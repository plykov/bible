// Chapter reader: interlinear words, variant markers, Septuagint and Dead Sea Scrolls parallels.
import * as data from "../data.js";
import { fill, h, store, save, surface, verseLinks } from "../util.js";
import { openWord } from "../panel.js";
import { DSS_LEGEND, findspot, renderDss } from "../dss.js";

const DEFAULTS = { translit: true, gloss: true, strong: false, morph: false, lxx: false, dss: false, variants: true };

export async function renderReader(app, { book, ch, vs, w }) {
  const { books } = await data.books();
  const b = books.find((x) => x.id === book) || books[0];
  ch = Math.min(Math.max(1, ch || 1), b.ch);
  const opts = { ...DEFAULTS, ...store("reader-opts", {}) };
  const ot = b.t === "OT";
  const loaded = { lxx: false, dss: false };

  const nav = h("div", { class: "reader-nav" },
    h("select", { "aria-label": "Book", onchange: (e) => (location.hash = `#/r/${e.target.value}.1`) },
      h("optgroup", { label: "Old Testament (Hebrew & Aramaic)" },
        books.filter((x) => x.t === "OT").map((x) => h("option", { value: x.id, selected: x.id === b.id }, x.name))),
      h("optgroup", { label: "New Testament (Greek)" },
        books.filter((x) => x.t === "NT").map((x) => h("option", { value: x.id, selected: x.id === b.id }, x.name)))),
    h("select", { "aria-label": "Chapter", onchange: (e) => (location.hash = `#/r/${b.id}.${e.target.value}`) },
      Array.from({ length: b.ch }, (_, i) => h("option", { value: i + 1, selected: i + 1 === ch }, `Chapter ${i + 1}`))),
    h("a", { class: "btn", href: prevHref(books, b, ch), "aria-label": "Previous chapter" }, "‹"),
    h("a", { class: "btn", href: nextHref(books, b, ch), "aria-label": "Next chapter" }, "›"),
  );

  const toggles = h("div", { class: "toggles" },
    toggle("translit", "Transliteration"), toggle("gloss", "English"), toggle("strong", "Strong's"),
    toggle("morph", "Grammar"), toggle("variants", "Variants"),
    ot && b.lxx ? toggle("lxx", "Septuagint") : null,
    ot && b.dss ? toggle("dss", "Dead Sea Scrolls") : null,
  );

  function toggle(key, label) {
    return h("label", { class: "toggle" },
      h("input", { type: "checkbox", checked: opts[key], onchange: (e) => {
        opts[key] = e.target.checked;
        save("reader-opts", opts);
        applyOpts();
        if ((key === "lxx" || key === "dss") && e.target.checked) loadParallels();
      } }), label);
  }

  const body = h("div", { class: `chapter ${ot ? "ot" : "nt"}` }, h("p", { class: "muted" }, "Loading…"));
  const langNote = ot
    ? "Hebrew text: Leningrad Codex via STEPBible TAHOT. Aramaic words are marked."
    : "Greek text: STEPBible TAGNT (NA27/28 base with TR, Byzantine, SBL, WH, Tregelles and Tyndale House editions).";
  fill(app, 
    h("section", { class: "reader" },
      h("h1", {}, `${b.name} ${ch}`),
      nav, toggles,
      h("p", { class: "note" }, langNote),
      body),
  );

  function applyOpts() {
    for (const [k, v] of Object.entries(opts)) body.classList.toggle(`hide-${k}`, !v);
  }
  applyOpts();

  const verses = await data.chapter(b.id, ch);
  fill(body, ...verses.map((v) => renderVerse(b, ch, v, ot)));
  if (opts.lxx || opts.dss) loadParallels();

  if (vs) {
    const el = body.querySelector(`[data-v="${vs}"]`);
    if (el) {
      el.classList.add("focus");
      el.scrollIntoView({ block: "center" });
      if (w) {
        const word = el.querySelectorAll(".word")[w - 1];
        if (word) {
          word.classList.add("hit");
          word.click();
        }
      }
    }
  } else window.scrollTo(0, 0);

  async function loadParallels() {
    if (opts.dss && !loaded.dss && b.dss) {
      loaded.dss = true;
      const dss = await data.dssChapter(b.id, ch);
      let n = 0;
      for (const el of body.querySelectorAll(".verse")) {
        const rows = dss?.[el.dataset.v];
        if (!rows) continue;
        n++;
        el.append(h("div", { class: "parallel dss" },
          h("span", { class: "plabel" }, "DSS"),
          h("div", { class: "dss-rows" }, rows.map(([scroll, frag, text]) => h("div", { class: "dss-row" },
            h("span", { class: "scroll", title: [findspot(scroll), frag && `fragment/column ${frag}`].filter(Boolean).join(" · ") }, scroll),
            h("span", { class: "dss-text", lang: "he", dir: "rtl" }, renderDss(text)))))));
      }
      body.prepend(h("p", { class: "note dss-note" },
        `Dead Sea Scrolls: ${n} verse${n === 1 ? "" : "s"} in this chapter attested in the scrolls (consonantal text, Hebrew numbering mapped to English). Key: `,
        DSS_LEGEND.map(([k, label]) => [h("span", { class: `dss-key ${k}` }, "אבג"), ` ${label}  `]),
        "Hover a scroll name for where it was found. Data: ETCBC/CACCHT (M. Abegg transcriptions), CC BY-NC 4.0."));
    }
    if (!opts.lxx || loaded.lxx || !b.lxx) return;
    loaded.lxx = true;
    const lxx = await data.lxxChapter(b.id, ch);
    for (const el of body.querySelectorAll(".verse")) {
      const words = lxx?.[el.dataset.v];
      if (words) {
        el.append(h("div", { class: "parallel lxx", lang: "grc" },
          h("span", { class: "plabel" }, "LXX"),
          h("span", { class: "ptext" }, words.map((x) => x[0]).join(" "))));
      }
    }
    body.prepend(h("p", { class: "note lxx-note" }, "Septuagint: Swete (1909–30), aligned by its own (LXX) verse numbers, which differ from the Hebrew in places, e.g. Psalms, Jeremiah, and parts of Exodus."));
  }
}

