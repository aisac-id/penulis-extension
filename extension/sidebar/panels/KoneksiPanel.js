import { h, clear, icon, num, pct } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { SecretVault } from "../../core/SecretVault.js";
import { COMMANDS } from "../../connectors/LocalBridge.js";
import { HOST_NAME } from "../../connectors/NativeBridge.js";

const stack = (kids = []) => h("div", { class: "stack" }, kids);
const row = (kids = []) => h("div", { class: "row" }, kids);
const para = (cls, text) => h("p", { class: cls, text });
const span = (cls, text) => h("span", { class: cls, text });
const btn = (label, fn, icon = null, kind = "ghost") => Controls.button(label, fn, { small: true, kind, iconName: icon });
const ib = (name, label, fn, tone = "") => Controls.iconButton(name, label, fn, { tone });
const ENV_NAMES = ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GROQ_API_KEY", "DEEPSEEK_API_KEY", "OPENROUTER_API_KEY", "INGEST_TOKEN", "PAIRING_TOKEN"];
const SECRET_OF = (n) => Object.values(SecretVault.mapEnv({ [n]: "x" }))[0] || n.toLowerCase();
const BRIDGE_ICON = { platform: "send", local: "wrench", native: "book", wikipedia: "globe" };
const WIKI_LANGS = [["id", "Bahasa Indonesia"], ["jv", "Basa Jawa"], ["su", "Basa Sunda"], ["ms", "Melayu"], ["en", "English"]];
const usd = (n) => `$${Number(n || 0).toFixed(3)}`;
const clock = (t) => new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const logLine = (tone, t, m) => h("div", { class: tone ? `log__l log--${tone}` : "log__l" }, [h("span", { class: "log__t", text: t }), h("span", { class: "log__m", text: m })]);
const logBox = (rows) => h("div", { class: "log" }, rows.length ? rows : [logLine("warn", "catat", "belum ada aktivitas tersimpan.")]);

