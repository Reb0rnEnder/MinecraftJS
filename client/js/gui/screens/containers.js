// Container GUIs (port of GuiContainer and subclasses, incl. GuiContainerCreative).
import { FontRenderer } from '../font.js';
import { JavaRandom } from '../../util/jrandom.js';
import { mat4, D2R } from '../../gfx/math.js';
import { Node } from '../../gfx/scene.js';
import { blockModel } from '../../render/entity-models.js';
import { entityMaterial } from '../../render/boxmodel.js';
import { tr } from '../i18n.js';
import { platform } from '../../platform/platform.js';
import { Screen } from './manager.js';
import { Button, TextField } from '../widgets.js';
import { C } from '../../net/packets.js';
import { Writer } from '../../net/buffer.js';
import { copy, stackable } from '../../game/container.js';
import { blocks } from '../../world/blocks.js';

const quickcraft = (stage, mode) => (stage & 3) | ((mode & 3) << 2);

function playerInvSlots(start, x0, y0, hotbarY) {
  const out = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 9; j++) out.push([start + j + i * 9, x0 + j * 18, y0 + i * 18]);
  for (let j = 0; j < 9; j++) out.push([start + 27 + j, x0 + j * 18, hotbarY]);
  return out;
}

// ---------------------------------------------------------------- base container screen

export class ContainerScreen extends Screen {
  constructor(game, container) {
    super(game);
    this.container = container;
    this.isContainer = true;
    this.xSize = 176;
    this.ySize = 166;
    this.slotPos = []; // [slotIndex, x, y]
    this.dragSplitting = false;
    this.dragSlots = new Set();
    this.dragButton = 0;
    this.dragLimit = 0;
    this.ignoreMouseUp = false;
    this.lastClickSlot = null;
    this.lastClickTime = 0;
    this.lastClickButton = -1;
    this.doubleClick = false;
    this.shiftClickedItem = null;
    this.hovered = null;
  }

  get inv() { return this.game.inventory; }

  init() {
    this.guiLeft = Math.floor((this.width - this.xSize) / 2);
    this.guiTop = Math.floor((this.height - this.ySize) / 2);
  }

  slotAt(mx, my) {
    for (const [i, x, y] of this.slotPos) {
      if (mx >= this.guiLeft + x - 1 && mx < this.guiLeft + x + 17 && my >= this.guiTop + y - 1 && my < this.guiTop + y + 17) return i;
    }
    return null;
  }

  drawBackground() {}
  drawForeground() {}

  render(gui, mx, my, partial) {
    gui.worldBackground();
    this.drawBackground(gui, mx, my, partial);
    gui.pushMatrix();
    gui.translate(this.guiLeft, this.guiTop);
    const c = this.container;
    this.hovered = null;
    const cursor = this.inv.cursor;
    for (const [i, x, y] of this.slotPos) {
      let item = c.get(i);
      let countText = null;
      // Drag-split preview
      if (this.dragSplitting && this.dragSlots.has(i) && cursor) {
        if (this.dragSlots.size === 1) { /* vanilla shows normally */ } else if (c._canAdd(i, cursor, true) && c.isValid(i, cursor)) {
          const st = copy(cursor);
          const k = item ? item.count : 0;
          if (this.dragLimit === 0) st.count = Math.floor(cursor.count / this.dragSlots.size);
          else if (this.dragLimit === 1) st.count = 1;
          else st.count = c.maxStack(st);
          st.count += k;
          if (st.count > c.maxStack(st)) { countText = '§e' + c.maxStack(st); st.count = c.maxStack(st); }
          item = st;
          gui.rect(x, y, x + 16, y + 16, 0x80ffffff);
        }
      }
      if (!item && this.drawEmptySlot) this.drawEmptySlot(gui, i, x, y);
      if (item) this.game.itemRenderer.drawItem(gui, item, x, y, true, 0, countText);
      if (mx >= this.guiLeft + x - 1 && mx < this.guiLeft + x + 17 && my >= this.guiTop + y - 1 && my < this.guiTop + y + 17) {
        this.hovered = i;
        gui.rect(x, y, x + 16, y + 16, 0x80ffffff);
      }
    }
    this.drawForeground(gui, mx - this.guiLeft, my - this.guiTop);
    gui.popMatrix();
    for (const b of this.buttons) b.render(gui, mx, my);
    for (const f of this.fields) f.render(gui);
    this.drawOverlay && this.drawOverlay(gui, mx, my);
    // Cursor item
    if (cursor) {
      let shown = cursor;
      let text = null;
      if (this.dragSplitting && this.dragSlots.size > 1) {
        let left = cursor.count;
        for (const s of this.dragSlots) {
          const it = c.get(s);
          const k = it ? it.count : 0;
          let add = this.dragLimit === 0 ? Math.floor(cursor.count / this.dragSlots.size) : this.dragLimit === 1 ? 1 : c.maxStack(cursor);
          add = Math.min(add + k, c.maxStack(cursor)) - k;
          left -= add;
        }
        shown = { ...cursor, count: left };
        text = left <= 0 ? '§e0' : null;
      }
      this.game.itemRenderer.drawItem(gui, shown, mx - 8, my - 8, true, 0, text);
    } else if (this.hovered !== null) {
      const it = c.get(this.hovered);
      if (it) gui.tooltip(this.game.items.tooltip(it, this.game.settings.advancedItemTooltips), mx, my);
    }
    if (this.renderExtraTooltip) this.renderExtraTooltip(gui, mx, my);
  }

  isOutside(mx, my) {
    return mx < this.guiLeft || my < this.guiTop || mx >= this.guiLeft + this.xSize || my >= this.guiTop + this.ySize;
  }

  handleClick(slot, slotId, button, mode) {
    this.container.click(slotId, button, mode);
  }

  mouseDown(mx, my, button, e) {
    for (const b of this.buttons) if (button === 0 && b.mouseDown(mx, my, this.game)) return true;
    for (const f of this.fields) f.mouseDown(mx, my, this.gui);
    if (this.extraMouseDown && this.extraMouseDown(mx, my, button)) return true;
    const middle = button === 1;
    const btn = middle ? 2 : button === 2 ? 1 : 0; // DOM: 0 left, 1 middle, 2 right -> MC: 0 left, 1 right, 2 middle
    const slot = this.slotAt(mx, my);
    const now = platform().now();
    this.doubleClick = this.lastClickSlot === slot && now - this.lastClickTime < 250 && this.lastClickButton === btn;
    this.ignoreMouseUp = false;
    let l = slot !== null ? slot : -1;
    if (this.isOutside(mx, my) && slot === null) l = -999;
    if (l !== -1) {
      if (!this.dragSplitting) {
        if (!this.inv.cursor) {
          if (btn === 2) this.handleClick(slot, l, 2, 3);
          else {
            const shift = l !== -999 && e && e.shift;
            let mode = 0;
            if (shift) { this.shiftClickedItem = slot !== null ? copy(this.container.get(slot)) : null; mode = 1; }
            else if (l === -999) mode = 4;
            this.handleClick(slot, l, btn, mode);
          }
          this.ignoreMouseUp = true;
        } else {
          this.dragSplitting = true;
          this.dragButton = btn;
          this.dragSlots.clear();
          this.dragLimit = btn === 0 ? 0 : btn === 1 ? 1 : 2;
          if (slot !== null) this._tryAddDrag(slot);
        }
      }
    }
    this.lastClickSlot = slot;
    this.lastClickTime = now;
    this.lastClickButton = btn;
    this._mouseIsDown = true;
    return true;
  }

