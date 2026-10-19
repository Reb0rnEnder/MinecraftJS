// Startup splash (Minecraft.drawSplashScreen): the Mojang logo (256x256 texture) centred on white, pixel-sharp at a
// fixed whole-number scale (about 512 CSS pixels, smaller only when the window cannot fit it).
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
    this.mesh = device.createMesh(FORMAT.color, new Float32Array(36), { quads: true, dynamic: true });
    this.view = mat4.create();
    this.proj = mat4.create();
  }

  // bytes: mojang.png (from a resource pack or the base assets)
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
    let scale = Math.max(1, Math.round(2 * (P.dpr || 1)));
    while (scale > 1 && 256 * scale > Math.min(w, h)) scale--;
    const sw = w / scale, sh = h / scale;
    d.beginFrame([1, 1, 1]);
    if (this.tex) {
      const x0 = Math.floor((sw - 256) / 2), y0 = Math.floor((sh - 256) / 2), x1 = x0 + 256, y1 = y0 + 256;
      d.updateMesh(this.mesh, new Float32Array([
        x0, y0, 0, 0, 0, 1, 1, 1, 1,
        x0, y1, 0, 0, 1, 1, 1, 1, 1,
        x1, y1, 0, 1, 1, 1, 1, 1, 1,
        x1, y0, 0, 1, 0, 1, 1, 1, 1,
      ]), { quads: true });
      mat4.ortho(this.proj, 0, sw, sh, 0, -1, 1);
      d.setGlobals({ view: this.view, proj: this.proj, fogMode: 2 });
      d.draw({ mesh: this.mesh, pipeline: 'color', textures: [this.tex], params: PARAMS, state: STATE });
    }
    d.endFrame();
  }
}
