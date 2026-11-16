import { h, clear, icon, num } from "./ui/Dom.js";
import { Controls } from "./ui/Controls.js";
import { VerticalTabs } from "./VerticalTabs.js";
import { PageProvider } from "./PageProvider.js";
import { OnboardingFlow } from "../onboarding/OnboardingFlow.js";
import { LocalExecutor, TabExecutor } from "../rpa/Executors.js";
import { MSG } from "../core/MessageBus.js";
import { PANELS } from "./panels/index.js";

export class SidebarApp {
  constructor(ctx, { studio = false } = {}) {
    this.ctx = ctx;
    this.studio = studio;
    this.root = ctx.root;
    this.pages = new PageProvider(ctx, { studio });
    this.instances = new Map();
    this.current = null;
    this.mode = studio ? "fullscreen" : ctx.settings.get("umum.modeDefault");
    this.cleanups = [];
    this.onb = null;
    this._wireCtx();
  }

  _wireCtx() {
    const c = this.ctx;
    c.app = this;
    c.pages = this.pages;
    c.studio = this.studio;
    c.openPanel = (id) => this.openPanel(id);
    c.setMode = (m) => this.setMode(m);
    c.pageLabel = () => this.pages.pageLabel();
    c.demoHost = () => this.demoHost;
    c.runDemo = () => this.runDemo();
    c.runDemoScript = (id) => this.runDemoScript(id);
    c.burst = (delta) => this.burst(delta);
    c.onWords = () => this.paintStatus();
    c.onEditorBack = () => this.openPanel("naskah");
    c.closeOnboarding = () => this.hideOnboarding();
    c.onOnboardingDone = () => { this.onbHost.hidden = true; this.paintStatus(); };
  }

  async mount() {
    this.shell = h("div", { class: "shell" });
    this.main = h("div", { class: "shell__main" });
    this.top = h("header", { class: "top" });
    this.panelHost = h("div", { class: "panel-host" });
    this.onbHost = h("div", { class: "onb-host" });
    this.demoHost = h("div", { class: "demo-host", hidden: true });
    this.status = h("footer", { class: "statusbar" });
    this.main.append(this.top, this.onbHost, this.panelHost, this.demoHost, this.status);
    this.tabs = new VerticalTabs(this.shell, { onPick: (id) => this.openPanel(id) });
    this.tabs.setPanels(PANELS);
    this.shell.append(this.main);
    this.root.append(this.shell);
    this.paintTop();
    this.setMode(this.mode, { silent: true });
    this.bindKeys();
    this.bindBus();
    this.bindResize();
    await this.openPanel(this.ctx.settings.get("umum.panelAwal") || "naskah");
    this.onb = new OnboardingFlow(this.ctx, this.ctx.store, this.ctx.bus);
    await this.onb.load();
    if (this.onb.shouldShow) { this.onbHost.hidden = false; await this.onb.start(this.onbHost); }
    else this.onbHost.hidden = true;
    this.paintStatus();
    return this;
  }

  paintTop() {
    const c = this.ctx;
    const info = c.license.info();
    clear(this.top);
    this.top.append(
      h("div", { class: "top__brand" }, [
        icon("quill", 18),
        h("strong", { class: "top__name", text: c.brand.name }),
        h("span", { class: `edition edition--${info.edition}`, text: info.mode === "uji coba" ? `Pro ${info.trialDaysLeft}h` : info.label }),
      ]),
      h("div", { class: "top__acts" }, [
        c.sound.button(),
        Controls.iconButton("rail", "Ciutkan jadi rail (Alt+Shift+S)", () => this.setMode(this.mode === "rail" ? "sidebar" : "rail"), { active: this.mode === "rail" }),
        Controls.iconButton(this.mode === "fullscreen" ? "collapse" : "expand", "Layar penuh (Alt+Shift+F)", () => this.setMode(this.mode === "fullscreen" ? "sidebar" : "fullscreen")),
        Controls.iconButton("help", "Bantuan panel ini", () => c.help.open(this.current || "naskah")),
        this.studio ? null : Controls.iconButton("x", "Tutup sidebar (Esc)", () => this.close()),
      ].filter(Boolean)),
    );
    const acts = this.top.querySelectorAll(".top__acts .icon-btn");
    if (acts[0]) acts[0].dataset.act = "toggle-rail";
    if (acts[1]) acts[1].dataset.act = "fullscreen";
  }

