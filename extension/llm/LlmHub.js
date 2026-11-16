import { AppError, ERR } from "../core/AppError.js";
import { MSG } from "../core/MessageBus.js";
import { today } from "../sidebar/ui/Dom.js";
import { PromptLibrary } from "./PromptLibrary.js";
import { OpenAiCompatible } from "./providers/OpenAiCompatible.js";
import { Anthropic } from "./providers/Anthropic.js";
import { Gemini } from "./providers/Gemini.js";
import { Ollama } from "./providers/Ollama.js";
import { LocalHeuristic } from "./providers/LocalHeuristic.js";
export class LlmHub {
  constructor(settings, vault, http, store, bus, prompts, services = {}, logger = null) {
    this.settings = settings;
    this.vault = vault;
    this.store = store;
    this.bus = bus;
    this.prompts = prompts;
    this.services = services;
    this.log = logger?.child?.("llm") || logger;
    this.providers = new Map();
    this.usage = { day: today(), calls: 0, cost: 0, tokens: 0, byProvider: {} };
    this.history = [];
    this.abort = false;
    const reg = (p) => this.providers.set(p.id, p);
    reg(new LocalHeuristic(settings, vault, http, services));
    reg(new OpenAiCompatible(settings, vault, http));
    reg(new Anthropic(settings, vault, http));
    reg(new Gemini(settings, vault, http));
    reg(new Ollama(settings, vault, http));
    reg(new OpenAiCompatible(settings, vault, http, { id: "groq", label: "Groq", secret: "llm.groq", base: "https://api.groq.com/openai/v1", price: [0.05, 0.08] }));
    reg(new OpenAiCompatible(settings, vault, http, { id: "openrouter", label: "OpenRouter", secret: "llm.openrouter", base: "https://openrouter.ai/api/v1", price: [0.3, 1.2] }));
  }
  async load() {
    const u = await this.store.get("llmUsage", null);
    if (u && u.day === today()) this.usage = u;
    this.history = (await this.store.get("llmHistory", [])) || [];
    return this.usage;
  }
  list() { return [...this.providers.values()].map((p) => ({ id: p.id, label: p.label, needsKey: p.needsKey, secret: p.secret })); }
  get(id) { return this.providers.get(id) || this.providers.get("local"); }
  allowed(id) { return id === "local" || id === "ollama" || this.settings.bool("koneksi.llmPrivasi"); }
  async chain() {
    const order = [this.settings.get("koneksi.llmProvider") || "local"];
    if (this.settings.bool("koneksi.llmFallback")) {
      for (const id of ["ollama", "openai", "anthropic", "gemini", "groq", "openrouter"]) if (!order.includes(id)) order.push(id);
    }
    order.push("local");
    const out = [];
    for (const id of new Set(order)) {
      const p = this.providers.get(id);
      if (p && this.allowed(id) && (await p.ready())) out.push(p);
    }
    return out.length ? out : [this.providers.get("local")];
  }
  budgetLeft() { return Math.max(0, this.settings.num("koneksi.llmBiayaHarian") - this.usage.cost); }
  messages(task, vars = {}) {
    const recipe = this.prompts.get(task);
    const project = this.svcProject();
    const filled = {
      judul: project?.title || "", premis: project?.premise || "", genre: project?.genre || "",
      kata: this.services?.projects?.words?.() || 0,
      bible: this.services?.bible?.brief?.() || "", ringkasan: this.chapterSummaries(),
      ...vars,
    };
    return [
      { role: "system", content: recipe?.system || "Anda asisten penulis buku berbahasa Indonesia. Jawab ringkas dan konkret." },
      { role: "user", content: recipe ? PromptLibrary.render(recipe.template, filled) : (vars.pertanyaan || vars.teks || "") },
    ];
  }
  svcProject() { return this.services?.projects?.active || null; }
  chapterSummaries() {
    const p = this.svcProject();
    return p ? (p.chapters || []).map((c) => `${c.order}. ${c.title}: ${c.summary || "(belum ada ringkasan)"}`).join("\n") : "";
  }
  async _track(res, task) {
    if (this.usage.day !== today()) this.usage = { day: today(), calls: 0, cost: 0, tokens: 0, byProvider: {} };
    const b = this.usage.byProvider[res.provider] || { calls: 0, cost: 0 };
    this.usage.calls++;
    this.usage.cost += res.cost || 0;
    this.usage.tokens += (res.usage?.input || 0) + (res.usage?.output || 0);
    b.calls++;
    b.cost += res.cost || 0;
    this.usage.byProvider[res.provider] = b;
    await this.store.set("llmUsage", this.usage);
    this.history = [{ at: new Date().toISOString(), task, provider: res.provider, model: res.model, chars: (res.text || "").length, cost: res.cost || 0 }, ...this.history].slice(0, 40);
    await this.store.set("llmHistory", this.history);
    this.bus.emit("llm.usage", this.usage);
    return res;
  }
  async _run(task, vars, opts, streaming) {
    const { model = null, temperature = 0.7, maxTokens = 900, onDelta } = opts || {};
    const messages = this.messages(task, vars);
    const errors = [];
    for (const p of await this.chain()) {
      try {
        const res = streaming
          ? await p.stream({ task, vars, messages, model, temperature, maxTokens, onDelta: (d) => { if (!this.abort) onDelta?.(d); } })
          : await p.chat({ task, vars, messages, model, temperature, maxTokens });
        if (streaming && this.abort) return { ...res, stopped: true };
        if (res.text?.trim()) return this._track(res, task);
        errors.push(`${p.id}: ${streaming ? "kosong" : "jawaban kosong"}`);
      } catch (err) {
        errors.push(`${p.id}: ${err.message}`);
        if (!streaming) this.log?.warn?.("provider gagal", p.id, err.message);
      }
    }
    throw new AppError(ERR.LLM, `${streaming ? "Streaming" : "Semua provider"} gagal. ${errors.slice(0, 3).join(" · ")}`);
  }
  async chat(task, vars = {}, opts = {}) {
    if (!this.settings.bool("koneksi.llmAktif")) throw new AppError(ERR.LLM, "Asisten AI dimatikan di Pengaturan → Koneksi.");
    if (this.budgetLeft() <= 0 && this.settings.get("koneksi.llmProvider") !== "local") {
      throw new AppError(ERR.LLM, "Batas biaya harian tercapai. Naikkan batas atau pakai mesin lokal.");
    }
    return this._run(task, vars, opts, false);
  }
  async stream(task, vars = {}, opts = {}) {
    this.abort = false;
    return this._run(task, vars, opts, true);
  }
  stop() { this.abort = true; }
  async test(id) {
    if (!this.allowed(id)) return { ok: false, detail: "Gerbang privasi cloud masih OFF." };
    try { return await this.get(id).testConnection(); } catch (err) { return { ok: false, detail: err.message }; }
  }
  async models(id) {
    try { return await this.get(id).listModels(); } catch { return this.get(id).models; }
  }
  registerHandlers() {
    this.bus.on(MSG.LLM_CHAT, ({ task, vars, opts }) => this.chat(task, vars, opts));
    this.bus.on(MSG.LLM_TEST, ({ id }) => this.test(id));
    this.bus.on(MSG.LLM_STOP, () => { this.stop(); return { ok: true }; });
  }
  setServices(services) {
    this.services = services;
    const local = this.providers.get("local");
    if (local) local.svc = services;
  }
}
