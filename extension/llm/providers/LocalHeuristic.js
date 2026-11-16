import { BaseProvider } from "./BaseProvider.js";
import { TextStats } from "../../analysis/TextStats.js";
import { ProjectService } from "../../model/ProjectService.js";
const NAMA = {
  perempuan: ["Larasati", "Sulastri", "Ratna", "Wulandari", "Sekar", "Ambarwati", "Ningsih", "Prawesti", "Cempaka", "Ayu Lestari"],
  laki: ["Bagas", "Soekarjo", "Darto", "Wisnu", "Sutarjo", "Hardi", "Pramudya", "Jarot", "Sena", "Bimo"],
  tempat: ["Ujung Jalan", "Pasar Kliwon", "Kampung Sawah", "Stasiun Kota", "Rumah Panggung", "Warung Pojok", "Tanjung Karang", "Gang Melati"],
};
export class LocalHeuristic extends BaseProvider {
  constructor(settings, vault, http, services = {}) {
    super(settings, vault, http, { id: "local", label: "Mesin lokal (offline)", secret: null, price: [0, 0] });
    this.svc = services;
    this.models = ["kalam-lokal-1"];
  }
  async listModels() { return this.models; }
  async ready() { return true; }
  async testConnection() { return { ok: true, ms: 1, detail: "Mesin lokal siap, tanpa jaringan.", model: this.models[0] }; }
  async chat({ task = "bebas", vars = {}, messages = [] }) {
    return { text: await this.run(task, vars, messages), usage: { input: 0, output: 0 }, cost: 0, model: this.models[0], provider: this.id, offline: true };
  }
  async stream({ task = "bebas", vars = {}, messages = [], onDelta }) {
    const res = await this.chat({ task, vars, messages });
    let buf = "";
    for (const p of res.text.split(/(\s+)/)) {
      buf += p;
      if (buf.length >= 18) { onDelta?.(buf); buf = ""; await new Promise((r) => setTimeout(r, 8)); }
    }
    if (buf) onDelta?.(buf);
    return res;
  }
  async run(task, vars, messages) {
    const project = this.svc.projects?.active;
    const teks = vars.teks || messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
    if (task === "ringkas") return this.ringkas(vars, teks);
    if (task === "lubang") return this.lubang(project);
    if (task === "variasi") return this.variasi(teks);
    if (task === "tanya") return this.tanya(vars.pertanyaan || teks);
    if (task === "sinopsis") return this.sinopsis(project, vars);
    if (task === "surat") return this.surat(project, vars);
    if (task === "beat") return this.beat(vars);
    if (task === "nama") return this.nama(vars.pertanyaan || teks);
    return this.bebas(teks);
  }
  ringkas(vars, teks) {
    if (!teks.trim()) return "Bab masih kosong — tulis beberapa paragraf dulu.";
    const st = TextStats.stats(teks);
    const top = TextStats.freq(teks, { min: 4 }).slice(0, 4).map((f) => f.word);
    return [
      `**Ringkasan — ${vars.judul || "bab ini"}**`, "",
      TextStats.summarize(teks, 3), "",
      `**Inti bab:** ${top.length ? `pergeseran pada ${top.slice(0, 2).join(" dan ")}` : "adegan pembuka menyiapkan konflik"}.`,
      "", `_${st.words} kata · ${st.sentences} kalimat · dialog ${Math.round(st.dialogue * 100)}% · keterbacaan ${st.readability}._`,
    ].join("\n");
  }
  lubang(project) {
    const c = this.svc.consistency;
    if (!project || !c) return "Belum ada proyek aktif.";
    const findings = c.run();
    const LABEL = { nama: "Varian nama", kronologi: "Kronologi", pov: "Sudut pandang", tokoh: "Tokoh tak terpakai", rencana: "Rencana vs naskah", naskah: "Bab belum digarap" };
    if (!findings.length) return "**Tidak ada kontradiksi.** Nama konsisten, kronologi urut, semua rencana punya bab.";
    const groups = new Map();
    for (const f of findings) {
      if (!groups.has(f.kind)) groups.set(f.kind, []);
      groups.get(f.kind).push(f);
    }
    const setups = c.setups().slice(0, 3);
    return ["**Temuan struktur** (data proyek Anda)", "",
      ...[...groups.entries()].flatMap(([kind, list]) => [
        `### ${LABEL[kind] || kind}`,
        ...list.slice(0, 5).map((f) => `- ${f.title}${f.snippet ? ` _(${f.snippet})_` : ""} → ${f.advice}`), "",
      ]),
      ...(setups.length ? ["### Janji belum dibayar", ...setups.map((s) => `- "${s.word}" disebut ${s.count}× di awal, lalu hilang.`)] : []),
    ].join("\n");
  }
  variasi(teks) {
    const s = TextStats.sentences(teks)[0] || teks.trim();
    if (!s) return "Blok satu kalimat di editor, lalu jalankan variasi.";
    const clean = s.replace(/\b(sangat|benar-benar|agak|cukup|sedikit)\s+/gi, "").replace(/\s+/g, " ").trim();
    const clauses = clean.split(/,\s*/);
    const pendek = clean.replace(/,\s*[^,]+$/, "").replace(/[.!?]$/, "");
    const balik = clauses.length > 1 ? `${clauses[clauses.length - 1]}, ${clauses.slice(0, -1).join(", ")}` : clean;
    return [
      "**Tiga alternatif** (makna sama, ritme beda)", "",
      `1. **Pendek.** ${pendek}.`,
      `2. **Sedang.** ${clean}`,
      `3. **Panjang.** ${balik}${/[.!?]$/.test(balik) ? "" : "."}`, "",
      "_Tips: buang kata penegas, pilih kata kerja lebih spesifik._",
    ].join("\n");
  }
  tanya(q) {
    const bible = this.svc.bible;
    const term = String(q || "").toLowerCase().replace(/[?!.]/g, "").trim();
    if (!term) return "Tulis pertanyaan, misalnya: apa luka batin Laras?";
    const hits = bible.search(term).slice(0, 6);
    if (!hits.length) {
      const all = [...bible.list("characters"), ...bible.list("places")].slice(0, 5);
      return [`Belum tercatat di bible untuk "${q}".`, "", "Yang sudah ada:",
        ...all.map((x) => `- **${x.name}** — ${x.role || x.kind || ""}`)].join("\n");
    }
    return [`**Dari bible proyek** — ${hits.length} catatan cocok:`, "",
      ...hits.map((h) => `- **${h.name}** (${h.kind}): ${h.want || h.detail || h.summary || ""}${h.wound ? ` Luka: ${h.wound}.` : ""}${h.need ? ` Butuh: ${h.need}.` : ""}`)].join("\n");
  }
  sinopsis(project, vars) {
    if (!project) return "Belum ada proyek aktif.";
    const chapters = project.chapters || [];
    const written = chapters.filter((c) => ProjectService.chapterWords(c) > 20);
    const lines = [`**${project.title}** — ${project.genre || "fiksi"} · ${this.svc.projects.words()} kata`, "",
      project.premise || "(premis belum diisi)", ""];
    for (const c of written.slice(0, 12)) lines.push(c.summary || TextStats.summarize(ProjectService.chapterText(c), 1));
    const empty = chapters.length - written.length;
    if (empty > 0) lines.push("", `_${empty} bab masih rencana; sinopsis mengeras setelah ditulis._`);
    lines.push("", `**Taruhan:** ${vars.taruhan || project.premise || "apa yang hilang bila tokoh gagal"}.`);
    return lines.join("\n");
  }
  surat(project, vars) {
    if (!project) return "Belum ada proyek aktif.";
    return this.svc.submissions.queryLetter(project, { publisher: vars.penerbit || "Tim Akuisisi" });
  }
  beat(vars) {
    const tujuan = vars.tujuan || "tokoh ingin sesuatu yang konkret";
    const halangan = vars.halangan || "sesuatu menahan langkahnya";
    const pov = vars.pov || "tokoh utama";
    const latar = vars.latar || "latar yang sudah Anda catat";
    return ["**Tujuh beat adegan**", "", ...[
      `**Masuk:** ${pov} tiba di ${latar} dengan satu maksud — ${tujuan}.`,
      "**Gangguan kecil:** satu detail tempat salah; pembaca tahu ada yang tak beres.",
      `**Upaya pertama:** ${pov} mencoba cara termudah. Berhasil separuh.`,
      `**Halangan naik:** ${halangan}. Biayanya kini nyata.`,
      `**Titik balik:** informasi baru memaksa ${pov} mengubah cara, bukan tujuan.`,
      "**Pilihan mahal:** ia mengorbankan sesuatu yang disayangi.",
      "**Keluar:** keadaan berubah; satu pertanyaan baru tersisa untuk bab berikutnya.",
    ].map((b, i) => `${i + 1}. ${b}`)].join("\n");
  }
  nama(q) {
    const t = String(q || "").toLowerCase();
    const pool = /tempat|latar|kota|kampung|jalan/.test(t) ? NAMA.tempat : /laki|pria|ayah|tokoh cowok/.test(t) ? NAMA.laki : NAMA.perempuan;
    const seed = TextStats.words(t) + t.length;
    const uniq = [...new Set(pool.map((n, i) => pool[(i * 3 + seed) % pool.length]))].slice(0, 8);
    return [`**Usulan nama** untuk: ${q || "tokoh baru"}`, "",
      ...uniq.map((n, i) => `${i + 1}. **${n}** — ${i % 2 ? "akrab di dialog, mudah dipanggil" : "berbobot untuk narasi; cocok tokoh penyimpan rahasia"}`),
      "", "_Bank nama Indonesia bawaan; sesuaikan era dan daerah cerita._"].join("\n");
  }
  bebas(teks) {
    if (!teks.trim()) return "Mesin lokal siap. Pilih resep, atau tulis pertanyaan tentang naskah.";
    const st = TextStats.stats(teks);
    const findings = this.svc.style?.check(teks) || [];
    return ["**Baca cepat naskah**", "",
      `- ${st.words} kata, ${st.paragraphs} paragraf, rata-rata ${st.avgSentence} kata/kalimat.`,
      `- Dialog ${Math.round(st.dialogue * 100)}% — ${st.dialogue < 0.15 ? "tambahkan percakapan agar adegan hidup" : st.dialogue > 0.6 ? "imbangi dengan aksi dan pikiran tokoh" : "seimbang"}.`,
      `- Keterbacaan ${st.readability}/100 (target ${this.settings.num("analisis.targetReadability")}).`,
      `- Perkiraan baca ${st.minutes} menit · ${st.pages} halaman buku.`, "",
      findings.length ? `**${findings.length} catatan gaya**, tiga teratas:` : "Tidak ada catatan gaya menonjol.",
      ...findings.slice(0, 3).map((f) => `- ${f.title} → ${f.advice}`)].join("\n");
  }
}
