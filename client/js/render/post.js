// ShaderGroup: vanilla's post-processing chains (shaders/post/*.json) run on the device's "post" pipeline. The world is
// drawn into the chain's "minecraft:main" target; each pass reads one target (and optional aux targets) and writes
// another; at the end main goes to the screen and the GUI is drawn over it. Used for the view of a spectated creeper,
// spider or enderman (EntityRenderer.loadEntityShader).
import { FORMAT } from '../gfx/device.js';

// shaders/program/*.json: the post pipeline's program number and the uniforms' defaults
const PROGRAMS = {
  blit: { mode: 0, uniforms: { ColorModulate: [1, 1, 1, 1] } },
  invert: { mode: 1, uniforms: { InverseAmount: [0] } },
  color_convolve: { mode: 2, uniforms: { Saturation: [1.8], RedMatrix: [1, 0, 0], GreenMatrix: [0, 1, 0], BlueMatrix: [0, 0, 1] } },
  bits: { mode: 3, uniforms: { Resolution: [4], Saturation: [1.5], MosaicSize: [8] } },
  blur: { mode: 4, uniforms: { BlurDir: [1, 1], Radius: [5] } },
  spider: { mode: 5, uniforms: { InRotation: [0], InScale: [1, 1], InOffset: [0, 0], Scissor: [0, 0, 1, 1], Vignette: [0, 0, 1, 1] } },
};

// Where each uniform goes in the pipeline's params (see device.js)
const SLOTS = {
  ColorModulate: 4, InverseAmount: 1, Saturation: 1, RedMatrix: 4, GreenMatrix: 8, BlueMatrix: 12,
  Resolution: 1, MosaicSize: 3, BlurDir: 4, Radius: 6, InRotation: 1, InScale: 4, InOffset: 6, Scissor: 8, Vignette: 12,
};
const SLOTS_BY_PROGRAM = { bits: { Saturation: 2 } };

// shaders/post/creeper.json, spider.json and invert.json (used when the assets carry no shaders/post files)
const u = (name, values) => ({ name, values });
export const BUILTIN_CHAINS = {
  creeper: { targets: ['swap'], passes: [
    { name: 'color_convolve', intarget: 'minecraft:main', outtarget: 'swap', uniforms: [u('RedMatrix', [0, 0, 0]), u('GreenMatrix', [0.3, 0.59, 0.11]), u('BlueMatrix', [0, 0, 0])] },
    { name: 'bits', intarget: 'swap', outtarget: 'minecraft:main', uniforms: [u('Resolution', [16]), u('MosaicSize', [4])] },
  ] },
  spider: { targets: ['largeBlur', 'smallBlur', 'temp', 'swap'], passes: [
    { name: 'blur', intarget: 'minecraft:main', outtarget: 'temp', uniforms: [u('BlurDir', [1, 0]), u('Radius', [15])] },
    { name: 'blur', intarget: 'temp', outtarget: 'largeBlur', uniforms: [u('BlurDir', [0, 1]), u('Radius', [15])] },
    { name: 'blur', intarget: 'minecraft:main', outtarget: 'temp', uniforms: [u('BlurDir', [1, 0]), u('Radius', [7])] },
    { name: 'blur', intarget: 'temp', outtarget: 'smallBlur', uniforms: [u('BlurDir', [0, 1]), u('Radius', [7])] },
    { name: 'spider', intarget: 'minecraft:main', outtarget: 'temp', auxtargets: [{ name: 'BlurSampler', id: 'largeBlur' }],
      uniforms: [u('InScale', [1.25, 2]), u('InOffset', [-0.125, -0.1]), u('Scissor', [0, 0, 1, 1]), u('Vignette', [0.1, 0.1, 0.9, 0.9])] },
    { name: 'spider', intarget: 'smallBlur', outtarget: 'swap', auxtargets: [{ name: 'BlurSampler', id: 'temp' }],
      uniforms: [u('InScale', [2.35, 4.2]), u('InOffset', [-1.1, -1.5]), u('InRotation', [-45]), u('Scissor', [0.21, 0, 0.79, 1]), u('Vignette', [0.31, 0.1, 0.69, 0.9])] },
    { name: 'spider', intarget: 'smallBlur', outtarget: 'temp', auxtargets: [{ name: 'BlurSampler', id: 'swap' }],
      uniforms: [u('InScale', [2.35, 4.2]), u('InOffset', [0.45, -4.45]), u('InRotation', [45]), u('Scissor', [0.21, 0, 0.79, 1]), u('Vignette', [0.31, 0.1, 0.69, 0.9])] },
    { name: 'spider', intarget: 'smallBlur', outtarget: 'swap', auxtargets: [{ name: 'BlurSampler', id: 'temp' }],
      uniforms: [u('InScale', [2.35, 2.35]), u('InOffset', [-0.385, -1.29]), u('InRotation', [0]), u('Vignette', [0.31, 0.1, 0.69, 0.9])] },
    { name: 'spider', intarget: 'smallBlur', outtarget: 'temp', auxtargets: [{ name: 'BlurSampler', id: 'swap' }],
      uniforms: [u('InScale', [2.35, 2.35]), u('InOffset', [-0.965, -1.29]), u('Vignette', [0.31, 0.1, 0.69, 0.9])] },
    { name: 'blit', intarget: 'temp', outtarget: 'minecraft:main', uniforms: [u('ColorModulate', [1, 0.8, 0.8, 1])] },
  ] },
  invert: { targets: ['swap'], passes: [
    { name: 'invert', intarget: 'minecraft:main', outtarget: 'swap', uniforms: [u('InverseAmount', [0.8])] },
    { name: 'blit', intarget: 'swap', outtarget: 'minecraft:main' },
  ] },
};

