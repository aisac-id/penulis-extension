import { h, icon } from "./Dom.js";
import { Controls } from "./Controls.js";

export const HELP = {
  naskah: {
    title: "Naskah & bab",
    intro: "Editor bab: tulis naskah, atur adegan, simpan versi.",
    tips: [
      "Klik bab untuk membuka editor; autosave jalan tiap 2 detik.",
      "Tarik pegangan ⠿ atau tekan Alt+↑/↓ untuk mengurutkan bab.",
      "Ctrl+S menyimpan versi yang bisa dipulihkan lewat drawer detail.",
      "Tombol perluas (⛶) membuka mode layar penuh.",
    ],
    keys: [["Alt+Shift+S", "Rail ↔ sidebar"], ["Alt+Shift+F", "Layar penuh"], ["Esc", "Keluar mode penuh"], ["Ctrl+S", "Simpan versi"]],
  },
  rencana: {
    title: "Papan rencana",
    intro: "Papan gabus digital: kartu beat per babak, bisa digeser antar kolom.",
    tips: [
      "Pilih template struktur untuk mengisi kartu awal.",
      "Tarik kartu antar kolom; warna kolom mengikuti babak.",
      "Tautkan kartu ke bab agar rencana dan naskah tidak tercerai.",
    ],
    keys: [["Alt+↑/↓", "Geser kartu terpilih"], ["Enter", "Buka detail kartu"]],
  },
  karakter: {
    title: "Bible karakter",
    intro: "Kartu tokoh: peran, keinginan, luka, gaya bicara, busur perubahan.",
    tips: [
      "Isi 'suara' agar pemeriksa konsistensi menandai dialog yang melenceng.",
      "Nama dan alias dipakai untuk mendeteksi ejaan nama yang berbeda.",
      "Klik tokoh untuk detail lengkap + daftar bab kemunculannya.",
    ],
    keys: [],
  },
  dunia: {
    title: "Dunia & garis waktu",
    intro: "Tempat, aturan dunia, dan urutan peristiwa supaya kronologi konsisten.",
    tips: [
      "Tambahkan detail sensorik agar deskripsi tidak generik.",
      "Garis waktu mengurutkan peristiwa per bab; bentrok tanggal ditandai.",
      "Aturan dunia dipakai asisten AI saat merangkum atau memberi saran.",
    ],
    keys: [],
  },
  riset: {
    title: "Riset & kliping",
    intro: "Panen teks, gambar, dan tabel dari halaman terbuka, lengkap sumber.",
    tips: [
      "Buka halaman referensi lalu klik 'Panen halaman ini'; hasil masuk tab Data.",
      "Tiap kliping menyimpan URL, judul, dan waktu panen untuk sitasi.",
      "Kutip seperlunya dan tulis ulang dengan bahasa sendiri.",
    ],
    keys: [],
  },
  data: {
    title: "Data & library",
    intro: "Pratinjau, analisis, filter, dan ekspor semua hasil panen.",
    tips: [
      "Urutkan lewat judul kolom, cari lewat kotak pencarian, pilih massal.",
      "Ekspor: JSON, CSV, Markdown, TXT, EPUB, ZIP.",
      "Kuota library 500 MB; peringatan muncul di 80%.",
    ],
    keys: [],
  },
  target: {
    title: "Target & sprint",
    intro: "Target harian, sprint menulis, streak, dan proyeksi tanggal selesai.",
    tips: [
      "Sprint memakai timer nyata; kata selama sprint dihitung terpisah.",
      "Grafik batang menunjukkan target; batang hijau berarti tercapai.",
      "Proyeksi selesai dihitung dari rata-rata 7 hari terakhir.",
    ],
    keys: [["Spasi", "Mulai/jeda sprint (saat panel terbuka)"]],
  },
  analisis: {
    title: "Analisis gaya",
    intro: "Pemeriksaan mekanis: kalimat panjang, pasif, adverbia, klise, keterbacaan.",
    tips: [
      "Ambang pemeriksaan diubah di Settings → Analisis.",
      "Klik temuan untuk melompat ke kalimatnya di editor.",
      "Alat bantu, bukan vonis: kalimat pasif kadang pilihan terbaik.",
    ],
    keys: [],
  },
  asisten: {
    title: "Asisten penulis (AI)",
    intro: "Ringkas bab, cari lubang plot, buat variasi kalimat, tanya bible.",
    tips: [
      "Tanpa kunci API, mesin lokal (heuristik) tetap bekerja offline.",
      "Sambungkan penyedia AI di tab Koneksi; kunci tersimpan terenkripsi.",
      "Sakelar privasi OFF berarti naskah tak pernah dikirim ke cloud.",
    ],
    keys: [["Ctrl+Enter", "Kirim pertanyaan"]],
  },
  ekspor: {
    title: "Ekspor & penerbit",
    intro: "Keluarkan naskah jadi berkas siap kirim dan lacak status ke penerbit.",
    tips: [
      "Format: Markdown, TXT, HTML, EPUB 3, DOCX, dan cetak/PDF.",
      "Halaman judul, daftar isi, dan biodata diatur lewat sakelar.",
      "Pelacak penerbit mencatat tanggal kirim, balasan, dan tahap berikutnya.",
    ],
    keys: [],
  },
  rpa: {
    title: "Otomatisasi (RPA)",
    intro: "Rangkaian klik/ketikan pada halaman nyata, dengan jeda sopan.",
    tips: [
      "Pilih template, jalankan, pantau log; Pause/Stop selalu tersedia.",
      "Rantai cadangan selector: data-* → id → aria → CSS → XPath.",
      "Tidak ada bypass login/CAPTCHA; situs yang menolak memicu jeda.",
    ],
    keys: [],
  },
  koneksi: {
    title: "Koneksi",
    intro: "Penyedia AI, platform penulis, terminal lokal, dan aplikasi desktop.",
    tips: [
      "Impor berkas .env lewat Settings untuk mengisi banyak kunci sekaligus.",
      "Kunci dienkripsi AES-GCM 256 di perangkat; tak dikirim ke mana pun.",
      "Terminal lokal hanya menerima loopback dan perintah dalam whitelist.",
    ],
    keys: [],
  },
  settings: {
    title: "Pengaturan lengkap",
    intro: "Semua perilaku diatur di sini: cari, ubah, reset, ekspor/impor JSON.",
    tips: [
      "Perubahan langsung berlaku tanpa reload.",
      "Ekspor pengaturan tidak menyertakan kunci rahasia.",
      "Reset kategori hanya mengembalikan kategori itu.",
    ],
    keys: [],
  },
};

