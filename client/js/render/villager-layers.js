import {VILLAGER_TYPES,VILLAGER_PROFESSIONS,VILLAGER_HATS} from '../game/villager-data.js';
export function villagerLayers(entity,hats=VILLAGER_HATS){
 const dir=entity.villagerZombie?'zombie_villager':'villager';
 const type=VILLAGER_TYPES[entity.villagerType??2]||'plains',profession=VILLAGER_PROFESSIONS[entity.profession??entity.villagerProfession??0]||'none';
 const typeTexture=`entity/${dir}/type/${type}.png`,professionTexture=`entity/${dir}/profession/${profession}.png`;
 const hat=hats[professionTexture]||'none',typeHat=hats[typeTexture]||'none';
 const layers=[{texture:typeTexture,hideHat:hat==='full'||hat==='partial'&&typeHat==='full'}];
 if(profession!=='none'&&!entity.child){layers.push({texture:professionTexture});
  layers.push({texture:`entity/${dir}/profession_level/${['stone','iron','gold','emerald','diamond'][Math.max(0,Math.min(4,(entity.villagerLevel||1)-1))]}.png`});}
 return layers;
}
