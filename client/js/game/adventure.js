import {getBlock,getStateProperties} from '../world/blocks.js';
import {parseSnbt} from '../net/snbt.js';

const normalize=id=>id.startsWith(':')?'minecraft'+id:id.includes(':')?id:'minecraft:'+id;
const blockName=b=>normalize(b.name);

// NbtUtils.compareNbt(..., true): compound subsets and unordered list subsets,
// with exact numeric tag types. Empty lists only match empty lists.
export function matchesAdventureNbt(expected,actual){
  if(expected===null)return true;
  if(!actual||expected.t!==actual.t)return false;
  if(expected.t===10)return Object.entries(expected.v).every(([key,value])=>Object.hasOwn(actual.v,key)&&matchesAdventureNbt(value,actual.v[key]));
  if(expected.t===9){
    const a=expected.v,b=actual.v;
    if(!a.items.length)return !b.items.length;
    return a.items.every(value=>b.items.some(other=>matchesAdventureNbt({t:a.et,v:value},{t:b.et,v:other})));
  }
  if([7,11,12].includes(expected.t))return expected.v.length===actual.v.length&&Array.from(expected.v).every((value,i)=>value===actual.v[i]);
  return expected.v===actual.v;
}

// BlockPredicateArgument parses a single predicate, not an entire command. Native
// Adventure checks deliberately do not reject an otherwise valid trailing suffix.
export function adventurePredicate(text){
  if(typeof text!=='string')return null;
  let i=0;const tag=text[i]==='#';if(tag)i++;
  const start=i;while(i<text.length&&/[a-z0-9_./:\-]/.test(text[i]))i++;
  const id=normalize(text.slice(start,i));if(!/^[a-z0-9_.-]+:[a-z0-9_./-]+$/.test(id))return null;
  const properties=Object.create(null);
  const skip=()=>{while(i<text.length&&/\s/.test(text[i]))i++;};
  const string=()=>{
    const quote=text[i];if(quote==='"'||quote==="'"){i++;let value='';while(i<text.length){const c=text[i++];if(c===quote)return value;if(c==='\\'){const next=text[i++];if(next!==quote&&next!=='\\')throw Error('Invalid property escape');value+=next;}else value+=c;}throw Error('Unclosed property');}
    const start=i;while(i<text.length&&/[A-Za-z0-9_.+\-]/.test(text[i]))i++;return text.slice(start,i);
  };
  try{
    if(text[i]==='['){
      i++;skip();while(i<text.length&&text[i]!==']'){
        const name=string();if(Object.hasOwn(properties,name))return null;skip();if(text[i++]!=='=')return null;skip();const value=string();if(!value)return null;properties[name]=value;skip();
        if(text[i]===','){i++;skip();}else if(text[i]!==']')return null;
      }if(text[i++]!==']')return null;
    }
    let nbt=null;
    if(text[i]==='{'){
      const start=i;let depth=0,quote=null,escape=false;
      for(;i<text.length;i++){
        const c=text[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}
        if(c==='"'||c==="'")quote=c;else if(c==='{')depth++;else if(c==='}'&&!--depth){i++;break;}
      }
      nbt=parseSnbt(text.slice(start,i),{indexedLists:false,nativeNumbers:true});if(nbt.t!==10)return null;
    }
    return{id,tag,properties,nbt};
  }catch{return null;}
}

export function matchesAdventurePredicate(predicate,block,state,tags,blockEntityNbt){
  const p=typeof predicate==='string'?adventurePredicate(predicate):predicate;if(!p||!block)return false;
  if(p.tag){if(!tags?.contains('blocks',p.id,block.id))return false;}
  else if(blockName(block)!==p.id)return false;
  const props=getStateProperties(state);
  if(!Object.entries(p.properties).every(([key,value])=>Object.hasOwn(props,key)&&String(props[key])===value))return false;
  return p.nbt===null||matchesAdventureNbt(p.nbt,blockEntityNbt);
}

export function adventureAllows(game,item,key,pos){
  if(!item||item.count<=0)return false;
  const list=item.nbt?.t===10?item.nbt.v?.[key]:null;
  if(list?.t!==9||list.v.et!==8)return false;
  const state=game.world.getState(pos.x,pos.y,pos.z),block=getBlock(state);
  const tile=game.tileRenderer?.tiles?.get(`${pos.x},${pos.y},${pos.z}`);
  const nbt=tile&&getBlock(tile.state).id===block.id?tile.nbt:null;
  return list.v.items.some(text=>matchesAdventurePredicate(text,block,state,game.tags,nbt));
}
