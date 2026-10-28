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

// Sefaria: Targumim and Jastrow/BDB. CORS is open; texts carry their own licences.
const SEFARIA = "https://www.sefaria.org/api";

export async function sefariaChapter(title, ch) {
  const key = `sefaria:${title}.${ch}`;
  if (!cache.has(key)) {
    const url = `${SEFARIA}/v3/texts/${encodeURIComponent(`${title.replace(/ /g, "_")}.${ch}`)}`;
    const p = fetch(url).then((r) => (r.ok ? r.json() : null)).then((d) => {
      const v = d?.versions?.[0];
      return v ? { text: v.text, title: v.versionTitle, license: v.license } : null;
    });
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key);
}

export async function sefariaWords(word) {
  const key = `sefaria-words:${word}`;
  if (!cache.has(key)) {
    const p = fetch(`${SEFARIA}/words/${encodeURIComponent(word)}`).then((r) => (r.ok ? r.json() : []));
    p.catch(() => cache.delete(key));
    cache.set(key, p);
  }
  return cache.get(key);
}
