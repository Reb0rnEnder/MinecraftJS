import { appendAdventureTooltips } from './adventure-tooltip.js';
import { itemComponentValues774, COMPONENT_IDS } from '../net/item-components-1.21.11.js';
import { ITEM_DATA_774 } from './item-data-1.21.11.js';
import { isBundleItem, bundleContents, bundleContentWeight, bundleSelectedIndex } from './bundle.js';
import { simplify } from '../net/nbt.js';
import { blocksByName } from '../world/blocks.js';
import { chatToLegacy } from '../gui/chat.js';

// Item metadata helpers: names, tooltips, stack sizes, durability, use actions, tool speeds.
const FOOD_NAMES = new Set(`apple mushroom_stew bread porkchop cooked_porkchop golden_apple enchanted_golden_apple
  cod salmon tropical_fish pufferfish cooked_cod cooked_salmon cookie melon_slice beef cooked_beef chicken cooked_chicken
  rotten_flesh spider_eye carrot potato baked_potato poisonous_potato golden_carrot pumpkin_pie rabbit cooked_rabbit
  rabbit_stew mutton cooked_mutton chorus_fruit beetroot beetroot_soup dried_kelp honey_bottle`.split(/\s+/));
const SWORDS = new Set(['iron_sword', 'wooden_sword', 'stone_sword', 'copper_sword', 'diamond_sword', 'golden_sword', 'netherite_sword']);
const POTIONS = new Set(['potion', 'splash_potion', 'lingering_potion', 'tipped_arrow']);
const SINGLE_LEVEL = new Set(`aqua_affinity binding_curse silk_touch flame infinity channeling mending vanishing_curse`.split(' '));
const attributeKey = (name) => 'attribute.name.' + String(name).replace(/^minecraft:/, '');
const resource = (name) => name.includes(':') ? name : 'minecraft:' + name;
const translationKey = (kind, name) => kind + '.' + resource(name).replace(':', '.');

function hiddenSetOf(c) {
  const td = c.tooltip_display;
  const arr = td?.hiddenComponents ?? td?.hidden_components;
  if (!Array.isArray(arr) || !arr.length) return null;
  const set = new Set();
  for (const v of arr) {
    set.add(v);
    if (typeof v === 'string') {
      const bare = v.replace(/^minecraft:/, '');
      set.add(bare);
      if (COMPONENT_IDS[bare] !== undefined) set.add(COMPONENT_IDS[bare]);
    } else if (typeof v === 'number') {
      set.add(v);
    }
  }
  return set;
}

export class Items {
  constructor(assets, player = null) {
    this.player = player;
    this.assets = assets;
    // Only item definitions belong here: block IDs and item IDs are different registries.
    this.byId = new Map(assets.data.items.map((d) => [d.id, d]));
    this.byName = new Map(assets.data.items.map((d) => [d.name, d]));
    this.maps = new Map();
    this.effects = ITEM_DATA_774.effects;
  }

  def(id) { return this.byId.get(id) || null; }

  name(id) { const d = this.def(id); return d ? d.name : 'unknown'; }

  components(item) { return itemComponentValues774(item); }
  component(item, type) { return this.components(item)[type]; }
  maxStack(item) { return this.component(item, 'max_stack_size') ?? 1; }
  maxDurability(item) { return this.component(item, 'max_damage') ?? 0; }
  isDamageable(item) {
    const c = this.components(item);
    return !!item && c.max_damage !== undefined && c.damage !== undefined && !(Object.hasOwn(c, 'unbreakable') && c.unbreakable !== false);
  }
  damage(item) { return Math.max(0, Math.min(this.maxDurability(item), this.component(item, 'damage') ?? 0)); }
  rarity(item) {
    const base = this.component(item, 'rarity') ?? 'common';
    if (!this.enchantments(item, false).length) return base;
    return base === 'common' || base === 'uncommon' ? 'rare' : base === 'rare' ? 'epic' : base;
  }

