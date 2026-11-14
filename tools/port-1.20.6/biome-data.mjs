import {KNOWN_PACK_766} from '../../client/js/net/known-pack-1.20.6.js';
import {simplify} from '../../client/js/net/nbt.js';
// The upstream table omits downfall and color overrides. Native known-pack
// values supply climate and effects; retain upstream IDs only for its name map.
export function nativeBiomeData(rows){
 const values=new Map(KNOWN_PACK_766.registries['minecraft:worldgen/biome'].map(e=>[e.key,simplify(e.value)]));
 return rows.map(row=>{
  const b=values.get('minecraft:'+row.name);if(!b)throw Error('Missing native biome '+row.name);
  return {...row,temperature:b.temperature,rainfall:b.downfall,precipitation:!b.has_precipitation?'none':b.temperature<.15?'snow':'rain',effects:b.effects};
 });
}
