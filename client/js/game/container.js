// Inventory/container model with a faithful port of vanilla Container.slotClick and
// per-container transferStackInSlot (1.8 servers don't echo accepted clicks back).
import { C } from '../net/packets.js';
import { craftResult, containerItem } from './crafting.js';

export const copy = (it) => (it ? { id: it.id, count: it.count, damage: it.damage, nbt: it.nbt, nbtRaw: it.nbtRaw } : null);

function sameItem(a, b) {
  return !!a && !!b && a.id === b.id && a.damage === b.damage;
}
function tagsEqual(a, b) {
  const ra = a && a.nbtRaw, rb = b && b.nbtRaw;
  if (!ra && !rb) return true;
  if (!ra || !rb || ra.length !== rb.length) return false;
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return false;
  return true;
}
export function stackable(a, b) { return sameItem(a, b) && tagsEqual(a, b); }

const ARMOR = {
  helmet: new Set([298, 302, 306, 310, 314]),
  chest: new Set([299, 303, 307, 311, 315]),
  legs: new Set([300, 304, 308, 312, 316]),
  boots: new Set([301, 305, 309, 313, 317]),
};
export function armorType(item) {
  if (!item) return -1;
  if (ARMOR.helmet.has(item.id)) return 0;
  if (ARMOR.chest.has(item.id)) return 1;
  if (ARMOR.legs.has(item.id)) return 2;
  if (ARMOR.boots.has(item.id)) return 3;
  return -1;
}

const SMELTABLE = new Set([15, 14, 12, 4, 17, 162, 81, 337, 87, 82, 98, 319, 363, 365, 349, 423, 411, 392, 16, 73, 74, 21, 56, 129, 153, 19, 24]);
const FUEL = new Set([5, 6, 17, 162, 47, 53, 54, 58, 65, 72, 84, 85, 96, 107, 126, 134, 135, 136, 143, 146, 151, 163, 164, 173, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192,
  263, 268, 269, 270, 271, 290, 280, 327, 369, 346, 281, 323, 324, 333, 427, 428, 429, 430, 431, 425, 25]);
const BREWING_INGREDIENTS = new Set([372, 348, 331, 289, 376, 353, 370, 382, 377, 378, 396, 375, 349, 414]);
const BEACON_PAYMENT = new Set([388, 264, 266, 265]);

// Base container: slots with rules; also used for the player inventory (window 0)
class ContainerBase {
  constructor(game) {
    this.game = game;
    this.slots = [];
    this.properties = {};
    this.dragEvent = 0;
    this.dragMode = -1;
    this.dragSlots = new Set();
  }

  get items() { return this.game.items; }
  get inv() { return this.game.inventory; }

  maxStack(item) { return item ? this.items.maxStack(item.id) : 64; }

  slotLimit(i, item) {
    const s = this.slots[i];
    let lim = s.limit !== undefined ? s.limit : 64;
    if (item) lim = Math.min(lim, 64);
    return lim;
  }

  isValid(i, item) {
    const s = this.slots[i];
    return s.valid ? s.valid(item) : true;
  }

  canTake(i) { const s = this.slots[i]; return s.canTake ? s.canTake() : true; }

  get(i) { return this.slots[i] ? this.slots[i].item : null; }

  put(i, item) {
    if (!this.slots[i]) return;
    this.slots[i].item = item && item.count > 0 ? item : null;
    this.onSlotChanged(i);
  }

  decr(i, n) {
    const it = this.get(i);
    if (!it) return null;
    if (it.count <= n) { this.put(i, null); return it; }
    const out = copy(it);
    out.count = n;
    it.count -= n;
    this.onSlotChanged(i);
    return out;
  }

  onSlotChanged(i) { /* overridden for crafting */ }
  onPickupFromSlot(i, taken) { /* overridden for crafting */ }
  canMergeSlot(i) { return !this.slots[i].output; }
  canDragIntoSlot(i) { return !this.slots[i].output; }

