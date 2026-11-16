import { h, clear, num } from "../ui/Dom.js";
import { Controls } from "../ui/Controls.js";
import { ProjectService } from "../../model/ProjectService.js";

/** AsistenPanel — asisten penulis: resep tugas, jawaban mengalir, privasi per tugas, dan riwayat. */
export class AsistenPanel {
  constructor(ctx) {
    this.ctx = ctx;
    this.id = "asisten";
    this.title = "Asisten AI";
    this.icon = "spark";
    this.task = "ringkas";
    this.messages = [];
    this.busy = false;
    this.cleanups = [];
  }

  async render(host) {
    this.host = host;
    this.cleanups.push(this.ctx.bus.on("llm.usage", () => this.paintHead()));
    this.paint();
    return host;
  }

  refresh() { if (this.host) this.paint(); }

  paint() {
    const c = this.ctx;
    clear(this.host);
    this.head = h("div", { class: "stack" });
    this.chat = h("div", { class: "chat" });
    this.host.append(this.head, this.recipes(), this.contextForm(), this.chat, this.composer());
    this.paintHead();
    this.paintChat();
  }

  paintHead() {
    if (!this.head?.isConnected) return;
    const c = this.ctx;
    clear(this.head);
    const prov = h("select", { class: "input select", "aria-label": "Provider AI" },
      c.llm.list().map((p) => h("option", { value: p.id, text: p.label + (p.needsKey ? " (butuh kunci)" : "") })));
    prov.value = c.settings.get("koneksi.llmProvider");
    prov.addEventListener("change", async (e) => { await c.settings.set("koneksi.llmProvider", e.target.value); this.paintHead(); });
    const u = c.llm.usage;
    this.head.append(
      h("div", { class: "card" }, [
        h("div", { class: "card__head" }, [h("h4", { text: "Mesin asisten" }), h("span", { class: "grow" }),
          Controls.button("Uji", async () => {
            const r = await c.llm.test(c.settings.get("koneksi.llmProvider"));
            r.ok ? c.toast.ok(r.detail || "Sambungan sehat.") : c.toast.warn(r.detail || "Belum tersambung.");
          }, { small: true, iconName: "plug" })]),
        prov,
        c.controls.field(c.settings.field("koneksi.llmPrivasi"), c.settings.bool("koneksi.llmPrivasi"),
          async (v) => { await c.settings.set("koneksi.llmPrivasi", v); c.toast.info(v ? "Naskah boleh dikirim ke AI cloud." : "Semua tugas diproses di perangkat."); }),
        h("div", { class: "row" }, [
          Controls.chip(`${u.calls} panggilan hari ini`, "cyan"),
          Controls.chip(`$${u.cost.toFixed(3)} terpakai`, u.cost > 0 ? "amber" : "lime"),
          Controls.chip(`sisa batas $${c.llm.budgetLeft().toFixed(2)}`, "violet"),
        ]),
        h("p", { class: "muted small", text: "Tanpa kunci API pun asisten tetap jalan: mesin lokal membaca naskah, bible, dan gaya Anda di perangkat ini." }),
      ]),
    );
  }

  recipes() {
    const c = this.ctx;
    const grid = h("div", { class: "task-grid" });
    for (const p of c.prompts.list()) {
      grid.append(h("button", {
        class: `task ${p.id === this.task ? "is-active" : ""}`, type: "button", title: p.desc,
        onclick: () => { this.task = p.id; this.paint(); },
        oncontextmenu: (e) => { e.preventDefault(); this.editPrompt(p); },
      }, [h("strong", { text: p.label }), h("small", { text: p.desc })]));
    }
    grid.append(h("button", {
      class: "task", type: "button", onclick: () => this.editPrompt(null),
    }, [h("strong", { text: "+ Resep baru" }), h("small", { text: "Tulis prompt Anda sendiri" })]));
    return h("div", { class: "stack" }, [
      grid,
      h("div", { class: "row" }, [
        Controls.button("Ubah resep terpilih", () => this.editPrompt(c.prompts.get(this.task)), { small: true, iconName: "wrench" }),
        Controls.button("Kembalikan resep bawaan", async () => {
          if (!await c.modal.confirm("Kembalikan resep bawaan?", "Resep buatan Anda akan diganti delapan resep bawaan.", { okLabel: "Kembalikan" })) return;
          await c.prompts.reset();
          this.task = "ringkas";
          this.paint();
          c.toast.ok("Resep bawaan dipulihkan.");
        }, { small: true, iconName: "undo" }),
      ]),
    ]);
  }

