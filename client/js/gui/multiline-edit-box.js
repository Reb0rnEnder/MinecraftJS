// Native 1.20.6 MultiLineEditBox (AbstractScrollWidget + MultilineTextField): a bordered, scrolling, word-wrapped
// text area with a placeholder, a character limit and its "n/limit" counter under the box.
import { platform } from '../platform/platform.js';
import { stampWidget } from './focus-navigation.js';
import { textLines } from './text-editor.js';
import { tr } from './i18n.js';

const PAD = 4, LINE = 9, TEXT = 0xe0e0e0, CURSOR = 0xffd0d0d0, PLACEHOLDER = 0xcce0e0e0;
const space = (c) => /\s/.test(c);
// StringUtil.filterText(text, allowLineBreaks = true): drops section signs and control characters except newlines
const filterText = (s) => s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f§]/g, '');

export class MultiLineEditBox {
  constructor(gui, x, y, w, h, placeholder, narration, opts = {}) {
    stampWidget(this);
    this.gui = gui; this.x = x; this.y = y; this.w = w; this.h = h;
    this.placeholder = placeholder; this.narration = narration;
    this.limit = opts.limit ?? Infinity; this.onChange = opts.onChange || null;
    this.focused = false; this.visible = true; this.scroll = 0; this.scrolling = false; this.selecting = false;
    this.focusedTime = platform().now();
    this.setValue(opts.value ?? '');
  }
  get text() { return this.value; }
  // MultilineTextField.setValue: truncated to the limit, cursor at the end
  setValue(s) { this.value = this.limit === Infinity ? s : s.slice(0, this.limit); this.cursor = this.anchor = this.value.length; this.changed(); }
  changed() { this.lines = textLines(this.value, this.gui.font, this.w - 2 * PAD); this.onChange?.(this.value); this.scrollToCursor(); }
  selection() { return [Math.min(this.cursor, this.anchor), Math.max(this.cursor, this.anchor)]; }
  hasSelection() { return this.cursor !== this.anchor; }
  insertText(s) {
    if (!s && !this.hasSelection()) return;
    let text = filterText(s);
    if (this.limit !== Infinity) text = text.slice(0, Math.max(0, this.limit - this.value.length));
    const [a, b] = this.selection();
    this.value = this.value.slice(0, a) + text + this.value.slice(b);
    this.cursor = this.anchor = a + text.length;
    this.changed();
  }
  deleteText(n) { if (!this.hasSelection()) this.anchor = Math.max(0, Math.min(this.value.length, this.cursor + n)); this.insertText(''); }
  seek(pos) { this.cursor = Math.max(0, Math.min(this.value.length, pos)); this.scrollToCursor(); if (!this.selecting) this.anchor = this.cursor; }
  lineAtCursor() { return this.lines.findIndex((l) => this.cursor >= l.start && this.cursor <= l.end); }
  lineView(i) { return this.lines[Math.max(0, Math.min(this.lines.length - 1, i))]; }
  seekLine(d) {
    const cur = this.lineView(this.lineAtCursor()), x = this.gui.font.width(this.value.slice(cur.start, this.cursor)) + 2, next = this.lineView(this.lineAtCursor() + d);
    this.seek(next.start + this.gui.font.trimToWidth(this.value.slice(next.start, next.end), x).length);
  }
  previousWord() {
    if (!this.value) return 0;
    let i = Math.max(0, Math.min(this.cursor, this.value.length - 1));
    while (i > 0 && space(this.value[i - 1])) i--;
    while (i > 0 && !space(this.value[i - 1])) i--;
    return i;
  }
  nextWord() {
    if (!this.value) return 0;
    let i = Math.max(0, Math.min(this.cursor, this.value.length - 1));
    while (i < this.value.length && !space(this.value[i])) i++;
    while (i < this.value.length && space(this.value[i])) i++;
    return i;
  }
  // MultilineTextField.keyPressed (the edit box forwards every key while focused)
  key(e) {
    if (!this.focused) return false;
    this.selecting = !!e.shift;
    if (e.ctrl && e.code === 'KeyA') { this.cursor = this.value.length; this.anchor = 0; return true; }
    if (e.ctrl && (e.code === 'KeyC' || e.code === 'KeyX')) { const [a, b] = this.selection(); platform().setClipboard(this.value.slice(a, b)); if (e.code === 'KeyX') this.insertText(''); return true; }
    if (e.ctrl && e.code === 'KeyV') return true; // the paste arrives through char()
    switch (e.code) {
      case 'ArrowLeft': this.seek(e.ctrl ? this.previousWord() : this.cursor - 1); return true;
      case 'ArrowRight': this.seek(e.ctrl ? this.nextWord() : this.cursor + 1); return true;
      case 'ArrowUp': if (!e.ctrl) this.seekLine(-1); return true;
      case 'ArrowDown': if (!e.ctrl) this.seekLine(1); return true;
      case 'PageUp': this.seek(0); return true;
      case 'PageDown': this.seek(this.value.length); return true;
      case 'Home': this.seek(e.ctrl ? 0 : this.lineView(this.lineAtCursor()).start); return true;
      case 'End': this.seek(e.ctrl ? this.value.length : this.lineView(this.lineAtCursor()).end); return true;
      case 'Backspace': this.deleteText(e.ctrl ? this.previousWord() - this.cursor : -1); return true;
      case 'Delete': this.deleteText(e.ctrl ? this.nextWord() - this.cursor : 1); return true;
      case 'Enter': case 'NumpadEnter': this.insertText('\n'); return true;
      default: return false;
    }
  }
  char(c) { if (!this.visible || !this.focused) return false; this.insertText(c); return true; }
  tick() {}
  // AbstractScrollWidget
  innerHeight() { return LINE * this.lines.length; }
  maxScroll() { return Math.max(0, this.innerHeight() + 4 - (this.h - 4)); }
  setScroll(v) { this.scroll = Math.max(0, Math.min(this.maxScroll(), v)); }
  scrollbarVisible() { return this.lines.length > (this.h - 2 * PAD) / LINE; }
  barHeight() { return Math.max(32, Math.min(this.h, Math.trunc(this.h * this.h / (this.innerHeight() + 4)))); }
  scrollToCursor() {
    if (!this.lines) return;
    let s = this.scroll;
    const top = this.lineView(Math.trunc(s / LINE));
    if (this.cursor <= top.start) s = this.lineAtCursor() * LINE;
    else { const bottom = this.lineView(Math.trunc((s + this.h) / LINE) - 1); if (this.cursor > bottom.end) s = this.lineAtCursor() * LINE - this.h + LINE + 2 * PAD; }
    this.setScroll(s);
  }
  inside(mx, my) { return mx >= this.x && mx < this.x + this.w && my >= this.y && my < this.y + this.h; }
  seekToPoint(mx, my) {
    const px = Math.floor(mx - this.x - PAD), line = this.lineView(Math.floor((my - this.y - PAD + this.scroll) / LINE));
    this.seek(line.start + this.gui.font.trimToWidth(this.value.slice(line.start, line.end), px).length);
  }
  // mouseClicked: inside moves the cursor (shift extends the selection); the scrollbar column starts dragging
  click(mx, my, gui, shift = false) {
    if (!this.visible) return false;
    if (this.inside(mx, my)) { this.selecting = shift; this.seekToPoint(mx, my); return true; }
    const onBar = this.scrollbarVisible() && mx >= this.x + this.w && mx <= this.x + this.w + 8 && my >= this.y && my < this.y + this.h;
    if (onBar) this.scrolling = true;
    return onBar;
  }
  mouseDown(mx, my) { const hit = this.click(mx, my); this.focused = hit; if (hit) this.focusedTime = platform().now(); return hit; }
  drag(mx, my, dy) {
    if (this.focused && this.scrolling) {
      if (my < this.y) this.setScroll(0); else if (my > this.y + this.h) this.setScroll(this.maxScroll());
      else this.setScroll(this.scroll + dy * Math.max(1, this.maxScroll() / (this.h - this.barHeight())));
      return true;
    }
    if (this.inside(mx, my)) { this.selecting = true; this.seekToPoint(mx, my); this.selecting = false; return true; }
    return false;
  }
  mouseUp() { this.scrolling = false; }
  wheel(delta) { if (!this.visible) return false; this.setScroll(this.scroll + delta * LINE / 2); return true; }
  setFocused(f) { if (f && !this.focused) this.focusedTime = platform().now(); this.focused = f; }

