// Native 1.20.6 Item.appendHoverText overrides that the tooltip was missing (ItemStack.getTooltipLines calls them
// unless hide_additional_tooltip): MapItem, ShulkerBoxBlock, WrittenBookItem generation, SmithingTemplateItem,
// SpawnerBlock / TrialSpawnerBlock (Spawner.appendHoverText), DecoratedPotBlock, OminousBottleItem,
// BannerItem / ShieldItem patterns, BannerPatternItem and DiscFragmentItem descriptions, MobBucketItem tropical
// fish variants, HangingEntityItem paintings and SuspiciousStewItem (creative). Also ArmorTrim.addToTooltip.
import { simplify } from '../net/nbt.js';
import { registryEntries } from '../net/registry-codec.js';
import { KNOWN_PACK_766 } from '../net/known-pack-1.20.6.js';
import { componentFromNbt } from '../net/component-nbt-1.20.6.js';
import { chatToLegacy } from '../gui/chat.js';
import { ITEM_PRESENTATION_762 } from './item-presentation-1.19.4.js';

const DYES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const qualified = (id) => (String(id).includes(':') ? String(id) : 'minecraft:' + id);
const strip = (id) => String(id).replace(/^minecraft:/, '');
const nbt = (v) => (v && typeof v === 'object' && 't' in v && 'v' in v ? simplify(v) : v);
const text = (v) => (v && typeof v === 'object' && 't' in v && 'v' in v ? componentFromNbt(v) : v);

// Configuration registries (falling back to the vanilla known pack before Configuration)
const cache = new WeakMap(), fallback = {};
function entries(game, registry) {
  const source = game?.dimensionCodec;
  if (!source) return fallback[registry] ??= (KNOWN_PACK_766.registries[registry] || []).map((e, id) => ({ id, name: e.key, element: simplify(e.value) }));
  let byRegistry = cache.get(source);
  if (!byRegistry) cache.set(source, byRegistry = {});
  return byRegistry[registry] ??= registryEntries(simplify(source), registry);
}
const holderElement = (game, registry, holder, idField) => (holder?.data ? null : entries(game, registry).find((e) => e.id === holder?.[idField] || e.name === qualified(holder))?.element);

// TropicalFish.Pattern (base | index << 8) and COMMON_VARIANTS (pattern, base color, pattern color)
const FISH_PATTERNS = { 0: 'kob', 256: 'flopper', 1: 'sunstreak', 257: 'stripey', 2: 'snooper', 258: 'glitter', 3: 'dasher', 259: 'blockfish', 4: 'brinely', 260: 'betty', 5: 'spotty', 261: 'clayfish' };
const FISH_COMMON = 'stripey,orange,gray;flopper,gray,gray;flopper,gray,blue;clayfish,white,gray;sunstreak,blue,gray;kob,orange,white;spotty,pink,light_blue;blockfish,purple,yellow;clayfish,white,red;spotty,white,yellow;glitter,white,gray;clayfish,white,orange;dasher,cyan,pink;brinely,lime,light_blue;betty,red,white;snooper,gray,red;blockfish,red,white;flopper,white,yellow;kob,red,white;sunstreak,gray,white;dasher,cyan,yellow;flopper,yellow,yellow'.split(';');

// ArmorTrim.addToTooltip: "Upgrade:", then the pattern in the material's style and the material
export function trimTooltip766(items, trim, t) {
  if (!trim || (trim.showInTooltip ?? trim.show_in_tooltip ?? true) === false) return [];
  const game = items.game;
  const materialDesc = text(trim.material?.data?.description) ?? holderElement(game, 'minecraft:trim_material', trim.material, 'materialId')?.description;
  const patternDesc = text(trim.pattern?.data?.description) ?? holderElement(game, 'minecraft:trim_pattern', trim.pattern, 'patternId')?.description;
  if (!materialDesc || !patternDesc) return [];
  const style = typeof materialDesc === 'object' ? Object.fromEntries(Object.entries(materialDesc).filter(([k]) => ['color', 'bold', 'italic', 'underlined', 'strikethrough', 'obfuscated', 'font'].includes(k))) : {};
  const pattern = typeof patternDesc === 'object' ? { ...patternDesc, ...style } : { text: patternDesc, ...style };
  return ['§7' + t('item.minecraft.smithing_template.upgrade'), ' ' + chatToLegacy(pattern, { parsed: true }), ' ' + chatToLegacy(materialDesc, { parsed: true })];
}

