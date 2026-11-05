import {test} from 'node:test';import assert from 'node:assert/strict';import {Game} from '../client/js/game/game.js';import {sectionKey} from '../client/js/world/section-key.js';
test('disabled LOD avoids repeated full-world scans and still rebuilds old LOD meshes when switched off',()=>{
 let scans=0;const sections=new Map([[sectionKey(2,4,0),{cx:2,sy:4,cz:0,lod:false}]]),values=sections.values.bind(sections);sections.values=()=>{scans++;return values();};
 let camera=[0,64,0];const g={renderer:{sections},settings:{lodDistance:0},dirty:new Set(),_lodCamera:()=>camera};
 Game.prototype._updateLod.call(g);assert.equal(scans,1);
 camera=[1,65,1];sections.set(sectionKey(3,4,0),{cx:3,sy:4,cz:0,lod:false});Game.prototype._updateLod.call(g);assert.equal(scans,1);assert.equal(g.dirty.size,0);
 g.settings.lodDistance=16;Game.prototype._updateLod.call(g);assert.equal(scans,2);assert.ok(g.dirty.has('3,4,0'));
 sections.get(sectionKey(3,4,0)).lod=true;g.settings.lodDistance=0;g.dirty.clear();Game.prototype._updateLod.call(g);assert.equal(scans,3);assert.ok(g.dirty.has('3,4,0'));
});
test('per-section hysteresis reads the numeric terrain key rather than an absent string key',()=>{
 const g={renderer:{sections:new Map([[sectionKey(1,0,0),{lod:true}]])},settings:{lodDistance:16},_lodCamera:()=>[0,0,0]};
 assert.equal(Game.prototype._lodFor.call(g,1,0,0),true);g.renderer.sections.clear();assert.equal(Game.prototype._lodFor.call(g,1,0,0),false);
});
