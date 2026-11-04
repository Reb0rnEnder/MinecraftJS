import{Node}from'../gfx/scene.js';
import{entityMaterial}from'./boxmodel.js';
// InventoryScreen uses the normal living renderer's equipment layers, without
// its world shadows/nameplate. Keep a separate visual so GUI lighting and poses
// never mutate the in-world player.
export function updateGuiEquipment(renderer,model,root,args){
 const g=renderer.game;if(!g.items||!g.itemRenderer)return;
 let v=renderer._guiEquipment;
 if(!v||v.root!==root){
  v=renderer._guiEquipment={root,model,modelGroup:root,materials:[],atlasMat:entityMaterial(renderer.atlasTex||(()=>g.assets.atlasTexture),{alphaTest:.1,fullBright:true,inventoryLighting:true})};
  const attach=part=>{if(!part?.obj)return null;const holder=new Node();holder.scale.set(16,16,16);part.obj.add(holder);return holder;};
  v.itemHolder=attach(model.parts?.rightArm);v.leftHolder=attach(model.parts?.leftArm);v.headHolder=attach(model.parts?.head);
  renderer._addArmorLayers(v,{kind:'player'});
 }
 const equipment=[g.inventory.held(),...(g.inventory.armor||[])],e={...(g.entities?.self||g.player),kind:'player',uuid:g.playerUuid||g.entities?.self?.uuid,ticks:g.ticks,equipment,offhand:null,mainHand:1,child:false,invisible:false};
 renderer._updateArmor(e,v,model,args);renderer._updateHeld(e,v,equipment[0],args);renderer._updateHeadItem(e,v);
 root.traverse(node=>{for(const d of node.drawables){const mat=d.mat;if(mat?.pipeline==='entity'){mat.params.setFullBright(true);mat.params.setInventoryLighting(true);}}});
}
export function guiHandPoses(game){
 const left=false,main=game.inventory.held(),off=null,right=left?off:main,other=left?main:off;
 return{heldRight:right?1:0,heldLeft:other?1:0,rightPose:right?'item':'empty',leftPose:other?'item':'empty'};
}
