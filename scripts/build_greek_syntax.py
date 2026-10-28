"""Clause and constituent structure for the Greek New Testament (MACULA Greek, SBLGNT trees).

MACULA "lowfat" trees nest word groups; clauses are <wg class="cl">. Two kinds:
  - real clauses, whose rule is a constituent order such as V-O, S-V-O, P-VC-S;
  - structural wrappers: Conj-CL (and + clause), sub-CL (subordinator + clause),
    CLaCL (coordination), DetCL, that-VP, …
Only real clauses are shown. A word that sits only in a wrapper (καί, ὅτι, ἵνα)
is placed with the clause it introduces; indentation counts real clauses only.
Each word's role is the role of the clause constituent containing it
(s, v, vc, o, o2, io, p, adv, aux); MACULA's 'err_…' notes are ignored.

The app's NT text is TAGNT (8 editions), so SBLGNT words are aligned to the
TAGNT words found in the SBL edition, by normalised spelling, verse by verse.

Output: syntax/{Book}/{ch}.json, same shape as the Hebrew (build_bhsa.py):
  {verse: {"a": [[first, last, depth, rule, "", clause role, ""], ...],
           "p": [[role, constituent class], ...], "w": [constituent per word],
           "c": [clause per word]}}
Returns {(book, ch, vs, word): role} for annotating occurrences.
"""
import difflib
import re
import unicodedata
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOWFAT = ROOT / ".cache" / "sources" / "macula_greek" / "SBLGNT" / "lowfat"
ROLE_TOKENS = {"S", "V", "VC", "O", "O2", "IO", "ADV", "P", "AUX"}
ROLES = {"s", "v", "vc", "o", "o2", "io", "p", "adv", "aux"}


def norm(word):
    """Greek for matching: no accents/breathings, lower case, letters only, σ for ς."""
    s = unicodedata.normalize("NFD", word)
    s = "".join(c for c in s if not unicodedata.combining(c)).lower().replace("ς", "σ")
    return re.sub(r"[^\w]", "", s)


def same_word(a, b):
    """Equal, or equal up to elision (ἀλλά / ἀλλ’, δέ / δ’)."""
    if a == b:
        return True
    short, long_ = sorted((a, b), key=len)
    return len(long_) == len(short) + 1 and long_.startswith(short) and long_[-1] in "αεοι" and len(short) >= 2


def step_code(usfm):
    """'JHN' -> 'Jhn', '1CO' -> '1Co'"""
    return usfm[:2] + usfm[2:].lower() if usfm[0].isdigit() else usfm[0] + usfm[1:].lower()


def role_of(el):
    r = el.get("role")
    return r if r in ROLES else None


def is_real(wg):
    """A clause with its own constituents: some direct child carries a role.
    (Wrappers such as Conj-CL, sub-CL, CLaCL, DetCL never do; some real clauses
    have no rule at all.)"""
    return wg.get("class") == "cl" and any(role_of(c) for c in wg)


def clause_label(wg):
    """Constituent order: the rule when it is one (P-VC-S), else derived from the children."""
    rule = wg.get("rule") or ""
    if rule and all(t in ROLE_TOKENS for t in rule.split("-")):
        return rule
    return "-".join(role_of(c).upper() for c in wg if role_of(c))


