// Exact target Entity.getPickRadius (old getCollisionBorderSize) overrides.
const DEFAULT_RADIUS=Math.fround(.1);
const FIREBALLS=new Set(['fireball','small_fireball','dragon_fireball','wither_skull']);
export function entityPickRadius(entity){
  if(entity.pickRadius!==undefined)return entity.pickRadius;
  if(entity.kind==='itemframe'||entity.entityName==='item_frame'||entity.entityName==='glow_item_frame')return 0;
  if(FIREBALLS.has(entity.entityName)||entity.kind==='projectile'&&[63,64,66,93].includes(entity.type))return 1;
  return DEFAULT_RADIUS;
}
