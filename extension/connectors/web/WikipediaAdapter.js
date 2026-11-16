import { TextScraper } from "../../scrapers/TextScraper.js";

const HOST = "https://*.wikipedia.org";

export class WikipediaAdapter {
  constructor(settings, http) {
    this.settings = settings;
    this.http = http;
    this.id = "wikipedia";
    this.label = "Wikipedia (riset)";
    this.host = HOST;
    this.lang = "id";
  }

  enabled() { return this.settings.bool("koneksi.wikiAktif"); }

  origin() { return `https://${this.lang}.wikipedia.org`; }

  static permission() { return { origins: ["https://*.wikipedia.org/*"] }; }

  async search(term, limit = 8) {
    const url = `${this.origin()}/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(term)}&srlimit=${limit}&format=json&origin=*`;
    const data = await this.http.json(url, { timeoutMs: 12000 });
    return (data.query?.search || []).map((s) => ({
      title: s.title, snippet: String(s.snippet || "").replace(/<[^>]+>/g, ""),
      words: s.wordcount, url: `${this.origin()}/wiki/${encodeURIComponent(s.title.replace(/ /g, "_"))}`,
    }));
  }

  async summary(title) {
    const url = `${this.origin()}/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const data = await this.http.json(url, { timeoutMs: 12000 });
    return { title: data.title, text: data.extract || "", url: data.content_urls?.desktop?.page || "", thumb: data.thumbnail?.source || "" };
  }

  async article(title) {
    const url = `${this.origin()}/w/api.php?action=parse&page=${encodeURIComponent(title)}&prop=text&format=json&origin=*`;
    const data = await this.http.json(url, { timeoutMs: 15000 });
    const html = data.parse?.text?.["*"] || "";
    const page = { url: `${this.origin()}/wiki/${encodeURIComponent(title)}`, title, html: `<article>${html}</article>`, selection: "" };
    const doc = TextScraper.clean(page.html, { boilerplate: true });
    const text = [...doc.querySelectorAll("p")].map((p) => p.textContent.trim()).filter((t) => t.length > 40).join("\n\n");
    return { page, text };
  }

  async clips(term, limit = 4) {
    const hits = await this.search(term, limit);
    const out = [];
    for (const h of hits) {
      const s = await this.summary(h.title);
      if (!s.text) continue;
      out.push({
        type: "text", title: s.title, text: s.text, url: s.url || h.url,
        note: `Riset Wikipedia: ${term}`, tags: ["wikipedia", term.toLowerCase()],
        meta: { adapter: this.id },
      });
      await new Promise((r) => setTimeout(r, this.settings.num("scraper.jedaHalamanMs")));
    }
    return out;
  }

  async test() {
    if (!this.enabled()) return { ok: false, detail: "Adapter masih OFF." };
    try {
      const r = await this.search("novel", 1);
      return { ok: r.length > 0, detail: r.length ? `Contoh: ${r[0].title}` : "Tidak ada hasil." };
    } catch (err) {
      return { ok: false, detail: `${err.message} — izinkan host Wikipedia di tab Koneksi.` };
    }
  }

  status() { return { id: this.id, label: this.label, on: this.enabled(), host: this.host }; }
}