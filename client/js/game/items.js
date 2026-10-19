// Item metadata helpers: names, tooltips, stack sizes, durability, use actions, tool speeds.
import { simplify } from '../net/nbt.js';
import { blocks } from '../world/blocks.js';
import { ItemNames } from './itemnames.js';

const ENCH_NAMES = {
  0: 'protect.all', 1: 'protect.fire', 2: 'protect.fall', 3: 'protect.explosion', 4: 'protect.projectile', 5: 'oxygen',
  6: 'waterWorker', 7: 'thorns', 8: 'waterWalker', 16: 'damage.all', 17: 'damage.undead', 18: 'damage.arthropods',
  19: 'knockback', 20: 'fire', 21: 'lootBonus', 32: 'digging', 33: 'untouching', 34: 'durability', 35: 'lootBonusDigger',
  48: 'arrowDamage', 49: 'arrowKnockback', 50: 'arrowFire', 51: 'arrowInfinite', 61: 'lootBonusFishing', 62: 'fishingSpeed',
};

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

const FOOD_IDS = new Set([260, 282, 297, 319, 320, 322, 349, 350, 357, 360, 363, 364, 365, 366, 367, 375, 391, 392, 393, 394, 396, 400, 411, 412, 413, 423, 424,
  432, 434, 436]); // + chorus fruit, beetroot, beetroot soup (1.9)
const SWORDS = new Set([267, 268, 272, 276, 283]);
const RARITY_UNCOMMON = new Set([384, 399, 2256, 2257, 2258, 2259, 2260, 2261, 2262, 2263, 2264, 2265, 2266, 2267, 397, 138, 116, 322]);

export class Items {
  constructor(assets) {
    this.assets = assets;
    this.names = new ItemNames(assets, this);
    this.byId = assets.itemsById;
    this.byName = assets.itemsByName;
    this.maps = new Map();
    this.materials = assets.data.materials;
    this.foods = new Map();
    for (const f of assets.data.foods) this.foods.set(f.id, f);
  }

  def(id) { return this.byId.get(id) || null; }

  name(id) { const d = this.def(id); return d ? d.name : 'unknown'; }

  maxStack(id) {
    const d = this.def(id);
    return d && d.stackSize ? d.stackSize : 64;
  }

  maxDurability(id) {
    const d = this.def(id);
    return d && d.maxDurability ? d.maxDurability : 0;
  }

  isDamageable(item) { return this.maxDurability(item.id) > 0; }

  nbt(item) {
    if (!item || !item.nbt) return null;
    if (!item._simple) item._simple = simplify(item.nbt) || {};
    return item._simple;
  }

  // ItemStack.getDisplayName: custom name, else the translated item name
  displayName(item) {
    const tag = this.nbt(item);
    if (tag && tag.display && tag.display.Name) return tag.display.Name;
    const d = this.def(item.id);
    if (!d) return 'Unknown (' + item.id + ')';
    if (item.id === 387 && tag && tag.title) return tag.title;
    if (item.id === 397 && item.damage === 3 && tag && tag.SkullOwner) {
      const owner = typeof tag.SkullOwner === 'string' ? tag.SkullOwner : tag.SkullOwner.Name;
      if (owner) return this.assets.translate('item.skull.player.name', [owner]);
    }
    let english = d.displayName;
    if (d.variations) {
      const v = d.variations.find((x) => x.metadata === item.damage);
      if (v) english = v.displayName;
    }
    return this.names.name(item, d, english);
  }

  potionName(item) { return this.names.potion(item); }

  // Approximation of PotionHelper for common damage values
  potionEffects(item) {
    const tag = this.nbt(item);
    if (tag && tag.CustomPotionEffects) return tag.CustomPotionEffects.map((e) => ({ id: e.Id, amplifier: e.Amplifier || 0, duration: e.Duration || 0 }));
    const d = item.damage & 15;
    const map = { 1: 10, 2: 1, 3: 12, 4: 19, 5: 6, 6: 16, 8: 18, 9: 5, 10: 2, 11: 8, 12: 7, 13: 13, 14: 14 };
    const id = map[d];
    if (!id) return [];
    return [{ id, amplifier: item.damage & 32 ? 1 : 0, duration: 0 }];
  }

