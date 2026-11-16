import { BaseProvider } from "./BaseProvider.js";
export class Ollama extends BaseProvider {
  constructor(settings, vault, http) {
    super(settings, vault, http, { id: "ollama", label: "Ollama / LM Studio (lokal)", secret: null, price: [0, 0] });
    this.models = ["llama3.2", "qwen2.5:7b", "gemma2:9b", "mistral"];
  }
  baseUrl() {
    const s = String(this.settings.get("koneksi.llmBaseUrl") || "").trim();
    return (/11434|1234|localhost|127\.0\.0\.1/.test(s) ? s : "http://127.0.0.1:11434").replace(/\/$/, "");
  }
  async listModels() {
    try {
      const ids = ((await this.http.json(`${this.baseUrl()}/api/tags`, { timeoutMs: 4000 })).models || []).map((m) => m.name).filter(Boolean);
      if (ids.length) this.models = ids;
    } catch {
      try {
        const ids = ((await this.http.json(`${this.baseUrl()}/v1/models`, { timeoutMs: 4000 })).data || []).map((m) => m.id);
        if (ids.length) this.models = ids;
      } catch { /* server belum hidup */ }
    }
    return this.models;
  }
  async chat({ messages, model, temperature = 0.7, maxTokens = 900 }) {
    const m = this.model(model);
    const data = await this.http.json(`${this.baseUrl()}/api/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: m, messages, stream: false, options: { temperature, num_predict: maxTokens } }),
      timeoutMs: Math.max(30000, this.settings.num("koneksi.llmTimeoutMs")),
    });
    return { text: data.message?.content || "", usage: { input: data.prompt_eval_count || 0, output: data.eval_count || 0 }, cost: 0, model: m, provider: this.id };
  }
  async stream({ messages, model, temperature = 0.7, maxTokens = 900, onDelta }) {
    const m = this.model(model);
    let res;
    try {
      res = await fetch(`${this.baseUrl()}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: m, messages, stream: true, options: { temperature, num_predict: maxTokens } }),
      });
    } catch { res = null; }
    if (!res?.ok || !res.body) return this.chunked((a) => this.chat(a), { messages, model, temperature, maxTokens }, onDelta);
    const reader = res.body.getReader();
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
        if (!line.trim()) continue;
        try {
          const piece = JSON.parse(line).message?.content || "";
          if (piece) { text += piece; onDelta?.(piece); }
        } catch { /* potongan JSON */ }
      }
    }
    return this._out(text, messages, m);
  }
}
