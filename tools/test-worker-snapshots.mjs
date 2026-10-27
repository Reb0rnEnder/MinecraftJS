import {setPlatform} from '../client/js/platform/platform.js';
setPlatform({now:()=>0});
import {test} from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../client/js/game/game.js';
function fixture(){const worker={},drawn=[],g={assets:{worker},world:{getChunk:()=>({})},renderer:{setSectionMesh:(...a)=>drawn.push(a)}};Game.prototype._setupWorker.call(g);return {g,drawn,reply:(gen,token)=>worker.onmessage({data:{type:'built',x:0,y:0,z:0,gen,token}})};}
test('obsolete mesh replies cannot clear a newer job or overwrite its geometry',()=>{
 const {g,drawn,reply}=fixture();g.buildTokens.set('0,0,0',2);g.inFlight.set('0,0,0',123);
 reply(g.meshGen,1);assert.equal(drawn.length,0);assert.equal(g.inFlight.get('0,0,0'),123);
 reply(g.meshGen-1,2);assert.equal(drawn.length,0);assert.equal(g.inFlight.get('0,0,0'),123);
 reply(g.meshGen,2);Game.prototype._uploadMeshes.call(g);assert.equal(drawn.length,1);assert.equal(g.inFlight.size,0);
});
test('a section dirtied during a build stays pending until a fresh snapshot completes',()=>{
 const {g,drawn,reply}=fixture();g.buildTokens.set('0,0,0',1);g.inFlight.set('0,0,0',1);g.dirty.add('0,0,0');
 reply(g.meshGen,1);assert.equal(drawn.length,0);assert.ok(g.dirty.has('0,0,0'));assert.equal(g.inFlight.size,0);
 g.buildTokens.set('0,0,0',2);g.inFlight.set('0,0,0',2);g.dirty.delete('0,0,0');reply(g.meshGen,2);Game.prototype._uploadMeshes.call(g);assert.equal(drawn.length,1);
});
test('mesh uploads defer a burst across frames and revalidate dirty sections before applying',()=>{
 let now=0;setPlatform({now:()=>now});const worker={},drawn=[],g={assets:{worker},world:{getChunk:()=>({})},renderer:{setSectionMesh:(x,y,z)=>{drawn.push(x);now+=2;}}};Game.prototype._setupWorker.call(g);
 for(let x=0;x<3;x++){const key=x+',0,0';g.buildTokens.set(key,x+1);g.inFlight.set(key,0);worker.onmessage({data:{type:'built',x,y:0,z:0,gen:g.meshGen,token:x+1}});}
 assert.equal(drawn.length,0);assert.equal(g.inFlight.size,3);Game.prototype._uploadMeshes.call(g);assert.deepEqual(drawn,[0]);assert.equal(g.inFlight.size,2);g.dirty.add('1,0,0');Game.prototype._uploadMeshes.call(g);assert.deepEqual(drawn,[0,2]);assert.equal(g.inFlight.size,0);setPlatform({now:()=>0});
});
test('changing worlds immediately drops completed meshes waiting for upload',()=>{
 const{g,reply}=fixture();g.renderer.clearSections=()=>{};g.buildTokens.set('0,0,0',1);g.inFlight.set('0,0,0',1);reply(g.meshGen,1);assert.equal(g._meshUploads.length,1);const old=g.meshGen;Game.prototype._resetMeshing.call(g);assert.equal(g._meshUploads.length,0);assert.equal(g.meshGen,old+1);
});
