import { uid } from "../sidebar/ui/Dom.js";
import { AppError, ERR } from "../core/AppError.js";

export class LibraryStore {
  constructor(settings, bus, logger) {
    this.settings = settings;
    this.bus = bus;
    this.log = logger?.child?.("library") || logger;
    this.db = null;
    this.items = [];
    this.warned = false;
  }

  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const req = indexedDB.open("kalam-library", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("items")) {
          const s = db.createObjectStore("items", { keyPath: "id" });
          s.createIndex("dataset", "dataset");
          s.createIndex("type", "type");
        }
        if (!db.objectStoreNames.contains("blobs")) db.createObjectStore("blobs");
      };
      req.onsuccess = () => { this.db = req.result; res(this.db); };
      req.onerror = () => rej(AppError.wrap(req.error, ERR.STORAGE));
    });
  }

  async tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const req = fn(t.objectStore(store));
      t.oncomplete = () => res(req?.result);
      t.onerror = () => rej(AppError.wrap(t.error, ERR.STORAGE));
      t.onabort = () => rej(AppError.wrap(t.error, ERR.STORAGE));
    });
  }

  async load() {
    this.items = (await this.tx("items", "readonly", (s) => s.getAll())) || [];
    this.items.sort((a, b) => String(b.capturedAt).localeCompare(String(a.capturedAt)));
    return this.items;
  }

  static hash(text) {
    let h = 2166136261;
    const s = String(text || "");
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0).toString(36);
  }

  isDuplicate(dataset, payload) {
    const key = LibraryStore.hash(typeof payload === "string" ? payload : JSON.stringify(payload));
    return this.items.some((i) => i.dataset === dataset && i.hash === key);
  }

  async add(item) {
    const meta = { ...(item.meta || {}) };
    if (item.text && !meta.words) meta.words = item.text.trim().split(/\s+/).filter(Boolean).length;
    const rec = {
      id: item.id || uid("item"), dataset: item.dataset || "Umum", type: item.type || "text", title: item.title || "Tanpa judul",
      text: item.text || "", url: item.url || "", source: item.source || "", capturedAt: item.capturedAt || new Date().toISOString(),
      note: item.note || "", tags: item.tags || [], meta,
      size: item.size || new Blob([item.text || ""]).size, hash: LibraryStore.hash(item.text || item.url || item.title), blobId: item.blobId || null,
    };
    await this.tx("items", "readwrite", (s) => s.put(rec));
    this.items.unshift(rec);
    await this.checkQuota();
    this.bus.emit("data.changed", { id: rec.id, dataset: rec.dataset });
    return rec;
  }

  async addBlob(id, blob) { await this.tx("blobs", "readwrite", (s) => s.put(blob, id)); return id; }
  async getBlob(id) { if (!id) return null; return (await this.tx("blobs", "readonly", (s) => s.get(id))) || null; }

  async update(id, patch) {
    const it = this.items.find((x) => x.id === id);
    if (!it) return null;
    Object.assign(it, patch);
    await this.tx("items", "readwrite", (s) => s.put(it));
    this.bus.emit("data.changed", { id });
    return it;
  }

  async remove(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    const removed = this.items.filter((i) => list.includes(i.id));
    for (const it of removed) {
      await this.tx("items", "readwrite", (s) => s.delete(it.id));
      if (it.blobId) await this.tx("blobs", "readwrite", (s) => s.delete(it.blobId));
    }
    this.items = this.items.filter((i) => !list.includes(i.id));
    this.bus.emit("data.changed", { removed: list });
    return removed;
  }

  clearDataset(dataset) { return this.remove(this.items.filter((i) => i.dataset === dataset).map((i) => i.id)); }

  datasets() {
    const map = new Map();
    for (const i of this.items) {
      if (!map.has(i.dataset)) map.set(i.dataset, { id: i.dataset, name: i.dataset, count: 0, size: 0, types: new Set(), last: i.capturedAt });
      const d = map.get(i.dataset);
      d.count++;
      d.size += i.size || 0;
      d.types.add(i.type);
      if (String(i.capturedAt) > String(d.last)) d.last = i.capturedAt;
    }
    return [...map.values()].map((d) => ({ ...d, types: [...d.types] })).sort((a, b) => b.count - a.count);
  }

  byDataset(dataset) { return this.items.filter((i) => i.dataset === dataset); }

  filter({ dataset = null, type = null, term = "" } = {}) {
    const q = String(term).toLowerCase();
    return this.items.filter((i) =>
      (!dataset || i.dataset === dataset) && (!type || i.type === type) &&
      (!q || `${i.title} ${i.text} ${i.url} ${(i.tags || []).join(" ")}`.toLowerCase().includes(q)));
  }

  bytes() { return this.items.reduce((a, i) => a + (i.size || 0), 0); }

  quota() {
    const max = this.settings.num("data.kuotaMb") * 1048576;
    const used = this.bytes();
    return { used, max, ratio: max ? used / max : 0, warnAt: this.settings.num("data.peringatanPersen") / 100 };
  }

  async checkQuota() {
    const q = this.quota();
    if (q.ratio >= q.warnAt && !this.warned) { this.warned = true; this.bus.emit("data.quota", q); }
    if (q.ratio > 1) throw new AppError(ERR.STORAGE, "Kuota library penuh. Hapus atau ekspor data lama.");
    return q;
  }

  duplicates() {
    const seen = new Map();
    const dups = [];
    for (const i of this.items) { const k = `${i.dataset}:${i.hash}`; if (seen.has(k)) dups.push(i); else seen.set(k, i); }
    return dups;
  }

  destroy() { this.db?.close(); this.db = null; }
}
