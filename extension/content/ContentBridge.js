import { AppContext } from "../sidebar/AppContext.js";
import { SidebarApp } from "../sidebar/SidebarApp.js";
import { LocalExecutor } from "../rpa/Executors.js";
import { MSG } from "../core/MessageBus.js";

const STYLES = ["layout", "tokens", "base", "overlays", "panels", "editor"];
const HOST_ID = "kalam-harness-host";

class ContentBridge {
  constructor() {
    this.host = document.getElementById(HOST_ID);
    if (!this.host) {
      this.host = document.createElement("div");
      this.host.id = HOST_ID;
      this.host.setAttribute("data-mode", "sidebar");
      document.documentElement.append(this.host);
    }
    this.shadow = this.host.shadowRoot || this.host.attachShadow({ mode: "open" });
    this.root = document.createElement("div");
    this.root.className = "kalam-root";
    this.root.setAttribute("role", "complementary");
    this.root.setAttribute("aria-label", "Kalam — ruang kerja penulis buku");
    this.shadow.append(this.root);
    this.ctx = null;
    this.app = null;
    this.executor = null;
    this.open = false;
    this.off = [];
    this.booting = this.boot();
  }

  async boot() {
    await this.styles();
    this.ctx = new AppContext(this.root, { mode: "sidebar" });
    await this.ctx.load();
    this.app = new SidebarApp(this.ctx);
    await this.app.mount();
    this.executor = new LocalExecutor(this.ctx.settings, { root: document, bus: this.ctx.bus, logger: this.ctx.log });
    this.bind();
    this.host.dataset.mode = this.app.mode;
    this.show(true);
    this.ctx.bus.send(MSG.SIDEBAR_READY, { url: location.href }, { local: false });
    return this;
  }

  async styles() {
    const parts = [];
    for (const name of STYLES) {
      const url = chrome.runtime.getURL(`styles/${name}.css`);
      try { parts.push(await (await fetch(url)).text()); } catch { /* gaya opsional gagal: lanjut */ }
    }
    const style = document.createElement("style");
    style.textContent = parts.join("\n");
    this.shadow.prepend(style);
  }

  bind() {
    const bus = this.ctx.bus;
    this.off.push(bus.on(MSG.SIDEBAR_PING, () => ({ ok: true, open: this.open, mode: this.app.mode })));
    this.off.push(bus.on("mode.changed", ({ mode }) => { this.host.dataset.mode = mode; this.push(this.open); }));
    this.off.push(bus.on(MSG.SIDEBAR_TOGGLE, ({ toggle, open }) => {
      this.show(toggle ? !this.open : open !== false);
      return { ok: true, open: this.open };
    }));
    this.off.push(bus.on(MSG.SIDEBAR_MODE, ({ mode }) => {
      if (!this.open) this.show(true);
      this.app.setMode(mode, { silent: true });
      return { ok: true, mode };
    }));
    this.off.push(bus.on(MSG.PAGE_SNAPSHOT, () => this.snapshot()));
    this.off.push(bus.on(MSG.PAGE_ACT, (p) => this.act(p)));
    this.off.push(bus.on(MSG.SCRAPE_RUN, (p) => this.clip(p)));
    this.off.push(bus.on(MSG.ONBOARDING, (p) => {
      if (p?.kind === "pengingat" && this.open) {
        this.ctx.toast.info(`Waktunya menulis. Target hari ini ${this.ctx.goals.goal} kata, sudah ${this.ctx.goals.todayWords}.`);
      }
      return { ok: true };
    }));
    this.off.push(bus.on(MSG.CONNECT_STATUS, async (p) => {
      if (p?.kind !== "rawat") return { ok: true };
      const sent = await this.ctx.connections.platform.flush(5).catch(() => ({ sent: 0 }));
      return { ok: true, ...sent };
    }));
    this._close = () => this.show(false);
    this.root.addEventListener("kalam:close", this._close);
    this._unload = () => this.destroy();
    window.addEventListener("pagehide", this._unload, { once: true });
  }

  show(open) {
    this.open = !!open;
    this.host.hidden = !this.open;
    this.push(open);
    if (this.open) this.app.tabs.focusActive();
    return this.open;
  }

  push(open) {
    const on = open && this.ctx.settings.bool("umum.dorongKonten") && this.app.mode !== "fullscreen";
    const w = on ? `${this.host.getBoundingClientRect().width}px` : "";
    document.documentElement.style.setProperty("scroll-padding-right", w);
    document.body.style.transition = "margin-right 240ms cubic-bezier(0.22,0.68,0.24,1)";
    document.body.style.marginRight = w;
  }

  snapshot() {
    return {
      url: location.href,
      title: document.title,
      html: document.documentElement.outerHTML,
      selection: String(window.getSelection?.() || ""),
      lang: document.documentElement.lang || "id",
    };
  }

  async act({ op, step, cond }) {
    await this.booting;
    if (op === "test") return { value: this.executor.test(cond) };
    if (op === "blocked") return { reason: this.executor.blocked() };
    try {
      const res = await this.executor.run(step);
      return res;
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async clip({ text, url }) {
    await this.booting;
    if (!text) return { ok: false };
    if (!this.open) this.show(true);
    const res = await this.ctx.pipeline.ingest(
      { type: "text", title: document.title || "Kliping halaman", text, url: url || location.href },
      { dataset: "Kliping halaman", tags: ["kliping"], url: url || location.href },
    );
    this.ctx.toast.ok(res.duplicate ? "Kliping ini sudah tersimpan." : "Kliping masuk pustaka riset.");
    this.ctx.openPanel("data");
    return { ok: true, duplicate: res.duplicate };
  }

  destroy() {
    for (const off of this.off.splice(0)) off();
    this.root.removeEventListener("kalam:close", this._close);
    this.executor?.destroy();
    this.app?.destroy();
    this.ctx?.destroy();
    document.body.style.marginRight = "";
    this.host.remove();
    window.__kalamBridge = null;
    window.__kalamLoader = false;
  }
}

if (window.__kalamBridge) window.__kalamBridge.booting.then((b) => b.show(true));
else window.__kalamBridge = new ContentBridge();