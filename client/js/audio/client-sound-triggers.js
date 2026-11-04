// Native collection-packet and locally activated block sounds. Server-owned
// release/lever/throw sounds must not be duplicated here.
export function playPickupSound(game, entity) {
  const orb=entity.kind==='xp';
  const volume=orb?.1:.2,pitch=orb?(Math.random()-Math.random())*.35+.9:(Math.random()-Math.random())*1.4+2;
  game.sound?.play(orb?'entity.experience_orb.pickup':'entity.item.pickup',entity.x,entity.y,entity.z,volume,pitch,{category:'player'});
}
export function playActivatedBlockSound(game, target, block) {
  const {x,y,z}=target,state=game.world.getState(x,y,z),name=block.name;
  const powered=!!(state&8),subtract=!!(state&4);
  let sound,volume=.3,pitch,next;
  if(name==='stone_button'||name==='wooden_button'||name.endsWith('_button')){
    if(powered)return;
    sound=name==='wooden_button'?'block.wood_button.click_on':'block.stone_button.click_on';pitch=.6;
    next=state|8;
  }else if((name==='comparator'||name==='unpowered_comparator'||name==='powered_comparator')&&game.gameMode!==2){
    sound='block.comparator.click';pitch=subtract?.5:.55;
    next=state^4;
  }else return;
  game.world.setState(x,y,z,next);
  game.sound?.play(sound,x+.5,y+.5,z+.5,volume,pitch,{category:'block'});
}