// EntityRenderer.loadEntityShader: by spawn type (creeper, spider, cave spider, enderman)
const ENTITY_SHADERS = { 50: 'creeper', 52: 'spider', 59: 'spider', 58: 'invert' };
export function entityShaderName(e) { return e && e.kind !== 'player' ? ENTITY_SHADERS[e.type] || null : null; }

// The pass's params: program number, then each uniform (the pass's value, else the program's default)
function passParams(pass) {
  const prog = PROGRAMS[pass.name];
  if (!prog) return null;
  const p = new Float32Array(16);
  p[0] = prog.mode;
  const given = new Map((pass.uniforms || []).map((x) => [x.name, x.values]));
  for (const [name, def] of Object.entries(prog.uniforms)) {
    const v = given.get(name) || def;
    const at = (SLOTS_BY_PROGRAM[pass.name] && SLOTS_BY_PROGRAM[pass.name][name]) ?? SLOTS[name];
    for (let i = 0; i < def.length; i++) p[at + i] = v[i] ?? def[i];
  }
  return p;
}

const BLIT = passParams({ name: 'blit' });

export class PostChain {
  constructor(device, def) {
    this.device = device;
    this.def = def;
    this.passes = def.passes.map((ps) => ({ ...ps, params: passParams(ps) }));
    this.ok = this.passes.every((ps) => ps.params);
    this.targets = new Map();
    this.width = 0; this.height = 0;
    // One full-screen quad, clip space, uv (0, 0) at the top left
    const v = new Float32Array([-1, 1, 0, 0, 0, 1, 1, 1, 1, -1, -1, 0, 0, 1, 1, 1, 1, 1, 1, -1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1]);
    this.quad = device.createMesh(FORMAT.color, v, { quads: true });
  }

  // ShaderGroup.createBindFramebuffers: every target at the screen size (or its own size)
  _resize() {
    const d = this.device, W = d.width, H = d.height;
    if (W === this.width && H === this.height && this.main) return;
    this.width = W; this.height = H;
    for (const t of this.targets.values()) d.destroyTexture(t);
    this.targets.clear();
    if (this.main) d.destroyTexture(this.main);
    this.main = d.createRenderTarget(W, H);
    for (const t of this.def.targets || []) {
      const name = typeof t === 'string' ? t : t.name;
      const w = typeof t === 'object' && t.width ? t.width : W, h = typeof t === 'object' && t.height ? t.height : H;
      this.targets.set(name, d.createRenderTarget(w, h));
    }
  }

  // Before the world is drawn: the target it goes into
  begin(clearColor) {
    this._resize();
    this.device.setRenderTarget(this.main, [clearColor[0], clearColor[1], clearColor[2], 1]);
  }

  _target(name) { return name === 'minecraft:main' ? this.main : this.targets.get(name); }

  // ShaderGroup.render, then main onto the screen (lightmap: the world's, put back for whatever draws next)
  render(lightmap) {
    const d = this.device;
    const ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const state = { blend: 'none', depthTest: false, depthWrite: false };
    d.setGlobals({ view: ident, proj: ident, fogMode: 2 });
    for (const ps of this.passes) {
      const src = this._target(ps.intarget), dst = this._target(ps.outtarget);
      if (!src || !dst) continue;
      const aux = ps.auxtargets && ps.auxtargets.length ? this._target(ps.auxtargets[0].id) : null;
      d.setRenderTarget(dst, [0, 0, 0, 0]);
      d.setGlobals({ lightmap: aux || src });
      d.draw({ mesh: this.quad, pipeline: 'post', textures: [src], params: ps.params, state });
    }
    d.setRenderTarget(null);
    d.setGlobals({ lightmap: this.main });
    d.draw({ mesh: this.quad, pipeline: 'post', textures: [this.main], params: BLIT, state });
    if (lightmap) d.setGlobals({ lightmap });
  }

  destroy() {
    const d = this.device;
    for (const t of this.targets.values()) d.destroyTexture(t);
    if (this.main) d.destroyTexture(this.main);
    d.destroyMesh(this.quad);
  }
}

// Chains by name, loaded once per resource reload: the assets' shaders/post/<name>.json, else the built-in copy
export class PostEffects {
  constructor(game) { this.game = game; this.chains = new Map(); this.loading = new Set(); }

  get(name) {
    if (!name) return null;
    const c = this.chains.get(name);
    if (c !== undefined) return c;
    if (!this.loading.has(name)) {
      this.loading.add(name);
      const g = this.game;
      const version = g.assets.version;
      g.assets.readJson('shaders/post/' + name + '.json').catch(() => null).then((json) => {
        this.loading.delete(name);
        if (g.assets.version !== version) return;
        const chain = new PostChain(g.device, json && Array.isArray(json.passes) ? json : BUILTIN_CHAINS[name]);
        this.chains.set(name, chain.ok ? chain : (chain.destroy(), new PostChain(g.device, BUILTIN_CHAINS[name])));
      });
    }
    return null;
  }

  clear() {
    for (const c of this.chains.values()) if (c) c.destroy();
    this.chains.clear();
  }
}
