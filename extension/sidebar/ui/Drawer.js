import { h, icon, clear } from "./Dom.js";

export class Drawer {
  constructor(root) {
    this.root = root;
    this.scrim = h("div", { class: "drawer-scrim", hidden: true });
    this.el = h("aside", { class: "drawer", role: "dialog", "aria-modal": "false" });
    this.scrim.addEventListener("mousedown", (e) => { if (e.target === this.scrim) this.close(); });
    root.append(this.scrim, this.el);
    this._key = (e) => { if (e.key === "Escape" && this.el.classList.contains("is-open")) this.close(); };
    root.addEventListener?.("keydown", this._key);
    this.onClose = null;
  }

  open({ title, subtitle = "", body, actions = [], badge = null }) {
    clear(this.el);
    this.el.append(
      h("header", { class: "drawer__head" }, [
        h("div", { class: "drawer__titles" }, [h("h3", { text: title }), subtitle ? h("p", { class: "muted", text: subtitle }) : null]),
        badge,
        h("button", { class: "icon-btn", type: "button", "aria-label": "Tutup detail", onclick: () => this.close() }, [icon("x", 16)]),
      ]),
      h("div", { class: "drawer__body" }, [body]),
      actions.length ? h("footer", { class: "drawer__foot" }, actions) : null,
    );
    this.scrim.hidden = false;
    requestAnimationFrame(() => { this.el.classList.add("is-open"); this.scrim.classList.add("is-in"); });
    return this.el;
  }

  close() {
    this.el.classList.remove("is-open");
    this.scrim.classList.remove("is-in");
    setTimeout(() => { this.scrim.hidden = true; }, 200);
    this.onClose?.();
  }

  get isOpen() { return this.el.classList.contains("is-open"); }

  destroy() {
    this.root.removeEventListener?.("keydown", this._key);
    this.el.remove();
    this.scrim.remove();
  }
}
