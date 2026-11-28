import { simplify } from '../net/nbt.js';
import { registryEntries } from '../net/registry-codec.js';
import { KNOWN_PACK_774 } from '../net/known-pack-1.21.11.js';
import { bannerLayers } from './banner.js';

const DYES = ['white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray', 'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'];
const qualified = (id) => (id.includes(':') ? id : 'minecraft:' + id);
const registryCache = new WeakMap();
let fallback;

function patterns(game) {
  const source = game.dimensionCodec;
  if (!source) {
    return (fallback ??= KNOWN_PACK_774.registries['minecraft:banner_pattern'].map((e, id) => ({
      id,
      name: e.key,
      element: simplify(e.value),
    })));
  }
  let entries = registryCache.get(source);
  if (!entries) {
    entries = registryEntries(simplify(source), 'minecraft:banner_pattern');
    registryCache.set(source, entries);
  }
  return entries;
}

// Render layers, not synthetic legacy ItemStack NBT. Wire holder IDs refer to
// the current Configuration registry; placed NBT uses holder keys / inline data.
export function bannerLayers774(game, base, values = []) {
  const layers = [];
  let entries;
  for (const value of values.layers ?? values) {
    const holder = value.pattern;
    let asset = holder?.data?.assetId ?? holder?.asset_id;
    if (!asset) {
      entries ??= patterns(game);
      const entry = typeof holder === 'string'
        ? entries.find((e) => e.name === qualified(holder))
        : entries.find((e) => e.id === (holder?.patternId ?? holder?.id));
      asset = entry?.element?.asset_id;
    }
    const dye = value.colorId ?? DYES.indexOf(value.color);
    if (typeof asset === 'string' && Number.isInteger(dye) && dye >= 0 && dye < 16) {
      layers.push({ Pattern: qualified(asset), Color: 15 - dye });
    }
  }
  return bannerLayers(15 - base, layers);
}

export function placedBannerLayers774(game, name, data) {
  return bannerLayers774(game, Math.max(0, DYES.indexOf(name.replace(/_(wall_)?banner$/, ''))), data?.patterns);
}

export function itemBannerLayers774(game, item) {
  const name = game.items.name(item.id);
  const base = name.endsWith('_banner')
    ? Math.max(0, DYES.indexOf(name.slice(0, -7)))
    : game.items.component(item, 'base_color');
  const value = game.items.component(item, 'banner_patterns');
  const list = value?.layers ?? value ?? [];
  if (base === undefined && !list.length) return null;
  return bannerLayers774(game, base ?? 0, list);
}

export function loomPatterns774(game, banner, dye, pattern) {
  const value = game.items.component(banner, 'banner_patterns');
  if (!banner || !dye || ((value?.layers ?? value)?.length || 0) >= 6) return [];
  const name = pattern ? game.items.name(pattern.id) : null;
  if (name && !name.endsWith('_banner_pattern')) return [];
  const tag = name ? 'minecraft:pattern_item/' + name.slice(0, -15) : 'minecraft:no_item_required';
  return game.commandTags?.['minecraft:banner_pattern']?.[tag] || [];
}
