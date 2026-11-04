// Native collection-packet and locally activated block sounds. Server-owned
// release/lever/throw sounds must not be duplicated here.
import {getStateProperties,findState} from '../world/blocks.js';
export function playPickupSound(game, entity) {
  const orb=entity.kind==='xp';
  const volume=orb?.1:.2,pitch=orb?(Math.random()-Math.random())*.35+.9:(Math.random()-Math.random())*1.4+2;
  game.sound?.play(orb?'entity.experience_orb.pickup':'entity.item.pickup',entity.x,entity.y,entity.z,volume,pitch,{category:'player'});
}
export function playActivatedBlockSound(game, target, block) {
  const {x,y,z}=target,state=game.world.getState(x,y,z),name=block.name;
  const props=getStateProperties(state),powered=props.powered==='true',subtract=props.mode==='subtract';
  let sound,volume=.3,pitch,next;
  if(name==='stone_button'||name==='wooden_button'||name.endsWith('_button')){
    if(powered)return;
    sound=name==='stone_button'||name==='polished_blackstone_button'?'block.stone_button.click_on':'block.wooden_button.click_on';
    if(name==='crimson_button'||name==='warped_button')sound='block.nether_wood_button.click_on';
    if(name==='bamboo_button')sound='block.bamboo_wood_button.click_on';
    if(name==='cherry_button')sound='block.cherry_wood_button.click_on';
    volume=1;pitch=1; // Native 1.19.4 button attenuation/pitch lives in sounds.json.
    next=findState(name,{...props,powered:'true'});
  }else if((name==='comparator'||name==='unpowered_comparator'||name==='powered_comparator')&&game.gameMode!==2){
    sound='block.comparator.click';pitch=subtract?.5:.55;
    next=findState(name,{...props,mode:subtract?'compare':'subtract'});
  }else return;
  game.world.setState(x,y,z,next);
  game.sound?.play(sound,x+.5,y+.5,z+.5,volume,pitch,{category:'block'});
}
