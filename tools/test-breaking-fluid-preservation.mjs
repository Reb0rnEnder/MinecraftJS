import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {initBlocks,blocksByName,findState,getBlock,getStateProperties} from '../client/js/world/blocks.js';
import {Interaction} from '../client/js/game/interaction.js';
const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(read('blocks'),read('blockCollisionShapes'));
function destroy(state){let current=state;const sounds=[],particles=[],g={gameMode:1,inventory:{held:()=>null},world:{getState:()=>current,setState:(x,y,z,s)=>{current=s;}},sound:{playBlockBreak:(x,y,z,s)=>sounds.push(s)},particles:{blockBreak:(x,y,z,s)=>particles.push(s)}};const i=new Interaction(g);assert.equal(i.destroyBlockClient({x:2,y:64,z:3}),true);return{current,sounds,particles};}
test('breaking waterlogged blocks immediately preserves their source water',()=>{
 for(const name of ['oak_slab','oak_stairs','oak_sign','lantern'].filter(n=>blocksByName[n]?.stateProperties.some(p=>p.name==='waterlogged'))){const state=findState(name,{...getStateProperties(blocksByName[name].defaultState),waterlogged:'true'}),result=destroy(state);assert.equal(getBlock(result.current).name,'water',name);assert.equal(getStateProperties(result.current).level,'0',name);assert.deepEqual(result.sounds,[state]);assert.deepEqual(result.particles,[state]);}
});
test('breaking submerged water plants preserves their implicit source fluid',()=>{
 for(const name of ['kelp','kelp_plant','seagrass','tall_seagrass']){const r=destroy(findState(name));assert.equal(getBlock(r.current).name,'water',name);assert.equal(getStateProperties(r.current).level,'0',name);}
});
test('dry blocks and ice still predict air; fluid creation from ice remains server-authoritative',()=>{
 for(const name of ['oak_planks','ice','oak_slab'])assert.equal(destroy(blocksByName[name].defaultState).current,0,name);
});
