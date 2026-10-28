// PWA: service-worker registration, update prompt, install button, online state.
import { h } from "./util.js";

let deferredInstall = null;

export function initPwa() {
  const nav = document.querySelector(".topnav");
  const install = h("button", { class: "btn small install", hidden: true, onclick: async () => {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    await deferredInstall.userChoice;
    deferredInstall = null;
    install.hidden = true;
  } }, "Install app");
  nav.append(install);
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstall = e;
    install.hidden = false;
  });
  window.addEventListener("appinstalled", () => (install.hidden = true));

  // navigator.onLine is only a hint; the router also sets is-offline when a fetch fails.
  const setOnline = () => document.body.classList.toggle("is-offline", !navigator.onLine);
  window.addEventListener("online", setOnline);
  window.addEventListener("offline", setOnline);
  setOnline();

  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const offer = (worker) => showUpdate(() => worker.postMessage("skipWaiting"));
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener("updatefound", () => {
      const worker = reg.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) offer(worker);
      });
    });
    // Check for a new version when the app comes back into view.
    document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && reg.update());
  }).catch((err) => console.warn("Service worker not registered:", err));

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!reloading) {
      reloading = true;
      location.reload();
    }
  });
}

function showUpdate(apply) {
  if (document.querySelector(".toast.update")) return;
  document.body.append(h("div", { class: "toast update", role: "status" },
    "A new version is available. ",
    h("button", { class: "btn primary small", onclick: apply }, "Reload"),
    h("button", { class: "btn small", onclick: (e) => e.target.closest(".toast").remove() }, "Later")));
}

export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const canInstall = () => !!deferredInstall;
export async function promptInstall() {
  document.querySelector(".install")?.click();
}
