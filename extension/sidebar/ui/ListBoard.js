import { h, icon, clear } from "./Dom.js";

export class ListBoard {
  constructor({ onReorder, onOpen, onSelect, render, className = "" }) {
    this.onReorder = onReorder;
    this.onOpen = onOpen;
    this.onSelect = onSelect;
    this.renderItem = render;
    this.el = h("div", { class: `listboard ${className}`, role: "list" });
    this.items = [];
    this.selected = new Set();
    this.dragId = null;
    this._over = null;
  }

  setItems(items) { this.items = items; this.paint(); return this.el; }

  paint() {
    clear(this.el);
    this.items.forEach((item, idx) => this.el.append(this._row(item, idx)));
    return this.el;
  }

  _row(item, idx) {
    const row = h("div", {
      class: `lrow ${this.selected.has(item.id) ? "is-sel" : ""}`, role: "listitem", tabindex: "0",
      dataset: { id: item.id, idx: String(idx) },
    });
    const label = item.title || item.name || "item";
    const handle = h("button", {
      class: "lrow__drag", type: "button", "aria-label": `Geser ${label} (Alt+panah)`,
      title: "Tarik untuk mengurutkan · Alt+↑/↓",
    }, [icon("drag", 14)]);
    handle.addEventListener("pointerdown", (e) => this._startDrag(e, item, row));
    const check = h("input", { type: "checkbox", class: "lrow__check", checked: this.selected.has(item.id), "aria-label": `Pilih ${label}` });
    check.addEventListener("change", () => {
      if (check.checked) this.selected.add(item.id); else this.selected.delete(item.id);
      row.classList.toggle("is-sel", check.checked);
      this.onSelect?.([...this.selected]);
    });
    const body = this.renderItem(item, idx);
    body.classList.add("lrow__body");
    body.addEventListener("click", (e) => {
      if (e.target.closest("button,input,select,a")) return;
      this.onOpen?.(item);
    });
    row.append(handle, check, body);
    row.addEventListener("keydown", (e) => {
      if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
        const to = idx + (e.key === "ArrowUp" ? -1 : 1);
        if (to < 0 || to >= this.items.length) return;
        this.onReorder?.(item.id, to);
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.onOpen?.(item);
      }
    });
    return row;
  }

  _startDrag(e, item, row) {
    e.preventDefault();
    this.dragId = item.id;
    row.classList.add("is-drag");
    const move = (ev) => {
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest?.(".lrow");
      if (this._over && this._over !== target) this._over.classList.remove("is-over");
      if (target && target !== row) { target.classList.add("is-over"); this._over = target; }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      row.classList.remove("is-drag");
      this._over?.classList.remove("is-over");
      if (this._over) this.onReorder?.(this.dragId, Number(this._over.dataset.idx));
      this._over = null;
      this.dragId = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  clearSelection() {
    this.selected.clear();
    this.el.querySelectorAll(".lrow__check").forEach((c) => { c.checked = false; });
    this.el.querySelectorAll(".lrow").forEach((r) => r.classList.remove("is-sel"));
    this.onSelect?.([]);
  }

  selectAll() {
    this.items.forEach((i) => this.selected.add(i.id));
    this.paint();
    this.onSelect?.([...this.selected]);
  }

  destroy() {
    this.items = [];
    this.selected.clear();
    clear(this.el);
  }
}
