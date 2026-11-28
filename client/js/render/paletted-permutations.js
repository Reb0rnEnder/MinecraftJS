// PalettedPermutations atlas source. Images are { width, height, data: Uint8Array RGBA }.
export function paletteMapping(keyPixels, valuePixels) {
  if (keyPixels.length !== valuePixels.length) {
    throw new Error('Palette mapping has different sizes: ' + keyPixels.length / 4 + ' and ' + valuePixels.length / 4);
  }
  const map = new Map();
  for (let i = 0; i < keyPixels.length; i += 4) {
    if (keyPixels[i + 3] === 0) continue;
    const rgb = (keyPixels[i] << 16) | (keyPixels[i + 1] << 8) | keyPixels[i + 2];
    map.set(rgb, [valuePixels[i], valuePixels[i + 1], valuePixels[i + 2], valuePixels[i + 3]]);
  }
  return map;
}

export function applyPalette(image, map) {
  const source = image.data, data = new Uint8Array(source.length);
  for (let i = 0; i < source.length; i += 4) {
    const alpha = source[i + 3];
    if (alpha === 0) {
      data[i] = source[i]; data[i + 1] = source[i + 1]; data[i + 2] = source[i + 2]; data[i + 3] = 0;
      continue;
    }
    const rgb = (source[i] << 16) | (source[i + 1] << 8) | source[i + 2];
    const mapped = map.get(rgb);
    data[i] = mapped ? mapped[0] : source[i];
    data[i + 1] = mapped ? mapped[1] : source[i + 1];
    data[i + 2] = mapped ? mapped[2] : source[i + 2];
    data[i + 3] = Math.trunc(alpha * (mapped ? mapped[3] : 255) / 255);
  }
  return { width: image.width, height: image.height, data };
}

const strip = (id) => String(id).replace(/^minecraft:/, '');

export async function palettedPermutationSprites(definitions, loadImage) {
  const output = [];
  for (const definition of definitions) for (const source of definition?.sources || []) {
    if (strip(source.type) !== 'paletted_permutations') continue;
    const key = await loadImage(strip(source.palette_key));
    if (!key) continue;
    const mappings = [];
    for (const [suffix, location] of Object.entries(source.permutations || {})) {
      const palette = await loadImage(strip(location));
      if (!palette) continue;
      try { mappings.push([suffix, paletteMapping(key.data, palette.data)]); }
      catch { /* native skips palette pairs with different dimensions */ }
    }
    for (const texture of source.textures || []) {
      const base = await loadImage(strip(texture));
      if (!base) continue;
      for (const [suffix, mapping] of mappings) {
        output.push({ name: strip(texture) + '_' + suffix, image: applyPalette(base, mapping) });
      }
    }
  }
  return output;
}
