// GuiSlot: vertical scrolling list with vanilla's dirt overlay, edge shading, scrollbar and optional header.
// Subclasses override size(), drawSlot(), and optionally isSelected(), clicked(), drawHeader(), headerClicked()
// and decorations().
import { platform } from '../platform/platform.js';

export class SlotList {
  constructor(screen, top, bottom, slotHeight, opts = {}) {
    this.screen = screen;
    this.top = top;
    this.bottom = bottom;
    this.slotHeight = slotHeight;
    this.left = 0;
    this.right = screen.width;
    this.headerPadding = opts.header || 0;
    this.showSelectionBox = opts.selectionBox !== false;
    this.listWidth = opts.listWidth || 220;
    this.scrollBarOffset = opts.scrollBarOffset || 0;
    this.amountScrolled = 0;
    this.dragging = false;
    this.lastClicked = -1;
    this.lastClickTime = 0;
  }

  get width() { return this.right - this.left; }
  size() { return 0; }
  isSelected() { return false; }
  clicked() { return false; }
  drawSlot() {}
  drawHeader() {}
  headerClicked() {}
  decorations() {}

  contentHeight() { return this.size() * this.slotHeight + this.headerPadding; }
  maxScroll() { return Math.max(0, this.contentHeight() - (this.bottom - this.top - 4)); }
  scrollBarX() { return this.width / 2 + 124 + this.scrollBarOffset; }
  slotLeft() { return this.left + this.width / 2 - this.listWidth / 2 + 2; }
  slotTop(i) { return this.top + 4 - Math.floor(this.amountScrolled) + i * this.slotHeight + this.headerPadding; }
  clamp() { this.amountScrolled = Math.max(0, Math.min(this.maxScroll(), this.amountScrolled)); }

  slotAt(x, y) {
    const i0 = this.left + this.width / 2 - this.listWidth / 2, i1 = this.left + this.width / 2 + this.listWidth / 2;
    const k = y - this.top - this.headerPadding + Math.floor(this.amountScrolled) - 4;
    const l = Math.floor(k / this.slotHeight);
    return x < this.scrollBarX() && x >= i0 && x <= i1 && l >= 0 && k >= 0 && l < this.size() ? l : -1;
  }

  // GuiSlot.overlayBackground: options_background.png tinted, scrolling with the content where asked
  _dirt(gui, y0, y1, tint, scroll = 0) {
    const tex = this.screen.game.assets.texture('gui/options_background.png', { wrap: 'repeat' });
    if (!tex) { gui.rect(this.left, y0, this.right, y1, 0xff000000 | (tint * 0x10101)); return; }
    const k = tint / 255;
    gui.quad(tex, this.left, y0, this.right, y1, this.left / 32, (y0 + scroll) / 32, this.right / 32, (y1 + scroll) / 32, [k, k, k, 1]);
  }

  render(gui, mx, my) {
    this.clamp();
    const sb = this.scrollBarX(), sbr = sb + 6;
    this._dirt(gui, this.top, this.bottom, 32, Math.floor(this.amountScrolled));
    const x = this.slotLeft(), y = this.top + 4 - Math.floor(this.amountScrolled);
    gui.scissor(this.left, this.top, this.width, this.bottom - this.top);
    if (this.headerPadding) this.drawHeader(gui, x, y, mx, my);
    const lw = this.listWidth;
    for (let i = 0; i < this.size(); i++) {
      const k1 = y + i * this.slotHeight + this.headerPadding, l1 = this.slotHeight - 4;
      if (k1 > this.bottom || k1 + l1 < this.top) continue;
      if (this.showSelectionBox && this.isSelected(i)) {
        const i1 = this.left + (this.width / 2 - lw / 2), j1 = this.left + this.width / 2 + lw / 2;
        gui.rect(i1, k1 - 2, j1, k1 + l1 + 2, 0xff808080);
        gui.rect(i1 + 1, k1 - 1, j1 - 1, k1 + l1 + 1, 0xff000000);
      }
      this.drawSlot(gui, i, x, k1, l1, mx, my);
    }
    gui.clearScissor();
    this._dirt(gui, 0, this.top, 64);
    this._dirt(gui, this.bottom, this.screen.height, 64);
    gui.gradient(this.left, this.top, this.right, this.top + 4, 0xff000000, 0x00000000);
    gui.gradient(this.left, this.bottom - 4, this.right, this.bottom, 0x00000000, 0xff000000);
    const max = this.maxScroll();
    if (max > 0) {
      const h = this.bottom - this.top;
      const k1 = Math.max(32, Math.min(h - 8, Math.floor(h * h / this.contentHeight())));
      const l1 = Math.max(this.top, Math.floor(Math.floor(this.amountScrolled) * (h - k1) / max) + this.top);
      gui.rect(sb, this.top, sbr, this.bottom, 0xff000000);
      gui.rect(sb, l1, sbr, l1 + k1, 0xff808080);
      gui.rect(sb, l1, sbr - 1, l1 + k1 - 1, 0xffc0c0c0);
    }
    this.decorations(gui, mx, my);
  }

  inside(my) { return my >= this.top && my <= this.bottom; }

  mouseDown(mx, my, button, e) {
    if (button !== 0 || !this.inside(my)) return false;
    const sb = this.scrollBarX();
    if (mx >= sb && mx <= sb + 6) {
      this.dragging = true;
      this._dragTo(my);
      return true;
    }
    const i = this.slotAt(mx, my);
    if (i >= 0) {
      const now = platform().now();
      const dbl = i === this.lastClicked && now - this.lastClickTime < 250;
      this.lastClicked = i;
      this.lastClickTime = now;
      this.clicked(i, dbl, mx, my, mx - this.slotLeft(), my - this.slotTop(i), e);
      return true;
    }
    const i0 = this.left + this.width / 2 - this.listWidth / 2, i1 = this.left + this.width / 2 + this.listWidth / 2;
    if (this.headerPadding && mx >= i0 && mx <= i1) {
      const k = my - this.top - this.headerPadding + Math.floor(this.amountScrolled) - 4;
      if (k < 0) { this.headerClicked(mx - i0, my - this.top + Math.floor(this.amountScrolled) - 4); return true; }
    }
    return false;
  }

  _dragTo(my) {
    const max = this.maxScroll();
    const h = this.bottom - this.top;
    const k1 = Math.max(32, Math.min(h - 8, Math.floor(h * h / Math.max(1, this.contentHeight()))));
    this.amountScrolled = (my - this.top - k1 / 2) / Math.max(1, h - k1) * max;
    this.clamp();
  }

  mouseMove(mx, my) { if (this.dragging) this._dragTo(my); }
  mouseUp() { this.dragging = false; }
  wheel(d) { this.amountScrolled += d * this.slotHeight / 2; this.clamp(); }
}
