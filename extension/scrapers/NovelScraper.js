import { TextScraper } from "./TextScraper.js";
import { TextStats } from "../analysis/TextStats.js";

const NEXT = /(next|berikut|selanjut|lanjut|bab\s*\d+|chapter\s*\d+|›|»|→)/i;
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export class NovelScraper {
  constructor(settings) {
    this.settings = settings;
    this.text = new TextScraper(settings);
    this.stopped = false;
  }

  static nextLink(doc, baseUrl) {
    for (const a of [...doc.querySelectorAll("a[rel=next], a.next, .nav a, a")]) {
      const label = `${a.textContent} ${a.getAttribute("title") || ""} ${a.getAttribute("aria-label") || ""}`;
      if (!NEXT.test(label)) continue;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("javascript")) continue;
      try { return new URL(href, baseUrl).href; } catch { /* lanjut ke tautan berikut */ }
    }
    return null;
  }

  stop() { this.stopped = true; }

  async run(page, fetchHtml, { onProgress = null, max = null } = {}) {
    this.stopped = false;
    const limit = max || this.settings.num("scraper.maksBab");
    const delay = this.settings.num("scraper.jedaHalamanMs");
    const chapters = [];
    let current = page;
    const visited = new Set();
    for (let i = 0; i < limit; i++) {
      if (this.stopped || !current?.html || visited.has(current.url)) break;
      visited.add(current.url);
      const doc = TextScraper.clean(current.html, { boilerplate: this.settings.bool("scraper.boilerplate") });
      const title = (doc.querySelector("h1,h2")?.textContent || doc.title || `Bagian ${i + 1}`).trim();
      const text = [...TextScraper.bestBlock(doc).querySelectorAll("p")].map((p) => p.textContent.trim().replace(/\s+/g, " ")).filter((t) => TextStats.words(t) > 4).join("\n\n");
      if (TextStats.words(text) < 60) break;
      chapters.push({
        type: "chapter", title, text, url: current.url, source: TextScraper.host(current.url),
        meta: { words: TextStats.words(text), index: i + 1 },
      });
      onProgress?.({ index: i + 1, title, words: TextStats.words(text), url: current.url });
      const next = NovelScraper.nextLink(doc, current.url);
      if (!next) break;
      await pause(delay);
      if (this.stopped) break;
      try { current = { url: next, html: await fetchHtml(next), title: "" }; }
      catch (err) { onProgress?.({ error: err.message, url: next }); break; }
    }
    return { items: chapters, stopped: this.stopped, total: chapters.length };
  }

  static asProject(chapters, title = "Bacaan referensi") {
    return {
      title, author: "Sumber eksternal", genre: "Referensi",
      premise: "Hasil panen teks berbab untuk dibaca; jangan terbitkan ulang.",
      chapters: chapters.map((c, i) => ({
        id: `ref_${i}`, order: i + 1, title: c.title, part: "Referensi", status: "selesai", pov: "", place: "", time: "",
        summary: TextStats.summarize(c.text, 1),
        scenes: [{ id: `ref_${i}_s`, title: "Isi", text: c.text, status: "selesai" }],
      })),
    };
  }
}
