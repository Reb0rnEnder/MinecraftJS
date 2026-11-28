import {test} from 'node:test';
import assert from 'node:assert/strict';
import {debugSubscriptionLines} from '../client/js/gui/debug-overlay.js';

const entry=(name,value)=>({subscription:1,subscriptionName:name,value});

test('26.3 debug subscriptions render decoded values with their target key', () => {
  const game={debugValues:{
    block:new Map([['1,64,2',entry('neighbor_updates',{x:1,y:64,z:2})]]),
    chunk:new Map(),
    entity:new Map([['7',entry('entity_paths',{path:{reached:true},maxNodeDistance:16})]]),
    events:[entry('game_events',{eventId:3,position:{x:1,y:2,z:3}})]
  }};
  const lines=debugSubscriptionLines(game);
  assert.equal(lines[0],'neighbor_updates [block 1,64,2]: {"x":1,"y":64,"z":2}');
  assert.ok(lines[1].startsWith('entity_paths [entity 7]: {"path":{"reached":true}'));
  assert.equal(lines[2],'game_events [event]: {"eventId":3,"position":{"x":1,"y":2,"z":3}}');
});

test('26.3 debug subscriptions are bounded and absent when no values arrived', () => {
  assert.deepEqual(debugSubscriptionLines({}),[]);
  const events=Array.from({length:40},(_,i)=>entry('raid',i));
  const lines=debugSubscriptionLines({debugValues:{block:new Map(),chunk:new Map(),entity:new Map(),events}},5);
  assert.equal(lines.length,5);
  assert.equal(lines.at(-1),'raid [event]: 39');
});

test('26.3 debug subscription values truncate oversized payloads instead of growing the HUD', () => {
  const lines=debugSubscriptionLines({debugValues:{block:new Map([['0,0,0',entry('brains',{name:'x'.repeat(400)})]]),chunk:new Map(),entity:new Map(),events:[]}});
  assert.ok(lines[0].endsWith('...'));
  assert.ok(lines[0].length<230);
});
