// Rendering Dead Sea Scrolls transcriptions (ETCBC/CACCHT Unicode `full` feature).
// Editorial signs become styles instead of raw symbols:
//   [ ]        reconstructed by a modern editor        -> .rec (faint)
//   # ? |  « » uncertain letter                         -> .unc (dotted)
//   {{ }} { }  erased by the scribe / removed by editor -> .del (struck)
//   ^ ^        written above the line (ancient)        -> .sup (raised)
//   << >> < >  correction (ancient / modern)           -> .cor (underlined)
//   ≤ ≥        vacat (deliberately blank space)        -> "vacat" label
//   ε          a missing letter                        -> ·
//   ׳          morpheme break added by analysts        -> dropped (not in the scroll)
import { h } from "./util.js";

// Word-level comparison with the Masoretic text (codes from scripts/dss_compare.py).
export const COMPARE = {
  x: ["v-x", "Different word. Masoretic text: "],
  "+": ["v-plus", "Not in the Masoretic text"],
  m: ["v-m", "Differs from the Masoretic text only by a prefix (and, the, in, to…) or an ending"],
  s: ["v-s", "Spelling only (vowel letters)"],
  u: ["v-u", "Possibly different, uncertain letters"],
};

// `codes`: one character per space-separated word; `notes`: [[word index, "x"|"-", MT word]].
export function renderDss(text, codes = "", notes = []) {
  const st = { rec: false, unc: false, del: 0, sup: false, cor: 0 };
  const mtWord = new Map(notes.filter((n) => n[1] === "x").map((n) => [n[0], n[2]]));
  const omitted = new Map();
  for (const [i, kind, w] of notes) if (kind === "-") omitted.set(i, [...(omitted.get(i) || []), w]);
  const out = [];
  text.split(" ").filter(Boolean).forEach((token, i) => {
    const segs = segment(token, st);
    const [cls, tip] = COMPARE[codes[i]] || [];
    out.push(cls ? h("span", { class: `tok ${cls}`, title: tip + (mtWord.get(i) || "") }, segs) : h("span", { class: "tok" }, segs), " ");
    for (const w of omitted.get(i) || []) {
      out.push(h("span", { class: "v-omit", title: "In the Masoretic text, missing here" }, `⟨${w}⟩`), " ");
    }
  });
  return out;
}

// One word's characters -> styled segments; `st` carries bracket state across words.
function segment(token, st) {
  const segs = [];
  const cls = () => [st.rec && "rec", st.unc && "unc", st.del && "del", st.sup && "sup", st.cor && "cor"].filter(Boolean).join(" ");
  const push = (c, k = cls()) => {
    const last = segs[segs.length - 1];
    if (last && last.k === k && !last.fixed) last.t += c;
    else segs.push({ k, t: c });
  };
  const markLastUncertain = () => {
    const last = segs[segs.length - 1];
    if (!last || !last.t.trim() || last.k.includes("unc")) return;
    const ch = last.t.slice(-1);
    last.t = last.t.slice(0, -1);
    if (!last.t) segs.pop();
    segs.push({ k: `${last.k} unc`.trim(), t: ch, fixed: true });
  };
  for (const c of token) {
    switch (c) {
      case "[": st.rec = true; break;
      case "]": st.rec = false; break;
      case "{": st.del++; break;
      case "}": st.del = Math.max(0, st.del - 1); break;
      case "^": st.sup = !st.sup; break;
      case "<": st.cor++; break;
      case ">": st.cor = Math.max(0, st.cor - 1); break;
      case "«": st.unc = true; break;
      case "»": st.unc = false; break;
      case "#": case "?": case "|": markLastUncertain(); break;
      case "(": case ")": case "׳": case "≥": break;
      case "≤": segs.push({ k: "vac", t: "vacat", fixed: true }); break;
      case "ε": segs.push({ k: "missing", t: "·", fixed: true }); break;
      case "╱": segs.push({ k: "eol", t: "⁄", fixed: true }); break;
      case "_": push(" "); break;
      default: push(c);
    }
  }
  return segs.filter((s) => s.t).map((s) => (s.k ? h("span", { class: s.k }, s.t) : s.t));
}

// Substantive differences in one reading: different words, extra words, omissions.
export const substantive = (codes, notes) =>
  [...codes].filter((c) => c === "x" || c === "+").length + notes.filter((n) => n[1] === "-").length;

// "4Q51" -> "Qumran Cave 4", "Mas1b" -> "Masada", …
export function findspot(scroll) {
  if (/^1Qisaa$/i.test(scroll)) return "Great Isaiah Scroll, Qumran Cave 1";
  const q = /^(\d+)Q/.exec(scroll);
  if (q) return `Qumran Cave ${q[1]}`;
  const places = [
    [/^Mas/i, "Masada"], [/^Mur/i, "Wadi Murabbaʿat"], [/^Xhev|^5\/6|^5\//i, "Naḥal Ḥever"],
    [/^34Se/i, "Naḥal Ṣeʾelim"], [/^Sdeir/i, "Wadi Sdeir"], [/^Arug/i, "Naḥal Arugot"],
    [/^XQ/i, "Qumran, cave unknown"], [/^X/i, "unprovenanced"],
  ];
  return places.find(([re]) => re.test(scroll))?.[1] || "";
}

export const DSS_LEGEND = [
  ["rec", "reconstructed by editors"], ["unc", "uncertain letter"], ["del", "erased by the scribe"],
  ["sup", "written above the line"], ["cor", "corrected"],
];
