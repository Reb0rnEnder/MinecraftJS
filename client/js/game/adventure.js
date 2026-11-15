import {parseJavaInteger} from '../util/java-integer.js';
import {blocks,blocksByName} from '../world/blocks.js';
// Native pre-1.13 ItemStack permissions resolve block names/IDs, not predicates.
export function adventureAllows(game,item,key,pos){
  if(!item||item.count<=0)return false;
  const list=item.nbt?.t===10?item.nbt.v?.[key]:null;
  if(list?.t!==9||list.v.et!==8)return false;
  const block=blocks[game.world.getState(pos.x,pos.y,pos.z)>>4];if(!block)return false;
  return list.v.items.some(name=>resolveAdventureBlock(name)?.id===block.id);

}
export function resolveAdventureBlock(name){
  if(typeof name!=='string')return null;
  const index=name.indexOf(':'),namespace=index>0?name.slice(0,index).toLowerCase():'minecraft';
  let path=index<0?name:name.slice(index+1);
  path=path.toLowerCase();
  if(namespace==='minecraft'&&blocksByName[path])return blocksByName[path];
  const id=parseJavaInteger(name);return id===null?null:blocks[id]||blocks[0];
}
// These old client item paths bypass Player.canPlayerEdit; their results
// still differ by release (notably 1.8.9 firework use returns false).
// ItemStack.useOn itself gains a universal Adventure gate only in 1.13.
export const LEGACY_UNRESTRICTED_USE=new Set([328,342,343,407,408,422,383,401]);
