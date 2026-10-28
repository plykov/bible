"""English stemmer shared (rule-for-rule) with web/app/stem.js.

Porter step 1 with the Porter2 refinements for -s/-ies/-y, plus an irregular-form
table. Only inflections are folded (loved/loves/loving -> love); derivations such
as 'creation' stay distinct, which keeps search results precise.
Keep the two implementations in sync; scripts/test_stem.py checks they agree.
"""
import json
import re
from pathlib import Path

_TABLE = json.loads((Path(__file__).resolve().parent.parent / "web" / "app" / "stem-irregular.json").read_text())
IRREGULAR = _TABLE["map"]
KEEP = set(_TABLE["keep"])
VOWELS = set("aeiou")


def _is_cons(w, i):
    c = w[i]
    if c in VOWELS:
        return False
    if c == "y":
        return i == 0 or not _is_cons(w, i - 1)
    return True


def _measure(w):
    """Porter's m: number of VC sequences."""
    m, i, n = 0, 0, len(w)
    while i < n and _is_cons(w, i):
        i += 1
    while i < n:
        while i < n and not _is_cons(w, i):
            i += 1
        if i >= n:
            break
        while i < n and _is_cons(w, i):
            i += 1
        m += 1
    return m


def _has_vowel(w):
    return any(not _is_cons(w, i) for i in range(len(w)))


def _ends_cvc(w):
    n = len(w)
    return (n >= 3 and _is_cons(w, n - 3) and not _is_cons(w, n - 2)
            and _is_cons(w, n - 1) and w[-1] not in "wxy")


def _step1a(w):
    if w.endswith("sses"):
        return w[:-2]
    if w.endswith("ied") or w.endswith("ies"):
        return w[:-2] if len(w) > 4 else w[:-1]
    if w.endswith("us") or w.endswith("ss"):
        return w
    if w.endswith("s") and len(w) > 2:
        stem = w[:-1]
        if any(c in VOWELS for c in stem[:-1]):
            return stem
    return w


def _step1b(w):
    if w.endswith("eed"):
        return w[:-1] if _measure(w[:-3]) > 0 else w
    for suf in ("ed", "ing"):
        if w.endswith(suf):
            stem = w[: -len(suf)]
            if not _has_vowel(stem):
                return w
            if stem.endswith(("at", "bl", "iz")):
                return stem + "e"
            if (len(stem) >= 2 and stem[-1] == stem[-2] and _is_cons(stem, len(stem) - 1)
                    and stem[-1] not in "lsz"):
                return stem[:-1]
            if _measure(stem) == 1 and _ends_cvc(stem):
                return stem + "e"
            return stem
    return w


def _step1c(w):
    if len(w) > 2 and w[-1] == "y" and _is_cons(w, len(w) - 2):
        return w[:-1] + "i"
    return w


def stem(word):
    w = word.lower()
    w = IRREGULAR.get(w, w)
    if w in KEEP or len(w) <= 2:
        return w
    return _step1c(_step1b(_step1a(w)))


_TOKEN = re.compile(r"[a-z]+(?:'[a-z]+)?")


def tokens(text):
    """Lower-case English word tokens; drops possessive 's."""
    out = []
    for t in _TOKEN.findall(text.lower()):
        if t.endswith("'s"):
            t = t[:-2]
        out.append(t.replace("'", ""))
    return out
