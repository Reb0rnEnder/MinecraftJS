// BundleTutorial: left-clicking a bundle while carrying an item shows a 160-tick right-click hint; right-clicking to
// insert (or to take out while carrying the bundle) hides it and sets hideBundleTutorial for good.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {setTranslator} from '../client/js/gui/i18n.js';
import {Tutorial} from '../client/js/game/tutorial.js';
setTranslator(k=>k);
const items=JSON.parse(readFileSync(new URL('../client/data/items.json',import.meta.url),'utf8')),id=n=>items.find(i=>i.name===n).id;
function fixture(){const toasts=[],settings={tutorialStep:'none',hideBundleTutorial:false,saved:0,save(){this.saved++;},keys:{},keyName:k=>k};
  const g={settings,gameMode:0,inWorld:true,assets:{data:{items}},items:{def:i=>items.find(x=>x.id===i)},hud:{addToast:t=>toasts.push(t)}};return {t:new Tutorial(g),g,toasts};}
const bundle={id:id('bundle'),count:1},stone={id:id('stone'),count:5};
test('left-click a bundle while carrying an item: a timed right-click hint that fills over 160 ticks',()=>{
  const {t,toasts}=fixture();t.onInventoryAction(stone,bundle,0);assert.equal(toasts.length,1);assert.equal(toasts[0].title,'tutorial.bundleInsert.title');assert.equal(toasts[0].progressBar,true);
  for(let i=0;i<80;i++)t.update();assert.ok(Math.abs(toasts[0].current-.5)<.01);for(let i=0;i<81;i++)t.update();assert.equal(toasts[0].visibility,'hide');
  t.onInventoryAction(stone,bundle,0);t.onInventoryAction(stone,bundle,0);assert.equal(toasts[1].visibility,'hide','a new hint replaces the previous one');
});
test('right-click insertion or extraction finishes the tutorial for good',()=>{
  const a=fixture();a.t.onInventoryAction(stone,bundle,0);a.t.onInventoryAction(stone,bundle,1);assert.equal(a.g.settings.hideBundleTutorial,true);assert.equal(a.toasts[0].visibility,'hide');assert.equal(a.g.settings.saved,1);
  a.t.onInventoryAction(stone,bundle,0);assert.equal(a.toasts.length,1,'never shown again');
  const b=fixture();b.t.onInventoryAction(bundle,stone,1);assert.equal(b.g.settings.hideBundleTutorial,true);
  const c=fixture();c.t.onInventoryAction(null,bundle,0);c.t.onInventoryAction(stone,stone,1);assert.equal(c.toasts.length,0);assert.equal(c.g.settings.hideBundleTutorial,false);
});
