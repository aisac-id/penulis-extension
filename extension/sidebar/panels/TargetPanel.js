import { h, clear, num, pct, icon, fmtDate, fmtTime } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { Chart } from "../ui/Chart.js";

const SVGNS = "http://www.w3.org/2000/svg";
const svgEl = (tag, attrs, kids = []) => {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of kids) el.append(c);
  return el;
};

/** TargetPanel — ritme menulis: target harian, runtutan, sprint nyata, proyeksi selesai. */
export class TargetPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "target";
    this.title = "Target & Ritme";
    this.icon = "target";
    this.cleanups = [];
    this.host = null;
    this.span = 14;
    this.bound = false;
    this.timer = null;
    this.sessions = [];
  }

  async render(host) {
    this.host = host;
    this.bind();
    this.sessions = await this.ctx.goals.sessions();
    this.paint();
    return this;
  }

  /** Langganan dibuat sekali per instansi; render() dipanggil ulang tiap panel dibuka. */
  bind() {
    if (this.bound) return;
    this.bound = true;
    for (const ev of ["sprint.tick", "sprint.changed", "sprint.done", "activity.changed", "settings.changed"]) {
      this.cleanups.push(this.ctx.bus.on(ev, (p) => this.onEvent(ev, p)));
    }
  }

  onEvent(ev, payload) {
    if (ev === "sprint.done") {
      const kind = payload?.kind || "run";
      const words = payload?.words || 0;
      if (kind === "run" && words > 0) {
        this.ctx.goals.logSession(words, this.ctx.settings.num("menulis.sprintMenit"))
          .then((list) => { this.sessions = list; this.paintSessions(); });
      }
      this.ctx.toast.ok(kind === "run" ? `Sprint selesai — ${num(words)} kata.` : "Rehat selesai. Lanjut lagi?");
      this.paintStats();
      return;
    }
    if (ev === "settings.changed") {
      const key = payload?.key;
      if (key && key.startsWith("menulis.")) this.armReminder();
    }
    this.paintSprint();
    if (ev !== "sprint.tick") this.paintStats();
  }

  paint() {
    const body = h("div", { class: "stack" });
    this.host.append(body);
    this.body = body;
    this.statHost = h("div", { class: "grid grid--2" });
    this.pressHost = h("div", { class: "stack" });
    this.chartHost = h("div", { class: "card stack" });
    this.heatHost = h("div", { class: "card stack" });
    this.sprintHost = h("div", { class: "card sprint" });
    this.sessionHost = h("div", { class: "stack" });
    body.append(
      this.statHost, this.pressHost, this.sprintHost,
      Controls.fieldset("Ritme menulis", [this.chartHost, this.viewsRow()], "Batang bergaris putih = hari ini."),
      Controls.fieldset("Kalender aktivitas", [this.heatHost]),
      Controls.fieldset("Catat manual & riwayat sprint", [this.logRow(), this.sessionHost]),
      this.controlsBlock(),
    );
    this.paintStats();
    this.paintSprint();
    this.paintSessions();
    this.armReminder();
  }

  refresh() { this.paintStats(); }

  /* ---------- statistik & tekanan tenggat ---------- */
  paintStats() {
    if (!this.statHost?.isConnected) return;
    const c = this.ctx;
    const g = c.goals;
    const p = c.projects.progress();
    const hit = g.todayWords() >= g.goal;
    const proj = g.projection(p.remaining);
    const press = g.deadlinePressure(c.projects.active?.deadline || "", p.remaining);
    clear(this.statHost);
    this.statHost.append(
      Controls.stat("Kata hari ini", `${num(g.todayWords())} / ${num(g.goal)}`, { tone: hit ? "lime" : "cyan", sub: hit ? "Target tercapai" : `Kurang ${num(g.goal - g.todayWords())} kata`, iconName: "quill" }),
      Controls.stat("Runtutan", `${num(g.streak())} hari`, { tone: "amber", sub: `Ambang ${num(c.settings.num("menulis.streakMinimal"))} kata/hari`, iconName: "flame" }),
      Controls.stat("Rata-rata 7 hari", num(g.average(7)), { tone: "violet", sub: `Target tercapai ${pct(g.hitRate(7))} hari`, iconName: "gauge" }),
      Controls.stat("Total naskah", num(p.words), { tone: "blue", sub: `${pct(p.ratio)} dari ${num(p.target)} kata`, iconName: "book" }),
      Controls.stat("Sisa kata", num(p.remaining), { tone: "magenta", sub: `${p.chapters - p.done} bab belum selesai`, iconName: "target" }),
      Controls.stat("Perkiraan selesai", proj.date ? fmtDate(proj.date) : "butuh data", { tone: "teal", sub: proj.date ? `${num(proj.days)} hari · ${num(proj.avg)} kata/hari` : "Catat kata minimal sehari", iconName: "clock" }),
    );
    clear(this.pressHost);
    if (!press) {
      this.pressHost.append(h("div", { class: "banner" }, [icon("clock", 15),
        h("span", { class: "banner__t", text: "Proyek ini belum punya tenggat. Isi tenggat supaya tekanan harian bisa dihitung." }),
        Controls.button("Buka Naskah", () => c.openPanel("naskah"), { small: true })]));
      return;
    }
    const tight = press.days <= c.settings.num("menulis.hariTenggat");
    this.pressHost.append(h("div", { class: `banner ${tight ? "banner--warn" : ""}` }, [
      icon(tight ? "flame" : "clock", 15),
      h("span", { class: "banner__t", text: `Tenggat ${fmtDate(c.projects.active.deadline)} — ${num(press.days)} hari lagi, butuh ${num(press.need)} kata/hari.` }),
      Controls.chip(press.ok ? "masih realistis" : "di atas rata-rata", press.ok ? "ok" : "red"),
    ]));
  }

  paintCharts() {
    if (!this.chartHost?.isConnected) return;
    const c = this.ctx;
    const days = c.goals.series(this.span);
    const hitWords = days.filter((d) => d.words >= c.goals.goal).reduce((a, d) => a + d.words, 0);
    const all = days.reduce((a, d) => a + d.words, 0);
    clear(this.chartHost);
    this.chartHost.append(
      Controls.toolbar([
        h("h5", { class: "grow", text: `Kata harian · ${days.length} hari` }),
        Controls.segmented([{ value: 14, label: "14 hari" }, { value: 30, label: "30 hari" }, { value: 60, label: "60 hari" }], this.span, (v) => { this.span = v; this.paintCharts(); }),
      ]),
      Chart.bars(days, { goal: c.goals.goal }),
      Chart.legend([{ label: "Tercapai", value: hitWords }, { label: "Di bawah target", value: all - hitWords }, { label: "Rata-rata/hari", value: c.goals.average(this.span) }]),
    );
    const weeks = c.goals.series(56);
    clear(this.heatHost);
    this.heatHost.append(Chart.heat(weeks));
    this.heatHost.append(h("p", { class: "small muted", text: `Delapan minggu terakhir: ${weeks.filter((d) => d.words > 0).length} hari menulis, ${num(all)} kata pada rentang aktif.` }));
  }

  /* ---------- mesin sprint ---------- */
  paintSprint() {
    if (!this.sprintHost?.isConnected) return;
    const c = this.ctx;
    const s = c.goals.sprint;
    const done = s.state === "idle" ? 0 : 1 - s.left / (s.total || 1);
    const rad = 46;
    const circ = 2 * Math.PI * rad;
    const rest = s.state === "rest";
    const ring = svgEl("svg", { viewBox: "0 0 108 108", width: 108, height: 108, "aria-hidden": "true" }, [
      svgEl("circle", { cx: 54, cy: 54, r: rad, fill: "none", stroke: "var(--surface-3)", "stroke-width": 9 }),
      svgEl("circle", { cx: 54, cy: 54, r: rad, fill: "none", "stroke-width": 9, "stroke-linecap": "round", stroke: rest ? "var(--c-cyan)" : "var(--brand-accent)", "stroke-dasharray": String(circ), "stroke-dashoffset": String(circ * (1 - done)) }),
    ]);
    const label = { run: "Sprint berjalan", rest: "Rehat berjalan", pause: "Dijeda", idle: "Siap sprint" }[s.state];
    this.sprintHost.className = `card sprint ${s.state === "run" ? "is-run" : rest ? "is-rest" : ""}`;
    clear(this.sprintHost);
    this.sprintHost.append(
      h("div", { class: "sprint__ring" }, [ring, h("div", {}, [
        h("div", { class: "sprint__time", text: fmtTime(s.state === "idle" ? c.settings.num("menulis.sprintMenit") * 60000 : s.left) }),
        h("div", { class: "sprint__label", text: label }),
      ])]),
      h("div", { class: "sprint__side" }, [
        Controls.toolbar([
          Controls.button(s.state === "idle" ? "Mulai sprint" : "Lanjut", () => this.start("run"), { kind: "accent", iconName: "play" }),
          Controls.button("Rehat", () => this.start("rest"), { iconName: "clock", title: `Rehat ${c.settings.num("menulis.rehatMenit")} menit` }),
          Controls.iconButton("pause", "Jeda atau lanjutkan", () => { c.goals.pauseSprint(); this.paintSprint(); }, { active: s.state === "pause" }),
          Controls.iconButton("stop", "Hentikan sprint", () => { c.goals.stopSprint(); this.paintSprint(); }),
        ]),
        Controls.progress(done, { tone: rest ? "cyan" : "lime", label: `${num(s.words)} kata pada sesi ini` }),
        h("p", { class: "small muted", text: `Sprint ${c.settings.num("menulis.sprintMenit")} menit, rehat ${c.settings.num("menulis.rehatMenit")} menit. Kata yang ditulis selama sprint dihitung terpisah.` }),
      ]),
    );
    this.paintCharts();
  }

  start(kind) {
    const c = this.ctx;
    if (kind === "run" && c.goals.sprint.state === "pause") { c.goals.pauseSprint(); this.paintSprint(); return; }
    c.goals.startSprint(null, kind);
    c.toast.info(kind === "run" ? "Sprint dimulai — tulis saja, hitungannya jalan." : "Rehat dimulai, tinggalkan layar sebentar.");
  }

  /* ---------- catat manual, tampilan tersimpan, riwayat ---------- */
  logRow() {
    const c = this.ctx;
    const target = c.settings.num("menulis.targetHarian");
    return c.controls.field(
      { label: "Catat kata hari ini", type: "number", min: 0, max: target * 8, step: Math.max(10, Math.round(target / 20)), unit: "kata", desc: "Dipakai bila Anda menulis di luar " + c.brand.name + "." },
      c.goals.todayWords(),
      async (v) => {
        const n = await c.goals.setToday(v);
        c.toast.ok(`Hari ini tercatat ${num(n)} kata.`);
        this.paintStats();
      },
    );
  }

  viewsRow() {
    const c = this.ctx;
    const wrap = h("div", { class: "row" });
    const paint = () => {
      clear(wrap);
      wrap.append(Controls.button("Simpan rentang", async () => {
        const name = await c.modal.prompt("Simpan tampilan target", { label: "Nama tampilan", value: `${this.span} hari` });
        if (!name) return;
        await c.views.add("target", name, { span: this.span });
        c.toast.ok(`Tampilan "${name}" disimpan.`);
        paint();
      }, { small: true, iconName: "plus" }));
      for (const v of c.views.for("target")) {
        wrap.append(h("div", { class: "saved-view" }, [
          Controls.chip(`${v.name} · ${v.state?.span || 14}h`, "cyan", `Dibuat ${fmtDate(v.createdAt)}`),
          Controls.iconButton("chev", `Pakai ${v.name}`, async () => {
            const got = await c.views.restore(v.id);
            this.span = got?.state?.span || this.span;
            this.paintCharts();
            c.toast.ok(`Tampilan "${got?.name}" dipakai.`);
            paint();
          }),
          Controls.iconButton("trash", `Hapus ${v.name}`, async () => {
            const gone = await c.views.remove(v.id);
            c.toast.undo(`Tampilan "${gone?.name}" dihapus.`, async () => { await c.views.add("target", gone.name, gone.state); paint(); });
            paint();
          }, { tone: "danger" }),
        ]));
      }
    };
    paint();
    return wrap;
  }

  paintSessions() {
    if (!this.sessionHost?.isConnected) return;
    clear(this.sessionHost);
    const list = this.sessions.slice(-8).reverse();
    if (!list.length) {
      this.sessionHost.append(Controls.empty("Belum ada sprint tercatat", "Jalankan satu sprint sampai selesai; hasilnya masuk ke sini."));
      return;
    }
    this.sessionHost.append(h("div", { class: "timeline" }, list.map((s) => h("div", { class: "tl" }, [
      h("div", { class: "tl__when", text: `${fmtDate(s.at)} · ${num(s.minutes)} menit` }),
      h("div", { class: "tl__what", text: `${num(s.words)} kata` }),
      h("div", { class: "tl__where", text: `${num(s.words / Math.max(1, s.minutes))} kata per menit` }),
    ]))));
  }

  /* ---------- wilayah kontrol: selalu terlihat ---------- */
  controlsBlock() {
    const c = this.ctx;
    const rows = [
      "menulis.targetHarian", "menulis.targetBuku", "menulis.sprintMenit", "menulis.rehatMenit",
      "menulis.streakMinimal", "menulis.pengingat", "menulis.pengingatMenit", "menulis.hariTenggat", "umum.suara",
    ].map((key) => {
      const spec = c.settings.field(key);
      return c.controls.field(spec, c.settings.get(key), async (v) => {
        try {
          await c.settings.set(key, v);
          const shown = typeof v === "boolean" ? (v ? "aktif" : "nonaktif") : `${v}${spec.unit ? ` ${spec.unit}` : ""}`;
          c.toast.ok(`${spec.label} → ${shown}`);
          this.armReminder();
        } catch (err) {
          c.toast.error(err.message);
        }
      });
    });
    rows.push(Controls.button("Coba pengingat sekarang", () => this.nudge(true), { small: true, iconName: "sound" }));
    return Controls.fieldset("Atur target & ritme", rows, "Setiap perubahan langsung berlaku, tanpa tombol simpan.");
  }

  armReminder() {
    clearTimeout(this.timer);
    if (!this.ctx.settings.bool("menulis.pengingat")) return;
    const mins = this.ctx.settings.num("menulis.pengingatMenit");
    this.timer = setTimeout(() => { this.nudge(false); this.armReminder(); }, mins * 60000);
  }

  nudge(force) {
    const c = this.ctx;
    const left = c.goals.goal - c.goals.todayWords();
    if (!force && left <= 0) return;
    c.sound.warn();
    c.toast.info(force
      ? `Uji pengingat: sisa ${num(Math.max(0, left))} kata lagi untuk menutup target hari ini.`
      : `Pengingat menulis — sisa ${num(left)} kata hari ini.`, { timeout: 9000 });
  }

  suspend() { clearTimeout(this.timer); this.timer = null; }

  destroy() {
    clearTimeout(this.timer);
    for (const off of this.cleanups.splice(0)) { try { off(); } catch { /* sudah dilepas */ } }
    this.bound = false;
    this.host = null;
    if (this.body) clear(this.body);
  }
}
