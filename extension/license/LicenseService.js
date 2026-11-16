import { Ed25519 } from "./Ed25519.js";
import { MSG } from "../core/MessageBus.js";
const DAY = 86400000;
export const EDITIONS = {
  free: { label: "Gratis", features: ["naskah", "editor", "rencana", "bible", "target", "analisis", "riset", "data", "ekspor.md", "ekspor.txt", "ekspor.json", "rpa", "ai.lokal", "onboarding"] },
  pro: { label: "Pro", features: ["*", "ekspor.epub", "ekspor.docx", "ekspor.zip", "ai.cloud", "koneksi", "batch", "whiteLabel"] },
  "bundle-studio": { label: "Bundle Studio", features: ["*", "tim", "platform", "native"] },
  enterprise: { label: "Enterprise", features: ["*", "sso", "audit", "prioritas"] },
};
export class LicenseService {
  constructor(store, settings, bus, logger) {
    this.store = store;
    this.settings = settings;
    this.bus = bus;
    this.log = logger?.child?.("license") || logger;
    this.state = { edition: "free", trialStartedAt: null, license: null, verified: false, lastCheckAt: 0, email: "" };
  }
  async load() {
    const saved = await this.store.get("license", null);
    if (saved) this.state = { ...this.state, ...saved };
    if (!this.state.trialStartedAt) {
      this.state.trialStartedAt = new Date().toISOString();
      await this.save();
    }
    if (this.state.license) await this.recheck();
    return this.info();
  }
  async save() {
    this.state.lastCheckAt = Date.now();
    await this.store.set("license", this.state);
    this.bus.emit("license.changed", this.info());
    this.bus.send(MSG.LICENSE_CHANGED, this.info(), { local: false }).catch(() => {});
  }
  trialDaysLeft() {
    return Math.max(0, 14 - Math.floor((Date.now() - new Date(this.state.trialStartedAt || Date.now()).getTime()) / DAY));
  }
  get edition() {
    if (this.state.verified && this.state.license) {
      const until = this.state.license.expiry || this.state.license.expiresAt;
      if (Date.now() <= (until ? new Date(until).getTime() : Infinity)) return this.state.license.edition;
    }
    return this.trialDaysLeft() > 0 ? "pro" : "free";
  }
  get mode() {
    if (this.state.verified && this.state.license) return "lisensi";
    return this.trialDaysLeft() > 0 ? "uji coba" : "gratis";
  }
  can(feature) {
    const ed = EDITIONS[this.edition] || EDITIONS.free;
    return ed.features.includes("*") || ed.features.includes(feature) ||
      (this.edition !== "free" && EDITIONS.free.features.includes(feature));
  }
  async activate(text, publicKey = null) {
    let data;
    try { data = JSON.parse(String(text).trim()); } catch { return { ok: false, detail: "Kunci lisensi harus JSON." }; }
    const payload = data.payload || data.license || data;
    const signature = data.signature || data.sig;
    if (!signature) return { ok: false, detail: "Tanda tangan lisensi tidak ada." };
    const ok = await Ed25519.verify(payload, signature, publicKey || this.settings.get("lanjutan.kunciPublik") || Ed25519.PUBLIC_KEY);
    if (!ok) return { ok: false, detail: "Tanda tangan tidak cocok dengan kunci penerbit." };
    if (!EDITIONS[payload.edition]) return { ok: false, detail: `Edisi tidak dikenal: ${payload.edition}` };
    this.state.license = payload;
    this.state.signature = signature;
    this.state.verified = true;
    this.state.email = payload.issuedTo || payload.email || "";
    await this.save();
    return { ok: true, detail: `Edisi ${EDITIONS[payload.edition].label} aktif.` };
  }
  async demoKey() {
    const url = typeof chrome !== "undefined" && chrome.runtime?.getURL
      ? chrome.runtime.getURL("docs/lisensi-demo.json")
      : new URL("../docs/lisensi-demo.json", import.meta.url).href;
    try {
      return await (await fetch(url)).text();
    } catch {
      return "";
    }
  }
  async recheck() {
    if (!this.state.license) return false;
    const ok = await Ed25519.verify(this.state.license, this.state.signature || "", this.settings.get("lanjutan.kunciPublik") || Ed25519.PUBLIC_KEY);
    this.state.lastCheckAt = Date.now();
    if (!ok && this.offlineGraceLeft() <= 0) this.state.verified = false;
    await this.store.set("license", this.state);
    return this.state.verified;
  }
  offlineGraceLeft() {
    return Math.max(0, 14 - Math.floor((Date.now() - (this.state.lastCheckAt || Date.now())) / DAY));
  }
  async deactivate() {
    this.state.license = null;
    this.state.verified = false;
    this.state.email = "";
    await this.save();
    return { ok: true, detail: "Lisensi dilepas. Data Anda tetap utuh." };
  }
  info() {
    const ed = this.edition;
    return {
      edition: ed, label: EDITIONS[ed]?.label || ed, mode: this.mode,
      trialDaysLeft: this.trialDaysLeft(), graceDays: this.offlineGraceLeft(),
      verified: this.state.verified, email: this.state.email,
      expiry: this.state.license?.expiry || this.state.license?.expiresAt || null,
      bundleId: this.state.license?.bundleId || "",
      seats: this.state.license?.seats || 1,
      features: EDITIONS[ed]?.features || [],
    };
  }
  reason(feature) {
    if (this.can(feature)) return "";
    return `Fitur ini bagian dari edisi Pro. Uji coba ${this.trialDaysLeft()} hari lagi — data Anda tetap bisa dibuka dan diekspor.`;
  }
}
