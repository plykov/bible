"""Dead Sea Scrolls readings as verse parallels (ETCBC/CACCHT Text-Fabric data).

For every biblical verse attested in a scroll, collects each scroll's reading as
transcribed, keeping the editors' brackets: letters inside [ ] are modern
reconstructions, not preserved on the leather. DSS references use Hebrew
versification; they are mapped to our English chapter/verse through the Hebrew
refs recorded by TAHOT (e.g. Mal 3:19 -> Mal 4:1, Psalm titles -> verse 0).

Each reading is compared word by word with the Masoretic text (dss_compare.py).

Output: dss/{Book}/{ch}.json  {verse: [[scroll, fragments, text, codes, notes], ...]}
        dss/variants.json     {book: [[ch, verse, substantive differences, [scrolls]], ...]}
"""
import bisect
import re
from collections import defaultdict
from pathlib import Path

import tf
from dss_compare import compare

ROOT = Path(__file__).resolve().parent.parent
TF = ROOT / ".cache" / "sources" / "dss" / "tf" / "2.0.2"

# DSS book abbreviations -> STEP codes
BOOK_MAP = {
    "Gen": "Gen", "Ex": "Exo", "Lev": "Lev", "Num": "Num", "Deut": "Deu", "Josh": "Jos",
    "Judg": "Jdg", "Ruth": "Rut", "1Sam": "1Sa", "2Sam": "2Sa", "1Kgs": "1Ki", "2Kgs": "2Ki",
    "1Chr": "1Ch", "2Chr": "2Ch", "Ezra": "Ezr", "Neh": "Neh", "Esth": "Est", "Job": "Job",
    "Ps": "Psa", "Prov": "Pro", "Eccl": "Ecc", "Song": "Sng", "Is": "Isa", "Jer": "Jer",
    "Lam": "Lam", "Ezek": "Ezk", "Dan": "Dan", "Hos": "Hos", "Joel": "Jol", "Amos": "Amo",
    "Obad": "Oba", "Jonah": "Jon", "Mic": "Mic", "Nah": "Nam", "Hab": "Hab", "Zeph": "Zep",
    "Hag": "Hag", "Zech": "Zec", "Mal": "Mal",
}


def read_tf(name, parse=lambda v: v):
    return tf.read_tf(TF / f"{name}.tf", parse)


OPENERS = {"[": ("rec", 1), "]": ("rec", -1), "{": ("del", 1), "}": ("del", -1),
           "«": ("unc", 1), "»": ("unc", -1), "<": ("cor", 1), ">": ("cor", -1)}


def track(state, text):
    """Update which bracket types are open after one word's transcription.
    Brackets of one type never nest in this notation, so each is just open or
    closed; counting depth would let one unbalanced '[' leak into later verses."""
    for c in text:
        if c in OPENERS:
            k, d = OPENERS[c]
            state[k] = 1 if d > 0 else 0
        elif c == "^":
            state["sup"] ^= 1


def reopen(state):
    """Markers that re-open brackets still open from a previous verse."""
    return ("[" if state["rec"] else "") + ("{" if state["del"] else "") + ("«" if state["unc"] else "") \
        + ("<" if state["cor"] else "") + ("^" if state["sup"] else "")


def preserved_letters(text):
    """Letters actually on the scroll: outside [ ] reconstruction brackets."""
    rec, n = False, 0
    for c in text:
        if c == "[":
            rec = True
        elif c == "]":
            rec = False
        elif "\u05d0" <= c <= "\u05ea" and not rec:
            n += 1
    return n


