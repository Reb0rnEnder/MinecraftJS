import {test} from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WorldBorder} from '../client/js/world/world-border.js';
import {World} from '../client/js/world/world.js';
import {LocalPlayer} from '../client/js/game/physics.js';
import {borderGeometry,BorderRenderer} from '../client/js/render/world-border.js';
import {setPlatform} from '../client/js/platform/platform.js';
const native=JSON.parse(readFileSync(new URL('./fixtures/border-look-native-1.19.4.json',import.meta.url)));
test('native JVM WorldBorder bounds and closest distances match, including absolute limits',()=>{
  for(const v of native.borders){const b=new WorldBorder(()=>0);b.x=v.center[0];b.z=v.center[1];b.setSize(v.size);b.absoluteMaxSize=v.limit;assert.deepEqual(b.bounds(),v.bounds);assert.equal(b.distance(...v.point),v.distance);}
});
test('border initialization retains diameter, moving extent, warning fields and absolute boundary',()=>{
  let now=1000;const b=new WorldBorder(()=>now);
  b.apply({action:3,x:4,z:-3,oldRadius:100,newRadius:20,speed:10000n,portalBoundary:500,warningBlocks:7,warningTime:9});
  assert.equal(b.radius,50);assert.deepEqual([b.warningBlocks,b.warningTime,b.absoluteMaxSize],[7,9,500]);
  now+=2500;assert.equal(b.size,80);assert.deepEqual(b.bounds(),[-36,-43,44,37]);assert.equal(b.status,'shrinking');assert.equal(b.color,0xff3030);
  now+=7500;b.tick();assert.equal(b.size,20);assert.equal(b.speed,0);assert.equal(b.status,'stationary');
  b.apply({action:1,oldRadius:20,newRadius:120,speed:1000});now+=500;assert.equal(b.size,70);assert.equal(b.color,0x40ff80);
  b.apply({action:0,radius:50});assert.equal(b.radius,25);assert.equal(b.remaining,0);
  b.reset();assert.equal(b.size,59999968);assert.equal(b.warningBlocks,5);
});
test('warning combines native movement speed/time and warning distance',()=>{
  let now=0;const b=new WorldBorder(()=>now);b.warningTime=2;b.warningBlocks=3;b.lerp(100,20,10000);
  assert.equal(b.warning(0,0),0);assert.equal(b.warning(40,0),Math.fround(1-Math.fround(10/16)));
  now=9500;assert.equal(b.size,24);assert.equal(b.warning(10,0),.5);
  b.setSize(20);b.warningBlocks=0;assert.equal(b.warning(0,0),0);assert.equal(b.warning(10,0),0);
});
test('border voxel shape stops movement at fractional bounds rounded outward, and permits return from outside',()=>{
  const world=new World(),b=world.worldBorder=new WorldBorder(()=>0);b.setSize(10.5);
  world.isLoaded=()=>true;world.getState=()=>0;world.collisionBoxes=()=>{};
  const p=new LocalPlayer();p.x=5;p.y=70;p.z=0;p._bb=null;
  const boxes=world.getCollisions([4.7,70,-.3,6.5,71.8,.3],p);
  assert.ok(boxes.some(a=>a[0]===6),'ceil(maxX) outside shape');
  p.moveEntity(world,1,0,0);assert.equal(p.bb()[3],6);assert.equal(p.collidedH,true);
  p.setPosition(12,70,0);p.moveEntity(world,-1,0,0);assert.equal(p.x,11,'outside entity is not trapped');
  const none=[];b.collisions([-10,60,-10,10,80,10],null,none);assert.deepEqual(none,[]);
});
test('legacy float lerp, one-sided bounds and outside-border hysteresis remain distinct',()=>{
  let now=0;const b=new WorldBorder(()=>now,{legacyTime:true,legacyBounds:true,collisionMode:'legacy'});
  b.lerp(100,20,3000);now=1000;assert.equal(b.size,100+Math.fround(1/3)*-80);
  b.x=105;b.absoluteMaxSize=100;b.setSize(10);assert.deepEqual(b.bounds(),[100,-5,100,5]);
  b.x=106;assert.deepEqual(b.bounds(),[101,-5,100,5],'old native bounds can invert outside absolute limits');
  b.x=0;b.absoluteMaxSize=29999984;b.setSize(10);
  const mover={x:5.5,z:0,outsideBorder:false},out=[];b.collisions([5,0,0,6,2,1],mover,out);assert.equal(mover.outsideBorder,false);assert.ok(out.length);
  mover.x=6.5;b.collisions([6,0,0,7,2,1],mover,[]);assert.equal(mover.outsideBorder,true);
  mover.x=4.5;b.collisions([4,0,0,5,2,1],mover,[]);assert.equal(mover.outsideBorder,true);
  mover.x=3.5;b.collisions([3,0,0,4,2,1],mover,[]);assert.equal(mover.outsideBorder,false);
});
test('border wall uses native texture phase, colors, vertical extent and old rendering modes',()=>{
  const b=new WorldBorder(()=>0);b.setSize(20);
  assert.equal(borderGeometry(b,[0,70,0],4,1500),null);
  const g=borderGeometry(b,[9,70,0],4,1500);
  assert.equal(g.data.length,8*4*9);assert.deepEqual(g.rgba,[32/255,160/255,1,.75**4]);
  assert.deepEqual([...g.data.slice(0,5)],[1,-16,-4,.5,-18.5]);
  const classic=borderGeometry(b,[9,70,0],4,1500,{mode:'classic'}),raised=borderGeometry(b,[9,70,0],4,1500,{mode:'raised'});
  assert.deepEqual([...classic.data.slice(0,5)],[1,-70,-4,.5,128.5]);
  assert.deepEqual([...raised.data.slice(0,5)],[1,-16,-4,.5,-53.5]);
});
test('renderer submits the native forcefield with additive blending and reuses its mesh',()=>{
  setPlatform({now:()=>1500});const calls=[],device={createMesh:(format,data,opts)=>({format,data,opts}),updateMesh:(m,data)=>{m.data=data;},draw:d=>calls.push(d)},g={inWorld:true,player:{x:9,y:70,z:0},worldBorder:new WorldBorder(()=>0),assets:{texture:(name,opts)=>{assert.equal(name,'misc/forcefield.png');assert.equal(opts.wrap,'repeat');return {}; }},renderer:{camPos:[9,70,0],renderDistance:.25,extraDraws:[]}};
  g.worldBorder.setSize(20);new BorderRenderer(g);g.renderer.extraDraws[0](device);g.renderer.extraDraws[0](device);
  assert.equal(calls.length,2);assert.equal(calls[0].mesh,calls[1].mesh);assert.equal(calls[0].state.blend,'add');assert.equal(calls[0].state.depthWrite,false);assert.equal(calls[0].state.cull,false);
});
