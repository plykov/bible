// Search engine: English -> original lemmas, phrases, Hebrew/Greek, Strong's.
import { englishIndex, lex, lemmas, occurrences } from "./data.js";
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
export async function searchPhrase(query, order) {
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
    for (const strong of cands) {
      for (const [ref, w] of await matchingOccurrences(strong, st)) {
        if (!byRef.has(ref)) byRef.set(ref, []);
        byRef.get(ref).push({ w, strong });
      }
    }
    perTerm.push({ term, st, byRef });
  }
  const window = terms.length + 3;
  const verses = [];
  for (const [ref, first] of perTerm[0].byRef) {
    if (!perTerm.every((p) => p.byRef.has(ref))) continue;
    const lists = perTerm.map((p) => p.byRef.get(ref));
    const words = lists.map((l) => l.map((x) => x.w));
    const lo = Math.max(...words.map((w) => Math.min(...w)));
    const hi = Math.min(...words.map((w) => Math.max(...w)));
    const all = words.flat();
    if (Math.max(...all) - Math.min(...all) <= window || hi - lo <= window) {
      verses.push({ ref, hits: lists.flat() });
    }
  }
  verses.sort((a, b) => order(a.ref) - order(b.ref));
  return { terms, verses };
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
