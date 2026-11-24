// DisplayRenderer (1.19.4+): block, item and text display entities. The billboard orientation and the interpolated
// transformation form the node matrix; the inner content follows BlockDisplayRenderer / ItemDisplayRenderer /
// TextDisplayRenderer.
import { Node, material } from '../gfx/scene.js';
import { litParams } from '../gfx/device.js';
import { buildTextMeshes, destroyTextMeshes } from './text-mesh.js';
import { applyTransform } from './item-renderer.js';
import { shadowGeometry } from './shadows.js';
import { chatToLegacy } from '../gui/chat.js';
import { displayProgress, lerpTransformation, transformationMatrix, billboardAngles, orientationMatrix, multiply,
  lerpInt, lerpColor, lerpFloat, textStyle, ITEM_DISPLAY } from '../game/display-entity.js';

const TEXT_PARAMS = litParams(0.01);
// Font: colours whose alpha is below 4 are drawn opaque
const fontAlpha = (byte) => { const a = byte & 255; return a < 4 ? 255 : a; };
const rotLerp = (p, a, b) => { let d = (b - a) % 360; if (d >= 180) d -= 360; if (d < -180) d += 360; return a + p * d; };

export function buildDisplay(er, e) {
  const v = { root: new Node(), kind: 'display', materials: [] };
  v.atlasMat = er._mat(v, er.atlasTex, { alphaTest: 0.1, transparent: true });
  v.frame = new Node();
  v.root.add(v.frame);
  v.content = new Node();
  v.frame.add(v.content);
  er._addShadow(v);
  return v;
}

export function destroyDisplay(er, v) { destroyTextMeshes(er.device, v.textMeshes); v.textMeshes = null; }

// Native culling: a display with zero width or height is never culled; otherwise its width x height box at the
// entity position must be visible. Distance limit: viewRange * 64 * entity view scale.
export function displayVisible(er, e, p, d2, viewScale) {
  const d = e.display;
  if (!d || !d.renderState) return false;
  const range = d.viewRange * 64 * viewScale;
  if (!(d2 < range * range)) return false;
  if (e.noCulling) return true;
  const hw = d.width / 2;
  return er.r.boxVisible(p.x - hw, p.y, p.z - hw, p.x + hw, p.y + d.height, p.z + hw);
}

export function renderDisplay(er, e, v, p, partial) {
  const g = er.game, d = e.display, s = d.renderState;
  const progress = displayProgress(e, partial);
  const yaw = rotLerp(partial, e.prevYaw ?? e.yaw ?? 0, e.yaw ?? 0), pitch = (e.prevPitch ?? e.pitch ?? 0) + ((e.pitch ?? 0) - (e.prevPitch ?? e.pitch ?? 0)) * partial;
  const [ay, ax] = billboardAngles(s.billboard, yaw, pitch, er.r.camYaw ?? 0, er.r.camPitch ?? 0);
  v.frame.matrix = Float32Array.from(multiply(orientationMatrix(ay, ax), transformationMatrix(lerpTransformation(s.transformation, progress))));
  // Brightness override (packed block << 4 | sky << 20), else the light at the entity position
  let light;
  if (s.brightness !== -1) light = [(s.brightness >> 20) & 15, (s.brightness >> 4) & 15];
  else light = er._light(p.x, p.y, p.z);
  for (const m of v.materials) m.params.setLight(light[0], light[1]);
  updateShadow(er, e, v, p, s, progress);
  if (e.entityName === 'text_display') return renderText(er, e, v, s, progress, light);
  if (e.entityName === 'block_display') {
    const key = 'block:' + s.blockState;
    if (v.contentKey === key) return;
    v.contentKey = key; v.content.clear();
    // BlockDisplayRenderer: renderSingleBlock at the pose origin (our block meshes are centred)
    const o = s.blockState ? er._blockObject(s.blockState, v.atlasMat) : null;
    if (o) { o.position.set(0.5, 0.5, 0.5); v.content.add(o); }
    return;
  }
  if (e.entityName === 'item_display') {
    const it = s.item && s.item.id ? s.item : null;
    const key = 'item:' + (it ? g.itemRenderer.iconKey(it) : '') + ':' + s.itemDisplay;
    if (v.contentKey === key) return;
    v.contentKey = key; v.content.clear();
    if (!it) return;
    const io = er._itemObject(it, v.atlasMat);
    if (!io) return;
    // ItemDisplayRenderer: rotate 180 degrees about Y, then render with the item's display transform
    const turn = new Node(); turn.rotation.set(0, Math.PI, 0);
    const inner = new Node();
    const context = ITEM_DISPLAY[s.itemDisplay] || 'none';
    if (context !== 'none') applyTransform(inner, (io.model?.display || {})[context], context.endsWith('lefthand'));
    inner.add(io.obj); turn.add(inner); v.content.add(turn);
  }
}

