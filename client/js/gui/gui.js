// 2D GUI layer rendered through the graphics device (vanilla-like drawing helpers).
// Quads are accumulated for the whole frame and drawn in order at end() (one vertex upload per frame).
import { FontRenderer } from './font.js';
import { FORMAT, colorParams } from '../gfx/device.js';
import { mat4 } from '../gfx/math.js';
import { toDraw } from '../gfx/scene.js';
import { platform } from '../platform/platform.js';

const MAX_QUADS = 65536;
const STRIDE = FORMAT.color.stride;
const GUI_PARAMS = colorParams(1, 1, 1, 1, 0.004, 0);

export function argb(c) {
  return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255, ((c >>> 24) & 255) / 255];
}

export class Gui {
  constructor(device, assets) {
    this.device = device;
    this.assets = assets;
    this.font = new FontRenderer(this);
    this.guiScaleSetting = 0; // 0 = auto
    this.scale = 2;
    this.width = 0;
    this.height = 0;
    this.verts = new Float32Array(MAX_QUADS * 4 * STRIDE);
    this.quadCount = 0;
    this.mesh = device.createMesh(FORMAT.color, new Float32Array(0), { quads: true, dynamic: true });
    this.white = device.createTexture({ width: 1, height: 1, data: new Uint8Array([255, 255, 255, 255]) });
    this.commands = [];
    this.stack = [mat4.create()];
    this.color = [1, 1, 1, 1];
    this.blend = 'alpha';
    this.scissorRect = null;
    this.iconDepth = 0;
    this.proj = mat4.create();
    this.resize();
  }

  get matrix() { return this.stack[this.stack.length - 1]; }

  resize() {
    const w = platform().width, h = platform().height;
    let scale = 1;
    const max = this.guiScaleSetting === 0 ? 1000 : this.guiScaleSetting;
    while (scale < max && w / (scale + 1) >= 320 && h / (scale + 1) >= 240) scale++;
    this.scale = scale;
    this.width = Math.ceil(w / scale);
    this.height = Math.ceil(h / scale);
  }

  begin() {
    this.quadCount = 0;
    this.commands.length = 0;
    this.stack.length = 1;
    mat4.identity(this.stack[0]);
    this.color = [1, 1, 1, 1];
    this.blend = 'alpha';
    this.scissorRect = null;
    this.depth = null;
    this.iconDepth = 0;
    this._cur = null;
  }

  // Flush everything to the device (call once per frame)
  end() {
    const d = this.device;
    if (this.quadCount) d.updateMesh(this.mesh, this.verts.subarray(0, this.quadCount * 4 * STRIDE), { quads: true });
    const pw = platform().width / this.scale, ph = platform().height / this.scale;
    mat4.ortho(this.proj, 0, pw, ph, 0, -400000, 400000);
    d.clearDepth();
    d.setGlobals({ view: IDENTITY, proj: this.proj, fogMode: 2 });
    for (const c of this.commands) {
      d.setScissor(c.scissor ? [c.scissor[0] * this.scale, c.scissor[1] * this.scale, c.scissor[2] * this.scale, c.scissor[3] * this.scale] : null);
      if (c.kind === 'quads') {
        const state = c.depth ? { blend: c.blend, ...c.depth } : { blend: c.blend, depthTest: false, depthWrite: false };
        const tex = (c.texture && (c.texture.bg || c.texture.tex)) ? c.texture : this.white;
        d.draw({ mesh: this.mesh, pipeline: 'color', textures: [tex], params: GUI_PARAMS, state, first: c.first * 6, count: c.count * 6 });
      } else {
        d.draw(c.draw);
      }
    }
    d.setScissor(null);
  }

  // ---------------------------------------------------------------- state

  pushMatrix() { this.stack.push(new Float32Array(this.matrix)); }
  popMatrix() { if (this.stack.length > 1) this.stack.pop(); }
  translate(x, y, z = 0) { mat4.translate(this.matrix, this.matrix, x, y, z); }
  scaleBy(x, y = x, z = 1) { mat4.scale(this.matrix, this.matrix, x, y, z); }
  rotate(rad) { mat4.rotateZ(this.matrix, this.matrix, rad); }

  setColor(r, g, b, a) { this.color = [r, g, b, a]; }
  setAlpha(a) { this.color = [1, 1, 1, a]; }
  resetColor() { this.color = [1, 1, 1, 1]; }
  setBlend(mode) { this.blend = mode || 'alpha'; }
  // Depth state for following quads (null = no depth test), e.g. { depthTest: true, depthWrite: true }
  setDepth(state) { this.depth = state || null; this._cur = null; }

  // Scissor in GUI coordinates (axis aligned, ignores the matrix stack)
  scissor(x, y, w, h) { this.scissorRect = [x, y, w, h]; this._cur = null; }
  clearScissor() { this.scissorRect = null; this._cur = null; }

  // ---------------------------------------------------------------- primitives

