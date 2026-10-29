import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Hud} from '../client/js/gui/hud.js';import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
import {debugLeft,columnHeights,packetHeight,packetRates,soundStats} from '../client/js/gui/debug-overlay.js';
import {platform,setPlatform} from '../client/js/platform/platform.js';import {initBlocks,blocksByName} from '../client/js/world/blocks.js';
import {initBiomes} from '../client/js/world/biomes.js';import {World} from '../client/js/world/world.js';import {Chunk} from '../client/js/world/chunk.js';
const v=VANILLA_UI.version,minor=Number(v.split('.')[1]),read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url))),shapes=read('blockCollisionShapes');
initBlocks(read('blocks'),shapes);initBiomes(read('biomes'));setPlatform({now:()=>1000,info:()=>({runtime:'Test Browser',bits:64,cpu:'Test CPU',memory:{used:16*1048576,total:32*1048576,max:64*1048576}}),width:854,height:480});
const state=name=>{const b=blocksByName[name];return b.defaultState??b.id<<4;};
function fixture(){
 const world=new World(),chunk=new Chunk(0,0,true);world.chunks.set('0,0',chunk);chunk.biomes.fill(1);chunk.setState(0,62,0,state('stone'));chunk.setState(0,63,0,state('water'));chunk.setState(0,64,0,state(minor>=13?'grass':'tallgrass'));
 const g={player:{x:.5,y:64,z:.5,yaw:180,pitch:0},settings:{renderDistance:32,maxFps:0,enableVsync:false,fancyGraphics:false,clouds:0,useVbo:true,biomeBlendRadius:2},serverViewDistance:10,serverBrand:'vanilla',fps:660,chunkUpdates:3,renderer:{visibleSections:36,sections:new Map()},entityRenderer:{stats:{total:2,culled:1}},entities:{count:()=>2,all:()=>[{x:0,y:64,z:0},{x:20,y:64,z:20}]},particles:{count:()=>126},world,dimension:0,dirty:new Set(),inFlight:new Map(),assets:{worker:{workers:[{busy:false}]},data:{blockCollisionShapes:shapes}},difficulty:1,interaction:{target:{type:'block',state:state('stone'),x:5,y:64,z:6}},device:{name:'WebGL 2',info:{vendor:'Test',renderer:'Test GPU',version:'WebGL 2'}},sound:{playing:new Set(),biomeSounds:{mood:.4}},tags:{forEntry:kind=>kind==='blocks'?['minecraft:enderman_holdable']:['minecraft:water']}};
 const hud=Object.create(Hud.prototype);hud.game=g;hud.debugTargets={block:g.interaction.target,fluid:{x:7,y:63,z:8,state:state('water')}};return{g,hud,chunk};
}
test(v+': full F3 line families and ordering follow this exact native release',()=>{
 const{hud}=fixture(),lines=debugLeft(hud),right=hud._debugRight();
 assert.equal(lines[0],`MinecraftJS ${v} (${v}/vanilla)`);assert.equal(lines[1].includes('chunk update'),minor<15);assert.equal(lines[1].includes(' vbo'),minor<15);assert.equal(lines[1].includes(' B: 2'),minor>=15);
 assert.equal(lines.some(s=>s.includes('"vanilla" server, 0 tx, 0 rx')),minor>=13);
 assert.equal(lines.some(s=>s.startsWith('Client Light:')),minor>=14);assert.equal(lines.some(s=>s.startsWith('CH ')),minor>=14);assert.equal(lines.some(s=>s.startsWith('SH ')),minor>=15);
 assert.equal(lines.some(s=>s.startsWith('Server Light:')),minor===15||minor===16);
 assert.equal(lines.some(s=>s.startsWith('Sounds:')),minor>=14);assert.equal(lines.some(s=>s.includes('(Mood 40%)')),minor>=16);
 assert.equal(lines.some(s=>s.includes('FC:')),minor>=13);if(minor>=13)assert.ok(lines.includes('minecraft:overworld FC: '+(minor===13?'n/a':'0')));
 assert.equal(lines.some(s=>s.includes('I: 0')),minor<14);assert.equal(lines.some(s=>s.includes('T: All:')),minor<14);
 assert.equal(lines.some(s=>s.startsWith('Looking at:')),minor<13);assert.equal(lines.some(s=>s.startsWith('Looking at block:')),minor>=13&&minor<16);
 if(minor>=16){assert.ok(right.includes('§nTargeted Block: 5, 64, 6'));assert.ok(right.includes('§nTargeted Fluid: 7, 63, 8'));assert.ok(right.includes('#minecraft:enderman_holdable'));}
 else if(minor>=13){assert.ok(right.includes('§nTargeted Block'));assert.ok(right.includes('§nTargeted Fluid'));}
 assert.ok(right.includes('Allocated: 50% 032MB'));assert.equal(lines.some(s=>s==='For help: press F3 + Q'),v!=='1.8.9');
 const local=lines.find(s=>s.startsWith('Local Difficulty:'));assert.equal(local.includes('//'),v!=='1.8.9');
 if(minor>=17)assert.ok(lines.includes('Chunks[C] W: 729, 1 E: 2,2,1'));else if(minor>=14)assert.ok(lines.includes('Client Chunk Cache: 729, 1'));
 assert.ok(lines.some(s=>s.startsWith('C: 36/67600 ')));
});
test(v+': reduced debug suppresses coordinates and target details while keeping native footer',()=>{
 const{g,hud}=fixture();g.reducedDebug=true;const left=hud._debugLeft(),right=hud._debugRight();
 assert.ok(left.includes('Chunk-relative: 0 0 0'));assert.ok(!left.some(s=>/^(XYZ:|Biome:|CH |SH |Looking at|Local Difficulty:)|FC:/.test(s)));assert.ok(!right.some(s=>s.includes('Targeted')||s.includes('minecraft:stone')));assert.equal(left.includes('For help: press F3 + Q'),v!=='1.8.9');
});
if(minor>=14)test(v+': native heightmap filters distinguish plants, fluids and solid blocks, then invalidate on block changes',()=>{
 const{g,chunk}=fixture();assert.equal(shapes.debugHeightmaps.source.version,v);assert.equal(shapes.debugHeightmaps.masks.length,shapes.render.states.length);
 assert.deepEqual(columnHeights(g,chunk,0,0),{S:64,M:63});chunk.setState(0,65,0,state('stone'));assert.deepEqual(columnHeights(g,chunk,0,0),{S:65,M:65});
});
if(minor>=14)test(v+': native packed heightmap reads retain column order at long boundaries',()=>{
 const values=Array.from({length:256},(_,i)=>10+i%200),padded=minor>=16,raw=new Array(padded?37:36).fill(0n);
 for(let i=0;i<256;i++){const word=padded?Math.floor(i/7):Math.floor(i*9/64),shift=padded?i%7*9:i*9%64;raw[word]|=BigInt(values[i]+1)<<BigInt(shift);if(!padded&&shift>55)raw[word+1]|=BigInt(values[i]+1)>>BigInt(64-shift);}
 const chunk={heightmaps:{v:{WORLD_SURFACE:{v:raw.map(n=>BigInt.asIntN(64,n))}}}};for(let i=0;i<256;i++)assert.equal(packetHeight(chunk,'WORLD_SURFACE',i%16,Math.floor(i/16)),values[i]);
});
test(v+': packet rates count real sent/received packets and browser audio reports actual pools',()=>{
 const c={packetsOut:0,packetsIn:0};assert.deepEqual(packetRates(c,0),{tx:0,rx:0});c.packetsOut=5;c.packetsIn=17;assert.deepEqual(packetRates(c,1000),{tx:5,rx:17});assert.equal(soundStats({playing:new Set([{stream:false},{stream:true}])}),'Sounds: 1/∞ + 1/∞');
});

