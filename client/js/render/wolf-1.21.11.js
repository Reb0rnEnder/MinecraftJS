import { PAWS_DATA_774 } from '../game/paws-data-1.21.11.js';
import { simplify } from '../net/nbt.js';
import { registryEntries } from '../net/registry-codec.js';
import { KNOWN_PACK_774 } from '../net/known-pack-1.21.11.js';

const cache = new WeakMap();
let vanilla;

export function wolfTexture774(game = {}, e) {
  const source = game.dimensionCodec;
  let entries;
  if (source) {
    entries = cache.get(source);
    if (!entries) {
      entries = registryEntries(simplify(source), 'minecraft:wolf_variant');
      cache.set(source, entries);
    }
  } else {
    entries = vanilla ??= KNOWN_PACK_774.registries['minecraft:wolf_variant'].map((entry, id) => ({
      id,
      name: entry.key,
      element: simplify(entry.value)
    }));
  }
  const variant = e.wolfVariant === undefined
    ? entries.find((v) => v.name === 'minecraft:pale')
    : entries.find((v) => v.id === e.wolfVariant);
  const mode = e.tamed ? 'tame' : e.angry ? 'angry' : 'wild';
  const texture = variant?.element?.assets?.[mode] ?? variant?.element?.[mode + '_texture'];
  if (typeof texture !== 'string') return null;
  return (texture.replace(/^minecraft:/, '') + '.png').replace(/\.png\.png$/, '.png');
}

export function wolfArmor774(items, stack) {
  if (!stack || items.name(stack.id) !== 'wolf_armor') return null;
  const max = items.maxDurability(stack), damage = items.damage(stack);
  const fraction = Math.fround(1 - Math.fround(damage / max));
  const crack = !items.isDamageable(stack)
    ? null
    : fraction < PAWS_DATA_774.crackThresholds.fractionHigh
      ? 'high'
      : fraction < PAWS_DATA_774.crackThresholds.fractionMedium
        ? 'medium'
        : fraction < PAWS_DATA_774.crackThresholds.fractionLow
          ? 'low'
          : null;
  const dye = items.component(stack, 'dyed_color');
  const raw = typeof dye === 'number' ? dye : (dye?.rgb ?? dye?.color ?? 0);
  const rgb = raw >>> 0;
  return {
    crack,
    color: dye === undefined || dye === null ? null : [((rgb >> 16) & 255) / 255, ((rgb >> 8) & 255) / 255, (rgb & 255) / 255]
  };
}
