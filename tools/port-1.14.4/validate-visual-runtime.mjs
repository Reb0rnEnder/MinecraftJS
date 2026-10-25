import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {initBlocks} from '../../client/js/world/blocks.js';
import {setJarModels} from '../../client/js/render/entity-models.js';
import {EntityRenderer} from '../../client/js/render/entity-renderer.js';
import {ENTITY_TYPES,MOB_FAMILIES} from '../../client/js/game/entity-types.js';
import {villagerLayers} from '../../client/js/render/villager-layers.js';
const read=name=>JSON.parse(readFileSync(new URL('../../client/data/'+name+'.json',import.meta.url)));
const NON_LIVING=new Set('area_effect_cloud armor_stand arrow boat dragon_fireball end_crystal evoker_fangs experience_orb eye_of_ender falling_block firework_rocket item item_frame fireball leash_knot llama_spit minecart chest_minecart command_block_minecart furnace_minecart hopper_minecart spawner_minecart tnt_minecart painting tnt shulker_bullet small_fireball snowball spectral_arrow egg ender_pearl experience_bottle potion trident wither_skull lightning_bolt player fishing_bobber'.split(' '));
export function validateVisualRuntime(jar,models,shapes=read('blockCollisionShapes')){
 const hash=createHash('sha1').update(jar.data).digest('hex'),definitions=read('blocks'),count=Math.max(...definitions.map(b=>b.maxStateId))+1;
 const props=shapes.render;
 if(props?.source?.clientJarSha1!==hash||props.states.length!==count)throw Error('Native rendering table is missing/stale: regenerate runtime data from this jar');
 for(let state=0;state<count;state++){
  const p=props.values[props.states[state]];
  if(!p||typeof p.solid!=='boolean'||typeof p.viewBlocking!=='boolean'||!Number.isInteger(p.renderType)||typeof p.collisionFull!=='boolean'||typeof p.occludes!=='boolean'||!Number.isFinite(p.shade)||!Number.isInteger(p.lightBlock)||!Number.isInteger(p.emission)||!Array.isArray(p.occlusion))throw Error('Invalid native rendering properties for state '+state);
 }
 initBlocks(definitions,shapes);setJarModels(models);
 const renderer=Object.create(EntityRenderer.prototype),tested=new Set();
 const texture=path=>{if(!jar.read('assets/minecraft/textures/'+path))throw Error('Entity texture is absent from this jar: '+path);tested.add(path);};
 let mobs=0;
 for(const entry of ENTITY_TYPES){
  if(!entry.mob){if(!NON_LIVING.has(entry.name))throw Error('Entity needs a living/object renderer classification: '+entry.name);continue;}
  const e={kind:'mob',entityName:entry.name,type:MOB_FAMILIES[entry.name]?.[0]||entry.name,...MOB_FAMILIES[entry.name]?.[1]};
  mobs++;if(e.type===63){texture('entity/enderdragon/dragon.png');continue;}
  texture(renderer._texFor(e));

  const model=renderer._modelFor(e);if(!model)throw Error('Missing living entity adapter: '+entry.name);
  model.animate(model,{age:0,yaw:0,pitch:0,ls:0,lsa:0,swing:0,peek:0,squish:0,onGround:true,inWater:false,entityId:1});
  const seen=new Set();const visit=part=>{
   if(!part||!Array.isArray(part.boxes))throw Error('Missing model part for '+entry.name);
   if(seen.has(part))return;seen.add(part);
   for(const key of ['px','py','pz','rx','ry','rz'])if(!Number.isFinite(part[key]))throw Error('Invalid model pose '+entry.name+'.'+key);
   for(const child of part.children)visit(child);
  };model.roots.forEach(visit);
 }
 for(const villagerZombie of [false,true])for(let type=0;type<7;type++)for(let profession=0;profession<15;profession++)for(let level=1;level<=5;level++)for(const layer of villagerLayers({villagerZombie,villagerType:type,profession,villagerLevel:level}))texture(layer.texture);
 return {states:count,mobs,textures:tested.size};
}
