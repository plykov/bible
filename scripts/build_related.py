"""Related-word ("meaning field") data from MACULA, keyed by our lexicon keys.

Three independent signals that one original word is close in meaning to another:

  syn  Clear's cross-language Proximity scores (Hebrew/Aramaic/Greek). The value
       is a distance: lower = closer.
  dom  Semantic domain per word occurrence: Louw-Nida for Greek (MACULA Greek),
       SDBH lexical domain for Hebrew/Aramaic (MACULA Hebrew).
  lxx  Septuagint equivalents: the Greek word MACULA aligns with each Hebrew word,
       counted both ways (Hebrew -> Greek, Greek -> Hebrew).

MACULA/Proximity and STEPBible letter homonyms differently (MACULA H2617 =
STEP H2617A 'kindness'; MACULA H2617a = STEP H2617B 'shame'), so Hebrew numbers
are mapped by majority vote over verses where both tag the same word (map_hebrew).

SDBH domain *codes* group words consistently, but the published label file does
not match the code version in the TSV (labels drift by +-1 at the leaf level), so
Hebrew domains are named from their most frequent member glosses instead.
"""
import csv
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / ".cache" / "sources"
GREEK_TSV = SRC / "macula_greek" / "SBLGNT" / "tsv" / "macula-greek-SBLGNT.tsv"
GREEK_LABELS = SRC / "macula_greek" / "sources" / "MARBLE" / "SDBG" / "marble-domain-label-mapping.json"
PROXIMITY = SRC / "macula_greek" / "sources" / "Clear" / "synonyms" / "Proximity.tsv"
HEBREW_TSV = SRC / "macula_hebrew" / "WLC" / "tsv" / "macula-hebrew.tsv"

MAX_SYN = 15          # nearest neighbours kept per word
MAX_LXX = 10          # Septuagint equivalents kept per word
MAX_MEMBERS = 80      # words listed per domain
MIN_DOMAIN_SHARE = 0.1
MIN_MEMBER_SHARE = 0.3


def to_key(raw, resolve, default_lang):
    """'G25', 'H3039a', 'A2417a', '0157', '1254a' -> resolved lexicon key."""
    m = re.match(r"^([AGH]?)(\d+)([a-z]?)$", raw.strip())
    if not m:
        return None
    lang = m.group(1) or default_lang
    prefix = "G" if lang == "G" else "H"
    return resolve(f"{prefix}{int(m.group(2)):04d}{m.group(3).upper()}")


# Septuagint function words aligned with almost anything; not meaningful equivalents.
LXX_STOP = {"G3588", "G2532", "G1510", "G2258", "G0846", "G1161", "G3739", "G3754", "G1722",
            "G1519", "G1537", "G0575", "G3361", "G3756", "G2443", "G1063", "G3778", "G1473", "G4771"}
MIN_LXX_SHARE = 0.02


def map_hebrew(chapters, resolve):
    """Vote MACULA (lang, strongnumberx) -> STEP key, using verses where exactly one
    STEP root word shares the same base Strong's number."""
    roots = defaultdict(lambda: defaultdict(set))  # (book, heb ch, heb vs) -> base -> {keys}
    for (book, ch), verses in chapters.items():
        for n, v in verses.items():
            hc, hv = (v.get("h") or f"{ch}.{n}").split(".")
            for w in v["w"]:
                s = w.get("s")
                if s and s.startswith("H"):
                    roots[(book, int(hc), int(hv))][int(s[1:5])].add(s)
    votes = defaultdict(Counter)
    for ix, r in read_tsv(HEBREW_TSV):
        m = re.match(r"^(\w+) (\d+):(\d+)", r[ix["ref"]])
        num = re.match(r"^(\d+)([a-z]?)$", r[ix["strongnumberx"]])
        if not m or not num:
            continue
        book = m.group(1)[0] + m.group(1)[1:].lower()
        cands = roots.get((book, int(m.group(2)), int(m.group(3))), {}).get(int(num.group(1)))
        if cands and len(cands) == 1:
            votes[(r[ix["lang"]], r[ix["strongnumberx"]])][next(iter(cands))] += 1
    table = {k: c.most_common(1)[0][0] for k, c in votes.items()}

    def hebrew_key(lang, raw):
        raw = raw.strip()
        if (lang, raw) in table:
            return table[(lang, raw)]
        other = "H" if lang == "A" else "A"
        return table.get((other, raw)) or to_key(raw, resolve, "H")
    return hebrew_key


