import { TextStats } from "../analysis/TextStats.js";

export class AnalysisService {
  constructor(library, settings) {
    this.library = library;
    this.settings = settings;
  }

  static TYPES = [
    { id: "text", label: "Teks", tone: "cyan" }, { id: "table", label: "Tabel", tone: "violet" },
    { id: "image", label: "Gambar", tone: "magenta" }, { id: "chapter", label: "Bab", tone: "amber" },
    { id: "file", label: "Berkas", tone: "lime" },
  ];

  summary(items = this.library.items) {
    const words = items.reduce((a, i) => a + (i.meta?.words || 0), 0);
    const types = AnalysisService.TYPES.map((t) => ({ ...t, count: items.filter((i) => i.type === t.id).length })).filter((t) => t.count);
    const sources = new Map();
    for (const i of items) { const k = i.source || "lokal"; sources.set(k, (sources.get(k) || 0) + 1); }
    const read = items.filter((i) => i.meta?.readability).map((i) => i.meta.readability);
    return {
      count: items.length, words, bytes: items.reduce((a, i) => a + (i.size || 0), 0), types,
      datasets: this.library.datasets().length,
      sources: [...sources.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      readability: read.length ? Math.round(read.reduce((a, b) => a + b, 0) / read.length) : 0,
      duplicates: this.library.duplicates().length,
      oldest: items.length ? items[items.length - 1].capturedAt : null,
      newest: items.length ? items[0].capturedAt : null,
    };
  }

  keywords(items, limit = 14) {
    const text = items.filter((i) => i.text).map((i) => i.text).join("\n");
    if (!text) return [];
    return TextStats.freq(text, { min: this.settings.num("analisis.kataUlang"), stop: true }).slice(0, limit);
  }

  timeline(items) {
    const map = new Map();
    for (const i of items) { const k = String(i.capturedAt || "").slice(0, 10); map.set(k, (map.get(k) || 0) + 1); }
    return [...map.entries()].sort().map(([day, count]) => ({ day, count }));
  }

  preview(item, chars = 900) {
    if (!item) return "";
    if (item.type === "table" && item.meta?.data) {
      return item.meta.data.slice(0, 8).map((r) => (Array.isArray(r) ? r.join(" | ") : String(r))).join("\n");
    }
    const t = String(item.text || "");
    return t.length > chars ? `${t.slice(0, chars)}…` : t;
  }

  quality(items) {
    const n = items.length || 1;
    const sourced = items.filter((i) => i.url || i.source).length;
    const noted = items.filter((i) => i.note).length;
    const substantial = items.filter((i) => (i.meta?.words || 0) >= 40 || i.type !== "text").length;
    const score = Math.round(((sourced / n) * 45 + (noted / n) * 20 + (substantial / n) * 35));
    return {
      score,
      sourced: Math.round((sourced / n) * 100),
      noted: Math.round((noted / n) * 100),
      substantial: Math.round((substantial / n) * 100),
      advice: sourced < n * 0.8 ? "Lengkapi sumber agar sitasi akurat."
        : noted < n * 0.3 ? "Tambah catatan pada kliping penting."
        : "Riset rapi; siap diekspor.",
    };
  }

  tableRows(items) {
    return items.map((i) => ({
      id: i.id, judul: i.title, jenis: i.type, dataset: i.dataset,
      kata: i.meta?.words || 0, sumber: i.source || i.url || "lokal",
      tanggal: String(i.capturedAt || "").slice(0, 10), ukuran: i.size || 0, item: i,
    }));
  }
}
