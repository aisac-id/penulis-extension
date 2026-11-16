import { uid } from "../sidebar/ui/Dom.js";
import { AppError, ERR } from "../core/AppError.js";
import { MSG } from "../core/MessageBus.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class RpaEngine {
  constructor(settings, bus, logger) {
    this.settings = settings;
    this.bus = bus;
    this.log = logger?.child?.("rpa") || logger;
    this.state = "idle";
    this.script = null;
    this.executor = null;
    this.index = 0;
    this.total = 0;
    this.events = [];
    this.results = [];
    this.startedAt = 0;
    this._resume = null;
  }

  emit(kind, detail = {}) {
    const row = { id: uid("ev"), at: Date.now(), kind, state: this.state, index: this.index, ...detail };
    this.events.push(row);
    if (this.events.length > 200) this.events.shift();
    this.bus.emit("rpa.event", row);
    this.bus.send(MSG.RPA_EVENT, row, { local: false }).catch(() => {});
    return row;
  }

  static count(steps = []) {
    return steps.reduce((a, s) => a + 1 + (s.steps ? RpaEngine.count(s.steps) : 0) + (s.else ? RpaEngine.count(s.else) : 0), 0);
  }

  async run(script, executor) {
    if (this.state === "running") throw new AppError(ERR.RPA, "Skrip lain sedang berjalan.");
    this.script = script;
    this.executor = executor;
    this.state = "running";
    this.index = 0;
    this.results = [];
    this.events = [];
    this.total = RpaEngine.count(script.steps || []);
    this.startedAt = Date.now();
    this.emit("start", { title: script.name, total: this.total });
    try {
      const block = executor.blocked ? await executor.blocked() : null;
      if (block) {
        this.state = "paused";
        this.emit("blocked", { text: block });
        await this._waitResume();
      }
      await this._seq(script.steps || []);
      if (this.state === "stopped") this.emit("stop", { text: "Dihentikan pengguna." });
      else { this.state = "done"; this.emit("done", { ms: Date.now() - this.startedAt, count: this.results.length }); }
    } catch (err) {
      this.state = "error";
      this.emit("error", { text: err.message });
      throw AppError.wrap(err, ERR.RPA);
    }
    return { state: this.state, results: this.results, ms: Date.now() - this.startedAt, vars: executor.vars?.() || {} };
  }

  async _seq(steps) {
    for (const step of steps) {
      await this._gate();
      if (this.state === "stopped") return;
      if (step.action === "loop") {
        const times = Math.max(1, Math.min(200, Number(step.times) || 1));
        for (let i = 0; i < times; i++) {
          this.emit("loop", { text: `Putaran ${i + 1}/${times}`, as: step.as });
          await this._seq(step.steps || []);
          if (this.state === "stopped") return;
        }
        continue;
      }
      if (step.action === "if") {
        const ok = await this.executor.test(step.cond || {});
        this.emit("branch", { text: `Kondisi ${ok ? "terpenuhi" : "tidak terpenuhi"}` });
        await this._seq((ok ? step.steps : step.else) || []);
        continue;
      }
      await this._step(step);
    }
  }

  async _step(step) {
    const retries = Math.max(0, this.settings.num("rpa.retry"));
    const timeout = Number(step.timeout) || this.settings.num("rpa.timeoutMs");
    let lastErr = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      await this._gate();
      if (this.state === "stopped") return;
      this.index++;
      this.emit("step", { text: step.label || step.action, action: step.action, attempt: attempt + 1 });
      try {
        const res = await Promise.race([
          this.executor.run(step),
          sleep(timeout).then(() => { throw new AppError(ERR.RPA, `Timeout ${timeout} ms pada "${step.action}".`); }),
        ]);
        if (res?.ok === false) throw new AppError(ERR.RPA, res.error || "Aksi gagal.");
        this.results.push({ step: step.label || step.action, ...res });
        this.emit("ok", { text: this._brief(res), action: step.action });
        if (res?.navigated) { this.emit("navigate", { text: "Halaman berpindah; skrip berhenti." }); this.state = "stopped"; return; }
        await sleep(this._delay());
        return;
      } catch (err) {
        lastErr = err;
        this.emit("retry", { text: `${err.message} (percobaan ${attempt + 1}/${retries + 1})`, level: "warn" });
        await sleep(400 + attempt * 350);
      }
    }
    if (step.optional) { this.emit("skip", { text: `Dilewati (opsional): ${lastErr.message}`, level: "warn" }); return; }
    throw lastErr;
  }

  _brief(res) {
    if (Array.isArray(res?.data)) return `${res.data.length} nilai diambil`;
    return String(res?.data ?? "selesai").slice(0, 90);
  }

  _delay() { return Math.round(this.settings.num("rpa.jedaMs") * (0.75 + Math.random() * 0.6)); }

  async _gate() { if (this.state === "paused") await this._waitResume(); }
  _waitResume() { return new Promise((res) => { this._resume = res; }); }

  pause() {
    if (this.state !== "running") return false;
    this.state = "paused";
    this.emit("pause", { text: "Dijeda." });
    return true;
  }

  resume() {
    if (this.state !== "paused") return false;
    this.state = "running";
    this.emit("resume", { text: "Dilanjutkan." });
    const r = this._resume;
    this._resume = null;
    r?.();
    return true;
  }

  stop() {
    if (["idle", "done", "error"].includes(this.state)) return false;
    this.state = "stopped";
    const r = this._resume;
    this._resume = null;
    r?.();
    this.emit("stop", { text: "Dihentikan." });
    return true;
  }

  progress() { return { state: this.state, index: this.index, total: this.total, ratio: this.total ? this.index / this.total : 0 }; }
  destroy() { this.stop(); this.executor?.destroy?.(); this.executor = null; }
}