  mergeItemStack(stack, start, end, reverse) {
    let flag = false;
    let i = reverse ? end - 1 : start;
    const max = this.maxStack(stack);
    if (max > 1) {
      while (stack.count > 0 && (!reverse && i < end || reverse && i >= start)) {
        const it = this.get(i);
        if (it && stackable(it, stack)) {
          const j = it.count + stack.count;
          if (j <= max) { stack.count = 0; it.count = j; this.onSlotChanged(i); flag = true; }
          else if (it.count < max) { stack.count -= max - it.count; it.count = max; this.onSlotChanged(i); flag = true; }
        }
        i += reverse ? -1 : 1;
      }
    }
    if (stack.count > 0) {
      i = reverse ? end - 1 : start;
      while (!reverse && i < end || reverse && i >= start) {
        if (!this.get(i)) { this.put(i, copy(stack)); stack.count = 0; flag = true; break; }
        i += reverse ? -1 : 1;
      }
    }
    return flag;
  }

  transferStackInSlot(i) { return null; }

  // Generic transfer helper: run a merge plan, then do vanilla bookkeeping
  _transfer(i, plan) {
    const it = this.get(i);
    if (!it) return null;
    const original = copy(it);
    const ok = plan(it);
    if (ok === false) return null;
    if (it.count === 0) this.put(i, null); else this.onSlotChanged(i);
    if (it.count === original.count) return null;
    this.onPickupFromSlot(i, it);
    return original;
  }

