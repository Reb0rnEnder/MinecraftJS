// Proxy Servers: the MinecraftJS proxies used to reach vanilla servers (and to relay Microsoft sign in and skins).
// Laid out like the multiplayer screen: a list with ping bars and move arrows, and add / edit / delete buttons.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button, TextField } from '../widgets.js';
import { platform } from '../../platform/platform.js';
import { SlotList } from '../slot-list.js';
import { ConfirmScreen } from './menus.js';
import { parseProxyUrl } from '../../net/address.js';
import { proxyTests, ensureTested } from '../../net/proxies.js';

export class ProxiesScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
    this.tests = proxyTests; // url -> { pending } | { ping, info } | { error }
    this.selected = game.proxies.index;
    this.hoverText = null;
  }

  get proxies() { return this.game.proxies; }
  get items() { return this.proxies.list; }

  init() {
    const g = this.game, cx = this.width / 2;
    const prevScroll = this.list ? this.list.amountScrolled : 0;
    this.list = new ProxyList(this);
    this.list.amountScrolled = prevScroll;
    this.useBtn = new Button(1, cx - 154, this.height - 52, 100, 20, tr('minecraftjs.proxies.use'), () => this.use());
    this.buttons.push(this.useBtn);
    this.buttons.push(new Button(4, cx - 50, this.height - 52, 100, 20, tr('minecraftjs.proxies.testAll'), () => this.tests.clear()));
    this.buttons.push(new Button(3, cx + 54, this.height - 52, 100, 20, tr('minecraftjs.proxies.add'), () => g.screens.open(new ProxyEditScreen(g, this, null))));
    this.editBtn = new Button(7, cx - 154, this.height - 28, 70, 20, tr('selectServer.edit'), () => this.selected >= 0 && g.screens.open(new ProxyEditScreen(g, this, this.selected)));
    this.buttons.push(this.editBtn);
    this.delBtn = new Button(2, cx - 74, this.height - 28, 70, 20, tr('selectServer.delete'), () => this.remove());
    this.buttons.push(this.delBtn);
    this.testBtn = new Button(8, cx + 4, this.height - 28, 70, 20, tr('minecraftjs.proxies.test'), () => {
      const p = this.items[this.selected];
      if (p) this.tests.delete(p.url);
    });
    this.buttons.push(this.testBtn);
    this.buttons.push(new Button(0, cx + 80, this.height - 28, 75, 20, tr('gui.done'), () => this.close()));
  }

  testAll() {
    for (const p of this.items) ensureTested(p.url);
  }

  select(i) { this.selected = i; }

  use() {
    if (this.selected < 0 || this.selected >= this.items.length) return;
    this.proxies.select(this.selected);
  }

  remove() {
    const g = this.game, p = this.items[this.selected];
    if (!p) return;
    g.screens.open(new ConfirmScreen(g, (yes) => {
      if (yes) {
        const active = this.proxies.index;
        this.items.splice(this.selected, 1);
        // keep the active proxy selected (it moves up when an earlier one is removed)
        if (this.selected < active) this.game.settings.proxy = active - 1;
        else if (this.selected === active) this.game.settings.proxy = 0;
        this.selected = -1;
        this.proxies.save();
      }
      g.screens.open(this);
    }, tr('minecraftjs.proxies.deleteQuestion'), "'" + p.name + "' " + tr('selectServer.deleteWarning'), tr('selectServer.deleteButton'), tr('gui.cancel')));
  }

  moveUp(i, shift) { this._swap(i, shift ? 0 : i - 1); }
  moveDown(i, shift) { this._swap(i, shift ? this.items.length - 1 : i + 1); }
  // Moves the entry, keeping the active proxy and the selection on the same entries
  _swap(i, j) {
    const s = this.items;
    if (i === j || j < 0 || j >= s.length) return;
    const activeEntry = this.proxies.current();
    const selEntry = s[this.selected];
    const [e] = s.splice(i, 1);
    s.splice(j, 0, e);
    this.game.settings.proxy = s.indexOf(activeEntry);
    this.selected = selEntry ? s.indexOf(selEntry) : -1;
    this.proxies.save();
  }

  render(gui, mx, my, partial) {
    this.testAll();
    this.hoverText = null;
    const ok = this.selected >= 0 && this.selected < this.items.length;
    this.editBtn.enabled = this.delBtn.enabled = this.testBtn.enabled = ok;
    this.useBtn.enabled = ok && this.selected !== this.proxies.index;
    gui.dirtBackground();
    this.list.render(gui, mx, my);
    gui.textCentered(tr('minecraftjs.proxies.title'), this.width / 2, 20, 0xffffff, true);
    if (!this.items.length) gui.textCentered(tr('minecraftjs.proxies.none'), this.width / 2, this.height / 2 - 20, 0x808080, false);
    for (const b of this.buttons) b.render(gui, mx, my);
    if (this.hoverText) gui.tooltip(this.hoverText.split('\n'), mx, my);
  }

  mouseDown(mx, my, button, e) {
    if (super.mouseDown(mx, my, button)) return true;
    return this.list.mouseDown(mx, my, button, e);
  }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); this.list.mouseUp(); }
  mouseMove(mx, my) { this.list.mouseMove(mx, my); }
  wheel(d) { this.list.wheel(d); }

  key(e) {
    const n = this.items.length;
    if (e.code === 'F5') { this.tests.clear(); return true; }
    if (this.selected >= 0) {
      const i = this.selected;
      if (e.code === 'ArrowUp' && i > 0) { if (e.shift) this._swap(i, i - 1); else this.select(i - 1); return true; }
      if (e.code === 'ArrowDown' && i < n - 1) { if (e.shift) this._swap(i, i + 1); else this.select(i + 1); return true; }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { this.use(); return true; }
    }
    return super.key(e);
  }

  close() { this.game.screens.open(this.parent); }
}

