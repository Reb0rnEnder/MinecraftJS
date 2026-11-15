import {blocks,blocksByName} from '../world/blocks.js';
import {adventurePredicate,adventurePropertyValue} from './adventure.js';
import {DEFAULT_TAGS} from './default-tags.js';
import {ADVENTURE_TOOLTIP_DATA as data} from './adventure-tooltip-data.js';
function adventureTooltipNames(items,text){
  const predicate=adventurePredicate(text);if(!predicate)return ['missingno'];
  const name=block=>items.assets.translate(data.blockNames[block.name]);
  if(predicate.tag){
    const tags=items.registryTags?.(),ids=tags?tags.registries.blocks.get(predicate.id):DEFAULT_TAGS.blocks[predicate.id];
    if(!ids||!ids.length&&data.emptyTagFallback)return ['missingno'];
    return ids.map(id=>blocks[id]).filter(Boolean).map(name);
  }
  const block=predicate.id.startsWith('minecraft:')?blocksByName[predicate.id.slice(10)]:null;
  if(!block||Object.entries(predicate.properties).some(([key,value])=>adventurePropertyValue(block,key,value)===null))return ['missingno'];
  return [name(block)];
}
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
