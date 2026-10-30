import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';
import {VANILLA_UI} from '../client/js/gui/vanilla-layout.js';
import {initBlocks,getStateProperties,findState} from '../client/js/world/blocks.js';
const json=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));
const defs=json('blocks');initBlocks(defs,json('blockCollisionShapes'));
test('explicit property values retain their native lower bound and state IDs round-trip',()=>{
 for(const block of defs)for(const prop of block.states||[])if(prop.values?.length){
  const values=new Set();for(let state=block.minStateId;state<=block.maxStateId;state++){
   const properties=getStateProperties(state);values.add(properties[prop.name]);assert.equal(findState(block.name,properties),state,block.name+' '+state);
  }
  assert.deepEqual([...values].sort(),prop.values.map(String).sort(),block.name+'.'+prop.name);
 }
});
const native=new URL('../cache/port-1.17.1/generated/reports/blocks.json',import.meta.url);
if(VANILLA_UI.version==='1.17.1'&&existsSync(native))test('all 20,342 native 1.17.1 state IDs decode to the exact native properties',()=>{
 const report=JSON.parse(readFileSync(native));let count=0;
 for(const [name,block] of Object.entries(report))for(const state of block.states){assert.deepEqual(getStateProperties(state.id),state.properties||{},name+' '+state.id);count++;}
 assert.equal(count,20342);
});