function renderVerse(b, ch, v, ot) {
  const words = v.w.map((w, i) => renderWord(b, ch, v.n, w, i + 1, ot));
  const label = v.n === 0 ? "title" : v.n;
  const heb = v.h ? h("span", { class: "alt-ref", title: "Hebrew verse number" }, `Heb ${v.h.replace(".", ":")}`) : null;
  return h("div", { class: "verse", "data-v": v.n, "data-h": v.h || null },
    h("div", { class: "vhead" },
      h("a", { class: "vnum", href: `#/r/${b.id}.${ch}.${v.n}` }, label), heb,
      v.alt ? h("span", { class: "alt-ref", title: "KJV / other versification" }, v.alt) : null,
      h("span", { class: "vlinks" }, verseLinks(b.id, ch, v.n, b.t).map(([n, u]) => h("a", { href: u, target: "_blank", rel: "noopener" }, n)))),
    h("div", { class: "words", dir: ot ? "rtl" : "ltr" }, words),
  );
}

function renderWord(b, ch, vs, w, idx, ot) {
  const classes = ["word"];
  let badge = null;
  if (ot) {
    if (w.m?.[0] === "A") classes.push("aramaic");
    if (w.k) {
      classes.push("variant");
      badge = h("span", { class: "badge", title: otVariantTitle(w.k) }, w.k);
    }
  } else if (w.k) {
    classes.push("variant");
    if (!w.k.includes("N")) classes.push("not-na");
    badge = h("span", { class: "badge", title: `Editions: ${w.e || "all"}` }, w.k);
  }
  if (w.mv) classes.push("meaning-variant");
  return h("button", { class: classes.join(" "), type: "button", onclick: (e) => openWord(e.currentTarget, { b, ch, vs, idx, w, ot }) },
    h("span", { class: "orig", lang: ot ? (w.m?.[0] === "A" ? "arc" : "he") : "grc" }, surface(w.t)),
    h("span", { class: "translit" }, w.x),
    h("span", { class: "gloss" }, w.g),
    h("span", { class: "strong" }, w.s || ""),
    h("span", { class: "morph" }, w.m),
    badge,
  );
}

function otVariantTitle(k) {
  const codes = { L: "Leningrad", Q: "Qere (read)", K: "Ketiv (written)", R: "restored text", X: "from LXX (BHS/BHK)", A: "Aleppo", B: "BHS" };
  return k.replace(/[A-Z]/g, (c) => (codes[c] ? `${c}=${codes[c]} ` : c));
}

function prevHref(books, b, ch) {
  if (ch > 1) return `#/r/${b.id}.${ch - 1}`;
  const i = books.indexOf(b);
  const p = books[(i - 1 + books.length) % books.length];
  return `#/r/${p.id}.${p.ch}`;
}
function nextHref(books, b, ch) {
  if (ch < b.ch) return `#/r/${b.id}.${ch + 1}`;
  const n = books[(books.indexOf(b) + 1) % books.length];
  return `#/r/${n.id}.1`;
}
