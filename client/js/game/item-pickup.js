// ItemPickupParticle/EntityPickupFX owns a render copy, independently of the
// server entity. Collect and destroy packets commonly arrive in the same batch.
const HALF_EYE_TARGET=true;
export function pickupVisual(source,target,id){return{...source,id,pickable:false,item:source.item?{...source.item}:source.item,pickupVisual:{age:0,target,start:[source.x,source.y,source.z]}};}
export function pickupPosition(effect,player,partial){
 const fx=effect.pickupVisual,target=fx.target||player,p=Math.fround(partial),lerp=(a,b)=>a+(b-a)*p;
 let phase=Math.fround(Math.fround(fx.age+p)/3);phase=Math.fround(phase*phase);
 const eye=typeof target.eyeHeight==='function'?target.eyeHeight():(target.eyeHeight??(target.height||1.8)*.85);
 const tx=lerp(target.prevX??target.x,target.x),tz=lerp(target.prevZ??target.z,target.z);
 const ty=HALF_EYE_TARGET?lerp(target.prevY??target.y,target.y+eye/2):lerp(target.prevY??target.y,target.y)+.5;
 const [x,y,z]=fx.start;return{x:x+(tx-x)*phase,y:y+(ty-y)*phase,z:z+(tz-z)*phase};
}
export function tickPickupVisuals(manager){const alive=[];for(const e of manager.pickups||[]){if(++e.pickupVisual.age>=3)manager.game.entityRenderer.remove(e);else alive.push(e);}manager.pickups=alive;}
