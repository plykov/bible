"""Word-level comparison of a Dead Sea Scrolls reading with the Masoretic text.

Each scroll token gets one code:
  =  same consonants as the aligned Masoretic word
  s  spelling only: differs just by vowel letters (ו י, word-final ה א)
  m  minor: differs only by a one-letter prefix (ו ה ב ל כ מ) or a final ה
  x  a different word (the MT word is recorded for display)
  +  a word the Masoretic text doesn't have
  ?  differs, but the token is (partly) reconstructed: not evidence
  u  differs, but has uncertain letters: possible difference
  -  not comparable (punctuation, missing-letter marks, vacat)
Masoretic words with no counterpart are reported as omissions, but only between
two fully preserved scroll words: gaps at fragment edges are damage, not variants.

The Masoretic side is TAHOT's text; words it restores from the LXX (X) or from
parallels (R) are not Masoretic and are skipped. Where TAHOT follows the Qere,
the Ketiv (closer to the scrolls' consonants) is accepted as well.
"""
import re

FINALS = str.maketrans("ךםןףץ", "כמנפצ")
HEB = re.compile(r"[א-ת]")


def consonants(s):
    return "".join(HEB.findall(s)).translate(FINALS)


def skeletons(c):
    """Possible consonantal skeletons of a word, ignoring vowel letters.
    First and last letters are kept (a final ו/י is a pronoun suffix: עבדו "his
    servant" ≠ עבדי "my servant"); interior ו י א are dropped (the scrolls add or
    omit them: יסבול / יסבל, הזאת / הזת). Long endings typical of the scrolls are
    normalised: names ending יהו = יה (עזיהו / עזיה); final וה → ו or ה (נפשוה = נפשו; פרעוה = פרעה), אה → א (הואה),
    יא → י (כיא), תה → ת (ושמרתה), כה → כ, מה → מ; final א ≡ ה (חמשא / חמשה)."""
    forms = {c}
    if c.endswith("יהו"):  # theophoric names: עזיהו = עזיה, יחזקיהו = יחזקיה
        forms.add(c[:-1])
    for end, shorts in (("וה", ("ו", "ה")), ("אה", ("א",)), ("יא", ("י",)), ("תה", ("ת",)),
                        ("כה", ("כ",)), ("מה", ("מ",))):
        if c.endswith(end) and len(c) > len(end):
            forms |= {c[: -len(end)] + sh for sh in shorts}
    out = set()
    for f in forms:
        if f.endswith("א") and len(f) > 1:
            f = f[:-1] + "ה"
        out.add(f[0] + re.sub("[ויא]", "", f[1:-1]) + f[-1] if len(f) > 2 else f)
    return out


def skeleton(c):
    """One representative skeleton (for similarity scoring)."""
    # Ties broken alphabetically: set order varies between runs (hash seeds).
    return min(skeletons(c), key=lambda x: (len(x), x)) if c else c


def similarity(a, b):
    """Dice overlap of the skeletons' letters, 0..1."""
    a, b = skeleton(a), skeleton(b)
    if not a or not b:
        return 0.0
    common = sum(min(a.count(ch), b.count(ch)) for ch in set(a))
    return 2 * common / (len(a) + len(b))


PREFIXES = "והבלכמ"


def minor_forms(c):
    """Skeletons of the word with up to two prefix letters (and, the, in, to, as,
    from) or a final ה removed: differences here are grammatical, not lexical."""
    out = {c}
    for _ in range(2):
        out |= {x[1:] for x in out if len(x) > 2 and x[0] in PREFIXES}
    out |= {x[:-1] for x in out if len(x) > 2 and x.endswith("ה")}
    return set().union(*(skeletons(x) for x in out))


def classify(dss, mt_forms):
    """Compare one scroll word (consonants) with a Masoretic word (its forms)."""
    if dss in mt_forms:
        return "="
    sk = skeletons(dss)
    if any(sk & skeletons(f) for f in mt_forms):
        return "s"
    mine = minor_forms(dss)
    if any(mine & minor_forms(f) for f in mt_forms):
        return "m"
    return "x"


def mt_tokens(verse):
    out = []
    for w in verse["w"]:
        k = w.get("k", "L")
        if k[:1] in ("X", "R"):
            continue
        # Paragraph marks (ס setumah, פ petuchah) are not words.
        text = re.sub(r"[\\\s]+[ספ]\s*$", "", w["t"])
        cons = consonants(text)
        if not cons:
            continue
        forms = {cons}
        ketiv = re.search(r"K=[^(]*\(([^)]+)\)", w.get("mv", "") + " " + w.get("sv", ""))
        if ketiv:
            forms.add(consonants(ketiv.group(1)))
        out.append({"forms": forms, "shown": re.sub(r"[/\\֑-ֽ֯׀׃]", "", text).strip()})
    return out


