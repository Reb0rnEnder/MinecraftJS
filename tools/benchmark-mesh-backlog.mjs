import {performance} from 'node:perf_hooks';import {setPlatform} from '../client/js/platform/platform.js';import {Game} from '../client/js/game/game.js';import {DirtySections} from '../client/js/render/dirty-sections.js';import {baselineLargeRangeScheduler} from './fixtures/mesh-scheduler-32-baseline.js';
setPlatform({now:()=>performance.now()});
function fixture(){
 const blocks=new Uint16Array(4096),section={nonAir:1,blocks,blockLight:new Uint8Array(2048),skyLight:new Uint8Array(2048)},empty={...section,nonAir:0},chunk={minY:-64,maxY:320,hasSky:true,getSection:y=>y===4?section:empty},world={getChunk:()=>chunk,getBiome:()=>1};
 const g={assets:{worker:{}},renderer:{sections:new Map(),removeSection(){}},world,settings:{renderDistance:32,prioritizeChunkUpdates:'byPlayer',biomeBlendRadius:0},_lodCamera:()=>[0,64,0],_updateLod(){},_lodFor:()=>false};Game.prototype._setupWorker.call(g);g.worker.postMessage=()=>{};
 for(let x=-32;x<=32;x++)for(let z=-32;z<=32;z++)for(let y=-4;y<20;y++)g.dirty.add(`${x},${y},${z}`);return g;
}
function measure(fn){const g=fixture(),frames=[];for(let i=0;i<60;i++){g.inFlight.clear();const t=performance.now();fn.call(g);frames.push(performance.now()-t);}const sorted=frames.slice(5).sort((a,b)=>a-b);return {medianMs:sorted[Math.floor(sorted.length/2)],p95Ms:sorted[Math.floor(sorted.length*.95)],firstFrameMs:frames[0],remainingDirty:g.dirty.size};}
console.log(JSON.stringify({scope:'Synthetic CPU replay, same 101400 in-range dirty entries and actual scheduler; not gameplay FPS',before:measure(baselineLargeRangeScheduler),after:measure(Game.prototype._scheduleMeshes)},null,2));
