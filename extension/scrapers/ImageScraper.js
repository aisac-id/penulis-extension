import { TextScraper } from "./TextScraper.js";

export class ImageScraper {
  constructor(settings) { this.settings = settings; }

  extract(page) {
    const doc = TextScraper.clean(page.html, { boilerplate: false });
    const min = this.settings.num("scraper.gambarMinPx");
    const host = TextScraper.host(page.url);
    const abs = (src) => { try { return new URL(src, page.url).href; } catch { return null; } };
    const seen = new Set();
    const items = [];
    for (const img of doc.querySelectorAll("img")) {
      const raw = img.getAttribute("src") || img.getAttribute("data-src") || (img.getAttribute("srcset") || "").split(",")[0].trim().split(" ")[0];
      const url = raw ? abs(raw) : null;
      if (!url || seen.has(url) || url.startsWith("data:")) continue;
      const w = Number(img.getAttribute("width")) || 0;
      const h = Number(img.getAttribute("height")) || 0;
      if ((w && w < min) || (h && h < min)) continue;
      seen.add(url);
      items.push({
        type: "image",
        title: img.getAttribute("alt")?.trim() || url.split("/").pop().slice(0, 60) || "Gambar",
        text: img.getAttribute("alt")?.trim() || "",
        url: page.url, source: host,
        meta: { imageUrl: url, width: w, height: h, figure: img.closest("figure")?.querySelector("figcaption")?.textContent?.trim() || "" },
      });
    }
    for (const el of doc.querySelectorAll("[style*='background-image']")) {
      const m = /url\(["']?([^"')]+)["']?\)/.exec(el.getAttribute("style") || "");
      const url = m ? abs(m[1]) : null;
      if (!url || seen.has(url) || url.startsWith("data:")) continue;
      seen.add(url);
      items.push({ type: "image", title: "Latar belakang", text: "", url: page.url, source: host, meta: { imageUrl: url, css: true } });
    }
    return { items: items.slice(0, 60), count: items.length };
  }

  async download(items, fetcher, onProgress = null) {
    const limit = this.settings.num("scraper.paralelUnduh");
    const delay = this.settings.num("scraper.jedaHalamanMs");
    const out = [];
    let idx = 0;
    const worker = async () => {
      while (idx < items.length) {
        const it = items[idx++];
        try {
          out.push({ item: it, blob: await fetcher(it.meta.imageUrl) });
          onProgress?.({ done: out.length, total: items.length, title: it.title });
        } catch (err) {
          onProgress?.({ done: out.length, total: items.length, error: err.message, title: it.title });
        }
        await new Promise((r) => setTimeout(r, delay));
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, limit) }, worker));
    return out;
  }
}
