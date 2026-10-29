// Native ItemProperties compass getter: target direction plus a once-per-tick yaw wobble.
const mod=value=>((value%1)+1)%1;
function wobble(state,tick,target){
 if(state.tick!==tick){state.tick=tick;state.delta=((state.delta||0)+(mod(target-(state.rotation||0)+.5)-.5)*.1)*.8;state.rotation=mod((state.rotation||0)+state.delta);}
 return state.rotation||0;
}
export function compassProperty(game,item,holder,state){
 const tag=game.items.nbt(item),lodestone=tag&&(Object.hasOwn(tag,'LodestonePos')||Object.hasOwn(tag,'LodestoneDimension')),worldName=game.worldName||({0:'minecraft:overworld',[-1]:'minecraft:the_nether',1:'minecraft:the_end'}[game.dimension]);
 const position=lodestone?(tag.LodestoneDimension===worldName?tag.LodestonePos:null):((game.dimensionData?.natural??game.dimension===0)?game.spawnPos:null),entity=holder||game.player,tick=game.world?.worldAge??game.ticks??0;
 const x=position?.X??position?.x,z=position?.Z??position?.z;
 if(!Number.isFinite(x)||!Number.isFinite(z)||(x+.5-entity.x)**2+(z+.5-entity.z)**2<1e-5){
  state.random||={};state.salts||=new WeakMap();if(!state.salts.has(item))state.salts.set(item,Math.random());
  return Math.fround(mod(wobble(state.random,tick,Math.random())+state.salts.get(item)));
 }
 const local=!holder||holder.id===game.entityId,yaw=mod((local?entity.yaw:entity.bodyYaw??entity.yaw??0)/360),angle=Math.atan2(z-entity.z,x-entity.x)/(Math.PI*2);
 state.yaw||={};return Math.fround(mod(angle+(local?wobble(state.yaw,tick,.75-yaw):.75-yaw)));
}