  contextForm() {
    const c = this.ctx;
    const recipe = c.prompts.get(this.task);
    const needs = recipe?.needs || "selection";
    const box = h("div", { class: "stack" });
    this.vars = {};
    if (needs === "chapter") {
      const sel = h("select", { class: "input select", "aria-label": "Pilih bab" },
        c.projects.chapters().map((ch) => h("option", { value: ch.id, text: `${ch.title} · ${num(ProjectService.chapterWords(ch))} kata` })));
      const first = c.projects.chapters()[0];
      if (first) { sel.value = first.id; this.vars = { judul: first.title, teks: ProjectService.chapterText(first) }; }
      sel.addEventListener("change", () => {
        const ch = c.projects.findChapter(sel.value);
        this.vars = { judul: ch.title, teks: ProjectService.chapterText(ch) };
      });
      box.append(sel);
    } else if (needs === "question") {
      const q = h("input", { class: "input", placeholder: "mis. Apa luka masa lalu Ratri?", "aria-label": "Pertanyaan" });
      q.addEventListener("input", () => { this.vars = { pertanyaan: q.value }; });
      box.append(q);
    } else if (needs === "selection") {
      const t = h("textarea", { class: "textarea", placeholder: "Tempel kalimat atau paragraf yang ingin digarap…", "aria-label": "Teks terpilih" });
      t.addEventListener("input", () => { this.vars = { teks: t.value }; });
      box.append(t, Controls.button("Ambil dari editor", () => {
        const text = c.editor?.text || "";
        if (!text) { c.toast.warn("Buka satu bab di tab Naskah dulu."); return; }
        t.value = text.slice(-1200);
        this.vars = { teks: t.value };
        c.toast.ok("1200 karakter terakhir editor dimuat.");
      }, { small: true, iconName: "quill" }));
    } else {
      box.append(h("p", { class: "muted small", text: "Resep ini memakai data buku aktif: judul, premis, ringkasan bab, dan bible." }));
    }
    return Controls.fieldset(`Bahan untuk "${recipe?.label || "tugas"}"`, [box], recipe?.desc || "");
  }

