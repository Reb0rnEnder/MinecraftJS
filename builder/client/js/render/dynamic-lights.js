import{blocksByName,getBlock}from'../world/blocks.js';import{EMPTY_DYNAMIC_LIGHTS,dynamicBlockLight}from'../gfx/dynamic-lighting.js';
// Optional Gravrust presentation effect; never changes server light or chunks.
export function heldLightLevel(game,item){
 if(!item||item.count===0)return 0;
 const name=game.items.name(item.id),block=blocksByName[name];
 if(block)return Math.max(0,Math.min(15,getBlock(block.defaultState??(block.id<<4)).emitLight||0));
 return name==='lava_bucket'?15:0;
}
export function collectDynamicLights(game,camera,partial=0){
 if(!game.settings.dynamicLights||!game.inWorld)return EMPTY_DYNAMIC_LIGHTS;
 const sources=[],add=(entity,items)=>{const level=Math.max(...items.map(item=>heldLightLevel(game,item)));if(!level||entity.spectator)return;
  const x=(entity.prevX??entity.x)+((entity.x??0)-(entity.prevX??entity.x))*partial,y=(entity.prevY??entity.y)+((entity.y??0)-(entity.prevY??entity.y))*partial+(typeof entity.eyeHeight==='function'?entity.eyeHeight():entity.eyeHeight??(entity.height||1.8)*.85)-.25,z=(entity.prevZ??entity.z)+((entity.z??0)-(entity.prevZ??entity.z))*partial;
  const distance=(x-camera[0])**2+(y-camera[1])**2+(z-camera[2])**2;if(distance<=(game.settings.renderDistance*16+8)**2)sources.push({x,y,z,level,distance});};
 add(game.player,[game.inventory.held(),game.inventory.offhand]);
 if(game.settings.dynamicLightsOthers!==false)for(const e of game.entities.all())if(e.id!==game.entityId&&!e.dead)add(e,[e.equipment?.[0],e.offhand]);
 sources.sort((a,b)=>a.distance-b.distance);const data=new Float32Array(24);
 sources.slice(0,6).forEach((s,i)=>data.set([s.x,s.y,s.z,s.level],i*4));return data;
}

// Hands use camera-local matrices, so world-space light sources must be sampled
// before that transform rather than passed to the hand shader as local positions.
export function firstPersonBlockLight(game,eye,base){
 if(!game.settings.dynamicLights)return base;
 const nearby=dynamicBlockLight(game.renderer.dynamicLights,...eye,base);
 return Math.max(nearby,heldLightLevel(game,game.inventory.held()),heldLightLevel(game,game.inventory.offhand));
}
