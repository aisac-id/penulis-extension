import { h, clear, icon, num, bytes, fmtDate } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { DataTable } from "../ui/DataTable.js";
import { ExportService } from "../../pipeline/ExportService.js";
import { EpubBuilder } from "../../pipeline/EpubBuilder.js";
import { SUB_STATUS } from "../../model/SubmissionService.js";

const stack = (kids = []) => h("div", { class: "stack" }, kids);
const row = (kids = []) => h("div", { class: "row" }, kids);
const para = (cls, text) => h("p", { class: cls, text });
const btn = (label, fn, icon = null, kind = "ghost") => Controls.button(label, fn, { small: true, kind, iconName: icon });
const ib = (name, label, fn, tone = "") => Controls.iconButton(name, label, fn, { tone });
const PREVIEW_CHARS = 1200;
const PREVIEWABLE = ["markdown", "txt", "html"];
const FORMATS = [["markdown", "Markdown", "md", "type", null], ["txt", "Teks polos", "txt", "book", null],
  ["html", "HTML cetak", "html", "globe", null], ["json", "JSON data", "json", "database", null],
  ["csv", "CSV per bab", "csv", "clip", null], ["epub", "EPUB 3", "epub", "book", "ekspor.epub"],
  ["docx", "DOCX", "docx", "export", "ekspor.docx"]].map(([kind, label, ext, iconName, feat]) => ({ kind, label, ext, iconName, feat }));
const slug = (s) => String(s || "naskah").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "naskah";

