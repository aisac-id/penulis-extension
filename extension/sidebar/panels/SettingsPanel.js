import { h, clear, icon, num, pct, bytes, fmtDate } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";

const stack = (kids = []) => h("div", { class: "stack" }, kids);
const row = (kids = []) => h("div", { class: "row" }, kids);
const para = (cls, text) => h("p", { class: cls, text });
const span = (cls, text) => h("span", { class: cls, text });
const btn = (label, fn, icon = null, kind = "ghost") => Controls.button(label, fn, { small: true, kind, iconName: icon });
const ib = (name, label, fn, tone = "") => Controls.iconButton(name, label, fn, { tone });
const LOG_SIZES = [[100, "100 baris"], [200, "200 baris"], [400, "400 baris"]];
const LEVEL_TONE = { error: "err", warn: "warn", info: "", debug: "" };
const logLine = (tone, t, m) => h("div", { class: tone ? `log__l log--${tone}` : "log__l" }, [h("span", { class: "log__t", text: t }), h("span", { class: "log__m", text: m })]);
const jam = (t) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
const arg = (a) => (typeof a === "string" ? a : a == null ? "" : typeof a === "object" ? JSON.stringify(a) : String(a));

export class SettingsPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "settings"; this.title = "Pengaturan"; this.icon = "sliders"; this.bottom = true; this.cleanups = [];
    this.host = this.body = this.fieldHost = this.logHost = null;
    this.cat = "umum"; this.term = ""; this.logSize = 200; this.bound = false;
  }
  async render(host) {
    this.host = host;
    if (!this.bound) {
      this.bound = true;
      this.cleanups.push(this.ctx.bus.on("settings.changed", (p) => { if (this.fieldHost?.isConnected && !String(p?.key || "").startsWith("lanjutan.brand")) this.paintValue(p?.key); }));
      this.cleanups.push(this.ctx.bus.on("license.changed", () => { if (this.licHost?.isConnected) this.paintLicense(); }));
      this.cleanups.push(this.ctx.bus.on("data.changed", () => { if (this.dataHost?.isConnected) this.paintData(); }));
    }
    if (!this.body?.isConnected) this.build();
    this.paintTabs(); this.paintFields(); this.paintBackup(); this.paintLicense(); this.paintBrand(); this.paintApps(); this.paintData();
    return this;
  }
  refresh() { if (this.fieldHost?.isConnected) { this.paintTabs(); this.paintFields(); this.paintData(); } }
  build() {
    this.searchBox = Controls.search("Cari label, kunci, atau kategori…", (v) => { this.term = v; this.paintFields(); }, { value: this.term });
    this.tabHost = h("div", { class: "seg" });
    this.listHead = h("div", { class: "row small muted" });
    this.fieldHost = stack(); this.backupHost = stack(); this.licHost = stack(); this.brandHost = stack(); this.appHost = stack(); this.dataHost = stack();
    this.resetHost = h("div", { class: "toolbar" });
    this.body = stack([this.searchBox.box, this.tabHost,
      Controls.fieldset("Nilai", [this.listHead, this.fieldHost, this.resetHost], "Setiap perubahan langsung dipakai layanan terkait."),
      Controls.fieldset("Cadangan & pemulihan", [this.backupHost], "Berkas JSON berisi preferensi, tanpa kunci API."),
      Controls.fieldset("Lisensi", [this.licHost], "Edisi, uji coba, dan daftar fitur yang terbuka."),
      Controls.fieldset("White-label", [this.brandHost], "Nama, warna, dan tautan bantuan merek Anda."),
      Controls.fieldset("Aplikasi", [this.appHost], "Tutorial dan umpan balik suara."),
      Controls.fieldset("Data & alat", [this.dataHost], "Kuota nyata, duplikat, dan log internal.")]);
    this.host.append(this.body);
  }
  paintTabs() {
    this.tabHost.replaceChildren(...this.ctx.settings.categories.map((cat) => h("button", {
      class: `seg__b ${cat.id === this.cat && !this.term ? "is-active" : ""}`, type: "button", role: "tab", title: cat.desc,
      "aria-selected": cat.id === this.cat && !this.term ? "true" : "false", onclick: () => { this.cat = cat.id; this.term = ""; this.searchBox.input.value = ""; this.paintTabs(); this.paintFields(); },
    }, [icon(cat.icon, 13), h("span", { text: cat.label })])));
  }
  paintFields() {
    const c = this.ctx;
    const rows = this.term ? c.settings.search(this.term) : c.settings.byCategory(this.cat);
    const label = this.term ? `Cari "${this.term}"` : (c.settings.categories.find((x) => x.id === this.cat)?.label || this.cat);
    clear(this.fieldHost);
    this.listHead.replaceChildren(...[h("strong", { text: label }), Controls.chip(`${num(rows.length)} pengaturan`, "cyan"),
      h("span", { class: "grow" }), this.term ? btn("Hapus pencarian", () => { this.term = ""; this.searchBox.input.value = ""; this.paintTabs(); this.paintFields(); }, "x", "") : null].filter(Boolean));
    if (!rows.length) { this.resetHost.replaceChildren(); this.fieldHost.append(Controls.empty("Tidak ada yang cocok", "Coba kata lain, mis. “kuota” atau “model”.")); return; }
    for (const spec of rows) this.fieldHost.append(c.controls.field(spec, c.settings.get(spec.key), (v) => this.setField(spec.key, v)));
    const scope = this.term ? "hasil cari" : (c.settings.categories.find((x) => x.id === this.cat)?.label || "kategori");
    this.resetHost.replaceChildren(
      Controls.button(`Reset ${scope}`, () => this.resetRows(rows, scope), { small: true, kind: "ghost", iconName: "refresh", title: `Kembalikan ${rows.length} pengaturan yang tampil ke bawaan` }),
      Controls.button("Reset semua", () => this.resetAll(), { small: true, kind: "danger", iconName: "trash", title: `Kembalikan seluruh ${c.settings.schema.length} pengaturan ke bawaan` }));
  }
  async resetRows(rows, scope) {
    const c = this.ctx, before = Object.fromEntries(rows.map((s) => [s.key, c.settings.get(s.key)]));
    if (!(await c.modal.confirm(`Kembalikan ${scope}?`, "Hanya yang tampil kembali ke bawaan; kunci API dan naskah aman."))) return;
    if (this.term) await c.settings.setMany(Object.fromEntries(rows.map((s) => [s.key, s.default])));
    else await c.settings.resetCategory(this.cat);
    this.paintTabs(); this.paintFields(); this.paintBrand();
    c.toast.undo(`${num(rows.length)} pengaturan ${scope} kembali ke bawaan.`, async () => {
      await c.settings.importJSON({ values: before }); this.paintFields(); this.paintBrand();
    });
  }
  async setField(key, value) {
    const c = this.ctx;
    try {
      await c.settings.set(key, value);
      c.toast.ok(`${c.settings.field(key)?.label || key}: ${typeof value === "boolean" ? (value ? "ON" : "OFF") : value}.`);
      if (key.startsWith("lanjutan.brand")) c.brand.apply(c.root);
      if (key === "lanjutan.logLevel") c.log.setLevel(value);
      if (key === "lanjutan.developer") { this.paintData(); this.paintBrand(); }
    } catch (err) { c.toast.error(`Nilai ditolak: ${err.message}`); this.paintFields(); }
  }
  paintValue(key) {
    if (!key || key === "*") { this.paintFields(); this.paintData(); return; }
    if (["koneksi.", "data.", "menulis.", "umum.", "editor.", "analisis.", "rpa.", "scraper.", "lanjutan."].some((p) => key.startsWith(p))) this.paintData();
  }
  async resetAll() {
    const c = this.ctx;
    if (!(await c.modal.confirm("Kembalikan SEMUA pengaturan?", `${num(c.settings.schema.length)} nilai kembali ke bawaan; naskah & kunci API aman.`, { danger: true, okLabel: "Reset semua" }))) return;
    const before = c.settings.toJSON().values;
    const n = await c.settings.resetAll();
    this.paintTabs(); this.paintFields(); this.paintBrand(); this.paintData();
    c.toast.undo(`${num(n)} pengaturan kembali ke bawaan.`, async () => {
      await c.settings.importJSON({ values: before });
      this.paintTabs(); this.paintFields(); this.paintBrand(); this.paintData();
      c.toast.ok("Nilai pengaturan lama dipulihkan.");
    });
  }
  paintBackup() {
    const c = this.ctx;
    clear(this.backupHost);
    this.backupHost.append(Controls.toolbar([
      btn("Unduh settings.json", () => this.exportSettings(), "download", "primary"),
      btn("Salin ke papan klip", async () => { await navigator.clipboard.writeText(JSON.stringify(c.settings.toJSON(), null, 2)); c.toast.ok("Cadangan disalin — rahasia tidak ikut."); }, "copy", "")]));
    const file = h("input", { type: "file", accept: "application/json,.json", class: "input", "aria-label": "Berkas cadangan" });
    file.addEventListener("change", async () => { const f = file.files?.[0]; if (f) await this.importSettings(await f.text()); });
    const paste = h("textarea", { class: "input textarea", rows: 3, placeholder: '{"settingsVersion":…,"values":{…}}', "aria-label": "Tempel cadangan JSON" });
    this.backupHost.append(Controls.row("Pulihkan dari berkas", file, "Rahasia brankas tidak diekspor, jadi tak ikut kembali."),
      Controls.row("Atau tempel JSON", paste, "Kunci tak dikenal atau salah tipe dilewati."),
      btn("Terapkan cadangan", () => this.importSettings(paste.value), "refresh", "accent"));  }
  async exportSettings() {
    const c = this.ctx;
    try {
      const res = await c.exports.download(new Blob([JSON.stringify(c.settings.toJSON({ includeSecrets: false }), null, 2)], { type: "application/json" }), "kalam-settings.json");
      c.toast.ok(`Cadangan diunduh: ${res.filename} (${bytes(res.bytes || 0)}).`);
    } catch (err) { c.toast.error(`Cadangan gagal: ${err.message}`); }
  }
  async importSettings(text) {
    const c = this.ctx;
    try {
      const res = await c.settings.importJSON(JSON.parse(String(text || "{}")));
      this.paintFields(); this.paintBrand(); this.paintData(); this.paintLicense();
      c.toast.ok(`${num(res.applied)} pengaturan dipulihkan${res.errors.length ? `, ${num(res.errors.length)} dilewati: ${res.errors[0]}` : ""}.`);
    } catch (err) { c.toast.error(`Cadangan tidak terbaca: ${err.message}`); }
  }
  async paintLicense() {
    const c = this.ctx, info = c.license.info();
    clear(this.licHost);
    this.licHost.append(Controls.toolbar([Controls.chip(info.label, info.edition === "free" ? "amber" : "lime"),
      Controls.chip(info.mode, "cyan"), Controls.chip(`sisa uji coba ${num(info.trialDaysLeft)} hari`, "violet"),
      Controls.chip(`tolerasi luring ${num(info.graceDays)} hari`, "magenta"), Controls.chip(info.verified ? "terverifikasi" : "belum terverifikasi", info.verified ? "lime" : "red")]));
    this.licHost.append(para("small muted", info.email ? `Atas nama ${info.email} · ${info.seats} kursi${info.expiry ? ` · jatuh tempo ${fmtDate(info.expiry)}` : ""}${info.bundleId ? ` · bundel ${info.bundleId}` : ""}` : "Belum ada kunci lisensi — berjalan di edisi Gratis."));
    this.keyBox = this.keyBox || h("textarea", { class: "input textarea", rows: 3, placeholder: '{"payload":…,"signature":"…"}', "aria-label": "Kunci lisensi JSON" });
    this.licHost.append(Controls.row("Tempel kunci lisensi", this.keyBox, "Tanda tangan Ed25519 diverifikasi offline."),
      Controls.toolbar([btn("Aktifkan", () => this.activateKey(), "key", "primary"),
        btn("Pakai contoh kode", () => this.demoKey(), "spark", ""),
        info.edition !== "free" ? btn("Lepas lisensi", () => this.deactivate(), "trash", "danger") : null]));
    this.licHost.append(row((info.features.length ? info.features : ["tidak ada fitur berbayar"]).slice(0, 12).map((f) => Controls.chip(f, f === "*" ? "lime" : "cyan"))));
  }
  async activateKey() {
    const c = this.ctx, res = await c.license.activate(this.keyBox.value);
    c.toast[res.ok ? "ok" : "error"](res.detail);
    this.paintLicense();
  }
  async demoKey() {
    const c = this.ctx, key = await c.license.demoKey();
    if (!key) { c.toast.error("Contoh kunci tak terbaca dari docs/lisensi-demo.json."); return; }
    this.keyBox.value = key;
    c.toast.info("Contoh kunci terisi — tekan Aktifkan.");
  }
  async deactivate() {
    const c = this.ctx;
    if (!(await c.modal.confirm("Lepas kunci lisensi?", "Kembali ke edisi Gratis; naskah & data tetap utuh.", { danger: true, okLabel: "Lepas" }))) return;
    c.toast.ok((await c.license.deactivate()).detail);
    this.paintLicense(); this.paintBrand();
  }
  paintBrand() {
    const c = this.ctx, allowed = c.license.can("whiteLabel");
    clear(this.brandHost);
    this.brandHost.append(h("div", { class: "row small" }, [h("strong", { text: c.brand.name }), span("grow", c.brand.tagline),
      Controls.chip(c.brand.accent, "cyan"), Controls.chip(allowed ? "white-label terbuka" : "butuh Pro", allowed ? "lime" : "amber")]));
    if (!allowed) { this.brandHost.append(para("small muted", c.license.reason("whiteLabel")), btn("Buka kunci lisensi", () => this.keyBox?.scrollIntoView?.(), "key")); return; }
    for (const key of ["lanjutan.brandNama", "lanjutan.brandWarna", "lanjutan.brandBantuan"]) {
      const spec = c.settings.field(key);
      this.brandHost.append(c.controls.field(spec, c.settings.get(spec.key), (v) => this.setField(key, v)));
    }
    this.brandHost.append(Controls.toolbar([btn("Terapkan merek sekarang", () => { c.brand.apply(c.root); c.toast.ok(`Merek “${c.brand.name}” dipakai di seluruh antarmuka.`); }, "sliders", "primary"),
      btn("Buka tautan bantuan", () => { window.open(c.brand.help, "_blank", "noopener"); }, "help", "")]));
  }
  paintApps() {
    const c = this.ctx;
    clear(this.appHost);
    for (const key of ["umum.tema", "umum.modeDefault", "umum.lebarSidebar", "umum.animasi", "umum.suara", "umum.volume", "umum.panelAwal"]) {
      const spec = c.settings.field(key);
      this.appHost.append(c.controls.field(spec, c.settings.get(spec.key), (v) => this.setField(key, v)));
    }
    this.appHost.append(Controls.toolbar([btn("Mulai ulang tutorial", () => c.app.restartOnboarding(), "help", "accent"),
      btn("Coba suara", () => { c.sound.ok(); c.toast.info(c.settings.bool("umum.suara") ? "Bunyi capaian diputar." : "Suara masih OFF di pengaturan umum."); }, c.settings.bool("umum.suara") ? "sound" : "mute", ""),
      btn("Buka panduan panel", () => c.help.open("settings"), "help", "")]));
  }
  async paintData() {
    const c = this.ctx, q = c.library.quota(), u = await c.store.usage(), dev = c.settings.bool("lanjutan.developer");
    clear(this.dataHost);
    this.dataHost.append(h("div", { class: "grid grid--2" }, [
      Controls.stat("Kliping", num(c.library.items.length), { tone: "cyan", sub: `${num(c.library.datasets().length)} dataset`, iconName: "clip" }),
      Controls.stat("Pakai pustaka", bytes(q.used), { tone: "violet", sub: `dari kuota ${num(c.settings.num("data.kuotaMb"))} MB`, iconName: "database" }),
      Controls.stat("Kunci penyimpanan", num(u.keys), { tone: "lime", sub: `${bytes(u.bytes)} JSON`, iconName: "lock" }),
      Controls.stat("Duplikat", num(c.library.duplicates().length), { tone: "amber", sub: "siap dipangkas", iconName: "filter" })]),
      Controls.progress(q.ratio, { tone: q.ratio >= q.warnAt ? "red" : "lime", label: `${pct(q.ratio)} kuota terpakai · peringatan di ${pct(q.warnAt)}` }),
      Controls.toolbar([btn("Pangkas duplikat", () => this.dedupe(), "filter", "primary"),
        btn("Ekspor semua data", () => this.exportAllData(), "download", ""),
        btn("Hapus semua data", () => this.wipeAll(), "trash", "danger")]),
      c.controls.field(c.settings.field("lanjutan.developer"), dev, (v) => this.setField("lanjutan.developer", v)),
      this.logHost = stack());
    this.paintLog();
  }
  paintLog() {
    const c = this.ctx;
    clear(this.logHost);
    if (!c.settings.bool("lanjutan.developer")) { this.logHost.append(para("small muted", "Nyalakan mode developer untuk melihat ekor log.")); return; }
    this.logHost.append(Controls.toolbar([h("h5", { class: "grow", text: "Ekor log" }),
      Controls.segmented(LOG_SIZES.map(([v, l]) => ({ value: v, label: l })), this.logSize, (v) => { this.logSize = v; this.paintLog(); }),
      btn("Kosongkan", () => { c.log.clear(); this.paintLog(); c.toast.ok("Log dibersihkan."); }, "trash", "danger")]),
      h("div", { class: "log" }, c.log.tail(this.logSize).map((e) => logLine(LEVEL_TONE[e.level] ?? "warn", `${jam(e.at)} ${e.scope}`, e.args.map(arg).join(" ")))));
  }
  async dedupe() {
    const c = this.ctx, n = await c.pipeline.dedupe();
    c.toast[n ? "ok" : "info"](n ? `${num(n)} duplikat dihapus (salinan lebih lama).` : "Tidak ada duplikat.");
    await this.paintData();
  }
  async exportAllData() {
    const c = this.ctx;
    try {
      const data = await c.store.exportAll({ exclude: ["secrets"] });
      const res = await c.exports.download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), "kalam-data.json");
      c.toast.ok(`Data diunduh (tanpa brankas): ${res.filename} (${bytes(res.bytes || 0)}).`);
    } catch (err) { c.toast.error(`Unduh data gagal: ${err.message}`); }
  }
  async wipeAll() {
    const c = this.ctx;
    if (!(await c.modal.confirm("Hapus SEMUA data Kalam?", "Semua naskah, kliping, target & pengaturan hilang. Unduh cadangan dulu bila perlu.", { danger: true, okLabel: "Lanjut" }))) return;
    if (!(await c.modal.confirm("Yakin hapus permanen?", "Tidak bisa dibatalkan dan tak ada undo.", { danger: true, okLabel: "Hapus sekarang" }))) { c.toast.info("Penghapusan dibatalkan."); return; }
    await c.library.remove(c.library.items.map((i) => i.id));
    for (const k of await c.store.keys()) await c.store.remove(k);
    c.vault.lock();
    c.toast.warn("Semua data dihapus — memuat ulang…", { timeout: 4000 });
    if (typeof location !== "undefined") setTimeout(() => location.reload(), 800);
  }
  destroy() {
    for (const off of this.cleanups.splice(0)) { try { off(); } catch {} }
    this.bound = false;
    this.host = this.body = null;
    this.keyBox = null;
  }
}