  // Returns the "clicked item" vanilla would return
  slotClick(slotId, button, mode) {
    const inv = this.inv;
    let result = null;
    if (mode === 5) {
      const prev = this.dragEvent;
      this.dragEvent = button & 3;
      if ((prev !== 1 || this.dragEvent !== 2) && prev !== this.dragEvent) this._resetDrag();
      else if (!inv.cursor) this._resetDrag();
      else if (this.dragEvent === 0) {
        this.dragMode = (button >> 2) & 3;
        if (this.dragMode === 0 || this.dragMode === 1 || (this.dragMode === 2 && this.game.player.creative)) { this.dragEvent = 1; this.dragSlots.clear(); }
        else this._resetDrag();
      } else if (this.dragEvent === 1) {
        const c = inv.cursor;
        if (slotId >= 0 && this.slots[slotId] && this._canAdd(slotId, c, true) && this.isValid(slotId, c) && c.count > this.dragSlots.size && this.canDragIntoSlot(slotId)) {
          this.dragSlots.add(slotId);
        }
      } else if (this.dragEvent === 2) {
        if (this.dragSlots.size) {
          const c = inv.cursor;
          const base = copy(c);
          let remaining = c.count;
          for (const s of this.dragSlots) {
            if (this._canAdd(s, c, true) && this.isValid(s, c) && c.count >= this.dragSlots.size && this.canDragIntoSlot(s)) {
              const st = copy(base);
              const k = this.get(s) ? this.get(s).count : 0;
              if (this.dragMode === 0) st.count = Math.floor(st.count / this.dragSlots.size);
              else if (this.dragMode === 1) st.count = 1;
              else st.count = this.maxStack(st);
              st.count += k;
              if (st.count > this.maxStack(st)) st.count = this.maxStack(st);
              if (st.count > this.slotLimit(s, st)) st.count = this.slotLimit(s, st);
              remaining -= st.count - k;
              this.put(s, st);
            }
          }
          base.count = remaining;
          inv.cursor = remaining > 0 ? base : null;
        }
        this._resetDrag();
      } else this._resetDrag();
      return null;
    }
    if (this.dragEvent !== 0) { this._resetDrag(); return null; }

    if ((mode === 0 || mode === 1) && (button === 0 || button === 1)) {
      if (slotId === -999) {
        if (inv.cursor) {
          if (button === 0) inv.cursor = null;
          else { inv.cursor.count--; if (inv.cursor.count <= 0) inv.cursor = null; }
        }
      } else if (mode === 1) {
        if (slotId < 0) return null;
        if (this.slots[slotId] && this.canTake(slotId)) {
          const moved = this.transferStackInSlot(slotId);
          if (moved) {
            result = copy(moved);
            const now = this.get(slotId);
            if (now && now.id === moved.id) this.slotClick(slotId, button, 1);
          }
        }
      } else {
        if (slotId < 0) return null;
        const slot = this.slots[slotId];
        if (!slot) return null;
        const st = slot.item;
        const cur = inv.cursor;
        if (st) result = copy(st);
        if (!st) {
          if (cur && this.isValid(slotId, cur)) {
            let k = button === 0 ? cur.count : 1;
            if (k > this.slotLimit(slotId, cur)) k = this.slotLimit(slotId, cur);
            if (cur.count >= k) {
              const part = copy(cur); part.count = k;
              cur.count -= k;
              this.put(slotId, part);
            }
            if (cur.count === 0) inv.cursor = null;
          }
        } else if (this.canTake(slotId)) {
          if (!cur) {
            const j = button === 0 ? st.count : Math.floor((st.count + 1) / 2);
            const taken = this.decr(slotId, j);
            inv.cursor = taken;
            this.onPickupFromSlot(slotId, taken);
          } else if (this.isValid(slotId, cur)) {
            if (stackable(st, cur)) {
              let n = button === 0 ? cur.count : 1;
              if (n > this.slotLimit(slotId, cur) - st.count) n = this.slotLimit(slotId, cur) - st.count;
              if (n > this.maxStack(cur) - st.count) n = this.maxStack(cur) - st.count;
              cur.count -= n;
              if (cur.count === 0) inv.cursor = null;
              st.count += n;
              this.onSlotChanged(slotId);
            } else if (cur.count <= this.slotLimit(slotId, cur)) {
              this.put(slotId, cur);
              inv.cursor = st;
            }
          } else if (st.id === cur.id && this.maxStack(cur) > 1 && st.damage === cur.damage && tagsEqual(st, cur)) {
            const l = st.count;
            if (l > 0 && l + cur.count <= this.maxStack(cur)) {
              cur.count += l;
              const taken = this.decr(slotId, l);
              this.onPickupFromSlot(slotId, taken);
            }
          }
          this.onSlotChanged(slotId);
        }
      }
    } else if (mode === 2 && button >= 0 && button < 9) {
      const slot = this.slots[slotId];
      if (slot && this.canTake(slotId)) {
        const hot = inv.main[button];
        const slotIsPlayerInv = slot.playerIndex !== undefined;
        let flag = !hot || (slotIsPlayerInv && this.isValid(slotId, hot));
        let k1 = -1;
        if (!flag) { k1 = inv.firstEmpty(); flag = flag || k1 > -1; }
        if (slot.item && flag) {
          const st = slot.item;
          inv.main[button] = copy(st);
          if ((!slotIsPlayerInv || !this.isValid(slotId, hot)) && hot) {
            if (k1 > -1) {
              inv.addToInventory(hot);
              this.decr(slotId, st.count);
              this.put(slotId, null);
              this.onPickupFromSlot(slotId, st);
            }
          } else {
            this.decr(slotId, st.count);
            this.put(slotId, hot);
            this.onPickupFromSlot(slotId, st);
          }
        } else if (!slot.item && hot && this.isValid(slotId, hot)) {
          inv.main[button] = null;
          this.put(slotId, hot);
        }
        inv.syncWindowSlots();
      }
    } else if (mode === 3 && this.game.player.creative && !inv.cursor && slotId >= 0) {
      const st = this.get(slotId);
      if (st) { const c = copy(st); c.count = this.maxStack(c); inv.cursor = c; }
    } else if (mode === 4 && !inv.cursor && slotId >= 0) {
      const st = this.get(slotId);
      if (st && this.canTake(slotId)) {
        const taken = this.decr(slotId, button === 0 ? 1 : st.count);
        this.onPickupFromSlot(slotId, taken);
      }
    } else if (mode === 6 && slotId >= 0) {
      const cur = inv.cursor;
      const slot = this.slots[slotId];
      if (cur && (!slot || !slot.item || !this.canTake(slotId))) {
        const start = button === 0 ? 0 : this.slots.length - 1;
        const step = button === 0 ? 1 : -1;
        for (let pass = 0; pass < 2; pass++) {
          for (let i = start; i >= 0 && i < this.slots.length && cur.count < this.maxStack(cur); i += step) {
            const s = this.get(i);
            if (s && this._canAdd(i, cur, true) && this.canTake(i) && this.canMergeSlot(i) && (pass !== 0 || s.count !== this.maxStack(s))) {
              const l = Math.min(this.maxStack(cur) - cur.count, s.count);
              const taken = this.decr(i, l);
              cur.count += l;
              this.onPickupFromSlot(i, taken);
            }
          }
        }
      }
    }
    return result;
  }

