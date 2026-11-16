import { h } from "../sidebar/ui/Dom.js";
import { Controls } from "../sidebar/ui/Controls.js";
import { TOUR } from "./TourSteps.js";

const p = (text) => h("p", { class: "onb__lead", text });
const li = (items) => h("ul", { class: "onb__list" }, items.map((t) => h("li", { text: t })));

export class StepBodies {
  constructor(ctx, flow) {
    this.ctx = ctx;
    this.flow = flow;
  }

  build(n) {
    const fn = this[`s${n}`] || this.s12;
    return fn.call(this);
  }

  s1() {
    return {
      title: "Selamat datang di Kalam",
      text: "Ruang kerja penulis buku yang menempel di sisi layar: menulis, rencana, tokoh, riset, target, sampai kirim naskah ke penerbit.",
      node: li([
        "Yang dilakukan: menulis & menyunting naskah, menyimpan riset dari halaman yang Anda buka, mengekspor EPUB/DOCX.",
        "Yang tidak dilakukan: melewati login atau CAPTCHA, menyimpan kata sandi situs, mengirim naskah ke cloud tanpa izin Anda.",
        "Semua data tersimpan di perangkat Anda. Ekspor tetap bisa dipakai kapan pun.",
      ]),
      primary: "Mulai (2 menit)",
      run: async () => true,
    };
  }

  s2() {
    const s = this.ctx.settings;
    const node = h("div", { class: "stack" }, [
      this.ctx.controls.field(s.field("umum.bahasa"), s.get("umum.bahasa"), (v) => s.set("umum.bahasa", v)),
      Controls.segmented([["system", "Ikut sistem"], ["light", "Terang"], ["dark", "Gelap"]].map(([value, label]) => ({ value, label })), s.get("umum.tema"), async (v) => {
        await s.set("umum.tema", v);
        s.applyTheme(this.ctx.root);
      }),
      this.ctx.controls.field(s.field("umum.suara"), s.bool("umum.suara"), (v) => s.set("umum.suara", v)),
    ]);
    return { title: "Bahasa, tema, dan suara", text: "Ubah sekarang — tampilannya langsung berubah tanpa muat ulang.", node, primary: "Lanjut", run: async () => true };
  }

  s3() {
    const info = this.ctx.license.info();
    const input = h("textarea", { class: "onb__key", rows: 4, placeholder: 'Tempel kode lisensi (JSON bertanda tangan) di sini…', "aria-label": "Kode lisensi" });
    const node = h("div", { class: "stack" }, [
      h("div", { class: "row" }, [
        h("span", { class: `chip chip--amber`, text: `Uji coba Pro: ${info.trialDaysLeft} hari` }),
        h("span", { class: "chip", text: "Tanpa kartu kredit" }),
      ]),
      p("Pro membuka ekspor EPUB/DOCX, asisten AI cloud, dan konektor. Free tetap bisa menulis, riset, dan ekspor Markdown/TXT/JSON."),
      input,
      h("div", { class: "row" }, [
        h("button", {
          class: "btn btn--accent btn--sm", text: "Aktifkan kode",
          onclick: async () => {
            const r = await this.ctx.license.activate(input.value);
            this.ctx.toast[r.ok ? "ok" : "error"](r.detail);
            this.flow.mark("lisensi", r.ok);
            this.flow.repaint();
          },
        }),
        h("button", {
          class: "btn btn--ghost btn--sm", text: "Pakai contoh kode",
          onclick: async () => {
            const r = await this.ctx.license.demoKey();
            input.value = r;
            this.ctx.toast.info("Contoh kode dimuat. Klik Aktifkan kode.");
          },
        }),
      ]),
      p("Kode bisa dicetak di buku, disisipkan di deskripsi video, atau datang dari bundel. Verifikasi berjalan offline."),
    ]);
    return { title: "Lisensi atau uji coba", text: "Pilih salah satu; data Anda tetap milik Anda apa pun edisinya.", node, primary: "Lanjut", run: async () => true };
  }

  s4() {
    const node = h("div", { class: "stack" }, [
      p("Tur singkat menyorot tombol yang asli di sidebar ini. Anda boleh mencoba tombolnya di tengah tur."),
      h("div", { class: "onb__checklist" }, TOUR.map((t) => h("div", { class: "onb__check", text: t.title }))),
    ]);
    return {
      title: "Kenali tampilan",
      text: "Enam titik: rail tab, ciutkan, layar penuh, Data, Koneksi, dan Pengaturan.",
      node, primary: "Mulai tur",
      run: async () => { await this.flow.runTour(); return true; },
    };
  }

