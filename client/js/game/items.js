// Item metadata helpers: names, tooltips, stack sizes, durability, use actions, tool speeds.
import { simplify } from '../net/nbt.js';
import { blocksByName } from '../world/blocks.js';
import { chatToLegacy } from '../gui/chat.js';

// Registry names, never legacy item IDs or metadata variants. See items-1.13.2.md for sources.
const FOOD_NAMES = new Set(`apple mushroom_stew bread porkchop cooked_porkchop golden_apple enchanted_golden_apple
  cod salmon tropical_fish pufferfish cooked_cod cooked_salmon cookie melon_slice beef cooked_beef chicken cooked_chicken
  rotten_flesh spider_eye carrot potato baked_potato poisonous_potato golden_carrot pumpkin_pie rabbit cooked_rabbit
  rabbit_stew mutton cooked_mutton chorus_fruit beetroot beetroot_soup dried_kelp honey_bottle`.split(/\s+/));
const SWORDS = new Set(['iron_sword', 'wooden_sword', 'stone_sword', 'diamond_sword', 'golden_sword','netherite_sword']);
const POTIONS = new Set(['potion', 'splash_potion', 'lingering_potion', 'tipped_arrow']);
const RARITY_UNCOMMON = new Set(`experience_bottle nether_star enchanted_book elytra dragon_breath totem_of_undying
  heart_of_the_sea skeleton_skull wither_skeleton_skull player_head zombie_head creeper_head dragon_head`.split(/\s+/));
const RARITY_RARE = new Set(['golden_apple', 'end_crystal', 'beacon', 'conduit']);
const RARITY_EPIC = new Set(['enchanted_golden_apple', 'dragon_egg', 'command_block', 'chain_command_block', 'repeating_command_block', 'structure_block']);
const SINGLE_LEVEL = new Set(`aqua_affinity binding_curse silk_touch flame infinity channeling mending vanishing_curse`.split(' '));
const resource = (name) => name.includes(':') ? name : 'minecraft:' + name;
const translationKey = (kind, name) => kind + '.' + resource(name).replace(':', '.');
// Additions to the existing name-keyed potion/effect tables, verified against the 1.13.2 jar.
const POTION_ADDITIONS = {
  strong_slowness: { name: 'slowness', effects: [[2, 400, 3]] },
  turtle_master: { name: 'turtle_master', effects: [[2, 400, 3], [11, 400, 2]] },
  long_turtle_master: { name: 'turtle_master', effects: [[2, 800, 3], [11, 800, 2]] },
  strong_turtle_master: { name: 'turtle_master', effects: [[2, 400, 5], [11, 400, 3]] },
  slow_falling: { name: 'slow_falling', effects: [[28, 1800, 0]] },
  long_slow_falling: { name: 'slow_falling', effects: [[28, 4800, 0]] },
};
const EFFECT_ADDITIONS = {
  28: { key: 'minecraft:slow_falling', color: 16773073, bad: false, modifiers: [] },
  29: { key: 'minecraft:conduit_power', color: 1950417, bad: false, modifiers: [] },
  30: { key: 'minecraft:dolphins_grace', color: 8954814, bad: false, modifiers: [] },
};
const EGG_ADDITIONS = {
  cod: [12691306, 15058059], dolphin: [2243405, 16382457], drowned: [9433559, 7969893],
  phantom: [4411786, 8978176], pufferfish: [16167425, 3654642], salmon: [10489616, 951412],
  tropical_fish: [15690005, 16775663], turtle: [15198183, 44975],
};

