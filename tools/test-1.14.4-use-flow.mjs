import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Items} from '../client/js/game/items.js';
import {Interaction} from '../client/js/game/interaction.js';
import {LocalPlayer} from '../client/js/game/physics.js';
import {C} from '../client/js/net/packets.js';

const data=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));

function fixture() {
  const assets={data:{items:data('items'),creative:data('creative'),enchantments:data('enchantments')},translate:k=>k};
  const items=new Items(assets),player=new LocalPlayer(),sent=[];
  const game={assets,items,player,gameMode:0,food:20,cooldownFraction:()=>0,
    inventory:{main:[],offhand:null,held:()=>game.inventory.main[0]||null,getHand:h=>h?game.inventory.offhand:game.inventory.held()},
    send:p=>sent.push(p),sound:{playAtPlayer(){}},world:{getState:()=>1},sent};
  return {game,items,player,sent,interaction:new Interaction(game)};
}

test('1.14.4 trident release and elytra firework use send native use packets',()=>{
  const {game,items,player,sent,interaction}=fixture();
  const trident={id:items.byName.get('trident').id,count:1}; game.inventory.main=[trident];
  assert.equal(interaction.sendUseItem(trident),true); interaction.useTicks=10; interaction.stopUsingItem();
  assert.deepEqual(sent[0],C.useItem(0)); assert.deepEqual(sent[1],C.blockDig(5,0,0,0,0));
  sent.length=0;
  const rocket={id:items.byName.get('firework_rocket').id,count:1}; game.inventory.main=[rocket]; player.elytraFlying=true;
  interaction.target={type:'block',x:0,y:64,z:0,face:1,hit:[0.5,65,0.5]}; interaction.rightClickMouse();
  assert.deepEqual(sent[0],C.useItem(0),'terrain does not swallow an elytra rocket use');
});

test('1.14.4 creative catalog keeps fireworks and trident in their native entries',()=>{
  const creative=data('creative'),items=data('items'),names=new Map(items.map(i=>[i.id,i.name]));
  const search=creative.tabs.find(t=>t.label==='search'),brewing=creative.tabs.find(t=>t.label==='brewing'),combat=creative.tabs.find(t=>t.label==='combat');
  assert.equal(search.items.filter(([id])=>names.get(id)==='firework_star').length,1);
  assert.equal(brewing.items.some(([id])=>names.get(id)==='trident'),false);
  assert.equal(combat.items.some(([id])=>names.get(id)==='trident'),true);
});
