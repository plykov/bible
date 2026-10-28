#!/usr/bin/env python3
"""Service-worker inputs for the PWA, written after build_data.py.

web/precache.json  {"version": hash, "files": [...]}  the app shell, cached on install.
                   The version is a hash of every shell file, so any change to the
                   code or core data makes the service worker refresh its cache.
web/sw.js          the service worker, from scripts/sw.template.js with the version filled in
                   (the browser detects an update only when this file's bytes change).
web/data/offline.json  downloadable sets for the Offline page: {id: {label, bytes, files}}.

Everything else is cached at runtime as it is used (see web/sw.js).
"""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
DATA = WEB / "data"

SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png",
         "icons/icon-512.png", "icons/maskable-512.png", "icons/apple-touch-icon.png"]
SHELL_GLOBS = ["app/*.js", "app/views/*.js", "app/*.css", "app/*.json"]
SHELL_DATA = ["data/books.json", "data/meta.json", "data/morph/heb.json", "data/morph/grk.json",
              "data/domains.json", "data/dss/variants.json"]

# Downloadable sets: (id, label, description, globs)
SETS = [
    ("ot", "Hebrew Bible text", "Interlinear Hebrew & Aramaic, all 39 books", ["text/" + b + "/*.json" for b in
        "Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nam Hab Zep Hag Zec Mal".split()]),
    ("nt", "New Testament text", "Interlinear Greek with 8 editions, all 27 books", ["text/" + b + "/*.json" for b in
        "Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev".split()]),
    ("lex", "Dictionaries", "Brief lexicons, renderings and related words", ["lex/*.json", "rel/*.json", "lemmas.json"]),
    ("lsj", "Liddell–Scott–Jones", "Full classical Greek lexicon", ["lsj/*.json"]),
    ("occ", "Word occurrences", "Every occurrence of every word (word study)", ["occ/*.json"]),
    ("search", "Search indexes", "English word and phrase search", ["search/en/*.json", "phrase/*.json"]),
    ("syntax", "Syntax", "Clauses and phrase roles (BHSA, MACULA Greek)", ["syntax/*/*.json"]),
    ("dss", "Dead Sea Scrolls", "Scroll readings and comparison", ["dss/*/*.json"]),
    ("lxx", "Septuagint", "Swete LXX parallel text", ["lxx/*/*.json"]),
]


def main():
    shell = list(SHELL) + SHELL_DATA
    for g in SHELL_GLOBS:
        shell += sorted(str(p.relative_to(WEB)) for p in WEB.glob(g))
    h = hashlib.sha256()
    for f in shell:
        path = WEB / ("index.html" if f == "./" else f)
        h.update(f.encode())
        h.update(path.read_bytes())
    version = h.hexdigest()[:12]
    (WEB / "precache.json").write_text(json.dumps({"version": version, "files": shell}, indent=1))
    template = (ROOT / "scripts" / "sw.template.js").read_text()
    (WEB / "sw.js").write_text(template.replace("__VERSION__", version))

    sets = {}
    for sid, label, desc, globs in SETS:
        files = sorted({str(p.relative_to(WEB)) for g in globs for p in DATA.glob(g)})
        sets[sid] = {"label": label, "desc": desc, "bytes": sum((WEB / f).stat().st_size for f in files), "files": files}
    (DATA / "offline.json").write_text(json.dumps(sets, separators=(",", ":")))
    print(f"pwa: shell {len(shell)} files, version {version}; offline sets: "
          + ", ".join(f"{k} {v['bytes'] / 1e6:.1f} MB" for k, v in sets.items()))


if __name__ == "__main__":
    main()
