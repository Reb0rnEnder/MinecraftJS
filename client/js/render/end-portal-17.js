// 1.17+ rendertype_end_portal / rendertype_end_gateway core shader, drawn as additive passes of the 'endportal'
// device pipeline:
//   color = texProj(end_sky) * COLORS[0] + sum_{i<layers} texProj(end_portal * end_portal_layer(i + 1)) * COLORS[i]
// texProj0 is the fragment's screen position (a, b) in 0..1. end_portal_layer(L) maps it to
//   0.5 * s * R(angle) * (a, b) + 0.5 * (17 / L, (2 + L / 1.5) * GameTime * 1.5) + 0.25
// with s = (4.5 - L / 4) * 2 and angle = radians((L^2 * 4321 + L * 9) * 2). The pipeline samples
// fract(0.5 + 0.5 * (R * (ndc * scale) + offset)) with ndc = 2 * (a, b) - 1, so scale = s / 2 and
// offset = 0.5 * s * R(1, 1) + (17 / L, dy) - 0.5. Params[3] = 2 selects opaque output without fog.
const f32 = Math.fround;
export const END_PORTAL_COLORS_17 = [
  [0.022087, 0.098399, 0.110818], [0.011892, 0.095924, 0.089485], [0.027636, 0.101689, 0.100326], [0.046564, 0.109883, 0.114838],
  [0.064901, 0.117696, 0.097189], [0.063761, 0.086895, 0.123646], [0.084817, 0.111994, 0.166380], [0.097489, 0.154120, 0.091064],
  [0.106152, 0.131144, 0.195191], [0.097721, 0.110188, 0.187229], [0.133516, 0.138278, 0.148582], [0.070006, 0.243332, 0.235792],
  [0.196766, 0.142899, 0.214696], [0.047281, 0.315338, 0.321970], [0.204675, 0.390010, 0.302066], [0.080955, 0.314821, 0.661491],
];
export const END_SKY_TEXTURE = 'environment/end_sky.png';
export const END_PORTAL_TEXTURE = 'entity/end_portal.png';
// rendertype_end_portal.json / rendertype_end_gateway.json EndPortalLayers
export const PORTAL_LAYERS = 15, GATEWAY_LAYERS = 16;

// Static part of each pass: [{ texture, blend, params, layer }]; the first is the sky
export function endPortalPasses17(layers) {
  const passes = [];
  const sky = new Float32Array(16);
  sky.set(END_PORTAL_COLORS_17[0], 0); sky[3] = 2; sky[4] = 1;
  passes.push({ texture: END_SKY_TEXTURE, blend: 'none', params: sky, layer: 0 });
  for (let i = 0; i < layers; i++) {
    const L = i + 1, p = new Float32Array(16);
    p.set(END_PORTAL_COLORS_17[i], 0); p[3] = 2;
    const s = f32(f32(4.5 - f32(L / 4)) * 2);
    // radians() of an exactly representable float, as the shader computes it
    const angle = f32(f32((L * L * 4321 + L * 9) * 2) * f32(Math.PI / 180));
    const c = Math.cos(angle), sn = Math.sin(angle);
    p[4] = s / 2; p[5] = angle % (Math.PI * 2);
    passes.push({ texture: END_PORTAL_TEXTURE, blend: 'add', params: p, layer: L, s, c, sn });
  }
  return passes;
}

// RenderSystem.setShaderGameTime: ((gameTime % 24000) + partial) / 24000
export function shaderGameTime(gameTime, partial) {
  const t = typeof gameTime === 'bigint' ? Number(gameTime % 24000n) : (Number(gameTime) || 0) % 24000;
  return f32(f32(t + partial) / 24000);
}

export function updateEndPortalPasses17(passes, time, width, height) {
  for (const P of passes) {
    const p = P.params;
    p[8] = width; p[9] = height;
    if (!P.layer) continue;
    const L = P.layer, dy = f32(f32(2 + f32(L / 1.5)) * f32(time * 1.5));
    p[6] = 0.5 * P.s * (P.c - P.sn) + 17 / L - 0.5;
    p[7] = 0.5 * P.s * (P.sn + P.c) + dy - 0.5;
    // the offset enters the UV halved: keep it small for float precision by wrapping modulo 2
    p[6] -= 2 * Math.floor(p[6] / 2); p[7] -= 2 * Math.floor(p[7] / 2);
  }
}
