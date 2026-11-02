import {registryEntries} from '../net/registry-codec.js';
// Native DamageEffects.sound and Player.getHurtSound (1.19.4 bek / bym).
const PLAYER_SOUNDS={hurt:'entity.player.hurt',thorns:'enchant.thorns.hit',drowning:'entity.player.hurt_drown',burning:'entity.player.hurt_on_fire',poking:'entity.player.hurt_sweet_berry_bush',freezing:'entity.player.hurt_freeze'};
export function handleDamage762(game,packet,codec){
 const local=packet.entityId===game.entityId,e=local?game.player:game.entities.get(packet.entityId);
 if(!e)return;
 e.lastDamageSource=packet;e.hurtTime=10;e.invulnerableTime=20;
 if(local)game.hurtTime=10;
 if(e.silent)return;
 if(local||e.kind==='player'){
  const type=registryEntries(codec,'minecraft:damage_type').find(entry=>entry.id===packet.sourceTypeId);
  const name=PLAYER_SOUNDS[type?.element?.effects]||PLAYER_SOUNDS.hurt,pitch=1+(Math.random()-Math.random())*.2;
  game.sound.play(name,e.x,e.y,e.z,1,pitch,{category:'player',global:local});
 }else game.sound.playEntityHurt(e);
}
