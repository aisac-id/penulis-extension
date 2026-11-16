const pick = (r, sel, all) => (all ? [...r.querySelectorAll(sel)] : r.querySelector(sel));

export class SelectorEngine {
  constructor(root = document) {
    this.root = root;
    this.hits = { data: 0, id: 0, aria: 0, css: 0, xpath: 0, text: 0 };
  }

  static esc(s) { return String(s).replace(/["\\]/g, "\\$&"); }

  static candidates(target) {
    if (typeof target === "string") return [{ how: "css", value: target }];
    const out = [];
    if (target.data) out.push({ how: "data", value: target.data });
    if (target.id) out.push({ how: "id", value: target.id });
    if (target.aria) out.push({ how: "aria", value: target.aria });
    if (target.css) out.push({ how: "css", value: target.css });
    if (target.xpath) out.push({ how: "xpath", value: target.xpath });
    if (target.text) out.push({ how: "text", value: target.text });
    return out;
  }

  one(target, { all = false } = {}) {
    for (const c of SelectorEngine.candidates(target)) {
      const found = this.by(c, all);
      if (all ? found.length : found) {
        this.hits[c.how] = (this.hits[c.how] || 0) + 1;
        return found;
      }
    }
    return all ? [] : null;
  }

  by({ how, value }, all = false) {
    const r = this.root;
    try {
      if (how === "data") {
        const [k, v] = String(value).split("=");
        return pick(r, v ? `[data-${SelectorEngine.esc(k)}="${SelectorEngine.esc(v)}"]` : `[data-${SelectorEngine.esc(k)}]`, all);
      }
      if (how === "id") return all ? [...r.querySelectorAll(`#${CSS.escape(value)}`)] : r.getElementById(value);
      if (how === "aria") return pick(r, `[aria-label="${SelectorEngine.esc(value)}"],[aria-labelledby="${SelectorEngine.esc(value)}"]`, all);
      if (how === "css") return pick(r, value, all);
      if (how === "xpath") {
        const doc = r.ownerDocument || r;
        const it = doc.evaluate(value, r, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
        const list = [];
        for (let n = it.iterateNext(); n; n = it.iterateNext()) list.push(n);
        return all ? list : list[0] || null;
      }
      if (how === "text") {
        const q = String(value).toLowerCase();
        const list = [...r.querySelectorAll("a,button,[role=button],h1,h2,h3,summary,label")].filter((e) => (e.textContent || "").trim().toLowerCase().includes(q));
        return all ? list : list[0] || null;
      }
    } catch { return all ? [] : null; }
    return all ? [] : null;
  }

  static describe(el) {
    if (!el || el.nodeType !== 1) return { css: "body" };
    const out = {};
    for (const a of el.attributes || []) {
      if (a.name.startsWith("data-") && a.value && a.value.length < 40) { out.data = `${a.name.slice(5)}=${a.value}`; break; }
    }
    if (el.id && !/^\d|:/.test(el.id)) out.id = el.id;
    const aria = el.getAttribute("aria-label");
    if (aria) out.aria = aria;
    out.css = SelectorEngine.cssPath(el);
    const txt = (el.textContent || "").trim().slice(0, 40);
    if (txt && ["A", "BUTTON", "SUMMARY"].includes(el.tagName)) out.text = txt;
    return out;
  }

  static cssPath(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      const cls = [...(node.classList || [])].filter((c) => !/^(is-|has-|active|hover)/.test(c)).slice(0, 2);
      if (cls.length) part += `.${cls.join(".")}`;
      const parent = node.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === node.tagName);
        if (same.length > 1) part += `:nth-of-type(${same.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      if (node.id) { parts[0] = `#${CSS.escape(node.id)}`; break; }
      node = parent;
    }
    return parts.join(" > ");
  }

  report() { return { ...this.hits }; }
}
