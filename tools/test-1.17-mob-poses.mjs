import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {EntityManager} from '../client/js/game/entities.js';import {NATIVE_METADATA} from '../client/js/game/entity-metadata-1.17.1.js';
import {goat,playerModel,setJarModels} from '../client/js/render/entity-models.js';import {spyglassArmPitch,attachSpyglassHolder} from '../client/js/render/spyglass-pose.js';import {scaleAgeableGroups} from '../client/js/render/ageable-pose.js';import {Node} from '../client/js/gfx/scene.js';
setJarModels(JSON.parse(readFileSync(new URL('../client/assets/bundles/entity-models.json',import.meta.url))));
test('native 1.17 LONG_JUMPING and DYING indices retain distinct dimensions',()=>{
 const m=new EntityManager({}),p=m._base(1,0,64,0);p.kind='player';p.entityName='player';m._applyMeta(p,{[NATIVE_METADATA.player.DATA_POSE]:7});assert.equal(p.height,Math.fround(.2));
 const g=m._base(2,0,64,0);g.kind='mob';g.entityName='goat';m._applyMeta(g,{6:6});assert.ok(Math.abs(g.width-.63)<1e-6);assert.ok(Math.abs(g.height-.91)<1e-6);m._applyMeta(g,{6:0});assert.ok(Math.abs(g.width-.9)<1e-6);
});
test('goat ramming status starts/stops head movement and native model keeps horns hidden for babies',()=>{
 const manager=new EntityManager({}),e=manager._base(1,0,64,0);e.kind='mob';e.entityName='goat';manager.map.set(1,e);
 manager.onStatus({entityId:1,entityStatus:58});assert.equal(e.goatRamming,true);manager.onStatus({entityId:1,entityStatus:59});assert.equal(e.goatRamming,false);
 const model=goat();model.animate(model,{child:true,rammingHeadRotation:Math.PI/6});assert.equal(model.parts.head.rx,Math.PI/6);assert.equal(model.parts.leftHorn.visible,false);
 const groups={head:new Node(),body:new Node()};scaleAgeableGroups(groups,true,model.nativeAgeable);assert.equal(groups.head.scale.x,.6);assert.equal(groups.body.scale.x,.5);scaleAgeableGroups(groups,false,model.nativeAgeable);assert.equal(groups.head.scale.x,1);assert.equal(groups.head.position.y,0);
});
test('spyglass arms clamp at native pitch limits and have no idle bob',()=>{
 const model=playerModel(false);model.animate(model,{rightPose:'spyglass',pitch:0,yaw:0,age:33,swing:-9999});assert.equal(model.parts.rightArm.rx,spyglassArmPitch(0,false));assert.equal(model.parts.rightArm.rz,0);
 assert.equal(spyglassArmPitch(-5,false),-2.4);assert.equal(spyglassArmPitch(9,false),3.3);
});
test('spyglass holder follows clamped head pitch, preserves arm parent and restores on release',()=>{
 const root=new Node(),arm=new Node(),headNode=new Node(),holder=new Node();root.add(arm,headNode);arm.add(holder);
 const head={obj:headNode,px:0,py:1,pz:0,rx:-2,ry:.4,rz:0};attachSpyglassHolder(holder,head,true);assert.equal(holder.parent,root);assert.equal(holder.rotation.x,-.5235988);assert.equal(holder.position.y,1);
 attachSpyglassHolder(holder,head,false);assert.equal(holder.parent,arm);assert.equal(holder.position.y,0);assert.equal(holder.rotation.x,0);
});
