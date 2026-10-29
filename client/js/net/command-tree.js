// Native Brigadier command tree. Every parser below is registered by the pinned jar's ArgumentTypes.
const SIMPLE = new Set(['brigadier:bool','minecraft:game_profile','minecraft:block_pos','minecraft:column_pos','minecraft:vec3','minecraft:vec2','minecraft:block_state','minecraft:block_predicate','minecraft:item_stack','minecraft:item_predicate','minecraft:color','minecraft:component','minecraft:message','minecraft:nbt','minecraft:nbt_path','minecraft:objective','minecraft:objective_criteria','minecraft:operation','minecraft:particle','minecraft:rotation','minecraft:scoreboard_slot','minecraft:swizzle','minecraft:team','minecraft:item_slot','minecraft:resource_location','minecraft:mob_effect','minecraft:function','minecraft:entity_anchor','minecraft:int_range','minecraft:float_range','minecraft:item_enchantment','minecraft:entity_summon','minecraft:dimension','minecraft:nbt_tag','minecraft:nbt_compound_tag','minecraft:time','minecraft:angle','minecraft:uuid']);
export function readCommandTree(r) {
  const count=r.varint(),nodes=[];
  for(let i=0;i<count;i++) {
    const flags=r.u8(),type=flags&3,n=r.varint(),children=[];
    for(let j=0;j<n;j++)children.push(r.varint());
    const node={type,children,executable:!!(flags&4)};
    if(flags&8)node.redirect=r.varint();
    if(type===1||type===2)node.name=r.string();
    if(type===2) {
      node.parser=r.string();node.properties={};
      if(['brigadier:float','brigadier:double','brigadier:integer','brigadier:long'].includes(node.parser)) {
        const bounds=r.u8(),read=node.parser==='brigadier:float'?'f32':node.parser==='brigadier:double'?'f64':node.parser==='brigadier:long'?'i64':'i32';
        if(bounds&1)node.properties.min=r[read]();if(bounds&2)node.properties.max=r[read]();
      } else if(node.parser==='brigadier:string')node.properties.mode=r.varint();
      else if(node.parser==='minecraft:entity'||node.parser==='minecraft:score_holder')node.properties.flags=r.u8();
      else if(!SIMPLE.has(node.parser))throw new Error('Unsupported command parser: '+node.parser);
      if(flags&16)node.suggestions=r.string();
    }
    nodes.push(node);
  }
  const root=r.varint();
  if(!nodes[root]||nodes.some(n=>n.children.some(id=>!nodes[id])||n.redirect!==undefined&&!nodes[n.redirect]))throw new Error('Invalid command-tree reference');
  return {nodes,root};
}
export function readTags(r) {
  const tags={};
  for(const kind of ['blocks','items','fluids']) {
    const entries=tags[kind]={},count=r.varint();
    for(let i=0;i<count;i++){const name=r.string(),n=r.varint(),ids=[];for(let j=0;j<n;j++)ids.push(r.varint());entries[name]=ids;}
  }
  return tags;
}
