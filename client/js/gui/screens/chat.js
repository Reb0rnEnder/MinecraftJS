// GuiChat: chat input with history, tab completion and clickable messages.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { TextField, Button } from '../widgets.js';
import { platform } from '../../platform/platform.js';
import { C } from '../../net/packets.js';

export class ChatScreen extends Screen {
  constructor(game, initial) {
    super(game);
    this.initial = initial;
    this.background = 'none';
    this.historyIndex = -1;
    this.tabMatches = null;
    this.tabIndex = 0;
    this.waitingTab = false;
  }

  init() {
    const f = new TextField(4, this.height - 12, this.width - 4, 12, { text: this.input ? this.input.text : this.initial, maxLength: 100, background: false, focused: true });
    this.input = f;
    this.fields.push(f);
    this.game.hud.chatScroll = 0;
  }

  render(gui, mx, my) {
    gui.rect(2, this.height - 14, this.width - 2, this.height - 2, 0x80000000);
    this.input.render(gui);
    const hover = this.game.hud.chatComponentAt(mx, my);
    if (hover && hover.hoverText) gui.tooltip(hover.hoverText.split('\n'), mx, my);
  }

  key(e) {
    const g = this.game;
    if (e.code === 'Tab') { this.tabComplete(); return true; }
    this.tabMatches = null;
    if (e.code === 'Escape') { this.close(); return true; }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      const msg = this.input.text.trim();
      if (msg) {
        g.hud.sentHistory.push(msg);
        if (g.hud.sentHistory.length > 100) g.hud.sentHistory.shift();
        g.send(C.chat(msg.slice(0, 100)));
      }
      this.close();
      return true;
    }
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
      const h = g.hud.sentHistory;
      if (!h.length) return true;
      if (this.historyIndex === -1) { this.historyIndex = h.length; this.draft = this.input.text; }
      this.historyIndex += e.code === 'ArrowUp' ? -1 : 1;
      if (this.historyIndex < 0) this.historyIndex = 0;
      if (this.historyIndex >= h.length) { this.historyIndex = -1; this.input.setText(this.draft || ''); } else this.input.setText(h[this.historyIndex]);
      return true;
    }
    if (e.code === 'PageUp') { g.hud.scrollChat(g.hud.chatLinesVisible() - 1); return true; }
    if (e.code === 'PageDown') { g.hud.scrollChat(-(g.hud.chatLinesVisible() - 1)); return true; }
    return this.input.key(e);
  }

  tabComplete() {
    const g = this.game;
    if (this.tabMatches && this.tabMatches.length) {
      this.tabIndex = (this.tabIndex + 1) % this.tabMatches.length;
      this._applyTab();
      return;
    }
    const text = this.input.text.slice(0, this.input.cursor);
    this.tabPrefixStart = text.lastIndexOf(' ') + 1;
    this.tabBase = this.input.text;
    this.waitingTab = true;
    const t = g.interaction.target;
    const block = t && t.type === 'block' ? { x: t.x, y: t.y, z: t.z } : null;
    g.send(C.tabComplete(text, block));
  }

  onTabComplete(matches) {
    if (!this.waitingTab) return;
    this.waitingTab = false;
    if (!matches.length) return;
    if (matches.length > 1) this.game.hud.addChat(matches.join(', '), null, true);
    this.tabMatches = matches;
    this.tabIndex = 0;
    this._applyTab();
  }

  _applyTab() {
    const m = this.tabMatches[this.tabIndex];
    const before = this.tabBase.slice(0, this.tabPrefixStart);
    // Matches for the first word of a command come back with the leading slash
    this.input.setText(before + m);
  }

  mouseDown(mx, my, button) {
    if (button === 0) {
      const comp = this.game.hud.chatComponentAt(mx, my);
      if (comp && comp.click) {
        const c = comp.click;
        if (c.action === 'open_url') {
          this.game.screens.open(new ConfirmLinkScreen(this.game, this, c.value));
        } else if (c.action === 'run_command') {
          this.game.send(C.chat(c.value));
        } else if (c.action === 'suggest_command') {
          this.input.setText(c.value);
        }
        return true;
      }
    }
    return super.mouseDown(mx, my, button);
  }

  wheel(d) { this.game.hud.scrollChat(-d * 1); }

  onClose() { this.game.hud.chatScroll = 0; }
}

// GuiConfirmOpenLink
export class ConfirmLinkScreen extends Screen {
  constructor(game, parent, url) {
    super(game);
    this.parent = parent;
    this.url = url;
    this.background = 'world';
  }
  init() {
    const cx = this.width / 2, y = this.height / 6 + 96;
    this.buttons.push(new Button(0, cx - 155, y, 100, 20, tr('chat.link.open'), () => { platform().openUrl(this.url); this.close(); }));
    this.buttons.push(new Button(2, cx - 50, y, 100, 20, tr('chat.copy'), () => { platform().setClipboard(this.url); this.close(); }));
    this.buttons.push(new Button(1, cx + 55, y, 100, 20, tr('gui.cancel'), () => this.close()));
  }
  close() { this.game.screens.open(this.parent); }
  renderContent(gui) {
    gui.textCentered(tr('chat.link.confirmTrusted'), this.width / 2, 70, 0xffffff);
    gui.textCentered(this.url, this.width / 2, 90, 0xffffff);
    gui.textCentered('§c' + tr('chat.link.warning'), this.width / 2, 110, 0xffffff);
  }
}