if(minor>=13)test(v+': the effective payload handler retains server branding and Eagler texture dispatch',async()=>{
 const{Game}=await import('../client/js/game/game.js'),{Writer}=await import('../client/js/net/buffer.js');let calls=0;
 const g={eaglerTextures:{handle(){calls++;}}};Game.prototype.on_custom_payload.call(g,{channel:'minecraft:brand',data:new Writer().string('Paper Test').build()});
 assert.equal(g.serverBrand,'Paper Test');assert.equal(calls,1);
});

test(v+': active native post-processing shader is reported only in full debug mode',()=>{const{g,hud}=fixture();g.debugShaderName='minecraft:shaders/post/creeper.json';assert.ok(hud._debugLeft().includes('Shader: minecraft:shaders/post/creeper.json'));g.reducedDebug=true;assert.ok(!hud._debugLeft().some(s=>s.startsWith('Shader:')));});

if(minor>=13)test(v+': traffic sampling continues while the F3 overlay is hidden',()=>{
 const previous=platform();let now=0;setPlatform({...previous,now:()=>now});
 try{const{g,hud}=fixture();g.conn={packetsOut:0,packetsIn:0};hud.processQueuedChat=()=>{};hud.updateCounter=0;hud.tick();now=1000;g.conn.packetsOut=5;g.conn.packetsIn=20;hud.tick();now=2000;g.conn.packetsOut=11;g.conn.packetsIn=42;hud.tick();assert.deepEqual(packetRates(g.conn,now),{tx:6,rx:22});}finally{setPlatform(previous);}
});
