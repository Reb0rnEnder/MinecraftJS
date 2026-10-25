// Container GUIs (port of GuiContainer and subclasses, incl. GuiContainerCreative).
import { FontRenderer, stripCodes } from '../font.js';
import {drawEffectIcon} from '../effect-icons.js';
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
import {createWorkstationScreen} from './workstations.js';
import { RecipeBookGui } from '../recipebook.js';

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
    if (!this.noWorldBackground) gui.worldBackground();
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


// ---------------------------------------------------------------- recipe book (1.12)

// GuiInventory / GuiCrafting: recipe book button and panel. opts: slots [result, ...grid], gridW, gridH,
// button [x from guiLeft, y from the screen middle, u, v, texture]
function withRecipeBook(screen, opts) {
  const rb = screen.recipeBook = new RecipeBookGui(screen, { ...opts, windowId: () => (screen.container.windowId !== undefined ? screen.container.windowId : screen.container.id) || 0 });
  const base = {
    init: screen.init.bind(screen), render: screen.render.bind(screen), mouseDown: screen.mouseDown.bind(screen),
    isOutside: screen.isOutside.bind(screen), key: screen.key.bind(screen), char: screen.char.bind(screen),
    tick: screen.tick.bind(screen), handleClick: screen.handleClick.bind(screen),
  };
  const [bx, by, u, v, tex] = opts.button;
  screen.init = () => {
    base.init();
    rb.layout();
    screen.guiLeft = rb.screenLeft(screen.xSize);
    const b = new Button(10, screen.guiLeft + bx, Math.floor(screen.height / 2) + by, 20, 18, '', () => {
      rb.toggle();
      screen.guiLeft = rb.screenLeft(screen.xSize);
      b.x = screen.guiLeft + bx;
      rb.layout();
    });
    // GuiButtonImage: hovered one row (19 px) down
    b.render = (gui, mx, my) => gui.blit(tex, b.x, b.y, u, v + (b.hovered(mx, my) ? 19 : 0), 20, 18);
    screen.buttons.push(b);
  };
  screen.render = (gui, mx, my, partial) => {
    gui.worldBackground();
    screen.noWorldBackground = true;
    if (rb.visible && rb.narrow) {
      // the book covers the container
      screen.drawBackground(gui, mx, my, partial);
      rb.render(gui, mx, my, partial);
      for (const b of screen.buttons) b.render(gui, mx, my);
    } else {
      rb.render(gui, mx, my, partial);
      base.render(gui, mx, my, partial);
      rb.renderGhost(gui, screen.guiLeft, screen.guiTop);
    }
    rb.renderTooltip(gui, mx, my);
  };
  screen.mouseDown = (mx, my, button, e) => {
    if (rb.mouseDown(mx, my, button, e)) return true;
    if (rb.visible && rb.narrow) {
      for (const b of screen.buttons) if (button === 0 && b.mouseDown(mx, my, screen.game)) return true;
      return true;
    }
    return base.mouseDown(mx, my, button, e);
  };
  screen.isOutside = (mx, my) => !rb.contains(mx, my) && base.isOutside(mx, my);
  screen.key = (e) => rb.key(e) || base.key(e);
  screen.char = (c) => rb.char(c) || base.char(c);
  screen.tick = () => { base.tick(); rb.tick(); };
  screen.handleClick = (slot, slotId, button, mode) => { rb.slotClicked(slotId); base.handleClick(slot, slotId, button, mode); };
  screen.recipesUpdated = () => rb.recipesUpdated();
  return screen;
}

// ---------------------------------------------------------------- player inventory

// Slot.getSlotTexture for the armor slots and (1.9+) the off hand
function drawPlayerEmptySlot(game, gui, i, x, y) {
  const name = i >= 5 && i <= 8 ? ['empty_armor_slot_helmet', 'empty_armor_slot_chestplate', 'empty_armor_slot_leggings', 'empty_armor_slot_boots'][i - 5]
    : i === 45 ? 'empty_armor_slot_shield' : null;
  if (name && game.assets.atlas.entries.get('item/' + name)) game.itemRenderer.drawSprite(gui, 'item/' + name, x, y);
}