class ProxyList extends SlotList {
  constructor(screen) {
    super(screen, 32, screen.height - 64, 36, { listWidth: 220 + 85, scrollBarOffset: 30 });
  }
  size() { return this.screen.items.length; }
  isSelected(i) { return i === this.screen.selected; }

  drawSlot(gui, i, x, y, h, mx, my) {
    const s = this.screen, p = s.items[i], lw = this.listWidth;
    const r = s.tests.get(p.url);
    const active = i === s.proxies.index;
    gui.text(p.name + (active ? ' §a' + tr('minecraftjs.accounts.inUse') : ''), x + 32 + 3, y + 1, 0xffffff, false);
    gui.text(gui.font.trimToWidth(p.url, lw - 32 - 6), x + 32 + 3, y + 12, 0x808080, false);
    let status, k = 0, l, hover;
    if (!r || r.pending) {
      status = '§8' + tr('minecraftjs.multiplayer.pinging');
      k = 1;
      l = (Math.floor(platform().now() / 100) + i * 2) & 7;
      if (l > 4) l = 8 - l;
      hover = 'Pinging...';
    } else if (r.error) {
      status = '§4' + tr('minecraftjs.proxies.unreachable') + ' §8(' + r.error + ')';
      l = 5; hover = '(no connection)';
    } else {
      status = '§7' + (r.info ? (r.info.name || 'MinecraftJS proxy') + (r.info.version ? ' ' + r.info.version : '') : tr('minecraftjs.proxies.reachable'));
      l = r.ping < 150 ? 0 : r.ping < 300 ? 1 : r.ping < 600 ? 2 : r.ping < 1000 ? 3 : 4;
      hover = r.ping + 'ms';
    }
    gui.text(gui.font.trimToWidth(status, lw - 32 - 6), x + 32 + 3, y + 21, 0x808080, false);
    if (r && !r.pending && !r.error) {
      const ms = r.ping + 'ms';
      gui.text('§7' + ms, x + lw - gui.textWidth(ms) - 15 - 2, y + 1, 0x808080, false);
    }
    gui.blit('gui/icons.png', x + lw - 15, y, k * 10, 176 + l * 8, 10, 8);
    const rx = mx - x, ry = my - y;
    if (my >= this.top && my <= this.bottom && rx >= lw - 15 && rx <= lw - 5 && ry >= 0 && ry <= 8) s.hoverText = hover;
    // Use / move arrows on hover, in the spot where the server list has its icons (proxies have none)
    if (s.game.settings.touchscreen || this.slotAt(mx, my) === i) {
      const SEL = 'gui/server_selection.png';
      const over = my >= this.top && my <= this.bottom;
      gui.blit(SEL, x, y, 0, over && rx < 32 && rx > 16 && ry >= 0 && ry < 32 ? 32 : 0, 32, 32);
      if (i > 0) gui.blit(SEL, x, y, 96, over && rx >= 0 && rx < 16 && ry >= 0 && ry < 16 ? 32 : 0, 32, 32);
      if (i < s.items.length - 1) gui.blit(SEL, x, y, 64, over && rx >= 0 && rx < 16 && ry > 16 && ry < 32 ? 32 : 0, 32, 32);
    }
  }

