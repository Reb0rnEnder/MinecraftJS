// Native 1.20.6 AdvancementsScreen / AdvancementTab / AdvancementWidget: a 252x140 window inside a
// HeaderAndFooterLayout (title header, Done footer), one sprite tab per root advancement when there is more than
// one, the tab's tree on a tiled background that can be dragged or scrolled, and a hover panel per advancement.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { C } from '../../net/packets.js';

const WINDOW = 'gui/advancements/window.png';
const FRAME_NAME = ['task', 'challenge', 'goal'];
// AdvancementType chat colours applied to descriptions (task/goal GREEN, challenge DARK_PURPLE)
const FRAME_COLOR = ['\u00a7a', '\u00a75', '\u00a7a'];
const frameSprite = (frame, obtained) => 'advancements/' + (FRAME_NAME[frame] || 'task') + '_frame_' + (obtained ? 'obtained' : 'unobtained');
const boxSprite = (obtained) => 'advancements/box_' + (obtained ? 'obtained' : 'unobtained');
// AdvancementWidget.findOptimalLines test offsets
const LINE_OFFSETS = [0, 10, -10, 25, -25];

// AdvancementTabType: sprite family, ends (first/middle/last), size and capacity
const TAB_TYPES = [
  { name: 'above', ends: ['left', 'middle', 'right'], w: 28, h: 32, max: 8 },
  { name: 'below', ends: ['left', 'middle', 'right'], w: 28, h: 32, max: 8 },
  { name: 'left', ends: ['top', 'middle', 'bottom'], w: 32, h: 28, max: 5 },
  { name: 'right', ends: ['top', 'middle', 'bottom'], w: 32, h: 28, max: 5 },
];
const tabSprite = (t, i, selected) => 'advancements/tab_' + t.name + '_' + t.ends[i === 0 ? 0 : i === t.max - 1 ? 2 : 1] + (selected ? '_selected' : '');
function tabPlace(index) {
  for (const t of TAB_TYPES) { if (index < t.max) return { t, i: index }; index -= t.max; }
  return null;
}
const tabX = (t, i) => (t.name === 'above' || t.name === 'below' ? (t.w + 4) * i : t.name === 'left' ? -t.w + 4 : 248);
const tabY = (t, i) => (t.name === 'above' ? -t.h + 4 : t.name === 'below' ? 136 : t.h * i);

