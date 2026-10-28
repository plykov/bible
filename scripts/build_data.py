#!/usr/bin/env python3
"""Build the static JSON data for the web app from the pinned upstream sources.

Run scripts/fetch_sources.py first. Output goes to web/data/ (git-ignored;
GitHub Actions rebuilds it on every deploy).

Layout produced:
  books.json                      book list and chapter counts
  text/{Book}/{ch}.json           interlinear words per verse (OT: TAHOT, NT: TAGNT)
  lxx/{Book}/{ch}.json            Swete LXX words per verse
  lex/{H|G}{bucket}.json          brief lexicon + renderings + counts, 100 numbers per file
  lsj/G{bucket}.json              full LSJ entries (TFLSJ), Greek only
  occ/{H|G}{bucket}.json          every occurrence of every lemma
  search/en/{xx}.json             English stem -> lemmas index, sharded by first 2 letters
  lemmas.json                     compact lemma list for Hebrew/Greek/Strong's lookup
  morph/{heb,grk}.json            morphology code expansions
  rel/{H|G}{bucket}.json          related words: synonyms, semantic domains, LXX equivalents
  domains.json                    semantic domain labels + member lemmas
  phrase/verses.json              verse refs in canonical order (ids used by the phrase index)
  phrase/{xx}.json                positional English index: stem -> delta-encoded [verse, pos, word]
  meta.json                       build info + source commits (for the credits page)
"""
import html
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from books import BOOKS, SWETE_BOOKS  # noqa: E402
import build_related  # noqa: E402
from stem import stem, tokens  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".cache" / "sources"
STEP = SRC / "stepbible"
OUT = ROOT / "web" / "data"

BOOK_CODES = {b[0] for b in BOOKS}
OT_CODES = {b[0] for b in BOOKS if b[2] == "OT"}
ALL_EDITIONS = "NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz"

# Matches TAHOT/TAGNT word rows, e.g. "Mal.4.1(3.19)#01=L" or "Act.2.11[2.10]#01=NKO"
REF_RE = re.compile(r"^(\w+)\.(\d+)\.(\d+)((?:[\[\(\{]\d+\.\d+[\]\)\}])*)#(\d+)=(.+)$")
ALT_RE = re.compile(r"([\[\(\{])(\d+\.\d+)[\]\)\}]")


