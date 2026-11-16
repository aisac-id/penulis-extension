import { AppError, ERR } from "../core/AppError.js";

export const COMMANDS = [
  { id: "pandoc", label: "Konversi naskah (pandoc)", args: ["--from", "markdown", "--to", "docx"] },
  { id: "wordcount", label: "Hitung kata berkas", args: ["-w"] },
  { id: "open-folder", label: "Buka folder naskah", args: [] },
  { id: "backup", label: "Cadangkan folder naskah", args: [] },
];

export class LocalBridge {
  constructor(settings, vault, store, bus, logger) {
    this.settings = settings;
    this.vault = vault;
    this.store = store;
    this.bus = bus;
    this.log = logger?.child?.("local") || logger;
    this.id = "local";
    this.label = "Terminal / CLI lokal";
    this.ws = null;
    this.state = "off";
    this.lastError = "";
    this.pending = new Map();
    this.seq = 0;
    this.history = [];
  }

  enabled() { return this.settings.bool("koneksi.localAktif"); }

  endpoint() {
    const port = this.settings.num("koneksi.localPort");
    return `ws://127.0.0.1:${port}`;
  }

  token() {
    const t = this.vault?.get?.("local.pairing");
    if (!t) throw new AppError(ERR.CONNECT, "Token pasangan belum diisi (PAIRING_TOKEN di .env).");
    return t;
  }

  connect() {
    if (!this.enabled()) return Promise.resolve({ ok: false, detail: "Bridge masih OFF." });
    if (this.ws && this.state === "on") return Promise.resolve({ ok: true, detail: "Sudah tersambung." });
    return new Promise((res) => {
      let settled = false;
      const done = (r) => { if (!settled) { settled = true; res(r); } };
      try {
        this.ws = new WebSocket(this.endpoint());
      } catch (err) {
        this.state = "error";
        this.lastError = err.message;
        done({ ok: false, detail: err.message });
        return;
      }
      const timer = setTimeout(() => { this.ws?.close(); done({ ok: false, detail: "Timeout sambungan CLI." }); }, 6000);
      this.ws.onopen = () => {
        this.ws.send(JSON.stringify({ op: "hello", token: this.token(), client: "kalam", version: "1.0.0" }));
      };
      this.ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch { return; }
        if (msg.op === "welcome") {
          clearTimeout(timer);
          this.state = "on";
          this.lastError = "";
          this.bus.emit("connect.status", this.status());
          done({ ok: true, detail: `CLI siap: ${(msg.commands || []).join(", ") || "whitelist standar"}` });
          return;
        }
        const p = this.pending.get(msg.id);
        if (p) { this.pending.delete(msg.id); p(msg); }
      };
      this.ws.onerror = () => { this.state = "error"; this.lastError = "CLI tidak menjawab. Jalankan pendamping dulu."; };
      this.ws.onclose = () => {
        clearTimeout(timer);
        this.state = "off";
        this.bus.emit("connect.status", this.status());
        done({ ok: false, detail: this.lastError || "Sambungan ditutup." });
      };
    });
  }

  async run(command, args = [], { confirm = false } = {}) {
    const known = COMMANDS.find((c) => c.id === command);
    if (!known && !(this.settings.bool("koneksi.commandBebas") && confirm)) {
      throw new AppError(ERR.PERMISSION, `Perintah "${command}" di luar whitelist. Aktifkan izin eksplisit bila memang perlu.`);
    }
    if (this.state !== "on") await this.connect();
    if (this.state !== "on") throw new AppError(ERR.CONNECT, this.lastError || "CLI belum tersambung.");
    const id = `cmd_${++this.seq}`;
    const payload = { op: "run", id, token: this.token(), command, args: args.map(String) };
    const reply = await new Promise((res, rej) => {
      const timer = setTimeout(() => { this.pending.delete(id); rej(new AppError(ERR.CONNECT, "Timeout perintah CLI.")); }, 20000);
      this.pending.set(id, (m) => { clearTimeout(timer); res(m); });
      this.ws.send(JSON.stringify(payload));
    });
    this.history.unshift({ at: new Date().toISOString(), command, ok: !!reply.ok, out: String(reply.stdout || reply.error || "").slice(0, 400) });
    this.history = this.history.slice(0, 20);
    return reply;
  }

  async test() {
    if (!this.enabled()) return { ok: false, detail: "Bridge masih OFF." };
    const r = await this.connect();
    return r;
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.state = "off";
    this.pending.clear();
  }

  status() {
    return { id: this.id, label: this.label, on: this.enabled() && this.state === "on", state: this.state, endpoint: this.endpoint(), error: this.lastError, commands: COMMANDS.map((c) => c.id) };
  }
}