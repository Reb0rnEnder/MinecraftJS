import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EntityManager} from '../client/js/game/entities.js';
import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
const {NATIVE_METADATA}=await import('../client/js/game/entity-metadata-'+VANILLA_UI.version+'.js');
test('native bee anger accessor follows metadata deltas independently of nectar',()=>{
 const manager=new EntityManager({}),e=manager._base(4,0,64,0),ids=NATIVE_METADATA.bee;
 e.kind='mob';e.entityName='bee';
 const anger=ids.DATA_REMAINING_ANGER_TIME??ids.ANGER_TIME;
 assert.ok(Number.isInteger(anger));
 manager._applyMeta(e,{[ids.DATA_FLAGS_ID]:12,[anger]:40});
 assert.equal(e.angry,true);assert.equal(e.angerTime,40);assert.equal(e.hasNectar,true);assert.equal(e.hasStung,true);
 manager._applyMeta(e,{[anger]:0});assert.equal(e.angry,false);assert.equal(e.hasNectar,true);
});
