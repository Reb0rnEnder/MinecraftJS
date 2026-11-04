import {performance} from 'node:perf_hooks';
import {Game} from '../client/js/game/game.js';
import {DirtySections} from '../client/js/render/dirty-sections.js';
import {SectionCuller} from '../client/js/render/culling.js';
import {World} from '../client/js/world/world.js';
import {baselineScheduleMeshes} from './fixtures/mesh-scheduler-baseline.js';
import {setPlatform} from '../client/js/platform/platform.js';
setPlatform({now:()=>performance.now()});
const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
function scheduleFixture(Queue){const g={assets:{worker:{}},renderer:{sections:new Map()},world:{getChunk:()=>null},settings:{renderDistance:10,prioritizeChunkUpdates:'none'},_lodCamera:()=>[0,64,0],_updateLod(){}};Game.prototype._setupWorker.call(g);g.dirty=new Queue();for(let x=-32;x<=32;x++)for(let z=-32;z<=32;z++)if(Math.abs(x)>11||Math.abs(z)>11)for(let y=-4;y<20;y++)g.dirty.add([x,y,z].join(','));return g;}
const before=scheduleFixture(Set),after=scheduleFixture(DirtySections);
for(let i=0;i<4;i++){baselineScheduleMeshes.call(before);Game.prototype._scheduleMeshes.call(after);}
const measure=(fn,frames)=>{const rounds=[];for(let r=0;r<5;r++){const start=performance.now();for(let i=0;i<frames;i++)fn(i);rounds.push((performance.now()-start)/frames);}return{medianMsPerCall:median(rounds),roundsMsPerCall:rounds};};
const scheduling={serverRadius:32,clientRadius:10,pendingSections:before.dirty.size,framesPerRound:15,before:measure(()=>baselineScheduleMeshes.call(before),15),after:measure(()=>Game.prototype._scheduleMeshes.call(after),15)};
const world=new World();for(let x=-10;x<=10;x++)for(let z=-10;z<=10;z++)world.chunks.set(x+','+z,{});world._gen++;
const oldCull=new SectionCuller(),newCull=new SectionCuller(),sections=new Map(),bounds={minSection:world.minSection??0,sectionCount:world.sectionCount??16},column=(x,z)=>!!world.getChunk(x,z);
const walk=(c,i,revision)=>c.update(sections,[],[1+(i%100)/100,65,1],32,column,false,Infinity,bounds,revision);
for(let i=0;i<10;i++){walk(oldCull,i);walk(newCull,i,world._gen);}
const culling={clientRadius:32,serverRadius:10,framesPerRound:30,before:measure(i=>walk(oldCull,i),30),after:measure(i=>walk(newCull,i,world._gen),30)};
console.log(JSON.stringify({node:process.version,scope:'Synthetic CPU replay of actual Game scheduler and SectionCuller; not whole-frame FPS or user GPU measurements',scheduling,culling},null,2));