  _tryAddDrag(slot) {
    const c = this.container;
    const cur = this.inv.cursor;
    if (cur && cur.count > this.dragSlots.size && c._canAdd(slot, cur, true) && c.isValid(slot, cur) && c.canDragIntoSlot(slot)) this.dragSlots.add(slot);
  }

  mouseMove(mx, my) {
    if (!this.dragSplitting) return;
    const slot = this.slotAt(mx, my);
    if (slot !== null) this._tryAddDrag(slot);
  }

  mouseUp(mx, my, button, e) {
    for (const b of this.buttons) if (b.mouseUp) b.mouseUp();
    if (!this._mouseIsDown) return;
    this._mouseIsDown = false;
    const btn = button === 1 ? 2 : button === 2 ? 1 : 0;
    const slot = this.slotAt(mx, my);
    let l = slot !== null ? slot : -1;
    if (this.isOutside(mx, my) && slot === null) l = -999;
    const shift = e && e.shift;
    const c = this.container;
    if (this.doubleClick && slot !== null && btn === 0 && c.canMergeSlot(slot)) {
      if (shift) {
        if (this.shiftClickedItem) {
          const sameInv = (i) => (c.slots[i].playerIndex !== undefined) === (c.slots[slot].playerIndex !== undefined);
          for (let i = 0; i < c.slots.length; i++) {
            const it = c.get(i);
            if (it && c.canTake(i) && sameInv(i) && c._canAdd(i, this.shiftClickedItem, true) && stackable(it, this.shiftClickedItem)) this.handleClick(i, i, btn, 1);
          }
        }
      } else {
        this.handleClick(slot, l, btn, 6);
      }
      this.doubleClick = false;
      this.lastClickTime = 0;
    } else {
      if (this.dragSplitting && this.dragButton !== btn) {
        this.dragSplitting = false; this.dragSlots.clear(); this.ignoreMouseUp = true; return;
      }
      if (this.ignoreMouseUp) { this.ignoreMouseUp = false; this.dragSplitting = false; return; }
      if (this.dragSplitting && this.dragSlots.size > 0) {
        if (this.dragSlots.size === 1) {
          const s = [...this.dragSlots][0];
          this.handleClick(s, s, btn, 0);
        } else {
          this.handleClick(null, -999, quickcraft(0, this.dragLimit), 5);
          for (const s of this.dragSlots) this.handleClick(s, s, quickcraft(1, this.dragLimit), 5);
          this.handleClick(null, -999, quickcraft(2, this.dragLimit), 5);
        }
      } else if (this.inv.cursor) {
        if (btn === 2) this.handleClick(slot, l, btn, 3);
        else {
          const sh = l !== -999 && !!shift;
          if (sh) this.shiftClickedItem = slot !== null ? copy(c.get(slot)) : null;
          this.handleClick(slot, l, btn, sh ? 1 : (l === -999 ? 0 : 0));
        }
      }
    }
    if (!this.inv.cursor) this.lastClickTime = 0;
    this.dragSplitting = false;
  }

  key(e) {
    const g = this.game;
    for (const f of this.fields) if (f.focused && f.key(e)) return true;
    if (this.fields.some((f) => f.focused) && e.code !== 'Escape') return true;
    if (e.code === 'Escape' || e.code === g.settings.keys.inventory) { this.close(); return true; }
    if (this.hovered !== null && !this.inv.cursor) {
      for (let i = 0; i < 9; i++) {
        if (e.code === g.settings.keys['hotbar' + (i + 1)]) { this.handleClick(this.hovered, this.hovered, i, 2); return true; }
      }
    }
    if (this.hovered !== null && this.container.get(this.hovered)) {
      if (e.code === g.settings.keys.drop) { this.handleClick(this.hovered, this.hovered, e.ctrl ? 1 : 0, 4); return true; }
    }
    return true;
  }

  close() {
    const g = this.game;
    g.send(C.closeWindow(this.container.windowId));
    this.inv.cursor = null;
    if (this.container.onClose) this.container.onClose();
    if (this.container !== g.inventory) g.window = null;
    // Crafting grid contents are returned by the server
    if (this.container === g.inventory) { for (let i = 0; i < 4; i++) g.inventory.craft[i] = null; g.inventory.craftResult = null; }
    g.screens.current = null;
    if (g.inWorld) g.input.lock();
  }

  onClose() {}

  title(gui, text, x, y) { gui.text(text, x, y, 0x404040, false); }
}


// ---------------------------------------------------------------- player inventory

export class InventoryScreen extends ContainerScreen {
  constructor(game) {
    super(game, game.inventory);
    const s = [[0, 144, 36]];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) s.push([1 + j + i * 2, 88 + j * 18, 26 + i * 18]);
    for (let k = 0; k < 4; k++) s.push([5 + k, 8, 8 + k * 18]);
    s.push(...playerInvSlots(9, 8, 84, 142));
    this.slotPos = s;
  }

  init() {
    super.init();
    this.effectsShift = this.game.effects.size > 0;
    if (this.effectsShift) this.guiLeft = Math.floor(160 + (this.width - this.xSize - 200) / 2);
  }

  drawEmptySlot(gui, i, x, y) {
    if (i >= 5 && i <= 8) {
      const names = ['empty_armor_slot_helmet', 'empty_armor_slot_chestplate', 'empty_armor_slot_leggings', 'empty_armor_slot_boots'];
      const e = this.game.assets.atlas.entries.get('items/' + names[i - 5]);
      if (e) this.game.itemRenderer.drawSprite(gui, 'items/' + names[i - 5], x, y);
    }
  }

  drawBackground(gui, mx, my) {
    gui.blit('gui/container/inventory.png', this.guiLeft, this.guiTop, 0, 0, this.xSize, this.ySize);
    this.game.entityRenderer.drawPlayerInGui && this.game.entityRenderer.drawPlayerInGui(gui, this.guiLeft + 51, this.guiTop + 75, 30, this.guiLeft + 51 - mx, this.guiTop + 75 - 50 - my);
    if (this.effectsShift) drawEffects(this.game, gui, this.guiLeft - 124, this.guiTop);
  }

  drawForeground(gui) { this.title(gui, this.game.assets.translate('container.crafting'), 86, 16); }
}

