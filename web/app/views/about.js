// Sources, licences and credits (CC BY requires attribution).
import * as data from "../data.js";
import { fill, h } from "../util.js";

const LIVE = [
  ["Sefaria", "https://www.sefaria.org", "Jastrow, BDB and Klein dictionaries on the word-study page, loaded live."],
];

const PLANNED = [
  ["MACULA syntax trees & participant referents", "CC BY 4.0", "Clause structure and who-does-what for each verse"],
  ["ETCBC BHSA", "CC BY-NC 4.0", "Clause and phrase linguistics for the Hebrew Bible"],
  ["ETCBC Peshitta", "MIT", "Syriac Old Testament"],
  ["LXX Rahlfs 1935 (CCAT / Eliran Wong)", "CC BY-NC-SA + CCAT declaration", "Tagged Septuagint — needs the CCAT user declaration before any public build"],
  ["CNTR, NTVMR", "CC BY-SA / CC", "Early New Testament manuscript transcriptions"],
];

export async function renderAbout(app) {
  const meta = await data.meta().catch(() => null);
  fill(app, h("section", { class: "about" },
    h("h1", {}, "Sources & licences"),
    h("p", {}, "This is a non-commercial study tool. Original texts, tags, glosses and dictionaries come from the open datasets below and are rebuilt from pinned upstream commits on every deploy."),
    h("h2", {}, "Bundled data"),
    h("table", { class: "lemma-table" },
      h("thead", {}, h("tr", {}, h("th", {}, "Source"), h("th", {}, "Licence"), h("th", {}, "Commit"))),
      h("tbody", {}, Object.entries(meta?.sources || {}).map(([, s]) => h("tr", {},
        h("td", {}, h("a", { href: s.url, target: "_blank", rel: "noopener" }, s.credit)),
        h("td", {}, s.license), h("td", {}, h("code", {}, s.commit.slice(0, 10))))))),
    h("p", { class: "muted" }, "STEPBible data: TAHOT (Hebrew OT), TAGNT (Greek NT with 8 editions), TBESH (abridged BDB), TBESG (Abbott-Smith), TFLSJ (LSJ), TEHMC/TEGMC (morphology). Data created by www.STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0). Hebrew text derived from the Westminster Leningrad Codex via OpenScriptures; English glosses based on the Berean Study Bible."),
    h("p", { class: "muted" }, "Dead Sea Scrolls (ETCBC/CACCHT, CC BY-NC 4.0): biblical scroll readings from Martin Abegg’s transcriptions, shown under each verse with the editors’ reconstructions marked."),
    h("p", { class: "muted" }, "MACULA Hebrew & Greek (Biblica / Clear Bible, CC BY 4.0): Louw–Nida (Greek) and SDBH (Hebrew) semantic domains, used with permission of the United Bible Societies; cross-language synonym scores; Septuagint Hebrew↔Greek word alignments. These power “Related words” and the meaning field in search."),
    meta ? h("p", { class: "muted" }, `${meta.counts.ot_words.toLocaleString()} Hebrew/Aramaic words · ${meta.counts.nt_words.toLocaleString()} Greek words · ${meta.counts.lemmas.toLocaleString()} dictionary entries.`) : null,
    h("h2", {}, "Loaded live"),
    h("ul", {}, LIVE.map(([n, u, d]) => h("li", {}, h("a", { href: u, target: "_blank", rel: "noopener" }, n), " — ", d))),
    h("h2", {}, "Coming next"),
    h("ul", {}, PLANNED.map(([n, l, d]) => h("li", {}, h("strong", {}, n), ` (${l}) — ${d}`))),
  ));
}