def build(chapters, out_dir, write_json):
    files = sorted(LOWFAT.glob("*.xml"))
    if not files:
        print("macula greek syntax: source missing, skipping")
        return {}
    # Per verse: list of (normalised word, role, constituent element, clause element)
    verses = defaultdict(list)
    clause_info = {}  # id(clause) -> (depth, rule, role as a constituent of its parent)
    for f in files:
        root = ET.parse(f).getroot()
        parent = {c: p for p in root.iter() for c in p}

        def ancestors(el):
            while el in parent:
                el = parent[el]
                yield el

        for w in root.iter("w"):
            ref = w.get("ref")
            if not ref:
                continue
            m = re.match(r"(\w+) (\d+):(\d+)!", ref)
            book, ch, vs = step_code(m.group(1)), int(m.group(2)), int(m.group(3))
            # innermost real clause, and the constituent of it that holds the word
            clause, constituent = None, None
            for anc in [w, *ancestors(w)]:
                if anc is not w and is_real(anc):
                    clause = anc
                    break
                if role_of(anc):
                    constituent = anc  # keeps the outermost role-bearing group below the clause
            if clause is not None and id(clause) not in clause_info:
                depth = sum(1 for a in ancestors(clause) if is_real(a))
                # its role in the parent clause: first role on the way up to the next real clause
                crole = role_of(clause)
                for a in ancestors(clause):
                    if is_real(a):
                        break
                    crole = crole or role_of(a)
                clause_info[id(clause)] = (depth, clause_label(clause), crole or "")
            verses[(book, ch, vs)].append((norm(w.text or w.get("unicode") or ""), w, constituent, clause))

    out = defaultdict(dict)
    roles = {}
    stats = Counter()
    for (book, ch, vs), sbl in verses.items():
        tverse = chapters.get((book, ch), {}).get(vs)
        if not tverse:
            stats["verses unmapped"] += 1
            continue
        tw = tverse["w"]
        # TAGNT words in the SBL edition ('e' absent = all editions)
        t_idx = [i for i, w in enumerate(tw, 1) if "e" not in w or "SBL" in w["e"]]
        t_norm = [norm(tw[i - 1]["t"]) for i in t_idx]
        s_norm = [x[0] for x in sbl]
        pairs = {}
        if s_norm == t_norm:
            pairs = {k: t_idx[k] for k in range(len(sbl))}
            stats["verses identical"] += 1
        else:
            sm = difflib.SequenceMatcher(a=s_norm, b=t_norm, autojunk=False)
            for op, a1, a2, b1, b2 in sm.get_opcodes():
                if op == "equal" or (op == "replace" and a2 - a1 == b2 - b1):
                    for k in range(a2 - a1):
                        pairs[a1 + k] = t_idx[b1 + k]
            stats["verses aligned"] += 1
            # Word order: TAGNT follows NA order; SBL sometimes places a word elsewhere.
            # Pair leftover identical words, nearest position first.
            free_t = [j for j in range(len(t_idx)) if t_idx[j] not in pairs.values()]
            for k in range(len(sbl)):
                if k in pairs:
                    continue
                cands = [j for j in free_t if same_word(s_norm[k], t_norm[j])]
                if cands:
                    j = min(cands, key=lambda j: abs(j - k))
                    pairs[k] = t_idx[j]
                    free_t.remove(j)
        stats["words unaligned"] += len(sbl) - len(pairs)

        # Words outside any real clause (καί, ὅτι in a wrapper) join the next word's clause.
        clauses = [x[3] for x in sbl]
        for k in range(len(clauses) - 2, -1, -1):
            if clauses[k] is None:
                clauses[k] = clauses[k + 1]
        if clauses and clauses[-1] is None:
            clauses[-1] = next((c for c in reversed(clauses) if c is not None), None)
        # Introducers (ὥστε, ἵνα, ἀλλά, γάρ) sit in a clause wrapper, not a phrase: their
        # nearest constituent is a clause or nothing. When the next word is in a deeper
        # clause, the introducer belongs to that clause.
        depth = lambda c: clause_info[id(c)][0] if c is not None else -1  # noqa: E731
        for k in range(len(sbl) - 2, -1, -1):
            constituent = sbl[k][2]
            introducer = constituent is None or (constituent.get("class") == "cl" and constituent is not sbl[k][1])
            if introducer and depth(clauses[k + 1]) > depth(clauses[k]):
                clauses[k] = clauses[k + 1]

        phrases, p_index = [], {}
        word_phrase = [-1] * len(tw)
        word_clause = [-1] * len(tw)
        atoms, atom_words = [], defaultdict(list)
        for k, (_, w, constituent, _) in enumerate(sbl):
            ti = pairs.get(k)
            if ti is None:
                continue
            if constituent is not None and constituent is not w and constituent.get("class") == "cl":
                constituent = None  # an introducer: the role belongs to the clause it introduces
            if constituent is not None:
                key = id(constituent)
                if key not in p_index:
                    p_index[key] = len(phrases)
                    phrases.append([role_of(constituent), constituent.get("class", "")])
                word_phrase[ti - 1] = p_index[key]
                roles[(book, ch, vs, ti)] = role_of(constituent)
            cl = clauses[k]
            if cl is not None:
                if id(cl) not in atom_words:
                    atoms.append(cl)
                atom_words[id(cl)].append(ti)
                word_clause[ti - 1] = atoms.index(cl)
        rows = []
        for cl in atoms:
            depth, rule, crole = clause_info[id(cl)]
            rows.append([min(atom_words[id(cl)]), max(atom_words[id(cl)]), depth, rule, "", crole, ""])
        # Greek clauses nest (a main clause can continue after an embedded one), so
        # spans overlap; "c" gives each word's clause for the reader to lay out.
        out[(book, ch)][vs] = {"a": rows, "p": phrases, "w": word_phrase, "c": word_clause}
    for (book, ch), vv in out.items():
        write_json(out_dir / "syntax" / book / f"{ch}.json", dict(sorted(vv.items())))
    print("macula greek syntax: " + ", ".join(f"{v} {k}" for k, v in stats.items()))
    return roles
