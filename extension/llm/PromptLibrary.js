import { uid } from "../sidebar/ui/Dom.js";
const P = (id, label, icon, tone, desc, needs, system, template) => ({ id, label, icon, tone, desc, needs, system, template });
export const PROMPTS = [
  P("ringkas", "Ringkas bab", "clip", "cyan", "Ringkasan 3 kalimat + satu kalimat premis bab.", "chapter",
    "Anda editor fiksi Indonesia. Ringkas tanpa spoiler berlebihan, bahasa hidup.",
    "Ringkas bab ini dalam 3 kalimat, lalu tulis satu kalimat 'Inti bab:'.\n\nJudul: {{judul}}\n\n{{teks}}"),
  P("lubang", "Cari lubang plot", "search", "red", "Kontradiksi timeline, POV, dan janji belum dibayar.", "project",
    "Anda editor struktur. Sebut masalah spesifik beserta babnya, jangan mengarang fakta baru.",
    "Periksa naskah dan bible ini, daftar lubang plot beserta babnya:\n\n{{bible}}\n\n{{ringkasan}}"),
  P("variasi", "Variasi kalimat", "type", "amber", "Tiga alternatif kalimat lebih tajam, ritme berbeda.", "selection",
    "Anda penulis prosa Indonesia. Pertahankan makna dan sudut pandang, variasikan ritme.",
    "Tulis 3 alternatif kalimat ini dengan ritme berbeda (pendek, sedang, panjang):\n\n{{teks}}"),
  P("tanya", "Tanya bible", "users", "violet", "Jawab pertanyaan karakter/latar dari bible proyek.", "question",
    "Jawab hanya dari bible yang diberikan. Bila tidak ada datanya, katakan belum tercatat.",
    "Bible:\n{{bible}}\n\nPertanyaan: {{pertanyaan}}"),
  P("sinopsis", "Sinopsis penerbit", "book", "magenta", "Sinopsis 1 halaman siap kirim, nada jual tanpa lebay.", "project",
    "Anda penulis sinopsis penerbit Indonesia. Maksimal 350 kata, sertakan konflik dan taruhan.",
    "Buat sinopsis penerbit dari data ini:\n\nJudul: {{judul}}\nPremis: {{premis}}\n\n{{ringkasan}}"),
  P("surat", "Query letter", "send", "lime", "Surat pengantar formal ke penerbit/agensi.", "submission",
    "Tulis surat pengantar profesional, hangat, tanpa janji berlebihan. Boleh bandingkan judul serupa.",
    "Tulis query letter untuk penerbit {{penerbit}}.\n\nJudul: {{judul}}\nGenre: {{genre}}\nJumlah kata: {{kata}}\nPremis: {{premis}}"),
  P("beat", "Beat adegan", "board", "blue", "Tujuh beat adegan dari tujuan dan konflik Anda.", "scene",
    "Anda pelatih struktur adegan. Tiap beat punya tujuan, halangan, dan perubahan nilai.",
    "Susun 7 beat adegan.\nPOV: {{pov}}\nLatar: {{latar}}\nTujuan: {{tujuan}}\nHalangan: {{halangan}}"),
  P("nama", "Nama & detail", "spark", "teal", "Nama tokoh, tempat, dan detail sensorik sesuai era.", "question",
    "Berikan pilihan nama Indonesia sesuai era dan daerah, plus alasan singkat.",
    "Beri 8 usulan nama untuk: {{pertanyaan}}"),
];
export class PromptLibrary {
  constructor(store) {
    this.store = store;
    this.items = [];
  }
  async load() {
    const saved = await this.store.get("prompts", null);
    this.items = Array.isArray(saved) && saved.length ? saved : PROMPTS.map((p) => ({ ...p, builtin: true }));
    return this.items;
  }
  async save() { await this.store.set("prompts", this.items); }
  get(id) { return this.items.find((p) => p.id === id) || null; }
  list() { return this.items; }
  async add(patch) {
    const item = { id: uid("prompt"), label: "Resep baru", icon: "spark", tone: "cyan", desc: "", needs: "selection", system: "", template: "{{teks}}", ...patch };
    this.items.push(item);
    await this.save();
    return item;
  }
  async update(id, patch) {
    const p = this.get(id);
    if (!p) return null;
    Object.assign(p, patch);
    await this.save();
    return p;
  }
  async remove(id) {
    const p = this.get(id);
    this.items = this.items.filter((x) => x.id !== id);
    await this.save();
    return p;
  }
  async reset() {
    this.items = PROMPTS.map((p) => ({ ...p, builtin: true }));
    await this.save();
    return this.items;
  }
  static render(template, vars = {}) {
    return String(template || "").replace(/\{\{(\w+)\}\}/g, (_, k) => {
      const v = vars[k];
      return v === undefined || v === null || v === "" ? "(belum ada data)" : String(v);
    });
  }
}
