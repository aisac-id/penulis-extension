import { h, clear, icon, num, fmtDate } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { ListBoard } from "../ui/ListBoard.js";

const TABS = [{ value: "latar", label: "Latar" }, { value: "kronologi", label: "Kronologi" }, { value: "aturan", label: "Aturan dunia" }];
const KIND = { latar: "places", kronologi: "events", aturan: "rules" };
const NOUN = { places: "tempat", events: "peristiwa", rules: "aturan dunia" };
const stack = (kids = []) => h("div", { class: "stack" }, kids);
const row = (kids = []) => h("div", { class: "row" }, kids);
const btn = (label, fn, ic = null, kind = "ghost", small = false) => Controls.button(label, fn, { small, kind, iconName: ic });
const ib = (name, label, fn, tone = "") => Controls.iconButton(name, label, fn, { tone });

export class DuniaPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "dunia"; this.title = "Dunia & Kronologi"; this.icon = "globe"; this.cleanups = [];
    this.tab = "latar"; this.term = ""; this.sel = new Set(); this.current = null;
  }
  async render(host, mode) {
    this.host = host; this.mode = mode;
    this._teardown();
    if (!this.ctx.bible.projectId) await this.ctx.bible.load();
    this.cleanups.push(this.ctx.bus.on("project.changed", (p) => { if (p?.switched) this.paint(); }));
    this.wrap = stack();
    this.bulk = h("div", { class: "bulkbar", hidden: true });
    this.board = new ListBoard({
      onReorder: (id, to) => this._reorder(KIND[this.tab], id, to),
      onOpen: (item) => this._edit(KIND[this.tab], item.id),
      onSelect: () => this._bulk(),
      render: (item) => (this.tab === "latar" ? this._placeRow(item) : this._ruleRow(item)),
    });
    host.append(this.wrap);
    this.paint();
  }
  refresh() { this.paint(); }
  suspend() { if (this.ctx.drawer.isOpen) this.ctx.drawer.close(); }
  destroy() { this._teardown(); this.board?.destroy(); if (this.ctx.drawer.isOpen) this.ctx.drawer.close(); }
  _teardown() { for (const off of this.cleanups.splice(0)) { try { off(); } catch {} } }
  paint() {
    if (!this.wrap || !this.wrap.isConnected) return;
    clear(this.wrap);
    this.sel.clear();
    this.wrap.append(this._head(), this._stats());
    if (this.tab === "kronologi") this.wrap.append(...[this._clashes(), this._timeline()].filter(Boolean));
    else this.wrap.append(this._list());
  }
  _head() {
    const search = Controls.search(this._placeholder(), (v) => { this.term = v; this.paint(); }, { value: this.term });
    return stack([
      Controls.segmented(TABS, this.tab, (v) => { this.tab = v; this.term = ""; this.sel.clear(); this.paint(); }),
      Controls.toolbar([search.box,
        btn("Tambah", () => this._add(KIND[this.tab]), "plus", "primary", true),
        btn("Ringkas dunia", () => this._brief(), "spark", "ghost", true)]),
    ]);
  }
  _placeholder() {
    return this.tab === "latar" ? "Cari tempat, detail sensorik…"
      : this.tab === "kronologi" ? "Cari peristiwa, tanggal, tempat…" : "Cari aturan dunia…";
  }
  _stats() {
    const b = this.ctx.bible, clashes = b.clashes().length;
    const evs = b.list("events").filter((e) => e.when).map((e) => String(e.when));
    return h("div", { class: "grid grid--3" }, [
      Controls.stat("Tempat", num(b.list("places").length), { tone: "teal", iconName: "globe", sub: "dengan detail sensorik" }),
      Controls.stat("Peristiwa", num(b.list("events").length), { tone: "cyan", sub: evs.length ? `terlama ${this._date([...evs].sort()[0])}` : "belum bertanggal" }),
      Controls.stat("Aturan", num(b.list("rules").length), { tone: clashes ? "red" : "amber", sub: `${num(clashes)} tabrakan tanggal` }),
    ]);
  }
  _list() {
    const kind = KIND[this.tab], all = this.ctx.bible.list(kind), rows = this._filter(all, kind);
    if (!all.length) {
      return Controls.empty(this._emptyTitle(kind), this._emptyDesc(kind),
        btn(`Tambah ${NOUN[kind]}`, () => this._add(kind), "plus", "primary"));
    }
    if (!rows.length) {
      return Controls.empty("Tidak ada yang cocok", `Tidak ada ${NOUN[kind]} untuk kata “${this.term}”.`,
        btn("Bersihkan pencarian", () => { this.term = ""; this.paint(); }, "x", ""));
    }
    this.board.selected.clear();
    return h("div", {}, [this.board.setItems(rows), this.bulk]);
  }
  _emptyTitle(kind) { return kind === "places" ? "Belum ada latar tempat" : "Belum ada aturan dunia"; }
  _emptyDesc(kind) {
    return kind === "places"
      ? "Tulis bau, bunyi, tekstur, dan cahaya tempatnya."
      : "Tulis batas dunia cerita — dipakai asisten AI.";
  }
  _filter(all, kind) {
    return this.term.trim() ? this.ctx.bible.search(this.term, kind).map((r) => r.item) : [...all];
  }
  _placeRow(p) {
    const used = this._used(p), chips = used.slice(0, 4).map((x) => h("span", { class: "chip", text: x.title }));
    if (used.length > 4) chips.push(h("span", { class: "chip chip--info", text: `+${used.length - 4}` }));
    return h("div", { class: "lrow__main place" }, [
      h("div", { class: "grow" }, [
        row([h("strong", { text: p.name }), Controls.chip(p.kind || "Ruang", "cyan")]),
        p.senses ? h("p", { text: p.senses }) : h("p", { class: "muted", text: "Detail sensorik belum diisi." }),
        h("div", { class: "lrow__meta" }, chips.length ? chips : [h("span", { class: "muted", text: "belum muncul di naskah" })]),
      ]),
      ib("pencil", `Ubah ${p.name}`, () => this._edit("places", p.id)),
    ]);
  }
  _ruleRow(r) {
    return h("div", { class: "lrow__main" }, [
      icon("check", 14),
      h("div", { class: "grow small", text: r.text }),
      ib("pencil", "Ubah aturan", () => this._edit("rules", r.id)),
    ]);
  }
  // Bab yang menyebut tempat ini, ditelusur dari isi naskah.
  _used(p) {
    const name = String(p.name || "").toLowerCase().trim();
    if (!name) return [];
    const keys = [name, ...name.split(/[^a-z0-9]+/).filter((w) => w.length > 5)];
    return this.ctx.projects.chapters().filter((ch) => {
      const hay = [(ch.scenes || []).map((s) => s.text || "").join(" "), ch.title, ch.place, ch.summary].join(" ").toLowerCase();
      return keys.some((k) => hay.includes(k)) || (p.chapters || []).includes(ch.id);
    });
  }
  _timeline() {
    const c = this.ctx, all = c.bible.sortedEvents(), rows = this._filter(all, "events");
    if (!all.length) {
      return Controls.empty("Kronologi masih kosong", "Catat tanggal & tempat peristiwa agar urutan cerita tak bocor.",
        btn("Tambah peristiwa", () => this._add("events"), "plus", "primary"));
    }
    const warn = new Set(c.bible.clashes().map(([when]) => when));
    const body = rows.length
      ? rows.map((e) => this._tlRow(e, warn.has(String(e.when))))
      : [Controls.empty("Tidak ada peristiwa yang cocok", `Tidak ada peristiwa untuk kata “${this.term}”.`,
        btn("Bersihkan pencarian", () => { this.term = ""; this.paint(); }, "x", ""))];
    return h("div", {}, [h("div", { class: "timeline" }, body), this.bulk]);
  }
  _tlRow(e, isWarn) {
    const box = h("input", { type: "checkbox", class: "tcheck", checked: this.sel.has(e.id), "aria-label": `Pilih peristiwa ${e.what}` });
    box.addEventListener("change", () => { if (box.checked) this.sel.add(e.id); else this.sel.delete(e.id); this._bulk(); });
    const ch = this.ctx.projects.chapters().find((x) => x.id === e.chapter);
    const where = [e.place, ch ? `bab ${ch.title}` : "tanpa bab"].filter(Boolean).join(" · ");
    return h("div", { class: `tl ${isWarn ? "is-warn" : ""}` }, [
      h("div", { class: "tl__when", text: e.when ? this._date(e.when) : "tanpa tanggal" }),
      row([box,
        h("div", { class: "grow" }, [h("div", { class: "tl__what", text: e.what }), h("div", { class: "tl__where", text: where })]),
        ib("pencil", "Ubah peristiwa", () => this._edit("events", e.id)),
        ib("trash", "Hapus peristiwa", () => this._remove("events", [e.id]), "danger"),
      ]),
    ]);
  }
  _clashes() {
    const list = this.ctx.bible.clashes();
    if (!list.length) return null;
    return h("div", { class: "banner banner--warn" }, [
      icon("clock", 16),
      h("div", { class: "banner__t" }, [
        h("strong", { text: `${num(list.length)} tanggal dipakai di lebih dari satu tempat` }),
        ...list.map(([when, evs]) => h("div", { class: "small", text: `${this._date(when)} — ${evs.map((e) => e.place || "tanpa tempat").join(" / ")}` })),
      ]),
      btn("Tinjau", () => this._edit("events", list[0][1][0].id), null, "ghost", true),
    ]);
  }
  _date(v) {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? String(v) : fmtDate(d);
  }
  _fields(kind, item) {
    const chapters = this.ctx.projects.chapters();
    if (kind === "places") return [
      { key: "name", label: "Nama tempat", value: item.name, placeholder: "mis. Pasar Wage" },
      { key: "kind", label: "Jenis", value: item.kind, placeholder: "Rumah / Publik / Institusi" },
      { key: "senses", label: "Detail sensorik", value: item.senses, type: "textarea", hint: "bau, bunyi, tekstur, cahaya" },
      { key: "note", label: "Catatan penulis", value: item.note, type: "textarea" },
    ];
    if (kind === "events") return [
      { key: "when", label: "Tanggal", value: item.when, type: "date" },
      { key: "what", label: "Peristiwa", value: item.what, placeholder: "mis. Surat terakhir Bapak" },
      { key: "place", label: "Tempat", value: item.place, placeholder: "isi bebas atau pilih dari latar", list: "dunia-tempat" },
      { key: "chapter", label: "Bab terkait", value: item.chapter, type: "select", options: [["", "Belum ada bab"], ...chapters.map((x) => [x.id, x.title])] },
    ];
    return [{ key: "text", label: "Aturan dunia", value: item.text, type: "textarea", hint: "satu aturan per kartu" }];
  }
  async _form(title, fields) {
    const inputs = new Map();
    const dl = this.ctx.bible.list("places").map((p) => h("option", { value: p.name }));
    const body = stack([
      ...fields.map((f) => {
        const el = f.type === "textarea" ? h("textarea", { class: "input textarea", rows: 3, "aria-label": f.label })
          : f.type === "select" ? h("select", { class: "input select", "aria-label": f.label }, f.options.map(([v, l]) => h("option", { value: v, text: l })))
            : h("input", { class: "input", type: f.type || "text", "aria-label": f.label, placeholder: f.placeholder || "", list: f.list || null });
        el.value = f.value ?? "";
        inputs.set(f.key, el);
        return h("label", { class: "field" }, [h("span", { class: "field__label", text: f.label }), el,
          f.hint ? h("small", { class: "muted", text: f.hint }) : null]);
      }),
      dl.length ? h("datalist", { id: "dunia-tempat" }, dl) : null,
    ]);
    const r = await this.ctx.modal.open({
      title, body, width: 430,
      actions: [{ label: "Batal", value: null }, { label: "Simpan", kind: "primary", value: "ok" }],
    });
    if (r !== "ok") return null;
    const out = {};
    for (const [k, el] of inputs) out[k] = String(el.value ?? "").trim();
    return out;
  }
  async _add(kind) {
    const c = this.ctx, vals = await this._form(`Tambah ${NOUN[kind]}`, this._fields(kind, {}));
    if (!vals || !Object.values(vals).some((v) => v)) { c.toast.info("Tidak ada isian — batal disimpan."); return; }
    const item = await c.bible.add(kind, vals);
    this.current = item.id;
    this.paint();
    c.toast.ok(`${NOUN[kind]} tersimpan.`, { action: () => this._edit(kind, item.id), actionLabel: "Ubah lagi" });
  }
  async _edit(kind, id) {
    const c = this.ctx, item = c.bible.find(kind, id);
    if (!item) return;
    const vals = await this._form(`Ubah ${NOUN[kind]}`, this._fields(kind, item));
    if (!vals) return;
    await c.bible.update(kind, id, vals);
    c.toast.ok(`${NOUN[kind]} diperbarui.`, { timeout: 1800 });
    this.paint();
  }
  async _reorder(kind, id, to) {
    const c = this.ctx;
    await c.bible.reorder(kind, id, to);
    c.toast.ok("Urutan tersimpan.", { timeout: 1600 });
    this.paint();
  }
  _bulk() {
    const kind = KIND[this.tab], ids = this.tab === "kronologi" ? [...this.sel] : [...(this.board?.selected || [])];
    this.bulk.hidden = !ids.length;
    clear(this.bulk);
    if (!ids.length) return;
    this.bulk.append(
      h("strong", { text: `${num(ids.length)} ${NOUN[kind]} dipilih` }), h("span", { class: "grow" }),
      btn("Hapus terpilih", () => this._remove(kind, ids), "trash", "danger", true),
      btn("Batal", () => { this.sel.clear(); this.board?.clearSelection(); this.paint(); }, null, "ghost", true));
  }
  async _remove(kind, ids) {
    const c = this.ctx;
    if (!(await c.modal.confirm(`Hapus ${NOUN[kind]}?`, `${ids.length} entri hilang dari bible; ringkasan ikut berubah.`, { danger: true, okLabel: "Hapus" }))) return;
    await c.bible.remove(kind, ids);
    this.sel.clear();
    this.board?.clearSelection();
    this.paint();
    c.toast.undo(`${num(ids.length)} ${NOUN[kind]} dihapus.`, async () => { await c.bible.undo(); this.paint(); });
  }
  async _brief() {
    const c = this.ctx, text = c.bible.brief();
    const how = await c.modal.pick("Ringkas dunia", [
      { value: "salin", label: "Salin ke papan klip", desc: `${num(c.bible.list("characters").length)} tokoh, ${num(c.bible.list("places").length)} tempat, ${num(c.bible.list("rules").length)} aturan.`, icon: "copy" },
      { value: "sisip", label: "Sisipkan ke editor", desc: "Masuk akhir bab yang terbuka.", icon: "quill" },
    ], "Tanpa isi naskah — aman untuk diskusi dengan editor.");
    if (!how) return;
    if (how === "sisip") { if (c.insertToEditor(`\n${text}\n`)) c.toast.ok("Ringkasan dunia disisipkan ke editor."); return; }
    try { await navigator.clipboard.writeText(text); c.toast.ok("Ringkasan dunia disalin."); }
    catch { c.toast.warn("Papan klip tidak tersedia — pakai Sisipkan ke editor."); }
  }
}
