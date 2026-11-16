import { BaseProvider } from "./BaseProvider.js";
const API = "https://generativelanguage.googleapis.com/v1beta";
export class Gemini extends BaseProvider {
  constructor(settings, vault, http) {
    super(settings, vault, http, { id: "gemini", label: "Google Gemini", secret: "llm.gemini", price: [0.1, 0.4] });
    this.models = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
  }
  body(messages, temperature, maxTokens) {
    const { system, messages: rest } = BaseProvider.flatten(messages);
    return {
      contents: rest.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    };
  }
  static text(data) {
    return (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  }
  async listModels() {
    try {
      const data = await this.http.json(`${API}/models?key=${encodeURIComponent(await this.key())}`);
      const ids = (data.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => String(m.name || "").replace("models/", ""));
      if (ids.length) this.models = ids;
    } catch { /* daftar bawaan */ }
    return this.models;
  }
  async chat({ messages, model, temperature = 0.7, maxTokens = 900 }) {
    const key = await this.key(), m = this.model(model);
    const data = await this.http.json(`${API}/models/${m}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.body(messages, temperature, maxTokens)),
    });
    const usage = { input: data.usageMetadata?.promptTokenCount || 0, output: data.usageMetadata?.candidatesTokenCount || 0 };
    return { text: Gemini.text(data), usage, cost: this.cost(usage), model: m, provider: this.id };
  }
  async stream({ messages, model, temperature = 0.7, maxTokens = 900, onDelta }) {
    const key = await this.key(), m = this.model(model);
    const text = await this._sse(`${API}/models/${m}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(this.body(messages, temperature, maxTokens)),
    }, { messages, model, temperature, maxTokens }, onDelta, (j) => Gemini.text(j));
    return this._out(text, messages, m);
  }
}