  potionColor(item) {
    const colors = { 1: 0x7cafc6, 2: 0x5a6c81, 3: 0xd9c043, 4: 0x4a4217, 5: 0x932423, 6: 0xf82423, 7: 0x430a09, 8: 0x786297,
      9: 0x551d4a, 10: 0xcd5cab, 11: 0x99453a, 12: 0xe49a3a, 13: 0x2e5299, 14: 0x7f8392, 15: 0x1f1f23, 16: 0x1f1fa1,
      17: 0x587653, 18: 0x484d48, 19: 0x4e9331, 20: 0x352a27, 21: 0xf87d23, 22: 0x2552a5, 23: 0xf82423 };
    const eff = this.potionEffects(item);
    if (!eff.length) return 0x385dc6;
    let r = 0, g = 0, b = 0, n = 0;
    for (const e of eff) {
      const c = colors[e.id] || 0x385dc6;
      for (let i = 0; i <= e.amplifier; i++) { r += ((c >> 16) & 255) / 255; g += ((c >> 8) & 255) / 255; b += (c & 255) / 255; n++; }
    }
    return (((r / n) * 255) << 16) | (((g / n) * 255) << 8) | ((b / n) * 255);
  }

  enchantments(item) {
    const tag = this.nbt(item);
    if (!tag) return [];
    const list = tag.ench || tag.StoredEnchantments || [];
    return list.map((e) => ({ id: e.id, lvl: e.lvl }));
  }

  isEnchanted(item) {
    if (!item) return false;
    if (item.id === 403 || item.id === 322 && item.damage === 1) return true;
    if (item.id === 384 || item.id === 399) return true;
    return this.enchantments(item).length > 0;
  }

  enchantLevel(item, id) {
    if (!item) return 0;
    const e = this.enchantments(item).find((x) => x.id === id);
    return e ? e.lvl : 0;
  }

  tooltip(item, advanced = false) {
    const lines = [];
    let name = this.displayName(item);
    const tag = this.nbt(item);
    const hasCustom = tag && tag.display && tag.display.Name;
    let color = '';
    if (this.isEnchanted(item) && item.id !== 384) color = '§b';
    else if (RARITY_UNCOMMON.has(item.id)) color = '§e';
    if (item.id === 322 && item.damage === 1) color = '§d';
    if (item.id === 399) color = '§e';
    if (hasCustom) name = '§o' + name;
    if (advanced) {
      const d = this.def(item.id);
      const sub = item.damage || this.maxDurability(item.id) ? `/${item.damage}` : '';
      name += ` (#${String(item.id).padStart(4, '0')}${sub})`;
      void d;
    }
    lines.push(color + name);
    const t = (k, ...a) => this.assets.translate(k, a);
    if (item.id === 373) {
      const effects = this.potionEffects(item);
      if (!effects.length) lines.push('§7' + t('potion.empty'));
      for (const e of effects) {
        const pot = e.amplifier > 0 ? t('potion.potency.' + e.amplifier) : '';
        lines.push('§9' + this.names.effectName(e.id) + (pot && !pot.startsWith('potion.') ? ' ' + pot : ''));
      }
    }
    if (tag && tag.author && item.id === 387) lines.push('§7' + t('book.byAuthor', tag.author));
    const rec = this.names.recordDescription(item.id);
    if (rec) lines.push('§7' + rec);
    for (const e of this.enchantments(item)) {
      const key = 'enchantment.' + (ENCH_NAMES[e.id] || 'unknown');
      const ename = this.assets.translate(key);
      const lvl = this.assets.translate('enchantment.level.' + e.lvl);
      lines.push('§7' + ename + ' ' + (lvl.startsWith('enchantment.') ? e.lvl : lvl));
    }
    if (tag && tag.display) {
      if (tag.display.color !== undefined && (item.id >= 298 && item.id <= 301)) {
        lines.push(advanced ? '§7Color: #' + tag.display.color.toString(16).toUpperCase() : '§7§o' + t('item.dyed'));
      }
      if (tag.display.Lore) for (const l of tag.display.Lore) lines.push('§5§o' + l);
    }
    const weapon = { 267: 6, 268: 4, 272: 5, 276: 7, 283: 4, 258: 3, 271: 3, 275: 4, 279: 6, 286: 3,
      256: 2.5, 269: 1, 273: 2, 277: 4, 284: 1, 257: 4, 270: 2, 274: 3, 278: 5, 285: 2 };
    if (weapon[item.id] !== undefined) {
      const sharp = this.enchantLevel(item, 16);
      const dmg = weapon[item.id] + 1 + sharp * 1.25;
      lines.push('');
      lines.push('§9' + t('attribute.modifier.plus.0', String(Math.round(dmg * 100) / 100), t('attribute.name.generic.attackDamage')));
    }
    if (advanced && this.isDamageable(item) && item.damage > 0) {
      lines.push('Durability: ' + (this.maxDurability(item.id) - item.damage) + ' / ' + this.maxDurability(item.id));
    }
    return lines;
  }

