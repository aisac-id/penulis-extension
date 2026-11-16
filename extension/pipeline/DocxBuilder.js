import { ZipWriter } from "./ZipWriter.js";
import { esc } from "./EpubBuilder.js";
import { ProjectService } from "../model/ProjectService.js";

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const para = (text, style = null) => {
  const runs = String(text || "").split("\n").map((line, i) =>
    `${i ? "<w:r><w:br/></w:r>" : ""}<w:r><w:t xml:space="preserve">${esc(line)}</w:t></w:r>`).join("");
  return `<w:p>${style ? `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>` : ""}${runs}</w:p>`;
};

export class DocxBuilder {
  static build(project, { toc = true, bio = "" } = {}) {
    const zip = new ZipWriter();
    zip.add("[Content_Types].xml", `${XML}
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`);
    zip.add("_rels/.rels", `${XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`);
    zip.add("word/_rels/document.xml.rels", `${XML}
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
    zip.add("docProps/core.xml", `${XML}
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>${esc(project.title || "Naskah")}</dc:title><dc:creator>${esc(project.author || "Penulis")}</dc:creator>
<dc:description>${esc(project.premise || "")}</dc:description></cp:coreProperties>`);
    zip.add("word/styles.xml", DocxBuilder.styles());
    const body = [para(project.title || "Naskah", "Title"), para(project.author || "", "Subtitle")];
    if (project.premise) body.push(para(project.premise));
    if (toc) {
      body.push(para("Daftar isi", "Heading1"));
      for (const c of project.chapters || []) body.push(para(`${c.order || ""}. ${c.title}`));
    }
    for (const c of project.chapters || []) {
      body.push(para(c.title, "Heading1"));
      for (const p of String(ProjectService.chapterText(c)).split(/\n{2,}/)) if (p.trim()) body.push(para(p.trim(), "BodyText"));
    }
    if (bio) {
      body.push(para("Tentang penulis", "Heading1"));
      body.push(para(bio, "BodyText"));
    }
    zip.add("word/document.xml", `${XML}
<w:document ${W}><w:body>${body.join("")}
<w:sectPr><w:pgSz w:w="8391" w:h="11907"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>
</w:body></w:document>`);
    return zip.build();
  }

  static styles() {
    const s = (id, name, extra, rpr) => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:pPr>${extra}</w:pPr><w:rPr>${rpr}</w:rPr></w:style>`;
    return `${XML}
<w:styles ${W}>
${s("Normal", "Normal", '<w:spacing w:after="120" w:line="360" w:lineRule="auto"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/>')}
${s("BodyText", "Body Text", '<w:spacing w:after="120" w:line="360" w:lineRule="auto"/><w:ind w:firstLine="567"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/>')}
${s("Title", "Title", '<w:jc w:val="center"/><w:spacing w:before="2400" w:after="240"/>', '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:b/><w:sz w:val="56"/>')}
${s("Subtitle", "Subtitle", '<w:jc w:val="center"/><w:spacing w:after="480"/>', '<w:i/><w:sz w:val="28"/>')}
${s("Heading1", "heading 1", '<w:spacing w:before="480" w:after="240"/><w:outlineLvl w:val="0"/>', '<w:b/><w:sz w:val="32"/>')}
</w:styles>`;
  }
}
