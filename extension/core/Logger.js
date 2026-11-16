const LEVELS = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };
const REDACT = /(sk-[A-Za-z0-9_-]{6,}|ghp_[A-Za-z0-9]{6,}|AIza[A-Za-z0-9_-]{6,}|Bearer\s+[A-Za-z0-9._-]{6,})/g;
export class Logger {
  constructor(scope = "kalam", level = "warn") {
    this.scope = scope;
    this.level = level;
    this.buffer = [];
    this.maxBuffer = 300;
    this.listeners = new Set();
  }
  setLevel(level) { if (LEVELS[level] !== undefined) this.level = level; }
  child(scope) {
    const c = new Logger(`${this.scope}:${scope}`, this.level);
    c.listeners = this.listeners;
    c.buffer = this.buffer;
    return c;
  }
  static clean(args) {
    return args.map((a) => {
      if (typeof a === "string") return a.replace(REDACT, "«tersamar»");
      if (a && typeof a === "object") {
        try { return JSON.parse(JSON.stringify(a).replace(REDACT, "«tersamar»")); } catch { return "[objek]"; }
      }
      return a;
    });
  }
  log(level, ...args) {
    if (LEVELS[level] > LEVELS[this.level]) return;
    const entry = { at: Date.now(), level, scope: this.scope, args: Logger.clean(args) };
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();
    for (const fn of this.listeners) {
      try { fn(entry); } catch { /* listener tidak boleh menjatuhkan pemanggil */ }
    }
    (console[level] || console.debug)(`[${this.scope}]`, ...entry.args);
  }
  error(...a) { this.log("error", ...a); }
  warn(...a) { this.log("warn", ...a); }
  info(...a) { this.log("info", ...a); }
  debug(...a) { this.log("debug", ...a); }
  onEntry(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  tail(n = 80) { return this.buffer.slice(-n); }
  clear() { this.buffer.length = 0; }
}
