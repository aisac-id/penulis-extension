import { AppError, ERR } from "../core/AppError.js";

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

export class FileDownloader {
  constructor(settings, logger) {
    this.settings = settings;
    this.log = logger?.child?.("files") || logger;
    this.maxBytes = 25 * 1048576;
    this.allowed = ["image/", "application/pdf", "text/", "application/epub+zip", "application/vnd.openxmlformats"];
    this.stopped = false;
  }

  stop() { this.stopped = true; }

  static looksLikeFile(url) {
    return /\.(pdf|docx?|txt|md|epub|png|jpe?g|webp|gif|csv)(\?|#|$)/i.test(String(url || ""));
  }

  links(page) {
    const doc = new DOMParser().parseFromString(page.html || "", "text/html");
    const out = [];
    for (const a of doc.querySelectorAll("a[href]")) {
      const href = a.getAttribute("href");
      if (!FileDownloader.looksLikeFile(href)) continue;
      try { out.push({ title: a.textContent.trim() || href.split("/").pop(), url: new URL(href, page.url).href, page: page.url }); } catch { /* href tak sah */ }
    }
    return out;
  }

  async fetchOne(url, fetcher) {
    if (this.stopped) throw new AppError(ERR.CONNECT, " Dihentikan pengguna.");
    const blob = await fetcher(url);
    if (!blob) throw new AppError(ERR.CONNECT, "Berkas kosong.");
    if (blob.size > this.maxBytes) throw new AppError(ERR.CONNECT, `Berkas terlalu besar (${Math.round(blob.size / 1048576)} MB > 25 MB).`);
    const type = blob.type || "application/octet-stream";
    if (!this.allowed.some((a) => type.startsWith(a))) throw new AppError(ERR.CONNECT, `Tipe berkas tidak diizinkan: ${type}`);
    return blob;
  }

  async run(links, fetcher, { onProgress = null } = {}) {
    this.stopped = false;
    const delay = this.settings.num("scraper.jedaHalamanMs");
    const results = [];
    for (let i = 0; i < links.length; i++) {
      if (this.stopped) break;
      const l = links[i];
      try {
        const blob = await this.fetchOne(l.url, fetcher);
        results.push({ link: l, blob });
        onProgress?.({ done: i + 1, total: links.length, title: l.title, bytes: blob.size });
      } catch (err) {
        onProgress?.({ done: i + 1, total: links.length, title: l.title, error: err.message });
      }
      await pause(delay);
    }
    return results;
  }
}
