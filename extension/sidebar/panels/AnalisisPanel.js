import { h, clear, num, pct, icon, debounce } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { Chart } from "../ui/Chart.js";
import { ProjectService } from "../../model/ProjectService.js";
import { TextStats } from "../../analysis/TextStats.js";
import { StyleChecker } from "../../analysis/StyleChecker.js";

const stack = (kids = []) => h("div", { class: "stack" }, kids);
const row = (kids = []) => h("div", { class: "row" }, kids);
const para = (cls, text) => h("p", { class: cls, text });
const span = (cls, text) => h("span", { class: cls, text });
const KEYS = ["analisis.kalimatPanjang", "analisis.paragrafPanjang", "analisis.kataUlang", "analisis.targetReadability",
  "analisis.cekPasif", "analisis.cekAdverbia", "analisis.cekKlise", "analisis.cekFilter"];
const TONE = { high: "red", med: "amber", low: "cyan" };
const SEV = { high: "Tinggi", med: "Sedang", low: "Ringan" };

export class AnalisisPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "analisis"; this.title = "Analisis Naskah"; this.icon = "gauge"; this.cleanups = [];
    this.host = this.body = null;
    this.scope = "seluruh"; this.kind = "semua"; this.term = ""; this.bound = false; this.muting = false;
    this.result = { findings: [], kinds: [], consistency: [], setups: [], stats: TextStats.stats(""), score: 0, per1000: 0, tidy: false };
  }
  async render(host) { this.host = host; this.bind(); this.build(); this.run(); return this; }
  bind() {
    if (this.bound) return;
    this.bound = true;
    this.cleanups.push(this.ctx.bus.on("project.changed", () => { if (!this.muting && this.listHost?.isConnected) this.reloadScope(); }));
    this.cleanups.push(this.ctx.bus.on("settings.changed", (p) => {
      if (String(p?.key || "").startsWith("analisis.") && this.statHost?.isConnected) this.run();
    }));
  }
  build() {
    this.body = stack();
    this.host.append(this.body);
    this.statHost = h("div", { class: "grid grid--2" });
    this.chartHost = h("div", { class: "card stack" });
    this.toolbar = stack();
    this.listHost = stack(); this.consHost = stack();
    this.body.append(
      this.statHost, this.chartHost, this.toolbar,
      Controls.fieldset("Temuan gaya", [this.listHost], "Klik temuan untuk melihat kalimat dan saran."),
      Controls.fieldset("Konsistensi cerita", [this.consHost], "Diperiksa dari naskah, bible, dan rencana."),
      this.controlsBlock(),
    );
  }
  refresh() { if (this.statHost?.isConnected) this.run(); }
  scopeChapters() {
    const chs = this.ctx.projects.chapters();
    return this.scope === "seluruh" ? chs : chs.filter((c) => c.id === this.scope);
  }
  scopeText() { return this.scopeChapters().map((c) => ProjectService.chapterText(c)).join("\n\n"); }
  reloadScope() {
    if (this.scope !== "seluruh" && !this.ctx.projects.chapters().some((c) => c.id === this.scope)) this.scope = "seluruh";
    this.run();
  }
  run() {
    const c = this.ctx, text = this.scopeText(), findings = c.style.check(text), scored = c.style.score(text, findings);
    this.result = { findings, score: scored.score, stats: scored.stats, per1000: scored.per1000,
      kinds: c.style.byKind(findings), consistency: c.consistency.run(), setups: c.consistency.setups(),
      tidy: c.style.tidy(text).changed };
    this.paintStats(); this.paintChart(); this.paintList(); this.paintConsistency();
  }
  paintStats() {
    if (!this.statHost?.isConnected) return;
    const c = this.ctx, s = this.result.stats, target = c.settings.num("analisis.targetReadability");
    const high = this.result.findings.filter((f) => f.sev === "high").length;
    clear(this.statHost);
    this.statHost.append(
      Controls.stat("Skor gaya", `${num(this.result.score)}/100`, { tone: this.result.score >= 85 ? "lime" : this.result.score >= 65 ? "amber" : "red", sub: `${num(this.result.per1000)} temuan per 1.000 kata`, iconName: "gauge" }),
      Controls.stat("Temuan", num(this.result.findings.length), { tone: "magenta", sub: `${num(high)} perlu diprioritaskan`, iconName: "filter" }),
      Controls.stat("Jumlah kata", num(s.words), { tone: "cyan", sub: `${num(s.pages)} halaman · ${num(s.minutes)} menit baca`, iconName: "book" }),
      Controls.stat("Kalimat", `${num(s.sentences)} · rerata ${s.avgSentence}`, { tone: "violet", sub: `terpanjang ${num(s.longest)} kata, ambang ${num(c.settings.num("analisis.kalimatPanjang"))}`, iconName: "type" }),
      Controls.stat("Keterbacaan", num(s.readability), { tone: s.readability >= target ? "lime" : "amber", sub: `sasaran ${num(target)} · selisih ${num(s.readability - target)}`, iconName: "spark" }),
      Controls.stat("Dialog", pct(s.dialogue), { tone: "teal", sub: `${num(s.paragraphs)} paragraf, rerata ${num(s.avgParagraph)} kata`, iconName: "users" }),
    );
  }
  paintChart() {
    if (!this.chartHost?.isConnected) return;
    const s = this.result.stats, target = this.ctx.settings.num("analisis.targetReadability");
    const parts = this.result.kinds.map((k) => ({ id: k.kind, label: k.label, value: k.count }));
    if (!parts.length) parts.push({ id: "bersih", label: "Tidak ada temuan", value: 1 });
    clear(this.chartHost);
    this.chartHost.append(row([
      h("div", { style: { flex: "0 0 132px" } }, [Chart.donut(parts, { size: 132, thickness: 18, center: num(this.result.findings.length) })]),
      h("div", { class: "grow stack" }, [
        h("h5", { text: "Sebaran jenis temuan" }),
        Chart.legend(parts.slice(0, 8)),
        Controls.progress(s.readability / Math.max(1, target), { tone: s.readability >= target ? "lime" : "amber", label: `Keterbacaan ${num(s.readability)} dari sasaran ${num(target)}` }),
      ]),
    ]));
  }
  buildScope() {
    if (!this.toolbar?.isConnected) return;
    const c = this.ctx;
    clear(this.toolbar);
    const sel = h("select", { class: "input select", "aria-label": "Cakupan analisis" });
    sel.append(h("option", { value: "seluruh", text: `Seluruh naskah (${c.projects.chapters().length} bab)` }));
    for (const ch of c.projects.chapters()) sel.append(h("option", { value: ch.id, text: `${ch.order}. ${ch.title} · ${num(ProjectService.chapterWords(ch))} kata` }));
    sel.value = this.scope;
    sel.addEventListener("change", () => { this.scope = sel.value; this.run(); });
    const kinds = [{ value: "semua", label: `Semua (${num(this.result.findings.length)})` },
      ...this.result.kinds.map((k) => ({ value: k.kind, label: `${k.label} (${k.count})` }))];
    const search = Controls.search("Cari di temuan…", debounce((v) => { this.term = v; this.paintList(); }, 180), { value: this.term });
    const fix = this.result.tidy
      ? Controls.button("Perbaiki otomatis", () => this.applyTidy(), { small: true, kind: "ok", iconName: "wrench", title: "Rapikan spasi, tipografi, dan kutip" })
      : span("small muted", "Tidak ada perbaikan mekanis di cakupan ini.");
    this.toolbar.append(
      Controls.toolbar([icon("target", 14), sel]),
      Controls.toolbar([icon("filter", 14), Controls.segmented(kinds, this.kind, (v) => { this.kind = v; this.paintList(); })]),
      row([search.box, fix,
        Controls.button("Salin", () => this.copy(), { small: true, iconName: "copy" }),
        Controls.button("JSON", () => this.exportAs("json"), { small: true, iconName: "export" }),
        Controls.button("CSV", () => this.exportAs("csv"), { small: true, iconName: "export" })]),
    );
  }
  filtered() {
    const q = this.term.trim().toLowerCase();
    return this.result.findings.filter((f) => (this.kind === "semua" || f.kind === this.kind) && (!q || `${f.title} ${f.snippet} ${f.advice}`.toLowerCase().includes(q)));
  }
  row(f) {
    return h("div", { class: `finding finding--${f.sev}`, tabindex: "0", role: "button", onclick: () => this.open(f), onkeydown: (e) => { if (e.key === "Enter") this.open(f); } }, [
      h("i", { class: "finding__sev" }),
      h("div", { class: "finding__t" }, [h("strong", { text: f.title }), h("div", { class: "small muted nowrap", text: f.snippet || StyleChecker.LABELS[f.kind] || f.advice })]),
      Controls.chip(SEV[f.sev] || f.sev, TONE[f.sev] || "ink"),
    ]);
  }
  paintList() {
    if (!this.listHost?.isConnected) return;
    this.buildScope();
    const list = this.filtered();
    clear(this.listHost);
    if (!list.length) {
      this.listHost.append(Controls.empty(this.result.findings.length ? "Tidak ada yang cocok" : "Cakupan ini bersih",
        this.result.findings.length ? "Ubah penyaring jenis atau kata kuncinya." : "Tidak ada temuan gaya pada cakupan terpilih."));
      return;
    }
    for (const f of list.slice(0, 200)) this.listHost.append(this.row(f));
    if (list.length > 200) this.listHost.append(para("small muted", `+${num(list.length - 200)} temuan lain — persempit pencarian.`));
  }
  open(f) {
    const c = this.ctx, where = this.scope === "seluruh" ? "seluruh naskah" : "bab terpilih";
    const body = stack([
      f.snippet ? h("p", { class: "quote", text: f.snippet }) : para("small muted", "Temuan ini tidak menunjuk satu kalimat tertentu."),
      h("dl", { class: "kv" }, [
        h("dt", { text: "Jenis" }), h("dd", { text: StyleChecker.LABELS[f.kind] || f.kind }),
        h("dt", { text: "Tingkat" }), h("dd", { text: SEV[f.sev] || f.sev }),
        h("dt", { text: "Posisi" }), h("dd", { text: `karakter ke-${num(f.at)} pada ${where}` }),
        h("dt", { text: "Saran" }), h("dd", { text: f.advice }),
      ]),
      para("small muted", "Ambang ada di blok bawah panel — ubah nilainya untuk menghitung ulang."),
    ]);
    const actions = [Controls.button("Tutup", () => c.drawer.close(), { small: true })];
    if (this.result.tidy) actions.unshift(Controls.button("Perbaiki otomatis", () => { c.drawer.close(); this.applyTidy(); }, { small: true, kind: "ok", iconName: "wrench" }));
    c.drawer.open({ title: StyleChecker.LABELS[f.kind] || "Temuan", subtitle: f.title, body, badge: Controls.chip(SEV[f.sev] || f.sev, TONE[f.sev] || "ink"), actions });
  }
  async applyTidy() {
    const c = this.ctx, before = [];
    for (const ch of this.scopeChapters()) for (const sc of ch.scenes) before.push({ chapterId: ch.id, sceneId: sc.id, text: sc.text });
    this.muting = true;
    let n = 0;
    try {
      for (const rec of before) {
        const t = c.style.tidy(rec.text);
        if (t.changed) { await c.projects.saveScene(rec.chapterId, rec.sceneId, t.text); n++; }
      }
    } catch (err) {
      this.muting = false;
      c.toast.error(err.message);
      return;
    }
    this.muting = false;
    if (!n) { c.toast.info("Tidak ada yang perlu dirapikan."); this.run(); return; }
    this.run();
    c.toast.undo(`Merapikan tipografi ${num(n)} adegan.`, async () => {
      this.muting = true;
      for (const rec of before) await c.projects.saveScene(rec.chapterId, rec.sceneId, rec.text);
      this.muting = false;
      this.run();
    });
  }
  paintConsistency() {
    if (!this.consHost?.isConnected) return;
    const groups = new Map();
    for (const f of this.result.consistency) groups.set(f.kind, [...(groups.get(f.kind) || []), f]);
    clear(this.consHost);
    if (!groups.size && !this.result.setups.length) {
      this.consHost.append(Controls.empty("Tidak ada kejanggalan", "Nama, kronologi, sudut pandang, dan rencana saling cocok."));
      return;
    }
    for (const [kind, list] of groups) {
      this.consHost.append(stack([
        row([h("h5", { class: "grow", text: `Kelompok: ${kind}` }),
          Controls.chip(`${list.length} temuan`, list.some((f) => f.sev === "high") ? "red" : "amber")]),
        ...list.map((f) => this.row(f)),
      ]));
    }
    if (!this.result.setups.length) return;
    this.consHost.append(stack([
      h("h5", { text: "Janji belum dibayar" }),
      row(this.result.setups.map((s) => Controls.chip(`“${s.word}” ${s.count}× di awal`, "violet", s.note))),
      para("small muted", "Disebut di awal lalu tidak muncul lagi."),
    ]));
  }
  async copy() {
    const rows = this.filtered().map((f) => `${SEV[f.sev] || f.sev} · ${f.title} — ${f.snippet}`);
    try {
      await navigator.clipboard.writeText(rows.join("\n") || "Tidak ada temuan.");
      this.ctx.toast.ok(`${num(rows.length)} temuan disalin.`);
    } catch (err) { this.ctx.toast.error(`Salin gagal: ${err.message}`); }
  }
  async exportAs(kind) {
    const c = this.ctx, list = this.filtered();
    const payload = kind === "json"
      ? { cakupan: this.scope, dibuatPada: new Date().toISOString(), skor: this.result.score, statistik: this.result.stats, temuan: list, konsistensi: this.result.consistency, janji: this.result.setups }
      : list.map((f) => ({ jenis: StyleChecker.LABELS[f.kind] || f.kind, tingkat: SEV[f.sev] || f.sev, temuan: f.title, kalimat: f.snippet, posisi: f.at, saran: f.advice }));
    try {
      const blob = await c.exports.build(kind, payload);
      const res = await c.exports.download(blob, `temuan-analisis-${this.scope === "seluruh" ? "naskah" : "bab"}.${kind}`);
      c.toast.ok(`Terunduh: ${res.filename}`, { timeout: 6000 });
    } catch (err) { c.toast.error(err.message); }
  }
  controlsBlock() {
    const c = this.ctx;
    const rows = KEYS.map((key) => {
      const spec = c.settings.field(key);
      return c.controls.field(spec, c.settings.get(key), async (v) => {
        try {
          await c.settings.set(key, v);
          c.toast.ok(`${spec.label} → ${typeof v === "boolean" ? (v ? "diperiksa" : "dilewati") : `${v}${spec.unit ? ` ${spec.unit}` : ""}`}`);
        } catch (err) { c.toast.error(err.message); }
      });
    });
    return Controls.fieldset("Ambang & pemeriksaan", rows, "Tiap perubahan menghitung ulang temuan seketika.");
  }
  destroy() {
    for (const off of this.cleanups.splice(0)) { try { off(); } catch {} }
    this.bound = false;
    this.host = null;
    if (this.body) clear(this.body);
  }
}