const POTION_ICON = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 8: 10, 9: 11, 10: 7, 11: 14, 12: 15, 13: 16, 14: 8, 15: 13, 16: 12, 17: 9, 18: 5, 19: 6, 20: 17, 21: 23, 22: 18 };
const POTION_NAMES = { 1: 'moveSpeed', 2: 'moveSlowdown', 3: 'digSpeed', 4: 'digSlowDown', 5: 'damageBoost', 6: 'heal', 7: 'harm', 8: 'jump',
  9: 'confusion', 10: 'regeneration', 11: 'resistance', 12: 'fireResistance', 13: 'waterBreathing', 14: 'invisibility', 15: 'blindness',
  16: 'nightVision', 17: 'hunger', 18: 'weakness', 19: 'poison', 20: 'wither', 21: 'healthBoost', 22: 'absorption', 23: 'saturation' };

function drawEffects(game, gui, x, y) {
  const n = game.effects.size;
  let dy = 33;
  if (n > 5) dy = Math.floor(132 / (n - 1));
  const names = POTION_NAMES, iconIdx = POTION_ICON;
  for (const [id, e] of game.effects) {
    gui.blit('gui/container/inventory.png', x, y, 0, 166, 140, 32);
    const ic = iconIdx[id];
    if (ic !== undefined) gui.blit('gui/container/inventory.png', x + 6, y + 7, (ic % 8) * 18, 198 + Math.floor(ic / 8) * 18, 18, 18);
    let name = game.assets.translate('potion.' + (names[id] || 'unknown'));
    if (e.amplifier === 1) name += ' ' + game.assets.translate('enchantment.level.2');
    else if (e.amplifier === 2) name += ' ' + game.assets.translate('enchantment.level.3');
    else if (e.amplifier === 3) name += ' ' + game.assets.translate('enchantment.level.4');
    gui.text(name, x + 10 + 18, y + 6, 0xffffff, true);
    const secs = Math.floor(e.duration / 20);
    const dur = e.duration > 32767 ? '**:**' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    gui.text(dur, x + 10 + 18, y + 6 + 10, 0x7f7f7f, true);
    y += dy;
  }
}

// ---------------------------------------------------------------- server containers

class ChestScreen extends ContainerScreen {
  constructor(game, win) {
    super(game, win);
    this.rows = Math.floor(win.size / 9);
    this.ySize = 114 + this.rows * 18;
    const s = [];
    for (let i = 0; i < this.rows; i++) for (let j = 0; j < 9; j++) s.push([j + i * 9, 8 + j * 18, 18 + i * 18]);
    const off = (this.rows - 4) * 18;
    s.push(...playerInvSlots(win.size, 8, 103 + off, 161 + off));
    this.slotPos = s;
  }
  drawBackground(gui) {
    gui.blit('gui/container/generic_54.png', this.guiLeft, this.guiTop, 0, 0, this.xSize, this.rows * 18 + 17);
    gui.blit('gui/container/generic_54.png', this.guiLeft, this.guiTop + this.rows * 18 + 17, 0, 126, this.xSize, 96);
  }
  drawForeground(gui) {
    this.title(gui, this.container.title, 8, 6);
    this.title(gui, this.game.assets.translate('container.inventory'), 8, this.ySize - 96 + 2);
  }
}

class SimpleScreen extends ContainerScreen {
  constructor(game, win, tex, slots, opts = {}) {
    super(game, win);
    this.tex = tex;
    this.ySize = opts.ySize || 166;
    this.xSize = opts.xSize || 176;
    this.titleX = opts.titleX;
    this.slotPos = [...slots, ...playerInvSlots(win.size, opts.invX || 8, opts.invY || 84, opts.hotbarY || 142)];
  }
  drawBackground(gui) { gui.blit(this.tex, this.guiLeft, this.guiTop, 0, 0, this.xSize, this.ySize); }
  drawForeground(gui) {
    const t = this.container.title;
    const x = this.titleX !== undefined ? this.titleX : this.xSize / 2 - gui.textWidth(t) / 2;
    this.title(gui, t, x, 6);
    this.title(gui, this.game.assets.translate('container.inventory'), 8, this.ySize - 96 + 2);
  }
}

class FurnaceScreen extends SimpleScreen {
  constructor(game, win) { super(game, win, 'gui/container/furnace.png', [[0, 56, 17], [1, 56, 53], [2, 116, 35]]); }
  drawBackground(gui) {
    super.drawBackground(gui);
    const p = this.container.properties;
    const burn = p[0] || 0;
    if (burn > 0) {
      let total = p[1] || 0;
      if (total === 0) total = 200;
      const k = Math.floor(burn * 13 / total);
      gui.blit(this.tex, this.guiLeft + 56, this.guiTop + 36 + 12 - k, 176, 12 - k, 14, k + 1);
    }
    const cook = p[2] || 0, totalCook = p[3] || 0;
    const l = cook && totalCook ? Math.floor(cook * 24 / totalCook) : 0;
    gui.blit(this.tex, this.guiLeft + 79, this.guiTop + 34, 176, 14, l + 1, 16);
  }
}

class BrewingScreen extends SimpleScreen {
  constructor(game, win) { super(game, win, 'gui/container/brewing_stand.png', [[0, 56, 46], [1, 79, 53], [2, 102, 46], [3, 79, 17]]); }
  drawBackground(gui) {
    super.drawBackground(gui);
    const t = this.container.properties[0] || 0;
    if (t > 0) {
      let j1 = Math.floor(28 * (1 - t / 400));
      if (j1 > 0) gui.blit(this.tex, this.guiLeft + 97, this.guiTop + 16, 176, 0, 9, j1);
      const k1 = Math.floor(t / 2) % 7;
      j1 = [29, 24, 20, 16, 11, 6, 0][k1];
      if (j1 > 0) gui.blit(this.tex, this.guiLeft + 65, this.guiTop + 14 + 29 - j1, 185, 29 - j1, 12, j1);
    }
  }
}

// EnchantmentNameParts: the clue words (3 - 4), drawn wrapped in the Standard Galactic font
const NAME_PARTS = 'the elder scrolls klaatu berata niktu xyzzy bless curse light darkness fire air earth water hot dry cold wet ignite snuff embiggen twist shorten stretch fiddle destroy imbue galvanize enchant free limited range of towards inside sphere cube self other ball mental physical grow shrink demon elemental spirit animal creature beast humanoid undead fresh stale phnglui mglwnafh cthulhu rlyeh wgahnagl fhtagnbaguette'.split(' ');

// GuiEnchantment
class EnchantScreen extends SimpleScreen {
  constructor(game, win) {
    super(game, win, 'gui/container/enchanting_table.png', [[0, 15, 47], [1, 35, 47]]);
    this.flip = 0; this.oFlip = 0; this.flipT = 0; this.flipA = 0; this.open = 0; this.oOpen = 0; this.lastItem = null;
  }

  // GuiEnchantment.tickBook: a new item flips some pages; the book opens while there is something to enchant
  tick() {
    super.tick();
    const it = this.container.get(0);
    const k = it ? JSON.stringify([it.id, it.damage, it.count, it.nbt || null]) : null;
    if (k !== this.lastItem) {
      this.lastItem = k;
      do { this.flipT += Math.floor(Math.random() * 4) - Math.floor(Math.random() * 4); } while (this.flip <= this.flipT + 1 && this.flip >= this.flipT - 1);
    }
    this.oFlip = this.flip; this.oOpen = this.open;
    const p = this.container.properties;
    const any = [0, 1, 2].some((i) => (p[i] || 0) !== 0);
    this.open = Math.min(1, Math.max(0, this.open + (any ? 0.2 : -0.2)));
    const f1 = Math.min(0.2, Math.max(-0.2, (this.flipT - this.flip) * 0.4));
    this.flipA += (f1 - this.flipA) * 0.9;
    this.flip += this.flipA;
  }

