// Port of vanilla VisGraph: which faces of a 16^3 section can see each other through non-opaque blocks.
// Result: Uint8Array(6), bit b of entry a set when face a connects to face b (DIR_OFFSETS order).
import { getBlock } from '../world/blocks.js';

const ALL = new Uint8Array([63, 63, 63, 63, 63, 63]);
const stack = new Int32Array(4096);
const seen = new Uint8Array(4096);

export function allVisible() { return ALL.slice(); }

// blocksArr: Uint16Array(4096) indexed (y << 8) | (z << 4) | x. fancyLeaves: leaves don't block vision.
export function computeVisibility(blocksArr, fancyLeaves) {
  seen.fill(0);
  let opaqueCount = 0;
  for (let i = 0; i < 4096; i++) {
    const b = getBlock(blocksArr[i]);
    if (b && b.opaque && !(fancyLeaves && b.name.endsWith('_leaves'))) { seen[i] = 1; opaqueCount++; }
  }
  // Vanilla shortcut: nearly empty sections connect everything
  if (opaqueCount < 256) return allVisible();
  const vis = new Uint8Array(6);
  if (opaqueCount === 4096) return vis;
  // Flood fill from every open block on the section border
  for (let i = 0; i < 4096; i++) {
    if (seen[i]) continue;
    const x = i & 15, z = (i >> 4) & 15, y = i >> 8;
    if (x !== 0 && x !== 15 && y !== 0 && y !== 15 && z !== 0 && z !== 15) continue;
    let faces = 0, sp = 0;
    stack[sp++] = i; seen[i] = 1;
    while (sp > 0) {
      const j = stack[--sp];
      const jx = j & 15, jz = (j >> 4) & 15, jy = j >> 8;
      if (jy === 0) faces |= 1; else if (!seen[j - 256]) { seen[j - 256] = 1; stack[sp++] = j - 256; }
      if (jy === 15) faces |= 2; else if (!seen[j + 256]) { seen[j + 256] = 1; stack[sp++] = j + 256; }
      if (jz === 0) faces |= 4; else if (!seen[j - 16]) { seen[j - 16] = 1; stack[sp++] = j - 16; }
      if (jz === 15) faces |= 8; else if (!seen[j + 16]) { seen[j + 16] = 1; stack[sp++] = j + 16; }
      if (jx === 0) faces |= 16; else if (!seen[j - 1]) { seen[j - 1] = 1; stack[sp++] = j - 1; }
      if (jx === 15) faces |= 32; else if (!seen[j + 1]) { seen[j + 1] = 1; stack[sp++] = j + 1; }
    }
    for (let a = 0; a < 6; a++) if (faces & (1 << a)) vis[a] |= faces;
  }
  return vis;
}
