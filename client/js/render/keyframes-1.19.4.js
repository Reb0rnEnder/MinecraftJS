// KeyframeAnimations: time in milliseconds; native channels already contain
// radians, the position Y sign conversion, and scale deltas from one.
const clamp=v=>Math.max(0,Math.min(1,v));
export function sampleChannel762(channel,time,weight=1){
 const frames=channel.frames;let upper=frames.findIndex(k=>time<=k[0]);if(upper<0)upper=frames.length;const i=Math.max(0,upper-1),j=Math.min(frames.length-1,i+1),a=frames[i],b=frames[j],t=i===j?0:clamp((time-a[0])/(b[0]-a[0]));
 if(b[2]==='linear')return a[1].map((v,k)=>(v+(b[1][k]-v)*t)*weight);
 const p=frames[Math.max(0,i-1)][1],n=frames[Math.min(frames.length-1,j+1)][1];return a[1].map((v,k)=>.5*((2*v)+(-p[k]+b[1][k])*t+(2*p[k]-5*v+4*b[1][k]-n[k])*t*t+(-p[k]+3*v-3*b[1][k]+n[k])*t*t*t)*weight);
}
export function animateKeyframes762(parts,animation,millis,weight=1){
 if(!animation||weight===0)return;const seconds=Math.fround(Math.trunc(millis)/1000),time=animation.looping?seconds%animation.length:seconds;
 for(const[bone,channels]of Object.entries(animation.bones)){const part=parts[bone]||(bone==='root'?parts.$root:null);if(!part)continue;for(const channel of channels){const value=sampleChannel762(channel,time,weight),keys={position:['px','py','pz'],rotation:['rx','ry','rz'],scale:['sx','sy','sz']}[channel.target];keys.forEach((key,i)=>part[key]+=value[i]);}}
}
