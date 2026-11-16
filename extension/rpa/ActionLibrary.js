import { SelectorEngine } from "./SelectorEngine.js";
import { AppError, ERR } from "../core/AppError.js";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class ActionLibrary {
  constructor(settings, { root = document, bus = null, logger = null } = {}) {
    this.settings = settings;
    this.root = root;
    this.bus = bus;
    this.log = logger?.child?.("rpa") || logger;
    this.sel = new SelectorEngine(root);
    this.vars = {};
    this.marks = [];
  }

  static get ACTIONS() {
    return ["click", "type", "select", "scroll", "wait", "waitForSelector", "extract", "screenshot", "navigate", "loop", "if", "highlight", "setVar"];
  }

  find(target, all = false) {
    const el = this.sel.one(target, { all });
    if (!el || (all && !el.length)) throw new AppError(ERR.SELECTOR, `Elemen tidak ditemukan: ${JSON.stringify(target).slice(0, 90)}`);
    return el;
  }

  highlight(el, ms = 700) {
    if (!el?.style) return;
    const prev = el.style.outline;
    const prevOff = el.style.outlineOffset;
    el.style.outline = "2px solid #f6a723";
    el.style.outlineOffset = "2px";
    setTimeout(() => { el.style.outline = prev; el.style.outlineOffset = prevOff; }, ms);
  }

  async run(step) {
    const a = step.action;
    const v = step.value ?? "";
    if (a === "click") {
      const el = this.find(step.target);
      this.highlight(el);
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      await sleep(120);
      el.click();
      return { ok: true, data: `klik ${el.tagName.toLowerCase()}` };
    }
    if (a === "type") {
      const el = this.find(step.target);
      this.highlight(el);
      el.focus();
      if ("value" in el) {
        el.value = step.append ? `${el.value}${v}` : String(v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else el.textContent = String(v);
      return { ok: true, data: `${String(v).length} karakter` };
    }
    if (a === "select") {
      const el = this.find(step.target);
      el.value = String(v);
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return { ok: true, data: `pilih ${v}` };
    }
    if (a === "scroll") {
      if (step.target) this.find(step.target).scrollIntoView({ block: "center", behavior: "smooth" });
      else window.scrollBy({ top: Number(v) || 600, behavior: "smooth" });
      await sleep(260);
      return { ok: true, data: "gulir" };
    }
    if (a === "wait") { await sleep(Math.min(30000, Number(v) || 500)); return { ok: true, data: `tunggu ${v} ms` }; }
    if (a === "waitForSelector") {
      const limit = Number(step.timeout) || this.settings.num("rpa.timeoutMs");
      const t0 = Date.now();
      while (Date.now() - t0 < limit) {
        const el = this.sel.one(step.target);
        if (el) return { ok: true, data: "elemen muncul" };
        await sleep(200);
      }
      throw new AppError(ERR.SELECTOR, `Timeout menunggu elemen (${limit} ms).`);
    }
    if (a === "extract") {
      const list = this.find(step.target, true);
      const attr = step.attr || "text";
      const data = list.map((el) => (attr === "text" ? (el.textContent || "").trim() : el.getAttribute(attr) || ""));
      if (step.as) this.vars[step.as] = data;
      return { ok: true, data, count: data.length };
    }
    if (a === "screenshot") {
      if (!this.bus) return { ok: true, data: "screenshot hanya di mode ekstensi" };
      const res = await this.bus.send("rpa.screenshot", { name: step.value || "kalam" }, { local: false });
      return { ok: !!res?.ok, data: res?.filename || "screenshot" };
    }
    if (a === "navigate") {
      const url = new URL(String(v), location.href);
      if (!["http:", "https:", "file:"].includes(url.protocol)) throw new AppError(ERR.RPA, "Protokol tidak diizinkan.");
      location.assign(url.href);
      return { ok: true, data: url.href, navigated: true };
    }
    if (a === "highlight") {
      const list = this.find(step.target, true);
      list.forEach((el) => this.highlight(el, 2200));
      this.marks.push(...list);
      return { ok: true, data: `${list.length} ditandai` };
    }
    if (a === "setVar") {
      this.vars[step.as || "v"] = v;
      return { ok: true, data: `var ${step.as} = ${String(v).slice(0, 40)}` };
    }
    throw new AppError(ERR.RPA, `Aksi tidak dikenal: ${a}`);
  }

  test(cond = {}) {
    if (cond.exists) return !!this.sel.one(cond.exists);
    if (cond.text) return (this.root.body?.textContent || "").toLowerCase().includes(String(cond.text).toLowerCase());
    if (cond.var) return !!this.vars[cond.var];
    return false;
  }

  blocked() {
    const t = (this.root.body?.textContent || "").slice(0, 4000).toLowerCase();
    if (this.sel.one({ css: "iframe[src*='recaptcha'],iframe[src*='hcaptcha'],[class*='g-recaptcha']" })) return "CAPTCHA terdeteksi";
    if (this.sel.one({ css: "input[type=password]" }) && /masuk|login|sign in/.test(t)) return "Halaman login terdeteksi";
    if (/access denied|captcha|verify you are human|too many requests/.test(t)) return "Halaman menolak akses otomatis";
    return null;
  }

  destroy() {
    for (const el of this.marks) if (el?.style) { el.style.outline = ""; el.style.outlineOffset = ""; }
    this.marks = [];
    this.vars = {};
  }
}
