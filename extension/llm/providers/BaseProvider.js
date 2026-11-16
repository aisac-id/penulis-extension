import { AppError, ERR } from "../../core/AppError.js";
export class BaseProvider {
  constructor(settings, vault, http, { id, label, secret = null, price = [0, 0] } = {}) {
    this.settings = settings;
    this.vault = vault;
    this.http = http;
    this.id = id;
    this.label = label;
    this.secret = secret;
    this.price = price;
    this.models = [];
  }
  get needsKey() { return !!this.secret; }
  async key() {
    if (!this.secret) return "";
    if (!this.vault?.key) throw new AppError(ERR.VAULT_LOCKED, "Brankas kunci terkunci. Buka di tab Koneksi.");
    const k = this.vault.get(this.secret);
    if (!k) throw new AppError(ERR.LLM, `Kunci ${this.secret} belum diisi.`);
    return k;
  }
  async ready() { return !this.needsKey || !!(this.vault?.key && this.vault.has(this.secret)); }
  baseUrl() { return String(this.settings.get("koneksi.llmBaseUrl") || "").replace(/\/$/, ""); }
  model(override) { return override || this.settings.get("koneksi.llmModel") || this.models[0]; }
  cost(usage = {}) {
    const [pin, pout] = this.price;
    return ((usage.input || 0) * pin + (usage.output || 0) * pout) / 1e6;
  }
  static flatten(messages = []) {
    const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    return { system: sys, messages: messages.filter((m) => m.role !== "system") };
  }
  static estimate(text) { return Math.ceil(String(text || "").length / 3.6); }
  _out(text, messages, m) {
    const usage = { input: BaseProvider.estimate(messages.map((x) => x.content).join(" ")), output: BaseProvider.estimate(text) };
    return { text, usage, cost: this.cost(usage), model: m, provider: this.id };
  }
  // jatuh ke chunked bila fetch/SSE gagal.
  async _sse(url, init, args, onDelta, pick) {
    let res;
    try { res = await fetch(url, init); } catch { res = null; }
    if (!res?.ok || !res.body) return this.chunked((a) => this.chat(a), args, onDelta);
    return this.readSse(res, onDelta, pick);
  }
  async chunked(chatFn, args, onDelta) {
    const res = await chatFn(args);
    let buf = "";
    for (const w of String(res.text || "").split(/(\s+)/)) {
      buf += w;
      if (buf.length >= 24) { onDelta?.(buf); buf = ""; }
    }
    if (buf) onDelta?.(buf);
    return res;
  }
  async readSse(response, onDelta, pick) {
    const reader = response.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const data = t.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        try {
          const piece = pick(JSON.parse(data));
          if (piece) { text += piece; onDelta?.(piece); }
        } catch { /* baris keep-alive */ }
      }
    }
    return text;
  }
  async listModels() { return this.models; }
  async testConnection() {
    const t0 = Date.now();
    const r = await this.chat({ messages: [{ role: "user", content: "Balas satu kata: siap" }], maxTokens: 12 });
    return { ok: !!r.text, ms: Date.now() - t0, detail: String(r.text || "").slice(0, 60), model: r.model };
  }
}
