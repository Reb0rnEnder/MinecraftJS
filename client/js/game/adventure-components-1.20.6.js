import {getStateProperties} from '../world/blocks.js';
import {ADVENTURE_PROPERTIES_766} from './adventure-properties-1.20.6.js';

import {parseJavaInteger} from '../util/java-integer.js';
function ordinal(type,value) {const parsed=type.integer?parseJavaInteger(value):value;return type.values.indexOf(parsed===null?null:String(parsed));}

// BlockPredicate.matchesState: block holder membership AND all property matchers.
export function matchesAdventureComponentState(predicate,block,state,tags) {
  if(!predicate||!block)return false;
  const set=predicate.blockSet;
  if(set){
    if(set.name!==undefined){if(!tags?.contains('blocks',set.name,block.id))return false;}
    else if(!set.blockIds?.includes(block.id))return false;
  }
  const properties=getStateProperties(state),definitions=ADVENTURE_PROPERTIES_766.properties[block.name];
  return (predicate.properties||[]).every(matcher=>{
    const index=definitions?.[matcher.name],type=ADVENTURE_PROPERTIES_766.types[index];
    if(!type||!Object.hasOwn(properties,matcher.name))return false;
    const actual=ordinal(type,String(properties[matcher.name])),value=matcher.value;
    if(actual<0)return false;
    if(matcher.isExactMatch)return ordinal(type,value.exactValue)===actual;
    for(const [bound,minimum]of [[value.minValue,true],[value.maxValue,false]]){
      if(bound==null)continue;
      const limit=ordinal(type,bound);
      if(limit<0||(minimum?actual<limit:actual>limit))return false;
    }
    return true;
  });
}
