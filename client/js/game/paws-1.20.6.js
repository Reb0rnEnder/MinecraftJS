import{PAWS_DATA_766}from'./paws-data-1.20.6.js';
export function applyPawsMetadata(e,wire){
 const ids=PAWS_DATA_766.metadata[e.entityName];if(!ids)return;
 const set=(symbol,key)=>{if(wire[ids[symbol]]!==undefined)e[key]=wire[ids[symbol]];};
 set('DATA_HEALTH_ID','health');
 if(e.entityName==='wolf'){
  set('DATA_VARIANT_ID','wolfVariant');set('DATA_INTERESTED_ID','begging');set('DATA_COLLAR_COLOR','collar');set('DATA_REMAINING_ANGER_TIME','angerTime');
  if(wire[ids.DATA_FLAGS_ID]!==undefined){const flags=wire[ids.DATA_FLAGS_ID];e.tamed=!!(flags&4);e.sitting=!!(flags&1);}
  e.angry=(e.angerTime??0)>0;
 }
 if(e.entityName==='armadillo'&&wire[ids.ARMADILLO_STATE]!==undefined){const state=wire[ids.ARMADILLO_STATE];if(e.armadilloState!==state){e.armadilloState=state;e.armadilloStateStart=e.ticks??0;e.armadilloStateTicks=0;}}
 if(wire[ids.DATA_BABY_ID]!==undefined){e.child=!!wire[ids.DATA_BABY_ID];if(e.entityName==='armadillo')[e.width,e.height,e.eyeHeight]=PAWS_DATA_766.armadilloDimensions[e.child?'baby':'adult'].map(Math.fround);}
}
export function wolfTailAngle766(e){if(e.angry)return Math.fround(1.5393804);if(!e.tamed)return Math.fround(.62831855);const f=Math.fround,max=f(e.maxHealth??40),missing=f(f(max-f(e.health??max))/max);return f(f(f(.55)-f(missing*f(.4)))*f(Math.PI));}
// Armadillo.setupAnimationStates runs on ticks; metadata/events only request
// transitions. This keeps a packet between ticks from restarting a pose early.
export function tickArmadillo766(e){
 const state=e.armadilloState??0,elapsed=e.armadilloStateTicks??0;
 e.armadilloAnimationInitialized=true;
 if(state!==1)e.armadilloRollUpStart=undefined;
 if(state!==3)e.armadilloRollOutStart=undefined;
 if(state!==2)e.armadilloPeekStart=undefined;
 if(state===1)e.armadilloRollUpStart??=e.ticks;
 if(state===3)e.armadilloRollOutStart??=e.ticks;
 if(state===2){if(e.armadilloPeekReceived){e.armadilloPeekStart=undefined;e.armadilloPeekReceived=false;}if(elapsed===0)e.armadilloPeekStart=e.ticks-50;else e.armadilloPeekStart??=e.ticks;}
 e.armadilloStateTicks=elapsed+1;
}

// Wolf.tick (client): the begging head tilt eases by 0.4 per tick; a wet wolf (in water, rain or a bubble column)
// shakes once the server starts it (entity event 8, cancelled by 56): shakeAnim climbs 0.05 per tick to 2, with
// splash particles from 0.4
const f32 = Math.fround;
export function tickWolf766(e, wetNow, splash) {
  if (e.health !== undefined && e.health <= 0) return;
  const ia = e.interestedAngle || 0;
  e.interestedAngleO = ia;
  e.interestedAngle = f32(ia + f32(f32((e.begging ? 1 : 0) - ia) * f32(0.4)));
  if (wetNow) { e.isWet = true; return; }
  if (!e.shaking) return;
  if (e.shakeAnim === 0 || e.shakeAnim === undefined) e.shakeAnim = 0;
  e.shakeAnimO = e.shakeAnim;
  e.shakeAnim = f32(e.shakeAnim + f32(0.05));
  if (e.shakeAnimO >= 2) { e.isWet = false; e.shaking = false; e.shakeAnimO = 0; e.shakeAnim = 0; return; }
  if (e.shakeAnim > 0.4 && splash) {
    const n = Math.trunc(Math.sin(f32(f32(e.shakeAnim - 0.4) * f32(Math.PI))) * 7);
    for (let i = 0; i < n; i++) splash((Math.random() * 2 - 1) * (e.width || 0.6) * 0.5, (Math.random() * 2 - 1) * (e.width || 0.6) * 0.5);
  }
}
export function wolfEvent766(e, status) {
  if (status === 8) { e.shaking = true; e.shakeAnim = 0; e.shakeAnimO = 0; return true; }
  if (status === 56) { e.shaking = false; e.shakeAnim = 0; e.shakeAnimO = 0; return true; } // cancelShake
  return false;
}
const lerp = (p, a, b) => a + p * (b - a);
// getHeadRollAngle / getBodyRollAngle / getWetShade
export function wolfHeadRoll766(e, p) { return f32(lerp(p, e.interestedAngleO || 0, e.interestedAngle || 0) * f32(0.15) * f32(Math.PI)); }
export function wolfBodyRoll766(e, p, offset) {
  let t = f32((lerp(p, e.shakeAnimO || 0, e.shakeAnim || 0) + offset) / f32(1.8));
  t = Math.min(1, Math.max(0, t));
  return f32(Math.sin(f32(t * f32(Math.PI))) * Math.sin(f32(t * f32(Math.PI) * 11)) * f32(0.15) * f32(Math.PI));
}
export function wolfWetShade766(e, p) { return e.isWet ? Math.min(f32(0.75 + lerp(p, e.shakeAnimO || 0, e.shakeAnim || 0) / 2 * 0.25), 1) : 1; }
