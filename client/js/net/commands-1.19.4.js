import {COMMAND_PARSERS_762} from './registries-1.19.4.js';
export function readCommands762(r){
 const count=r.varint();if(count<1||count>1048576||count>r.remaining())throw Error('Invalid 762 command count');const nodes=[];
 for(let i=0;i<count;i++){
  const flags=r.u8(),type=flags&3,n=r.varint();if(type===3||n<0||n>count)throw Error('Invalid 762 command node');const children=Array.from({length:n},()=>r.varint()),node={type,children,executable:!!(flags&4)};
  if(flags&8)node.redirect=r.varint();if(type===1||type===2)node.name=r.string();
  if(type===2){const parser=COMMAND_PARSERS_762[r.varint()];if(!parser)throw Error('Unknown 762 argument parser');node.parser=parser;const props=node.properties={};
   if(['brigadier:float','brigadier:double','brigadier:integer','brigadier:long'].includes(parser)){const bounds=r.u8(),read={'brigadier:float':'f32','brigadier:double':'f64','brigadier:integer':'i32','brigadier:long':'i64'}[parser];if(bounds&1)props.min=r[read]();if(bounds&2)props.max=r[read]();}
   else if(parser==='brigadier:string')props.mode=r.varint();
   else if(parser==='minecraft:entity'||parser==='minecraft:score_holder')props.flags=r.u8();
   else if(['minecraft:resource','minecraft:resource_key','minecraft:resource_or_tag','minecraft:resource_or_tag_key'].includes(parser))props.registry=r.string();
   else if(parser==='minecraft:time')props.min=r.i32();
   if(flags&16)node.suggestions=r.string();
  }nodes.push(node);
 }
 const root=r.varint();if(!nodes[root]||nodes.some(n=>n.children.some(id=>!nodes[id])||n.redirect!==undefined&&!nodes[n.redirect]))throw Error('Invalid 762 command reference');return{nodes,root};
}
