import { AppError, ERR } from "./AppError.js";
export class StorageService {
  constructor(logger, prefix = "kalam:") {
    this.log = logger?.child?.("storage") || logger;
    this.prefix = prefix;
    this.useChrome = typeof chrome !== "undefined" && !!chrome.storage?.local;
    this.cache = new Map();
    this.watchers = new Set();
    if (this.useChrome) {
      this._onChange = (changes, area) => {
        if (area !== "local") return;
        for (const [k, v] of Object.entries(changes)) {
          if (!k.startsWith(this.prefix)) continue;
          const key = k.slice(this.prefix.length);
          this.cache.set(key, v.newValue);
          this.watchers.forEach((fn) => fn(key, v.newValue));
        }
      };
      chrome.storage.onChanged.addListener(this._onChange);
    }
  }
  _k(key) { return this.prefix + key; }
  async get(key, fallback = null) {
    if (this.cache.has(key)) return this.cache.get(key);
    try {
      let value;
      if (this.useChrome) value = (await chrome.storage.local.get(this._k(key)))[this._k(key)];
      else {
        const raw = localStorage.getItem(this._k(key));
        value = raw == null ? undefined : JSON.parse(raw);
      }
      if (value === undefined) value = fallback;
      this.cache.set(key, value);
      return value;
    } catch (err) {
      this.log?.warn("get gagal", key, err?.message);
      throw AppError.wrap(err, ERR.STORAGE);
    }
  }
  async set(key, value) {
    try {
      this.cache.set(key, value);
      if (this.useChrome) await chrome.storage.local.set({ [this._k(key)]: value });
      else localStorage.setItem(this._k(key), JSON.stringify(value));
      this.watchers.forEach((fn) => fn(key, value));
      return value;
    } catch (err) {
      throw AppError.wrap(err, ERR.STORAGE);
    }
  }
  async update(key, fn, fallback = null) {
    return this.set(key, await fn(await this.get(key, fallback)));
  }
  async remove(key) {
    this.cache.delete(key);
    if (this.useChrome) await chrome.storage.local.remove(this._k(key));
    else localStorage.removeItem(this._k(key));
    this.watchers.forEach((fn) => fn(key, undefined));
  }
  async keys() {
    const all = this.useChrome ? await chrome.storage.local.get(null) : { ...localStorage };
    return Object.keys(all).filter((k) => k.startsWith(this.prefix)).map((k) => k.slice(this.prefix.length));
  }
  async usage() {
    const keys = await this.keys();
    let bytes = 0;
    for (const k of keys) {
      try { bytes += JSON.stringify((await this.get(k)) ?? "").length; } catch { /* abaikan */ }
    }
    return { keys: keys.length, bytes };
  }
  async exportAll({ exclude = ["secrets"] } = {}) {
    const out = {};
    for (const k of await this.keys()) {
      if (exclude.some((x) => k.startsWith(x))) continue;
      out[k] = await this.get(k);
    }
    return out;
  }
  async importAll(data) {
    for (const [k, v] of Object.entries(data || {})) {
      if (!k.startsWith("secrets")) await this.set(k, v);
    }
  }
  watch(fn) { this.watchers.add(fn); return () => this.watchers.delete(fn); }
  destroy() {
    if (this.useChrome && this._onChange) chrome.storage.onChanged.removeListener(this._onChange);
    this.watchers.clear();
    this.cache.clear();
  }
}
