// World renderer (device-agnostic, see gfx/device.js).
import { FORMAT, terrainParams, colorParams } from '../gfx/device.js';
import { mat4, D2R, frustumPlanes, aabbInFrustum } from '../gfx/math.js';
import { Node, drawTree } from '../gfx/scene.js';
import {
  celestialAngle, sunBrightness, starBrightness, skyColor, baseFogColor, sunriseColors, cloudColor,
  updateLightmap, buildStarPositions,
} from './sky.js';
import { platform } from '../platform/platform.js';
import { SectionCuller, sectionKey } from './culling.js';

const P_SOLID = terrainParams(0, 1);
const P_CUTOUT = terrainParams(0.1, 1);
const P_TRANSLUCENT = terrainParams(0.004, 1);
// far (LOD) sections sample the atlas one and a half mip levels smaller
const LOD_BIAS = 1.5;
const P_SOLID_LOD = terrainParams(0, 1, undefined, LOD_BIAS);
const P_CUTOUT_LOD = terrainParams(0.1, 1, undefined, LOD_BIAS);
const P_TRANSLUCENT_LOD = terrainParams(0.004, 1, undefined, LOD_BIAS);
const P_WHITE = colorParams(1, 1, 1, 1);
const P_BREAK = colorParams(1, 1, 1, 1, 0.1);

// Builds a quad list in FORMAT.color: quads = [[x,y,z,u,v,r,g,b,a] x4, ...]
export function colorMesh(device, quads, opts = {}) {
  const data = new Float32Array(quads.length * 4 * 9);
  let o = 0;
  for (const q of quads) for (const v of q) { data.set(v, o); o += 9; }
  return device.createMesh(FORMAT.color, data, { quads: true, ...opts });
}

export class Renderer {
  constructor(device, assets) {
    this.device = device;
    this.assets = assets;
    this.renderDistance = 8;
    this.sections = new Map(); // sectionKey -> { cx, sy, cz, solid, cutout, translucent, vis }
    this.culler = new SectionCuller();
    this.columnLoaded = () => true; // set by the game
    this.opaqueAt = () => false;
    this.entityRoot = new Node();
    this.lightmapData = new Uint8Array(16 * 16 * 4);
    this.lightmap = device.createTexture({ width: 16, height: 16, data: this.lightmapData, filter: 'linear' });
    this.view = mat4.create();
    this.proj = mat4.create();
    this.viewProj = mat4.create();
    this.skyView = mat4.create();
    this.skyProj = mat4.create();
    this.camPos = [0, 0, 0];
    this.fov = 70;
    this.aspect = 1;
    this.gamma = 0.5;
    this.torchFlickerX = 0;
    this.torchFlickerDX = 0;
    this.cloudTicks = 0;
    this.lightningTicks = 0;
    this.dimension = 0;
    this.fog = { color: [0.7, 0.8, 1], start: 96, end: 128, density: 0.1, mode: 0 };
    this.env = { sky: [0, 0, 0], skyVisible: true };
    this.outlineBox = null;
    this.breakState = null;
    this.extraDraws = [];
    this.afterHand = []; // functions(device) drawn after the hand with depth cleared (F3 world axes) // functions(device) drawn in the world pass after entities, ordered by .order
    this._setupSky();
    this._setupOutline();
  }

  get atlasTexture() { return this.assets.atlasTexture; }

  resize() { this.aspect = platform().width / platform().height; }

  // ---------------------------------------------------------------- sections

  setSectionMesh(cx, sy, cz, data) {
    const key = sectionKey(cx, sy, cz);
    this.removeSection(key);
    if (!data || data.empty) return;
    const s = { cx, sy, cz, vis: data.vis || null, lod: !!data.lod };
    for (const layer of ['solid', 'cutout', 'translucent']) {
      const arr = data[layer];
      if (arr && arr.length) s[layer] = this.device.createMesh(FORMAT.terrain, arr, { quads: true });
    }
    s.model = mat4.translate(mat4.create(), mat4.create(), cx * 16, sy * 16, cz * 16);
    this.sections.set(key, s);
  }

  // key: sectionKey number or 'cx,sy,cz'
  removeSection(key) {
    if (typeof key === 'string') { const p = key.split(','); key = sectionKey(+p[0], +p[1], +p[2]); }
    const s = this.sections.get(key);
    if (!s) return;
    for (const layer of ['solid', 'cutout', 'translucent']) if (s[layer]) this.device.destroyMesh(s[layer]);
    this.sections.delete(key);
  }

  removeChunk(cx, cz) { for (let y = 0; y < 16; y++) this.removeSection(sectionKey(cx, y, cz)); }
  clearSections() { for (const k of [...this.sections.keys()]) this.removeSection(k); }

  // ---------------------------------------------------------------- sky geometry

