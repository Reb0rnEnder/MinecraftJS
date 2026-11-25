// 26.3 Brigadier command tree. Two native changes over 1.20.6:
//   1. argument types travel as a registry id into minecraft:command_argument_type, not a name string;
//   2. each argument node carries its type-specific properties from ArgumentTypeInfo.deserializeFromNetwork,
//      and a new restricted flag exists (FLAG_RESTRICTED = 32).
// The id order below is the protocol_id order from the native registries report, not a guess.
import {readCommandTree} from './command-tree.js';

export const COMMAND_ARGUMENT_TYPES_26_3=Object.freeze([
  'brigadier:bool','brigadier:float','brigadier:double','brigadier:integer','brigadier:long','brigadier:string',
  'minecraft:entity','minecraft:game_profile','minecraft:block_pos','minecraft:column_pos','minecraft:vec3','minecraft:vec2',
  'minecraft:block_state','minecraft:block_predicate','minecraft:item_stack','minecraft:item_predicate','minecraft:team_color','minecraft:hex_color',
  'minecraft:component','minecraft:style','minecraft:message','minecraft:nbt_compound_tag','minecraft:nbt_tag','minecraft:nbt_path',
  'minecraft:objective','minecraft:objective_criteria','minecraft:operation','minecraft:particle','minecraft:angle','minecraft:rotation',
  'minecraft:scoreboard_slot','minecraft:score_holder','minecraft:swizzle','minecraft:team','minecraft:item_slot','minecraft:item_slots',
  'minecraft:resource_location','minecraft:function','minecraft:entity_anchor','minecraft:int_range','minecraft:float_range','minecraft:dimension',
  'minecraft:gamemode','minecraft:time','minecraft:resource_or_tag','minecraft:resource_or_tag_key','minecraft:resource','minecraft:resource_key',
  'minecraft:resource_selector','minecraft:template_mirror','minecraft:template_rotation','minecraft:heightmap','minecraft:loot_table','minecraft:loot_predicate',
  'minecraft:loot_modifier','minecraft:context_float_provider','minecraft:context_int_provider','minecraft:slot_source','minecraft:dialog','minecraft:feature',
  'minecraft:swing_animation','minecraft:uuid'
]);

const BOUNDED={'brigadier:float':'f32','brigadier:double':'f64','brigadier:integer':'i32','brigadier:long':'i64'};
const REGISTRY_TYPED=new Set(['minecraft:resource','minecraft:resource_key','minecraft:resource_or_tag','minecraft:resource_or_tag_key','minecraft:resource_selector']);

function readProperties(reader,name){
  if(BOUNDED[name]){
    const bounds=reader.u8(),properties={};
    if(bounds&1)properties.min=reader[BOUNDED[name]]();
    if(bounds&2)properties.max=reader[BOUNDED[name]]();
    return properties;
  }
  if(name==='brigadier:string')return {mode:reader.varint()};
  if(name==='minecraft:entity'||name==='minecraft:score_holder')return {flags:reader.u8()};
  if(name==='minecraft:time')return {min:reader.i32()};
  if(REGISTRY_TYPED.has(name))return {registry:reader.string()};
  return {};
}

export function readCommands26_3(reader){
  const count=reader.varint();
  if(count<0||count>1048576||count>reader.remaining())throw Error('Invalid 26.3 command count');
  const nodes=[];
  for(let i=0;i<count;i++){
    const flags=reader.u8();
    const type=flags&3;
    const childCount=reader.varint();
    if(childCount<0||childCount>count)throw Error('Invalid 26.3 command child count');
    const children=[];
    for(let j=0;j<childCount;j++)children.push(reader.varint());
    const node={type,children,executable:!!(flags&4),restricted:!!(flags&32)};
    if(flags&8)node.redirect=reader.varint();
    if(type===1)node.name=reader.string();
    if(type===2){
      node.name=reader.string();
      const argumentId=reader.varint();
      const parser=COMMAND_ARGUMENT_TYPES_26_3[argumentId];
      if(!parser)throw Error('Unknown 26.3 argument type id '+argumentId);
      node.parser=parser;
      node.properties=readProperties(reader,parser);
      if(flags&16)node.suggestions=reader.string();
    }
    if(type===3)throw Error('Invalid 26.3 command node type');
    nodes.push(node);
  }
  const root=reader.varint();
  if(!nodes[root])throw Error('Invalid 26.3 command root');
  for(const node of nodes){
    if(node.children.some(id=>!nodes[id]))throw Error('Invalid 26.3 command child reference');
    if(node.redirect!==undefined&&!nodes[node.redirect])throw Error('Invalid 26.3 command redirect reference');
  }
  return {nodes,root};
}

export {readCommandTree};
