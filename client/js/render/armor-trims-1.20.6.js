// Armor trims (1.20+): the "trim" component's material/pattern (Configuration registry entries or inline data),
// the trim_type item-model predicate, and the worn trim textures generated from atlases/armor_trims.json.
import { simplify } from '../net/nbt.js';
import { registryEntries } from '../net/registry-codec.js';
import { KNOWN_PACK_766 } from '../net/known-pack-1.20.6.js';
import { decodeUtf8 } from '../util/utf8.js';
import { paletteMapping, applyPalette } from './paletted-permutations.js';

// Registries.ARMOR_MATERIAL is static in 1.20.6 (inline override maps key it by protocol id)
export const ARMOR_MATERIALS_766 = ['minecraft:leather', 'minecraft:chainmail', 'minecraft:iron', 'minecraft:gold', 'minecraft:diamond', 'minecraft:turtle', 'minecraft:netherite', 'minecraft:armadillo'];
const strip = (id) => String(id ?? '').replace(/^minecraft:/, '');
const qualified = (id) => (String(id).includes(':') ? String(id) : 'minecraft:' + id);

const cache = new WeakMap();
const fallback = {};
function entries(game, registry) {
  const source = game.dimensionCodec;
  if (!source) return fallback[registry] ??= (KNOWN_PACK_766.registries[registry] || []).map((e, id) => ({ id, name: e.key, element: simplify(e.value) }));
  let byRegistry = cache.get(source);
  if (!byRegistry) cache.set(source, byRegistry = {});
  return byRegistry[registry] ??= registryEntries(simplify(source), registry);
}

function material(game, holder) {
  if (!holder) return null;
  if (holder.data) {
    const d = holder.data, overrides = {};
    for (const o of d.overrideArmorMaterials || []) overrides[ARMOR_MATERIALS_766[o.armorMaterialId]] = o.assetName;
    return { assetName: d.assetName, itemModelIndex: d.itemModelIndex ?? 0, overrides };
  }
  const e = entries(game, 'minecraft:trim_material').find((x) => x.id === holder.materialId);
  if (!e) return null;
  const el = e.element || {};
  const overrides = {};
  for (const [k, v] of Object.entries(el.override_armor_materials || {})) overrides[qualified(k)] = v;
  return { assetName: el.asset_name, itemModelIndex: Number(el.item_model_index ?? 0), overrides };
}

function pattern(game, holder) {
  if (!holder) return null;
  if (holder.data) return { assetId: holder.data.assetId, decal: !!holder.data.decal };
  const e = entries(game, 'minecraft:trim_pattern').find((x) => x.id === holder.patternId);
  return e ? { assetId: e.element?.asset_id, decal: !!e.element?.decal } : null;
}

export function itemTrim(game, item) {
  const trim = item && game.items.component?.(item, 'trim');
  if (!trim) return null;
  const m = material(game, trim.material), p = pattern(game, trim.pattern);
  return m && p && m.assetName && p.assetId ? { material: m, pattern: p } : null;
}

// ItemProperties "trim_type": -inf unless #trimmable_armor, else the trim material's item model index (0 untrimmed)
export function trimTypePredicate(game, item) {
  const name = qualified(game.items.name(item.id));
  const tagged = game.tags?.registries?.items?.get?.('minecraft:trimmable_armor');
  const trimmable = tagged ? tagged.includes(item.id) : /_(helmet|chestplate|leggings|boots)$/.test(name);
  if (!trimmable) return -Infinity;
  return itemTrim(game, item)?.material.itemModelIndex ?? 0;
}

// The ArmorMaterial of a worn armor item, by item name
export function armorMaterialOf(name) {
  const n = strip(name);
  if (n === 'turtle_helmet') return 'minecraft:turtle';
  const m = /^(leather|chainmail|iron|golden|diamond|netherite)_/.exec(n);
  return m ? 'minecraft:' + (m[1] === 'golden' ? 'gold' : m[1]) : null;
}

// ArmorTrim.outerTexture / innerTexture: trims/models/armor/<pattern>[_leggings]_<material asset or override>
export function trimTextureName(game, item, inner) {
  const trim = itemTrim(game, item);
  if (!trim) return null;
  const armor = armorMaterialOf(game.items.name(item.id));
  const asset = (armor && trim.material.overrides[armor]) || trim.material.assetName;
  return 'trims/models/armor/' + strip(trim.pattern.assetId) + (inner ? '_leggings' : '') + '_' + asset;
}

// Sprites of the armor_trims atlas, generated on first use and cached per resource load
export function armorTrimTexture(game, name) {
  const A = game.assets;
  if (!A) return null;
  let store = A._armorTrimStore;
  if (!store || store.version !== A.version) store = A._armorTrimStore = { version: A.version, textures: new Map(), definitions: null };
  if (store.textures.has(name)) return store.textures.get(name);
  store.textures.set(name, null);
  (async () => {
    store.definitions ??= (async () => (await A.readResourceStack('minecraft:atlases/armor_trims.json')).reverse().map((r) => { try { return JSON.parse(decodeUtf8(r.bytes)); } catch { return null; } }))();
    const definitions = await store.definitions;
    const load = (p) => A.imageAsync(strip(p) + '.png').catch(() => null);
    for (const def of definitions) for (const source of def?.sources || []) {
      if (strip(source.type) !== 'paletted_permutations') continue;
      for (const texture of source.textures || []) for (const [suffix, palette] of Object.entries(source.permutations || {})) {
        if (strip(texture) + '_' + suffix !== name) continue;
        const [base, key, values] = await Promise.all([load(texture), load(source.palette_key), load(palette)]);
        if (!base || !key || !values || store.version !== A.version) return;
        const image = applyPalette(base, paletteMapping(key.data, values.data));
        store.textures.set(name, A.makeTexture('armor_trims/' + name, image.width, image.height, image.data));
        return;
      }
    }
  })().catch(() => {});
  return null;
}
