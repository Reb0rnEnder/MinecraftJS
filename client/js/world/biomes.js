import {biomeInfoNoise,temperatureNoise} from './biome-info-noise.js';
import {registryEntries} from '../net/registry-codec.js';
import { WATER_BIOMES } from './water-biomes.js';
// Biome colour helpers (ColorizerGrass / ColorizerFoliage + per-biome overrides). Worker-safe.

let biomeTable = [];
let serverBiomeTable=[];
let grassMap = null; // Uint8ClampedArray 256*256*4
let foliageMap = null;

export function initBiomes(biomesJson, grassPixels, foliagePixels) {
  biomeTable = [];
  for (const b of biomesJson) biomeTable[b.id] = b;
  grassMap = grassPixels;
  foliageMap = foliagePixels;
}

export function setServerBiomes(codec){
 serverBiomeTable=[];
 for(const entry of registryEntries(codec,'minecraft:worldgen/biome')){
  const b=entry.element,effects=b.effects||{};
  serverBiomeTable[entry.id]={...(biomeTable[entry.id]||{}),...b,name:entry.name.replace(/^minecraft:/,''),rainfall:b.downfall,effects,waterColor:effects.water_color,waterFogColor:effects.water_fog_color};
 }
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
  if (b.effects) {
    const c=typeof b.effects.grass_color==='number'?b.effects.grass_color:sample(grassMap,b.temperature,b.rainfall);
    if(b.effects.grass_color_modifier==='swamp')return biomeInfoNoise(x*.0225,z*.0225)<-.1?0x4c763c:0x6a7039;
    if(b.effects.grass_color_modifier==='dark_forest')return ((c&0xfefefe)+0x28340a)>>1;
    return c;
  }
  if (isSwamp(n)) return biomeInfoNoise(x*.0225,z*.0225)<-.1?0x4c763c:0x6a7039;
  if (isMesa(n)) return 0x90814d;
  const c = sample(grassMap, b.temperature, b.rainfall);
  if (isRoofed(n)) return ((c & 0xfefefe) + 0x28340a) >> 1;
  return c;
}

export function foliageColor(id, y) {
  const b = biomeInfo(id);
  const n = b.name;
  if (b.effects) return typeof b.effects.foliage_color==='number'?b.effects.foliage_color:sample(foliageMap,b.temperature,b.rainfall);
  if (isSwamp(n)) return 0x6a7039;
  if (isMesa(n)) return 0x9e814d;
  return sample(foliageMap, b.temperature, b.rainfall);
}

export function waterColor(id) {
  const b = biomeInfo(id);
  if(typeof b.effects?.water_color==='number')return b.effects.water_color;
  if(WATER_BIOMES[id])return WATER_BIOMES[id][0];
  // The 1.13 water sprites are grayscale: their blue comes from biome tint.
  if (typeof b.waterColor === 'number') return b.waterColor;
  return isSwamp(b.name) ? 0x617b64 : 0x3f76e4;
}

// Precipitation at a position: none where the biome has none, snow below temperature 0.15, else rain
export function biomeRainType(id, y, x = 0, z = 0) {
  const b = biomeInfo(id);
  if (b.precipitation === 'none' || b.has_precipitation === false) return 'none';
  return heightAdjustedTemperature(b, x, y, z) < 0.15 ? 'snow' : 'rain';
}
