import {Atlas} from './atlas.js';
import {decodePng} from '../util/png.js';
import {decodeUtf8} from '../util/utf8.js';

// Sprite lists belong to particles/*.json; animation timing belongs to the particle, not .mcmeta.
export async function loadParticleSprites(assets) {
  const definitions=structuredClone(assets.data.particleSprites||{});
  for(const pack of [...assets.packs].reverse())for(const path of pack.list('particles/'))if(path.endsWith('.json')) {
    try { definitions[path.slice(10,-5)]=JSON.parse(decodeUtf8(pack.read(path))); } catch { /* malformed pack definition */ }
  }
  const names=new Set(Object.values(definitions).flatMap(d=>Array.isArray(d.textures)?d.textures:[]));
  const textures=(await Promise.all([...names].map(async name=>{
    const [ns,path]=name.includes(':')?name.split(':'):['minecraft',name];
    try {
      const bytes=await assets.readResourceBytes(`${ns}:textures/particle/${path}.png`);
      return bytes?{name,image:decodePng(bytes)}:null;
    } catch { return null; }
  }))).filter(Boolean);
  const atlas=new Atlas();atlas.build(textures,{});
  if(assets.particleTexture)assets.device.destroyTexture(assets.particleTexture);
  assets.particleTexture=assets.device.createTexture({width:atlas.size,height:atlas.size,data:atlas.data,filter:'nearest'});
  assets.particleAtlas=atlas;
  assets.particleSprites=Object.fromEntries(Object.entries(definitions).map(([name,d])=>[name,(d.textures||[]).filter(t=>atlas.has(t))]));
}

export function particleSprite(assets,particle,partial=0) {
  const frames=assets.particleSprites?.[particle.sprite||'poof'];
  if(!frames?.length)return null;
  const frame=particle.spriteMode==='random'?Math.floor((particle.spriteRandom??0)*frames.length):Math.floor((particle.age+partial)*frames.length/(particle.maxAge+1));
  return assets.particleAtlas.uv(frames[Math.max(0,Math.min(frames.length-1,frame))]);
}
