// IronGolem.Crackiness.byFraction and IronGolemCrackinessLayer (Java 1.15+).
export function golemCrackTexture(health, maxHealth) {
  const fraction = Math.fround(health / maxHealth);
  const stage = fraction < .25 ? 'high' : fraction < .5 ? 'medium' : fraction < .75 ? 'low' : null;
  return stage ? 'entity/iron_golem/iron_golem_crackiness_' + stage + '.png' : null;
}
export function updateGolemCracks(entity, layer) {
  const texture = golemCrackTexture(entity.health, entity.maxHealth);
  layer.obj.visible = !!texture && !entity.invisible;
  if (texture) layer.mat.tex = texture;
}
