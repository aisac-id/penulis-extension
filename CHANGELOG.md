# Changelog

Semua perubahan penting pada Kalam dicatat di sini. Format mengikuti semantic versioning.

## 1.0.0 — 2026-11-16

Rilis pertama. Ruang kerja penulis buku lengkap di sidebar Chrome, patuh Harness Extension Standard v1.5.

### Ditambahkan
- **Cangkang**: sidebar Shadow DOM di pinggir kanan selebar 25% viewport (min 280 / maks 420 px), rail ikon vertikal 48 px, mode layar penuh, pintasan `Alt+Shift+S` / `Alt+Shift+F` / `Esc`, panel malas-dimuat, tema gelap/terang/ikut sistem, Kalam Studio di tab penuh.
- **13 tab**: Naskah, Rencana, Tokoh, Dunia, Riset, Data, Target & Ritme, Analisis, Asisten AI, Ekspor & Kirim, Otomatisasi, Koneksi, Pengaturan.
- **Menulis**: proyek multi-buku, bab dan adegan, editor dengan autosave, mode fokus, typewriter, snapshot versi (Ctrl+S), penanda dialog, hitung kata langsung, pencarian isi naskah, filter status, empat mode urutan, drag susun ulang, aksi massal, tampilan tersimpan, dan urungkan setelah hapus.
- **Rencana**: papan gabus drag-and-drop, lima template alur (Tiga Babak, Save the Cat, Kishōtenketsu, Perjalanan Pahlawan, Nonfiksi), audit cakupan dan tautan rusak, beat jadi bab.
- **Bible**: tokoh (want/need/wound/voice/arc) dengan grafik kemunculan per bab, latar dengan detail sensorik, kronologi bertanggal dengan deteksi tabrakan, aturan dunia.
- **Riset & Data**: lima scraper (teks/tabel, gambar, novel multi-bab, berkas, teks terpilih) → satu DataPipeline → LibraryStore IndexedDB (kuota 500 MB, peringatan 80%), provenance per item, sitasi Chicago/APA/MLA, dedupe, pratinjau, catatan/tag, ekspor JSON/CSV/Markdown/TXT/EPUB/ZIP, kliping manual, pencarian Wikipedia.
- **Target & Ritme**: target harian/buku, streak, rata-rata 7 hari, proyeksi selesai, tekanan tenggat, grafik batang + heatmap, sprint dengan cincin waktu, pengingat lewat `chrome.alarms`.
- **Analisis**: pemeriksa gaya (kalimat/paragraf panjang, kata ulang, pasif, adverbia, klise, kata filter) dengan perbaikan otomatis yang bisa diurungkan, pemeriksa konsistensi, statistik keterbacaan, delapan ambang live.
- **Asisten AI**: LlmHub multi-provider (lokal heuristik, OpenAI-compatible, Anthropic, Gemini, Ollama) dengan rantai fallback, streaming, batas biaya harian, pencatat token, sakelar privasi per tugas, delapan resep prompt yang bisa disunting.
- **Ekspor & Kirim**: Markdown/TXT/JSON/HTML/EPUB/DOCX/ZIP tanpa dependensi eksternal, opsi daftar isi/sinopsis/bio/sampul, pratinjau, pelacak pengiriman penerbit, pembuat surat query.
- **Otomatisasi (RPA)**: RpaEngine + SelectorEngine berjenjang (data-* → id → aria → CSS → XPath → teks) + ActionLibrary + ScriptStore, perekam langkah, lima template, jeda/lanjut/berhenti, retry 3, timeout 10 s, pacing 300–800 ms, auto-pause saat situs menolak, ekspor/impor skrip JSON.
- **Koneksi**: ConnectionHub dengan semua konektor default OFF — Platform Bridge (HTTPS + ingest token + idempotencyKey + outbox + auto-pause), Local Bridge (ws://127.0.0.1 + pairing token + daftar putih perintah), Native Messaging (companion Python + installer Linux/macOS/Windows), Wikipedia.
- **Pengaturan**: 79 pengaturan dalam 9 kategori, pencarian, validasi, reset per kategori dan global dengan urungkan, ekspor/impor JSON tanpa rahasia, impor `.env`, log developer.
- **Keamanan**: SecretVault AES-GCM 256 + PBKDF2 600.000 putaran, ciphertext saja, nama tersamar, kunci otomatis 30 menit, izin minimum, host permission opsional.
- **Onboarding**: 12 langkah bernomor dengan aksi nyata, tur coach-mark 4a–4f pada elemen asli, halaman demo bawaan, resume/skip/kembali, bisa diulang dari Pengaturan.
- **Lisensi**: LicenseService Ed25519 offline, edisi Gratis/Pro/Bundle Studio/Enterprise, uji coba 14 hari, grace offline, data pengguna tidak pernah terkunci, white-label.
- **Demo & seed**: proyek contoh "Hujan di Ujung Jalan" (12 bab, 6 tokoh, 5 latar, 8 peristiwa, 10 kartu rencana, 6 kliping riset berprovenance, riwayat target) dan halaman demo lokal berisi artikel, tabel, galeri, formulir, serta berkas unduhan.

### Kemasan
- `extension/` sumber terbaca (121 berkas, ≤300 baris/berkas); `npm run build` memadatkan tanpa bundling menjadi `dist/extension` **483,2 KiB (494.777 byte)** (batas Harness 500 KB) dan `dist/companion` untuk native messaging.
- `npm run check` mengaudit batas baris, sintaks tiap modul, larangan eval/CDN/TODO, dan ukuran paket.

### Verifikasi rilis
- Semua file `.js`/`.css`/`.html` ≤ 300 baris; `node --check` lolos untuk seluruh modul.
- Chromium nyata (Chrome for Testing 152, headless): **16/16 langkah alur penulis lulus, 0 error runtime** — tutorial 12 langkah selesai, aktivasi lisensi Ed25519 offline (edisi Pro), editor menulis + autosave (741→757 kata), data bertahan setelah muat ulang, panen halaman demo (11 item), tabel Data + drawer detail, unduhan EPUB/DOCX/Markdown nyata, RPA demo selesai (5 hasil), asisten lokal menjawab, ambang analisis live mengubah temuan (59→75), pencarian pengaturan, hapus massal + urungkan (12→10→12), tata letak desktop/tablet/ponsel × sidebar/rail/fullscreen tanpa overflow dokumen.
- **Sapuan 306 tombol** di 13 panel: 0 error runtime, 0 teks `undefined`/`NaN`/`[object Object]`.
- Injeksi pada halaman web nyata: sidebar **tepat 25% viewport (360/1440 px)** menempel kanan, rail **48 px**, `Esc` menutup, buka ulang tanpa host ganda, ponsel 390 px lebar 280 px tanpa overflow horizontal.
- Berkas unduhan diperiksa isinya: EPUB `mimetype` stored sebagai entri pertama + seluruh XML sah; DOCX OOXML sah (49 paragraf); Markdown 7.402 karakter.