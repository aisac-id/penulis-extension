import { h, icon, clear, num } from "./Dom.js";
import { Controls } from "./Controls.js";

export class DataTable {
  constructor({ columns, onOpen, onSelect, empty = "Belum ada data." }) {
    this.columns = columns;
    this.onOpen = onOpen;
    this.onSelect = onSelect;
    this.emptyText = empty;
    this.rows = [];
    this.sortKey = columns[0]?.key || null;
    this.dir = 1;
    this.selected = new Set();
    this.term = "";
    this.el = h("div", { class: "table-wrap" });
    this.head = h("div", { class: "table-head" });
    this.body = h("div", { class: "table-body", role: "table" });
    this.bulk = h("div", { class: "bulkbar", hidden: true });
    this.el.append(this.head, this.bulk, this.body);
    this._paintHead();
  }

  _paintHead() {
    clear(this.head);
    const all = h("input", { type: "checkbox", class: "tcheck", "aria-label": "Pilih semua baris" });
    all.addEventListener("change", () => {
      this.selected = all.checked ? new Set(this.view().map((r) => r.id)) : new Set();
      this.paint();
      this._syncBulk();
    });
    this.allCheck = all;
    this.head.append(all);
    for (const c of this.columns) {
      const b = h("button", {
        class: `th ${this.sortKey === c.key ? "is-sorted" : ""}`, type: "button",
        title: `Urutkan ${c.label}`, style: c.width ? { flex: c.width } : null,
        onclick: () => {
          if (this.sortKey === c.key) this.dir *= -1; else { this.sortKey = c.key; this.dir = 1; }
          this._paintHead();
          this.paint();
        },
      }, [h("span", { text: c.label }), this.sortKey === c.key ? icon(this.dir > 0 ? "chevDown" : "chev", 12) : null]);
      this.head.append(b);
    }
  }

  setRows(rows) { this.rows = rows || []; this.paint(); return this.el; }

  setFilter(term) { this.term = String(term || "").toLowerCase(); this.paint(); }

  view() {
    const q = this.term;
    let out = this.rows.filter((r) => !q || this.columns.some((c) => String(c.value?.(r) ?? r[c.key] ?? "").toLowerCase().includes(q)));
    const col = this.columns.find((c) => c.key === this.sortKey);
    if (col) {
      const val = (r) => col.value?.(r) ?? r[col.key];
      out = [...out].sort((a, b) => {
        const x = val(a);
        const y = val(b);
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "id");
        return cmp * this.dir;
      });
    }
    return out;
  }

  paint() {
    clear(this.body);
    const rows = this.view();
    if (this.countEl) this.countEl.textContent = `${num(rows.length)} baris`;
    if (!rows.length) {
      this.body.append(h("p", { class: "table-empty muted", text: this.emptyText }));
      this._syncBulk();
      return;
    }
    for (const r of rows) {
      const row = h("div", { class: `trow ${this.selected.has(r.id) ? "is-sel" : ""}`, role: "row", tabindex: "0", dataset: { id: r.id } });
      const check = h("input", { type: "checkbox", class: "tcheck", checked: this.selected.has(r.id), "aria-label": `Pilih ${r.title || r.id}` });
      check.addEventListener("change", () => {
        if (check.checked) this.selected.add(r.id); else this.selected.delete(r.id);
        row.classList.toggle("is-sel", check.checked);
        this._syncBulk();
      });
      row.append(check);
      for (const c of this.columns) {
        const content = c.render ? c.render(r) : h("span", { text: String(c.value?.(r) ?? r[c.key] ?? "—") });
        row.append(h("div", { class: `td ${c.cls || ""}`, style: c.width ? { flex: c.width } : null }, [content]));
      }
      row.addEventListener("click", (e) => {
        if (e.target.closest("input,button,a,select")) return;
        this.onOpen?.(r);
      });
      row.addEventListener("keydown", (e) => { if (e.key === "Enter") this.onOpen?.(r); });
      this.body.append(row);
    }
    this._syncBulk();
  }

  setBulkActions(actions) { this.bulkActions = actions; this._syncBulk(); }

  _syncBulk() {
    const n = this.selected.size;
    this.bulk.hidden = n === 0;
    clear(this.bulk);
    this.onSelect?.([...this.selected]);
    if (!n) return;
    this.bulk.append(h("strong", { text: `${n} dipilih` }));
    for (const a of this.bulkActions || []) {
      this.bulk.append(Controls.button(a.label, () => a.onClick([...this.selected]), { kind: a.kind || "", small: true, iconName: a.icon }));
    }
    this.bulk.append(Controls.button("Bersihkan", () => this.clearSelection(), { small: true }));
  }

  clearSelection() {
    this.selected.clear();
    if (this.allCheck) this.allCheck.checked = false;
    this.paint();
  }

  destroy() {
    this.rows = [];
    this.selected.clear();
    clear(this.el);
  }
}