  s5() {
    const node = h("div", { class: "stack" }, [
      li(["Di halaman web mana pun: tekan Alt+Shift+S untuk sidebar, Alt+Shift+F untuk layar penuh, Esc untuk keluar.",
        "Di Studio (tab penuh) semua ini sudah aktif tanpa pintasan.",
        "Sidebar memakai 1/4 lebar layar dan bisa diciutkan jadi rail 48 piksel."]),
      h("div", { class: "row" }, [
        h("button", { class: "btn btn--ghost btn--sm", text: "Coba layar penuh sekarang", onclick: () => this.ctx.setMode("fullscreen") }),
        h("button", { class: "btn btn--ghost btn--sm", text: "Kembalikan ke sidebar", onclick: () => this.ctx.setMode("sidebar") }),
      ]),
      h("div", { class: "statusbar", text: this.ctx.pageLabel() }),
    ]);
    return { title: "Sidebar di halaman nyata", text: "Pastikan Anda bisa memunculkan dan menutupnya.", node, primary: "Sudah bisa", run: async () => true };
  }

  s6() {
    const log = h("div", { class: "onb__log", "aria-live": "polite" });
    const paint = () => {
      log.replaceChildren(...this.ctx.pipeline.steps.slice(-8).map((s) => h("div", { class: `log log--${s.level === "err" ? "err" : s.level === "ok" ? "ok" : s.level === "warn" ? "warn" : "info"}`, text: s.text })));
    };
    const off = this.ctx.bus.on("pipeline.step", paint);
    this.flow.onLeave(off);
    return {
      title: "Demo panen pertama",
      text: "Satu klik menjalankan scraper sungguhan pada halaman demo bawaan: artikel, tabel, dan gambar.",
      node: h("div", { class: "stack" }, [p("Inilah cara semua scraper bekerja: membaca halaman seperti Anda melihatnya, bukan lewat API."), log]),
      primary: "Jalankan demo",
      run: async () => {
        const r = await this.ctx.runDemo();
        paint();
        this.flow.mark("demo", r.added.length >= 3);
        return r.added.length >= 3;
      },
      done: () => this.ctx.library.items.length >= 3,
    };
  }

  s7() {
    return {
      title: "Lihat hasil di tab Data",
      text: "Buka satu item untuk melihat pratinjau, sumber, dan waktunya. Coba filter jenis atau kata kunci.",
      node: h("div", { class: "stack" }, [
        h("div", { class: "row" }, [
          h("button", { class: "btn btn--primary btn--sm", text: "Buka tab Data", onclick: () => this.ctx.openPanel("data") }),
          h("span", { class: "chip chip--cyan", text: `${this.ctx.library.items.length} item tersimpan` }),
        ]),
        p("Detail item terbuka di drawer. Di layar penuh, tabel dan galeri tampil lebih lebar."),
      ]),
      primary: "Sudah saya buka",
      run: async () => true,
      done: () => this.flow.state.done.detail,
    };
  }

  s8() {
    const sel = h("select", { "aria-label": "Format ekspor" }, [["json", "JSON (data mentah)"], ["csv", "CSV (Excel)"], ["markdown", "Markdown (kliping)"], ["zip", "ZIP (teks + gambar + sumber)"]]
      .map(([v, t]) => h("option", { value: v, text: t })));
    return {
      title: "Ekspor hasil riset",
      text: "Berkas benar-benar terunduh ke folder unduhan Anda.",
      node: h("div", { class: "stack" }, [sel, p("Hasil bisa dipakai di Excel, lampiran buku, atau sistem lain. Setiap item membawa sumber dan tanggal.")]),
      primary: "Ekspor sekarang",
      run: async () => {
        const items = this.ctx.library.items.slice(0, 30);
        if (!items.length) { this.ctx.toast.warn("Jalankan demo dulu di langkah 6."); return false; }
        const r = await this.ctx.exports.exportDataset(items, sel.value, "riset-demo");
        this.ctx.toast.ok(`Terunduh: ${r.filename}`);
        this.flow.mark("ekspor", true);
        return true;
      },
    };
  }