export class InventoryScreen extends ContainerScreen {
  constructor(game) {
    super(game, game.inventory);
    // ContainerPlayer (1.9+): result 154,28, crafting grid from 98,18
    const s = [[0, 154, 28]];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) s.push([1 + j + i * 2, 98 + j * 18, 18 + i * 18]);
    for (let k = 0; k < 4; k++) s.push([5 + k, 8, 8 + k * 18]);
    s.push(...playerInvSlots(9, 8, 84, 142));
    s.push([45, 77, 62]); // ContainerPlayer off hand
    this.slotPos = s;
    withRecipeBook(this, { slots: [0, 1, 2, 3, 4], gridW: 2, gridH: 2, button: [104, -22, 178, 0, 'gui/container/inventory.png'] });
  }

  init() {
    super.init();
    this.effectsShift = this.game.effects.size > 0 && !this.game.recipeBook.open;
    if (this.effectsShift) this.guiLeft = Math.floor(160 + (this.width - this.xSize - 200) / 2);
  }

  drawEmptySlot(gui, i, x, y) { drawPlayerEmptySlot(this.game, gui, i, x, y); }

  drawBackground(gui, mx, my) {
    gui.blit('gui/container/inventory.png', this.guiLeft, this.guiTop, 0, 0, this.xSize, this.ySize);
    this.game.entityRenderer.drawPlayerInGui && this.game.entityRenderer.drawPlayerInGui(gui, this.guiLeft + 51, this.guiTop + 75, 30, this.guiLeft + 51 - mx, this.guiTop + 75 - 50 - my);
    if (this.effectsShift) drawEffects(this.game, gui, this.guiLeft - 124, this.guiTop);
  }

  drawForeground(gui) { this.title(gui, this.game.assets.translate('container.crafting'), 97, 8); }
}

const POTION_ICON = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 8: 10, 9: 11, 10: 7, 11: 14, 12: 15, 13: 16, 14: 8, 15: 13, 16: 12, 17: 9, 18: 5, 19: 6, 20: 17, 21: 23, 22: 18 };
// Potion.getName (effect.moveSpeed, ...) by effect id, from client/data/creative.json
const effectKey = (game, id) => (game.assets.data.creative.effects[id] || { name: 'effect.none' }).name;

function drawEffects(game, gui, x, y) {
  const n = game.effects.size;
  let dy = 33;
  if (n > 5) dy = Math.floor(132 / (n - 1));
  const iconIdx = POTION_ICON;
  for (const [id, e] of game.effects) {
    gui.blit('gui/container/inventory.png', x, y, 0, 166, 140, 32);
    drawEffectIcon(game,gui,id,x+6,y+7);
    let name = game.assets.translate(effectKey(game, id)); // Potion.getName: effect.*
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
    this.titleY = opts.titleY !== undefined ? opts.titleY : 6;
    this.slotPos = [...slots, ...playerInvSlots(win.size, opts.invX || 8, opts.invY || 84, opts.hotbarY || 142)];
  }
  drawBackground(gui) { gui.blit(this.tex, this.guiLeft, this.guiTop, 0, 0, this.xSize, this.ySize); }
  drawForeground(gui) {
    const t = this.container.title;
    const x = this.titleX !== undefined ? this.titleX : this.xSize / 2 - gui.textWidth(t) / 2;
    this.title(gui, t, x, this.titleY);
    this.title(gui, this.game.assets.translate('container.inventory'), 8, this.ySize - 96 + 2);
  }
}

