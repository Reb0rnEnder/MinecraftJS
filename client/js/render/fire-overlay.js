import {mat4} from '../gfx/math.js';

// ScreenEffectRenderer.renderFire: two intersecting planes, translated +/-0.24,
// down 0.3 and yawed +/-10 degrees, in the fixed 70-degree hand projection.
export function fireOverlayVertices(uv) {
  const [u0,v0,u1,v1]=uv,vertices=[];
  for(let side=0;side<2;side++){
    const sign=side*2-1,angle=sign*Math.PI/18,c=Math.cos(angle),s=Math.sin(angle);
    for(const [x,y,u,v] of [[-.5,-.5,u1,v1],[.5,-.5,u0,v1],[.5,.5,u0,v0],[-.5,.5,u1,v0]])
      vertices.push(c*x-s*.5-sign*.24,y-.3,-s*x-c*.5,u,v,1,1,1,.9);
  }
  return new Float32Array(vertices);
}
export function fireOverlayProjection(width,height){
  // Gui.end supplies an orthographic projection. Cancel it before applying the
  // perspective matrix so the shared pipelines retain perspective-correct UVs.
  const gui=mat4.ortho(mat4.create(),0,width,height,0,-400000,400000);
  const inverse=mat4.invert(mat4.create(),gui);
  return mat4.multiply(inverse,inverse,mat4.perspective(mat4.create(),70*Math.PI/180,width/height,.05,10));
}
