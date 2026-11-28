// Native weather for this release (decompiled renderSnowAndRain / tickRain, the client's random display ticks and
// Biome height-adjusted temperature). NATIVE in weather.js records the per-release differences; random values here
// come from the pinned 1.20.6 client's RandomSource and are the same java.util.Random sequence in every release.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as blocks from '../client/js/world/blocks.js';
import {temperatureNoise} from '../client/js/world/biome-info-noise.js';
import {initBiomes,heightAdjustedTemperature,biomeInfo} from '../client/js/world/biomes.js';
import {Weather,columnRandom,NATIVE} from '../client/js/render/weather.js';
import {JavaRandom} from '../client/js/util/jrandom.js';

const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url),'utf8'));
const shapes=json('blockCollisionShapes');blocks.initBlocks(json('blocks'),shapes);
const biomes=json('biomes');initBiomes(biomes,new Uint8ClampedArray(256*256*4),new Uint8ClampedArray(256*256*4));
const biomeId=(...names)=>{for(const n of names){const b=biomes.find(x=>x.name===n);if(b)return b.id;}throw Error('no biome '+names);};
const state=(...names)=>{for(const n of names){if(blocks.findState){try{const s=blocks.findState(n);if(s)return s;}catch{}}const b=blocks.blocksByName?.[n];if(b)return b.defaultState??(b.id<<4);}throw Error('no block '+names);};

// azh/Random seeded per column; rain draws nextFloat (1.15+) or nextDouble (to 1.14), snow nextDouble/nextGaussian x2
const NATIVE_COLUMNS=[[0,0,3.7309678,0.730967787376657,-1.2895731239084833,0.5504370051176339,0.6829853173685814],
 [5,-3,3.7006378,0.7006377797289546,3.114871344215155,0.35760415118069666,1.5376474274989396],
 [-17,42,3.5338793,0.533879233842473,2.1907280720725826,0.4428303578294652,0.5648629447258836],
 [1557,2130,3.5362139,0.5362138025118711,0.8175597375388246,0.05048816649894583,-1.2119841755577816],
 [-300,-7,3.8601608,0.8601607831510799,2.1716511689495763,0.5710363761319309,-1.424749119723828]];

test('per-column rain speed and snow drift match the native column random',()=>{
 for(const [x,z,speed,su,sug,sv,svg] of NATIVE_COLUMNS){const c=columnRandom(x,z);
  assert.equal(c.rainSpeed,NATIVE.rainScroll==='double'?3+su:Math.fround(speed),'rain speed '+x+','+z);
  assert.equal(c.su,su);assert.equal(c.sug,sug);assert.equal(c.sv,sv);assert.equal(c.svg,svg);}
 const t=new JavaRandom(BigInt.asIntN(64,1234n*312987231n));assert.deepEqual([t.nextInt(21),t.nextInt(21),t.nextDouble()],[8,16,0.36966110531722696]);
});

test('TEMPERATURE_NOISE (seed 1234) matches the native simplex noise and drives the height-adjusted temperature',()=>{
 const expected=[[10/8,-20/8,0.8136667115405001],[1557/8,2130/8,0.8195592918620891],[-333.5,77.25,-0.45240621555668503],[0,0,0],[12345/8,-999/8,0.8868302405855427]];
 for(const [x,z,v] of expected)assert.equal(temperatureNoise(x,z),v);
 const modern=NATIVE.biomeY==='camera',above=modern?80:64,mul=modern?8:4,div=modern?40:30,b={temperature:0.8},f=Math.fround;
 assert.equal(heightAdjustedTemperature(b,10,above,-20),f(0.8),'no adjustment at the threshold');
 const n=f(0.8136667115405001*mul);assert.equal(heightAdjustedTemperature(b,10,above+30,-20),f(f(0.8)-f(f(f(f(n+above+30)-above)*f(0.05))/div)));
});

function fixture({fancy=true,rain=1,biome=null,top=64,particles=0,playerY=64}={}){
 const sections=[],stone=state('stone');
 const chunk={getSection:sy=>sections[sy]};
 const g={settings:{fancyGraphics:fancy,fabulousGraphics:false,particles},inWorld:true,assets:{data:{blockCollisionShapes:shapes},texture:()=>({})},
  device:{createMesh:()=>({}),updateMesh(m,data){m.data=data.slice();}},renderer:{extraDraws:[],camPos:[0.5,playerY+1.62,0.5]},
  player:{x:0.5,y:playerY,z:0.5,prevY:playerY},sound:{played:[],play(...a){this.played.push(a);}},particles:{randomDisplayTick(){},nativeParticle(){},smoke(){}},
  world:{minY:0,minSection:0,maxSection:16,rainStrength:rain,getChunk:()=>chunk,getBiome:()=>biome??biomeId('plains'),getSkyLight:()=>15,getBlockLight:()=>0,
   getState:(x,y,z)=>y<top?stone:0}};
 g.particles.rain=()=>g.particles.rainCalls=(g.particles.rainCalls||0)+1;
 const sy=Math.floor((top-1)/16);sections[sy]={nonAir:1,get:(x,y,z)=>(sy*16+y)<top?stone:0};
 return {g,w:new Weather(g),chunk,sections};
}
const snowy=()=>biomeId('snowy_plains','snowy_tundra','ice_flats','ice_plains');
const at=(L)=>{const D=L.mesh.data,stride=11;for(let o=0;o<D.length;o+=stride*4)if(Math.abs(D[o]-1.5)<0.6&&Math.abs(D[o+2]-0.5)<0.6&&D[o+1]>66)return D.slice(o,o+stride);};

