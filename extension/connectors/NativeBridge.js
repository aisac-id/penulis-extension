import { AppError, ERR } from "../core/AppError.js";

export const HOST_NAME = "id.aisac.kalam";

export class NativeBridge {
  constructor(settings, bus, logger) {
    this.settings = settings;
    this.bus = bus;
    this.log = logger?.child?.("native") || logger;
    this.id = "native";
    this.label = "Aplikasi desktop (native)";
    this.port = null;
    this.state = "off";
    this.lastError = "";
    this.pending = new Map();
    this.seq = 0;
    this.capabilities = [];
  }

  enabled() { return this.settings.bool("koneksi.nativeAktif"); }

  available() { return typeof chrome !== "undefined" && !!chrome.runtime?.connectNative; }

  connect() {
    if (!this.enabled()) return { ok: false, detail: "Bridge masih OFF." };
    if (!this.available()) return { ok: false, detail: "Native messaging hanya tersedia di mode ekstensi." };
    if (this.port) return { ok: true, detail: "Sudah tersambung." };
    try {
      this.port = chrome.runtime.connectNative(HOST_NAME);
    } catch (err) {
      this.state = "error";
      this.lastError = err.message;
      return { ok: false, detail: `Host belum terpasang: ${err.message}` };
    }
    this.port.onMessage.addListener((msg) => this._receive(msg));
    this.port.onDisconnect.addListener(() => {
      this.lastError = chrome.runtime.lastError?.message || "Host menutup sambungan.";
      this.state = "off";
      this.port = null;
      this.pending.clear();
      this.bus.emit("connect.status", this.status());
    });
    this.state = "on";
    this.lastError = "";
    this.port.postMessage({ op: "hello", client: "kalam", version: "1.0.0" });
    return { ok: true, detail: `Terhubung ke ${HOST_NAME}.` };
  }

  _receive(msg) {
    if (msg?.op === "welcome") {
      this.capabilities = msg.capabilities || [];
      this.bus.emit("connect.status", this.status());
      return;
    }
    const p = this.pending.get(msg?.id);
    if (p) { this.pending.delete(msg.id); p(msg); }
  }

  async send(op, payload = {}, timeoutMs = 15000) {
    if (!this.port) {
      const r = this.connect();
      if (!r.ok) throw new AppError(ERR.CONNECT, r.detail);
    }
    const id = `n_${++this.seq}`;
    const bytes = JSON.stringify({ op, id, ...payload }).length;
    if (bytes > 1048576) throw new AppError(ERR.CONNECT, "Pesan melebihi 1 MB.");
    return new Promise((res, rej) => {
      const timer = setTimeout(() => { this.pending.delete(id); rej(new AppError(ERR.CONNECT, "Timeout host desktop.")); }, timeoutMs);
      this.pending.set(id, (m) => { clearTimeout(timer); res(m); });
      try {
        this.port.postMessage({ op, id, ...payload });
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        rej(AppError.wrap(err, ERR.CONNECT));
      }
    });
  }

  async saveFile(name, text) { return this.send("saveFile", { name, text }); }

  async openFolder(path) { return this.send("openFolder", { path }); }

  async test() {
    if (!this.enabled()) return { ok: false, detail: "Bridge masih OFF." };
    const r = this.connect();
    if (!r.ok) return r;
    try {
      const pong = await this.send("ping", {}, 5000);
      return { ok: !!pong?.ok, detail: pong?.host || "Host menjawab." };
    } catch (err) {
      return { ok: false, detail: err.message };
    }
  }

  disconnect() {
    this.port?.disconnect();
    this.port = null;
    this.state = "off";
    this.pending.clear();
  }

  status() {
    return { id: this.id, label: this.label, on: this.enabled() && this.state === "on", state: this.state, host: HOST_NAME, error: this.lastError, capabilities: this.capabilities };
  }
}