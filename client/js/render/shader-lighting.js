// Basic BSL colour/lightmap bridge. Uses the imported pack's authoring values and attenuation;
// this deliberately does not emulate its deferred lighting, shadow maps, PBR or exposure buffers.
export const lightingOption=/^(?:(?:LIGHT|AMBIENT)_[MDEN][RGBI]|(?:BLOCKLIGHT|MINLIGHT|END)_[RGBI]|NETHER_N[RGBI])$/;
export function packLighting(options,values){
 const defaults=Object.fromEntries(options.map(o=>[o.name,o.default]));
 if(!['BLOCKLIGHT_R','BLOCKLIGHT_G','BLOCKLIGHT_B','BLOCKLIGHT_I','LIGHT_DR','AMBIENT_DR'].every(k=>defaults[k]!==undefined))return null;
 const get=k=>Number(values[k]??defaults[k]);
 const color=(prefix)=>['R','G','B'].map(k=>get(prefix+k)*get(prefix+'I')/255);
 const colors={};for(const k of ['LIGHT_M','LIGHT_D','LIGHT_E','LIGHT_N','AMBIENT_M','AMBIENT_D','AMBIENT_E','AMBIENT_N','BLOCKLIGHT_','MINLIGHT_','END_','NETHER_N']){const c=color(k);if(c.every(Number.isFinite))colors[k]=c;}
 return colors;
}
export function lightingFrame(colors,worldTime,dimension=0,rain=0){
 const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t),square=a=>a.map(v=>v*v),zero=[0,0,0];
 const phase=((worldTime%24000)+24000)%24000/24000,sun=Math.max(0,Math.sin(phase*Math.PI*2));
 const evening=1-Math.max(0,Math.min(1,Math.abs(phase-.5)*8-1.5)),day=1-Math.pow(1-sun,1.5);
 const weather=a=>mix(a,a.map(()=>a[0]*.299+a[1]*.587+a[2]*.114),Math.max(0,Math.min(1,rain)));
 const sample=prefix=>square(weather(mix((colors[prefix+'N']||zero).map(v=>v*.3),mix(mix(colors[prefix+'M']||zero,colors[prefix+'E']||zero,evening),colors[prefix+'D']||zero,day),Math.min(1,sun*4))));
 let ambient=sample('AMBIENT_'),direct=sample('LIGHT_');
 if(dimension===-1){ambient=(colors.NETHER_N||[1,.4,.2]).map(v=>v*.07);direct=zero;}
 if(dimension===1){ambient=square(colors.END_||[.5,.4,.8]).map(v=>v*.015);direct=square(colors.END_||[.5,.4,.8]).map(v=>v*.04);}
 return {ambient,direct,block:square(colors.BLOCKLIGHT_),minimum:square(colors.MINLIGHT_||zero).map(v=>v*.04),dimension};
}
export const basicLightingGLSL=`
uniform vec3 uPackAmbient,uPackDirect,uPackBlock,uPackMinimum;
uniform float uPackDimension;
vec3 mcjsPackLight(vec2 light){
 float block=clamp(light.x/15.0,0.0,1.0),sky=clamp(light.y/15.0,0.0,1.0);
 float attenuation=pow(block,10.0)*1.6+block*.6;
 vec3 scene=uPackDimension==0.0?(uPackAmbient*sky+uPackDirect*.6)*sky*sky:uPackAmbient+uPackDirect*.6;
 vec3 linear=scene+uPackBlock*attenuation*attenuation+uPackMinimum*(1.0-sky*sky);
 return sqrt(max(linear,vec3(0.0)));
}
`;
