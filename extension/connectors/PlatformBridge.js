import { AppError, ERR } from "../core/AppError.js";
import { MSG } from "../core/MessageBus.js";

const now = () => new Date().toISOString();

export class PlatformBridge {
  constructor(settings, vault, http, store, bus, logger) {
    this.settings = settings;
    this.vault = vault;
    this.http = http;
    this.store = store;
    this.bus = bus;
    this.log = logger?.child?.("platform") || logger;
    this.id = "platform";
    this.label = "Platform penulis (HTTPS)";
    this.outbox = [];
    this.paused = false;
    this.lastError = "";
    this.sent = 0;
  }

  enabled() { return this.settings.bool("koneksi.platformAktif"); }

  url() {
    const u = String(this.settings.get("koneksi.platformUrl") || "").trim().replace(/\/$/, "");
    if (!u) throw new AppError(ERR.CONNECT, "Platform URL belum diisi.");
    if (!/^https:\/\//i.test(u)) throw new AppError(ERR.CONNECT, "Platform wajib HTTPS.");
    return u;
  }

  async load() {
    this.outbox = (await this.store.get("platformOutbox", [])) || [];
    return this.outbox;
  }

  async save() { await this.store.set("platformOutbox", this.outbox.slice(-200)); }

  token() {
    const t = this.vault?.get?.("platform.ingest");
    if (!t) throw new AppError(ERR.VAULT_LOCKED, "Ingest token belum ada. Impor .env atau isi di tab Koneksi.");
    return t;
  }

  envelope(kind, payload) {
    return {
      idempotencyKey: `${kind}:${this.settings.get("lanjutan.brandNama")}:${JSON.stringify(payload).length}:${Date.now()}`,
      kind, source: "kalam-extension", version: "1.0.0", sentAt: now(), payload,
    };
  }

  async enqueue(kind, payload) {
    const env = this.envelope(kind, payload);
    this.outbox.push(env);
    await this.save();
    this.bus.emit("connect.status", { id: this.id, queued: this.outbox.length });
    return env;
  }

  async send(env) {
    const res = await this.http.request(`${this.url()}/api/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.token()}`, "Idempotency-Key": env.idempotencyKey },
      body: JSON.stringify(env),
      timeoutMs: 20000,
    });
    if (res.status === 401 || res.status === 403) {
      this.paused = true;
      this.lastError = "Token ditolak platform. Jeda otomatis.";
      throw new AppError(ERR.CONNECT, this.lastError);
    }
    if (res.status === 429 || res.status >= 500) {
      this.lastError = `Platform sibuk (${res.status}). Dicoba lagi nanti.`;
      throw new AppError(ERR.CONNECT, this.lastError);
    }
    if (!res.ok) throw new AppError(ERR.CONNECT, `HTTP ${res.status}`);
    this.sent++;
    return res.json || { ok: true };
  }

  async flush(limit = 5) {
    if (!this.enabled() || this.paused || !this.outbox.length) return { sent: 0, left: this.outbox.length, paused: this.paused };
    let sent = 0;
    for (const env of [...this.outbox].slice(0, limit)) {
      try {
        await this.send(env);
        this.outbox = this.outbox.filter((x) => x.idempotencyKey !== env.idempotencyKey);
        sent++;
      } catch (err) {
        this.lastError = err.message;
        break;
      }
    }
    await this.save();
    this.bus.emit("connect.status", { id: this.id, sent, queued: this.outbox.length, paused: this.paused, error: this.lastError });
    return { sent, left: this.outbox.length, paused: this.paused };
  }

  async pullJobs() {
    if (!this.enabled() || this.paused) return [];
    const res = await this.http.request(`${this.url()}/api/jobs?limit=5`, { headers: { Authorization: `Bearer ${this.token()}` } });
    if (!res.ok) return [];
    return res.json?.jobs || [];
  }

  resume() { this.paused = false; this.lastError = ""; }

  async test() {
    if (!this.enabled()) return { ok: false, detail: "Bridge masih OFF." };
    try {
      const res = await this.http.request(`${this.url()}/api/ping`, { headers: { Authorization: `Bearer ${this.token()}` }, timeoutMs: 8000 });
      return { ok: res.ok, detail: res.ok ? "Platform menjawab ping." : `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, detail: err.message };
    }
  }

  status() {
    return { id: this.id, label: this.label, on: this.enabled(), queued: this.outbox.length, sent: this.sent, paused: this.paused, error: this.lastError };
  }

  registerHandlers() {
    this.bus.on(MSG.CONNECT_TEST, async ({ id }) => (id === this.id ? this.test() : null));
  }
}