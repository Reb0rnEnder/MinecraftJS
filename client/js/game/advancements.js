// ClientAdvancementManager (1.12): advancements the server sent, their progress, tabs (roots with a display) and
// the toast shown when one is completed.
import { chatToLegacy } from '../gui/chat.js';

export class Advancements {
  constructor(game) {
    this.game = game;
    this.map = new Map();   // id -> { id, parent, display, criteria, requirements, children: [] }
    this.progress = new Map(); // id -> { criterion: obtained time | null }
    this.selectedTab = null;
    this.listener = null;   // the open screen
  }

  clear() { this.map.clear(); this.progress.clear(); this.selectedTab = null; }

  // roots with a display, in arrival order (AdvancementList.getRoots)
  tabs() { return [...this.map.values()].filter((a) => !a.parent && a.display); }

  // ClientAdvancementManager.read
  onPacket(p) {
    if (p.reset) this.clear();
    for (const id of p.removed) this.map.delete(id);
    for (const a of p.added) {
      const display = a.display && { ...a.display, title: chatToLegacy(a.display.title), description: chatToLegacy(a.display.description) };
      this.map.set(a.id, { ...a, display, children: [] });
    }
    for (const a of this.map.values()) a.children = [];
    for (const a of this.map.values()) if (a.parent && this.map.has(a.parent)) this.map.get(a.parent).children.push(a);
    for (const pr of p.progress) {
      const a = this.map.get(pr.id);
      if (!a) continue;
      this.progress.set(pr.id, pr.criteria);
      // a completed advancement with a display that asks for it shows a toast (not on the first sync)
      if (!p.reset && this.isDone(a) && a.display && a.display.showToast) this.game.hud.addToast({ type: 'advancement', advancement: a });
    }
    if (!this.selectedTab || !this.map.has(this.selectedTab)) this.selectedTab = this.tabs()[0] ? this.tabs()[0].id : null;
    if (this.listener) this.listener.onAdvancementsChanged();
  }

  onSelectTab(id) { if (id && this.map.has(id)) { this.selectedTab = id; if (this.listener) this.listener.onAdvancementsChanged(); } }

  // AdvancementProgress: requirement groups are met when any of their criteria is obtained
  _completed(a) {
    const crit = this.progress.get(a.id) || {};
    let n = 0;
    for (const group of a.requirements) if (group.some((c) => crit[c] !== null && crit[c] !== undefined)) n++;
    return n;
  }
  isDone(a) { return a.requirements.length > 0 && this._completed(a) === a.requirements.length; }
  percent(a) { return a.criteria.length ? this._completed(a) / a.requirements.length : 0; }
  progressText(a) {
    if (!a.criteria.length || a.requirements.length <= 1) return null;
    return this._completed(a) + '/' + a.requirements.length;
  }
  hasProgress(a) { return this.progress.has(a.id); }
}
