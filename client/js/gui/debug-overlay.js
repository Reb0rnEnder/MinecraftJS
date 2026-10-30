import {VANILLA_UI} from './vanilla-layout.js';
import {platform} from '../platform/platform.js';
import {biomeInfo} from '../world/biomes.js';
const version=VANILLA_UI.version;
const since=minor=>Number(version.split('.')[1])>=minor;
const namespace=name=>name?.includes(':')?name:'minecraft:'+(name||'plains');
const wrap=a=>((a+180)%360+360)%360-180;
const rates=new WeakMap(),columns=new WeakMap();
export function packetRates(conn,now){
 if(!conn)return{tx:0,rx:0};
 let sample=rates.get(conn);if(!sample){sample={at:now,sent:conn.packetsOut||0,received:conn.packetsIn||0,tx:0,rx:0};rates.set(conn,sample);}
 const elapsed=now-sample.at;
 if(elapsed>=1000){sample.tx=Math.round(((conn.packetsOut||0)-sample.sent)*1000/elapsed);sample.rx=Math.round(((conn.packetsIn||0)-sample.received)*1000/elapsed);sample.at=now;sample.sent=conn.packetsOut||0;sample.received=conn.packetsIn||0;}
 return{tx:sample.tx,rx:sample.rx};
}
// Native predicates, not collision bounds, determine which blocks enter each heightmap.
export function columnHeights(game,chunk,x,z){
 const masks=game.assets?.data?.blockCollisionShapes?.debugHeightmaps?.masks;
 if(!masks||!chunk?.getState)return{S:'??',M:'??'};
 let cache=columns.get(chunk),revision=chunk.debugHeightRevision||0;
 if(!cache||cache.revision!==revision){cache={revision,values:new Map()};columns.set(chunk,cache);}
 const key=(z&15)*16+(x&15);if(cache.values.has(key))return cache.values.get(key);
 const min=chunk.minY??0,max=chunk.maxY??256;let S=min-1,M=min-1;
 for(let y=max-1;y>=min&&(S<min||M<min);y--){const mask=parseInt(masks[chunk.getState(x&15,y,z&15)],16);if(S<min&&(mask&1))S=y;if(M<min&&(mask&4))M=y;}
 const result={S,M};cache.values.set(key,result);return result;
}
// Heightmaps were continuous bit arrays before 1.16 and padded per long afterwards.
export function packetHeight(chunk,type,x,z){
 const raw=chunk.heightmaps?.v?.[type]?.v??chunk.heightmaps?.[type];if(!raw?.length)return -1;
 const index=(z&15)*16+(x&15),padded=since(16),bits=Math.ceil(Math.log2((chunk.height??256)+1)),perLong=Math.floor(64/bits),word=padded?Math.floor(index/perLong):Math.floor(index*bits/64),shift=padded?(index%perLong)*bits:index*bits%64;
 if(raw[word]===undefined)return -1;let value=BigInt.asUintN(64,BigInt(raw[word]))>>BigInt(shift);
 if(!padded&&shift>64-bits&&raw[word+1]!==undefined)value|=BigInt.asUintN(64,BigInt(raw[word+1]))<<BigInt(64-shift);
 return Number(value&((1n<<BigInt(bits))-1n))+(chunk.minY??0)-1;
}
export function localDifficulty(difficulty,time,moonOverride){
 if(!difficulty)return 0;
 const f=Math.fround,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),moon=moonOverride??[1,.75,.5,.25,0,.25,.5,.75][((Math.trunc(time/24000)%8)+8)%8];
 const age=f(clamp(f(f(f(time)-72000)/1440000),0,1)*f(.25));
 let extra=f(clamp(f(moon*f(.25)),0,age));if(difficulty===1)extra=f(extra*f(.5));
 return f(difficulty*f(f(f(.75)+age)+extra));
}
export function soundStats(sound){
 let regular=0,streaming=0;for(const h of sound?.playing||[]){if(h.stream)streaming++;else regular++;}
 // WebAudio has no OpenAL source-pool limit. Do not invent Java/OpenAL hardware values.
 return `Sounds: ${regular}/${sound?.audio?.maxStaticVoices??'∞'} + ${streaming}/${sound?.audio?.maxStreamingVoices??'∞'}`;
}
export function debugLeft(hud){
 const g=hud.game,s=g.settings,r=g.renderer,pl=g.player,w=g.world,er=g.entityRenderer?.stats||{total:0,culled:0};
 const distance=s.renderDistance||0,loaded=w.chunks?.size||0,entities=g.entities.count?.()??g.entities.map?.size??0;
 let fps=`${g.fps} fps`;
 if(!since(15)){const n=g.chunkUpdates||0;fps+=` (${n} chunk update${n===1?'':'s'})`;}
 fps+=` T: ${s.maxFps||'inf'}${s.enableVsync?' vsync':''}`;
 fps+=since(16)?(s.fabulousGraphics?' fabulous':s.fancyGraphics?' fancy':' fast'):(s.fancyGraphics?'':' fast');
 fps+=!s.clouds?'':s.clouds===1?' fast-clouds':' fancy-clouds';
 fps+=since(15)?` B: ${s.biomeBlendRadius??2}`:s.useVbo!==false?' vbo':'';
 const workers=g.assets.worker?.workers?.filter(worker=>!worker.busy).length??1;
 const totalSections=(2*distance+1)**2*16;
 const lines=[`MinecraftJS ${version} (${version}/vanilla)`,fps];
 if(since(13)){const rate=packetRates(g.conn,platform().now());lines.push(`"${g.serverBrand??'null'}" server, ${rate.tx} tx, ${rate.rx} rx`);}
 lines.push(`C: ${r.visibleSections||0}/${totalSections} (s) D: ${distance}, ${['1.12.2','1.13.2'].includes(version)?'L: 0, ':''}pC: ${String(g.dirty?.size||0).padStart(3,'0')}, pU: ${g.inFlight?.size||0}, aB: ${workers}`);
 lines.push(`E: ${Math.max(0,er.total-er.culled)}/${entities}, B: ${er.culled||0}${since(14)?'':', I: '+(er.invisible||0)}`);
 lines.push(`P: ${g.particles.count?.()||0}. T: ${since(14)?'':'All: '}${entities}`);
 const capacity=(2*(Math.max(2,g.serverViewDistance??distance)+3)+1)**2;
 if(since(17)){
  const sections=new Set();for(const e of g.entities.all?.()||[])sections.add(`${Math.floor(e.x/16)},${Math.floor(e.y/16)},${Math.floor(e.z/16)}`);
  lines.push(`Chunks[C] W: ${capacity}, ${loaded} E: ${entities},${sections.size},${loaded}`);
 }else lines.push(since(14)?`Client Chunk Cache: ${capacity}, ${loaded}`:`MultiplayerChunkCache: ${loaded}, ${loaded}`);
 const bx=Math.floor(pl.x),by=Math.floor(pl.y),bz=Math.floor(pl.z),reduced=g.reducedDebug||s.reducedDebugInfo;
 const footer=()=>{if(version!=='1.8.9')lines.push('',`Debug: Pie [shift]: ${g.showProfiler?'visible':'hidden'} FPS [alt]: ${g.showLagometer?'visible':'hidden'}`,'For help: press F3 + Q');return lines;};
 if(reduced){lines.push('',`Chunk-relative: ${bx&15} ${by&15} ${bz&15}`);return footer();}
 if(since(13)){const dim=g.worldName||{0:'minecraft:overworld',[-1]:'minecraft:the_nether',1:'minecraft:the_end'}[g.dimension??w.dimension??0];lines.push(`${dim||'Unknown dimension'} FC: ${since(14)?0:'n/a'}`);}
 lines.push('',`XYZ: ${pl.x.toFixed(3)} / ${pl.y.toFixed(5)} / ${pl.z.toFixed(3)}`,`Block: ${bx} ${by} ${bz}`,`Chunk: ${bx&15} ${by&15} ${bz&15} in ${bx>>4} ${by>>4} ${bz>>4}`);
 const direction=Math.floor(pl.yaw*4/360+.5)&3;
 lines.push(`Facing: ${['south','west','north','east'][direction]} (Towards ${['positive Z','negative X','negative Z','positive X'][direction]}) (${wrap(pl.yaw).toFixed(1)} / ${wrap(pl.pitch).toFixed(1)})`);
 const chunk=w.getChunk?.(bx>>4,bz>>4),inBounds=by>=(w.minY??0)&&by<(w.maxY??256);
 if(chunk&&(inBounds||since(17))){
  const biome=biomeInfo(w.getBiome(bx,bz,by)),sky=w.getSkyLight(bx,by,bz),block=w.getBlockLight(bx,by,bz);
  if(since(14)){
   lines.push(`Client Light: ${Math.max(sky,block)} (${sky} sky, ${block} block)`);
   if(['1.15.2','1.16.5'].includes(version))lines.push(`Server Light: (${sky} sky, ${block} block)`);
   const h=columnHeights(g,chunk,bx,bz);lines.push(`CH S: ${h.S} M: ${h.M}`);
   if(since(15))lines.push(`SH S: ${h.S} O: ${packetHeight(chunk,'OCEAN_FLOOR',bx,bz)} M: ${h.M} ML: ${packetHeight(chunk,'MOTION_BLOCKING_NO_LEAVES',bx,bz)}`);
  }
  if(inBounds){
   lines.push('Biome: '+(since(13)?namespace(biome.name):biome.displayName||biome.name));
   if(!since(14))lines.push(`Light: ${Math.max(sky,block)} (${sky} sky, ${block} block)`);
   const time=w.timeOfDay||0,d=localDifficulty(g.difficulty,time,version==='1.14.4'?0:undefined),clamped=d<2?0:d>4?1:Math.fround(Math.fround(d-2)/2);
   lines.push(`Local Difficulty: ${d.toFixed(2)}${version==='1.8.9'?'':' // '+clamped.toFixed(2)} (Day ${Math.trunc(time/24000)})`);
  }
 }else if(version!=='1.8.9')lines.push(!inBounds?'Outside of world...':'Waiting for chunk...');
 if(g.debugShaderName)lines.push('Shader: '+g.debugShaderName);
 if(since(13)&&!since(16)){const targets=hud.debugTargets;if(targets?.block){const t=targets.block;lines.push(`Looking at block: ${t.x} ${t.y} ${t.z}`);}if(targets?.fluid){const t=targets.fluid;lines.push(`Looking at liquid: ${t.x} ${t.y} ${t.z}`);}}
 else if(!since(13)){const t=g.interaction.target;if(t?.type==='block')lines.push(`Looking at: ${t.x} ${t.y} ${t.z}`);}
 if(since(14))lines.push(soundStats(g.sound)+(since(16)?` (Mood ${Math.round((g.sound?.biomeSounds?.mood||0)*100)}%)`:''));
 return footer();
}