  _canAdd(i, stack, sizeMatters) {
    const st = this.get(i);
    let flag = !st;
    if (st && stack && sameItem(st, stack) && tagsEqual(st, stack)) {
      flag = flag || st.count + (sizeMatters ? 0 : stack.count) <= this.maxStack(stack);
    }
    return flag;
  }

  _resetDrag() { this.dragEvent = 0; this.dragSlots.clear(); }

  // Perform a click and send it to the server
  click(slotId, button, mode) {
    const clicked = this.slotClick(slotId, button, mode);
    const action = this.inv.nextAction();
    this.game.send(C.windowClick(this.windowId, slotId, button, action, mode, clicked));
    if (this.afterClick) this.afterClick();
    return clicked;
  }

  setSlot(i, item) { if (this.slots[i]) { this.slots[i].item = item; this.onSlotChanged(i); } }
  setAll(items) { for (let i = 0; i < items.length && i < this.slots.length; i++) this.slots[i].item = items[i]; this.onSlotChanged(1); }
}

// Player inventory: window 0 (46 slots) + the underlying 36-slot main inventory, 4 armor and the off hand (slot 45)
export class Inventory extends ContainerBase {
  constructor(game) {
    super(game);
    this.windowId = 0;
    this.reset();
  }

  reset() {
    this.main = new Array(36).fill(null); // 0-8 hotbar, 9-35 main
    this.armor = new Array(4).fill(null); // boots, legs, chest, helmet (vanilla order)
    this.offhand = null;
    this.craft = new Array(4).fill(null);
    this.craftResult = null;
    this.cursor = null;
    this.actionCounter = 0;
    this._buildSlots();
  }

  nextAction() { this.actionCounter = (this.actionCounter + 1) & 0x7fff; return this.actionCounter; }

  _buildSlots() {
    const self = this;
    const s = [];
    s.push({ get item() { return self.craftResult; }, set item(v) { self.craftResult = v; }, output: true, valid: () => false });
    for (let i = 0; i < 4; i++) s.push({ get item() { return self.craft[i]; }, set item(v) { self.craft[i] = v; } });
    for (let i = 0; i < 4; i++) {
      const at = i; // 0 helmet .. 3 boots
      s.push({
        get item() { return self.armor[3 - at]; }, set item(v) { self.armor[3 - at] = v; }, limit: 1,
        valid: (it) => !!it && (armorType(it) === at || (at === 0 && (it.id === 86 || it.id === 397))),
      });
    }
    for (let i = 9; i < 36; i++) s.push({ get item() { return self.main[i]; }, set item(v) { self.main[i] = v; }, playerIndex: i });
    for (let i = 0; i < 9; i++) s.push({ get item() { return self.main[i]; }, set item(v) { self.main[i] = v; }, playerIndex: i });
    s.push({ get item() { return self.offhand; }, set item(v) { self.offhand = v; }, playerIndex: 40 });
    this.slots = s;
  }