export class EksporPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "ekspor"; this.title = "Ekspor & Kirim"; this.icon = "export"; this.cleanups = [];
    this.host = this.body = this.table = null;
    this.subForm = {}; this.previewKind = "markdown"; this.bound = false;
    this.opts = { synopsis: true, toc: true, bio: "", cover: null, coverLabel: "", name: "" };
  }
  async render(host) {
    this.host = host;
    if (!this.bound) {
      this.bound = true;
      this.cleanups.push(this.ctx.bus.on("project.changed", () => { if (this.fmtHost?.isConnected) this.paintAll(); }));
    }
    if (!this.body?.isConnected) this.build();
    this.paintAll();
    return this;
  }
  refresh() { if (this.fmtHost?.isConnected) this.paintAll(); }
  build() {
    this.sumHost = h("div", { class: "card stack" });
    this.fmtHost = h("div", { class: "task-grid" });
    this.optHost = this.optionsBlock();
    this.previewHost = stack(); this.subHost = stack(); this.dataHost = stack();
    this.body = stack([this.sumHost,
      Controls.fieldset("Format keluaran", [this.fmtHost], "Tiap tombol mengunduh berkas sungguhan."),
      Controls.fieldset("Pilihan yang mengubah isi", [this.optHost], "Pratinjau ikut berubah tiap perubahan."),
      Controls.fieldset("Pratinjau berkas", [this.previewHost], `${num(PREVIEW_CHARS)} karakter pertama dari naskah.`),
      Controls.fieldset("Kirim ke penerbit", [this.subHost], "Catat penerbit, tanggal, dan tindak lanjut."),
      Controls.fieldset("Ekspor dataset riset", [this.dataHost], "Kliping tab Data ikut terbawa.")]);
    this.host.append(this.body);
  }
  paintAll() { this.paintSummary(); this.paintFormats(); this.paintPreview(); this.paintSubmissions(); this.paintDataset(); }
  paintSummary() {
    const c = this.ctx, p = c.projects.active;
    clear(this.sumHost);
    if (!p) { this.sumHost.append(Controls.empty("Belum ada proyek", "Buat proyek di panel Naskah untuk mengekspor.")); return; }
    const prog = c.projects.progress(), st = ExportService.manuscriptStats(p);
    this.sumHost.append(
      h("div", { class: "card__head" }, [icon("quill", 15), h("h4", { class: "grow", text: p.title }), Controls.chip(`${num(prog.chapters)} bab`, "cyan")]),
      para("small muted", `${p.author || "penulis belum diisi"} · ${p.genre || "genre belum diisi"} · ${p.premise || "premis belum diisi"}`),
      Controls.progress(prog.ratio, { tone: "lime", label: `${num(prog.words)} dari ${num(prog.target)} kata · ${num(st.sentences)} kalimat · ${num(st.minutes)} menit baca` }),
      para("small dim", `Berkas masuk ke folder ${c.settings.get("data.folderUnduhan")}/`));
  }
  optionsBlock() {
    const c = this.ctx, wrap = stack();
    wrap.append(c.controls.field(c.settings.field("scraper.formatDefault"), this.previewKind, (v) => {
      const hit = FORMATS.find((f) => f.kind === v);
      if (!hit) { c.toast.info("Format itu tidak berlaku untuk naskah; pratinjau tetap Markdown."); return; }
      this.previewKind = PREVIEWABLE.includes(hit.kind) ? hit.kind : "markdown";
      if (!PREVIEWABLE.includes(hit.kind)) c.toast.info(`Berkas .${hit.ext} biner — pratinjau ditampilkan sebagai Markdown.`);
      this.paintAll();
    }));
    wrap.append(c.controls.field({ label: "Sertakan sinopsis bab", type: "toggle", desc: "Ringkasan tiap bab di daftar isi." }, this.opts.synopsis, (v) => { this.opts.synopsis = v; this.paintPreview(); }));
    wrap.append(c.controls.field({ label: "Sertakan daftar isi", type: "toggle", desc: "Dipakai EPUB dan HTML cetak." }, this.opts.toc, (v) => { this.opts.toc = v; this.paintPreview(); }));
    const bio = h("textarea", { class: "input textarea", rows: 3, placeholder: "Biodata untuk halaman 'Tentang penulis'.", "aria-label": "Bio penulis" });
    bio.value = this.opts.bio;
    bio.addEventListener("input", () => { this.opts.bio = bio.value; this.paintPreview(); });
    wrap.append(Controls.row("Bio penulis", bio, "Untuk HTML cetak & akhir EPUB."));
    const cover = h("input", { type: "file", accept: "image/*", class: "input", "aria-label": "Berkas sampul" });
    cover.addEventListener("change", async () => {
      const file = cover.files?.[0];
      if (!file) return;
      this.opts.cover = await file.arrayBuffer();
      this.opts.coverLabel = `${file.name} · ${bytes(file.size)}`;
      c.toast.ok(`Sampul siap dipakai: ${this.opts.coverLabel}`);
      this.paintFormats();
    });
    wrap.append(Controls.row("Sampul (EPUB)", cover, this.opts.coverLabel ? `Terpilih: ${this.opts.coverLabel}` : "Belum dipilih — EPUB dibuat tanpa sampul."));
    const name = h("input", { type: "text", class: "input", value: this.opts.name, placeholder: slug(c.projects.active?.title || "naskah"), "aria-label": "Nama berkas" });
    name.addEventListener("input", () => { this.opts.name = name.value; this.paintFormats(); });
    wrap.append(Controls.row("Nama berkas", name, "Kosong = pakai judul naskah, tanpa ekstensi."));
    return wrap;
  }
  paintFormats() {
    if (!this.fmtHost?.isConnected) return;
    const c = this.ctx;
    clear(this.fmtHost);
    for (const f of FORMATS) {
      const locked = f.feat ? !c.license.can(f.feat) : false;
      this.fmtHost.append(h("button", { class: "task", type: "button",
        title: locked ? c.license.reason(f.feat) : `Unduh berkas .${f.ext}`,
        onclick: () => (locked ? this.explainLock(f) : this.doExport(f)) }, [
        row([icon(f.iconName, 14), h("strong", { text: f.label })]),
        h("small", { text: locked ? "terkunci" : `.${f.ext}${PREVIEWABLE.includes(f.kind) ? " · bisa dipratinjau" : ""}` }),
        locked ? Controls.chip("Pro", "amber", c.license.reason(f.feat)) : null]));
    }
    this.fmtHost.append(para("small muted", `Nama berkas: "${slug(this.opts.name || c.projects.active?.title || "naskah")}" + ekstensi format.`));
  }
  explainLock(f) {
    const c = this.ctx;
    c.modal.open({ title: `${f.label} butuh edisi lebih tinggi`, subtitle: "Naskah Anda tetap bisa keluar", width: 420,
      body: stack([para("", c.license.reason(f.feat)), para("small muted", "Markdown, teks polos, HTML, JSON, dan CSV selalu terbuka.")]),
      actions: [{ label: "Ekspor Markdown saja", onClick: () => this.doExport(FORMATS[0]) },
        { label: "Buka Pengaturan", kind: "primary", onClick: () => c.openPanel("settings") }] });
  }
  async doExport(f) {
    const c = this.ctx, p = c.projects.active;
    if (!p) { c.toast.error("Belum ada proyek untuk diekspor."); return; }
    const opts = { synopsis: this.opts.synopsis, toc: this.opts.toc, includeToc: this.opts.toc, bio: this.opts.bio, cover: this.opts.cover };
    const named = this.opts.name.trim() ? slug(this.opts.name) : "";
    try {
      const res = named ? await c.exports.download(await c.exports.build(f.kind, p, opts), `${named}.${f.ext}`)
        : await c.exports.exportProject(p, f.kind, opts);
      c.sound.ok();
      c.toast.ok(`${f.label} tersimpan: ${res.filename} (${bytes(res.bytes || 0)})`, { timeout: 7000 });
    } catch (err) { c.toast.error(`${f.label} gagal: ${err.message}`); }
  }
  paintPreview() {
    if (!this.previewHost?.isConnected) return;
    const p = this.ctx.projects.active || { chapters: [] };
    const text = this.previewKind === "markdown" ? ExportService.markdown(p, { synopsis: this.opts.synopsis })
      : this.previewKind === "txt" ? ExportService.plain(p) : EpubBuilder.printHtml(p, { toc: this.opts.toc, bio: this.opts.bio });
    const box = h("p", { class: "quote", style: { whiteSpace: "pre-wrap", margin: "0", maxHeight: "260px", overflowY: "auto" } });
    box.append(document.createTextNode(text.slice(0, PREVIEW_CHARS)));
    if (text.length > PREVIEW_CHARS) box.append(h("em", { text: ` …total ${num(text.length)} karakter` }));
    clear(this.previewHost);
    this.previewHost.append(Controls.toolbar([h("h5", { class: "grow", text: `Isi berkas .${this.previewKind === "markdown" ? "md" : this.previewKind}` }),
      Controls.segmented(FORMATS.filter((f) => PREVIEWABLE.includes(f.kind)).map((f) => ({ value: f.kind, label: f.ext.toUpperCase() })),
        this.previewKind, (v) => { this.previewKind = v; this.paintPreview(); })]), box);
  }
  paintSubmissions() {
    if (!this.subHost?.isConnected) return;
    const c = this.ctx, horizon = c.settings.num("menulis.hariTenggat"), stat = c.submissions.stats(), due = c.submissions.dueSoon(horizon);
    clear(this.subHost);
    if (due.length) this.subHost.append(h("div", { class: "banner banner--warn" }, [icon("clock", 15),
      h("span", { class: "banner__t", text: `${num(due.length)} kiriman perlu tindak lanjut ≤${num(horizon)} hari: ${due.map((d) => d.publisher).join(", ")}.` }),
      Controls.button("Lihat", () => this.openItem(due[0]), { small: true })]));
    this.subHost.append(Controls.toolbar([Controls.chip(`${num(stat.total)} tujuan`, "cyan"), Controls.chip(`${num(stat.sent)} terkirim`, "lime"),
      Controls.chip(`Balasan ${num(Math.round(stat.answerRate * 100))}%`, "violet"), h("span", { class: "grow" }),
      btn("Tambah", () => this.addItem(), "plus", "primary")]));
    const statusCell = (r) => {
      const sel = h("select", { class: "input select", "aria-label": `Status ${r.publisher}`, onchange: async () => {
        await c.submissions.update(r.id, { status: sel.value });
        this.paintSubmissions();
        c.toast.ok(`${r.publisher} → ${SUB_STATUS.find((s) => s[0] === sel.value)?.[1]}.`);
      } }, SUB_STATUS.map(([v, l]) => h("option", { value: v, text: l, selected: v === r.status })));
      sel.value = r.status;
      return sel;
    };
    const actionCell = (r) => row([
      ib("send", "Tandai sudah dikirim", async () => { await c.submissions.markSent(r.id); this.paintSubmissions(); c.toast.ok(`${r.publisher} ditandai terkirim hari ini.`); }),
      ib("quill", "Buat surat pengantar", () => this.queryLetter(r)),
      ib("trash", "Hapus dari daftar", () => this.removeItem(r), "danger")]);
    const table = new DataTable({ empty: "Belum ada penerbit yang dicatat.", onOpen: (r) => this.openItem(r), columns: [
      { key: "publisher", label: "Penerbit", width: "2 1", value: (r) => r.publisher },
      { key: "status", label: "Status", width: "1 1", render: statusCell },
      { key: "sentAt", label: "Dikirim", width: "1 1", value: (r) => (r.sentAt ? fmtDate(r.sentAt) : "belum") },
      { key: "aksi", label: "Aksi", width: "1 1", render: actionCell }] });
    table.setRows(c.submissions.items);
    table.setBulkActions([{ label: "Hapus terpilih", kind: "danger", icon: "trash", onClick: async (ids) => {
      const gone = await c.submissions.remove(ids);
      this.paintSubmissions();
      c.toast.undo(`${num(gone.length)} tujuan dihapus.`, async () => { await c.submissions.undo(); this.paintSubmissions(); });
    } }]);
    this.table?.destroy();
    this.table = table;
    this.subHost.append(table.el);
  }
  async addItem() {
    const it = await this.ctx.submissions.add({ publisher: `Penerbit ${this.ctx.submissions.items.length + 1}` });
    this.paintSubmissions();
    this.ctx.toast.ok("Tujuan baru dibuat — lengkapi detailnya.");
    this.openItem(it);
  }
  removeItem(r) {
    const c = this.ctx;
    c.modal.confirm("Hapus tujuan ini?", `${r.publisher} hilang dari daftar pengiriman.`, { danger: true, okLabel: "Hapus" }).then(async (ok) => {
      if (!ok) return;
      await c.submissions.remove([r.id]);
      this.paintSubmissions();
      c.toast.undo(`${r.publisher} dihapus.`, async () => { await c.submissions.undo(); this.paintSubmissions(); });
    });
  }
  openItem(it) {
    const c = this.ctx, form = this.subForm = {};
    const mk = (label, type, value, name) => Controls.row(label, form[name] = h("input", { class: "input", type, value: value || "", "aria-label": label }));
    form.note = h("textarea", { class: "input textarea", rows: 3, "aria-label": "Catatan" });
    form.note.value = it.note || "";
    const body = stack([mk("Penerbit / agen", "text", it.publisher, "publisher"),
      mk("Narahubung", "text", it.contact, "contact"), mk("Tanggal kirim", "date", it.sentAt, "sentAt"),
      mk("Rencana tindak lanjut", "date", it.nextAt, "nextAt"), Controls.row("Catatan", form.note),
      c.controls.field({ label: "Status", type: "select", options: SUB_STATUS }, it.status, (v) => { form.statusValue = v; })]);
    c.modal.open({ title: "Detail pengiriman", subtitle: it.publisher, width: 440, body, actions: [
      { label: "Batal" },
      { label: "Surat", onClick: () => { this.queryLetter(it); return false; }, keepOpen: true },
      { label: "Simpan", kind: "primary", onClick: async () => {
        await c.submissions.update(it.id, { publisher: form.publisher.value.trim() || it.publisher, contact: form.contact.value.trim(),
          sentAt: form.sentAt.value, nextAt: form.nextAt.value, note: form.note.value, status: form.statusValue || it.status });
        this.paintSubmissions();
        c.toast.ok("Detail pengiriman disimpan.");
      } }] });
  }
  queryLetter(item) {
    const c = this.ctx, box = h("textarea", { class: "input textarea", rows: 12, "aria-label": "Surat pengantar" });
    box.value = c.submissions.queryLetter(c.projects.active, item);
    c.modal.open({ title: "Surat pengantar", subtitle: `${item.publisher} · ${c.projects.active?.title || "tanpa proyek"}`, width: 480,
      body: stack([box, para("small muted", "Disusun dari judul, penulis, genre, premis, dan target kata — sunting bebas.")]),
      actions: [
        { label: "Salin", keepOpen: true, onClick: async () => { await navigator.clipboard.writeText(box.value); c.toast.ok("Surat disalin ke papan klip."); return false; } },
        { label: "Sisipkan ke editor", keepOpen: true, onClick: () => {
          if (c.insertToEditor(box.value)) c.toast.ok("Surat disisipkan ke akhir adegan yang terbuka.");
          else c.toast.warn("Belum ada editor adegan yang terbuka.");
          return false;
        } },
        { label: "Tutup", kind: "primary" }] });
  }
  paintDataset() {
    if (!this.dataHost?.isConnected) return;
    const c = this.ctx, items = c.library.items;
    clear(this.dataHost);
    if (!items.length) { this.dataHost.append(Controls.empty("Belum ada kliping", "Panen halaman di tab Riset, datanya bisa diekspor dari sini.")); return; }
    this.dataHost.append(para("small muted", `${num(items.length)} item · ${bytes(c.library.bytes())} · ${num(c.library.datasets().length)} dataset.`));
    const rowEl = h("div", { class: "toolbar" });
    for (const k of ["json", "csv", "markdown", "zip"]) {
      const locked = k === "zip" && !c.license.can("ekspor.zip");
      rowEl.append(Controls.button(k.toUpperCase(), async () => {
        if (locked) { this.explainLock({ label: "Arsip ZIP", feat: "ekspor.zip" }); return; }
        try {
          const res = await c.exports.exportDataset(items, k, this.opts.name.trim() || "riset");
          c.toast.ok(`Dataset tersimpan: ${res.filename} (${bytes(res.bytes || 0)})`, { timeout: 7000 });
        } catch (err) { c.toast.error(`Ekspor dataset gagal: ${err.message}`); }
      }, { small: true, kind: locked ? "" : "ghost", iconName: "database", title: locked ? c.license.reason("ekspor.zip") : `Unduh semua kliping sebagai .${k === "markdown" ? "md" : k}` }));
    }
    this.dataHost.append(rowEl);
  }
  destroy() {
    this.table?.destroy();
    this.table = null;
    for (const off of this.cleanups.splice(0)) { try { off(); } catch {} }
    this.bound = false;
    this.host = this.body = null;
  }
}
