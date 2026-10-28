// Search results: English word -> original lemmas with every matching occurrence.
import * as data from "../data.js";
import { contentTerms, matchingOccurrences, searchOriginal, searchPhrase, searchStrong, searchWord } from "../search.js";
import { fill, h, isGreek, isHebrew, langOf, parseRef, surface } from "../util.js";

export async function renderSearch(app, { q }) {
  q = (q || "").trim();
  document.getElementById("searchInput").value = q;
  if (!q) return fill(app, h("p", {}, "Type a word to search."));

  const ref = parseRef(q);
  if (ref) {
    location.replace(`#/r/${ref.book}.${ref.ch}${ref.vs ? "." + ref.vs : ""}`);
    return;
  }
  const out = h("section", { class: "search" }, h("p", { class: "muted" }, "Searching…"));
  fill(app, out);

  const strongHits = await searchStrong(q);
  if (strongHits) {
    if (strongHits.length === 1) return location.replace(`#/w/${strongHits[0].strong}`);
    return fill(out, h("h1", {}, `Strong's ${q.toUpperCase()}`), lemmaList(strongHits));
  }
  if (isHebrew(q) || isGreek(q)) {
    const hits = await searchOriginal(q);
    return fill(out, 
      h("h1", {}, "Lemmas matching ", h("span", { lang: isHebrew(q) ? "he" : "grc" }, q)),
      h("p", { class: "muted" }, "Matched against dictionary forms, ignoring vowels and accents."),
      hits.length ? lemmaList(hits) : h("p", {}, "No matching lemma."));
  }

  const terms = contentTerms(q);
  if (terms.length > 1) return renderPhrase(out, q);
  const res = await searchWord(terms[0] || q);
  const { books } = await data.books();
  fill(out, 
    h("h1", {}, `“${q}” in the original languages`),
    h("p", { class: "muted" },
      `Every Hebrew, Aramaic and Greek word translated with a form of “${res.term}” (stem “${res.stem}”) in the interlinear. `,
      `Open a word to see each occurrence, grouped by meaning.`),
    res.main.length ? h("div", { class: "results" }, res.main.map((x) => lemmaCard(x, res, books))) : h("p", {}, "No interlinear renderings found."),
    res.rare.length ? h("details", {}, h("summary", {}, `Also rendered “${res.term}” occasionally (${res.rare.length} words)`),
      h("div", { class: "results compact" }, res.rare.map((x) => lemmaCard(x, res, books)))) : null,
    res.dictionary.length ? h("details", {}, h("summary", {}, `Dictionary meaning includes “${res.term}” (${res.dictionary.length})`),
      lemmaList(res.dictionary.map((d) => ({ strong: d.strong, lemma: d.entry.l, translit: d.entry.x, gloss: d.entry.g, n: d.entry.n })))) : null,
  );
}

function lemmaCard({ strong, count, entry }, res, books) {
  if (!entry) return null;
  const lang = langOf(strong, entry.m);
  const list = h("ol", { class: "occ" });
  const det = h("details", { class: "occ-box", ontoggle: async (e) => {
    if (!e.target.open || list.childElementCount) return;
    const occ = await matchingOccurrences(strong, res.stem);
    const byBook = new Map();
    for (const [ref, w] of occ) {
      const b = ref.split(".")[0];
      if (!byBook.has(b)) byBook.set(b, []);
      byBook.get(b).push([ref, w]);
    }
    for (const [b, items] of byBook) {
      const name = books.find((x) => x.id === b)?.name || b;
      list.append(h("li", {}, h("strong", {}, name, ": "),
        items.map(([ref, w], i) => [i ? ", " : "", h("a", { href: `#/r/${ref}?w=${w}` }, ref.split(".").slice(1).join(":"))])));
    }
  } }, h("summary", {}, `${count} verses where it is rendered “${res.term}”`), list);

  return h("article", { class: "card" },
    h("header", {},
      h("a", { class: "lemma", href: `#/w/${strong}?en=${encodeURIComponent(res.term)}`, lang: lang === "Greek" ? "grc" : "he" }, entry.l),
      h("span", { class: "translit" }, entry.x),
      h("span", { class: `lang ${lang.toLowerCase()}` }, lang),
      h("span", { class: "muted" }, strong)),
    h("p", {}, h("strong", {}, entry.g), ` · rendered “${res.term}” ${count}× of ${entry.n}`),
    h("p", { class: "muted small" }, "Also: ", entry.r.slice(0, 6).map(([g, n]) => `${g} (${n})`).join(", ")),
    det);
}

function lemmaList(hits) {
  return h("table", { class: "lemma-table" },
    h("thead", {}, h("tr", {}, h("th", {}, "Word"), h("th", {}, "Translit."), h("th", {}, "Meaning"), h("th", {}, "Strong's"), h("th", {}, "Uses"))),
    h("tbody", {}, hits.map((x) => h("tr", {},
      h("td", {}, h("a", { href: `#/w/${x.strong}`, lang: x.strong[0] === "G" ? "grc" : "he" }, x.lemma)),
      h("td", {}, x.translit), h("td", {}, x.gloss), h("td", {}, x.strong), h("td", {}, x.n)))));
}

async function renderPhrase(out, q) {
  const { books } = await data.books();
  const order = new Map(books.map((b, i) => [b.id, i]));
  const key = (ref) => {
    const [b, c, v] = ref.split(".");
    return order.get(b) * 1e6 + Number(c) * 1e3 + Number(v);
  };
  const res = await searchPhrase(q, key);
  if (res.missing) {
    return fill(out, h("h1", {}, `“${q}”`), h("p", {}, `No original word is rendered “${res.missing}”.`));
  }
  const rows = h("ol", { class: "phrase-results" });
  let shown = 0;
  const more = h("button", { class: "btn small", onclick: () => draw() }, "Show more");
  function draw() {
    for (const v of res.verses.slice(shown, shown + 50)) {
      const strongs = [...new Set(v.hits.map((x) => x.strong))];
      const li = h("li", {},
        h("a", { href: `#/r/${v.ref}?w=${Math.min(...v.hits.map((x) => x.w))}` }, prettyRef(v.ref, books)), " ",
        h("span", { class: "snippet muted" }, "…"), " ",
        h("span", { class: "tags" }, strongs.map((s) => h("a", { class: "tag", href: `#/w/${s}` }, s))));
      rows.append(li);
      phraseSnippet(v).then((s) => li.querySelector(".snippet").replaceWith(s));
    }
    shown += 50;
    more.hidden = shown >= res.verses.length;
  }
  fill(out, 
    h("h1", {}, `Phrase: “${q}”`),
    h("p", { class: "muted" }, `${res.verses.length} verses where the original words translated ${res.terms.map((t) => `“${t}”`).join(" + ")} occur close together.`),
    rows, more);
  draw();
}

async function phraseSnippet(v) {
  const verse = await data.verse(v.ref).catch(() => null);
  if (!verse) return h("span");
  const hit = new Set(v.hits.map((x) => x.w));
  return h("span", { class: "snippet" }, verse.w.map((w, i) => {
    const g = w.g.replace(/[<>/]/g, "") + " ";
    return hit.has(i + 1) ? h("mark", { title: surface(w.t) }, g) : g;
  }));
}

const prettyRef = (ref, books) => {
  const [b, c, v] = ref.split(".");
  return `${books.find((x) => x.id === b)?.name || b} ${c}:${v}`;
};
