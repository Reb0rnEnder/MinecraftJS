// AbstractContainerMenu.doClick SWAP (hotbar 0-8 or offhand 40) and ItemInHandRenderer re-equip on stack changes.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Inventory} from '../client/js/game/container.js';
import {Interaction} from '../client/js/game/interaction.js';
const items={maxStack:()=>64,name:()=>'stone',component:()=>undefined,components:()=>({})};
function game(){const sent=[];const g={sent,items,send:p=>sent.push(p),player:{creative:false},effects:{get:()=>null},inventory:null};g.inventory=new Inventory(g);return g;}
const st=(id,count=1)=>({id,count,damage:0});
test('swap-hands over a slot swaps it with the offhand both ways and moves a lone item either way',()=>{
  const g=game(),inv=g.inventory;inv.main[12]=st(5,10);inv.offhand=st(7,3);
  const slot=inv.slots.findIndex(s=>s.playerIndex===12);
  inv.slotClick(slot,40,2);assert.deepEqual([inv.main[12].id,inv.offhand.id],[7,5]);
  inv.offhand=null;inv.slotClick(slot,40,2);assert.equal(inv.main[12],null);assert.equal(inv.offhand.id,7);
  inv.slotClick(slot,40,2);assert.equal(inv.main[12].id,7);assert.equal(inv.offhand,null);
  inv.main[3]=st(9,2);inv.slotClick(slot,3,2);assert.deepEqual([inv.main[12].id,inv.main[3].id],[9,7]);
});
test('a hand re-equips (lowers, switches below 0.1, rises) when its stack changes, not when the same stack shrinks',()=>{
  const g=game(),inv=g.inventory;inv.main[0]=st(5,10);inv.offhand=st(7,1);g.heldSlot=0;
  const i=Object.create(Interaction.prototype);Object.assign(i,{game:g,equipProgress:1,equipProgressOff:1,cooledAttackStrength:()=>1});
  for(let t=0;t<10;t++)i.updateEquip();assert.equal(i.equipProgressOff,1); // the first ticks equip from empty, as native
  inv.main[0].count--;i.updateEquip();assert.equal(i.equipProgress,1); // eating shrinks in place
  inv.offhand=st(5,10);inv.main[0]=st(7,1);i.updateEquip();assert.ok(i.equipProgressOff<1&&i.equipProgress<1);
  assert.deepEqual(i.shownHandStacks().map(s=>s.id),[5,7]); // still the old stacks while lowering
  for(let t=0;t<6;t++)i.updateEquip();assert.deepEqual(i.shownHandStacks().map(s=>s.id),[7,5]);assert.equal(i.equipProgressOff,1);
});
