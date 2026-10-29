import {smithingRecipe,smithingResult,smithingRecipes} from './workstations-1.16.5.js';
// Inventory/container model with a faithful port of vanilla Container.slotClick and
// per-container transferStackInSlot (1.8 servers don't echo accepted clicks back).
import { C } from '../net/packets.js';
import { Reader } from '../net/buffer.js';
import { TAG } from '../net/nbt.js';
import {tradeCost,stonecutterRecipes} from './workstations-1.14.4.js';
import { craftResult, containerItem } from './crafting.js';

// ItemStack.copy owns its NBT: editing a picked/displayed stack must not mutate
// the source entity or another inventory slot (including typed array/long tags).
export const copy = (it) => (it ? { id: it.id, count: it.count, damage: it.damage,
  nbt: it.nbt ? structuredClone(it.nbt) : it.nbt, nbtRaw: it.nbtRaw ? it.nbtRaw.slice() : it.nbtRaw } : null);

function sameItem(a, b) {
  // Protocol404 variants have separate item IDs; durability lives in Damage NBT.
  return !!a && !!b && a.id === b.id;
}

function nbtPayloadEqual(type, a, b) {
  if (a === b) return true;
  if (type === TAG.COMPOUND) {
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every(k => Object.prototype.hasOwnProperty.call(b, k) && nbtEqual(a[k], b[k]));
  }
  if (type === TAG.LIST) {
    return a.items.length === b.items.length && (!a.items.length || a.et === b.et && a.items.every((v, i) => nbtPayloadEqual(a.et, v, b.items[i])));
  }
  if (type === TAG.BYTE_ARRAY || type === TAG.INT_ARRAY || type === TAG.LONG_ARRAY) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  return false;
}

// Match NBT values and types: compound order/root names are irrelevant, list order is significant.
// Do not simplify (which loses numeric tag types and precision for longs) or stringify typed arrays.
function nbtEqual(a, b) { return a === b || !!a && !!b && a.t === b.t && nbtPayloadEqual(a.t, a.v, b.v); }
function stackTag(item) { return item.nbt || (item.nbtRaw ? new Reader(item.nbtRaw).optionalNbt() : null); }
function tagsEqual(a, b) { return nbtEqual(stackTag(a), stackTag(b)); }
export function stackable(a, b) { return sameItem(a, b) && tagsEqual(a, b); }

const ARMOR_POINTS = {
  leather: [1, 3, 2, 1], chainmail: [2, 5, 4, 1], iron: [2, 6, 5, 2], diamond: [3, 8, 6, 3], netherite: [3, 8, 6, 3], golden: [2, 5, 3, 1],
};
const ARMOR_PARTS = ['helmet', 'chestplate', 'leggings', 'boots'];
const HEADWEAR = new Set(['carved_pumpkin', 'skeleton_skull', 'wither_skeleton_skull', 'zombie_head', 'player_head', 'creeper_head', 'dragon_head']);
const itemName = (item, registry) => {
  if (!item) return '';
  const name = registry instanceof Map ? registry.get(item.id)?.name : registry ? registry.name(item.id) : item.name;
  return typeof name === 'string' ? name.replace(/^minecraft:/, '') : '';
};

// Public API: numeric stacks need Items (or its byId Map); named stacks also work without a registry.
// 0 head .. 3 feet, -1 otherwise. Never interpret a protocol404 ID as a legacy ID.
export function armorType(item, registry = null) {
  const name = itemName(item, registry);
  if (name === 'turtle_helmet' || HEADWEAR.has(name)) return 0;
  if (name === 'elytra') return 1;
  const [material, part] = name.split('_');
  if (ARMOR_POINTS[material]) return ARMOR_PARTS.indexOf(part);
  return -1;
}

