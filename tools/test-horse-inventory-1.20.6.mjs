// Native 1.20.6 horse inventory: the packet's second field is the chest column count (1.20.5+), slots follow
// HorseInventoryMenu, and the screen draws the native slot sprites only where Slot.isActive.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {horseInventoryLayout} from '../client/js/gui/screens/containers.js';
import {Game} from '../client/js/game/game.js';
import {ZipFile} from '../lib/zip.js';
const ids=l=>l.slots.map(s=>s[0]),pos=(l,i)=>l.slots.find(s=>s[0]===i).slice(1);
test('tamed horse: saddle and armour slots, no chest, player inventory from slot 2',()=>{
  const l=horseInventoryLayout({entityName:'horse',horseFlags:2},0);
  assert.equal(l.saddleable,true);assert.equal(l.armor,true);assert.equal(l.chest,false);assert.equal(l.hidden.size,0);
  assert.deepEqual(pos(l,0),[8,18]);assert.deepEqual(pos(l,1),[8,36]);assert.deepEqual(pos(l,2),[8,84]);assert.deepEqual(pos(l,29),[8,142]);assert.equal(l.slots.length,38);
});
test('chested donkey: 3 x 5 chest slots, no armour slot, player inventory after them',()=>{
  const l=horseInventoryLayout({entityName:'donkey',horseFlags:2,horseChest:true},5);
  assert.equal(l.armor,false);assert.deepEqual([...l.hidden],[1]);assert.deepEqual(pos(l,2),[80,18]);assert.deepEqual(pos(l,16),[152,54]);assert.deepEqual(pos(l,17),[8,84]);assert.equal(l.slots.length,2+15+36);
});
test('llama strength 3: three chest columns, carpet slot, never a saddle; untamed/undead horses hide slots',()=>{
  const l=horseInventoryLayout({entityName:'llama',horseFlags:2,horseChest:true},3);
  assert.equal(l.saddleable,false);assert.equal(l.llama,true);assert.deepEqual(pos(l,4),[116,18]);assert.deepEqual(pos(l,5),[80,36]);assert.deepEqual(pos(l,11),[8,84]);
  assert.equal(horseInventoryLayout({entityName:'horse',horseFlags:0},0).saddleable,false);
  assert.equal(horseInventoryLayout({entityName:'horse',horseFlags:2,baby:true},0).saddleable,false);
  const sk=horseInventoryLayout({entityName:'skeleton_horse',horseFlags:2},0);assert.equal(sk.armor,false);assert.equal(sk.saddleable,true);
});
test('the open packet sizes the window from columns and titles it with the animal',()=>{
  const opened=[];const fake={entities:{get:()=>({entityName:'donkey'})},on_open_window:p=>opened.push(p)};
  Game.prototype.on_open_horse_window.call(fake,{windowId:3,nbSlots:5,entityId:9});
  assert.equal(opened[0].slotCount,17);assert.equal(opened[0].horseColumns,5);assert.equal(JSON.parse(opened[0].windowTitle).translate,'entity.minecraft.donkey');
  const named={entities:{get:()=>({entityName:'horse',customName:'Spirit'})},on_open_window:p=>opened.push(p)};
  Game.prototype.on_open_horse_window.call(named,{windowId:4,nbSlots:0,entityId:1});assert.equal(opened[1].slotCount,2);assert.equal(JSON.parse(opened[1].windowTitle).text,'Spirit');
});
test('every horse inventory sprite exists in the pinned jar',()=>{
  const jar=new ZipFile(new URL('../cache/port-1.20.6/client.jar',import.meta.url));
  for(const n of ['chest_slots','saddle_slot','armor_slot','llama_armor_slot'])assert.ok(jar.read('assets/minecraft/textures/gui/sprites/container/horse/'+n+'.png'),n);
});
test('the horse preview re-poses the live model for the GUI pass and restores its world pose',async()=>{
  const {EntityRenderer}=await import('../client/js/render/entity-renderer.js');
  const vec=(x,y,z)=>({x,y,z,set(a,b,c){this.x=a;this.y=b;this.z=c;}});
  const lights=[],v={root:{position:vec(10,64,-3)},yawGroup:{rotation:{x:0,y:1.25,z:0}},shadow:{visible:true},tag:{visible:true},materials:[{params:{setLight:(a,b)=>lights.push([a,b])}}]};
  const fake={visuals:new Map([[7,v]])},calls=[];
  const gui={scissor:(...a)=>calls.push(['scissor',...a]),clearScissor:()=>calls.push(['clear']),drawNode:(node,m)=>calls.push(['draw',node.position.x,node.position.y,v.yawGroup.rotation.y,v.shadow.visible,Array.from(m)])};
  const drawn=EntityRenderer.prototype.drawMobInGui.call(fake,gui,{id:7,height:1.6},26,18,78,70,17,.25,52,44);
  assert.equal(drawn,true);assert.deepEqual(calls[0],['scissor',26,18,52,52]);
  const draw=calls.find(c=>c[0]==='draw');assert.deepEqual(draw.slice(1,5),[0,0,0,false],'origin, facing the viewer (body 180), no shadow');
  assert.deepEqual([draw[5][12],draw[5][13],draw[5][14]].map(n=>Math.round(n*100)/100),[52,44+17*(.8+.25)*-1*-1,50].map(n=>Math.round(n*100)/100));
  assert.deepEqual([v.root.position.x,v.root.position.y,v.root.position.z,v.yawGroup.rotation.y,v.shadow.visible,v.tag.visible],[10,64,-3,1.25,true,true]);
  assert.deepEqual(lights,[[15,15]]);
  assert.equal(EntityRenderer.prototype.drawMobInGui.call({visuals:new Map()},gui,{id:1},0,0,1,1,17,.25,0,0),false,'no visual: no preview');
});
