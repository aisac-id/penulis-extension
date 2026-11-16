import { AppError, ERR } from "./AppError.js";
import { MSG } from "./MessageBus.js";
const toBase64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 8192) s += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(s);
};
const fromBase64 = (b64, mime) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || "application/octet-stream" });
};
export class HttpClient {
  constructor(bus, settings, logger, { direct = typeof window === "undefined" } = {}) {
    this.bus = bus;
    this.settings = settings;
    this.log = logger?.child?.("http") || logger;
    this.direct = direct;
    this.calls = 0;
    this.bytes = 0;
  }
  async handle({ url, method = "GET", headers = {}, body = null, timeoutMs = 20000, binary = false }) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method, headers, body, signal: ctrl.signal, redirect: "follow", credentials: "omit" });
      const out = { ok: res.ok, status: res.status, mime: res.headers.get("content-type") || "", url: res.url };
      if (binary) {
        const buf = await res.arrayBuffer();
        this.bytes += buf.byteLength;
        out.base64 = toBase64(buf);
        out.size = buf.byteLength;
      } else {
        out.text = await res.text();
      }
      this.calls++;
      return out;
    } catch (err) {
      return { ok: false, status: 0, error: err.name === "AbortError" ? "Timeout" : err.message };
    } finally {
      clearTimeout(timer);
    }
  }
  async request(url, opts = {}) {
    const payload = { url, timeoutMs: opts.timeoutMs || this.settings?.num?.("koneksi.llmTimeoutMs") || 20000, ...opts };
    let res = this.direct ? await this.handle(payload) : await this.bus.send(MSG.HTTP_FETCH, payload, { local: false });
    if (!res) res = await this.handle(payload);
    if (!res || res.status === 0) throw new AppError(ERR.CONNECT, res?.error || "Tidak ada respons jaringan.");
    if (res.base64) res.blob = fromBase64(res.base64, res.mime);
    if (res.text && /json/i.test(res.mime || "")) {
      try { res.json = JSON.parse(res.text); } catch { res.json = null; }
    }
    return res;
  }
  async text(url, opts = {}) {
    const res = await this.request(url, opts);
    if (!res.ok) throw new AppError(ERR.CONNECT, `HTTP ${res.status} untuk ${url}`);
    return res.text || "";
  }
  async json(url, opts = {}) {
    const res = await this.request(url, opts);
    if (!res.ok) throw new AppError(ERR.CONNECT, `HTTP ${res.status}: ${(res.text || "").slice(0, 160)}`);
    if (res.json) return res.json;
    try { return JSON.parse(res.text || "{}"); } catch { throw new AppError(ERR.CONNECT, "Respons bukan JSON."); }
  }
  async blob(url, opts = {}) {
    const res = await this.request(url, { ...opts, binary: true });
    if (!res.ok) throw new AppError(ERR.CONNECT, `HTTP ${res.status} untuk berkas.`);
    return res.blob;
  }
  stats() { return { calls: this.calls, bytes: this.bytes }; }
}
