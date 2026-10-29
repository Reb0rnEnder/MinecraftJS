// Native menu slot positions and BannerPattern ordinal order, verified from the 1.14.4 client jar.
export const WORKSTATIONS_498 = {
  'minecraft:grindstone': {texture:'grindstone', slots:[[0,49,19],[1,49,40],[2,129,34]],titleY:6},
  'minecraft:cartography': {texture:'cartography_table',slots:[[0,15,15],[1,15,52],[2,145,39]],titleY:4},
  'minecraft:stonecutter': {texture:'stonecutter',slots:[[0,20,33],[1,143,33]],titleY:4},
  'minecraft:loom': {texture:'loom',slots:[[0,13,26],[1,33,26],[2,23,45],[3,143,58]],titleY:4},
};
export const LOOM_PATTERNS = 'b bl br tl tr bs ts ls rs cs ms drs dls ss cr sc bt tt bts tts ld rd lud rud mc mr vh hh vhr hhb bo cbo gra gru bri glb cre sku flo moj pig'.split(' ');
export function stonecutterRecipes(game, input) {
  if(!input)return [];
  const key=r=>(game.items.isBlockItem(r.data.result.id)?'block.minecraft.':'item.minecraft.')+game.items.name(r.data.result.id);
  return (game.serverRecipes||[]).filter(r=>r.type==='minecraft:stonecutting' && r.data.ingredient.some(it=>it?.id===input.id))
    .sort((a,b)=>key(a)<key(b)?-1:key(a)>key(b)?1:0);
}
export function tradeCost(trade, maxStack=64) {
  const extra=Math.max(0,Math.floor(Math.fround(Math.fround(trade.a.count*trade.demand)*trade.priceMultiplier)));
  return {...trade.a,count:Math.max(1,Math.min(maxStack,trade.a.count+extra+trade.specialPrice))};
}
