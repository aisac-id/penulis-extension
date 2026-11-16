import { uid } from "../sidebar/ui/Dom.js";

export const TEMPLATES = {
  three: { label: "Tiga babak", desc: "Struktur paling umum: bangun, runtuh, pilih.", cols: [
    { id: "act1", label: "Babak 1 · Bangun", tone: "cyan", beats: ["Dunia normal", "Panggilan", "Penolakan", "Masuk pintu"] },
    { id: "act2", label: "Babak 2 · Runtuh", tone: "magenta", beats: ["Sekutu & musuh", "Coba-coba", "Titik tengah", "Semua hilang"] },
    { id: "act3", label: "Babak 3 · Pilih", tone: "amber", beats: ["Pilihan sadar", "Klimaks", "Dunia baru"] },
  ] },
  savecat: { label: "Save the Cat", desc: "15 beat populer untuk novel komersial.", cols: [
    { id: "act1", label: "Pembuka", tone: "cyan", beats: ["Citra pembuka", "Tema disebut", "Perkenalan", "Katalis", "Berdebat"] },
    { id: "act2", label: "Tengah", tone: "magenta", beats: ["Masuk babak 2", "Kisah B", "Janji keseruan", "Titik tengah", "Penjahat mendekat", "Semua hilang", "Malam gelap jiwa"] },
    { id: "act3", label: "Penutup", tone: "amber", beats: ["Masuk babak 3", "Final", "Citra penutup"] },
  ] },
  kishotenketsu: { label: "Kishōtenketsu", desc: "Empat bagian tanpa konflik sebagai mesin utama.", cols: [
    { id: "ki", label: "Ki · Perkenalan", tone: "cyan", beats: ["Siapa & di mana", "Kebiasaan"] },
    { id: "sho", label: "Shō · Pengembangan", tone: "teal", beats: ["Perluasan dunia", "Detail yang menumpuk"] },
    { id: "ten", label: "Ten · Pembelokan", tone: "magenta", beats: ["Sudut pandang lain", "Benda yang mengubah makna"] },
    { id: "ketsu", label: "Ketsu · Penyatuan", tone: "amber", beats: ["Makna baru", "Gambaran akhir"] },
  ] },
  hero: { label: "Perjalanan pahlawan", desc: "Untuk cerita petualangan atau transformation arc.", cols: [
    { id: "act1", label: "Keberangkatan", tone: "cyan", beats: ["Dunia biasa", "Panggilan", "Menolak", "Mentor", "Menyeberang"] },
    { id: "act2", label: "Inisiasi", tone: "magenta", beats: ["Ujian", "Gua terdalam", "Hadiah"] },
    { id: "act3", label: "Kembali", tone: "amber", beats: ["Jalan pulang", "Bangkit", "Membawa eliksir"] },
  ] },
  nonfiksi: { label: "Nonfiksi", desc: "Untuk buku panduan, esai panjang, atau memoar tematik.", cols: [
    { id: "act1", label: "Masalah", tone: "cyan", beats: ["Janji buku", "Mengapa sekarang", "Peta isi"] },
    { id: "act2", label: "Isi", tone: "magenta", beats: ["Kerangka", "Bukti & cerita", "Latihan", "Kesalahan umum"] },
    { id: "act3", label: "Penutup", tone: "amber", beats: ["Rangkuman", "Langkah pertama", "Bacaan lanjut"] },
  ] },
};

export class OutlineService {
  constructor(store, projects, bus) { this.store = store; this.projects = projects; this.bus = bus; this.template = "three"; this.cards = []; this.trash = null; }
  key(id = this.projects.activeId) { return `outline:${id}`; }
  async load(projectId = this.projects.activeId) {
    const data = (await this.store.get(this.key(projectId), null)) || { template: "three", cards: [] };
    this.template = TEMPLATES[data.template] ? data.template : "three";
    this.cards = Array.isArray(data.cards) ? data.cards : [];
    return this;
  }
  async save() { await this.store.set(this.key(), { template: this.template, cards: this.cards }); this.bus.emit("project.changed", { part: "outline" }); }
  get cols() { return TEMPLATES[this.template].cols; }
  async setTemplate(id) {
    if (!TEMPLATES[id]) return;
    this.template = id;
    const valid = new Set(TEMPLATES[id].cols.map((c) => c.id));
    const fallback = TEMPLATES[id].cols[0].id;
    this.cards.forEach((c) => { if (!valid.has(c.col)) c.col = fallback; });
    await this.save();
  }
  async fillTemplate() {
    const existing = new Set(this.cards.map((c) => c.title.toLowerCase()));
    let added = 0;
    for (const col of this.cols) {
      for (const beat of col.beats) {
        if (existing.has(beat.toLowerCase())) continue;
        this.cards.push({ id: uid("o"), col: col.id, title: beat, desc: "", chapter: "" });
        added++;
      }
    }
    await this.save(); return added;
  }
  async add(col = this.cols[0].id, patch = {}) {
    const card = { id: uid("o"), col, title: "Beat baru", desc: "", chapter: "", ...patch };
    card.id = uid("o");
    this.cards.push(card);
    await this.save(); return card;
  }
  async update(id, patch) {
    const c = this.cards.find((x) => x.id === id);
    if (!c) return null;
    Object.assign(c, patch); await this.save(); return c;
  }
  async move(id, col, toIndex = null) {
    const idx = this.cards.findIndex((c) => c.id === id);
    if (idx < 0) return;
    const [card] = this.cards.splice(idx, 1);
    card.col = col;
    if (toIndex === null) this.cards.push(card);
    else {
      const inCol = this.cards.filter((c) => c.col === col);
      const anchor = inCol[Math.min(toIndex, inCol.length - 1)];
      const at = anchor ? this.cards.indexOf(anchor) + (toIndex >= inCol.length ? 1 : 0) : this.cards.length;
      this.cards.splice(at, 0, card);
    }
    await this.save();
  }
  async remove(ids) {
    const list = Array.isArray(ids) ? ids : [ids];
    this.trash = this.cards.filter((c) => list.includes(c.id));
    this.cards = this.cards.filter((c) => !list.includes(c.id));
    await this.save(); return this.trash;
  }
  async undo() {
    if (!this.trash) return null;
    this.cards.push(...this.trash);
    const t = this.trash; this.trash = null;
    await this.save(); return t;
  }
  byCol(col) { return this.cards.filter((c) => c.col === col); }
  audit() {
    const chapters = this.projects.chapters();
    const linked = new Set(this.cards.map((c) => c.chapter).filter(Boolean));
    return {
      unplanned: chapters.filter((c) => !linked.has(c.id)),
      broken: this.cards.filter((c) => c.chapter && !chapters.some((ch) => ch.id === c.chapter)),
      coverage: chapters.length ? linked.size / chapters.length : 0,
    };
  }
}
