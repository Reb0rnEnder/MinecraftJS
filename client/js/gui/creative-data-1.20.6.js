import {createItemStack766} from '../net/item-components-1.20.6.js';

const catalogs=new WeakMap();
const arrays={Int8Array,Uint8Array,Int32Array,BigInt64Array};
function revive(value){
 if(value?.$big!==undefined)return BigInt(value.$big);
 if(value?.$ta){const Type=arrays[value.$ta];if(!Type)throw Error('Invalid Creative component array');return Type===BigInt64Array?BigInt64Array.from(value.a,BigInt):new Type(value.a);}
 if(Array.isArray(value))return value.map(revive);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,child])=>[key,revive(child)]));
 return value;
}
export function creativeStack766(tuple){
 if(!tuple)return null;
 const [id,,,patch]=tuple;
 return createItemStack766(id,1,patch?revive(patch):{added:[],removed:[]});
}
export function nativeCreativeRows766(game){
 const data=game.assets.data.creative;
 if(data.stackFormat!=='native-components-766')return null;
 let catalog=catalogs.get(data);
 if(!catalog){
  const rows=rows=>rows.map(row=>({...row,icon:data.stacks[row.icon],items:row.items.map(id=>data.stacks[id])}));
  catalog=data.featureCatalogs.map(c=>({...c,tabs:rows(c.tabs),operatorTabs:rows(c.operatorTabs)}));catalogs.set(data,catalog);
 }
 const flags=game.enabledFeatures,mask=(flags?.has('minecraft:update_1_21')?1:0)|(flags?.has('minecraft:bundle')?2:0)|(flags?.has('minecraft:trade_rebalance')?4:0);
 const selected=catalog.find(c=>c.mask===mask);if(!selected)throw Error('Missing native Creative feature catalogue '+mask);
 return game.settings.operatorItemsTab&&game.canUseCommandBlock()?selected.operatorTabs:selected.tabs;
}
