export const TEMPLATES = [
  {
    id: "kliping", name: "Kliping artikel riset", icon: "clip", tone: "cyan",
    desc: "Tunggu artikel siap, ambil paragraf, tandai bagian penting.", site: "Halaman artikel apa pun",
    steps: [
      { action: "waitForSelector", target: { data: "artikel", css: "article" }, label: "Tunggu artikel" },
      { action: "scroll", target: { data: "artikel", css: "article" }, label: "Gulir ke artikel" },
      { action: "extract", target: { css: "article p" }, as: "paragraf", label: "Ambil paragraf" },
      { action: "highlight", target: { css: "article p" }, label: "Tandai paragraf" },
      { action: "wait", value: 400, label: "Jeda singkat" },
    ],
  },
  {
    id: "tabel", name: "Ambil tabel statistik", icon: "database", tone: "violet",
    desc: "Ekstrak baris tabel jadi data siap tempel ke lampiran.", site: "Halaman dengan tabel (demo: data penduduk)",
    steps: [
      { action: "waitForSelector", target: { data: "tabel", css: "table" }, label: "Tunggu tabel" },
      { action: "scroll", target: { data: "tabel", css: "table" }, label: "Gulir ke tabel" },
      { action: "extract", target: { css: "table tbody tr" }, as: "baris", label: "Ambil baris" },
      { action: "extract", target: { css: "table thead th" }, as: "kolom", label: "Ambil kepala kolom" },
      { action: "highlight", target: { data: "tabel", css: "table" }, label: "Tandai tabel" },
    ],
  },
  {
    id: "moodboard", name: "Tandai gambar latar", icon: "eye", tone: "magenta",
    desc: "Sorot semua gambar referensi di halaman.", site: "Halaman galeri / artikel bergambar",
    steps: [
      { action: "waitForSelector", target: { css: "img" }, label: "Tunggu gambar" },
      { action: "loop", times: 3, label: "Gulir tiga layar", steps: [
        { action: "scroll", value: 700, label: "Gulir" },
        { action: "wait", value: 350, label: "Beri waktu memuat" },
      ] },
      { action: "highlight", target: { css: "figure img, article img" }, label: "Tandai gambar" },
      { action: "extract", target: { css: "figure img, article img" }, attr: "alt", as: "caption", label: "Ambil caption" },
    ],
  },
  {
    id: "kirim", name: "Isi formulir pengiriman", icon: "send", tone: "lime",
    desc: "Isi judul, penulis, genre, lalu klik kirim pada formulir demo.", site: "Formulir penerbit (demo, tanpa jaringan)",
    steps: [
      { action: "scroll", target: { data: "form", css: "form" }, label: "Gulir ke formulir" },
      { action: "type", target: { data: "field=judul", css: "#f-judul" }, value: "Hujan di Ujung Jalan", label: "Isi judul" },
      { action: "type", target: { data: "field=penulis", css: "#f-penulis" }, value: "Ratri Anindya", label: "Isi penulis" },
      { action: "type", target: { data: "field=sinopsis", css: "#f-sinopsis" }, value: "Seorang arsiparis kembali ke kota kecilnya dan menemukan surat yang tak pernah dikirim.", label: "Isi sinopsis" },
      { action: "select", target: { data: "field=genre", css: "#f-genre" }, value: "fiksi-sastra", label: "Pilih genre" },
      { action: "if", cond: { exists: { data: "setuju", css: "#f-setuju" } }, label: "Centang persetujuan bila ada", steps: [
        { action: "click", target: { data: "setuju", css: "#f-setuju" }, label: "Centang" },
      ] },
      { action: "click", target: { data: "kirim", css: "#f-kirim" }, label: "Kirim formulir" },
      { action: "waitForSelector", target: { data: "sukses", css: ".form-ok" }, label: "Tunggu konfirmasi" },
    ],
  },
  {
    id: "bab", name: "Ikuti tautan bab berikutnya", icon: "book", tone: "amber",
    desc: "Klik tautan 'bab berikutnya' — skrip berhenti saat halaman berpindah.", site: "Situs baca berbab (pastikan berhak menyalin)",
    steps: [
      { action: "waitForSelector", target: { data: "next", css: "a[rel=next]" }, label: "Tunggu tautan" },
      { action: "extract", target: { css: "article p" }, as: "bab", label: "Ambil isi bab ini" },
      { action: "click", target: { data: "next", css: "a[rel=next]" }, label: "Buka bab berikutnya" },
    ],
  },
];

export function blankScript(name = "Skrip baru") {
  return { id: `scr_${Date.now().toString(36)}`, name, desc: "", site: "", steps: [], createdAt: new Date().toISOString() };
}