class FurnaceScreen extends SimpleScreen {
  constructor(game, win) { super(game, win, 'gui/container/'+({'minecraft:blast_furnace':'blast_furnace','minecraft:smoker':'smoker'}[win.type]||'furnace')+'.png', [[0, 56, 17], [1, 56, 53], [2, 116, 35]]); }
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

// GuiBrewingStand (1.9+): potion slots at y 51 / 58, ingredient, blaze powder fuel; fuel bar, brew arrow, bubbles
class BrewingScreen extends SimpleScreen {
  constructor(game, win) { super(game, win, 'gui/container/brewing_stand.png', [[0, 56, 51], [1, 79, 58], [2, 102, 51], [3, 79, 17], [4, 17, 17]]); }
  drawBackground(gui) {
    super.drawBackground(gui);
    const p = this.container.properties;
    const fuel = p[1] || 0;
    const w = Math.min(18, Math.max(0, Math.trunc((18 * fuel + 20 - 1) / 20)));
    if (w > 0) gui.blit(this.tex, this.guiLeft + 60, this.guiTop + 44, 176, 29, w, 4);
    const t = p[0] || 0;
    if (t > 0) {
      const j1 = Math.trunc(28 * (1 - t / 400));
      if (j1 > 0) gui.blit(this.tex, this.guiLeft + 97, this.guiTop + 16, 176, 0, 9, j1);
      const b = [29, 24, 20, 16, 11, 6, 0][Math.trunc(t / 2) % 7]; // BUBBLELENGTHS
      if (b > 0) gui.blit(this.tex, this.guiLeft + 63, this.guiTop + 14 + 29 - b, 185, 29 - b, 12, b);
    }
  }
}

// EnchantmentNameParts: the clue words, 3 - 4 of them wrapped to two lines in the Standard Galactic font
const NAME_PARTS = 'the elder scrolls klaatu berata niktu xyzzy bless curse light darkness fire air earth water hot dry cold wet ignite snuff embiggen twist shorten stretch fiddle destroy imbue galvanize enchant free limited range of towards inside sphere cube self other ball mental physical grow shrink demon elemental spirit animal creature beast humanoid undead fresh stale phnglui mglwnafh cthulhu rlyeh wgahnagl fhtagnbaguette'.split(' ');

// GuiEnchantment
class EnchantScreen extends SimpleScreen {
  constructor(game, win) {
    // GuiEnchantment.drawGuiContainerForegroundLayer: the name at (12, 5)
    super(game, win, 'gui/container/enchanting_table.png', [[0, 15, 47], [1, 35, 47]], { titleX: 12, titleY: 5 });
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
      const cost = p[l] || 0;
      if (cost === 0) { gui.blit(this.tex, x, y, 0, 185, 108, 19); continue; }
      const s = '' + cost;
      const w = 86 - gui.textWidth(s);
      const n = rand.nextInt(2) + 3;
      const words = [];
      for (let i = 0; i < n; i++) words.push(NAME_PARTS[rand.nextInt(NAME_PARTS.length)]);
      const clue = sga.wrap(words.join(' '), w).slice(0, 2).join(' ');
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

  // GuiEnchantment.drawScreen: the clue tooltip with the lapis / level requirements
  drawOverlay(gui, mx, my) {
    const g = this.game, p = this.container.properties;
    const lapis = this.container.get(1), lapisCount = lapis ? lapis.count : 0;
    for (let i = 0; i < 3; i++) {
      const lvl = p[i] || 0, ench = p[4 + i], clue = p[7 + i];
      const x = this.guiLeft + 60, y = this.guiTop + 14 + 19 * i;
      if (!(mx >= x - 1 && mx < x + 108 + 1 && my >= y - 1 && my < y + 17 + 1) || lvl <= 0 || clue === undefined || clue < 0 || ench === undefined || ench < 0) continue;
      const lines = ['§f§o' + tr('container.enchant.clue', g.items.enchantmentName(ench, clue))];
      if (!g.player.creative) {
        lines.push('');
        const k = i + 1;
        if (g.xpLevel < lvl) lines.push('§c' + tr('container.enchant.level.requirement', lvl));
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
        // ContainerEnchantment.enchantItem on the client: an item, l + 1 lapis and enough levels (creative: neither)
        const g = this.game, p = this.container.properties, cost = p[l] || 0;
        const item = this.container.get(0), lapis = this.container.get(1), creative = g.player.creative, k = l + 1;
        if (!creative && (!lapis || lapis.count < k)) return true;
        if (!(cost > 0 && item && (creative || (g.xpLevel >= k && g.xpLevel >= cost)))) return true;
        g.send(C.enchantItem(this.container.windowId, l));
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
      this.game.send(C.nameItem(t));
    };
    this.fields.push(this.nameField);
    this._lastFirst = null;
  }
  tick() {
    super.tick();
    const first = this.container.get(0);
    const name = first ? stripCodes(this.game.items.displayName(first)) : '';
    const key = first ? first.id + ':' + name : null;
    if (key !== this._lastFirst) {
      this._lastFirst = key;
      this.nameField.text = name;
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
        drawEffectIcon(this.game,gui,b.effect,b.x+2,b.y+2);
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
        text = this.game.assets.translate(effectKey(this.game, b.effect));
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
      this.game.sound.playUi('ui.button.click', 1);
      if (b.cancel) { this.close(); return true; }
      if (b.confirm) {
        this.game.send(C.setBeaconEffects(this.field(1),this.field(2)));
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
  const native=createWorkstationScreen(game,win,SimpleScreen,ContainerScreen);
  if(native){game.screens.open(native);return;}
  let s;
  const P = (x, y) => [x, y];
  void P;
  switch (t) {
    case 'minecraft:chest': case 'minecraft:container': s = new ChestScreen(game, win); break;
    case 'minecraft:crafting_table': {
      const slots = [[0, 124, 35]];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) slots.push([1 + j + i * 3, 30 + j * 18, 17 + i * 18]);
      s = new SimpleScreen(game, win, 'gui/container/crafting_table.png', slots, { titleX: 28 });
      withRecipeBook(s, { slots: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], gridW: 3, gridH: 3, button: [5, -49, 0, 168, 'gui/container/crafting_table.png'] });
      if (!win.title) win.title = game.assets.translate('container.crafting');
      break;
    }
    case 'minecraft:blast_furnace': case 'minecraft:smoker': case 'minecraft:furnace': s = new FurnaceScreen(game, win); break;
    case 'minecraft:dispenser': case 'minecraft:dropper': {
      const slots = [];
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) slots.push([j + i * 3, 62 + j * 18, 17 + i * 18]);
      s = new SimpleScreen(game, win, 'gui/container/dispenser.png', slots);
      break;
    }
    case 'minecraft:shulker_box': {
      const slots=[];for(let i=0;i<27;i++)slots.push([i,8+i%9*18,18+Math.floor(i/9)*18]);
      s=new SimpleScreen(game,win,'gui/container/shulker_box.png',slots,{titleX:8});break;
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
    case 'EntityHorse': s = new HorseScreen(game, win); break;
    default: s = new ChestScreen(game, win); break;
  }
  game.screens.open(s);
}

// ---------------------------------------------------------------- creative inventory

// Native Java 1.14.4 creative tabs, extracted from the pinned client jar by tools/creative-dump.
// The middle tuple field is retained for the data format only; flattened variants have distinct IDs.
const stackOf = ([id, , tag]) => ({ id, count: 1, damage: 0, nbt: tag ? { t: 10, name: '', v: structuredClone(tag) } : null });
// Creative templates/snapshots must never share mutable NBT with player stacks. Prefer
// the structured tag over an older raw buffer when a caller has changed NBT in place.
const creativeCopy = (it) => it ? { id: it.id, count: it.count, damage: 0,
  nbt: it.nbt ? structuredClone(it.nbt) : null, nbtRaw: !it.nbt && it.nbtRaw ? it.nbtRaw.slice() : null } : null;
const creativeLocked = (it) => !!(it && (it.locked || it.nbt?.v?.CustomCreativeLock));
const sendCreativeSlot = (game, slot, it) => game.send(C.creativeSlot(slot, creativeCopy(it)));
const tabData = (game) => game.assets.data.creative.tabs;
const tabInfo = (game, i) => tabData(game).find((t) => t.index === i);
const label = (game, i) => (tabInfo(game, i) || {}).label;

// Scope caches to the actual dataset, not a process-wide CreativeScreen static. A new
// asset set (or replacement tabs array) cannot inherit another world's catalog/categories.
const creativeCatalogs = new WeakMap();
function creativeCatalog(game) {
  const data = game.assets.data.creative;
  let catalog = creativeCatalogs.get(data);
  if (!catalog || catalog.source !== data.tabs) {
    const tabs = {}, tabOfId = new Map(), enchantmentTabs = new Map();
    for (const t of data.tabs) {
      tabs[t.label] = t.items.map(stackOf);
      if (['search', 'hotbar', 'inventory'].includes(t.label)) continue;
      for (const it of tabs[t.label]) {
        if (!tabOfId.has(it.id)) tabOfId.set(it.id, t.label);
        for (const e of it.nbt?.v?.StoredEnchantments?.v?.items || []) {
          if (!enchantmentTabs.has(e.id.v)) enchantmentTabs.set(e.id.v, t.label);
        }
      }
    }
    catalog = { source: data.tabs, tabs, tabOfId, enchantmentTabs };
    creativeCatalogs.set(data, catalog);
  }
  return catalog;
}

// HotbarSnapshot storage (CreativeSettings, hotbar.nbt): nine saved toolbars, kept in the browser
// Never read/write the unversioned 1.12 key: its numeric IDs cannot be safely reinterpreted.
const HOTBARS_KEY = 'minecraftjs.hotbars.1.14.4.v1';
const toJson = (v) => JSON.stringify(v, (k, x) => (ArrayBuffer.isView(x) ? { $ta: x.constructor.name, a: Array.from(x, (n) => (typeof n === 'bigint' ? String(n) : n)) } : typeof x === 'bigint' ? { $big: String(x) } : x));
const savedArrays = { Int8Array, Uint8Array, Int32Array, BigInt64Array };
const fromJson = (s) => JSON.parse(s, (k, x) => {
  if (x && x.$ta) {
    if (!Object.prototype.hasOwnProperty.call(savedArrays, x.$ta) || !Array.isArray(x.a)) throw new Error('Invalid saved NBT array');
    return x.$ta === 'BigInt64Array' ? BigInt64Array.from(x.a.map(BigInt)) : new savedArrays[x.$ta](x.a);
  }
  return x && x.$big !== undefined ? BigInt(x.$big) : x;
});
const emptyHotbars = () => Array.from({ length: 9 }, () => new Array(9).fill(null));
export function hotbarSnapshots() {
  try {
    const saved = fromJson(localStorage.getItem(HOTBARS_KEY) || 'null');
    if (saved?.version !== 1 || saved.minecraftVersion !== '1.14.4' || saved.protocol !== 498 || saved.dataVersion !== 1976) return emptyHotbars();
    if (!Array.isArray(saved.bars) || saved.bars.length !== 9) return emptyHotbars();
    return saved.bars.map(bar => {
      if (!Array.isArray(bar) || bar.length !== 9) return new Array(9).fill(null);
      return bar.map(it => {
        if (!it || !Number.isInteger(it.id) || it.id < 1 || it.id > 876 || !Number.isInteger(it.count) || it.count < 1 || it.count > 127 || creativeLocked(it)) return null;
        const copied = creativeCopy(it);
        // Check that persisted typed NBT is serializable before it reaches a live click.
        new Writer().slot(copied).build();
        return copied;
      });
    });
  } catch (e) { return emptyHotbars(); }
}
function saveHotbarSnapshots(list) {
  try {
    localStorage.setItem(HOTBARS_KEY, toJson({ version: 1, minecraftVersion: '1.14.4', protocol: 498, dataVersion: 1976, bars: list }));
    return true;
  } catch (e) { return false; /* storage unavailable */ }
}

// GuiContainerCreative.handleHotbarSnapshots: load (X + number) or save (C + number) a toolbar in creative mode
export function handleHotbarSnapshots(game, n, load, save) {
  if (!Number.isInteger(n) || n < 0 || n >= 9) return;
  const list = hotbarSnapshots();
  if (load) {
    for (let i = 0; i < 9; i++) {
      const it = creativeCopy(list[n][i]);
      game.inventory.setSlot(36 + i, it);
      sendCreativeSlot(game, 36 + i, it);
    }
  } else if (save) {
    for (let i = 0; i < 9; i++) list[n][i] = creativeLocked(game.inventory.main[i]) ? null : creativeCopy(game.inventory.main[i]);
    if (!saveHotbarSnapshots(list)) return;
    const k = game.settings.keys;
    game.hud.setActionBar(tr('inventory.hotbarSaved', game.settings.keyName(k['hotbar' + (n + 1)]), game.settings.keyName(k.loadToolbarActivator)));
  }
  const screen = game.screens?.current;
  if (screen instanceof CreativeScreen && screen.tabLabel() === 'hotbar') screen.setTab(screen.tab);
}

// Creative tab of an item id (first tab that lists it), e.g. for the recipe book's categories
export function creativeTabOf(game, id) {
  return creativeCatalog(game).tabOfId.get(id) || 'misc';
}

export class CreativeScreen extends ContainerScreen {
  constructor(game) {
    super(game, game.inventory);
    this.xSize = 195; this.ySize = 136;
    this.tab = tabInfo(game, CreativeScreen.lastTab) ? CreativeScreen.lastTab : 0;
    this.scroll = 0;
    this.catalog = creativeCatalog(game);
    this.language = game.assets.lang;
    this.list = [];
    this.isScrolling = false;
  }

  init() {
    super.init();
    // InventoryEffectRenderer: with active effects the window moves right to make room for the list
    this.effectsShift = this.game.effects.size > 0;
    if (this.effectsShift) this.guiLeft = Math.floor(160 + (this.width - this.xSize - 200) / 2);
    this.search = new TextField(this.guiLeft + 82, this.guiTop + 6, 80, 9, { maxLength: 50, background: false, focused: false, onChange: () => this.filter() });
    this.search.textColor = 0xffffff;
    this.setTab(this.tab);
  }

  tick() {
    super.tick();
    this._refreshCatalog();
  }

  _refreshCatalog() {
    if (this.catalog === creativeCatalog(this.game) && this.language === this.game.assets.lang) return;
    const query = this.search.text;
    this.language = this.game.assets.lang;
    this.setTab(this.tab);
    if (this.tabLabel() === 'search') this.search.setText(query);
  }

  tabLabel(i = this.tab) { return label(this.game, i); }

  // GuiContainerCreative.setCurrentCreativeTab
  setTab(i) {
    if (!tabInfo(this.game, i)) i = 0;
    this.catalog = creativeCatalog(this.game);
    this.tab = i;
    CreativeScreen.lastTab = i;
    this.scroll = 0;
    this.isScrolling = false;
    this.hovered = null;
    this.fields = [];
    this.search.focused = false;
    const lab = this.tabLabel(i);
    if (lab === 'search') { this.fields.push(this.search); this.search.focused = true; this.search.setText(''); }
    else if (lab === 'hotbar') {
      // saved toolbars; an empty one shows a locked paper on its own column saying how to save it
      const g = this.game, k = g.settings.keys;
      this.list = [];
      hotbarSnapshots().forEach((bar, n) => {
        if (bar.every((it) => !it)) {
          for (let j = 0; j < 9; j++) {
            if (j !== n) { this.list.push(null); continue; }
            const name = JSON.stringify({ translate: 'inventory.hotbarInfo', with: [g.settings.keyName(k['hotbar' + (n + 1)]), g.settings.keyName(k.saveToolbarActivator)] });
            this.list.push({ id: g.items.byName.get('paper').id, count: 1, damage: 0, locked: true,
              nbt: { t: 10, name: '', v: { CustomCreativeLock: { t: 10, v: {} }, display: { t: 10, v: { Name: { t: 8, v: name } } } } } });
          }
        } else for (const it of bar) this.list.push(creativeCopy(it));
      });
    } else this.list = this.catalog.tabs[lab] || [];
    this._layout();
  }

  // GuiContainerCreative.updateCreativeSearch: SearchTreeManager.ITEMS matches the tooltip lines or the registry name
  filter() {
    const q = this.search.text.toLowerCase().trim();
    const all = creativeCatalog(this.game).tabs.search;
    const items = this.game.items;
    const hit = (it) => {
      if(q.startsWith('#')) {
        const term=q.slice(1),colon=term.indexOf(':');
        return this.game.tags.forEntry('items',it.id).some(tag=>colon<0?tag.split(':')[1].includes(term):tag.split(':')[0].includes(term.slice(0,colon))&&tag.split(':')[1].includes(term.slice(colon+1)));
      }
      const def = items.def(it.id);
      const colon = q.indexOf(':');
      const term = colon < 0 ? q : q.slice(colon + 1).trim();
      if (colon >= 0 && !'minecraft'.includes(q.slice(0, colon).trim())) return false;
      if (def && def.name.includes(term)) return true;
      return items.tooltip(it).some((l) => stripCodes(l).toLowerCase().includes(term));
    };
    this.list = q ? all.filter(hit) : all;
    this.scroll = 0;
    this._layout();
  }

  _layout() {
    const inv = this.tabLabel() === 'inventory';
    this.slotPos = [];
    if (inv) {
      // GuiContainerCreative survival tab (1.9+): armor 2x2 around the player, off hand at 35,20
      for (let k = 0; k < 4; k++) this.slotPos.push([5 + k, 54 + Math.floor(k / 2) * 54, 6 + (k % 2) * 27]);
      this.slotPos.push([45, 35, 20]);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 9; j++) this.slotPos.push([9 + j + i * 9, 9 + j * 18, 54 + i * 18]);
      for (let j = 0; j < 9; j++) this.slotPos.push([36 + j, 9 + j * 18, 112]);
    } else {
      for (let j = 0; j < 9; j++) this.slotPos.push([36 + j, 9 + j * 18, 112]);
    }
  }

  maxScrollRows() { return Math.max(0, Math.ceil(this.list.length / 9) - 5); }

  gridItemAt(mx, my) {
    if (this.tabLabel() === 'inventory') return null;
    const x = mx - this.guiLeft - 9, y = my - this.guiTop - 18;
    if (x < 0 || y < 0 || x >= 9 * 18 || y >= 5 * 18) return null;
    const col = Math.floor(x / 18), row = Math.floor(y / 18);
    const idx = (row + Math.round(this.scroll * this.maxScrollRows())) * 9 + col;
    return { idx, item: this.list[idx] || null, x: 9 + col * 18, y: 18 + row * 18 };
  }

  render(gui, mx, my, partial) {
    this._refreshCatalog();
    gui.worldBackground();
    const L = this.guiLeft, T = this.guiTop;
    // Tabs behind
    const info = tabInfo(this.game, this.tab);
    for (const t of tabData(this.game)) if (t.index !== this.tab) this._drawTab(gui, t, false);
    const tabTex = 'gui/container/creative_inventory/tab_' + info.background; // CreativeTabs.getBackgroundImageName
    if (this.effectsShift) drawEffects(this.game, gui, L - 124, T);
    gui.blit(tabTex, L, T, 0, 0, this.xSize, this.ySize);
    if (info.scrollbar) {
      const sx = L + 175, sy = T + 18;
      const enabled = this.maxScrollRows() > 0;
      gui.blit('gui/container/creative_inventory/tabs.png', sx, sy + (112 - 17) * this.scroll, 232 + (enabled ? 0 : 12), 0, 12, 15);
    }
    this._drawTab(gui, info, true);
    if (info.title) gui.text(tr('itemGroup.' + info.label), L + 8, T + 6, 0x404040, false);
    // Grid items
    let hoverGrid = null;
    if (this.tabLabel() !== 'inventory') {
      const start = Math.round(this.scroll * this.maxScrollRows()) * 9;
      for (let i = 0; i < 45; i++) {
        const it = this.list[start + i];
        const x = L + 9 + (i % 9) * 18, y = T + 18 + Math.floor(i / 9) * 18;
        if (it) this.game.itemRenderer.drawItem(gui, it, x, y, false);
        if (mx >= x - 1 && my >= y - 1 && mx < x + 17 && my < y + 17) { gui.rect(x, y, x + 16, y + 16, 0x80ffffff); hoverGrid = it; }
      }
    } else {
      this.game.entityRenderer.drawPlayerInGui && this.game.entityRenderer.drawPlayerInGui(gui, L + 88, T + 45, 20, L + 88 - mx, T + 45 - 30 - my);
    }
    // Player slots (hotbar / survival inv)
    gui.pushMatrix();
    gui.translate(L, T);
    this.hovered = null;
    for (const [i, x, y] of this.slotPos) {
      const it = this.container.get(i);
      if (it) this.game.itemRenderer.drawItem(gui, it, x, y);
      else if (this.tabLabel() === 'inventory') drawPlayerEmptySlot(this.game, gui, i, x, y);
      if (mx >= L + x - 1 && mx < L + x + 17 && my >= T + y - 1 && my < T + y + 17) { this.hovered = i; gui.rect(x, y, x + 16, y + 16, 0x80ffffff); }
    }
    if (this.tabLabel() === 'inventory') {
      // destroy item slot
      const dx = 173, dy = 112;
      if (mx >= L + dx - 1 && mx < L + dx + 17 && my >= T + dy - 1 && my < T + dy + 17) gui.rect(dx, dy, dx + 16, dy + 16, 0x80ffffff);
    }
    gui.popMatrix();
    for (const f of this.fields) f.render(gui);
    const cursor = this.inv.cursor;
    if (cursor) this.game.itemRenderer.drawItem(gui, cursor, mx - 8, my - 8);
    else if (hoverGrid) gui.tooltip(this._tooltip(hoverGrid), mx, my);
    else if (this.hovered !== null && this.container.get(this.hovered)) gui.tooltip(this._tooltip(this.container.get(this.hovered)), mx, my);
    else {
      const t = this._tabAt(mx, my);
      if (t >= 0) gui.tooltip([tr('itemGroup.' + this.tabLabel(t))], mx, my);
      else if (this.tabLabel() === 'inventory' && mx >= L + 172 && mx < L + 190 && my >= T + 111 && my < T + 129) gui.tooltip([tr('inventory.binSlot')], mx, my);
    }
  }

  _tooltip(it) {
    const items = this.game.items, lines = items.tooltip(it, this.game.settings.advancedItemTooltips);
    if (this.tabLabel() === 'search') {
      let group = this.catalog.tabOfId.get(it.id);
      if (items.name(it.id) === 'enchanted_book') {
        const ench = items.enchantments(it);
        group = ench.length === 1 ? this.catalog.enchantmentTabs.get(ench[0].id) : null;
      }
      if (group) lines.splice(1, 0, '§9' + tr('itemGroup.' + group));
      if(this.search.text.startsWith('#'))for(const tag of this.game.tags.forEntry('items',it.id))lines.splice(1,0,'§5#'+tag);
    }
    return lines;
  }

  // GuiContainerCreative.drawTab / isMouseOverTab: columns 28 apart (+1 per column), right-aligned tabs from the
  // right edge; top row above the window, bottom row below it
  _tabRect(t) {
    const col = t.column;
    let x = this.guiLeft + 28 * col;
    if (t.right) x = this.guiLeft + this.xSize - 28 * (6 - col);
    else if (col > 0) x += col;
    const y = t.top ? this.guiTop - 28 : this.guiTop + this.ySize - 4;
    return { x, y, top: t.top, col };
  }

  _tabAt(mx, my) {
    for (const t of tabData(this.game)) {
      // isMouseOverTab: x from 28 * column (+ column, or + 2 when right-aligned), y 32 above / at ySize
      let x = 28 * t.column;
      if (t.right) x = this.xSize - 28 * (6 - t.column) + 2;
      else if (t.column > 0) x += t.column;
      const y = t.top ? -32 : this.ySize;
      const rx = mx - this.guiLeft, ry = my - this.guiTop;
      if (rx >= x && rx <= x + 28 && ry >= y && ry <= y + 32) return t.index;
    }
    return -1;
  }

  _drawTab(gui, t, selected) {
    const r = this._tabRect(t);
    let v = r.top ? 0 : 64;
    if (selected) v += 32;
    gui.blit('gui/container/creative_inventory/tabs.png', r.x, r.y, r.col * 28, v, 28, 32);
    const ix = r.x + 6, iy = r.y + 8 + (r.top ? 1 : -1);
    this.game.itemRenderer.drawItem(gui, stackOf(t.icon), ix, iy, false);
  }

  wheel(d) {
    const max = this.maxScrollRows();
    if (!max) return;
    this.scroll = Math.min(1, Math.max(0, this.scroll + d / max));
  }

  mouseDown(mx, my, button, e) {
    this._refreshCatalog();
    for (const f of this.fields) f.mouseDown(mx, my, this.gui);
    if (this.tabLabel() === 'search') this.search.focused = true;
    const t = this._tabAt(mx, my);
    if (t >= 0 && button === 0) { if (t !== this.tab) { this.setTab(t); this.game.sound.playUi('ui.button.click', 1); } return true; }
    const L = this.guiLeft, T = this.guiTop;
    if (tabInfo(this.game, this.tab).scrollbar && mx >= L + 175 && mx < L + 187 && my >= T + 18 && my < T + 130) { this.isScrolling = true; this._scrollTo(my); return true; }
    const g = this.game;
    const inv = this.inv;
    const btn = button === 1 ? 2 : button === 2 ? 1 : 0;
    const shift = e && e.shift;
    const grid = this.gridItemAt(mx, my);
    if (grid) {
      const it = grid.item;
      // a locked item (the empty saved toolbar's hint) cannot be taken (CustomCreativeLock)
      if (creativeLocked(it)) return true;
      const cur = inv.cursor;
      if (btn === 2) { if (!cur && it) { const c = creativeCopy(it); c.count = g.items.maxStack(c.id); inv.cursor = c; } return true; }
      if (cur && it && stackable(cur, it)) {
        if (btn === 0) { if (shift) cur.count = g.items.maxStack(cur.id); else if (cur.count < g.items.maxStack(cur.id)) cur.count++; }
        else if (cur.count <= 1) inv.cursor = null;
        else cur.count--;
      } else if (it && !cur) {
        const c = creativeCopy(it);
        c.count = shift ? g.items.maxStack(c.id) : 1;
        inv.cursor = c;
      } else if (btn === 0 || !cur || cur.count <= 1) inv.cursor = null;
      else cur.count--;
      return true;
    }
    // Destroy slot
    if (this.tabLabel() === 'inventory' && mx >= L + 172 && mx < L + 190 && my >= T + 111 && my < T + 129) {
      if (shift) { for (let i = 0; i < inv.slots.length; i++) { if (inv.get(i)) { inv.setSlot(i, null); sendCreativeSlot(g, i, null); } } }
      inv.cursor = null;
      return true;
    }
    const slot = this.slotAt(mx, my);
    if (slot !== null) {
      const before = inv.slots.map((_, i) => creativeCopy(inv.get(i)));
      if (btn === 2) {
        if (!inv.cursor && inv.get(slot)) { const c = creativeCopy(inv.get(slot)); c.count = g.items.maxStack(c.id); inv.cursor = c; }
        return true;
      }
      if (shift && this.tabLabel() !== 'inventory') {
        inv.setSlot(slot, null);
      } else {
        inv.slotClick(slot, btn, shift ? 1 : 0);
      }
      inv.cursor = creativeCopy(inv.cursor);
      for (let i = 0; i < inv.slots.length; i++) {
        const now = inv.get(i), old = before[i];
        if ((!now && !old) || now && old && now.count === old.count && stackable(now, old)) continue;
        inv.setSlot(i, creativeCopy(now));
        sendCreativeSlot(g, i, inv.get(i));
      }
      return true;
    }
    if (this.isOutside(mx, my) && t < 0 && inv.cursor) {
      // Drop the cursor stack
      if (btn === 0) { sendCreativeSlot(g, -1, inv.cursor); inv.cursor = null; }
      else { const one = creativeCopy(inv.cursor); one.count = 1; sendCreativeSlot(g, -1, one); inv.cursor.count--; if (inv.cursor.count <= 0) inv.cursor = null; }
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
    this._refreshCatalog();
    const g = this.game;
    this.ignoreNextChar = false;
    if (e.code === 'Escape') { this.close(); return true; }
    // Number keys over grid items: put into hotbar
    const [mx, my] = g.screens._mouse();
    const grid = this.gridItemAt(mx, my);
    const slot = this.slotAt(mx, my);
    for (let i = 0; i < 9; i++) {
      if (e.code === g.settings.keys['hotbar' + (i + 1)] && (grid?.item || slot !== null)) {
        this.ignoreNextChar = true;
        if (grid && grid.item && !creativeLocked(grid.item)) {
          const c = creativeCopy(grid.item); c.count = g.items.maxStack(c.id);
          this.inv.setSlot(36 + i, c);
          sendCreativeSlot(g, 36 + i, c);
        } else if (!grid && slot !== null && slot !== 36 + i) {
          const before = creativeCopy(this.inv.get(36 + i));
          const cur = creativeCopy(this.inv.get(slot));
          if (!before || this.inv.isValid(slot, before) && before.count <= this.inv.slotLimit(slot, before)) {
            this.inv.setSlot(36 + i, cur); this.inv.setSlot(slot, before);
            sendCreativeSlot(g, 36 + i, cur); sendCreativeSlot(g, slot, before);
          }
        }
        return true;
      }
    }
    if (this.tabLabel() === 'search' && this.search.focused) { this.search.key(e); return true; }
    if (e.code === g.settings.keys.inventory) { this.close(); return true; }
    if (e.code === g.settings.keys.chat && this.tabLabel() !== 'search') { this.setTab(5); this.ignoreNextChar = true; return true; }
    return true;
  }

  char(c) {
    if (this.ignoreNextChar) { this.ignoreNextChar = false; return true; }
    if (this.tabLabel() === 'search') return this.search.char(c);
    return false;
  }

  close() {
    const g = this.game;
    if (this.inv.cursor) { sendCreativeSlot(g, -1, this.inv.cursor); this.inv.cursor = null; }
    g.send(C.closeWindow(0));
    g.screens.current = null;
    if (g.inWorld) g.input.lock();
  }
}

export { blocks };
