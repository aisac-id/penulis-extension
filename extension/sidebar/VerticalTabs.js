import { h, icon, clear } from "./ui/Dom.js";

export class VerticalTabs {
  constructor(root, { onPick, onHelp }) {
    this.root = root;
    this.onPick = onPick;
    this.onHelp = onHelp;
    this.el = h("nav", { class: "rail", role: "tablist", "aria-label": "Ruang kerja penulis", "aria-orientation": "vertical" });
    this.buttons = new Map();
    this.active = null;
    this.badges = new Map();
  }

  setPanels(panels) {
    clear(this.el);
    this.buttons.clear();
    const bottom = h("div", { class: "rail__group rail__group--bottom" });
    const main = h("div", { class: "rail__group" });
    for (const p of panels) {
      const b = h("button", {
        class: "rail__b", type: "button", role: "tab", "aria-selected": "false",
        "aria-label": p.title, title: p.title, dataset: { panel: p.id },
        onclick: () => this.onPick(p.id),
      }, [icon(p.icon, 18), h("span", { class: "rail__tip", text: p.title })]);
      this.buttons.set(p.id, b);
      (p.bottom ? bottom : main).append(b);
    }
    this.el.append(main, bottom);
    this.root.append(this.el);
    return this.el;
  }

  setActive(id) {
    this.active = id;
    for (const [pid, b] of this.buttons) {
      const on = pid === id;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    }
    return this.buttons.get(id) || null;
  }

  badge(id, value) {
    const b = this.buttons.get(id);
    if (!b) return;
    if (value === null || value === undefined || value === "") delete b.dataset.badge;
    else b.dataset.badge = String(value);
    this.badges.set(id, value);
  }

  focusActive() { this.buttons.get(this.active)?.focus(); }

  destroy() { clear(this.el); this.el.remove(); this.buttons.clear(); }
}
