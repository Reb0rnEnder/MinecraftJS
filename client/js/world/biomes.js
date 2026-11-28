import {registryEntries} from '../net/registry-codec.js';
import {biomeInfoNoise,temperatureNoise} from './biome-info-noise.js';
import { WATER_BIOMES } from './water-biomes.js';
// Biome colour helpers (ColorizerGrass / ColorizerFoliage + per-biome overrides). Worker-safe.

let biomeTable = [];
let serverBiomeTable = [];
let grassMap = null; // Uint8ClampedArray 256*256*4
let foliageMap = null;
let dryFoliageMap = null;

/**
 * Parse an integer RGB color or `#rrggbb` / `rrggbb` hex string into a 24-bit integer.
 */
export function parseColor(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^#?[0-9a-f]{6}$/i.test(v)) return parseInt(v[0] === '#' ? v.slice(1) : v, 16);
  return undefined;
}

/**
 * Resolve a 1.21.11 EnvironmentAttributeMap entry, unwrapping modifier objects if present.
 */
export function resolveAttribute(attrs, key) {
  if (!attrs) return undefined;
  const raw = attrs[key] ?? attrs[key.replace(/^minecraft:/, '')];
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw === 'object' && !Array.isArray(raw) && ('argument' in raw || 'value' in raw)) {
    return raw.argument ?? raw.value;
  }
  return raw;
}

function soundIdOf(sound) {
  return typeof sound === 'string' ? sound : sound?.sound_id;
}

function normalizeBiomeEffects(rawEffects, attrs) {
  const src = rawEffects || {};
  const effects = { ...src };

  const colorKeys = [
    ['sky_color', 'minecraft:visual/sky_color'],
    ['fog_color', 'minecraft:visual/fog_color'],
    ['water_fog_color', 'minecraft:visual/water_fog_color'],
  ];
  for (const [effectKey, attrKey] of colorKeys) {
    const c = parseColor(resolveAttribute(attrs, attrKey) ?? src[effectKey]);
    if (c !== undefined) effects[effectKey] = c;
  }
  for (const key of ['water_color', 'foliage_color', 'dry_foliage_color', 'grass_color']) {
    const c = parseColor(src[key]);
    if (c !== undefined) effects[key] = c;
  }

  const ap = resolveAttribute(attrs, 'minecraft:visual/ambient_particles');
  if (ap !== undefined && effects.particle === undefined) {
    const item = Array.isArray(ap) ? ap[0] : ap;
    if (item && typeof item === 'object') {
      const opts = item.options ?? item.particle;
      effects.particle = { ...item, options: typeof opts === 'string' ? { type: opts } : opts };
    }
  }

  const bgMusic = resolveAttribute(attrs, 'minecraft:audio/background_music');
  if (bgMusic !== undefined && effects.music === undefined) {
    const m = bgMusic?.default ?? bgMusic;
    if (m && typeof m === 'object') {
      const sound = soundIdOf(m.sound);
      effects.music = sound !== undefined ? { ...m, sound } : m;
    }
  }

  const amb = resolveAttribute(attrs, 'minecraft:audio/ambient_sounds');
  if (amb && typeof amb === 'object') {
    if (amb.loop !== undefined && effects.ambient_sound === undefined) effects.ambient_sound = soundIdOf(amb.loop);
    if (amb.mood !== undefined && effects.mood_sound === undefined) {
      const ms = soundIdOf(amb.mood.sound);
      effects.mood_sound = ms !== undefined ? { ...amb.mood, sound: ms } : amb.mood;
    }
    const add = Array.isArray(amb.additions) ? amb.additions[0] : amb.additions;
    if (add && effects.additions_sound === undefined) {
      const as = soundIdOf(add.sound);
      effects.additions_sound = as !== undefined ? { ...add, sound: as } : add;
    }
  }

  return effects;
}

export function initBiomes(biomesJson, grassPixels, foliagePixels, dryFoliagePixels = null) {
  biomeTable = [];
  for (const b of biomesJson) {
    const effects = normalizeBiomeEffects(b.effects, b.attributes);
    biomeTable[b.id] = {
      ...b,
      rainfall: b.rainfall ?? b.downfall,
      effects,
      waterColor: parseColor(b.waterColor ?? effects.water_color),
      waterFogColor: parseColor(b.waterFogColor ?? effects.water_fog_color),
    };
  }
  grassMap = grassPixels;
  foliageMap = foliagePixels;
  dryFoliageMap = dryFoliagePixels ?? null;
}

