# Kalam — ruang kerja penulis buku di sidebar Chrome

**Kalam** adalah ekstensi Chrome (Manifest V3) untuk penulis buku: menulis naskah per bab, merencanakan alur, menjaga bible tokoh dan dunia, memanen riset dari halaman web lengkap dengan sumbernya, mengejar target kata harian, memeriksa gaya tulisan, meminta bantuan AI, lalu mengekspor naskah jadi EPUB/DOCX/Markdown dan mengirimkannya ke penerbit.

Semuanya hidup di **sidebar selebar 1/4 layar di pinggir kanan** halaman yang sedang Anda buka, dengan tab vertikal menurun di sisi kiri sidebar. Bisa diciutkan jadi rail ikon, atau dibuka layar penuh. Tanpa akun, tanpa server, tanpa build step — semua data tersimpan di perangkat Anda.

Dibangun mengikuti **Harness Extension Standard v1.5** (`aisac-id/harness-extension`).

---

## Daftar isi

- [Pasang (load unpacked)](#pasang-load-unpacked)
- [Tiga mode tampilan & shortcut](#tiga-mode-tampilan--shortcut)
- [13 tab dan gunanya](#13-tab-dan-gunanya)
- [Alur kerja lengkap seorang penulis](#alur-kerja-lengkap-seorang-penulis)
- [Penyimpanan, privasi, dan rahasia](#penyimpanan-privasi-dan-rahasia)
- [Penyedia AI](#penyedia-ai)
- [Otomatisasi (RPA) dan panen riset](#otomatisasi-rpa-dan-panen-riset)
- [Koneksi opsional & aplikasi pendamping](#koneksi-opsional--aplikasi-pendamping)
- [Edisi, lisensi, dan uji coba](#edisi-lisensi-dan-uji-coba)
- [Izin yang diminta dan alasannya](#izin-yang-diminta-dan-alasannya)
- [Batas etis, ToS, dan hak cipta](#batas-etis-tos-dan-hak-cipta)
- [Struktur repo](#struktur-repo)
- [Kepatuhan Harness v1.5](#kepatuhan-harness-v15)
- [Dukungan, pengembalian dana, dan kontribusi](#dukungan-pengembalian-dana-dan-kontribusi)

---

## Pasang (load unpacked)

1. Unduh/clone repo ini.
2. Buka `chrome://extensions`, aktifkan **Developer mode** (kanan atas).
3. Klik **Load unpacked**, pilih folder **`dist/extension/`** (paket padat, 483 KB) atau **`extension/`** (sumber terbaca, 637 KB). Keduanya berfungsi identik; `dist/extension` yang memenuhi batas ukuran Harness < 500 KB.
4. Sematkan ikon Kalam di toolbar. Buka situs mana pun, tekan **Alt+Shift+S**.
5. Tutorial 12 langkah muncul otomatis pada pemakaian pertama, lengkap dengan halaman demo bawaan (`extension/demo/index.html`) supaya Anda melihat hasil nyata dalam dua menit. Tutorial bisa diulang dari **Pengaturan → Umum → Mulai ulang tutorial**.

Tanpa konfigurasi apa pun, Kalam langsung berisi satu proyek contoh ("Hujan di Ujung Jalan", 12 bab, 6 tokoh, 5 latar, kronologi, papan rencana, kliping riset, dan riwayat target) supaya tidak ada layar kosong. Hapus kapan saja dari Pengaturan → Data.

**Kalam Studio** (tampilan layar penuh di tab sendiri): klik kanan ikon → *Buka Kalam Studio*, atau lewat tombol layar penuh di sidebar. Fungsinya identik, hanya lebih luas.

## Tiga mode tampilan & shortcut

| Mode | Lebar | Shortcut |
| --- | --- | --- |
| Rail | ±48 px, ikon saja | `Alt+Shift+S` (toggle rail ↔ sidebar) |
| Sidebar | 25% viewport, min 280 px / maks 420 px, pinggir kanan | `Alt+Shift+S` |
| Layar penuh | 100% viewport | `Alt+Shift+F` |
| Tutup | — | `Esc` |

Sidebar memakai Shadow DOM sehingga CSS situs tidak bocor masuk dan sebaliknya. Panel dibuat **lazy** — hanya tab yang Anda buka yang diinstansiasi. Tema gelap/terang/ikut sistem, ukuran font naskah, lebar baris, dan lebar sidebar semuanya bisa diatur.

## 13 tab dan gunanya

1. **Naskah** — daftar bab dengan status (Ide/Draf/Revisi/Selesai), pencarian judul *dan* isi naskah, filter status, urutan (urutan buku/jumlah kata/judul/status), drag untuk menyusun ulang bab, pilih banyak untuk ubah status atau hapus (dengan *Urungkan*), tampilan tersimpan, dan drawer detail bab. Editor per adegan: autosave, mode fokus, typewriter, snapshot versi, penanda dialog, hitung kata langsung.
2. **Rencana** — papan gabus (corkboard) drag-and-drop antar babak. Template siap pakai: Tiga Babak, Save the Cat, Kishōtenketsu, Perjalanan Pahlawan, Nonfiksi. Audit otomatis: bab tanpa rencana, tautan kartu rusak, cakupan rencana. Setiap beat bisa dijadikan bab atau ditulis ke naskah.
3. **Tokoh** — bible karakter: keinginan (*want*), kebutuhan (*need*), luka, suara bicara, busur perubahan, tag, dan grafik kemunculan per bab. Pencarian, filter peran, urutan, drag, hapus massal dengan undo.
4. **Dunia** — latar dengan detail sensorik, kronologi bertanggal, dan aturan dunia. Deteksi tabrakan kronologi, daftar bab yang memakai tiap latar, ringkasan dunia untuk asisten AI.
5. **Riset** — panen halaman nyata: teks/artikel, gambar, novel multi-bab, berkas, atau teks terseleksi. Sumber bisa halaman aktif atau halaman demo bawaan. Delapan kontrol hidup (jeda halaman, unduhan paralel, ukuran minimum gambar, batas bab, format ekspor, gaya sitasi, buang boilerplate, simpan provenance) langsung dipakai pada panen berikutnya. Ada kliping manual dan pencarian Wikipedia.
6. **Data** — perpustakaan hasil riset (IndexedDB): tabel dengan filter dataset/jenis, pencarian, urutan kolom, pilih banyak, pratinjau (gambar, teks, tabel), catatan dan tag, sitasi Chicago/APA/MLA, ekspor JSON/CSV/Markdown/TXT/EPUB/ZIP, deteksi duplikat, kuota dengan peringatan, dan undo setelah hapus (termasuk blob gambar).
7. **Target & Ritme** — target kata harian dan target buku, streak, rata-rata 7 hari, proyeksi selesai, tekanan tenggat, grafik batang 14 hari + heatmap, sprint menulis dengan cincin waktu dan jeda, catatan sesi, pengingat. Sembilan kontrol hidup.
8. **Analisis** — pemeriksa gaya (kalimat terlalu panjang, paragraf padat, kata berulang, pasif, adverbia, klise, kata filter) dengan tingkat keparahan, saran, dan perbaikan otomatis yang bisa diurungkan; pemeriksa konsistensi (nama, mata, warna, janji yang belum dibayar); statistik keterbacaan; delapan ambang batas yang bisa diubah dan langsung menghitung ulang.
9. **Asisten AI** — delapan resep siap pakai (ringkas bab, cari lubang alur, variasi kalimat, tanya naskah, sinopsis, surat query, kembangkan beat, cari nama) plus resep buatan sendiri. Streaming, riwayat, sisipkan hasil ke naskah atau simpan ke Data. Tanpa kunci API pun tetap jalan lewat mesin lokal di perangkat.
10. **Ekspor & Kirim** — Markdown, TXT, JSON, HTML, EPUB, DOCX, ZIP; opsi daftar isi, sinopsis bab, bio penulis, sampul, nama berkas; pratinjau sebelum unduh. Pelacak pengiriman ke penerbit/agen (status, tanggal kirim, tindak lanjut) dan pembuat surat query.
11. **Otomatisasi** — RPA: rekam atau susun langkah (klik, isi, tunggu, gulir, ekstrak, loop, kondisi), lima template siap pakai, jalankan di halaman aktif atau halaman demo, jeda/lanjut/berhenti, log langsung, ekspor/impor skrip JSON, dan delapan kontrol pacing yang hidup.
12. **Koneksi** — semua koneksi **default OFF**: penyedia AI, Platform Bridge (kirim data ke sistem Anda), Local Bridge (CLI di `127.0.0.1`), Native Messaging (aplikasi desktop), Wikipedia. Uji sambungan per koneksi, log, dan pemakaian biaya AI.
13. **Pengaturan** — 79 pengaturan dalam 9 kategori dengan pencarian, validasi, reset per kategori dan global (bisa diurungkan), ekspor/impor JSON (rahasia tidak ikut), impor `.env`, manajemen rahasia terenkripsi, lisensi, white-label, kuota data, dan log developer.

## Alur kerja lengkap seorang penulis

Buat buku → pilih template rencana → isi beat → jadikan bab → tulis di editor dengan sprint dan target harian → panen riset dan simpan dengan sumbernya → jaga tokoh/dunia tetap konsisten → jalankan analisis gaya → minta asisten menambal lubang alur → ekspor EPUB/DOCX → catat pengiriman ke penerbit. Semua langkah itu terjadi di sidebar yang sama, tanpa berpindah aplikasi.

## Penyimpanan, privasi, dan rahasia

- Naskah, bible, rencana, target, dan pengaturan: `chrome.storage.local`. Hasil riset dan gambar: IndexedDB (kuota bawaan 500 MB, peringatan pada 80%).
- **Tidak ada telemetri, tidak ada server Kalam.** Satu-satunya lalu lintas keluar adalah yang Anda sendiri minta: penyedia AI yang Anda pilih, situs yang Anda panen, atau koneksi yang Anda aktifkan.
- Kunci API/token disimpan di **SecretVault**: AES-GCM 256-bit, kunci diturunkan PBKDF2-SHA256 600.000 putaran. Yang tersimpan hanya ciphertext; nama rahasia ditampilkan tersamar; vault terkunci otomatis setelah 30 menit idle.
- Impor `.env` lewat Pengaturan (contoh: `.env.example`). `.gitignore` memblokir `.env*`. Rahasia tidak pernah masuk bundle, `chrome.storage.sync`, atau log.
- Ekspor pengaturan **tidak** menyertakan rahasia secara default.
- Sakelar privasi per tugas AI: bila aktif, isi naskah tidak dikirim ke penyedia awan; mesin lokal yang mengerjakan.

## Penyedia AI

Satu class per penyedia di `extension/llm/providers/`, kontrak seragam `listModels/chat/stream/testConnection`:

- **Lokal (bawaan, tanpa kunci)** — heuristik di perangkat: ringkasan, lubang alur, variasi kalimat, statistik gaya. Selalu tersedia.
- **OpenAI-compatible** — satu class untuk OpenAI, Groq, DeepSeek, Mistral, Together, OpenRouter, xAI, dan endpoint lain; cukup ubah Base URL + model.
- **Anthropic**, **Gemini**, **Ollama** (lokal di `127.0.0.1:11434`).

Ada rantai fallback (provider gagal → provider berikutnya), batas biaya harian, pencatat token dan estimasi biaya, serta uji sambungan. Menambah penyedia baru = menambah satu class ≤300 baris, tanpa mengubah `LlmHub`.

## Otomatisasi (RPA) dan panen riset

Mesin RPA membaca halaman seperti Anda melihatnya — bukan lewat API. Resolusi selector berjenjang: `data-*` → `id` → `aria` → CSS → XPath → teks. Retry 3 kali, timeout 10 detik, jeda antar aksi 300–800 ms dengan jitter, batas aksi per jam, dan **berhenti otomatis** bila halaman menunjukkan CAPTCHA/checkpoint/rate-limit. Tidak ada upaya melewati login, CAPTCHA, atau pemblokiran.

Semua scraper (`TextScraper`, `ImageScraper`, `NovelScraper`, `FileDownloader`, `SelectionScraper`) masuk ke **satu jalur** `DataPipeline` → `LibraryStore` → tab **Data**. Setiap item menyimpan provenance: URL, judul halaman, waktu panen, jenis, dan gaya sitasi pilihan Anda.

## Koneksi opsional & aplikasi pendamping

Semuanya mati sampai Anda nyalakan di tab Koneksi.

- **Platform Bridge** — HTTPS ke server Anda sendiri: `POST {url}/ingest` dengan envelope + `jobId` + `idempotencyKey`, outbox queue dengan backoff (selamat saat service worker mati), polling job lewat `chrome.alarms` (minimum 30 detik), auto-pause saat `blocked`. Ingest token sebaiknya *write-only* dan bisa diputar dari Pengaturan.
- **Local Bridge (CLI)** — WebSocket **hanya** `ws://127.0.0.1`, wajib pairing token, perintah masuk daftar putih (`pandoc`, `wordcount`, `open-folder`, `backup`), path dipenjara di folder kerja.
- **Native Messaging** — companion host Python dengan framing 4-byte little-endian, batas pesan 1 MB, operasi `saveFile`/`openFolder`/`ping`.

Pasang companion (opsional):

```bash
# Linux
bash extension/connectors/native-host/install-linux.sh
# macOS
bash extension/connectors/native-host/install-macos.sh
```

```powershell
# Windows (PowerShell biasa, tanpa admin)
powershell -ExecutionPolicy Bypass -File extension\connectors\native-host\install-windows.ps1
```

CLI loopback: `python3 extension/connectors/native-host/kalam-cli.py --port 8765 --token "<token-anda>"`, lalu masukkan port dan token yang sama di tab Koneksi. Folder kerja bawaan `~/Documents/Kalam` (ubah lewat `KALAM_FOLDER`).

## Edisi, lisensi, dan uji coba

| Edisi | Isi |
| --- | --- |
| **Gratis** | Naskah, editor, rencana, bible, target, analisis, riset, data, RPA, AI lokal, ekspor MD/TXT/JSON |
| **Pro** | Semua di atas + EPUB, DOCX, ZIP, AI awan, semua koneksi, proses massal, white-label |
| **Bundle Studio** | Pro + kerja tim, Platform Bridge, Native Messaging |
| **Enterprise** | Pro + SSO, audit, dukungan prioritas |

- Uji coba Pro **14 hari tanpa kartu kredit**, dimulai dari Pengaturan → Lisensi.
- Aktivasi **offline**: kode lisensi ditandatangani Ed25519 dan diverifikasi di perangkat (payload `edition, bundleId, seats, expiry, issuedTo`). Tidak ada panggilan server untuk aktivasi. Grace period offline ≥14 hari.
- **Data Anda tidak pernah dikunci.** Kalau lisensi habis, naskah, riset, dan ekspor MD/TXT/JSON tetap bisa dibuka dan diekspor. Yang terkunci hanya fitur tambahan.
- White-label: nama, warna, dan tautan bantuan bisa diganti (Pengaturan → Lanjutan) untuk penerbit/studio yang membeli bundle.
- Penerbit lisensi untuk pemilik produk: `node tools/license-issuer.mjs` (kunci privat jangan pernah masuk repo).

## Izin yang diminta dan alasannya

| Izin | Alasan |
| --- | --- |
| `storage`, `unlimitedStorage` | Menyimpan naskah, bible, dan pengaturan di perangkat |
| `activeTab` | Membaca halaman yang sedang Anda buka **hanya saat Anda meminta** (panen/RPA) |
| `scripting` | Menyuntikkan sidebar secara lazy ketika Anda menekannya |
| `alarms` | Pengingat menulis dan polling job (minimum 30 detik, bisa dimatikan) |
| `downloads` | Menyimpan hasil ekspor dan berkas unduhan |
| `contextMenus` | Klip teks terseleksi, buka sidebar, buka Studio |
| `nativeMessaging` *(opsional)* | Companion desktop, hanya bila Anda aktifkan |
| `clipboardWrite` *(opsional)* | Menyalin sitasi dan surat query |
| Host `https://*/*`, `http://127.0.0.1/*`, `http://localhost/*` *(opsional)* | Panen halaman dan koneksi loopback; diminta saat dibutuhkan, bukan saat pasang |

Tidak ada izin `<all_urls>` wajib, tidak ada akses ke riwayat, tab lain, atau kata sandi.

## Batas etis, ToS, dan hak cipta

- **Hak cipta riset.** Scraper mengambil materi yang terlihat di halaman Anda. Materi itu tetap milik pemiliknya. Kalam menyimpan sumber dan menyediakan sitasi supaya Anda mengutip secara sah; memakai ulang teks/gambar orang lain di buku komersial tanpa izin adalah tanggung jawab Anda. Kutipan pendek dengan atribusi umumnya wajar; menyalin satu bab utuh bukan.
- **ToS situs target.** Mengotomatiskan akun Anda sendiri (mengirim formulir, memanen berhalaman-halaman) bisa melanggar ketentuan situs tertentu dan berujung pembatasan akun. Risiko itu Anda sadari dan tanggung sendiri. Kalam memakai pacing sopan dan berhenti sendiri saat situs menolak.
- **Tanpa bypass.** Tidak ada pemecah CAPTCHA, tidak ada penyimpanan kata sandi situs, tidak ada penyamaran identitas. RPA hanya bekerja pada halaman yang sudah Anda buka dan Anda login sendiri.
- **Data pribadi.** Panen hanya yang Anda butuhkan. Kalam tidak mengunggah apa pun ke server Kalam.
- **AI.** Keluaran model bisa salah, termasuk fakta sejarah dan hukum. Verifikasi sebelum masuk naskah. Naskah Anda tidak dipakai untuk melatih apa pun oleh Kalam; kebijakan penyedia yang Anda pilih tetap berlaku.
- **Tanpa jaminan.** Perangkat lunak disediakan "sebagaimana adanya". Selalu simpan cadangan (Pengaturan → Data → Cadangkan semua). Penulis tetap pemilik penuh karyanya; Kalam tidak menuntut hak apa pun atas naskah Anda.

## Struktur repo

```
penulis-extension/
├── extension/            ← folder yang di-load unpacked (manifest.json di sini)
│   ├── background/       ServiceWorker MV3 tipis
│   ├── content/          Loader + ContentBridge (injeksi lazy, Shadow DOM)
│   ├── sidebar/          SidebarApp, rail vertikal, ui/, panels/ (13 panel)
│   ├── core/             MessageBus, StorageService, Settings, SecretVault, HttpClient
│   ├── model/            Project, Outline, Bible, Goal, Submission, View, SeedData
│   ├── analysis/         StyleChecker, ConsistencyChecker, TextStats
│   ├── editor/           EditorPane (adegan, autosave, snapshot)
│   ├── llm/              LlmHub, PromptLibrary, providers/
│   ├── rpa/              RpaEngine, SelectorEngine, ActionLibrary, ScriptStore, Templates
│   ├── scrapers/         ScraperHub + 5 scraper
│   ├── pipeline/         DataPipeline, LibraryStore, AnalysisService, ExportService, EPUB/DOCX/ZIP
│   ├── connectors/       ConnectionHub, Platform/Local/NativeBridge, web/, native-host/
│   ├── license/          LicenseService + Ed25519
│   ├── onboarding/       OnboardingFlow 12 langkah + coach-mark
│   ├── styles/           tokens, layout, base, overlays, panels, editor
│   ├── studio/           versi layar penuh di tab sendiri
│   ├── demo/             halaman demo lokal untuk tutorial & panen pertama
│   └── assets/           ikon + logo
├── tools/license-issuer.mjs
├── .env.example
└── README.md
```

## Kepatuhan Harness v1.5

- Setiap file `.js`/`.css`/`.html` **≤ 300 baris**; satu class utama per file, dependensi disuntik lewat constructor.
- ES module murni, **tanpa bundler, tanpa CDN, tanpa eval**, vanilla JS + Shadow DOM, font system stack, ikon SVG inline.
- Event-driven: `MutationObserver`/event DOM, periodik hanya `chrome.alarms` ≥30 detik dan bisa dimatikan; handler input/scroll di-debounce; animasi hanya `transform`/`opacity`; 0% CPU saat idle.
- Sidebar kanan 25% (min 280 / maks 420 px), tiga mode + shortcut, rail vertikal, panel lazy, listener dilepas saat ditutup.
- Pengaturan penuh tanpa angka ajaib di luar skema: pencarian, validasi, reset per kategori/global, ekspor/impor JSON, uji sambungan.
- Lapisan RPA lengkap + ekspor/impor JSON; konektor default OFF, loopback-only, pairing token, daftar putih perintah; Platform Bridge dengan idempotencyKey + outbox + auto-pause.
- Scraper → satu DataPipeline → LibraryStore IndexedDB → tab Data dengan provenance dan ekspor JSON/CSV/MD/TXT/EPUB/ZIP.
- LlmHub multi-provider + fallback + streaming + batas biaya + sakelar privasi per tugas.
- SecretVault AES-GCM + PBKDF2, impor `.env`, `.env.example`, `.gitignore`.
- Onboarding 12 langkah bernomor + guided tour + demo first-run, bisa dilewati/diulang.
- LicenseService Ed25519 offline, edisi + bundleId, uji coba 14 hari, data pengguna tidak terkunci, white-label.

Ukuran unpacked dan jumlah baris diverifikasi sebelum rilis; lihat `CHANGELOG.md`.

### Sumber terbaca + paket padat

Batas Harness (< 500 KB unpacked) dan batas keterbacaan (≤ 300 baris per file, satu class per file, nama jelas) dipenuhi bersamaan dengan dua folder:

- `extension/` — sumber yang diaudit: **121 berkas, 11.990 baris, 636,6 KB**, semua ≤ 300 baris.
- `dist/extension/` — hasil `npm run build`: **483,2 KiB / 494.777 byte (LULUS < 500 KB)**.

`tools/build.mjs` hanya **memadatkan** (terser: buang komentar/whitespace, `mangle.toplevel=false`, `keep_classnames`, `keep_fnames`; CSS dipadatkan; HTML dipadatkan tanpa mengubah isi `<pre>`/`<textarea>`/`<script>`/`<style>`). Tidak ada bundling, tidak ada penggantian nama class/fungsi, tidak ada dependensi runtime baru — struktur modul, `import`, dan nama class tetap sama sehingga tetap bisa ditelusuri. Skrip pendamping native messaging dikeluarkan ke `dist/companion/` (di luar folder extension yang diukur).

```bash
npm install        # hanya terser (devDependency)
npm run build      # extension/ → dist/extension + dist/companion, cetak ukuran & LULUS/GAGAL
npm run check      # audit: ≤300 baris, node --check tiap modul, tanpa eval/CDN/TODO, ukuran paket
npm run license    # terbitkan kode lisensi uji (Ed25519) untuk pengujian offline
```

## Dukungan, pengembalian dana, dan kontribusi

- **Bantuan**: tombol `?` di setiap panel membuka panduan kontekstual; Pengaturan → Umum bisa mengulang tutorial.
- **Bug/fitur**: buka issue di repo ini dengan langkah reproduksi, versi Chrome, dan (bila relevan) ekspor pengaturan JSON — **jangan sertakan rahasia atau naskah pribadi**.
- **Pengembalian dana**: pembelian lisensi digital dapat diminta kembali dalam 14 hari sejak aktivasi bila produk tidak bekerja seperti dijanjikan pada perangkat Anda; hubungi penjual dengan bukti pembelian. Data Anda tetap bisa diekspor kapan pun, tanpa lisensi aktif.
- **Kontribusi**: patuhi batas 300 baris per file, satu class per file, teks UI Bahasa Indonesia, tanpa dependensi runtime baru. Jalankan `node --check` pada setiap modul yang Anda ubah dan uji load-unpacked di Chrome sebelum mengirim PR.

Lisensi kode: MIT (`LICENSE`). Naskah contoh di `SeedData` dan halaman demo adalah karya fiksi asli untuk keperluan demonstrasi.