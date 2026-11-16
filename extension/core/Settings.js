import { SCHEMA, DEFAULTS, CATEGORIES, SETTINGS_VERSION } from "./SettingsSchema.js";
import { AppError, ERR } from "./AppError.js";
export class Settings {
  constructor(store, bus, logger) {
    this.store = store;
    this.bus = bus;
    this.log = logger?.child?.("settings") || logger;
    this.schema = SCHEMA;
    this.categories = CATEGORIES;
    this.values = { ...DEFAULTS };
    this.listeners = new Set();
    this.version = SETTINGS_VERSION;
  }
  async load() {
    const saved = await this.store.get("settings", {});
    const ver = await this.store.get("settingsVersion", 0);
    this.values = { ...DEFAULTS, ...(saved || {}) };
    if (ver !== SETTINGS_VERSION) await this.migrate(ver);
    return this.values;
  }
  async migrate(from) {
    this.log?.info("migrasi settings", from, "→", SETTINGS_VERSION);
    for (const s of this.schema) if (this.values[s.key] === undefined) this.values[s.key] = s.default;
    await this.store.set("settings", this.values);
    await this.store.set("settingsVersion", SETTINGS_VERSION);
  }
  get(key, fallback) {
    const v = this.values[key];
    if (v !== undefined) return v;
    const def = DEFAULTS[key];
    return def !== undefined ? def : fallback;
  }
  num(key) { return Number(this.get(key)) || 0; }
  bool(key) { return !!this.get(key); }
  field(key) { return this.schema.find((s) => s.key === key) || null; }
  validate(key, value) {
    const s = this.field(key);
    if (!s) throw new AppError(ERR.VALIDATION, `Setting tidak dikenal: ${key}`);
    if (s.type === "toggle") return !!value;
    if (s.type === "number" || s.type === "range") {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new AppError(ERR.VALIDATION, `${s.label} harus angka.`);
      if (s.min !== undefined && n < s.min) throw new AppError(ERR.VALIDATION, `${s.label} minimum ${s.min}.`);
      if (s.max !== undefined && n > s.max) throw new AppError(ERR.VALIDATION, `${s.label} maksimum ${s.max}.`);
      return n;
    }
    if (s.type === "select") {
      if (!s.options.some(([v]) => v === value)) throw new AppError(ERR.VALIDATION, `${s.label}: pilihan tidak valid.`);
      return value;
    }
    if (s.type === "color") {
      if (!/^#[0-9a-f]{6}$/i.test(String(value))) throw new AppError(ERR.VALIDATION, `${s.label}: format warna #rrggbb.`);
      return value;
    }
    const text = String(value ?? "");
    if (key === "koneksi.platformUrl" && text && !/^https:\/\/|^http:\/\/127\.0\.0\.1|^http:\/\/localhost/.test(text)) {
      throw new AppError(ERR.VALIDATION, "Platform URL wajib HTTPS (kecuali loopback development).");
    }
    return text;
  }
  async set(key, value, { silent = false } = {}) {
    const clean = this.validate(key, value);
    this.values[key] = clean;
    await this.store.set("settings", this.values);
    if (!silent) this._notify(key, clean);
    return clean;
  }
  async setMany(patch) {
    for (const [k, v] of Object.entries(patch)) this.values[k] = this.validate(k, v);
    await this.store.set("settings", this.values);
    for (const [k, v] of Object.entries(patch)) this._notify(k, v);
  }
  _notify(key, value) {
    for (const fn of this.listeners) {
      try { fn(key, value, this.values); } catch (err) { this.log?.warn("listener setting gagal", err?.message); }
    }
    this.bus?.emit("settings.changed", { key, value });
  }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  search(term) {
    const q = String(term || "").trim().toLowerCase();
    if (!q) return this.schema;
    return this.schema.filter((s) => [s.key, s.label, s.desc || "", s.category].join(" ").toLowerCase().includes(q));
  }
  byCategory(cat) { return this.schema.filter((s) => s.category === cat); }
  async resetCategory(cat) {
    const patch = {};
    for (const s of this.byCategory(cat)) patch[s.key] = s.default;
    await this.setMany(patch);
    return Object.keys(patch).length;
  }
  async resetAll() {
    this.values = { ...DEFAULTS };
    await this.store.set("settings", this.values);
    await this.store.set("settingsVersion", SETTINGS_VERSION);
    this._notify("*", null);
    return this.schema.length;
  }
  toJSON({ includeSecrets = false } = {}) {
    return { settingsVersion: SETTINGS_VERSION, exportedAt: new Date().toISOString(), secretsIncluded: includeSecrets, values: { ...this.values } };
  }
  async importJSON(data) {
    const values = data?.values || data;
    if (!values || typeof values !== "object") throw new AppError(ERR.VALIDATION, "Berkas settings tidak dikenali.");
    let applied = 0;
    const errors = [];
    for (const [k, v] of Object.entries(values)) {
      if (!this.field(k)) continue;
      try {
        this.values[k] = this.validate(k, v);
        applied++;
      } catch (err) {
        errors.push(`${k}: ${err.message}`);
      }
    }
    await this.store.set("settings", this.values);
    this._notify("*", null);
    return { applied, errors };
  }
  applyTheme(root) {
    const mode = this.get("umum.tema");
    const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    root.dataset.theme = dark ? "dark" : "light";
    root.style.setProperty("--brand-accent", this.get("lanjutan.brandWarna"));
    root.dataset.motion = this.bool("umum.animasi") ? "on" : "off";
    return dark ? "dark" : "light";
  }
}