  // GuiEnchantment.drawGuiContainerBackgroundLayer: ModelBook through its own 320 x 240 viewport and
  // gluPerspective(90, 4 / 3, 9, 80), here folded into one matrix into GUI space
  _drawBook(gui, partial) {
    if (!this.book) {
      const parts = blockModel('book', ['coverRight', 'coverLeft', 'pagesRight', 'pagesLeft', 'flipRight', 'flipLeft', 'spine']);
      const mat = entityMaterial('entity/enchanting_table_book.png', { alphaTest: 0.1, cull: true, fullBright: true, noLighting: true });
      const root = new Node();
      for (const p of Object.values(parts)) { root.add(p.build()); p.setMaterial(mat); }
      this.book = { parts, root };
    }
    const f3 = this.oOpen + (this.open - this.oOpen) * partial;
    let f4 = this.oFlip + (this.flip - this.oFlip) * partial + 0.25, f5 = this.oFlip + (this.flip - this.oFlip) * partial + 0.75;
    f4 = Math.min(1, Math.max(0, (f4 - Math.floor(f4)) * 1.6 - 0.3));
    f5 = Math.min(1, Math.max(0, (f5 - Math.floor(f5)) * 1.6 - 0.3));
    // ModelBook.setRotationAngles(0, f4, f5, f3)
    const P = this.book.parts, f = 1.25 * f3;
    P.coverRight.ry = Math.PI + f; P.coverLeft.ry = -f; P.pagesRight.ry = f; P.pagesLeft.ry = -f;
    P.flipRight.ry = f - f * 2 * f4; P.flipLeft.ry = f - f * 2 * f5;
    P.pagesRight.px = P.pagesLeft.px = P.flipRight.px = P.flipLeft.px = Math.sin(f);
    for (const p of Object.values(P)) p.sync();
    const W = this.width, H = this.height;
    const vx = Math.trunc((W - 320) / 2), vy = H - Math.trunc((H - 240) / 2) - 240; // the GL viewport, from the top
    const m = mat4.create();
    // NDC -> GUI pixels; depth spread over +-20000 GUI units (nearer = higher) so the closed book's covers stay in
    // front of the pages 0.01 inside them (the GUI depth range is +-400000)
    mat4.translate(m, m, vx + 160, vy + 120, 100);
    mat4.scale(m, m, 160, -120, -20000);
    mat4.translate(m, m, -0.34, 0.23, 0);
    mat4.multiply(m, m, mat4.perspective(mat4.create(), 90 * D2R, 4 / 3, 9, 80));
    mat4.translate(m, m, 0, 3.3, -16);
    mat4.scale(m, m, 5, 5, 5);
    mat4.rotateZ(m, m, Math.PI);
    mat4.rotateX(m, m, 20 * D2R);
    mat4.translate(m, m, (1 - f3) * 0.2, (1 - f3) * 0.1, (1 - f3) * 0.25);
    mat4.rotateY(m, m, (-(1 - f3) * 90 - 90) * D2R);
    mat4.rotateX(m, m, Math.PI);
    mat4.scale(m, m, 1 / 16, 1 / 16, 1 / 16);
    gui.drawNode(this.book.root, m);
  }

  drawBackground(gui, mx, my) {
    super.drawBackground(gui);
    this._drawBook(gui, this.game.partial || 0);
    const g = this.game, p = this.container.properties;
    const lapis = this.container.get(1);
    const lapisCount = lapis ? lapis.count : 0;
    const sga = gui.galacticFont || (gui.galacticFont = new FontRenderer(gui, 'font/ascii_sga.png'));
    // EnchantmentNameParts.reseedRandomGenerator(xpSeed): the same words while the seed holds
    const rand = new JavaRandom(p[3] || 0);
    for (let l = 0; l < 3; l++) {
      const x = this.guiLeft + 60, y = this.guiTop + 14 + 19 * l;
      // generateNewRandomName() for every row, before the level is looked at
      const n = rand.nextInt(2) + 3;
      const words = [];
      for (let i = 0; i < n; i++) words.push(NAME_PARTS[rand.nextInt(NAME_PARTS.length)]);
      const clue = words.join(' ');
      const w = 86;
      const cost = p[l] || 0;
      if (cost === 0) { gui.blit(this.tex, x, y, 0, 185, 108, 19); continue; }
      const s = '' + cost;
      let color = 6839882;
      if (!((lapisCount >= l + 1 && g.xpLevel >= cost) || g.player.creative)) {
        gui.blit(this.tex, x, y, 0, 185, 108, 19);
        gui.blit(this.tex, x + 1, y + 1, 16 * l, 239, 16, 16);
        this._split(sga, clue, x + 20, y + 2, w, (color & 0xfefefe) >> 1);
        color = 4226832;
      } else {
        const hover = mx >= x && my >= y && mx < x + 108 && my < y + 19;
        if (hover) { gui.blit(this.tex, x, y, 0, 204, 108, 19); color = 0xffff80; } else gui.blit(this.tex, x, y, 0, 166, 108, 19);
        gui.blit(this.tex, x + 1, y + 1, 16 * l, 223, 16, 16);
        this._split(sga, clue, x + 20, y + 2, w, color);
        color = 8453920;
      }
      gui.text(s, x + 20 + 86 - gui.textWidth(s), y + 2 + 7, color, true);
    }
  }

  // FontRenderer.drawSplitString: wrapped lines, no shadow
  _split(font, text, x, y, w, color) {
    font.wrap(text, w).forEach((line, i) => font.draw(line, x, y + i * 9, color, false));
  }

  // GuiEnchantment.drawScreen: the clue tooltip (enchantmentIds: id | level << 8) with the lapis / level requirements
  drawOverlay(gui, mx, my) {
    const g = this.game, p = this.container.properties;
    const lapis = this.container.get(1), lapisCount = lapis ? lapis.count : 0;
    for (let i = 0; i < 3; i++) {
      const lvl = p[i] || 0, id = p[4 + i] === undefined ? -1 : p[4 + i];
      const x = this.guiLeft + 60, y = this.guiTop + 14 + 19 * i;
      if (!(mx >= x - 1 && mx < x + 108 + 1 && my >= y - 1 && my < y + 17 + 1) || lvl <= 0 || id < 0) continue;
      const lines = [];
      if (g.items.enchantmentName(id & 255, 1) !== null) lines.push('§f§o' + tr('container.enchant.clue', g.items.enchantmentName(id & 255, (id & 0xff00) >> 8)));
      if (!g.player.creative) {
        lines.push('');
        const k = i + 1;
        if (g.xpLevel < lvl) lines.push('§cLevel Requirement: ' + lvl);
        else {
          lines.push((lapisCount >= k ? '§7' : '§c') + (k === 1 ? tr('container.enchant.lapis.one') : tr('container.enchant.lapis.many', k)));
          lines.push('§7' + (k === 1 ? tr('container.enchant.level.one') : tr('container.enchant.level.many', k)));
        }
      }
      gui.tooltip(lines, mx, my);
      break;
    }
  }
  extraMouseDown(mx, my, button) {
    if (button !== 0) return false;
    for (let l = 0; l < 3; l++) {
      const x = this.guiLeft + 60, y = this.guiTop + 14 + 19 * l;
      if (mx >= x && my >= y && mx < x + 108 && my < y + 19) {
        this.game.send(C.enchantItem(this.container.windowId, l));
        return true;
      }
    }
    return false;
  }
}

