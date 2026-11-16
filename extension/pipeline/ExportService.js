import { ZipWriter } from "./ZipWriter.js";
import { EpubBuilder } from "./EpubBuilder.js";
import { DocxBuilder } from "./DocxBuilder.js";
import { ProjectService } from "../model/ProjectService.js";
import { TextStats } from "../analysis/TextStats.js";
import { AppError, ERR } from "../core/AppError.js";

const slug = (s) => String(s || "naskah").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "naskah";
const EXT = { markdown: "md", txt: "txt", json: "json", csv: "csv", html: "html", epub: "epub", docx: "docx", zip: "zip" };

export class ExportService {
  constructor(settings, library, logger) {
    this.settings = settings;
    this.library = library;
    this.log = logger?.child?.("export") || logger;
  }

  static markdown(project, { synopsis = true } = {}) {
    const lines = [`# ${project.title || "Naskah"}`, "", `*${project.author || "Penulis"}*`, ""];
    if (project.premise) lines.push(`> ${project.premise}`, "");
    if (synopsis) {
      lines.push("## Sinopsis bab", "");
      for (const c of project.chapters || []) lines.push(`- **${c.title}** — ${c.summary || "(belum ada ringkasan)"}`);
      lines.push("");
    }
    for (const c of project.chapters || []) {
      lines.push(`## ${c.title}`, "");
      const meta = [c.pov && `POV: ${c.pov}`, c.place && `Latar: ${c.place}`, c.time && `Waktu: ${c.time}`].filter(Boolean).join(" · ");
      if (meta) lines.push(`<!-- ${meta} -->`, "");
      lines.push(ProjectService.chapterText(c) || "_(bab ini masih kosong)_", "");
    }
    return lines.join("\n");
  }

  static plain(project) {
    const out = [`${(project.title || "NASKAH").toUpperCase()}`, project.author || "", "", project.premise || "", ""];
    for (const c of project.chapters || []) out.push("", `${c.order || ""}. ${c.title.toUpperCase()}`, "", ProjectService.chapterText(c) || "");
    return out.join("\n");
  }

  static csv(rows) {
    if (!rows.length) return "";
    const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((k) => !["blobId", "meta"].includes(k));
    const cell = (v) => {
      const s = Array.isArray(v) ? v.join("; ") : typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\n");
  }

  static citation(item, style = "chicago") {
    const date = new Date(item.capturedAt || Date.now());
    const year = date.getFullYear();
    const accessed = date.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    const host = item.source || (item.url ? new URL(item.url).hostname : "sumber lokal");
    if (style === "apa") return `${host}. (${year}). ${item.title}. ${item.url || ""}`;
    if (style === "mla") return `“${item.title}.” ${host}, ${year}, ${item.url || "berkas lokal"}. Diakses ${accessed}.`;
    return `${host}. “${item.title}.” Diakses ${accessed}. ${item.url || ""}`.trim();
  }

  static clipsMarkdown(items, style = "chicago") {
    return ["# Kliping riset", "", ...items.flatMap((i) => [
      `## ${i.title}`, "", `> ${(i.text || "").replace(/\n/g, "\n> ")}`, "",
      i.note ? `Catatan: ${i.note}` : "", `Sumber: ${ExportService.citation(i, style)}`, "",
    ])].join("\n");
  }

  async build(kind, payload, opts = {}) {
    if (kind === "markdown") return new Blob([payload.chapters ? ExportService.markdown(payload, opts) : ExportService.clipsMarkdown(payload, opts.sitasi)], { type: "text/markdown" });
    if (kind === "txt") return new Blob([payload.chapters ? ExportService.plain(payload) : payload.map((i) => `${i.title}\n${i.text}\n${i.url}\n`).join("\n")], { type: "text/plain" });
    if (kind === "json") return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    if (kind === "csv") return new Blob([ExportService.csv(Array.isArray(payload) ? payload : payload.chapters || [])], { type: "text/csv" });
    if (kind === "html") return new Blob([EpubBuilder.printHtml(payload, opts)], { type: "text/html" });
    if (kind === "epub") return EpubBuilder.build(payload, opts);
    if (kind === "docx") return DocxBuilder.build(payload, opts);
    if (kind === "zip") return this.zipDataset(payload, opts);
    throw new AppError(ERR.EXPORT, `Format tidak dikenal: ${kind}`);
  }

  async zipDataset(items, { name = "dataset" } = {}) {
    const zip = new ZipWriter();
    zip.add(`${slug(name)}/index.json`, JSON.stringify(items.map(({ blobId, ...rest }) => rest), null, 2));
    zip.add(`${slug(name)}/kliping.md`, ExportService.clipsMarkdown(items, this.settings.get("scraper.sitasiGaya")));
    zip.add(`${slug(name)}/daftar-sumber.csv`, ExportService.csv(items.map((i) => ({
      judul: i.title, sumber: i.url || i.source, tanggal: i.capturedAt, sitasi: ExportService.citation(i, this.settings.get("scraper.sitasiGaya")),
    }))));
    let n = 0;
    for (const it of items) {
      if (it.type === "image" && it.blobId) {
        const blob = await this.library.getBlob(it.blobId);
        if (blob) zip.add(`${slug(name)}/gambar/${++n}-${slug(it.title)}.jpg`, await blob.arrayBuffer());
      } else if (it.text) {
        zip.add(`${slug(name)}/teks/${slug(it.title)}.txt`, `${it.title}\n\n${it.text}\n\nSumber: ${it.url || it.source}`);
      }
    }
    return zip.build();
  }

  async download(blob, filename) {
    const folder = this.settings.get("data.folderUnduhan") || "Kalam";
    const rel = `${folder}/${filename}`;
    const url = URL.createObjectURL(blob);
    try {
      if (typeof chrome !== "undefined" && chrome.downloads?.download) {
        const id = await chrome.downloads.download({ url, filename: rel, saveAs: false });
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        return { filename: rel, id, bytes: blob.size };
      }
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 20000);
      return { filename, bytes: blob.size };
    } catch (err) {
      URL.revokeObjectURL(url);
      throw AppError.wrap(err, ERR.EXPORT);
    }
  }

  async exportProject(project, kind, opts = {}) {
    const blob = await this.build(kind, project, opts);
    return this.download(blob, `${slug(project.title)}.${EXT[kind]}`);
  }

  async exportDataset(items, kind, name = "riset") {
    const payload = kind === "epub" ? ExportService.asBook(items, name) : items;
    const blob = await this.build(kind, payload, { name, sitasi: this.settings.get("scraper.sitasiGaya") });
    return this.download(blob, `${slug(name)}.${EXT[kind]}`);
  }

  static asBook(items, name) {
    return {
      title: name, author: "Kliping riset", premise: "Kumpulan bahan riset dengan sumber.",
      chapters: items.map((i, n) => ({
        id: i.id, order: n + 1, title: i.title,
        scenes: [{ id: `${i.id}_s`, title: "Isi", text: `${i.text}\n\nSumber: ${i.url || i.source}${i.note ? `\n\nCatatan: ${i.note}` : ""}` }],
      })),
    };
  }

  static manuscriptStats(project) {
    return TextStats.stats((project.chapters || []).map((c) => ProjectService.chapterText(c)).join("\n\n"));
  }
}
