import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Settings} from '../client/js/game/settings.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {ResourcePacksScreen} from '../client/js/gui/screens/packs.js';
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

test('pack entry arrows follow hover or explicit vanilla Touchscreen Mode',()=>{
 const game={settings:{touchscreen:false,resourcePacks:[]},assets:{listPacks:async()=>[]}};
 const screen=new ResourcePacksScreen(game,null),pack={id:'test',name:'Test',description:'',format:0};
 screen._icon=()=>null;
 let arrows=0;const gui={tex:()=>null,rect(){},text(){},textWidth:()=>0,font:{wrap:()=>[],trimToWidth:s=>s},blit(){arrows++;}};
 screen._entry(gui,{side:0},pack,0,20,40,500,500);assert.equal(arrows,0);
 screen._entry(gui,{side:0},pack,0,20,40,100,50);assert.equal(arrows,1,'hover over the entry text shows arrows');
 game.settings.touchscreen=true;arrows=0;
 screen._entry(gui,{side:0},pack,0,20,40,500,500);assert.equal(arrows,1,'touch preference keeps arrows visible');
 game.settings.touchscreen=false;arrows=0;
 screen._entry(gui,{side:0,list:{inside:()=>false}},pack,0,20,20,100,25);assert.equal(arrows,0,'clipped header area is not hovered');
});
