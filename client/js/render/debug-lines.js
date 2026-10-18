// Debug line overlays: F3+B entity hitboxes (RenderManager.renderDebugBoundingBox) and the F3 world
// direction axes that replace the crosshair (EntityRenderer.renderWorldDirections).
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
    this.axes = new LineBatch(game.device);
    this.axesAt = null; // [x, y, z] in world space, or null
    const draw = (d) => {
      this.boxes.draw(d, { blend: 'alpha', depthWrite: false, cull: false });
      // drawn last with no depth test so the axes stay on top of the world (but under the hand)
      this.axes.draw(d, { blend: 'alpha', depthWrite: false, depthTest: false, cull: false });
    };
    draw.order = 20;
    game.renderer.extraDraws.push(draw);
  }

  // Called once per frame after the entity renderer posed everything
  update(partial) {
    const g = this.game;
    this.boxes.begin();
    this.axes.begin();
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
    const a = this.axesAt;
    if (a) {
      // AxisAlignedBB(0,0,0, 0.005,1e-4,1e-4) red / (.., 0.0033, ..) green / (.., .., 0.005) blue
      const [x, y, z] = a;
      this.axes.box(x, y, z, x + 0.005, y + 1e-4, z + 1e-4, 1, 0, 0, 1);
      this.axes.box(x, y, z, x + 1e-4, y + 1e-4, z + 0.005, 0, 0, 1, 1);
      this.axes.box(x, y, z, x + 1e-4, y + 0.0033, z + 1e-4, 0, 1, 0, 1);
    }
  }
}

function wrap(a) { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; }
