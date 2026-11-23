// Native horse inventory before 1.20.5: the window size is 2 + 3 * chest columns (5, or a llama's strength),
// inactive saddle/armour slots take no clicks, and the screen draws only the active slot backgrounds.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {horseInventoryLayout} from '../client/js/gui/screens/containers.js';
const MODERN_SADDLE=/isSaddleable \(1\.16\+\)/.test(readFileSync(new URL('../client/js/gui/screens/containers.js',import.meta.url),'utf8'));
const pos=(l,i)=>l.slots.find(s=>s[0]===i)?.slice(1);
test('horse without chest: saddle and armour, player inventory from slot 2',()=>{
  const l=horseInventoryLayout({entityName:'horse',horseFlags:2},2);
  assert.deepEqual(pos(l,0),[8,18]);assert.deepEqual(pos(l,1),[8,36]);assert.deepEqual(pos(l,2),[8,84]);assert.equal(l.chest,false);assert.equal(l.hidden.size,0);
});
test('chested donkey: 5 columns, no armour slot; llama strength 3: 3 columns and no saddle',()=>{
  const d=horseInventoryLayout({entityName:'donkey',horseFlags:2,horseChest:true},17);
  assert.equal(d.columns,5);assert.deepEqual(pos(d,16),[152,54]);assert.deepEqual(pos(d,17),[8,84]);assert.deepEqual([...d.hidden],[1]);
  const l=horseInventoryLayout({entityName:'llama',horseFlags:2,horseChest:true},11);
  assert.equal(l.columns,3);assert.deepEqual(pos(l,4),[116,18]);assert.deepEqual(pos(l,11),[8,84]);assert.equal(l.saddleable,false);assert.equal(l.llama,true);
});
test('the saddle rule follows this release',()=>{
  const wild=horseInventoryLayout({entityName:'horse',horseFlags:0},2);
  assert.equal(wild.saddleable,!MODERN_SADDLE,MODERN_SADDLE?'1.16+ needs a tamed adult':'before 1.16 every non-llama horse can be saddled');
});
