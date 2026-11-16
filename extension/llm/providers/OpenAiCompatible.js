import { BaseProvider } from "./BaseProvider.js";
export class OpenAiCompatible extends BaseProvider {
  constructor(settings, vault, http, { id = "openai", label = "OpenAI-compatible", secret = "llm.openai", base = "https://api.openai.com/v1", price = [0.15, 0.6] } = {}) {
    super(settings, vault, http, { id, label, secret, price });
    this.defaultBase = base;
    this.models = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o4-mini"];
  }
  baseUrl() {
    return (String(this.settings.get("koneksi.llmBaseUrl") || "").trim() || this.defaultBase).replace(/\/$/, "");
  }
  async listModels() {
    try {
      const data = await this.http.json(`${this.baseUrl()}/models`, { headers: { Authorization: `Bearer ${await this.key()}` } });
      const ids = (data.data || []).map((m) => m.id).filter(Boolean).sort();
      if (ids.length) this.models = ids.slice(0, 60);
    } catch { /* tetap pakai daftar bawaan */ }
    return this.models;
  }
  async chat({ messages, model, temperature = 0.7, maxTokens = 900 }) {
    const key = await this.key(), m = this.model(model);
    const data = await this.http.json(`${this.baseUrl()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: m, messages, temperature, max_tokens: maxTokens }),
    });
    const usage = { input: data.usage?.prompt_tokens || 0, output: data.usage?.completion_tokens || 0 };
    return { text: data.choices?.[0]?.message?.content || "", usage, cost: this.cost(usage), model: m, provider: this.id };
  }
  async stream({ messages, model, temperature = 0.7, maxTokens = 900, onDelta }) {
    const key = await this.key();
    const args = { messages, model, temperature, maxTokens };
    const text = await this._sse(`${this.baseUrl()}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: this.model(model), messages, temperature, max_tokens: maxTokens, stream: true }),
    }, args, onDelta, (j) => j.choices?.[0]?.delta?.content || "");
    return this._out(text, messages, this.model(model));
  }
}