class AnvilScreen extends SimpleScreen {
  constructor(game, win) { super(game, win, 'gui/container/anvil.png', [[0, 27, 47], [1, 76, 47], [2, 134, 47]], { titleX: 60 }); }
  init() {
    super.init();
    this.nameField = new TextField(this.guiLeft + 62, this.guiTop + 24, 103, 12, { maxLength: 30, background: false, focused: false });
    this.nameField.textColor = 0xffffff;
    this.nameField.onChange = (t) => {
      const w = new Writer().string(t).build();
      this.game.send(C.customPayload('MC|ItemName', w));
    };
    this.fields.push(this.nameField);
    this._lastFirst = null;
  }
  tick() {
    super.tick();
    const first = this.container.get(0);
    const key = first ? first.id + ':' + first.damage : null;
    if (key !== this._lastFirst) {
      this._lastFirst = key;
      this.nameField.text = first ? this.game.items.displayName(first) : '';
      this.nameField.enabled = !!first;
      this.nameField.cursor = this.nameField.selEnd = this.nameField.text.length;
    }
  }
  drawBackground(gui) {
    super.drawBackground(gui);
    gui.blit(this.tex, this.guiLeft + 59, this.guiTop + 20, 0, this.ySize + (this.container.get(0) ? 0 : 16), 110, 16);
    if ((this.container.get(0) || this.container.get(1)) && !this.container.get(2)) gui.blit(this.tex, this.guiLeft + 99, this.guiTop + 45, this.xSize, 0, 28, 21);
  }
  drawForeground(gui) {
    this.title(gui, this.game.assets.translate('container.repair'), 60, 6);
    const cost = this.container.properties[0] || 0;
    if (cost > 0) {
      let color = 8453920;
      let s = tr('container.repair.cost', cost);
      if (cost >= 40 && !this.game.player.creative) { s = tr('container.repair.expensive'); color = 16736352; }
      else if (!this.container.get(2)) color = 16736352;
      else if (this.game.xpLevel < cost && !this.game.player.creative) color = 16736352;
      const x = this.xSize - 8 - gui.textWidth(s);
      gui.rect(x - 2, 67 - 1, this.xSize - 7, 79 - 1, 0x4f000000);
      gui.text(s, x, 69, color, true);
    }
  }
}

// GuiBeacon: primary powers in three tiers, secondary (regeneration or level II of the primary), payment slot
const BEACON_TEX = 'gui/container/beacon.png';
const BEACON_EFFECTS = [[1, 3], [11, 8], [5], [10]]; // TileEntityBeacon.effectsList
class BeaconScreen extends ContainerScreen {
  constructor(game, win) {
    super(game, win);
    this.xSize = 230; this.ySize = 219;
    this.slotPos = [[0, 136, 110], ...playerInvSlots(1, 36, 137, 195)];
    this.local = {}; // fields changed by clicking (TileEntityBeacon.setField on the client)
  }

  field(i) { return this.local[i] !== undefined ? this.local[i] : (this.container.properties[i] || 0); }

  // GuiBeacon.updateScreen: power buttons for the current levels / selection
  _buttons() {
    const L = this.guiLeft, T = this.guiTop;
    const levels = this.field(0), primary = this.field(1), secondary = this.field(2);
    const out = [];
    for (let l = 0; l <= 2; l++) {
      const list = BEACON_EFFECTS[l];
      const w = list.length * 22 + (list.length - 1) * 2;
      list.forEach((id, k) => out.push({ x: L + 76 + k * 24 - Math.floor(w / 2), y: T + 22 + l * 25, effect: id, tier: l, enabled: l < levels, selected: l < levels && id === primary }));
    }
    const n = BEACON_EFFECTS[3].length + 1;
    const w = n * 22 + (n - 1) * 2;
    BEACON_EFFECTS[3].forEach((id, k) => out.push({ x: L + 167 + k * 24 - Math.floor(w / 2), y: T + 47, effect: id, tier: 3, enabled: 3 < levels, selected: 3 < levels && id === secondary }));
    if (primary > 0) out.push({ x: L + 167 + (n - 1) * 24 - Math.floor(w / 2), y: T + 47, effect: primary, tier: 3, enabled: 3 < levels, selected: 3 < levels && primary === secondary });
    const pay = !!this.container.get(0);
    out.push({ x: L + 164, y: T + 107, confirm: true, enabled: pay && primary > 0, u: 90, v: 220 });
    out.push({ x: L + 190, y: T + 107, cancel: true, enabled: true, u: 112, v: 220 });
    return out;
  }

  drawBackground(gui, mx, my) {
    const L = this.guiLeft, T = this.guiTop;
    gui.blit(BEACON_TEX, L, T, 0, 0, this.xSize, this.ySize);
    // payment items
    const ir = this.game.itemRenderer;
    [388, 264, 266, 265].forEach((id, k) => ir.drawItem(gui, { id, count: 1, damage: 0 }, L + 42 + k * 22, T + 109, false));
    // GuiBeacon.Button.drawButton: 22x22 frame (disabled / selected / hovered), then the icon
    this.beaconButtons = this._buttons();
    for (const b of this.beaconButtons) {
      const hov = mx >= b.x && my >= b.y && mx < b.x + 22 && my < b.y + 22;
      let u = 0;
      if (!b.enabled) u += 44; else if (b.selected) u += 22; else if (hov) u += 66;
      gui.blit(BEACON_TEX, b.x, b.y, u, 219, 22, 22);
      if (b.effect) {
        const ic = POTION_ICON[b.effect];
        if (ic >= 0) gui.blit('gui/container/inventory.png', b.x + 2, b.y + 2, (ic % 8) * 18, 198 + Math.floor(ic / 8) * 18, 18, 18);
      } else gui.blit(BEACON_TEX, b.x + 2, b.y + 2, b.u, b.v, 18, 18);
    }
  }

  drawForeground(gui) {
    gui.textCentered(this.game.assets.translate('tile.beacon.primary'), 62, 10, 0xe0e0e0, true);
    gui.textCentered(this.game.assets.translate('tile.beacon.secondary'), 169, 10, 0xe0e0e0, true);
  }