const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak'];
const COLORS = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const LOGS = WOODS.flatMap(w => [w + '_log', w + '_wood', 'stripped_' + w + '_log', 'stripped_' + w + '_wood']);
// Vanilla 1.13.2 smelting ingredients and furnace fuel tags, verified against the local jar.
// This is only shift-click routing; the furnace input slot accepts any manually inserted stack.
const SMELTABLE = new Set([
  ...`iron_ore gold_ore coal_ore lapis_ore diamond_ore emerald_ore redstone_ore nether_quartz_ore sand red_sand cobblestone
    cactus clay_ball netherrack clay stone_bricks porkchop beef chicken cod salmon mutton rabbit potato wet_sponge
    chorus_fruit kelp sea_pickle`.split(/\s+/),
  ...LOGS, ...COLORS.map(c => c + '_terracotta'),
  ...['iron', 'golden'].flatMap(m => [...ARMOR_PARTS, 'pickaxe', 'shovel', 'axe', 'hoe', 'sword', 'horse_armor'].map(p => m + '_' + p)),
  ...ARMOR_PARTS.map(p => 'chainmail_' + p),
]);
const FUEL = new Set([
  ...`lava_bucket coal_block blaze_rod coal charcoal note_block bookshelf jukebox chest trapped_chest crafting_table
    daylight_detector bow fishing_rod ladder sign wooden_shovel wooden_sword wooden_hoe wooden_axe wooden_pickaxe
    stick bowl dried_kelp_block bamboo scaffolding barrel loom cartography_table fletching_table smithing_table lectern composter`.split(/\s+/),
  ...LOGS,
  ...WOODS.flatMap(w => ['planks', 'stairs', 'slab', 'trapdoor', 'pressure_plate', 'fence', 'fence_gate', 'door', 'boat', 'button', 'sapling'].map(p => w + '_' + p)),
  ...COLORS.flatMap(c => ['wool', 'carpet', 'banner'].map(p => c + '_' + p)),
]);
const BREWING_INGREDIENTS = new Set(`nether_wart glowstone_dust redstone gunpowder dragon_breath fermented_spider_eye sugar
  ghast_tear glistering_melon_slice blaze_powder magma_cream golden_carrot spider_eye pufferfish rabbit_foot turtle_helmet phantom_membrane`.split(/\s+/));
