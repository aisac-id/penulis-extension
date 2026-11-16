import { h, icon, num, clear, debounce, fmtTime } from "../sidebar/ui/Dom.js";
import { Controls } from "../sidebar/ui/Controls.js";
import { TextStats } from "../analysis/TextStats.js";
import { ProjectService, CHAPTER_STATUS } from "../model/ProjectService.js";

export class EditorPane {
  constructor(ctx) {
    this.ctx = ctx;
    this.chapterId = null;
    this.sceneId = null;
    this.dirty = false;
    this.zen = false;
    this.el = h("div", { class: "editor" });
    this.area = h("textarea", {
      class: "editor__area", spellcheck: "true", placeholder: "Mulai menulis di sini. Autosave menyimpan sendiri; Ctrl+S menyimpan versi.",
      "aria-label": "Isi naskah",
    });
    this.titleInput = h("input", { class: "editor__title", "aria-label": "Judul bab" });
    this.saveState = h("span", { class: "editor__save" });
    this.metaEl = h("div", { class: "editor__meta" });
    this.scenesEl = h("div", { class: "scene-tabs" });
    this.marksEl = h("div", { class: "marks" });
    this._save = debounce(() => this.flush(), 200);
    this._marks = debounce(() => this.paintMarks(), 420);
    this._wire();
  }

