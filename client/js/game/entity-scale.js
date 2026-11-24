// generic.scale (1.20.5+): LivingEntity.getScale scales remote entities' dimensions (hitbox, eye height) and
// LivingEntityRenderer scales the model by it (the name tag and shadow stay unscaled).
const f32 = Math.fround;

// AttributeInstance value: base, + add_value, x (1 + sum of add_multiplied_base), x (1 + each add_multiplied_total)
export function attributeValue(prop) {
  let v = prop.value;
  for (const m of prop.modifiers || []) if (m.operation === 0) v += m.amount;
  const base = v;
  for (const m of prop.modifiers || []) if (m.operation === 1) v += base * m.amount;
  for (const m of prop.modifiers || []) if (m.operation === 2) v *= 1 + m.amount;
  return v;
}

// Called after anything may have set the unscaled dimensions; values another update wrote replace the base
export function applyEntityScale(e) {
  const s = e.attrScale ?? 1;
  if (s === 1 && e._scaledW === undefined) return;
  if (e.width !== e._scaledW) e._baseW = e.width;
  if (e.height !== e._scaledH) e._baseH = e.height;
  if (e.eyeHeight !== e._scaledE) e._baseE = e.eyeHeight;
  e.width = e._scaledW = f32(e._baseW * s);
  e.height = e._scaledH = f32(e._baseH * s);
  e.eyeHeight = e._scaledE = f32((e._baseE ?? 0) * s);
}

export function setScaleAttribute(e, prop) {
  // Attributes.SCALE: ranged 0.0625 - 16
  e.attrScale = Math.min(16, Math.max(0.0625, attributeValue(prop)));
  applyEntityScale(e);
}
