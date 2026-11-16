import { h } from "./ui/Dom.js";
import { MSG } from "../core/MessageBus.js";

const hasChrome = () => typeof chrome !== "undefined" && !!chrome.runtime?.id;
const extUrl = (p) => (hasChrome() ? chrome.runtime.getURL(p) : new URL(`../${p}`, import.meta.url).href);

export class PageProvider {
  constructor(ctx, { studio = false } = {}) {
    this.ctx = ctx;
    this.studio = studio;
    this.frame = null;
    this.frameHost = null;
    this.last = null;
    this.tab = null;
  }

  async activeTab() {
    if (!hasChrome() || !chrome.tabs?.query) return null;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    this.tab = tab || null;
    return this.tab;
  }

  async page() {
    if (this.studio) return this.demoPage();
    const tab = await this.activeTab();
    if (!tab?.id) return this.demoPage();
    let snap = await this.ctx.bus.sendTab(tab.id, MSG.PAGE_SNAPSHOT, {});
    if (!snap) {
      await this.ctx.bus.send(MSG.PAGE_INJECT, { tabId: tab.id }, { local: false });
      snap = await this.ctx.bus.sendTab(tab.id, MSG.PAGE_SNAPSHOT, {});
    }
    if (!snap) return this.demoPage();
    this.ctx.tabId = tab.id;
    this.last = snap;
    return snap;
  }

  async ensureDemo(host) {
    if (this.frame && this.frame.isConnected) {
      if (host && this.frame.parentElement !== host) host.append(this.frame);
      await this.demoReady();
      return this.frame;
    }
    this.frameHost = host || this.frameHost;
    const url = extUrl("demo/index.html");
    let html = "";
    try {
      html = await (await fetch(url)).text();
    } catch {
      html = "<article data-artikel><h1>Demo tidak tersedia</h1><p>Berkas demo/index.html gagal dimuat.</p></article>";
    }
    const base = url.replace(/index\.html$/, "");
    this.frame = h("iframe", {
      class: "demo-frame", title: "Halaman demo riset Kalam",
      srcdoc: html.replace(/<head>/i, `<head><base href="${base}">`),
      sandbox: "allow-same-origin allow-scripts allow-forms",
    });
    (this.frameHost || this.ctx.root).append(this.frame);
    await this.demoReady();
    return this.frame;
  }

  /** Tunggu dokumen srcdoc benar-benar terisi (bukan about:blank awal). */
  demoReady(limit = 4000) {
    const usable = () => {
      const d = this.demoDocument();
      return !!d?.documentElement && !!d.body && d.body.childElementCount > 0 && d.URL !== "about:blank";
    };
    if (usable()) return Promise.resolve(true);
    return new Promise((res) => {
      const started = Date.now();
      const done = (ok) => { this.frame?.removeEventListener("load", onLoad); clearInterval(timer); res(ok); };
      const onLoad = () => { if (usable()) done(true); };
      const timer = setInterval(() => {
        if (usable()) done(true);
        else if (Date.now() - started > limit) done(false);
      }, 60);
      this.frame?.addEventListener("load", onLoad);
    });
  }

  demoDocument() {
    try { return this.frame?.contentDocument || null; } catch { return null; }
  }

  async demoPage(host = null) {
    await this.ensureDemo(host);
    const doc = this.demoDocument();
    if (!doc?.documentElement) return { url: "demo/index.html", title: "Demo", html: "", selection: "" };
    this.last = {
      url: extUrl("demo/index.html"),
      title: doc.title || "Arsip Kota Lama — demo riset",
      html: doc.documentElement.outerHTML,
      selection: String(doc.getSelection?.() || ""),
    };
    return this.last;
  }

  pageLabel() {
    if (this.studio) return "Studio · halaman demo bawaan siap dipakai";
    if (this.tab?.title) return `Tab aktif: ${this.tab.title.slice(0, 60)}`;
    return "Belum ada tab aktif — demo bawaan dipakai";
  }

  fetchHtml(url) { return this.ctx.http.text(url, { timeoutMs: 15000 }); }

  fetchBlob(url) { return this.ctx.http.blob(url, { timeoutMs: 25000 }); }

  destroy() {
    this.frame?.remove();
    this.frame = null;
  }
}
