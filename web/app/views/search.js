// Search results: English word -> original lemmas, meaning field, combined verse lists.
import * as data from "../data.js";
import { contentTerms, matchingOccurrences, meaningField, searchOriginal, searchPhrase, searchStrong, searchWord } from "../search.js";
import { fill, h, isGreek, isHebrew, langOf, parseRef, surface } from "../util.js";

export async function renderSearch(app, { q, expand }) {
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

  const { books } = await data.books();
  const terms = contentTerms(q);
  if (terms.length > 1) return renderPhrase(out, q, books, expand === "1");

  const res = await searchWord(terms[0] || q);
  const sel = new Selection(books);
  const fieldBox = h("div", { class: "field" }, h("p", { class: "muted" }, "Finding related words…"));
  const conceptBox = h("div");

  fill(out,
    h("h1", {}, `“${q}” in the original languages`),
    h("p", { class: "muted" },
      `Every Hebrew, Aramaic and Greek word translated with a form of “${res.term}” in the interlinear, then other original words for the same idea. `,
      `Tick words to compare them and list their verses together.`),
    conceptBox,
    h("h2", {}, `Translated “${res.term}”`),
    res.main.length ? h("div", { class: "results" }, res.main.map((x) => lemmaCard(x, res, books, sel))) : h("p", {}, "No interlinear renderings found."),
    res.rare.length ? h("details", {}, h("summary", {}, `Also rendered “${res.term}” occasionally (${res.rare.length} words)`),
      h("div", { class: "results compact" }, res.rare.map((x) => lemmaCard(x, res, books, sel)))) : null,
    fieldBox,
    res.dictionary.length ? h("details", {}, h("summary", {}, `Dictionary meaning includes “${res.term}” (${res.dictionary.length})`),
      lemmaList(res.dictionary.map((d) => ({ strong: d.strong, lemma: d.entry.l, translit: d.entry.x, gloss: d.entry.g, n: d.entry.n })), sel)) : null,
    sel.bar, sel.results,
  );

  const concepts = await data.concepts().catch(() => ({}));
  if (concepts[res.stem]) fill(conceptBox, await conceptCard(concepts[res.stem], sel));

  const direct = new Set([...res.main, ...res.rare].map((x) => x.strong));
  const seeds = res.main.slice(0, 6).map((x) => x.strong);
  if (!seeds.length) return fill(fieldBox);
  const field = await meaningField(seeds, direct);
  fill(fieldBox, renderField(field, res, sel));
}

// ---- Selection: tick lemmas anywhere on the page, then list their verses together ----