  // Window 0 slot index -> set
  setSlot(i, item) {
    if (!this.slots[i]) return;
    this.slots[i].item = item;
    this.onSlotChanged(i);
  }

  setAll(items) { for (let i = 0; i < items.length && i < this.slots.length; i++) this.slots[i].item = items[i]; this.updateCraftResult(); }

  // windowId -2 in 1.8 isn't used, kept for safety (index into main inventory)
  setPlayerSlotByInventoryIndex(i, item) { if (i >= 0 && i < 36) this.main[i] = item; }

  held() { return this.main[this.game.heldSlot]; }
  setHeld(item) { this.main[this.game.heldSlot] = item; }
  // hand: 0 main, 1 off
  getHand(hand) { return hand === 1 ? this.offhand : this.held(); }
  setHand(hand, item) { if (hand === 1) this.offhand = item; else this.setHeld(item); }

  firstEmpty() {
    for (let i = 0; i < 36; i++) if (!this.main[i]) return i;
    return -1;
  }

  addToInventory(item) {
    const max = this.maxStack(item);
    for (let i = 0; i < 36 && item.count > 0; i++) {
      const s = this.main[i];
      if (s && stackable(s, item) && s.count < max) {
        const n = Math.min(max - s.count, item.count);
        s.count += n; item.count -= n;
      }
    }
    if (item.count > 0) {
      const e = this.firstEmpty();
      if (e >= 0) { this.main[e] = copy(item); item.count = 0; }
    }
    return item.count === 0;
  }

  syncWindowSlots() {}

  onSlotChanged(i) {
    if (i >= 1 && i <= 4) this.updateCraftResult();
  }

  updateCraftResult() {
    this.craftResult = craftResult(this.craft, 2, this.items);
  }

  onPickupFromSlot(i, taken) {
    if (i === 0) consumeGrid(this, 1, 4);
  }

  transferStackInSlot(i) {
    return this._transfer(i, (it) => {
      if (i === 0) {
        if (!this.mergeItemStack(it, 9, 45, true)) return false;
      } else if (i >= 1 && i < 5) {
        if (!this.mergeItemStack(it, 9, 45, false)) return false;
      } else if (i >= 5 && i < 9) {
        if (!this.mergeItemStack(it, 9, 45, false)) return false;
      } else if (armorType(it) >= 0 && !this.get(5 + armorType(it))) {
        const t = 5 + armorType(it);
        if (!this.mergeItemStack(it, t, t + 1, false)) return false;
      } else if (i >= 9 && i < 36) {
        if (!this.mergeItemStack(it, 36, 45, false)) return false;
      } else if (i >= 36 && i < 45) {
        if (!this.mergeItemStack(it, 9, 36, false)) return false;
      } else if (!this.mergeItemStack(it, 9, 45, false)) return false;
      return true;
    });
  }

  // Armor points (for the HUD)
  armorPoints() {
    const pts = { 298: 1, 299: 3, 300: 2, 301: 1, 302: 2, 303: 5, 304: 4, 305: 1, 306: 2, 307: 6, 308: 5, 309: 2,
      310: 3, 311: 8, 312: 6, 313: 3, 314: 2, 315: 5, 316: 3, 317: 1 };
    let n = 0;
    for (const a of this.armor) if (a && pts[a.id]) n += pts[a.id];
    return n;
  }
}

function consumeGrid(container, from, to) {
  for (let s = from; s <= to; s++) {
    const it = container.get(s);
    if (!it) continue;
    const cont = containerItem(it);
    container.decr(s, 1);
    if (cont) {
      if (!container.get(s)) container.put(s, cont);
      else container.inv.addToInventory(cont);
    }
  }
}

