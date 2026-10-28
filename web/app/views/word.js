// Word study: lexicons, renderings, every occurrence grouped by meaning.
import * as data from "../data.js";
import { glossMask } from "../search.js";
import { stem } from "../stem.js";
import { fill, h, isHebrew, langOf, sanitize, studyLinks, surface } from "../util.js";
import { FUNCTION } from "../syntax.js";

export async function renderWord(app, { strong, en }) {
  const [entry, occ] = await Promise.all([data.lex(strong), data.occurrences(strong)]);
  if (!entry) {
    fill(app, h("section", {}, h("h1", {}, strong), h("p", {}, "No lexicon entry for this number.")));
    return;
  }
  const language = langOf(strong, entry.m);
  const isG = strong[0] === "G";
  const st = en ? stem(en) : null;

  const groupBy = h("select", { onchange: () => drawGroups() },
    h("option", { value: "gloss" }, "Group by English rendering"),
    occ?.s?.filter(Boolean).length > 1 ? h("option", { value: "sense" }, "Group by sense") : null,
    occ?.r ? h("option", { value: "role" }, "Group by syntactic role (subject, object…)") : null,
    h("option", { value: "book" }, "Group by book"));
  const onlyMatch = st ? h("label", { class: "toggle" }, h("input", { type: "checkbox", checked: true, onchange: () => drawGroups() }), ` Only where rendered “${en}”`) : null;
  const groups = h("div", { class: "groups" });
  const relatedBox = h("div", { class: "related" });
  renderRelated(strong, relatedBox);

  const rend = entry.r.length
    ? h("div", { class: "renderings" }, entry.r.slice(0, 15).map(([g, n]) =>
      h("div", { class: "rend" },
        h("span", { class: "bar", style: `width:${Math.max(4, (100 * n) / entry.r[0][1])}%` }),
        h("span", { class: "rlabel" }, g), h("span", { class: "rcount" }, n))))
    : null;

  const lsjBox = isG ? h("details", { ontoggle: async (e) => {
    if (!e.target.open || e.target.dataset.loaded) return;
    e.target.dataset.loaded = 1;
    const html = await data.lsj(strong);
    e.target.append(h("div", { class: "def", html: html ? sanitize(html) : "<p>No LSJ entry.</p>" }));
  } }, h("summary", {}, "Liddell–Scott–Jones (full classical lexicon)")) : null;

  const sefariaBox = !isG ? h("details", { ontoggle: async (e) => {
    if (!e.target.open || e.target.dataset.loaded) return;
    e.target.dataset.loaded = 1;
    const box = h("div", { class: "def" }, "Loading from Sefaria…");
    e.target.append(box);
    try {
      const entries = await data.sefariaWords(entry.l.normalize("NFD").replace(/[\u0591-\u05C7]/g, ""));
      fill(box, ...(entries.length ? entries.slice(0, 12).map(sefariaEntry) : [h("p", {}, "No entries found.")]));
    } catch {
      box.textContent = "Sefaria could not be reached.";
    }
  } }, h("summary", {}, language === "Aramaic" ? "Jastrow & BDB (via Sefaria, live)" : "BDB, Jastrow & Klein (via Sefaria, live)")) : null;

  fill(app, h("section", { class: "word-study" },
    h("p", { class: "muted" }, `${language} · ${strong}${entry.rel ? " · " + entry.rel : ""}`),
    h("h1", {}, h("span", { lang: isG ? "grc" : "he", dir: isG ? "ltr" : "rtl", class: "lemma" }, entry.l), " ",
      h("small", {}, entry.x)),
    h("p", { class: "gloss-big" }, entry.g, h("span", { class: "muted" }, ` · ${entry.n} occurrences · ${entry.m}`)),
    h("div", { class: "cols" },
      h("div", {},
        h("h2", {}, "Dictionary"),
        h("div", { class: "def", html: sanitize(entry.d) }),
        lsjBox, sefariaBox,
        h("div", { class: "ext" }, h("h4", {}, "Study elsewhere"),
          studyLinks(strong, entry.l).map(([n, u]) => h("a", { href: u, target: "_blank", rel: "noopener" }, n)))),
      h("div", {},
        h("h2", {}, "How it is translated"), rend || h("p", { class: "muted" }, "No interlinear renderings."))),
    relatedBox,
    h("h2", {}, "Every occurrence"),
    h("div", { class: "group-controls" }, groupBy, onlyMatch),
    groups));

  function drawGroups() {
    if (!occ) return fill(groups, h("p", { class: "muted" }, "No occurrences."));
    const mode = groupBy.value;
    let list = occ.o;
    if (st && onlyMatch?.querySelector("input").checked) {
      const mask = glossMask(occ, st);
      list = list.filter((o) => mask[o[2]]);
    }
    const map = new Map();
    for (const o of list) {
      const key = mode === "gloss" ? occ.g[o[2]] || "—"
        : mode === "sense" ? occ.s[o[3]] || "(general)"
        : mode === "role" ? FUNCTION[occ.r[o[4]]] || "(no syntactic role recorded)"
        : o[0].split(".")[0];
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(o);
    }
    const sorted = [...map].sort((a, b) => (mode === "book" ? 0 : b[1].length - a[1].length));
    fill(groups, 
      h("p", { class: "muted" }, `${list.length} occurrences in ${sorted.length} groups`),
      ...sorted.map(([key, items]) => occurrenceGroup(key, items)));
  }
  drawGroups();
}

