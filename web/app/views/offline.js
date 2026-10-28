// Offline page: download data sets into the cache the service worker serves from.
import * as data from "../data.js";
import { canInstall, isIos, isStandalone, promptInstall } from "../pwa.js";
import { fill, h, save, store } from "../util.js";

const DATA_CACHE = "data-v1";  // must match web/sw.js
const BASE = new URL("../../", import.meta.url);
const mb = (b) => `${(b / 1e6).toFixed(1)} MB`;

export async function renderOffline(app) {
  const sets = await data.getJSON("offline.json").catch(() => null);
  const supported = "caches" in window && "serviceWorker" in navigator;
  const storageLine = h("p", { class: "muted" });
  const status = store("offline-sets", {});

  async function refreshStorage() {
    if (!navigator.storage?.estimate) return;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const persisted = await navigator.storage.persisted?.();
    fill(storageLine, `Storage used by this app: ${mb(usage)} of ${mb(quota)} available`,
      persisted ? " · protected from automatic clean-up" : " · may be cleared by the browser when space is low");
  }

  const actions = [];
  const rows = Object.entries(sets || {}).map(([id, set]) => {
    const bar = h("progress", { max: set.files.length, value: 0, hidden: true });
    const state = h("span", { class: "muted small" }, status[id] ? `downloaded ${new Date(status[id]).toLocaleDateString()}` : "");
    const get = h("button", { class: "btn small primary", onclick: () => download(id, set, bar, state, get) }, status[id] ? "Update" : "Download");
    const del = h("button", { class: "btn small", onclick: () => remove(id, set, state, get) }, "Remove");
    actions.push(() => download(id, set, bar, state, get));
    return h("tr", {},
      h("td", {}, h("strong", {}, set.label), h("div", { class: "muted small" }, set.desc)),
      h("td", {}, mb(set.bytes)),
      h("td", {}, get, " ", del, " ", state, bar));
  });

  async function download(id, set, bar, state, btn) {
    if (navigator.storage?.persist) await navigator.storage.persist();
    btn.disabled = true;
    bar.hidden = false;
    bar.value = 0;
    const cache = await caches.open(DATA_CACHE);
    let done = 0, failed = 0;
    const queue = [...set.files];
    const worker = async () => {
      while (queue.length) {
        const f = queue.shift();
        try {
          const res = await fetch(new URL(f, BASE), { cache: "no-cache" });
          if (!res.ok) throw new Error(res.status);
          await cache.put(new URL(f, BASE), res);
        } catch {
          failed++;
        }
        bar.value = ++done;
        state.textContent = `${done} / ${set.files.length} files`;
      }
    };
    await Promise.all(Array.from({ length: 6 }, worker));
    btn.disabled = false;
    if (failed) {
      state.textContent = `${failed} files failed; try again when online`;
    } else {
      status[id] = Date.now();
      save("offline-sets", status);
      state.textContent = `downloaded ${new Date().toLocaleDateString()}`;
      btn.textContent = "Update";
    }
    bar.hidden = true;
    refreshStorage();
  }

  async function remove(id, set, state, btn) {
    const cache = await caches.open(DATA_CACHE);
    await Promise.all(set.files.map((f) => cache.delete(new URL(f, BASE))));
    delete status[id];
    save("offline-sets", status);
    state.textContent = "removed";
    btn.textContent = "Download";
    refreshStorage();
  }

  const total = Object.values(sets || {}).reduce((s, x) => s + x.bytes, 0);
  const installBox = isStandalone() ? h("p", {}, "✓ Running as an installed app.")
    : isIos() ? h("p", {}, "To install on iPhone or iPad: open this site in Safari, tap the Share button, then “Add to Home Screen”.")
      : h("p", {}, canInstall()
        ? h("button", { class: "btn primary", onclick: () => promptInstall() }, "Install app")
        : "To install, use your browser’s “Install app” or “Add to Home screen” menu item.");
  fill(app, h("section", { class: "offline-page" },
    h("h1", {}, "Install & offline use"),
    h("h2", {}, "Install"), installBox,
    h("h2", {}, "Offline"),
    h("p", {}, "The app itself works offline once it has been opened. Every chapter, dictionary page and search you open is kept and refreshed in the background. To have everything available without a connection, download the sets you want:"),
    !supported ? h("p", { class: "note" }, "This browser doesn’t support offline storage.") : null,
    sets ? h("table", { class: "lemma-table offline-sets" },
      h("thead", {}, h("tr", {}, h("th", {}, "Data"), h("th", {}, "Size"), h("th", {}))),
      h("tbody", {}, rows)) : h("p", {}, "Offline data list not found (run scripts/build_pwa.py)."),
    sets ? h("p", {},
      h("button", { class: "btn", onclick: async (e) => {
        e.target.disabled = true;
        for (const run of actions) await run();  // one set at a time
        e.target.disabled = false;
      } }, `Download everything (${mb(total)})`),
      h("span", { class: "muted small" }, " Live dictionary look-ups from Sefaria still need a connection.")) : null,
    storageLine));
  refreshStorage();
}
