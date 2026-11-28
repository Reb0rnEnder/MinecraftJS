// Native 26.3 armor trims: the trim component stores registry ids for a TrimMaterial
// (palette_id, no item index) and a TrimPattern (asset_id, decal). Worn trims use
// textures/trims/entity/<layer>/<pattern>.png recoloured from textures/palettes/trim_base.png
// with textures/palettes/<palette_id>.png. Equipment assets can override the palette for a
// matching armor material (iron trim on iron armor uses trim/iron_darker).
import { paletteMapping, applyPalette } from './paletted-permutations.js';

// TrimMaterials.bootstrap / TrimPatterns.bootstrap in the pinned 26.3 jar.
export const TRIM_MATERIALS_26_3 = ['quartz', 'iron', 'netherite', 'redstone', 'copper', 'gold', 'emerald', 'diamond', 'lapis', 'amethyst', 'resin'];
export const TRIM_PATTERNS_26_3 = ['sentry', 'dune', 'coast', 'wild', 'ward', 'eye', 'vex', 'tide', 'snout', 'rib', 'spire', 'wayfinder', 'shaper', 'silence', 'raiser', 'host', 'flow', 'bolt'];
const DARKER_PALETTES = new Set(['iron', 'netherite', 'copper', 'gold', 'diamond']);
const ARMOR_SLOTS = new Set(['head', 'chest', 'legs', 'feet']);
const strip = (id) => String(id ?? '').replace(/^minecraft:/, '');

function equippable(game, item) {
  return game.items.component?.(item, 'equippable') ?? null;
}

function armorAsset(game, item) {
  const e = equippable(game, item);
  const asset = e?.assetId ?? e?.asset_id;
  if (asset) return strip(asset);
  const n = strip(game.items.name?.(item.id));
  if (n === 'turtle_helmet') return 'turtle_scute';
  const m = /^(leather|chainmail|iron|golden|diamond|netherite|copper)_/.exec(n);
  return m ? (m[1] === 'golden' ? 'gold' : m[1]) : null;
}

function trimMaterialName(game, id) {
  if (Number.isInteger(id) && TRIM_MATERIALS_26_3[id]) return TRIM_MATERIALS_26_3[id];
  return null;
}

function trimPatternName(game, id) {
  if (Number.isInteger(id) && TRIM_PATTERNS_26_3[id]) return TRIM_PATTERNS_26_3[id];
  return null;
}

export function itemTrim(game, item) {
  const trim = game.items.component?.(item, 'trim');
  if (!trim) return null;
  const materialId = trim.material ?? trim.materialId;
  const patternId = trim.pattern ?? trim.patternId;
  const material = trimMaterialName(game, materialId);
  const pattern = trimPatternName(game, patternId);
  if (!material || !pattern) return null;
  return { material, pattern, materialId, patternId, decal: false, armor: armorAsset(game, item) };
}

// Palette id from the equipment asset's trim override, otherwise trim/<material>.
function paletteName(trim) {
  return trim.armor === trim.material && DARKER_PALETTES.has(trim.material)
    ? 'trim/' + trim.material + '_darker'
    : 'trim/' + trim.material;
}

// Item model selected by the native 26.3 `minecraft:trim_material` property.
export function trimItemModel(game, item) {
  const trim = itemTrim(game, item);
  if (!trim || !trim.armor) return null;
  return 'item/' + strip(game.items.name(item.id)) + '_' + trim.material + '_trim';
}

export function trimTypePredicate(game, item) {
  const trim = itemTrim(game, item);
  return trim && trim.armor ? 'minecraft:' + trim.material : undefined;
}

// ArmorTrim texture path relative to textures/, with the 26.3 humanoid layer names.
export function trimTextureName(game, item, inner) {
  const trim = itemTrim(game, item);
  if (!trim) return null;
  return 'trims/entity/' + (inner ? 'humanoid_leggings' : 'humanoid') + '/' + trim.pattern;
}

function trimPalette(game, item) {
  const trim = itemTrim(game, item);
  return trim ? paletteName(trim) : null;
}

// PalettedTextureManager.getOrPrepare: generate the trim texture once per resource load.
export function armorTrimTexture(game, textureName, item) {
  const A = game.assets;
  if (!A || !textureName) return null;
  const palette = trimPalette(game, item);
  const key = textureName + '|' + palette;
  let store = A._armorTrimStore;
  if (!store || store.version !== A.version) store = A._armorTrimStore = { version: A.version, textures: new Map(), pending: new Set() };
  if (store.textures.has(key)) return store.textures.get(key);
  if (store.pending.has(key)) return null;
  store.pending.add(key);
  const version = A.version;
  (async () => {
    const load = (p) => A.imageAsync(p + '.png').catch(() => null);
    const [base, basePalette, target] = await Promise.all([
      load(textureName),
      load('palettes/trim_base'),
      load('palettes/' + palette),
    ]);
    if (!base || !basePalette || !target || store.version !== A.version || version !== A.version) return;
    const image = applyPalette(base, paletteMapping(basePalette.data, target.data));
    store.textures.set(key, A.makeTexture('armor_trims/' + key, image.width, image.height, image.data));
  })().catch(() => {}).finally(() => store.pending.delete(key));
  return null;
}

// Configured trimmable_armor tag when the server sent it; equipable armor is the fallback.
export function isTrimmableArmor(game, item) {
  const tagged = game.tags?.registries?.items?.get?.('minecraft:trimmable_armor');
  if (tagged) return tagged.includes(item.id);
  const slot = equippable(game, item)?.slot ?? equippable(game, item)?.slotName;
  return ARMOR_SLOTS.has(slot);
}
