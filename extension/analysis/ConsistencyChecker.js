import { ProjectService } from "../model/ProjectService.js";
import { TextStats } from "./TextStats.js";
export class ConsistencyChecker {
  constructor(projects, bible, outline) {
    this.projects = projects;
    this.bible = bible;
    this.outline = outline;
  }
  run() {
    return [
      ...this.nameVariants(), ...this.timeline(), ...this.pov(),
      ...this.unusedCharacters(), ...this.planGaps(), ...this.emptyChapters(),
    ];
  }
  nameVariants() {
    const names = this.bible.list("characters").flatMap((c) => [c.name, c.alias]).filter((n) => n && n.length > 3);
    const caps = [...new Set((this.projects.fullText().match(/\b[A-Z][a-z]{3,}\b/g) || []))];
    const out = [];
    for (const cap of caps) {
      for (const name of names) {
        const short = name.split(" ")[0];
        if (cap === short || cap === name) continue;
        if (cap.length > 4 && this.dist(cap.toLowerCase(), short.toLowerCase()) === 1) {
          out.push(this.f("nama", "high", `"${cap}" mirip "${short}" — mungkin salah ejaan.`, `Bab: ${this.whereIs(cap)}`, "Samakan ejaan di seluruh naskah."));
        }
      }
    }
    return out.slice(0, 12);
  }
  dist(a, b) {
    if (Math.abs(a.length - b.length) > 1) return 9;
    const m = [];
    for (let i = 0; i <= a.length; i++) m[i] = [i];
    for (let j = 0; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
    }
    return m[a.length][b.length];
  }
  whereIs(word) {
    return this.projects.chapters().filter((c) => ProjectService.chapterText(c).includes(word)).map((c) => c.title).join(", ") || "—";
  }
  timeline() {
    const out = [];
    for (const [when, list] of this.bible.clashes()) {
      out.push(this.f("kronologi", "high", `Dua peristiwa pada ${when} di tempat berbeda.`, list.map((e) => `${e.what} @ ${e.place}`).join(" · "), "Cek apakah salah satu tanggalnya keliru."));
    }
    const order = this.projects.chapters().map((c) => c.id);
    let last = -1;
    for (const e of this.bible.sortedEvents().filter((e) => e.when && e.chapter)) {
      const idx = order.indexOf(e.chapter);
      if (idx < last) out.push(this.f("kronologi", "med", `Peristiwa ${e.when} muncul di bab lebih awal dari peristiwa sebelumnya.`, e.what, "Sesuaikan urutan bab atau tanggal."));
      last = Math.max(last, idx);
    }
    return out;
  }
  pov() {
    const chs = this.projects.chapters();
    const counts = new Map();
    const out = [];
    for (const c of chs) {
      if (!c.pov) { out.push(this.f("pov", "low", `Bab "${c.title}" belum punya sudut pandang.`, "", "Isi POV agar pemeriksaan suara bisa jalan.")); continue; }
      counts.set(c.pov, (counts.get(c.pov) || 0) + 1);
    }
    for (const [name, n] of counts) {
      if (chs.length >= 6 && n === 1) out.push(this.f("pov", "med", `POV "${name}" hanya muncul di 1 dari ${chs.length} bab.`, "", "Kalau memang sekali, pastikan itu disengaja, bukan sisa draf lama."));
    }
    return out;
  }
  unusedCharacters() {
    const out = [];
    for (const c of this.bible.list("characters")) {
      if (!this.bible.appearances(c).length && !/almarhum|pusat/i.test(c.role || "")) {
        out.push(this.f("tokoh", "med", `"${c.name}" ada di bible tapi tidak pernah muncul di naskah.`, c.role || "", "Hapus dari bible atau masukkan ke adegan."));
      }
    }
    return out;
  }
  planGaps() {
    const audit = this.outline.audit();
    const out = [];
    for (const c of audit.unplanned.slice(0, 8)) {
      out.push(this.f("rencana", "low", `Bab "${c.title}" belum punya kartu rencana.`, "", "Tambah kartu di panel Rencana agar struktur terlihat."));
    }
    for (const c of audit.broken) {
      out.push(this.f("rencana", "high", `Kartu "${c.title}" menunjuk bab yang sudah tidak ada.`, "", "Tautkan ulang atau hapus kartunya."));
    }
    return out;
  }
  emptyChapters() {
    return this.projects.chapters()
      .filter((c) => ProjectService.chapterWords(c) < 40 && c.status !== "idea")
      .map((c) => this.f("naskah", "med", `Bab "${c.title}" berstatus ${c.status} tapi baru ${ProjectService.chapterWords(c)} kata.`, TextStats.excerpt(ProjectService.chapterText(c), 90), "Ubah status atau lanjutkan menulis."));
  }
  f(kind, sev, title, snippet, advice) {
    return { id: `${kind}_${title.slice(0, 24)}`, kind, sev, title, snippet, advice, at: 0 };
  }
  setups() {
    const chs = this.projects.chapters();
    if (chs.length < 3) return [];
    const first = ProjectService.chapterText(chs[0]) + " " + ProjectService.chapterText(chs[1] || chs[0]);
    const rest = chs.slice(2).map((c) => ProjectService.chapterText(c)).join(" ").toLowerCase();
    return TextStats.freq(first, { min: 5 }).slice(0, 12)
      .filter((f) => !rest.includes(f.word))
      .map((f) => ({ word: f.word, count: f.count, note: "Disebut di awal, tidak muncul lagi setelahnya." }));
  }
}
