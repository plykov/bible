# Interlinear Bible

A static Hebrew / Aramaic / Greek interlinear Bible for GitHub Pages. It has no server and no
build step for the frontend: plain ES modules plus pre-built JSON shards.

**What it does**

- **Reader:** every word of the OT (Leningrad Codex) and NT shown with transliteration,
  English gloss, Strong's number and grammar. Aramaic words are marked.
- **Textual variants:** OT Ketiv/Qere, Aleppo and BHS readings; NT readings across 8 editions
  (NA28, NA27, Tyndale House, SBL, Westcott-Hort, Tregelles, TR, Byzantine).
- **Parallels:** Septuagint (Swete) and the Aramaic Targum (live from Sefaria, aligned through
  Hebrew verse numbers).
- **Word panel:** click any word for its morpheme breakdown, expanded grammar, variants,
  dictionary entry and external study links.
- **Word study:** abridged BDB or Abbott-Smith, full LSJ for Greek, and Jastrow/BDB/Klein from
  Sefaria for Hebrew and Aramaic. Shows how the word is translated, and every occurrence grouped
  by English rendering, sense or book, with verse snippets.
- **Search:**
  - an English word → every Hebrew/Aramaic/Greek word rendered that way, with counts and
    verse links (`love` → אָהַב, ἀγαπάω, ἀγάπη, φιλέω …)
  - an English phrase → verses where the original words occur together (`word of God`)
  - Hebrew or Greek (vowels and accents ignored), Strong's numbers (`H7225`), or references
    (`Jn 1:1`)

## Run locally

```bash
python3 scripts/fetch_sources.py
```

```bash
python3 scripts/build_data.py
```

```bash
python3 -m http.server -d web 8000
```

Then open http://localhost:8000. The first two steps download the pinned upstream data
(about 190 MB) and write about 125 MB of JSON to `web/data/` (git-ignored).

`python3 scripts/test_stem.py` checks that the Python stemmer (used to build the search index)
and the JavaScript stemmer (used in the browser) agree on every English gloss word.

## Deploy

`.github/workflows/pages.yml` fetches the sources, builds the data, runs the tests, and deploys
`web/` to GitHub Pages on every push to the default branch. One-time setup: **Settings → Pages
→ Source: GitHub Actions**.

## Layout

```
scripts/sources.json     upstream datasets pinned to commits
scripts/fetch_sources.py sparse, shallow checkouts into .cache/sources
scripts/build_data.py    TAHOT/TAGNT/lexicons/LXX → web/data/*.json
scripts/stem.py          English stemmer (mirrors web/app/stem.js)
web/index.html           app shell
web/app/                 main.js (router), data.js, search.js, panel.js, views/*
docs/research/           data-source research and licence notes
```

## Data & licences

Non-commercial study tool. See the in-app **Sources** page and
[docs/research/data-sources.md](docs/research/data-sources.md).

- **STEPBible Data** (TAHOT, TAGNT, TBESH, TBESG, TFLSJ, TEHMC/TEGMC): CC BY 4.0, Tyndale
  House Cambridge / www.STEPBible.org
- **Swete LXX** (Eliran Wong): public-domain text, GPL-3.0 repository
- **Sefaria** (live): Targumim and dictionaries; each text carries its own licence

## Roadmap

- [ ] MACULA Hebrew/Greek: semantic domains (SDBH, Louw–Nida) for sense grouping, Hebrew→LXX
      word links
- [ ] ETCBC Dead Sea Scrolls as verse parallels; ETCBC BHSA clause and phrase data
- [ ] ETCBC Peshitta (Syriac OT)
- [ ] Rahlfs LXX with morphology (requires the CCAT user declaration first)
- [ ] CNTR / NTVMR early-manuscript readings for the NT
- [ ] Map LXX ↔ Hebrew versification with STEPBible TVTMS (Psalms, Jeremiah)
