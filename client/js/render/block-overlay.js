import{getBlock}from'../world/blocks.js';import{resolveState}from'../world/blockstates.js';
// ScreenEffectRenderer.getViewBlockingState: sample eight corners around the
// player's eye. Collision alone does not decide whether a block hides the view.
export function viewBlockingState(game){
 const p=game.player;if(!p||p.spectator||p.noClip||game.gameMode===3)return null;
 const width=p.width??.6,eye=p.y+(typeof p.eyeHeight==='function'?p.eyeHeight():p.eyeHeight??1.62);
 for(let i=0;i<8;i++){const x=Math.floor(p.x+(((i>>0)&1)-.5)*width*.8),y=Math.floor(eye+(((i>>1)&1)-.5)*.1),z=Math.floor(p.z+(((i>>2)&1)-.5)*width*.8),state=game.world.getState(x,y,z),b=getBlock(state);
  if(b&&(b.renderType===undefined?b.hasModel:b.renderType!==0)&&(b.viewBlocking??b.suffocates??b.opaque))return{state,x,y,z};
 }return null;
}
export function renderBlockOverlay(game,gui){
 const hit=viewBlockingState(game);if(!hit)return;
 const assets=game.assets,resolved=resolveState(hit.state,(x,y,z)=>game.world.getState(x,y,z),hit.x,hit.y,hit.z,game.tileProps),model=assets.modelStore.bakeVariant(resolved.file,resolved.props,resolved.variant,0),sprite=assets.atlas.entries.get(model.particle);
 if(sprite){const[u0,v0,u1,v1]=sprite.uv;gui.quad(assets.atlasTexture,0,0,gui.width,gui.height,u1,v0,u0,v1,[.1,.1,.1,1]);}
}
