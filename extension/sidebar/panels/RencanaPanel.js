import { h, clear, num, pct } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { TEMPLATES } from "../../model/OutlineService.js";
import { ProjectService } from "../../model/ProjectService.js";

/** RencanaPanel — papan beat (corkboard) dengan template struktur, drag antar babak, dan audit rencana. */
export class RencanaPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "rencana";
    this.title = "Rencana";
    this.icon = "board";
    this.term = "";
    this.cleanups = [];
    this.dragId = null;
  }

  async render(host) {
    this.host = host;
    this.cleanups.push(this.ctx.on("project.changed", (p) => { if (p?.part === "outline" || p?.switched) this.paint(); }));
    this.views = this.ctx.views.for("rencana");
    this.paint();
    return host;
  }

  refresh() { if (this.host) this.paint(); }

  paint() {
    const c = this.ctx;
    clear(this.host);
    const tpl = h("select", { class: "input select", "aria-label": "Template struktur" },
      Object.entries(TEMPLATES).map(([id, t]) => h("option", { value: id, text: t.label })));
    tpl.value = c.outline.template;
    tpl.addEventListener("change", async () => {
      await c.outline.setTemplate(tpl.value);
      this.paint();
      c.toast.ok(`Struktur: ${TEMPLATES[tpl.value].label}. Kartu lama dipindah ke babak pertama.`);
    });
    const search = Controls.search("Cari beat atau isi kartu…", (v) => { this.term = v; this.paintBoard(); }, { value: this.term });
    this.auditEl = h("div", { class: "stack" });
    this.boardEl = h("div", { class: "cork" });
    this.host.append(
      h("div", { class: "card" }, [
        h("div", { class: "row" }, [
          tpl,
          Controls.button("Isi beat template", async () => {
            const n = await c.outline.fillTemplate();
            this.paint();
            c.toast.ok(n ? `${n} beat ditambahkan.` : "Semua beat template sudah ada.");
          }, { iconName: "spark", small: true }),
          Controls.iconButton("save", "Simpan tampilan", () => this.saveView()),
        ]),
        h("p", { class: "muted small", text: TEMPLATES[c.outline.template].desc }),
      ]),
      search.box,
      this.viewRow(),
      this.auditEl,
      this.boardEl,
    );
    this.paintAudit();
    this.paintBoard();
  }

  viewRow() {
    const row = h("div", { class: "row" });
    const views = this.ctx.views.for("rencana");
    if (!views.length) return h("span", { class: "muted small", text: "Rencana tersimpan per buku. Simpan kata kunci favorit sebagai tampilan." });
    for (const v of views) {
      row.append(h("span", { class: "saved-view" }, [
        Controls.button(v.name, () => { this.term = v.state.term || ""; this.paint(); }, { small: true, iconName: "eye" }),
        Controls.iconButton("x", `Hapus ${v.name}`, async () => {
          await this.ctx.views.remove(v.id);
          this.paint();
          this.ctx.toast.undo("Tampilan dihapus.", async () => { await this.ctx.views.add("rencana", v.name, v.state); this.paint(); });
        }, { tone: "danger" }),
      ]));
    }
    return row;
  }

  async saveView() {
    const name = await this.ctx.modal.prompt("Simpan tampilan rencana", { label: "Nama", value: this.term || "Semua beat" });
    if (!name) return;
    await this.ctx.views.add("rencana", name, { term: this.term });
    this.paint();
    this.ctx.toast.ok(`Tampilan "${name}" tersimpan.`);
  }

  paintAudit() {
    const c = this.ctx;
    const a = c.outline.audit();
    clear(this.auditEl);
    this.auditEl.append(
      h("div", { class: "grid grid--2" }, [
        Controls.stat("Kartu rencana", num(c.outline.cards.length), { tone: "violet", sub: `${c.outline.cols.length} babak`, iconName: "board" }),
        Controls.stat("Cakupan bab", pct(a.coverage), { tone: a.coverage >= 0.8 ? "lime" : "amber", sub: `${a.unplanned.length} bab belum punya kartu`, iconName: "gauge" }),
      ]),
      Controls.progress(a.coverage, { tone: a.coverage >= 0.8 ? "lime" : "amber", label: "Bab yang sudah direncanakan" }),
    );
    if (a.unplanned.length) {
      const box = h("div", { class: "card" }, [h("h5", { text: "Bab tanpa kartu rencana" })]);
      for (const ch of a.unplanned.slice(0, 6)) {
        box.append(h("div", { class: "row" }, [
          h("span", { class: "grow small", text: ch.title }),
          Controls.button("Buat kartu", async () => {
            await c.outline.add(c.outline.cols[0].id, { title: ch.title, desc: ch.summary || "", chapter: ch.id });
            this.paint();
            c.toast.ok(`Kartu untuk "${ch.title}" dibuat.`);
          }, { small: true, iconName: "plus" }),
        ]));
      }
      this.auditEl.append(box);
    }
    if (a.broken.length) {
      this.auditEl.append(h("div", { class: "card" }, [
        h("h5", { text: `${a.broken.length} kartu menunjuk bab yang sudah dihapus` }),
        Controls.button("Lepaskan tautan rusak", async () => {
          for (const card of a.broken) await c.outline.update(card.id, { chapter: "" });
          this.paint();
          c.toast.ok("Tautan rusak dilepaskan.");
        }, { small: true, kind: "danger", iconName: "wrench" }),
      ]));
    }
  }

  paintBoard() {
    const c = this.ctx;
    clear(this.boardEl);
    const q = this.term.trim().toLowerCase();
    for (const col of c.outline.cols) {
      const cards = c.outline.byCol(col.id).filter((x) => !q || `${x.title} ${x.desc}`.toLowerCase().includes(q));
      const list = h("div", { class: "cork__list", dataset: { col: col.id } });
      list.addEventListener("dragover", (e) => { e.preventDefault(); list.classList.add("is-over"); });
      list.addEventListener("dragleave", () => list.classList.remove("is-over"));
      list.addEventListener("drop", async (e) => {
        e.preventDefault();
        list.classList.remove("is-over");
        if (!this.dragId) return;
        const over = e.target.closest?.(".beat");
        const idx = over ? cards.findIndex((x) => x.id === over.dataset.id) : cards.length;
        await c.outline.move(this.dragId, col.id, idx < 0 ? cards.length : idx);
        this.dragId = null;
        this.paintBoard();
        this.paintAudit();
        c.toast.ok("Kartu dipindah.");
      });
      for (const card of cards) list.append(this.card(card, col));
      if (!cards.length) list.append(h("p", { class: "muted small", text: q ? "Tidak ada yang cocok." : "Tarik kartu ke sini atau tambah beat." }));
      this.boardEl.append(h("section", { class: "cork__col", style: { "--col": `var(--c-${col.tone})` } }, [
        h("header", { class: "cork__head" }, [
          h("strong", { text: col.label }),
          Controls.chip(String(cards.length), col.tone),
          Controls.iconButton("plus", `Tambah beat di ${col.label}`, async () => {
            const title = await c.modal.prompt("Beat baru", { label: "Judul beat", value: col.beats[0] || "Beat baru" });
            if (!title) return;
            await c.outline.add(col.id, { title });
            this.paintBoard();
            this.paintAudit();
            c.toast.ok("Beat ditambahkan.");
          }),
        ]),
        list,
      ]));
    }
  }

  card(card, col) {
    const c = this.ctx;
    const ch = c.projects.chapters().find((x) => x.id === card.chapter);
    const el = h("article", {
      class: "beat", draggable: "true", tabindex: "0", dataset: { id: card.id },
      "aria-label": `Beat ${card.title}`,
    }, [
      h("div", { class: "beat__t" }, [
        h("strong", { text: card.title }),
        Controls.iconButton("wrench", "Ubah beat", () => this.editCard(card, col)),
      ]),
      card.desc ? h("p", { class: "beat__d", text: card.desc }) : h("p", { class: "beat__d muted", text: "Belum ada catatan beat." }),
      h("div", { class: "beat__foot" }, [
        ch ? Controls.chip(ch.title, "cyan") : Controls.chip("belum ditautkan", "ink"),
        ch ? Controls.chip(`${num(ProjectService.chapterWords(ch))} kata`, "violet") : null,
        h("span", { class: "grow" }),
        Controls.iconButton("trash", "Hapus beat", async () => {
          await c.outline.remove(card.id);
          this.paintBoard();
          this.paintAudit();
          c.toast.undo("Beat dihapus.", async () => { await c.outline.undo(); this.paintBoard(); this.paintAudit(); });
        }, { tone: "danger" }),
      ].filter(Boolean)),
    ]);
    el.addEventListener("dragstart", () => { this.dragId = card.id; el.classList.add("is-drag"); });
    el.addEventListener("dragend", () => { el.classList.remove("is-drag"); this.dragId = null; });
    el.addEventListener("keydown", async (e) => {
      if (!e.altKey || !["ArrowLeft", "ArrowRight"].includes(e.key)) return;
      e.preventDefault();
      const cols = c.outline.cols;
      const i = cols.findIndex((x) => x.id === card.col) + (e.key === "ArrowRight" ? 1 : -1);
      if (i < 0 || i >= cols.length) return;
      await c.outline.move(card.id, cols[i].id, null);
      this.paintBoard();
      c.toast.ok(`Beat dipindah ke ${cols[i].label}.`);
    });
    return el;
  }

  editCard(card, col) {
    const c = this.ctx;
    const title = h("input", { class: "input", value: card.title, "aria-label": "Judul beat" });
    const desc = h("textarea", { class: "textarea", value: card.desc || "", "aria-label": "Catatan beat" });
    const link = h("select", { class: "input select", "aria-label": "Tautkan ke bab" },
      [h("option", { value: "", text: "— belum ditautkan —" }), ...c.projects.chapters().map((ch) => h("option", { value: ch.id, text: ch.title }))]);
    link.value = card.chapter || "";
    const save = async () => {
      await c.outline.update(card.id, { title: title.value.trim() || card.title, desc: desc.value, chapter: link.value });
      this.paintBoard();
      this.paintAudit();
      c.toast.ok("Beat disimpan.");
    };
    title.addEventListener("change", save);
    desc.addEventListener("change", save);
    link.addEventListener("change", save);
    const body = h("div", { class: "stack" }, [
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Judul beat" }), title]),
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Apa yang terjadi" }), desc]),
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Bab terkait" }), link]),
      h("div", { class: "row" }, [
        Controls.button("Kembangkan dengan AI", async () => {
          try {
            const res = await c.llm.chat("beat", { judul: card.title, teks: card.desc || card.title, babak: col.label });
            desc.value = res.text.trim();
            await save();
          } catch (err) { c.toast.error(err.message); }
        }, { iconName: "spark", small: true }),
        Controls.button("Jadikan bab", async () => {
          const ch = await c.projects.addChapter({ title: card.title, summary: card.desc });
          await c.outline.update(card.id, { chapter: ch.id });
          c.drawer.close();
          this.paint();
          c.toast.ok(`Bab "${ch.title}" dibuat dari beat.`);
        }, { iconName: "plus", small: true, kind: "primary" }),
        Controls.button("Tulis ke naskah", () => {
          c.insertToEditor(`${card.title}\n\n${card.desc || ""}`);
          c.drawer.close();
        }, { iconName: "quill", small: true }),
      ]),
    ]);
    c.drawer.open({ title: card.title, subtitle: col.label, body, badge: Controls.chip("beat", col.tone) });
  }

  destroy() { for (const off of this.cleanups.splice(0)) off(); }
}