  setMode(mode, { silent = false } = {}) {
    this.mode = mode;
    this.root.dataset.mode = mode;
    this.root.style.setProperty("--kalam-w", `${this.ctx.settings.num("umum.lebarSidebar")}vw`);
    if (!this.studio) this.ctx.bus.send(MSG.SIDEBAR_MODE, { mode }, { local: false }).catch(() => {});
    this.paintTop();
    if (!silent) this.ctx.sound.click();
    this.instances.get(this.current)?.onMode?.(mode);
    this.ctx.bus.emit("mode.changed", { mode });
    return mode;
  }

  async openPanel(id) {
    const spec = PANELS.find((p) => p.id === id) || PANELS[0];
    if (this.current === spec.id && this.instances.has(spec.id)) {
      this.instances.get(spec.id).refresh?.();
      return this.instances.get(spec.id);
    }
    this.instances.get(this.current)?.suspend?.();
    let panel = this.instances.get(spec.id);
    if (!panel) {
      panel = spec.make(this.ctx);
      this.instances.set(spec.id, panel);
    }
    this.current = spec.id;
    this.tabs.setActive(spec.id);
    clear(this.panelHost);
    const wrap = h("section", { class: "panel", role: "tabpanel", "aria-label": spec.title, dataset: { panel: spec.id } });
    wrap.append(
      h("header", { class: "panel__head" }, [h("h2", { text: spec.title }), h("div", { class: "panel__acts" }, [this.ctx.help.button(spec.id)])]),
      h("div", { class: "panel__body" }),
    );
    this.panelHost.append(wrap);
    await panel.render(wrap.lastChild, this.mode);
    this.paintStatus();
    this.ctx.sound.click();
    return panel;
  }

  paintStatus() {
    const p = this.ctx.projects.progress();
    const g = this.ctx.goals;
    clear(this.status);
    const narrow = (this.root?.clientWidth || 900) < 430;
    this.status.append(...[
      h("span", { class: "statusbar__i", text: narrow ? `${num(p.words)} kata` : `${num(p.words)} / ${num(p.target)} kata` }),
      h("span", { class: "statusbar__i", text: narrow ? `+${num(g.todayWords)}` : `hari ini ${num(g.todayWords)}` }),
      h("span", { class: "statusbar__i", text: narrow ? `${g.streak()}h` : `streak ${g.streak()} hari` }),
      narrow ? null : h("span", { class: "statusbar__i statusbar__i--right", text: this.pages.pageLabel() }),
    ].filter(Boolean));
    this.tabs.badge("target", g.todayWords >= g.goal ? "✓" : null);
    this.tabs.badge("data", this.ctx.library.items.length || null);
  }

  bindKeys() {
    this._onKey = (e) => {
      if (e.altKey && e.shiftKey && (e.key === "S" || e.key === "s")) { e.preventDefault(); this.setMode(this.mode === "rail" ? "sidebar" : "rail"); }
      else if (e.altKey && e.shiftKey && (e.key === "F" || e.key === "f")) { e.preventDefault(); this.setMode(this.mode === "fullscreen" ? "sidebar" : "fullscreen"); }
      else if (e.key === "Escape" && !this.ctx.modal.isOpen && !this.ctx.drawer.isOpen) {
        if (this.mode === "fullscreen") this.setMode("sidebar");
        else if (!this.studio) this.close();
      }
    };
    window.addEventListener("keydown", this._onKey, true);
    this.cleanups.push(() => window.removeEventListener("keydown", this._onKey, true));
  }

