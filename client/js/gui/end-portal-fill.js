// GuiGraphics.fill(RenderType.endPortal(), ...): a GUI rectangle filled with the 1.17+ end portal shader, as used by
// WinScreen's poem background and the end-portal ReceivingLevelScreen (1.20.5+).
import {FORMAT} from '../gfx/device.js';
import {mat4} from '../gfx/math.js';
import {endPortalPasses17,updateEndPortalPasses17,shaderGameTime,PORTAL_LAYERS} from '../render/end-portal-17.js';

export class EndPortalFill {
  constructor(game) { this.game = game; this.mesh = null; this.size = ''; this.passes = endPortalPasses17(PORTAL_LAYERS); }
  draw(gui, x0, y0, x1, y1, partial) {
    const g = this.game, d = g.device, size = [x0, y0, x1, y1].join(',');
    if (!this.mesh || this.size !== size) {
      if (this.mesh) d.destroyMesh(this.mesh);
      this.mesh = d.createMesh(FORMAT.color, new Float32Array([x0,y0,0,0,0,1,1,1,1, x0,y1,0,0,1,1,1,1,1, x1,y1,0,1,1,1,1,1,1, x1,y0,0,1,0,1,1,1,1]), { quads: true });
      this.size = size;
    }
    updateEndPortalPasses17(this.passes, shaderGameTime(g.world?.worldAge ?? 0, partial), d.width, d.height);
    for (const P of this.passes) {
      const tex = g.assets.texture(P.texture, { wrap: 'repeat' });
      if (tex) gui.drawMesh({ mesh: this.mesh, pipeline: 'endportal', textures: [tex], params: P.params, state: { blend: P.blend, depthTest: false, depthWrite: false, cull: false } }, mat4.create());
    }
  }
  destroy() { if (this.mesh) this.game.device.destroyMesh(this.mesh); this.mesh = null; }
}
