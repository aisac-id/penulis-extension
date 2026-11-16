import { uid, today } from "../sidebar/ui/Dom.js";

export const SUB_STATUS = [["disiapkan", "Disiapkan"], ["terkirim", "Terkirim"], ["ditinjau", "Ditinjau"], ["diminta", "Diminta revisi"], ["diterima", "Diterima"], ["ditolak", "Ditolak"]];

export class SubmissionService {
  constructor(store, projects, bus) { this.store = store; this.projects = projects; this.bus = bus; this.items = []; this.trash = null; }
  key(id = this.projects.activeId) { return `submissions:${id}`; }
  async load(projectId = this.projects.activeId) { this.items = (await this.store.get(this.key(projectId), [])) || []; return this.items; }
  async save() { await this.store.set(this.key(), this.items); this.bus.emit("project.changed", { part: "submissions" }); }
  async add(patch = {}) {
    const item = { id: uid("sub"), publisher: "Penerbit baru", contact: "", sentAt: "", status: "disiapkan", note: "", nextAt: "", ...patch };
    this.items.push(item); await this.save(); return item;
  }
  async update(id, patch) {
    const it = this.items.find((x) => x.id === id);
    if (!it) return null;
    Object.assign(it, patch); await this.save(); return it;
  }
  async markSent(id) { return this.update(id, { status: "terkirim", sentAt: today() }); }
  async remove(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    this.trash = this.items.filter((x) => list.includes(x.id));
    this.items = this.items.filter((x) => !list.includes(x.id));
    await this.save(); return this.trash;
  }
  async undo() {
    if (!this.trash) return null;
    this.items.push(...this.trash);
    const t = this.trash; this.trash = null;
    await this.save(); return t;
  }
  dueSoon(withinDays = 7) {
    const limit = Date.now() + withinDays * 86400000;
    return this.items.filter((x) => x.nextAt && new Date(x.nextAt).getTime() <= limit && !["diterima", "ditolak"].includes(x.status));
  }
  stats() {
    const by = {};
    for (const [k] of SUB_STATUS) by[k] = 0;
    for (const it of this.items) by[it.status] = (by[it.status] || 0) + 1;
    const sent = this.items.filter((x) => x.sentAt);
    const answered = this.items.filter((x) => ["diterima", "ditolak", "diminta"].includes(x.status));
    return { total: this.items.length, by, sent: sent.length, answerRate: sent.length ? answered.length / sent.length : 0 };
  }
  queryLetter(project, item) {
    const p = project || {};
    return [
      `Kepada ${item?.publisher || "Redaksi"},`,
      "",
      `Saya ${p.author || "(nama penulis)"}, mengajukan naskah "${p.title || "(judul)"}" (${p.genre || "genre"}), panjang sekitar ${Math.round((p.targetWords || 70000) / 1000)} ribu kata.`,
      "",
      `Premis: ${p.premise || "(satu paragraf premis)"}`,
      "",
      "Naskah lengkap tersedia atas permintaan. Tiga bab pertama dan sinopsis saya lampirkan.",
      "",
      "Terima kasih atas waktu dan pertimbangan Bapak/Ibu.",
      `Hormat saya,\n${p.author || "(nama penulis)"}`,
    ].join("\n");
  }
}