const isReagent = (it, items) => BREWING_INGREDIENTS.has(itemName(it, items));
// ContainerBrewingStand.Potion.canHoldPotion: potions of the three kinds and glass bottles
const BOTTLES = new Set(['potion', 'splash_potion', 'lingering_potion', 'glass_bottle']);
const canHoldPotion = (it, items) => BOTTLES.has(itemName(it, items));
const BEACON_PAYMENT = new Set(['emerald', 'diamond', 'gold_ingot', 'iron_ingot', 'netherite_ingot']);
const HORSE_ARMOR = new Set(['leather_horse_armor', 'iron_horse_armor', 'golden_horse_armor', 'diamond_horse_armor']);

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
    let lim = typeof s.limit === 'function' ? s.limit(item) : s.limit !== undefined ? s.limit : 64;
    if (item) lim = Math.min(lim, this.maxStack(item));
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
        if (it && this.isValid(i, stack) && stackable(it, stack)) {
          const moved = Math.min(stack.count, this.slotLimit(i, stack) - it.count);
          if (moved > 0) { stack.count -= moved; it.count += moved; this.onSlotChanged(i); flag = true; }
        }
        i += reverse ? -1 : 1;
      }
    }
    if (stack.count > 0) {
      i = reverse ? end - 1 : start;
      while (!reverse && i < end || reverse && i >= start) {
        if (!this.get(i) && this.isValid(i, stack)) {
          const moved = Math.min(stack.count, this.slotLimit(i, stack));
          if (moved > 0) {
            const part = copy(stack); part.count = moved;
            stack.count -= moved; this.put(i, part); flag = true; break;
          }
        }
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
          } else if (this.maxStack(cur) > 1 && stackable(st, cur)) {
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

  // Network setters are authoritative. Local onSlotChanged hooks still predict from legacy recipes;
  // invoking them here overwrites valid server output (including output-before-input packet order).
  setSlot(i, item) { if (this.slots[i]) this.slots[i].item = item; }
  setAll(items) { for (let i = 0; i < items.length && i < this.slots.length; i++) this.slots[i].item = items[i]; }
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
        valid: (it) => !!it && armorType(it, this.items) === at,
      });
    }
    for (let i = 9; i < 36; i++) s.push({ get item() { return self.main[i]; }, set item(v) { self.main[i] = v; }, playerIndex: i });
    for (let i = 0; i < 9; i++) s.push({ get item() { return self.main[i]; }, set item(v) { self.main[i] = v; }, playerIndex: i });
    s.push({ get item() { return self.offhand; }, set item(v) { self.offhand = v; }, playerIndex: 40 });
    this.slots = s;
  }

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
      const at = armorType(it, this.items);
      if (i === 0) {
        if (!this.mergeItemStack(it, 9, 45, true)) return false;
      } else if (i >= 1 && i < 5) {
        if (!this.mergeItemStack(it, 9, 45, false)) return false;
      } else if (i >= 5 && i < 9) {
        if (!this.mergeItemStack(it, 9, 45, false)) return false;
      } else if (at >= 0 && !this.get(5 + at)) {
        const t = 5 + at;
        if (!this.mergeItemStack(it, t, t + 1, false)) return false;
      } else if (itemName(it, this.items) === 'shield' && i !== 45 && !this.get(45)) {
        if (!this.mergeItemStack(it, 45, 46, false)) return false;
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
    let n = 0;
    for (const a of this.armor) {
      const name = itemName(a, this.items), [material, part] = name.split('_');
      n += name === 'turtle_helmet' ? 2 : ARMOR_POINTS[material]?.[ARMOR_PARTS.indexOf(part)] || 0;
    }
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
    const fixed = { 'minecraft:crafting_table': 10, 'minecraft:enchanting_table': 2, 'minecraft:smithing': 3, 'minecraft:anvil': 3, 'minecraft:villager': 3, 'minecraft:beacon': 1 };
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
    if(this.type==='minecraft:lectern'){this.slots=s;return;}
    for (let i = 9; i < 36; i++) s.push({ get item() { return inv.main[i]; }, set item(v) { inv.main[i] = v; }, playerIndex: i });
    for (let i = 0; i < 9; i++) s.push({ get item() { return inv.main[i]; }, set item(v) { inv.main[i] = v; }, playerIndex: i });
    this.slots = s;
  }

  _configureSlot(i, slot) {
    switch (this.type) {
      case 'minecraft:smithing': if(i===2){slot.output=true;slot.valid=()=>false;slot.canTake=()=>!!smithingRecipe(this.game,this.get(0),this.get(1));}break;
      case 'minecraft:crafting_table': if (i === 0) { slot.output = true; slot.valid = () => false; } break;
      case 'minecraft:blast_furnace': case 'minecraft:smoker': case 'minecraft:furnace':
        if (i === 2) { slot.output = true; slot.valid = () => false; }
        if (i === 1) {
          slot.valid = it => FUEL.has(itemName(it, this.items)) || itemName(it, this.items) === 'bucket';
          slot.limit = it => itemName(it, this.items) === 'bucket' ? 1 : 64;
        }
        break;
      case 'minecraft:brewing_stand':
        if (i < 3) { slot.valid = it => canHoldPotion(it, this.items); slot.limit = 1; }
        else if (i === 3) slot.valid = it => isReagent(it, this.items);
        else slot.valid = it => itemName(it, this.items) === 'blaze_powder';
        break;
      case 'minecraft:enchanting_table':
        if (i === 0) { slot.limit = 1; }
        else slot.valid = it => itemName(it, this.items) === 'lapis_lazuli';
        break;
      case 'minecraft:stonecutter':
        if(i===1){slot.output=true;slot.valid=()=>false;} break;
      case 'minecraft:loom':
        if(i===3){slot.output=true;slot.valid=()=>false;}
        else if(i===0)slot.valid=it=>itemName(it,this.items).endsWith('_banner');
        else if(i===1)slot.valid=it=>itemName(it,this.items).endsWith('_dye');
        else slot.valid=it=>itemName(it,this.items).endsWith('_banner_pattern'); break;
      case 'minecraft:cartography':
        if(i===2){slot.output=true;slot.valid=()=>false;}
        else slot.valid=it=>i===0?itemName(it,this.items)==='filled_map':['paper','map','glass_pane'].includes(itemName(it,this.items)); break;
      case 'minecraft:grindstone':
        if(i===2){slot.output=true;slot.valid=()=>false;}
        else slot.valid=it=>this.items.def(it.id)?.maxDurability>0 || itemName(it,this.items)==='enchanted_book' || !!this.items.nbt(it)?.Enchantments?.length; break;
      case 'minecraft:lectern': slot.valid=()=>false;slot.canTake=()=>false; break;
      case 'minecraft:anvil': if (i === 2) { slot.output = true; slot.valid = () => false; } break;
      case 'minecraft:villager': if (i === 2) { slot.output = true; slot.valid = () => false; } break;
      case 'minecraft:beacon': slot.limit = 1; slot.valid = it => BEACON_PAYMENT.has(itemName(it, this.items)); break;
      case 'EntityHorse':
        if (i === 0) { slot.valid = it => itemName(it, this.items) === 'saddle'; slot.limit = 1; }
        if (i === 1) { slot.valid = it => HORSE_ARMOR.has(itemName(it, this.items)); slot.limit = 1; }
        break;
      default: break;
    }
  }

  onSlotChanged(i) {
    if(this.type==='minecraft:smithing'&&i<2)this.container[2]=smithingResult(this.game,this.get(0),this.get(1));
    if (this.type === 'minecraft:crafting_table' && i >= 1 && i <= 9) {
      this.container[0] = craftResult(this.container.slice(1, 10), 3, this.items);
    }
  }

  // ResultContainer and MerchantContainer remove the entire result even on right click.
  decr(i,n) {
    if(this.slots[i]?.output && ['minecraft:smithing','minecraft:stonecutter','minecraft:grindstone','minecraft:cartography','minecraft:villager'].includes(this.type))n=this.get(i)?.count||n;
    return super.decr(i,n);
  }

  onPickupFromSlot(i, taken) {
    if (this.type === 'minecraft:crafting_table' && i === 0) consumeGrid(this, 1, 9);
    if(!this.slots[i]?.output)return;
    const consume=(slot,count=1)=>{const it=this.get(slot);if(it)this.put(slot,it.count>count?{...it,count:it.count-count}:null);};
    // Accepted clicks do not echo these predicted input changes. Network setters
    // still replace every slot when the server changes/rejects the result.
    if(this.type==='minecraft:smithing'){consume(0);consume(1);this.put(2,smithingResult(this.game,this.get(0),this.get(1)));
    }else if(this.type==='minecraft:stonecutter'){
      const recipe=stonecutterRecipes(this.game,this.get(0))[this.properties[0]];
      consume(0);this.put(1,this.get(0)&&recipe?copy(recipe.data.result):null);
    }else if(this.type==='minecraft:loom'){
      consume(0);consume(1);this.put(3,this.get(0)&&this.get(1)?{...copy(taken),count:1}:null);
    }else if(this.type==='minecraft:grindstone'){
      this.put(0,null);this.put(1,null);this.put(2,null);
    }else if(this.type==='minecraft:cartography'){
      const count=itemName(this.get(1),this.items)==='map'?2:1;
      consume(0);consume(1);this.put(2,this.get(0)&&this.get(1)?{...copy(taken),count}:null);
    }else if(this.type==='minecraft:villager'){
      const data=this.tradeData;if(!data)return;
      const matches=(slot,item)=>item?this.get(slot)?.id===item.id&&this.get(slot).count>=item.count:!this.get(slot);
      // With the default selection hint, MerchantOffers also finds offers by
      // manually supplied inputs, including reversed input slots.
      const selected=data.trades[this.selectedTrade||0];
      const candidates=[selected,...data.trades.filter(t=>t!==selected)];
      let trade,cost,first,second;
      for(const candidate of candidates){
        if(!candidate||candidate.disabled||!stackable(candidate.out,taken))continue;
        const required=tradeCost(candidate,this.maxStack(candidate.a));
        if(matches(0,required)&&matches(1,candidate.b)){trade=candidate;cost=required;first=0;second=1;break;}
        if(matches(1,required)&&matches(0,candidate.b)){trade=candidate;cost=required;first=1;second=0;break;}
      }
      if(!trade)return;
      if(matches(first,cost)&&matches(second,trade.b)){
        consume(first,cost.count);if(trade.b)consume(second,trade.b.count);
        trade.uses++;trade.disabled=trade.uses>=trade.max;data.experience+=trade.xp;
      }
      this.put(2,!trade.disabled&&matches(first,cost)&&matches(second,trade.b)?copy(trade.out):null);
    }
  }

  canMergeSlot(i) { return !this.slots[i].output; }

  transferStackInSlot(i) {
    const n = this.size;
    const total = this.slots.length;
    const t = this.type;
    return this._transfer(i, (it) => {
      const name = itemName(it, this.items);
      const m = (a, b, r) => this.mergeItemStack(it, a, b, r);
      if (t === 'minecraft:crafting_table') {
        if (i === 0) { if (!m(10, 46, true)) return false; }
        else if (i >= 10 && i < 37) { if (!m(37, 46, false)) return false; }
        else if (i >= 37 && i < 46) { if (!m(10, 37, false)) return false; }
        else if (!m(10, 46, false)) return false;
        return true;
      }
      if (t === 'minecraft:furnace' || t === 'minecraft:blast_furnace' || t === 'minecraft:smoker') {
        if (i === 2) { if (!m(3, 39, true)) return false; }
        else if (i !== 1 && i !== 0) {
          const kind=t==='minecraft:blast_furnace'?'minecraft:blasting':t==='minecraft:smoker'?'minecraft:smoking':'minecraft:smelting';
          const smeltable=this.game.serverRecipes?this.game.serverRecipes.some(r=>r.type===kind&&r.data.ingredient.some(s=>s?.id===it.id)):SMELTABLE.has(name);
          if (smeltable) { if (!m(0, 1, false)) return false; }
          else if (FUEL.has(name) || name === 'bucket') { if (!m(1, 2, false)) return false; }
          else if (i >= 3 && i < 30) { if (!m(30, 39, false)) return false; }
          else if (i >= 30 && i < 39 && !m(3, 30, false)) return false;
        } else if (!m(3, 39, false)) return false;
        return true;
      }
      if (t === 'minecraft:brewing_stand') {
        // ContainerBrewingStand.transferStackInSlot (5 slots: 3 potions, ingredient, fuel)
        if (i >= 0 && i <= 4) { if (!m(5, 41, true)) return false; }
        else if (isReagent(it, this.items)) { if (!m(3, 4, false)) return false; }
        else if (canHoldPotion(it, this.items) && it.count === 1) { if (!m(0, 3, false)) return false; }
        else if (name === 'blaze_powder') { if (!m(4, 5, false)) return false; }
        else if (i >= 5 && i < 32) { if (!m(32, 41, false)) return false; }
        else if (i >= 32 && i < 41) { if (!m(5, 32, false)) return false; }
        else if (!m(5, 41, false)) return false;
        return true;
      }
      if (t === 'minecraft:enchanting_table') {
        if (i === 0 || i === 1) { if (!m(2, 38, true)) return false; }
        else if (name === 'lapis_lazuli') { if (!m(1, 2, true)) return false; }
        else {
          if (this.get(0)) return false;
          const one = copy(it); one.count = 1;
          this.put(0, one);
          it.count--;
        }
        return true;
      }
      if(t==='minecraft:smithing'){
        if(i===2){if(!m(3,39,true))return false;}
        else if(i<2){if(!m(3,39,false))return false;}
        else {const start=smithingRecipes(this.game).some(r=>r.data.addition.some(s=>s?.id===it.id))?1:0;if(!m(start,2,false))return false;}
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
        else if (!this.get(0) && BEACON_PAYMENT.has(name) && it.count === 1) { if (!m(0, 1, false)) return false; }
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

  // Closing the window returns grid items in vanilla server-side; mirror locally
  onClose() {
    if (this.type === 'minecraft:crafting_table') for (let i = 0; i <= 9; i++) this.container[i] = null;
  }
}

export { CHEST_TYPES };
