import { today, dayKey } from "../sidebar/ui/Dom.js";

const EMPTY = () => ({ days: {}, sessions: 0, sprints: 0, streak: 0, lastGoalHit: null });

export class GoalTracker {
  constructor(store, settings, bus, sound) {
    this.store = store;
    this.settings = settings;
    this.bus = bus;
    this.sound = sound;
    this.data = EMPTY();
    this.sprint = { state: "idle", left: 0, total: 0, words: 0, startedAt: 0 };
    this.timer = null;
    this.onTick = null;
    this.celebrated = null;
  }

  async load() {
    this.data = (await this.store.get("activity", null)) || EMPTY();
    if (!this.data.days) this.data.days = {};
    this.data.streak = this.streak();
    return this.data;
  }

  async save() { await this.store.set("activity", this.data); this.bus.emit("activity.changed", { today: this.todayWords() }); }
  get goal() { return this.settings.num("menulis.targetHarian"); }
  todayWords() { return this.data.days[today()] || 0; }

  async addWords(delta, { silent = false } = {}) {
    if (!delta) return this.todayWords();
    const key = today();
    const before = this.data.days[key] || 0;
    const next = Math.max(0, before + delta);
    this.data.days[key] = next;
    if (this.sprint.state === "run" && delta > 0) this.sprint.words += delta;
    this.data.streak = this.streak();
    await this.save();
    if (!silent && before < this.goal && next >= this.goal && this.celebrated !== key) {
      this.celebrated = key;
      this.data.lastGoalHit = key;
      this.sound?.goal();
      this.bus.emit("goal.hit", { words: next, goal: this.goal });
    }
    return next;
  }

  async setToday(words) { const key = today(); return this.addWords(Math.max(0, Number(words) || 0) - (this.data.days[key] || 0)); }

  streak() {
    const min = this.settings.num("menulis.streakMinimal");
    let n = 0;
    const d = new Date();
    if ((this.data.days[dayKey(d)] || 0) < min) d.setDate(d.getDate() - 1);
    for (let i = 0; i < 400; i++) {
      if ((this.data.days[dayKey(d)] || 0) >= min) { n++; d.setDate(d.getDate() - 1); } else break;
    }
    return n;
  }

  series(count = 21) {
    const out = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      out.push({ key, words: this.data.days[key] || 0, isToday: key === today(),
        label: d.toLocaleDateString("id-ID", { day: "numeric", month: "short" }),
        short: d.toLocaleDateString("id-ID", { weekday: "short" }).slice(0, 3) });
    }
    return out;
  }

  average(days = 7) {
    const s = this.series(days).filter((x) => x.words > 0);
    return s.length ? Math.round(s.reduce((a, x) => a + x.words, 0) / s.length) : 0;
  }

  total() { return Object.values(this.data.days).reduce((a, b) => a + b, 0); }
  hitRate(days = 21) { const s = this.series(days); return s.filter((x) => x.words >= this.goal).length / s.length; }

  projection(remainingWords) {
    const avg = this.average(7);
    if (avg <= 0) return { days: null, date: null, avg, perDay: this.goal };
    const days = Math.ceil(remainingWords / avg);
    const d = new Date();
    d.setDate(d.getDate() + days);
    return { days, date: d.toISOString().slice(0, 10), avg, perDay: avg };
  }

  deadlinePressure(deadline, remainingWords) {
    if (!deadline) return null;
    const days = Math.max(1, Math.ceil((new Date(deadline) - new Date()) / 86400000));
    const need = Math.ceil(remainingWords / days);
    return { days, need, ok: need <= this.average(7) || need <= this.goal };
  }

  startSprint(minutes = null, kind = "run") {
    const mins = minutes || (kind === "rest" ? this.settings.num("menulis.rehatMenit") : this.settings.num("menulis.sprintMenit"));
    this.stopTimer();
    this.sprint = { state: kind, left: mins * 60000, total: mins * 60000, words: 0, startedAt: Date.now() };
    if (kind === "run") { this.data.sessions++; this.sound?.sprintStart(); }
    this.tickLoop();
    this.bus.emit("sprint.changed", this.sprint);
    return this.sprint;
  }

  tickLoop() {
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.sprint.state === "idle" || this.sprint.state === "pause") return;
      this.sprint.left -= 1000;
      if (this.sprint.left <= 0) {
        const finished = this.sprint.state;
        this.sprint.left = 0;
        this.sprint.state = "idle";
        this.stopTimer();
        if (finished === "run") { this.data.sprints++; this.save(); this.sound?.sprintEnd(); }
        else this.sound?.ok();
        this.bus.emit("sprint.done", { kind: finished, words: this.sprint.words });
      }
      this.onTick?.(this.sprint);
      this.bus.emit("sprint.tick", this.sprint);
    }, 1000);
  }

  pauseSprint() {
    if (this.sprint.state === "run" || this.sprint.state === "rest") { this.sprint.prev = this.sprint.state; this.sprint.state = "pause"; this.bus.emit("sprint.changed", this.sprint); }
    else if (this.sprint.state === "pause") { this.sprint.state = this.sprint.prev || "run"; this.bus.emit("sprint.changed", this.sprint); }
    return this.sprint;
  }

  stopSprint() {
    this.stopTimer();
    const words = this.sprint.words;
    this.sprint = { state: "idle", left: 0, total: 0, words: 0, startedAt: 0 };
    this.bus.emit("sprint.changed", this.sprint);
    return words;
  }

  stopTimer() { clearInterval(this.timer); this.timer = null; }

  async logSession(words, minutes) {
    const list = (await this.store.get("sprintLog", [])) || [];
    list.push({ at: new Date().toISOString(), words, minutes });
    await this.store.set("sprintLog", list.slice(-60));
    return list;
  }

  async sessions() { return (await this.store.get("sprintLog", [])) || []; }
  destroy() { this.stopTimer(); }
}
