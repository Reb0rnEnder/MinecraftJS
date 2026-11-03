import{DYE_TEXTURE_COLORS}from'./dye-colors.js';
import{mcCos}from'../game/physics.js';
// Banners: pattern texture compositing (LayeredColorMaskTexture) and the banner model
// (ModelBanner / TileEntityBannerRenderer), shared by placed banners and banner items.
import { blockModel } from './entity-models.js';
import { Node } from '../gfx/scene.js';
import { D2R } from '../gfx/math.js';

export const BANNER_CODES = {
  b: 'base', bl: 'square_bottom_left', br: 'square_bottom_right', tl: 'square_top_left', tr: 'square_top_right', bs: 'stripe_bottom',
  ts: 'stripe_top', ls: 'stripe_left', rs: 'stripe_right', cs: 'stripe_center', ms: 'stripe_middle', drs: 'stripe_downright',
  dls: 'stripe_downleft', ss: 'small_stripes', cr: 'cross', sc: 'straight_cross', bt: 'triangle_bottom', tt: 'triangle_top',
  bts: 'triangles_bottom', tts: 'triangles_top', ld: 'diagonal_left', rd: 'diagonal_up_right', lud: 'diagonal_up_left',
  rud: 'diagonal_right', mc: 'circle', mr: 'rhombus', vh: 'half_vertical', hh: 'half_horizontal', vhr: 'half_vertical_right',
  hhb: 'half_horizontal_bottom', bo: 'border', cbo: 'curly_border', cre: 'creeper', gra: 'gradient', gru: 'gradient_up',
  bri: 'bricks', sku: 'skull', flo: 'flower', moj: 'mojang',
};
// EnumDyeColor map colours, indexed by dye damage (0 = black ... 15 = white)
export const DYE_MAP_COLORS = DYE_TEXTURE_COLORS.slice().reverse().map(c=>(Math.round(c[0]*255)<<16)|(Math.round(c[1]*255)<<8)|Math.round(c[2]*255));

// Banner contents from tile entity data or an item (BlockEntityTag, base colour from the damage value)
export function bannerLayers(base, patterns) {
  return [{ Pattern: 'b', Color: base }, ...(patterns || [])].slice(0, 17);
}

// LayeredColorMaskTexture: start from banner_base.png; every pattern mask pixel with a non-zero blue channel
// replaces the pixel with (base texture * dye colour) and alpha = mask blue. Returns null until images load.
// shield: BannerTextures.SHIELD_DESIGNS (shield_base.png and the entity/shield/ masks)
export function composeBanner(assets, layers, shield = false) {
  const bi = assets.image(shield ? 'entity/shield_base.png' : 'entity/banner_base.png');
  const dir = shield ? 'entity/shield/' : 'entity/banner/';
  const imgs = layers.map((p) => (BANNER_CODES[p.Pattern] ? assets.image(dir + BANNER_CODES[p.Pattern] + '.png') : false));
  if (!bi || imgs.some((i) => i === null)) return null;
  const W = bi.width, H = bi.height, src = bi.data;
  const out = new Uint8Array(src);
  layers.forEach((p, k) => {
    const img = imgs[k];
    if (!img || img.width !== W || img.height !== H) return;
    const col = DYE_MAP_COLORS[p.Color & 15];
    const r = (col >> 16) & 255, g = (col >> 8) & 255, b = col & 255;
    const m = img.data;
    for (let i = 0; i < out.length; i += 4) {
      if(m[i+3]===0)continue;
      const alpha=m[i]/255,targetAlpha=out[i+3]/255;
      const alphaByte=m[i],destinationAlpha=out[i+3],resultAlpha=alphaByte+Math.round(destinationAlpha*(255-alphaByte)/255);if(resultAlpha===0)continue;
      // BufferedImage's SrcOver operates on quantized premultiplied channels.
      for(let channel=0;channel<3;channel++){const tint=[r,g,b][channel],source=Math.floor(src[i+channel]*tint/255),sourcePre=Math.round(source*alphaByte/255),destinationPre=Math.round(out[i+channel]*destinationAlpha/255);out[i+channel]=Math.round((sourcePre+Math.round(destinationPre*(255-alphaByte)/255))*255/resultAlpha);}
      out[i+3]=resultAlpha;
    }
  });
  return { width: W, height: H, data: out };
}

// TileEntityBannerRenderer in block space (origin at the block corner). standing: rotation in 1/16 turns;
// wall banners: facing meta 2..5. Returns { node, swing } (swing = the flag, animated by the caller).
export function buildBanner(mat, standing, meta) {
  const { slate, stand, top } = blockModel('banner', ['slate', 'stand', 'top']); // ModelBanner
  const f = 0.6666667;
  const outer = new Node();
  let inner = null;
  if (standing) { outer.position.set(0.5, 0.75 * f, 0.5); outer.rotation.y = -(meta * 360 / 16) * D2R; }
  else {
    const rot = meta === 2 ? 180 : meta === 4 ? 90 : meta === 5 ? -90 : 0;
    outer.position.set(0.5, -0.25 * f, 0.5); outer.rotation.y = -rot * D2R; // translate(x + 0.5, y - 0.25 * f, z + 0.5)
    inner = new Node(); inner.position.set(0, -0.3125, -0.4375);
  }
  const sc = new Node(); sc.scale.set(f, -f, -f);
  const model = new Node(); model.scale.set(1 / 16, 1 / 16, 1 / 16);
  const swing = new Node();
  swing.add(slate.build()); slate.setMaterial(mat);
  swing.position.set(0, -32, 0);
  model.add(swing);
  if (standing) { model.add(stand.build()); stand.setMaterial(mat); }
  model.add(top.build()); top.setMaterial(mat);
  sc.add(model);
  if (inner) { inner.add(sc); outer.add(inner); } else outer.add(sc);
  const node = new Node();
  node.add(outer);
  return { node, swing };
}

// Flag sway: (-0.0125 + 0.01 * cos(time * PI * 0.02)) * PI around X
export function bannerSwing(time) { const f=Math.fround,phase=f(((time%100)+100)%100/100);return f(f(f(-.0125)+f(f(.01)*mcCos(f(f(Math.PI*2)*phase))))*f(Math.PI)); }