export class Help {
  constructor(modal, settings) {
    this.modal = modal;
    this.settings = settings;
  }

  button(panelId) {
    return Controls.iconButton("help", `Bantuan: ${HELP[panelId]?.title || "panel ini"}`, () => this.open(panelId));
  }

  open(panelId) {
    const d = HELP[panelId] || { title: "Bantuan", intro: "Panduan panel ini.", tips: [], keys: [] };
    const body = h("div", { class: "help" }, [
      h("p", { class: "help__intro", text: d.intro }),
      h("ul", { class: "help__tips" }, d.tips.map((t) => h("li", {}, [icon("check", 13), h("span", { text: t })]))),
      d.keys.length ? h("div", { class: "help__keys" }, [
        h("h5", { text: "Pintasan" }),
        ...d.keys.map(([k, v]) => h("div", { class: "keyrow" }, [h("kbd", { text: k }), h("span", { text: v })])),
      ]) : null,
      h("p", { class: "help__foot muted", text: "Tutorial 12 langkah bisa diulang dari Settings → Umum → Ulangi tutorial." }),
    ]);
    return this.modal.open({
      title: d.title, subtitle: "Panduan singkat", body, width: 460,
      actions: [{ label: "Mengerti", kind: "primary", value: true }],
    });
  }
}
