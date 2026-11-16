import { uid } from "../sidebar/ui/Dom.js";
import { TextStats } from "../analysis/TextStats.js";

const now = () => new Date().toISOString();
const host = (url) => { try { return new URL(url).hostname; } catch { return String(url || "").slice(0, 60); } };

export class DataPipeline {
  constructor(hub, library, settings, bus, logger) {
    this.hub = hub; this.library = library; this.settings = settings; this.bus = bus;
    this.log = logger?.child?.("pipeline") || logger;
    this.steps = []; this.busy = false; this.lastRun = null;
  }
  step(text, level = "info", extra = {}) {
    const row = { id: uid("step"), at: now(), text, level, ...extra };
    this.steps.push(row);
    if (this.steps.length > 120) this.steps.shift();
    this.bus.emit("pipeline.step", row);
    return row;
  }
  reset() { this.steps = []; }
  normalize(raw, ctx) {
    const text = String(raw.text || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").trim();
    const type = raw.type || "text";
    const words = type === "text" || type === "chapter" ? TextStats.words(text) : 0;
    return {
      dataset: ctx.dataset, type, title: (raw.title || text.slice(0, 60) || "Tanpa judul").trim().slice(0, 160), text,
      url: raw.url || ctx.url || "", source: ctx.source || "", capturedAt: now(), note: raw.note || "",
      tags: [...new Set([...(raw.tags || []), ...(ctx.tags || [])])],
      meta: { ...(raw.meta || {}), words, ...(words ? { readability: TextStats.readability(text) } : {}), scraper: ctx.kind },
      size: raw.size || new Blob([text]).size,
    };
  }
  async run(kind, page, { dataset = "Riset", tags = [], fetchHtml = null, fetchBlob = null } = {}) {
    if (this.busy) return { ok: false, info: "Pipeline sedang berjalan." };
    this.busy = true;
    this.reset();
    const ctx = { dataset, tags, kind, url: page?.url || "", source: host(page?.url) };
    const out = { ok: true, added: [], skipped: 0, blobs: 0, info: "", quota: null };
    try {
      this.step(`Mulai panen "${kind}" dari ${ctx.source || "halaman lokal"}.`);
      if (!page?.html && !page?.selection) {
        this.step("Halaman belum terbaca. Buka tab lalu klik ikon Kalam.", "err");
        return { ...out, ok: false, info: "Tidak ada snapshot halaman." };
      }
      const res = await this.hub.run(kind, page, {
        fetchHtml, fetchBlob,
        onProgress: (p) => this.step(`${p.step}: ${p.count ?? p.done ?? 0}${p.total ? `/${p.total}` : ""}`),
      });
      this.step(`${res.items.length} item mentah — ${res.info}.`);
      const blobFor = new Map();
      for (const b of res.blobs || []) blobFor.set(b.item, b.blob);
      for (const raw of res.items) {
        const rec = this.normalize(raw, ctx);
        if (this.library.isDuplicate(dataset, rec.text || rec.url || rec.title)) { out.skipped++; continue; }
        const blob = blobFor.get(raw) || null;
        if (blob) {
          rec.blobId = uid("blob"); rec.size = blob.size; rec.meta.mime = blob.type;
          await this.library.addBlob(rec.blobId, blob);
          out.blobs++;
        }
        out.added.push(await this.library.add(rec));
        if (out.added.length % 5 === 0) this.step(`Tersimpan ${out.added.length} item…`);
      }
      out.quota = this.library.quota();
      out.info = `${out.added.length} item baru${out.skipped ? `, ${out.skipped} duplikat dilewati` : ""}${out.blobs ? `, ${out.blobs} berkas` : ""}.`;
      this.step(out.info, "ok");
      if (out.quota.ratio >= out.quota.warnAt) this.step(`Kuota terpakai ${Math.round(out.quota.ratio * 100)}%. Ekspor atau bersihkan dataset lama.`, "warn");
      this.lastRun = { kind, dataset, at: now(), count: out.added.length };
      this.bus.emit("pipeline.done", { ...out, added: out.added.length });
      return out;
    } catch (err) {
      this.step(err.message || String(err), "err");
      this.log?.error?.("pipeline gagal", err);
      return { ...out, ok: false, info: err.message || "Pipeline gagal." };
    } finally { this.busy = false; }
  }
  async ingest(raw, { dataset = "Riset", tags = [], url = "", source = "" } = {}) {
    const rec = this.normalize(raw, { dataset, tags, kind: "manual", url, source: source || host(url) });
    if (this.library.isDuplicate(dataset, rec.text || rec.title)) return { duplicate: true, item: null };
    const item = await this.library.add(rec);
    this.step(`Kliping manual "${item.title}" masuk dataset ${dataset}.`, "ok");
    return { duplicate: false, item };
  }
  stop() { this.hub.stop(); this.step("Panen dihentikan oleh pengguna.", "warn"); }
  async dedupe(dataset = null) {
    const dups = this.library.duplicates().filter((d) => !dataset || d.dataset === dataset);
    if (!dups.length) return 0;
    await this.library.remove(dups.map((d) => d.id));
    this.step(`${dups.length} duplikat dihapus.`, "ok");
    return dups.length;
  }
}
