import { ITEM_DATA_774 } from './item-data-1.21.11.js';

// Native 1.21.11 mob_effect registry IDs start at zero; retain zero-based IDs everywhere.
export const EFFECT_774 = Object.freeze(
  Object.fromEntries(
    Object.entries(ITEM_DATA_774.registries.mob_effect).map(([id, key]) => [key.replace(/^minecraft:/, ''), Number(id)])
  )
);

export function effectLabel774(game, id, amplifier = 0) {
  const def = game.items.effects[id];
  if (!def) return '';
  let label = game.assets.translate('effect.' + def.key.replace(':', '.'));
  if (amplifier >= 1 && amplifier <= 9) label += ' ' + game.assets.translate('enchantment.level.' + (amplifier + 1));
  return label;
}

export function effectDuration774(duration, translate, tickRate = 20) {
  if (duration === -1) return translate('effect.duration.infinite');
  const seconds = Math.trunc(duration / tickRate);
  const minutes = Math.trunc(seconds / 60);
  const hours = Math.trunc(minutes / 60);
  return (hours ? String(hours).padStart(2, '0') + ':' : '') +
    String(minutes % 60).padStart(2, '0') + ':' +
    String(seconds % 60).padStart(2, '0');
}

// MobEffectInstance.compareTo; inventory uses natural order, the HUD reverses it.
export function compareEffects774([id, a], [otherId, b], definitions = ITEM_DATA_774.effects) {
  const ambientA = a.ambient ? 1 : 0;
  const ambientB = b.ambient ? 1 : 0;
  const colorA = definitions[id]?.color ?? 0;
  const colorB = definitions[otherId]?.color ?? 0;
  const infA = a.duration === -1 ? 1 : 0;
  const infB = b.duration === -1 ? 1 : 0;
  if ((!infA && a.duration > 32147 && !infB && b.duration > 32147) || (ambientA && ambientB)) {
    return (ambientA - ambientB) || (colorA - colorB);
  }
  return (ambientA - ambientB) || (infA - infB) || (a.duration - b.duration) || (colorA - colorB);
}

// MobEffectInstance.BlendState
export function createEffectBlend774(id, duration, smooth = true, previous = null, definitions = ITEM_DATA_774.effects) {
  const blendTicks = definitions[id]?.blendTicks ?? 0;
  if (!smooth) {
    const immediate = (duration === -1 || duration >= blendTicks) ? 1 : 0;
    return { blendTicks, factor_current: immediate, factor_previous_frame: immediate };
  }
  if (previous) return previous;
  return { blendTicks, factor_current: 0, factor_previous_frame: 0 };
}

export function tickEffectBlend774(effect) {
  const d = effect?.factor;
  if (!d) return;
  d.factor_previous_frame = d.factor_current;
  const target = (effect.duration === -1 || effect.duration >= d.blendTicks) ? 1 : 0;
  if (d.factor_current === target) return;
  if (!d.blendTicks) {
    d.factor_current = target;
    return;
  }
  const f = Math.fround;
  const step = f(1 / d.blendTicks);
  const delta = Math.max(-step, Math.min(step, f(target - d.factor_current)));
  d.factor_current = f(d.factor_current + delta);
}