// EntityRenderDispatcher: the shadow uses the interpolated radius (at most 32) and (1 - d^2 / 256) * strength
function updateShadow(er, e, v, p, s, progress) {
  const g = er.game, radius = Math.min(32, lerpFloat(s.shadowRadius, progress)), c = er.r.camPos || [p.x, p.y, p.z];
  const strength = (1 - ((p.x - c[0]) ** 2 + (p.y - c[1]) ** 2 + (p.z - c[2]) ** 2) / 256) * lerpFloat(s.shadowStrength, progress);
  if (!g.settings.entityShadows || e.invisible || !(radius > 0) || !(strength > 0)) { v.shadow.visible = false; return; }
  const vertices = shadowGeometry(g.world, p, radius, strength);
  v.shadow.visible = vertices.length > 0;
  if (!vertices.length) return;
  v.shadowParams[3] = 1;
  v.shadow.position.set(0, 0, 0);
  er.device.updateMesh(v.shadowMesh, vertices, { quads: true });
}

function textOf(text) {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  try { return chatToLegacy(text); } catch { return ''; }
}

// TextDisplayRenderer.renderInner
function renderText(er, e, v, s, progress, light) {
  const g = er.game, font = g.gui.font;
  const style = textStyle(s.styleFlags);
  const opacity = fontAlpha(lerpInt(s.textOpacity, progress));
  // Options.getBackgroundOpacity(0.25): the fallback while the text background is limited to chat
  const set = g.settings, backgroundOpacity = set.textBackgroundOnlyChat !== false ? 0.25 : (set.textBackgroundOpacity ?? 0.5);
  const background = style.defaultBackground ? Math.trunc(backgroundOpacity * 255) << 24 : lerpColor(s.background, progress);
  const text = textOf(s.text);
  const key = [text, s.lineWidth, s.styleFlags, opacity, background, light[0], light[1]].join('\u0000');
  if (v.contentKey === key) return;
  v.contentKey = key;
  v.content.clear();
  destroyTextMeshes(er.device, v.textMeshes);
  // splitLines: wrap to lineWidth; the block is as wide as its widest line, lines are 9 + 1 pixels apart
  const lines = text.split('\n').flatMap((l) => font.wrap(l, Math.max(1, s.lineWidth)));
  const widths = lines.map((l) => font.width(l)), width = widths.reduce((a, b) => Math.max(a, b), 0), lineHeight = 10, height = lines.length * lineHeight;
  const ox = 1 - width / 2, oy = -height;
  const items = lines.map((l, i) => ({ text: l, x: ox + (style.align === 'left' ? 0 : style.align === 'right' ? width - widths[i] : width / 2 - widths[i] / 2),
    y: oy + i * lineHeight, color: 0xffffff, alpha: opacity / 255, shadow: style.shadow }));
  const rects = (background >>> 24) !== 0 ? [{ x0: ox - 1, y0: oy - 1, x1: ox + width, y1: oy + height,
    color: [((background >> 16) & 255) / 255, ((background >> 8) & 255) / 255, (background & 255) / 255, (background >>> 24) / 255] }] : [];
  // The text faces +z here; keep the background just behind the glyphs (native draws both at z 0 and offsets the
  // text polygons forward)
  const meshes = [...(rects.length ? buildTextMeshes(er.device, font, [], rects, -0.04, light) : []), ...buildTextMeshes(er.device, font, items, [], 0, light)];
  v.textMeshes = meshes;
  // rotate 180 degrees about Y and scale by -0.025: x and z stay, font y points down
  const node = new Node(); node.scale.set(0.025, -0.025, 0.025);
  const state = style.seeThrough ? { blend: 'alpha', depthTest: false, depthWrite: false, cull: false } : { blend: 'alpha', polygonOffset: true, cull: false };
  for (const m of meshes) node.addDrawable(m.mesh, material('lit', m.tex || g.gui.white, TEXT_PARAMS, state), { order: style.seeThrough ? 20 : 0 });
  v.content.add(node);
}
