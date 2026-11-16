import { ActionLibrary } from "./ActionLibrary.js";
import { MSG } from "../core/MessageBus.js";

export class LocalExecutor {
  constructor(settings, { root = document, bus = null, logger = null } = {}) {
    this.lib = new ActionLibrary(settings, { root, bus, logger });
    this.kind = "local";
  }

  async run(step) { return this.lib.run(step); }
  test(cond) { return this.lib.test(cond); }
  blocked() { return this.lib.blocked(); }
  vars() { return this.lib.vars; }
  destroy() { this.lib.destroy(); }
}

export class TabExecutor {
  constructor(bus, tabId) {
    this.bus = bus;
    this.tabId = tabId;
    this.kind = "tab";
    this.collected = {};
  }

  async run(step) {
    const res = await this.bus.sendTab(this.tabId, MSG.PAGE_ACT, { op: "run", step });
    if (!res) return { ok: false, error: "Tab belum siap. Klik ikon Kalam sekali di tab itu." };
    if (res.ok && step.as && Array.isArray(res.data)) this.collected[step.as] = res.data;
    return res;
  }

  async test(cond) { return !!(await this.bus.sendTab(this.tabId, MSG.PAGE_ACT, { op: "test", cond }))?.value; }
  async blocked() { return (await this.bus.sendTab(this.tabId, MSG.PAGE_ACT, { op: "blocked" }))?.reason || null; }
  vars() { return this.collected; }
  destroy() { this.collected = {}; }
}
