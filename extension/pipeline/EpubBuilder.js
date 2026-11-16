import { ZipWriter } from "./ZipWriter.js";
import { ProjectService } from "../model/ProjectService.js";

export const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const paras = (text) => String(text || "").split(/\n{2,}/).filter((p) => p.trim()).map((p) => `<p>${esc(p.trim()).replace(/\n/g, "<br/>")}</p>`).join("\n");
const CONTAINER = `<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`;
const CSS = `body{font-family:Georgia,serif;line-height:1.7;margin:5% 7%;color:#1a1a1a}h1{font-size:1.5em;line-height:1.25;margin:0 0 1.2em}h2{font-size:1.15em}p{margin:0 0 .85em;text-indent:1.4em}p:first-of-type{text-indent:0}.title{text-align:center;margin-top:22%}.title h1{font-size:2em;text-indent:0}.byline{text-align:center;font-style:italic;color:#555}hr{border:0;border-top:1px solid #ccc;margin:2em 0}`;

export class EpubBuilder {
  static build(project, { cover = null, includeToc = true, css = "" } = {}) {
    const zip = new ZipWriter();
    const id = `urn:uuid:${EpubBuilder.uuid()}`;
    const title = project.title || "Naskah", author = project.author || "Penulis";
    const chapters = (project.chapters || []).filter((c) => ProjectService.chapterText(c).trim());
    zip.add("mimetype", "application/epub+zip");
    zip.add("META-INF/container.xml", CONTAINER);
    zip.add("OEBPS/style.css", css || CSS);
    const items = [], spine = [];
    const premise = project.premise ? `<p style="text-indent:0;margin-top:2em">${esc(project.premise)}</p>` : "";
    zip.add("OEBPS/title.xhtml", EpubBuilder.xhtml(title, `<div class="title"><h1>${esc(title)}</h1><p class="byline">${esc(author)}</p>${premise}</div>`));
    items.push('<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>');
    spine.push('<itemref idref="title"/>');
    chapters.forEach((c, i) => {
      const file = `ch${i + 1}.xhtml`;
      zip.add(`OEBPS/${file}`, EpubBuilder.xhtml(c.title, `<h1>${esc(c.title)}</h1>\n${paras(ProjectService.chapterText(c))}`));
      items.push(`<item id="ch${i + 1}" href="${file}" media-type="application/xhtml+xml"/>`);
      spine.push(`<itemref idref="ch${i + 1}"/>`);
    });
    if (includeToc) {
      zip.add("OEBPS/nav.xhtml", EpubBuilder.xhtml("Daftar isi", `<nav epub:type="toc" id="toc"><h1>Daftar isi</h1><ol>${chapters.map((c, i) => `<li><a href="ch${i + 1}.xhtml">${esc(c.title)}</a></li>`).join("")}</ol></nav>`));
      items.push('<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>');
      spine.splice(1, 0, '<itemref idref="nav"/>');
    }
    if (cover) {
      zip.add("OEBPS/cover.jpg", cover);
      items.push('<item id="cover-img" href="cover.jpg" media-type="image/jpeg" properties="cover-image"/>');
    }
    zip.add("OEBPS/content.opf", `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id" xml:lang="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="pub-id">${id}</dc:identifier><dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><dc:language>id</dc:language><dc:description>${esc(project.premise || "")}</dc:description><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, "Z")}</meta></metadata><manifest>${items.join("\n")}<item id="css" href="style.css" media-type="text/css"/></manifest><spine>${spine.join("\n")}</spine></package>`);
    return zip.build();
  }
  static xhtml(title, body) {
    return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="id" lang="id"><head><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head><body>${body}</body></html>`;
  }
  static uuid() {
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const hex = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  static printHtml(project, { toc = true, bio = "" } = {}) {
    const chapters = project.chapters || [];
    return `<!DOCTYPE html><html lang="id"><head><meta charset="utf-8"><title>${esc(project.title)}</title><style>@page{size:A5;margin:18mm 16mm}body{font-family:Georgia,"Times New Roman",serif;line-height:1.7;color:#111;max-width:36em;margin:0 auto;padding:24px}h1{font-size:1.6em;page-break-before:always}h1:first-of-type{page-break-before:avoid}p{margin:0 0 .8em;text-indent:1.5em}p:first-of-type{text-indent:0}.cover{text-align:center;padding:22vh 0}.cover h1{font-size:2.2em}.toc{page-break-before:always}.toc ol{line-height:2}.bio{page-break-before:always;font-size:.95em}@media print{.noprint{display:none}}</style></head><body><div class="cover"><h1>${esc(project.title)}</h1><p style="text-indent:0"><em>${esc(project.author || "")}</em></p><p style="text-indent:0">${esc(project.premise || "")}</p></div>${toc ? `<div class="toc"><h2>Daftar isi</h2><ol>${chapters.map((c) => `<li>${esc(c.title)}</li>`).join("")}</ol></div>` : ""}${chapters.map((c) => `<h1>${esc(c.title)}</h1>${paras(ProjectService.chapterText(c))}`).join("\n")}${bio ? `<div class="bio"><h2>Tentang penulis</h2><p style="text-indent:0">${esc(bio)}</p></div>` : ""}</body></html>`;
  }
}
