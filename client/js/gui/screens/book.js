// GuiScreenBook: read written books, edit/sign book & quill (MC|BEdit / MC|BSign)
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { C } from '../../net/packets.js';
import { Writer } from '../../net/buffer.js';
import { nbt, TAG } from '../../net/nbt.js';
import { chatToLegacy } from '../chat.js';

const W = 192, H = 192;

class PageButton {
  constructor(x, y, next, onClick) { this.x = x; this.y = y; this.next = next; this.onClick = onClick; this.visible = true; this.enabled = true; }
  hovered(mx, my) { return mx >= this.x && my >= this.y && mx < this.x + 23 && my < this.y + 13; }
  render(gui, mx, my) {
    if (!this.visible) return;
    const u = this.hovered(mx, my) ? 23 : 0;
    gui.blit('gui/book.png', this.x, this.y, u, this.next ? 192 : 205, 23, 13);
  }
  mouseDown(mx, my, game) {
    if (this.visible && this.hovered(mx, my)) { game.sound.playUi('gui.button.press', 1); this.onClick(); return true; }
    return false;
  }
}

export class BookScreen extends Screen {
  constructor(game, item, editable) {
    super(game);
    this.background = 'none';
    this.item = item;
    this.editable = editable === undefined ? item.id === 386 : editable;
    const tag = game.items.nbt(item) || {};
    this.pages = (tag.pages && tag.pages.length ? tag.pages.slice() : ['']).map((p) => p);
    if (!this.editable) this.pages = this.pages.map((p) => { try { return chatToLegacy(p); } catch (e) { return p; } });
    this.page = 0;
    this.signing = false;
    this.title = '';
    this.modified = false;
    this.counter = 0;
    this.author = tag.author || '';
  }

  init() {
    const g = this.game;
    const x = (this.width - W) / 2, y = 2;
    this.left = x; this.top = y;
    if (this.editable) {
      this.signBtn = new Button(3, this.width / 2 - 100, 4 + H, 98, 20, tr('book.signButton'), () => { this.signing = true; this.updateButtons(); });
      this.doneBtn = new Button(0, this.width / 2 + 2, 4 + H, 98, 20, tr('gui.done'), () => { this.sendBook(false); this.close(); });
      this.finalBtn = new Button(5, this.width / 2 - 100, 4 + H, 98, 20, tr('book.finalizeButton'), () => { if (this.title.trim()) { this.sendBook(true); this.close(); } });
      this.cancelBtn = new Button(4, this.width / 2 + 2, 4 + H, 98, 20, tr('gui.cancel'), () => { this.signing = false; this.updateButtons(); });
      this.buttons.push(this.signBtn, this.doneBtn, this.finalBtn, this.cancelBtn);
    } else {
      this.buttons.push(new Button(0, this.width / 2 - 100, 4 + H, 200, 20, tr('gui.done'), () => this.close()));
    }
    this.nextBtn = new PageButton(x + 120, y + 154, true, () => this.nextPage());
    this.prevBtn = new PageButton(x + 38, y + 154, false, () => { if (this.page > 0) this.page--; this.updateButtons(); });
    this.buttons.push(this.nextBtn, this.prevBtn);
    this.updateButtons();
    void g;
  }

  nextPage() {
    if (this.page < this.pages.length - 1) this.page++;
    else if (this.editable && this.pages.length < 50) { this.pages.push(''); this.page++; this.modified = true; }
    this.updateButtons();
  }

  updateButtons() {
    this.nextBtn.visible = !this.signing && (this.page < this.pages.length - 1 || this.editable);
    this.prevBtn.visible = !this.signing && this.page > 0;
    if (this.editable) {
      this.signBtn.visible = this.doneBtn.visible = !this.signing;
      this.finalBtn.visible = this.cancelBtn.visible = this.signing;
      this.finalBtn.enabled = this.title.trim().length > 0;
    }
  }

  tick() { this.counter++; }

