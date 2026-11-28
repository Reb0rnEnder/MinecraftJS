import { POT_PATTERNS_774 } from './pot-data-1.21.11.js';
import { blockModel } from './entity-models.js';
import { entityMaterial } from './boxmodel.js';
import { Node } from '../gfx/scene.js';
import { mat4, D2R } from '../gfx/math.js';
import { mcSin, mcCos } from '../game/physics.js';

const f = Math.fround, PI = f(Math.PI), SIDES = ['back', 'left', 'right', 'front'];

function patternPath(raw) {
  const short = String(raw).replace(/^minecraft:/, '');
  return (short.startsWith('entity/') ? short : 'entity/decorated_pot/' + short) + '.png';
}

export function potTextures774(decorations = []) {
  return Object.fromEntries(SIDES.map((side, i) => {
    const name = decorations[i], key = typeof name === 'string' ? (name.includes(':') ? name : 'minecraft:' + name) : '';
    return [side, patternPath(POT_PATTERNS_774[key] || POT_PATTERNS_774['minecraft:brick'])];
  }));
}

export function itemPotDecorations774(game, item) {
  const value = game.items.component(item, 'pot_decorations'), list = value?.decorations ?? value ?? [];
  return Array.isArray(list) ? list.map((id) => (typeof id === 'number' ? 'minecraft:' + game.items.name(id) : id)) : [];
}

export function potFrame774(facing = 'south', style = -1, elapsed = 0, partial = 0) {
  const m = mat4.create();
  mat4.translate(m, m, 0.5, 0, 0.5);
  mat4.rotateY(m, m, (180 - ({ south: 0, west: 90, north: 180, east: 270 }[facing] ?? 0)) * D2R);
  mat4.translate(m, m, -0.5, 0, -0.5);
  const duration = style === 0 ? 7 : style === 1 ? 10 : 0, p = f(f(f(elapsed) + f(partial)) / duration);
  if (duration && p >= 0 && p <= 1) {
    mat4.translate(m, m, 0.5, 0, 0.5);
    if (style === 0) {
      const phase = f(p * f(PI * 2)), angle = f(f(-1.5 * f(mcCos(phase) + 0.5)) * mcSin(f(phase / 2)));
      mat4.rotateX(m, m, f(angle / 64));
      mat4.rotateZ(m, m, f(mcSin(phase) / 64));
    } else {
      const a = f(mcSin(f(f(f(-p * 3) * PI))) * 0.125);
      mat4.rotateY(m, m, f(a * f(1 - p)));
    }
    mat4.translate(m, m, -0.5, 0, -0.5);
  }
  return m;
}

export function buildPot774(decorations = [], facing = 'south', makeMaterial = (path) => entityMaterial(path)) {
  const root = new Node(), model = new Node(), materials = [], textures = potTextures774(decorations);
  root.matrix = potFrame774(facing);
  model.scale.set(1 / 16, 1 / 16, 1 / 16);
  root.add(model);
  const base = makeMaterial('entity/decorated_pot/decorated_pot_base.png');
  base.state = { ...base.state, cull: true };
  materials.push(base);
  for (const part of Object.values(blockModel('decoratedPotBase', ['neck', 'top', 'bottom']))) {
    model.add(part.build());
    part.setMaterial(base);
  }
  const sides = blockModel('decoratedPotSides', SIDES);
  for (const side of SIDES) {
    const part = sides[side], mat = makeMaterial(textures[side]);
    mat.state = { ...mat.state, cull: true };
    materials.push(mat);
    model.add(part.build());
    part.setMaterial(mat);
  }
  return { root, materials };
}
