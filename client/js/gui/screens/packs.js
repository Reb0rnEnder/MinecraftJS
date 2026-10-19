// GuiScreenResourcePacks: available / selected pack lists, adding packs from files.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { platform } from '../../platform/platform.js';
import { decodePng } from '../../util/png.js';

const ENTRY_W = 200, ENTRY_H = 36, HEADER = 16, ARROWS = 'gui/resource_packs.png';

export class ResourcePacksScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
    this.available = [];
    this.selected = [];
    this.loaded = false;
    this.message = '';
    this.scroll = [0, 0];
    this.icons = new Map();
    this._load();
  }

  async _load() {
    const A = this.game.assets;
    const all = await A.listPacks();
    const active = this.game.settings.resourcePacks || [];
    this.selected = active.map((id) => all.find((p) => p.id === id)).filter(Boolean);
    this.available = all.filter((p) => !active.includes(p.id));
    this.initial = this.selected.map((p) => p.id).join('\n');
    this.loaded = true;
  }

  init() {
    const cx = this.width / 2;
    this.buttons.push(new Button(2, cx - 154, this.height - 48, 150, 20, tr('resourcePack.openFolder'), () => this._add()));
    this.buttons.push(new Button(1, cx + 4, this.height - 48, 150, 20, tr('gui.done'), () => this.done()));
  }

  async _add() {
    const files = await platform().pickFiles({ accept: '.zip', multiple: true });
    for (const f of files) {
      try {
        const pack = await this.game.assets.addPack(f.name, f.bytes);
        this.available = this.available.filter((p) => p.id !== pack.id);
        this.selected = this.selected.filter((p) => p.id !== pack.id);
        this.available.unshift(pack);
        this.message = '§a' + tr('minecraftjs.packs.added', pack.name);
      } catch (e) {
        this.message = '§c' + f.name + ': ' + e.message;
      }
    }
  }

  async done() {
    const ids = this.selected.map((p) => p.id);
    const g = this.game;
    if (ids.join('\n') === this.initial) { g.screens.open(this.parent); return; }
    g.settings.resourcePacks = ids;
    g.settings.save();
    const loading = new ReloadingScreen(g);
    g.screens.open(loading);
    try {
      await g.assets.activatePacks(ids);
      await g.reloadResources((msg, pct) => { loading.status = msg; loading.pct = pct; });
    } catch (e) {
      console.error(e);
      this.message = '§c' + tr('minecraftjs.packs.failed', e.message);
    }
    g.screens.open(this.parent);
  }

  close() { this.done(); }

  _lists() {
    const top = 32, bottom = this.height - 64;
    return [
      { items: this.available, x: this.width / 2 - 4 - ENTRY_W, top, bottom, title: tr('resourcePack.available.title'), side: 0 },
      { items: [...this.selected, null], x: this.width / 2 + 4, top, bottom, title: tr('resourcePack.selected.title'), side: 1 },
    ];
  }

  // Default pack: vanilla shows pack.png from the root of the game jar
  _defaultIcon() {
    const A = this.game.assets;
    const k = 'default@' + A.version;
    if (!this.icons.has(k)) {
      this.icons.set(k, null);
      A.source.bytes('pack.png').then((bytes) => {
        if (!bytes) return;
        const img = decodePng(bytes);
        this.icons.set(k, A.makeTexture('packicon:default', img.width, img.height, img.data, { filter: 'linear' }));
      }).catch(() => {});
    }
    return this.icons.get(k) || 'misc/unknown_pack.png';
  }

  _icon(pack) {
    const A = this.game.assets;
    if (!pack) return this._defaultIcon();
    const k = pack.id + '@' + A.version;
    if (!this.icons.has(k)) {
      this.icons.set(k, pack.icon ? A.makeTexture('packicon:' + pack.id, pack.icon.width, pack.icon.height, pack.icon.data, { filter: 'linear' }) : null);
    }
    return this.icons.get(k) || 'misc/unknown_pack.png';
  }

  renderContent(gui, mx, my) {
    gui.textCentered(tr('resourcePack.title'), this.width / 2, 16, 0xffffff);
    if (!this.loaded) { gui.textCentered(tr('minecraftjs.loading'), this.width / 2, this.height / 2, 0xa0a0a0); return; }
    for (const L of this._lists()) {
      gui.rect(L.x, L.top, L.x + ENTRY_W, L.bottom, 0x80000000);
      gui.scissor(L.x, L.top, ENTRY_W, L.bottom - L.top);
      gui.textCentered('§n§l' + L.title, L.x + ENTRY_W / 2, L.top + 4 - this.scroll[L.side], 0xffffff);
      let y = L.top + 4 + HEADER - this.scroll[L.side];
      L.items.forEach((pack, idx) => {
        this._entry(gui, L, pack, idx, L.x + 2, y, mx, my);
        y += ENTRY_H;
      });
      gui.clearScissor();
    }
    if (this.message) gui.textCentered(this.message, this.width / 2, this.height - 60, 0xffffff);
    gui.textCentered(tr('resourcePack.folderInfo'), this.width / 2 - 77, this.height - 26, 0x808080);
  }

  _entry(gui, L, pack, idx, x, y, mx, my) {
    const name = pack ? pack.name : tr('minecraftjs.packs.defaultName');
    const desc = pack ? pack.description || '' : tr('minecraftjs.packs.defaultDescription');
    const incompatible = pack && pack.format !== 1 && pack.format !== undefined;
    if (incompatible) gui.rect(x - 1, y - 1, x + ENTRY_W - 3, y + ENTRY_H - 3, 0xff770000);
    const icon = gui.tex(this._icon(pack));
    if (icon) gui.drawImage(icon, 0, 0, icon.width, icon.height, x, y, 32, 32);
    const overIcon = pack && mx >= x && mx < x + 32 && my >= y && my < y + 32 && my >= L.top && my < L.bottom;
    if (overIcon) {
      gui.rect(x, y, x + 32, y + 32, 0xa0909090);
      const rx = mx - x, ry = my - y;
      if (L.side === 0) gui.blit(ARROWS, x, y, 0, rx < 32 ? 32 : 0, 32, 32);
      else {
        gui.blit(ARROWS, x, y, 32, rx < 16 ? 32 : 0, 32, 32);
        if (idx > 0) gui.blit(ARROWS, x, y, 96, rx < 32 && rx > 16 && ry < 16 ? 32 : 0, 32, 32);
        if (idx < this.selected.length - 1) gui.blit(ARROWS, x, y, 64, rx < 32 && rx > 16 && ry > 16 ? 32 : 0, 32, 32);
      }
    }
    let title = name;
    if (gui.textWidth(title) > 157) title = gui.font.trimToWidth(title, 157 - gui.textWidth('...')) + '...';
    gui.text(title, x + 32 + 2, y + 1, 0xffffff, true);
    const lines = incompatible ? ['§c' + tr(pack.format > 1 ? 'resourcePack.incompatible.new' : 'resourcePack.incompatible.old')] : gui.font.wrap(desc, 157);
    for (let i = 0; i < Math.min(2, lines.length); i++) gui.text(lines[i], x + 32 + 2, y + 12 + 10 * i, 0x808080, true);
  }

  mouseDown(mx, my, button, e) {
    if (super.mouseDown(mx, my, button)) return true;
    if (!this.loaded || button !== 0) return false;
    for (const L of this._lists()) {
      if (mx < L.x || mx >= L.x + ENTRY_W || my < L.top || my >= L.bottom) continue;
      const idx = Math.floor((my - L.top - 4 - HEADER + this.scroll[L.side]) / ENTRY_H);
      const pack = L.items[idx];
      if (!pack) return false;
      const ex = L.x + 2, ey = L.top + 4 + HEADER - this.scroll[L.side] + idx * ENTRY_H;
      const rx = mx - ex, ry = my - ey;
      if (L.side === 0) {
        if (e && e.shift) { this._delete(pack); return true; }
        if (rx < 32) { this.available.splice(idx, 1); this.selected.unshift(pack); }
      } else if (rx < 32) {
        if (rx < 16) { this.selected.splice(idx, 1); this.available.unshift(pack); }
        else if (ry < 16 && idx > 0) { this.selected.splice(idx, 1); this.selected.splice(idx - 1, 0, pack); }
        else if (ry >= 16 && idx < this.selected.length - 1) { this.selected.splice(idx, 1); this.selected.splice(idx + 1, 0, pack); }
      }
      this.game.sound.playUi('gui.button.press', 1);
      return true;
    }
    return false;
  }

  async _delete(pack) {
    await this.game.assets.removePack(pack.id);
    this.available = this.available.filter((p) => p !== pack);
    this.message = '§e' + tr('minecraftjs.packs.deleted', pack.name);
  }

  wheel(d) {
    const [mx] = this.game.screens._mouse();
    const side = mx >= this.width / 2 ? 1 : 0;
    const n = side ? this.selected.length + 1 : this.available.length;
    const max = Math.max(0, n * ENTRY_H + 8 + HEADER - (this.height - 64 - 32));
    this.scroll[side] = Math.max(0, Math.min(max, this.scroll[side] + d * 18));
  }
}

class ReloadingScreen extends Screen {
  constructor(game) { super(game); this.background = 'dirt'; this.status = tr('minecraftjs.packs.reloading'); this.pct = 0; }
  key() { return true; }
  renderContent(gui) {
    gui.textCentered(this.status, this.width / 2, this.height / 2 - 10, 0xffffff);
    const w = 200, x = this.width / 2 - w / 2, y = this.height / 2 + 4;
    gui.rect(x, y, x + w, y + 2, 0xff808080);
    gui.rect(x, y, x + w * (this.pct || 0) / 100, y + 2, 0xff80ff80);
  }
}
