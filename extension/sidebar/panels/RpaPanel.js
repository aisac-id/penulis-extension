import { h, clear, icon, num, debounce } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { ListBoard } from "../ui/ListBoard.js";
import { LocalExecutor, TabExecutor } from "../../rpa/Executors.js";
import { Recorder } from "../../rpa/Recorder.js";
import { ScriptStore } from "../../rpa/ScriptStore.js";
import { RpaEngine } from "../../rpa/RpaEngine.js";
import { ActionLibrary } from "../../rpa/ActionLibrary.js";
import { TEMPLATES } from "../../rpa/Templates.js";

const stack = (kids = []) => h("div", { class: "stack" }, kids);
const row = (kids = []) => h("div", { class: "row" }, kids);
const para = (cls, text) => h("p", { class: cls, text });
const span = (cls, text) => h("span", { class: cls, text });
const fld = (label, el) => h("label", { class: "field" }, [h("span", { class: "field__label", text: label }), el]);
const btn = (label, fn, icon = null, kind = "ghost") => Controls.button(label, fn, { small: true, kind, iconName: icon });
const ib = (name, label, fn, tone = "") => Controls.iconButton(name, label, fn, { tone });
const ANAME = { click: "Klik", type: "Isi kolom", select: "Pilih opsi", scroll: "Gulir", wait: "Tunggu", waitForSelector: "Tunggu elemen", extract: "Ambil data", screenshot: "Tangkap layar", navigate: "Buka URL", loop: "Ulangi", if: "Bila", highlight: "Tandai", setVar: "Simpan nilai" };
const NEED = ["click", "type", "select", "waitForSelector", "extract", "highlight"];
const STATE = { idle: "Siap", running: "Berjalan", paused: "Dijeda", done: "Selesai", stopped: "Dihentikan", error: "Gagal" };
const TONE = { error: "err", retry: "warn", skip: "warn", pause: "warn", blocked: "warn", stop: "warn", ok: "ok", done: "ok" };
const prog = (p) => `${STATE[p.state] || p.state} · ${p.total ? `${num(p.index)}/${num(p.total)} langkah (${num(Math.round(p.ratio * 100))}%)` : "tanpa langkah"}`;
const tsum = (t) => (!t ? "" : typeof t === "string" ? t : String(["css", "data", "id", "aria", "text", "xpath"].map((k) => t[k]).find(Boolean) || ""));
export class RpaPanel {
  constructor(ctx) {
    this.ctx = ctx; this.id = "rpa"; this.title = "Otomatisasi"; this.icon = "robot"; this.cleanups = [];
    this.term = ""; this.target = "demo"; this.scriptId = null; this.logs = []; this.acts = []; this.rec = null; this.recorded = 0;
    this._say = debounce(() => this.ctx.toast.ok("Disimpan — berlaku mulai langkah berikutnya.", { timeout: 1500 }), 600);
  }
  async render(host, mode) {
    this.host = host; this.mode = mode; this._teardown();
    this.cleanups.push(this.ctx.bus.on("rpa.event", (ev) => this._onEvent(ev)));
    this.wrap = stack(); this.bulk = h("div", { class: "bulkbar", hidden: true });
    this.board = new ListBoard({ onReorder: (id, to) => this._reorder(id, to), onSelect: () => this._bulk(), render: (s) => this._row(s), onOpen: (s) => { this.scriptId = s.id; this.paint(); } });
    if (!this.ctx.scripts.get(this.scriptId)) this.scriptId = this.ctx.scripts.list()[0]?.id || null;
    host.append(this.wrap); this.paint();
  }
  refresh() { this.paint(); }
  suspend() { if (this.rec?.active) this._recStop(); }
  destroy() { this._teardown(); this.rec?.destroy(); this.rec = null; this.board?.destroy(); }
  _teardown() { for (const off of this.cleanups.splice(0)) { try { off(); } catch {} } }
  _sel() { return this.ctx.scripts.get(this.scriptId); }
  _done(msg, undo) { this.paint(); if (undo) this.ctx.toast.undo(msg, undo); else this.ctx.toast.ok(msg, { timeout: 1800 }); }
  async _patch(id, fn, msg) {
    const c = this.ctx, s = c.scripts.get(id);
    if (!s) return;
    const before = s.steps.slice();
    try { await c.scripts.update(id, { steps: fn(before) }); } catch (err) { c.toast.error(err.message); return; }
    this._done(msg, async () => { await c.scripts.update(id, { steps: before }); this.paint(); });
  }
  paint() { if (!this.wrap?.isConnected) return; clear(this.wrap); this.wrap.append(this._top(), this._list(), this._steps(), this._engine(), this._results(), this._recorder(), this._controls()); this._bulk(); }
  _top() {
    const search = Controls.search("Cari skrip, deskripsi, label langkah…", (v) => { this.term = v; this.paint(); }, { value: this.term });
    const file = h("input", { type: "file", accept: ".json,application/json", "aria-label": "Berkas JSON skrip", style: { display: "none" } });
    file.addEventListener("change", async () => { const f = file.files?.[0]; if (f) await this._import(await f.text()); file.value = ""; });
    const all = this.ctx.scripts.list(), s = this._sel(), limit = this.ctx.settings.num("rpa.batasAksiJam");
    return stack([
      Controls.toolbar([search.box, btn("Skrip baru", () => this._new(), "plus"), btn("Dari template", () => this._fromTemplate(), "spark")]),
      Controls.toolbar([btn("Ekspor JSON", () => this._export(null), "export"), btn("Impor berkas", () => file.click(), "database"), btn("Impor tempel", () => this._paste(), "copy"), file]),
      h("div", { class: "grid grid--3" }, [Controls.stat("Skrip", num(all.length), { tone: "cyan", iconName: "robot", sub: `${num(all.filter((x) => x.builtin).length)} bawaan` }),
        Controls.stat("Langkah", num(s ? RpaEngine.count(s.steps || []) : 0), { tone: "violet", sub: s ? s.name : "belum dipilih" }),
        Controls.stat("Aksi 1 jam", num(this.acts.length), { tone: this.acts.length >= limit ? "red" : "lime", sub: `batas ${num(limit)}` })])]);
  }
  _list() {
    const all = this.ctx.scripts.list(), q = this.term.trim().toLowerCase();
    if (!all.length) return Controls.empty("Belum ada skrip", "Buat dari nol atau gandakan template bawaan.", Controls.button("Dari template", () => this._fromTemplate(), { kind: "primary", iconName: "spark" }));
    const rows = q ? all.filter((s) => `${s.name} ${s.desc || ""} ${(s.steps || []).map((x) => x.label).join(" ")}`.toLowerCase().includes(q)) : all;
    if (!rows.length) return Controls.empty("Tidak ada skrip cocok", `Nama, deskripsi, dan label tak ada yang cocok “${this.term}”.`, Controls.button("Bersihkan pencarian", () => { this.term = ""; this.paint(); }, { iconName: "x" }));
    this.board.selected.clear(); return h("div", {}, [this.board.setItems(rows), this.bulk]);
  }
  _row(s) {
    const bad = ScriptStore.validate(s).length, meta = [Controls.chip(`${num((s.steps || []).length)} langkah`, bad ? "red" : "cyan"), s.id === this.scriptId ? Controls.chip("dipilih", "ok") : null, s.desc ? span("nowrap", s.desc) : null];
    return h("div", { class: "lrow__main" }, [icon(s.icon || "robot", 16),
      h("div", { class: "grow" }, [h("div", { class: "lrow__title", text: s.name }), h("div", { class: "lrow__meta" }, meta)]),
      ib("play", `Jalankan ${s.name}`, () => this._run(s.id)), ib("trash", `Hapus ${s.name}`, () => this._remove([s.id]), "danger")]);
  }
  _steps() {
    const s = this._sel();
    if (!s) return Controls.fieldset("Langkah", para("muted small", "Pilih skrip di daftar untuk menyunting langkahnya."));
    const errs = ScriptStore.validate(s), box = {};
    const mk = (key, label, ph) => { box[key] = h("input", { class: "input", "aria-label": label, placeholder: ph }); return fld(label, box[key]); };
    box.sel = h("select", { class: "input select", "aria-label": "Jenis aksi" }, ActionLibrary.ACTIONS.map((a) => h("option", { value: a, text: ANAME[a] || a })));
    box.sel.value = "click";
    return Controls.fieldset(`Langkah — ${s.name}`, [
      errs.length ? h("div", { class: "banner banner--danger" }, [icon("x", 15), h("div", { class: "banner__t" }, [h("strong", { text: `${num(errs.length)} masalah validasi` }), ...errs.map((e) => span("small", e))])])
        : h("div", { class: "banner" }, [icon("check", 15), span("small", "Semua langkah valid — siap dijalankan.")]),
      stack(s.steps.length ? s.steps.map((st, i) => this._stepRow(s, st, i)) : [para("muted small", "Belum ada langkah — tambahkan di bawah.")]),
      Controls.fieldset("Tambah langkah", [
        h("div", { class: "grid grid--2" }, [fld("Aksi", box.sel), mk("label", "Label", "mis. Ambil paragraf"), mk("target", "Target CSS", "article p"), mk("value", "Nilai / teks / ms", "")]),
        row([mk("as", "Simpan sebagai", "paragraf"), btn("Tambah", () => this._addStep(s, box), "plus", "primary")])]),
      row([btn("Ubah nama", () => this._rename(s.id), "pencil"), btn("Hapus skrip", () => this._remove([s.id]), "trash", "danger")])],
    "Nomor langkah = urutan eksekusi; klik label atau target untuk mengubahnya.");
  }
  _stepRow(s, st, i) {
    const mv = (d) => { const b = ib("chevDown", `${d < 0 ? "Naikkan" : "Turunkan"} langkah ${i + 1}`, () => this._patch(s.id, (x) => { const y = [...x]; [y[i], y[i + d]] = [y[i + d], y[i]]; return y; }, `Langkah ${i + 1} pindah ke urutan ${i + 1 + d}.`)); if (d < 0) b.style.transform = "rotate(180deg)"; return b; };
    const ed = (key, label, ph) => h("button", { class: key === "label" ? "grow btn btn--sm nowrap" : "chip mono", type: "button", title: `Ubah ${label.toLowerCase()}`, text: key === "label" ? (st.label || st.action) : (tsum(st.target) || "tanpa target"), onclick: () => this._editStep(s, i, key, label, ph) });
    return row([span("lrow__num", String(i + 1)), Controls.chip(ANAME[st.action] || st.action, "violet"),
      ed("label", "Label langkah", "mis. Ambil paragraf"), ed("css", "Target CSS", "article p"),
      i > 0 ? mv(-1) : h("span"), i < s.steps.length - 1 ? mv(1) : h("span"),
      ib("x", `Hapus langkah ${i + 1}`, () => this._patch(s.id, (x) => x.filter((_, j) => j !== i), `Langkah ${i + 1} “${st.label || st.action}” dihapus.`), "danger")]);
  }
  async _addStep(s, box) {
    const action = box.sel.value, css = box.target.value.trim(), val = box.value.value, as = box.as.value.trim();
    const step = { action, label: (box.label.value || ANAME[action] || action).trim(), ...(css ? { target: { css } } : {}), ...(val ? { value: val } : {}), ...(as ? { as } : {}) };
    if (NEED.includes(action) && !step.target) { this.ctx.toast.warn(`Aksi ${ANAME[action]} wajib punya target CSS.`); return; }
    const at = (s.steps || []).length;
    await this.ctx.scripts.addStep(s.id, step);
    this._done(`Langkah ${at + 1} “${step.label}” ditambahkan.`, async () => { await this.ctx.scripts.removeStep(s.id, at); this.paint(); });
  }
  async _editStep(s, i, key, label, ph) {
    const cur = s.steps[i] || {};
    const v = await this.ctx.modal.prompt(`Ubah ${label.toLowerCase()}`, { label, value: key === "css" ? tsum(cur.target) : (cur[key] || ""), placeholder: ph, okLabel: "Simpan" });
    if (!v?.trim()) return;
    const val = key === "css" ? { ...cur, target: { ...(typeof cur.target === "object" && cur.target ? cur.target : {}), css: v.trim() } } : { ...cur, [key]: v.trim() };
    this._patch(s.id, (x) => x.map((y, j) => (j === i ? val : y)), `${label} diperbarui.`);
  }
  _engine() {
    const p = this.ctx.rpa.progress(), bar = Controls.progress(p.ratio, { tone: "lime", label: prog(p) });
    this.progFill = bar.querySelector("i"); this.progLabel = bar.querySelector(".prog__label");
    this.logEl = h("div", { class: "log", "aria-live": "polite" }, this.logs.map((r) => this._logRow(r)));
    return Controls.fieldset("Mesin", [
      Controls.segmented([{ value: "tab", label: "Halaman ini" }, { value: "demo", label: "Halaman demo" }], this.target, (v) => { this.target = v; this.paint(); }),
      row([btn("Jalankan", () => this._run(), "play", "primary"), btn("Jeda", () => this._ctl("pause"), "pause"), btn("Lanjut", () => this._ctl("resume"), "play"), btn("Berhenti", () => this._ctl("stop"), "stop", "danger")]),
      bar, this.logEl, para("muted small", "Halaman yang menolak akses atau menampilkan CAPTCHA menghentikan mesin otomatis.")],
    `${prog(p)} · target ${this.target === "demo" ? "halaman demo bawaan" : "tab aktif"}.`);
  }
  _ctl(kind) {
    const done = !!this.ctx.rpa[kind]?.(), label = { pause: "dijeda", resume: "dilanjutkan", stop: "dihentikan" }[kind];
    this.ctx.toast[done ? "ok" : "info"](done ? `Mesin ${label}.` : `Saat ${String(STATE[this.ctx.rpa.state] || this.ctx.rpa.state).toLowerCase()} tidak ada yang bisa ${label}.`, { timeout: 2200 });
  }
  async _demo() {
    const host = typeof this.ctx.demoHost === "function" ? this.ctx.demoHost() : null;
    if (host) host.hidden = false;
    await this.ctx.pages.ensureDemo(host || undefined);
    const root = this.ctx.pages.demoDocument();
    if (!root) this.ctx.toast.error("Halaman demo gagal dimuat.");
    return root || null;
  }
  async _executor() {
    if (this.target === "demo") { const root = await this._demo(); return root ? new LocalExecutor(this.ctx.settings, { root, bus: this.ctx.bus, logger: this.ctx.log }) : null; }
    const tab = await this.ctx.pages.activeTab();
    if (!tab?.id) { this.ctx.toast.warn("Tidak ada tab aktif — pakai Halaman demo atau buka satu tab."); return null; }
    this.ctx.tabId = tab.id; return new TabExecutor(this.ctx.bus, tab.id);
  }
  async _run(id = this.scriptId) {
    const c = this.ctx, s = c.scripts.get(id);
    if (!s) { c.toast.error("Pilih skrip dulu di daftar."); return; }
    this.scriptId = id;
    const errs = ScriptStore.validate(s);
    if (errs.length) { this.paint(); c.toast.error(`Skrip belum siap: ${errs[0]}`); return; }
    const limit = Math.max(1, c.settings.num("rpa.batasAksiJam"));
    this.acts = this.acts.filter((t) => t > Date.now() - 3600000);
    if (this.acts.length >= limit) { c.toast.warn(`Batas ${num(limit)} aksi/jam tercapai — tunggu atau naikkan di Kontrol berjalan.`); return; }
    const ex = await this._executor();
    if (!ex) return;
    let why = null;
    try { why = await ex.blocked(); } catch {}
    if (why) {
      const halt = c.settings.bool("rpa.autoPauseBlocked");
      this._log("warn", halt ? `Ditolak halaman: ${why}` : `${why} — jeda otomatis dimatikan, risiko ditanggung sendiri.`);
      if (halt) { ex.destroy?.(); this.paint(); c.toast.warn(`${why}. Jeda otomatis aktif — skrip tidak dijalankan.`); return; }
    }
    this.logs = []; this.paint();
    this._log("", `Mulai “${s.name}” pada ${this.target === "demo" ? "halaman demo" : "tab aktif"}`);
    try {
      const r = await c.rpa.run(s, ex);
      c.toast[r.state === "done" ? "ok" : "warn"](`${STATE[r.state] || r.state} · ${num(Math.round((r.ms || 0) / 1000))} dtk · ${num(c.rpa.results.length)} hasil.`);
    } catch (err) { this._log("err", err.message || String(err)); c.toast.error(err.message || String(err)); }
    finally { ex.destroy?.(); this.paint(); }
  }
  _results() {
    const rows = this.ctx.rpa.results.filter((r) => Array.isArray(r.data) && r.data.length).map((r) => h("div", { class: "card" }, [
      row([h("strong", { class: "small grow nowrap", text: r.step }), Controls.chip(`${num(r.data.length)} nilai`, "cyan"),
        btn("Simpan ke Data", () => this._ingest(r), "database"), btn("Salin", () => this._copy(r.data), "copy")]),
      h("ul", { class: "stack small" }, r.data.slice(0, 6).map((v) => h("li", { text: String(v).replace(/\s+/g, " ").slice(0, 160) }))),
      r.data.length > 6 ? span("muted small", `+${num(r.data.length - 6)} nilai lain`) : null]));
    if (!rows.length) rows.push(para("muted small", "Belum ada hasil — jalankan skrip berisi aksi Ambil data."));
    return Controls.fieldset("Hasil ekstraksi", stack(rows), "Tiap aksi Ambil data menghasilkan daftar untuk tab Data.");
  }
  async _ingest(r) {
    const vals = r.data.map((v) => String(v).replace(/\s+/g, " ").trim()).filter((t) => t.length >= 4);
    let added = 0;
    for (const text of vals) { const out = await this.ctx.pipeline.ingest({ type: "text", title: text.slice(0, 60), text }, { dataset: "Otomatisasi", tags: ["rpa", this._sel()?.name || "skrip"] }); if (!out.duplicate) added++; }
    this.ctx.toast.ok(`${num(added)} nilai masuk dataset “Otomatisasi”${r.data.length - added ? `, ${num(r.data.length - added)} dilewati (duplikat/pendek)` : ""}.`);
  }
  _copy(data) { navigator.clipboard.writeText(data.map((v) => String(v).trim()).join("\n")).then(() => this.ctx.toast.ok("Hasil disalin ke papan klip.")).catch(() => this.ctx.toast.warn("Papan klip tidak tersedia.")); }
  _recorder() {
    const on = this.ctx.settings.bool("rpa.rekaman");
    const b = !on ? btn("Perekam nonaktif", () => this.ctx.toast.warn("Nyalakan “Aktifkan perekam klik/ketikan” di Kontrol berjalan."), "lock", "")
      : this.rec ? btn("Hentikan rekaman", () => this._recStop(), "stop", "danger") : btn("Mulai merekam", () => this._recStart(), "play", "primary");
    return Controls.fieldset("Perekam langkah", [
      row([b, Controls.chip(this.rec ? "sedang merekam" : `${num(this.recorded)} langkah terekam`, this.rec ? "amber" : "cyan")]),
      para("muted small", "Klik dan ketik di halaman demo menjadi langkah; antarmuka Kalam diabaikan."),
      para("muted small", `Tujuan rekaman: ${this._sel()?.name || "belum dipilih — klik satu skrip di daftar dulu."}`)], "Isi kolom sandi tidak pernah ikut terekam.");
  }
  async _recStart() {
    if (!this._sel()) { this.ctx.toast.warn("Pilih skrip tujuan di daftar dulu."); return; }
    const root = await this._demo();
    if (!root) return;
    this.rec = new Recorder(this.ctx.bus, { root, onStep: (st, i) => { this.recorded = i; this._log("ok", `Terekam #${num(i)}: ${ANAME[st.action] || st.action} — ${st.label || tsum(st.target)}`); } });
    this.rec.start();
    this.ctx.toast.info("Merekam — klik/ketik di halaman demo, lalu hentikan di sini.");
    this.paint();
  }
  async _recStop() {
    const steps = this.rec?.stop() || [], s = this._sel();
    this.rec = null; this.recorded = steps.length;
    if (!steps.length) { this._done("Tidak ada langkah terekam."); return; }
    if (!s) { this.ctx.toast.error("Skrip tujuan tidak ada — hasil rekaman dibuang."); this.paint(); return; }
    const before = (s.steps || []).length;
    for (const st of steps) await this.ctx.scripts.addStep(s.id, st);
    this._done(`${num(steps.length)} langkah rekaman masuk ke “${s.name}”.`, async () => {
      const cur = this.ctx.scripts.get(s.id);
      if (cur) { await this.ctx.scripts.update(s.id, { steps: cur.steps.slice(0, before) }); this.paint(); }
    });
  }
  _controls() {
    const keys = [...this.ctx.settings.byCategory("rpa").map((f) => f.key), "scraper.jedaHalamanMs"];
    const rows = keys.map((k) => { const spec = this.ctx.settings.field(k); return spec ? this.ctx.controls.field(spec, this.ctx.settings.get(k), (v) => this._set(k, v)) : null; }).filter(Boolean);
    this.estRun = h("div", { class: "small" }); this.estUse = h("div", { class: "small muted" });
    const box = Controls.fieldset("Kontrol berjalan", [stack(rows), h("div", { class: "banner" }, [icon("gauge", 15), h("div", { class: "banner__t" }, [this.estRun, this.estUse])])], "Berlaku mulai langkah berikutnya, tanpa dijalankan ulang.");
    this._updEstimate(); return box;
  }
  async _set(key, value) {
    try { await this.ctx.settings.set(key, value); } catch (err) { this.ctx.toast.error(err.message); return; }
    this._updEstimate(); this._say();
  }
  _updEstimate() {
    if (!this.estRun?.isConnected) return;
    const s = this.ctx.settings, jeda = s.num("rpa.jedaMs"), jitter = s.num("rpa.jitterMs"), skrip = this._sel(), n = skrip ? RpaEngine.count(skrip.steps || []) : 0, kuota = `kuota aksi ${num(this.acts.length)}/${num(s.num("rpa.batasAksiJam"))} per jam`;
    this.estRun.textContent = `Antaraksi ±${num(jeda)} ms (+ jitter ${num(jitter)} ms) · maks ${num(s.num("rpa.retry") + 1)} percobaan · timeout ${num(s.num("rpa.timeoutMs"))} ms · jeda halaman scraper ${num(s.num("scraper.jedaHalamanMs"))} ms.`;
    this.estUse.textContent = n ? `Skrip terpilih ± ${num(n)} aksi → perkiraan ${num(Math.ceil((n * (jeda + jitter / 2) + n * 120) / 1000))} dtk penjadwalan · ${kuota}.` : `${kuota}.`;
  }
  _logRow(r) { return h("div", { class: `log__l ${r.tone ? `log--${r.tone}` : ""}` }, [h("span", { class: "log__t", text: new Date(r.at).toLocaleTimeString("id-ID", { hour12: false }) }), h("span", { class: "log__m", text: r.text })]); }
  _log(tone, text) {
    this.logs.push({ tone, text, at: Date.now() });
    if (this.logs.length > 120) this.logs.splice(0, this.logs.length - 120);
    if (!this.logEl?.isConnected) return;
    this.logEl.append(this._logRow(this.logs[this.logs.length - 1]));
    while (this.logEl.children.length > 120) this.logEl.firstChild.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }
  _onEvent(ev) {
    if (ev.kind === "step") this.acts.push(Date.now());
    this._log(TONE[ev.kind] || "", `${ev.index ?? "·"} ${ev.text || ev.title || ev.kind}`);
    const p = this.ctx.rpa.progress();
    if (this.progFill) this.progFill.style.transform = `scaleX(${p.ratio})`; if (this.progLabel) this.progLabel.textContent = prog(p);
    if (["done", "stop", "error"].includes(ev.kind)) this.paint();
  }
  _bulk() {
    const ids = [...(this.board?.selected || [])];
    this.bulk.hidden = !ids.length;
    clear(this.bulk);
    if (!ids.length) return;
    this.bulk.append(h("strong", { text: `${num(ids.length)} skrip dipilih` }), h("span", { class: "grow" }),
      btn("Ekspor terpilih", () => this._export(ids), "export"), btn("Hapus terpilih", () => this._remove(ids), "trash", "danger"), btn("Batal", () => this.board.clearSelection(), "x"));
  }
  async _remove(ids) {
    if (!await this.ctx.modal.confirm("Hapus skrip?", `${num(ids.length)} skrip dihapus dari daftar — ekspor dulu bila masih perlu.`, { danger: true, okLabel: "Hapus" })) return;
    if (ids.includes(this.scriptId)) this.scriptId = this.ctx.scripts.list().find((x) => !ids.includes(x.id))?.id || null;
    await this.ctx.scripts.remove(ids);
    this.board.clearSelection();
    this._done(`${num(ids.length)} skrip dihapus.`, async () => { await this.ctx.scripts.undo(); this.paint(); });
  }
  async _reorder(id, to) { await this.ctx.scripts.reorder(id, to); this._done("Urutan skrip tersimpan."); }
  _opened(s, msg) { this.scriptId = s.id; this._done(msg, async () => { await this.ctx.scripts.remove([s.id]); this.paint(); }); }
  async _new() {
    const name = await this.ctx.modal.prompt("Skrip baru", { label: "Nama skrip", placeholder: "mis. Panen lampiran tabel" });
    if (name?.trim()) this._opened(await this.ctx.scripts.add({ name: name.trim() }), `“${name.trim()}” dibuat — belum ada langkah.`);
  }
  async _rename(id) {
    const s = this.ctx.scripts.get(id), name = s && await this.ctx.modal.prompt("Ubah nama skrip", { label: "Nama", value: s.name });
    if (!name?.trim()) return;
    await this.ctx.scripts.update(id, { name: name.trim() });
    this._done("Nama skrip diperbarui.");
  }
  async _fromTemplate() {
    const id = await this.ctx.modal.pick("Duplikat dari template",
      TEMPLATES.map((t) => ({ value: t.id, label: t.name, desc: `${t.desc} · ${num(t.steps.length)} langkah`, icon: t.icon || "robot" })),
      "Salinan bebas disunting; template bawaan tetap utuh.");
    if (!id) return;
    try { this._opened(await this.ctx.scripts.fromTemplate(id), "Template tersalin — siap disunting."); } catch (err) { this.ctx.toast.error(err.message); }
  }
  async _export(ids) {
    try {
      const blob = new Blob([this.ctx.scripts.toJSON(ids)], { type: "application/json" });
      this.ctx.toast.ok(`Diekspor: ${(await this.ctx.exports.download(blob, ids ? `skrip-terpilih-${ids.length}.json` : "kalam-skrip.json")).filename}`);
    } catch (err) { this.ctx.toast.error(err.message || "Ekspor gagal."); }
  }
  async _import(text) { try { const r = await this.ctx.scripts.importJSON(text); this._done(`${num(r.imported)} diimpor, ${num(r.skipped)} dilewati (tidak valid).`); } catch (err) { this.ctx.toast.error(err.message); } }
  async _paste() {
    const text = await this.ctx.modal.prompt("Impor skrip dari teks", { label: "Tempel JSON format kalam-rpa", multiline: true, placeholder: '{ "format": "kalam-rpa", "scripts": [ … ] }', okLabel: "Impor" });
    if (text?.trim()) await this._import(text);
  }
}
