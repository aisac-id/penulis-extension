import { uid } from "../sidebar/ui/Dom.js";
import { ProjectService } from "./ProjectService.js";

export class BibleService {
  constructor(store, projects, bus) {
    this.store = store; this.projects = projects; this.bus = bus;
    this.data = { characters: [], places: [], events: [], rules: [] };
    this.projectId = null; this.trash = null;
  }
  key(id = this.projects.activeId) { return `bible:${id}`; }
  async load(projectId = this.projects.activeId) {
    this.projectId = projectId;
    this.data = (await this.store.get(this.key(projectId), null)) || { characters: [], places: [], events: [], rules: [] };
    for (const k of ["characters", "places", "events", "rules"]) if (!Array.isArray(this.data[k])) this.data[k] = [];
    return this.data;
  }
  async save() { await this.store.set(this.key(), this.data); this.bus.emit("project.changed", { id: this.projectId, part: "bible" }); }
  list(kind) { return this.data[kind] || []; }
  find(kind, id) { return this.list(kind).find((x) => x.id === id) || null; }
  async add(kind, patch = {}) {
    const base = { id: uid(kind.slice(0, 3)) };
    if (kind === "characters") Object.assign(base, { name: "Tokoh baru", alias: "", role: "Pendukung", age: 30, tone: "cyan", want: "", need: "", wound: "", voice: "", arc: "", tags: [], first: "" });
    if (kind === "places") Object.assign(base, { name: "Tempat baru", kind: "Ruang", senses: "", note: "", chapters: [] });
    if (kind === "events") Object.assign(base, { when: "", what: "Peristiwa baru", place: "", chapter: "" });
    if (kind === "rules") Object.assign(base, { text: "Aturan baru" });
    const item = { ...base, ...patch, id: base.id };
    this.data[kind].push(item);
    await this.save(); return item;
  }
  async update(kind, id, patch) {
    const item = this.find(kind, id);
    if (!item) return null;
    Object.assign(item, patch); await this.save(); return item;
  }
  async remove(kind, ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    const removed = this.data[kind].filter((x) => list.includes(x.id));
    this.data[kind] = this.data[kind].filter((x) => !list.includes(x.id));
    this.trash = { kind, removed };
    await this.save(); return removed;
  }
  async undo() {
    if (!this.trash) return null;
    this.data[this.trash.kind].push(...this.trash.removed);
    const t = this.trash; this.trash = null;
    await this.save(); return t;
  }
  async reorder(kind, id, to) {
    const arr = this.data[kind];
    const from = arr.findIndex((x) => x.id === id);
    if (from < 0) return;
    const [it] = arr.splice(from, 1);
    arr.splice(Math.max(0, Math.min(arr.length, to)), 0, it);
    await this.save();
  }
  appearances(character) {
    const names = [character.name, character.alias, ...(character.tags || [])].filter((n) => n && n.length > 2);
    const out = [];
    for (const ch of this.projects.chapters(this.projectId)) {
      const text = ProjectService.chapterText(ch);
      const hits = names.reduce((a, n) => a + (text.match(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi")) || []).length, 0);
      if (hits > 0) out.push({ id: ch.id, title: ch.title, hits });
    }
    return out.sort((a, b) => b.hits - a.hits);
  }
  sortedEvents() { return [...this.list("events")].sort((a, b) => String(a.when).localeCompare(String(b.when))); }
  clashes() {
    const map = new Map();
    for (const e of this.list("events")) {
      if (!e.when) continue;
      if (!map.has(e.when)) map.set(e.when, []);
      map.get(e.when).push(e);
    }
    return [...map.entries()].filter(([, v]) => v.length > 1 && new Set(v.map((e) => e.place)).size > 1);
  }
  search(term, kind = null) {
    const q = String(term || "").toLowerCase();
    const kinds = kind ? [kind] : ["characters", "places", "events", "rules"];
    const out = [];
    for (const k of kinds) {
      for (const item of this.list(k)) {
        if (!q || JSON.stringify(item).toLowerCase().includes(q)) out.push({ kind: k, item });
      }
    }
    return out;
  }
  brief() {
    const chars = this.list("characters").map((c) => `${c.name} (${c.role}): ingin ${c.want || "—"}; butuh ${c.need || "—"}`).join("\n");
    const places = this.list("places").map((p) => `${p.name}: ${p.senses || p.note || ""}`).join("\n");
    const rules = this.list("rules").map((r) => `- ${r.text}`).join("\n");
    return `TOKOH\n${chars}\n\nLATAR\n${places}\n\nATURAN DUNIA\n${rules}`;
  }
}
