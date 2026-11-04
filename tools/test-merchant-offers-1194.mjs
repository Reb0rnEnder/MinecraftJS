import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Writer762,decodePacket762} from '../client/js/net/protocol-1.19.4.js';
import {CLIENTBOUND_762 as IN} from '../client/js/net/protocol-1.19.4-ids.js';
import {Game} from '../client/js/game/game.js';
import {createWorkstationScreen} from '../client/js/gui/screens/workstations.js';
const stack=(id,count)=>({id,count,damage:0,nbt:null});
function packet(second=null,disabled=false){return new Writer762().varint(IN.trade_list).varint(7).varint(1)
 .slot(stack(10,4)).slot(stack(11,1)).slot(second).bool(disabled).i32(2).i32(12).i32(3).i32(-1).f32(.5).i32(1)
 .varint(2).varint(20).bool(true).bool(true).build();}
test('native 762 offers reach merchant rendering, discounted cost, second input and hover without field mismatches',()=>{
 for(const second of [null,stack(12,2)])for(const disabled of [false,true]){
  const p=decodePacket762(packet(second,disabled));
  assert.equal(p.trades[0].a.id,10);assert.equal(p.trades[0].out.id,11);assert.equal(p.trades[0].disabled,disabled);
  const drawn=[],tips=[],win={id:7,type:'minecraft:villager',title:'Villager'},game={window:win,inventory:{cursor:null},settings:{},items:{maxStack:()=>64,tooltip:item=>[String(item.id)]},itemRenderer:{drawItem:(_,item)=>{assert.ok(item);drawn.push(item);}}};
  class Base {constructor(){this.guiLeft=this.guiTop=0;}}
  const screen=createWorkstationScreen(game,win,Base,Base);game.screens={current:screen};Game.prototype.on_trade_list.call(game,p);
  const gui={blit(){},button(){},text(){},tooltip:t=>tips.push(t)};
  screen.drawBackground(gui,0,0);assert.equal(drawn[0].count,5);assert.deepEqual(drawn.map(i=>i.id),second?[10,12,11]:[10,11]);
  screen.renderExtraTooltip(gui,15,20);assert.deepEqual(tips,[['10']]);
  assert.equal(win.selectedTrade,0);assert.equal(win.tradeData.canRestock,true);
 }
});
test('merchant opens safely before offers arrive and ignores another window offers',()=>{
 const win={id:7,type:'minecraft:villager'},game={window:win,inventory:{cursor:null},screens:{}};
 class Base {constructor(){this.guiLeft=this.guiTop=0;}}
 const screen=createWorkstationScreen(game,win,Base,Base);screen.drawBackground({blit(){}},0,0);
 Game.prototype.on_trade_list.call(game,{windowId:8,trades:[]});assert.equal(win.tradeData,undefined);
});
