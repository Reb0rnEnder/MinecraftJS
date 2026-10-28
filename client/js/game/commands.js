import {PROTOCOL_VERSION} from '../net/packets.js';
import {parseSnbt} from '../net/snbt.js';
// Client-side parsing of the server's Brigadier tree. Execution and permission checks stay on the server.
const COLORS=['§b','§e','§a','§d','§6'];
const COLOR_NAMES=['black','dark_blue','dark_green','dark_aqua','dark_red','dark_purple','gold','gray','dark_gray','blue','green','aqua','red','light_purple','yellow','white'];
const normalize=s=>s.includes(':')?s:'minecraft:'+s;
const matches=(value,prefix)=>value.toLowerCase().startsWith(prefix.toLowerCase())||value.toLowerCase().includes('_'+prefix.toLowerCase());
export function playerSuggestions(game,text,cursor=text.length) {
  const prefix=text.slice(0,cursor),start=prefix.search(/\S+$/),range=start<0?cursor:start,word=prefix.slice(range);
  const names=[...(game.scoreboard?.players?.values()||[])].map(p=>p.name).filter(Boolean);
  return {start:range,end:cursor,matches:[...new Set(names)].filter(n=>matches(n,word)).sort((a,b)=>a.toLowerCase().localeCompare(b.toLowerCase())).map(match=>({match}))};
}
function fail(start,key='command.unknown.argument',args=[]) { return {end:start,error:{start,key,args}}; }
function word(text,start) {let end=start;while(end<text.length&&!/\s/.test(text[end]))end++;return {value:text.slice(start,end),end};}
// Quoted strings, selectors, JSON/SNBT and block-state properties can contain whitespace inside delimiters.
function balanced(text,start) {
  const stack=[];let quote=null,escaped=false,end=start;
  for(;end<text.length;end++) {
    const c=text[end];
    if(quote){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c===quote)quote=null;continue;}
    if(c==='"'||c==="'"){quote=c;continue;}
    if(c==='['||c==='{')stack.push(c==='['?']':'}');
    else if(c===']'||c==='}') {if(stack.pop()!==c)return fail(start,'parsing.expected',[stack.at(-1)||'end']);}
    else if(/\s/.test(c)&&!stack.length)break;
  }
  if(quote||stack.length)return fail(start,'parsing.expected',[quote||stack.at(-1)]);
  return {end,value:text.slice(start,end)};
}
function nativeSnbt(value){
 if(PROTOCOL_VERSION<477){let quoted=false,escaped=false;for(const c of value){if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}else if(c==='"')quoted=true;else if(c==="'")throw Error('Single quotes require 1.14 SNBT');}}
 return parseSnbt(value);
}
function splitOptions(value){
 const out=[];let start=0,depth=0,quote=null,escape=false;
 for(let i=0;i<value.length;i++){
  const c=value[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}
  if(c==='"'||c==="'"){quote=c;continue;}if(c==='{'||c==='[')depth++;else if(c==='}'||c===']')depth--;
  else if(c===','&&!depth){out.push(value.slice(start,i));start=i+1;}
 }out.push(value.slice(start));return out;
}
function selectorOptions(value){
 const raw=value.includes('[')?value.slice(value.indexOf('[')+1,-1):'',options={};
 for(const part of splitOptions(raw)){
  if(!part.trim())continue;
  const at=part.indexOf('='),key=part.slice(0,at).trim(),v=part.slice(at+1).trim();
  if(key==='predicate'&&PROTOCOL_VERSION<573)return null;
  if(at<0||!['x','y','z','dx','dy','dz','distance','x_rotation','y_rotation','limit','sort','level','gamemode','name','team','type','tag','nbt','scores','advancements','predicate'].includes(key)||!v)return null;
  if(options[key]&&!['tag','nbt','predicate'].includes(key)&&!(['name','team','type','gamemode'].includes(key)&&options[key].every(p=>p.startsWith('!'))))return null;
  if(key==='limit'&&(!/^\d+$/.test(v)||Number(v)<1||Number(v)>2147483647))return null;
  if(key==='sort'&&!['nearest','furthest','random','arbitrary'].includes(v))return null;
  if(key==='gamemode'&&!['survival','creative','adventure','spectator'].includes(v.replace(/^!/,'')))return null;
  if(['x','y','z','dx','dy','dz'].includes(key)&&!numeric(v))return null;
  if(['distance','level','x_rotation','y_rotation'].includes(key)){
   const range=v.split('..');if(range.length>2||range.every(n=>!n)||range.some(n=>n&&!numeric(n,key==='level'))||range.length===2&&range.every(Boolean)&&Number(range[0])>Number(range[1]))return null;
   if(['distance','level'].includes(key)&&range.some(n=>n&&Number(n)<0))return null;
  }
  (options[key]||=[]).push(v);
 }return options;
}
const numeric=(value,integer=false)=>integer?/^-?\d+$/.test(value):/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value);
export class CommandTree {
  constructor(packet,game) { this.nodes=packet.nodes;this.root=packet.root;this.game=game; }
  registry(kind) {
    const data=this.game.assets?.data?.[kind];
    if(kind==='effects')return ['speed','slowness','haste','mining_fatigue','strength','instant_health','instant_damage','jump_boost','nausea','regeneration','resistance','fire_resistance','water_breathing','invisibility','blindness','night_vision','hunger','weakness','poison','wither','health_boost','absorption','saturation','glowing','levitation','luck','unluck','slow_falling','conduit_power','dolphins_grace'].map(normalize);
    return Array.isArray(data)?data.map(d=>d.name).filter(Boolean).map(normalize):[];
  }
  argument(node,text,start) {
    const parser=node.parser,p=node.properties||{};
    if(parser==='minecraft:message'||parser==='brigadier:string'&&p.mode===2)return start<text.length?{end:text.length}:fail(start);
    const token=balanced(text,start);
    if(token.error)return token;
    let {value,end}=token;
    if(!value)return fail(start);
    if(parser==='brigadier:string') {
      if(p.mode===2)return {end:text.length};
      if(p.mode===0&&!/^[0-9A-Za-z_+.-]+$/.test(value))return fail(start);
      if(p.mode===1){if(value.startsWith('"')){try{JSON.parse(value);}catch{return fail(start,'parsing.quote.expected.end');}}else if(!/^[0-9A-Za-z_+.-]+$/.test(value))return fail(start);}
      return {end};
    }
    if(['minecraft:nbt','minecraft:nbt_compound_tag','minecraft:nbt_tag'].includes(parser)){
      try{const tag=nativeSnbt(value);if(parser!=='minecraft:nbt_tag'&&tag.t!==10)return fail(start);}catch{return fail(start,'argument.nbt.invalid');}
    }
    if(parser==='minecraft:time'){
      const match=value.match(/^(-?(?:\d+(?:\.\d*)?|\.\d+))([dst]?)$/);
      if(!match)return fail(start,'argument.time.invalid_unit');
      const ticks=Math.round(Number(match[1])*({d:24000,s:20,t:1,'':1}[match[2]]));
      if(ticks<0)return fail(start,'argument.time.invalid_tick_count',[ticks]);
    }
    if(parser==='minecraft:component'){try{if(JSON.parse(value)===null)return fail(start);}catch{return fail(start,'argument.component.invalid',[value]);}}
    if(['brigadier:integer','brigadier:float','brigadier:double'].includes(parser)) {
      const integer=parser==='brigadier:integer',type=integer?'int':parser.slice(10),number=Number(value);
      if(!numeric(value,integer)||!Number.isFinite(number))return fail(start,'parsing.'+type+'.invalid',[value]);
      const min=p.min??(integer?-2147483648:-Infinity),max=p.max??(integer?2147483647:Infinity),key=integer?'integer':type;
      if(number<min)return fail(start,'argument.'+key+'.low',[min,number]);
      if(number>max)return fail(start,'argument.'+key+'.big',[max,number]);
      return {end};
    }
    if(parser==='brigadier:bool')return ['true','false'].includes(value)?{end}:fail(start,'parsing.bool.invalid',[value]);
    const count={'minecraft:block_pos':3,'minecraft:vec3':3,'minecraft:column_pos':2,'minecraft:vec2':2,'minecraft:rotation':2}[parser];
    if(count) {
      const local=value.startsWith('^');
      for(let i=0;i<count;i++) {
        if(i){if(end>=text.length||text[end]!==' ')return fail(start,'argument.pos'+count+'d.incomplete');while(text[end]===' ')end++;token.end=end;({value,end}=word(text,end));}
        const relative=/^[~^]/.test(value),n=relative?value.slice(1):value;
        if((value.startsWith('^')!==local)||(local&&parser!=='minecraft:vec3'&&parser!=='minecraft:block_pos')||n!==''&&!numeric(n,parser==='minecraft:block_pos'&&!relative))return fail(start,'argument.pos.mixed');
        if(!relative&&!n)return fail(start);
        if(parser==='minecraft:block_pos'&&!relative&&(Number(n)<-2147483648||Number(n)>2147483647))return fail(start);
      }
      return {end};
    }
    if(parser==='minecraft:entity'||parser==='minecraft:game_profile'||parser==='minecraft:score_holder') {
      if(value.startsWith('@')){
        if(!/^@[pares](?:\[.*\])?$/.test(value))return fail(start,'argument.entity.selector.unknown',[value.slice(0,2)]);
        const options=selectorOptions(value);if(!options)return fail(start,'argument.entity.options.invalid');
        const limit=Number(options.limit?.[0]??(/^@[ae]/.test(value)?Infinity:1));
        if(parser==='minecraft:entity'&&(p.flags&1)&&limit>1)return fail(start,'argument.entity.toomany');
        if(parser==='minecraft:entity'&&(p.flags&2)&&/^@e/.test(value)&&!['player','minecraft:player'].includes(options.type?.[0]))return fail(start,'argument.player.entities');
      } else if(!(parser==='minecraft:score_holder'&&value==='*')&&!/^[0-9A-Za-z_+.-]+$/.test(value))return fail(start);
      return {end};
    }
    if(parser==='minecraft:int_range'||parser==='minecraft:float_range') {
      const pieces=value.split('..'),integer=parser==='minecraft:int_range';
      if(pieces.length>2||pieces.every(s=>!s)||pieces.some(s=>s&&!numeric(s,integer))||pieces.length===2&&pieces.every(Boolean)&&Number(pieces[0])>Number(pieces[1]))return fail(start,'command.unknown.argument');
    }
    const choices={
      'minecraft:color':COLOR_NAMES,'minecraft:entity_anchor':['eyes','feet'],
      'minecraft:operation':['=','+=','-=','*=','/=','%=','<','>','><'],
      'minecraft:scoreboard_slot':['list','sidebar','belowName',...COLOR_NAMES.map(n=>'sidebar.team.'+n)],
    }[parser];
    if(choices&&!choices.includes(value))return fail(start,{'minecraft:color':'argument.color.invalid','minecraft:entity_anchor':'argument.anchor.invalid','minecraft:operation':'arguments.operation.invalid','minecraft:scoreboard_slot':'argument.scoreboardDisplaySlot.invalid'}[parser],[value]);
    if(parser==='minecraft:item_slot'){
      const fixed=['weapon','weapon.mainhand','weapon.offhand','armor.head','armor.chest','armor.legs','armor.feet','horse.saddle','horse.armor','horse.chest'];
      const match=value.match(/^(container|hotbar|inventory|enderchest|villager|horse)\.(\d+)$/),sizes={container:54,hotbar:9,inventory:27,enderchest:27,villager:8,horse:15};
      if(!fixed.includes(value)&&(!match||Number(match[2])>=sizes[match[1]]))return fail(start,'slot.unknown',[value]);
    }
    if(parser==='minecraft:objective_criteria'){
      const names=['dummy','trigger','deathCount','playerKillCount','totalKillCount','health','food','air','armor','xp','level',...COLOR_NAMES.flatMap(c=>['teamkill.'+c,'killedByTeam.'+c])];
      if(!names.includes(value)&&!/^minecraft\.(?:mined|crafted|used|broken|picked_up|dropped|killed|killed_by|custom):[a-z0-9_.]+(?:\.[a-z0-9_]+)+$/.test(value))return fail(start,'argument.criteria.invalid',[value]);
    }
    if(parser==='minecraft:nbt_path'){
      let quote=null;
      for(let i=0;i<value.length;i++){
        if(quote){if(value[i]==='\\')i++;else if(value[i]===quote)quote=null;continue;}
        if(value[i]==='"'||value[i]==="'"){quote=value[i];continue;}
        if(value[i]==='['){let end=i+1,depth=1,q=null;
          for(;end<value.length;end++){const c=value[end];if(q){if(c==='\\')end++;else if(c===q)q=null;}else if(c==='"'||c==="'")q=c;else if(c==='[')depth++;else if(c===']'&&!--depth)break;}
          const part=value.slice(i+1,end).trim();
          if(PROTOCOL_VERSION<477&&!/^-?\d+$/.test(part))return fail(start);
          if(/^-?\d+$/.test(part)&&(Number(part)<-2147483648||Number(part)>2147483647))return fail(start);
          if(part&&!/^-?\d+$/.test(part)){try{if(nativeSnbt(part).t!==10)return fail(start);}catch{return fail(start);}}
          i=end;
        }
      }
    }
    if(parser==='minecraft:swizzle'&&(!/^[xyz]+$/.test(value)||new Set(value).size!==value.length))return fail(start,'arguments.swizzle.invalid');
    const kind={ 'minecraft:block_state':'blocks','minecraft:block_predicate':'blocks','minecraft:item_stack':'items','minecraft:item_predicate':'items','minecraft:entity_summon':'entities','minecraft:mob_effect':'effects','minecraft:item_enchantment':'enchantments'}[parser];
    if(kind) {
      const nbt=value.indexOf('{');if(nbt>=0){try{if(nativeSnbt(value.slice(nbt)).t!==10)return fail(start);}catch{return fail(start);}}

      const id=value.split(/[\[{]/,1)[0],tag=id.startsWith('#'),name=normalize(tag?id.slice(1):id),registry=this.registry(kind);
      if(!/^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$/.test(tag?id.slice(1):id))return fail(start);
      if(tag){if(!parser.endsWith('_predicate')||!this.game.tags?.names(kind).includes(name))return fail(start,'arguments.block.tag.unknown',[name]);}
      else if(registry.length&&!registry.includes(name))return fail(start,({'blocks':'argument.block.id.invalid','items':'argument.item.id.invalid','effects':'effect.effectNotFound','enchantments':'enchantment.unknown','entities':'entity.notFound'})[kind],[name]);
      if(kind==='blocks'&&value.includes('[')&&!tag){
        const def=this.game.assets.data.blocks.find(b=>normalize(b.name)===name),properties=value.slice(value.indexOf('[')+1,value.indexOf(']'));
        const seen=new Set();for(const pair of properties?properties.split(','):[]){const [key,v]=pair.split('='),property=def?.states?.find(p=>p.name===key);
          if(!property)return fail(start,'argument.block.property.unknown',[name,key]);
          if(seen.has(key))return fail(start,'argument.block.property.duplicate',[key,name]);seen.add(key);
          const allowed=property.type==='bool'?['true','false']:property.values||Array.from({length:property.num_values},(_,i)=>String(i));
          if(!allowed.includes(v))return fail(start,'argument.block.property.invalid',[name,v,key]);
        }
      }
    }
    if(parser==='minecraft:resource_location'||parser==='minecraft:dimension'||parser==='minecraft:function') {
      const id=value.startsWith('#')?value.slice(1):value;if(!/^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$/.test(id))return fail(start);
    }
    if(parser==='minecraft:particle') {
      const id=normalize(value),particles=this.registry('particles');
      if(particles.length&&!particles.includes(id))return fail(start,'particle.notFound',[id]);
      const extra=id==='minecraft:dust'?['brigadier:float','brigadier:float','brigadier:float','brigadier:float']:['minecraft:block','minecraft:falling_dust'].includes(id)?['minecraft:block_state']:id==='minecraft:item'?['minecraft:item_stack']:[];
      for(const parser of extra){if(text[end]!==' ')return fail(start);while(text[end]===' ')end++;const part=this.argument({parser},text,end);if(part.error)return part;end=part.end;}
    }
    return {end};
  }
  parse(text,slash=true) {
    const start=slash&&text.startsWith('/')?1:0,limit=4000;let attempts=0;
    const visit=(id,pos,spans,edges,depth,color=spans.length)=>{
      if(++attempts>limit||depth>128)return {cursor:pos,spans,edges,node:id,incomplete:true};
      const node=this.nodes[id];if(!node)return {cursor:pos,spans,edges,node:this.root};
      const target=node.redirect===undefined?id:node.redirect,children=this.nodes[target]?.children||[];
      const context={node:target,start:pos};
      if(pos===text.length)return {cursor:pos,spans,edges,node:target,incomplete:!node.executable,completion:context};
      const literal=children.find(i=>this.nodes[i]?.type===1&&word(text,pos).value===this.nodes[i].name);
      const choices=literal===undefined?children.filter(i=>this.nodes[i]?.type===2):[literal];
      let best={cursor:pos,spans,edges,node:target,error:{start:pos,key:target===this.root?'command.unknown.command':'command.unknown.argument',args:[]},completion:context};
      const potentials=[];
      for(const childId of choices) {
        const child=this.nodes[childId],part=child.type===1?{end:pos+child.name.length}:this.argument(child,text,pos);
        if(part.error){if(part.error.key!=='command.unknown.argument')best={...best,error:part.error};continue;}
        const nextSpans=child.type===2?[...spans,{start:pos,end:part.end,color:COLORS[color%COLORS.length]}]:spans;
        const nextEdges=[...edges,{parent:target,start:pos,end:part.end,node:childId}];
        if(part.end<text.length&&text[part.end]!==' ')continue;
        const remaining=text.length-part.end;
        if(remaining>=(child.redirect===undefined?2:1)){
          potentials.push(visit(childId,part.end+1,nextSpans,nextEdges,depth+1,child.redirect!==undefined?0:color+(child.type===2?1:0)));
        } else {
          const candidate={cursor:part.end,spans:nextSpans,edges:nextEdges,node:childId,incomplete:!child.executable,hasExceptions:false};
          if(remaining)Object.assign(candidate,{error:{start:part.end,key:'command.unknown.argument',args:[]},completion:{node:childId,start:part.end+1}});
          potentials.push(candidate);
        }
      }
      // Brigadier compares consumed input, then empty exception maps, and keeps
      // insertion order for ties. It does not choose the furthest failed branch.
      potentials.sort((a,b)=>(a.cursor<text.length)-(b.cursor<text.length)||(!!a.hasExceptions)-(!!b.hasExceptions));
      return potentials[0]||{...best,hasExceptions:true};
    };
    const result=visit(this.root,start,[],[],0,0);
    if(result.error)result.cursor=result.error.start;
    if(!text.endsWith(' ')&&!result.error&&result.edges?.length){const edge=result.edges.at(-1);result.completion={node:edge.parent,start:edge.start};}
    return result;
  }
  format(text,offset=0,full=text,slash=true) {
    if(slash&&!full.startsWith('/'))return text;
    const parse=this.parse(full,slash),events=[];
    for(const span of parse.spans){events.push([span.start,span.color]);events.push([span.end,'§7']);}
    if(parse.error)events.push([parse.error.start,'§c']);events.sort((a,b)=>a[0]-b[0]);
    let color='§7',out='',pos=offset;
    for(const [at,next] of events){if(at<=offset){color=next;continue;}if(at>=offset+text.length)break;out+=(out?'':color)+text.slice(pos-offset,at-offset)+next;pos=at;}
    return (out||color)+text.slice(pos-offset);
  }
  suggestions(text,cursor=text.length,slash=true) {
    const prefix=text.slice(0,cursor),parsed=this.parse(prefix,slash),context=parsed.completion||{node:parsed.node,start:cursor},word=prefix.slice(context.start),names=[];
    let askServer=false;
    for(const id of this.nodes[context.node]?.children||[]) {
      const node=this.nodes[id];if(node.type===1){names.push(node.name);continue;}
      if(node.suggestions){if(node.suggestions==='minecraft:ask_server')askServer=true;else if(node.suggestions==='minecraft:available_sounds')names.push(...this.game.assets.data.sounds.map(s=>normalize(s.name)));else if(node.suggestions==='minecraft:summonable_entities')names.push(...this.registry('entities'));else askServer=true;continue;}
      const parser=node.parser;
      if(parser==='brigadier:bool')names.push('true','false');
      if(['minecraft:entity','minecraft:game_profile','minecraft:score_holder'].includes(parser)) {
        names.push(...[...(this.game.scoreboard?.players?.values()||[])].map(p=>p.name).filter(Boolean));
        if(parser==='minecraft:entity'||parser==='minecraft:game_profile')names.push('@p','@a','@r','@s',...((node.properties?.flags&2)?[]:['@e']));
      }
      if(parser==='minecraft:color')names.push(...COLOR_NAMES);
      if(parser==='minecraft:entity_anchor')names.push('eyes','feet');
      if(parser==='minecraft:dimension')names.push('minecraft:overworld','minecraft:the_nether','minecraft:the_end');
      const kind={'minecraft:block_state':'blocks','minecraft:block_predicate':'blocks','minecraft:item_stack':'items','minecraft:item_predicate':'items','minecraft:mob_effect':'effects','minecraft:item_enchantment':'enchantments','minecraft:entity_summon':'entities'}[parser];
      if(kind==='blocks'&&word.includes('[')) {
        const bracket=word.indexOf('['),def=this.game.assets.data.blocks.find(b=>normalize(b.name)===normalize(word.slice(0,bracket)));
        if(def&&!word.includes(']')) {
          const partial=word.slice(bracket+1),last=partial.lastIndexOf(',')+1,pair=partial.slice(last),equal=pair.indexOf('=');
          const used=new Set(partial.slice(0,last).split(',').map(s=>s.split('=')[0]));let values,start;
          if(equal<0){values=(def.states||[]).filter(p=>!used.has(p.name)).map(p=>p.name+'=');start=context.start+bracket+1+last;}
          else {const prop=def.states?.find(p=>p.name===pair.slice(0,equal));values=prop?(prop.type==='bool'?['true','false']:prop.values||Array.from({length:prop.num_values},(_,i)=>String(i))):[];start=context.start+bracket+1+last+equal+1;}
          return {start,end:cursor,matches:values.filter(v=>matches(v,prefix.slice(start))).sort().map(match=>({match})),askServer:false,parsed};
        }
      }
      if(kind){names.push(...this.registry(kind));if(parser.endsWith('_predicate'))names.push(...(this.game.tags?.names(kind)||[]).map(n=>'#'+n));}
      if(parser==='minecraft:team')names.push(...(this.game.scoreboard?.teams?.keys()||[]));
      if(parser==='minecraft:objective')names.push(...(this.game.scoreboard?.objectives?.keys()||[]));
      if(parser==='minecraft:resource_location'||parser==='minecraft:function')askServer=true;
    }
    const filtered=[...new Set(names)].filter(Boolean).filter(n=>matches(n,word)||n.startsWith('minecraft:')&&matches(n.slice(10),word));
    filtered.sort((a,b)=>a.toLowerCase()<b.toLowerCase()?-1:a.toLowerCase()>b.toLowerCase()?1:0);
    return {start:context.start,end:cursor,matches:filtered.map(match=>({match})),askServer,parsed};
  }
}