  _batch(texture) {
    const c = this._cur;
    if (c && c.texture === texture && c.blend === this.blend && c.scissor === this.scissorRect && c.depth === this.depth) return c;
    this._cur = { kind: 'quads', texture, blend: this.blend, scissor: this.scissorRect, depth: this.depth, first: this.quadCount, count: 0 };
    this.commands.push(this._cur);
    return this._cur;
  }

  // Emit a textured quad; corners in GUI space (before the matrix), uv in 0..1, colours per corner
  quad(texture, x0, y0, x1, y1, u0, v0, u1, v1, c0, c1 = c0, c2 = c1, c3 = c0) {
    if (!texture || this.quadCount >= MAX_QUADS) return;
    const b = this._batch(texture);
    const m = this.matrix;
    const v = this.verts;
    let o = this.quadCount * 4 * STRIDE;
    const mc = this.color;
    // vertex order: (x0,y0) (x0,y1) (x1,y1) (x1,y0)
    const pts = [[x0, y0, u0, v0, c0], [x0, y1, u0, v1, c1], [x1, y1, u1, v1, c2], [x1, y0, u1, v0, c3]];
    for (const [x, y, u, vv, c] of pts) {
      v[o] = m[0] * x + m[4] * y + m[12];
      v[o + 1] = m[1] * x + m[5] * y + m[13];
      v[o + 2] = m[2] * x + m[6] * y + m[14];
      v[o + 3] = u; v[o + 4] = vv;
      v[o + 5] = c[0] * mc[0]; v[o + 6] = c[1] * mc[1]; v[o + 7] = c[2] * mc[2]; v[o + 8] = c[3] * mc[3];
      o += STRIDE;
    }
    this.quadCount++;
    b.count++;
  }

  // Quad with explicit per-corner uvs: uvs = [[u,v] x4] in corner order (x0,y0) (x0,y1) (x1,y1) (x1,y0)
  quadUV(texture, x0, y0, x1, y1, uvs, c) {
    if (!texture || this.quadCount >= MAX_QUADS) return;
    const b = this._batch(texture);
    const m = this.matrix, v = this.verts, mc = this.color;
    let o = this.quadCount * 4 * STRIDE;
    const pts = [[x0, y0], [x0, y1], [x1, y1], [x1, y0]];
    for (let i = 0; i < 4; i++) {
      const [x, y] = pts[i];
      v[o] = m[0] * x + m[4] * y + m[12];
      v[o + 1] = m[1] * x + m[5] * y + m[13];
      v[o + 2] = m[2] * x + m[6] * y + m[14];
      v[o + 3] = uvs[i][0]; v[o + 4] = uvs[i][1];
      v[o + 5] = c[0] * mc[0]; v[o + 6] = c[1] * mc[1]; v[o + 7] = c[2] * mc[2]; v[o + 8] = c[3] * mc[3];
      o += STRIDE;
    }
    this.quadCount++;
    b.count++;
  }

  // Arbitrary quad (triangles: repeat the last point) with per-corner colours; pts = [[x, y] x4]
  quadPoints(texture, pts, colors) {
    if (!texture || this.quadCount >= MAX_QUADS) return;
    const b = this._batch(texture);
    const m = this.matrix, v = this.verts, mc = this.color;
    let o = this.quadCount * 4 * STRIDE;
    for (let i = 0; i < 4; i++) {
      const [x, y] = pts[i], c = colors[i] || colors[0];
      v[o] = m[0] * x + m[4] * y + m[12];
      v[o + 1] = m[1] * x + m[5] * y + m[13];
      v[o + 2] = m[2] * x + m[6] * y + m[14];
      v[o + 3] = 0; v[o + 4] = 0;
      v[o + 5] = c[0] * mc[0]; v[o + 6] = c[1] * mc[1]; v[o + 7] = c[2] * mc[2]; v[o + 8] = c[3] * mc[3];
      o += STRIDE;
    }
    this.quadCount++;
    b.count++;
  }

  tex(path) { return typeof path === 'string' ? this.assets.texture(path) : path; }
  img(path) { return this.assets.image(path); }

  // drawTexturedModalRect equivalent; texture coordinates are in a texW x texH space
  blit(path, x, y, u, v, w, h, texW = 256, texH = 256, dw = w, dh = h) {
    const t = this.tex(path);
    if (!t || w <= 0 || h <= 0) return;
    this.quad(t, x, y, x + dw, y + dh, u / texW, v / texH, (u + w) / texW, (v + h) / texH, WHITE);
  }

  // Draw a texture region given in texture pixels
  drawImage(path, sx, sy, sw, sh, x, y, w, h, color = WHITE) {
    const t = this.tex(path);
    if (!t) return;
    this.quad(t, x, y, x + w, y + h, sx / t.width, sy / t.height, (sx + sw) / t.width, (sy + sh) / t.height, color);
  }

