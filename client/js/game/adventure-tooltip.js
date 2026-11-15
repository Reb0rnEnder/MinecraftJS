import {ADVENTURE_TOOLTIP_DATA as data} from './adventure-tooltip-data.js';
import {resolveAdventureBlock} from './adventure.js';
function adventureTooltipNames(items,text){const block=resolveAdventureBlock(text);return [block?items.assets.translate(data.blockNames[block.id]):'missingno'];}
// NBT numeric getters accept all six numeric tags and reject strings/compounds.
export function tooltipNbtInt(tag){
  if(!tag||tag.t<1||tag.t>6)return 0;
  if(tag.t===4)return Number(BigInt.asIntN(32,BigInt(tag.v)));
  const n=Number(tag.v);
  if(tag.t<5)return n|0;
  const cast=Number.isNaN(n)?0:Math.max(-2147483648,Math.min(2147483647,Math.trunc(n)));
  return (n<cast?cast-1:cast)|0;
}
export function tooltipHideFlags(item){return tooltipNbtInt(item.nbt?.t===10?item.nbt.v.HideFlags:null);}
function nbtList(item,key){const tag=item.nbt?.t===10?item.nbt.v[key]:null;return tag?.t===9&&tag.v.et===8?tag.v.items:[];}
export function appendAdventureTooltips(items,item,lines){
  const flags=tooltipHideFlags(item),t=(key)=>items.assets.translate(key);
  if((tooltipNbtInt(item.nbt?.t===10?item.nbt.v.Unbreakable:null)&255)&&!(flags&4))lines.push('§9'+t('item.unbreakable'));
  for(const [key,mask,title]of [['CanDestroy',8,'item.canBreak'],['CanPlaceOn',16,'item.canPlace']]){
    const entries=nbtList(item,key);if(flags&mask||!entries.length)continue;
    lines.push('','§7'+t(title));
    for(const entry of entries)for(const name of adventureTooltipNames(items,entry))lines.push('§8'+name);
  }
}