export class AdvancementsScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.adv = game.advancements;
    this.tabs = new Map(); // root id -> tab state
  }

  init() {
    this.buttons.push(new Button(0, Math.floor(this.width / 2) - 100, this.height - 26, 200, 20, tr('gui.done'), () => this.close()));
    this.adv.listener = this;
    this.onAdvancementsChanged();
    // ClientAdvancementManager.setSelectedTab(first, tellServer)
    if (this.adv.selectedTab) this.game.send(C.seenAdvancements(this.adv.selectedTab));
  }

  close() {
    this.adv.listener = null;
    this.game.send(C.seenAdvancements(null)); // CPacketSeenAdvancements.closedScreen
    if (this.parent) this.game.screens.open(this.parent); else this.game.screens.close();
  }

  // GuiAdvancementTab: widgets with their parents and the tree's bounds
  onAdvancementsChanged() {
    const g = this.game;
    const old = this.tabs;
    this.tabs = new Map();
    this.adv.tabs().forEach((root, index) => {
      const place = tabPlace(index);
      if (!place) return;
      const prev = old.get(root.id);
      const tab = { root, place, widgets: [], minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity,
        scrollX: prev ? prev.scrollX : 0, scrollY: prev ? prev.scrollY : 0, centered: prev ? prev.centered : false, fade: 0 };
      const add = (a, parentWidget) => {
        let w = parentWidget;
        if (a.display) {
          w = this._widget(a, parentWidget);
          tab.widgets.push(w);
          tab.minX = Math.min(tab.minX, w.x); tab.maxX = Math.max(tab.maxX, w.x + 28);
          tab.minY = Math.min(tab.minY, w.y); tab.maxY = Math.max(tab.maxY, w.y + 27);
        }
        for (const c of a.children) add(c, w);
      };
      add(root, null);
      this.tabs.set(root.id, tab);
    });
    void g;
  }

  // GuiAdvancement constructor: position, trimmed title, description lines and the panel width
  _widget(a, parent) {
    const font = this.gui.font;
    const d = a.display;
    const title = font.trimToWidth(d.title, 163);
    const n = a.requirements.length;
    const k = n > 1 ? font.width('  ') + font.width('0') * String(n).length * 2 + font.width('/') : 0;
    let l = 29 + font.width(title) + k;
    const description = this._optimalLines((FRAME_COLOR[d.frame] || '') + (d.description || ''), l);
    for (const s of description) l = Math.max(l, font.width(s));
    return { a, parent, x: Math.floor(d.x * 28), y: Math.floor(d.y * 27), title, description, width: l + 3 + 5 };
  }

  // AdvancementWidget.findOptimalLines: try widths around maxWidth, keep the first whose widest line is within 10
  _optimalLines(text, maxWidth) {
    const font = this.gui.font;
    if (!text.replace(/\u00a7./g, '')) return [];
    let best = null, bestDiff = Infinity;
    for (const offset of LINE_OFFSETS) {
      const lines = font.wrap(text, maxWidth - offset), widest = Math.max(0, ...lines.map((l) => font.width(l)));
      const diff = Math.abs(widest - maxWidth);
      if (diff <= 10) return lines;
      if (diff < bestDiff) { bestDiff = diff; best = lines; }
    }
    return best;
  }

  _visible(w) { return !w.a.display.hidden || this.adv.isDone(w.a); }

  get selected() { return this.tabs.get(this.adv.selectedTab) || null; }

  mouseDown(mx, my, button) {
    const L = Math.floor((this.width - 252) / 2), T = Math.floor((this.height - 140) / 2);
    if (button === 0) {
      for (const tab of this.tabs.values()) {
        const { t, i } = tab.place;
        const x = L + tabX(t, i), y = T + tabY(t, i);
        if (mx > x && mx < x + t.w && my > y && my < y + t.h) {
          this.adv.onSelectTab(tab.root.id);
          this.game.send(C.seenAdvancements(tab.root.id));
          return true;
        }
      }
    }
    if (super.mouseDown(mx, my, button)) return true;
    // mouseDragged: left drags anywhere scroll the tab; the first drag event of the screen only arms it
    if (button === 0) { this.dragging = { x: mx, y: my }; return true; }
    return false;
  }

  _scroll(tab, dx, dy) {
    if (tab.maxX - tab.minX > 234) tab.scrollX = Math.max(-(tab.maxX - 234), Math.min(0, tab.scrollX + dx));
    if (tab.maxY - tab.minY > 113) tab.scrollY = Math.max(-(tab.maxY - 113), Math.min(0, tab.scrollY + dy));
  }

  // mouseScrolled: 16 pixels per notch
  wheel(d) { const tab = this.selected; if (tab) this._scroll(tab, 0, -d * 16); }

  mouseMove(mx, my) {
    if (!this.dragging) return;
    const tab = this.selected;
    if (!this.dragArmed) this.dragArmed = true;
    else if (tab) this._scroll(tab, mx - this.dragging.x, my - this.dragging.y);
    this.dragging = { x: mx, y: my };
  }

  mouseUp(mx, my, button) { this.dragging = null; super.mouseUp(mx, my, button); }

  key(e) {
    // the advancements key closes straight to the game (setScreen(null)); removed() still tells the server
    if (e.code === this.game.settings.keys.advancements) { this.adv.listener = null; this.game.send(C.seenAdvancements(null)); this.game.screens.close(); return true; }
    return super.key(e);
  }

  render(gui, mx, my, partial) {
    gui.menuBackground(this.game.inWorld);
    gui.textCentered(tr('gui.advancements'), Math.floor(this.width / 2), 12, 0xffffff);
    for (const b of this.buttons) b.render(gui, mx, my);
    const L = Math.floor((this.width - 252) / 2), T = Math.floor((this.height - 140) / 2);
    this._renderInside(gui, L, T);
    this._renderWindow(gui, L, T);
    this._renderTooltips(gui, mx, my, L, T);
    void partial;
  }

  // GuiScreenAdvancements.renderInside + GuiAdvancementTab.drawContents
  _renderInside(gui, L, T) {
    const tab = this.selected;
    const x = L + 9, y = T + 18;
    if (!tab) {
      gui.rect(x, y, x + 234, y + 113, 0xff000000);
      const s = tr('advancements.empty');
      gui.text(s, x + 117 - Math.floor(gui.textWidth(s) / 2), y + 56 - 4, 0xffffffff, false);
      gui.text(':(', x + 117 - Math.floor(gui.textWidth(':(') / 2), y + 113 - 9, 0xffffffff, false);
      return;
    }
    if (!tab.centered && tab.widgets.length) {
      tab.scrollX = 117 - Math.floor((tab.maxX + tab.minX) / 2);
      tab.scrollY = 56 - Math.floor((tab.maxY + tab.minY) / 2);
      tab.centered = true;
    }
    gui.scissor(x, y, 234, 113);
    gui.rect(x, y, x + 234, y + 113, 0xff000000);
    const i = Math.floor(tab.scrollX), j = Math.floor(tab.scrollY);
    const bg = tab.root.display.background;
    if (bg) {
      const tex = bg.replace(/^minecraft:/, '').replace(/^textures\//, '');
      const k = i % 16, l = j % 16;
      for (let i1 = -1; i1 <= 15; i1++) for (let j1 = -1; j1 <= 8; j1++) gui.blit(tex, x + k + 16 * i1, y + l + 16 * j1, 0, 0, 16, 16, 16, 16);
    }
    // GuiAdvancement.drawConnectivity: black outline first, then the white line
    for (const outline of [true, false]) {
      const c = outline ? 0xff000000 : 0xffffffff;
      for (const w of tab.widgets) {
        if (!w.parent) continue;
        const pi = x + i + w.parent.x + 13, pj = x + i + w.parent.x + 26 + 4, pk = y + j + w.parent.y + 13;
        const l = x + i + w.x + 13, i1 = y + j + w.y + 13;
        const hl = (a, b, yy) => { if (b < a) [a, b] = [b, a]; gui.rect(a, yy, b + 1, yy + 1, c); };
        const vl = (xx, a, b) => { if (b < a) [a, b] = [b, a]; gui.rect(xx, a + 1, xx + 1, b, c); };
        if (outline) {
          hl(pj, pi, pk - 1); hl(pj + 1, pi, pk); hl(pj, pi, pk + 1);
          hl(l, pj - 1, i1 - 1); hl(l, pj - 1, i1); hl(l, pj - 1, i1 + 1);
          vl(pj - 1, i1, pk); vl(pj + 1, i1, pk);
        } else { hl(pj, pi, pk); hl(l, pj, i1); vl(pj, i1, pk); }
      }
    }
    // GuiAdvancement.draw
    for (const w of tab.widgets) {
      if (!this._visible(w)) continue;
      gui.sprite(frameSprite(w.a.display.frame, this.adv.percent(w.a) >= 1), x + i + w.x + 3, y + j + w.y, 26, 26);
      if (w.a.display.icon) this.game.itemRenderer.drawItem(gui, w.a.display.icon, x + i + w.x + 8, y + j + w.y + 5, false);
    }
    gui.clearScissor();
  }

  // GuiScreenAdvancements.renderWindow: frame, tabs (drawTab / drawIcon) and the title
  _renderWindow(gui, L, T) {
    gui.blit(WINDOW, L, T, 0, 0, 252, 140);
    if (this.tabs.size > 1) {
      for (const tab of this.tabs.values()) {
        const { t, i } = tab.place;
        gui.sprite(tabSprite(t, i, tab.root.id === this.adv.selectedTab), L + tabX(t, i), T + tabY(t, i), t.w, t.h);
      }
      for (const tab of this.tabs.values()) {
        const { t, i } = tab.place;
        let x = L + tabX(t, i), y = T + tabY(t, i);
        if (t.name === 'above') { x += 6; y += 9; } else if (t.name === 'below') { x += 6; y += 6; } else if (t.name === 'left') { x += 10; y += 5; } else { x += 6; y += 5; }
        if (tab.root.display.icon) this.game.itemRenderer.drawItem(gui, tab.root.display.icon, x, y, false);
      }
    }
    // the selected tab's title, or "Advancements" without a tab
    gui.text(this.selected ? this.selected.root.display.title : tr('gui.advancements'), L + 8, T + 6, 0x404040, false);
  }

  // GuiScreenAdvancements.renderToolTips + GuiAdvancementTab.drawToolTips + GuiAdvancement.drawHover
  _renderTooltips(gui, mx, my, L, T) {
    const tab = this.selected;
    if (tab) {
      const x = L + 9, y = T + 18;
      const rx = mx - x, ry = my - y;
      const i = Math.floor(tab.scrollX), j = Math.floor(tab.scrollY);
      gui.rect(x, y, x + 234, y + 113, (Math.floor(tab.fade * 255) << 24) >>> 0);
      let hovered = null;
      if (rx > 0 && rx < 234 && ry > 0 && ry < 113) {
        for (const w of tab.widgets) {
          if (!this._visible(w)) continue;
          const a = i + w.x, b = j + w.y;
          if (rx >= a && rx <= a + 26 && ry >= b && ry <= b + 26) { hovered = w; break; }
        }
      }
      if (hovered) this._drawHover(gui, hovered, x, y, i, j, L);
      tab.fade = hovered ? Math.min(0.3, tab.fade + 0.02) : Math.max(0, tab.fade - 0.04);
    }
    if (this.tabs.size > 1) {
      for (const t of this.tabs.values()) {
        const { t: ty, i } = t.place;
        const tx = L + tabX(ty, i), tyy = T + tabY(ty, i);
        if (mx > tx && mx < tx + ty.w && my > tyy && my < tyy + ty.h) gui.tooltip([t.root.display.title], mx, my);
      }
    }
  }

  _drawHover(gui, w, ox, oy, scrollX, scrollY, L) {
    const font = gui.font;
    const flag = L + 9 + scrollX + w.x + w.width + 26 >= this.width;
    const s = this.adv.progressText(w.a);
    const sw = s ? font.width(s) : 0;
    const flag1 = 113 - scrollY - w.y - 26 <= 6 + w.description.length * 9;
    const f = this.adv.percent(w.a);
    let j = Math.floor(f * w.width);
    let st, st1, st2;
    if (f >= 1) { j = Math.floor(w.width / 2); st = st1 = st2 = 0; }
    else if (j < 2) { j = Math.floor(w.width / 2); st = st1 = st2 = 1; }
    else if (j > w.width - 2) { j = Math.floor(w.width / 2); st = st1 = 0; st2 = 1; }
    else { st = 0; st1 = st2 = 1; }
    const k = w.width - j;
    const l = oy + scrollY + w.y;
    const i1 = ox + (flag ? scrollX + w.x - w.width + 26 + 6 : scrollX + w.x);
    const j1 = 32 + w.description.length * 9;
    if (w.description.length) gui.sprite('advancements/title_box', i1, flag1 ? l + 26 - j1 : l, w.width, j1);
    gui.spriteRegion(boxSprite(st === 0), 200, 26, 0, 0, i1, l, j, 26);
    gui.spriteRegion(boxSprite(st1 === 0), 200, 26, 200 - k, 0, i1 + j, l, k, 26);
    gui.sprite(frameSprite(w.a.display.frame, st2 === 0), ox + scrollX + w.x + 3, oy + scrollY + w.y, 26, 26);
    if (flag) {
      gui.text(w.title, i1 + 5, oy + scrollY + w.y + 9, 0xffffffff, true);
      if (s) gui.text(s, ox + scrollX + w.x - sw, oy + scrollY + w.y + 9, 0xffffffff, true);
    } else {
      gui.text(w.title, ox + scrollX + w.x + 32, oy + scrollY + w.y + 9, 0xffffffff, true);
      if (s) gui.text(s, ox + scrollX + w.x + w.width - sw - 5, oy + scrollY + w.y + 9, 0xffffffff, true);
    }
    w.description.forEach((line, k1) => {
      const yy = flag1 ? l + 26 - j1 + 7 + k1 * 9 : oy + scrollY + w.y + 9 + 17 + k1 * 9;
      gui.text(line, i1 + 5, yy, 0xffaaaaaa, false);
    });
    if (w.a.display.icon) this.game.itemRenderer.drawItem(gui, w.a.display.icon, ox + scrollX + w.x + 8, oy + scrollY + w.y + 5, false);
  }
}

export { FRAME_NAME };
