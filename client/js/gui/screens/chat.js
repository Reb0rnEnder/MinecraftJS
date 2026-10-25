import { chatHoverTooltip } from '../chat-hover.js';
import { playerSuggestions } from '../../game/commands.js';
// GuiChat: chat input with history, tab completion and clickable messages.
import { tr } from '../i18n.js';
import { chatToPlain } from '../chat.js';
import { Screen } from './manager.js';
import { TextField, Button } from '../widgets.js';
import { platform } from '../../platform/platform.js';
import { C } from '../../net/packets.js';

export class ChatScreen extends Screen {
  constructor(game, initial, options = {}) {
    super(game);
    this.initial = initial;
    this.isChatScreen = true;
    this.commandOnly = !!options.commandOnly;
    this.background = 'none';
    this.historyIndex = -1;
    this.tabMatches = null;
    this.tabIndex = 0;
    this.waitingTab = false;
    this.tabTransaction = 0;
    this.tabBase = '';
    this.tabReplaceStart = 0;
    this.tabReplaceEnd = 0;
    this.tabCursor = 0;
    this.tabRequest = null;
    this.applyingTab = false;
    this.tabApplied = false;
    this.tabOffset = 0;
  }

  init() {
    const f = new TextField(4, this.height - 12, this.width - 4, 12, {
      text: this.input ? this.input.text : this.initial,
      maxLength: 256,
      background: false,
      focused: true,
      onChange: () => { if (!this.applyingTab) this.requestSuggestions(); },
    });
    this.input = f;
    this.fields.push(f);
    f.formatter = (text,offset) => this.game.commands ? this.game.commands.format(text,offset,this.input.text,!this.commandOnly) : text;
    this.game.hud.chatScroll = 0;
    this.requestSuggestions();
  }

  render(gui, mx, my) {
    gui.rect(2, this.height - 14, this.width - 2, this.height - 2, 0x80000000);
    this.input.render(gui);
    this.renderSuggestions(gui,mx,my);
    const hover = this.game.hud.chatComponentAt(mx, my);
    const tooltip=chatHoverTooltip(this.game,hover);
    if(tooltip)gui.tooltip(hover?.hover?.action==='show_text'&&gui.font.wrap?tooltip.flatMap(line=>gui.font.wrap(line,Math.max(this.width/2,200))):tooltip,mx,my);
  }

  renderSuggestions(gui,mx,my) {
    this.tabBox = null;
    if (this.tabMatches?.length) {
      const box = this.tabBox = this._suggestionBox(gui);
      const { x, y, width, rows } = box;
      const moved = mx !== this.tabMouseX || my !== this.tabMouseY;
      this.tabMouseX = mx; this.tabMouseY = my;
      const hoverRow = this._suggestionRow(mx, my);
      if (moved && hoverRow >= 0) { this.tabIndex = hoverRow; this.tabApplied = false; }
      gui.rect(x, y, x + width, y + rows * 12, 0xd0000000);
      if (this.tabOffset > 0 || this.tabOffset + rows < this.tabMatches.length) {
        gui.rect(x, y - 1, x + width, y, 0xd0000000);
        gui.rect(x, y + rows * 12, x + width, y + rows * 12 + 1, 0xd0000000);
        for (let i = 0; i < width; i += 2) {
          if (this.tabOffset > 0) gui.rect(x + i, y - 1, x + i + 1, y, 0xffffffff);
          if (this.tabOffset + rows < this.tabMatches.length) gui.rect(x + i, y + rows * 12, x + i + 1, y + rows * 12 + 1, 0xffffffff);
        }
      }
      for (let i = 0; i < rows; i++) {
        const index = this.tabOffset + i;
        gui.text(this._matchText(index), x + 1, y + 2 + i * 12, index === this.tabIndex ? 0xffffff00 : 0xffaaaaaa, true);
      }
      const applied = this.tabBase.slice(0, this.tabReplaceStart) + this._matchText(this.tabIndex) + this.tabBase.slice(this.tabReplaceEnd);
      if (this.input.cursor === this.input.text.length && applied.startsWith(this.input.text)) {
        const textX = this.input.x + gui.font.width(this.input.text.slice(this.input.scroll));
        const ghost = gui.font.trimToWidth(applied.slice(this.input.text.length), this.input.x + this.input.w - textX);
        if (ghost) gui.text(ghost, textX, this.input.y, 0xff808080, true);
      }
      if (hoverRow >= 0) {
        const tooltip = this.tabMatches[this.tabIndex].tooltip;
        if (tooltip) gui.tooltip(chatToPlain(tooltip).split('\n'), mx, my);
      }
    }
    if (!this.tabMatches?.length && this.commandState?.error) {
      const error=this.commandState.error,text=this.game.assets.translate(error.key,error.args||[]);
      const x=this.input.x,y=this.commandOnly?this.input.y+this.input.h+2:this.input.y-14;
      const width=Math.min(this.width-x-2,gui.font.width(text)+2);
      gui.rect(x-1,y-2,x+width,y+10,0xd0000000);gui.text(text,x,y,0xffff5555,true);
    }
  }