const CHEST_TYPES = new Set(['minecraft:chest', 'minecraft:container']);

// A server-opened container window. Slots = container slots followed by the 36 player slots.
export class ContainerWindow extends ContainerBase {
  constructor(game, id, type, title, slotCount, entityId) {
    super(game);
    this.windowId = id;
    this.id = id;
    this.type = type;
    this.title = title;
    this.entityId = entityId;
    const fixed = { 'minecraft:crafting_table': 10, 'minecraft:enchanting_table': 2, 'minecraft:anvil': 3, 'minecraft:villager': 3, 'minecraft:beacon': 1 };
    this.size = fixed[type] !== undefined ? fixed[type] : slotCount;
    if (type === 'EntityHorse') this.size = slotCount;
    this.container = new Array(this.size).fill(null);
    this._buildSlots();
  }

  _buildSlots() {
    const self = this;
    const inv = this.game.inventory;
    const s = [];
    for (let i = 0; i < this.size; i++) {
      const slot = { get item() { return self.container[i]; }, set item(v) { self.container[i] = v; } };
      this._configureSlot(i, slot);
      s.push(slot);
    }
    for (let i = 9; i < 36; i++) s.push({ get item() { return inv.main[i]; }, set item(v) { inv.main[i] = v; }, playerIndex: i });
    for (let i = 0; i < 9; i++) s.push({ get item() { return inv.main[i]; }, set item(v) { inv.main[i] = v; }, playerIndex: i });
    this.slots = s;
  }

  _configureSlot(i, slot) {
    switch (this.type) {
      case 'minecraft:crafting_table': if (i === 0) { slot.output = true; slot.valid = () => false; } break;
      case 'minecraft:furnace':
        if (i === 2) { slot.output = true; slot.valid = () => false; }
        if (i === 1) slot.valid = (it) => !!it && (FUEL.has(it.id) || it.id === 325);
        break;
      case 'minecraft:brewing_stand':
        if (i < 3) { slot.valid = (it) => !!it && (it.id === 373 || it.id === 374); slot.limit = 1; }
        else slot.valid = (it) => !!it && BREWING_INGREDIENTS.has(it.id);
        break;
      case 'minecraft:enchanting_table':
        if (i === 0) { slot.limit = 1; }
        else slot.valid = (it) => !!it && it.id === 351 && it.damage === 4;
        break;
      case 'minecraft:anvil': if (i === 2) { slot.output = true; slot.valid = () => false; } break;
      case 'minecraft:villager': if (i === 2) { slot.output = true; slot.valid = () => false; } break;
      case 'minecraft:beacon': slot.limit = 1; slot.valid = (it) => !!it && BEACON_PAYMENT.has(it.id); break;
      case 'EntityHorse':
        if (i === 0) { slot.valid = (it) => !!it && it.id === 329; slot.limit = 1; }
        if (i === 1) { slot.valid = (it) => !!it && it.id >= 417 && it.id <= 419; slot.limit = 1; }
        break;
      default: break;
    }
  }

  onSlotChanged(i) {
    if (this.type === 'minecraft:crafting_table' && i >= 1 && i <= 9) {
      this.container[0] = craftResult(this.container.slice(1, 10), 3, this.items);
    }
  }

  onPickupFromSlot(i, taken) {
    if (this.type === 'minecraft:crafting_table' && i === 0) consumeGrid(this, 1, 9);
  }

  canMergeSlot(i) { return !this.slots[i].output; }