  nbt(item) {
    if (item?._renderTag !== undefined) return item._renderTag;
    if (!item || !item.nbt) return null;
    if (!item._simple || item._simpleFor !== item.nbt) {
      item._simple = simplify(item.nbt) || {};
      item._simpleFor = item.nbt;
    }
    return item._simple;
  }

  // ItemStack.getDisplayName: custom_name, patched item_name, else special or translated item name
  displayName(item) {
    const c = this.components(item);
    const patchedItemName = item?.effectiveComponents?.item_name?.source === 'patch' ? c.item_name : undefined;
    if (c.custom_name !== undefined) return chatToLegacy(c.custom_name, { parsed: true });
    if (patchedItemName !== undefined) {
      if (patchedItemName?.translate && !patchedItemName.with && !patchedItemName.extra) {
        return this.assets.translate(patchedItemName.translate, patchedItemName.with || []);
      }
      return chatToLegacy(patchedItemName, { parsed: true });
    }
    const d = this.def(item.id);
    if (!d) return 'Unknown (' + item.id + ')';
    if (d.name === 'written_book' && c.written_book_content?.title) {
      const title = c.written_book_content.title;
      return typeof title === 'string' ? title : title.content ?? title.raw ?? '';
    }
    if (d.name === 'player_head' && c.profile?.name) {
      return this.assets.translate('block.minecraft.player_head.named', [c.profile.name]);
    }
    if (POTIONS.has(d.name)) return this.potionName(item);
    if (d.name === 'compass' && c.lodestone_tracker !== undefined) {
      return this.assets.translate('item.minecraft.lodestone_compass');
    }
    const key = translationKey(this.isBlockItem(item.id) ? 'block' : 'item', d.name);
    const translated = this.assets.translate(key);
    return translated === key ? d.displayName : translated;
  }

  potionName(item) {
    return this.assets.translate(translationKey('item', this.name(item.id)) + '.effect.' + this.potionType(item).name);
  }

  potionType(item) {
    const c = this.component(item, 'potion_contents') || {};
    const id = c.potionId;
    if (id !== undefined && id !== null) return ITEM_DATA_774.potions[id] || { name: 'empty', effects: [] };
    return Object.values(ITEM_DATA_774.potions).find((p) => p.key === c.potion) || { name: 'empty', effects: [] };
  }

  potionEffects(item) {
    const c = this.component(item, 'potion_contents') || {};
    const base = this.potionType(item).effects.map((e) => ({ ...e }));
    for (const e of c.customEffects || c.custom_effects || []) {
      const d = e.details || e;
      const raw = e.id;
      const id = typeof raw === 'number'
        ? raw
        : Number(Object.entries(ITEM_DATA_774.registries.mob_effect).find(([, name]) => name === resource(raw))?.[0]);
      if (this.effects[id]) {
        base.push({
          id,
          duration: d.duration ?? 0,
          amplifier: d.amplifier ?? 0,
          particles: d.showParticles ?? d.show_particles ?? true,
          ambient: d.ambient ?? false
        });
      }
    }
    return base;
  }

  potionColor(item) {
    const c = this.component(item, 'potion_contents') || {};
    return c.customColor ?? c.custom_color ?? this.effectsColor(this.potionEffects(item));
  }

  effectsColor(effects) {
    let r = 0, g = 0, b = 0, n = 0;
    for (const e of effects) {
      if (e.particles === false) continue;
      const c = this.effects[e.id]?.color ?? 0;
      const w = e.amplifier + 1;
      r += w * ((c >> 16) & 255);
      g += w * ((c >> 8) & 255);
      b += w * (c & 255);
      n += w;
    }
    return n ? ((Math.trunc(r / n) << 16) | (Math.trunc(g / n) << 8) | Math.trunc(b / n)) : 0x385dc6;
  }

