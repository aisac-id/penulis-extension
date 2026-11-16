import { uid } from "../sidebar/ui/Dom.js";
import { TEMPLATES, blankScript } from "./Templates.js";
import { AppError, ERR } from "../core/AppError.js";

export class ScriptStore {
  constructor(store, bus) {
    this.store = store;
    this.bus = bus;
    this.items = [];
    this.trash = null;
  }

  async load() {
    const saved = await this.store.get("scripts", null);
    this.items = Array.isArray(saved) && saved.length ? saved : TEMPLATES.map((t) => ({ ...t, builtin: true }));
    return this.items;
  }

  async save() { await this.store.set("scripts", this.items); this.bus.emit("rpa.scripts", this.items); }
  list() { return this.items; }
  get(id) { return this.items.find((s) => s.id === id) || null; }

  async add(patch = {}) {
    const s = { ...blankScript(), ...patch, id: uid("scr") };
    this.items.push(s);
    await this.save();
    return s;
  }

  async fromTemplate(id) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) throw new AppError(ERR.RPA, "Template tidak ditemukan.");
    return this.add({ ...t, name: `${t.name} (salinan)`, builtin: false });
  }

  async update(id, patch) {
    const s = this.get(id);
    if (!s) return null;
    Object.assign(s, patch, { updatedAt: new Date().toISOString() });
    await this.save();
    return s;
  }

  async remove(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    this.trash = this.items.filter((s) => list.includes(s.id));
    this.items = this.items.filter((s) => !list.includes(s.id));
    await this.save();
    return this.trash;
  }

  async undo() {
    if (!this.trash) return null;
    this.items.push(...this.trash);
    const t = this.trash;
    this.trash = null;
    await this.save();
    return t;
  }

  async reorder(id, to) {
    const from = this.items.findIndex((s) => s.id === id);
    if (from < 0) return;
    const [s] = this.items.splice(from, 1);
    this.items.splice(Math.max(0, Math.min(this.items.length, to)), 0, s);
    await this.save();
  }

  async addStep(id, step) {
    const s = this.get(id);
    if (!s) return null;
    s.steps.push({ label: step.action, ...step });
    await this.save();
    return s;
  }

  async removeStep(id, index) {
    const s = this.get(id);
    if (!s) return null;
    s.steps.splice(index, 1);
    await this.save();
    return s;
  }

  static validate(script) {
    const errs = [];
    if (!script?.name?.trim()) errs.push("Nama skrip wajib diisi.");
    if (!Array.isArray(script?.steps) || !script.steps.length) errs.push("Skrip belum punya langkah.");
    const walk = (steps, path) => steps.forEach((s, i) => {
      const at = `${path}${i + 1}`;
      if (!s.action) errs.push(`Langkah ${at}: aksi kosong.`);
      if (["click", "type", "select", "waitForSelector", "extract", "highlight"].includes(s.action) && !s.target) errs.push(`Langkah ${at}: target selector kosong.`);
      if (s.action === "loop" && !s.steps?.length) errs.push(`Langkah ${at}: loop tanpa isi.`);
      if (s.steps) walk(s.steps, `${at}.`);
      if (s.else) walk(s.else, `${at}e.`);
    });
    walk(script?.steps || [], "");
    return errs;
  }

  toJSON(ids = null) {
    const list = ids ? this.items.filter((s) => ids.includes(s.id)) : this.items;
    return JSON.stringify({ format: "kalam-rpa", version: 1, scripts: list }, null, 2);
  }

  async importJSON(text) {
    let data;
    try { data = JSON.parse(text); } catch { throw new AppError(ERR.VALIDATION, "Berkas bukan JSON yang sah."); }
    const list = Array.isArray(data) ? data : data.scripts;
    if (!Array.isArray(list)) throw new AppError(ERR.VALIDATION, "Tidak ada daftar 'scripts' di berkas.");
    let n = 0;
    for (const raw of list) {
      if (!ScriptStore.validate(raw).length) { this.items.push({ ...raw, id: uid("scr"), builtin: false, importedAt: new Date().toISOString() }); n++; }
    }
    await this.save();
    return { imported: n, skipped: list.length - n };
  }
}
