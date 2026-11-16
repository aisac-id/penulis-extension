import { SelectorEngine } from "./SelectorEngine.js";

const pushType = (rec, el) => rec._push({ action: "type", target: SelectorEngine.describe(el), value: el.value, label: `Isi ${el.name || el.id || "kolom"}` });

export class Recorder {
  constructor(bus, { root = document, onStep = null } = {}) {
    this.bus = bus;
    this.root = root;
    this.onStep = onStep;
    this.active = false;
    this.steps = [];
    this._onClick = (e) => this._click(e);
    this._onChange = (e) => this._change(e);
    this._onKey = (e) => this._key(e);
  }

  start() {
    if (this.active) return;
    this.active = true;
    this.steps = [];
    this.root.addEventListener("click", this._onClick, true);
    this.root.addEventListener("change", this._onChange, true);
    this.root.addEventListener("keydown", this._onKey, true);
    this.bus?.emit("rpa.record", { active: true });
  }

  stop() {
    if (!this.active) return this.steps;
    this.active = false;
    this.root.removeEventListener("click", this._onClick, true);
    this.root.removeEventListener("change", this._onChange, true);
    this.root.removeEventListener("keydown", this._onKey, true);
    this.bus?.emit("rpa.record", { active: false, count: this.steps.length });
    return this.steps;
  }

  _push(step) {
    this.steps.push(step);
    this.onStep?.(step, this.steps.length);
    this.bus?.send("rpa.recorded", step, { local: false }).catch(() => {});
    return step;
  }

  _own(el) { return !el?.closest?.("kalam-sidebar, .kalam-root, [data-kalam]"); }

  _click(e) {
    const el = e.target;
    if (!this._own(el)) return;
    const tag = el.tagName;
    if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
    this._push({ action: "click", target: SelectorEngine.describe(el), label: `Klik ${(el.textContent || tag).trim().slice(0, 32)}` });
  }

  _change(e) {
    const el = e.target;
    if (!this._own(el)) return;
    if (el.tagName === "SELECT") { this._push({ action: "select", target: SelectorEngine.describe(el), value: el.value, label: `Pilih ${el.value}` }); return; }
    if (el.type === "checkbox" || el.type === "radio") {
      if (el.checked) this._push({ action: "click", target: SelectorEngine.describe(el), label: "Centang pilihan" });
      return;
    }
    if ("value" in el && el.type !== "password") pushType(this, el);
  }

  _key(e) {
    const el = e.target;
    if (e.key !== "Enter" || !this._own(el) || el.tagName === "TEXTAREA") return;
    if ("value" in el && el.type !== "password") pushType(this, el);
  }

  destroy() { this.stop(); this.steps = []; }
}