  rect(x0, y0, x1, y1, color) {
    if (x0 > x1) [x0, x1] = [x1, x0];
    if (y0 > y1) [y0, y1] = [y1, y0];
    const c = argb(color >>> 0);
    this.quad(this.white, x0, y0, x1, y1, 0, 0, 1, 1, c);
  }

  gradient(x0, y0, x1, y1, top, bottom) {
    const a = argb(top >>> 0), b = argb(bottom >>> 0);
    this.quad(this.white, x0, y0, x1, y1, 0, 0, 1, 1, a, b, b, a);
  }

  text(s, x, y, color = 0xffffff, shadow = true) { return this.font.draw(s, x, y, color, shadow); }
  textCentered(s, cx, y, color = 0xffffff, shadow = true) { return this.font.drawCentered(s, cx, y, color, shadow); }
  textWidth(s) { return this.font.width(s); }

  // Queue a 3D draw (e.g. item models) in GUI space. model is relative to the current matrix.
  drawMesh(draw, model) {
    const m = mat4.multiply(mat4.create(), this.matrix, model);
    this.commands.push({ kind: 'draw', scissor: this.scissorRect, draw: { ...draw, model: m } });
    this._cur = null;
  }

  // Queue a scene node tree in GUI space (model relative to the current matrix)
  drawNode(node, model) {
    const m = mat4.multiply(mat4.create(), this.matrix, model);
    node.updateWorld(m, null);
    const list = node.collect([]);
    list.sort((a, b) => (a.d.order || 0) - (b.d.order || 0));
    const resolve = (t) => (typeof t === 'function' ? t() : this.assets.texture(t));
    for (const { d, world } of list) {
      const dr = toDraw(d, new Float32Array(world), resolve);
      if (dr) this.commands.push({ kind: 'draw', scissor: this.scissorRect, draw: dr });
    }
    this._cur = null;
  }

  // Next depth slot for stacked 3D icons, so later icons draw over earlier ones
  nextIconDepth() { this.iconDepth += 64; return this.iconDepth; }

  // ---------------------------------------------------------------- vanilla helpers

  dirtBackground(tint = 0x404040) {
    const t = this.assets.texture('gui/options_background.png', { wrap: 'repeat' });
    if (!t) { this.rect(0, 0, this.width, this.height, 0xff202020); return; }
    const k = (tint & 255) / 255;
    this.quad(t, 0, 0, this.width, this.height, 0, 0, this.width / 32, this.height / 32, [k, k, k, 1]);
  }

  worldBackground() { this.gradient(0, 0, this.width, this.height, 0xc0101010, 0xd0101010); }

  // GuiScreen.drawHoveringText
  tooltip(lines, mx, my) {
    if (!lines.length) return;
    let w = 0;
    for (const l of lines) w = Math.max(w, this.textWidth(l));
    let x = mx + 12, y = my - 12;
    let h = 8;
    if (lines.length > 1) h += 2 + (lines.length - 1) * 10;
    if (x + w > this.width) x -= 28 + w;
    if (y + h + 6 > this.height) y = this.height - h - 6;
    const bg = 0xf0100010, b1 = 0x505000ff, b2 = 0x5028007f;
    this.rect(x - 3, y - 4, x + w + 3, y - 3, bg);
    this.rect(x - 3, y + h + 3, x + w + 3, y + h + 4, bg);
    this.rect(x - 3, y - 3, x + w + 3, y + h + 3, bg);
    this.rect(x - 4, y - 3, x - 3, y + h + 3, bg);
    this.rect(x + w + 3, y - 3, x + w + 4, y + h + 3, bg);
    this.gradient(x - 3, y - 3 + 1, x - 3 + 1, y + h + 3 - 1, b1, b2);
    this.gradient(x + w + 2, y - 3 + 1, x + w + 3, y + h + 3 - 1, b1, b2);
    this.rect(x - 3, y - 3, x + w + 3, y - 3 + 1, b1);
    this.rect(x - 3, y + h + 2, x + w + 3, y + h + 3, b2);
    for (let i = 0; i < lines.length; i++) {
      this.text(lines[i], x, y, 0xffffff, true);
      y += i === 0 ? 12 : 10;
    }
  }

  // GuiButton
  button(x, y, w, h, label, hovered, enabled = true) {
    const v = !enabled ? 46 : hovered ? 86 : 66;
    x = Math.floor(x); y = Math.floor(y);
    const half = Math.floor(w / 2);
    this.blit('gui/widgets.png', x, y, 0, v, half, h);
    this.blit('gui/widgets.png', x + half, y, 200 - half, v, half, h);
    const color = !enabled ? 0xa0a0a0 : hovered ? 0xffffa0 : 0xe0e0e0;
    this.textCentered(label, x + Math.floor(w / 2), y + Math.floor((h - 8) / 2), color, true);
  }
}

const WHITE = [1, 1, 1, 1];
const IDENTITY = mat4.create();
export { WHITE };
