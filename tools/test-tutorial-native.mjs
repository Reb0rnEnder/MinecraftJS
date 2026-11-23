// Tutorial steps recognise trees, logs and planks the native way for this release (tags, or the 1.13-1.18
// TREE_BLOCKS set), instead of 1.12 numeric ids.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setTranslator} from '../client/js/gui/i18n.js';
import {initBlocks,findState} from '../client/js/world/blocks.js';
import {Tutorial} from '../client/js/game/tutorial.js';
import {StatsCounter} from '../client/js/game/stats-counter.js';
setTranslator(k=>k);
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url),'utf8'));
const data={items:json('items'),blocks:json('blocks'),entities:json('entities'),blockCollisionShapes:json('blockCollisionShapes')};
initBlocks(data.blocks,data.blockCollisionShapes);
const source=readFileSync(new URL('../client/js/game/tutorial.js',import.meta.url),'utf8');
const TAGGED=/const TREE_BLOCKS = null;/.test(source);
const itemId=n=>data.items.find(i=>i.name===n).id;
function fixture(step){
  const states=new Map(),toasts=[];
  const settings={tutorialStep:step,keys:{forward:'KeyW',left:'KeyA',back:'KeyS',right:'KeyD',jump:'Space',attack:'mouse0',inventory:'KeyE'},keyName:k=>k,save(){}};
  const g={settings,gameMode:0,inWorld:true,assets:{data},items:{def:id=>data.items.find(i=>i.id===id)},inventory:{main:new Array(36).fill(null),armor:[null,null,null,null],offhand:null},
    hud:{addToast:t=>toasts.push(t)},world:{getState:(x,y,z)=>states.get(x+','+y+','+z)??0}};
  const t=new Tutorial(g);t.reload();return {t,g,states,toasts};
}
test('find tree: hovering a tree block starts punching, and picking up its item skips to crafting',()=>{
  const {t,g,states}=fixture('find_tree');t.update();
  states.set('1,2,3',findState('oak_leaves'));t.onMouseHover({type:'block',x:1,y:2,z:3});assert.equal(g.settings.tutorialStep,'punch_tree');
  const f2=fixture('find_tree');f2.t.update();f2.states.set('0,0,0',findState('stone'));f2.t.onMouseHover({type:'block',x:0,y:0,z:0});assert.equal(f2.g.settings.tutorialStep,'find_tree');
  f2.t.handleSetSlot({id:itemId('oak_log'),count:1});assert.equal(f2.g.settings.tutorialStep,'craft_planks');
});
test('find tree skips ahead when the inventory already holds a tree item or the stats show a mined tree',()=>{
  const a=fixture('find_tree');a.g.inventory.main[4]={id:itemId('birch_log'),count:3};a.t.update();assert.equal(a.g.settings.tutorialStep,'craft_planks');
  const b=fixture('find_tree');b.g.statsCounter=new StatsCounter(data);b.g.statsCounter.apply([{categoryId:0,statisticId:data.blocks.find(x=>x.name==='oak_log').id,value:1}]);b.t.update();assert.equal(b.g.settings.tutorialStep,'craft_planks');
  const c=fixture('find_tree');c.g.inventory.main[0]={id:itemId('cobblestone'),count:1};c.t.update();assert.equal(c.g.settings.tutorialStep,'find_tree');
});
test('punch tree: progress on #logs blocks, then the inventory step; leaves do not count',()=>{
  const {t,g,toasts}=fixture('punch_tree');t.update();
  for(let i=0;i<5;i++)t.onHitBlock(findState('oak_log'),0);assert.equal(toasts.length,0);for(let i=0;i<600;i++)t.update();assert.equal(toasts.length,1);
  t.onHitBlock(findState('oak_leaves'),.5);assert.equal(g.settings.tutorialStep,'punch_tree');
  t.onHitBlock(findState('spruce_log'),.5);assert.equal(toasts[0].current,.5);t.onHitBlock(findState('spruce_log'),1);assert.equal(g.settings.tutorialStep,'open_inventory');
});
test('open inventory, then crafting finishes on any #planks item',()=>{
  const {t,g}=fixture('open_inventory');t.update();t.openInventory();assert.equal(g.settings.tutorialStep,'craft_planks');
  t.update();t.handleSetSlot({id:itemId('stick'),count:1});assert.equal(g.settings.tutorialStep,'craft_planks');
  t.handleSetSlot({id:itemId('birch_planks'),count:4});assert.equal(g.settings.tutorialStep,'none');
});
test('the find-tree rule follows this release (tag from 1.19.4, TREE_BLOCKS before)',()=>{
  const {t}=fixture('find_tree');
  if(TAGGED)assert.equal(t.isTreeBlock(findState('stripped_oak_log')),true,'#completes_find_tree_tutorial includes stripped logs');
  else assert.equal(t.isTreeBlock(findState('stripped_oak_log')),false,'TREE_BLOCKS has no stripped logs');
  assert.equal(t.isTreeBlock(findState('oak_wood')),true);assert.equal(t.isTreeBlock(findState('dirt')),false);
});
test('tutorial toasts draw this release\'s native toast art',async()=>{
  const {t,toasts}=fixture('punch_tree');for(let i=0;i<600;i++)t.update();const toast=toasts[0];const calls=[];
  toast.draw({sprite:(...a)=>calls.push(['sprite',...a]),blit:(...a)=>calls.push(['blit',...a]),text(){},rect(){}},0);
  if(/gui\.sprite\('toast\/tutorial'/.test(source)){
    const {ZipFile}=await import('../lib/zip.js');const jar=new ZipFile(new URL('../cache/port-1.20.6/client.jar',import.meta.url));
    assert.deepEqual(calls.map(c=>c[1]),['toast/tutorial','toast/tree']);
    for(const n of ['tutorial','movement_keys','mouse','tree','recipe_book','wooden_planks'])assert.ok(jar.read('assets/minecraft/textures/gui/sprites/toast/'+n+'.png'),n);
  }else assert.deepEqual(calls.map(c=>c[1]),['gui/toasts.png','gui/toasts.png']);
});
