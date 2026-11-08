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
  sobel: { mode: 6, uniforms: {} },
  deconverge: { mode: 7, uniforms: { ConvergeX: [-4, 0, 2], ConvergeY: [0, -4, 2], RadialConvergeX: [1, 1, 1], RadialConvergeY: [1, 1, 1] } },
  phosphor: { mode: 8, uniforms: { Phosphor: [0.3, 0.3, 0.3] } },
  bumpy: { mode: 9, uniforms: {} },
  blobs: { mode: 10, uniforms: {} },
  blobs2: { mode: 11, uniforms: { Radius: [7] } },
  antialias: { mode: 12, uniforms: {} },
  scan_pincushion: { mode: 13, uniforms: {} },
  wobble: { mode: 14, uniforms: { Time: [0], Frequency: [512, 288], WobbleAmount: [0.002, 0.002] } },
  outline_soft: { mode: 15, uniforms: { LumaRamp: [16], LumaLevel: [4] } },
  flip: { mode: 16, uniforms: { ColorModulate: [1, 1, 1, 1] } },
};

// Where each uniform goes in the pipeline's params (see device.js)
const SLOTS = {
  ColorModulate: 4, InverseAmount: 1, Saturation: 1, RedMatrix: 4, GreenMatrix: 8, BlueMatrix: 12,
  Resolution: 1, MosaicSize: 3, BlurDir: 4, Radius: 6, InRotation: 1, InScale: 4, InOffset: 6, Scissor: 8, Vignette: 12,
  ConvergeX: 4, ConvergeY: 8, RadialConvergeX: 12, RadialConvergeY: 1, Phosphor: 4, Time: 1, Frequency: 4, WobbleAmount: 6,
  LumaRamp: 1, LumaLevel: 2,
};
const SLOTS_BY_PROGRAM = { bits: { Saturation: 2 }, blobs2: { Radius: 1 } };

// EntityRenderer.shaderResourceLocations: what 1.8's "Super Secret Settings..." button cycles through (then none).
// SUPER_SECRET_SUPPORTED: the ones whose programs the post pipeline has (notch, fxaa, art, ntsc and outline are not ported)
export const SUPER_SECRET = ['notch', 'fxaa', 'art', 'bumpy', 'blobs2', 'pencil', 'color_convolve', 'deconverge', 'flip', 'invert', 'ntsc',
  'outline', 'phosphor', 'scan_pincushion', 'sobel', 'bits', 'desaturate', 'green', 'blur', 'wobble', 'blobs', 'antialias', 'creeper', 'spider'];
const UNPORTED = new Set(['notch', 'fxaa', 'art', 'ntsc', 'outline']);
export const SUPER_SECRET_SUPPORTED = SUPER_SECRET.filter((n) => !UNPORTED.has(n));

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
  // The Super Secret Settings ones
  desaturate: { targets: ['swap'], passes: [{ name: 'color_convolve', intarget: 'minecraft:main', outtarget: 'swap', uniforms: [u('Saturation', [0.2])] }, { name: 'blit', intarget: 'swap', outtarget: 'minecraft:main' }] },
  color_convolve: { targets: ['swap'], passes: [{ name: 'color_convolve', intarget: 'minecraft:main', outtarget: 'swap', uniforms: [u('Saturation', [1.4])] }, { name: 'blit', intarget: 'swap', outtarget: 'minecraft:main' }] },
  green: { targets: ['swap'], passes: [
    { name: 'color_convolve', intarget: 'minecraft:main', outtarget: 'swap', uniforms: [u('RedMatrix', [0, 0, 0]), u('GreenMatrix', [0.3, 0.59, 0.11]), u('BlueMatrix', [0, 0, 0])] },
    { name: 'bits', intarget: 'swap', outtarget: 'minecraft:main' },
    { name: 'scan_pincushion', intarget: 'minecraft:main', outtarget: 'swap' },
    { name: 'blit', intarget: 'swap', outtarget: 'minecraft:main' },
  ] },
  blur: { targets: ['swap'], passes: [
    { name: 'blur', intarget: 'minecraft:main', outtarget: 'swap', uniforms: [u('BlurDir', [1, 0]), u('Radius', [20])] },
    { name: 'blur', intarget: 'swap', outtarget: 'minecraft:main', uniforms: [u('BlurDir', [0, 1]), u('Radius', [20])] },
  ] },
  phosphor: { targets: ['swap', 'previous'], passes: [
    { name: 'phosphor', intarget: 'minecraft:main', outtarget: 'swap', auxtargets: [{ name: 'PrevSampler', id: 'previous' }], uniforms: [u('Phosphor', [0.95, 0.95, 0.95])] },
    { name: 'blit', intarget: 'swap', outtarget: 'previous' },
    { name: 'blit', intarget: 'swap', outtarget: 'minecraft:main' },
  ] },
  pencil: single('outline_soft'),
  ...Object.fromEntries(['bits', 'flip', 'wobble', 'scan_pincushion', 'sobel', 'deconverge', 'bumpy', 'blobs', 'blobs2', 'antialias'].map((n) => [n, single(n)])),
};

// The usual one-program chain: main -> swap with the program, then blit back
function single(name) {
  return { targets: ['swap'], passes: [{ name, intarget: 'minecraft:main', outtarget: 'swap' }, { name: 'blit', intarget: 'swap', outtarget: 'minecraft:main' }] };
}

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

  // ShaderGroup.render, then main onto the screen (lightmap: the world's, put back for whatever draws next; time: the
  // Time uniform, 0-1 over 20 ticks)
  render(lightmap, time = 0) {
    const d = this.device;
    const ident = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
    const state = { blend: 'none', depthTest: false, depthWrite: false };
    // blit.json blends with the target (srcalpha, 1-srcalpha); the other programs replace it
    const blend = { blend: 'alpha', depthTest: false, depthWrite: false };
    d.setGlobals({ view: ident, proj: ident, fogMode: 2 });
    for (const ps of this.passes) {
      const src = this._target(ps.intarget), dst = this._target(ps.outtarget);
      if (!src || !dst) continue;
      const aux = ps.auxtargets && ps.auxtargets.length ? this._target(ps.auxtargets[0].id) : null;
      if (ps.name === 'wobble') ps.params[1] = time;
      // Shader.render: framebufferOut.framebufferClear() (ShaderGroup.addFramebuffer: colour 0, 0, 0, 0)
      d.setRenderTarget(dst, [0, 0, 0, 0]);
      d.setGlobals({ lightmap: aux || src });
      d.draw({ mesh: this.quad, pipeline: 'post', textures: [src], params: ps.params, state: ps.name === 'blit' ? blend : state });
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
        let chain = json && Array.isArray(json.passes) ? new PostChain(g.device, json) : null;
        if (chain && !chain.ok) { chain.destroy(); chain = null; }
        if (!chain && BUILTIN_CHAINS[name]) chain = new PostChain(g.device, BUILTIN_CHAINS[name]);
        this.chains.set(name, chain); // null: a chain this client cannot run
      });
    }
    return null;
  }

  clear() {
    for (const c of this.chains.values()) if (c) c.destroy();
    this.chains.clear();
  }
}
