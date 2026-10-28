#!/usr/bin/env python3
"""Check that the Python and JavaScript stemmers agree on every gloss token.

The build indexes English with stem.py and the browser queries with stem.js;
any disagreement would silently lose search results.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from stem import stem  # noqa: E402

words = set("love loved loving lies cries beginning hopping agreed jesus spoke men feet".split())
for path in (ROOT / "web" / "data" / "lex").glob("*.json"):
    for entry in json.loads(path.read_text()).values():
        for g, _ in entry["r"]:
            words.update(w.lower() for w in g.replace("[", " ").replace("]", " ").split() if w.isalpha())
words = sorted(words)

js = f"""
import {{ initStemmer, stem }} from "{(ROOT / 'web/app/stem.js').as_uri()}";
import fs from "fs";
initStemmer(JSON.parse(fs.readFileSync("{ROOT / 'web/app/stem-irregular.json'}", "utf8")));
const words = JSON.parse(fs.readFileSync(0, "utf8"));
process.stdout.write(JSON.stringify(words.map(stem)));
"""
res = subprocess.run(["node", "--input-type=module", "-e", js], input=json.dumps(words),
                     capture_output=True, text=True, check=True)
js_stems = json.loads(res.stdout)
bad = [(w, stem(w), j) for w, j in zip(words, js_stems) if stem(w) != j]
print(f"{len(words)} words checked, {len(bad)} mismatches")
for b in bad[:20]:
    print("  ", b)
sys.exit(1 if bad else 0)
