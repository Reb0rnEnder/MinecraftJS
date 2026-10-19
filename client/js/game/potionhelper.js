// Port of 1.8 PotionHelper: a potion's effects follow from the bits of its damage value through the requirement and
// amplifier formulas, and its colour from those effects. Potion holds the effect table (Potion.potionTypes).

const f32 = Math.fround;

// Potion.potionTypes: name (translation key), bad effect, liquid colour, effectiveness (0.5 for bad effects unless set),
// instant, attribute modifiers [attribute, amount, operation] (amount per level: PotionAttackDamage and the default
// getAttributeModifierAmount)
export const POTIONS = {
  1: { name: 'potion.moveSpeed', bad: false, color: 8171462, eff: 1, mods: [['generic.movementSpeed', f32(0.2), 2]] },
  2: { name: 'potion.moveSlowdown', bad: true, color: 5926017, eff: 0.5, mods: [['generic.movementSpeed', f32(-0.15), 2]] },
  3: { name: 'potion.digSpeed', bad: false, color: 14270531, eff: 1.5 },
  4: { name: 'potion.digSlowDown', bad: true, color: 4866583, eff: 0.5 },
  5: { name: 'potion.damageBoost', bad: false, color: 9643043, eff: 1, mods: [['generic.attackDamage', 2.5, 2]], attackDamage: true },
  6: { name: 'potion.heal', bad: false, color: 16262179, eff: 1, instant: true },
  7: { name: 'potion.harm', bad: true, color: 4393481, eff: 0.5, instant: true },
  8: { name: 'potion.jump', bad: false, color: 2293580, eff: 1 },
  9: { name: 'potion.confusion', bad: true, color: 5578058, eff: 0.25 },
  10: { name: 'potion.regeneration', bad: false, color: 13458603, eff: 0.25 },
  11: { name: 'potion.resistance', bad: false, color: 10044730, eff: 1 },
  12: { name: 'potion.fireResistance', bad: false, color: 14981690, eff: 1 },
  13: { name: 'potion.waterBreathing', bad: false, color: 3035801, eff: 1 },
  14: { name: 'potion.invisibility', bad: false, color: 8356754, eff: 1 },
  15: { name: 'potion.blindness', bad: true, color: 2039587, eff: 0.25 },
  16: { name: 'potion.nightVision', bad: false, color: 0x1f1fa1, eff: 1 },
  17: { name: 'potion.hunger', bad: true, color: 5797459, eff: 0.5 },
  18: { name: 'potion.weakness', bad: true, color: 0x484d48, eff: 0.5, mods: [['generic.attackDamage', 2, 0]], attackDamage: true },
  19: { name: 'potion.poison', bad: true, color: 5149489, eff: 0.25 },
  20: { name: 'potion.wither', bad: true, color: 3484199, eff: 0.25 },
  21: { name: 'potion.healthBoost', bad: false, color: 16284963, eff: 1, mods: [['generic.maxHealth', 4, 0]] },
  22: { name: 'potion.absorption', bad: false, color: 0x2552a5, eff: 1 },
  23: { name: 'potion.saturation', bad: false, color: 16262179, eff: 1, instant: true },
};

// Potion.getAttributeModifierAmount (PotionAttackDamage: strength 1.3, weakness -0.5F per level)
export function modifierAmount(id, amplifier, amount) {
  if (id === 18) return f32(-0.5 * (amplifier + 1));
  if (id === 5) return 1.3 * (amplifier + 1);
  return amount * (amplifier + 1);
}

const REQUIREMENTS = {
  10: '0 & !1 & !2 & !3 & 0+6',
  1: '!0 & 1 & !2 & !3 & 1+6',
  12: '0 & 1 & !2 & !3 & 0+6',
  6: '0 & !1 & 2 & !3',
  19: '!0 & !1 & 2 & !3 & 2+6',
  18: '!0 & !1 & !2 & 3 & 3+6',
  7: '!0 & !1 & 2 & 3',
  2: '!0 & 1 & !2 & 3 & 3+6',
  5: '0 & !1 & !2 & 3 & 3+6',
  16: '!0 & 1 & 2 & !3 & 2+6',
  14: '!0 & 1 & 2 & 3 & 2+6',
  13: '0 & !1 & 2 & 3 & 2+6',
  8: '0 & 1 & !2 & 3 & 3+6',
};
const AMPLIFIERS = { 1: '5', 3: '5', 5: '5', 10: '5', 7: '5', 6: '5', 11: '5', 19: '5', 8: '5' };

