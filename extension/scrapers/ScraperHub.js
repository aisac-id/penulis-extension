import { TextScraper } from "./TextScraper.js";
import { ImageScraper } from "./ImageScraper.js";
import { NovelScraper } from "./NovelScraper.js";
import { FileDownloader } from "./FileDownloader.js";

export const SCRAPERS = [
  { id: "text", label: "Teks & tabel", icon: "clip", desc: "Artikel, paragraf, dan tabel dari halaman ini." },
  { id: "image", label: "Gambar referensi", icon: "eye", desc: "Gambar halaman untuk moodboard latar." },
  { id: "novel", label: "Teks berbab", icon: "book", desc: "Ikuti tautan 'berikutnya' sampai batas bab." },
  { id: "file", label: "Berkas", icon: "export", desc: "PDF/DOCX/EPUB yang ditautkan halaman." },
  { id: "selection", label: "Teks terpilih", icon: "type", desc: "Hanya teks yang Anda blok di halaman." },
];

export class ScraperHub {
  constructor(settings, logger) {
    this.settings = settings;
    this.log = logger?.child?.("scrapers") || logger;
    this.text = new TextScraper(settings);
    this.image = new ImageScraper(settings);
    this.novel = new NovelScraper(settings);
    this.files = new FileDownloader(settings, logger);
    this.running = null;
  }

  list() { return SCRAPERS; }

  async run(kind, page, { fetchHtml = null, fetchBlob = null, onProgress = null } = {}) {
    this.running = kind;
    try {
      if (kind === "text") {
        const r = this.text.extract(page);
        onProgress?.({ step: "teks", count: r.items.length });
        return { items: r.items, blobs: [], info: `${r.blocks} blok teks` };
      }
      if (kind === "selection") {
        const item = TextScraper.selection(page.selection, page);
        return { items: item ? [item] : [], blobs: [], info: item ? "1 kliping" : "tidak ada teks terpilih" };
      }
      if (kind === "image") {
        const r = this.image.extract(page);
        onProgress?.({ step: "daftar gambar", count: r.items.length });
        if (!fetchBlob || !r.items.length) return { items: r.items, blobs: [], info: `${r.items.length} gambar terdaftar` };
        const downloaded = await this.image.download(r.items, fetchBlob, onProgress);
        return { items: downloaded.map((d) => d.item), blobs: downloaded, info: `${downloaded.length}/${r.items.length} terunduh` };
      }
      if (kind === "novel") {
        if (!fetchHtml) return { items: [], blobs: [], info: "butuh izin akses halaman" };
        const r = await this.novel.run(page, fetchHtml, { onProgress });
        return { items: r.items, blobs: [], info: `${r.total} bab` };
      }
      if (kind === "file") {
        const links = this.files.links(page);
        onProgress?.({ step: "tautan berkas", count: links.length });
        if (!fetchBlob) return { items: links.map((l) => ({ type: "file", title: l.title, text: "", url: l.page, meta: { fileUrl: l.url } })), blobs: [], info: `${links.length} tautan` };
        const got = await this.files.run(links, fetchBlob, onProgress);
        return {
          items: got.map((g) => ({ type: "file", title: g.link.title, text: "", url: g.link.page, meta: { fileUrl: g.link.url, bytes: g.blob.size } })),
          blobs: got.map((g) => ({ item: { title: g.link.title }, blob: g.blob })),
          info: `${got.length}/${links.length} berkas`,
        };
      }
      return { items: [], blobs: [], info: "scraper tidak dikenal" };
    } finally {
      this.running = null;
    }
  }

  stop() { this.novel.stop(); this.files.stop(); }
}
