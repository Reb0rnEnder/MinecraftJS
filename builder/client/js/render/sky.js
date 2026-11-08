// Vanilla-style sky/fog/lightmap computations (World / WorldProvider / EntityRenderer ports).

export function celestialAngle(worldTime, partial) {
  const i = Number(((BigInt(Math.floor(worldTime)) % 24000n) + 24000n) % 24000n);
  let f = (i + partial) / 24000 - 0.25;
  if (f < 0) f += 1;
  if (f > 1) f -= 1;
  const f1 = f;
  f = 1 - (Math.cos(f * Math.PI) + 1) / 2;
  return f1 + (f - f1) / 3;
}

export function sunBrightness(angle, rain, thunder) {
  let f1 = 1 - (Math.cos(angle * Math.PI * 2) * 2 + 0.2);
  f1 = Math.min(1, Math.max(0, f1));
  f1 = 1 - f1;
  f1 *= 1 - rain * 5 / 16;
  f1 *= 1 - thunder * 5 / 16;
  return f1 * 0.8 + 0.2;
}

export function starBrightness(angle) {
  let f1 = 1 - (Math.cos(angle * Math.PI * 2) * 2 + 0.25);
  f1 = Math.min(1, Math.max(0, f1));
  return f1 * f1 * 0.5;
}

function hsbToRgb(h, s, v) {
  h = (h - Math.floor(h)) * 6;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const table = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]];
  return table[i % 6];
}

export function skyColor(angle, temperature, rain, thunder) {
  let f1 = Math.cos(angle * Math.PI * 2) * 2 + 0.5;
  f1 = Math.min(1, Math.max(0, f1));
  let t = temperature / 3;
  t = Math.min(1, Math.max(-1, t));
  let [r, g, b] = hsbToRgb(0.62222224 - t * 0.05, 0.5 + t * 0.1, 1);
  r *= f1; g *= f1; b *= f1;
  if (rain > 0) {
    const f7 = (r * 0.3 + g * 0.59 + b * 0.11) * 0.6;
    const f8 = 1 - rain * 0.75;
    r = r * f8 + f7 * (1 - f8); g = g * f8 + f7 * (1 - f8); b = b * f8 + f7 * (1 - f8);
  }
  if (thunder > 0) {
    const f7 = (r * 0.3 + g * 0.59 + b * 0.11) * 0.2;
    const f8 = 1 - thunder * 0.75;
    r = r * f8 + f7 * (1 - f8); g = g * f8 + f7 * (1 - f8); b = b * f8 + f7 * (1 - f8);
  }
  return [r, g, b];
}

export function baseFogColor(angle) {
  let f = Math.cos(angle * Math.PI * 2) * 2 + 0.5;
  f = Math.min(1, Math.max(0, f));
  return [0.7529412 * (f * 0.94 + 0.06), 0.84705883 * (f * 0.94 + 0.06), 1.0 * (f * 0.91 + 0.09)];
}

export function sunriseColors(angle) {
  const f = 0.4;
  const f1 = Math.cos(angle * Math.PI * 2);
  if (f1 >= -f && f1 <= f) {
    const f3 = f1 / f * 0.5 + 0.5;
    let f4 = 1 - (1 - Math.sin(f3 * Math.PI)) * 0.99;
    f4 *= f4;
    return [f3 * 0.3 + 0.7, f3 * f3 * 0.7 + 0.2, 0.2, f4];
  }
  return null;
}

export function cloudColor(angle, rain, thunder) {
  let f1 = Math.cos(angle * Math.PI * 2) * 2 + 0.5;
  f1 = Math.min(1, Math.max(0, f1));
  let r = f1 * 0.9 + 0.1, g = f1 * 0.9 + 0.1, b = f1 * 0.85 + 0.15;
  if (rain > 0) {
    const f6 = (r * 0.3 + g * 0.59 + b * 0.11) * 0.6;
    const f7 = 1 - rain * 0.95;
    r = r * f7 + f6 * (1 - f7); g = g * f7 + f6 * (1 - f7); b = b * f7 + f6 * (1 - f7);
  }
  r *= 1 - thunder * 0.5; g *= 1 - thunder * 0.5; b *= 1 - thunder * 0.5;
  return [r, g, b];
}

export function brightnessTable(dimension) {
  const f = dimension === -1 ? 0.1 : 0;
  const t = [];
  for (let i = 0; i <= 15; i++) {
    const f1 = 1 - i / 15;
    t.push((1 - f1) / (f1 * 3 + 1) * (1 - f) + f);
  }
  return t;
}

