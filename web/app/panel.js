// Side panel with details for a clicked word.
import * as data from "./data.js";
import { fill, h, langOf, morphParts, sanitize, studyLinks, surface } from "./util.js";
import { CLAUSE_KIND, CLAUSE_RELATION, CLAUSE_TYPE, FUNCTION, GREEK_CLASS, GREEK_CLAUSE_ROLE, GREEK_ROLE, PHRASE_TYPE, ruleLabel, textType } from "./syntax.js";

const panel = () => document.getElementById("panel");

export function closePanel() {
  const p = panel();
  p.hidden = true;
  document.querySelectorAll(".word.selected").forEach((e) => e.classList.remove("selected"));
}

document.addEventListener("keydown", (e) => e.key === "Escape" && closePanel());

export async function openWord(el, { b, ch, vs, idx, w, ot }) {
  document.querySelectorAll(".word.selected").forEach((e) => e.classList.remove("selected"));
  el.classList.add("selected");
  const p = panel();
  p.hidden = false;
  const lang = ot ? "heb" : "grk";
  const [entry, morphTable, syntax] = await Promise.all([w.s ? data.lex(w.s) : null, data.morph(lang), data.syntaxChapter(b.id, ch)]);
  const syn = syntaxInfo(syntax?.[vs], idx);
  const language = ot ? (w.m?.[0] === "A" ? "Aramaic" : "Hebrew") : "Greek";

  const morph = morphParts(w.m, lang).map((code) => {
    const d = morphTable[code];
    return h("li", {}, h("code", {}, code), " ", d ? d[0] : "");
  });

  // Each morpheme of a Hebrew word has its own tag: H9003/{H7225G}
  const parts = ot ? w.d.split("/").map((p) => p.split("\\")[0]) : [];
  const glossParts = ot ? w.g.split("/") : [];
  const morphemes = ot && parts.length > 1
    ? h("div", { class: "morphemes" }, h("h4", {}, "Parts of this word"),
      h("ul", {}, parts.map((p, i) => {
        const tag = /H\d{4}\w?/.exec(p)?.[0];
        return h("li", {}, tag ? h("a", { href: `#/w/${tag}` }, tag) : p, " · ", (glossParts[i] || "").trim(), p.includes("{") ? h("em", {}, " (root)") : "");
      })))
    : null;

  const variant = [];
  if (w.k) variant.push(h("p", {}, h("strong", {}, "Source: "), ot ? w.k : `${w.k} · editions: ${w.e || "all"}`));
  if (w.mv) variant.push(h("p", {}, h("strong", {}, "Meaning variant: "), w.mv));
  if (w.sv) variant.push(h("p", {}, h("strong", {}, "Spelling variant: "), w.sv));
  if (w.vn && w.vn.trim() !== "^") variant.push(h("p", { class: "vn", html: sanitize(w.vn) }));

  fill(p, 
    h("button", { class: "close", "aria-label": "Close", onclick: closePanel }, "×"),
    h("p", { class: "muted" }, `${b.name} ${ch}:${vs} · word ${idx} · ${language}`),
    h("div", { class: "big", lang: ot ? "he" : "grc", dir: ot ? "rtl" : "ltr" }, surface(w.t)),
    h("p", { class: "translit" }, w.x),
    h("p", { class: "gloss-big" }, w.g),
    w.sm ? h("p", {}, h("strong", {}, "Sense here: "), w.sm) : null,
    entry
      ? h("div", { class: "lex" },
        h("h3", {}, h("span", { lang: ot ? "he" : "grc" }, entry.l), " ", h("small", {}, entry.x), " · ", entry.g),
        h("p", { class: "muted" }, `${w.s} · ${entry.n} occurrences`),
        h("a", { class: "btn primary", href: `#/w/${w.s}` }, "Full word study →"))
      : null,
    h("h4", {}, "Grammar"), h("ul", { class: "morph-list" }, morph),
    syn && !ot ? h("div", { class: "syn" }, h("h4", {}, "Syntax (MACULA Greek)"),
      h("ul", { class: "morph-list" },
        syn.fn ? h("li", {}, h("strong", {}, GREEK_ROLE[syn.fn] || syn.fn), syn.ptyp && GREEK_CLASS[syn.ptyp] ? ` · ${GREEK_CLASS[syn.ptyp]}` : "") : null,
        syn.clause ? h("li", {}, `Clause: ${ruleLabel(syn.clause.typ)}`,
          GREEK_CLAUSE_ROLE[syn.clause.rela] ? ` · ${GREEK_CLAUSE_ROLE[syn.clause.rela]}` : "") : null)) : null,
    syn && ot ? h("div", { class: "syn" }, h("h4", {}, "Syntax (ETCBC BHSA)"),
      h("ul", { class: "morph-list" },
        syn.fn ? h("li", {}, h("strong", {}, FUNCTION[syn.fn] || syn.fn), syn.ptyp ? ` · in a ${(PHRASE_TYPE[syn.ptyp] || syn.ptyp).toLowerCase()}` : "") : null,
        syn.clause ? h("li", {}, CLAUSE_TYPE[syn.clause.typ] || syn.clause.typ,
          syn.clause.kind ? ` (${CLAUSE_KIND[syn.clause.kind]})` : "",
          syn.clause.rela && syn.clause.rela !== "NA" ? ` · ${CLAUSE_RELATION[syn.clause.rela] || syn.clause.rela}` : "") : null,
        syn.clause?.tt ? h("li", {}, `Text type: ${syn.clause.tt.path}`) : null)) : null,
    morphemes,
    variant.length ? h("div", { class: "variants" }, h("h4", {}, "Textual variants"), variant) : null,
    entry ? h("details", { open: true }, h("summary", {}, "Dictionary (brief)"), h("div", { class: "def", html: sanitize(entry.d) })) : null,
    w.s ? h("div", { class: "ext" }, h("h4", {}, "Study elsewhere"),
      studyLinks(w.s, entry?.l).map(([n, u]) => h("a", { href: u, target: "_blank", rel: "noopener" }, n))) : null,
  );
  p.scrollTop = 0;
}

// Phrase function and clause of TAHOT word `idx` in a verse's BHSA record.
function syntaxInfo(s, idx) {
  if (!s) return null;
  const ph = s.p[s.w[idx - 1]];
  const a = s.a.find(([first, last]) => idx >= first && idx <= last);
  return {
    fn: ph?.[0], ptyp: ph?.[1],
    clause: a ? { typ: a[3], tt: textType(a[4]), rela: a[5], kind: a[6] } : null,
  };
}

export { langOf };
