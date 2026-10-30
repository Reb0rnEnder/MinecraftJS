import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {TileEntityRenderer} from '../client/js/render/tile-renderer.js';import {initBlocks,blocksByName} from '../client/js/world/blocks.js';
const read=name=>JSON.parse(readFileSync(new URL('../client/data/'+name+'.json',import.meta.url)));initBlocks(read('blocks'),read('blockCollisionShapes'));
test('empty sections avoid block scans while nonempty sections still find tile entities',()=>{
 const empty={nonAir:0,get blocks(){throw Error('empty block array should not be scanned');}},sections=new Array(16).fill(empty),c={x:0,z:0,minSection:0,maxSection:16,sections,getSection:y=>sections[y]},found=[];
 TileEntityRenderer.prototype.scanChunk.call({_ensure:(...args)=>found.push(args)},c);assert.equal(found.length,0);
 const chest=blocksByName.chest,blocks=new Uint32Array(4096);blocks[0]=chest.defaultState??chest.id<<4;sections[0]={nonAir:1,blocks};TileEntityRenderer.prototype.scanChunk.call({_ensure:(...args)=>found.push(args)},c);assert.equal(found.length,1);assert.deepEqual(found[0].slice(0,3),[0,0,0]);
});
