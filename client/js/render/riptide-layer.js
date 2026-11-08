// LayerRiptide: the jar's 64x64 ModelBox, with three counter-rotating scaled shells.
import { Node } from '../gfx/scene.js';
import { D2R } from '../gfx/math.js';
import { Part, entityMaterial } from './boxmodel.js';
export function updateRiptide(e,v,partial) {
  if(e.kind!=='player')return;
  if(!e.riptide){if(v.riptideLayer)v.riptideLayer.visible=false;return;}
  if(!v.riptideLayer) {
    const root=v.riptideLayer=new Node();v.modelGroup.add(root);v.riptideShells=[];
    const mat=entityMaterial('entity/trident_riptide.png',{cull:false});v.materials.push(mat);
    for(let i=0;i<3;i++) {
      const shell=new Node(),part=new Part(64,64).box(-8,-16,-8,16,32,16);
      shell.add(part.build());part.setMaterial(mat);root.add(shell);v.riptideShells.push(shell);
    }
  }
  v.riptideLayer.visible=true;
  v.riptideShells.forEach((s,i)=>{const f=0.75*i;s.scale.setScalar(f);s.position.set(0,f*(-0.2+0.6*i)*16,0);s.rotation.y=((e.ticks||0)+partial)*-(45+i*5)*D2R;});
}
