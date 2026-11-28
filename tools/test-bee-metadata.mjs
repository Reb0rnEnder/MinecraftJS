import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EntityManager} from '../client/js/game/entities.js';
import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
const {NATIVE_METADATA}=await import('../client/js/game/entity-metadata-'+VANILLA_UI.version+'.js');
test('native bee anger accessor follows metadata deltas independently of nectar',()=>{
 const manager=new EntityManager({world:{worldAge:100n}}),e=manager._base(4,0,64,0),ids=NATIVE_METADATA.bee;
 e.kind='mob';e.entityName='bee';
 const anger=ids.DATA_ANGER_END_TIME;
 assert.ok(Number.isInteger(anger));
 manager._applyMeta(e,{[ids.DATA_FLAGS_ID]:12,[anger]:140n});
 assert.equal(e.angry,true);assert.equal(e.angerEndTime,140n);assert.equal(e.hasNectar,true);assert.equal(e.hasStung,true);
 manager._applyMeta(e,{[anger]:0n});assert.equal(e.angry,false);assert.equal(e.hasNectar,true);
 manager._applyMeta(e,{[anger]:100n});assert.equal(e.angry,false);
});
