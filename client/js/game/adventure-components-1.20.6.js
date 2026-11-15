import {getStateProperties} from '../world/blocks.js';
import {ADVENTURE_PROPERTIES_766} from './adventure-properties-1.20.6.js';

// IntegerProperty delegates parsing to Integer.parseInt, then checks its domain.
function integerValue(text) {
  if(typeof text!=='string')return null;
  const negative=text[0]==='-',start=negative||text[0]==='+'?1:0;
  if(start===text.length)return null;
  let n=0;
  for(let i=start;i<text.length;i++){
    const c=text[i];if(!/\p{Nd}/u.test(c))return null;
    let zero=c.charCodeAt(0);while(zero>0&&/\p{Nd}/u.test(String.fromCharCode(zero-1)))zero--;
    n=n*10+(c.charCodeAt(0)-zero)%10;if(n>2147483648)return null;
  }
  if(!negative&&n>2147483647)return null;
  return String(negative&&n?-n:n);
}
function ordinal(type,value) {return type.values.indexOf(type.integer?integerValue(value):value);}

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
