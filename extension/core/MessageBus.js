export const MSG = {
  SIDEBAR_TOGGLE: "sidebar.toggle",
  SIDEBAR_MODE: "sidebar.mode",
  SIDEBAR_READY: "sidebar.ready",
  SIDEBAR_PING: "sidebar.ping",
  SETTINGS_CHANGED: "settings.changed",
  PROJECT_CHANGED: "project.changed",
  ACTIVITY_CHANGED: "activity.changed",
  DATA_CHANGED: "data.changed",
  RPA_RUN: "rpa.run",
  RPA_CONTROL: "rpa.control",
  RPA_EVENT: "rpa.event",
  SCRAPE_RUN: "scrape.run",
  LLM_CHAT: "llm.chat",
  LLM_STREAM: "llm.stream",
  LLM_STOP: "llm.stop",
  LLM_TEST: "llm.test",
  CONNECT_TEST: "connect.test",
  CONNECT_STATUS: "connect.status",
  EXPORT_FILE: "export.file",
  LICENSE_CHANGED: "license.changed",
  ONBOARDING: "onboarding.step",
  OPEN_STUDIO: "studio.open",
  TAB_INFO: "tab.info",
  HTTP_FETCH: "http.fetch",
  PAGE_SNAPSHOT: "page.snapshot",
  PAGE_ACT: "page.act",
  PAGE_INJECT: "page.inject",
};
export class MessageBus {
  constructor(logger) {
    this.log = logger?.child?.("bus") || logger;
    this.handlers = new Map();
    this.port = null;
    this.hasChrome = typeof chrome !== "undefined" && !!chrome.runtime?.id;
    if (this.hasChrome) {
      this._onMessage = (msg, sender, sendResponse) => this._receive(msg, sender, sendResponse);
      chrome.runtime.onMessage.addListener(this._onMessage);
    }
  }
  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(fn);
    return () => this.handlers.get(type)?.delete(fn);
  }
  emit(type, payload = null) {
    const set = this.handlers.get(type);
    if (!set) return 0;
    for (const fn of [...set]) {
      try { fn(payload, type); } catch (err) { this.log?.warn("handler gagal", type, err?.message); }
    }
    return set.size;
  }
  async send(type, payload = null, { local = true, remote = true } = {}) {
    if (local) this.emit(type, payload);
    if (!remote || !this.hasChrome) return null;
    try {
      return await chrome.runtime.sendMessage({ type, payload });
    } catch (err) {
      this.log?.debug("send tanpa penerima", type, err?.message);
      return null;
    }
  }
  async sendTab(tabId, type, payload = null) {
    if (!this.hasChrome || !tabId) return null;
    try {
      return await chrome.tabs.sendMessage(tabId, { type, payload });
    } catch (err) {
      this.log?.debug("tab belum siap", type, err?.message);
      return null;
    }
  }
  _receive(msg, sender, sendResponse) {
    if (!msg?.type) return false;
    const set = this.handlers.get(msg.type);
    if (!set || !set.size) return false;
    const results = [];
    for (const fn of [...set]) {
      try {
        results.push(fn(msg.payload, msg.type, sender));
      } catch (err) {
        results.push(Promise.resolve({ error: err?.message }));
      }
    }
    Promise.all(results).then((r) => sendResponse(r.length === 1 ? r[0] : r)).catch(() => sendResponse(null));
    return true;
  }
  destroy() {
    if (this.hasChrome && this._onMessage) chrome.runtime.onMessage.removeListener(this._onMessage);
    this.handlers.clear();
  }
}