  // PotionContents.addPotionTooltip (durationFactor: potions 1, lingering 0.25, tipped arrows 0.125)
  potionTooltip(item, lines, factor) {
    const E = this.effects;
    const t = (k, ...a) => this.assets.translate(k, a).trim();
    const effects = this.potionEffects(item), mods = [];
    if (!effects.length) lines.push('§7' + t('effect.none'));
    for (const e of effects) {
      const def = E[e.id];
      if (!def) continue;
      let s = t(translationKey('effect', def.key));
      for (const [attr, amount, op] of def.modifiers) mods.push([attr, amount * (e.amplifier + 1), op]);
      if (e.amplifier > 0) s = t('potion.withAmplifier', s, t('potion.potency.' + e.amplifier));
      if (e.duration > 20 || e.duration === -1) {
        const ticks = Math.floor(Math.fround(e.duration * factor));
        const sec = Math.floor(ticks / 20), m = Math.floor(sec / 60), r = sec % 60;
        const hours = Math.floor(m / 60);
        const time = e.duration === -1
          ? t('effect.duration.infinite')
          : (hours ? String(hours).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') : String(m).padStart(2, '0')) + ':' + String(r).padStart(2, '0');
        s = t('potion.withDuration', s, time);
      }
      lines.push((def.bad ? '§c' : '§9') + s);
    }
    if (!mods.length) return;
    lines.push('');
    lines.push('§5' + t('potion.whenDrank'));
    const fmt = (d) => String(Math.round(d * 100) / 100);
    for (const [attr, amount, op] of mods) {
      const d = op === 1 || op === 2 ? amount * 100 : amount;
      if (amount > 0) lines.push('§9' + t('attribute.modifier.plus.' + op, fmt(d), t(attributeKey(attr))));
      else if (amount < 0) lines.push('§c' + t('attribute.modifier.take.' + op, fmt(-d), t(attributeKey(attr))));
    }
  }

  eggEntity(item) {
    const entity = this.component(item, 'entity_data');
    const data = entity ? (entity.t ? simplify(entity) : entity) : null;
    let id = typeof data?.id === 'string' ? data.id : null;
    if (id && !id.includes(':')) id = 'minecraft:' + id;
    const name = this.name(item.id);
    return id || (name.endsWith('_spawn_egg') ? 'minecraft:' + name.slice(0, -10) : null);
  }

  eggInfo(item) {
    return ITEM_DATA_774.eggs[resource(this.name(item.id))] || null;
  }

  enchantments(item, stored = this.name(item?.id) === 'enchanted_book') {
    if (!item) return [];
    const c = this.component(item, stored ? 'stored_enchantments' : 'enchantments');
    if (!c) return [];
    if (Array.isArray(c.enchantments)) {
      return this.sortEnchantments(
        c.enchantments.map((e) => ({ id: ITEM_DATA_774.registries.enchantment[e.id], lvl: e.level })).filter((e) => e.id)
      );
    }
    const map = c.levels ?? c;
    if (map && typeof map === 'object') {
      return this.sortEnchantments(Object.entries(map).map(([id, lvl]) => ({ id: resource(id), lvl })));
    }
    return [];
  }

  sortEnchantments(list) {
    const order = ITEM_DATA_774.enchantmentOrder.map((id) => ITEM_DATA_774.registries.enchantment[id]);
    return list.sort((a, b) => {
      const ai = order.indexOf(a.id), bi = order.indexOf(b.id);
      return (ai < 0 ? Infinity : ai) - (bi < 0 ? Infinity : bi);
    });
  }

  isEnchanted(item) { return !!item && this.enchantments(item, false).length > 0; }

  hasEffect(item) {
    if (!item) return false;
    const c = this.components(item);
    if (c.enchantment_glint_override !== undefined) return !!c.enchantment_glint_override;
    return (this.name(item.id) === 'compass' && c.lodestone_tracker !== undefined) || this.isEnchanted(item);
  }

  enchantmentName(id, level) {
    const definition = this.assets.data.enchantments.find((e) => typeof id === 'number' ? e.id === id : resource(e.name) === resource(id));
    const name = typeof id === 'number' ? definition?.name : id;
    if (!name) return this.assets.translate('enchantment.unknown', [id]);
    const short = name.replace(/^minecraft:/, '');
    let s = this.assets.translate(translationKey('enchantment', name));
    if (short === 'binding_curse' || short === 'vanishing_curse') s = '§c' + s;
    const key = 'enchantment.level.' + level, translated = this.assets.translate(key);
    return level === 1 && (definition ? definition.maxLevel === 1 : SINGLE_LEVEL.has(short))
      ? s
      : s + ' ' + (translated === key ? level : translated);
  }

  enchantLevel(item, id) {
    if (!item) return 0;
    const name = typeof id === 'number' ? this.assets.data.enchantments.find((e) => e.id === id)?.name : id;
    const e = name && this.enchantments(item, false).find((x) => x.id === resource(name));
    return e ? e.lvl : 0;
  }

  _hornDescription(c) {
    const inst = c.instrument;
    if (!inst) return null;
    if (typeof inst === 'string') return this.assets.translate('instrument.' + resource(inst).replace(':', '.'));
    if (inst.hasHolder === false && typeof inst.data === 'string') {
      return this.assets.translate('instrument.' + resource(inst.data).replace(':', '.'));
    }
    const holder = inst.hasHolder ? inst.data : inst;
    if (holder?.data?.description !== undefined) {
      const desc = holder.data.description?.t ? simplify(holder.data.description) : holder.data.description;
      return chatToLegacy(typeof desc === 'string' ? { text: desc } : desc, { parsed: true });
    }
    const id = holder?.instrumentId ?? inst.instrumentId;
    const meta = id !== undefined ? ITEM_DATA_774.instruments[id] : null;
    return meta ? this.assets.translate('instrument.' + meta.key.replace(':', '.')) : null;
  }

  tooltip(item, advanced = false, creative = false) {
    const c = this.components(item);
    const td = c.tooltip_display;
    const hideAll = !!(td?.hideTooltip || td?.hide_tooltip || Object.hasOwn(c, 'hide_tooltip'));
    if (!creative && hideAll) return [];
    const hidden = hiddenSetOf(c);
    const shows = (key) => !hideAll && (!hidden || (!hidden.has(key) && !hidden.has('minecraft:' + key) && !hidden.has(COMPONENT_IDS[key])));

    const rarity = this.rarity(item);
    const color = { common: 'white', uncommon: 'yellow', rare: 'aqua', epic: 'light_purple' }[rarity] || 'white';
    const patchedItemName = item?.effectiveComponents?.item_name?.source === 'patch' ? c.item_name : undefined;
    const rawName = c.custom_name ?? patchedItemName ?? { text: this.displayName(item) };
    const name = rawName?.translate && !rawName.with && !rawName.extra
      ? { ...rawName, translate: undefined, text: this.assets.translate(rawName.translate) }
      : rawName;
    const lines = [chatToLegacy(name, { parsed: true, style: { color, ...(c.custom_name !== undefined ? { italic: true } : {}) } })];
    const t = (key, ...args) => this.assets.translate(key, args);
    const registryName = this.name(item.id);

    if (POTIONS.has(registryName) && shows('potion_contents')) {
      this.potionTooltip(item, lines, registryName === 'lingering_potion' ? 0.25 : registryName === 'tipped_arrow' ? 0.125 : 1);
    }
    if (isBundleItem(item, this) && shows('bundle_contents')) {
      const weight = bundleContentWeight(item, this);
      lines.push('§7' + t('item.minecraft.bundle.fullness', weight, 64));
      lines.bundleTooltip = { items: bundleContents(item, this), weight, selectedIndex: bundleSelectedIndex(item) };
    }
    const book = c.written_book_content;
    if (registryName === 'written_book' && book?.author && shows('written_book_content')) {
      lines.push('§7' + t('book.byAuthor', book.author));
    }
    if (registryName.startsWith('music_disc_') && shows('jukebox_playable')) {
      lines.push('§7' + t(translationKey('item', registryName) + '.desc'));
    }
    if (registryName === 'goat_horn' && shows('instrument')) {
      const desc = this._hornDescription(c);
      if (desc) lines.push('§7' + desc);
    }
    if (registryName === 'crossbow' && shows('charged_projectiles') && this.chargedProjectiles(item).length) {
      const projectiles = this.chargedProjectiles(item);
      const projectile = projectiles[0];
      const single = t('item.minecraft.crossbow.projectile.single', '[' + this.displayName(projectile) + ']');
      lines.push(single !== 'item.minecraft.crossbow.projectile.single'
        ? single
        : t('item.minecraft.crossbow.projectile') + ' [' + this.displayName(projectile) + ']');
      if (this.name(projectile.id) === 'firework_rocket') {
        const more = [];
        this.rocketTooltip(this.component(projectile, 'fireworks'), more);
        lines.push(...more.map((s) => '§7  ' + s));
      }
    }
    if (registryName === 'firework_rocket' && shows('fireworks')) this.rocketTooltip(c.fireworks, lines);
    if (registryName === 'filled_map' && c.map_id !== undefined && !this.maps.has(c.map_id) && shows('map_id')) {
      lines.push('§7' + t('filled_map.unknown'));
    }
    if (registryName === 'firework_star' && c.firework_explosion && shows('firework_explosion')) {
      this.fireworkTooltip(c.firework_explosion, lines);
    }

    for (const [stored, compKey] of [[true, 'stored_enchantments'], [false, 'enchantments']]) {
      const enchant = this.component(item, compKey);
      if (enchant && shows(compKey) && (enchant.show_in_tooltip ?? enchant.showInTooltip ?? enchant.showTooltip ?? true)) {
        for (const e of this.enchantments(item, stored)) {
          const formatted = this.enchantmentName(e.id, e.lvl);
          lines.push(formatted.startsWith('§c') ? formatted : '§7' + formatted);
        }
      }
    }

    const dye = c.dyed_color;
    if (dye !== undefined && dye !== null && shows('dyed_color') && (dye.show_in_tooltip ?? dye.showTooltip ?? true)) {
      const rgb = typeof dye === 'number' ? dye : (dye.rgb ?? dye.color ?? 0);
      lines.push(advanced ? '§7' + t('item.color', '#' + (rgb & 0xffffff).toString(16).toUpperCase().padStart(6, '0')) : '§7§o' + t('item.dyed'));
    }

    if (shows('lore')) {
      for (const line of c.lore || []) {
        lines.push(chatToLegacy(line, { parsed: true, style: { color: 'dark_purple', italic: true } }));
      }
    }

    if (shows('attribute_modifiers')) this.attributeTooltip(item, lines);

    if (Object.hasOwn(c, 'unbreakable') && c.unbreakable !== false && shows('unbreakable') &&
        (typeof c.unbreakable !== 'object' || c.unbreakable === null || (c.unbreakable.show_in_tooltip ?? c.unbreakable.showTooltip ?? true))) {
      lines.push('§9' + t('item.unbreakable'));
    }

    appendAdventureTooltips(this, item, lines);

    if (advanced) {
      if (this.isDamageable(item) && this.damage(item) > 0 && shows('damage')) {
        lines.push(t('item.durability', this.maxDurability(item) - this.damage(item), this.maxDurability(item)));
      }
      lines.push('§8' + resource(registryName));
      const n = Object.keys(c).length;
      if (n) lines.push('§8' + t('item.components', n));
    }
    return lines;
  }

  rocketTooltip(fireworks, lines) {
    if (!fireworks) return;
    const duration = fireworks.flight_duration ?? fireworks.flightDuration ?? 0;
    if (duration > 0) lines.push('§7' + this.assets.translate('item.minecraft.firework_rocket.flight') + ' ' + duration);
    for (const explosion of fireworks.explosions || []) this.fireworkTooltip(explosion, lines);
  }

  fireworkTooltip(explosion, lines) {
    const t = (key, ...args) => this.assets.translate(key, args), base = 'item.minecraft.firework_star.';
    lines.push('§7' + t(base + 'shape.' + explosion.shape));
    const colors = (values) => values.map((c) => t(base + (ITEM_DATA_774.fireworkColors[c] || 'custom_color'))).join(', ');
    if (explosion.colors?.length) lines.push('§7' + colors(explosion.colors));
    const fade = explosion.fadeColors ?? explosion.fade_colors;
    if (fade?.length) lines.push('§7' + t(base + 'fade_to') + ' ' + colors(fade));
    if (explosion.hasTrail ?? explosion.has_trail) lines.push('§7' + t(base + 'trail'));
    if (explosion.hasTwinkle ?? explosion.has_twinkle) lines.push('§7' + t(base + 'flicker'));
  }

  attributeTooltip(item, lines) {
    const attrs = this.component(item, 'attribute_modifiers');
    if (attrs && !Array.isArray(attrs) && (attrs.show_in_tooltip ?? attrs.showTooltip ?? true) === false) return;
    const own = Array.isArray(attrs) ? attrs : (attrs?.modifiers ?? attrs?.attributes ?? []);
    const mods = own;
    if (!mods.length) return;
    const t = (key, ...args) => this.assets.translate(key, args);
    const player = typeof this.player === 'function' ? this.player() : this.player;
    const groups = ['mainhand', 'offhand', 'feet', 'legs', 'chest', 'head', 'body', 'saddle'];
    for (const group of groups) {
      const selected = mods.filter((m) => {
        if (m.display?.type === 'hidden') return false;
        const s = (m.slot ?? 'any').replace('_', '');
        return s === 'any' || s === group || (s === 'hand' && ['mainhand', 'offhand'].includes(group)) ||
          (s === 'armor' && ['feet', 'legs', 'chest', 'head'].includes(group));
      });
      if (!selected.length) continue;
      lines.push('', '§7' + t('item.modifiers.' + group));
      for (const m of selected) {
        if (m.display?.type === 'override') {
          lines.push(chatToLegacy(m.display.component, { parsed: true }));
          continue;
        }
        const type = m.type ?? ITEM_DATA_774.registries.attribute[m.typeId];
        const op = { add_value: 0, add: 0, add_multiplied_base: 1, multiply_base: 1, add_multiplied_total: 2, multiply_total: 2 }[m.operation] ?? 0;
        let value = m.amount ?? m.value;
        let equal = false;
        if (player && m.id === ITEM_DATA_774.baseAttackDamageId) {
          const baseDmg = player.attributes?.get('generic.attackDamage')?.value ?? player.attributes?.get('attack_damage')?.value ?? 1;
          const sharp = this.enchantLevel(item, 'sharpness');
          value += baseDmg + (sharp > 0 ? 0.5 * sharp + 0.5 : 0);
          equal = true;
        } else if (player && m.id === ITEM_DATA_774.baseAttackSpeedId) {
          value += player.attributes?.get('generic.attackSpeed')?.value ?? player.attributes?.get('attack_speed')?.value ?? 4;
          equal = true;
        }
        const isKbRes = type === 'minecraft:knockback_resistance' || type === 'knockback_resistance' || type === 'minecraft:generic.knockback_resistance';
        const amount = op ? value * 100 : isKbRes ? value * 10 : value;
        const fmt = Number(amount.toFixed(2)).toString();
        if (equal) lines.push('§2 ' + t('attribute.modifier.equals.' + op, fmt, t(attributeKey(type))));
        else if (value > 0) lines.push('§9' + t('attribute.modifier.plus.' + op, fmt, t(attributeKey(type))));
        else if (value < 0) lines.push('§c' + t('attribute.modifier.take.' + op, Number((-amount).toFixed(2)).toString(), t(attributeKey(type))));
      }
    }
  }

  useAction(item) {
    if (!item) return 'none';
    const c = this.components(item);
    const meta = ITEM_DATA_774.items[item.id];
    if (c.blocks_attacks !== undefined) return 'block';
    const action = meta?.action || 'none';
    if (!['none', 'eat'].includes(action)) return action;
    if (c.consumable !== undefined) return c.consumable.animation || 'eat';
    if (c.kinetic_weapon !== undefined) return 'spear';
    return 'none';
  }

  useDuration(item) {
    if (!item) return 0;
    const c = this.components(item), name = this.name(item.id), meta = ITEM_DATA_774.items[item.id];
    if (c.consumable !== undefined) {
      const sec = c.consumable.consume_seconds ?? c.consumable.consumeSeconds ?? 1.6;
      return Math.trunc(Math.fround(Math.fround(sec) * 20));
    }
    if (name === 'goat_horn') {
      const inst = c.instrument;
      const holder = inst?.hasHolder ? inst.data : inst;
      const useDur = holder?.data?.useDuration ?? holder?.data?.use_duration;
      if (useDur !== undefined) return Math.trunc(Math.fround(Math.fround(useDur) * 20));
      const id = holder?.instrumentId ?? inst?.instrumentId;
      if (id !== undefined && ITEM_DATA_774.instruments[id]) {
        return Math.trunc(Math.fround(ITEM_DATA_774.instruments[id].duration * 20));
      }
      const key = typeof inst === 'string' ? inst : inst?.hasHolder === false ? inst.data : null;
      if (key) {
        const found = Object.values(ITEM_DATA_774.instruments).find((i) => i.key === resource(key));
        if (found) return Math.trunc(Math.fround(found.duration * 20));
      }
      return meta?.duration ?? 0;
    }
    if (c.blocks_attacks !== undefined || c.kinetic_weapon !== undefined) return 72000;
    return meta?.action === 'eat' ? 0 : meta?.duration || 0;
  }

  isFood(item) { return !!item && this.component(item, 'food') !== undefined; }
  canAlwaysEat(item) {
    const food = this.component(item, 'food');
    return !!(food?.can_always_eat ?? food?.canAlwaysEat);
  }
  crossbowChargeDuration(item) { return 25 - 5 * this.enchantLevel(item, 'quick_charge'); }
  chargedProjectiles(item) {
    const value = this.component(item, 'charged_projectiles');
    return value?.projectiles ?? value ?? [];
  }
  crossbowCharged(item) { return this.chargedProjectiles(item).length > 0; }

  // ItemTool.getStrVsBlock + DataComponents.TOOL
  strVsBlock(item, blockDef) {
    if (!item) return 1;
    const name = this.name(item.id), native = this.assets.data.creative.toolSpeeds?.[item.id];
    if (native) return native[blockDef.name] ?? 1;
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
    const tool = /^(wooden|stone|copper|iron|diamond|golden|netherite)_(pickaxe|axe|shovel|spear)$/.exec(name);
    if (tool && ({ pickaxe: ['rock'], axe: ['wood', 'plant'], shovel: ['dirt'], spear: [] }[tool[2]]).includes(blockDef.material)) {
      return { wooden: 2, stone: 4, copper: 5, iron: 6, diamond: 8, golden: 12, netherite: 9 }[tool[1]];
    }
    return 1;
  }

  canHarvest(item, blockDef) {
    if (!blockDef.harvestTools) return true;
    return !!(item && blockDef.harvestTools[item.id]);
  }

  blockFor(id) {
    const d = this.def(id);
    return d && d.name !== 'air' && d.name !== 'wheat' ? blocksByName[d.name] || null : null;
  }

  isBlockItem(id) { return !!this.blockFor(id); }

  updateMap(p) {
    let m = this.maps.get(p.itemDamage);
    if (!m) { m = { colors: new Uint8Array(128 * 128), icons: [], scale: p.scale, version: 0 }; this.maps.set(p.itemDamage, m); }
    m.scale = p.scale;
    m.locked = !!p.locked;
    if (p.icons !== null) m.icons = p.icons;
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
