# Interlinear Bible App — Data Sources & Architecture Research

*Researched 2026-10-28. Licences marked ✅ were read from the source's own LICENSE/README file
or verified live; ⚠️ means a secondary source only, or a conflict to resolve before shipping.*

Goal: a static app on GitHub Pages that shows the original-language text (Hebrew, Aramaic,
Greek) with interlinear English, textual variants and lexicon entries. It should also let you
search an English word or phrase and get back **every original word behind it, grouped by
meaning, as a list of links for further study.**

---

## 1. Recommended core stack (all open, all redistributable)

| Layer | Old Testament | New Testament |
|---|---|---|
| Base text + word tagging | **STEPBible TAHOT** (CC BY 4.0) ✅ | **STEPBible TAGNT** (CC BY 4.0) ✅ |
| Interlinear English | TAHOT "Translation" column (context-sensitive) + MACULA Cherith gloss | TAGNT "English translation" + MACULA Berean/Cherith gloss |
| Syntax, word senses, semantic domains | **MACULA Hebrew** (CC BY 4.0) ✅ | **MACULA Greek** (CC BY 4.0) ✅ |
| Variants | TAHOT L/Q/K/A/B/X codes, ETCBC DSS (NC) | TAGNT `editions` column, Robinson-Pierpont apparatus |
| Lexicon | TBESH (abridged BDB), full BDB, Strong's, Jastrow (Aramaic) | TBESG (Abbott-Smith), TFLSJ / LSJ, Strong's |
| Versification | STEPBible **TVTMS** (CC BY 4.0) ✅ | same |

STEPBible + MACULA cover about 90% of what you need under CC BY 4.0, which only requires
attribution. Everything else in this document is enrichment.

---

## 2. Original texts

### 2.1 Hebrew Bible (including Biblical Aramaic)

The Aramaic portions are Gen 31:47 (2 words), Jer 10:11, Dan 2:4b–7:28, Ezra 4:8–6:18 and
Ezra 7:12–26. Every source below includes them, and they are tagged per word. In OSHB/TAHOT
morphology the code's first letter is `H` (Hebrew) or `A` (Aramaic), and TBESH marks entries
`H:` or `A:`.

