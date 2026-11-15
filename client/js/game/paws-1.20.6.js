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