def scroll_tokens(text):
    """Split a reading into tokens with letters, reconstruction and uncertainty."""
    rec = unc = False
    erased = 0
    out = []
    for raw in text.split(" "):
        if not raw:
            continue
        letters, n_rec, uncertain = [], 0, False
        for c in raw:
            if c == "[":
                rec = True
            elif c == "]":
                rec = False
            elif c == "{":
                erased += 1
            elif c == "}":
                erased = max(0, erased - 1)
            elif c == "«":
                unc = True
            elif c == "»":
                unc = False
            elif c in "#?|":
                uncertain = True
            elif HEB.match(c) and not erased:  # letters the scribe erased aren't text
                letters.append(c)
                n_rec += rec
                uncertain = uncertain or unc
        cons = "".join(letters).translate(FINALS)
        # "full": every letter preserved and no bracket between letters. A bracket
        # before or after the letters (אלוהים[ , ]יצלח) only touches its neighbours.
        inner = re.sub(r"^[^\u05d0-\u05ea]*|[^\u05d0-\u05ea]*$", "", raw)
        whole = n_rec == 0 and "[" not in inner and "]" not in inner
        out.append({"cons": cons, "rec": n_rec, "full": bool(cons) and whole, "unc": uncertain})
    return out


def compare(text, verse):
    """Returns (codes, notes): one code per space-separated token of `text`, and
    notes [[token index, kind, MT word]] for 'x' (substitution) and '-' (omission
    after that token index)."""
    toks = scroll_tokens(text)
    mt = mt_tokens(verse)
    idx = [i for i, t in enumerate(toks) if t["cons"]]
    a = [toks[i] for i in idx]
    n, m = len(a), len(mt)
    # A substitution must cost less than a gap, or a different word at a fragment
    # edge would come out as "extra word" plus a free gap.
    GAP = 0.8
    cost = {"=": 0.0, "s": 0.2, "m": 0.4}
    # Needleman-Wunsch; leading/trailing gaps on the MT side are free (fragments).
    D = [[0.0] * (m + 1) for _ in range(n + 1)]
    P = [[None] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        D[i][0], P[i][0] = D[i - 1][0] + GAP, "up"
    for j in range(1, m + 1):
        D[0][j], P[0][j] = 0.0, "left"
    cls = {}
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            c = cls[(i, j)] = classify(a[i - 1]["cons"], mt[j - 1]["forms"])
            # A different word costs more the less it resembles the MT word, so
            # alignment pairs related words and leaves unrelated ones as gaps.
            sub = cost[c] if c != "x" else 0.45 + 0.45 * (1 - max(similarity(a[i - 1]["cons"], f) for f in mt[j - 1]["forms"]))
            best = (D[i - 1][j - 1] + sub, "diag")
            up = (D[i - 1][j] + GAP, "up")
            left = (D[i][j - 1] + (0.0 if i == n else GAP), "left")
            D[i][j], P[i][j] = min(best, up, left)
    codes = ["-"] * len(toks)
    notes = []
    pairs = []
    i, j = n, m
    while i > 0 or j > 0:
        p = P[i][j]
        if p == "diag":
            pairs.append((i - 1, j - 1))
            i, j = i - 1, j - 1
        elif p == "up":
            pairs.append((i - 1, None))
            i -= 1
        else:
            pairs.append((None, j - 1))
            j -= 1
    pairs.reverse()
    last_tok = None
    for k, (ai, mj) in enumerate(pairs):
        if ai is not None:
            t, ti = a[ai], idx[ai]
            c = cls[(ai + 1, mj + 1)] if mj is not None else "+"
            if c in ("x", "+") and not t["full"]:
                c = "?"
            elif c in ("x", "+") and t["unc"]:
                c = "u"
            codes[ti] = c
            if c == "x":
                notes.append([ti, "x", mt[mj]["shown"]])
            last_tok = ai
        elif last_tok is not None:
            nxt = next((p[0] for p in pairs[k + 1:] if p[0] is not None), None)
            if nxt is not None and a[last_tok]["full"] and a[nxt]["full"]:
                notes.append([idx[last_tok], "-", mt[mj]["shown"]])
    # Word order: a scroll word marked "+" that matches a Masoretic word reported as
    # omitted in the same verse was moved, not added; keep it as a minor difference.
    for n in list(notes):
        if n[1] != "-":
            continue
        moved = next((i for i, c in enumerate(codes) if c == "+" and toks[i]["full"]
                      and skeletons(toks[i]["cons"]) & skeletons(consonants(n[2]))), None)
        if moved is not None:
            codes[moved] = "m"
            notes.remove(n)
    return "".join(codes), notes
