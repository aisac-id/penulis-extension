import { MSG } from "../core/MessageBus.js";
import { PlatformBridge } from "./PlatformBridge.js";
import { LocalBridge } from "./LocalBridge.js";
import { NativeBridge } from "./NativeBridge.js";
import { WikipediaAdapter } from "./web/WikipediaAdapter.js";

export class ConnectionHub {
  constructor({ settings, vault, http, store, bus, logger }) {
    this.settings = settings;
    this.bus = bus;
    this.log = logger?.child?.("connect") || logger;
    this.platform = new PlatformBridge(settings, vault, http, store, bus, logger);
    this.local = new LocalBridge(settings, vault, store, bus, logger);
    this.native = new NativeBridge(settings, bus, logger);
    this.wikipedia = new WikipediaAdapter(settings, http);
    this.bridges = [this.platform, this.local, this.native, this.wikipedia];
    this.results = new Map();
  }

  async load() {
    await this.platform.load();
    return this.status();
  }

  list() {
    return this.bridges.map((b) => ({
      id: b.id, label: b.label, on: b.enabled(),
      desc: {
        platform: "Kirim kliping & progres ke platform penulis Anda. Butuh URL HTTPS + ingest token.",
        local: "Sambungkan ke CLI di komputer sendiri (loopback saja) untuk konversi & cadangan.",
        native: "Simpan naskah langsung ke folder komputer lewat aplikasi pendamping.",
        wikipedia: "Cari bahan riset di Wikipedia bahasa Indonesia, lengkap dengan sumber.",
      }[b.id],
      needs: {
        platform: "koneksi.platformAktif + INGEST_TOKEN",
        local: "koneksi.localAktif + PAIRING_TOKEN + CLI berjalan",
        native: "koneksi.nativeAktif + host terpasang",
        wikipedia: "koneksi.wikiAktif + izin host wikipedia.org",
      }[b.id],
    }));
  }

  get(id) { return this.bridges.find((b) => b.id === id) || null; }

  status() { return this.bridges.map((b) => b.status()); }

  async test(id) {
    const b = this.get(id);
    if (!b) return { ok: false, detail: "Jembatan tidak dikenal." };
    const res = await b.test();
    this.results.set(id, { ...res, at: new Date().toISOString() });
    this.bus.emit("connect.status", { id, ...res });
    return res;
  }

  async testAll() {
    const out = [];
    for (const b of this.bridges) out.push({ id: b.id, ...(await this.test(b.id)) });
    return out;
  }

  async requestHost(origins) {
    if (typeof chrome === "undefined" || !chrome.permissions?.request) return true;
    try {
      return await chrome.permissions.request({ origins });
    } catch {
      return false;
    }
  }

  async enable(id) {
    const key = { platform: "koneksi.platformAktif", local: "koneksi.localAktif", native: "koneksi.nativeAktif", wikipedia: "koneksi.wikiAktif" }[id];
    if (!key) return { ok: false, detail: "Jembatan tidak dikenal." };
    if (id === "wikipedia") {
      const ok = await this.requestHost(["https://*.wikipedia.org/*"]);
      if (!ok) return { ok: false, detail: "Izin host Wikipedia ditolak." };
    }
    if (id === "platform") {
      const url = String(this.settings.get("koneksi.platformUrl") || "");
      if (!/^https:\/\//i.test(url)) return { ok: false, detail: "Isi Platform URL dengan HTTPS dulu." };
      const host = new URL(url).origin;
      const ok = await this.requestHost([`${host}/*`]);
      if (!ok) return { ok: false, detail: "Izin host platform ditolak." };
    }
    await this.settings.set(key, true);
    this.bus.emit("connect.status", { id, on: true });
    return { ok: true, detail: "Aktif." };
  }

  async disable(id) {
    const key = { platform: "koneksi.platformAktif", local: "koneksi.localAktif", native: "koneksi.nativeAktif", wikipedia: "koneksi.wikiAktif" }[id];
    if (!key) return { ok: false };
    await this.settings.set(key, false);
    if (id === "local") this.local.disconnect();
    if (id === "native") this.native.disconnect();
    this.bus.emit("connect.status", { id, on: false });
    return { ok: true, detail: "Dimatikan." };
  }

  registerHandlers() {
    this.bus.on(MSG.CONNECT_TEST, async ({ id }) => this.test(id));
    this.bus.on(MSG.CONNECT_STATUS, () => this.status());
  }

  destroy() {
    this.local.disconnect();
    this.native.disconnect();
  }
}