class Selection {
  constructor(books) {
    this.books = books;
    this.items = new Map(); // strong -> entry
    this.count = h("span");
    this.bar = h("div", { class: "selbar", hidden: true },
      h("span", {}, "Selected: "), this.count,
      h("button", { class: "btn primary small", onclick: () => this.show() }, "Show verses together"),
      h("button", { class: "btn small", onclick: () => this.clear() }, "Clear"));
    this.results = h("div", { class: "combined" });
  }
  box(strong, entry) {
    const cb = h("input", { type: "checkbox", class: "pick", "data-strong": strong, "aria-label": `Select ${entry?.l || strong}`,
      checked: this.items.has(strong),
      onchange: (e) => this.toggle(strong, entry, e.target.checked) });
    return cb;
  }
  toggle(strong, entry, on) {
    if (on) this.items.set(strong, entry);
    else this.items.delete(strong);
    document.querySelectorAll(`input.pick[data-strong="${strong}"]`).forEach((c) => (c.checked = on));
    this.count.textContent = [...this.items.values()].map((e) => e?.l).join(", ");
    this.bar.hidden = !this.items.size;
  }
  clear() {
    for (const s of [...this.items.keys()]) this.toggle(s, null, false);
    fill(this.results);
  }
  async show() {
    fill(this.results, h("p", { class: "muted" }, "Collecting verses…"));
    const lists = await Promise.all([...this.items].map(async ([s, e]) => [s, e, (await data.occurrences(s))?.o || []]));
    const byRef = new Map();
    for (const [s, , occ] of lists) {
      for (const [ref, w] of occ) {
        if (!byRef.has(ref)) byRef.set(ref, new Map());
        if (!byRef.get(ref).has(s)) byRef.get(ref).set(s, w);
      }
    }
    const order = new Map(this.books.map((b, i) => [b.id, i]));
    const key = (ref) => {
      const [b, c, v] = ref.split(".");
      return order.get(b) * 1e6 + Number(c) * 1e3 + Number(v);
    };
    const together = [...byRef].filter(([, m]) => m.size > 1).sort((a, b) => key(a[0]) - key(b[0]));
    const label = (s) => this.items.get(s)?.l || s;
    fill(this.results,
      h("h2", {}, "Selected words — verses"),
      h("p", { class: "muted" }, `${byRef.size} verses contain at least one of: ${[...this.items.values()].map((e) => e?.l).join(", ")}.`),
      together.length ? h("details", { open: true }, h("summary", {}, `${together.length} verses where two or more of them occur together`),
        h("ol", { class: "occ" }, together.slice(0, 300).map(([ref, m]) => h("li", {},
          h("a", { href: `#/r/${ref}?w=${Math.min(...m.values())}` }, prettyRef(ref, this.books)), " ",
          h("span", { class: "tags" }, [...m.keys()].map((s) => h("span", { class: "tag" }, label(s)))))))) : null,
      lists.map(([s, e, occ]) => h("details", { class: "group" },
        h("summary", {}, h("span", { class: "gkey" }, h("span", { lang: s[0] === "G" ? "grc" : "he" }, e?.l || s), ` ${e?.g || ""} · ${s}`), h("span", { class: "gcount" }, occ.length)),
        bookList(occ, this.books))),
    );
    this.results.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function bookList(occ, books) {
  const byBook = new Map();
  for (const [ref, w] of occ) {
    const b = ref.split(".")[0];
    if (!byBook.has(b)) byBook.set(b, []);
    byBook.get(b).push([ref, w]);
  }
  return h("ol", { class: "occ" }, [...byBook].map(([b, items]) => h("li", {},
    h("strong", {}, (books.find((x) => x.id === b)?.name || b) + ": "),
    items.map(([ref, w], i) => [i ? ", " : "", h("a", { href: `#/r/${ref}?w=${w}` }, ref.split(".").slice(1).join(":"))]))));
}

// ---- Cards and tables ----

function lemmaCard({ strong, count, entry }, res, books, sel) {
  if (!entry) return null;
  const lang = langOf(strong, entry.m);
  const list = h("div");
  const det = h("details", { class: "occ-box", ontoggle: async (e) => {
    if (!e.target.open || list.childElementCount) return;
    fill(list, bookList(await matchingOccurrences(strong, res.stem), books));
  } }, h("summary", {}, `${count} verses where it is rendered “${res.term}”`), list);

  return h("article", { class: "card" },
    h("header", {},
      sel.box(strong, entry),
      h("a", { class: "lemma", href: `#/w/${strong}?en=${encodeURIComponent(res.term)}`, lang: lang === "Greek" ? "grc" : "he" }, entry.l),
      h("span", { class: "translit" }, entry.x),
      h("span", { class: `lang ${lang.toLowerCase()}` }, lang),
      h("span", { class: "muted" }, strong)),
    h("p", {}, h("strong", {}, entry.g), ` · rendered “${res.term}” ${count}× of ${entry.n}`),
    h("p", { class: "muted small" }, "Also: ", entry.r.slice(0, 6).map(([g, n]) => `${g} (${n})`).join(", ")),
    det);
}

function lemmaList(hits, sel) {
  return h("table", { class: "lemma-table" },
    h("thead", {}, h("tr", {}, sel ? h("th", {}) : null, h("th", {}, "Word"), h("th", {}, "Translit."), h("th", {}, "Meaning"), h("th", {}, "Strong's"), h("th", {}, "Uses"))),
    h("tbody", {}, hits.map((x) => h("tr", {},
      sel ? h("td", {}, sel.box(x.strong, { l: x.lemma, g: x.gloss })) : null,
      h("td", {}, h("a", { href: `#/w/${x.strong}`, lang: x.strong[0] === "G" ? "grc" : "he" }, x.lemma)),
      h("td", {}, x.translit), h("td", {}, x.gloss), h("td", {}, x.strong), h("td", {}, x.n)))));
}

const WHERE = { nt: "New Testament", ot: "Hebrew Bible", lxx: "Septuagint", none: "not biblical" };

async function conceptCard(c, sel) {
  const rows = await Promise.all(c.items.map(async (it) => {
    const entries = await Promise.all(it.strongs.map(async (s) => [s, await data.lex(s)]));
    return h("tr", {},
      h("td", {}, h("strong", {}, it.label)),
      h("td", {}, entries.length ? entries.map(([s, e]) => h("div", { class: "cword" },
        sel.box(s, e), " ",
        h("a", { href: `#/w/${s}`, lang: s[0] === "G" ? "grc" : "he" }, e?.l || s), " ",
        h("span", { class: "muted small" }, `${e?.g || ""} · ${e?.n ?? 0}×`))) : h("span", { class: "muted" }, "—")),
      h("td", {}, it.where.map((w) => h("span", { class: `where ${w}` }, WHERE[w]))),
      h("td", { class: "small" }, it.note,
        it.refs ? h("div", {}, it.refs.map(([label, route]) => h("a", { class: "tag", href: `#/${route}` }, label))) : null));
  }));
  return h("div", { class: "concept" },
    h("h2", {}, c.title),
    h("p", { class: "small" }, c.intro),
    h("div", { class: "table-wrap" }, h("table", { class: "lemma-table concept-table" },
      h("thead", {}, h("tr", {}, h("th", {}, "Name"), h("th", {}, "Words (uses in Hebrew Bible + NT)"), h("th", {}, "Attested in"), h("th", {}, "Notes"))),
      h("tbody", {}, rows))));
}

function renderField(field, res, sel) {
  if (!field.words.length) return null;
  const names = new Map([...res.main, ...res.rare].map((x) => [x.strong, x.entry?.l || x.strong]));
  const name = (s) => names.get(s) || s;
  const domLabel = (d) => d.id.startsWith("G:")
    ? `Louw–Nida: ${d.label}${d.parent ? ` (${d.parent})` : ""}`
    : `Hebrew domain (SDBH): ${d.label}`;
  const why = (w) => {
    const out = [];
    const syn = w.reasons.filter((r) => r.type === "syn").sort((a, b) => a.d - b.d)[0];
    if (syn) out.push(h("span", { class: "why syn", title: "MACULA synonym distance (lower = closer)" }, `close to ${name(syn.from)} (${syn.d.toFixed(2)})`));
    for (const r of w.reasons.filter((r) => r.type === "lxx").slice(0, 2)) {
      out.push(h("span", { class: "why lxx", title: "Septuagint translation equivalent" }, `LXX ↔ ${name(r.from)} ×${r.n}`));
    }
    if (w.reasons.some((r) => r.type === "dom")) out.push(h("span", { class: "why dom", title: "Shares a semantic domain" }, "same domain"));
    return out;
  };
  const groups = [["Hebrew & Aramaic", (w) => w.strong[0] === "H"], ["Greek", (w) => w.strong[0] === "G"]];
  return h("div", {},
    h("h2", {}, `Other original words for this idea`),
    h("p", { class: "muted small" },
      `Close in meaning to the words above but not (or rarely) translated “${res.term}”. Evidence: MACULA cross-language synonym scores, Septuagint Hebrew↔Greek translation pairs, and shared semantic domains.`),
    h("div", { class: "domains" }, field.domains.map((d) => h("span", { class: "tag" }, domLabel(d)))),
    groups.map(([title, test]) => {
      const words = field.words.filter(test);
      return words.length ? h("div", {},
        h("h3", {}, title),
        h("div", { class: "table-wrap" }, h("table", { class: "lemma-table field-table" },
          h("thead", {}, h("tr", {}, h("th", {}), h("th", {}, "Word"), h("th", {}, "Meaning"), h("th", {}, "Uses"), h("th", {}, "Why it is related"))),
          h("tbody", {}, words.map((w) => h("tr", {},
            h("td", {}, sel.box(w.strong, w.entry)),
            h("td", {}, h("a", { href: `#/w/${w.strong}`, lang: w.strong[0] === "G" ? "grc" : "he" }, w.entry.l), " ",
              h("span", { class: "muted small" }, w.entry.x)),
            h("td", {}, w.entry.g),
            h("td", {}, w.entry.n),
            h("td", {}, why(w)))))))) : null;
    }));
}

// ---- Phrase search ----

async function renderPhrase(out, q, books, expand) {
  const order = new Map(books.map((b, i) => [b.id, i]));
  const key = (ref) => {
    const [b, c, v] = ref.split(".");
    return order.get(b) * 1e6 + Number(c) * 1e3 + Number(v);
  };
  const res = await searchPhrase(q, key, { expand });
  if (res.missing) {
    return fill(out, h("h1", {}, `“${q}”`), h("p", {}, `No original word is rendered “${res.missing}”.`));
  }
  const rows = h("ol", { class: "phrase-results" });
  let shown = 0;
  const more = h("button", { class: "btn small", onclick: () => draw() }, "Show more");
  function draw() {
    for (const v of res.verses.slice(shown, shown + 50)) {
      const strongs = [...new Map(v.hits.map((x) => [x.strong, x.rel]))];
      const li = h("li", {},
        h("a", { href: `#/r/${v.ref}?w=${Math.min(...v.hits.map((x) => x.w))}` }, prettyRef(v.ref, books)), " ",
        h("span", { class: "snippet muted" }, "…"), " ",
        h("span", { class: "tags" }, strongs.map(([s, rel]) => h("a", { class: rel ? "tag rel" : "tag", href: `#/w/${s}`, title: rel ? "related word (synonym / LXX equivalent)" : "" }, s))));
      rows.append(li);
      phraseSnippet(v).then((s) => li.querySelector(".snippet").replaceWith(s));
    }
    shown += 50;
    more.hidden = shown >= res.verses.length;
  }
  fill(out,
    h("h1", {}, `Phrase: “${q}”`),
    h("p", { class: "muted" }, `${res.verses.length} verses where the original words translated ${res.terms.map((t) => `“${t}”`).join(" + ")} occur close together.`),
    h("label", { class: "toggle" },
      h("input", { type: "checkbox", checked: expand, onchange: (e) => (location.hash = `#/s?q=${encodeURIComponent(q)}${e.target.checked ? "&expand=1" : ""}`) }),
      " Also match close synonyms and Septuagint equivalents (e.g. φιλέω, חָבַב for “love”)"),
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
