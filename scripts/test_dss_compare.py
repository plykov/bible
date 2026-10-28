#!/usr/bin/env python3
"""Known cases for the DSS ↔ Masoretic word classifier (scripts/dss_compare.py).

Spelling-only differences typical of the scrolls must not be flagged as
variants, and real variants must be."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dss_compare import classify, consonants  # noqa: E402

CASES = [
    # scroll, Masoretic, expected   (s = spelling only, m = prefix/grammar, x = different word)
    ("לוא", "לא", "s"), ("ולוא", "לא", "m"), ("פרעוה", "פרעה", "s"), ("נפשוה", "נפשו", "s"),
    ("כיא", "כי", "s"), ("הואה", "הוא", "s"), ("וחמשא", "וחמשה", "s"), ("היא", "הוא", "s"),
    ("יסבול", "יסבל", "s"), ("הזת", "הזאת", "s"), ("ושמרתה", "ושמרת", "s"),
    ("ולשופט", "ושפט", "m"), ("וישבע", "ישבע", "m"), ("השוכן", "שכן", "m"),
    ("עבדו", "עבדי", "x"),      # Isa 53:11 1QIsaᵃ "his servant" vs MT "my servant"
    ("אלוהים", "ישראל", "x"),   # Deut 32:8 4QDeutʲ "sons of God" vs "sons of Israel"
    ("חציל", "חציר", "x"),      # Isa 40:8 1QIsaᵃ
    ("על", "אל", "x"),
    ("עוזיה", "עזיהו", "s"),    # theophoric name spelling, Isa 1:1
]

bad = [(a, b, want, classify(consonants(a), {consonants(b)})) for a, b, want in CASES]

# Whole readings: Deut 32:8 4QDeutʲ, where a bracket after אלוהים must not hide it.
from dss_compare import compare  # noqa: E402
verse = {"w": [{"t": t} for t in "בְּהַנְחֵל עֶלְיוֹן גּוֹיִם בְּהַפְרִידוֹ בְּנֵי אָדָם יַצֵּב גְּבֻלֹת עַמִּים לְמִסְפַּר בְּנֵי יִשְׂרָאֵל".split()]}
codes, notes = compare("[בהנחי[ל עליון גוים בהפריד׳ו בני אדם יצב גבלת עמים למספר] בני אלוהים[ ε ׃", verse)
if codes[11] != "x" or notes != [[11, "x", "יִשְׂרָאֵל"]]:
    bad.append(("Deut 32:8 reading", "", "x at word 12", f"{codes} {notes}"))
bad = [x for x in bad if x[2] != x[3]]
# Word order: Isa 1:30-style transposition is one minor difference, not + and −.
v2 = {"w": [{"t": t} for t in "כִּי תִהְיוּ כְּאֵלָה נֹבֶלֶת עָלֶהָ וּכְגַנָּה אֲשֶׁר מַיִם אֵין לָהּ".split()]}
codes, notes = compare("כיא תהיו כאלה נובלת עליה וכגנה אשר אין מים לה ׃", v2)
if "+" in codes or any(n[1] == "-" for n in notes):
    bad.append(("Isa 1:30 transposition", "", "no +/−", f"{codes} {notes}"))

print(f"{len(CASES) + 2} cases, {len(bad)} wrong")
for a, b, want, got in bad:
    print(f"  {a} vs {b}: expected {want}, got {got}")
sys.exit(1 if bad else 0)
