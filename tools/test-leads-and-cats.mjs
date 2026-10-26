import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';
import mcassets from '../lib/mcassets.js';import{ZipFile}from'../lib/zip.js';import{extractModels}from'../lib/modelextract.js';
import{leashGeometry,leashEndpoints}from'../client/js/render/leash.js';
import{animateOcelot}from'../client/js/render/ocelot-pose.js';
import{setJarModels,J}from'../client/js/render/entity-models.js';
const modelPath=new URL('../client/assets/bundles/entity-models.json',import.meta.url);const extracted=existsSync(modelPath)?JSON.parse(readFileSync(modelPath)):extractModels(new ZipFile(await mcassets.locateJar()));const models=extracted.models||extracted;setJarModels(models);
const names=['backLeft','backRight','frontLeft','frontRight','tail','tail2','head','body'];
test('sitting cats and older tame ocelots use native pivots and return to standing without accumulation',()=>{
 for(const name of ['ocelot',...(models.cat?['cat']:[])]){
  const m={parts:J(name,names),jarModel:name};const p=m.parts;animateOcelot(m,{sitting:true});
  assert.equal(p.body.py,8);assert.equal(p.body.pz,-5);assert.equal(p.body.rx,.7853982);assert.equal(p.head.py,11.7);
  assert.equal(p.backLeft.py,21);assert.equal(p.backLeft.pz,1);assert.equal(p.backLeft.rx,-1.5707964);assert.equal(p.frontLeft.py,name==='cat'?16.1:15.8);
  assert.equal(p.tail.py,23);assert.equal(p.tail2.rx,2.670354);
  const pose=JSON.stringify(names.map(k=>[p[k].py,p[k].pz,p[k].rx]));for(let i=0;i<10;i++)animateOcelot(m,{sitting:true});assert.equal(JSON.stringify(names.map(k=>[p[k].py,p[k].pz,p[k].rx])),pose);
  animateOcelot(m,{});assert.equal(p.body.py,12);assert.equal(p.body.pz,-10);assert.equal(p.body.rx,Math.PI/2);assert.equal(p.backLeft.rx,0);assert.equal(p.head.py,15);
 }
});
test('native lead geometry has crossed strips, sag, alternating colours and finite coincident endpoints',()=>{
 const input={start:[0,0,0],end:[4,1,0],height:1.6},v=leashGeometry(input);assert.equal(v.length,24*2*4*9);
 assert.ok(Math.abs(v[1]-(24/18+.125))<1e-6);assert.ok(Math.abs(v[5]-.35)<1e-6);assert.ok(Math.abs(v[2*9+5]-.5)<1e-6);
 assert.ok(Math.abs(v[(24*4-1)*9]-4)<1e-6);assert.ok([...leashGeometry({...input,end:input.start})].every(Number.isFinite));
 const second=24*4*9;assert.ok(v[second+1]>v[1]);assert.ok(v[second+2*9+2]>v[2*9+2]);
});
test('lead endpoints interpolate a player hand and fence knots and honour entity size',()=>{
 const mob={x:2,y:3,z:4,prevX:0,prevY:3,prevZ:4,width:.6,height:.7,bodyYaw:0},holder={x:4,y:5,z:6,yaw:0,pitch:0,eyeHeight:1.62};
 const a=leashEndpoints(mob,holder,.5);assert.ok(Math.abs(a.start[0]-1)<1e-9);assert.ok(Math.abs(a.start[2]-4.24)<1e-9);assert.deepEqual(a.end,[3.3,5+1.62*.7-.25,6.5]);
 assert.deepEqual(leashEndpoints(mob,{...holder,kind:'leash',eyeHeight:0},.5).end,[4,5.25,6]);
});

test('attached leads render independently of their mob and are removed immediately on detach or missing holder',async()=>{
 const{EntityEffects}=await import('../client/js/render/entity-effects.js'),{Node}=await import('../client/js/gfx/scene.js');
 const mob={id:4,kind:'mob',type:92,x:1,y:0,z:0,width:.6,height:1.3,leashHolder:0},player={x:3,y:0,z:0,yaw:0,pitch:0,eyeHeight:()=>1.62};let destroyed=0,updates=0;
 const entities={all:()=>[mob],get:()=>undefined,interp:e=>({x:e.x,y:e.y,z:e.z})},g={entities,entityId:0,player,assets:{},settings:{renderDistance:8},renderer:{entityRoot:new Node(),camPos:[0,0,0],boxVisible:()=>true},device:{createMesh:()=>({}),updateMesh:()=>updates++,destroyMesh:()=>destroyed++}};
 const effects=new EntityEffects(g);effects.update(.5);assert.ok(effects.entries.has('leash:4'));assert.equal(updates,1);mob.leashHolder=-1;effects.update(.5);assert.equal(effects.entries.size,0);assert.equal(destroyed,1);mob.leashHolder=42;effects.update(.5);assert.equal(effects.entries.size,0);
});