def write_json(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def bucket(strong):
    """'H0430G' -> 'H04'  (100 Strong's numbers per shard file)."""
    m = re.match(r"([HG])(\d+)", strong)
    return f"{m.group(1)}{int(m.group(2)) // 100:02d}" if m else None


def step_file(pattern):
    files = sorted(STEP.glob(pattern))
    if not files:
        sys.exit(f"missing source file {pattern}; run scripts/fetch_sources.py")
    return files


def data_rows(path):
    with open(path, encoding="utf-8-sig") as f:
        for line in f:
            if REF_RE.match(line.split("\t", 1)[0]):
                yield line.rstrip("\n").split("\t")


# ---------------------------------------------------------------- HTML cleanup

class _Sanitizer(HTMLParser):
    """Whitelist sanitizer for lexicon HTML. Keeps formatting, turns STEP <ref>
    tags into data-ref links, and turns citation anchors into title spans."""

    KEEP = {"b", "i", "em", "strong", "br", "sup", "sub", "p", "ul", "ol", "li", "small"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "br":
            self.out.append("<br>")
        elif tag in self.KEEP:
            self.out.append(f"<{tag}>")
            self.stack.append(tag)
        elif tag == "a" and a.get("data-ref"):
            self.out.append(f'<a data-ref="{html.escape(a["data-ref"])}">')
            self.stack.append("a")
        elif tag == "a" and a.get("title"):
            self.out.append(f'<span class="cite" title="{html.escape(a["title"])}">')
            self.stack.append("span")
        else:
            self.stack.append(None)

    def handle_endtag(self, tag):
        if tag == "br":
            return
        while self.stack:
            t = self.stack.pop()
            if t:
                self.out.append(f"</{t}>")
            if t == tag or (tag == "a" and t in ("a", "span")) or t is None:
                break

    def handle_data(self, data):
        self.out.append(html.escape(data, quote=False))


def clean_html(raw):
    if not raw:
        return ""
    raw = re.sub(r"<ref=['\"]([^'\"]+)['\"]>", r'<a data-ref="\1">', raw)
    raw = raw.replace("</ref>", "</a>")
    s = _Sanitizer()
    s.feed(raw)
    s.close()
    while s.stack:
        t = s.stack.pop()
        if t:
            s.out.append(f"</{t}>")
    return "".join(s.out).strip()


# ---------------------------------------------------------------- lexicons

def load_lexicon(pattern):
    """TBESH/TBESG/TFLSJ rows -> {dStrong: entry}. Columns:
    eStrong, 'dStrong = relation', uStrong, lemma, translit, morph, gloss, meaning."""
    lex = {}
    for path in step_file(pattern):
        with open(path, encoding="utf-8-sig") as f:
            for line in f:
                c = line.rstrip("\n").split("\t")
                if len(c) < 8 or not re.match(r"^[HG]\d{4}", c[0]):
                    continue
                key = c[1].split(" ")[0].strip() or c[0]
                rel = c[1][len(key):].strip(" =")
                lex[key] = {
                    "e": c[0], "u": c[2], "l": c[3], "x": c[4], "m": c[5], "g": c[6],
                    "d": c[7], "rel": rel,
                }
    return lex


def resolver(lex):
    """Map a dStrong from the texts to a key that exists in the lexicon."""
    by_e = defaultdict(list)
    for k, v in lex.items():
        by_e[v["e"].upper()].append(k)
    cache = {}

    def resolve(s):
        if s in cache:
            return cache[s]
        r = None
        if s in lex:
            r = s
        else:
            base = re.match(r"([HG]\d{4})", s)
            if base:
                b = base.group(1)
                for cand in (b, b + "G", b + "A"):
                    if cand in lex:
                        r = cand
                        break
                if not r and by_e.get(b):
                    r = sorted(by_e[b])[0]
        cache[s] = r or s
        return cache[s]

    return resolve


# ---------------------------------------------------------------- morphology

def load_morph(pattern):
    """TEHMC/TEGMC: records separated by '$' lines. First line 'CODE\\tFunction=..',
    then a readable description, an explanation, and an example."""
    out = {}
    for path in step_file(pattern):
        rec = []
        with open(path, encoding="utf-8-sig") as f:
            for line in f:
                line = line.rstrip("\n")
                if line.strip() == "$":
                    if rec and "\t" in rec[0]:
                        code = rec[0].split("\t")[0].strip()
                        lines = [r.strip().strip('"') for r in rec[1:] if r.strip()]
                        if code and lines:
                            out[code] = lines[:3]
                    rec = []
                else:
                    rec.append(line)
    return out


# ---------------------------------------------------------------- gloss parsing

def gloss_terms(gloss):
    """English tokens in a gloss, skipping <untranslated> and [implied] words."""
    g = re.sub(r"<[^>]*>", " ", gloss)
    g = re.sub(r"\[[^\]]*\]", " ", g)
    return tokens(g)


def clean_gloss(g):
    """Display form of a gloss: morpheme slashes removed, edge punctuation trimmed."""
    g = re.sub(r"\s+", " ", g.replace("/", " ")).strip()
    return g.strip(" .,;:!?\u00b6\"'\u2019\u201c\u201d()")


def root_meaning(expanded):
    """From TAHOT 'Expanded Strong tags', pull the root's sub-meaning.
    '{H6965B=קוּם=: rise»to arise:1_rise;_get_going}' -> 'to arise: 1 rise; get going'"""
    m = re.search(r"\{[HG]\w+=[^=]*=([^}]*)\}", expanded or "")
    if not m:
        return ""
    rest = m.group(1)
    if "@" in rest:  # proper-name ID (e.g. 'God»LORD@Gen.1.1-Heb'), not a sense
        return ""
    if "»" in rest:
        rest = rest.split("»", 1)[1]
    return rest.replace("_", " ").strip(" :")


def sub_meaning(raw):
    """TAGNT 'Sub-meaning' column, e.g. ': since»that/since|2_since' -> 'that/since: 2 since'."""
    if not raw:
        return ""
    if "@" in raw:
        return ""
    s = raw.split("»", 1)[1] if "»" in raw else raw
    s = s.replace("|", ": ").replace("_", " ")
    return s.strip(" :")


# ---------------------------------------------------------------- builders

class Collector:
    """Accumulates occurrences and English renderings per lemma."""

    def __init__(self):
        self.occ = defaultdict(list)            # strong -> [[ref, word#, gloss_i, sense_i]]
        self.glosses = defaultdict(list)        # strong -> [distinct gloss]
        self.gloss_ix = defaultdict(dict)
        self.senses = defaultdict(list)
        self.sense_ix = defaultdict(dict)
        self.renderings = defaultdict(Counter)  # strong -> Counter(gloss key)
        self.display = defaultdict(Counter)     # (strong, gloss key) -> Counter(display form)
        self.stems = defaultdict(Counter)       # stem -> Counter(strong)

    def _ix(self, table, index, strong, value):
        if value not in index[strong]:
            index[strong][value] = len(table[strong])
            table[strong].append(value)
        return index[strong][value]

    def add(self, strong, ref, word_no, gloss, sense):
        g = clean_gloss(gloss)
        key = g.lower()
        gi = self._ix(self.glosses, self.gloss_ix, strong, key)
        si = self._ix(self.senses, self.sense_ix, strong, sense or "")
        self.occ[strong].append([ref, word_no, gi, si])
        self.display[(strong, key)][g] += 1
        if key:
            self.renderings[strong][key] += 1
        for st in {stem(t) for t in gloss_terms(gloss)}:
            self.stems[st][strong] += 1

    def shown(self, strong, key):
        """Most common original casing of a gloss key ('God', not 'god')."""
        d = self.display.get((strong, key))
        return d.most_common(1)[0][0] if d else key


def build_ot(col, resolve, chapters):
    stats = Counter()
    for path in step_file("Translators Amalgamated OT+NT/TAHOT*"):
        for c in data_rows(path):
            m = REF_RE.match(c[0])
            book, ch, vs, alt, wno, typ = m.groups()
            if book not in BOOK_CODES:
                continue
            c += [""] * (12 - len(c))
            heb = ALT_RE.search(alt)
            hebrew, translit, gloss, dstr, morph = c[1], c[2], c[3], c[4], c[5]
            parts_s = [p for p in dstr.split("/")]
            parts_g = gloss.split("/")
            # Root lemma is the tag in {braces}; strip punctuation tags after "\".
            root = re.search(r"\{(H\d{4}\w?)\}", dstr)
            root = resolve(root.group(1)) if root else None
            sense = root_meaning(c[11])
            word = {"t": hebrew, "x": translit, "g": gloss, "d": dstr, "m": morph}
            if root:
                word["s"] = root
            if typ != "L":
                word["k"] = typ
            if c[6].strip():
                word["mv"] = c[6].strip()
            if c[7].strip():
                word["sv"] = c[7].strip()
            if sense:
                word["sm"] = sense
            key = (book, int(ch))
            verse = chapters[key].setdefault(int(vs), {"w": []})
            if heb and heb.group(2) != f"{ch}.{vs}":
                verse["h"] = heb.group(2)
            verse["w"].append(word)
            ref = f"{book}.{ch}.{vs}"
            wi = len(verse["w"])
            # Align English pieces with morpheme tags when the counts match.
            if len(parts_s) == len(parts_g):
                for ps, pg in zip(parts_s, parts_g):
                    tag = re.search(r"H\d{4}\w?", ps.split("\\")[0])
                    if tag:
                        s = resolve(tag.group(0))
                        col.add(s, ref, wi, pg, sense if s == root else "")
            elif root:
                col.add(root, ref, wi, gloss, sense)
                stats["unaligned"] += 1
            stats["words"] += 1
    return stats


def build_nt(col, resolve, chapters):
    stats = Counter()
    for path in step_file("Translators Amalgamated OT+NT/TAGNT*"):
        for c in data_rows(path):
            m = REF_RE.match(c[0])
            book, ch, vs, alt, wno, typ = m.groups()
            if book not in BOOK_CODES:
                continue
            c += [""] * (14 - len(c))
            gm = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", c[1])
            greek, translit = (gm.group(1), gm.group(2)) if gm else (c[1], "")
            strong, _, morph = c[3].partition("=")
            strong = resolve(strong.strip())
            sense = sub_meaning(c[9])
            word = {"t": greek, "x": translit, "g": c[2], "s": strong, "m": morph.strip()}
            if typ != "NKO":
                word["k"] = typ
            if c[5].strip() != ALL_EDITIONS:
                word["e"] = c[5].strip()
            if c[6].strip():
                word["mv"] = c[6].strip()
            if c[7].strip():
                word["sv"] = c[7].strip()
            if c[13].strip():
                word["vn"] = c[13].strip()
            if sense:
                word["sm"] = sense
            key = (book, int(ch))
            verse = chapters[key].setdefault(int(vs), {"w": []})
            if alt:
                verse["alt"] = alt
            verse["w"].append(word)
            col.add(strong, f"{book}.{ch}.{vs}", len(verse["w"]), c[2], sense)
            stats["words"] += 1
    return stats


ARTICLES = {"the", "a", "an"}


def phrase_tokens(gloss):
    """English tokens of one word's gloss for the phrase index: <untranslated>
    parts dropped, [implied] words kept, articles dropped (the query drops them too)."""
    g = re.sub(r"<[^>]*>", " ", gloss).replace("[", " ").replace("]", " ")
    return [stem(t) for t in tokens(g) if t not in ARTICLES]


def build_phrase_index(chapters):
    """Positional index over the interlinear English, for exact short-phrase search.
    Each posting is (verse id, token position in verse, word number); per stem the
    list is flattened and verse ids are delta-encoded to keep the JSON small."""
    order = {code: i for i, (code, _, _) in enumerate(BOOKS)}
    refs, postings = [], defaultdict(list)
    ot_count = 0
    for (book, ch), verses in sorted(chapters.items(), key=lambda x: (order[x[0][0]], x[0][1])):
        for n, v in sorted(verses.items()):
            vid = len(refs)
            refs.append(f"{book}.{ch}.{n}")
            if book in OT_CODES:
                ot_count = vid + 1
            pos = 0
            for wi, w in enumerate(v["w"], 1):
                for st in phrase_tokens(w["g"]):
                    postings[st].append((vid, pos, wi))
                    pos += 1
    shards = defaultdict(dict)
    for st, plist in postings.items():
        flat, prev = [], 0
        for vid, pos, wi in plist:
            flat += [vid - prev, pos, wi]
            prev = vid
        shards[(st + "_")[:2]][st] = flat
    write_json(OUT / "phrase" / "verses.json", {"refs": refs, "ot": ot_count})
    for p, entries in shards.items():
        write_json(OUT / "phrase" / f"{p}.json", entries)
    print(f"phrase index: {len(refs)} verses, {len(postings)} stems, "
          f"{sum(len(p) for p in postings.values())} tokens")


def build_lxx():
    base = SRC / "swete"
    if not base.exists():
        print("swete: not fetched, skipping LXX")
        return {}
    starts = []
    for line in (base / "00-Swete_versification.csv").read_text(encoding="utf-8").splitlines():
        i, ref = line.split("\t")
        starts.append((int(i), ref))
    words = {}
    for name, idx in (("01-Swete_word_with_punctuations.csv", 0), ("03-Swete_SBL_transliterations.csv", 1)):
        for line in (base / name).read_text(encoding="utf-8").splitlines():
            i, w = line.split("\t", 1)
            words.setdefault(int(i), ["", ""])[idx] = w
    max_i = max(words)
    chapters = defaultdict(dict)
    for n, (start, ref) in enumerate(starts):
        end = starts[n + 1][0] if n + 1 < len(starts) else max_i + 1
        bk, cv = ref.split(".", 1)
        ch, vs = cv.split(":")
        code = SWETE_BOOKS.get(bk)
        if not code:  # deuterocanonical / additional books: not used for now
            continue
        chapters[(code, int(ch))][int(vs)] = [words[i] for i in range(start, end) if i in words]
    for (code, ch), verses in chapters.items():
        write_json(OUT / "lxx" / code / f"{ch}.json", verses)
    lxx_books = defaultdict(int)
    for code, ch in chapters:
        lxx_books[code] = max(lxx_books[code], ch)
    print(f"lxx: {len(chapters)} chapters, {sum(len(v) for v in words.values()) and len(words)} words")
    return dict(lxx_books)


def main():
    if OUT.exists():
        import shutil
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    heb_lex = load_lexicon("Lexicons/TBESH*")
    grk_lex = load_lexicon("Lexicons/TBESG*")
    lsj = load_lexicon("Lexicons/TFLSJ*")
    lex = {**heb_lex, **grk_lex}
    resolve = resolver(lex)
    print(f"lexicon: {len(heb_lex)} Hebrew/Aramaic, {len(grk_lex)} Greek, {len(lsj)} LSJ")

    col = Collector()
    chapters = defaultdict(dict)
    ot = build_ot(col, resolve, chapters)
    nt = build_nt(col, resolve, chapters)
    print(f"OT: {ot['words']} words ({ot['unaligned']} gloss/morpheme count mismatches); NT: {nt['words']} words")

    # Text shards
    chapter_counts = defaultdict(int)
    for (book, ch), verses in chapters.items():
        write_json(OUT / "text" / book / f"{ch}.json",
                   [{"n": n, **v} for n, v in sorted(verses.items())])
        chapter_counts[book] = max(chapter_counts[book], ch)

    build_phrase_index(chapters)
    lxx_books = build_lxx()

    books = [{"id": code, "name": name, "t": t, "ch": chapter_counts.get(code, 0),
              "lxx": lxx_books.get(code, 0) if t == "OT" else 0}
             for code, name, t in BOOKS]
    write_json(OUT / "books.json", {"books": books})

    # Lexicon shards (only keys we have) + rendering stats
    shards = defaultdict(dict)
    for key, v in lex.items():
        b = bucket(key)
        if not b:
            continue
        rend = col.renderings.get(key, Counter())
        entry = {k: v[k] for k in ("l", "x", "m", "g", "u", "rel")}
        entry["d"] = clean_html(v["d"])
        entry["n"] = len(col.occ.get(key, []))
        entry["r"] = [[col.shown(key, g), n] for g, n in rend.most_common(40)]
        shards[b][key] = entry
    for b, entries in shards.items():
        write_json(OUT / "lex" / f"{b}.json", entries)

    lsj_shards = defaultdict(dict)
    for key, v in lsj.items():
        b = bucket(key)
        if b:
            lsj_shards[b][key] = clean_html(v["d"])
    for b, entries in lsj_shards.items():
        write_json(OUT / "lsj" / f"{b}.json", entries)

    # Occurrence shards
    occ_shards = defaultdict(dict)
    for s, occ in col.occ.items():
        b = bucket(s)
        if b:
            occ_shards[b][s] = {"g": [col.shown(s, g) for g in col.glosses[s]], "s": col.senses[s], "o": occ}
    for b, entries in occ_shards.items():
        write_json(OUT / "occ" / f"{b}.json", entries)

    # English search index: rendering counts from interlinear glosses, plus a
    # lower-weight "dictionary" list from the lexicon gloss, for words the
    # interlinear never uses.
    index = defaultdict(lambda: {"r": [], "lx": []})
    for st, cnt in col.stems.items():
        index[st]["r"] = cnt.most_common()
    for key, v in lex.items():
        for st in {stem(t) for t in gloss_terms(v["g"])}:
            if key not in col.stems.get(st, {}):
                index[st]["lx"].append(key)
    search_shards = defaultdict(dict)
    for st, v in index.items():
        if not v["lx"]:
            del v["lx"]
        search_shards[(st + "_")[:2]][st] = v
    for p, entries in search_shards.items():
        write_json(OUT / "search" / "en" / f"{p}.json", entries)

    # Lemma list for original-language lookup: [strong, lemma, translit, gloss, count]
    lemmas = [[k, v["l"], v["x"], v["g"], len(col.occ.get(k, []))]
              for k, v in sorted(lex.items()) if bucket(k)]
    write_json(OUT / "lemmas.json", lemmas)

    build_related.build(resolve, lex, chapters, OUT, write_json, bucket)

    write_json(OUT / "morph" / "heb.json", load_morph("Morphology codes/TEHMC*"))
    write_json(OUT / "morph" / "grk.json", load_morph("Morphology codes/TEGMC*"))

    sources = json.loads((ROOT / "scripts" / "sources.json").read_text())
    write_json(OUT / "meta.json", {
        "sources": {k: {x: v[x] for x in ("commit", "license", "credit", "url")}
                    for k, v in sources.items() if not k.startswith("_")},
        "counts": {"ot_words": ot["words"], "nt_words": nt["words"], "lemmas": len(lemmas)},
    })

    unresolved = sorted({s for s in col.occ if s not in lex})
    if unresolved:
        print(f"warning: {len(unresolved)} tags missing from lexicon, e.g. {unresolved[:8]}")
    total = sum(f.stat().st_size for f in OUT.rglob("*.json"))
    print(f"wrote {sum(1 for _ in OUT.rglob('*.json'))} files, {total / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
