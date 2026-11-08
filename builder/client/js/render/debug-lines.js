// Debug line overlays: F3+B entity hitboxes (RenderManager.renderDebugBoundingBox) and F3+G chunk borders
// (DebugRendererChunkBorder). The F3 direction axes at the crosshair are drawn by the HUD (GuiIngame, 1.12).
import { FORMAT, colorParams } from '../gfx/device.js';

const P_WHITE = colorParams(1, 1, 1, 1);
const MAX_SEGS = 4096;

class LineBatch {
  constructor(device) {
    this.device = device;
    this.data = new Float32Array(MAX_SEGS * 2 * 9);
    this.mesh = device.createMesh(FORMAT.color, new Float32Array(2 * 9), { dynamic: true });
    this.n = 0;
  }
  begin() { this.n = 0; }
  line(x0, y0, z0, x1, y1, z1, r, g, b, a = 1) {
    if (this.n >= MAX_SEGS) return;
    const d = this.data;
    let o = this.n * 18;
    d[o] = x0; d[o + 1] = y0; d[o + 2] = z0; d[o + 3] = 0; d[o + 4] = 0; d[o + 5] = r; d[o + 6] = g; d[o + 7] = b; d[o + 8] = a;
    o += 9;
    d[o] = x1; d[o + 1] = y1; d[o + 2] = z1; d[o + 3] = 0; d[o + 4] = 0; d[o + 5] = r; d[o + 6] = g; d[o + 7] = b; d[o + 8] = a;
    this.n++;
  }
  // RenderGlobal.drawOutlinedBoundingBox
  box(x0, y0, z0, x1, y1, z1, r, g, b, a = 1) {
    this.line(x0, y0, z0, x1, y0, z0, r, g, b, a); this.line(x1, y0, z0, x1, y0, z1, r, g, b, a);
    this.line(x1, y0, z1, x0, y0, z1, r, g, b, a); this.line(x0, y0, z1, x0, y0, z0, r, g, b, a);
    this.line(x0, y1, z0, x1, y1, z0, r, g, b, a); this.line(x1, y1, z0, x1, y1, z1, r, g, b, a);
    this.line(x1, y1, z1, x0, y1, z1, r, g, b, a); this.line(x0, y1, z1, x0, y1, z0, r, g, b, a);
    this.line(x0, y0, z0, x0, y1, z0, r, g, b, a); this.line(x1, y0, z0, x1, y1, z0, r, g, b, a);
    this.line(x1, y0, z1, x1, y1, z1, r, g, b, a); this.line(x0, y0, z1, x0, y1, z1, r, g, b, a);
  }
  draw(d, state) {
    if (!this.n) return;
    this.device.updateMesh(this.mesh, this.data.subarray(0, this.n * 18));
    d.draw({ mesh: this.mesh, pipeline: 'color', params: P_WHITE, primitive: 'lines', state });
  }
}

export class DebugLines {
  constructor(game) {
    this.game = game;
    this.boxes = new LineBatch(game.device);
    const draw = (d) => this.boxes.draw(d, { blend: 'alpha', depthWrite: false, cull: false });
    draw.order = 20;
    game.renderer.extraDraws.push(draw);
  }

  update(partial) {
    const g = this.game;
    this.boxes.begin();
    if (g.showHitboxes) {
      const er = g.entityRenderer;
      const list = [...g.entities.all()];
      if (g.entities.self && g.thirdPerson > 0) list.push(g.entities.self);
      for (const e of list) {
        if (e.invisible || e.kind === 'dragonPart') continue;
        const v = er.visuals.get(e.id);
        if (!v || !v.root.visible || (v.yawGroup && !v.yawGroup.visible)) continue;
        const p = g.entities.interp(e, partial);
        const hw = (e.width || 0) / 2, h = e.height || 0;
        if (e.box) { const b = e.box; this.boxes.box(b[0], b[1], b[2], b[3], b[4], b[5], 1, 1, 1, 1); continue; }
        this.boxes.box(p.x - hw, p.y, p.z - hw, p.x + hw, p.y + h, p.z + hw, 1, 1, 1, 1);
        if (e.kind === 'mob' || e.kind === 'player') {
          // eye height (red) and look vector x2 (blue)
          const ey = p.y + (e.eyeHeight || h * 0.85);
          this.boxes.box(p.x - hw, ey - 0.01, p.z - hw, p.x + hw, ey + 0.01, p.z + hw, 1, 0, 0, 1);
          const yaw = (e.prevHeadYaw !== undefined ? e.prevHeadYaw + wrap(e.headYaw - e.prevHeadYaw) * partial : e.yaw) * Math.PI / 180;
          const pitch = (e.prevPitch !== undefined ? e.prevPitch + (e.pitch - e.prevPitch) * partial : e.pitch || 0) * Math.PI / 180;
          const lx = -Math.sin(yaw) * Math.cos(pitch), ly = -Math.sin(pitch), lz = Math.cos(yaw) * Math.cos(pitch);
          this.boxes.line(p.x, ey, p.z, p.x + lx * 2, ey + ly * 2, p.z + lz * 2, 0, 0, 1, 1);
        }
      }
    }
    if (g.showChunkBorders) this._chunkBorders(partial);
  }

  // DebugRendererChunkBorder: red lines at the neighbouring chunks' corners, yellow every 2 blocks along this chunk's
  // edges and every 2 blocks up, blue at its corners and every 16 blocks up (lines from y 0 to 256)
  _chunkBorders() {
    const g = this.game, B = this.boxes;
    const cx = Math.floor(g.player.x / 16) * 16, cz = Math.floor(g.player.z / 16) * 16;
    for (let n = -16; n <= 32; n += 16) for (let m = -16; m <= 32; m += 16) B.line(cx + n, 0, cz + m, cx + n, 256, cz + m, 1, 0, 0, 1);
    const Y = [1, 1, 0, 1];
    for (let n = 2; n < 16; n += 2) {
      B.line(cx + n, 0, cz, cx + n, 256, cz, ...Y); B.line(cx + n, 0, cz + 16, cx + n, 256, cz + 16, ...Y);
      B.line(cx, 0, cz + n, cx, 256, cz + n, ...Y); B.line(cx + 16, 0, cz + n, cx + 16, 256, cz + n, ...Y);
    }
    const ring = (y, c) => {
      B.line(cx, y, cz, cx, y, cz + 16, ...c); B.line(cx, y, cz + 16, cx + 16, y, cz + 16, ...c);
      B.line(cx + 16, y, cz + 16, cx + 16, y, cz, ...c); B.line(cx + 16, y, cz, cx, y, cz, ...c);
    };
    for (let y = 0; y <= 256; y += 2) if (y % 16) ring(y, Y);
    const Bl = [0.25, 0.25, 1, 1];
    for (const n of [0, 16]) for (const m of [0, 16]) B.line(cx + n, 0, cz + m, cx + n, 256, cz + m, ...Bl);
    for (let y = 0; y <= 256; y += 16) ring(y, Bl);
  }
}

function wrap(a) { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; }
