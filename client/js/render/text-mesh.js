// World-space text: FontRenderer glyph quads turned into FORMAT.color meshes (one per glyph texture).
// Coordinates are in font pixels with y pointing down, like the GUI; callers transform the node.
import { FORMAT } from '../gfx/device.js';

// items: [{ text, x, y, color, shadow, alpha }], rects: [{ x0, y0, x1, y1, color: [r,g,b,a] }] drawn first.
// Returns [{ mesh, tex }] where tex null means the white texture.
export function buildTextMeshes(device, font, items, rects = [], z = 0) {
  const groups = new Map();
  const push = (tex, x0, y0, x1, y1, u0, v0, u1, v1, c, skew, zz, origin = y0) => {
    let g = groups.get(tex);
    if (!g) { g = []; groups.set(tex, g); }
    const top = skew ? (origin + 4 - y0) * 0.25 : 0, bottom = skew ? (origin + 4 - y1) * 0.25 : 0;
    g.push(
      [x0 + top, y0, zz, u0, v0, c[0], c[1], c[2], c[3]],
      [x0 + bottom, y1, zz, u0, v1, c[0], c[1], c[2], c[3]],
      [x1 + bottom, y1, zz, u1, v1, c[0], c[1], c[2], c[3]],
      [x1 + top, y0, zz, u1, v0, c[0], c[1], c[2], c[3]],
    );
  };
  for (const r of rects) push(null, r.x0, r.y0, r.x1, r.y1, 0, 0, 1, 1, r.color, false, z + 0.01);
  for (const it of items) {
    const { quads } = font.layout(it.text, it.x, it.y, it.color === undefined ? 0xffffff : it.color, !!it.shadow, it.alpha === undefined ? 1 : it.alpha);
    let i = 0;
    for (const q of quads) {
      // shadow glyphs sit slightly behind the text to avoid z-fighting
      const zz = z - (i++ < quads.length / 2 && it.shadow ? 0 : 0.005);
      push(q.tex || null, q.x0, q.y0, q.x1, q.y1, q.u0 || 0, q.v0 || 0, q.u1 || 1, q.v1 || 1, q.color, q.skew, zz, q.skewOrigin);
    }
  }
  const out = [];
  for (const [tex, verts] of groups) {
    const data = new Float32Array(verts.length * 9);
    verts.forEach((v, i) => data.set(v, i * 9));
    out.push({ mesh: device.createMesh(FORMAT.color, data, { quads: true }), tex });
  }
  return out;
}

export function destroyTextMeshes(device, list) {
  if (list) for (const t of list) device.destroyMesh(t.mesh);
}