  _matchText(index) { const m = this.tabMatches[index]; return typeof m === 'string' ? m : m.match; }

  _suggestionBox(gui) {
    // GuiChat.h / SuggestionsList: range-start anchor, 12px rows, 1px left inset.
    const rows = Math.min(10, this.tabMatches.length);
    const widest = Math.max(...this.tabMatches.map((_, i) => gui.font.width(this._matchText(i))));
    const anchor = this.input.x + gui.font.width(this.input.text.slice(this.input.scroll, Math.max(this.input.scroll, this.tabReplaceStart)));
    return { x: Math.floor(Math.max(0, Math.min(anchor, this.width - widest))) - 1,
      y: this.commandOnly ? this.input.y + this.input.h + 2 : this.height - 15 - rows * 12, width: widest + 1, rows };
  }

  _suggestionRow(mx, my) {
    const b = this.tabBox;
    if (!b || mx < b.x || mx >= b.x + b.width || my < b.y || my >= b.y + b.rows * 12) return -1;
    return this.tabOffset + Math.floor((my - b.y) / 12);
  }

  _selectTab(index) {
    this.tabIndex = (index + this.tabMatches.length) % this.tabMatches.length;
    const rows = Math.min(10, this.tabMatches.length);
    if (this.tabIndex < this.tabOffset) this.tabOffset = this.tabIndex;
    if (this.tabIndex >= this.tabOffset + rows) this.tabOffset = this.tabIndex - rows + 1;
  }

  key(e) {
    const g = this.game;
    if (e.code === 'Tab') { this.tabComplete(!!e.shift); return true; }
    if (this.tabMatches?.length) {
      if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        this._selectTab(this.tabIndex + (e.code === 'ArrowUp' ? -1 : 1));
        this.tabApplied = false;
        return true;
      }
      if (e.code === 'Escape') { this.tabMatches = null; this.tabBox = null; return true; }
    }
    if (e.code === 'Escape') { this.close(); return true; }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') {
      const msg = this.input.text.trim();
      if (msg) {
        g.hud.sentHistory.push(msg);
        if (g.hud.sentHistory.length > 100) g.hud.sentHistory.shift();
        g.send(C.chat(msg.slice(0, 256)));
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
    const cursor = this.input.cursor;
    const handled = this.input.key(e);
    if (cursor !== this.input.cursor && (this.tabCursor !== this.input.cursor || this.tabBase !== this.input.text)) this.requestSuggestions();
    return handled;
  }

  tabComplete(reverse = false) {
    if (this.tabMatches && this.tabMatches.length) {
      if (this.tabApplied) this.tabIndex = (this.tabIndex + (reverse ? -1 : 1) + this.tabMatches.length) % this.tabMatches.length;
      else if (reverse) this.tabIndex = this.tabMatches.length - 1;
      this._selectTab(this.tabIndex);
      this._applyTab();
      return;
    }
    this.requestSuggestions(true);
  }

