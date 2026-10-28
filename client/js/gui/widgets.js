// GUI widgets: Button, TextField, Slider (vanilla look & behaviour)
import { platform } from '../platform/platform.js';

export class Button {
  constructor(id, x, y, w, h, label, onClick) {
    // GuiButton coordinates are ints in vanilla; fractional ones put quad edges between pixels and
    // bleed neighbouring rows of widgets.png into the button
    this.id = id; this.x = Math.floor(x); this.y = Math.floor(y); this.w = w; this.h = h;
    this.label = label; this.onClick = onClick;
    this.enabled = true; this.visible = true;
  }
  hovered(mx, my) { return mx >= this.x && my >= this.y && mx < this.x + this.w && my < this.y + this.h; }
  render(gui, mx, my) {
    if (!this.visible) return;
    gui.button(this.x, this.y, this.w, this.h, typeof this.label === 'function' ? this.label() : this.label, this.enabled && this.hovered(mx, my), this.enabled);
  }
  mouseDown(mx, my, game) {
    if (this.visible && this.enabled && this.hovered(mx, my)) {
      if (this.pressSound) this.pressSound(game); else game.sound.playUi('gui.button.press', 1);
      if (this.onClick) this.onClick(this);
      return true;
    }
    return false;
  }
}

export class Slider extends Button {
  constructor(id, x, y, w, h, labelFn, value, onChange) {
    super(id, x, y, w, h, '', null);
    this.labelFn = labelFn; this.value = value; this.onChange = onChange; this.dragging = false;
  }
  render(gui, mx, my) {
    if (!this.visible) return;
    if (this.dragging) this._set(mx);
    gui.blit('gui/widgets.png', this.x, this.y, 0, 46, this.w / 2, this.h);
    gui.blit('gui/widgets.png', this.x + this.w / 2, this.y, 200 - this.w / 2, 46, this.w / 2, this.h);
    const kx = this.x + Math.floor(this.value * (this.w - 8));
    gui.blit('gui/widgets.png', kx, this.y, 0, 66, 4, 20);
    gui.blit('gui/widgets.png', kx + 4, this.y, 196, 66, 4, 20);
    gui.textCentered(this.labelFn(this.value), this.x + this.w / 2, this.y + (this.h - 8) / 2, (this.focused||this.hovered(mx, my)) ? 0xffffa0 : 0xe0e0e0);
  }
  key(e,game) {
    if(this.enabled&&this.visible&&['ArrowLeft','ArrowRight'].includes(e.code)){
      const value=Math.max(0,Math.min(1,this.value+(e.code==='ArrowRight'?1:-1)/(this.w-8)));
      if(value!==this.value){this.value=value;this.onChange(value);}
      return true;
    }
    return false;
  }
  _set(mx) {
    let v = (mx - (this.x + 4)) / (this.w - 8);
    v = Math.min(1, Math.max(0, v));
    if (v !== this.value) { this.value = v; this.onChange(v); }
  }
  mouseDown(mx, my, game) {
    if (this.visible && this.enabled && this.hovered(mx, my)) {
      this.dragging = true;
      this._set(mx);
      game.sound.playUi('gui.button.press', 1);
      return true;
    }
    return false;
  }
  mouseUp() { this.dragging = false; }
}

export class TextField {
  constructor(x, y, w, h, opts = {}) {
    this.x = Math.floor(x); this.y = Math.floor(y); this.w = w; this.h = h;
    this.text = opts.text || '';
    this.maxLength = opts.maxLength || 32;
    this.focused = !!opts.focused;
    this.cursor = this.text.length;
    this.selEnd = this.cursor;
    this.scroll = 0;
    this.drawBackground = opts.background !== false;
    this.enabled = true;
    this.textColor = 0xe0e0e0;
    this.cursorCounter = 0;
    this.filter = opts.filter || null;
    this.onEnter = opts.onEnter || null;
    this.onChange = opts.onChange || null;
  }

  setText(t) {
    this.text = t.slice(0, this.maxLength);
    this.cursor = this.selEnd = this.text.length;
    if (this.onChange) this.onChange(this.text);
  }

  tick() { this.cursorCounter++; }

  selection() { return [Math.min(this.cursor, this.selEnd), Math.max(this.cursor, this.selEnd)]; }

  insert(str) {
    let s = '';
    for (const ch of str) if (ch >= ' ' && ch !== '\u007f' && ch !== '§') s += ch;
    if (this.filter) s = [...s].filter(this.filter).join('');
    const [a, b] = this.selection();
    const room = this.maxLength - this.text.length + (b - a);
    s = s.slice(0, Math.max(0, room));
    this.text = this.text.slice(0, a) + s + this.text.slice(b);
    this.cursor = this.selEnd = a + s.length;
    if (this.onChange) this.onChange(this.text);
  }

