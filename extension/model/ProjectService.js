import { uid, today } from "../sidebar/ui/Dom.js";
import { TextStats } from "../analysis/TextStats.js";
import { AppError, ERR } from "../core/AppError.js";

export const CHAPTER_STATUS = [["idea", "Ide"], ["draft", "Draf"], ["revisi", "Revisi"], ["selesai", "Selesai"]];

export class ProjectService {
  constructor(store, bus, settings) {
    this.store = store; this.bus = bus; this.settings = settings;
    this.projects = []; this.activeId = null; this.lastDeleted = null;
  }
  async load() {
    this.projects = (await this.store.get("projects", [])) || [];
    this.activeId = await this.store.get("activeProject", this.projects[0]?.id || null);
    if (!this.projects.some((p) => p.id === this.activeId)) this.activeId = this.projects[0]?.id || null;
    return this.projects;
  }
  async save() {
    await this.store.set("projects", this.projects);
    await this.store.set("activeProject", this.activeId);
    this.bus.emit("project.changed", { id: this.activeId });
  }
  get active() { return this.projects.find((p) => p.id === this.activeId) || null; }
  async setActive(id) {
    if (!this.projects.some((p) => p.id === id)) throw new AppError(ERR.VALIDATION, "Proyek tidak ditemukan.");
    this.activeId = id; await this.save(); return this.active;
  }
  static blankProject(title = "Buku baru") {
    return { id: uid("prj"), title, genre: "Fiksi umum", author: "", premise: "", targetWords: 70000, deadline: "", createdAt: today(), chapters: [] };
  }
  async createProject(patch = {}) {
    const p = { ...ProjectService.blankProject(), ...patch, id: uid("prj") };
    p.targetWords = Number(patch.targetWords) || this.settings.num("menulis.targetBuku");
    this.projects.push(p); this.activeId = p.id;
    await this.save(); return p;
  }
  async updateProject(id, patch) {
    const p = this.projects.find((x) => x.id === id);
    if (!p) throw new AppError(ERR.VALIDATION, "Proyek tidak ditemukan.");
    Object.assign(p, patch); await this.save(); return p;
  }
  async deleteProject(id) {
    const idx = this.projects.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const [p] = this.projects.splice(idx, 1);
    this.lastDeleted = { kind: "project", item: p, index: idx };
    if (this.activeId === id) this.activeId = this.projects[0]?.id || null;
    await this.save(); return p;
  }
  chapters(projectId = this.activeId) { return this.projects.find((p) => p.id === projectId)?.chapters || []; }
  static blankChapter(title = "Bab baru", n = 1) {
    return {
      id: uid("ch"), title, part: "Babak 1", status: "idea", pov: "", place: "", time: "", summary: "",
      scenes: [{ id: uid("sc"), title: "Adegan 1", text: "", status: "draft" }], order: n,
    };
  }
  async addChapter(patch = {}, projectId = this.activeId) {
    const p = this.projects.find((x) => x.id === projectId);
    if (!p) throw new AppError(ERR.VALIDATION, "Pilih proyek dulu.");
    const ch = { ...ProjectService.blankChapter(`Bab ${p.chapters.length + 1}`, p.chapters.length + 1), ...patch, id: uid("ch") };
    p.chapters.push(ch);
    await this.save(); return ch;
  }
  async updateChapter(chapterId, patch) {
    const ch = this.findChapter(chapterId);
    if (!ch) throw new AppError(ERR.VALIDATION, "Bab tidak ditemukan.");
    Object.assign(ch, patch); await this.save(); return ch;
  }
  async deleteChapter(chapterId) {
    const p = this.active;
    const idx = p?.chapters.findIndex((c) => c.id === chapterId) ?? -1;
    if (idx < 0) return null;
    const [ch] = p.chapters.splice(idx, 1);
    this.lastDeleted = { kind: "chapter", item: ch, index: idx, projectId: p.id };
    await this.save(); return ch;
  }
  async deleteChapters(ids) {
    const p = this.active;
    if (!p) return [];
    const removed = [];
    for (const id of ids) {
      const idx = p.chapters.findIndex((c) => c.id === id);
      if (idx >= 0) removed.push({ item: p.chapters[idx], index: idx });
    }
    p.chapters = p.chapters.filter((c) => !ids.includes(c.id));
    this.lastDeleted = { kind: "chapters", items: removed, projectId: p.id };
    await this.save(); return removed;
  }
  async undoDelete() {
    const d = this.lastDeleted;
    if (!d) return null;
    const proj = () => this.projects.find((x) => x.id === d.projectId);
    if (d.kind === "project") { this.projects.splice(d.index, 0, d.item); this.activeId = d.item.id; }
    else if (d.kind === "chapter") proj()?.chapters.splice(d.index, 0, d.item);
    else if (d.kind === "chapters") for (const r of d.items.sort((a, b) => a.index - b.index)) proj()?.chapters.splice(r.index, 0, r.item);
    this.lastDeleted = null;
    await this.save(); return d;
  }
  async reorderChapter(id, toIndex) {
    const p = this.active;
    if (!p) return;
    const from = p.chapters.findIndex((c) => c.id === id);
    if (from < 0) return;
    const [ch] = p.chapters.splice(from, 1);
    p.chapters.splice(Math.max(0, Math.min(p.chapters.length, toIndex)), 0, ch);
    p.chapters.forEach((c, i) => { c.order = i + 1; });
    await this.save();
  }
  findChapter(chapterId) {
    for (const p of this.projects) {
      const ch = p.chapters.find((c) => c.id === chapterId);
      if (ch) return ch;
    }
    return null;
  }
  findScene(chapterId, sceneId) { return this.findChapter(chapterId)?.scenes.find((s) => s.id === sceneId) || null; }
  async addScene(chapterId, title = "") {
    const ch = this.findChapter(chapterId);
    if (!ch) throw new AppError(ERR.VALIDATION, "Bab tidak ditemukan.");
    const sc = { id: uid("sc"), title: title || `Adegan ${ch.scenes.length + 1}`, text: "", status: "draft" };
    ch.scenes.push(sc);
    await this.save(); return sc;
  }
  async saveScene(chapterId, sceneId, text) {
    const sc = this.findScene(chapterId, sceneId);
    if (!sc) throw new AppError(ERR.VALIDATION, "Adegan tidak ditemukan.");
    const before = TextStats.words(sc.text);
    sc.text = text;
    await this.save();
    return { scene: sc, delta: TextStats.words(text) - before };
  }
  async deleteScene(chapterId, sceneId) {
    const ch = this.findChapter(chapterId);
    if (!ch || ch.scenes.length <= 1) return null;
    const idx = ch.scenes.findIndex((s) => s.id === sceneId);
    const [sc] = ch.scenes.splice(idx, 1);
    await this.save(); return sc;
  }
  static chapterText(ch) { return (ch?.scenes || []).map((s) => s.text).filter(Boolean).join("\n\n"); }
  static chapterWords(ch) { return TextStats.words(ProjectService.chapterText(ch)); }
  words(projectId = this.activeId) { return this.chapters(projectId).reduce((a, c) => a + ProjectService.chapterWords(c), 0); }
  fullText(projectId = this.activeId) { return this.chapters(projectId).map((c) => ProjectService.chapterText(c)).join("\n\n"); }
  progress(projectId = this.activeId) {
    const p = this.projects.find((x) => x.id === projectId);
    const words = this.words(projectId);
    const target = p?.targetWords || this.settings.num("menulis.targetBuku");
    const chs = this.chapters(projectId);
    return {
      words, target, ratio: target ? words / target : 0, chapters: chs.length,
      done: chs.filter((c) => c.status === "selesai").length,
      drafted: chs.filter((c) => c.status !== "idea").length,
      remaining: Math.max(0, target - words),
    };
  }
  search(term, projectId = this.activeId) {
    const q = String(term || "").toLowerCase().trim();
    if (!q) return [];
    const out = [];
    for (const ch of this.chapters(projectId)) {
      if (ch.title.toLowerCase().includes(q) || (ch.summary || "").toLowerCase().includes(q)) {
        out.push({ chapterId: ch.id, sceneId: ch.scenes[0]?.id, title: ch.title, snippet: ch.summary || "" });
      }
      for (const sc of ch.scenes) {
        const i = sc.text.toLowerCase().indexOf(q);
        if (i >= 0) out.push({ chapterId: ch.id, sceneId: sc.id, title: `${ch.title} · ${sc.title}`, snippet: TextStats.excerpt(sc.text.slice(Math.max(0, i - 40)), 140) });
      }
    }
    return out.slice(0, 40);
  }
  sortChapters(list, mode) {
    const arr = [...list];
    const byStatus = (c) => CHAPTER_STATUS.findIndex((s) => s[0] === c.status);
    if (mode === "kata") return arr.sort((a, b) => ProjectService.chapterWords(b) - ProjectService.chapterWords(a));
    if (mode === "judul") return arr.sort((a, b) => a.title.localeCompare(b.title, "id"));
    if (mode === "status") return arr.sort((a, b) => byStatus(a) - byStatus(b));
    return arr;
  }
}
