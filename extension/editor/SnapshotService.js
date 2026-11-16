import { uid } from "../sidebar/ui/Dom.js";
import { TextStats } from "../analysis/TextStats.js";

export class SnapshotService {
  constructor(store, settings) {
    this.store = store;
    this.settings = settings;
  }

  key(sceneId) { return `snapshots:${sceneId}`; }

  async list(sceneId) {
    return (await this.store.get(this.key(sceneId), [])) || [];
  }

  async capture(sceneId, text, label = "manual") {
    if (!text || !text.trim()) return null;
    const list = await this.list(sceneId);
    if (list[0]?.text === text) return list[0];
    const snap = { id: uid("snap"), at: new Date().toISOString(), label, words: TextStats.words(text), text };
    list.unshift(snap);
    const max = this.settings.num("editor.maksSnapshot");
    await this.store.set(this.key(sceneId), list.slice(0, max));
    return snap;
  }

  async restore(sceneId, snapId) {
    const list = await this.list(sceneId);
    return list.find((s) => s.id === snapId) || null;
  }

  async remove(sceneId, snapId) {
    const list = await this.list(sceneId);
    const next = list.filter((s) => s.id !== snapId);
    await this.store.set(this.key(sceneId), next);
    return list.length - next.length;
  }

  async clear(sceneId) { await this.store.remove(this.key(sceneId)); }

  static diff(oldText, newText, limit = 60) {
    const a = String(oldText || "").split(/\s+/).filter(Boolean);
    const b = String(newText || "").split(/\s+/).filter(Boolean);
    const out = [];
    let i = 0;
    let j = 0;
    while ((i < a.length || j < b.length) && out.length < limit) {
      if (a[i] === b[j]) { i++; j++; continue; }
      const aheadB = b.indexOf(a[i], j);
      const aheadA = a.indexOf(b[j], i);
      if (aheadB > -1 && (aheadA === -1 || aheadB - j <= aheadA - i)) {
        while (j < aheadB && out.length < limit) out.push({ t: "+", w: b[j++] });
      } else if (aheadA > -1) {
        while (i < aheadA && out.length < limit) out.push({ t: "-", w: a[i++] });
      } else {
        if (i < a.length) out.push({ t: "-", w: a[i++] });
        if (j < b.length) out.push({ t: "+", w: b[j++] });
      }
    }
    return out;
  }

  static summarizeDiff(oldText, newText) {
    const before = TextStats.words(oldText);
    const after = TextStats.words(newText);
    return { before, after, delta: after - before };
  }
}