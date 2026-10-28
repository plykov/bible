// English stemmer, rule-for-rule identical to scripts/stem.py (see that file for
// rationale). scripts/test_stem.py verifies both produce the same stems.
let IRREGULAR = {};
let KEEP = new Set();

export function initStemmer(table) {
  IRREGULAR = table.map;
  KEEP = new Set(table.keep);
}

const VOWELS = new Set(["a", "e", "i", "o", "u"]);

function isCons(w, i) {
  const c = w[i];
  if (VOWELS.has(c)) return false;
  if (c === "y") return i === 0 || !isCons(w, i - 1);
  return true;
}

function measure(w) {
  let m = 0, i = 0;
  const n = w.length;
  while (i < n && isCons(w, i)) i++;
  while (i < n) {
    while (i < n && !isCons(w, i)) i++;
    if (i >= n) break;
    while (i < n && isCons(w, i)) i++;
    m++;
  }
  return m;
}

function hasVowel(w) {
  for (let i = 0; i < w.length; i++) if (!isCons(w, i)) return true;
  return false;
}

function endsCvc(w) {
  const n = w.length;
  return n >= 3 && isCons(w, n - 3) && !isCons(w, n - 2) && isCons(w, n - 1) && !"wxy".includes(w[n - 1]);
}

function step1a(w) {
  if (w.endsWith("sses")) return w.slice(0, -2);
  if (w.endsWith("ied") || w.endsWith("ies")) return w.length > 4 ? w.slice(0, -2) : w.slice(0, -1);
  if (w.endsWith("us") || w.endsWith("ss")) return w;
  if (w.endsWith("s") && w.length > 2) {
    const stem = w.slice(0, -1);
    for (const c of stem.slice(0, -1)) if (VOWELS.has(c)) return stem;
  }
  return w;
}

function step1b(w) {
  if (w.endsWith("eed")) return measure(w.slice(0, -3)) > 0 ? w.slice(0, -1) : w;
  for (const suf of ["ed", "ing"]) {
    if (w.endsWith(suf)) {
      const stem = w.slice(0, -suf.length);
      if (!hasVowel(stem)) return w;
      if (stem.endsWith("at") || stem.endsWith("bl") || stem.endsWith("iz")) return stem + "e";
      const n = stem.length;
      if (n >= 2 && stem[n - 1] === stem[n - 2] && isCons(stem, n - 1) && !"lsz".includes(stem[n - 1])) {
        return stem.slice(0, -1);
      }
      if (measure(stem) === 1 && endsCvc(stem)) return stem + "e";
      return stem;
    }
  }
  return w;
}

function step1c(w) {
  if (w.length > 2 && w[w.length - 1] === "y" && isCons(w, w.length - 2)) return w.slice(0, -1) + "i";
  return w;
}

export function stem(word) {
  let w = word.toLowerCase();
  w = IRREGULAR[w] ?? w;
  if (KEEP.has(w) || w.length <= 2) return w;
  return step1c(step1b(step1a(w)));
}

const TOKEN = /[a-z]+(?:'[a-z]+)?/g;

export function tokens(text) {
  return (text.toLowerCase().match(TOKEN) || []).map((t) => (t.endsWith("'s") ? t.slice(0, -2) : t).replace(/'/g, ""));
}