// Banner layer description: the pattern's translation key + "." + color (BannerPatternLayers.Layer.description)
function layerName(game, layer, t) {
  const holder = layer.pattern, key = holder?.data?.translationKey ?? holder?.translation_key ?? holderElement(game, 'minecraft:banner_pattern', holder, 'patternId')?.translation_key;
  const color = typeof layer.color === 'string' ? layer.color : DYES[layer.colorId ?? layer.color];
  return key && color ? t(key + '.' + color) : null;
}

export function appendHoverText766(items, item, lines, { advanced = false, creative = false } = {}) {
  const c = items.components(item), name = items.name(item.id), game = items.game;
  const t = (key, ...args) => items.assets.translate(key, args);
  const gray = (s) => lines.push('§7' + s);
  // MapItem
  if (name === 'filled_map') {
    const id = c.map_id, data = id != null ? items.maps.get(id) : null, post = c.map_post_processing; // 0 lock, 1 scale
    if (data && (data.locked || post === 0)) gray(t('filled_map.locked', id));
    if (advanced) {
      if (data) {
        if (post == null) gray(t('filled_map.id', id));
        const scale = Math.min((data.scale ?? 0) + (post === 1 ? 1 : 0), 4);
        gray(t('filled_map.scale', 1 << scale)); gray(t('filled_map.level', scale, 4));
      } else gray(t('filled_map.unknown'));
    }
  }
  // ShulkerBoxBlock
  if (name === 'shulker_box' || name.endsWith('_shulker_box')) {
    if (c.container_loot !== undefined) lines.push(t('container.shulkerBox.unknownContents'));
    let shown = 0, total = 0;
    for (const slot of c.container?.contents ?? []) {
      if (!slot || !(slot.itemCount > 0)) continue;
      total++;
      if (shown > 4) continue;
      shown++;
      lines.push(t('container.shulkerBox.itemCount', items.displayName({ ...slot, id: slot.itemId, count: slot.itemCount }), slot.itemCount));
    }
    if (total - shown > 0) lines.push('§o' + t('container.shulkerBox.more', total - shown));
  }
  // WrittenBookItem: author (when not blank) and generation
  if (name === 'written_book' && c.written_book_content) {
    const book = c.written_book_content;
    if (book.author && book.author.trim()) gray(t('book.byAuthor', book.author));
    gray(t('book.generation.' + (book.generation ?? 0)));
  }
  // SmithingTemplateItem
  if (name.endsWith('_smithing_template')) {
    const upgrade = name === 'netherite_upgrade_smithing_template', kind = upgrade ? 'netherite_upgrade' : 'armor_trim';
    gray(upgrade ? t('upgrade.minecraft.netherite_upgrade') : t('trim_pattern.minecraft.' + name.replace(/_armor_trim_smithing_template$/, '')));
    lines.push('');
    gray(t('item.minecraft.smithing_template.applies_to'));
    lines.push(' §9' + t(`item.minecraft.smithing_template.${kind}.applies_to`));
    gray(t('item.minecraft.smithing_template.ingredients'));
    lines.push(' §9' + t(`item.minecraft.smithing_template.${kind}.ingredients`));
  }
  // Spawner.appendHoverText ("SpawnData" / "spawn_data")
  if (name === 'spawner' || name === 'trial_spawner') {
    const data = nbt(c.block_entity_data) || {}, spawn = data[name === 'spawner' ? 'SpawnData' : 'spawn_data'];
    const id = spawn && typeof spawn === 'object' ? spawn.entity?.id : null, known = id && /^([a-z0-9_.-]+:)?[a-z0-9/._-]+$/.test(id) && (items.assets.data?.entities || []).some((e) => qualified(e.name) === qualified(id));
    if (known) gray(t('entity.minecraft.' + strip(id).replace(/\//g, '.')));
    else { lines.push(''); gray(t('block.minecraft.spawner.desc1')); lines.push(' §9' + t('block.minecraft.spawner.desc2')); }
  }
  // DecoratedPotBlock: front, left, right, back; missing faces are bricks
  if (name === 'decorated_pot' && c.pot_decorations?.decorations?.length) {
    const ids = c.pot_decorations.decorations; // back, left, right, front
    lines.push('');
    for (const i of [3, 1, 2, 0]) { const id = ids[i]; gray(items.displayName({ id: id ?? items.byName.get('brick')?.id, count: 1 })); }
  }
  // OminousBottleItem: Bad Omen at the amplifier for 120000 ticks
  if (name === 'ominous_bottle') items.potionTooltip(item, lines, 1, [{ id: items.effectId?.('bad_omen'), amplifier: c.ominous_bottle_amplifier ?? 0, duration: 120000 }]);
  // BannerItem / ShieldItem: up to six layers
  if ((name.endsWith('_banner') || name === 'shield') && c.banner_patterns) {
    for (const layer of (c.banner_patterns.layers ?? c.banner_patterns).slice(0, 6)) { const s = layerName(game, layer, t); if (s) gray(s); }
  }
  // BannerPatternItem / DiscFragmentItem: the description name
  if (name.endsWith('_banner_pattern') || name === 'disc_fragment_5') gray(t('item.minecraft.' + name + '.desc'));
  // MobBucketItem (tropical fish)
  if (name === 'tropical_fish_bucket') {
    const data = nbt(c.bucket_entity_data), packed = data?.BucketVariantTag;
    if (Number.isInteger(packed)) {
      const pattern = FISH_PATTERNS[packed & 0xffff] ?? 'kob', base = DYES[(packed >> 16) & 0xff] ?? 'white', over = DYES[(packed >>> 24) & 0xff] ?? 'white';
      const common = FISH_COMMON.indexOf([pattern, base, over].join(','));
      if (common !== -1) lines.push('§7§o' + t('entity.minecraft.tropical_fish.predefined.' + common));
      else {
        lines.push('§7§o' + t('entity.minecraft.tropical_fish.type.' + pattern));
        lines.push('§7§o' + t('color.minecraft.' + base) + (base !== over ? ', ' + t('color.minecraft.' + over) : ''));
      }
    }
  }
  // HangingEntityItem (painting): variant title/author/size, or "random" in creative
  if (name === 'painting') {
    const data = nbt(c.entity_data);
    if (data && Object.keys(data).length) {
      const variant = data.variant && ITEM_PRESENTATION_762.paintings.find((p) => p.name === qualified(data.variant));
      if (variant) {
        const key = strip(variant.name);
        lines.push('§e' + t('painting.minecraft.' + key + '.title'));
        gray(t('painting.minecraft.' + key + '.author'));
        lines.push(t('painting.dimensions', Math.ceil(variant.width / 16), Math.ceil(variant.height / 16)));
      } else gray(t('painting.random'));
    } else if (creative) gray(t('painting.random'));
  }
  // SuspiciousStewItem: the stew's effects, in the creative inventory only
  if (name === 'suspicious_stew' && creative) {
    const effects = (c.suspicious_stew_effects?.effects ?? []).map((e) => ({ id: e.effect ?? items.effectId?.(e.id), amplifier: 0, duration: e.duration ?? 160 }));
    items.potionTooltip(item, lines, 1, effects);
  }
}