  _setupSky() {
    const d = this.device;
    // Flat grid planes (sky above, void below), 768 wide
    const plane = (y, flip) => {
      const q = [];
      const n = 16, size = 768, step = size / n, h = size / 2;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x0 = -h + i * step, z0 = -h + j * step, x1 = x0 + step, z1 = z0 + step;
        const v = (x, z) => [x, y, z, 0, 0, 1, 1, 1, 1];
        q.push(flip ? [v(x0, z0), v(x1, z0), v(x1, z1), v(x0, z1)] : [v(x0, z0), v(x0, z1), v(x1, z1), v(x1, z0)]);
      }
      return colorMesh(d, q);
    };
    this.skyPlane = plane(0, false);
    this.voidPlane = plane(0, true);
    // Sunrise fan as triangles (centre + ring), vertex alpha fades towards the ring
    const fan = [];
    for (let j = 0; j < 16; j++) {
      const a0 = j * Math.PI * 2 / 16, a1 = (j + 1) * Math.PI * 2 / 16;
      fan.push(0, 100, 0, 0, 0, 1, 1, 1, 1);
      fan.push(Math.sin(a0) * 120, Math.cos(a0) * 120, -Math.cos(a0) * 40, 0, 0, 1, 1, 1, 0);
      fan.push(Math.sin(a1) * 120, Math.cos(a1) * 120, -Math.cos(a1) * 40, 0, 0, 1, 1, 1, 0);
    }
    this.sunriseMesh = d.createMesh(FORMAT.color, new Float32Array(fan));
    // Stars
    const stars = buildStarPositions();
    const sdata = new Float32Array(stars.length / 3 * 9);
    for (let i = 0, o = 0; i < stars.length; i += 3, o += 9) sdata.set([stars[i], stars[i + 1], stars[i + 2], 0, 0, 1, 1, 1, 1], o);
    this.starMesh = d.createMesh(FORMAT.color, sdata);
    // Sun (30 wide at 100 up) and moon (20 wide at 100 down)
    const sq = (s, y, flipU) => {
      const v = (x, z, u, vv) => [x, y, z, u, vv, 1, 1, 1, 1];
      return y > 0 ? [v(-s, -s, flipU ? 1 : 0, 0), v(s, -s, flipU ? 0 : 1, 0), v(s, s, flipU ? 0 : 1, 1), v(-s, s, flipU ? 1 : 0, 1)]
        : [v(-s, -s, 0, 0), v(-s, s, 0, 1), v(s, s, 1, 1), v(s, -s, 1, 0)];
    };
    this.sunMesh = colorMesh(d, [sq(30, 100)]);
    this.moonMesh = colorMesh(d, [sq(20, -100)], { dynamic: true });
    this.moonPhase = -1;
    // Clouds: a single quad whose UVs scroll
    this.cloudMesh = colorMesh(d, [[[0, 0, 0, 0, 0, 1, 1, 1, 1], [0, 0, 1, 0, 1, 1, 1, 1, 1], [1, 0, 1, 1, 1, 1, 1, 1, 1], [1, 0, 0, 1, 0, 1, 1, 1, 1]]], { dynamic: true });
    // Break overlay unit cube
    const cube = [];
    // Vertex colour = vanilla's face shading (up 1, down 0.5, north/south 0.8, east/west 0.6)
    let shade = 1;
    const c = (x, y, z, u, v) => [x, y, z, u, v, shade, shade, shade, 1];
    shade = 1; cube.push([c(0, 1, 0, 0, 0), c(0, 1, 1, 0, 1), c(1, 1, 1, 1, 1), c(1, 1, 0, 1, 0)]);
    shade = 0.5; cube.push([c(0, 0, 1, 0, 0), c(0, 0, 0, 0, 1), c(1, 0, 0, 1, 1), c(1, 0, 1, 1, 0)]);
    shade = 0.8; cube.push([c(1, 1, 0, 0, 0), c(1, 0, 0, 0, 1), c(0, 0, 0, 1, 1), c(0, 1, 0, 1, 0)]);
    cube.push([c(0, 1, 1, 0, 0), c(0, 0, 1, 0, 1), c(1, 0, 1, 1, 1), c(1, 1, 1, 1, 0)]);
    shade = 0.6; cube.push([c(0, 1, 0, 0, 0), c(0, 0, 0, 0, 1), c(0, 0, 1, 1, 1), c(0, 1, 1, 1, 0)]);
    cube.push([c(1, 1, 1, 0, 0), c(1, 0, 1, 0, 1), c(1, 0, 0, 1, 1), c(1, 1, 0, 1, 0)]);
    this.cubeMesh = colorMesh(d, cube);
  }

  _setupOutline() {
    this.outlineMesh = this.device.createMesh(FORMAT.color, new Float32Array(24 * 9), { dynamic: true });
  }

  setOutline(box) {
    const key = box ? box.join(',') : null;
    if (key === this._outlineKey) return;
    this._outlineKey = key;
    this.outlineBox = box;
    if (!box) return;
    const e = 0.002;
    const [x0, y0, z0, x1, y1, z1] = [box[0] - e, box[1] - e, box[2] - e, box[3] + e, box[4] + e, box[5] + e];
    const lines = [
      [x0, y0, z0, x1, y0, z0], [x1, y0, z0, x1, y0, z1], [x1, y0, z1, x0, y0, z1], [x0, y0, z1, x0, y0, z0],
      [x0, y1, z0, x1, y1, z0], [x1, y1, z0, x1, y1, z1], [x1, y1, z1, x0, y1, z1], [x0, y1, z1, x0, y1, z0],
      [x0, y0, z0, x0, y1, z0], [x1, y0, z0, x1, y1, z0], [x1, y0, z1, x1, y1, z1], [x0, y0, z1, x0, y1, z1],
    ];
    const data = new Float32Array(24 * 9);
    let o = 0;
    for (const l of lines) {
      data.set([l[0], l[1], l[2], 0, 0, 0, 0, 0, 0.4], o); o += 9;
      data.set([l[3], l[4], l[5], 0, 0, 0, 0, 0, 0.4], o); o += 9;
    }
    this.device.updateMesh(this.outlineMesh, data);
  }

  setBreakTextures(paths) { this.breakTextures = paths; }

  // light: { sky, block } levels at the block; the overlay is lit like the block (vanilla draws it through the
  // block's own model with the lightmap on), otherwise the 2x multiply blend would brighten dark blocks
  setBreakProgress(pos, stage, box, light = { sky: 15, block: 15 }) {
    if (!pos || stage < 0) { this.breakState = null; return; }
    const b = box || [0, 0, 0, 1, 1, 1];
    const m = mat4.create();
    mat4.translate(m, m, pos.x + b[0] - 0.001, pos.y + b[1] - 0.001, pos.z + b[2] - 0.001);
    mat4.scale(m, m, b[3] - b[0] + 0.002, b[4] - b[1] + 0.002, b[5] - b[2] + 0.002);
    this.breakState = { tex: `blocks/destroy_stage_${Math.min(9, stage)}.png`, model: m, light };
  }

  // ---------------------------------------------------------------- per tick / frame

  tick() {
    // EntityRenderer.updateTorchFlicker
    this.torchFlickerDX += (Math.random() - Math.random()) * Math.random() * Math.random();
    this.torchFlickerDX *= 0.9;
    this.torchFlickerX += this.torchFlickerDX - this.torchFlickerX;
    this.cloudTicks++;
    if (this.lightningTicks > 0) this.lightningTicks--;
  }

  updateEnvironment(state) {
    const { worldTime, partial, rain, thunder, temperature, dimension } = state;
    this.dimension = dimension;
    const angle = celestialAngle(worldTime, partial);
    const sun = sunBrightness(angle, rain, thunder);
    updateLightmap(this.lightmapData, {
      sun: dimension === 0 ? sun : 1, dimension, torchFlicker: this.torchFlickerX, gamma: this.gamma,
      nightVision: state.nightVision || 0, lightning: this.lightningTicks,
    });
    this.device.updateTexture(this.lightmap, this.lightmapData);

    const renderDistBlocks = this.renderDistance * 16;
    let fogR, fogG, fogB;
    let sky = [0, 0, 0];
    if (dimension === 0) {
      sky = skyColor(angle, temperature, rain, thunder);
      [fogR, fogG, fogB] = baseFogColor(angle);
      if (this.renderDistance >= 4) {
        const sunDir = Math.sin(angle * Math.PI * 2) > 0 ? -1 : 1;
        let f5 = state.lookDir[0] * sunDir;
        if (f5 < 0) f5 = 0;
        if (f5 > 0) {
          const sr = sunriseColors(angle);
          if (sr) { f5 *= sr[3]; fogR = fogR * (1 - f5) + sr[0] * f5; fogG = fogG * (1 - f5) + sr[1] * f5; fogB = fogB * (1 - f5) + sr[2] * f5; }
        }
      }
      let f = 0.25 + 0.75 * this.renderDistance / 32;
      f = 1 - Math.pow(f, 0.25);
      fogR += (sky[0] - fogR) * f; fogG += (sky[1] - fogG) * f; fogB += (sky[2] - fogB) * f;
      if (rain > 0) { const f4 = 1 - rain * 0.5, f10 = 1 - rain * 0.4; fogR *= f4; fogG *= f4; fogB *= f10; }
      if (thunder > 0) { const f11 = 1 - thunder * 0.5; fogR *= f11; fogG *= f11; fogB *= f11; }
    } else if (dimension === -1) {
      fogR = 0.2; fogG = 0.03; fogB = 0.03;
    } else {
      fogR = 0.627 * 0.15; fogG = 0.5 * 0.15; fogB = 0.627 * 0.15;
    }
    let fogMode = 0, fogStart = renderDistBlocks * 0.75, fogEnd = renderDistBlocks, fogDensity = 0.1;
    if (state.underwater) { fogR = 0.02; fogG = 0.02; fogB = 0.2; fogMode = 1; fogDensity = 0.1 - (state.respiration || 0) * 0.03; }
    else if (state.inLava) { fogR = 0.6; fogG = 0.1; fogB = 0; fogMode = 1; fogDensity = 2.0; }
    else if (dimension === -1) { fogStart = 0; fogEnd = renderDistBlocks * 0.5; }
    if (state.blindness) { fogMode = 0; fogStart = 0; fogEnd = 5; fogR *= 0.1; fogG *= 0.1; fogB *= 0.1; }
    // WorldProvider.getVoidFogYFactor: 1.0 on superflat worlds, 1/32 otherwise
    const voidFactor = state.horizon === 0 ? 1 : 0.03125;
    if (dimension === 0 && state.camPos[1] * voidFactor < 1) {
      let d1 = state.camPos[1] * voidFactor;
      if (d1 < 1) { if (d1 < 0) d1 = 0; d1 *= d1; fogR *= d1; fogG *= d1; fogB *= d1; }
    }
    this.fog = { color: [fogR, fogG, fogB], start: fogStart, end: fogEnd, density: fogDensity, mode: fogMode };

    const env = this.env;
    env.skyVisible = dimension === 0 && !state.underwater && !state.inLava;
    env.sky = sky;
    env.angle = angle;
    env.rain = rain;
    env.horizon = state.horizon !== undefined ? state.horizon : 63;
    env.camPos = state.camPos;
    env.sunrise = sunriseColors(angle);
    env.starBrightness = starBrightness(angle) * (1 - rain);
    const phase = Number((BigInt(Math.floor(worldTime)) / 24000n) % 8n);
    if (phase !== this.moonPhase) this._setMoonPhase(phase);
    env.cloudColor = cloudColor(angle, rain, thunder);
    // GameSettings.shouldRenderClouds: 0 off, 1 fast, 2 fancy (only with render distance >= 4)
    const cloudMode = state.clouds === true ? 2 : state.clouds === false ? 0 : (state.clouds | 0);
    env.cloudMode = this.renderDistance >= 4 ? cloudMode : 0;
    env.cloudsVisible = dimension === 0 && env.cloudMode > 0;
    if (env.cloudMode === 2) this._updateFancyClouds(state.camPos, partial);
    // Fast clouds follow the camera; UVs scroll with time
    const size = renderDistBlocks * 4;
    const cam = state.camPos;
    const scrollX = (this.cloudTicks + partial) * 0.03;
    const u = (cam[0] + scrollX) / 12 / 256, v = cam[2] / 12 / 256, rep = size / 12 / 256;
    const h = size / 2;
    const cy = 128.33;
    const cv = (x, z, uu, vv) => [cam[0] + x, cy, cam[2] + z, uu, vv, 1, 1, 1, 1];
    const cd = new Float32Array(36);
    [cv(-h, -h, u - rep / 2, v - rep / 2), cv(-h, h, u - rep / 2, v + rep / 2), cv(h, h, u + rep / 2, v + rep / 2), cv(h, -h, u + rep / 2, v - rep / 2)].forEach((p, i) => cd.set(p, i * 9));
    this.device.updateMesh(this.cloudMesh, cd, { quads: true });
  }

  // RenderGlobal.renderCloudsFancy: 16x16 tiles of 8x8 cloud cells (12 blocks wide, 4 high) around the camera.
  // Tops/bottoms are whole textured tiles, sides are one strip per cell column; the cloud texture's alpha
  // cuts out the shapes. The mesh is rebuilt only when the camera crosses a cell or the cloud layer.
  _updateFancyClouds(cam, partial) {
    const d0 = this.cloudTicks + partial;
    const d1 = (cam[0] + d0 * 0.03) / 12, d2 = cam[2] / 12 + 0.33;
    const cellX = Math.floor(d1), cellZ = Math.floor(d2);
    const f3 = 128.33 - cam[1]; // cloud layer relative to the eye
    const band = f3 > 5 ? 1 : f3 <= -5 ? -1 : 0;
    const key = cellX + ',' + cellZ + ',' + band;
    let fc = this.fancyClouds;
    if (!fc || fc.key !== key) {
      const f4 = 1 / 256, f17 = (((cellX % 256) + 256) % 256) * f4, f18 = (((cellZ % 256) + 256) % 256) * f4;
      const quads = [];
      const q = (pts, c) => quads.push(pts.map((p) => [p[0] * 12, p[1], p[2] * 12, p[3], p[4], c, c, c, 1]));
      const E = 9.765625e-4;
      for (let i1 = -7; i1 <= 8; i1++) for (let j1 = -7; j1 <= 8; j1++) {
        const fx = i1 * 8, fz = j1 * 8;
        const U = (x) => (fx + x) * f4 + f17, V = (z) => (fz + z) * f4 + f18;
        if (band >= 0) q([[fx, 0, fz + 8, U(0), V(8)], [fx + 8, 0, fz + 8, U(8), V(8)], [fx + 8, 0, fz, U(8), V(0)], [fx, 0, fz, U(0), V(0)]], 0.7);
        if (band <= 0) q([[fx, 4 - E, fz + 8, U(0), V(8)], [fx + 8, 4 - E, fz + 8, U(8), V(8)], [fx + 8, 4 - E, fz, U(8), V(0)], [fx, 4 - E, fz, U(0), V(0)]], 1);
        for (let k = 0; k < 8; k++) {
          if (i1 > -1) q([[fx + k, 0, fz + 8, U(k + 0.5), V(8)], [fx + k, 4, fz + 8, U(k + 0.5), V(8)], [fx + k, 4, fz, U(k + 0.5), V(0)], [fx + k, 0, fz, U(k + 0.5), V(0)]], 0.9);
          if (i1 <= 1) q([[fx + k + 1 - E, 0, fz + 8, U(k + 0.5), V(8)], [fx + k + 1 - E, 4, fz + 8, U(k + 0.5), V(8)], [fx + k + 1 - E, 4, fz, U(k + 0.5), V(0)], [fx + k + 1 - E, 0, fz, U(k + 0.5), V(0)]], 0.9);
          if (j1 > -1) q([[fx, 4, fz + k, U(0), V(k + 0.5)], [fx + 8, 4, fz + k, U(8), V(k + 0.5)], [fx + 8, 0, fz + k, U(8), V(k + 0.5)], [fx, 0, fz + k, U(0), V(k + 0.5)]], 0.8);
          if (j1 <= 1) q([[fx, 4, fz + k + 1 - E, U(0), V(k + 0.5)], [fx + 8, 4, fz + k + 1 - E, U(8), V(k + 0.5)], [fx + 8, 0, fz + k + 1 - E, U(8), V(k + 0.5)], [fx, 0, fz + k + 1 - E, U(0), V(k + 0.5)]], 0.8);
        }
      }
      if (fc) this.device.destroyMesh(fc.mesh);
      fc = this.fancyClouds = { key, mesh: colorMesh(this.device, quads), model: mat4.create() };
    }
    // world position: cell grid anchored at cellX/cellZ, sliding with the cloud drift
    mat4.identity(fc.model);
    mat4.translate(fc.model, fc.model, cellX * 12 - d0 * 0.03, 128.33, (cellZ - 0.33) * 12);
  }

  _setMoonPhase(phase) {
    this.moonPhase = phase;
    const i = phase % 4, j = Math.floor(phase / 4) % 2;
    const u0 = i / 4, u1 = (i + 1) / 4, v0 = j / 2, v1 = (j + 1) / 2;
    const s = 20, y = -100;
    const v = (x, z, uu, vv) => [x, y, z, uu, vv, 1, 1, 1, 1];
    const data = new Float32Array(36);
    [v(-s, -s, u1, v1), v(-s, s, u1, v0), v(s, s, u0, v0), v(s, -s, u0, v1)].forEach((p, k) => data.set(p, k * 9));
    this.device.updateMesh(this.moonMesh, data, { quads: true });
  }

  // pre: optional view-space transform applied before orienting the camera (vanilla's hurt shake / view
  // bobbing, which are GL ops issued before orientCamera)
  setCamera(x, y, z, yawDeg, pitchDeg, rollDeg, fov, pre = null) {
    this.camPos = [x, y, z];
    this.fov = fov;
    this.aspect = platform().width / platform().height;
    // view = Rz(-roll) * Rx(pitch) * Ry(yaw - 180) * T(-pos)
    const r = pre ? mat4.copy(mat4.create(), pre) : mat4.create();
    if (rollDeg) mat4.rotateZ(r, r, -rollDeg * D2R);
    mat4.rotateX(r, r, pitchDeg * D2R);
    mat4.rotateY(r, r, (yawDeg - 180) * D2R);
    this.skyView.set(r);
    this.camRot = mat4.invert(this.camRot || mat4.create(), r);
    mat4.translate(this.view, r, -x, -y, -z);
    const far = Math.max(256, this.renderDistance * 16 * 2);
    mat4.perspective(this.proj, fov * D2R, this.aspect, 0.05, far);
    mat4.perspective(this.skyProj, fov * D2R, this.aspect, 0.05, 1000);
    mat4.multiply(this.viewProj, this.proj, this.view);
    this.frustum = frustumPlanes(this.viewProj);
  }

  // ---------------------------------------------------------------- drawing

  _globals(view, proj) {
    const f = this.fog;
    this.device.setGlobals({ view, proj, fogColor: f.color, fogStart: f.start, fogEnd: f.end, fogDensity: f.density, fogMode: f.mode, lightmap: this.lightmap });
  }

  _drawSky() {
    const d = this.device;
    const env = this.env;
    if (!env.skyVisible) return;
    this._globals(this.skyView, this.skyProj);
    const sky = env.sky;
    const noDepth = { blend: 'none', depthTest: false, depthWrite: false };
    const m = mat4.create();
    mat4.translate(m, m, 0, 16, 0);
    d.draw({ mesh: this.skyPlane, pipeline: 'color', params: colorParams(sky[0], sky[1], sky[2], 1, 0, 1), model: m, state: noDepth });
    const vm = mat4.translate(mat4.create(), mat4.create(), 0, env.horizon - env.camPos[1], 0);
    d.draw({ mesh: this.voidPlane, pipeline: 'color', params: colorParams(sky[0] * 0.2 + 0.04, sky[1] * 0.2 + 0.04, sky[2] * 0.6 + 0.1, 1, 0, 1), model: vm, state: noDepth });
    if (env.sunrise) {
      const sr = env.sunrise;
      // vanilla: rotate X 90, rotate Z (sin(angle) < 0 ? 180 : 0), rotate Z 90
      const fm = mat4.create();
      mat4.rotateX(fm, fm, Math.PI / 2);
      mat4.rotateZ(fm, fm, Math.sin(env.angle * Math.PI * 2) < 0 ? Math.PI : 0);
      mat4.rotateZ(fm, fm, Math.PI / 2);
      d.draw({ mesh: this.sunriseMesh, pipeline: 'color', params: colorParams(sr[0], sr[1], sr[2], sr[3]), model: fm, state: { blend: 'alpha', depthTest: false, depthWrite: false } });
    }
    const cm = mat4.create();
    mat4.rotateZ(cm, cm, env.angle * Math.PI * 2);
    const alpha = 1 - env.rain;
    const add = { blend: 'add', depthTest: false, depthWrite: false };
    if (env.starBrightness > 0) d.draw({ mesh: this.starMesh, pipeline: 'color', params: colorParams(1, 1, 1, env.starBrightness), model: cm, state: { blend: 'alpha', depthTest: false, depthWrite: false } });
    const sunT = this.assets.texture('environment/sun.png');
    const moonT = this.assets.texture('environment/moon_phases.png');
    if (sunT) d.draw({ mesh: this.sunMesh, pipeline: 'color', textures: [sunT], params: colorParams(alpha, alpha, alpha, alpha), model: cm, state: add });
    if (moonT) d.draw({ mesh: this.moonMesh, pipeline: 'color', textures: [moonT], params: colorParams(alpha, alpha, alpha, alpha), model: cm, state: add });
  }

  // Frustum + occlusion culling (graph walk from the camera section). Call after setCamera.
  cull() {
    const c = this.camPos;
    const f = this.fog;
    const fogEnd = f.mode === 0 ? f.end : f.mode === 1 ? 4.6 / Math.max(0.001, f.density) : Infinity; // exp fog: 99% at 4.6/density
    this.visibleList = this.culler.update(this.sections, this.frustum, c, this.renderDistance, this.columnLoaded, this.opaqueAt(c[0], c[1], c[2]), this.culler.enabled ? fogEnd : Infinity);
    return this.visibleList;
  }

  // Can anything at this point be seen? (frustum + occlusion, for entities and block entities)
  boxVisible(x0, y0, z0, x1, y1, z1) {
    if (!aabbInFrustum(this.frustum, x0, y0, z0, x1, y1, z1)) return false;
    const c = this.culler;
    return c.isVisible(x0, y0, z0) || c.isVisible(x1, y1, z1) || c.isVisible((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  }

  // Draw the world. hand: { draw(device) } optional, run after clearing depth with its own camera
  render(hand) {
    const d = this.device;
    d.beginFrame(this.fog.color);
    this._drawSky();
    d.clearDepth();
    this._globals(this.view, this.proj);
    const atlas = [this.atlasTexture];
    // Visible sections, sorted near to far
    const cx = this.camPos[0], cy = this.camPos[1], cz = this.camPos[2];
    const vis = this.visibleList || this.cull();
    this.visibleList = null;
    for (const s of vis) {
      const dx = s.cx * 16 + 8 - cx, dy = s.sy * 16 + 8 - cy, dz = s.cz * 16 + 8 - cz;
      s.dist = dx * dx + dy * dy + dz * dz;
    }
    vis.sort((a, b) => a.dist - b.dist);
    this.visibleSections = vis.length;
    const solidState = { blend: 'none', cull: true };
    for (const s of vis) if (s.solid) d.draw({ mesh: s.solid, pipeline: 'terrain', textures: atlas, params: s.lod ? P_SOLID_LOD : P_SOLID, model: s.model, state: solidState });
    const cutState = { blend: 'none', cull: true };
    for (const s of vis) if (s.cutout) d.draw({ mesh: s.cutout, pipeline: 'terrain', textures: atlas, params: s.lod ? P_CUTOUT_LOD : P_CUTOUT, model: s.model, state: cutState });
    // Entities + tile entities
    if (this.drawEntities) this.drawEntities(d, this.camRot);
    else drawTree(d, this.entityRoot, { camRot: this.camRot });
    // Selection outline + break progress
    if (this.outlineBox) d.draw({ mesh: this.outlineMesh, pipeline: 'color', params: P_WHITE, primitive: 'lines', state: { blend: 'alpha', depthWrite: false } });
    if (this.breakState) {
      const t = this.assets.texture(this.breakState.tex);
      if (t) {
        // RenderGlobal.preRenderDamagedBlocks: blendFunc(DST_COLOR, SRC_COLOR), alpha test 0.1
        const { sky, block } = this.breakState.light;
        const i = (sky * 16 + block) * 4, L = this.lightmapData;
        colorParams(L[i] / 255, L[i + 1] / 255, L[i + 2] / 255, 1, 0.1, 0, P_BREAK);
        d.draw({ mesh: this.cubeMesh, pipeline: 'color', textures: [t], params: P_BREAK, model: this.breakState.model, state: { blend: 'multiply', depthWrite: false, polygonOffset: true } });
      }
    }
    const extras = [...this.extraDraws].sort((a, b) => (a.order || 0) - (b.order || 0));
    for (const e of extras) if ((e.order || 0) < 10) e(d);
    // Translucent terrain, far to near
    const transState = { blend: 'alpha', cull: true, depthWrite: true };
    for (let i = vis.length - 1; i >= 0; i--) {
      const s = vis[i];
      if (s.translucent) d.draw({ mesh: s.translucent, pipeline: 'terrain', textures: atlas, params: s.lod ? P_TRANSLUCENT_LOD : P_TRANSLUCENT, model: s.model, state: transState });
    }
    // Clouds
    if (this.env.cloudsVisible) {
      const ct = this.assets.texture('environment/clouds.png', { wrap: 'repeat' });
      const cc = this.env.cloudColor;
      if (ct && this.env.cloudMode === 2 && this.fancyClouds) {
        // two passes like vanilla: depth only, then colour where the clouds are frontmost
        const fc = this.fancyClouds, p = colorParams(cc[0], cc[1], cc[2], 0.8, 0.1, 1);
        d.draw({ mesh: fc.mesh, pipeline: 'color', textures: [ct], params: p, model: fc.model, state: { blend: 'none', colorWrite: false, cull: false } });
        d.draw({ mesh: fc.mesh, pipeline: 'color', textures: [ct], params: p, model: fc.model, state: { blend: 'alpha', depthWrite: false, cull: false } });
      } else if (ct) d.draw({ mesh: this.cloudMesh, pipeline: 'color', textures: [ct], params: colorParams(cc[0], cc[1], cc[2], 0.8, 0.004, 1), state: { blend: 'alpha', depthWrite: false } });
    }
    for (const e of extras) if ((e.order || 0) >= 10) e(d);
    // EntityRenderer.renderWorldPass: clear depth, renderHand, then renderWorldDirections
    if (hand || this.afterHand.some((f) => f.active && f.active())) {
      d.clearDepth();
      if (hand) hand.draw(d);
      for (const f of this.afterHand) if (!f.active || f.active()) f(d);
    }
  }

  // Title screen panorama (GuiMainMenu.drawPanorama): cube of 6 images, slowly rotating
  renderPanorama(timeMs) {
    const d = this.device;
    if (!this.panoMesh) {
      const faces = [];
      // face i: 0 front (-z), 1 right (+x), 2 back (+z), 3 left (-x), 4 top, 5 bottom
      const corners = [
        [[-1, 1, -1], [-1, -1, -1], [1, -1, -1], [1, 1, -1]],
        [[1, 1, -1], [1, -1, -1], [1, -1, 1], [1, 1, 1]],
        [[1, 1, 1], [1, -1, 1], [-1, -1, 1], [-1, 1, 1]],
        [[-1, 1, 1], [-1, -1, 1], [-1, -1, -1], [-1, 1, -1]],
        [[-1, 1, 1], [-1, 1, -1], [1, 1, -1], [1, 1, 1]],
        [[-1, -1, -1], [-1, -1, 1], [1, -1, 1], [1, -1, -1]],
      ];
      const uv = [[0, 0], [0, 1], [1, 1], [1, 0]];
      this.panoMeshes = corners.map((c) => colorMesh(d, [c.map((p, k) => [p[0], p[1], p[2], uv[k][0], uv[k][1], 1, 1, 1, 1])]));
      this.panoMesh = true;
    }
    const t = timeMs / 50;
    this.aspect = platform().width / platform().height;
    // GuiMainMenu.renderSkybox: the cube is drawn 64 times with tiny jitter into a 256x256 texture,
    // blurred by 6 passes of rotateAndBlurSkybox, then stretched over the screen (which blurs it more)
    if (!this.panoRT && d.createRenderTarget) this.panoRT = [d.createRenderTarget(256, 256), d.createRenderTarget(256, 256)];
    d.beginFrame([0, 0, 0]);
    if (!this.panoRT) return;
    const [A, B] = this.panoRT;
    d.setRenderTarget(A, [0, 0, 0, 1]);
    const proj = mat4.perspective(mat4.create(), 120 * D2R, 1, 0.05, 10);
    const view = mat4.create();
    const noDepth = { blend: 'alpha', depthTest: false, depthWrite: false };
    const texs = [];
    for (let i = 0; i < 6; i++) texs.push(this.assets.texture('gui/title/background/panorama_' + i + '.png'));
    for (let j = 0; j < 64; j++) {
      mat4.identity(view);
      mat4.translate(view, view, ((j % 8) / 8 - 0.5) / 64, (Math.floor(j / 8) / 8 - 0.5) / 64, 0);
      mat4.rotateX(view, view, (Math.sin(t / 400) * 25 + 20) * D2R);
      mat4.rotateY(view, view, t * 0.1 * D2R);
      d.setGlobals({ view, proj, fogMode: 2 });
      const p = colorParams(1, 1, 1, Math.floor(255 / (j + 1)) / 255);
      for (let i = 0; i < 6; i++) if (texs[i]) d.draw({ mesh: this.panoMeshes[i], pipeline: 'color', textures: [texs[i]], params: p, state: noDepth });
    }
    // Fullscreen quads in clip space; rtFlip: render targets are stored bottom-up (WebGL)
    const flip = !!d.rtOriginBottom;
    const vOf = (ty) => (flip ? 1 - ty : ty); // ty: 0 = top of the image
    const quad = (u0, t0, u1, t1) => [[-1, 1, 0, u0, vOf(t0), 1, 1, 1, 1], [-1, -1, 0, u0, vOf(t1), 1, 1, 1, 1], [1, -1, 0, u1, vOf(t1), 1, 1, 1, 1], [1, 1, 0, u1, vOf(t0), 1, 1, 1, 1]];
    if (!this.panoBlur || this.panoBlurFlip !== flip) {
      this.panoBlurFlip = flip;
      this.panoBlur = [];
      for (let axis = 0; axis < 2; axis++) {
        for (let j = 0; j < 3; j++) {
          const o = (j - 1) / 256;
          this.panoBlur.push(colorMesh(d, [axis === 0 ? quad(o, 0, 1 + o, 1) : quad(0, o, 1, 1 + o)]));
        }
      }
      this.panoScreen = null;
    }
    const ident = mat4.create();
    d.setGlobals({ view: ident, proj: ident, fogMode: 2 });
    let src = A, dst = B;
    for (let pass = 0; pass < 6; pass++) {
      d.setRenderTarget(dst, [0, 0, 0, 1]);
      for (let j = 0; j < 3; j++) d.draw({ mesh: this.panoBlur[(pass & 1) * 3 + j], pipeline: 'color', textures: [src], params: colorParams(1, 1, 1, 1 / (j + 1)), state: noDepth });
      [src, dst] = [dst, src];
    }
    d.setRenderTarget(null);
    const W = platform().width, H = platform().height;
    const f = W > H ? 120 / W : 120 / H;
    const fy = H * f / 256, fx = W * f / 256;
    const key = fx.toFixed(5) + ',' + fy.toFixed(5);
    if (this.panoScreenKey !== key || !this.panoScreen) {
      this.panoScreenKey = key;
      if (this.panoScreen) d.destroyMesh(this.panoScreen);
      this.panoScreen = colorMesh(d, [quad(0.5 - fx, 0.5 - fy, 0.5 + fx, 0.5 + fy)]);
    }
    d.draw({ mesh: this.panoScreen, pipeline: 'color', textures: [src], params: P_WHITE, state: { blend: 'none', depthTest: false, depthWrite: false } });
  }

  // Plain clear (menus without panorama)
  renderBlank() { this.device.beginFrame([0, 0, 0]); }
}
