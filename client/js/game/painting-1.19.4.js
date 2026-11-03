import{ITEM_PRESENTATION_762}from'./item-presentation-1.19.4.js';
export const PAINTING_VARIANT_INDEX_762=ITEM_PRESENTATION_762.paintingVariantIndex;
const variants=new Map(ITEM_PRESENTATION_762.paintings.map(v=>[v.id,v]));
// Painting.recreateFromPacket uses a six-direction wire ID and the packet's
// anchor BlockPos. Its variant arrives separately as synchronized entity data.
export function paintingFacing762(direction){return({3:0,4:1,2:2,5:3})[direction]??0;}
export function configurePainting762(entity,id=entity.paintingId??0){
 const art=variants.get(id);if(!art||!entity.blockPos)return false;
 entity.paintingId=id;entity.paintingName=art.name.replace(/^minecraft:/,'');entity.title=entity.paintingName;
 entity.width=art.width/16;entity.height=art.height/16;entity.pickable=true;
 const front=[[0,1],[-1,0],[0,-1],[1,0]][entity.facing],side=[[1,0],[0,1],[-1,0],[0,-1]][entity.facing],p=entity.blockPos,off=pixels=>pixels%32===0?.5:0;
 const x=p.x+.5-front[0]*.46875+side[0]*off(art.width),y=p.y+.5+off(art.height),z=p.z+.5-front[1]*.46875+side[1]*off(art.width),hx=(front[0]===0?art.width:1)/32,hz=(front[0]===0?1:art.width)/32;
 entity.box=[x-hx,y-art.height/32,z-hz,x+hx,y+art.height/32,z+hz];
 entity.x=entity.prevX=entity.newX=x;entity.y=entity.prevY=entity.newY=y;entity.z=entity.prevZ=entity.newZ=z;return true;
}
