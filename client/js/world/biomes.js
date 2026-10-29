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
 for(const entry of codec?.['minecraft:worldgen/biome']?.value||[]){
  const b=entry.element,effects=b.effects||{};
  serverBiomeTable[entry.id]={...(biomeTable[entry.id]||{}),...b,name:entry.name.replace(/^minecraft:/,''),rainfall:b.downfall,effects,waterColor:effects.water_color,waterFogColor:effects.water_fog_color};
 }
}
export function biomeInfo(id) { return serverBiomeTable[id] || biomeTable[id] || biomeTable[1] || { temperature: 0.8, rainfall: 0.4, name: 'plains' }; }

function sample(map, temp, rain) {
  if (!map) return 0x7fb238;
  temp = Math.min(1, Math.max(0, temp));
  rain = Math.min(1, Math.max(0, rain)) * temp;
  const i = ((1 - temp) * 255) | 0;
  const j = ((1 - rain) * 255) | 0;
  const k = (j << 8 | i) * 4;
  return (map[k] << 16) | (map[k + 1] << 8) | map[k + 2];
}

function tempAt(b, y) {
  let t = b.temperature;
  if (y > 64) t -= (y - 64) * 0.05 / 30;
  return t;
}

const isSwamp = (n) => n === 'swamp' || n === 'swamp_hills';
const isRoofed = (n) => n === 'dark_forest' || n === 'dark_forest_hills';
const isMesa = (n) => !!n && (n.includes('badlands'));

export function grassColor(id, y) {
  const b = biomeInfo(id);
  const n = b.name;
  if (isSwamp(n)) return 0x6a7039;
  if (isMesa(n)) return 0x90814d;
  const c = sample(grassMap, tempAt(b, y), b.rainfall);
  if (isRoofed(n)) return ((c & 0xfefefe) + 0x28340a) >> 1;
  return c;
}

export function foliageColor(id, y) {
  const b = biomeInfo(id);
  const n = b.name;
  if (isSwamp(n)) return 0x6a7039;
  if (isMesa(n)) return 0x9e814d;
  return sample(foliageMap, tempAt(b, y), b.rainfall);
}

export function waterColor(id) {
  const b = biomeInfo(id);
  if(typeof b.effects?.water_color==='number')return b.effects.water_color;
  if(WATER_BIOMES[id])return WATER_BIOMES[id][0];
  // The 1.13 water sprites are grayscale: their blue comes from biome tint.
  if (typeof b.waterColor === 'number') return b.waterColor;
  return isSwamp(b.name) ? 0x617b64 : 0x3f76e4;
}

export function biomeRainType(id, y) {
  const b = biomeInfo(id);
  if (b.precipitation === 'none' || b.rainfall === 0) return 'none';
  return tempAt(b, y) < 0.15 ? 'snow' : 'rain';
}
