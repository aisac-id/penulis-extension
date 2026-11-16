import { h, clear, num } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { ListBoard } from "../ui/ListBoard.js";

const stack = (kids = []) => h("div", { class: "stack" }, kids);
const row = (kids = []) => h("div", { class: "row" }, kids);
const para = (cls, text) => h("p", { class: cls, text });
const PROSE = [["want", "Yang diinginkan"], ["need", "Yang dibutuhkan"], ["wound", "Luka batin"], ["voice", "Suara / cara bicara"], ["arc", "Busur perubahan"]];
const TONES = ["cyan", "amber", "magenta", "violet", "lime", "teal"];

export class KarakterPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "karakter"; this.title = "Tokoh"; this.icon = "users"; this.cleanups = [];
    this.state = { term: "", role: "", tag: "", sort: "nama", tone: "" };
    this.current = null; this.cache = new Map();
  }
  async render(host, mode) {
    this.host = host; this.mode = mode; this._teardown();
    if (!this.ctx.bible.projectId) await this.ctx.bible.load();
    this.cleanups.push(this.ctx.bus.on("project.changed", (p) => { if (p?.switched) this.paint(); }));
    this.wrap = stack(); this.bulk = h("div", { class: "bulkbar", hidden: true });
    this.board = new ListBoard({ onReorder: (id, to) => this._reorder(id, to), onOpen: (item) => this._detail(item.id), onSelect: (ids) => this._bulk(ids), render: (item) => this._row(item) });
    host.append(this.wrap); this.paint();
  }
  refresh() { this.paint(); }
  suspend() { if (this.ctx.drawer.isOpen) this.ctx.drawer.close(); }
  destroy() { this._teardown(); this.board?.destroy(); if (this.ctx.drawer.isOpen) this.ctx.drawer.close(); }
  _teardown() { for (const off of this.cleanups.splice(0)) { try { off(); } catch {} } }
  paint() {
    if (!this.wrap?.isConnected) return;
    this.cache.clear(); clear(this.wrap);
    const all = this.ctx.bible.list("characters");
    this.wrap.append(this._head(all), this._stats(all));
    const rows = this._filter(all);
    if (!all.length) {
      this.wrap.append(Controls.empty("Belum ada tokoh di bible ini", "Isi nama, peran, keinginan & luka batin — dipakai pemeriksa konsistensi dan AI.",
        Controls.button("Tambah tokoh", () => this._add(), { kind: "primary", iconName: "plus" })));
      return;
    }
    if (!rows.length) {
      this.wrap.append(Controls.empty("Tidak ada tokoh yang cocok", "Tidak ada yang cocok dengan pencarian & filter aktif.",
        Controls.button("Bersihkan pencarian & filter", () => { this.state.term = ""; this.state.role = ""; this.state.tag = ""; this.state.tone = ""; this.paint(); }, { iconName: "x" })));
      return;
    }
    this.board.selected.clear();
    this.wrap.append(this.board.setItems(rows), this.bulk);
    this._bulk([]);
  }
  _head(all) {
    const s = this.state;
    const roles = [...new Set(all.map((c) => c.role).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id"));
    const tags = [...new Set(all.flatMap((c) => c.tags || []))].sort((a, b) => a.localeCompare(b, "id"));
    const search = Controls.search("Cari nama, alias, penanda…", (v) => { s.term = v; this.paint(); }, { value: s.term });
    return stack([
      Controls.toolbar([search.box, Controls.button("Tambah tokoh", () => this._add(), { kind: "primary", small: true, iconName: "plus" })]),
      row([
        this._sel([["", "Semua peran"], ...roles.map((r) => [r, r])], s.role, (v) => { s.role = v; this.paint(); }, "Saring menurut peran"),
        this._sel([["", "Semua penanda"], ...tags.map((t) => [t, `#${t}`])], s.tag, (v) => { s.tag = v; this.paint(); }, "Saring menurut penanda"),
        this._sel([["", "Semua warna"], ...TONES.map((t) => [t, t])], s.tone, (v) => { s.tone = v; this.paint(); }, "Saring warna kartu"),
        this._sel([["nama", "Urut: nama"], ["kemunculan", "Urut: kemunculan"], ["peran", "Urut: peran"]], s.sort, (v) => { s.sort = v; this.paint(); }, "Urutkan daftar"),
      ]),
      this._views(),
    ]);
  }
  _views() {
    const list = this.ctx.views.for(this.id);
    return row([
      Controls.button("Simpan tampilan", () => this._saveView(), { small: true, kind: "ghost", iconName: "eye" }),
      ...list.map((v) => h("span", { class: "saved-view" }, [
        h("button", { class: "btn btn--sm", type: "button", text: v.name, title: "Pulihkan pencarian, filter, dan urutan", onclick: () => this._restore(v) }),
        Controls.iconButton("x", `Hapus tampilan ${v.name}`, () => this._dropView(v), { tone: "danger" }),
      ])),
      list.length ? null : h("span", { class: "muted small", text: "Belum ada tampilan tersimpan." }),
    ]);
  }
  _stats(all) {
    const withApps = all.filter((c) => this._apps(c).length).length;
    const lengkap = all.filter((c) => c.want && c.need && c.voice).length;
    return h("div", { class: "grid grid--3" }, [
      Controls.stat("Tokoh", num(all.length), { tone: "cyan", iconName: "users" }),
      Controls.stat("Muncul di naskah", num(withApps), { tone: "lime", sub: "hasil telusur bab" }),
      Controls.stat("Detail lengkap", num(lengkap), { tone: "violet", sub: "ingin + butuh + suara" }),
    ]);
  }
  _row(c) {
    const apps = this._apps(c);
    const meta = [Controls.chip(c.role || "—", c.tone || "cyan")];
    if (c.alias && c.alias !== c.name) meta.push(h("span", { class: "mono", text: c.alias }));
    for (const t of (c.tags || []).slice(0, 2)) meta.push(h("span", { text: `#${t}` }));
    return h("div", { class: "lrow__main" }, [
      this._avatar(c),
      h("div", { class: "grow" }, [h("div", { class: "lrow__title", text: c.name || "Tanpa nama" }), h("div", { class: "lrow__meta" }, meta)]),
      h("div", { class: "lrow__num", text: `${num(apps.length)} bab`, title: `${num(this._hits(c))} sebutan di seluruh naskah` }),
    ]);
  }
  _avatar(c, size = 34) {
    const av = h("div", { class: "avatar", text: String(c.name || "?").trim().charAt(0).toUpperCase(), title: c.role || "" });
    av.style.cssText = `width:${size}px;height:${size}px;font-size:${size > 34 ? 17 : 13}px`;
    av.style.setProperty("--tone", `var(--c-${c.tone || "cyan"})`);
    return av;
  }
  _apps(c) { if (!this.cache.has(c.id)) this.cache.set(c.id, this.ctx.bible.appearances(c)); return this.cache.get(c.id); }
  _hits(c) { return this._apps(c).reduce((a, x) => a + x.hits, 0); }
  _filter(all) {
    const s = this.state;
    let rows = s.term.trim() ? this.ctx.bible.search(s.term, "characters").map((r) => r.item) : [...all];
    if (s.role) rows = rows.filter((c) => c.role === s.role);
    if (s.tag) rows = rows.filter((c) => (c.tags || []).includes(s.tag));
    if (s.tone) rows = rows.filter((c) => (c.tone || "cyan") === s.tone);
    const byNama = (a, b) => String(a.name).localeCompare(String(b.name), "id");
    if (s.sort === "kemunculan") rows.sort((a, b) => this._hits(b) - this._hits(a) || byNama(a, b));
    else if (s.sort === "peran") rows.sort((a, b) => String(a.role).localeCompare(String(b.role), "id") || byNama(a, b));
    else rows.sort(byNama);
    return rows;
  }
  _sel(options, value, onPick, label) {
    const sel = h("select", { class: "input select", "aria-label": label, style: { width: "auto", maxWidth: "140px", flex: "none" } },
      options.map(([v, l]) => h("option", { value: v, text: l })));
    sel.value = value;
    sel.addEventListener("change", () => onPick(sel.value));
    return sel;
  }
  _input(label, type, value, onCommit, placeholder = "") {
    const el = type === "textarea"
      ? h("textarea", { class: "input textarea", rows: 3, "aria-label": label, placeholder })
      : h("input", { class: "input", type, "aria-label": label, placeholder });
    el.value = value ?? "";
    el.addEventListener("change", () => onCommit(el.value));
    return h("label", { class: "field" }, [h("span", { class: "field__label", text: label }), el]);
  }
  _detail(id) {
    const c = this.ctx.bible.find("characters", id);
    if (!c) return;
    this.current = id;
    const apps = this._apps(c), top = apps.length ? Math.max(1, apps[0].hits) : 1, chapters = this.ctx.projects.chapters();
    const body = stack([
      row([this._avatar(c, 46), stack([
        this._input("Nama", "text", c.name, (v) => this._save(id, { name: v.trim() || c.name })),
        this._input("Alias", "text", c.alias, (v) => this._save(id, { alias: v.trim() }), "nama panggilan"),
      ])]),
      h("div", { class: "grid grid--2" }, [
        this._input("Peran", "text", c.role, (v) => this._save(id, { role: v.trim() }), "mis. Protagonis"),
        this._input("Usia", "number", c.age, (v) => this._save(id, { age: Number(v) || 0 })),
      ]),
      this._input("Penanda (pisahkan koma)", "text", (c.tags || []).join(", "),
        (v) => this._save(id, { tags: v.split(",").map((x) => x.trim()).filter(Boolean) }), "juru arsip, pulang"),
      ...PROSE.map(([k, label]) => this._input(label, "textarea", c[k], (v) => this._save(id, { [k]: v }))),
      h("div", { class: "grid grid--2" }, [
        h("label", { class: "field" }, [h("span", { class: "field__label", text: "Warna kartu" }),
          this._sel([["", "—"], ...TONES.map((t) => [t, t])], c.tone || "", (v) => this._save(id, { tone: v || "cyan" }), "Warna kartu tokoh")]),
        h("label", { class: "field" }, [h("span", { class: "field__label", text: "Bab pertama muncul" }),
          this._sel([["", "Belum ditentukan"], ...chapters.map((ch) => [ch.id, ch.title])], c.first || "", (v) => this._save(id, { first: v }), "Bab pertama tokoh ini")]),
      ]),
      Controls.fieldset("Kemunculan per bab", apps.length
        ? stack(apps.map((a) => row([
          h("span", { class: "small nowrap grow", text: a.title }),
          Controls.progress(a.hits / top, { tone: "cyan", height: 7 }),
          h("span", { class: "mono", text: num(a.hits) }),
        ])))
        : para("muted small", "Nama, alias, dan penandanya belum ditemukan di naskah mana pun."),
        "Dihitung dari teks naskah nyata."),
      c.voice ? h("div", { class: "quote", text: c.voice }) : null,
    ]);
    this.ctx.drawer.open({
      title: c.name || "Tokoh",
      subtitle: `${c.role || "peran belum diisi"} · muncul di ${num(apps.length)} bab`,
      badge: Controls.chip(c.role || "tanpa peran", c.tone || "cyan"),
      body,
      actions: [
        Controls.button("Sisipkan ringkasan ke editor", () => this._insert(c), { kind: "primary", iconName: "quill" }),
        Controls.button("Salin ringkasan", () => this._copy(this._summary(c)), { kind: "ghost", iconName: "copy" }),
        Controls.button("Hapus tokoh", () => this._remove([id]), { kind: "danger", iconName: "trash" }),
      ],
    });
  }
  async _save(id, patch) {
    await this.ctx.bible.update("characters", id, patch);
    this.ctx.toast.ok("Perubahan tersimpan.", { timeout: 1800 });
    this.paint(); this._detail(id);
  }
  _summary(c) {
    const apps = this._apps(c);
    const line = (label, val) => (val ? `${label}: ${val}` : "");
    return [
      `${c.name}${c.alias && c.alias !== c.name ? ` (${c.alias})` : ""} — ${c.role || "peran belum diisi"}`,
      line("Ingin", c.want), line("Butuh", c.need), line("Luka", c.wound), line("Suara", c.voice), line("Busur", c.arc),
      (c.tags || []).length ? `Penanda: ${c.tags.join(", ")}` : "",
      apps.length ? `Muncul di ${apps.length} bab: ${apps.map((a) => a.title).join(", ")}` : "Belum muncul di naskah.",
    ].filter(Boolean).join("\n");
  }
  _insert(c) { if (this.ctx.insertToEditor(`\n${this._summary(c)}\n`)) this.ctx.toast.ok(`Ringkasan “${c.name}” disisipkan ke editor.`); }
  async _copy(text) {
    try { await navigator.clipboard.writeText(text); this.ctx.toast.ok("Ringkasan disalin ke papan klip."); }
    catch { this.ctx.toast.warn("Papan klip tak tersedia — pakai tombol sisipkan."); }
  }
  async _add() {
    const name = await this.ctx.modal.prompt("Tambah tokoh", { label: "Nama tokoh", placeholder: "mis. Laras Prameswari", okLabel: "Tambah" });
    if (!name || !name.trim()) return;
    const c = await this.ctx.bible.add("characters", { name: name.trim() });
    this.paint();
    this.ctx.toast.ok(`“${c.name}” masuk bible.`, { action: () => this._detail(c.id), actionLabel: "Buka detail" });
  }
  async _reorder(id, to) {
    await this.ctx.bible.reorder("characters", id, to);
    this.ctx.toast.ok("Urutan tersimpan.", { timeout: 1600 });
    this.paint();
  }
  _bulk(ids) {
    if (!this.bulk) return;
    this.bulk.hidden = !ids.length;
    clear(this.bulk);
    if (!ids.length) return;
    this.bulk.append(
      h("strong", { text: `${num(ids.length)} tokoh dipilih` }), h("span", { class: "grow" }),
      Controls.button("Pilih semua", () => this.board.selectAll(), { small: true, kind: "ghost" }),
      Controls.button("Hapus terpilih", () => this._remove(ids), { small: true, kind: "danger", iconName: "trash" }),
      Controls.button("Batal", () => this.board.clearSelection(), { small: true, kind: "ghost" }));
  }
  async _remove(ids) {
    const ok = await this.ctx.modal.confirm("Hapus tokoh dari bible?",
      `${ids.length} tokoh hilang dari daftar & pemeriksa konsistensi.`, { danger: true, okLabel: "Hapus" });
    if (!ok) return;
    await this.ctx.bible.remove("characters", ids);
    if (ids.includes(this.current)) { this.current = null; this.ctx.drawer.close(); }
    this.board.clearSelection();
    this.paint();
    this.ctx.toast.undo(`${num(ids.length)} tokoh dihapus.`, async () => { await this.ctx.bible.undo(); this.paint(); });
  }
  async _saveView() {
    const name = await this.ctx.modal.prompt("Simpan tampilan", { label: "Nama tampilan", placeholder: "mis. Peran utama" });
    if (!name || !name.trim()) return;
    await this.ctx.views.add(this.id, name.trim(), { ...this.state });
    this.ctx.toast.ok(`Tampilan “${name.trim()}” tersimpan.`);
    this.paint();
  }
  async _restore(v) {
    const found = await this.ctx.views.restore(v.id);
    if (!found) return;
    this.state = { term: "", role: "", tag: "", sort: "nama", tone: "", ...found.state };
    this.ctx.toast.info(`Tampilan “${found.name}” dipulihkan.`);
    this.paint();
  }
  async _dropView(v) {
    await this.ctx.views.remove(v.id);
    this.paint();
    this.ctx.toast.undo(`Tampilan “${v.name}” dihapus.`, async () => { await this.ctx.views.add(v.panel, v.name, v.state); this.paint(); });
  }
}
