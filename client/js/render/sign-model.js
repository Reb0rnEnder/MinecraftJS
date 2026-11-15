import{Node}from'../gfx/scene.js';import{D2R}from'../gfx/math.js';import{blockModel}from'./entity-models.js';import{isHangingSign}from'../game/signs-1.14.4.js';
// Native 1.19.4/1.20.6 model frame. Text data/layout are release-specific.
export function buildSignFrame(name,props,mat){
 const hanging=isHangingSign(name),wall=name.includes('_wall_'),scale=hanging?1:Math.fround(2/3),root=new Node();root.position.set(.5,hanging?.9375:.75*scale,.5);root.rotation.y=-(wall?({north:180,south:0,west:90,east:-90}[props.facing]||0):Number(props.rotation||0)*360/16)*D2R;
 const inner=new Node();if(hanging)inner.position.set(0,-.3125,0);else if(wall)inner.position.set(0,-.3125,-.4375);root.add(inner);const model=new Node();model.scale.set(scale/16,-scale/16,-scale/16);inner.add(model);
 if(hanging){const p=blockModel('hangingSign',['root','plank','vChains','normalChains']);p.plank.visible=wall;p.vChains.visible=!wall&&props.attached==='true';p.normalChains.visible=!p.vChains.visible;model.add(p.root.build());p.root.setMaterial(mat);}
 else{const p=blockModel('sign',['board','stick']);model.add(p.board.build());p.board.setMaterial(mat);if(!wall){model.add(p.stick.build());p.stick.setMaterial(mat);}}
 return{root,inner,scale,hanging,wall};
}
