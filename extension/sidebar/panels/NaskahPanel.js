import { h, clear, num, pct } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { ListBoard } from "../ui/ListBoard.js";
import { EditorPane } from "../../editor/EditorPane.js";
import { ProjectService, CHAPTER_STATUS } from "../../model/ProjectService.js";
import { TextStats } from "../../analysis/TextStats.js";
import { ProjectBar } from "./ProjectBar.js";

const SORTS = [["urutan", "Urutan bab"], ["kata", "Kata terbanyak"], ["judul", "Judul A–Z"], ["status", "Status"]];

/** NaskahPanel — proyek, daftar bab (drag/pilih massal), pencarian naskah, dan editor. */
export class NaskahPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "naskah";
    this.title = "Naskah";
    this.icon = "quill";
    this.state = { term: "", status: "semua", sort: "urutan" };
    this.editing = null;
    this.cleanups = [];
    this.editor = new EditorPane(ctx);
    ctx.setEditor(this.editor);
    this.bar = new ProjectBar(ctx, () => { this.editing = null; this.paintList(); });
    this.board = new ListBoard({
      onReorder: async (id, to) => { await ctx.projects.reorderChapter(id, to); this.paintList(); ctx.toast.ok("Urutan bab diubah."); },
      onOpen: (ch) => this.openEditor(ch),
      onSelect: (ids) => this.paintBulk(ids),
      render: (ch, idx) => this.row(ch, idx),
    });
  }

  async render(host, mode) {
    this.host = host;
    this.mode = mode;
    this.ctx.onEditorBack = () => { this.editing = null; this.ctx.openPanel("naskah"); };
    this.cleanups.push(this.ctx.on("project.changed", () => { if (!this.editing) this.paintList(); }));
    this.cleanups.push(this.ctx.on("goal.changed", () => this.paintStats()));
    this.paintList();
    return host;
  }

  refresh() {
    if (!this.host) return;
    if (this.editing) { if (!this.editor.el.isConnected) this.paintEditor(); return; }
    this.paintList();
  }

  paintList() {
    clear(this.host);
    this.stats = h("div", { class: "stack" });
    this.viewRow = h("div", { class: "row" });
    this.bulk = h("div", { class: "bulkbar", hidden: true });
    this.listHost = h("div", { class: "stack" });
    this.host.append(this.bar.paint(), this.stats, this.toolbar(), this.viewRow, this.bulk, this.listHost);
    this.paintStats();
    this.paintViews();
    this.paintRows();
  }

  paintStats() {
    if (!this.stats?.isConnected) return;
    const c = this.ctx;
    const p = c.projects.progress();
    clear(this.stats);
    this.stats.append(
      h("div", { class: "grid grid--2" }, [
        Controls.stat("Kata naskah", num(p.words), { tone: "cyan", sub: `target ${num(p.target)}`, iconName: "type" }),
        Controls.stat("Bab selesai", `${p.done}/${p.chapters}`, { tone: "lime", sub: `${p.drafted} sudah digarap`, iconName: "check" }),
      ]),
      Controls.progress(p.ratio, { tone: p.ratio >= 1 ? "lime" : "cyan", label: `${pct(p.ratio)} · sisa ${num(p.remaining)} kata` }),
    );
  }

  toolbar() {
    const s = Controls.search("Cari bab atau isi naskah…", (v) => { this.state.term = v; this.paintRows(); }, { value: this.state.term });
    const status = h("select", { class: "input select", "aria-label": "Saring status bab" },
      [["semua", "Semua status"], ...CHAPTER_STATUS].map(([v, l]) => h("option", { value: v, text: l, selected: v === this.state.status })));
    status.value = this.state.status;
    status.addEventListener("change", () => { this.state.status = status.value; this.paintRows(); });
    const sort = h("select", { class: "input select", "aria-label": "Urutkan bab" },
      SORTS.map(([v, l]) => h("option", { value: v, text: l, selected: v === this.state.sort })));
    sort.value = this.state.sort;
    sort.addEventListener("change", () => { this.state.sort = sort.value; this.paintRows(); });
    return h("div", { class: "stack" }, [
      s.box,
      Controls.toolbar([
        status, sort, h("span", { class: "grow" }),
        Controls.button("Bab baru", () => this.newChapter(), { kind: "primary", iconName: "plus", small: true }),
        Controls.iconButton("save", "Simpan tampilan ini", () => this.saveView()),
      ]),
    ]);
  }

  paintViews() {
    clear(this.viewRow);
    const views = this.ctx.views.for("naskah");
    if (!views.length) { this.viewRow.append(h("span", { class: "muted small", text: "Tampilan tersimpan akan muncul di sini." })); return; }
    for (const v of views) {
      this.viewRow.append(h("span", { class: "saved-view" }, [
        Controls.button(v.name, () => {
          this.state = { ...this.state, ...v.state };
          this.paintList();
          this.ctx.toast.info(`Tampilan "${v.name}" dipakai.`);
        }, { small: true, iconName: "eye" }),
        Controls.iconButton("x", `Hapus tampilan ${v.name}`, async () => {
          await this.ctx.views.remove(v.id);
          this.paintViews();
          this.ctx.toast.undo("Tampilan dihapus.", async () => { await this.ctx.views.add("naskah", v.name, v.state); this.paintViews(); });
        }, { tone: "danger" }),
      ]));
    }
  }

  async saveView() {
    const name = await this.ctx.modal.prompt("Simpan tampilan", { label: "Nama tampilan", value: `${this.state.status} · ${this.state.sort}` });
    if (!name) return;
    await this.ctx.views.add("naskah", name, { ...this.state });
    this.paintViews();
    this.ctx.toast.ok(`Tampilan "${name}" tersimpan.`);
  }

  filtered() {
    const c = this.ctx;
    let list = c.projects.chapters();
    if (this.state.status !== "semua") list = list.filter((ch) => ch.status === this.state.status);
    const q = this.state.term.trim().toLowerCase();
    if (q) {
      const hits = new Set(c.projects.search(q).map((r) => r.chapterId));
      list = list.filter((ch) => hits.has(ch.id) || ch.title.toLowerCase().includes(q));
    }
    return c.projects.sortChapters(list, this.state.sort);
  }

  paintRows() {
    const list = this.filtered();
    clear(this.listHost);
    if (!list.length) {
      this.listHost.append(Controls.empty("Belum ada bab di sini",
        this.state.term ? "Tidak ada bab yang cocok. Ubah kata kunci atau saringan." : "Mulai dari satu bab, lalu tulis adegan pertamanya.",
        Controls.button("Tambah bab", () => this.newChapter(), { kind: "primary", iconName: "plus" })));
      this.board.setItems([]);
      return;
    }
    this.listHost.append(this.board.setItems(list));
    const q = this.state.term.trim();
    if (q) {
      const hits = this.ctx.projects.search(q).slice(0, 8);
      if (hits.length) {
        const box = h("div", { class: "card" }, [h("h5", { text: `Kecocokan isi naskah (${hits.length})` })]);
        for (const r of hits) {
          box.append(h("button", {
            class: "clip", type: "button", onclick: () => this.openEditor(this.ctx.projects.findChapter(r.chapterId), r.sceneId),
          }, [h("strong", { class: "clip__src", text: r.title }), h("span", { class: "clip__text", text: r.snippet })]));
        }
        this.listHost.append(box);
      }
    }
    this.paintBulk([...this.board.selected]);
  }

  row(ch, idx) {
    const c = this.ctx;
    const words = ProjectService.chapterWords(ch);
    const tone = { idea: "ink", draft: "cyan", revisi: "amber", selesai: "lime" }[ch.status] || "ink";
    return h("div", { class: "lrow__main" }, [
      h("div", { class: "lrow__title" }, [
        h("span", { class: "lrow__num", text: String(ch.order || idx + 1) }),
        h("strong", { text: ch.title }),
        Controls.chip(CHAPTER_STATUS.find((s) => s[0] === ch.status)?.[1] || ch.status, tone),
      ]),
      h("div", { class: "lrow__meta" }, [
        h("span", { text: `${num(words)} kata · ${ch.scenes.length} adegan` }),
        ch.pov ? h("span", { text: `POV ${ch.pov}` }) : null,
        h("span", { class: "grow" }),
        Controls.iconButton("info", "Detail bab", () => this.chapterDrawer(ch)),
        Controls.iconButton("quill", "Tulis bab ini", () => this.openEditor(ch)),
      ].filter(Boolean)),
      ch.summary ? h("p", { class: "muted small", text: TextStats.excerpt(ch.summary, 110) }) : null,
      Controls.progress(Math.min(1, words / Math.max(1, c.settings.num("menulis.targetHarian") * 2)), { tone, height: 4 }),
    ]);
  }

  paintBulk(ids) {
    if (!this.bulk) return;
    clear(this.bulk);
    this.bulk.hidden = !ids.length;
    if (!ids.length) return;
    const c = this.ctx;
    this.bulk.append(h("strong", { text: `${ids.length} bab dipilih` }));
    for (const [v, label] of CHAPTER_STATUS) {
      this.bulk.append(Controls.button(label, async () => {
        for (const id of ids) await c.projects.updateChapter(id, { status: v });
        this.board.clearSelection();
        this.paintRows();
        c.toast.ok(`${ids.length} bab → ${label}.`);
      }, { small: true }));
    }
    this.bulk.append(Controls.button("Hapus", async () => {
      if (!await c.modal.confirm("Hapus bab terpilih?", `${ids.length} bab beserta adegannya akan dihapus. Anda bisa mengurungkan.`, { danger: true, okLabel: "Hapus" })) return;
      await c.projects.deleteChapters(ids);
      this.board.clearSelection();
      this.paintRows();
      c.toast.undo(`${ids.length} bab dihapus.`, async () => { await c.projects.undoDelete(); this.paintRows(); });
    }, { small: true, kind: "danger", iconName: "trash" }));
    this.bulk.append(Controls.button("Bersihkan", () => this.board.clearSelection(), { small: true }));
  }

  chapterDrawer(ch) {
    const c = this.ctx;
    const body = h("div", { class: "stack" });
    for (const [key, label] of [["title", "Judul bab"], ["part", "Babak / bagian"], ["pov", "Sudut pandang"], ["place", "Latar tempat"], ["time", "Waktu kejadian"], ["summary", "Ringkasan bab"]]) {
      body.append(this.bar.editField(label, ch[key], key === "summary", async (v) => {
        await c.projects.updateChapter(ch.id, { [key]: v });
        c.toast.ok(`${label} disimpan.`);
        this.paintRows();
      }));
    }
    body.append(h("div", { class: "row" }, [
      Controls.button("Tulis bab", () => { c.drawer.close(); this.openEditor(ch); }, { kind: "primary", iconName: "quill" }),
      Controls.button("Ringkas dengan AI", async () => {
        try {
          const res = await c.llm.chat("ringkas", { judul: ch.title, teks: ProjectService.chapterText(ch) });
          await c.projects.updateChapter(ch.id, { summary: res.text.trim() });
          c.toast.ok("Ringkasan bab tersimpan.");
          c.drawer.close();
          this.paintRows();
        } catch (err) { c.toast.error(err.message); }
      }, { iconName: "spark" }),
    ]));
    c.drawer.open({ title: ch.title, subtitle: `${num(ProjectService.chapterWords(ch))} kata · ${ch.scenes.length} adegan`, body, badge: Controls.chip(ch.status, "cyan") });
  }

  async newChapter() {
    const title = await this.ctx.modal.prompt("Bab baru", { label: "Judul bab", value: `Bab ${this.ctx.projects.chapters().length + 1}` });
    if (!title) return;
    const ch = await this.ctx.projects.addChapter({ title });
    this.paintRows();
    this.ctx.toast.ok(`"${ch.title}" dibuat.`);
    this.openEditor(ch);
  }

  async openEditor(ch, sceneId = null) {
    if (!ch) return;
    await this.editor.flush();
    this.editing = { chapterId: ch.id, sceneId };
    this.ctx.sound.click();
    this.paintEditor();
  }

  async paintEditor() {
    if (!this.editing) return;
    clear(this.host);
    this.host.append(h("div", { class: "row" }, [
      Controls.button("Daftar bab", () => { this.editing = null; this.paintList(); }, { iconName: "chev", small: true }),
      h("span", { class: "grow" }),
      Controls.chip(`${num(this.ctx.projects.words())} kata naskah`, "cyan"),
    ]));
    const el = await this.editor.open(this.editing.chapterId, this.editing.sceneId);
    this.host.append(el);
    this.editing.sceneId = this.editor.sceneId;
  }

  suspend() { this.editor.flush(); }

  destroy() {
    for (const off of this.cleanups.splice(0)) off();
    this.editor.destroy();
    this.board.destroy();
  }
}