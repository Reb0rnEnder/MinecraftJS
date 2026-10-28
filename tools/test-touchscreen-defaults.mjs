import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Settings} from '../client/js/game/settings.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {SlotList} from '../client/js/gui/slot-list.js';

test('Touchscreen Mode defaults to device capability and keeps explicit vanilla preferences',()=>{
 for(const capable of [false,true]){
  setPlatform({hasTouchscreen:capable,loadSetting:()=>null});
  assert.equal(new Settings().touchscreen,capable);
  for(const saved of [false,true]){
   setPlatform({hasTouchscreen:capable,loadSetting:()=>JSON.stringify({touchscreen:saved})});
   assert.equal(new Settings().touchscreen,saved);
  }
 }
});
test('clipped entries behind list headers and footers cannot remain hovered',()=>{
 const list=new SlotList({width:420},32,200,36);list.size=()=>20;
 list.amountScrolled=20;
 assert.equal(list.slotAt(210,31),-1);assert.equal(list.slotAt(210,201),-1);
 assert.ok(list.slotAt(210,60)>=0);
});