export class KoneksiPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "koneksi"; this.title = "Koneksi"; this.icon = "plug"; this.cleanups = [];
    this.host = this.body = this.modelHost = this.logHost = this.envBox = null;
    this.tests = {}; this.wiki = []; this.wikiTerm = ""; this.prov = "local"; this.bound = false;
  }
  async render(host) {
    this.host = host;
    this.prov = this.ctx.settings.get("koneksi.llmProvider") || "local";
    if (!this.bound) {
      this.bound = true;
      const live = () => { if (this.brHost?.isConnected) { this.paintBridges(); this.paintBanner(); } };
      this.cleanups.push(this.ctx.bus.on("connect.status", live), this.ctx.bus.on("llm.usage", () => { if (this.usageHost?.isConnected) this.paintUsage(); }));
      this.cleanups.push(this.ctx.bus.on("settings.changed", (p) => { if (String(p?.key || "").startsWith("koneksi.") || p?.key === "lanjutan.vaultIdleMenit") live(); }));
    }
    if (!this.body?.isConnected) this.build();
    this.paintBanner(); await this.paintVault(); this.paintLlm(); await this.paintModels(); this.paintUsage(); this.paintBridges(); this.paintCli();
    return this;
  }
  refresh() { if (this.brHost?.isConnected) { this.paintBanner(); this.paintVault(); this.paintLlm(); this.paintUsage(); this.paintBridges(); this.paintCli(); } }
  build() {
    this.bannerHost = stack(); this.vaultHost = stack(); this.llmHost = stack();
    this.usageHost = stack(); this.brHost = stack(); this.cliHost = stack();
    this.body = stack([this.bannerHost,
      Controls.fieldset("Brankas kunci API", [this.vaultHost], "AES-GCM 256 — kunci hanya hidup di perangkat ini."),
      Controls.fieldset("Model & provider", [this.llmHost], "Provider, model, batas biaya, gerbang privasi."),
      Controls.fieldset("Pemakaian hari ini", [this.usageHost], "Angka nyata dari LlmHub, bukan taksiran."),
      Controls.fieldset("Jembatan keluar", [this.brHost], "Semuanya OFF sampai Anda nyalakan sendiri."),
      Controls.fieldset("Perintah CLI whitelist", [this.cliHost], "Argumen dikirim sebagai array, bukan string shell.")]);
    this.host.append(this.body);
  }
  paintBanner() {
    const c = this.ctx, off = c.connections.list().filter((b) => !b.on).map((b) => b.label), msgs = [];
    if (off.length) msgs.push(`Belum tersambung: ${off.join(", ")}.`);
    if (!c.vault.key) msgs.push("Brankas terkunci — kunci API tak terbaca.");
    if (!c.settings.bool("koneksi.llmPrivasi")) msgs.push("Gerbang privasi OFF — tugas AI dikerjakan mesin lokal.");
    clear(this.bannerHost);
    if (!msgs.length) { this.bannerHost.append(h("div", { class: "banner" }, [icon("check", 15), span("banner__t", "Semua jembatan aktif dan brankas terbuka.")])); return; }
    this.bannerHost.append(h("div", { class: "banner banner--warn" }, [icon("plug", 15), span("banner__t", msgs.join(" ")),
      btn("Uji semua", async () => {
        const out = await c.connections.testAll();
        for (const r of out) this.tests[r.id] = { ok: r.ok, detail: r.detail, at: Date.now() };
        c.toast[out.some((r) => r.ok) ? "ok" : "warn"](`${num(out.filter((r) => r.ok).length)} dari ${num(out.length)} jembatan merespons.`);
        this.paintBridges(); this.paintBanner(); this.paintLog();
      }, "wrench", "")]));
  }
  async paintVault() {
    const c = this.ctx, st = await c.vault.status(), names = st.unlocked ? c.vault.names() : [];
    const pass = h("input", { type: "password", class: "input", placeholder: "kosong = kunci perangkat", "aria-label": "Passphrase brankas" });
    const envFile = h("input", { type: "file", accept: ".env,text/plain", class: "input", "aria-label": "Berkas .env" });
    this.envBox = this.envBox || h("textarea", { class: "input textarea", rows: 3, placeholder: "OPENAI_API_KEY=sk-...\nINGEST_TOKEN=...", "aria-label": "Isi .env" });
    envFile.addEventListener("change", async () => { const f = envFile.files?.[0]; if (f) { this.envBox.value = await f.text(); await this.importEnv(this.envBox.value); } });
    clear(this.vaultHost);
    this.vaultHost.append(Controls.toolbar([
      Controls.chip(st.initialized ? (st.mode === "pass" ? "mode passphrase" : "mode kunci perangkat") : "brankas belum dibuat", st.initialized ? "lime" : "amber"),
      Controls.chip(st.unlocked ? `terbuka · ${num(st.count)} kunci` : "terkunci", st.unlocked ? "cyan" : "red"),
      Controls.chip(`kunci otomatis ${num(c.settings.num("lanjutan.vaultIdleMenit"))} menit setelah pakai`, "violet")]),
      Controls.row("Buka brankas", row([pass,
        btn("Buka", () => this.run(async () => { await c.vault.unlock(pass.value || null); return `Brankas terbuka (mode ${c.vault.mode || "device"}).`; }, () => { this.paintVault(); this.paintBridges(); }), "key", "primary"),
        btn("Kunci", () => { c.vault.lock(); this.paintVault(); this.paintBridges(); c.toast.info("Brankas dikunci."); }, "lock", "")]), "Hanya turunan passphrase yang disimpan."),
      names.length ? stack(names.map((n) => h("div", { class: "keyrow" }, [icon("key", 13), h("span", { class: "mono", text: n }),
        h("span", { class: "mono grow", text: c.vault.masked(n) }), ib("trash", `Hapus ${n}`, () => this.removeKey(n), "danger")])))
        : para("small muted", st.unlocked ? "Belum ada kunci tersimpan — impor .env di bawah." : "Buka brankas untuk melihat nama kunci."),
      Controls.row("Berkas .env", envFile, "Dibaca lokal, langsung dienkripsi, tak pernah dikirim ke server."),
      Controls.row("Atau tempel teksnya", this.envBox, "Nama di luar daftar di bawah diabaikan."),
      Controls.button("Impor teks", () => this.importEnv(this.envBox.value), { kind: "primary", iconName: "database" }),
      para("small dim mono", ENV_NAMES.map((n) => `${n}→${SECRET_OF(n)}`).join("  ·  ")));
  }
  async run(job, after) {
    try { this.ctx.toast.ok(await job()); } catch (err) { this.ctx.toast.error(err.message); }
    if (after) await after();
  }
  async removeKey(n) {
    const c = this.ctx;
    if (await c.modal.confirm("Hapus kunci ini?", `${n} hilang permanen — provider diisi ulang sendiri nanti.`)) await this.run(async () => { await c.vault.remove(n); return `${n} dihapus dari brankas.`; }, () => this.paintVault());
  }
  async importEnv(text) {
    await this.run(async () => {
      const got = await this.ctx.vault.importEnv(text);
      return got.length ? `${num(got.length)} kunci disimpan: ${got.join(", ")}` : "Tidak ada kunci yang dikenali dalam teks itu.";
    }, () => this.paintVault());
  }
  tokenRow(name, envName) {
    const c = this.ctx, known = c.vault.key ? c.vault.has(name) : null;
    return h("div", { class: "keyrow" }, [icon("lock", 13), h("span", { class: "mono", text: name }),
      span("grow", known === null ? "brankas terkunci" : known ? `tersimpan (${envName})` : `belum ada (${envName})`),
      btn("Isi", async () => {
        const val = await c.modal.prompt(`Simpan ${name}`, { label: `Nilai untuk ${envName}`, placeholder: "tempel token lalu OK" });
        if (val) await this.run(async () => { await c.vault.set(name, val.trim()); return `${name} tersimpan terenkripsi.`; }, () => this.paintVault());
      }, "pencil", "")]);
  }
  paintLlm() {
    const c = this.ctx, s = c.settings, priv = s.bool("koneksi.llmPrivasi"), main = s.field("koneksi.llmProvider");
    clear(this.llmHost);
    this.llmHost.append(Controls.toolbar([h("h5", { class: "grow", text: "Provider terpasang" }),
      Controls.segmented(c.llm.list().map((p) => ({ value: p.id, label: p.label })), this.prov, (v) => { this.prov = v; this.paintLlm(); this.paintModels(); })]),
      c.controls.field(main, s.get("koneksi.llmProvider"), (v) => this.set("koneksi.llmProvider", v, true)), this.modelHost = stack());
    if (!main.options.some(([v]) => v === this.prov)) this.llmHost.append(para("small muted", `${this.prov} dipakai untuk uji & daftar model di panel ini.`));
    for (const key of ["koneksi.llmBaseUrl", "koneksi.llmTimeoutMs", "koneksi.llmBiayaHarian"]) this.llmHost.append(c.controls.field(s.field(key), s.get(key), (v) => this.set(key, v)));
    this.llmHost.append(c.controls.field(s.field("koneksi.llmAktif"), s.bool("koneksi.llmAktif"), (v) => this.set("koneksi.llmAktif", v, true)),
      c.controls.field(s.field("koneksi.llmPrivasi"), priv, (v) => this.set("koneksi.llmPrivasi", v, true)),
      para("small muted", priv ? "Gerbang privasi ON: naskah boleh ke cloud, biaya dicatat per panggilan."
        : "Gerbang privasi OFF: hanya mesin lokal & Ollama; tidak ada teks keluar perangkat."),
      Controls.toolbar([btn(`Uji ${this.prov}`, () => this.testLlm(this.prov), "wrench", "primary"),
        ...c.llm.list().filter((p) => p.id !== this.prov).map((p) => Controls.button(p.label, () => this.testLlm(p.id), { small: true, kind: "ghost", title: `Butuh kunci ${p.secret}` }))]), this.logHost = h("div", { class: "log" }));
    this.paintLog();
  }
  paintLog() {
    const rows = Object.keys(this.tests).map((id) => logLine(this.tests[id].ok ? "ok" : "err", clock(this.tests[id].at),
      `${id}: ${this.tests[id].detail || (this.tests[id].ok ? "beres" : "gagal")}${this.tests[id].model ? ` · ${this.tests[id].model}` : ""}`));
    this.logHost.replaceChildren(...(rows.length ? rows : [logLine("warn", "uji", "belum ada — tekan tombol Uji.")]));
  }
  async paintModels() {
    if (!this.modelHost?.isConnected) return;
    const c = this.ctx, list = (await c.llm.models(this.prov)) || [], cur = c.settings.get("koneksi.llmModel") || "";
    const opts = [...new Set([cur, ...list].filter(Boolean))].map((m) => [m, m]);
    clear(this.modelHost);
    this.modelHost.append(c.controls.field({ label: "Model", type: "select", options: opts, desc: `${num(opts.length)} model dikenali ${this.prov}.` }, opts[0]?.[0] || "", (v) => this.set("koneksi.llmModel", v)));
  }
  async testLlm(id) {
    const c = this.ctx, r = await c.llm.test(id);
    this.tests[id] = { ...r, at: Date.now() };
    c.toast[r.ok ? "ok" : "warn"](`${id}: ${r.detail || (r.ok ? "merespons" : "tidak merespons")} (${num(r.ms || 0)} ms).`);
    this.paintLog();
  }
  async set(key, value, repaint = false) {
    const c = this.ctx;
    try {
      await c.settings.set(key, value);
      c.toast.ok(`${c.settings.field(key)?.label || key}: ${typeof value === "boolean" ? (value ? "ON" : "OFF") : value}.`);
      if (key === "koneksi.llmProvider") { this.prov = value; if (repaint) this.paintLlm(); await this.paintModels(); }
      if (repaint && key !== "koneksi.llmProvider") this.paintLlm();
      this.paintBanner();
    } catch (err) { c.toast.error(`Nilai ditolak: ${err.message}`); }
  }
  paintUsage() {
    const c = this.ctx, u = c.llm.usage, cap = c.settings.num("koneksi.llmBiayaHarian"), ratio = cap ? Math.min(1, u.cost / cap) : 0;
    clear(this.usageHost);
    this.usageHost.append(h("div", { class: "grid grid--2" }, [
      Controls.stat("Panggilan", num(u.calls), { tone: "cyan", iconName: "spark" }),
      Controls.stat("Biaya hari ini", usd(u.cost), { tone: ratio >= 1 ? "red" : "lime", sub: `batas ${usd(cap)}` }),
      Controls.stat("Token", num(u.tokens), { tone: "violet", sub: `${num(Object.keys(u.byProvider).length)} provider terpakai` }),
      Controls.stat("Sisa anggaran", usd(c.llm.budgetLeft()), { tone: "amber", sub: `tanggal ${u.day}` })]),
      Controls.progress(ratio, { tone: ratio >= 1 ? "red" : "cyan", label: `${pct(ratio)} batas harian terpakai` }),
      logBox(c.llm.history.slice(0, 8).map((it) => logLine("", clock(it.at), `${it.task} · ${it.provider}/${it.model} · ${num(it.chars)} karakter · ${usd(it.cost)}`))));
  }
  paintBridges() {
    if (!this.brHost?.isConnected) return;
    const c = this.ctx;
    clear(this.brHost);
    for (const b of c.connections.list()) {
      const st = c.connections.get(b.id).status();
      const card = h("div", { class: `conn ${st.on ? "is-on" : ""}` }, [h("span", { class: "conn__ico" }, [icon(BRIDGE_ICON[b.id], 16)]),
        h("div", { class: "conn__t" }, [h("strong", { text: b.label }), h("small", { class: "muted", text: this.bridgeLine(b.id, st, this.tests[b.id]) }), h("small", { class: "dim", text: b.needs })]),
        c.controls.toggle(`Nyalakan ${b.label}`, st.on, (v) => this.flip(b.id, v)), btn("Uji", () => this.testBridge(b.id), "wrench", "")]);
      this.brHost.append(stack([card, ...this.bridgeExtra(b.id, st)]));
    }
  }
  bridgeLine(id, st, res) {
    const bits = [st.on ? `status ${st.state || "aktif"}` : "OFF"];
    if (id === "platform") bits.push(`${num(st.queued)} antrean`, `${num(st.sent)} terkirim`, st.paused ? "dijeda" : "siap kirim");
    if (id === "local") bits.push(st.endpoint || "loopback belum disusun");
    if (id === "native") bits.push(st.host);
    if (id === "wikipedia") bits.push(`${this.ctx.connections.wikipedia.origin()} (${this.ctx.connections.wikipedia.lang})`);
    if (st.error) bits.push(`galat: ${st.error}`);
    if (res) bits.push(`uji terakhir ${res.ok ? "berhasil" : "gagal"} — ${res.detail || "-"}`);
    return bits.join(" · ");
  }
  async flip(id, on) {
    const c = this.ctx, r = on ? await c.connections.enable(id) : await c.connections.disable(id);
    if (!r?.ok) c.toast.error(`${c.connections.get(id).label} tetap OFF: ${r?.detail || "alasan tidak diketahui"}`);
    else c.toast.ok(`${c.connections.get(id).label} ${on ? "dinyalakan" : "dimatikan"}.`);
    this.paintBridges(); this.paintBanner();
  }
  async testBridge(id) {
    const c = this.ctx, r = await c.connections.test(id);
    this.tests[id] = { ...r, at: Date.now() };
    c.toast[r.ok ? "ok" : "warn"](`${c.connections.get(id).label}: ${r.detail || (r.ok ? "merespons" : "tidak merespons")}.`);
    this.paintBridges(); this.paintLog();
  }
  bridgeExtra(id, st) {
    const c = this.ctx, s = c.settings, out = [];
    if (id === "platform") out.push(c.controls.field(s.field("koneksi.platformUrl"), s.get("koneksi.platformUrl"), (v) => this.set("koneksi.platformUrl", v)),
      c.controls.field(s.field("koneksi.platformPollDetik"), s.num("koneksi.platformPollDetik"), (v) => this.set("koneksi.platformPollDetik", v)),
      row([btn("Kirim antrean", () => this.run(async () => { const r = await c.connections.platform.flush(); return `${num(r.sent)} terkirim, ${num(r.left)} masih antre${r.paused ? " (dijeda)" : ""}.`; }, () => this.paintBridges()), "send", "primary"),
        st.paused ? btn("Lanjutkan", () => { c.connections.platform.resume(); this.paintBridges(); c.toast.ok("Antrean jalan lagi."); }, "play", "") : null]),
      this.tokenRow("platform.ingest", "INGEST_TOKEN"));
    if (id === "local") out.push(c.controls.field(s.field("koneksi.localPort"), s.num("koneksi.localPort"), (v) => this.set("koneksi.localPort", v)),
      c.controls.field(s.field("koneksi.commandBebas"), s.bool("koneksi.commandBebas"), (v) => this.set("koneksi.commandBebas", v, true)), this.tokenRow("local.pairing", "PAIRING_TOKEN"));
    if (id === "native") {
      out.push(para("small muted", `Nama host: ${HOST_NAME} — pasang manifest aplikasi pendamping dulu.`));
      if (!c.connections.native.available()) out.push(para("small", "Native messaging hanya aktif di mode ekstensi."));
    }
    if (id === "wikipedia") out.push(c.controls.field({ label: "Bahasa Wikipedia", type: "select", options: WIKI_LANGS, desc: "Domain dicari ulang tiap pencarian." },
      c.connections.wikipedia.lang, (v) => { c.connections.wikipedia.lang = v; c.toast.ok(`Wikipedia ${v} dipilih.`); this.paintBridges(); }), this.wikiRow());
    return out;
  }
  wikiRow() {
    const c = this.ctx, term = h("input", { type: "text", class: "input", value: this.wikiTerm, placeholder: "mis. Candi Borobudur", "aria-label": "Kata kunci Wikipedia" });
    const go = () => this.wikiSearch(term.value);
    term.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
    return stack([row([term, btn("Cari", go, "search", "primary")]),
      h("div", { class: "listboard" }, this.wiki.map((r) => h("div", { class: "lrow" }, [icon("globe", 14),
        h("span", { class: "pick__t" }, [h("strong", { text: r.title }), h("small", { class: "muted", text: String(r.snippet || "").slice(0, 90) })]),
        ib("plus", `Simpan ${r.title} ke dataset riset`, () => this.run(async () => {
          const res = await c.pipeline.ingest({ type: "text", title: r.title, text: r.snippet, url: r.url, note: `Wikipedia ${c.connections.wikipedia.lang}`, tags: ["wikipedia"] }, { dataset: "Riset", url: r.url, source: c.connections.wikipedia.origin() });
          return res.duplicate ? `${r.title} sudah ada di dataset Riset.` : `${r.title} masuk dataset Riset.`;
        }, () => this.paintBridges()))])))]);
  }
  async wikiSearch(term) {
    const c = this.ctx;
    this.wikiTerm = term;
    if (!c.settings.bool("koneksi.wikiAktif")) { c.toast.warn("Nyalakan adapter Wikipedia dulu."); return; }
    await this.run(async () => { this.wiki = (await c.connections.wikipedia.search(term, 5)) || []; return `${num(this.wiki.length)} hasil dari ${c.connections.wikipedia.origin()}.`; }, () => this.paintBridges());
  }
  paintCli() {
    if (!this.cliHost?.isConnected) return;
    const c = this.ctx, st = c.connections.local.status();
    clear(this.cliHost);
    this.cliHost.append(para("small muted", `Endpoint ${st.endpoint || "belum disusun"} · ${num(COMMANDS.length)} perintah whitelist · ${st.on ? "CLI tersambung." : "CLI belum tersambung — tombol akan menolak."}`),
      h("div", { class: "grid grid--2" }, COMMANDS.map((cmd) => Controls.button(cmd.label, () => this.run(async () => { const r = await c.connections.local.run(cmd.id, cmd.args); return `${cmd.label}: ${String(r.stdout || r.error || "selesai").slice(0, 120)}`; }, () => this.paintCli()),
        { small: true, kind: st.on ? "accent" : "ghost", iconName: "wrench", title: `argv: ${cmd.args.join(" ") || "(tanpa argumen)"}` }))),
      logBox((c.connections.local.history || []).slice(0, 5).map((it) => logLine(it.ok ? "ok" : "err", clock(it.at), `${it.command}: ${String(it.out || "").slice(0, 90) || "tanpa keluaran"}`))));
  }
  destroy() {
    for (const off of this.cleanups.splice(0)) { try { off(); } catch {} }
    this.bound = false;
    this.host = this.body = null;
    this.wiki = []; this.tests = {};
  }
}
