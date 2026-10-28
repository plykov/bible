// Shared helpers: DOM building, references, text normalisation, links.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---- Sanitising HTML from lexicons and live APIs ----

const ALLOWED = new Set(["B", "I", "EM", "STRONG", "BR", "SUP", "SUB", "P", "UL", "OL", "LI", "SMALL", "SPAN", "A"]);

export function sanitize(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) continue;
      if (child.nodeType !== Node.ELEMENT_NODE || !ALLOWED.has(child.tagName)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          walk(child);
          child.replaceWith(...child.childNodes);
        } else child.remove();
        continue;
      }
      const ref = child.getAttribute("data-ref");
      const title = child.getAttribute("title");
      for (const a of [...child.attributes]) child.removeAttribute(a.name);
      if (child.tagName === "A") {
        if (ref) {
          child.setAttribute("data-ref", ref);
          child.setAttribute("href", "#/r/" + refToRoute(ref));
        } else {
          const span = document.createElement("span");
          span.append(...child.childNodes);
          child.replaceWith(span);
          walk(span);
          continue;
        }
      } else if (child.tagName === "SPAN" && title) {
        child.setAttribute("title", title);
        child.className = "cite";
      }
      walk(child);
    }
  };
  const root = doc.body.firstChild;
  walk(root);
  return root.innerHTML;
}

// "Mat.8.8" / "1Co.14.9, 19" -> "Mat.8.8"
export function refToRoute(ref) {
  const m = /^(\w+)\.(\d+)(?:\.(\d+))?/.exec(ref.trim());
  return m ? `${m[1]}.${m[2]}${m[3] ? "." + m[3] : ""}` : ref;
}

// ---- References ----

let bookIndex = null;
export function setBooks(list) {
  bookIndex = new Map();
  const add = (k, code) => bookIndex.set(k.toLowerCase().replace(/[\s.]/g, ""), code);
  const extra = {
    Gen: ["gn"], Exo: ["ex", "exod"], Lev: ["lv"], Num: ["nm", "nb"], Deu: ["dt", "deut"], Jos: ["josh"],
    Jdg: ["judg", "jg"], Rut: ["ru", "rth"], "1Sa": ["1sam", "1s"], "2Sa": ["2sam", "2s"], "1Ki": ["1kgs", "1k"],
    "2Ki": ["2kgs", "2k"], "1Ch": ["1chr", "1chron"], "2Ch": ["2chr", "2chron"], Neh: ["ne"], Est: ["esth"],
    Psa: ["ps", "psalm", "pss", "psalms"], Pro: ["prov", "pr"], Ecc: ["eccl", "qoh"], Sng: ["song", "sos", "cant", "songofsolomon"],
    Isa: ["is"], Jer: ["je"], Lam: ["la"], Ezk: ["ezek", "eze"], Dan: ["dn"], Hos: ["ho"], Jol: ["joel", "jl"],
    Amo: ["am"], Oba: ["obad", "ob"], Jon: ["jnh"], Mic: ["mi"], Nam: ["nah", "na"], Hab: ["hb"], Zep: ["zeph"],
    Hag: ["hg"], Zec: ["zech"], Mal: ["ml"], Mat: ["mt", "matt"], Mrk: ["mk", "mar", "mark"], Luk: ["lk", "luke"],
    Jhn: ["jn", "joh", "john"], Act: ["ac", "acts"], Rom: ["ro", "rm"], "1Co": ["1cor"], "2Co": ["2cor"], Gal: ["ga"],
    Eph: ["ephes"], Php: ["phil", "philippians"], Col: ["co"], "1Th": ["1thess"], "2Th": ["2thess"], "1Ti": ["1tim"],
    "2Ti": ["2tim"], Tit: ["ti"], Phm: ["philem", "phlm"], Heb: ["he"], Jas: ["jm", "jam"], "1Pe": ["1pet", "1pt"],
    "2Pe": ["2pet", "2pt"], "1Jn": ["1john", "1jo"], "2Jn": ["2john", "2jo"], "3Jn": ["3john", "3jo"], Jud: ["jude", "jd"],
    Rev: ["re", "rv", "apoc", "revelations"],
  };
  for (const b of list) {
    add(b.id, b.id);
    add(b.name, b.id);
    for (const e of extra[b.id] || []) add(e, b.id);
  }
}

