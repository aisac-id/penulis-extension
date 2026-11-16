import { TextStats } from "../analysis/TextStats.js";

const BOILER = "nav,header,footer,aside,script,style,noscript,form,[role=navigation],[aria-hidden=true],.advert,.ads,.iklan,.sidebar,.menu,.breadcrumb,.comments,#comments";

export class TextScraper {
  constructor(settings) { this.settings = settings; }

  static clean(html, { boilerplate = true } = {}) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    if (boilerplate) doc.querySelectorAll(BOILER).forEach((n) => n.remove());
    return doc;
  }

  static bestBlock(doc) {
    const candidates = [...doc.querySelectorAll("article,main,[role=main],.post,.article,.entry-content,#content,.content")];
    const score = (el) => {
      const ps = [...el.querySelectorAll("p")];
      return ps.reduce((a, p) => a + TextStats.words(p.textContent), 0) + ps.length * 12;
    };
    if (candidates.length) return candidates.sort((a, b) => score(b) - score(a))[0];
    return doc.body || doc.documentElement;
  }

  extract(page, { maxBlocks = 40 } = {}) {
    const doc = TextScraper.clean(page.html, { boilerplate: this.settings.bool("scraper.boilerplate") });
    const root = TextScraper.bestBlock(doc);
    const host = TextScraper.host(page.url);
    const title = (doc.querySelector("h1")?.textContent || doc.title || page.title || "Tanpa judul").trim();
    const items = [];
    const blocks = [...root.querySelectorAll("p,li,blockquote,h2,h3,pre")].filter((n) => TextStats.words(n.textContent) >= 8);
    const grouped = [];
    let buf = [];
    for (const b of blocks) {
      buf.push(b.textContent.trim().replace(/\s+/g, " "));
      if (buf.length >= 3) { grouped.push(buf.join("\n\n")); buf = []; }
    }
    if (buf.length) grouped.push(buf.join("\n\n"));
    grouped.slice(0, maxBlocks).forEach((text, i) => {
      items.push({
        type: "text", title: grouped.length > 1 ? `${title} — bagian ${i + 1}` : title, text, url: page.url, source: host,
        meta: { words: TextStats.words(text), readability: TextStats.readability(text), selector: "article/main/p" },
      });
    });
    if (!items.length) {
      const text = (root.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length > 40) items.push({ type: "text", title, text: text.slice(0, 6000), url: page.url, source: host, meta: { words: TextStats.words(text) } });
    }
    return { items: [...items, ...TextScraper.tables(doc, page)], title, blocks: grouped.length };
  }

  static tables(doc, page) {
    const out = [];
    doc.querySelectorAll("table").forEach((t, i) => {
      const rows = [...t.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.textContent.trim().replace(/\s+/g, " ")));
      if (rows.length < 2) return;
      const head = rows[0];
      const body = rows.slice(1);
      out.push({
        type: "table", title: `${doc.title || "Tabel"} — tabel ${i + 1}`, text: rows.map((r) => r.join(" | ")).join("\n"), url: page.url, source: TextScraper.host(page.url),
        meta: { columns: head, rows: body.length, data: body.map((r) => Object.fromEntries(head.map((h, j) => [h || `kolom${j + 1}`, r[j] || ""]))) },
      });
    });
    return out;
  }

  static selection(sel, page) {
    if (!sel || sel.trim().length < 3) return null;
    return {
      type: "text", title: `Kliping: ${TextStats.excerpt(sel, 60)}`, text: sel.trim(),
      url: page.url, source: TextScraper.host(page.url), meta: { words: TextStats.words(sel), selection: true },
    };
  }

  static host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "halaman lokal"; }
  }
}
