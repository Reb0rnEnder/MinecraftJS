import{test}from'node:test';import assert from'node:assert/strict';
import{trimMeshResidency}from'../client/js/render/mesh-residency.js';
import{DirtySections}from'../client/js/render/dirty-sections.js';
import{Game}from'../client/js/game/game.js';
import{Renderer}from'../client/js/render/renderer.js';
import{sectionKey}from'../client/js/render/culling.js';
function fixture(){const world={getChunk:()=>({})},worker={},destroyed=[],r={sections:new Map(),device:{destroyMesh:m=>destroyed.push(m)},invalidateVisibility(){},removeSection:Renderer.prototype.removeSection},g={world,assets:{worker},renderer:r,settings:{renderDistance:10}};Game.prototype._setupWorker.call(g);return{g,r,destroyed,worker};}
test('terrain beyond the selected distance is evicted with a safety margin and remains pending on re-entry',()=>{
 const{g,r,destroyed}=fixture();for(const [x,y,z]of[[0,4,0],[12,4,12],[13,4,0],[-13,4,0]])r.sections.set(sectionKey(x,y,z),{cx:x,sy:y,cz:z,solid:{x},cutout:{x},translucent:{x},tripwire:{x}});
 trimMeshResidency(g,[0,64,0]);assert.equal(r.sections.size,2);assert.equal(destroyed.length,8);
 assert.deepEqual(g.dirty.within(13,0,0).map(r=>r[0]),['13,4,0']);assert.ok(g.dirty.has('-13,4,0'));
 assert.ok(r.sections.has(sectionKey(12,4,12)),'margin does not remove visible boundary terrain');
 trimMeshResidency(g,[16*13,64,0]);assert.ok(g.dirty.has('0,4,0'));assert.equal(r.sections.size,1);
 g.settings.renderDistance=2;trimMeshResidency(g,[16*13,64,0]);assert.equal(r.sections.size,0);
 assert.equal(g.world.getChunk(0,0)!==undefined,true,'world/lighting data is not unloaded');
});
test('a discarded distant worker result cannot resurrect an evicted mesh or cancel a newer build',()=>{
 const{g,worker}=fixture(),key='30,4,0';g.inFlight.set(key,1);g.buildTokens.set(key,1);
 trimMeshResidency(g,[0,64,0]);assert.equal(g.inFlight.has(key),false);assert.equal(g.buildTokens.has(key),false);assert.ok(g.dirty.has(key));
 g.buildTokens.set(key,2);g.inFlight.set(key,2);worker.onmessage({data:{type:'built',x:30,y:4,z:0,gen:g.meshGen,token:1}});assert.equal(g.inFlight.get(key),2);assert.equal(g._meshUploads.length,0);
});
