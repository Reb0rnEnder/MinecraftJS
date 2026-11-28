import { signTextItems } from './sign-text-layout.js';
import { buildSignFrame } from './sign-model.js';
import { Node, material } from '../gfx/scene.js';
import { colorParams } from '../gfx/device.js';
import { buildTextMeshes } from './text-mesh.js';
import { glowingSignStyle } from '../game/signs-1.14.4.js';
import { isScoping } from '../game/spyglass.js';
import { chatToLegacy, chatComponentString } from '../gui/chat.js';

const signComponent = (v) => Array.isArray(v)
  ? v.map(signComponent)
  : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).map(([k, n]) => [k, ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'].includes(k) && typeof n === 'number' ? !!n : signComponent(n)]))
    : v;

export function signFace774(data, front = true, filtered = false) {
  const text = data?.[front ? 'front_text' : 'back_text'] || {};
  const messages = filtered && text.filtered_messages ? text.filtered_messages : text.messages;
  const components = Array.from({ length: 4 }, (_, i) => {
    let v = messages?.[i] ?? '';
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch {} }
    v = signComponent(v);
    return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? { text: String(v) } : v;
  });
  return {
    lines: components.map((c) => chatToLegacy(c, { parsed: true })),
    plainLines: components.map(chatComponentString),
    color: text.color || 'black',
    glowing: !!text.has_glowing_text,
  };
}

export function signOutlineKey774(game, t) {
  const c = game.renderer.camPos;
  const d = (t.x + 0.5 - c[0]) ** 2 + (t.y + 0.5 - c[1]) ** 2 + (t.z + 0.5 - c[2]) ** 2;
  return [true, false].map((front) => {
    const f = signFace774(t.data, front);
    return glowingSignStyle(f.color, f.glowing, d, isScoping(game)).outlineColor ?? 'none';
  }).join('/');
}

export function buildSign774(game, t, name, props, mat) {
  const { root: outer, inner, scale: f, hanging } = buildSignFrame(name, props, mat);
  const textScale = hanging ? Math.fround(0.9) : Math.fround(2 / 3), lineHeight = hanging ? 9 : 10, maxWidth = hanging ? 60 : 90;
  t.textMeshes = [];
  t.signTextParams = [];
  const font = game.gui.font, c = game.renderer.camPos, dist = (t.x + 0.5 - c[0]) ** 2 + (t.y + 0.5 - c[1]) ** 2 + (t.z + 0.5 - c[2]) ** 2;
  for (const front of [true, false]) {
    const face = signFace774(t.data, front, game.settings.textFilteringEnabled);
    const style = glowingSignStyle(face.color, face.glowing, dist, isScoping(game));
    const items = signTextItems(font, face.lines, style, maxWidth, lineHeight);
    const meshes = buildTextMeshes(game.device || game.gui.device, font, items);
    t.textMeshes.push(...meshes);
    const side = new Node(), text = new Node();
    side.rotation.y = front ? 0 : Math.PI;
    side.add(text);
    inner.add(side);
    text.position.set(0, hanging ? Math.fround(-0.32) : Math.fround(1 / 3), hanging ? Math.fround(0.073) : Math.fround(0.07) * f);
    const scale = 0.015625 * textScale;
    text.scale.set(scale, -scale, scale);
    for (const m of meshes) {
      const params = colorParams(1, 1, 1, 1, 0.05, 1);
      t.signTextParams.push({ params, glowing: face.glowing });
      text.addDrawable(m.mesh, material('color', m.tex || game.gui.white, params, { blend: 'none' }));
    }
  }
  t.signOutlineKey = signOutlineKey774(game, t);
  return outer;
}