function occurrenceGroup(key, items) {
  const listEl = h("ol", { class: "occ" });
  let shown = 0;
  const more = h("button", { class: "btn small", onclick: () => showMore() }, "Show more");
  async function showMore() {
    const batch = items.slice(shown, shown + 25);
    shown += batch.length;
    more.hidden = shown >= items.length;
    for (const [ref, w] of batch) {
      const li = h("li", {}, h("a", { href: `#/r/${ref}?w=${w}` }, ref.replace(/\.(\d+)$/, ":$1").replace(".", " ")), " ", h("span", { class: "snippet muted" }, "…"));
      listEl.append(li);
      snippet(ref, w).then((s) => li.querySelector(".snippet").replaceWith(s));
    }
  }
  const det = h("details", { class: "group", ontoggle: (e) => e.target.open && !shown && showMore() },
    h("summary", {}, h("span", { class: "gkey" }, key), h("span", { class: "gcount" }, items.length)),
    listEl, more);
  return det;
}

// English line of the verse (from the interlinear glosses) with the word highlighted.
async function snippet(ref, wordNo) {
  const v = await data.verse(ref).catch(() => null);
  if (!v) return h("span", { class: "snippet" });
  const ot = isHebrew(v.w[0]?.t || "");
  return h("span", { class: "snippet" },
    h("span", { class: "orig-snip", lang: ot ? "he" : "grc" }, surface(v.w[wordNo - 1]?.t || ""), " "),
    ...v.w.map((w, i) => {
      const g = w.g.replace(/[<>]/g, "").replace(/\//g, "");
      return i === wordNo - 1 ? h("mark", {}, g, " ") : g + " ";
    }));
}

function sefariaEntry(e) {
  const senses = (list, depth = 0) => h("ol", {}, (list || []).map((s) =>
    h("li", {}, h("span", { html: sanitize(s.definition || "") }), s.senses ? senses(s.senses, depth + 1) : null)));
  return h("div", { class: "sefaria-entry" },
    h("h4", {}, h("span", { lang: "he" }, e.headword), " ", h("small", { class: "muted" }, e.parent_lexicon)),
    e.content?.morphology ? h("p", { class: "muted" }, e.content.morphology) : null,
    senses(e.content?.senses));
}

// Related words: close synonyms (any language), Septuagint equivalents, same domain.
async function renderRelated(strong, box) {
  const [rel, catalogue] = await Promise.all([data.related(strong), data.domains()]);
  if (!rel) return;
  const link = async (k, extra) => {
    const e = await data.lex(k);
    if (!e) return null;
    return h("li", {}, h("a", { href: `#/w/${k}`, lang: k[0] === "G" ? "grc" : "he" }, e.l), " ",
      h("span", { class: "muted small" }, `${e.g} · ${langOf(k, e.m)}`), extra ? h("span", { class: "why" }, extra) : null);
  };
  const syn = await Promise.all((rel.syn || []).filter(([, d]) => d <= 0.75).slice(0, 12).map(([k, d]) => link(k, d.toFixed(2))));
  const lxx = await Promise.all((rel.lxx || []).map(([k, n]) => link(k, `×${n}`)));
  const doms = (rel.dom || []).map(([id]) => catalogue[id]).filter(Boolean);
  const domLists = await Promise.all(doms.map(async (d) => h("div", {},
    h("h4", {}, d.parent ? `${d.label} (${d.parent})` : d.label),
    h("ul", { class: "inline-list" }, await Promise.all(d.m.filter(([k]) => k !== strong).slice(0, 14).map(([k]) => link(k)))))));
  const isG = strong[0] === "G";
  fill(box,
    h("h2", {}, "Related words"),
    h("p", { class: "muted small" }, "From MACULA: synonym distance across Hebrew, Aramaic and Greek (lower = closer), Septuagint translation pairs, and semantic domains (" + (isG ? "Louw–Nida" : "SDBH") + ")."),
    h("div", { class: "cols3" },
      syn.length ? h("div", {}, h("h3", {}, "Closest in meaning"), h("ul", {}, syn)) : null,
      lxx.length ? h("div", {}, h("h3", {}, isG ? "Hebrew words it translates (LXX)" : "Greek used for it in the LXX"), h("ul", {}, lxx)) : null,
      domLists.length ? h("div", {}, h("h3", {}, "Same semantic domain"), domLists) : null));
}