export class Items {
  constructor(assets) {
    this.assets = assets;
    // Only item definitions belong here: block IDs and item IDs are different registries.
    this.byId = new Map(assets.data.items.map(d => [d.id, d]));
    this.byName = new Map(assets.data.items.map(d => [d.name, d]));
    this.maps = new Map();
    this.effects = { ...EFFECT_ADDITIONS, ...assets.data.creative.effects };
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

  isDamageable(item) { return !!item && this.maxDurability(item.id) > 0 && !this.nbt(item)?.Unbreakable; }

  // Flattened slots have no damage field on the wire. It is the stack's Damage NBT, not a variant selector.
  damage(item) { return Math.max(0, this.nbt(item)?.Damage | 0); }

  nbt(item) {
    if (item?._renderTag !== undefined) return item._renderTag; // Simplified block-entity display stack; never sent as an inventory stack.
    if (!item || !item.nbt) return null;
    if (!item._simple || item._simpleFor !== item.nbt) {
      item._simple = simplify(item.nbt) || {};
      item._simpleFor = item.nbt;
    }
    return item._simple;
  }

  // ItemStack.getDisplayName: custom name, else the translated item name
  displayName(item) {
    const tag = this.nbt(item);
    if (tag && tag.display && typeof tag.display.Name === 'string') return chatToLegacy(tag.display.Name);
    const d = this.def(item.id);
    if (!d) return 'Unknown (' + item.id + ')';
    if (d.name === 'written_book' && tag && tag.title) return tag.title;
    if (d.name === 'player_head' && tag && tag.SkullOwner) {
      const owner = typeof tag.SkullOwner === 'string' ? tag.SkullOwner : tag.SkullOwner.Name;
      if (owner) return this.assets.translate('block.minecraft.player_head.named', [owner]);
    }
    if (POTIONS.has(d.name)) return this.potionName(item);
    if(d.name==='compass'&&tag&&(Object.hasOwn(tag,'LodestonePos')||Object.hasOwn(tag,'LodestoneDimension')))return this.assets.translate('item.minecraft.lodestone_compass');
    const key = translationKey(this.isBlockItem(item.id) ? 'block' : 'item', d.name);
    const translated = this.assets.translate(key);
    return translated === key ? d.displayName : translated;
  }

  potionName(item) { return this.assets.translate(translationKey('item', this.name(item.id)) + '.effect.' + this.potionType(item).name); }

  // 1.9+ potions, splash / lingering potions and tipped arrows: the PotionType in tag "Potion" (client/data/creative.json,
  // read from the game) plus CustomPotionEffects (PotionUtils.getEffectsFromStack)
  potionType(item) {
    const tag = this.nbt(item);
    const P = this.assets.data.creative.potions;
    let n = tag && typeof tag.Potion === 'string' ? tag.Potion : '';
    if (n && !n.includes(':')) n = 'minecraft:' + n;
    return POTION_ADDITIONS[n.replace(/^minecraft:/, '')] || P[n] || P['minecraft:empty'];
  }

  potionEffects(item) {
    const out = this.potionType(item).effects.map(([id, duration, amplifier]) => ({ id, duration, amplifier, particles: true }));
    const tag = this.nbt(item);
    if (tag && Array.isArray(tag.CustomPotionEffects)) {
      for (const e of tag.CustomPotionEffects) {
        if (!this.effects[e.Id & 255]) continue; // PotionEffect.readCustomPotionEffectFromNBT
        out.push({ id: e.Id & 255, amplifier: e.Amplifier | 0, duration: e.Duration | 0, particles: e.ShowParticles === undefined ? true : !!e.ShowParticles });
      }
    }
    return out;
  }

  // PotionUtils.getColor
  potionColor(item) {
    const tag = this.nbt(item);
    if (tag && typeof tag.CustomPotionColor === 'number') return tag.CustomPotionColor;
    if (this.potionType(item).name === 'empty') return 0xf800f8;
    return this.effectsColor(this.potionEffects(item));
  }

  // PotionUtils.getPotionColorFromEffectList
  effectsColor(effects) {
    if (!effects.length) return 3694022;
    const E = this.effects, f32 = Math.fround;
    let r = 0, g = 0, b = 0, n = 0;
    for (const e of effects) {
      if (!e.particles) continue;
      const c = E[e.id] ? E[e.id].color : 0, l = e.amplifier + 1;
      r = f32(r + f32(f32(l * ((c >> 16) & 255)) / 255)); g = f32(g + f32(f32(l * ((c >> 8) & 255)) / 255)); b = f32(b + f32(f32(l * (c & 255)) / 255));
      n += l;
    }
    if (n === 0) return 0;
    const ch = (v) => Math.trunc(f32(f32(v / n) * 255));
    return (ch(r) << 16) | (ch(g) << 8) | ch(b);
  }

  // PotionUtils.addPotionTooltip (durationFactor: potions 1, lingering 0.25, tipped arrows 0.125)
  potionTooltip(item, lines, factor) {
    const E = this.effects;
    const t = (k, ...a) => this.assets.translate(k, a).trim();
    const effects = this.potionEffects(item), mods = [];
    if (!effects.length) lines.push('§7' + t('effect.none'));
    for (const e of effects) {
      const def = E[e.id];
      if (!def) continue;
      let s = t(translationKey('effect', def.key));
      for (const [attr, amount, op] of def.modifiers) mods.push([attr, amount * (e.amplifier + 1), op]); // getAttributeModifierAmount
      if (e.amplifier > 0) s += ' ' + t('potion.potency.' + e.amplifier);
      if (e.duration > 20) {
        // Potion.getPotionDurationString -> StringUtils.ticksToElapsedTime
        const ticks = Math.floor(Math.fround(e.duration * factor)), sec = Math.floor(ticks / 20), m = Math.floor(sec / 60), r = sec % 60;
        s += ' (' + (e.duration >= 32767 && e.maxDuration ? '**:**' : m + ':' + (r < 10 ? '0' : '') + r) + ')';
      }
      lines.push((def.bad ? '§c' : '§9') + s);
    }
    if (!mods.length) return;
    lines.push('');
    lines.push('§5' + t('potion.whenDrank'));
    const fmt = (d) => String(Math.round(d * 100) / 100); // ItemStack.DECIMALFORMAT "#.##"
    for (const [attr, amount, op] of mods) {
      const d = op === 1 || op === 2 ? amount * 100 : amount;
      if (amount > 0) lines.push('§9' + t('attribute.modifier.plus.' + op, fmt(d), t('attribute.name.' + attr)));
      else if (amount < 0) lines.push('§c' + t('attribute.modifier.take.' + op, fmt(-d), t('attribute.name.' + attr)));
    }
  }

  // The flattened egg determines its default entity; EntityTag can override the spawn type.
  eggEntity(item) {
    const tag = this.nbt(item);
    let id = tag && tag.EntityTag && typeof tag.EntityTag.id === 'string' ? tag.EntityTag.id : null;
    if (id && !id.includes(':')) id = 'minecraft:' + id;
    const name = this.name(item.id);
    return id || (name.endsWith('_spawn_egg') ? 'minecraft:' + name.slice(0, -10) : null);
  }

  // EntityList.ENTITY_EGGS: [primary, secondary, translation name] or null
  eggInfo(item) {
    // ItemColors uses the egg item's own colours, even when EntityTag changes what it spawns.
    const name = this.name(item.id).replace(/_spawn_egg$/, '');
    const oldName = { evoker: 'evocation_illager', vindicator: 'vindication_illager' }[name] || name;
    return this.assets.data.creative.eggs['minecraft:' + name] || EGG_ADDITIONS[name] || this.assets.data.creative.eggs['minecraft:' + oldName] || null;
  }

  enchantments(item) {
    const tag = this.nbt(item);
    if (!tag) return [];
    const list = this.name(item.id) === 'enchanted_book' ? tag.StoredEnchantments : tag.Enchantments;
    return Array.isArray(list) ? list.filter(e => typeof e.id === 'string').map(e => ({ id: resource(e.id), lvl: e.lvl | 0 })) : [];
  }

  isEnchanted(item) {
    if (!item) return false;
    if (['enchanted_book', 'enchanted_golden_apple', 'experience_bottle', 'nether_star'].includes(this.name(item.id))) return true;
    return this.enchantments(item).length > 0;
  }

  // ItemStack.hasEffect (the glint): enchanted items, plus ItemPotion.hasEffect for potions with any effect (splash and
  // lingering potions too)
  hasEffect(item) {
    if (!item) return false;
    const tag=this.nbt(item);if(this.name(item.id)==='compass'&&tag&&(Object.hasOwn(tag,'LodestonePos')||Object.hasOwn(tag,'LodestoneDimension')))return true;
    if (['potion', 'splash_potion', 'lingering_potion'].includes(this.name(item.id)) && this.potionEffects(item).length) return true;
    return this.isEnchanted(item);
  }

  // Enchantment.getTranslatedName: curses in red, the level unless a single-level enchantment at level 1
  enchantmentName(id, level) {
    const definition = this.assets.data.enchantments.find(e => typeof id === 'number' ? e.id === id : resource(e.name) === resource(id));
    const name = typeof id === 'number' ? definition?.name : id;
    if (!name) return this.assets.translate('enchantment.unknown', [id]);
    const short = name.replace(/^minecraft:/, '');
    let s = this.assets.translate(translationKey('enchantment', name));
    if (short === 'binding_curse' || short === 'vanishing_curse') s = '§c' + s;
    const key = 'enchantment.level.' + level, translated = this.assets.translate(key);
    return level === 1 && (definition ? definition.maxLevel === 1 : SINGLE_LEVEL.has(short)) ? s : s + ' ' + (translated === key ? level : translated);
  }

  enchantLevel(item, id) {
    if (!item) return 0;
    // Numeric IDs use this target registry; gameplay callers use resource names.
    const name = typeof id === 'number' ? this.assets.data.enchantments.find(e => e.id === id)?.name : id;
    const e = name && this.enchantments(item).find((x) => x.id === resource(name));
    return e ? e.lvl : 0;
  }

  tooltip(item, advanced = false) {
    const lines = [];
    let name = this.displayName(item);
    const tag = this.nbt(item);
    const registryName = this.name(item.id), damage = this.damage(item);
    const hasCustom = tag && tag.display && typeof tag.display.Name === 'string';
    let rarity = RARITY_EPIC.has(registryName) ? 3 : RARITY_RARE.has(registryName) || registryName.startsWith('music_disc_') ? 2 : RARITY_UNCOMMON.has(registryName) ? 1 : 0;
    if (this.enchantments(item).length) rarity = rarity < 2 ? 2 : 3;
    const color = ['', '§e', '§b', '§d'][rarity];
    if (hasCustom) name = chatToLegacy(tag.display.Name, { style: { italic: true, color: ['white', 'yellow', 'aqua', 'light_purple'][rarity] } });
    lines.push(color + name);
    const t = (k, ...a) => this.assets.translate(k, a);
    // Item.addInformation: ItemPotion (and splash), ItemLingeringPotion, ItemTippedArrow
    if (registryName === 'potion' || registryName === 'splash_potion') this.potionTooltip(item, lines, 1);
    else if (registryName === 'lingering_potion') this.potionTooltip(item, lines, 0.25);
    else if (registryName === 'tipped_arrow') this.potionTooltip(item, lines, 0.125);
    if (tag && tag.author && registryName === 'written_book') lines.push('§7' + t('book.byAuthor', tag.author));
    if (registryName.startsWith('music_disc_')) lines.push('§7' + t(translationKey('item', registryName) + '.desc'));
    if (!(tag?.HideFlags & 1)) for (const e of this.enchantments(item)) lines.push('§7' + this.enchantmentName(e.id, e.lvl));
    if (tag && tag.display) {
      if (tag.display.color !== undefined && registryName.startsWith('leather_')) {
        lines.push(advanced ? '§7Color: #' + tag.display.color.toString(16).toUpperCase() : '§7§o' + t('item.dyed'));
      }
      if (Array.isArray(tag.display.Lore)) for (const l of tag.display.Lore) {
        try { lines.push(chatToLegacy(JSON.parse(l), { parsed: true, style: { color: 'dark_purple', italic: true } })); } catch { /* Native tooltips ignore malformed JSON lore. */ }
      }
    }
    const weapon = { iron_sword: 6, wooden_sword: 4, stone_sword: 5, diamond_sword: 7, golden_sword: 4,
      iron_axe: 9, wooden_axe: 7, stone_axe: 9, diamond_axe: 9, golden_axe: 7,
      iron_shovel: 4.5, wooden_shovel: 2.5, stone_shovel: 3.5, diamond_shovel: 5.5, golden_shovel: 2.5,
      iron_pickaxe: 4, wooden_pickaxe: 2, stone_pickaxe: 3, diamond_pickaxe: 5, netherite_sword:8,netherite_axe:10,netherite_pickaxe:6,netherite_shovel:6.5, golden_pickaxe: 2, trident: 9 };
    if (!(tag?.HideFlags & 2) && weapon[registryName] !== undefined) {
      const sharp = this.enchantLevel(item, 'sharpness');
      const dmg = weapon[registryName] + (sharp > 0 ? 0.5 * sharp + 0.5 : 0);
      lines.push('');
      lines.push('§9' + t('attribute.modifier.plus.0', String(Math.round(dmg * 100) / 100), t('attribute.name.generic.attackDamage')));
    }
    if (advanced && this.isDamageable(item) && damage > 0) {
      lines.push(t('item.durability', this.maxDurability(item.id) - damage, this.maxDurability(item.id)));
    }
    if (advanced) lines.push('§8' + resource(registryName));
    return lines;
  }

  // Use action: 'none' | 'eat' | 'drink' | 'block' | 'bow' | 'spear'
  useAction(item) {
    if (!item) return 'none';
    const native = this.assets.data.creative.itemMechanics?.[item.id];
    if (native) return native.action;
    // 1.9+: potions are always drinkable (splash / lingering are separate items), swords no longer block, shields do
    const name = this.name(item.id);
    if (name === 'potion' || name === 'milk_bucket') return 'drink';
    if (FOOD_NAMES.has(name)) return 'eat';
    if (name === 'shield') return 'block';
    if (name === 'bow') return 'bow';
    if (name === 'trident') return 'spear';
    return 'none';
  }

  useDuration(item) {
    if (!item) return 0;
    if (this.name(item.id) === 'crossbow') return this.crossbowChargeDuration(item) + 3;
    const native = this.assets.data.creative.itemMechanics?.[item.id];
    if (native) return native.duration;
    const a = this.useAction(item);
    if (a === 'eat' || a === 'drink') return this.name(item.id) === 'dried_kelp' ? 16 : 32;
    if (a === 'block' || a === 'bow' || a === 'spear') return 72000;
    return 0;
  }

  isFood(item) { return !!item && (this.assets.data.creative.itemMechanics?.[item.id]?.food ?? FOOD_NAMES.has(this.name(item.id))); }
  canAlwaysEat(item) { return !!this.assets.data.creative.itemMechanics?.[item?.id]?.alwaysEat; }
  crossbowChargeDuration(item) { return 25 - 5 * this.enchantLevel(item, 'quick_charge'); }
  crossbowCharged(item) { return !!this.nbt(item)?.Charged; }

  // ItemTool.getStrVsBlock
  strVsBlock(item, blockDef) {
    if (!item) return 1;
    const name = this.name(item.id),native=this.assets.data.creative.toolSpeeds?.[item.id];
    if(native)return native[blockDef.name]??1;
    if (name === 'shears') {
      if (blockDef.name === 'cobweb' || blockDef.material === 'leaves') return 15;
      if (blockDef.material === 'wool') return 5;
      return 1;
    }
    if (SWORDS.has(name)) {
      if (blockDef.name === 'cobweb') return 15;
      const m = blockDef.material;
      if (m === 'plant' || m === 'leaves' || blockDef.name === 'vine' || blockDef.name === 'pumpkin' || blockDef.name === 'melon') return 1.5;
      return 1;
    }
    // materials.json still has 1.12 numeric keys. Express the same tool/material rules by registry names.
    const tool = /^(wooden|stone|iron|diamond|golden|netherite)_(pickaxe|axe|shovel)$/.exec(name);
    if (tool && ({ pickaxe: ['rock'], axe: ['wood', 'plant'], shovel: ['dirt'] }[tool[2]]).includes(blockDef.material)) {
      return { wooden: 2, stone: 4, iron: 6, diamond: 8, golden: 12, netherite: 9 }[tool[1]];
    }
    return 1;
  }

  canHarvest(item, blockDef) {
    if (!blockDef.harvestTools) return true;
    return !!(item && blockDef.harvestTools[item.id]);
  }

  blockFor(id) {
    const d = this.def(id);
    // Wheat is harvested grain, not the identically named crop block (wheat_seeds plants that).
    return d && d.name !== 'air' && d.name !== 'wheat' ? blocksByName[d.name] || null : null;
  }

  isBlockItem(id) { return !!this.blockFor(id); }

  updateMap(p) {
    let m = this.maps.get(p.itemDamage);
    if (!m) { m = { colors: new Uint8Array(128 * 128), icons: [], scale: p.scale, version: 0 }; this.maps.set(p.itemDamage, m); }
    m.scale = p.scale;
    m.locked = !!p.locked;
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

export { SWORDS, FOOD_NAMES };