  requestSuggestions(fromTab = false) {
    const g = this.game;
    if (!this.input || !g.send) return;
    const text = this.input.text.slice(0, this.input.cursor);
    if (this.tabRequest) clearTimeout(this.tabRequest);
    this.tabRequest = null;
    this.tabMatches = null;
    this.tabBox = null;
    this.tabApplied = false;
    this.waitingTab = false;
    const isCommand = this.commandOnly || text.startsWith('/');
    this.commandState = isCommand && g.commands ? g.commands.parse(this.input.text,!this.commandOnly) : null;
    if (!isCommand) {
      if (fromTab) {
        const result=playerSuggestions(g,this.input.text,this.input.cursor);
        this.tabBase=this.input.text;this.tabCursor=this.input.cursor;
        this.tabReplaceStart=result.start;this.tabReplaceEnd=result.end;
        this._showMatches(result.matches);
      }
      return;
    }
    this.tabBase = this.input.text;
    this.tabCursor = this.input.cursor;
    this.tabReplaceStart = text.search(/\S+$/);
    if (this.tabReplaceStart < 0) this.tabReplaceStart = text.length;
    this.tabReplaceEnd = this.tabCursor;
    this.tabTransaction = g.suggestionTransaction = ((g.suggestionTransaction || 0) + 1) & 0x7fffffff;
    const local = g.commands?.suggestions(this.input.text,this.input.cursor,!this.commandOnly);
    if (local) {
      this.tabReplaceStart=local.start;this.tabReplaceEnd=local.end;
      this._showMatches(local.matches);
      if (!local.askServer) return;
    }
    this.waitingTab = true;
    const transaction = this.tabTransaction;
    const send = () => {
      if (!this.waitingTab || transaction !== this.tabTransaction) return;
      this.tabRequest = null;
      g.send(C.tabComplete(text, null, transaction));
    };
    if (fromTab) send();
    else this.tabRequest = setTimeout(send, 60);
  }

  onTabComplete(packet) {
    if (!this.waitingTab || !(this.commandOnly || this.input.text.startsWith('/')) || this.input.text !== this.tabBase || this.input.cursor !== this.tabCursor) return;
    const matches = Array.isArray(packet) ? packet.map(match => ({ match, tooltip: null })) : packet.matches || [];
    if (!Array.isArray(packet) && packet.transactionId !== undefined && packet.transactionId !== this.tabTransaction) return;
    this.waitingTab = false;
    if (!matches.length) return;
    if (!Array.isArray(packet)) {
      this.tabReplaceStart = packet.start;
      this.tabReplaceEnd = packet.start + packet.length;
    }
    this._showMatches(matches);
  }

  _showMatches(matches) {
    this.tabMatches = matches.length ? matches : null;
    this.tabIndex=0;this.tabOffset=0;
    this.tabMouseX=this.tabMouseY=undefined;
    this.tabApplied=false;
  }

  _applyTab() {
    const m = this._matchText(this.tabIndex);
    const before = this.tabBase.slice(0, this.tabReplaceStart);
    const after = this.tabBase.slice(this.tabReplaceEnd);
    this.applyingTab = true;
    this.input.setText(before + m + after);
    this.input.cursor = this.input.selEnd = Math.min(this.input.text.length, before.length + m.length);
    this.applyingTab = false;
    this.tabApplied = true;
    if(this.game.commands&&(this.commandOnly||this.input.text.startsWith('/')))this.commandState=this.game.commands.parse(this.input.text,!this.commandOnly);
  }

  mouseDown(mx, my, button) {
    if (button === 0) {
      const row = this._suggestionRow(mx, my);
      if (row >= 0) { this._selectTab(row); this._applyTab(); return true; }
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
    const cursor = this.input.cursor;
    const handled = super.mouseDown(mx, my, button);
    if (cursor !== this.input.cursor) this.requestSuggestions();
    return handled;
  }

  mouseMove(mx,my) {
    this.tabPointerX=mx;this.tabPointerY=my;
    const row=this._suggestionRow(mx,my);
    if(row>=0){this.tabIndex=row;this.tabApplied=false;}
  }

  wheel(d) {
    if (this.tabMatches?.length && this._suggestionRow(this.tabPointerX ?? this.tabMouseX, this.tabPointerY ?? this.tabMouseY) >= 0) {
      this.tabOffset = Math.max(0, Math.min(this.tabMatches.length - Math.min(10, this.tabMatches.length), this.tabOffset + d));
      const row=this._suggestionRow(this.tabPointerX??this.tabMouseX,this.tabPointerY??this.tabMouseY);
      if(row>=0){this.tabIndex=row;this.tabApplied=false;}
      return;
    }
    this.game.hud.scrollChat(-d);
  }

  onClose() {
    if (this.tabRequest) clearTimeout(this.tabRequest);
    this.tabRequest = null;
    this.waitingTab = false;
    this.game.hud.chatScroll = 0;
  }
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
