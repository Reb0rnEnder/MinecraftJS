import {test}from'node:test';import assert from'node:assert/strict';import{readFileSync}from'node:fs';
import{initBlocks,findState,getStateProperties}from'../client/js/world/blocks.js';import{Interaction}from'../client/js/game/interaction.js';
const blocks=JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url)));initBlocks(blocks,null);
function click(name,{sneaking=false,held=null}={}){
 let state=findState(name,{half:'lower',open:'false'});const sent=[],sound=[];
 const g={player:{sneaking},inventory:{getHand:()=>held,held:()=>held,offhand:null},gameMode:0,world:{getState:()=>state,setState:(x,y,z,s)=>state=s},send:p=>sent.push(p),sound:{onWorldEvent:p=>sound.push(p)},items:{name:()=> 'stick',isBlockItem:()=>false},cooldownFraction:()=>0};
 const interaction=new Interaction(g);interaction.sendUseItem=()=>false;interaction._onItemUse=()=>false;interaction.swing=()=>{};interaction.target={type:'block',x:0,y:64,z:0,face:2,hit:[.5,64.5,0]};interaction.rightClickMouse();return{sent,sound,state};
}
test('all wooden door, trapdoor and gate families activate once with empty hands',()=>{
 const names=blocks.filter(b=>(b.name.endsWith('_door')||b.name.endsWith('_trapdoor')||b.name.endsWith('_fence_gate'))&&!b.name.startsWith('iron_')).map(b=>b.name);
 assert.ok(names.includes('oak_door'));
 for(const name of names)for(const sneaking of[false,true]){const result=click(name,{sneaking});assert.equal(result.sent.length,1,name);assert.equal(result.sound.length,1,name);assert.equal(getStateProperties(result.state).open,'true',name);}
});
test('sneaking with a held item bypasses wooden door activation',()=>{const r=click('oak_door',{sneaking:true,held:{id:1,count:1,damage:0}});assert.equal(r.sound.length,0);assert.equal(getStateProperties(r.state).open,'false');});
