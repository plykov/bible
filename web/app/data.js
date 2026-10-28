// Data access: every JSON shard is fetched once and cached in memory.
const BASE = new URL("../data/", import.meta.url);
const cache = new Map();

export function getJSON(path) {
  if (!cache.has(path)) {
    const p = fetch(new URL(path, BASE)).then((r) => {
      if (!r.ok) throw new Error(`${r.status} ${path}`);
      return r.json();
    });
    p.catch(() => cache.delete(path));
    cache.set(path, p);
  }
  return cache.get(path);
}

// Same sharding rule as scripts/build_data.py bucket(): 100 Strong's numbers per file.
export function bucket(strong) {
  const m = /^([HG])(\d+)/.exec(strong);
  return m ? m[1] + String(Math.floor(Number(m[2]) / 100)).padStart(2, "0") : null;
}

export const books = () => getJSON("books.json");
export const chapter = (book, ch) => getJSON(`text/${book}/${ch}.json`);
export const lxxChapter = (book, ch) => getJSON(`lxx/${book}/${ch}.json`).catch(() => null);
export const dssChapter = (book, ch) => getJSON(`dss/${book}/${ch}.json`).catch(() => null);
export const syntaxChapter = (book, ch) => getJSON(`syntax/${book}/${ch}.json`).catch(() => null);
export const lemmas = () => getJSON("lemmas.json");
export const meta = () => getJSON("meta.json");
export const morph = (lang) => getJSON(`morph/${lang}.json`);

export async function lex(strong) {
  return (await getJSON(`lex/${bucket(strong)}.json`).catch(() => ({})))[strong] || null;
}
export async function lsj(strong) {
  return (await getJSON(`lsj/${bucket(strong)}.json`).catch(() => ({})))[strong] || null;
}
export async function occurrences(strong) {
  return (await getJSON(`occ/${bucket(strong)}.json`).catch(() => ({})))[strong] || null;
}
export async function englishIndex(stemmed) {
  const shard = (stemmed + "_").slice(0, 2);
  return (await getJSON(`search/en/${shard}.json`).catch(() => ({})))[stemmed] || null;
}

// Verse lookup through the chapter cache: "Gen.1.1" -> verse object.
export async function verse(ref) {
  const [book, ch, vs] = ref.split(".");
  const verses = await chapter(book, ch);
  return verses.find((v) => v.n === Number(vs)) || null;
}

// ---- Live sources (not bundled) ----

// Sefaria dictionaries (Jastrow, BDB, Klein). CORS is open.
const SEFARIA = "https://www.sefaria.org/api";

export async function sefariaWords(word) {
  const key = `sefaria-words:${word}`;
  if (!cache.has(key)) {
    const p = fetch(`${SEFARIA}/words/${encodeURIComponent(word)}`).then((r) => (r.ok ? r.json() : []));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key);
}

// ---- Related words (MACULA): synonyms, semantic domains, LXX equivalents ----

export async function related(strong) {
  return (await getJSON(`rel/${bucket(strong)}.json`).catch(() => ({})))[strong] || null;
}
export const domains = () => getJSON("domains.json");
let conceptsP = null;
export const concepts = () => (conceptsP ??= fetch(new URL("./concepts.json", import.meta.url)).then((r) => r.json()));

// ---- Positional English index for exact phrase search ----

export const phraseVerses = () => getJSON("phrase/verses.json");
export async function phrasePostings(stemmed) {
  const flat = (await getJSON(`phrase/${(stemmed + "_").slice(0, 2)}.json`).catch(() => ({})))[stemmed];
  if (!flat) return null;
  // Decode [Δverse, pos, word, ...] into [[verse, pos, word], ...]
  const out = [];
  let v = 0;
  for (let i = 0; i < flat.length; i += 3) {
    v += flat[i];
    out.push([v, flat[i + 1], flat[i + 2]]);
  }
  return out;
}
