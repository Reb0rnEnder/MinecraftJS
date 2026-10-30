import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import mcassets from '../lib/mcassets.js';
import {initBlocks,blocksByName,jarSelectionBox,staticCollisionBoxes} from '../client/js/world/blocks.js';import {blockModelOffset} from '../client/js/render/mesher.js';import {World} from '../client/js/world/world.js';
const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url))),shapes=read('blockCollisionShapes');initBlocks(read('blocks'),shapes);const samples=JSON.parse(readFileSync(new URL('fixtures/block-offsets-'+mcassets.MC_VERSION+'.json',import.meta.url))),near=(a,b,epsilon=1e-9)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<epsilon,JSON.stringify({actual:a,expected:b})));};
const stateOf=block=>block.defaultState??(block.id<<4);
test('all model offsets match native samples including signed coordinates and world borders',()=>{
 assert.ok(samples.length>=16);for(const sample of samples)near(blockModelOffset(sample.name,...sample.position),sample.offset);
 for(const name of ['brown_mushroom','red_mushroom'])if(blocksByName[name])assert.deepEqual(blockModelOffset(name,37,11,91),[0,0,0],name+' retains native NONE offset');
});
test('the offset position seed preserves target-native height behavior',()=>{
 const name=samples[0].name,a=blockModelOffset(name,37,0,91),b=blockModelOffset(name,37,11,91);if(mcassets.MC_VERSION==='1.8.9')assert.notDeepEqual(a,b);else assert.deepEqual(a,b);
});
test('selection and collision translate only where the native shape methods use the offset',()=>{
 const w=new World();for(const sample of samples){const b=blocksByName[sample.name],state=stateOf(b),policy=b.modelOffset,[x,y,z]=sample.position,raw=jarSelectionBox(state),selection=jarSelectionBox(state,x,y,z);
 if(raw)near(selection,raw.map((v,i)=>v+(policy.selection?sample.offset[i%3]-policy.origin[i%3]:0)));
 if(policy.collision){const boxes=staticCollisionBoxes(state),world=[];w.collisionBoxes(x,y,z,world,state);assert.equal(world.length,boxes.length);boxes.forEach((box,j)=>near(world[j],box.map((v,i)=>v+sample.position[i%3]+sample.offset[i%3]-policy.origin[i%3]),1e-7));}
 }
});
test('waterlogged camera/fluid ray queries do not modify cached native collision shapes',{skip:['1.8.9','1.12.2','1.13.2'].includes(mcassets.MC_VERSION)},async()=>{
 const {findState}=await import('../client/js/world/blocks.js'),{Chunk}=await import('../client/js/world/chunk.js'),w=new World(),c=new Chunk(0,0,true),state=findState('oak_stairs',{waterlogged:'true'});c.setState(0,0,0,state);w.chunks.set('0,0',c);const before=JSON.stringify(staticCollisionBoxes(state));w.raycast(.5,.5,-1,0,0,1,4,'any',true);assert.equal(JSON.stringify(staticCollisionBoxes(state)),before);
});