  s9() {
    const s = this.ctx.settings;
    const key = h("input", { type: "password", placeholder: "API key (opsional)", "aria-label": "API key penyedia AI" });
    const status = h("div", { class: "statusbar", text: "Mesin lokal aktif — asisten sudah bisa dipakai tanpa kunci." });
    return {
      title: "Sambungkan penyedia AI (opsional)",
      text: "Boleh dilewati. Tanpa kunci pun asisten tetap jalan memakai mesin lokal di perangkat Anda.",
      node: h("div", { class: "stack" }, [
        this.ctx.controls.field(s.field("koneksi.llmProvider"), s.get("koneksi.llmProvider"), (v) => s.set("koneksi.llmProvider", v)),
        key,
        h("div", { class: "row" }, [
          h("button", {
            class: "btn btn--ghost btn--sm", text: "Simpan kunci terenkripsi",
            onclick: async () => {
              const prov = s.get("koneksi.llmProvider");
              const name = { openai: "llm.openai", anthropic: "llm.anthropic", gemini: "llm.gemini", groq: "llm.groq", openrouter: "llm.openrouter" }[prov];
              if (!name || !key.value.trim()) { status.textContent = "Pilih penyedia cloud dan isi kunci dulu."; return; }
              await this.ctx.vault.unlock();
              await this.ctx.vault.set(name, key.value.trim());
              key.value = "";
              status.textContent = "Kunci dienkripsi di perangkat Anda (AES-GCM), tidak dikirim ke mana pun selain penyedia pilihan Anda.";
            },
          }),
          h("button", {
            class: "btn btn--ghost btn--sm", text: "Uji sambungan",
            onclick: async () => {
              const r = await this.ctx.llm.test(s.get("koneksi.llmProvider"));
              status.textContent = r.ok ? `Terhubung: ${r.detail}` : `Gagal: ${r.detail}`;
              this.flow.mark("llm", r.ok);
            },
          }),
        ]),
        status,
      ]),
      primary: "Lanjut", run: async () => true,
    };
  }

  s10() {
    const status = h("div", { class: "statusbar", text: "Semua konektor masih OFF. Nyalakan hanya yang Anda perlukan." });
    return {
      title: "Koneksi lain (opsional)",
      text: "Platform penulis, terminal lokal, dan aplikasi desktop. Semuanya bawaan mati.",
      node: h("div", { class: "stack" }, [
        h("button", { class: "btn btn--primary btn--sm", text: "Buka tab Koneksi", onclick: () => this.ctx.openPanel("koneksi") }),
        h("button", {
          class: "btn btn--ghost btn--sm", text: "Uji semua koneksi",
          onclick: async () => {
            const rs = await this.ctx.connections.testAll();
            status.textContent = rs.map((r) => `${r.id}: ${r.ok ? "OK" : r.detail}`).join(" · ");
            this.flow.mark("koneksi", rs.some((r) => r.ok));
          },
        }),
        status,
        p("Kunci dan token disimpan terenkripsi. Impor berkas .env lewat Pengaturan bila Anda sudah punya."),
      ]),
      primary: "Lanjut", run: async () => true,
    };
  }

  s11() {
    const log = h("div", { class: "onb__log", "aria-live": "polite" });
    const paint = (ev) => {
      log.append(h("div", { class: `log log--${ev.kind === "error" ? "err" : ev.kind === "ok" || ev.kind === "done" ? "ok" : "info"}`, text: `${ev.index || "·"} ${ev.text || ev.kind}` }));
      log.scrollTop = log.scrollHeight;
    };
    const off = this.ctx.bus.on("rpa.event", paint);
    this.flow.onLeave(off);
    return {
      title: "Otomatisasi klik pertama",
      text: "Jalankan template 'Kliping artikel riset' pada halaman demo. Tombol jeda dan berhenti bisa Anda coba saat berjalan.",
      node: h("div", { class: "stack" }, [
        h("div", { class: "row" }, [
          h("button", { class: "btn btn--ghost btn--sm", text: "Jeda", onclick: () => this.ctx.rpa.pause() }),
          h("button", { class: "btn btn--ghost btn--sm", text: "Lanjut", onclick: () => this.ctx.rpa.resume() }),
          h("button", { class: "btn btn--danger btn--sm", text: "Berhenti", onclick: () => this.ctx.rpa.stop() }),
        ]),
        log,
        p("Batas aman: bila situs menolak atau meminta CAPTCHA, skrip dijeda otomatis. Tidak ada bypass."),
      ]),
      primary: "Jalankan otomatisasi",
      run: async () => {
        const r = await this.ctx.runDemoScript("kliping");
        this.flow.mark("rpa", r.state === "done" || r.state === "stopped");
        return true;
      },
    };
  }

  s12() {
    const d = this.flow.state.done;
    const rows = [["Demo panen", d.demo], ["Detail item dibuka", d.detail], ["Ekspor berkas", d.ekspor], ["Penyedia AI", d.llm], ["Koneksi lain", d.koneksi], ["Otomatisasi pertama", d.rpa]];
    return {
      title: "Siap menulis",
      text: "Ringkasan yang sudah tersambung. Anda bisa mengulang tur ini kapan saja dari Pengaturan → Umum.",
      node: h("div", { class: "stack" }, [
        h("div", { class: "onb__checklist" }, rows.map(([label, ok]) => h("div", { class: `onb__check ${ok ? "is-done" : ""}`, text: `${ok ? "✓" : "•"} ${label}` }))),
        li(["Tombol ? di setiap panel membuka penjelasan panel itu.", "Pengaturan → Umum → Mulai ulang tutorial.", "Dokumentasi dan sumber terbuka di repositori proyek."]),
      ]),
      primary: "Mulai bekerja",
      run: async () => { await this.flow.finish(); return false; },
    };
  }
}