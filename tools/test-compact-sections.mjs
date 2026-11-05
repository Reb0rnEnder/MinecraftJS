import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {Section,Chunk} from '../client/js/world/chunk.js';import {initBlocks} from '../client/js/world/blocks.js';
const blocks=JSON.parse(readFileSync(new URL('../client/data/blocks.json',import.meta.url)));initBlocks(blocks,JSON.parse(readFileSync(new URL('../client/data/blockCollisionShapes.json',import.meta.url))));
test('every native registry state round-trips in compact section storage',()=>{
 const s=new Section(false),maximum=Math.max(...blocks.map(b=>b.maxStateId));assert.ok(maximum<65536);
 assert.equal(s.blocks.byteLength,8192);
 for(let state=0;state<=maximum;state++){s.set(0,0,0,state);assert.equal(s.get(0,0,0),state);}
 assert.equal(s.blocks.byteLength,8192);
});
test('decoded buffers transfer into sections without a redundant allocation or copy',()=>{
 const values=new Uint16Array(4096);values[0]=1;const s=new Section(false,values);assert.equal(s.blocks,values);s.set(1,1,1,1);assert.equal(s.get(1,1,1),1);
});
test('wider future/custom state IDs promote existing storage without truncation',()=>{
 const s=new Section(false);s.set(0,0,0,1);s.set(1,0,0,70000);assert.ok(s.blocks instanceof Uint32Array);assert.equal(s.get(0,0,0),1);assert.equal(s.get(1,0,0),70000);
});