  composer() {
    const c = this.ctx;
    this.input = h("textarea", {
      class: "textarea composer__in", placeholder: "Tanya apa saja tentang naskah Anda… (Enter kirim, Shift+Enter baris baru)",
      "aria-label": "Pertanyaan bebas",
    });
    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); this.sendFree(); }
    });
    return h("div", { class: "composer" }, [
      this.input,
      h("div", { class: "row" }, [
        Controls.button("Jalankan resep", () => this.run(this.task, this.vars), { kind: "primary", iconName: "spark" }),
        Controls.button("Tanya bebas", () => this.sendFree(), { iconName: "send", small: true }),
        Controls.button("Hentikan", () => { c.llm.stop(); this.busy = false; c.toast.warn("Jawaban dihentikan."); }, { iconName: "stop", small: true }),
        h("span", { class: "grow" }),
        Controls.iconButton("trash", "Bersihkan percakapan", () => { this.messages = []; this.paintChat(); c.toast.info("Percakapan dibersihkan."); }),
      ]),
    ]);
  }

  sendFree() {
    const q = this.input.value.trim();
    if (!q) { this.ctx.toast.warn("Tulis pertanyaan dulu."); return; }
    this.input.value = "";
    this.run("bebas", { pertanyaan: q, teks: q }, q);
  }

  async run(task, vars, label = null) {
    const c = this.ctx;
    if (this.busy) { c.toast.warn("Tunggu jawaban selesai atau tekan Hentikan."); return; }
    const recipe = c.prompts.get(task);
    this.messages.push({ role: "me", text: label || recipe?.label || task, at: Date.now() });
    const ai = { role: "ai", text: "", at: Date.now(), provider: "", task };
    this.messages.push(ai);
    this.paintChat();
    this.busy = true;
    try {
      const res = await c.llm.stream(task, vars, { onDelta: (d) => { ai.text += d; this.paintLast(ai); } });
      ai.provider = res.provider;
      ai.cost = res.cost || 0;
      this.paintChat();
      c.sound.ok();
      this.paintHead();
    } catch (err) {
      ai.text = `Gagal: ${err.message}`;
      ai.error = true;
      this.paintChat();
      c.toast.error(err.message);
    } finally { this.busy = false; }
  }

  paintChat() {
    if (!this.chat?.isConnected) return;
    clear(this.chat);
    if (!this.messages.length) {
      const hist = this.ctx.llm.history.slice(0, 4);
      this.chat.append(Controls.empty("Mulai dari satu resep",
        "Pilih resep di atas, lengkapi bahannya, lalu tekan Jalankan. Jawaban muncul bertahap dan bisa langsung masuk naskah."));
      if (hist.length) {
        const box = h("div", { class: "card" }, [h("div", { class: "card__head" }, [h("h4", { text: "Riwayat terakhir" })])]);
        for (const it of hist) {
          box.append(h("button", {
            class: "clip", type: "button", onclick: () => { this.messages = [{ role: "me", text: it.task, at: Date.now() }, { role: "ai", text: it.text, provider: it.provider, at: Date.now() }]; this.paintChat(); },
          }, [h("strong", { class: "clip__src", text: `${it.task} · ${it.provider}` }), h("span", { class: "clip__text", text: String(it.text || "").slice(0, 160) })]));
        }
        this.chat.append(box);
      }
      return;
    }
    for (const m of this.messages) this.chat.append(this.bubble(m));
    this.chat.scrollTop = this.chat.scrollHeight;
  }

  paintLast(ai) {
    const el = this.chat.lastElementChild?.querySelector?.(".msg__b");
    if (el) { el.textContent = ai.text; this.chat.scrollTop = this.chat.scrollHeight; }
    else this.paintChat();
  }

  bubble(m) {
    const c = this.ctx;
    if (m.role === "me") {
      return h("div", { class: "msg msg--me" }, [
        h("div", { class: "msg__who", text: "Anda" }),
        h("div", { class: "msg__b", text: m.text }),
      ]);
    }
    const el = h("div", { class: `msg msg--ai ${m.error ? "is-err" : ""}` }, [
      h("div", { class: "msg__who" }, [h("span", { text: "Kalam" }), m.provider ? Controls.chip(m.provider, "violet") : Controls.chip("menulis…", "cyan")]),
      h("div", { class: "msg__b", text: m.text || "…" }),
    ]);
    if (m.text && !m.error) {
      el.append(h("div", { class: "msg__meta" }, [
        Controls.button("Sisipkan ke naskah", () => c.insertToEditor(m.text), { small: true, iconName: "quill" }),
        Controls.button("Simpan ke Data", async () => {
          const res = await c.pipeline.ingest({ type: "text", title: `Asisten: ${m.task || "catatan"}`, text: m.text, tags: ["asisten"] }, { dataset: "Catatan asisten" });
          c.toast.ok(res.duplicate ? "Sudah tersimpan sebelumnya." : "Tersimpan di dataset Catatan asisten.");
        }, { small: true, iconName: "database" }),
        Controls.button("Salin", async () => { await navigator.clipboard.writeText(m.text).catch(() => {}); c.toast.ok("Disalin."); }, { small: true, iconName: "copy" }),
        m.cost ? Controls.chip(`$${m.cost.toFixed(4)}`, "amber") : null,
      ].filter(Boolean)));
    }
    return el;
  }

  editPrompt(p) {
    const c = this.ctx;
    const isNew = !p;
    const label = h("input", { class: "input", value: p?.label || "", placeholder: "Nama resep", "aria-label": "Nama resep" });
    const desc = h("input", { class: "input", value: p?.desc || "", placeholder: "Penjelasan singkat", "aria-label": "Penjelasan" });
    const system = h("textarea", { class: "textarea", value: p?.system || "", "aria-label": "Instruksi sistem" });
    const template = h("textarea", { class: "textarea", value: p?.template || "{{teks}}", "aria-label": "Template prompt" });
    const needs = h("select", { class: "input select", "aria-label": "Bahan yang dibutuhkan" },
      [["chapter", "Satu bab"], ["project", "Seluruh buku"], ["selection", "Teks terpilih"], ["question", "Pertanyaan"]].map(([v, l]) => h("option", { value: v, text: l })));
    needs.value = p?.needs || "selection";
    const body = h("div", { class: "stack" }, [
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Nama" }), label]),
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Penjelasan" }), desc]),
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Bahan" }), needs]),
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Instruksi sistem" }), system]),
      h("label", { class: "field" }, [h("span", { class: "field__label", text: "Template ({{judul}}, {{teks}}, {{bible}}, {{premis}}, {{pertanyaan}})" }), template]),
    ]);
    c.drawer.open({
      title: isNew ? "Resep baru" : `Ubah resep: ${p.label}`,
      subtitle: "Resep adalah data — ubah sesuka Anda, tersimpan di perangkat.",
      body,
      actions: [
        Controls.button("Simpan resep", async () => {
          const patch = { label: label.value.trim() || "Resep baru", desc: desc.value, system: system.value, template: template.value, needs: needs.value };
          const saved = isNew ? await c.prompts.add(patch) : await c.prompts.update(p.id, patch);
          this.task = saved.id;
          c.drawer.close();
          this.paint();
          c.toast.ok("Resep disimpan.");
        }, { kind: "primary", iconName: "save" }),
        isNew ? null : Controls.button("Hapus resep", async () => {
          await c.prompts.remove(p.id);
          this.task = c.prompts.list()[0]?.id || "ringkas";
          c.drawer.close();
          this.paint();
          c.toast.undo("Resep dihapus.", async () => { await c.prompts.add(p); this.paint(); });
        }, { kind: "danger", iconName: "trash", small: true }),
      ].filter(Boolean),
    });
  }

  destroy() { for (const off of this.cleanups.splice(0)) off(); }
}