  drawOverlay(gui, mx, my) {
    for (const b of this.beaconButtons || []) {
      if (!(mx >= b.x && my >= b.y && mx < b.x + 22 && my < b.y + 22)) continue;
      let text;
      if (b.confirm) text = this.game.assets.translate('gui.done');
      else if (b.cancel) text = this.game.assets.translate('gui.cancel');
      else {
        text = this.game.assets.translate('potion.' + POTION_NAMES[b.effect]);
        if (b.tier >= 3 && b.effect !== 10) text += ' II';
      }
      gui.tooltip([text], mx, my);
      break;
    }
  }

  extraMouseDown(mx, my, button) {
    if (button !== 0 || !this.beaconButtons) return false;
    for (const b of this.beaconButtons) {
      if (!(mx >= b.x && my >= b.y && mx < b.x + 22 && my < b.y + 22)) continue;
      if (!b.enabled) return true;
      this.game.sound.playUi('gui.button.press', 1);
      if (b.cancel) { this.close(); return true; }
      if (b.confirm) {
        const w = new Writer().i32(this.field(1)).i32(this.field(2)).build();
        this.game.send(C.customPayload('MC|Beacon', w));
        this.close();
        return true;
      }
      if (b.selected) return true;
      if (b.tier < 3) this.local[1] = b.effect; else this.local[2] = b.effect;
      return true;
    }
    return false;
  }
}

class VillagerScreen extends SimpleScreen {
  constructor(game, win) {
    super(game, win, 'gui/container/villager.png', [[0, 36, 53], [1, 62, 53], [2, 120, 53]]);
    this.trades = [];
    this.index = 0;
    if (game.pendingTrades) { this.onTradeList(game.pendingTrades); game.pendingTrades = null; }
  }
  init() {
    super.init();
    this.next = new Button(1, this.guiLeft + 120 + 27, this.guiTop + 24 - 1, 12, 19, '>', () => this.select(this.index + 1));
    this.prev = new Button(2, this.guiLeft + 36 - 19, this.guiTop + 24 - 1, 12, 19, '<', () => this.select(this.index - 1));
    this.buttons.push(this.next, this.prev);
  }
  onTradeList(data) {
    // MC|TrList: int windowId, byte count, then recipes
    import('../../net/buffer.js').then(({ Reader }) => {
      const r = new Reader(data);
      r.i32();
      const n = r.u8();
      const trades = [];
      for (let i = 0; i < n; i++) {
        const a = r.slot(); const out = r.slot(); const hasB = r.bool(); const b = hasB ? r.slot() : null;
        const disabled = r.bool(); const uses = r.i32(); const max = r.i32();
        trades.push({ a, b, out, disabled, uses, max });
      }
      this.trades = trades;
    });
  }
  select(i) {
    if (i < 0 || i >= this.trades.length) return;
    this.index = i;
    this.game.send(C.customPayload('MC|TrSel', new Writer().i32(i).build()));
  }
  drawBackground(gui) {
    super.drawBackground(gui);
    this.next.enabled = this.index < this.trades.length - 1;
    this.prev.enabled = this.index > 0;
    const t = this.trades[this.index];
    if (t && t.disabled) {
      gui.blit(this.tex, this.guiLeft + 83, this.guiTop + 21, 212, 0, 28, 21);
      gui.blit(this.tex, this.guiLeft + 83, this.guiTop + 51, 212, 0, 28, 21);
    }
  }
  drawForeground(gui) {
    super.drawForeground(gui);
    const t = this.trades[this.index];
    if (!t) return;
    const ir = this.game.itemRenderer;
    ir.drawItem(gui, t.a, 36, 24);
    if (t.b) ir.drawItem(gui, t.b, 62, 24);
    ir.drawItem(gui, t.out, 120, 24);
  }
}

class HorseScreen extends ContainerScreen {
  constructor(game, win) {
    super(game, win);
    const s = [[0, 8, 18], [1, 8, 36]];
    const chest = win.size > 2;
    if (chest) for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) s.push([2 + j + i * 5, 80 + j * 18, 18 + i * 18]);
    s.push(...playerInvSlots(win.size, 8, 84, 142));
    this.slotPos = s;
    this.chest = chest;
  }
  drawBackground(gui) {
    const t = 'gui/container/horse.png';
    gui.blit(t, this.guiLeft, this.guiTop, 0, 0, this.xSize, this.ySize);
    if (this.chest) gui.blit(t, this.guiLeft + 79, this.guiTop + 17, 0, this.ySize, 90, 54);
    gui.blit(t, this.guiLeft + 7, this.guiTop + 35 - 18, 18, this.ySize + 54, 18, 18);
    gui.blit(t, this.guiLeft + 7, this.guiTop + 35, 0, this.ySize + 54, 18, 18);
  }
  drawForeground(gui) {
    this.title(gui, this.container.title, 8, 6);
    this.title(gui, this.game.assets.translate('container.inventory'), 8, this.ySize - 96 + 2);
  }
}

export function openContainerScreen(game, win) {
  const t = win.type;
  let s;
  const P = (x, y) => [x, y];
  void P;
  switch (t) {
    case 'minecraft:chest': case 'minecraft:container': s = new ChestScreen(game, win); break;
    case 'minecraft:crafting_table': {
      const slots = [[0, 124, 35]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) slots.push([1 + j + i * 3, 30 + j * 18, 17 + i * 18]);
      s = new SimpleScreen(game, win, 'gui/container/crafting_table.png', slots, { titleX: 28 });
      if (!win.title || win.title === 'container.crafting') win.title = game.assets.translate('container.crafting');
      break;
    }
    case 'minecraft:furnace': s = new FurnaceScreen(game, win); break;
    case 'minecraft:dispenser': case 'minecraft:dropper': {
      const slots = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) slots.push([j + i * 3, 62 + j * 18, 17 + i * 18]);
      s = new SimpleScreen(game, win, 'gui/container/dispenser.png', slots);
      break;
    }
    case 'minecraft:hopper': {
      const slots = [];
      for (let i = 0; i < 5; i++) slots.push([i, 44 + i * 18, 20]);
      s = new SimpleScreen(game, win, 'gui/container/hopper.png', slots, { ySize: 133, invY: 51, hotbarY: 109 });
      break;
    }
    case 'minecraft:brewing_stand': s = new BrewingScreen(game, win); break;
    case 'minecraft:enchanting_table': s = new EnchantScreen(game, win); break;
    case 'minecraft:anvil': s = new AnvilScreen(game, win); break;
    case 'minecraft:beacon': s = new BeaconScreen(game, win); break;
    case 'minecraft:villager': s = new VillagerScreen(game, win); break;
    case 'EntityHorse': s = new HorseScreen(game, win); break;
    default: s = new ChestScreen(game, win); break;
  }
  if (win.title && win.title.startsWith('container.')) win.title = game.assets.translate(win.title);
  game.screens.open(s);
}

// ---------------------------------------------------------------- creative inventory

const TABS = ['buildingBlocks', 'decorations', 'redstone', 'transportation', 'misc', 'search', 'food', 'tools', 'combat', 'brewing', 'materials', 'inventory'];
const TAB_ICONS = [{ id: 45 }, { id: 175, damage: 5 }, { id: 331 }, { id: 27 }, { id: 327 }, { id: 345 }, { id: 260 }, { id: 258 }, { id: 283 }, { id: 373 }, { id: 280 }, { id: 54 }];

