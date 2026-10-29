import{test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{Interaction}from'../client/js/game/interaction.js';import{initBlocks,blocksByName}from'../client/js/world/blocks.js';import{VANILLA_UI}from'../client/js/gui/vanilla-layout.js';
initBlocks(JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url))),null);
test('client extinguishing dispatches the target version fire sound event',()=>{
 const events=[],b=blocksByName.fire,state=b.defaultState??b.id<<4,g={world:{getState:()=>state,setState(){}},sound:{onWorldEvent:e=>events.push(e)}};
 assert.equal(new Interaction(g)._extinguishFire({x:1,y:2,z:3},1),true);assert.equal(events.length,1);assert.equal(events[0].effectId,VANILLA_UI.version==='1.8.9'?1004:1009);
});
