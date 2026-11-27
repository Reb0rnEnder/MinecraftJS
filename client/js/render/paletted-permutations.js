// Atlas source "paletted_permutations" (1.19.4+, PalettedPermutations): every texture is recoloured once per
// permutation by mapping the colours of palette_key onto the permutation's palette, producing "<texture>_<key>".
// Images are { width, height, data: Uint8Array RGBA }.

// PalettedPermutations.createPaletteMapping: opaque-or-not key colours (alpha ignored) -> full permutation colours
export function paletteMapping(keyPixels, valuePixels) {
  if (keyPixels.length !== valuePixels.length) throw new Error('Palette mapping has different sizes: ' + keyPixels.length / 4 + ' and ' + valuePixels.length / 4);
  const map = new Map();
  for (let i = 0; i < keyPixels.length; i += 4) {
    if (keyPixels[i + 3] === 0) continue;
    const rgb = (keyPixels[i] << 16) | (keyPixels[i + 1] << 8) | keyPixels[i + 2];
    map.set(rgb, [valuePixels[i], valuePixels[i + 1], valuePixels[i + 2], valuePixels[i + 3]]);
  }
  return map;
}

// Each pixel: unchanged when fully transparent; otherwise its RGB is looked up (unmatched colours keep their RGB,
// fully opaque) and the alpha becomes pixel alpha * mapped alpha / 255
export function applyPalette(image, map) {
  const src = image.data, out = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3];
    if (a === 0) { out[i] = src[i]; out[i + 1] = src[i + 1]; out[i + 2] = src[i + 2]; out[i + 3] = 0; continue; }
    const rgb = (src[i] << 16) | (src[i + 1] << 8) | src[i + 2];
    const m = map.get(rgb);
    const r = m ? m[0] : src[i], g = m ? m[1] : src[i + 1], b = m ? m[2] : src[i + 2], ma = m ? m[3] : 255;
    out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = Math.trunc(a * ma / 255);
  }
  return { width: image.width, height: image.height, data: out };
}

const strip = (id) => String(id).replace(/^minecraft:/, '');

// All paletted_permutations sources of an atlas definition (atlases/<name>.json merged across the pack stack,
// lowest first), resolved to [{ name, image }] with loadImage(texturePath) -> image | null
export async function palettedPermutationSprites(atlasDefinitions, loadImage) {
  const out = [];
  for (const def of atlasDefinitions) for (const source of def?.sources || []) {
    if (strip(source.type) !== 'paletted_permutations') continue;
    const key = await loadImage(strip(source.palette_key));
    if (!key) continue;
    const mappings = [];
    for (const [suffix, location] of Object.entries(source.permutations || {})) {
      const palette = await loadImage(strip(location));
      if (!palette) continue;
      try { mappings.push([suffix, paletteMapping(key.data, palette.data)]); } catch { /* mismatched palette sizes are skipped natively */ }
    }
    for (const texture of source.textures || []) {
      const base = await loadImage(strip(texture));
      if (!base) continue;
      for (const [suffix, map] of mappings) out.push({ name: strip(texture) + '_' + suffix, image: applyPalette(base, map) });
    }
  }
  return out;
}
