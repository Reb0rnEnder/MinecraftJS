import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{fox,setJarModels}from'../client/js/render/entity-models.js';import{applyFoxFlags,tickFox,foxAnimationArgs}from'../client/js/game/fox.js';import{scaleFoxChild}from'../client/js/render/fox-pose.js';import{EntityManager}from'../client/js/game/entities.js';import{EntityRenderer}from'../client/js/render/entity-renderer.js';import{setModelDevice}from'../client/js/render/boxmodel.js';
const version=JSON.parse(readFileSync(new URL('../client/assets/asset-manifest.json',import.meta.url))).minecraftVersion||'1.15.2';
const models=JSON.parse(readFileSync(new URL('../client/assets/bundles/entity-models.json',import.meta.url)));setJarModels(models);setModelDevice({createMesh(format,vertices,opts){return{format,vertices,...opts};}});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('fox standing pose rotates the native body/tail and retains the jar hierarchy',()=>{
 const m=fox();close(m.parts.body.rx,Math.PI/2);close(m.parts.tail.rx,-.05235988);assert.equal(m.parts.body.children.includes(m.parts.tail),true);assert.equal(m.roots.includes(m.parts.tail),false);assert.equal(m.roots.length,6);
 m.animate(m,{ls:2,lsa:.5,yaw:30,pitch:15});close(m.parts.head.rx,Math.PI/12);close(m.parts.rightHindLeg.rx,Math.cos(2*.6662)*.7);close(m.parts.leftFrontLeg.rx,m.parts.rightHindLeg.rx);
});
test('sitting, sleeping, crouching and faceplanting reset cleanly back to standing',()=>{
 const m=fox(),p=m.parts;m.animate(m,{sitting:true});close(p.body.rx,.5235988);close(p.head.py,10);close(p.rightHindLeg.py,21.5);close(p.tail.rx,.7853982);
 m.animate(m,{foxSleeping:true,age:20});assert.equal(p.rightFrontLeg.visible,false);close(p.body.rz,-Math.PI/2);close(p.head.ry,-2.0943952);close(p.head.rz,Math.cos(20*.027)/22);close(p.tail.rx,-2.6179938);
 m.animate(m,{foxCrouching:true,foxCrouchAmount:2,age:10});assert.equal(p.rightFrontLeg.visible,true);close(p.head.py,18.5);close(p.body.py,18);close(p.body.rx,1.6755161);close(p.body.rz,0);
 m.animate(m,{foxFaceplanted:true,age:10,pitch:50});close(p.head.rx,0);assert.ok(Math.abs(p.rightHindLeg.rx)<=.1);
 m.animate(m,{});close(p.head.py,16.5);close(p.head.ry,0);close(p.head.rz,0);close(p.body.rx,Math.PI/2);close(p.tail.pz,-1);close(p.rightHindLeg.py,17.5);assert.equal(p.rightFrontLeg.visible,true);
});
test('wire flags, interpolated crouch/head interest and sleeping textures reach the fox',()=>{
 const manager=new EntityManager({}),e=manager._base(7,0,0,0);e.kind='mob';e.entityName='fox';e.type='fox';
 // Use the active native metadata table; 1.15 inserted the living stinger count.
 const metadata=JSON.parse(readFileSync(new URL('../client/js/game/entity-metadata-'+version+'.js',import.meta.url),'utf8').split('export const NATIVE_METADATA=')[1].replace(/;\s*$/,''));
 const ids=metadata.fox;manager._applyMeta(e,{[ids.DATA_TYPE_ID]:1,[ids.DATA_FLAGS_ID]:1|4|8|16|32|64|128});assert.equal(e.foxType,1);for(const key of ['sitting','foxCrouching','foxInterested','foxPouncing','foxSleeping','foxFaceplanted','foxDefending'])assert.equal(e[key],true,key);
 tickFox(e);const a=foxAnimationArgs(e,.5);close(a.foxCrouchAmount,.1);close(a.foxHeadRoll,.2*.11*Math.PI);for(let i=0;i<20;i++)tickFox(e);close(e.foxCrouchAmount,3);
 assert.equal(EntityRenderer.prototype._texFor.call({},e),'entity/fox/snow_fox_sleep.png');applyFoxFlags(e,0);tickFox(e);assert.equal(e.foxCrouchAmount,0);assert.equal(e.foxSleeping,false);assert.equal(EntityRenderer.prototype._texFor.call({},e),'entity/fox/snow_fox.png');
});
test('baby foxes use distinct native head/body transforms instead of shrinking the entire animal',()=>{
 const m=fox();EntityRenderer.prototype._makeModelObject.call({},m,{});scaleFoxChild(m.childGroups,true);close(m.childGroups.head.scale.x,.75);close(m.childGroups.head.position.y,6);close(m.childGroups.body.scale.x,.5);close(m.childGroups.body.position.y,12);m.animate(m,{child:true,foxSleeping:true});close(m.parts.body.pz,-2);close(m.parts.tail.rx,-2.1816616);
 scaleFoxChild(m.childGroups,false);close(m.childGroups.head.scale.x,1);close(m.childGroups.body.position.y,0);
});

test('a held item attaches to the fox mouth with ground display and sleep offsets',()=>{
 const m=fox(),node=EntityRenderer.prototype._makeModelObject.call({},m,{}),v={model:m,foxMouth:node,atlasMat:{}};let ground=0;
 const renderer={game:{itemRenderer:{iconKey:()=> 'berry',objectFor:()=>({model:{display:{ground:{translation:[0,3,0],scale:[.5,.5,.5]}}},obj:new (node.constructor)()})}},glints:[]};
 const e={child:false,foxSleeping:false},args={yaw:30,pitch:10,foxHeadRoll:.1};
 EntityRenderer.prototype._foxHeld.call(renderer,e,v,{id:1},args);close(v.foxHeldOffset.position.z,-.5);close(v.foxHeldOffset.position.y,.27);close(v.foxMouth.position.y,m.parts.head.py);close(v.foxHeldTurn.rotation.x,Math.PI/2);assert.equal(v.foxHeldTurn.children[0].scale.x,.5);
 e.foxSleeping=true;e.child=true;EntityRenderer.prototype._foxHeld.call(renderer,e,v,{id:1},args);close(v.foxHeldOffset.position.x,.4);close(v.foxHeldOffset.position.z,.15);close(v.foxHeldTurn.rotation.z,Math.PI/2);
 EntityRenderer.prototype._foxHeld.call(renderer,e,v,null,args);assert.equal(node.children.length,0);
});
