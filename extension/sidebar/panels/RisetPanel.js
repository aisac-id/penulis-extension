import { h, clear, num, bytes } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { SCRAPERS } from "../../scrapers/ScraperHub.js";
import { ExportService } from "../../pipeline/ExportService.js";

const KEYS = ["scraper.jedaHalamanMs", "scraper.paralelUnduh", "scraper.gambarMinPx", "scraper.maksBab",
  "scraper.formatDefault", "scraper.sitasiGaya", "scraper.boilerplate", "data.simpanProvenance"];

/** RisetPanel — panen halaman lewat satu pipeline, kliping manual, dan riset Wikipedia. */
export class RisetPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "riset";
    this.title = "Riset";
    this.icon = "clip";
    this.kind = "text";
    this.source = ctx.studio ? "demo" : "tab";
    this.dataset = "Riset";
    this.tags = "";
    this.cleanups = [];
    this.lastAdded = [];
  }

  async render(host) {
    this.host = host;
    this.cleanups.push(this.ctx.bus.on("pipeline.step", (row) => this.logRow(row)));
    this.cleanups.push(this.ctx.bus.on("pipeline.done", () => this.paintResult()));
    this.paint();
    return host;
  }

  refresh() { if (this.host) this.paint(); }

  paint() {
    const c = this.ctx;
    clear(this.host);
    this.logEl = h("div", { class: "log" });
    this.resultEl = h("div", { class: "stack" });
    this.host.append(
      this.sourceCard(),
      this.kindPicker(),
      this.runBar(),
      Controls.fieldset("Kendali panen (langsung berlaku)", KEYS.map((k) =>
        c.controls.field(c.settings.field(k), c.settings.get(k), async (v) => {
          try {
            await c.settings.set(k, v);
            c.toast.info(`${c.settings.field(k).label}: ${typeof v === "boolean" ? (v ? "aktif" : "mati") : v}`);
          } catch (err) { c.toast.error(err.message); this.paint(); }
        })), "Semua angka ini dipakai scraper pada panen berikutnya, tanpa membuka pengaturan."),
      this.logEl,
      this.resultEl,
      this.clipForm(),
      this.wikiCard(),
    );
    for (const row of c.pipeline.steps.slice(-14)) this.logRow(row);
    this.paintResult();
  }

  sourceCard() {
    const c = this.ctx;
    const seg = Controls.segmented([{ value: "tab", label: "Halaman ini" }, { value: "demo", label: "Halaman demo" }],
      this.source, (v) => { this.source = v; this.paint(); });
    return h("div", { class: "card" }, [
      h("div", { class: "card__head" }, [h("h4", { text: "Sumber panen" }), h("span", { class: "grow" }),
        Controls.iconButton("refresh", "Baca ulang halaman", async () => {
          const page = await this.page();
          c.toast.ok(`Terbaca: ${page.title || page.url}`);
        })]),
      seg,
      h("p", { class: "muted small", text: this.source === "demo" ? "Halaman demo bawaan: artikel, tabel, gambar, dan formulir siap dipanen." : c.pageLabel() }),
    ]);
  }

  kindPicker() {
    const grid = h("div", { class: "task-grid" });
    for (const s of SCRAPERS) {
      grid.append(h("button", {
        class: `task ${s.id === this.kind ? "is-active" : ""}`, type: "button",
        onclick: () => { this.kind = s.id; this.paint(); },
      }, [
        h("strong", { text: s.label }),
        h("small", { class: "muted", text: s.desc }),
      ]));
    }
    return grid;
  }

  runBar() {
    const c = this.ctx;
    const ds = h("input", { class: "input", value: this.dataset, placeholder: "Nama dataset", "aria-label": "Nama dataset" });
    ds.addEventListener("change", () => { this.dataset = ds.value.trim() || "Riset"; });
    const tg = h("input", { class: "input", value: this.tags, placeholder: "tag, tag lain", "aria-label": "Tag kliping" });
    tg.addEventListener("change", () => { this.tags = tg.value; });
    const list = h("select", { class: "input select", "aria-label": "Dataset yang sudah ada" },
      [h("option", { value: "", text: "— dataset baru —" }), ...c.library.datasets().map((d) => h("option", { value: d.name, text: `${d.name} (${d.count})` }))]);
    list.addEventListener("change", () => { if (list.value) { this.dataset = list.value; ds.value = list.value; } });
    return h("div", { class: "stack" }, [
      h("div", { class: "grid grid--2" }, [ds, tg]),
      list,
      Controls.toolbar([
        Controls.button("Panen sekarang", () => this.run(), { kind: "primary", iconName: "play" }),
        Controls.button("Hentikan", () => { c.pipeline.stop(); c.toast.warn("Panen dihentikan."); }, { iconName: "stop", small: true }),
        h("span", { class: "grow" }),
        Controls.button("Buka Data", () => c.openPanel("data"), { iconName: "database", small: true }),
      ]),
    ]);
  }

  async page() {
    const c = this.ctx;
    if (this.source === "demo") {
      const host = c.demoHost();
      host.hidden = false;
      return c.pages.demoPage(host);
    }
    return c.pages.page();
  }

  async run() {
    const c = this.ctx;
    if (c.pipeline.busy) { c.toast.warn("Panen lain sedang berjalan."); return; }
    const page = await this.page();
    const tags = this.tags.split(",").map((t) => t.trim()).filter(Boolean);
    const res = await c.pipeline.run(this.kind, page, {
      dataset: this.dataset, tags,
      fetchHtml: (url) => c.pages.fetchHtml(url),
      fetchBlob: (url) => c.pages.fetchBlob(url),
    });
    this.lastAdded = res.added || [];
    this.paintResult();
    if (res.ok) { c.sound.ok(); c.toast.ok(res.info); } else c.toast.error(res.info);
  }

  logRow(row) {
    if (!this.logEl?.isConnected) return;
    this.logEl.append(h("div", { class: `log__l log--${row.level === "err" ? "err" : row.level === "warn" ? "warn" : row.level === "ok" ? "ok" : "info"}` }, [
      h("span", { class: "log__t", text: new Date(row.at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) }),
      h("span", { text: row.text }),
    ]));
    while (this.logEl.childElementCount > 40) this.logEl.firstElementChild.remove();
    this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  paintResult() {
    if (!this.resultEl?.isConnected) return;
    const c = this.ctx;
    clear(this.resultEl);
    const items = this.lastAdded.length ? this.lastAdded : c.library.byDataset(this.dataset).slice(0, 6);
    const q = c.analysis.quality(items);
    this.resultEl.append(h("div", { class: "grid grid--2" }, [
      Controls.stat("Item dataset", num(c.library.byDataset(this.dataset).length), { tone: "cyan", sub: this.dataset, iconName: "database" }),
      Controls.stat("Kualitas riset", `${q.score}`, { tone: q.score >= 70 ? "lime" : "amber", sub: q.advice, iconName: "gauge" }),
    ]));
    if (!items.length) {
      this.resultEl.append(Controls.empty("Belum ada kliping", "Pilih jenis panen lalu tekan Panen sekarang, atau tempel kliping manual di bawah."));
      return;
    }
    for (const it of items.slice(0, 8)) {
      this.resultEl.append(h("div", { class: "clip" }, [
        h("strong", { class: "clip__src", text: `${it.title} · ${it.type}` }),
        h("span", { class: "clip__text", text: c.analysis.preview(it, 220) || "(berkas tanpa teks)" }),
        h("div", { class: "row" }, [
          Controls.chip(it.source || "lokal", "violet"),
          it.meta?.words ? Controls.chip(`${num(it.meta.words)} kata`, "cyan") : null,
          it.size ? Controls.chip(bytes(it.size), "ink") : null,
          h("span", { class: "grow" }),
          Controls.iconButton("quill", "Sisipkan ke naskah", () => c.insertToEditor(`${it.text}\n\n— sumber: ${it.url || it.source || "lokal"}`)),
          Controls.iconButton("copy", "Salin sitasi", async () => {
            const cite = ExportService.citation(it, c.settings.get("scraper.sitasiGaya"));
            await navigator.clipboard.writeText(cite).catch(() => {});
            c.toast.ok("Sitasi disalin.");
          }),
        ].filter(Boolean)),
      ]));
    }
  }

  clipForm() {
    const c = this.ctx;
    const title = h("input", { class: "input", placeholder: "Judul kliping", "aria-label": "Judul kliping" });
    const text = h("textarea", { class: "textarea", placeholder: "Tempel kutipan, catatan lapangan, atau hasil wawancara…", "aria-label": "Isi kliping" });
    const url = h("input", { class: "input", placeholder: "https://sumber… (opsional)", "aria-label": "URL sumber" });
    return Controls.fieldset("Kliping manual", [
      title, text, url,
      Controls.toolbar([
        Controls.button("Simpan ke dataset", async () => {
          if (!text.value.trim()) { c.toast.warn("Isi kliping masih kosong."); return; }
          const res = await c.pipeline.ingest({ type: "text", title: title.value.trim(), text: text.value, url: url.value.trim() },
            { dataset: this.dataset, tags: this.tags.split(",").map((t) => t.trim()).filter(Boolean), url: url.value.trim() });
          if (res.duplicate) { c.toast.info("Kliping ini sudah ada di dataset."); return; }
          this.lastAdded = [res.item];
          text.value = "";
          title.value = "";
          this.paintResult();
          c.sound.ok();
          c.toast.ok("Kliping tersimpan lengkap dengan sumber.");
        }, { kind: "primary", iconName: "plus" }),
        Controls.button("Ambil teks terpilih", async () => {
          const page = await this.page();
          if (!page.selection) { c.toast.warn("Blok dulu teks di halaman, lalu tekan tombol ini."); return; }
          text.value = page.selection;
          title.value = page.title || "Kliping terpilih";
          url.value = page.url || "";
          c.toast.ok("Teks terpilih dimuat ke formulir.");
        }, { iconName: "type", small: true }),
      ]),
    ], "Tetap lewat corong data yang sama: dedupe, provenance, dan kuota.");
  }

  wikiCard() {
    const c = this.ctx;
    const term = h("input", { class: "input", placeholder: "mis. Kota Lama Semarang", "aria-label": "Kata kunci Wikipedia" });
    const out = h("div", { class: "stack" });
    const on = c.settings.bool("koneksi.wikiAktif");
    return Controls.fieldset("Riset Wikipedia", [
      h("p", { class: "muted small", text: on ? "Adapter aktif. Hasil masuk dataset dengan tautan sumber." : "Adapter masih OFF. Nyalakan di tab Koneksi untuk memakai pencarian ensiklopedia." }),
      term,
      Controls.toolbar([
        Controls.button("Cari bahan", async () => {
          if (!on) { c.toast.warn("Nyalakan adapter Wikipedia di tab Koneksi."); c.openPanel("koneksi"); return; }
          if (!term.value.trim()) { c.toast.warn("Tulis kata kunci dulu."); return; }
          clear(out);
          out.append(h("p", { class: "muted small", text: "Mencari…" }));
          try {
            const clips = await c.connections.wikipedia.clips(term.value.trim(), 3);
            clear(out);
            for (const clip of clips) {
              const res = await c.pipeline.ingest(clip, { dataset: this.dataset, url: clip.url });
              out.append(h("div", { class: "clip" }, [
                h("strong", { class: "clip__src", text: clip.title }),
                h("span", { class: "clip__text", text: clip.text.slice(0, 240) }),
                Controls.chip(res.duplicate ? "sudah ada" : "tersimpan", res.duplicate ? "ink" : "lime"),
              ]));
            }
            this.lastAdded = c.library.byDataset(this.dataset).slice(0, 6);
            this.paintResult();
            c.toast.ok(`${clips.length} bahan riset masuk dataset.`);
          } catch (err) { clear(out); c.toast.error(err.message); }
        }, { iconName: "search", kind: "primary" }),
        Controls.button("Kelola koneksi", () => c.openPanel("koneksi"), { iconName: "plug", small: true }),
      ]),
      out,
    ]);
  }

  destroy() { for (const off of this.cleanups.splice(0)) off(); }
}