import {biomeInfoNoise,temperatureNoise} from './biome-info-noise.js';
// Biome colour helpers (ColorizerGrass / ColorizerFoliage + per-biome overrides). Worker-safe.

let biomeTable = [];
let grassMap = null; // Uint8ClampedArray 256*256*4
let foliageMap = null;

export function initBiomes(biomesJson, grassPixels, foliagePixels) {
  biomeTable = [];
  for (const b of biomesJson) biomeTable[b.id] = b;
  grassMap = grassPixels;
  foliageMap = foliagePixels;
}

export function biomeInfo(id) { return biomeTable[id] || biomeTable[1] || { temperature: 0.8, rainfall: 0.4, name: 'plains' }; }

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

// Biome height-adjusted temperature for this release: above y 64 the temperature drops with height plus
// TEMPERATURE_NOISE (seed 1234), in float arithmetic like the native code. The 1.13+ FROZEN modifier is not modelled.
const f32 = Math.fround;
export function heightAdjustedTemperature(b, x, y, z) {
  const t = f32(b.temperature);
  if (y <= 64) return t;
  const n = f32(temperatureNoise(f32(x / 8), f32(z / 8)) * 4);
  return f32(t - f32(f32(f32(f32(n + y) - 64) * f32(0.05)) / 30));
}

const isSwamp = (n) => n === 'swamp' || n === 'swamp_hills';
const isRoofed = (n) => n === 'dark_forest' || n === 'dark_forest_hills';
const isMesa = (n) => !!n && (n.includes('badlands'));

export function grassColor(id, y, x=0, z=0) {
  const b = biomeInfo(id);
  const n = b.name;
  if (isSwamp(n)) return biomeInfoNoise(x*.0225,z*.0225)<-.1?0x4c763c:0x6a7039;
  if (isMesa(n)) return 0x90814d;
  const c = sample(grassMap, heightAdjustedTemperature(b, x, y, z), b.rainfall);
  if (isRoofed(n)) return ((c & 0xfefefe) + 0x28340a) >> 1;
  return c;
}

export function foliageColor(id, y, x = 0, z = 0) {
  const b = biomeInfo(id);
  const n = b.name;
  if (isSwamp(n)) return 0x6a7039;
  if (isMesa(n)) return 0x9e814d;
  return sample(foliageMap, heightAdjustedTemperature(b, x, y, z), b.rainfall);
}

export function waterColor(id) {
  const b = biomeInfo(id);
  return isSwamp(b.name) ? 0xe0ffae : 0xffffff;
}

// Precipitation at a position: none where the biome has none, snow below temperature 0.15, else rain
export function biomeRainType(id, y, x = 0, z = 0) {
  const b = biomeInfo(id);
  if (b.precipitation === 'none' || b.has_precipitation === false) return 'none';
  return heightAdjustedTemperature(b, x, y, z) < 0.15 ? 'snow' : 'rain';
}
