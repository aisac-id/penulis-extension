import { AppContext } from "../sidebar/AppContext.js";
import { SidebarApp } from "../sidebar/SidebarApp.js";

/** StudioApp — Kalam di tab penuh: layanan yang sama, ruang lebih lebar, demo riset bawaan. */
class StudioApp {
  constructor(root) {
    this.root = root;
    this.ctx = new AppContext(root, { mode: "fullscreen" });
    this.app = null;
    this.off = [];
  }

  async boot() {
    await this.ctx.load();
    this.app = new SidebarApp(this.ctx, { studio: true });
    await this.app.mount();
    this.app.setMode("fullscreen", { silent: true });
    this.syncTheme();
    this.off.push(this.ctx.settings.onChange(() => this.syncTheme()));
    this.off.push(this.ctx.bus.on("license.changed", () => this.syncTitle()));
    this.syncTitle();
    window.addEventListener("beforeunload", () => this.ctx.editor?.flush());
    return this;
  }

  syncTheme() {
    const theme = this.root.dataset.theme || "dark";
    document.body.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }

  syncTitle() {
    const p = this.ctx.projects.active;
    document.title = p ? `${p.title} — ${this.ctx.brand.name} Studio` : `${this.ctx.brand.name} Studio`;
  }

  destroy() {
    for (const off of this.off.splice(0)) off();
    this.app?.destroy();
    this.ctx.destroy();
  }
}

const root = document.getElementById("kalam-root");
const studio = new StudioApp(root);
studio.boot().catch((err) => {
  root.textContent = `Kalam Studio gagal dimuat: ${err.message}. Muat ulang halaman; data Anda tetap aman di perangkat.`;
});
window.kalamStudio = studio;