def build(chapters, out_dir, write_json):
    if not (TF / "otype.tf").exists():
        print("dss: source missing, skipping")
        return {}
    ranges = tf.read_otype(TF / "otype.tf")

    # Hebrew ref -> English (ch, vs), from TAHOT
    heb2eng = {}
    for (book, ch), verses in chapters.items():
        for n, v in verses.items():
            hc, hv = (v.get("h") or f"{ch}.{n}").split(".")
            heb2eng[(book, int(hc), int(hv))] = (ch, n)

    book = read_tf("book")
    chapter = read_tf("chapter")
    verse = read_tf("verse")
    full = read_tf("full")
    after = read_tf("after")
    scroll = read_tf("scroll")
    fragment = read_tf("fragment")
    oslots = read_tf("oslots", tf.slot_bounds)  # node -> (first slot, last slot)

    # Fragment slot ranges -> (scroll, fragment label), for locating each word.
    fa, fb = ranges["fragment"]
    frags = sorted((oslots[n][0], oslots[n][1], n) for n in range(fa, fb + 1) if n in oslots)
    starts = [f[0] for f in frags]

    def where(word_node):
        s = oslots[word_node][0]
        i = bisect.bisect_right(starts, s) - 1
        if i >= 0 and frags[i][0] <= s <= frags[i][1]:
            n = frags[i][2]
            return scroll.get(n, "?"), fragment.get(n, "")
        return "?", ""

    readings = defaultdict(lambda: defaultdict(lambda: {"frags": [], "words": []}))
    # Bracket state per scroll, followed in reading order across all its words,
    # because a reconstruction [ ... ] can open in one verse and close in the next.
    states = defaultdict(lambda: {"rec": 0, "del": 0, "unc": 0, "cor": 0, "sup": 0})
    unmapped = 0
    wa, wb = ranges["word"]
    for w in range(wa, wb + 1):
        text = full.get(w)
        sc, fr = where(w) if text or w in book else ("?", "")
        state = states[sc]
        if state.get("frag") != fr:  # nothing carries across a physical break
            state.update({"rec": 0, "del": 0, "unc": 0, "cor": 0, "sup": 0, "frag": fr})
        code = BOOK_MAP.get(book.get(w))
        c, v = chapter.get(w, ""), verse.get(w, "")
        eng = heb2eng.get((code, int(c), int(v))) if code and c.isdigit() and v.isdigit() else None
        if code and c.isdigit() and v.isdigit() and not eng:
            unmapped += 1
        if eng and text:
            r = readings[(code, *eng)][sc]
            if fr and fr not in r["frags"]:
                r["frags"].append(fr)
            if not r["words"]:
                r["words"].append(reopen(state))
            # Spaces inside a word only pad brackets ("[ יצדיק"); word breaks come from `after`.
            r["words"].append(text.replace(" ", "") + (" " if after.get(w) else ""))
        if text:
            track(state, text)

    def scroll_key(name):
        m = re.match(r"(\d*)(\D+)(\d*)(.*)", name)
        return (int(m.group(1) or 0), m.group(2), int(m.group(3) or 0), m.group(4)) if m else (0, name, 0, "")

    by_chapter = defaultdict(dict)
    coverage = defaultdict(int)
    for (code, ch, vs), scrolls in readings.items():
        rows = []
        for sc in sorted(scrolls, key=scroll_key):
            text = re.sub(r"\s+", " ", "".join(scrolls[sc]["words"])).strip()
            if preserved_letters(text):  # skip placeholders such as "ε ε ׃"
                codes, notes = compare(text, chapters[(code, ch)][vs])
                rows.append([sc, ", ".join(scrolls[sc]["frags"]), text, codes, notes])
        if rows:
            by_chapter[(code, ch)][vs] = rows
            coverage[code] += 1
    for (code, ch), verses in by_chapter.items():
        write_json(out_dir / "dss" / code / f"{ch}.json", dict(sorted(verses.items())))

    # Index of verses where a scroll differs substantively from the Masoretic text:
    # a different word (x), an extra word (+) or an omission (-), on preserved letters.
    variants = defaultdict(list)
    for (code, ch), verses in by_chapter.items():
        for vs, rows in verses.items():
            n, scrolls = 0, []
            for sc, _, _, codes, notes in rows:
                k = codes.count("x") + codes.count("+") + sum(1 for nt in notes if nt[1] == "-")
                if k:
                    n += k
                    scrolls.append(sc)
            if n:
                variants[code].append([ch, vs, n, scrolls])
    order = list(BOOK_MAP.values())
    write_json(out_dir / "dss" / "variants.json",
               {b: sorted(v) for b, v in sorted(variants.items(), key=lambda x: order.index(x[0]))})
    print(f"dss: {sum(coverage.values())} verses in {len(coverage)} books, "
          f"{len({sc for r in readings.values() for sc in r})} scrolls"
          + (f", {unmapped} words with no matching verse" if unmapped else "")
          + f"; {sum(len(v) for v in variants.values())} verses with substantive differences from the MT")
    return dict(coverage)
