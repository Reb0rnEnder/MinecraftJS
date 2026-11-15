import {blocks} from '../world/blocks.js';
import {DEFAULT_TAGS} from './default-tags.js';
import {ADVENTURE_TOOLTIP_DATA as data} from './adventure-tooltip-data.js';

// AdventureModePredicate.computeTooltip: an unrestricted predicate makes the
// entire description unknown; otherwise flatten holders and remove duplicates.
export function appendAdventureTooltips(items,item,lines){
  const components=items.components(item),t=key=>items.assets.translate(key),tags=items.registryTags?.();
  for(const [key,title]of [['can_break','item.canBreak'],['can_place_on','item.canPlace']]){
    const permission=components[key];if(!permission||(permission.showTooltip??permission.show_in_tooltip??true)===false)continue;
    lines.push('','§7'+t(title));
    if(permission.predicates.some(p=>!p.blockSet)){lines.push('§7'+t('item.canUse.unknown'));continue;}
    const seen=new Set();
    for(const predicate of permission.predicates){
      const set=predicate.blockSet,ids=set.blockIds??(tags?tags.registries.blocks.get(set.name):DEFAULT_TAGS.blocks[set.name])??[];
      for(const id of ids)if(!seen.has(id)){seen.add(id);const block=blocks[id];if(block)lines.push('§8'+t(data.blockNames[block.name]));}
    }
  }
}
