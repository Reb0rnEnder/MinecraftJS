import {LocalPlayer} from './physics.js';
import {PLAYER_DATA} from './player-native.js';

// Native respawn creates a fresh player. The target supplies its metadata and
// attribute retention policies, whose meanings change between releases.
export function replaceRespawnPlayer(game,{copyMetadata=true,keepAttributes=false,healthIndex=PLAYER_DATA.healthIndex,poseIndex=PLAYER_DATA.poseIndex,livingFlagsIndex=PLAYER_DATA.livingFlagsIndex,frozenIndex=PLAYER_DATA.frozenIndex}={}){
  const old=game.player,player=new LocalPlayer();
  for(const key of ['onStep','onPowderSnow','onFall','onWaterEnter','onSwim'])if(old[key])player[key]=old[key];
  player.flySpeed=Math.fround(.05);player.walkSpeed=Math.fround(.1);
  player.speedAttr={base:Math.fround(.1),modifiers:[]};
  player.attributes=keepAttributes&&old.attributes?structuredClone(old.attributes):new Map();
  if(keepAttributes){player.speedAttr=structuredClone(old.speedAttr);if(Object.hasOwn(player,'attackSpeed'))player.attackSpeed=old.attackSpeed;}
  game.maxHealth=keepAttributes?(game.maxHealth??20):20;
  game.selfMetadata=copyMetadata?structuredClone(game.selfMetadata||{}):{};
  // LocalPlayer.resetPos runs after data/attribute copying: health is set to
  // max and pose to standing. Velocity, effects and use timers start fresh.
  game.selfMetadata[healthIndex]=game.maxHealth;
  if(poseIndex!==null)game.selfMetadata[poseIndex]=0;
  const flags=game.selfMetadata[0]||0;
  player.sneaking=!!(flags&2);player.sprinting=!!(flags&8);
  if(Object.hasOwn(player,'elytraFlying'))player.elytraFlying=!!(flags&128);
  if(frozenIndex!==null)player.frozenTicks=game.selfMetadata[frozenIndex]||0;
  if(livingFlagsIndex!==null)player.riptide=!!(game.selfMetadata[livingFlagsIndex]&4);
  player.health=game.health=game.prevHealth=game.maxHealth;
  game.player=player;
  const spawn=game.spawnPos||{x:0,y:0,z:0};
  player.setPosition(spawn.x+.5,spawn.y+1,spawn.z+.5);
  if(game.world?.isLoaded?.(player.x,player.z))for(let y=player.y;y>game.world.minY&&y<game.world.maxY;y++){
    player.setPosition(player.x,y,player.z);if(!game.world.getCollisions(player.bb(),player).length)break;
  }
  player.prevX=player.x;player.prevY=player.y;player.prevZ=player.z;
  player.yaw=-180;player.prevYaw=game.spawnAngle??0;player.pitch=player.prevPitch=0;
  game.effects?.clear();game.sleeping=false;game.bedPos=null;
  game.dead=false;game.hurtTime=0;game.lastDamageTime=0;
  game.food=20;game.saturation=5;game.xpBar=game.xpLevel=game.xpTotal=0;
  game.portalTime=game.prevPortalTime=0;
  game.heldSlot=0;game.window=null;game.inventoryOpen=false;
  if(game.inventory){
    game.inventory.reset();if(Object.hasOwn(game.inventory,'stateId'))game.inventory.stateId=0;game.inventory.properties={};
    game.inventory.dragEvent=0;game.inventory.dragMode=-1;game.inventory.dragSlots?.clear();
  }
  if(game.interaction){if(Object.hasOwn(game.interaction,'ticksSinceLastSwing'))game.interaction.ticksSinceLastSwing=0;game.interaction.useTicks=0;if(Object.hasOwn(game.interaction,'spyglassUsing'))game.interaction.spyglassUsing=false;}
  game.lastReported={x:0,y:0,z:0,yaw:0,pitch:0,sneak:game.lastReported?.sneak||false,sprint:game.lastReported?.sprint||false};
  game.positionUpdateTicks=0;
  if(game.entities?.self){game.entityRenderer?.remove(game.entities.self.id);game.entities.self=null;}
  return player;
}