  render(gui) {
    if (!this.visible) return;
    const { x, y, w, h } = this, font = gui.font;
    gui.sprite(this.focused ? 'widget/text_field_highlighted' : 'widget/text_field', x, y, w, h);
    gui.scissor(x + 1, y + 1, w - 2, h - 2);
    const top = (y0, y1) => y1 - this.scroll >= y && y0 - this.scroll <= y + h, s = Math.round(this.scroll);
    if (!this.value && !this.focused) {
      font.wrap(this.placeholder, w - 2 * PAD).forEach((line, i) => font.draw(line, x + PAD, y + PAD + i * LINE - s, PLACEHOLDER & 0xffffff, false, (PLACEHOLDER >>> 24) / 255));
    } else {
      const blink = this.focused && Math.floor((platform().now() - this.focusedTime) / 300) % 2 === 0, inside = this.cursor < this.value.length;
      let endX = 0, lastY = 0, ly = y + PAD;
      for (const l of this.lines) {
        const visible = top(ly, ly + LINE);
        if (blink && inside && this.cursor >= l.start && this.cursor <= l.end) {
          if (visible) {
            const before = this.value.slice(l.start, this.cursor);
            gui.text(before, x + PAD, ly - s, TEXT, true);
            endX = x + PAD + font.width(before);
            gui.rect(endX, ly - 1 - s, endX + 1, ly + 1 + LINE - s, CURSOR);
            gui.text(this.value.slice(this.cursor, l.end), endX, ly - s, TEXT, true);
          }
        } else {
          if (visible) { const t = this.value.slice(l.start, l.end); gui.text(t, x + PAD, ly - s, TEXT, true); endX = x + PAD + font.width(t); }
          lastY = ly;
        }
        ly += LINE;
      }
      if (blink && !inside && top(lastY, lastY + LINE)) gui.text('_', endX, lastY - s, CURSOR & 0xffffff, true);
      if (this.hasSelection()) {
        const [a, b] = this.selection();
        let hy = y + PAD;
        for (const l of this.lines) {
          if (a > l.end) { hy += LINE; continue; }
          if (l.start > b) break;
          if (top(hy, hy + LINE)) {
            const x0 = x + PAD + font.width(this.value.slice(l.start, Math.max(a, l.start))), x1 = b > l.end ? x + w : x + PAD + font.width(this.value.slice(l.start, b));
            // RenderType.guiTextHighlight: OR_REVERSE blue
            gui.setBlend('invert'); gui.rect(x0, hy - s, x1, hy + LINE - s, 0xffffffff);
            gui.setBlend('add'); gui.rect(x0, hy - s, x1, hy + LINE - s, 0xff0000ff); gui.setBlend('alpha');
          }
          hy += LINE;
        }
      }
    }
    gui.clearScissor();
    if (this.scrollbarVisible()) {
      const bar = this.barHeight(), max = this.maxScroll();
      gui.sprite('widget/scroller', x + w, Math.max(y, Math.trunc(Math.trunc(this.scroll) * (h - bar) / Math.max(1, max)) + y), 8, bar);
    }
    if (this.limit !== Infinity) {
      const counter = tr('gui.multiLineEditBox.character_limit', String(this.value.length), String(this.limit));
      gui.text(counter, x + w - font.width(counter), y + h + 4, 0xa0a0a0, true);
    }
  }
}
