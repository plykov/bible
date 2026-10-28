// Search engine: English -> original lemmas, phrases, Hebrew/Greek, Strong's.
import { domains, englishIndex, lex, lemmas, occurrences, phrasePostings, phraseVerses, related } from "./data.js";
import { stem, tokens } from "./stem.js";
import { fold } from "./util.js";

const STOP = new Set(
  "a an the of to in on at by for from with and or but not no nor so as is be was were are am been that this these those it its he she they them his her their we us our you your i me my".split(" "),
);

export function contentTerms(query) {
  const all = tokens(query);
  const content = all.filter((t) => !STOP.has(t));
  return content.length ? content : all;
}

// Decide which lemmas are the main answers for an English word, and which are
// rare or incidental renderings shown in a collapsed "also rendered" list.
// `hits` is [{strong, count, entry}] sorted by count, where count = how many
// times this English word renders that lemma in the interlinear.
export function rankLemmas(hits) {
  const total = hits.reduce((s, x) => s + x.count, 0);
  const threshold = Math.max(2, total * 0.01);
  const main = hits.filter((x) => x.count >= threshold);
  const rare = hits.filter((x) => x.count < threshold);
  return { main: main.length ? main : hits.slice(0, 5), rare: main.length ? rare : hits.slice(5) };
}

// Which glosses (by index) of an occurrence table contain the stemmed term.
export function glossMask(occ, st) {
  return occ.g.map((g) => tokens(g).some((t) => stem(t) === st));
}

export async function matchingOccurrences(strong, st) {
  const occ = await occurrences(strong);
  if (!occ) return [];
  if (!st) return occ.o;
  const mask = glossMask(occ, st);
  return occ.o.filter((o) => mask[o[2]]);
}

export async function searchWord(term) {
  const st = stem(term);
  const idx = await englishIndex(st);
  if (!idx) return { term, stem: st, main: [], rare: [], dictionary: [] };
  const hits = await Promise.all(idx.r.map(async ([strong, count]) => ({ strong, count, entry: await lex(strong) })));
  const dictionary = await Promise.all((idx.lx || []).slice(0, 40).map(async (strong) => ({ strong, entry: await lex(strong) })));
  return { term, stem: st, ...rankLemmas(hits), dictionary: dictionary.filter((d) => d.entry) };
}

// Phrase: find verses where each content word is rendered by some lemma, with the
// original words close together (original word order often differs from English).
export async function searchPhrase(query, order, { expand = false } = {}) {
  const terms = contentTerms(query);
  const perTerm = [];
  for (const term of terms) {
    const st = stem(term);
    const idx = await englishIndex(st);
    if (!idx) return { terms, verses: [], missing: term };
    // Lemmas covering ~98% of this word's renderings, at most 10.
    const total = idx.r.reduce((s, [, c]) => s + c, 0);
    let acc = 0;
    const cands = [];
    for (const [strong, c] of idx.r) {
      if (cands.length >= 10 || acc >= total * 0.98) break;
      cands.push(strong);
      acc += c;
    }
    const byRef = new Map();
    const push = (ref, w, strong, rel) => {
      if (!byRef.has(ref)) byRef.set(ref, []);
      byRef.get(ref).push({ w, strong, rel });
    };
    for (const strong of cands) {
      for (const [ref, w] of await matchingOccurrences(strong, st)) push(ref, w, strong, false);
    }
    if (expand) {
      // Add close synonyms / LXX equivalents, matching all their occurrences.
      const extra = new Set();
      for (const strong of cands) {
        const rel = await related(strong);
        for (const [k, d] of rel?.syn || []) if (d <= EXPAND_DIST) extra.add(k);
        // Only strong Septuagint pairs: at least 10% as frequent as the main one.
        const top = rel?.lxx?.[0]?.[1] || 0;
        for (const [k, n] of rel?.lxx || []) if (n >= Math.max(5, top * 0.1)) extra.add(k);
      }
      for (const c of cands) extra.delete(c);
      // Skip related words far more frequent than this term's own matches
      // (e.g. אָמַר "say" for "word"): they would flood the results.
      const cap = Math.max(3 * total, 300);
      for (const strong of extra) {
        const occ = (await occurrences(strong))?.o || [];
        if (occ.length > cap) continue;
        for (const [ref, w] of occ) push(ref, w, strong, true);
      }
    }
    perTerm.push({ term, st, byRef });
  }
  const window = terms.length + 3;
  const verses = [];
  for (const [ref, first] of perTerm[0].byRef) {
    if (!perTerm.every((p) => p.byRef.has(ref))) continue;
    const lists = perTerm.map((p) => p.byRef.get(ref));
    const pick = distinctPick(lists.map((l) => [...new Set(l.map((x) => x.w))]), window);
    if (pick) verses.push({ ref, hits: lists.flat().filter((x) => pick.includes(x.w)) });
  }
  verses.sort((a, b) => order(a.ref) - order(b.ref));
  return { terms, verses };
}

// ---- Exact phrase: consecutive words in the interlinear English ----

const ARTICLES = new Set(["the", "a", "an"]);

