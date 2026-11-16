/** Loader — bootstrap klasik: memuat modul ContentBridge sekali per tab (tanpa bundler). */
(() => {
  if (window.__kalamLoader) return;
  window.__kalamLoader = true;
  const url = chrome.runtime.getURL("content/ContentBridge.js");
  import(url).catch((err) => {
    window.__kalamLoader = false;
    console.warn("[Kalam] gagal memuat modul:", err?.message || err);
  });
})();