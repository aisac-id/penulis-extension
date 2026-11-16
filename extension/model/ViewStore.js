import { uid } from "../sidebar/ui/Dom.js";

export class ViewStore {
  constructor(store) { this.store = store; this.views = []; }
  async load() { this.views = (await this.store.get("savedViews", [])) || []; return this.views; }
  async save() { await this.store.set("savedViews", this.views); }
  for(panel) { return this.views.filter((v) => v.panel === panel); }
  async add(panel, name, state) {
    const v = { id: uid("view"), panel, name, state, createdAt: new Date().toISOString() };
    this.views.push(v); await this.save(); return v;
  }
  async remove(id) {
    const it = this.views.find((v) => v.id === id);
    this.views = this.views.filter((v) => v.id !== id);
    await this.save(); return it;
  }
  async restore(id) {
    const it = this.views.find((v) => v.id === id);
    this.views = this.views.filter((v) => v.id !== id);
    if (it) this.views.push(it);
    await this.save(); return it;
  }
  get(id) { return this.views.find((v) => v.id === id) || null; }
}