const checkFlag = (n, bit) => (n & (1 << bit)) !== 0;
function countSetFlags(n) { let c = 0; while (n > 0) { n &= n - 1; c++; } return c; }

// PotionHelper.getPotionEffect
function term(not, hasMult, negative, comparison, number, mult, damage) {
  let v = 0;
  if (not) v = checkFlag(damage, number) ? 0 : 1;
  else if (comparison !== -1) {
    const c = countSetFlags(damage);
    if ((comparison === 0 && c === number) || (comparison === 1 && c > number) || (comparison === 2 && c < number)) v = 1;
  } else v = checkFlag(damage, number) ? 1 : 0;
  if (hasMult) v *= mult;
  if (negative) v *= -1;
  return v;
}

// PotionHelper.parsePotionEffects (vanilla passes "index of | or & minus 1" as the left part's end)
function parse(s, start, end, damage) {
  if (start >= s.length || end < 0 || start >= end) return 0;
  let i = s.indexOf('|', start);
  if (i >= 0 && i < end) {
    const a = parse(s, start, i - 1, damage);
    if (a > 0) return a;
    const b = parse(s, i + 1, end, damage);
    return b > 0 ? b : 0;
  }
  i = s.indexOf('&', start);
  if (i >= 0 && i < end) {
    const a = parse(s, start, i - 1, damage);
    if (a <= 0) return 0;
    const b = parse(s, i + 1, end, damage);
    if (b <= 0) return 0;
    return a > b ? a : b;
  }
  let afterStar = false, hasMult = false, hasNumber = false, not = false, negative = false;
  let comparison = -1, number = 0, mult = 0, total = 0;
  const flush = () => {
    total += term(not, hasMult, negative, comparison, number, mult, damage);
    not = false; negative = false; afterStar = false; hasMult = false; hasNumber = false; mult = 0; number = 0; comparison = -1;
  };
  for (let k = start; k < end; k++) {
    const c = s[k];
    if (c >= '0' && c <= '9') {
      if (afterStar) { mult = c.charCodeAt(0) - 48; hasMult = true; } else { number = number * 10 + (c.charCodeAt(0) - 48); hasNumber = true; }
    } else if (c === '*') afterStar = true;
    else if (c === '!') { if (hasNumber) flush(); not = true; }
    else if (c === '-') { if (hasNumber) flush(); negative = true; }
    else if (c === '=' || c === '<' || c === '>') {
      if (hasNumber) flush();
      comparison = c === '=' ? 0 : c === '<' ? 2 : 1;
    } else if (c === '+' && hasNumber) flush();
  }
  if (hasNumber) total += term(not, hasMult, negative, comparison, number, mult, damage);
  return total;
}

const cache = new Map();
// PotionHelper.getPotionEffects(damage, false): [{ id, duration, amplifier, particles }]
export function getPotionEffects(damage) {
  let list = cache.get(damage);
  if (list) return list;
  list = [];
  for (let id = 1; id < 32; id++) {
    const p = POTIONS[id], req = REQUIREMENTS[id];
    if (!p || !req) continue;
    const level = parse(req, 0, req.length, damage);
    if (level <= 0) continue;
    let amp = 0;
    const as = AMPLIFIERS[id];
    if (as !== undefined && (amp = parse(as, 0, as.length, damage)) < 0) amp = 0;
    let duration;
    if (p.instant) duration = 1;
    else {
      duration = 1200 * (level * 3 + (level - 1) * 2);
      duration >>= amp;
      duration = Math.round(duration * p.eff);
      if (damage & 0x4000) duration = Math.round(duration * 0.75 + 0.5);
    }
    list.push({ id, duration, amplifier: amp, particles: true });
  }
  cache.set(damage, list);
  return list;
}

// PotionHelper.calcPotionLiquidColor: every amplifier level weighs the same
export function liquidColor(effects) {
  if (!effects || !effects.length) return 3694022;
  let r = 0, g = 0, b = 0, n = 0;
  for (const e of effects) {
    if (!e.particles) continue;
    const c = POTIONS[e.id] ? POTIONS[e.id].color : 0;
    for (let k = 0; k <= e.amplifier; k++) {
      r = f32(r + f32(((c >> 16) & 255) / 255)); g = f32(g + f32(((c >> 8) & 255) / 255)); b = f32(b + f32((c & 255) / 255)); n = f32(n + 1);
    }
  }
  if (n === 0) return 0;
  const ch = (v) => Math.trunc(f32(f32(v / n) * 255));
  return (ch(r) << 16) | (ch(g) << 8) | ch(b);
}
