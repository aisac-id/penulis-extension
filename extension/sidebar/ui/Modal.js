import { h, icon, clear } from "./Dom.js";

export class Modal {
  constructor(root) {
    this.root = root;
    this.scrim = h("div", { class: "modal-scrim", hidden: true });
    this.box = h("div", { class: "modal", role: "dialog", "aria-modal": "true" });
    this.scrim.append(this.box);
    root.append(this.scrim);
    this._key = (e) => { if (e.key === "Escape" && !this.scrim.hidden) { e.stopPropagation(); this.close(); } };
    this.scrim.addEventListener("mousedown", (e) => { if (e.target === this.scrim) this.close(); });
    root.addEventListener?.("keydown", this._key);
    this._resolve = null;
  }

  open({ title, body, actions = [], width = 460, subtitle = "" }) {
    clear(this.box);
    this.box.style.maxWidth = `${width}px`;
    this.box.append(
      h("div", { class: "modal__head" }, [
        h("div", {}, [h("h3", { class: "modal__title", text: title }), subtitle ? h("p", { class: "modal__sub", text: subtitle }) : null]),
        h("button", { class: "icon-btn", type: "button", "aria-label": "Tutup", onclick: () => this.close() }, [icon("x", 15)]),
      ]),
      h("div", { class: "modal__body" }, [body instanceof Node ? body : h("p", { text: String(body) })]),
      h("div", { class: "modal__foot" }, actions.map((a) => h("button", {
        class: `btn ${a.kind ? `btn--${a.kind}` : ""}`, type: "button", text: a.label,
        onclick: async () => { const r = await a.onClick?.(this); if (r !== false && a.keepOpen !== true) this.close(a.value); },
      }))),
    );
    this.scrim.hidden = false;
    requestAnimationFrame(() => this.scrim.classList.add("is-in"));
    setTimeout(() => this.box.querySelector("input,textarea,select,button.btn")?.focus(), 40);
    return new Promise((res) => { this._resolve = res; });
  }

  get isOpen() { return !this.scrim.hidden; }

  close(value = null) {
    this.scrim.classList.remove("is-in");
    setTimeout(() => { this.scrim.hidden = true; }, 180);
    this._resolve?.(value);
    this._resolve = null;
  }

  confirm(title, message, { danger = false, okLabel = "Lanjut" } = {}) {
    return this.open({
      title, body: message, width: 400,
      actions: [{ label: "Batal", value: false }, { label: okLabel, kind: danger ? "danger" : "primary", value: true }],
    });
  }

  prompt(title, { label = "Nilai", value = "", placeholder = "", multiline = false, okLabel = "Simpan" } = {}) {
    const input = multiline
      ? h("textarea", { class: "input textarea", rows: 5, placeholder })
      : h("input", { class: "input", type: "text", placeholder });
    input.value = value;
    const body = h("label", { class: "field" }, [h("span", { class: "field__label", text: label }), input]);
    return this.open({
      title, body, width: 440,
      actions: [{ label: "Batal", value: null }, { label: okLabel, kind: "primary", onClick: () => true, value: "read" }],
    }).then((r) => (r === "read" ? input.value : null));
  }

  pick(title, options, subtitle = "") {
    const list = h("div", { class: "pick-list" });
    for (const o of options) {
      list.append(h("button", { class: "pick", type: "button", onclick: () => this.close(o.value) }, [
        o.icon ? icon(o.icon, 17) : null,
        h("span", { class: "pick__t" }, [h("strong", { text: o.label }), o.desc ? h("small", { text: o.desc }) : null]),
        icon("chev", 14),
      ]));
    }
    return this.open({ title, subtitle, body: list, width: 440, actions: [{ label: "Batal", value: null }] });
  }

  destroy() {
    this.root.removeEventListener?.("keydown", this._key);
    this.scrim.remove();
  }
}
