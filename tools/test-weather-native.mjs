// Native 1.20.6 weather (decompiled LevelRenderer gdo.renderSnowAndRain / tickRain, ClientLevel fxx.animateTick,
// Biome dcz.getHeightAdjustedTemperature). Expected random values come from the pinned client's RandomSource.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {initBlocks,findState} from '../client/js/world/blocks.js';
import {temperatureNoise} from '../client/js/world/biome-info-noise.js';
import {initBiomes} from '../client/js/world/biomes.js';
import {Weather,columnRandom} from '../client/js/render/weather.js';
import {JavaRandom} from '../client/js/util/jrandom.js';

const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url),'utf8'));
const shapes=json('blockCollisionShapes');initBlocks(json('blocks'),shapes);
const biomes=json('biomes'),biomeId=n=>biomes.find(b=>b.name===n).id;
initBiomes(biomes,new Uint8ClampedArray(256*256*4),new Uint8ClampedArray(256*256*4));

// gdo: azh.a(seed) per column; rain uses nextFloat, snow nextDouble/nextGaussian/nextDouble/nextGaussian
const NATIVE_COLUMNS=[[0,0,3.7309678,0.730967787376657,-1.2895731239084833,0.5504370051176339,0.6829853173685814],
 [5,-3,3.7006378,0.7006377797289546,3.114871344215155,0.35760415118069666,1.5376474274989396],
 [-17,42,3.5338793,0.533879233842473,2.1907280720725826,0.4428303578294652,0.5648629447258836],
 [1557,2130,3.5362139,0.5362138025118711,0.8175597375388246,0.05048816649894583,-1.2119841755577816],
 [-300,-7,3.8601608,0.8601607831510799,2.1716511689495763,0.5710363761319309,-1.424749119723828]];

test('per-column rain speed and snow drift match the native column random',()=>{
 for(const [x,z,speed,su,sug,sv,svg] of NATIVE_COLUMNS){const c=columnRandom(x,z);
  assert.equal(c.rainSpeed,Math.fround(speed));assert.equal(c.su,su);assert.equal(c.sug,sug);assert.equal(c.sv,sv);assert.equal(c.svg,svg);}
 const t=new JavaRandom(BigInt.asIntN(64,1234n*312987231n));assert.deepEqual([t.nextInt(21),t.nextInt(21),t.nextDouble()],[8,16,0.36966110531722696]);
});

test('Biome.TEMPERATURE_NOISE (seed 1234) matches the native PerlinSimplexNoise',()=>{
 const expected=[[10/8,-20/8,0.8136667115405001],[1557/8,2130/8,0.8195592918620891],[-333.5,77.25,-0.45240621555668503],[0,0,0],[12345/8,-999/8,0.8868302405855427]];
 for(const [x,z,v] of expected)assert.equal(temperatureNoise(x,z),v);
});

function fixture({fancy=true,rain=1,biome='plains',top=64,particles=0}={}){
 const sections=[],masks=Uint8Array.from(shapes.debugHeightmaps.masks,c=>parseInt(c,16));assert.ok(masks.length);
 const chunk={getSection:sy=>sections[sy]};
 const stone=findState('stone');
 const g={settings:{fancyGraphics:fancy,fabulousGraphics:false,particles},inWorld:true,assets:{data:{blockCollisionShapes:shapes},texture:()=>({})},
  device:{createMesh:()=>({}),updateMesh(m,data){m.data=data.slice();}},renderer:{extraDraws:[],camPos:[0.5,65.62,0.5]},
  player:{x:0.5,y:64,z:0.5},sound:{played:[],play(...a){this.played.push(a);}},particles:{rain:[],smoke:[],randomDisplayTick(){},nativeParticle(){}},
  world:{minY:-64,minSection:-4,maxSection:20,rainStrength:rain,getChunk:()=>chunk,getBiome:()=>biomeId(biome),getSkyLight:()=>15,getBlockLight:()=>0,
   getState:(x,y,z)=>y<top?stone:0}};
 g.particles.rain=(...a)=>g.particles.rainCalls=(g.particles.rainCalls||0)+1;g.particles.smoke=()=>{};
 sections[Math.floor((top-1)/16)]={nonAir:1,get:(x,y,z)=>(Math.floor((top-1)/16)*16+y)<top?stone:0};
 return {g,w:new Weather(g),chunk,sections};
}

test('fast graphics renders a radius of 5 and fancy a radius of 10; rain and snow alphas follow their own falloff',()=>{
 const fancy=fixture(),fast=fixture({fancy:false});
 fancy.w.render(0,0.5,65.62,0.5);fast.w.render(0,0.5,65.62,0.5);
 assert.equal(fancy.w.layers.rain.count,21*21-1,'the camera column is degenerate (0/0) natively');assert.equal(fast.w.layers.rain.count,11*11-1);
 const snow=fixture({biome:'snowy_plains'});snow.w.render(0,0.5,65.62,0.5);assert.equal(snow.w.layers.snow.count,440);assert.equal(snow.w.layers.rain.count,0);
 // the column east of the camera: distance 0.1, alpha 0.995 for rain, 0.797 for snow; snow light is raised to (L*3+15)/4
 const at=(L)=>{const D=L.mesh.data,stride=11;for(let o=0;o<D.length;o+=stride*4)if(Math.abs(D[o]-1.5)<0.6&&Math.abs(D[o+2]-0.5)<0.6&&D[o+1]>66)return D.slice(o,o+stride);};
 assert.ok(Math.abs(at(fancy.w.layers.rain)[8]-0.995)<1e-6);const s=at(snow.w.layers.snow);assert.ok(Math.abs(s[8]-0.797)<1e-6);assert.equal(s[9],((15*48+240)>>2)/16);
 const dark=fixture({biome:'snowy_plains'});dark.g.world.getSkyLight=()=>0;dark.w.render(0,0.5,65.62,0.5);assert.equal(at(dark.w.layers.snow)[9],((0*48+240)>>2)/16);
});

test('desert has no precipitation; high cold-enough columns turn rain into snow by the noisy height temperature',()=>{
 const d=fixture({biome:'desert'});d.w.render(0,0.5,65.62,0.5);assert.equal(d.w.layers.rain.count+d.w.layers.snow.count,0);
 const m=fixture({biome:'windswept_hills',top:180});m.w.render(0,0.5,181.62,0.5);assert.ok(m.w.layers.snow.count>0,'windswept hills (0.2) snow high above y 80');
});

test('tick rain halves on fast graphics and decreased particles, and lands on the block top',()=>{
 const full=fixture(),fast=fixture({fancy:false}),less=fixture({particles:1}),min=fixture({particles:2});
 for(const f of [full,fast,less,min]){f.w.updateCount=7;f.w._rainParticles();}
 assert.equal(full.g.particles.rainCalls,100);assert.equal(fast.g.particles.rainCalls,25);assert.equal(less.g.particles.rainCalls,50);assert.equal(min.g.particles.rainCalls,undefined);
});

test('MOTION_BLOCKING heights come from native masks, and block changes invalidate them',()=>{
 const {w,chunk,sections}=fixture();const leaves=findState('oak_leaves'),torch=findState('torch');
 let above=0;sections[4]={nonAir:1,get:(x,y,z)=>y===5?above:0};
 assert.equal(w.precipHeight(0,0),64);
 above=torch;chunk.blockRevision=1;assert.equal(w.precipHeight(0,0),64,'torches do not stop rain');
 above=leaves;chunk.blockRevision=2;assert.equal(w.precipHeight(0,0),70,'leaves do');
});
