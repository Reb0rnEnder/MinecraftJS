// Native 1.20.6 MerchantScreen: villager.png plus container/villager/* sprites, 88-wide offer buttons, discounted
// costs struck through, the integer scroller step and the VillagerData experience bar.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ZipFile} from '../lib/zip.js';
import {createWorkstationScreen} from '../client/js/gui/screens/workstations.js';
import {ContainerScreen} from '../client/js/gui/screens/containers.js';
import {setTranslator} from '../client/js/gui/i18n.js';
setTranslator(k=>k);
const trade=(i,extra={})=>({a:{id:1,count:5},b:null,out:{id:2,count:1},demand:0,priceMultiplier:.05,specialPrice:0,xp:2,disabled:false,...extra,_i:i});
function fixture(trades,data={}){
  const calls=[],overlays=[];
  const gui={width:427,height:240,blit:(...a)=>calls.push(['blit',...a]),sprite:(...a)=>calls.push(['sprite',...a]),spriteRegion:(...a)=>calls.push(['region',...a]),button:(...a)=>calls.push(['button',...a]),text(){},textWidth:s=>s.length*6};
  const game={gui,assets:{translate:k=>k},items:{maxStack:()=>64},itemRenderer:{drawItem:(...a)=>calls.push(['item',...a]),drawOverlay:(...a)=>overlays.push(a)},inventory:{cursor:null},send(){},screens:{}};
  const win={type:'minecraft:villager',title:'Villager',tradeData:{trades,villagerLevel:1,experience:5,isRegularVillager:true,...data}};
  const s=createWorkstationScreen(game,win,null,ContainerScreen);s.guiLeft=0;s.guiTop=0;return {s,gui,calls,overlays};
}
test('background, trade arrows, offer buttons and the scroller use native sprites and sizes',()=>{
  const {s,gui,calls}=fixture([trade(0),trade(1,{disabled:true})]);s.drawBackground(gui,-1,-1);
  assert.deepEqual(calls[0].slice(0,2),['blit','gui/container/villager.png']);
  assert.ok(calls.some(c=>c[0]==='sprite'&&c[1]==='container/villager/scroller_disabled'&&c[2]===94&&c[3]===18));
  assert.deepEqual(calls.filter(c=>c[0]==='button').map(c=>[c[1],c[2],c[3]]),[[5,18,88],[5,38,88]]);
  assert.deepEqual(calls.filter(c=>c[0]==='sprite'&&/trade_arrow/.test(c[1])).map(c=>[c[1],c[2],c[3]]),[['container/villager/trade_arrow',60,22],['container/villager/trade_arrow_out_of_stock',60,42]]);
  assert.equal(calls.some(c=>c[0]==='blit'&&/villager2/.test(c[1])),false);
});
test('a discount draws the base count, the cost count 14 to the right and the strikethrough sprite',()=>{
  const {s,gui,calls,overlays}=fixture([trade(0,{specialPrice:-2})]);s.drawBackground(gui,-1,-1);
  assert.deepEqual(overlays.map(o=>[o[2],o[3],o[1].count]),[[10,19,5],[24,19,3]]);
  assert.ok(calls.some(c=>c[0]==='sprite'&&c[1]==='container/villager/discount_strikethrough'&&c[2]===17&&c[3]===31));
});
test('experience bar: current and pending XP as regions of the 102x5 bar; scroller steps natively',()=>{
  const {s,gui,calls}=fixture([trade(0,{xp:3})]);s.drawBackground(gui,-1,-1);
  const regions=calls.filter(c=>c[0]==='region');
  assert.deepEqual(regions.map(r=>[r[1],r[6],r[8]]),[['container/villager/experience_bar_current',136,51],['container/villager/experience_bar_result',187,30]]);
  const many=fixture(Array.from({length:12},(_,i)=>trade(i)));many.s.row=2;many.s.drawBackground(many.gui,-1,-1);
  const sc=many.calls.find(c=>c[0]==='sprite'&&c[1]==='container/villager/scroller');assert.equal(sc[3],18+2*(1+Math.trunc((139-(27+Math.trunc(5*139/6)))/6)+Math.trunc(139/6)));
  many.s.row=5;many.calls.length=0;many.s.drawBackground(many.gui,-1,-1);assert.equal(many.calls.find(c=>c[1]==='container/villager/scroller')[3],18+113,'last page pins to the bottom');
});
test('every merchant sprite exists in the pinned jar',()=>{
  const jar=new ZipFile(new URL('../cache/port-1.20.6/client.jar',import.meta.url));assert.ok(jar.read('assets/minecraft/textures/gui/container/villager.png'));
  for(const n of ['out_of_stock','experience_bar_background','experience_bar_current','experience_bar_result','scroller','scroller_disabled','trade_arrow','trade_arrow_out_of_stock','discount_strikethrough'])assert.ok(jar.read('assets/minecraft/textures/gui/sprites/container/villager/'+n+'.png'),n);
});