| Source | Contents | Format | Licence |
|---|---|---|---|
| [Westminster Leningrad Codex (tanach.us / UXLC)](https://tanach.us/) | Leningrad Codex, fully pointed with cantillation | XML | "may be viewed or copied without restriction" ✅ (quoted in MACULA LICENSE) |
| [OSHB – openscriptures/morphhb](https://github.com/openscriptures/morphhb) | WLC + lemma (augmented Strong's) + morphology, with immutable word IDs | OSIS XML | Text PD; tagging **CC BY 4.0** ✅ |
| [STEPBible TAHOT](https://github.com/STEPBible/STEPBible-Data) | WLC corrected against BHS/Leningrad; disambiguated Strong's for prefixes and suffixes; ETCBC morphology; English per morpheme; **Ketiv/Qere, Aleppo and BHS variants, LXX-restored text** | TSV, one word per line (4 files) | **CC BY 4.0** ✅ |
| [MACULA Hebrew](https://github.com/Clear-Bible/macula-hebrew) | WLC + OSHB morphology + syntax trees + **LXX Greek equivalents**, Strong's (Heb + Gk), SDBH semantic domains, English and Chinese glosses | XML (nodes/lowfat) + TSV | **CC BY 4.0** ✅ (SDBH portion "used with permission" from UBS) |
| [unfoldingWord UHB](https://git.door43.org/unfoldingWord/hbo_uhb) | OSHB 2.1, Ketiv only | USFM 3 (`\w word\|lemma strong x-morph`) | **CC BY-SA 4.0** ✅ (trademark must be removed in derivatives) |
| [ETCBC BHSA](https://github.com/ETCBC/bhsa) | BHS text + deep linguistic database (phrases, clauses, lexemes) | Text-Fabric | **CC BY-NC 4.0** ✅ (non-commercial) |
| [Sefaria API](https://www.sefaria.org/) | Tanakh, Targumim, commentaries | JSON, **CORS `*`** ✅ | Per version: some PD, some **CC BY-NC** ✅ — check `license` per version |

TAHOT variant codes, verified from the file header (this is where most Hebrew variant data
comes from):

```
L = Leningrad   Q = Qere (scribal correction)   K = Ketiv (written text)
R = restored text (Jos 21:36-37, Neh 7:67b)     X = extra words from the LXX, reconstructed in BHS/BHK
A = Aleppo Codex   B = BHS edition   ... e.g. Neh.2.13#17=Q(K+B)
lower-case = spelling-only variant, e.g. L(a)
```

### 2.2 Aramaic beyond the Hebrew Bible (Targumim, Peshitta)

| Source | Notes | Licence |
|---|---|---|
| Sefaria – Targum Onkelos / Jonathan | Live API test: `Onkelos_Genesis.1.1` → "בְּקַדְמִין בְּרָא יְיָ…" | That version is **CC BY-NC** ✅ — fine to fetch live and display, risky to bundle |
| [ETCBC Peshitta](https://github.com/ETCBC/peshitta) | Syriac OT, Text-Fabric | **MIT** ✅ (the repo is marked unsupported) |
| [Comprehensive Aramaic Lexicon (CAL)](https://cal.huc.edu/) | The scholarly standard: Targumim, Peshitta, parsed words | No formal licence found ⚠️ — **link out only** |
| Peshitta NT | Open tagged data is scarce; SEDRA is commercial | Link out (e.g. Dukhrana, CAL) ⚠️ |

### 2.3 Greek New Testament

| Source | Contents | Licence |
|---|---|---|
| [STEPBible TAGNT](https://github.com/STEPBible/STEPBible-Data) | One row per word; the **`editions` column lists the editions containing that word**: `NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz`. Includes meaning and spelling variants, English and Spanish translations | **CC BY 4.0** ✅ |
| [SBLGNT – LogosBible/SBLGNT](https://github.com/LogosBible/SBLGNT) | Critical text (v1.2 adds the pericope adulterae) | **CC BY 4.0** ✅ (relicensed 2022) |
| [MorphGNT SBLGNT](https://github.com/morphgnt/sblgnt) | SBLGNT + lemma + parsing, 7 columns per word | Tagging **CC BY-SA 3.0** ✅ |
| [MACULA Greek](https://github.com/Clear-Bible/macula-greek) | Nestle 1904 + SBLGNT trees, morphology, **Louw-Nida domains**, Berean + Cherith glosses, N1904↔SBLGNT word mapping | **CC BY 4.0** ✅ (Louw-Nida data "used with permission") |
| [Robinson-Pierpont Byzantine 2018 – byztxt](https://github.com/byztxt/byzantine-majority-text) | Byzantine text **with apparatus: Byz variants plus NA and ECM divergences**; Strong's and parsing; CSV and TEI | **Public domain** |
| [OpenGNT](https://github.com/eliranwong/OpenGNT) | Nestle 1904 base with a large word table | Main text **CC BY-SA 4.0** ✅ (current README; older copies say NC). Its Berean Interlinear column is © Bible Hub ⚠️ |
| [Nestle 1904 – biblicalhumanities](https://github.com/biblicalhumanities/Nestle1904) | PD text; Sandborg-Petersen morphology | Varies per subfolder ✅ — check each README |
| [Tischendorf 8th – morphgnt/tischendorf](https://github.com/morphgnt/tischendorf) | 19th-c. critical text with Sinaiticus-heavy readings | Text PD; confirm the tagging licence ⚠️ |
| [CNTR (Alan Bunning)](https://greekcntr.org/) | Transcriptions of **every Greek NT manuscript before 400 AD** plus a verse-by-verse collation | Announced as **CC BY-SA** (2021) ⚠️ — confirm on the site |
| [NTVMR (INTF Münster)](https://ntvmr.uni-muenster.de/) | Manuscript images + TEI transcriptions; API returns TEI per document and verse | Creative Commons per secondary sources ⚠️ |

**Not open (link out only):** NA28 and UBS5 text and apparatus, BHS apparatus, BDAG, HALOT,
NIV/NASB/ESV. TAGNT records whether each word is *in* NA28, which is factual data, but not
NA28's apparatus.

### 2.4 Septuagint (LXX)

This is the weakest area for open licences.

| Source | Licence |
|---|---|
| [eliranwong/LXX-Rahlfs-1935](https://github.com/eliranwong/LXX-Rahlfs-1935) — morphology, glosses, Strong's | **CC BY-NC-SA 4.0** ✅ **plus the CCAT user declaration** (restricts redistribution) |
| [eliranwong/LXX-Swete-1930](https://github.com/eliranwong/LXX-Swete-1930) — Swete (PD) + Tauber morphology | **GPL-3.0** ⚠️ (per aggregator) — the most open tagged option |
| MACULA Hebrew `@greek` attributes | LXX equivalents per Hebrew word, CC BY 4.0 ✅ — gives a Hebrew→LXX bridge without bundling the LXX |
| Brenton English LXX | Public domain |

---

## 3. Interlinear translation layers

| Gloss source | Type | Licence |
|---|---|---|
| TAHOT / TAGNT translation columns | Context-sensitive; split by morpheme (`in/ beginning`); `<obj.>` = untranslated, `[the]` = implied | CC BY 4.0 ✅ |
| MACULA Cherith glosses (Andi Wu) | English + Chinese, OT and NT | CC BY 4.0 ✅ |
| MACULA `@gloss` = Berean Interlinear | NT | MACULA states the Berean texts are PD as of 2023-04-30 ✅. berean.bible names only the "Berean Bible and Majority Bible texts" ⚠️ |
| **Berean Standard Bible** (full English) | Translation | **Public domain since 2023-04-30** ✅ ([berean.bible/terms](https://berean.bible/terms.htm)) |
| unfoldingWord ULT/UST aligned to UHB/UGNT | Word alignment in USFM (`\zaln-s` milestones) | CC BY-SA 4.0 |
| KJV with Strong's (CrossWire / eBible) | Classic reverse-interlinear | PD (outside the UK) |
| STEPBible TTESV (ESV ↔ Strong's) | Reverse-interlinear | **CC BY-NC** ✅ (in the filename) — avoid for an open app |
| Bible Hub / BLB interlinears | — | © — **do not scrape**, link out |

Sample rows (real data, Gen 1:1 and John 1:1):

```
TAHOT  Gen.1.1#01=L  בְּ/רֵאשִׁ֖ית  be./re.Shit  in/ beginning  H9003/{H7225G}  HR/Ncfsa
TAHOT  Gen.1.1#03=L  אֱלֹהִ֑ים     'E.lo.Him    God            {H0430G}        HNcmpa
TAGNT  Jhn.1.1#01=NKO  Ἐν (En)  In [the]  G1722=PREP  ἐν=in/on/among  NA28+NA27+Tyn+SBL+WH+Treg+TR+Byz
UGNT   \w ἀρχῇ|lemma="ἀρχή" strong="G07460" x-morph="Gr,N,,,,,DFS,"\w*
```

---

## 4. Dictionaries / lexicons

### Hebrew & Aramaic
| Lexicon | Notes | Licence |
|---|---|---|
| **TBESH** (STEPBible) | Abridged BDB keyed by **disambiguated Strong's** (H1254A vs H1254B); Hebrew/Aramaic cross-links (`H0429 = in Aramaic of H0428`) | CC BY 4.0 ✅ |
| **BDB + Strong's + LexicalIndex** – [openscriptures/HebrewLexicon](https://github.com/openscriptures/HebrewLexicon) | Full BDB XML (marked as a work in progress); maps BDB↔Strong's↔TWOT | Markup CC BY 4.0, texts PD ✅ |
| Strong's Hebrew/Greek JSON – [openscriptures/strongs](https://github.com/openscriptures/strongs) | Includes KJV usage lists (handy for English search) | CC BY-SA (JSON) ✅ |
| **Jastrow** (Targumic/Talmudic Aramaic) | Via Sefaria `/api/words/{word}`; tested live, returns BDB + Jastrow entries | PD text ✅ |
| CAL | Best Aramaic lexicon | Link out ⚠️ |
| MACULA SDBH domains | Semantic Dictionary of Biblical Hebrew senses per word | UBS permission ⚠️ |

### Greek
| Lexicon | Notes | Licence |
|---|---|---|
| **TBESG** (STEPBible) | Full **Abbott-Smith** entries keyed by Strong's, with verse refs as `<ref='Mat.8.8'>` | CC BY 4.0 ✅ |
| **TFLSJ** (STEPBible) | Formatted full **LSJ** entries for G0001–G5624, plus extras | CC BY 4.0 ✅ |
| [Abbott-Smith TEI](https://github.com/translatable-exegetical-tools/Abbott-Smith) | Clean TEI XML | **Public domain** ✅ |
| [Perseus lexica (LSJ, Middle Liddell)](https://github.com/PerseusDL/lexica) | Classical Greek depth | **CC BY-SA** ✅ (corrections go back to Perseus) |
| Strong's Greek / Thayer | Classic | PD |
| Louw-Nida domains via MACULA | Groups words by meaning | UBS permission ⚠️ |
| Logeion, BDAG | — | Link out only |

---

## 5. How existing interlinear apps structure their data

All serious projects (STEPBible, Bible Hub, BLB, Logos reverse-interlinears, MACULA) use the
same model: **one row per original-language word (or morpheme), keyed by a stable word ID, with
every annotation hung off that ID.**

```
Word token (atomic unit)
├─ id            Gen.1.1#01          (TAHOT/TAGNT)  · OSHB @id · MACULA xml:id
├─ surface       בְּ/רֵאשִׁ֖ית           (with morpheme boundaries)
├─ translit      be./re.Shit
├─ lemma         רֵאשִׁית
├─ strong        H7225G   (disambiguated: base number + letter = sense/homonym)
├─ morph         HR/Ncfsa (lang + POS + person/gender/number/state…)
├─ gloss_ctx     "in/ beginning"     (this occurrence)
├─ gloss_lex     "beginning"         (dictionary)
├─ sense/domain  SDBH / Louw-Nida id (MACULA)
├─ text_type     L | Q | K | A | B | X       (OT)  ·  editions[] (NT)
└─ align[]       English word indices in BSB/KJV/ULT (reverse interlinear)

Verse  = ordered list of word ids
Lemma  = strong → {lexicon entries, all occurrence ids, all English renderings + counts}
```

Rules other apps had to learn:

1. **The Strong's number is the join key** between texts and lexicons. Use *disambiguated*
   Strong's (STEPBible "dStrongs", OSHB augmented) internally and keep plain Strong's for
   linking out.
2. **Versification differs** between Hebrew and English (Mal 3:19–24 = Mal 4:1–6 in English,
   psalm titles as verse 0, Joel 2/3, …). Store the Hebrew/Greek reference and map it with
   **TVTMS**. TAHOT already gives `Eng (Heb)` refs.
3. **Normalise for search, never for display.** Hebrew: strip cantillation U+0591–05AF
   (optionally the vowels U+05B0–05C7) and fold final letters. Greek: NFD, strip combining
   marks, lower-case, ς→σ.
4. **Morphemes are not words.** Hebrew prefixes and suffixes (ו, ב, ל, pronominal suffixes)
   get their own tags (`H9003/{H7225G}`). The interlinear UI should split them with `/`, as
   TAHOT does.
5. **Fonts:** SBL Hebrew / Ezra SIL / Noto Serif Hebrew (RTL, cantillation), Gentium Plus /
   SBL Greek, Noto Sans Syriac. SIL fonts are OFL.

---

## 6. English → original-language search ("every case and meaning")

This is the feature that sets the app apart. Precompute it at build time; the browser does
lookups only.

```
"loved" ─► stem/lemma ("love")  [JS Snowball/Porter stemmer, or a lemma list]
        ─► reverse gloss index  english_stem → { strong → count }
              built from: TAHOT/TAGNT ctx glosses + MACULA glosses + BSB/KJV alignments
                          + Strong's "KJV usage" lists + lexicon definitions (lower weight)
        ─► results, grouped by original lemma, then by sense:
             אָהַב H0157   (Heb, verb)   "love" ×208, "lover" ×19 …
                ├ sense: human love (Gen 22:2, 24:67 …)
                └ sense: God's love (Deu 7:8 …)
             ἀγαπάω G0025 (Gk, verb)   ×143
             φιλέω G5368  (Gk, verb)   ×25
             רְחֵם A7356   (Aram) …
        ─► every occurrence = link  #/Jhn.21.15?w=12   + external study links
```

- **Senses** come from: STEPBible dStrong letters and the `»` sub-meaning (`H0430G=God»LORD`),
  MACULA SDBH (OT) and Louw-Nida (NT) domains, and TAHOT/TAGNT "meaning variants".
- **Phrase search:** index English gloss n-grams per verse (each linked to its word ids), *or*
  translate the phrase into a sequence of lemma sets and match consecutive original words.
  The second option finds the phrase even when English versions word it differently.
- **Link-outs per lemma:** STEPBible (`stepbible.org/?q=strong=H0157`), Sefaria word page,
  Logeion/Perseus (Greek), CAL (Aramaic), NTVMR (manuscript images for a verse), Bible Hub
  lexicon page.

---

## 7. GitHub Pages architecture

**Limits** ([docs](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)):
1 GB published site, ~100 GB/month soft bandwidth, 10-minute deploy timeout. The 10 builds/hour
limit does not apply when deploying via Actions. Git's per-file limit is 100 MB, and TAHOT is
already split into 4 files for this reason.

**Build pipeline (GitHub Actions):**
1. Clone upstream repos **at pinned commits**. STEPBible asks people not to re-host its raw files
   ("Please do not redistribute it yourself"). CC BY permits re-hosting, but courtesy and freshness
   both argue for publishing only transformed output and fetching the raw files at build time.
2. Merge on word ID: TAHOT ⨝ OSHB ⨝ MACULA-Hebrew; TAGNT ⨝ MACULA-Greek (via the N1904↔SBLGNT
   mapping) ⨝ MorphGNT.
3. Emit static shards:
   - `text/{book}/{chapter}.json`: word arrays, ~20–60 KB gzipped per chapter
   - `lex/H/0157.json`, `lex/G/0025.json`: entries + occurrence ids + rendering counts
   - `search/en/{2-letter-prefix}.json`: reverse gloss index shards
4. Rough size: under 150 MB uncompressed, well inside 1 GB.

**Alternative:** one SQLite file with FTS5, queried in the browser through
[sql.js-httpvfs](https://github.com/phiresky/sql.js-httpvfs) using HTTP Range requests, so
only the pages a query touches are downloaded. Simpler queries, but FTS5 needs a custom build
and the project is slow-moving. JSON shards plus a small client index (MiniSearch/FlexSearch)
are lower-risk.

**Runtime-only sources (not bundled):** Sefaria API (CORS-enabled, for Targumim, Jastrow and
NC-licensed versions) and NTVMR. Everything else is link-out.

---

## 8. Licence strategy

- **Default to CC BY / PD only** in the bundled data: STEPBible, MACULA, OSHB, SBLGNT, RP2018,
  BSB, Abbott-Smith, BDB, Strong's.
- **Share-alike sources** (MorphGNT, OpenGNT, Perseus LSJ, unfoldingWord, openscriptures/strongs
  JSON): including them makes those derived data files CC BY-SA. That's fine for an open
  project; keep them in separate shards so the licence boundaries stay clear.
- **Non-commercial** (BHSA, ETCBC DSS, Rahlfs/CCAT, TTESV, some Sefaria versions): fetch at
  runtime or link out. Bundle them only if the app will never be commercial, and label them.
- Add a `/credits` page that lists each source, licence and pinned commit, as CC BY requires.

## 9. Gaps / follow-ups

- [ ] Confirm the CNTR licence on greekcntr.org (site was unreachable from this environment).
- [ ] Confirm the NTVMR transcription licence before caching anything.
- [ ] Find an open Samaritan Pentateuch text (none verified yet).
- [ ] STEPBible has announced **TAGOT** (tagged LXX) and TFBDB (full BDB). Watch the repo:
      TAGOT would close the LXX gap under CC BY.
- [ ] Check the BSB *interlinear tables* licence directly with berean.bible (only the BSB text
      is explicitly PD).
