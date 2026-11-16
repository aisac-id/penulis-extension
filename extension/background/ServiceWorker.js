import { MessageBus, MSG } from "../core/MessageBus.js";
import { Logger } from "../core/Logger.js";
import { StorageService } from "../core/StorageService.js";
import { Settings } from "../core/Settings.js";
import { HttpClient } from "../core/HttpClient.js";

const ALARM_REMIND = "kalam:pengingat";
const ALARM_CARE = "kalam:rawat";
const INJECTABLE = /^(https?|file):/i;

class ServiceWorker {
  constructor() {
    this.log = new Logger("warn");
    this.bus = new MessageBus(this.log);
    this.store = new StorageService(this.bus, this.log);
    this.settings = new Settings(this.store, this.bus, this.log);
    this.http = new HttpClient(this.bus, this.settings, this.log, { direct: true });
    this.injected = new Set();
    this.ready = this.settings.load().then(() => { this.log.level = this.settings.get("lanjutan.logLevel"); });
    this.bind();
  }

  bind() {
    chrome.runtime.onInstalled.addListener((d) => this.onInstalled(d));
    chrome.runtime.onStartup.addListener(() => this.ensureAlarms());
    chrome.action.onClicked.addListener((tab) => this.toggle(tab));
    chrome.commands.onCommand.addListener((cmd) => this.command(cmd));
    chrome.alarms.onAlarm.addListener((a) => this.alarm(a));
    chrome.tabs.onRemoved.addListener((id) => this.injected.delete(id));
    chrome.tabs.onUpdated.addListener((id, info) => { if (info.status === "loading") this.injected.delete(id); });
    chrome.contextMenus.onClicked.addListener((info, tab) => this.contextMenu(info, tab));
    this.bus.on(MSG.HTTP_FETCH, (p) => this.http.handle(p));
    this.bus.on(MSG.PAGE_INJECT, async ({ tabId }) => this.inject(tabId));
    this.bus.on(MSG.SIDEBAR_TOGGLE, async ({ open, tabId }) => this.toggleById(tabId, open));
    this.bus.on(MSG.OPEN_STUDIO, () => this.openStudio());
    this.bus.on(MSG.EXPORT_FILE, ({ base64, mime, filename }) => this.download(base64, mime, filename));
    this.bus.on(MSG.TAB_INFO, async () => this.activeTab());
  }

  async onInstalled({ reason }) {
    await this.ready;
    await this.ensureAlarms();
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({ id: "kalam-clip", title: "Kalam: simpan teks terpilih sebagai kliping", contexts: ["selection"] });
      chrome.contextMenus.create({ id: "kalam-open", title: "Kalam: buka ruang kerja penulis", contexts: ["page", "action"] });
      chrome.contextMenus.create({ id: "kalam-studio", title: "Kalam: buka Studio (tab penuh)", contexts: ["action"] });
    });
    if (reason === "install") await this.store.set("installedAt", new Date().toISOString());
    this.log.info("Kalam siap", reason);
  }

  async ensureAlarms() {
    await this.ready;
    const menit = Math.max(30, this.settings.num("menulis.pengingatMenit"));
    const existing = await chrome.alarms.get(ALARM_REMIND);
    if (!existing || existing.periodInMinutes !== menit) {
      chrome.alarms.create(ALARM_REMIND, { periodInMinutes: menit, delayInMinutes: menit });
    }
    chrome.alarms.create(ALARM_CARE, { periodInMinutes: 5 });
  }

  async alarm({ name }) {
    await this.ready;
    if (name === ALARM_REMIND) {
      if (!this.settings.bool("menulis.pengingat")) return;
      const tab = await this.activeTab();
      if (tab?.id) this.bus.sendTab(tab.id, MSG.ONBOARDING, { kind: "pengingat", menit: this.settings.num("menulis.pengingatMenit") });
      return;
    }
    if (name === ALARM_CARE) {
      const tab = await this.activeTab();
      if (tab?.id) this.bus.sendTab(tab.id, MSG.CONNECT_STATUS, { kind: "rawat" });
    }
  }

  async activeTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  }

  async command(cmd) {
    const tab = await this.activeTab();
    if (cmd === "open-studio") return this.openStudio();
    if (!tab?.id) return;
    const ok = await this.inject(tab.id);
    if (!ok) return this.openStudio();
    if (cmd === "toggle-sidebar") await this.bus.sendTab(tab.id, MSG.SIDEBAR_TOGGLE, { toggle: true });
    if (cmd === "toggle-fullscreen") await this.bus.sendTab(tab.id, MSG.SIDEBAR_MODE, { mode: "fullscreen" });
  }

  async toggle(tab) {
    if (!tab?.id) return;
    const ok = await this.inject(tab.id);
    if (!ok) { this.openStudio(); return; }
    await this.bus.sendTab(tab.id, MSG.SIDEBAR_TOGGLE, { toggle: true });
  }

  async toggleById(tabId, open) {
    const id = tabId || (await this.activeTab())?.id;
    if (!id) return { ok: false };
    await this.inject(id);
    return this.bus.sendTab(id, MSG.SIDEBAR_TOGGLE, { open });
  }

  async inject(tabId) {
    if (!tabId) return false;
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (!tab?.url || !INJECTABLE.test(tab.url)) return false;
    if (this.injected.has(tabId)) {
      const alive = await this.bus.sendTab(tabId, MSG.SIDEBAR_PING, {});
      if (alive?.ok) return true;
      this.injected.delete(tabId);
    }
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ["content/Loader.js"] });
      this.injected.add(tabId);
      return true;
    } catch (err) {
      this.log.warn("suntik gagal", err.message);
      return false;
    }
  }

  async contextMenu(info, tab) {
    if (info.menuItemId === "kalam-studio") return this.openStudio();
    if (!tab?.id) return;
    await this.inject(tab.id);
    if (info.menuItemId === "kalam-open") return this.bus.sendTab(tab.id, MSG.SIDEBAR_TOGGLE, { open: true });
    if (info.menuItemId === "kalam-clip") {
      return this.bus.sendTab(tab.id, MSG.SCRAPE_RUN, { kind: "selection", text: info.selectionText || "", url: info.pageUrl });
    }
  }

  openStudio() {
    return chrome.tabs.create({ url: chrome.runtime.getURL("studio/index.html") });
  }

  async download(base64, mime, filename) {
    const url = `data:${mime || "application/octet-stream"};base64,${base64}`;
    const folder = this.settings.get("data.folderUnduhan") || "Kalam";
    const id = await chrome.downloads.download({ url, filename: `${folder}/${filename}`, saveAs: false });
    return { id, filename: `${folder}/${filename}` };
  }
}

new ServiceWorker();