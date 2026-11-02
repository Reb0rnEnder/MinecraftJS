// Client-only moving light sources. Six nearest holders fit in the existing
// 256-byte WebGPU globals block without growing its alignment or buffer stride.
export const EMPTY_DYNAMIC_LIGHTS=new Float32Array(24);
export function dynamicBlockLight(lights,x,y,z,base=0){
 if(!lights?.[3])return base;
 let value=base;
 for(let i=0;lights&&i<24;i+=4){const power=lights[i+3];if(power>0){const distance=Math.hypot(x-lights[i],y-lights[i+1],z-lights[i+2]);value=Math.max(value,power*Math.max(0,1-distance/7.5));}}
 return Math.min(15,value);
}
export const DYNAMIC_GLSL=`
uniform vec4 uDynamicLights[6];
float dynamicBlockLight(vec3 position,float base){
 if(uDynamicLights[0].w<=0.0)return base;
 float value=base;
 for(int i=0;i<6;i++){vec4 source=uDynamicLights[i];if(source.w>0.0)value=max(value,source.w*max(0.0,1.0-distance(position,source.xyz)/7.5));}
 return min(15.0,value);
}
`;
export const DYNAMIC_WGSL=`
fn dynamicBlockLight(position:vec3f,base:f32)->f32{
 if(G.lights[0].w<=0.0){return base;}
 var value=base;
 for(var i=0u;i<6u;i++){let source=G.lights[i];if(source.w>0.0){value=max(value,source.w*max(0.0,1.0-distance(position,source.xyz)/7.5));}}
 return min(15.0,value);
}
`;