  transferStackInSlot(i) {
    const n = this.size;
    const total = this.slots.length;
    const t = this.type;
    return this._transfer(i, (it) => {
      const m = (a, b, r) => this.mergeItemStack(it, a, b, r);
      if (t === 'minecraft:crafting_table') {
        if (i === 0) { if (!m(10, 46, true)) return false; }
        else if (i >= 10 && i < 37) { if (!m(37, 46, false)) return false; }
        else if (i >= 37 && i < 46) { if (!m(10, 37, false)) return false; }
        else if (!m(10, 46, false)) return false;
        return true;
      }
      if (t === 'minecraft:furnace') {
        if (i === 2) { if (!m(3, 39, true)) return false; }
        else if (i !== 1 && i !== 0) {
          if (SMELTABLE.has(it.id)) { if (!m(0, 1, false)) return false; }
          else if (FUEL.has(it.id) || it.id === 325) { if (!m(1, 2, false)) return false; }
          else if (i >= 3 && i < 30) { if (!m(30, 39, false)) return false; }
          else if (i >= 30 && i < 39 && !m(3, 30, false)) return false;
        } else if (!m(3, 39, false)) return false;
        return true;
      }
      if (t === 'minecraft:brewing_stand') {
        if ((i < 0 || i > 2) && i !== 3) {
          if (BREWING_INGREDIENTS.has(it.id) && !this.get(3)) { if (!m(3, 4, false)) return false; }
          else if (it.id === 373 || it.id === 374) { if (!m(0, 3, false)) return false; }
          else if (i >= 4 && i < 31) { if (!m(31, 40, false)) return false; }
          else if (i >= 31 && i < 40) { if (!m(4, 31, false)) return false; }
          else if (!m(4, 40, false)) return false;
        } else if (!m(4, 40, true)) return false;
        return true;
      }
      if (t === 'minecraft:enchanting_table') {
        if (i === 0 || i === 1) { if (!m(2, 38, true)) return false; }
        else if (it.id === 351 && it.damage === 4) { if (!m(1, 2, true)) return false; }
        else {
          if (this.get(0)) return false;
          const one = copy(it); one.count = 1;
          this.put(0, one);
          it.count--;
        }
        return true;
      }
      if (t === 'minecraft:anvil' || t === 'minecraft:villager') {
        if (i === 2) { if (!m(3, 39, true)) return false; }
        else if (i !== 0 && i !== 1) {
          if (t === 'minecraft:anvil') { if (i >= 3 && i < 39 && !m(0, 2, false)) return false; }
          else if (i >= 3 && i < 30) { if (!m(30, 39, false)) return false; }
          else if (i >= 30 && i < 39 && !m(3, 30, false)) return false;
        } else if (!m(3, 39, false)) return false;
        return true;
      }
      if (t === 'minecraft:beacon') {
        if (i === 0) { if (!m(1, 37, true)) return false; }
        else if (!this.get(0) && BEACON_PAYMENT.has(it.id) && it.count === 1) { if (!m(0, 1, false)) return false; }
        else if (i >= 1 && i < 28) { if (!m(28, 37, false)) return false; }
        else if (i >= 28 && i < 37) { if (!m(1, 28, false)) return false; }
        else if (!m(1, 37, false)) return false;
        return true;
      }
      if (t === 'EntityHorse') {
        if (i < n) { if (!m(n, total, true)) return false; }
        else if (this.slots[1] && this.isValid(1, it) && !this.get(1)) { if (!m(1, 2, false)) return false; }
        else if (this.isValid(0, it) && !this.get(0)) { if (!m(0, 1, false)) return false; }
        else if (n <= 2 || !m(2, n, false)) return false;
        return true;
      }
      // Chest-like (chest, dispenser, dropper, hopper, generic)
      if (i < n) { if (!m(n, total, true)) return false; }
      else if (!m(0, n, false)) return false;
      return true;
    });
  }

  setAll(items) {
    for (let i = 0; i < items.length && i < this.slots.length; i++) this.slots[i].item = items[i];
    this.onSlotChanged(1);
  }

  // Closing the window returns grid items in vanilla server-side; mirror locally
  onClose() {
    if (this.type === 'minecraft:crafting_table') for (let i = 0; i <= 9; i++) this.container[i] = null;
  }
}

export { CHEST_TYPES };
