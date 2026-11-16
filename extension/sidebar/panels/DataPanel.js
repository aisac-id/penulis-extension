import { h, clear, num, bytes, pct, fmtDate } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { DataTable } from "../ui/DataTable.js";
import { Chart } from "../ui/Chart.js";
import { AnalysisService } from "../../pipeline/AnalysisService.js";
import { ExportService } from "../../pipeline/ExportService.js";

const FORMATS = [["json", "JSON"], ["csv", "CSV"], ["markdown", "Markdown"], ["txt", "TXT"], ["zip", "ZIP + berkas"], ["epub", "EPUB"]];

/** DataPanel — pustaka riset: tabel, pratinjau, provenance, kuota, dedupe, dan ekspor. */
export class DataPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "data";
    this.title = "Data";
    this.icon = "database";
    this.state = { dataset: "", type: "", term: "" };
    this.cleanups = [];
    this.table = new DataTable({
      columns: [
        { key: "judul", label: "Judul", width: "3", render: (r) => h("span", { class: "small", text: r.judul }) },
        { key: "jenis", label: "Jenis", render: (r) => Controls.chip(r.jenis, AnalysisService.TYPES.find((t) => t.id === r.jenis)?.tone || "ink") },
        { key: "kata", label: "Kata", cls: "td--num", width: "0.8" },
        { key: "sumber", label: "Sumber", width: "1.6", render: (r) => h("span", { class: "muted small", text: r.sumber }) },
        { key: "tanggal", label: "Tanggal", width: "1.2" },
      ],
      onOpen: (r) => this.preview(r.item),
      empty: "Belum ada kliping. Panen dari tab Riset untuk mengisi pustaka.",
    });
    this.table.setBulkActions([
      { label: "Ekspor terpilih", icon: "export", onClick: (ids) => this.exportItems(this.byId(ids), "zip") },
      { label: "Sisipkan ke naskah", icon: "quill", onClick: (ids) => this.insert(ids) },
      { label: "Hapus", icon: "trash", kind: "danger", onClick: (ids) => this.remove(ids) },
    ]);
  }

  async render(host) {
    this.host = host;
    this.cleanups.push(this.ctx.bus.on("data.changed", () => this.paint()));
    this.paint();
    return host;
  }

  refresh() { if (this.host) this.paint(); }

  byId(ids) { return this.ctx.library.items.filter((i) => ids.includes(i.id)); }

  paint() {
    const c = this.ctx;
    clear(this.host);
    this.head = h("div", { class: "stack" });
    this.host.append(this.head, this.filters(), this.table.el, this.tools());
    this.paintHead();
    this.paintRows();
  }

  paintHead() {
    const c = this.ctx;
    const items = this.view();
    const s = c.analysis.summary(items);
    const q = c.library.quota();
    const quality = c.analysis.quality(items);
    clear(this.head);
    this.head.append(
      h("div", { class: "grid grid--2" }, [
        Controls.stat("Kliping", num(s.count), { tone: "cyan", sub: `${num(s.words)} kata · ${bytes(s.bytes)}`, iconName: "database" }),
        Controls.stat("Dataset", num(c.library.datasets().length), { tone: "violet", sub: `${s.duplicates} duplikat terdeteksi`, iconName: "clip" }),
        Controls.stat("Kualitas riset", `${quality.score}/100`, { tone: quality.score >= 70 ? "lime" : "amber", sub: `${quality.sourced}% bersumber`, iconName: "gauge" }),
        Controls.stat("Kuota", pct(q.ratio), { tone: q.ratio >= q.warnAt ? "magenta" : "lime", sub: `${bytes(q.used)} dari ${bytes(q.max)}`, iconName: "gauge" }),
      ]),
      Controls.progress(q.ratio, { tone: q.ratio >= q.warnAt ? "magenta" : "cyan", label: `Kuota pustaka · peringatan di ${pct(q.warnAt)}` }),
      h("p", { class: "muted small", text: quality.advice }),
    );
    if (s.types.length) {
      this.head.append(Chart.donut(s.types.map((t) => ({ id: `data-${t.id}`, label: t.label, value: t.count })), { center: num(s.count) }),
        Chart.legend(s.types.map((t) => ({ label: t.label, value: t.count }))));
    }
    const kw = c.analysis.keywords(items, 10);
    if (kw.length) {
      this.head.append(h("div", { class: "card" }, [
        h("div", { class: "card__head" }, [h("h4", { text: "Kata kunci riset" })]),
        h("div", { class: "row" }, kw.map((k) => Controls.chip(`${k.word} · ${k.count}`, "cyan"))),
      ]));
    }
  }

  filters() {
    const c = this.ctx;
    const ds = h("select", { class: "input select", "aria-label": "Saring dataset" },
      [h("option", { value: "", text: "Semua dataset" }), ...c.library.datasets().map((d) => h("option", { value: d.name, text: `${d.name} (${d.count})` }))]);
    ds.value = this.state.dataset;
    ds.addEventListener("change", () => { this.state.dataset = ds.value; this.paintHead(); this.paintRows(); });
    const ty = h("select", { class: "input select", "aria-label": "Saring jenis" },
      [h("option", { value: "", text: "Semua jenis" }), ...AnalysisService.TYPES.map((t) => h("option", { value: t.id, text: t.label }))]);
    ty.value = this.state.type;
    ty.addEventListener("change", () => { this.state.type = ty.value; this.paintHead(); this.paintRows(); });
    const search = Controls.search("Cari judul, isi, tag, sumber…", (v) => {
      this.state.term = v;
      this.table.setFilter(v);
      this.paintHead();
    }, { value: this.state.term });
    const views = h("div", { class: "row" });
    for (const v of c.views.for("data")) {
      views.append(h("span", { class: "saved-view" }, [
        Controls.button(v.name, () => { this.state = { ...v.state }; this.paint(); }, { small: true, iconName: "eye" }),
        Controls.iconButton("x", `Hapus tampilan ${v.name}`, async () => {
          await c.views.remove(v.id);
          this.paint();
          c.toast.undo("Tampilan dihapus.", async () => { await c.views.add("data", v.name, v.state); this.paint(); });
        }, { tone: "danger" }),
      ]));
    }
    return h("div", { class: "stack" }, [
      search.box,
      h("div", { class: "grid grid--2" }, [ds, ty]),
      Controls.toolbar([
        Controls.button("Simpan tampilan", async () => {
          const name = await c.modal.prompt("Simpan tampilan data", { label: "Nama", value: this.state.dataset || "Semua kliping" });
          if (!name) return;
          await c.views.add("data", name, { ...this.state });
          this.paint();
          c.toast.ok(`Tampilan "${name}" tersimpan.`);
        }, { small: true, iconName: "save" }),
        Controls.button("Pilih semua", () => {
          this.table.selected = new Set(this.table.view().map((r) => r.id));
          this.table.paint();
        }, { small: true, iconName: "check" }),
        h("span", { class: "grow" }),
        Controls.button("Riset baru", () => c.openPanel("riset"), { small: true, iconName: "plus" }),
      ]),
      views,
    ]);
  }

  view() {
    return this.ctx.library.filter({ dataset: this.state.dataset || null, type: this.state.type || null, term: this.state.term });
  }

  paintRows() {
    this.table.setRows(this.ctx.analysis.tableRows(this.view()));
    this.table.setFilter(this.state.term);
  }

  tools() {
    const c = this.ctx;
    const fmt = h("select", { class: "input select", "aria-label": "Format ekspor" },
      FORMATS.map(([v, l]) => h("option", { value: v, text: l })));
    fmt.value = c.settings.get("scraper.formatDefault") === "epub" ? "epub" : "markdown";
    return Controls.fieldset("Ekspor & rawat pustaka", [
      h("div", { class: "row" }, [
        fmt,
        Controls.button("Ekspor yang terlihat", () => this.exportItems(this.view(), fmt.value), { kind: "primary", iconName: "export" }),
      ]),
      Controls.toolbar([
        Controls.button("Bersihkan duplikat", async () => {
          const n = await c.pipeline.dedupe(this.state.dataset || null);
          this.paint();
          c.toast.ok(n ? `${n} duplikat dihapus.` : "Tidak ada duplikat.");
        }, { small: true, iconName: "wrench" }),
        Controls.button("Kosongkan dataset", async () => {
          if (!this.state.dataset) { c.toast.warn("Pilih satu dataset dulu."); return; }
          if (!await c.modal.confirm("Kosongkan dataset?", `Semua kliping di "${this.state.dataset}" akan dihapus. Ekspor dulu bila masih dibutuhkan.`, { danger: true, okLabel: "Kosongkan" })) return;
          const removed = await c.library.clearDataset(this.state.dataset);
          this.paint();
          c.toast.undo(`${removed.length} kliping dihapus.`, async () => { for (const it of removed) await c.library.add(it); this.paint(); });
        }, { small: true, kind: "danger", iconName: "trash" }),
        Controls.button("Cadangkan semua", () => this.exportItems(c.library.items, "zip"), { small: true, iconName: "save" }),
      ]),
      h("p", { class: "muted small", text: "ZIP menyertakan teks, gambar asli, daftar sumber CSV, dan index.json berprovenance." }),
    ]);
  }

  async exportItems(items, kind) {
    const c = this.ctx;
    if (!items.length) { c.toast.warn("Tidak ada item untuk diekspor."); return; }
    if ((kind === "epub" || kind === "zip") && !c.license.can("ekspor.epub")) {
      c.toast.warn(c.license.reason("ekspor.epub"));
      return;
    }
    try {
      const name = this.state.dataset || "pustaka-riset";
      const res = await c.exports.exportDataset(items, kind, name);
      c.sound.ok();
      c.toast.ok(`Terunduh: ${res.filename} (${bytes(res.bytes || 0)}).`);
    } catch (err) { c.toast.error(err.message); }
  }

  insert(ids) {
    const c = this.ctx;
    const items = this.byId(ids);
    const text = items.map((i) => `${i.text}\n\n— ${ExportService.citation(i, c.settings.get("scraper.sitasiGaya"))}`).join("\n\n");
    c.insertToEditor(text);
  }

  async remove(ids) {
    const c = this.ctx;
    if (!await c.modal.confirm("Hapus kliping?", `${ids.length} kliping beserta berkasnya akan dihapus. Masih bisa diurungkan.`, { danger: true, okLabel: "Hapus" })) return;
    const items = this.byId(ids);
    const blobs = [];
    for (const it of items) if (it.blobId) blobs.push([it.blobId, await c.library.getBlob(it.blobId)]);
    await c.library.remove(ids);
    this.table.clearSelection();
    this.paint();
    c.toast.undo(`${ids.length} kliping dihapus.`, async () => {
      for (const it of items) await c.library.add(it);
      for (const [id, blob] of blobs) if (blob) await c.library.addBlob(id, blob);
      this.paint();
    });
  }

  async preview(item) {
    const c = this.ctx;
    const body = h("div", { class: "stack" });
    if (item.type === "image" && item.blobId) {
      const blob = await c.library.getBlob(item.blobId);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const img = h("img", { class: "shot", src: url, alt: item.title });
        img.addEventListener("load", () => setTimeout(() => URL.revokeObjectURL(url), 30000), { once: true });
        body.append(img);
      }
    }
    body.append(h("pre", { class: "quote mono", text: c.analysis.preview(item, 2400) || "(berkas tanpa teks)" }));
    body.append(h("div", { class: "kv" }, [
      h("span", { text: "Sumber" }), h("span", { text: item.source || "lokal" }),
      h("span", { text: "URL" }), h("span", { text: item.url || "—" }),
      h("span", { text: "Diambil" }), h("span", { text: fmtDate(item.capturedAt) }),
      h("span", { text: "Ukuran" }), h("span", { text: bytes(item.size || 0) }),
      h("span", { text: "Keterbacaan" }), h("span", { text: String(item.meta?.readability ?? "—") }),
    ]));
    const note = h("textarea", { class: "textarea", value: item.note || "", "aria-label": "Catatan kliping" });
    note.addEventListener("change", async () => { await c.library.update(item.id, { note: note.value }); c.toast.ok("Catatan disimpan."); this.paintHead(); });
    const tags = h("input", { class: "input", value: (item.tags || []).join(", "), "aria-label": "Tag" });
    tags.addEventListener("change", async () => {
      await c.library.update(item.id, { tags: tags.value.split(",").map((t) => t.trim()).filter(Boolean) });
      c.toast.ok("Tag disimpan.");
    });
    body.append(h("label", { class: "field" }, [h("span", { class: "field__label", text: "Catatan Anda" }), note]),
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Tag" }), tags]),
      h("p", { class: "muted small", text: ExportService.citation(item, c.settings.get("scraper.sitasiGaya")) }));
    c.drawer.open({
      title: item.title,
      subtitle: `${item.dataset} · ${item.type}`,
      body,
      badge: Controls.chip(`${num(item.meta?.words || 0)} kata`, "cyan"),
      actions: [
        Controls.button("Sisipkan ke naskah", () => { c.insertToEditor(`${item.text}\n\n— ${item.url || item.source}`); c.drawer.close(); }, { kind: "primary", iconName: "quill" }),
        Controls.button("Salin sitasi", async () => {
          await navigator.clipboard.writeText(ExportService.citation(item, c.settings.get("scraper.sitasiGaya"))).catch(() => {});
          c.toast.ok("Sitasi disalin.");
        }, { iconName: "copy", small: true }),
        Controls.button("Unduh teks", async () => {
          const res = await c.exports.exportDataset([item], "txt", item.title);
          c.toast.ok(`Terunduh: ${res.filename}.`);
        }, { iconName: "download", small: true }),
        Controls.button("Hapus", () => { c.drawer.close(); this.remove([item.id]); }, { kind: "danger", iconName: "trash", small: true }),
      ],
    });
  }

  destroy() {
    for (const off of this.cleanups.splice(0)) off();
    this.table.destroy();
  }
}