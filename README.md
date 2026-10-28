# Interlinear Bible

A static Hebrew / Aramaic / Greek interlinear Bible for GitHub Pages. It has no server and no
build step for the frontend: plain ES modules plus pre-built JSON shards.

**What it does**

- **Reader:** every word of the OT (Leningrad Codex) and NT shown with transliteration,
  English gloss, Strong's number and grammar. Aramaic words are marked.
- **Textual variants:** OT Ketiv/Qere, Aleppo and BHS readings; NT readings across 8 editions
  (NA28, NA27, Tyndale House, SBL, Westcott-Hort, Tregelles, TR, Byzantine).
- **Parallels:** under each verse of the Hebrew Bible:
  - the Septuagint (Swete);
  - **Dead Sea Scrolls** readings from 262 scrolls (7,620 verses), each labelled with scroll,
    fragment and findspot. Editorial signs are shown as styles: reconstructed letters faint,
    uncertain dotted, scribal erasures struck through, supralinear raised. Try Isaiah 53:11
    (אור "light" in 1QIsaᵃ) or Deuteronomy 32:8 (בני אלוהים in 4Q37).
- **Word panel:** click any word for its morpheme breakdown, expanded grammar, variants,
  dictionary entry and external study links.
- **Word study:** abridged BDB or Abbott-Smith, full LSJ for Greek, and Jastrow/BDB/Klein from
  Sefaria for Hebrew and Aramaic. Shows how the word is translated, and every occurrence grouped
  by English rendering, sense or book, with verse snippets.
- **Search:**
  - an English word → every Hebrew/Aramaic/Greek word rendered that way, with counts and
    verse links (`love` → אָהַב, ἀγαπάω, ἀγάπη, φιλέω …)
  - **meaning field**: other Hebrew, Aramaic and Greek words for the same idea, even when the
    interlinear doesn't translate them with that English word. It draws on MACULA semantic
    domains (Louw–Nida, SDBH), cross-language synonym scores and Septuagint Hebrew↔Greek
    pairs. Curated notes check popular word lists (e.g. the "Greek words for love") against
    the texts.
  - tick any set of words → all their verses, plus the verses where two or more occur together
    (e.g. ἀγαπάω + φιλέω → John 21:15–16)
  - short phrases across both testaments (`in Christ`, `mercy and love`, `spirit of God`):
    - exact wording in the word-for-word English, via a positional index, with an "original
      words behind it" breakdown (`in Christ` → ἐν + Χριστός ×83)
    - by meaning: the original words for each term close together, widened with close
      synonyms and Septuagint equivalents (`mercy and love` → חֶסֶד + אָהֵב, רַחֲמִים + חֶסֶד,
      ἔλεος + ἀγάπη), with Hebrew Bible / New Testament counts
    - a **Direct / Narrow / Broad** switch sets how far "by meaning" reaches, for phrases and for
      the related-words list. It is remembered between visits and kept in the URL. The presets
      are `SCOPES` in `web/app/search.js`.
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
scripts/build_data.py    TAHOT/TAGNT/lexicons/LXX/phrase index → web/data/*.json
scripts/build_dss.py     Dead Sea Scrolls Text-Fabric → web/data/dss
scripts/build_related.py MACULA synonyms/domains/LXX pairs → web/data/rel, domains.json
web/app/concepts.json    curated notes on well-known word sets (checked against the data)
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
- **Dead Sea Scrolls** (ETCBC/CACCHT, Abegg transcriptions): CC BY-NC 4.0
- **MACULA Hebrew & Greek** (Biblica / Clear Bible): CC BY 4.0; semantic domains used with
  permission of UBS
- **Sefaria** (live): Jastrow, BDB and Klein dictionaries on the word-study page

## Roadmap

- [x] MACULA semantic domains, synonyms and Hebrew↔LXX links (related words, meaning field)
- [x] Curated concept notes (`web/app/concepts.json`): love, time, life, word, know
- [x] Dead Sea Scrolls readings as verse parallels
- [ ] Word-level DSS ↔ Masoretic comparison (highlight differing words)
- [ ] ETCBC BHSA clause and phrase data
- [ ] ETCBC Peshitta (Syriac OT)
- [ ] Rahlfs LXX with morphology (requires the CCAT user declaration first)
- [ ] CNTR / NTVMR early-manuscript readings for the NT
- [ ] Map LXX ↔ Hebrew versification with STEPBible TVTMS (Psalms, Jeremiah)