// "John 3:16", "jn3.16", "1 Cor 13", "Gen 1:1-5" -> {book, ch, vs}
export function parseRef(q) {
  if (!bookIndex) return null;
  const m = /^\s*([1-3]?\s*[A-Za-z][A-Za-z .]*?)\s*(\d+)(?:\s*[:.]\s*(\d+))?(?:\s*[-–]\s*\d+)?\s*$/.exec(q);
  if (!m) return null;
  const code = bookIndex.get(m[1].toLowerCase().replace(/[\s.]/g, ""));
  return code ? { book: code, ch: Number(m[2]), vs: m[3] ? Number(m[3]) : null } : null;
}

// ---- Original-language text ----

// Display form of a tagged word: drop morpheme "/" and punctuation "\" markers.
export const surface = (t) => t.replace(/[/\\]/g, "");

// Fold Hebrew/Greek for matching: no accents, vowels, cantillation; final forms folded.
export function fold(s) {
  return s
    .normalize("NFD")
    .replace(/[֑-ׇ̀-ͯ]/g, "")
    .replace(/[ךםןףץ]/g, (c) => ({ ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" })[c])
    .replace(/ς/g, "σ")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export const isHebrew = (s) => /[֐-׿]/.test(s);
export const isGreek = (s) => /[Ͱ-Ͽἀ-῿]/.test(s);

export function langOf(strong, lexMorph = "") {
  if (strong?.startsWith("G")) return "Greek";
  return lexMorph.startsWith("A:") ? "Aramaic" : "Hebrew";
}

// Hebrew morph "HR/Ncfsa": only the first segment carries the language letter.
export function morphParts(m, lang) {
  if (!m) return [];
  if (lang === "grk") return [m];
  const parts = m.split("/");
  const L = parts[0][0];
  return parts.map((p, i) => (i === 0 ? p : L + p));
}

// ---- External study links ----

export function studyLinks(strong, lemma) {
  const num = Number(strong.slice(1, 5));
  const isG = strong[0] === "G";
  const links = [
    ["STEPBible", `https://www.stepbible.org/?q=strong=${strong.slice(0, 5)}`],
    ["Bible Hub", `https://biblehub.com/${isG ? "greek" : "hebrew"}/${num}.htm`],
    ["Blue Letter Bible", `https://www.blueletterbible.org/lexicon/${isG ? "g" : "h"}${num}/kjv/${isG ? "tr" : "wlc"}/0-1/`],
  ];
  if (isG && lemma) {
    links.push(["Logeion", `https://logeion.uchicago.edu/${encodeURIComponent(lemma)}`]);
    links.push(["Perseus (LSJ)", `https://www.perseus.tufts.edu/hopper/morph?l=${encodeURIComponent(lemma)}&la=greek`]);
  }
  if (!isG && lemma) {
    links.push(["Sefaria", `https://www.sefaria.org/search?q=${encodeURIComponent(lemma)}&tab=sheet`]);
    links.push(["CAL (Aramaic)", "https://cal.huc.edu/"]);
  }
  return links;
}

export function verseLinks(book, ch, vs, testament) {
  const links = [["STEPBible", `https://www.stepbible.org/?q=reference=${book}.${ch}.${vs}`]];
  if (testament === "NT") {
    links.push(["NT Virtual Manuscript Room", "https://ntvmr.uni-muenster.de/manuscript-workspace"]);
  }
  return links;
}

export function store(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}
export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// replaceChildren() that skips null/false (replaceChildren would print "null").
export function fill(el, ...kids) {
  el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
  return el;
}
