// Render.renderEntityOnFire: burning entities get stacked, camera-facing fire_layer_0/1 sprites from the block
// atlas (alternating and mirrored every other pair), drawn with alpha test like the entity pass.
import { FORMAT, colorParams } from '../gfx/device.js';

const PARAMS = colorParams(1, 1, 1, 1, 0.1, 1);
const STATE = { blend: 'none', cull: false };
// Entity.isImmuneToFire: these never show flames
const IMMUNE = new Set([56, 57, 61, 62, 63, 64]);

export class EntityFire {
  constructor(game) {
    this.game = game;
    this.mesh = game.device.createMesh(FORMAT.color, new Float32Array(0), { quads: true, dynamic: true });
    this.count = 0;
    const draw = (d) => {
      if (this.count) d.draw({ mesh: this.mesh, pipeline: 'color', textures: [game.assets.atlasTexture], params: PARAMS, state: STATE, count: this.count * 6 });
    };
    draw.order = 2;
    game.renderer.extraDraws.push(draw);
  }

  burning(e) {
    if (!e.onFire) return false;
    if (e.kind === 'mob' && (IMMUNE.has(e.type) || (e.type === 51 && e.wither))) return false;
    if (e.kind === 'player' && e.gamemode === 3) return false;
    return true;
  }

  // entities: [{ e, p: interpolated position }], viewYaw: RenderManager.playerViewY (degrees)
  update(entities, viewYaw) {
    const A = this.game.assets;
    const s0 = A.atlas.entries.get('blocks/fire_layer_0'), s1 = A.atlas.entries.get('blocks/fire_layer_1');
    const out = [];
    if (s0 && s1) {
      const a = -viewYaw * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
      for (const { e, p } of entities) {
        if (!this.burning(e)) continue;
        const f = (e.width || 0.6) * 1.4;
        let f1 = 0.5, f3 = (e.height || 1.8) / f, f4 = 0, f5 = 0, i = 0;
        const zOff = -0.3 + Math.trunc(f3) * 0.02;
        const vert = (x, y, z, u, v) => {
          z += zOff;
          // rotate(-playerViewY, Y) then scale(f) and translate to the entity
          const rx = x * ca + z * sa, rz = -x * sa + z * ca;
          out.push(p.x + rx * f, p.y + y * f, p.z + rz * f, u, v, 1, 1, 1, 1);
        };
        while (f3 > 0) {
          const s = i % 2 === 0 ? s0 : s1;
          let [u0, v0, u1, v1] = s.uv;
          if (Math.floor(i / 2) % 2 === 0) [u0, u1] = [u1, u0];
          vert(f1, -f4, f5, u1, v1);
          vert(-f1, -f4, f5, u0, v1);
          vert(-f1, 1.4 - f4, f5, u0, v0);
          vert(f1, 1.4 - f4, f5, u1, v0);
          f3 -= 0.45; f4 -= 0.45; f1 *= 0.9; f5 += 0.03; i++;
        }
      }
    }
    this.count = out.length / 36;
    this.game.device.updateMesh(this.mesh, new Float32Array(out), { quads: true });
  }
}
