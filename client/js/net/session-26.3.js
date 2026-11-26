// The join context the game expects, built from native 26.3 configuration registries.
// Nothing here is assumed: block states come from the native block report, biomes and
// dimension types from the server's registry_data payloads, tags from update_tags.
import {AIR_STATES_26_3,BLOCK_STATE_COUNT_26_3} from './blocks-26.3.js';

// Anonymous network NBT (tag id only) to plain JS. Longs stay BigInt so no precision is lost.
export function nbtToJs(node){
  if(!node)return null;
  switch(node.t){
    case 1:return node.v!==0;
    case 2:case 3:case 5:case 6:return node.v;
    case 4:return node.v;
    case 7:return Array.from(node.v);
    case 8:return node.v;
    case 9:return node.items.map(nbtToJs);
    case 10:return Object.fromEntries(Object.entries(node.v).map(([key,child])=>[key,nbtToJs(child)]));
    case 11:return Array.from(node.v);
    case 12:return Array.from(node.v,Number);
    default:throw Error('Unknown NBT tag '+node.t);
  }
}

const dimensionRegistry=configuration=>configuration.registries.get('minecraft:dimension_type')||[];

// 26.3 removed DimensionType.effects in favour of the Skybox enum plus environment attributes,
// so the ambience id the renderer keys on is taken from the dimension type's own registry key
// (the keys are the same resource locations 1.20.6 used for effects).
const effectsFor=key=>key==='minecraft:the_nether'||key==='minecraft:the_end'?key:'minecraft:overworld';

// CommonPlayerSpawnInfo.dimensionType is a holder id into minecraft:dimension_type.
export function dimensionTypes26_3(configuration){
  const types=new Map();
  for(const entry of dimensionRegistry(configuration)){
    if(!entry.value)throw Error('Dimension type '+entry.key+' arrived without its payload');
    const data=nbtToJs(entry.value);
    types.set(entry.id,{
      id:entry.id,
      key:entry.key,
      min_y:data.min_y,
      height:data.height,
      logical_height:data.logical_height,
      coordinate_scale:data.coordinate_scale,
      has_skylight:!!data.has_skylight,
      has_ceiling:!!data.has_ceiling,
      ambient_light:data.ambient_light,
      effects:effectsFor(entry.key),
      skybox:data.skybox??null,
      cardinal_light:data.cardinal_light??null,
      has_fixed_time:!!data.has_fixed_time,
      fixed_time:data.fixed_time===undefined?null:Number(data.fixed_time),
      monster_spawn_light_level:data.monster_spawn_light_level,
      monster_spawn_block_light_limit:data.monster_spawn_block_light_limit
    });
  }
  return types;
}

export function biomeEntries26_3(configuration){
  const entries=configuration.registries.get('minecraft:worldgen/biome')||[];
  return entries.map(entry=>({id:entry.id,key:entry.key}));
}

function registryTags26_3(configuration){
  const tags={};
  for(const [registry,list] of configuration.tags)tags[registry]=list.map(tag=>({name:tag.name,entries:tag.entries.slice()}));
  return tags;
}

// Fields the game reads from Play Login that 26.3 no longer carries inline.
export function loginContext26_3(configuration,login){
  const types=dimensionTypes26_3(configuration);
  const dimensionType=types.get(login.spawn.dimensionType);
  if(!dimensionType)throw Error('Play Login names unknown dimension type '+login.spawn.dimensionType);
  if(!Number.isInteger(dimensionType.min_y)||!Number.isInteger(dimensionType.height)||dimensionType.height<=0){
    throw Error('Dimension type '+dimensionType.key+' has invalid vertical bounds');
  }
  const biomes=biomeEntries26_3(configuration);
  const registryTags=registryTags26_3(configuration);
  return {
    blockStateRegistrySize:BLOCK_STATE_COUNT_26_3,
    airStates:AIR_STATES_26_3,
    biomeRegistrySize:biomes.reduce((max,biome)=>Math.max(max,biome.id+1),1),
    biomeEntries:biomes,
    dimensionTypes:types,
    dimensionData:dimensionType,
    enabledFeatures:configuration.features.slice(),
    registryTags,
    commandTags:registryTags['minecraft:command']||[]
  };
}