test('configured weather radius renders identically across graphics modes; rain and snow alphas follow their own falloff',()=>{
 const fancy=fixture(),fast=fixture({fancy:false});
 fancy.w.render(0,0.5,65.62,0.5);fast.w.render(0,0.5,65.62,0.5);
  assert.equal(fancy.w.layers.rain.count,21*21-1,'the anchor column is degenerate (0/0) natively');assert.equal(fast.w.layers.rain.count,21*21-1);
 const snow=fixture({biome:snowy()});snow.w.render(0,0.5,65.62,0.5);assert.equal(snow.w.layers.snow.count,440);assert.equal(snow.w.layers.rain.count,0);
 // the column east of the anchor: distance 0.1, alpha 0.995 for rain, 0.797 for snow; snow light is raised to (L*3+15)/4
 assert.ok(Math.abs(at(fancy.w.layers.rain)[8]-0.995)<1e-6);const s=at(snow.w.layers.snow);assert.ok(Math.abs(s[8]-0.797)<1e-6);assert.equal(s[9],15);
 const dark=fixture({biome:snowy()});dark.g.world.getSkyLight=()=>0;dark.w.render(0,0.5,65.62,0.5);assert.equal(at(dark.w.layers.snow)[9],3.75);
 const lit=fixture({biome:snowy()});lit.g.world.getBlockLight=()=>4;lit.w.render(0,0.5,65.62,0.5);
 assert.equal(at(lit.w.layers.snow)[10],NATIVE.snowBlockLightTriple?Math.min(15,((12*48+240)>>2)/16):((4*48+240)>>2)/16,'1.15/1.16 triple snow block light');
});

test('desert has no precipitation; high columns of a 0.2 biome turn to snow by the noisy height temperature',()=>{
 const d=fixture({biome:biomeId('desert')});d.w.render(0,0.5,65.62,0.5);assert.equal(d.w.layers.rain.count+d.w.layers.snow.count,0);
 const hills=biomeId('windswept_hills','mountains','extreme_hills');assert.equal(Math.fround(biomeInfo(hills).temperature),Math.fround(0.2));
 const m=fixture({biome:hills,top:180,playerY:180});m.w.render(0,0.5,181.62,0.5);assert.ok(m.w.layers.snow.count>0);
 const low=fixture({biome:hills});low.w.render(0,0.5,65.62,0.5);assert.equal(low.w.layers.snow.count,0);
});

test('weather splash attempts ignore graphics mode, decrease for reduced particles, and minimal emits no particles',()=>{
 const full=fixture(),fast=fixture({fancy:false}),less=fixture({particles:1}),min=fixture({particles:2});
 for(const f of [full,fast,less,min]){f.w.updateCount=7;f.w._rainParticles();}
 assert.equal(full.g.particles.rainCalls,99);assert.equal(fast.g.particles.rainCalls,99);assert.equal(less.g.particles.rainCalls,49);assert.equal(min.g.particles.rainCalls,undefined);
});

test('rain splashes land on the block top and the rain sound plays',()=>{
 const f=fixture();const ys=[];f.g.particles.rain=(x,y,z)=>ys.push(y);for(let i=1;i<=6;i++){f.w.updateCount=i;f.w._rainParticles();}
 const expected=NATIVE.tick==='modern'?64:Math.fround(63.1)+1;assert.ok(ys.length&&ys.every(y=>Math.abs(y-expected)<1e-9),'splash height '+ys[0]);
 assert.ok(f.g.sound.played.length>0);assert.ok(f.g.sound.played.every(p=>NATIVE.sounds.includes(p[0])));
});

test('precipitation heights stop at leaves but not torches, and block changes invalidate them',()=>{
 const {w,chunk,sections}=fixture();const leaves=state('oak_leaves','leaves'),torch=state('torch');
 let above=0;sections[4]={nonAir:1,get:(x,y,z)=>y===5?above:0};
 assert.equal(w.precipHeight(0,0),64);
 above=torch;chunk.blockRevision=1;assert.equal(w.precipHeight(0,0),64,'torches do not stop rain');
 above=leaves;chunk.blockRevision=2;assert.equal(w.precipHeight(0,0),70,'leaves do');
});

test('random display ticks per game tick follow this release',()=>{
 const {g,w}=fixture();let n=0;g.world.getState=()=>(n++,0);w._ambience();
 assert.equal(n,NATIVE.displayTicks*NATIVE.displayRadii.length);
});