  bindResize() {
    if (typeof ResizeObserver === "undefined") return;
    let last = this.root.clientWidth;
    const ro = new ResizeObserver(() => {
      const w = this.root.clientWidth;
      if ((w < 430) !== (last < 430)) { last = w; this.paintStatus(); }
    });
    ro.observe(this.root);
    this.cleanups.push(() => ro.disconnect());
  }

  bindBus() {
    const c = this.ctx;
    const on = (t, fn) => this.cleanups.push(c.bus.on(t, fn));
    on(MSG.SIDEBAR_MODE, ({ mode }) => { if (mode !== this.mode) this.setMode(mode, { silent: true }); });
    for (const t of ["project.changed", "goal.changed", "data.changed"]) on(t, () => this.paintStatus());
    on("license.changed", () => this.paintTop());
    on("settings.changed", () => { this.paintTop(); this.setMode(this.mode, { silent: true }); });
    on("data.quota", (q) => c.toast.warn(`Kuota riset ${Math.round(q.ratio * 100)}% terpakai.`));
  }

  async runDemo() {
    this.demoHost.hidden = false;
    const page = await this.pages.demoPage(this.demoHost);
    const text = await this.ctx.pipeline.run("text", page, { dataset: "Demo riset", tags: ["demo"] });
    const img = await this.ctx.pipeline.run("image", page, { dataset: "Demo riset", tags: ["demo"], fetchBlob: (url) => this.pages.fetchBlob(url) });
    this.paintStatus();
    return { added: [...text.added, ...img.added], ok: text.ok || img.ok };
  }

  async runDemoScript(templateId = "kliping") {
    const list = this.ctx.scripts.list();
    const script = list.find((s) => s.id === templateId) || list[0];
    this.demoHost.hidden = false;
    await this.pages.ensureDemo(this.demoHost);
    const doc = this.pages.demoDocument();
    const executor = doc
      ? new LocalExecutor(this.ctx.settings, { root: doc, bus: this.ctx.bus, logger: this.ctx.log })
      : new TabExecutor(this.ctx.bus, this.ctx.tabId);
    try {
      return await this.ctx.rpa.run(script, executor);
    } catch (err) {
      this.ctx.toast.error(err.message);
      return { state: "error", results: [] };
    }
  }

  burst(delta) {
    if (delta <= 0 || !this.ctx.settings.bool("umum.animasi")) return;
    const host = h("div", { class: "wordburst", text: `+${delta}` });
    this.root.append(host);
    for (let i = 0; i < Math.min(6, Math.max(2, Math.round(delta / 12))); i++) {
      host.append(h("i", { class: "spark", style: { "--dx": `${(Math.random() - 0.5) * 90}px`, "--dy": `${-30 - Math.random() * 60}px` } }));
    }
    setTimeout(() => host.remove(), 1100);
  }

  hideOnboarding() {
    this.onbHost.hidden = true;
    this.ctx.toast.info("Tutorial disimpan. Lanjutkan kapan saja dari Pengaturan → Umum.");
  }

  async restartOnboarding() {
    this.onbHost.hidden = false;
    if (!this.onb) this.onb = new OnboardingFlow(this.ctx, this.ctx.store, this.ctx.bus);
    await this.onb.restart(this.onbHost);
  }

  close() {
    this.ctx.bus.send(MSG.SIDEBAR_TOGGLE, { open: false }, { local: false }).catch(() => {});
    this.root.dispatchEvent(new CustomEvent("kalam:close"));
  }

  destroy() {
    for (const off of this.cleanups.splice(0)) { try { off(); } catch { /* selesai */ } }
    for (const p of this.instances.values()) p.destroy?.();
    this.instances.clear();
    this.onb?.destroy();
    this.pages.destroy();
    this.tabs.destroy();
    clear(this.root);
  }
}
