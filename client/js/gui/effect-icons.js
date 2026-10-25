export function effectTexture(game,id) {
  const def=game.items.effects[id];
  return def?'mob_effect/'+def.key.replace(/^minecraft:/,'')+'.png':null;
}
export function drawEffectIcon(game,gui,id,x,y,size=18,alpha=1) {
  const path=effectTexture(game,id),texture=path&&gui.tex(path);
  if(texture)gui.quad(texture,x,y,x+size,y+size,0,0,1,1,[1,1,1,alpha]);
}
