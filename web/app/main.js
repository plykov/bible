// App entry: hash router and home page.
import * as data from "./data.js";
import { closePanel } from "./panel.js";
import { initStemmer } from "./stem.js";
import { fill, h, parseRef, setBooks } from "./util.js";
import { renderAbout } from "./views/about.js";
import { renderLxxBook, renderReader } from "./views/reader.js";
import { renderSearch } from "./views/search.js";
import { renderWord } from "./views/word.js";

const app = document.getElementById("app");

async function route() {
  closePanel();
  const [path, qs] = location.hash.replace(/^#/, "").split("?");
  const params = Object.fromEntries(new URLSearchParams(qs || ""));
  const parts = path.split("/").filter(Boolean);
  try {
    if (parts[0] === "r") {
      const [book, ch, vs] = (parts[1] || "Gen.1").split(".");
      await renderReader(app, { book, ch: Number(ch) || 1, vs: Number(vs) || null, w: Number(params.w) || null });
    } else if (parts[0] === "lxx") {
      const [book, ch] = (parts[1] || "").split(".");
      await renderLxxBook(app, { book, ch: Number(ch) || 1 });
    } else if (parts[0] === "w") {
      await renderWord(app, { strong: parts[1], en: params.en });
    } else if (parts[0] === "s") {
      await renderSearch(app, { q: params.q, expand: params.expand });
    } else if (parts[0] === "about") {
      await renderAbout(app);
    } else {
      await renderHome();
    }
  } catch (err) {
    console.error(err);
    fill(app, h("section", {}, h("h1", {}, "Something went wrong"), h("p", {}, String(err.message || err))));
  }
}

async function renderHome() {
  const { books, lxxExtra } = await data.books();
  const group = (t, title, note) => h("div", { class: "book-group" },
    h("h2", {}, title), h("p", { class: "muted" }, note),
    h("div", { class: "book-grid" }, books.filter((b) => b.t === t).map((b) => h("a", { href: `#/r/${b.id}.1` }, b.name))));
  const examples = ["love", "word of God", "spirit", "חסד", "λόγος", "H7225", "Jn 1:1"];
  fill(app, h("section", { class: "home" },
    h("h1", {}, "Hebrew, Aramaic & Greek Interlinear Bible"),
    h("p", { class: "lead" }, "Read the original texts word by word with English glosses, grammar, textual variants and dictionaries. Search an English word to find every original word behind it, and every place it occurs."),
    h("p", { class: "examples" }, "Try: ", examples.map((e) => h("a", { href: `#/s?q=${encodeURIComponent(e)}`, class: "tag" }, e))),
    group("OT", "Old Testament", "Leningrad Codex · Ketiv/Qere, Aleppo and BHS variants · Septuagint and Targum parallels"),
    group("NT", "New Testament", "NA27/28 with TR, Byzantine, SBL, Westcott-Hort, Tregelles and Tyndale House readings"),
    lxxExtra.length ? h("div", { class: "book-group" }, h("h2", {}, "Septuagint — additional books"),
      h("div", { class: "book-grid" }, lxxExtra.map((b) => h("a", { href: `#/lxx/${b.id}.1` }, b.name)))) : null,
  ));
}

document.getElementById("searchForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const q = document.getElementById("searchInput").value.trim();
  if (!q) return;
  const ref = parseRef(q);
  location.hash = ref ? `#/r/${ref.book}.${ref.ch}${ref.vs ? "." + ref.vs : ""}` : `#/s?q=${encodeURIComponent(q)}`;
});

(async () => {
  const [{ books }, table] = await Promise.all([data.books(), fetch(new URL("./stem-irregular.json", import.meta.url)).then((r) => r.json())]);
  initStemmer(table);
  setBooks(books);
  window.addEventListener("hashchange", route);
  route();
})();