// Lightmap as in EntityRenderer.updateLightmap. data: Uint8Array(16*16*4), index = sky*16 + block
export function updateLightmap(data, opts) {
  const { sun, dimension, torchFlicker, gamma, nightVision = 0, lightning = 0 } = opts;
  const table = brightnessTable(dimension);
  const f1 = sun * 0.95 + 0.05;
  for (let i = 0; i < 256; i++) {
    const skyI = i >> 4, blkI = i & 15;
    let f2 = table[skyI] * f1;
    const f3 = table[blkI] * (torchFlicker * 0.1 + 1.5);
    if (lightning > 0) f2 = table[skyI];
    const f4 = f2 * (sun * 0.65 + 0.35);
    const f5 = f2 * (sun * 0.65 + 0.35);
    const f6 = f3 * ((f3 * 0.6 + 0.4) * 0.6 + 0.4);
    const f7 = f3 * (f3 * f3 * 0.6 + 0.4);
    let r = f4 + f3, g = f5 + f6, b = f2 + f7;
    r = r * 0.96 + 0.03; g = g * 0.96 + 0.03; b = b * 0.96 + 0.03;
    if (dimension === 1) { r = 0.22 + f3 * 0.75; g = 0.28 + f6 * 0.75; b = 0.25 + f7 * 0.75; }
    if (nightVision > 0) {
      let f15 = 1 / Math.max(r, g, b);
      if (!isFinite(f15)) f15 = 1;
      r = r * (1 - nightVision) + r * f15 * nightVision;
      g = g * (1 - nightVision) + g * f15 * nightVision;
      b = b * (1 - nightVision) + b * f15 * nightVision;
    }
    r = Math.min(1, Math.max(0, r)); g = Math.min(1, Math.max(0, g)); b = Math.min(1, Math.max(0, b));
    let rr = 1 - r, gg = 1 - g, bb = 1 - b;
    rr = 1 - rr * rr * rr * rr; gg = 1 - gg * gg * gg * gg; bb = 1 - bb * bb * bb * bb;
    r = r * (1 - gamma) + rr * gamma; g = g * (1 - gamma) + gg * gamma; b = b * (1 - gamma) + bb * gamma;
    r = r * 0.96 + 0.03; g = g * 0.96 + 0.03; b = b * 0.96 + 0.03;
    r = Math.min(1, Math.max(0, r)); g = Math.min(1, Math.max(0, g)); b = Math.min(1, Math.max(0, b));
    // stored so that texture coords (block, sky) -> x = block, y = sky
    const idx = (skyI * 16 + blkI) * 4;
    data[idx] = r * 255; data[idx + 1] = g * 255; data[idx + 2] = b * 255; data[idx + 3] = 255;
  }
}

// Star field (vanilla RenderGlobal.renderStars with seed 10842)
// Returns triangle positions (x,y,z per vertex)
export function buildStarPositions() {
  // Java Random(10842L)
  let seed = (10842n ^ 0x5DEECE66Dn) & ((1n << 48n) - 1n);
  const next = (bits) => {
    seed = (seed * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n);
    return Number(BigInt.asIntN(32, seed >> BigInt(48 - bits)));
  };
  const nextFloat = () => (next(24) >>> 0) / (1 << 24);
  const nextDouble = () => ((next(26) >>> 0) * 134217728 + (next(27) >>> 0)) / 9007199254740992;
  const pos = [];
  for (let i = 0; i < 1500; i++) {
    let d0 = nextFloat() * 2 - 1, d1 = nextFloat() * 2 - 1, d2 = nextFloat() * 2 - 1;
    const d3 = 0.15 + nextFloat() * 0.1;
    let d4 = d0 * d0 + d1 * d1 + d2 * d2;
    if (d4 < 1 && d4 > 0.01) {
      d4 = 1 / Math.sqrt(d4);
      d0 *= d4; d1 *= d4; d2 *= d4;
      const d5 = d0 * 100, d6 = d1 * 100, d7 = d2 * 100;
      const d8 = Math.atan2(d0, d2);
      const d9 = Math.sin(d8), d10 = Math.cos(d8);
      const d11 = Math.atan2(Math.sqrt(d0 * d0 + d2 * d2), d1);
      const d12 = Math.sin(d11), d13 = Math.cos(d11);
      const d14 = nextDouble() * Math.PI * 2;
      const d15 = Math.sin(d14), d16 = Math.cos(d14);
      const quad = [];
      for (let j = 0; j < 4; j++) {
        const d18 = ((j & 2) - 1) * d3;
        const d19 = (((j + 1) & 2) - 1) * d3;
        const d21 = d18 * d16 - d19 * d15;
        const d22 = d19 * d16 + d18 * d15;
        const d23 = d21 * d12 + 0 * d13;
        const d24 = 0 * d12 - d21 * d13;
        const d25 = d24 * d9 - d22 * d10;
        const d26 = d22 * d9 + d24 * d10;
        quad.push([d5 + d25, d6 + d23, d7 + d26]);
      }
      pos.push(...quad[0], ...quad[1], ...quad[2], ...quad[0], ...quad[2], ...quad[3]);
    }
  }
  return pos;
}