def read_tsv(path):
    with open(path, encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t", quoting=csv.QUOTE_NONE)
        header = next(reader)
        ix = {k: i for i, k in enumerate(header)}
        for row in reader:
            yield ix, row


def build(resolve, lex, chapters, out_dir, write_json, bucket):
    if not (GREEK_TSV.exists() and HEBREW_TSV.exists() and PROXIMITY.exists()):
        print("macula: sources missing, skipping related words")
        return
    lex_keys = set(lex)
    hebrew_key = map_hebrew(chapters, resolve)

    def any_key(raw):
        """Proximity ids: 'G25' | 'H2617' | 'A2417a'."""
        if raw.startswith("G"):
            return to_key(raw, resolve, "G")
        return hebrew_key("A" if raw[0] == "A" else "H", raw[1:])

    domains = defaultdict(Counter)   # lemma key -> Counter(domain id)
    lxx = defaultdict(Counter)       # lemma key -> Counter(other-language key)

    for ix, r in read_tsv(GREEK_TSV):
        key = to_key(r[ix["strong"]], resolve, "G") if r[ix["strong"]] else None
        if key in lex_keys:
            for d in r[ix["domain"]].split():
                domains[key]["G:" + d] += 1

    for ix, r in read_tsv(HEBREW_TSV):
        key = hebrew_key(r[ix["lang"]], r[ix["strongnumberx"]])
        if key not in lex_keys:
            continue
        for d in r[ix["lexdomain"]].split():
            domains[key]["H:" + d] += 1
        for g in r[ix["greekstrong"]].split():
            gk = to_key(g, resolve, "G")
            if gk in lex_keys and gk not in LXX_STOP:
                lxx[key][gk] += 1
                lxx[gk][key] += 1

    syn = defaultdict(dict)
    with open(PROXIMITY, encoding="utf-8") as f:
        next(f)
        for line in f:
            a, b, dist = line.rstrip("\n").split("\t")
            ka, kb = any_key(a), any_key(b)
            if ka in lex_keys and kb in lex_keys and ka != kb:
                d = round(float(dist), 3)
                for x, y in ((ka, kb), (kb, ka)):
                    if y not in syn[x] or d < syn[x][y]:
                        syn[x][y] = d

    # Per-lemma records, sharded like the lexicon.
    shards = defaultdict(dict)
    members = defaultdict(Counter)
    for key in set(domains) | set(lxx) | set(syn):
        rec = {}
        total = sum(domains[key].values())
        doms = [[d, n] for d, n in domains[key].most_common() if n >= max(1, total * MIN_DOMAIN_SHARE)]
        if doms:
            rec["dom"] = doms[:4]
            # Listed as a domain member only where it is the word's primary domain.
            d, n = doms[0]
            if n >= total * MIN_MEMBER_SHARE:
                members[d][key] += n
        if syn.get(key):
            rec["syn"] = sorted(([k, d] for k, d in syn[key].items()), key=lambda x: x[1])[:MAX_SYN]
        if lxx.get(key):
            links = sum(lxx[key].values())
            keep = [[k, n] for k, n in lxx[key].most_common(MAX_LXX) if n >= 2 and n >= links * MIN_LXX_SHARE]
            if keep:
                rec["lxx"] = keep
        b = bucket(key)
        if rec and b:
            shards[b][key] = rec
    for b, recs in shards.items():
        write_json(out_dir / "rel" / f"{b}.json", recs)

    # Domain catalogue: label + members.
    greek_labels = json.loads(GREEK_LABELS.read_text(encoding="utf-8"))
    catalogue = {}
    for d, mem in members.items():
        lang, code = d.split(":", 1)
        top = mem.most_common(MAX_MEMBERS)
        if lang == "G":
            label = greek_labels.get(code) or greek_labels.get(code[:3]) or code
            parent = greek_labels.get(code[:3]) if len(code) > 3 else None
        else:
            # Named from its most frequent members' glosses (see module docstring).
            glosses = []
            for k, _ in top:
                g = re.sub(r"^to ", "", lex[k]["g"].split(":")[0]).strip()
                if g and g not in glosses:
                    glosses.append(g)
                if len(glosses) == 4:
                    break
            label, parent = " · ".join(glosses), None
        catalogue[d] = {"label": label, "parent": parent, "m": top}
    write_json(out_dir / "domains.json", catalogue)
    print(f"related: {sum(len(s) for s in shards.values())} lemmas, {len(catalogue)} domains, "
          f"{sum(1 for k in syn if syn[k])} with synonyms, {sum(1 for k in lxx if lxx[k])} with LXX links")
