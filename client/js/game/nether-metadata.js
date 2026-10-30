import {NATIVE_METADATA} from './entity-metadata-1.18.2.js';
import {ENTITIES_BY_NAME} from './entity-types.js';
const NETHER_MOBS=new Set(['axolotl','goat','glow_squid','hoglin','zoglin','piglin','piglin_brute','zombified_piglin','strider']);
export function applyNetherMetadata(e,wire){
 if(!NETHER_MOBS.has(e.entityName))return;
 const ids=NATIVE_METADATA[e.entityName],get=field=>wire[ids[field]];
 if(get('DATA_BABY_ID')!==undefined){
  e.child=!!get('DATA_BABY_ID');const def=ENTITIES_BY_NAME[e.entityName],scale=e.child?.5:1;
  e.width=def.width*scale;e.height=def.height*scale;e.eyeHeight=def.eyeHeight*scale;
 }
 if(e.entityName === 'goat') {
  const def = ENTITIES_BY_NAME.goat, scale = e.child ? .5 : 1, poseScale = Math.fround(e.pose === 6 ? .7 : 1);
  e.width = Math.fround(Math.fround(def.width * poseScale) * scale);
  e.height = Math.fround(Math.fround(def.height * poseScale) * scale);
  e.eyeHeight = def.eyeHeight * poseScale * scale;
 }
 if(get('DATA_MOB_FLAGS_ID')!==undefined){const flags=get('DATA_MOB_FLAGS_ID');e.aggressive=!!(flags&4);e.leftHanded=!!(flags&2);}
 for(const [field,key]of[['DATA_VARIANT','axolotlVariant'],['DATA_PLAYING_DEAD','playingDead'],['DATA_IS_SCREAMING_GOAT','screamingGoat'],['DATA_DARK_TICKS_REMAINING','darkTicks'],['DATA_IS_DANCING','dancing'],['DATA_IS_CHARGING_CROSSBOW','crossbowCharging'],['DATA_SUFFOCATING','striderCold'],['DATA_SADDLE_ID','saddled'],['DATA_BOOST_TIME','boostDuration'],['DATA_IMMUNE_TO_ZOMBIFICATION','immuneToZombification']]){
  const value=get(field);if(value!==undefined){e[key]=value;if(key==='boostDuration'){e.boostTicks=0;e.boosting=value>0;}}
 }
}