  sendBook(sign) {
    if (!this.modified && !sign) return;
    while (this.pages.length > 1 && !this.pages[this.pages.length - 1]) this.pages.pop();
    const g = this.game;
    const tagObj = { pages: nbt.list(TAG.STRING, this.pages.map((p) => p)) };
    if (sign) {
      tagObj.author = nbt.string(g.username);
      tagObj.title = nbt.string(this.title.trim());
    }
    const root = { t: TAG.COMPOUND, name: '', v: tagObj };
    const item = { id: sign ? 387 : 386, count: 1, damage: 0, nbt: root };
    const w = new Writer().slot(item).build();
    g.send(C.customPayload(sign ? 'MC|BSign' : 'MC|BEdit', w));
    const held = g.inventory.held();
    if (held && held.id === 386) { held.nbt = root; held.nbtRaw = null; held._simple = null; if (sign) held.id = 387; }
  }

  key(e) {
    if (e.code === 'Escape') { if (this.editable) this.sendBook(false); this.close(); return true; }
    if (!this.editable) return true;
    if (this.signing) {
      if (e.code === 'Backspace') { this.title = this.title.slice(0, -1); this.updateButtons(); return true; }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (this.title.trim()) { this.sendBook(true); this.close(); } return true; }
      return true;
    }
    const cur = this.pages[this.page] || '';
    if (e.code === 'Backspace') { this.pages[this.page] = cur.slice(0, -1); this.modified = true; return true; }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { this._insert('\n'); return true; }
    if (e.ctrl && e.code === 'KeyV') return true;
    return true;
  }

  char(c) {
    if (!this.editable) return true;
    if (this.signing) { if (this.title.length < 16 && c >= ' ') this.title += c; this.updateButtons(); return true; }
    if (c >= ' ' && c !== '§') this._insert(c);
    return true;
  }

  _insert(s) {
    const next = (this.pages[this.page] || '') + s;
    // Fit within 116px x 128px (FontRenderer.splitStringWidth)
    const lines = this.gui.font.wrap(next, 116);
    if (lines.length * 9 <= 128 && next.length < 256) { this.pages[this.page] = next; this.modified = true; }
  }

  render(gui, mx, my) {
    const x = this.left, y = this.top;
    gui.blit('gui/book.png', x, y, 0, 0, W, H);
    if (this.signing) {
      let t = this.title;
      if (Math.floor(this.counter / 6) % 2 === 0) t += '§0_'; else t += '§7_';
      const editTitle = tr('book.editTitle');
      gui.text(editTitle, x + 36 + (116 - gui.textWidth(editTitle)) / 2, y + 16 + 16, 0, false);
      gui.text(t, x + 36 + (116 - gui.textWidth(t)) / 2, y + 48, 0, false);
      const by = tr('book.byAuthor', this.game.username);
      gui.text('§8' + by, x + 36 + (116 - gui.textWidth(by)) / 2, y + 48 + 10, 0, false);
      const lines = gui.font.wrap(tr('book.finalizeWarning'), 116);
      lines.forEach((l, i) => gui.text(l, x + 36, y + 80 + i * 9, 0, false));
    } else {
      const ind = tr('book.pageIndicator', this.page + 1, this.pages.length);
      gui.text(ind, x - gui.textWidth(ind) + W - 44, y + 16, 0, false);
      let text = this.pages[this.page] || '';
      if (this.editable && Math.floor(this.counter / 6) % 2 === 0) text += '§0_';
      const lines = gui.font.wrap(text, 116);
      lines.slice(0, 14).forEach((l, i) => gui.text(l, x + 36, y + 16 + 16 + i * 9, 0, false));
    }
    for (const b of this.buttons) b.render(gui, mx, my);
  }
}

// GuiSleepMP: chat + "Leave Bed"
export class SleepScreen extends Screen {
  constructor(game) { super(game); this.background = 'none'; this.allowsMovement = false; }
  init() {
    this.buttons.push(new Button(1, this.width / 2 - 100, this.height - 40, 200, 20, tr('multiplayer.stopSleeping'), () => this.wake()));
  }
  wake() {
    const g = this.game;
    g.send(C.entityAction(g.entityId, 2));
  }
  key(e) {
    if (e.code === 'Escape') { this.wake(); return true; }
    if (e.code === this.game.settings.keys.chat) {
      import('./chat.js').then((m) => this.game.screens.open(new m.ChatScreen(this.game, '')));
      return true;
    }
    return true;
  }
  render(gui, mx, my) { for (const b of this.buttons) b.render(gui, mx, my); }
}