// Matches the query as consecutive English tokens (articles ignored on both sides,
// see scripts/build_data.py phrase_tokens). Returns each matching verse with the
// original word numbers that carry the phrase.
export async function phraseExact(query) {
  const stems = tokens(query).filter((t) => !ARTICLES.has(t)).map(stem);
  if (!stems.length) return { stems, verses: [] };
  const [vs, ...lists] = await Promise.all([phraseVerses(), ...stems.map(phrasePostings)]);
  const missing = stems.find((_, i) => !lists[i]);
  if (missing) return { stems, verses: [], missing, otCount: vs.ot };
  const KEY = 4096;
  const rest = lists.slice(1).map((l) => new Map(l.map(([v, t, w]) => [v * KEY + t, w])));
  const byVerse = new Map();
  for (const [v, t, w] of lists[0]) {
    const words = [w];
    let ok = true;
    for (let i = 0; i < rest.length; i++) {
      const next = rest[i].get(v * KEY + t + i + 1);
      if (next === undefined) {
        ok = false;
        break;
      }
      words.push(next);
    }
    if (!ok) continue;
    if (!byVerse.has(v)) byVerse.set(v, new Set());
    words.forEach((x) => byVerse.get(v).add(x));
  }
  const verses = [...byVerse].sort((a, b) => a[0] - b[0])
    .map(([v, words]) => ({ ref: vs.refs[v], ot: v < vs.ot, words: [...words].sort((a, b) => a - b) }));
  return { stems, verses, otCount: vs.ot };
}

// ---- Meaning field: other original words for the same idea ----

const EXPAND_DIST = 0.6;   // phrase expansion: only very close synonyms
const FIELD_DIST = 0.72;   // meaning field: synonyms up to this distance

// Collects words related to the seed lemmas by three independent signals and
// scores them; a word supported by several signals ranks higher.
//   syn: cross-language synonym distance (MACULA Proximity), lower = closer
//   lxx: Septuagint translation equivalent (Hebrew <-> Greek), with count
//   dom: shares a semantic domain (Louw-Nida / SDBH) with the seeds
export async function meaningField(seeds, exclude = new Set()) {
  const catalogue = await domains();
  const field = new Map();
  const add = (strong, reason, score) => {
    if (exclude.has(strong)) return;
    if (!field.has(strong)) field.set(strong, { strong, reasons: [], best: {} });
    const f = field.get(strong);
    f.reasons.push(reason);
    f.best[reason.type] = Math.max(f.best[reason.type] || 0, score);
  };
  const domainWeight = new Map();
  for (const seed of seeds) {
    const rel = await related(seed);
    if (!rel) continue;
    for (const [k, d] of rel.syn || []) if (d <= FIELD_DIST) add(k, { type: "syn", from: seed, d }, 1 - d);
    for (const [k, n] of rel.lxx || []) add(k, { type: "lxx", from: seed, n }, Math.min(0.9, 0.35 + n / 40));
    // Only each seed's primary domain: secondary ones come from special uses
    // (e.g. the participle "lover" tagged as a kind of person) and add noise.
    const [d, n] = rel.dom?.[0] || [];
    if (d) domainWeight.set(d, (domainWeight.get(d) || 0) + n);
  }
  const doms = [...domainWeight].sort((a, b) => b[1] - a[1]).slice(0, 4)
    .filter(([id]) => catalogue[id]).map(([id]) => ({ id, ...catalogue[id] }));
  for (const d of doms) {
    for (const [k, n] of d.m) add(k, { type: "dom", domain: d.id, n }, 0.25 + Math.min(0.25, n / 400));
  }
  const words = [...field.values()]
    .map((f) => ({ ...f, score: Object.values(f.best).reduce((a, b) => a + b, 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 60);
  await Promise.all(words.map(async (w) => (w.entry = await lex(w.strong))));
  return { domains: doms, words: words.filter((w) => w.entry) };
}

// One word position per term, all different (a single חֶסֶד must not satisfy both
// "mercy" and "love"), spanning at most `window` words. Small backtracking search:
// phrases have a handful of terms and each term only a few positions per verse.
function distinctPick(options, window) {
  const chosen = [];
  const go = (i) => {
    if (i === options.length) return Math.max(...chosen) - Math.min(...chosen) <= window;
    for (const w of options[i]) {
      if (chosen.includes(w)) continue;
      chosen.push(w);
      if (go(i + 1)) return true;
      chosen.pop();
    }
    return false;
  };
  return go(0) ? chosen : null;
}

// Hebrew / Greek / transliteration lookup against the lemma list.
export async function searchOriginal(q) {
  const list = await lemmas();
  const f = fold(q);
  if (!f) return [];
  const out = [];
  for (const [strong, lemma, translit, gloss, n] of list) {
    const fl = fold(lemma);
    const score = fl === f ? 3 : fl.startsWith(f) ? 2 : fl.includes(f) ? 1 : 0;
    if (score) out.push({ strong, lemma, translit, gloss, n, score });
  }
  return out.sort((a, b) => b.score - a.score || b.n - a.n).slice(0, 100);
}

// "H157", "h0157g", "G25" -> lemma keys present in the lexicon
export async function searchStrong(q) {
  const m = /^([HG])0*(\d{1,5})([A-Z])?$/i.exec(q.trim());
  if (!m) return null;
  const base = m[1].toUpperCase() + m[2].padStart(4, "0");
  const want = m[3] ? base + m[3].toUpperCase() : null;
  const list = await lemmas();
  return list
    .filter(([s]) => (want ? s === want : s === base || (s.startsWith(base) && /^[A-Z]$/.test(s.slice(base.length)))))
    .map(([strong, lemma, translit, gloss, n]) => ({ strong, lemma, translit, gloss, n }));
}
