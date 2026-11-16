import { BaseProvider } from "./BaseProvider.js";
const API = "https://api.anthropic.com/v1";
export class Anthropic extends BaseProvider {
  constructor(settings, vault, http) {
    super(settings, vault, http, { id: "anthropic", label: "Anthropic Claude", secret: "llm.anthropic", price: [0.8, 4] });
    this.models = ["claude-3-5-haiku-latest", "claude-3-5-sonnet-latest", "claude-3-opus-latest"];
  }
  model(override) { return override || this.settings.get("koneksi.llmModel") || this.models[0]; }
  headers(key) {
    return { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };
  }
  async chat({ messages, model, temperature = 0.7, maxTokens = 900 }) {
    const key = await this.key(), m = this.model(model);
    const { system, messages: rest } = BaseProvider.flatten(messages);
    const data = await this.http.json(`${API}/messages`, {
      method: "POST",
      headers: this.headers(key),
      body: JSON.stringify({ model: m, system, messages: rest, temperature, max_tokens: Math.max(256, maxTokens) }),
    });
    const usage = { input: data.usage?.input_tokens || 0, output: data.usage?.output_tokens || 0 };
    return { text: (data.content || []).map((c) => c.text || "").join(""), usage, cost: this.cost(usage), model: m, provider: this.id };
  }
  async stream({ messages, model, temperature = 0.7, maxTokens = 900, onDelta }) {
    const key = await this.key(), m = this.model(model);
    const { system, messages: rest } = BaseProvider.flatten(messages);
    const args = { messages, model, temperature, maxTokens };
    const text = await this._sse(`${API}/messages`, {
      method: "POST",
      headers: this.headers(key),
      body: JSON.stringify({ model: m, system, messages: rest, temperature, max_tokens: Math.max(256, maxTokens), stream: true }),
    }, args, onDelta, (j) => (j.type === "content_block_delta" ? j.delta?.text || "" : ""));
    return this._out(text, messages, m);
  }
}
