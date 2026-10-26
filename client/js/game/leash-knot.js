// EntityLeashKnot / LeashFenceKnotEntity: spawn packets carry the fence BlockPos,
// while rendering, rope endpoints, bounds and light sampling use its centre.
export function placeLeashKnot(e,x=e.x,y=e.y,z=e.z){
 e.x=e.prevX=e.newX=Math.floor(x)+.5;e.y=e.prevY=e.newY=Math.floor(y)+.5;e.z=e.prevZ=e.newZ=Math.floor(z)+.5;
 e.inc=0;e.width=.375;e.height=.5;e.eyeHeight=-.0625;
 e.box=[e.x-.1875,e.y-.125,e.z-.1875,e.x+.1875,e.y+.375,e.z+.1875];
}
