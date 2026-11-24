// Glowing entity outlines (LevelRenderer entity outline target + shaders/post/entity_outline.json, 1.9+): every
// glowing entity's outline-capable layers are drawn again in a flat team colour into the "final" target with no
// depth test (so they show through walls), the chain finds the silhouette edges (entity_sobel) and box-blurs
// them, and doEntityOutline blends the result over the frame after the hand.
import { EntityParams } from '../gfx/device.js';
import { material, toDraw } from '../gfx/scene.js';

// ChatFormatting colours by team colour index
const FORMAT_RGB = [0x000000, 0x0000aa, 0x00aa00, 0x00aaaa, 0xaa0000, 0xaa00aa, 0xffaa00, 0xaaaaaa, 0x555555, 0x5555ff, 0x55ff55, 0x55ffff, 0xff5555, 0xff55ff, 0xffff55, 0xffffff];
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// Entity.getTeamColor: the scoreboard team's colour (players by name, other entities by UUID), else white;
// Display.getTeamColor: the glow colour override when set
export function outlineColor(game, e) {
  if (e.display && e.display.glowColor !== -1 && e.display.glowColor !== undefined) return e.display.glowColor & 0xffffff;
  const teams = game.scoreboard?.playerTeam;
  const team = teams && (teams.get(e.kind === 'player' ? e.name : e.uuid) || (e.uuid && teams.get(String(e.uuid))));
  const color = team?.color;
  return Number.isInteger(color) && color >= 0 && color < 16 ? FORMAT_RGB[color] : 0xffffff;
}

export const isGlowing = (e) => !!e.glowing;

export class EntityOutline {
  constructor(game) { this.game = game; this.materials = new WeakMap(); }

  // Outline materials: the drawable's texture and alpha test, the team colour as a full overlay, no lighting
  _material(src, color) {
    let byColor = this.materials.get(src);
    if (!byColor) this.materials.set(src, byColor = new Map());
    let m = byColor.get(color);
    if (!m) {
      const p = new EntityParams();
      if (src.params?.p) p.p.set(src.params.p);
      p.setTint(1, 1, 1, 1).setOverlay(((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255, 1);
      p.setFullBright(true).setNoLighting(true).setAlphaTest(1 / 255);
      m = material('entity', src.tex, p, { blend: 'none', depthTest: false, depthWrite: false, cull: src.state?.cull ?? false });
      byColor.set(color, m);
    }
    return m;
  }

  // RenderType.outline exists for the cutout/solid/translucent entity layers, not for additive/emissive ones
  static outlines(d) {
    const m = d.mat;
    return m && m.pipeline === 'entity' && m.state?.blend !== 'add' && !m.noOutline;
  }

  render() {
    const g = this.game, er = g.entityRenderer, r = g.renderer, d = g.device;
    if (!er || !d.createRenderTarget) return;
    const targets = [];
    for (const e of g.entities.all()) {
      if (!isGlowing(e)) continue;
      const v = er.visuals.get(e.id);
      if (v && v.root.visible) targets.push([e, v]);
    }
    if (!targets.length) return;
    const chain = g.postEffects.get('entity_outline');
    if (!chain) return; // still loading, or a chain this client cannot run
    chain._resize();
    const final = chain.targets.get('final');
    if (!final) return;
    d.setRenderTarget(final, [0, 0, 0, 0]);
    r._globals(r.view, r.proj);
    d.setGlobals({ fogMode: 2 });
    const resolve = (t) => (typeof t === 'function' ? t() : g.assets.texture(t));
    for (const [e, v] of targets) {
      const color = outlineColor(g, e);
      for (const { d: drawable, world } of v.root.collect([])) {
        if (drawable.visible === false || !EntityOutline.outlines(drawable)) continue;
        const dr = toDraw({ ...drawable, mat: this._material(drawable.mat, color) }, world, resolve);
        if (dr) { dr.outputTarget = undefined; d.draw(dr); }
      }
    }
    // entity_outline.json passes, then doEntityOutline: final blended over the frame (srcalpha, 1 - srcalpha)
    const ident = IDENTITY, state = { blend: 'none', depthTest: false, depthWrite: false }, blend = { blend: 'alpha', depthTest: false, depthWrite: false };
    d.setGlobals({ view: ident, proj: ident, fogMode: 2 });
    for (const ps of chain.passes) {
      const src = chain._target(ps.intarget), dst = chain._target(ps.outtarget);
      if (!src || !dst) continue;
      d.setRenderTarget(dst, [0, 0, 0, 0]);
      d.setGlobals({ lightmap: src });
      d.draw({ mesh: chain.quad, pipeline: 'post', textures: [src], params: ps.params, state: ps.name === 'blit' ? blend : state });
    }
    d.setRenderTarget(null);
    d.setGlobals({ lightmap: final });
    d.draw({ mesh: chain.quad, pipeline: 'post', textures: [final], params: BLIT_PARAMS, state: blend });
    r._globals(r.view, r.proj);
  }
}

const BLIT_PARAMS = (() => { const p = new Float32Array(16); p[0] = 0; p[4] = p[5] = p[6] = p[7] = 1; return p; })();