// CreativeTabs.displayAllReleventItems for every tab, from client/data/creative.json (read from the game with
// tools/creative-dump; search: GuiContainerCreative.updateCreativeSearch's list)
function buildCreativeTabs(game) {
  const tabs = {};
  for (const t of game.assets.data.creative.tabs) tabs[t.label] = t.items.map(([id, damage, tag]) => ({ id, count: 1, damage, nbt: tag ? { t: 10, name: '', v: tag } : null }));
  return tabs;
}

export class CreativeScreen extends ContainerScreen {
  constructor(game) {
    super(game, game.inventory);
    this.xSize = 195; this.ySize = 136;
    this.tab = CreativeScreen.lastTab ?? 0;
    this.scroll = 0;
    if (!CreativeScreen.tabs) CreativeScreen.tabs = buildCreativeTabs(game);
    this.list = [];
    this.isScrolling = false;
  }

  init() {
    super.init();
    // InventoryEffectRenderer: with active effects the window moves right to make room for the list
    this.effectsShift = this.game.effects.size > 0;
    if (this.effectsShift) this.guiLeft = Math.floor(160 + (this.width - this.xSize - 200) / 2);
    this.search = new TextField(this.guiLeft + 82, this.guiTop + 6, 89, 9, { maxLength: 15, background: false, focused: false, onChange: () => this.filter() });
    this.search.textColor = 0xffffff;
    this.setTab(this.tab);
  }

  setTab(i) {
    this.tab = i;
    CreativeScreen.lastTab = i;
    this.scroll = 0;
    this.fields = [];
    if (TABS[i] === 'search') { this.fields.push(this.search); this.search.focused = true; this.filter(); }
    else this.list = CreativeScreen.tabs[TABS[i]] || [];
    this._layout();
  }

  filter() {
    const q = this.search.text.toLowerCase();
    const all = CreativeScreen.tabs.search;
    // updateCreativeSearch: any tooltip line (formatting stripped) containing the text
    this.list = q ? all.filter((it) => this.game.items.tooltip(it, this.game.settings.advancedItemTooltips).some((l) => l.replace(/§./g, '').toLowerCase().includes(q))) : all;
    this.scroll = 0;
    this._layout();
  }

