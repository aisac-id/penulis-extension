import { h, clear } from "../sidebar/ui/Dom.js";

export class CoachMark {
  constructor(root) {
    this.root = root;
    this.host = null;
    this.hole = null;
    this.card = null;
    this.target = null;
    this._onResize = () => this.place();
    this._onKey = (e) => { if (e.key === "Escape") this.close(); };
  }

  show({ selector, title, text, index = 1, total = 1, onNext, onSkip, nextLabel = "Berikutnya" }) {
    this.close();
    const target = this.root.querySelector(selector);
    this.target = target || null;
    this.host = h("div", { class: "coach" });
    this.hole = h("div", { class: "coach__hole" });
    this.card = h("div", { class: "coach__card" }, [
      h("div", { class: "coach__n", text: `Tur ${index}/${total}` }),
      h("strong", { text: title }),
      h("p", { text }),
      h("div", { class: "row" }, [
        h("button", { class: "btn btn--primary btn--sm", text: nextLabel, onclick: () => { this.close(); onNext?.(); } }),
        h("button", { class: "btn btn--ghost btn--sm", text: "Lewati tur", onclick: () => { this.close(); onSkip?.(); } }),
      ]),
    ]);
    this.host.append(this.hole, this.card);
    this.root.append(this.host);
    this.place();
    window.addEventListener("resize", this._onResize);
    window.addEventListener("scroll", this._onResize, true);
    this.root.addEventListener("keydown", this._onKey);
    return !!target;
  }

  place() {
    if (!this.host) return;
    const box = this.root.getBoundingClientRect();
    const r = this.target?.getBoundingClientRect();
    if (r && r.width) {
      Object.assign(this.hole.style, {
        left: `${r.left - box.left - 4}px`, top: `${r.top - box.top - 4}px`,
        width: `${r.width + 8}px`, height: `${r.height + 8}px`,
      });
      const cardW = Math.min(280, box.width - 24);
      const below = r.bottom - box.top + 12;
      const fits = below + 170 < box.height;
      Object.assign(this.card.style, {
        width: `${cardW}px`,
        left: `${Math.max(12, Math.min(box.width - cardW - 12, r.left - box.left))}px`,
        top: fits ? `${below}px` : `${Math.max(12, r.top - box.top - 182)}px`,
      });
    } else {
      Object.assign(this.hole.style, { left: "50%", top: "40%", width: "0px", height: "0px" });
      Object.assign(this.card.style, { left: "12px", top: "24%", width: `${Math.min(280, box.width - 24)}px` });
    }
  }

  close() {
    window.removeEventListener("resize", this._onResize);
    window.removeEventListener("scroll", this._onResize, true);
    this.root.removeEventListener("keydown", this._onKey);
    if (this.host) { clear(this.host); this.host.remove(); }
    this.host = null;
    this.hole = null;
    this.card = null;
    this.target = null;
  }

  destroy() { this.close(); }
}