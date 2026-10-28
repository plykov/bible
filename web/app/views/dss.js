// Dead Sea Scrolls variant lists: verses where a scroll differs from the Masoretic text.
import * as data from "../data.js";
import { findspot } from "../dss.js";
import { fill, h } from "../util.js";

const letters = (t) => t.replace(/[^א-ת]/g, "");

export async function renderDssVariants(app, { book }) {
  const [{ books }, variants] = await Promise.all([data.books(), data.getJSON("dss/variants.json")]);
  const name = (id) => books.find((b) => b.id === id)?.name || id;
  const intro = h("p", { class: "lead" },
    "Places where a Dead Sea Scroll reads differently from the Masoretic text: a different word, an extra word, or a missing word. ",
    "Spelling differences (vowel letters, e.g. לוא for לא) and letters reconstructed by editors are not counted.");

  if (!book || !variants[book]) {
    const total = Object.values(variants).reduce((s, v) => s + v.length, 0);
    const max = Math.max(...Object.values(variants).map((v) => v.length));
    return fill(app, h("section", { class: "dss-variants" },
      h("h1", {}, "Dead Sea Scrolls variants"), intro,
      h("p", {}, h("strong", {}, `${total} verses`), " with at least one substantive difference."),
      h("div", { class: "renderings" }, Object.entries(variants).map(([b, list]) =>
        h("a", { class: "rend", href: `#/dss/${b}` },
          h("span", { class: "bar", style: `width:${Math.max(3, (100 * list.length) / max)}%` }),
          h("span", { class: "rlabel" }, name(b)), h("span", { class: "rcount" }, list.length))))));
  }

  const list = variants[book];
  const tbody = h("tbody");
  const more = h("button", { class: "btn small", onclick: () => draw() }, "Show more");
  let shown = 0;
  async function draw() {
    const batch = list.slice(shown, shown + 60);
    shown += batch.length;
    more.hidden = shown >= list.length;
    const chapters = {};
    await Promise.all([...new Set(batch.map((r) => r[0]))].map(async (c) => (chapters[c] = await data.dssChapter(book, c))));
    for (const [ch, vs, n, scrolls] of batch) {
      const rows = (chapters[ch]?.[vs] || []).filter(([sc]) => scrolls.includes(sc));
      tbody.append(h("tr", {},
        h("td", {}, h("a", { href: `#/r/${book}.${ch}.${vs}?dss=1` }, `${ch}:${vs}`)),
        h("td", {}, n),
        h("td", {}, rows.map(([sc, frag, text, codes, notes]) => h("div", {},
          h("span", { class: "scroll", title: findspot(sc) }, sc), ": ",
          differences(text, codes, notes)))),
      ));
    }
  }
  fill(app, h("section", { class: "dss-variants" },
    h("p", {}, h("a", { href: "#/dss" }, "← All books")),
    h("h1", {}, `${name(book)}: Dead Sea Scrolls variants`), intro,
    h("p", {}, h("strong", {}, `${list.length} verses`), ` · ${list.reduce((s, r) => s + r[2], 0)} differences`),
    h("table", { class: "lemma-table variant-list" },
      h("thead", {}, h("tr", {}, h("th", {}, "Verse"), h("th", {}, "Diffs"), h("th", {}, "Scroll readings that differ"))),
      tbody),
    more));
  draw();
}

// "עבדו for עבדי · + אור · − לא"
function differences(text, codes, notes) {
  const toks = text.split(" ").filter(Boolean);
  const mt = new Map(notes.filter((n) => n[1] === "x").map((n) => [n[0], n[2]]));
  const parts = [];
  toks.forEach((t, i) => {
    // <bdi> isolates each Hebrew word so the English "for" doesn't reorder the line.
    if (codes[i] === "x") parts.push(h("span", { class: "vd" }, h("bdi", { class: "v-x" }, letters(t)), h("span", { class: "muted small" }, " for "), h("bdi", {}, mt.get(i))));
    if (codes[i] === "+") parts.push(h("span", { class: "vd" }, "+ ", h("bdi", { class: "v-plus" }, letters(t))));
  });
  for (const [, kind, w] of notes) if (kind === "-") parts.push(h("span", { class: "vd" }, "− ", h("bdi", { class: "v-omit" }, w)));
  return parts.flatMap((p, i) => (i ? [h("span", { class: "muted" }, " · "), p] : [p]));
}
