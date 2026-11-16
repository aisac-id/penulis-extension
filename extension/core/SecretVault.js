import { AppError, ERR } from "./AppError.js";
const ITER = 600000, enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export class SecretVault {
  constructor(store, settings, logger) {
    this.store = store;
    this.settings = settings;
    this.log = logger?.child?.("vault") || logger;
    this.key = null;
    this.plain = new Map();
    this.mode = null;
    this.lastUse = 0;
    this.timer = null;
  }
  static parseEnv(text) {
    const out = {};
    for (const raw of String(text).split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1) continue;
      const key = line.slice(0, i).trim().replace(/^export\s+/, "");
      let val = line.slice(i + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
      if (/^[A-Z0-9_]+$/.test(key)) out[key] = val;
    }
    return out;
  }
  static mapEnv(env) {
    const map = {
      OPENAI_API_KEY: "llm.openai", ANTHROPIC_API_KEY: "llm.anthropic", GEMINI_API_KEY: "llm.gemini",
      GOOGLE_API_KEY: "llm.gemini", GROQ_API_KEY: "llm.groq", DEEPSEEK_API_KEY: "llm.deepseek",
      OPENROUTER_API_KEY: "llm.openrouter", INGEST_TOKEN: "platform.ingest", PAIRING_TOKEN: "local.pairing",
    };
    const out = {};
    for (const [k, v] of Object.entries(env)) if (map[k] && v) out[map[k]] = v;
    return out;
  }
  async status() {
    const rec = await this.store.get("secrets", null);
    return { initialized: !!rec, mode: rec?.mode || null, unlocked: !!this.key, count: rec ? Object.keys(rec.items || {}).length : 0 };
  }
  async unlock(passphrase = null) {
    const rec = await this.store.get("secrets", null);
    if (!rec) return this._init(passphrase);
    if (rec.mode === "pass") {
      if (!passphrase) throw new AppError(ERR.VAULT_LOCKED, "Brankas terkunci. Masukkan passphrase.");
      this.key = await this._derive(passphrase, unb64(rec.salt));
    } else this.key = await this._deviceKey(true);
    try {
      for (const [name, blob] of Object.entries(rec.items || {})) this.plain.set(name, await this._decrypt(blob));
    } catch {
      this.key = null;
      this.plain.clear();
      throw new AppError(ERR.VAULT_BAD_PASS, "Passphrase salah atau data brankas rusak.");
    }
    this.mode = rec.mode;
    this._touch();
    return this.status();
  }
  async _init(passphrase) {
    if (passphrase) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      this.key = await this._derive(passphrase, salt);
      this.mode = "pass";
      await this.store.set("secrets", { mode: "pass", salt: b64(salt), items: {} });
    } else {
      this.key = await this._deviceKey(false);
      this.mode = "device";
      await this.store.set("secrets", { mode: "device", items: {} });
    }
    this.plain.clear();
    this._touch();
    return this.status();
  }
  async _derive(pass, salt) {
    const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" },
      base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  }
  async _deviceKey(create) {
    const db = await this._idb();
    const got = await new Promise((res, rej) => {
      const tx = db.transaction("keys", "readonly").objectStore("keys").get("device");
      tx.onsuccess = () => res(tx.result);
      tx.onerror = () => rej(tx.error);
    });
    if (got) return got;
    if (!create) throw new AppError(ERR.VAULT_LOCKED, "Device key hilang. Buat ulang brankas.");
    const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await new Promise((res, rej) => {
      const tx = db.transaction("keys", "readwrite").objectStore("keys").put(key, "device");
      tx.onsuccess = res;
      tx.onerror = () => rej(tx.error);
    });
    return key;
  }
  _idb() {
    if (this._db) return Promise.resolve(this._db);
    return new Promise((res, rej) => {
      const req = indexedDB.open("kalam-vault", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("keys");
      req.onsuccess = () => { this._db = req.result; res(req.result); };
      req.onerror = () => rej(req.error);
    });
  }
  async _encrypt(text) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return { iv: b64(iv), ct: b64(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, this.key, enc.encode(text))) };
  }
  async _decrypt(blob) {
    return dec.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(blob.iv) }, this.key, unb64(blob.ct)));
  }
  _touch() {
    this.lastUse = Date.now();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.lock(), (this.settings?.num("lanjutan.vaultIdleMenit") || 30) * 60000);
  }
  async set(name, value) {
    if (!this.key) throw new AppError(ERR.VAULT_LOCKED, "Buka brankas dulu sebelum menyimpan kunci.");
    const rec = (await this.store.get("secrets", null)) || { mode: this.mode, items: {} };
    rec.items[name] = await this._encrypt(String(value));
    await this.store.set("secrets", rec);
    this.plain.set(name, String(value));
    this._touch();
    return true;
  }
  get(name) {
    if (!this.key) throw new AppError(ERR.VAULT_LOCKED, "Brankas terkunci.");
    this._touch();
    return this.plain.get(name) || null;
  }
  has(name) { return this.plain.has(name); }
  names() { return [...this.plain.keys()]; }
  async remove(name) {
    const rec = await this.store.get("secrets", null);
    if (rec?.items?.[name]) {
      delete rec.items[name];
      await this.store.set("secrets", rec);
    }
    this.plain.delete(name);
  }
  async importEnv(text) {
    const mapped = SecretVault.mapEnv(SecretVault.parseEnv(text));
    if (!this.key) await this.unlock(null);
    for (const [k, v] of Object.entries(mapped)) await this.set(k, v);
    return Object.keys(mapped);
  }
  masked(name) {
    const v = this.plain.get(name);
    if (!v) return "—";
    return v.length <= 8 ? "•".repeat(v.length) : `${v.slice(0, 3)}${"•".repeat(8)}${v.slice(-4)}`;
  }
  lock() {
    this.key = null;
    this.plain.clear();
    clearTimeout(this.timer);
    this.log?.info("brankas dikunci otomatis");
  }
  async destroyVault() {
    await this.store.remove("secrets");
    this.lock();
  }
}
