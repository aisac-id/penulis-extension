import { h, icon } from "./Dom.js";

export class Toast {
  constructor(root, settings) {
    this.settings = settings;
    this.host = h("div", { class: "toast-host", role: "status", "aria-live": "polite" });
    root.append(this.host);
    this.items = new Set();
  }

  show(message, { kind = "info", action = null, actionLabel = "Urungkan", timeout = 4200 } = {}) {
    const el = h("div", { class: `toast toast--${kind}` }, [
      icon(kind === "ok" ? "check" : kind === "danger" ? "x" : kind === "warn" ? "help" : "spark", 15),
      h("span", { class: "toast__msg", text: message }),
    ]);
    if (action) {
      el.append(h("button", {
        class: "toast__act", type: "button", text: actionLabel,
        onclick: () => { try { action(); } finally { this._drop(el); } },
      }));
    }
    el.append(h("button", { class: "toast__x", type: "button", "aria-label": "Tutup notifikasi", onclick: () => this._drop(el) }, [icon("x", 13)]));
    this.host.append(el);
    this.items.add(el);
    requestAnimationFrame(() => el.classList.add("is-in"));
    el._t = setTimeout(() => this._drop(el), timeout);
    while (this.items.size > 4) this._drop([...this.items][0]);
    return el;
  }

  ok(m, o) { return this.show(m, { ...o, kind: "ok" }); }
  info(m, o) { return this.show(m, { ...o, kind: "info" }); }
  warn(m, o) { return this.show(m, { ...o, kind: "warn", timeout: 6000 }); }
  error(m, o) { return this.show(m, { ...o, kind: "danger", timeout: 7000 }); }

  undo(message, fn) { return this.show(message, { kind: "warn", action: fn, actionLabel: "Urungkan", timeout: 8000 }); }

  _drop(el) {
    if (!this.items.has(el)) return;
    clearTimeout(el._t);
    this.items.delete(el);
    el.classList.remove("is-in");
    setTimeout(() => el.remove(), 220);
  }

  destroy() {
    for (const el of [...this.items]) this._drop(el);
    this.host.remove();
  }
}