  deleteChars(n) {
    if (!this.text.length) return;
    const [a, b] = this.selection();
    if (a !== b) { this.insert(''); return; }
    const from = n < 0 ? Math.max(0, this.cursor + n) : this.cursor;
    const to = n < 0 ? this.cursor : Math.min(this.text.length, this.cursor + n);
    this.text = this.text.slice(0, from) + this.text.slice(to);
    this.cursor = this.selEnd = from;
    if (this.onChange) this.onChange(this.text);
  }

  wordBoundary(dir) {
    let i = this.cursor;
    if (dir < 0) {
      while (i > 0 && this.text[i - 1] === ' ') i--;
      while (i > 0 && this.text[i - 1] !== ' ') i--;
    } else {
      while (i < this.text.length && this.text[i] === ' ') i++;
      while (i < this.text.length && this.text[i] !== ' ') i++;
    }
    return i;
  }

  key(e) {
    if (!this.focused) return false;
    const shift = e.shift;
    const move = (pos) => { this.cursor = pos; if (!shift) this.selEnd = pos; };
    if (e.ctrl && e.code === 'KeyA') { this.cursor = this.text.length; this.selEnd = 0; return true; }
    if (e.ctrl && e.code === 'KeyC') { const [a, b] = this.selection(); platform().setClipboard(this.text.slice(a, b)); return true; }
    if (e.ctrl && e.code === 'KeyX') { const [a, b] = this.selection(); platform().setClipboard(this.text.slice(a, b)); this.insert(''); return true; }
    if (e.ctrl && e.code === 'KeyV') { return true; } // handled by paste event -> char
    switch (e.code) {
      case 'Backspace': if (e.ctrl) this.deleteChars(this.wordBoundary(-1) - this.cursor); else this.deleteChars(-1); return true;
      case 'Delete': if (e.ctrl) this.deleteChars(this.wordBoundary(1) - this.cursor); else this.deleteChars(1); return true;
      case 'Home': move(0); return true;
      case 'End': move(this.text.length); return true;
      case 'ArrowLeft': move(e.ctrl ? this.wordBoundary(-1) : Math.max(0, this.cursor - 1)); return true;
      case 'ArrowRight': move(e.ctrl ? this.wordBoundary(1) : Math.min(this.text.length, this.cursor + 1)); return true;
      case 'Enter': case 'NumpadEnter': if (this.onEnter) this.onEnter(this.text); return true;
      default: return false;
    }
  }

  char(c) {
    if (!this.focused || !this.enabled) return false;
    this.insert(c);
    return true;
  }

  mouseDown(mx, my, gui) {
    const inside = mx >= this.x && mx < this.x + this.w && my >= this.y && my < this.y + this.h;
    this.focused = inside;
    if (inside) {
      let rel = mx - this.x - (this.drawBackground ? 4 : 0);
      const visible = this.text.slice(this.scroll);
      const t = gui.font.trimToWidth(visible, rel);
      this.cursor = this.selEnd = this.scroll + t.length;
    }
    return inside;
  }

  render(gui) {
    if (this.drawBackground) {
      gui.rect(this.x - 1, this.y - 1, this.x + this.w + 1, this.y + this.h + 1, 0xffa0a0a0);
      gui.rect(this.x, this.y, this.x + this.w, this.y + this.h, 0xff000000);
    }
    const innerW = this.drawBackground ? this.w - 8 : this.w;
    if (this.cursor < this.scroll) this.scroll = this.cursor;
    while (gui.font.width(this.text.slice(this.scroll, this.cursor)) > innerW && this.scroll < this.cursor) this.scroll++;
    const visible = gui.font.trimToWidth(this.text.slice(this.scroll), innerW);
    const tx = this.drawBackground ? this.x + 4 : this.x;
    const ty = this.drawBackground ? this.y + (this.h - 8) / 2 : this.y;
    const color = this.enabled ? this.textColor : 0x707070;
    gui.text(visible, tx, ty, color, true);
    const cpos = this.cursor - this.scroll;
    const cx = tx + gui.font.width(visible.slice(0, cpos));
    if (this.focused && Math.floor(this.cursorCounter / 6) % 2 === 0) {
      if (this.cursor >= this.text.length) gui.text('_', cx, ty, color, true);
      else gui.rect(cx, ty - 1, cx + 1, ty + 1 + 9, 0xffd0d0d0);
    }
    if (this.selEnd !== this.cursor) {
      const a = Math.max(0, Math.min(this.cursor, this.selEnd) - this.scroll);
      const b = Math.min(visible.length, Math.max(this.cursor, this.selEnd) - this.scroll);
      const x0 = tx + gui.font.width(visible.slice(0, a)), x1 = tx + gui.font.width(visible.slice(0, b));
      // vanilla inverts the selection with a logic op
      gui.setBlend('invert');
      gui.rect(x0, ty - 1, x1, ty + 9, 0xffffffff);
      gui.setBlend('alpha');
    }
  }
}