  clicked(i, dbl, mx, my, rx, ry, e) {
    const s = this.screen;
    const shift = !!(e && e.shift);
    if (rx <= 32) {
      if (rx < 32 && rx > 16) { s.select(i); s.use(); return; }
      if (rx < 16 && ry < 16 && i > 0) { s.moveUp(i, shift); return; }
      if (rx < 16 && ry > 16 && i < s.items.length - 1) { s.moveDown(i, shift); return; }
    }
    s.select(i);
    if (dbl) s.use();
  }
}

export class ProxyEditScreen extends Screen {
  constructor(game, parent, index) {
    super(game);
    this.parent = parent;
    this.index = index;
    this.background = 'dirt';
  }

  init() {
    const g = this.game, cx = this.width / 2;
    const p = this.index !== null ? g.proxies.list[this.index] : null;
    this.nameField = new TextField(cx - 100, 66, 200, 20, { text: p ? p.name : tr('minecraftjs.proxies.defaultName'), maxLength: 32, focused: true });
    this.fields.push(this.nameField);
    this.urlField = new TextField(cx - 100, 106, 200, 20, { text: p ? p.url : '', maxLength: 256, onEnter: () => this.done() });
    this.fields.push(this.urlField);
    this.doneBtn = new Button(0, cx - 100, this.height / 4 + 96 + 18, 200, 20, p ? tr('gui.done') : tr('minecraftjs.proxies.add'), () => this.done());
    this.buttons.push(this.doneBtn);
    this.buttons.push(new Button(1, cx - 100, this.height / 4 + 120 + 18, 200, 20, tr('gui.cancel'), () => g.screens.open(this.parent)));
  }

  done() {
    const url = parseProxyUrl(this.urlField.text);
    if (!url) return;
    const g = this.game;
    const entry = { name: this.nameField.text || tr('minecraftjs.proxies.defaultName'), url };
    if (this.index !== null) g.proxies.list[this.index] = entry;
    else {
      g.proxies.list.push(entry);
      if (g.proxies.list.length === 1) g.settings.proxy = 0;
    }
    g.proxies.save();
    this.parent.tests.delete(url);
    g.screens.open(this.parent);
  }

  renderContent(gui) {
    const url = parseProxyUrl(this.urlField.text);
    this.doneBtn.enabled = !!url;
    gui.textCentered(this.index !== null ? tr('minecraftjs.proxies.edit') : tr('minecraftjs.proxies.add'), this.width / 2, 17, 0xffffff);
    gui.text(tr('minecraftjs.proxies.enterName'), this.width / 2 - 100, 53, 0xa0a0a0);
    gui.text(tr('minecraftjs.proxies.enterUrl'), this.width / 2 - 100, 94, 0xa0a0a0);
    if (url && url !== this.urlField.text.trim()) gui.text('§8' + gui.font.trimToWidth(url, 200), this.width / 2 - 100, 130, 0x808080, false);
  }

  close() { this.game.screens.open(this.parent); }
}
