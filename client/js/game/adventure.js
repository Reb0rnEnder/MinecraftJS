import {getBlock} from '../world/blocks.js';
import {itemComponentValues766} from '../net/item-components-1.20.6.js';
import {matchesAdventureComponentState} from './adventure-components-1.20.6.js';

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

export function adventureAllows(game,item,key,pos){
  if(!item||item.count<=0)return false;
  const type=key==='CanDestroy'?'can_break':key==='CanPlaceOn'?'can_place_on':null;
  if(!type)return false;
  const permission=itemComponentValues766(item)[type];
  if(!permission)return false;
  const state=game.world.getState(pos.x,pos.y,pos.z),block=getBlock(state);
  const tile=game.tileRenderer?.tiles?.get(`${pos.x},${pos.y},${pos.z}`);
  const nbt=tile&&getBlock(tile.state).id===block.id?tile.nbt:null;
  return permission.predicates.some(predicate=>matchesAdventureComponentState(predicate,block,state,game.tags)&&(predicate.nbt==null||!!nbt&&matchesAdventureNbt(predicate.nbt,nbt)));
}
