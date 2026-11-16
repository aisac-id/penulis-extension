import { h, num } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";

/** ProjectBar — pemilih buku aktif beserta CRUD detail buku (dipakai panel Naskah). */
export class ProjectBar {
  constructor(ctx, onChanged) {
    this.ctx = ctx;
    this.onChanged = onChanged;
    this.el = h("div", { class: "card" });
  }

  paint() {
    const c = this.ctx;
    const sel = h("select", { class: "input select", "aria-label": "Proyek buku" },
      c.projects.projects.map((p) => h("option", { value: p.id, text: `${p.title} · ${num(c.projects.words(p.id))} kata` })));
    sel.value = c.projects.activeId;
    sel.addEventListener("change", async () => {
      await c.switchProject(sel.value);
      this.onChanged();
      c.toast.ok(`Proyek aktif: ${c.projects.active?.title}.`);
    });
    this.el.replaceChildren(
      h("div", { class: "row" }, [
        sel,
        Controls.iconButton("plus", "Buku baru", () => this.newProject()),
        Controls.iconButton("wrench", "Ubah detail buku", () => this.editProject()),
        Controls.iconButton("trash", "Hapus buku ini", () => this.deleteProject(), { tone: "danger" }),
      ]),
      h("p", { class: "muted small", text: c.projects.active?.premise || "Belum ada premis. Tulis satu kalimat inti buku Anda." }),
    );
    return this.el;
  }

  async newProject() {
    const title = await this.ctx.modal.prompt("Buku baru", { label: "Judul buku", placeholder: "mis. Laut yang Menyimpan Nama" });
    if (!title) return;
    const p = await this.ctx.projects.createProject({ title });
    await this.ctx.switchProject(p.id);
    this.onChanged();
    this.ctx.toast.ok(`Buku "${p.title}" siap. Tambahkan bab pertama.`);
  }

  editProject() {
    const c = this.ctx;
    const p = c.projects.active;
    if (!p) return;
    const body = h("div", { class: "stack" });
    for (const [key, label] of [["title", "Judul"], ["author", "Penulis"], ["genre", "Genre"], ["premise", "Premis satu kalimat"]]) {
      body.append(this.editField(label, p[key], key === "premise", async (v) => {
        await c.projects.updateProject(p.id, { [key]: v });
        this.onChanged();
        c.toast.ok(`${label} disimpan.`);
      }));
    }
    body.append(c.controls.field({ ...c.settings.field("menulis.targetBuku"), label: "Target total kata" }, p.targetWords, async (v) => { await c.projects.updateProject(p.id, { targetWords: v }); this.onChanged(); }));
    body.append(c.controls.field({ key: "deadline", label: "Tenggat naskah", type: "text", placeholder: "2027-03-01" },
      p.deadline || "", async (v) => { await c.projects.updateProject(p.id, { deadline: v }); c.toast.ok("Tenggat disimpan."); }));
    c.drawer.open({ title: "Detail buku", subtitle: p.title, body, badge: Controls.chip(`${num(c.projects.words())} kata`, "cyan") });
  }

  async deleteProject() {
    const c = this.ctx;
    const p = c.projects.active;
    if (!p) return;
    if (!await c.modal.confirm("Hapus buku ini?", `"${p.title}" dan ${p.chapters.length} bab akan dihapus. Urungkan lewat notifikasi.`, { danger: true, okLabel: "Hapus buku" })) return;
    await c.projects.deleteProject(p.id);
    if (c.projects.activeId) await c.switchProject(c.projects.activeId);
    this.onChanged();
    c.toast.undo("Buku dihapus.", async () => { await c.projects.undoDelete(); await c.switchProject(c.projects.activeId); this.onChanged(); });
  }

  editField(label, value, multiline, onSave) {
    const el = h(multiline ? "textarea" : "input", { class: multiline ? "textarea" : "input", value: value || "", "aria-label": label });
    el.addEventListener("change", () => onSave(el.value));
    return h("label", { class: "field" }, [h("span", { class: "field__label", text: label }), el]);
  }
}
