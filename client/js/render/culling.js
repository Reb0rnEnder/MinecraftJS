// Section occlusion culling (vanilla RenderGlobal.setupTerrain / Sodium's graph search): a breadth-first walk
// from the camera's section that only passes through section faces the visibility graph says are connected,
// never turns back towards the camera, and stays inside the view frustum. Sections it never reaches are
// hidden behind terrain and are not drawn; entities and block entities in them are skipped too.
import { aabbInFrustum } from '../gfx/math.js';
import { DIR_OFFSETS, OPPOSITE } from '../world/blocks.js';

export const sectionKey = (cx, sy, cz) => ((cx + 0x100000) * 0x200000 + (cz + 0x100000)) * 16 + sy;

export class SectionCuller {
  constructor() {
    this.enabled = true;
    this.R = -1;
    this.reachedCount = 0;
  }

  _alloc(R) {
    this.R = R;
    this.W = 2 * R + 1;
    const n = this.W * this.W * 16;
    this.state = new Uint8Array(n);     // 0 unvisited, else 1 + entry face (or 7 for the start)
    this.dirs = new Uint8Array(n);      // directions travelled to reach this section
    this.queue = new Int32Array(n);
    this.columns = new Uint8Array(this.W * this.W);
  }

  // sections: Map sectionKey -> { vis?: Uint8Array(6), ... }. columnLoaded(cx, cz) -> bool.
  // Returns the reached sections that have geometry, in walk order (roughly near to far).
  // maxDist: fog end; sections entirely beyond it render as pure fog colour and are skipped (Sodium's fog occlusion)
  update(sections, frustum, cam, renderDistance, columnLoaded, cameraInOpaque, maxDist = Infinity) {
    const R = renderDistance + 1;
    if (R !== this.R) this._alloc(R);
    const W = this.W, state = this.state, dirs = this.dirs, queue = this.queue;
    state.fill(0);
    const ccx = Math.floor(cam[0] / 16), ccy = Math.floor(cam[1] / 16), ccz = Math.floor(cam[2] / 16);
    this.ccx = ccx; this.ccz = ccz;
    for (let i = 0; i < W; i++) for (let j = 0; j < W; j++) this.columns[i * W + j] = columnLoaded(ccx - R + j, ccz - R + i) ? 1 : 0;
    const idx = (cx, sy, cz) => ((cz - ccz + R) * W + (cx - ccx + R)) * 16 + sy;
    const out = [];
    let head = 0, tail = 0;
    const md2 = maxDist * maxDist;
    const inView = (cx, sy, cz) => {
      const x0 = cx * 16, y0 = sy * 16, z0 = cz * 16;
      // distance from the camera to the nearest point of the section
      const dx = Math.max(x0 - cam[0], 0, cam[0] - x0 - 16), dy = Math.max(y0 - cam[1], 0, cam[1] - y0 - 16), dz = Math.max(z0 - cam[2], 0, cam[2] - z0 - 16);
      if (dx * dx + dy * dy + dz * dz > md2) return false;
      return aabbInFrustum(frustum, x0, y0, z0, x0 + 16, y0 + 16, z0 + 16);
    };
    const occlude = this.enabled && !cameraInOpaque;
    if (ccy >= 0 && ccy < 16 && this.columns[R * W + R]) {
      const i = idx(ccx, ccy, ccz);
      state[i] = 7; dirs[i] = 0; queue[tail++] = i;
    } else {
      // Camera above / below the world (or in an unloaded column): seed with the nearest layer in view
      const sy = ccy >= 16 ? 15 : 0, entry = ccy >= 16 ? 1 : 0;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        if (!this.columns[(dz + R) * W + dx + R]) continue;
        const cx = ccx + dx, cz = ccz + dz;
        if (!inView(cx, sy, cz)) continue;
        const i = idx(cx, sy, cz);
        state[i] = 1 + entry; dirs[i] = 0; queue[tail++] = i;
      }
    }
    while (head < tail) {
      const i = queue[head++];
      const sy = i & 15, col = i >> 4, cz = ((col / W) | 0) - R + ccz, cx = (col % W) - R + ccx;
      const s = sections.get(sectionKey(cx, sy, cz));
      if (s && (s.solid || s.cutout || s.translucent)) out.push(s);
      const entry = state[i] - 1; // face we came in through (6 = start)
      const vis = occlude && s ? s.vis : null;
      for (let d = 0; d < 6; d++) {
        if (occlude && (dirs[i] & (1 << OPPOSITE[d]))) continue; // never walk back towards the camera
        if (vis && entry < 6 && !(vis[entry] & (1 << d))) continue; // no path through this section
        const o = DIR_OFFSETS[d];
        const nx = cx + o[0], ny = sy + o[1], nz = cz + o[2];
        if (ny < 0 || ny > 15 || Math.abs(nx - ccx) > R || Math.abs(nz - ccz) > R) continue;
        const col2 = (nz - ccz + R) * W + (nx - ccx + R);
        if (!this.columns[col2]) continue;
        const j = col2 * 16 + ny;
        if (state[j]) continue;
        if (!inView(nx, ny, nz)) continue;
        state[j] = 1 + OPPOSITE[d];
        dirs[j] = dirs[i] | (1 << d);
        queue[tail++] = j;
      }
    }
    this.reachedCount = tail;
    return out;
  }

  // Was the section containing this block reached by the last walk? (entities / block entities)
  isVisible(x, y, z) {
    if (this.R < 0 || !this.state) return true;
    const sy = Math.floor(y / 16);
    if (sy < 0 || sy > 15) return true;
    const cx = Math.floor(x / 16), cz = Math.floor(z / 16), R = this.R;
    if (Math.abs(cx - this.ccx) > R || Math.abs(cz - this.ccz) > R) return false;
    return this.state[((cz - this.ccz + R) * this.W + (cx - this.ccx + R)) * 16 + sy] !== 0;
  }
}
