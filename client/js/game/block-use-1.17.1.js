// Client-side consumption of native block/item use results. State, drops and
// durability are reconciled from server updates; consume a successful use once.
export function cavesBlockUse(name,props,item,mayBuild=true,canEat=false,hitY=0){
 const candle=/(?:^|_)candle$/.test(name),cake=/(?:^|_)candle_cake$/.test(name);
 if(name==='light')return true;
 if((name==='cave_vines'||name==='cave_vines_plant')&&props.berries==='true')return true;
 if(candle||cake){
  if((item==='flint_and_steel'||item==='fire_charge')&&props.lit!=='true'&&props.waterlogged!=='true')return true;
  if(!item&&props.lit==='true'&&mayBuild&&(candle||hitY>.5))return true;
  if(cake&&item!=='flint_and_steel'&&item!=='fire_charge'&&canEat)return true;
 }
 return false;
}
