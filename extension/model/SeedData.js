import { today } from "../sidebar/ui/Dom.js";

const day = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10); };
const ch = (n, title, part, status, pov, place, time, summary, paras) => ({
  id: `ch${n}`, order: n, title, part, status, pov, place, time, summary,
  scenes: [{ id: `ch${n}s1`, title: "Adegan 1", status: status === "idea" ? "idea" : "draft", text: paras.join("\n\n") }],
});
const ev = (id, when, what, place, chapter) => ({ id, when, what, place, chapter });
const clip = (id, dataset, title, text, path, at, note, tags) => ({ id, dataset, type: "text", title, text, url: `https://arsipContoh.example.org/${path}`, source: "Arsip Contoh (halaman demo)", capturedAt: day(at), note, tags });
const person = (id, name, alias, role, age, tone, want, need, wound, voice, arc, tags, first) => ({ id, name, alias, role, age, tone, want, need, wound, voice, arc, tags, first });
const place = (id, name, kind, senses, note, chapters) => ({ id, name, kind, senses, note, chapters });
const sub = (id, publisher, contact, sentAt, status, note, nextAt) => ({ id, publisher, contact, sentAt, status, note, nextAt });

export class SeedData {
  static project() {
    return {
      id: "prj_hujan", title: "Hujan di Ujung Jalan", genre: "Fiksi sastra · keluarga", author: "Ratri Anindya",
      premise: "Seorang juru arsip pulang untuk mengurus rumah ibunya yang meninggal, dan menemukan bahwa yang paling sulit diarsipkan adalah keluarganya sendiri.",
      targetWords: 78000, deadline: day(74), createdAt: day(-28), chapters: SeedData.chapters(),
    };
  }
  static chapters() {
    return [
      ch(1, "Kunci yang Tidak Cocok", "Babak 1", "selesai", "Laras", "Rumah Jalan Kenanga 14", "Sore, Maret", "Laras pulang setelah sebelas tahun; kunci warisan tidak bisa membuka pintu rumahnya sendiri.", [
        "Hujan turun seperti orang yang sudah lama menahan sesuatu. Laras berdiri di depan pintu rumah ibunya dengan koper yang rodanya sudah tidak mau berputar, dan menyadari bahwa kunci di tangannya bukan kunci pintu ini.",
        "“Cari yang di bawah pot,” kata Pak Darto dari seberang pagar, tetangga yang dulu mengajarinya naik sepeda, berdiri dengan sarung dan payung bocor. “Ibumu selalu bilang, kalau kamu pulang, kamu pasti lupa.”",
        "Di dalam, bau rumah menyambutnya lebih dulu: kapur barus, minyak kayu putih, dan yang manis dan tua seperti kertas lama. Ia tidak menyalakan lampu; ia berdiri di ruang tamu sampai gelap benar-benar datang, seperti orang yang menunggu izin.",
      ]),
      ch(2, "Kotak-kotak di Kamar Belakang", "Babak 1", "selesai", "Laras", "Kamar belakang", "Malam pertama", "Empat puluh dua kotak arsip ibu, berlabel tulisan tangan yang rapi.", [
        "Ibumu seorang juru tulis di kantor kecamatan, tetapi di rumah ia seorang juru arsip. Empat puluh dua kotak kardus, masing-masing dengan label: KWITANSI 1998–2003. SURAT DARI ORANG YANG TIDAK PERLU DIJAWAB. FOTO YANG ADA BAPAKMU.",
        "Laras membuka yang terakhir lebih dulu, karena ia pengecut dengan cara yang teratur. Di dalamnya bukan foto keluarga: seorang lelaki di depan toko fotokopi, memicingkan mata ke matahari, tangan menutupi lensa. Di belakangnya, pensil: Soekarjo, 1991, sebelum.",
        "Sebelum apa, Bu? Ia menutup kotak itu dan menuliskan pertanyaan tersebut di buku catatan dari Jakarta, pada halaman berjudul: HAL-HAL YANG TIDAK BISA DITANYAKAN LAGI.",
      ]),
      ch(3, "Kota yang Mengecil", "Babak 1", "revisi", "Laras", "Pasar Wage", "Pagi, hari kedua", "Kota masa kecilnya lebih kecil dari ingatan, dan itu menyakitkan.", [
        "Pasar Wage ternyata hanya dua lorong dan satu lapangan becek. Dalam ingatannya, pasar ini adalah kota dengan pemerintah sendiri, dengan bau dan bahasa dan hierarki. Kini ujungnya terlihat dari pangkalnya.",
        "“Cari apa, Mbak?” Penjual bumbu itu tidak mengenalinya, dan Laras bersyukur sekaligus tersinggung. “Kemangi.” “Buat apa?”",
        "Pertanyaan itu tidak pernah ditanyakan di Jakarta. Di sana kemangi adalah barang; di sini kemangi adalah rencana makan siang, dan orang berhak tahu rencana makan siangmu. Ia membeli terlalu banyak, lalu berpikir bahwa duka mungkin bukan kehilangan orang, melainkan kehilangan orang-orang yang tahu untuk apa kita membeli kemangi.",
      ]),
      ch(4, "Adik yang Tidak Menunggu", "Babak 1", "revisi", "Laras", "Ruang tamu", "Malam, hari ketiga", "Bagas datang, menolak ikut sentimental; ia sudah menjual sebagian tanah.", [
        "Bagas datang dengan motor yang knalpotnya sengaja dibesarkan, seolah ingin seluruh jalan tahu bahwa ia tidak datang diam-diam. “Kakak tidur di kamar Ibu?” “Di kamarku.”",
        "“Bagus. Kamar itu sudah aku bersihkan dua kali. Kakak tahu berapa lama aku di sini sebelum Kakak datang? Dua tahun, Kak. Dua tahun aku yang antar dia ke rumah sakit, sementara Kakak kirim uang.”",
        "Laras ingin mengatakan bahwa uang itu juga bentuk hadir — kalimat yang ia siapkan sebelas tahun, dan kini terasa seperti kwitansi yang dibawa ke pemakaman. “Tanah belakang sudah aku lepas,” kata Bagas. “Buat modal bengkel. Ibu setuju.”",
      ]),
      ch(5, "Surat yang Tidak Perlu Dijawab", "Babak 2", "draft", "Laras", "Kamar belakang", "Subuh", "Tiga puluh satu surat dari ayah, semuanya bertanggal Maret.", [
        "Tiga puluh satu surat, semuanya bertanggal Maret. Tidak ada satu pun yang dibuka dengan nama. Semuanya dimulai dengan hal kecil: harga beras, kucing yang mati, jalan yang diaspal. Ayahnya menua dalam laporan-laporan tentang hal yang tidak penting.",
        "Di surat terakhir, 2009: “Kalau Laras nanti tanya, bilang saja Bapak pergi karena pekerjaan. Jangan bilang yang sebenarnya. Anak umur delapan tahun tidak perlu tahu bahwa orang bisa memilih untuk tidak tinggal.” Yang ia rasakan bukan marah, melainkan kasihan pada ibunya yang menyimpan kalimat itu dua puluh tahun lebih.",
      ]),
      ch(6, "Pak Darto Bicara Terlalu Banyak", "Babak 2", "draft", "Laras", "Teras Pak Darto", "Sore", "Tetangga lama membuka cerita yang seharusnya tetap tertutup.", [
        "“Ibumu itu perempuan yang keras,” kata Pak Darto, menuang teh terlalu manis. “Bukan keras yang jahat. Keras yang menahan.” “Menahan apa?” Pak Darto minum dulu; orang tua di kota ini selalu minum dulu sebelum mengatakan hal yang mengubah hidup orang lain.",
        "“Bapakmu tidak pergi, Laras. Bapakmu diminta pergi.” Gelas di tangan Laras tidak jatuh. Ia justru meletakkannya dengan sangat hati-hati, seperti orang yang tahu bahwa satu gerakan salah akan membuat seluruh sore ini pecah.",
      ]),
      ch(7, "Arsip Kecamatan", "Babak 2", "draft", "Laras", "Kantor kecamatan", "Pagi", "Ia memakai keahliannya sebagai juru arsip untuk melacak keluarganya sendiri.", [
        "Ada kepuasan yang memalukan dalam bekerja. Selama empat jam ia bukan anak siapa pun; ia hanya orang yang tahu bahwa dokumen tahun 1990-an disimpan berdasarkan nomor, bukan nama.",
        "Ia menemukan surat permohonan perubahan nama pada 1993. Pemohon: Soekarjo. Alasan: “kesalahan penulisan pada akta lama”. Nama baru: Sutarjo. Ayahnya tidak hanya pergi; ia mengganti namanya, dua huruf saja — cukup untuk membuat seorang anak gagal mencari ayahnya selama dua puluh tahun.",
      ]),
      ch(8, "Hujan Kedua", "Babak 2", "draft", "Bagas", "Bengkel", "Malam", "Sudut pandang Bagas: ia tahu lebih banyak daripada yang ia katakan.", [
        "Bagas tahu soal nama itu sejak umur tujuh belas, menemukannya di kotak yang sama, dan memutuskan untuk tidak memberi tahu Laras. Bukan karena jahat: kalau Laras tahu, Laras akan pulang, dan Bagas akan kembali jadi adik — peran yang tidak punya hak atas apa pun, bahkan atas lelah.",
        "Ia mengencangkan baut yang tidak perlu dikencangkan. Di radio, penyiar bilang hujan akan turun sampai akhir bulan. Bagas berharap hujan tidak berhenti, supaya tidak ada yang pulang dan tidak ada yang pergi.",
      ]),
      ch(9, "Nama di Batu Nisan", "Babak 3", "idea", "Laras", "Pemakaman Karangmalang", "Pagi", "Makam ayah memakai nama baru.", []),
      ch(10, "Percakapan yang Terlambat", "Babak 3", "idea", "Laras", "Rumah", "Sore", "Berdamai dengan cara tidak rapi.", []),
      ch(11, "Mengarsipkan Ibu", "Babak 3", "idea", "Laras", "Kamar belakang", "Sepanjang hari", "Kotak dipilah: simpan, bakar, berikan.", []),
      ch(12, "Kunci Baru", "Babak 3", "idea", "Laras", "Depan rumah", "Sore, hujan", "Kunci baru; salinan untuk Bagas.", []),
    ];
  }
  static characters() {
    return [
      person("c_laras", "Laras Prameswari", "Laras", "Protagonis", 30, "cyan", "Tuntaskan rumah Ibu.", "Ia pulang karena takut.", "Ayah hilang saat ia 8.", "Pendek, presisi.", "Arsip jadi hidup.", ["juru arsip"], "ch1"),
      person("c_bagas", "Bagas Prayoga", "Bagas", "Deuteragonis", 26, "amber", "Bengkel diakui sebagai kerja.", "Berhenti mengukur kasih.", "Merawat Ibu 2 tahun.", "Sarkasme defensif.", "Rahasia jadi bagian.", ["adik"], "ch4"),
      person("c_ibu", "Sulastri", "Ibu", "Almarhum, pusat cerita", 64, "magenta", "Anak-anak tak benci.", "Diakui yang memilih.", "Meminta suami pergi.", "Lewat label kotak.", "Ideal jadi manusia.", ["almarhum"], "ch2"),
      person("c_ayah", "Soekarjo / Sutarjo", "Bapak", "Antagonis struktural", 71, "violet", "Hidup tanpa dijelaskan.", "Dilihat sebagai orang.", "Dipersilakan pergi.", "Surat laporan kecil.", "Mitos jadi catatan.", ["surat"], "ch2"),
      person("c_darto", "Pak Darto", "Pak Darto", "Pembuka rahasia", 78, "lime", "Menebus diam 20 tahun.", "Lepas beban orang lain.", "Ia mengantar Soekarjo.", "Menunda dengan teh.", "Ramah jadi saksi.", ["tetangga"], "ch1"),
      person("c_ratna", "Bu Ratna", "Bu Ratna", "Sekutu", 55, "teal", "Kertas tetap dihormati.", "Cukup tanpa jabatan.", "Pernah menolak permohonan.", "Datar, humor kering.", "Birokrat jadi pintu.", ["kecamatan"], "ch7"),
    ];
  }
  static places() {
    return [
      place("p_rumah", "Rumah Jalan Kenanga 14", "Rumah", "Kapur barus, kayu putih.", "Kunci di bawah pot geranium.", ["ch1", "ch4", "ch10", "ch12"]),
      place("p_kamar", "Kamar belakang (arsip)", "Ruang", "Debu kardus, neon, tinta.", "42 kotak; label tangan.", ["ch2", "ch5", "ch11"]),
      place("p_pasar", "Pasar Wage", "Publik", "Becek, kemangi, ikan asin.", "Dua lorong; kecil di ingatan.", ["ch3"]),
      place("p_kecamatan", "Kantor kecamatan", "Institusi", "Kipas berderit, stempel basah.", "Register diurut nomor.", ["ch7"]),
      place("p_makam", "Pemakaman Karangmalang", "Luar ruang", "Rumput basah, kamboja, nisan pudar.", "Blok C: Sutarjo.", ["ch9"]),
    ];
  }
  static events() {
    return [
      ev("e1", "1991-06-12", "Foto Bapak di fotokopian", "Toko foto", "ch2"),
      ev("e2", "1993-02-04", "Ganti nama jadi Sutarjo", "Kecamatan", "ch7"),
      ev("e3", "2009-03-18", "Surat terakhir Bapak", "Rumah", "ch5"),
      ev("e4", "2009-03-20", "Darto mengantar Bapak", "Terminal", "ch6"),
      ev("e5", day(-26), "Ibu meninggal", "RSUD", "ch1"),
      ev("e6", day(-3), "Laras tiba; kunci tak cocok", "Rumah", "ch1"),
      ev("e7", day(-1), "Bagas mengaku menjual tanah", "Ruang tamu", "ch4"),
      ev("e8", day(0), "Makam baru ditemukan", "Karangmalang", "ch9"),
    ];
  }
  static outline() {
    const card = (id, col, title, desc, chapter) => ({ id, col, title, desc, chapter: chapter || "" });
    return [
      card("o1", "act1", "Dunia normal yang palsu", "Laras di Jakarta; keluarga senyap.", "ch1"),
      card("o2", "act1", "Panggilan pulang", "Ibu meninggal; Laras cuti.", "ch1"),
      card("o3", "act1", "Penolakan pertama", "Kunci tak cocok: penghuni lama.", "ch1"),
      card("o4", "act1", "Sekutu tak terduga", "Pak Darto tahu letak kunci.", "ch1"),
      card("o5", "act2", "Menelusuri arsip", "42 kotak; surat Maret; nama ganda.", "ch5"),
      card("o6", "act2", "Konflik saudara", "Bagas merawat, kakak kirim uang.", "ch4"),
      card("o7", "act2", "Titik tengah", "Pak Darto: 'Bapakmu diminta pergi.'", "ch6"),
      card("o8", "act2", "Semua hilang", "Makam bernama lain; ayah mati.", "ch9"),
      card("o9", "act3", "Pilihan sadar", "Surat utuh; tak menuntut.", "ch11"),
      card("o10", "act3", "Dunia baru", "Kunci baru, dua salinan.", "ch12"),
    ];
  }
  static clips() {
    return [
      clip("clip_arsip", "Riset arsip", "Prinsip provenance dalam penataan arsip keluarga",
        "Asas provenance: arsip disusun menurut asal penciptanya, bukan topik. Kotak surat Ibu tidak boleh dicampur surat Bapak; menyusun ulang menurut tema berarti menghapus jejak.",
        "arsip/provenance", -9, "Bab 7: pertengkaran soal urutan kotak.", ["arsip", "bab7", "konflik"]),
      clip("clip_nama", "Riset hukum", "Prosedur ganti nama lewat pengadilan negeri",
        "Ganti nama diajukan ke pengadilan negeri dengan alasan, akta kelahiran, dan KTP; akta baru memakai catatan pinggir berisi nama lama. Nama lama tidak hilang, hanya berpindah — paralel rahasia keluarga.",
        "hukum/ganti-nama", -8, "Cek: 1993 lewat kecamatan atau pengadilan?", ["hukum", "timeline", "perlu-verifikasi"]),
      clip("clip_pasar", "Riset budaya", "Lorong pasar Jawa: los kering, los basah, pelataran",
        "Los kering (kain, kelontong), los basah (ikan, daging), pelataran tikar pedagang musiman; bau berpindah mengikuti los. Paling ramai pukul 05.30–08.00 — detail untuk adegan Bab 3.",
        "budaya/pasar", -6, "Sensorik Bab 3: bau, bunyi, urutan los.", ["budaya", "bab3", "sensorik"]),
      clip("clip_duka", "Riset psikologi", "Duka dan benda: ikatan pada barang almarhum",
        "Continuing bonds: benda peninggalan menjadi jembatan berdialog dengan yang meninggal; melepasnya terlalu cepat terasa memutus percakapan. Karena itu tiap benda kotak Ibu satu keputusan.",
        "psikologi/duka", -4, "Tiap benda satu keputusan.", ["psikologi", "tema", "karakter"]),
      clip("clip_hujan", "Riset cuaca", "Hujan akhir musim di kota pesisir Jawa",
        "Hujan peralihan pesisir turun singkat dan deras sore hari; angin darat berbau laut; genangan bertahan sampai malam. Suara seng dan talang penanda waktu. Motif: hujan menandai keputusan tokoh.",
        "cuaca/pesisir", -3, "Motif hujan: Bab 1, 5, 11.", ["cuaca", "motif", "bab1"]),
      clip("clip_kotak", "Riset arsip", "Daftar isi kotak kayu Ibu (transkrip lapangan)",
        "Kotak 1: 42 surat 1958–1971 (Sutarjo). Kotak 2: kuitansi dan sertifikat. Kotak 3: 61 foto tanpa keterangan. Kotak 4: daftar nama tanpa tanggal. Kotak 5: kain batik dan satu kunci kecil tanpa label.",
        "arsip/kotak-ibu", -1, "Setup kunci kecil → bayar di Bab 11.", ["arsip", "setup", "bab11"]),
    ];
  }
  static activity() {
    const pattern = [420, 780, 0, 1120, 640, 910, 1340, 260, 0, 880, 1010, 720, 1490, 300, 950, 1180, 0, 640, 1260, 870, 540];
    const days = {};
    pattern.forEach((w, i) => { days[day(i - pattern.length + 1)] = w; });
    return { days, sessions: 34, sprints: 19, streak: 4, lastGoalHit: day(-1) };
  }
  static submissions() {
    return [
      sub("sub1", "Penerbit Gramedia Pustaka", "naskah@contoh.id", day(-12), "ditinjau", "Diminta 3 bab + sinopsis.", day(18)),
      sub("sub2", "Marjin Kiri", "redaksi@contoh.id", day(-20), "ditolak", "Ditolak; keluar katalog.", ""),
      sub("sub3", "Agen Literasi Nusantara", "agen@contoh.id", "", "disiapkan", "Butuh query letter.", day(6)),
    ];
  }
  static async install(store) {
    const project = SeedData.project();
    await store.set("projects", [project]);
    await store.set("activeProject", project.id);
    await store.set(`bible:${project.id}`, { characters: SeedData.characters(), places: SeedData.places(), events: SeedData.events(), rules: [
      { id: "r1", text: "Rahasia lewat benda." },
      { id: "r2", text: "Hujan menandai keputusan." },
      { id: "r3", text: "Tiap bab ada benda nyata." },
    ] });
    await store.set(`outline:${project.id}`, { template: "three", cards: SeedData.outline() });
    await store.set("activity", SeedData.activity());
    await store.set(`submissions:${project.id}`, SeedData.submissions());
    await store.set("seededAt", today());
    return project;
  }
}
