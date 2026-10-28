"""Clause and phrase structure from the ETCBC BHSA (Text-Fabric 2021), per verse.

BHSA splits graphical words into morphemes (וַ / יֹּאמֶר, הַ / אָרֶץ); TAHOT keeps
graphical words. BHSA words are regrouped into graphical words with
`trailer_utf8` (a non-empty trailer — space, maqaf, sof pasuq — ends one) and
aligned to TAHOT's words by consonants. BHSA uses Hebrew versification; verses
are mapped to English through TAHOT's Hebrew refs, as for the Dead Sea Scrolls.

Output: syntax/{Book}/{ch}.json  {verse: {
    "a": [[first word, last word, tab, clause-atom type, text type, relation, kind], ...],
    "p": [[function, phrase type], ...],
    "w": [phrase index per TAHOT word, -1 if unaligned]}}
Word numbers are TAHOT's (1-based). Returns {(book, ch, vs, word): function}
for annotating occurrences with their syntactic role.
"""
import difflib
from collections import Counter, defaultdict
from pathlib import Path

import tf
from dss_compare import consonants

ROOT = Path(__file__).resolve().parent.parent
TF = ROOT / ".cache" / "sources" / "bhsa" / "tf" / "2021"

# BHSA book names are Latin.
BOOKS = {
    "Genesis": "Gen", "Exodus": "Exo", "Leviticus": "Lev", "Numeri": "Num", "Deuteronomium": "Deu",
    "Josua": "Jos", "Judices": "Jdg", "Ruth": "Rut", "Samuel_I": "1Sa", "Samuel_II": "2Sa",
    "Reges_I": "1Ki", "Reges_II": "2Ki", "Chronica_I": "1Ch", "Chronica_II": "2Ch", "Esra": "Ezr",
    "Nehemia": "Neh", "Esther": "Est", "Iob": "Job", "Psalmi": "Psa", "Proverbia": "Pro",
    "Ecclesiastes": "Ecc", "Canticum": "Sng", "Jesaia": "Isa", "Jeremia": "Jer",
    "Threni": "Lam", "Ezechiel": "Ezk", "Daniel": "Dan", "Hosea": "Hos", "Joel": "Jol",
    "Amos": "Amo", "Obadia": "Oba", "Jona": "Jon", "Micha": "Mic", "Nahum": "Nam",
    "Habakuk": "Hab", "Zephania": "Zep", "Haggai": "Hag", "Sacharia": "Zec", "Maleachi": "Mal",
}


def read(name, parse=lambda v: v):
    return tf.read_tf(TF / f"{name}.tf", parse)


def build(chapters, out_dir, write_json):
    if not (TF / "otype.tf").exists():
        print("bhsa: source missing, skipping")
        return {}
    ranges = tf.read_otype(TF / "otype.tf")
    book, chapter, verse = read("book"), read("chapter"), read("verse")
    trailer, cons = read("trailer_utf8"), read("g_cons_utf8")
    function, typ, rela, txt, kind, tab = read("function"), read("typ"), read("rela"), read("txt"), read("kind"), read("tab")
    oslots = read("oslots")

    # word -> phrase, word -> clause atom, word -> clause
    def owner(otype):
        m = {}
        a, b = ranges[otype]
        for n in range(a, b + 1):
            for s in tf.slot_list(oslots[n]):
                m[s] = n
        return m
    phrase_of, atom_of, clause_of = owner("phrase"), owner("clause_atom"), owner("clause")

    heb2eng = {}
    for (code, ch), verses in chapters.items():
        for n, v in verses.items():
            hc, hv = (v.get("h") or f"{ch}.{n}").split(".")
            heb2eng[(code, int(hc), int(hv))] = (ch, n)

    out = defaultdict(dict)
    roles = {}
    stats = Counter()
    va, vb = ranges["verse"]
    for vn in range(va, vb + 1):
        code = BOOKS.get(book.get(vn))
        eng = heb2eng.get((code, int(chapter[vn]), int(verse[vn]))) if code else None
        if not eng:
            stats["verses unmapped"] += 1
            continue
        ch, vs = eng
        tahot = chapters[(code, ch)][vs]["w"]
        words = tf.slot_list(oslots[vn])

        # BHSA graphical words
        groups, cur = [], []
        for w in words:
            cur.append(w)
            if trailer.get(w, "") or w == words[-1]:  # space, maqaf, sof pasuq… end a word
                groups.append(cur)
                cur = []
        if cur:
            groups.append(cur)
        g_cons = [consonants("".join(cons.get(w, "") for w in g)) for g in groups]
        # TAHOT words that are in the Masoretic text (not LXX-restored X / parallel R)
        t_idx = [i for i, w in enumerate(tahot, 1) if w.get("k", "L")[:1] not in ("X", "R") and consonants(w["t"])]
        t_cons = [consonants(tahot[i - 1]["t"]) for i in t_idx]

        g2t = {}
        if len(groups) == len(t_idx):
            g2t = {gi: t_idx[gi] for gi in range(len(groups))}
            stats["verses aligned 1:1"] += 1
        else:
            sm = difflib.SequenceMatcher(a=g_cons, b=t_cons, autojunk=False)
            for op, a1, a2, b1, b2 in sm.get_opcodes():
                if op == "equal" or (op == "replace" and a2 - a1 == b2 - b1):
                    for k in range(a2 - a1):
                        g2t[a1 + k] = t_idx[b1 + k]
            stats["verses aligned by consonants"] += 1
        stats["words unaligned"] += len(groups) - len(g2t)

        phrases, p_index = [], {}
        word_phrase = [-1] * len(tahot)
        atoms, atom_words = [], defaultdict(list)
        for gi, g in enumerate(groups):
            ti = g2t.get(gi)
            if ti is None:
                continue
            # Main BHSA word of the graphical word: the last one not in a
            # conjunction phrase (וַ in וַיֹּאמֶר belongs to the verb's word).
            main = next((w for w in reversed(g) if function.get(phrase_of.get(w)) != "Conj"), g[-1])
            ph = phrase_of.get(main)
            if ph not in p_index:
                p_index[ph] = len(phrases)
                phrases.append([function.get(ph, ""), typ.get(ph, "")])
            word_phrase[ti - 1] = p_index[ph]
            roles[(code, ch, vs, ti)] = function.get(ph, "")
            at = atom_of.get(main)
            if at not in atom_words:
                atoms.append(at)
            atom_words[at].append(ti)
        def clause_row(at):
            cl = clause_of.get(tf.slot_list(oslots[at])[0])
            return [min(atom_words[at]), max(atom_words[at]), int(tab.get(at, 0)), typ.get(at, ""),
                    txt.get(cl, ""), rela.get(cl, ""), kind.get(cl, "")]
        out[(code, ch)][vs] = {"a": [clause_row(at) for at in atoms], "p": phrases, "w": word_phrase}
    for (code, ch), verses in out.items():
        write_json(out_dir / "syntax" / code / f"{ch}.json", dict(sorted(verses.items())))
    print("bhsa: " + ", ".join(f"{v} {k}" for k, v in stats.items()))
    return roles