  _wire() {
    const s = this.ctx.settings;
    this.area.addEventListener("input", () => {
      this.dirty = true;
      this.paintSave("dirty");
      this.paintMeta();
      this._save();
      this._marks();
    });
    this.area.addEventListener("keydown", (e) => {
      const ch = e.key.length === 1 ? e.key : e.key === "Enter" ? "\n" : "";
      if (ch) this.ctx.sound?.key(ch);
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); this.snapshot(); }
      if (e.key === "Tab") { e.preventDefault(); this._insert("    "); }
      if (s.bool("editor.typewriter") && ["Enter", "ArrowUp", "ArrowDown"].includes(e.key)) requestAnimationFrame(() => this._center());
    });
    this.titleInput.addEventListener("input", debounce(async () => {
      if (!this.chapterId) return;
      await this.ctx.projects.updateChapter(this.chapterId, { title: this.titleInput.value });
      this.ctx.toast.ok("Judul bab diperbarui.");
    }, 400));
    this._offSettings = s.onChange((key) => {
      if (key.startsWith("editor.") || key === "*") this.applySettings();
      if (key.startsWith("analisis.")) this.paintMarks();
    });
  }

  _insert(text) {
    const a = this.area;
    const start = a.selectionStart;
    a.setRangeText(text, start, a.selectionEnd, "end");
    a.dispatchEvent(new Event("input"));
  }

  async appendText(text) {
    const add = String(text || "").trim();
    if (!add) return false;
    if (!this.chapterId) return false;
    const cur = this.area.value;
    this.area.value = cur ? `${cur.replace(/\s+$/, "")}\n\n${add}\n` : `${add}\n`;
    this.dirty = true;
    this.paintMeta();
    this.paintSave("dirty");
    await this.flush();
    this.paintMarks();
    this.area.scrollTop = this.area.scrollHeight;
    this.ctx.toast.ok("Teks disisipkan ke naskah.");
    return true;
  }

  _center() {
    const a = this.area;
    const lines = a.value.slice(0, a.selectionStart).split("\n").length;
    const lh = parseFloat(getComputedStyle(a).lineHeight) || 28;
    a.scrollTop = Math.max(0, lines * lh - a.clientHeight / 2);
  }

  applySettings() {
    const s = this.ctx.settings;
    this.el.dataset.font = s.get("editor.fontNaskah");
    this.el.dataset.focus = s.bool("editor.modeFokus") ? "on" : "off";
    this.area.style.setProperty("--fs", `${s.num("editor.ukuranFont")}px`);
    this.area.style.setProperty("--lh", String(s.num("editor.tinggiBaris") / 100));
    this.area.style.maxWidth = `${s.num("editor.lebarBaris")}ch`;
    this.area.spellcheck = s.bool("editor.ejaan");
    this._save = debounce(() => this.flush(), Math.max(500, s.num("editor.autosaveDetik") * 1000));
  }

  async open(chapterId, sceneId = null) {
    await this.flush();
    const ch = this.ctx.projects.findChapter(chapterId);
    if (!ch) return this.el;
    this.chapterId = chapterId;
    this.sceneId = sceneId || ch.scenes[0]?.id;
    const sc = this.ctx.projects.findScene(chapterId, this.sceneId);
    this.titleInput.value = ch.title;
    this.area.value = sc?.text || "";
    this.dirty = false;
    this.applySettings();
    this.paint();
    this.paintSave("saved");
    this.paintMarks();
    if (this.ctx.settings.bool("editor.snapshotOtomatis") && this.area.value.trim()) {
      await this.ctx.snapshots.capture(this.sceneId, this.area.value, "buka sesi");
    }
    return this.el;
  }

  paint() {
    const ch = this.ctx.projects.findChapter(this.chapterId);
    if (!ch) return;
    clear(this.el);
    const statusSel = h("select", { class: "select", style: { width: "auto" }, "aria-label": "Status bab" },
      CHAPTER_STATUS.map(([v, l]) => h("option", { value: v, text: l, selected: v === ch.status })));
    statusSel.value = ch.status;
    statusSel.addEventListener("change", async () => {
      await this.ctx.projects.updateChapter(ch.id, { status: statusSel.value });
      this.ctx.toast.ok(`Status bab: ${statusSel.options[statusSel.selectedIndex].text}.`);
    });
    const bar = h("div", { class: "editor__bar" }, [
      Controls.iconButton("chev", "Kembali ke daftar bab", () => this.ctx.onEditorBack?.()),
      this.titleInput, statusSel,
      Controls.iconButton("clock", "Simpan versi (Ctrl+S)", () => this.snapshot()),
      Controls.iconButton("eye", "Riwayat versi", () => this.showVersions()),
      Controls.iconButton("wrench", "Rapikan tanda baca & spasi", () => this.tidy()),
      Controls.iconButton(this.zen ? "collapse" : "expand", "Mode zen (layar tulis penuh)", () => this.toggleZen()),
    ]);
    clear(this.scenesEl);
    for (const sc of ch.scenes) {
      this.scenesEl.append(h("button", {
        class: `scene-tab ${sc.id === this.sceneId ? "is-active" : ""}`, type: "button",
        onclick: () => this.open(ch.id, sc.id),
      }, [h("span", { text: `${sc.title} · ${num(TextStats.words(sc.text))}` })]));
    }
    this.scenesEl.append(h("button", {
      class: "scene-tab", type: "button", title: "Tambah adegan",
      onclick: async () => { const sc = await this.ctx.projects.addScene(ch.id); this.open(ch.id, sc.id); },
    }, [icon("plus", 12)]));
    const paper = h("div", { class: "editor__paper" }, [this.area]);
    this.el.append(bar, this.scenesEl, this.metaEl, paper,
      h("div", { class: "editor__foot" }, [this.saveState, h("span", { class: "grow" }),
        h("span", { class: "muted small", text: "Ctrl+S versi · Tab indentasi · Alt+Shift+F layar penuh" })]),
      h("div", {}, [h("h5", { text: "Penanda gaya (klik untuk lompat)" }), this.marksEl]));
    this.paintMeta();
  }

  paintMeta() {
    const st = TextStats.stats(this.area.value);
    const goal = this.ctx.goals.todayWords();
    clear(this.metaEl);
    this.metaEl.append(
      Controls.chip(`${num(st.words)} kata`, "cyan"),
      Controls.chip(`${st.paragraphs} paragraf`, "violet"),
      Controls.chip(`rata-rata ${st.avgSentence} kata/kalimat`, "amber"),
      Controls.chip(`keterbacaan ${st.readability}`, st.readability >= this.ctx.settings.num("analisis.targetReadability") ? "lime" : "red"),
      Controls.chip(`dialog ${Math.round(st.dialogue * 100)}%`, "magenta"),
      Controls.chip(`hari ini ${num(goal)}`, "info"),
    );
  }

  paintSave(state) {
    clear(this.saveState);
    this.saveState.className = `editor__save ${state === "dirty" ? "is-dirty" : "is-saved"}`;
    this.saveState.append(icon(state === "dirty" ? "dot" : "check", 12),
      h("span", { text: state === "dirty" ? "menyimpan…" : `tersimpan ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` }));
  }

  paintMarks() {
    if (!this.marksEl.isConnected) return;
    const findings = this.ctx.style.check(this.area.value).slice(0, 24);
    clear(this.marksEl);
    if (!findings.length) {
      this.marksEl.append(h("p", { class: "muted small", text: "Tidak ada penanda. Naskah ini bersih menurut ambang saat ini." }));
      return;
    }
    for (const f of findings) {
      this.marksEl.append(h("button", {
        class: `mark mark--${f.kind}`, type: "button", title: f.advice,
        onclick: () => this.jump(f.at),
      }, [h("span", { class: "mark__w", text: f.title }), h("span", { class: "muted", text: f.advice })]));
    }
  }

  jump(at) {
    this.area.focus();
    this.area.setSelectionRange(at, Math.min(this.area.value.length, at + 60));
    const lh = parseFloat(getComputedStyle(this.area).lineHeight) || 28;
    const lines = this.area.value.slice(0, at).split("\n").length;
    this.area.scrollTop = Math.max(0, lines * lh - this.area.clientHeight / 2);
  }

  async flush() {
    if (!this.dirty || !this.chapterId || !this.sceneId) return;
    const { delta } = await this.ctx.projects.saveScene(this.chapterId, this.sceneId, this.area.value);
    this.dirty = false;
    this.paintSave("saved");
    if (delta > 0) {
      await this.ctx.goals.addWords(delta);
      this.ctx.burst?.(delta);
    } else if (delta < 0) await this.ctx.goals.addWords(delta, { silent: true });
    this.ctx.onWords?.(delta);
  }

  async snapshot() {
    await this.flush();
    const snap = await this.ctx.snapshots.capture(this.sceneId, this.area.value, "manual");
    this.ctx.sound?.ok();
    this.ctx.toast.ok(snap ? `Versi disimpan (${num(snap.words)} kata).` : "Belum ada teks untuk disimpan.");
  }

  async tidy() {
    const { text, changed } = this.ctx.style.tidy(this.area.value);
    if (!changed) { this.ctx.toast.info("Sudah rapi."); return; }
    const before = this.area.value;
    this.area.value = text;
    this.dirty = true;
    await this.flush();
    this.paintMarks();
    this.ctx.toast.undo("Tanda baca & spasi dirapikan.", () => { this.area.value = before; this.dirty = true; this.flush(); });
  }

  async showVersions() {
    const list = await this.ctx.snapshots.list(this.sceneId);
    const body = h("div", { class: "versions" });
    if (!list.length) body.append(h("p", { class: "muted", text: "Belum ada versi. Tekan Ctrl+S untuk menyimpan versi pertama." }));
    for (const s of list) {
      body.append(h("div", { class: "version" }, [
        h("div", { class: "version__t" }, [
          h("strong", { text: `${num(s.words)} kata · ${s.label}` }),
          h("div", { class: "version__when", text: new Date(s.at).toLocaleString("id-ID") }),
        ]),
        Controls.button("Pulihkan", async () => {
          const before = this.area.value;
          this.area.value = s.text;
          this.dirty = true;
          await this.flush();
          this.paintMarks();
          this.ctx.drawer.close();
          this.ctx.toast.undo("Versi dipulihkan.", () => { this.area.value = before; this.dirty = true; this.flush(); });
        }, { small: true, kind: "primary" }),
        Controls.iconButton("trash", "Hapus versi", async () => { await this.ctx.snapshots.remove(this.sceneId, s.id); this.showVersions(); }, { tone: "danger" }),
      ]));
    }
    this.ctx.drawer.open({ title: "Riwayat versi", subtitle: `${list.length} versi tersimpan`, body, badge: Controls.chip("lokal", "lime") });
  }

  toggleZen() {
    this.zen = !this.zen;
    if (this.zen) {
      this._zenHost = h("div", { class: "editor__zen" }, [
        h("div", { class: "editor__zenbar" }, [
          h("strong", { text: this.titleInput.value }), h("span", { class: "grow" }),
          Controls.button("Keluar zen (Esc)", () => this.toggleZen(), { iconName: "collapse" }),
        ]),
        this.area,
      ]);
      this._zenKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); this.toggleZen(); } };
      this.ctx.root.addEventListener("keydown", this._zenKey, true);
      this.ctx.root.append(this._zenHost);
      this.area.focus();
    } else {
      this.ctx.root.removeEventListener("keydown", this._zenKey, true);
      this._zenHost?.remove();
      this._zenHost = null;
      this.paint();
    }
    return this.zen;
  }

  get text() { return this.area.value; }

  destroy() {
    this.flush();
    this._offSettings?.();
    if (this.zen) this.toggleZen();
    this.el.remove();
  }
}