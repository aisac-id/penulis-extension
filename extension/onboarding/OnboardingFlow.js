import { h, clear } from "../sidebar/ui/Dom.js";
import { CoachMark } from "./CoachMark.js";
import { StepBodies } from "./StepBodies.js";
import { TOUR } from "./TourSteps.js";
import { MSG } from "../core/MessageBus.js";

const TOTAL = 12;

export class OnboardingFlow {
  constructor(ctx, store, bus) {
    this.ctx = ctx;
    this.store = store;
    this.bus = bus;
    this.state = { step: 1, started: false, finished: false, skipped: [], done: {} };
    this.host = null;
    this.coach = new CoachMark(ctx.root);
    this.bodies = new StepBodies(ctx, this);
    this.cleanups = [];
    this.busy = false;
  }

  async load() {
    const saved = await this.store.get("onboarding", null);
    if (saved) this.state = { ...this.state, ...saved, done: { ...saved.done } };
    return this.state;
  }

  async save() {
    await this.store.set("onboarding", this.state);
    this.bus.send(MSG.ONBOARDING, { step: this.state.step, finished: this.state.finished }, { local: false }).catch(() => {});
  }

  get shouldShow() { return !this.state.finished; }

  onLeave(fn) { if (typeof fn === "function") this.cleanups.push(fn); }

  _cleanup() {
    for (const fn of this.cleanups.splice(0)) { try { fn(); } catch { /* sudah dilepas */ } }
  }

  async mark(key, value = true) {
    this.state.done[key] = !!value;
    await this.save();
  }

  async start(host) {
    this.host = host;
    this.state.started = true;
    await this.save();
    this.repaint();
  }

  async next() {
    if (this.state.step >= TOTAL) return this.finish();
    this._cleanup();
    this.state.step++;
    await this.save();
    this.repaint();
    return true;
  }

  async back() {
    if (this.state.step <= 1) return false;
    this._cleanup();
    this.state.step--;
    await this.save();
    this.repaint();
    return true;
  }

  async skip() {
    if (!this.state.skipped.includes(this.state.step)) this.state.skipped.push(this.state.step);
    return this.next();
  }

  async finish() {
    this._cleanup();
    this.coach.close();
    this.state.finished = true;
    await this.save();
    if (this.host) { clear(this.host); this.host.hidden = true; }
    this.ctx.toast.ok("Tutorial selesai. Selamat menulis!");
    this.ctx.sound.ok();
    this.bus.emit("onboarding.done", this.state);
    this.ctx.onOnboardingDone?.();
    return true;
  }

  async restart(host = this.host) {
    this.state = { step: 1, started: true, finished: false, skipped: [], done: {} };
    await this.save();
    if (host) this.host = host;
    if (this.host) this.host.hidden = false;
    this.repaint();
  }

  /** Tur coach-mark 4a–4f pada elemen asli. */
  runTour() {
    return new Promise((resolve) => {
      let i = 0;
      const step = () => {
        if (i >= TOUR.length) { this.mark("tur", true); resolve(true); return; }
        const t = TOUR[i];
        this.coach.show({
          ...t, index: i + 1, total: TOUR.length,
          nextLabel: i === TOUR.length - 1 ? "Selesai tur" : "Berikutnya",
          onNext: () => { i++; step(); },
          onSkip: () => { this.mark("tur", false); resolve(false); },
        });
      };
      step();
    });
  }

  repaint() {
    if (!this.host) return;
    if (this.state.finished) { clear(this.host); return; }
    const n = this.state.step;
    const body = this.bodies.build(n);
    const done = body.done?.() || this.state.done[["", "", "", "tur", "", "demo", "detail", "ekspor", "llm", "koneksi", "rpa", ""][n]];
    const pips = h("div", { class: "onb__steps", role: "progressbar", "aria-valuemin": 1, "aria-valuemax": TOTAL, "aria-valuenow": n },
      Array.from({ length: TOTAL }, (_, i) => h("span", {
        class: `onb__pip ${i + 1 < n ? "is-done" : ""} ${i + 1 === n ? "is-now" : ""}`,
        title: `Langkah ${i + 1}`,
      })));
    const primary = h("button", {
      class: "btn btn--primary", text: body.primary,
      onclick: async () => {
        if (this.busy) return;
        this.busy = true;
        primary.disabled = true;
        try {
          const ok = await body.run();
          if (ok !== false) await this.next();
        } catch (err) {
          this.ctx.toast.error(err.message || "Langkah gagal.");
        } finally {
          this.busy = false;
          if (this.host) this.repaint();
        }
      },
    });
    clear(this.host);
    this.host.append(h("section", { class: "onb", "aria-label": `Tutorial langkah ${n} dari ${TOTAL}` }, [
      h("header", { class: "onb__top" }, [
        h("span", { class: "onb__count", text: `${n}/${TOTAL}` }),
        pips,
        h("button", { class: "icon-btn", text: "×", "aria-label": "Tutup tutorial, lanjut nanti", title: "Lanjut nanti", onclick: () => this.ctx.closeOnboarding?.() }),
      ]),
      h("div", { class: "onb__body" }, [
        h("h3", { class: "onb__title", text: body.title }),
        h("p", { class: "onb__lead", text: body.text }),
        body.node,
        done ? h("div", { class: "chip chip--lime", text: "Langkah ini sudah beres" }) : null,
      ].filter(Boolean)),
      h("footer", { class: "onb__foot" }, [
        h("button", { class: "btn btn--ghost btn--sm", text: "Kembali", disabled: n === 1, onclick: () => this.back() }),
        h("button", { class: "btn btn--ghost btn--sm", text: "Lewati", onclick: () => this.skip() }),
        primary,
      ]),
    ]));
  }

  destroy() {
    this._cleanup();
    this.coach.destroy();
    if (this.host) { clear(this.host); this.host.remove(); this.host = null; }
  }
}