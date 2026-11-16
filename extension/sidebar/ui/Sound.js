import { h, icon } from "./Dom.js";

export class Sound {
  constructor(settings) {
    this.settings = settings;
    this.ctx = null;
    this.master = null;
    this.lastKey = 0;
    this.enabled = settings.bool("umum.suara");
    this._off = settings.onChange((key) => { if (key === "umum.suara") this.enabled = settings.bool("umum.suara"); });
  }

  _ensure() {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    this.master.gain.value = (this.settings.num("umum.volume") / 100) * 0.5;
    return this.ctx;
  }

  _tone({ freq = 440, dur = 0.08, type = "triangle", gain = 0.3, slide = 0, delay = 0 }) {
    const ctx = this._ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  _noise(dur = 0.045, gain = 0.22) {
    const ctx = this._ensure();
    if (!ctx) return;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800 + Math.random() * 900;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
  }

  key(char = "") {
    if (!this.settings.bool("umum.suaraKetik")) return;
    const now = Date.now();
    if (now - this.lastKey < 45) return;
    this.lastKey = now;
    if (char === "\n") { this._tone({ freq: 1180, dur: 0.07, gain: 0.18, type: "square" }); return; }
    this._noise(0.03, 0.16);
  }

  click() { this._tone({ freq: 620, dur: 0.05, gain: 0.12, type: "sine" }); }
  ok() { this._tone({ freq: 660, dur: 0.09, gain: 0.2 }); this._tone({ freq: 990, dur: 0.12, gain: 0.16, delay: 0.08 }); }
  goal() { [523, 659, 784, 1047].forEach((f, i) => this._tone({ freq: f, dur: 0.18, gain: 0.2, delay: i * 0.09, type: "triangle" })); }
  sprintStart() { this._tone({ freq: 300, dur: 0.3, gain: 0.2, slide: 420, type: "sawtooth" }); }
  sprintEnd() { [880, 660, 440].forEach((f, i) => this._tone({ freq: f, dur: 0.25, gain: 0.22, delay: i * 0.13 })); }
  warn() { this._tone({ freq: 240, dur: 0.18, gain: 0.16, type: "square" }); }

  toggle() {
    const next = !this.settings.bool("umum.suara");
    this.settings.set("umum.suara", next);
    this.enabled = next;
    if (next) this.ok();
    return next;
  }

  button() {
    const paint = (btn) => {
      const on = this.settings.bool("umum.suara");
      btn.replaceChildren(icon(on ? "sound" : "mute", 16));
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-label", on ? "Suara aktif — klik untuk bisukan" : "Suara bisu — klik untuk aktifkan");
      btn.title = btn.getAttribute("aria-label");
      btn.dataset.state = on ? "on" : "off";
    };
    const btn = h("button", { class: "icon-btn sound-btn", type: "button" });
    paint(btn);
    btn.addEventListener("click", () => { this.toggle(); paint(btn); });
    this._unsub = this.settings.onChange((k) => { if (k === "umum.suara") paint(btn); });
    return btn;
  }

  destroy() {
    this._off?.();
    this._unsub?.();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
