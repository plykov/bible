// Search results: English word -> original lemmas, meaning field, combined verse lists.
import * as data from "../data.js";
import { SCOPES, contentTerms, currentScope, matchingOccurrences, meaningField, phraseExact, searchOriginal, searchPhrase, searchStrong, searchWord } from "../search.js";
import { tokens } from "../stem.js";
import { fill, h, isGreek, isHebrew, langOf, parseRef, surface } from "../util.js";

export async function renderSearch(app, { q, scope: scopeId }) {
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
  const scope = currentScope(scopeId);
  if (tokens(q).length > 1) return renderPhrase(out, q, books, scope);

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
  const switcher = scopeSwitch(q, scope);
  if (scope.id === "direct") {
    fill(fieldBox, h("h2", {}, "Other original words for this idea"), switcher,
      h("p", { class: "muted small" }, "Switch to Narrow or Broad to list related words that aren't translated this way."));
    return;
  }
  const field = await meaningField(seeds, direct, scope);
  fill(fieldBox, renderField(field, res, sel, switcher));
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

function renderField(field, res, sel, switcher) {
  if (!field.words.length) return [h("h2", {}, "Other original words for this idea"), switcher, h("p", { class: "muted small" }, "No related words at this setting.")];
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
    switcher,
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

// ---- Narrow / broad switch (shared by phrase search and the meaning field) ----

function scopeSwitch(q, scope) {
  return h("div", { class: "scope" },
    h("div", { class: "seg", role: "radiogroup", "aria-label": "How widely to search by meaning" },
      Object.values(SCOPES).map((s) => h("a", {
        class: s.id === scope.id ? "on" : null, role: "radio", "aria-checked": String(s.id === scope.id),
        href: `#/s?q=${encodeURIComponent(q)}&scope=${s.id}`, title: s.hint,
      }, s.label))),
    h("span", { class: "muted small" }, scope.hint));
}

// ---- Phrase search: exact wording + by meaning, across both testaments ----

async function renderPhrase(out, q, books, scope) {
  const order = new Map(books.map((b, i) => [b.id, i]));
  const key = (ref) => {
    const [b, c, v] = ref.split(".");
    return order.get(b) * 1e6 + Number(c) * 1e3 + Number(v);
  };
  const isOT = (ref) => books.find((b) => b.id === ref.split(".")[0])?.t === "OT";
  const terms = contentTerms(q);
  const exactBox = h("section", {}, h("p", { class: "muted" }, "Matching exact wording…"));
  const meaningBox = h("section");
  fill(out,
    h("h1", {}, `Phrase: “${q}”`),
    h("p", { class: "muted" }, "Searched in both testaments two ways: the exact wording of the word-for-word English, and by meaning (the original words behind each word, close together, including synonyms)."),
    exactBox, meaningBox);

  const exact = await phraseExact(q);
  const exactItems = exact.verses.map((v) => ({ ref: v.ref, words: v.words }));
  fill(exactBox,
    h("h2", {}, "Exact wording"),
    exact.missing
      ? h("p", {}, `The word “${exact.missing}” never occurs in the interlinear English.`)
      : exactItems.length
        ? [testamentSummary(exactItems, isOT, books), originalWording(exactItems), testamentLists(exactItems, isOT, books)]
        : h("p", {}, "No verse has these words consecutively. Try the by-meaning results below, or fewer words."));

  if (terms.length < 2) {
    fill(meaningBox, h("p", { class: "muted small" }, `By-meaning search needs two or more content words; for “${terms[0] || q}” alone, `,
      h("a", { href: `#/s?q=${encodeURIComponent(terms[0] || q)}` }, "see the word search and its related words"), "."));
    return;
  }
  fill(meaningBox, h("h2", {}, "By meaning"), h("p", { class: "muted" }, "Searching…"));
  const res = await searchPhrase(q, key, scope);
  const items = res.verses.map((v) => ({ ref: v.ref, words: [...new Set(v.hits.map((x) => x.w))], hits: v.hits }));
  fill(meaningBox,
    h("h2", {}, "By meaning"),
    h("p", { class: "muted small" }, `Verses where original words translated ${res.terms.map((t) => `“${t}”`).join(" + ")} occur within a few words of each other, in any order.`),
    scopeSwitch(q, scope),
    res.missing ? h("p", {}, `No original word is rendered “${res.missing}”.`)
      : items.length ? [testamentSummary(items, isOT, books), originalWording(items), testamentLists(items, isOT, books)]
        : h("p", {}, "No verses found."));
}

function testamentSummary(items, isOT, books) {
  const ot = items.filter((x) => isOT(x.ref)).length;
  const perBook = new Map();
  for (const x of items) {
    const b = x.ref.split(".")[0];
    perBook.set(b, (perBook.get(b) || 0) + 1);
  }
  return h("div", {},
    h("p", {}, h("strong", {}, `${items.length} verses`), ` · Hebrew Bible ${ot} · New Testament ${items.length - ot}`),
    h("div", { class: "book-dist" }, [...perBook].map(([b, n]) =>
      h("span", { class: `tag ${isOT(b + ".1.1") ? "ot" : "nt"}` }, `${books.find((x) => x.id === b)?.name || b} ${n}`))));
}

// Which original words carry the phrase: lemma sequences with counts.
function originalWording(items) {
  const box = h("details", { class: "orig-wording" }, h("summary", {}, "Original words behind these matches"));
  let done = false;
  box.addEventListener("toggle", async () => {
    if (!box.open || done) return;
    done = true;
    const sample = items.slice(0, 250);
    const counts = new Map();
    await Promise.all(sample.map(async (x) => {
      const v = await data.verse(x.ref).catch(() => null);
      if (!v) return;
      const keys = [...new Set(x.words.map((i) => v.w[i - 1]?.s).filter(Boolean))];
      const k = keys.join(" + ");
      if (!counts.has(k)) counts.set(k, { keys, n: 0, ref: x.ref });
      counts.get(k).n++;
    }));
    const rows = [...counts.values()].sort((a, b) => b.n - a.n).slice(0, 30);
    const names = new Map();
    await Promise.all([...new Set(rows.flatMap((r) => r.keys))].map(async (s) => names.set(s, (await data.lex(s))?.l || s)));
    box.append(...[
      sample.length < items.length ? h("p", { class: "muted small" }, `Based on the first ${sample.length} of ${items.length} matches.`) : null,
      h("table", { class: "lemma-table" },
        h("thead", {}, h("tr", {}, h("th", {}, "Original words"), h("th", {}, "Verses"), h("th", {}, "Example"))),
        h("tbody", {}, rows.map((r) => h("tr", {},
          h("td", {}, r.keys.map((s, i) => [i ? " + " : "", h("a", { href: `#/w/${s}`, lang: s[0] === "G" ? "grc" : "he" }, names.get(s))])),
          h("td", {}, r.n),
          h("td", {}, h("a", { href: `#/r/${r.ref}` }, r.ref.replace(/\.(\d+)$/, ":$1").replace(".", " "))))))),
    ].filter(Boolean));
  });
  return box;
}

function testamentLists(items, isOT, books) {
  const groups = [["Hebrew Bible", items.filter((x) => isOT(x.ref))], ["New Testament", items.filter((x) => !isOT(x.ref))]];
  return groups.filter(([, list]) => list.length).map(([title, list]) => {
    const ol = h("ol", { class: "phrase-results" });
    let shown = 0;
    const more = h("button", { class: "btn small", onclick: () => draw() }, "Show more");
    function draw() {
      for (const x of list.slice(shown, shown + 40)) {
        const li = h("li", {},
          h("a", { href: `#/r/${x.ref}?w=${Math.min(...x.words)}` }, prettyRef(x.ref, books)), " ",
          h("span", { class: "snippet muted" }, "…"));
        ol.append(li);
        verseSnippet(x.ref, new Set(x.words)).then((s) => li.querySelector(".snippet").replaceWith(s));
      }
      shown += 40;
      more.hidden = shown >= list.length;
    }
    const det = h("details", { class: "testament", open: true, ontoggle: (e) => e.target.open && !shown && draw() },
      h("summary", {}, `${title} (${list.length})`), ol, more);
    draw();
    return det;
  });
}

async function verseSnippet(ref, hit) {
  const verse = await data.verse(ref).catch(() => null);
  if (!verse) return h("span");
  return h("span", { class: "snippet" }, verse.w.map((w, i) => {
    const g = w.g.replace(/[<>/]/g, "") + " ";
    return hit.has(i + 1) ? h("mark", { title: surface(w.t) }, g) : g;
  }));
}

const prettyRef = (ref, books) => {
  const [b, c, v] = ref.split(".");
  return `${books.find((x) => x.id === b)?.name || b} ${c}:${v}`;
};
