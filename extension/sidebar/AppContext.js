import { Logger } from "../core/Logger.js";
import { MessageBus } from "../core/MessageBus.js";
import { StorageService } from "../core/StorageService.js";
import { Settings } from "../core/Settings.js";
import { SecretVault } from "../core/SecretVault.js";
import { HttpClient } from "../core/HttpClient.js";
import { Toast } from "./ui/Toast.js";
import { Modal } from "./ui/Modal.js";
import { Drawer } from "./ui/Drawer.js";
import { Sound } from "./ui/Sound.js";
import { Help } from "./ui/Help.js";
import { Controls } from "./ui/Controls.js";
import { ProjectService } from "../model/ProjectService.js";
import { BibleService } from "../model/BibleService.js";
import { OutlineService } from "../model/OutlineService.js";
import { GoalTracker } from "../model/GoalTracker.js";
import { SubmissionService } from "../model/SubmissionService.js";
import { ViewStore } from "../model/ViewStore.js";
import { SeedData } from "../model/SeedData.js";
import { StyleChecker } from "../analysis/StyleChecker.js";
import { ConsistencyChecker } from "../analysis/ConsistencyChecker.js";
import { SnapshotService } from "../editor/SnapshotService.js";
import { LibraryStore } from "../pipeline/LibraryStore.js";
import { DataPipeline } from "../pipeline/DataPipeline.js";
import { AnalysisService } from "../pipeline/AnalysisService.js";
import { ExportService } from "../pipeline/ExportService.js";
import { ScraperHub } from "../scrapers/ScraperHub.js";
import { PromptLibrary } from "../llm/PromptLibrary.js";
import { LlmHub } from "../llm/LlmHub.js";
import { ScriptStore } from "../rpa/ScriptStore.js";
import { RpaEngine } from "../rpa/RpaEngine.js";
import { ConnectionHub } from "../connectors/ConnectionHub.js";
import { LicenseService } from "../license/LicenseService.js";
import { Branding } from "../license/Branding.js";

export class AppContext {
  constructor(root, { mode = "sidebar", logger = null } = {}) {
    this.root = root;
    this.mode = mode;
    this.log = logger || new Logger("warn");
    this.bus = new MessageBus(this.log);
    this.store = new StorageService(this.bus, this.log);
    this.settings = new Settings(this.store, this.bus, this.log);
    this.vault = new SecretVault(this.store, this.settings, this.log);
    this.http = new HttpClient(this.bus, this.settings, this.log);
    this.brand = new Branding(this.settings);
    this.toast = new Toast(root, this.settings);
    this.modal = new Modal(root);
    this.drawer = new Drawer(root);
    this.sound = new Sound(this.settings);
    this.help = new Help(this.modal, this.settings);
    this.controls = new Controls(this.settings);
    this.projects = new ProjectService(this.store, this.bus, this.settings);
    this.bible = new BibleService(this.store, this.projects, this.bus);
    this.outline = new OutlineService(this.store, this.projects, this.bus);
    this.goals = new GoalTracker(this.store, this.settings, this.bus, this.sound);
    this.submissions = new SubmissionService(this.store, this.projects, this.bus);
    this.views = new ViewStore(this.store);
    this.style = new StyleChecker(this.settings);
    this.consistency = new ConsistencyChecker(this.projects, this.bible, this.outline);
    this.snapshots = new SnapshotService(this.store, this.settings);
    this.library = new LibraryStore(this.settings, this.bus, this.log);
    this.scrapers = new ScraperHub(this.settings, this.log);
    this.pipeline = new DataPipeline(this.scrapers, this.library, this.settings, this.bus, this.log);
    this.analysis = new AnalysisService(this.library, this.settings);
    this.exports = new ExportService(this.settings, this.library, this.log);
    this.prompts = new PromptLibrary(this.store);
    this.llm = new LlmHub(this.settings, this.vault, this.http, this.store, this.bus, this.prompts,
      { projects: this.projects, bible: this.bible, consistency: this.consistency, style: this.style, submissions: this.submissions }, this.log);
    this.scripts = new ScriptStore(this.store, this.bus);
    this.rpa = new RpaEngine(this.settings, this.bus, this.log);
    this.connections = new ConnectionHub({ settings: this.settings, vault: this.vault, http: this.http, store: this.store, bus: this.bus, logger: this.log });
    this.license = new LicenseService(this.store, this.settings, this.bus, this.log);
    this.cleanups = [];
    this.editor = null;
    this.tabId = null;
  }

  async load({ seed = true } = {}) {
    await this.settings.load();
    this.log.level = this.settings.get("lanjutan.logLevel");
    await this.projects.load();
    const fresh = seed && !this.projects.projects.length;
    if (fresh) { await SeedData.install(this.store); await this.projects.load(); }
    await Promise.all([
      this.bible.load(), this.outline.load(), this.goals.load(), this.submissions.load(),
      this.views.load(), this.library.load(), this.prompts.load(), this.scripts.load(),
      this.license.load(), this.llm.load(), this.connections.load(),
    ]);
    if (fresh && !this.library.items.length) for (const c of SeedData.clips()) await this.library.add(c);
    this.settings.applyTheme(this.root);
    this.brand.apply(this.root);
    this.cleanups.push(this.settings.onChange(() => {
      this.settings.applyTheme(this.root);
      this.brand.apply(this.root);
      this.bus.emit("settings.changed", this.settings.values);
    }));
    return this;
  }

  async switchProject(id) {
    await this.projects.setActive(id);
    await Promise.all([this.bible.load(id), this.outline.load(id), this.submissions.load(id)]);
    this.bus.emit("project.changed", { id, switched: true });
    return this.projects.active;
  }

  on(type, fn) {
    const off = this.bus.on(type, fn);
    this.cleanups.push(off);
    return off;
  }

  setEditor(editor) { this.editor = editor; }

  insertToEditor(text) {
    if (!this.editor?.chapterId) { this.toast.warn("Buka satu bab di tab Naskah dulu."); return false; }
    this.editor.appendText(text);
    this.openPanel?.("naskah");
    return true;
  }

  destroy() {
    for (const off of this.cleanups.splice(0)) { try { off(); } catch { /* sudah dilepas */ } }
    this.goals.destroy();
    this.rpa.destroy();
    this.connections.destroy();
    this.library.destroy();
    this.vault.lock();
    this.store.destroy?.();
    this.bus.destroy();
  }
}