  // Use action: 'none' | 'eat' | 'drink' | 'block' | 'bow'
  useAction(item) {
    if (!item) return 'none';
    // 1.9+: potions are always drinkable (splash / lingering are separate items), swords no longer block, shields do
    if (item.id === 373 || item.id === 335) return 'drink';
    if (FOOD_IDS.has(item.id)) return 'eat';
    if (item.id === 442) return 'block';
    if (item.id === 261) return 'bow';
    return 'none';
  }

  useDuration(item) {
    const a = this.useAction(item);
    if (a === 'eat' || a === 'drink') return item.id === 322 ? 32 : 32;
    if (a === 'block' || a === 'bow') return 72000;
    return 0;
  }

  isFood(item) { return item && FOOD_IDS.has(item.id); }

  // ItemTool.getStrVsBlock
  strVsBlock(item, blockDef) {
    if (!item) return 1;
    if (item.id === 359) { // shears
      if (blockDef.name === 'web' || blockDef.material === 'leaves') return 15;
      if (blockDef.material === 'wool') return 5;
      return 1;
    }
    if (SWORDS.has(item.id)) {
      if (blockDef.name === 'web') return 15;
      const m = blockDef.material;
      if (m === 'plant' || m === 'leaves' || blockDef.name === 'vine' || blockDef.name === 'pumpkin' || blockDef.name === 'melon_block') return 1.5;
      return 1;
    }
    const table = blockDef.material ? this.materials[blockDef.material] : null;
    if (table && table[item.id] !== undefined) return table[item.id];
    return 1;
  }

  canHarvest(item, blockDef) {
    if (!blockDef.harvestTools) return true;
    return !!(item && blockDef.harvestTools[item.id]);
  }

  isBlockItem(id) { return id > 0 && id < 256 && !!blocks[id]; }

  updateMap(p) {
    let m = this.maps.get(p.itemDamage);
    if (!m) { m = { colors: new Uint8Array(128 * 128), icons: [], scale: p.scale, version: 0 }; this.maps.set(p.itemDamage, m); }
    m.scale = p.scale;
    m.icons = p.icons;
    if (p.columns > 0 && p.data) {
      for (let i = 0; i < p.columns; i++) {
        for (let j = 0; j < p.rows; j++) {
          m.colors[(p.y + j) * 128 + p.x + i] = p.data[j * p.columns + i];
        }
      }
    }
    m.version++;
  }
}

export { SWORDS, FOOD_IDS };
