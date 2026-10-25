import {test} from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../client/js/game/game.js';
function fixture(){const worker={},drawn=[],g={assets:{worker},world:{getChunk:()=>({})},renderer:{setSectionMesh:(...a)=>drawn.push(a)}};Game.prototype._setupWorker.call(g);return {g,drawn,reply:(gen,token)=>worker.onmessage({data:{type:'built',x:0,y:0,z:0,gen,token}})};}
test('obsolete mesh replies cannot clear a newer job or overwrite its geometry',()=>{
 const {g,drawn,reply}=fixture();g.buildTokens.set('0,0,0',2);g.inFlight.set('0,0,0',123);
 reply(g.meshGen,1);assert.equal(drawn.length,0);assert.equal(g.inFlight.get('0,0,0'),123);
 reply(g.meshGen-1,2);assert.equal(drawn.length,0);assert.equal(g.inFlight.get('0,0,0'),123);
 reply(g.meshGen,2);assert.equal(drawn.length,1);assert.equal(g.inFlight.size,0);
});
test('a section dirtied during a build stays pending until a fresh snapshot completes',()=>{
 const {g,drawn,reply}=fixture();g.buildTokens.set('0,0,0',1);g.inFlight.set('0,0,0',1);g.dirty.add('0,0,0');
 reply(g.meshGen,1);assert.equal(drawn.length,0);assert.ok(g.dirty.has('0,0,0'));assert.equal(g.inFlight.size,0);
 g.buildTokens.set('0,0,0',2);g.inFlight.set('0,0,0',2);g.dirty.delete('0,0,0');reply(g.meshGen,2);assert.equal(drawn.length,1);
});
