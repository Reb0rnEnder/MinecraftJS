import{BUNDLE_NATIVE}from'./bundle-data.js';
import{TAG}from'../net/nbt.js';
const forbidden=new Set(BUNDLE_NATIVE.forbiddenItems);
export const isBundle=(item,items)=>!!item&&items.name(item.id)==='bundle';
function root(item){return item?.nbt?.t===TAG.COMPOUND?item.nbt:{t:TAG.COMPOUND,name:'',v:{}};}
function entries(item){const list=root(item).v.Items;return list?.t===TAG.LIST&&list.v.et===TAG.COMPOUND?list.v.items:[];}
function decode(entry,items){const name=entry.id?.v?.replace(/^minecraft:/,''),def=items.byName.get(name),count=Number(entry.Count?.v)||0;if(!def||count<=0)return null;return{id:def.id,count,damage:0,nbt:entry.tag?.t===TAG.COMPOUND?structuredClone(entry.tag):null};}
function encode(item,items){return{id:{t:TAG.STRING,v:'minecraft:'+items.name(item.id)},Count:{t:TAG.BYTE,v:item.count},...(item.nbt?{tag:structuredClone(item.nbt)}:{})};}
function setEntries(item,list){const tag=structuredClone(root(item));if(list.length)tag.v.Items={t:TAG.LIST,v:{et:TAG.COMPOUND,items:list}};else delete tag.v.Items;item.nbt=tag;delete item.nbtRaw;}
export function bundleContents(item,items){return entries(item).map(e=>decode(e,items)).filter(Boolean);}
export function bundleWeight(item,items){
 const name=items.name(item.id);
 if(name==='bundle')return 4+bundleContentWeight(item,items);
 if((name==='beehive'||name==='bee_nest')&&items.nbt(item)?.BlockEntityTag?.Bees?.length)return 64;
 return Math.trunc(64/items.maxStack(item.id));
}
export function bundleContentWeight(item,items){return bundleContents(item,items).reduce((weight,entry)=>weight+entry.count*bundleWeight(entry,items),0);}
export function bundleAdd(bundle,item,items,equal){
 if(!item||item.count<=0||forbidden.has(item.id))return 0;
 const count=Math.min(item.count,Math.trunc((64-bundleContentWeight(bundle,items))/bundleWeight(item,items)));if(count<=0)return 0;
 const list=structuredClone(entries(bundle));let at=isBundle(item,items)?-1:list.findIndex(e=>{const other=decode(e,items);return other&&equal(item,other);}),entry;
 if(at>=0){entry=list.splice(at,1)[0];entry.Count.v+=count;}else entry=encode({...item,count},items);
 list.unshift(entry);setEntries(bundle,list);return count;
}
export function bundleRemove(bundle,items){const list=structuredClone(entries(bundle));if(!list.length)return null;const first=decode(list.shift(),items);setEntries(bundle,list);return first;}
export function bundleSound(game,kind){if(BUNDLE_NATIVE.sounds)game.sound?.playAtPlayer?.('item.bundle.'+kind,.8,.8+Math.random()*.4,'player');}
export function emptyBundle(game,item){if(!Object.hasOwn(root(item).v,'Items'))return false;setEntries(item,[]);bundleSound(game,'drop_contents');return true;}
export function bundleSlotClick(container,slotId,button,equal){
 if(button!==1)return false;
 const slot=container.slots[slotId];if(!slot)return false;
 const items=container.items,cur=container.inv.cursor,stack=slot.item;
 if(isBundle(cur,items)){
  if(!stack){
   const taken=bundleRemove(cur,items);
   if(taken){bundleSound(container.game,'remove_one');let remaining=taken.count;
    if(container.isValid(slotId,taken)){const count=Math.min(remaining,container.slotLimit(slotId,taken));container.put(slotId,{...taken,count});remaining-=count;}
    if(remaining)bundleAdd(cur,{...taken,count:remaining},items,equal);
   }
  }else if(!forbidden.has(stack.id)&&container.canTake(slotId)){
   const count=Math.min(stack.count,items.maxStack(stack.id),Math.trunc((64-bundleContentWeight(cur,items))/bundleWeight(stack,items)));
   if(count>0&&!container.isValid(slotId,stack)&&count<stack.count)return true;
   if(count>0){const taken=container.decr(slotId,count);if(taken){bundleAdd(cur,taken,items,equal);container.onPickupFromSlot(slotId,taken);bundleSound(container.game,'insert');}}
  }
  return true;
 }
 if(isBundle(stack,items)&&container.canTake(slotId)&&container.isValid(slotId,stack)){
  if(!cur){const taken=bundleRemove(stack,items);if(taken){container.inv.cursor=taken;bundleSound(container.game,'remove_one');}}
  else{const moved=bundleAdd(stack,cur,items,equal);if(moved){cur.count-=moved;if(cur.count<=0)container.inv.cursor=null;bundleSound(container.game,'insert');}}
  container.onSlotChanged(slotId);return true;
 }
 return false;
}
export function bundleBar(item,items){const weight=bundleContentWeight(item,items);return weight>0?{width:Math.min(1+Math.trunc(12*weight/64),13),color:BUNDLE_NATIVE.barColor}:null;}
