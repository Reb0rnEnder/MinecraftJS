import {adaptNativeStack26_3} from '../net/item-components-26.3.js';

const catalogs=new WeakMap();
const arrays={Int8Array,Uint8Array,Int32Array,BigInt64Array};
function revive(value){
  if(value?.$big!==undefined)return BigInt(value.$big);
  if(value?.$ta){const Type=arrays[value.$ta];if(!Type)throw Error('Invalid Creative component array');return Type===BigInt64Array?BigInt64Array.from(value.a,BigInt):new Type(value.a);}
  if(Array.isArray(value))return value.map(revive);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,revive(child)]));
  return value;
}
export function creativeStack263(entry){
  if(!entry?.stack)return null;
  const item=adaptNativeStack26_3(revive(entry.stack));
  if(entry.patch){item.creativePatch=entry.patch;item.creativePatchItem=item.id;}
  return item;
}
export function nativeCreativeRows263(game){
  const data=game.assets.data.creative;
  if(data.stackFormat!=='native-components-263')return null;
  let catalog=catalogs.get(data);
  if(!catalog){
    const rows=rows=>rows.map(row=>({...row,icon:data.stacks[row.icon],items:row.items.map(id=>data.stacks[id])}));
    catalog=data.featureCatalogs.map(entry=>({...entry,tabs:rows(entry.tabs),operatorTabs:rows(entry.operatorTabs)}));catalogs.set(data,catalog);
  }
  const flags=game.enabledFeatures,mask=(flags?.has('minecraft:trade_rebalance')?1:0)|(flags?.has('minecraft:redstone_experiments')?2:0)|(flags?.has('minecraft:minecart_improvements')?4:0);
  const selected=catalog.find(entry=>entry.mask===mask);if(!selected)throw Error('Missing native 26.3 Creative feature catalogue '+mask);
  return game.settings.operatorItemsTab&&game.canUseCommandBlock()?selected.operatorTabs:selected.tabs;
}
