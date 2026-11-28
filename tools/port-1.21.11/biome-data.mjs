import { KNOWN_PACK_774 } from '../../client/js/net/known-pack-1.21.11.js';
import { simplify } from '../../client/js/net/nbt.js';

function parseColor(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^#?[0-9a-f]{6}$/i.test(value)) {
    return parseInt(value[0] === '#' ? value.slice(1) : value, 16);
  }
  return undefined;
}

function resolveAttribute(attrs, key) {
  if (!attrs) return undefined;
  const raw = attrs[key] ?? attrs[key.replace(/^minecraft:/, '')];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw) && ('argument' in raw || 'value' in raw)) {
    return raw.argument ?? raw.value;
  }
  return raw;
}

function normalizeEffects(rawEffects, attrs) {
  const effects = { ...(rawEffects || {}) };
  for (const key of ['water_color', 'foliage_color', 'dry_foliage_color', 'grass_color']) {
    const color = parseColor(effects[key]);
    if (color !== undefined) effects[key] = color;
  }
  for (const [effectKey, attrKey] of [
    ['sky_color', 'minecraft:visual/sky_color'],
    ['fog_color', 'minecraft:visual/fog_color'],
    ['water_fog_color', 'minecraft:visual/water_fog_color']
  ]) {
    const color = parseColor(effects[effectKey] ?? resolveAttribute(attrs, attrKey));
    if (color !== undefined) effects[effectKey] = color;
  }
  return effects;
}

// 1.21.11 splits biome visual/audio properties between `effects` and `attributes`
// (EnvironmentAttributeMap). Preserve both and include all KNOWN_PACK_774 biomes
// in exact registry ID order.
export function nativeBiomeData(rows = []) {
  const byName = new Map(rows.map((row) => [row.name, row]));
  const entries = KNOWN_PACK_774.registries['minecraft:worldgen/biome'];
  return entries.map((entry, id) => {
    const name = entry.key.replace(/^minecraft:/, '');
    const row = byName.get(name);
    if (row && row.id !== id) {
      throw new Error(`Native biome ID mismatch for ${name}: expected ${id}, got ${row.id}`);
    }
    const native = simplify(entry.value);
    const attributes = native.attributes || {};
    const effects = normalizeEffects(native.effects, attributes);
    const hasPrecipitation = Boolean(native.has_precipitation);
    const displayName = row?.displayName || name.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return {
      ...(row || {}),
      id,
      name,
      displayName,
      temperature: native.temperature,
      rainfall: native.downfall,
      has_precipitation: hasPrecipitation,
      precipitation: !hasPrecipitation ? 'none' : native.temperature < 0.15 ? 'snow' : 'rain',
      effects,
      attributes
    };
  });
}
