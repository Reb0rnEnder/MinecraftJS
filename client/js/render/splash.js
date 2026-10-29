// Native 1.16 startup logo: two 512x256 atlas halves form a 1024x256 wordmark.
import { FORMAT, colorParams } from '../gfx/device.js';
import { mat4 } from '../gfx/math.js';
import { platform } from '../platform/platform.js';
import { decodePng } from '../util/png.js';

const PARAMS = colorParams(1, 1, 1, 1, 0.004, 0);
const STATE = { blend: 'alpha', depthTest: false, depthWrite: false };

export class Splash {
  constructor(device) {
    this.device = device;
    this.tex = null;
    this.running = false;
    this.mesh = device.createMesh(FORMAT.color, new Float32Array(72), { quads: true, dynamic: true });
    this.view = mat4.create();
    this.proj = mat4.create();
  }

  // bytes: mojangstudios.png (from a resource pack or the base assets)
  async load(bytes) {
    if (!bytes) return;
    try {
      const img = decodePng(bytes);
      this.tex = this.device.createTexture({ width: img.width, height: img.height, data: img.data, filter: 'nearest' });
    } catch (e) { /* draw plain white */ }
  }

  start() {
    this.running = true;
    const loop = () => { if (!this.running) return; this.draw(); platform().requestFrame(loop); };
    loop();
  }

  stop() {
    this.running = false;
    if (this.tex) this.device.destroyTexture(this.tex);
    this.device.destroyMesh(this.mesh);
  }

  draw() {
    const d = this.device;
    const P = platform();
    const w = P.width, h = P.height;
    const sw = w / (P.dpr || 1), sh = h / (P.dpr || 1);
    d.beginFrame([239 / 255, 50 / 255, 61 / 255]);
    if (this.tex) {
      const width = Math.min(512, sw * .75), height = width / 4;
      const left = (sw - width) / 2, top = (sh - height) / 2;
      const vertices = [];
      for (let half = 0; half < 2; half++) {
        const x0 = left + half * width / 2, x1 = x0 + width / 2;
        const y0 = top, y1 = top + height, v0 = half / 2, v1 = v0 + .5;
        vertices.push(x0,y0,0,0,v0,1,1,1,1, x0,y1,0,0,v1,1,1,1,1,
          x1,y1,0,1,v1,1,1,1,1, x1,y0,0,1,v0,1,1,1,1);
      }
      d.updateMesh(this.mesh, new Float32Array(vertices), { quads: true });
      mat4.ortho(this.proj, 0, sw, sh, 0, -1, 1);
      d.setGlobals({ view: this.view, proj: this.proj, fogMode: 2 });
      d.draw({ mesh: this.mesh, pipeline: 'color', textures: [this.tex], params: PARAMS, state: STATE });
    }
    d.endFrame();
  }
}