export function setServerBiomeEntries(entries){
 serverBiomeTable=[];
 for(const entry of entries||[]){
  const b=entry.element;
  if(!b)continue;
  const effects=normalizeBiomeEffects(b.effects,b.attributes);
  const precipitation=b.precipitation??(b.has_precipitation!==undefined?((b.has_precipitation===false||b.has_precipitation===0)?'none':((b.temperature??0.8)<0.15?'snow':'rain')):biomeTable[entry.id]?.precipitation);
  serverBiomeTable[entry.id]={...(biomeTable[entry.id]||{}),...b,name:entry.name.replace(/^minecraft:/,''),rainfall:b.downfall??b.rainfall??biomeTable[entry.id]?.rainfall,precipitation,effects,waterColor:effects.water_color,waterFogColor:effects.water_fog_color};
 }
}
export function setServerBiomes(codec){
 setServerBiomeEntries(registryEntries(codec,'minecraft:worldgen/biome'));
}
export function biomeInfo(id) { return serverBiomeTable[id] || biomeTable[id] || biomeTable[1] || { temperature: 0.8, rainfall: 0.4, name: 'plains' }; }

function sample(map, temp, rain) {
  if (!map) return 0x7fb238;
  // Biome climate fields are Java floats before colormap index arithmetic.
  temp = Math.min(1, Math.max(0, Math.fround(temp)));
  rain = Math.min(1, Math.max(0, Math.fround(rain))) * temp;
  const i = ((1 - temp) * 255) | 0;
  const j = ((1 - rain) * 255) | 0;
  const k = (j << 8 | i) * 4;
  return (map[k] << 16) | (map[k + 1] << 8) | map[k + 2];
}

// Biome.getHeightAdjustedTemperature (1.18+): above y 80 the temperature drops with height plus TEMPERATURE_NOISE,
// in float arithmetic like the native code. The FROZEN temperature modifier (frozen oceans) is not modelled.
const f32 = Math.fround;
export function heightAdjustedTemperature(b, x, y, z) {
  const t = f32(b.temperature);
  if (y <= 80) return t;
  const n = f32(temperatureNoise(f32(x / 8), f32(z / 8)) * 8);
  return f32(t - f32(f32(f32(f32(n + y) - 80) * f32(0.05)) / 40));
}

const isSwamp = (n) => n === 'swamp' || n === 'swamp_hills';

export function grassColor(id, y, x=0, z=0) {
  const b = biomeInfo(id);
  const override = parseColor(b.effects?.grass_color);
  const c = override !== undefined ? override : sample(grassMap, b.temperature, b.rainfall);
  switch(b.effects?.grass_color_modifier){
    case 'dark_forest': return ((c & 0xfefefe) + 0x28340a) >> 1;
    case 'swamp': return biomeInfoNoise(x*.0225,z*.0225)<-.1?0x4c763c:0x6a7039;
    default: return c;
  }
}

export function foliageColor(id, y) {
  const b = biomeInfo(id);
  const override = parseColor(b.effects?.foliage_color);
  return override !== undefined ? override : sample(foliageMap, b.temperature, b.rainfall);
}

export function dryFoliageColor(id, y) {
  const b = biomeInfo(id);
  const override = parseColor(b.effects?.dry_foliage_color);
  return override !== undefined ? override : sample(dryFoliageMap, b.temperature, b.rainfall);
}

export function waterColor(id) {
  const b = biomeInfo(id);
  const wc = parseColor(b.effects?.water_color);
  if (wc !== undefined) return wc;
  if(WATER_BIOMES[id])return WATER_BIOMES[id][0];
  // The 1.13 water sprites are grayscale: their blue comes from biome tint.
  const bwc = parseColor(b.waterColor);
  if (bwc !== undefined) return bwc;
  return isSwamp(b.name) ? 0x617b64 : 0x3f76e4;
}

// Biome.getPrecipitationAt: none without precipitation, snow when coldEnoughToSnow (temperature < 0.15), else rain
export function biomeRainType(id, y, x = 0, z = 0) {
  const b = biomeInfo(id);
  if (b.precipitation === 'none' || b.has_precipitation === false) return 'none';
  return heightAdjustedTemperature(b, x, y, z) < 0.15 ? 'snow' : 'rain';
}
