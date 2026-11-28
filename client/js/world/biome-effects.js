import { biomeInfo, parseColor, resolveAttribute } from './biomes.js';

const KERNEL = [0, 1, 4, 6, 4, 1, 0];

function biomeVisualColor(id, effectKey, attrKey, fallback) {
  const b = biomeInfo(id);
  return parseColor(b.effects?.[effectKey] ?? resolveAttribute(b.attributes, attrKey)) ?? fallback;
}

export function biomeFogColor(id) { return biomeVisualColor(id, 'fog_color', 'minecraft:visual/fog_color', 0xc0d8ff); }
export function biomeSkyColor(id) { return biomeVisualColor(id, 'sky_color', 'minecraft:visual/sky_color', 0x78a7ff); }
export function biomeWaterFogColor(id) {
  const b = biomeInfo(id);
  return parseColor(b.effects?.water_fog_color ?? b.waterFogColor ?? resolveAttribute(b.attributes, 'minecraft:visual/water_fog_color')) ?? 0x050533;
}

// CubicSampler.gaussianSample uses quart positions with the camera offset by two blocks.
export function sampleBiomeFog(world, x, y, z) {
  const position = [(x - 2) / 4, (y - 2) / 4, (z - 2) / 4];
  const base = position.map(Math.floor);
  const fraction = position.map((v, i) => v - base[i]);
  const weights = fraction.map(f => Array.from({ length: 6 }, (_, i) => KERNEL[i + 1] + f * (KERNEL[i] - KERNEL[i + 1])));
  const sum = [0, 0, 0];
  let total = 0;
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) for (let c = 0; c < 6; c++) {
    const weight = weights[0][a] * weights[1][b] * weights[2][c];
    if (!weight) continue;
    const id = world.getNoiseBiome(base[0] - 2 + a, base[1] - 2 + b, base[2] - 2 + c);
    const color = biomeFogColor(id);
    sum[0] += ((color >> 16) & 255) * weight;
    sum[1] += ((color >> 8) & 255) * weight;
    sum[2] += (color & 255) * weight;
    total += weight;
  }
  return sum.map(v => v / (total * 255));
}