  _layout() {
    const inv = TABS[this.tab] === 'inventory';
    this.slotPos = [];
    if (inv) {
      // Survival layout inside the creative GUI
      for (let k = 0; k < 4; k++) this.slotPos.push([5 + k, 9 + Math.floor(k / 2) * 54, 6 + (k % 2) * 27]);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 9; j++) this.slotPos.push([9 + j + i * 9, 9 + j * 18, 54 + i * 18]);
      for (let j = 0; j < 9; j++) this.slotPos.push([36 + j, 9 + j * 18, 112]);
    } else {
      for (let j = 0; j < 9; j++) this.slotPos.push([36 + j, 9 + j * 18, 112]);
    }
  }

  maxScrollRows() { return Math.max(0, Math.ceil(this.list.length / 9) - 5); }

  gridItemAt(mx, my) {
    if (TABS[this.tab] === 'inventory') return null;
    const x = mx - this.guiLeft - 9, y = my - this.guiTop - 18;
    if (x < 0 || y < 0 || x >= 9 * 18 || y >= 5 * 18) return null;
    const col = Math.floor(x / 18), row = Math.floor(y / 18);
    const idx = (row + Math.round(this.scroll * this.maxScrollRows())) * 9 + col;
    return { idx, item: this.list[idx] || null, x: 9 + col * 18, y: 18 + row * 18 };
  }

  render(gui, mx, my, partial) {
    gui.worldBackground();
    const L = this.guiLeft, T = this.guiTop;
    // Tabs behind
    for (let i = 0; i < 12; i++) if (i !== this.tab) this._drawTab(gui, i, false);
    const tabTex = TABS[this.tab] === 'search' ? 'gui/container/creative_inventory/tab_item_search.png'
      : TABS[this.tab] === 'inventory' ? 'gui/container/creative_inventory/tab_inventory.png' : 'gui/container/creative_inventory/tab_items.png';
    if (this.effectsShift) drawEffects(this.game, gui, L - 124, T);
    gui.blit(tabTex, L, T, 0, 0, this.xSize, this.ySize);
    if (TABS[this.tab] !== 'inventory') {
      const sx = L + 175, sy = T + 18;
      const enabled = this.maxScrollRows() > 0;
      gui.blit('gui/container/creative_inventory/tabs.png', sx, sy + (112 - 17) * this.scroll, 232 + (enabled ? 0 : 12), 0, 12, 15);
    }
    this._drawTab(gui, this.tab, true);
    if (TABS[this.tab] !== 'inventory') gui.text(tr('itemGroup.' + TABS[this.tab]), L + 8, T + 6, 0x404040, false);
    // Grid items
    let hoverGrid = null;
    if (TABS[this.tab] !== 'inventory') {
      const start = Math.round(this.scroll * this.maxScrollRows()) * 9;
      for (let i = 0; i < 45; i++) {
        const it = this.list[start + i];
        const x = L + 9 + (i % 9) * 18, y = T + 18 + Math.floor(i / 9) * 18;
        if (it) this.game.itemRenderer.drawItem(gui, it, x, y, false);
        if (mx >= x - 1 && my >= y - 1 && mx < x + 17 && my < y + 17) { gui.rect(x, y, x + 16, y + 16, 0x80ffffff); hoverGrid = it; }
      }
    } else {
      this.game.entityRenderer.drawPlayerInGui && this.game.entityRenderer.drawPlayerInGui(gui, L + 43, T + 45, 20, L + 43 - mx, T + 45 - 30 - my);
    }
    // Player slots (hotbar / survival inv)
    gui.pushMatrix();
    gui.translate(L, T);
    this.hovered = null;
    for (const [i, x, y] of this.slotPos) {
      const it = this.container.get(i);
      if (it) this.game.itemRenderer.drawItem(gui, it, x, y);
      if (mx >= L + x - 1 && mx < L + x + 17 && my >= T + y - 1 && my < T + y + 17) { this.hovered = i; gui.rect(x, y, x + 16, y + 16, 0x80ffffff); }
    }
    if (TABS[this.tab] === 'inventory') {
      // destroy item slot
      const dx = 173, dy = 112;
      if (mx >= L + dx - 1 && mx < L + dx + 17 && my >= T + dy - 1 && my < T + dy + 17) gui.rect(dx, dy, dx + 16, dy + 16, 0x80ffffff);
    }
    gui.popMatrix();
    for (const f of this.fields) f.render(gui);
    const cursor = this.inv.cursor;
    if (cursor) this.game.itemRenderer.drawItem(gui, cursor, mx - 8, my - 8);
    else if (hoverGrid) gui.tooltip(this.game.items.tooltip(hoverGrid), mx, my);
    else if (this.hovered !== null && this.container.get(this.hovered)) gui.tooltip(this.game.items.tooltip(this.container.get(this.hovered)), mx, my);
    else {
      const t = this._tabAt(mx, my);
      if (t >= 0) gui.tooltip([tr('itemGroup.' + TABS[t])], mx, my);
      else if (TABS[this.tab] === 'inventory' && mx >= L + 172 && mx < L + 190 && my >= T + 111 && my < T + 129) gui.tooltip([tr('inventory.binSlot')], mx, my);
    }
  }

  _tabRect(i) {
    const col = i % 6, top = i < 6;
    let x = this.guiLeft + 28 * col;
    if (col === 5) x = this.guiLeft + this.xSize - 28;
    else if (col > 0) x += col;
    const y = top ? this.guiTop - 28 : this.guiTop + this.ySize - 4;
    return { x, y, top, col };
  }

  _tabAt(mx, my) {
    for (let i = 0; i < 12; i++) {
      const r = this._tabRect(i);
      if (mx >= r.x && mx < r.x + 28 && my >= r.y + (r.top ? 0 : 0) && my < r.y + 32) return i;
    }
    return -1;
  }

  _drawTab(gui, i, selected) {
    const r = this._tabRect(i);
    let v = r.top ? 0 : 64;
    if (selected) v += 32;
    gui.blit('gui/container/creative_inventory/tabs.png', r.x, r.y, r.col * 28, v, 28, 32);
    const icon = TAB_ICONS[i];
    const ix = r.x + 6, iy = r.y + (r.top ? 9 : 7) + (r.top ? 1 : -1);
    this.game.itemRenderer.drawItem(gui, { id: icon.id, damage: icon.damage || 0, count: 1 }, ix, iy, false);
  }

  wheel(d) {
    const max = this.maxScrollRows();
    if (!max) return;
    this.scroll = Math.min(1, Math.max(0, this.scroll + d / max));
  }

  mouseDown(mx, my, button, e) {
    for (const f of this.fields) f.mouseDown(mx, my, this.gui);
    const t = this._tabAt(mx, my);
    if (t >= 0 && button === 0) { if (t !== this.tab) { this.setTab(t); this.game.sound.playUi('gui.button.press', 1); } return true; }
    const L = this.guiLeft, T = this.guiTop;
    if (TABS[this.tab] !== 'inventory' && mx >= L + 175 && mx < L + 187 && my >= T + 18 && my < T + 130) { this.isScrolling = true; this._scrollTo(my); return true; }
    const g = this.game;
    const inv = this.inv;
    const btn = button === 1 ? 2 : button === 2 ? 1 : 0;
    const shift = e && e.shift;
    const grid = this.gridItemAt(mx, my);
    if (grid) {
      const it = grid.item;
      const cur = inv.cursor;
      if (btn === 2) { if (!cur && it) { const c = copy(it); c.count = g.items.maxStack(c.id); inv.cursor = c; } return true; }
      if (cur && it && cur.id === it.id && cur.damage === it.damage) {
        if (btn === 0) { if (shift) cur.count = g.items.maxStack(cur.id); else if (cur.count < g.items.maxStack(cur.id)) cur.count++; }
        else if (cur.count <= 1) inv.cursor = null;
        else cur.count--;
      } else if (it && !cur) {
        const c = copy(it);
        c.count = shift ? g.items.maxStack(c.id) : 1;
        inv.cursor = c;
      } else inv.cursor = null;
      return true;
    }
    // Destroy slot
    if (TABS[this.tab] === 'inventory' && mx >= L + 172 && mx < L + 190 && my >= T + 111 && my < T + 129) {
      if (shift) { for (let i = 0; i < 45; i++) { if (inv.get(i)) { inv.setSlot(i, null); g.send(C.creativeSlot(i, null)); } } }
      inv.cursor = null;
      return true;
    }
    const slot = this.slotAt(mx, my);
    if (slot !== null) {
      const before = [];
      for (let i = 0; i < 45; i++) before.push(inv.get(i) ? JSON.stringify([inv.get(i).id, inv.get(i).count, inv.get(i).damage]) : null);
      if (btn === 2) {
        if (!inv.cursor && inv.get(slot)) { const c = copy(inv.get(slot)); c.count = g.items.maxStack(c.id); inv.cursor = c; }
        return true;
      }
      if (shift && TABS[this.tab] !== 'inventory') {
        inv.setSlot(slot, null);
      } else {
        inv.slotClick(slot, btn, shift ? 1 : 0);
      }
      for (let i = 0; i < 45; i++) {
        const now = inv.get(i) ? JSON.stringify([inv.get(i).id, inv.get(i).count, inv.get(i).damage]) : null;
        if (now !== before[i]) g.send(C.creativeSlot(i, inv.get(i)));
      }
      return true;
    }
    if (this.isOutside(mx, my) && t < 0 && inv.cursor) {
      // Drop the cursor stack
      if (btn === 0) { g.send(C.creativeSlot(-1, inv.cursor)); inv.cursor = null; }
      else { const one = copy(inv.cursor); one.count = 1; g.send(C.creativeSlot(-1, one)); inv.cursor.count--; if (inv.cursor.count <= 0) inv.cursor = null; }
    }
    return true;
  }

  _scrollTo(my) {
    const T = this.guiTop + 18;
    this.scroll = Math.min(1, Math.max(0, (my - T - 7.5) / (112 - 15)));
  }

  mouseMove(mx, my) { if (this.isScrolling) this._scrollTo(my); }
  mouseUp() { this.isScrolling = false; }

  key(e) {
    const g = this.game;
    if (TABS[this.tab] === 'search' && e.code !== 'Escape') {
      if (this.search.key(e)) return true;
      return true;
    }
    if (e.code === 'Escape' || e.code === g.settings.keys.inventory) { this.close(); return true; }
    if (e.code === g.settings.keys.chat && TABS[this.tab] !== 'search') { this.setTab(5); return true; }
    // Number keys over grid items: put into hotbar
    const [mx, my] = g.screens._mouse();
    const grid = this.gridItemAt(mx, my);
    for (let i = 0; i < 9; i++) {
      if (e.code === g.settings.keys['hotbar' + (i + 1)]) {
        if (grid && grid.item) {
          const c = copy(grid.item); c.count = g.items.maxStack(c.id);
          this.inv.main[i] = c;
          g.send(C.creativeSlot(36 + i, c));
        } else if (this.hovered !== null) {
          const before = this.inv.get(36 + i);
          const cur = this.inv.get(this.hovered);
          this.inv.setSlot(36 + i, cur); this.inv.setSlot(this.hovered, before);
          g.send(C.creativeSlot(36 + i, cur)); g.send(C.creativeSlot(this.hovered, before));
        }
        return true;
      }
    }
    return true;
  }

  char(c) { if (TABS[this.tab] === 'search') return this.search.char(c); if (c === 't' || c === 'T') return true; return false; }

  close() {
    const g = this.game;
    if (this.inv.cursor) { g.send(C.creativeSlot(-1, this.inv.cursor)); this.inv.cursor = null; }
    g.send(C.closeWindow(0));
    g.screens.current = null;
    if (g.inWorld) g.input.lock();
  }
}

export { blocks };
