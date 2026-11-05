import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {initBlocks,blocksByName} from '../client/js/world/blocks.js';import {Interaction} from '../client/js/game/interaction.js';
const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(read('blocks'),read('blockCollisionShapes'));
test('native 1.14+ block destruction leaves tool durability and destruction to server updates',()=>{
 const tool={id:123,count:1,damage:99},sound=[],writes=[];let state=blocksByName.oak_planks.defaultState;
 const game={gameMode:0,inventory:{held:()=>tool,setHeld(){throw Error('Client must not delete a damaged tool');}},items:{isDamageable(){throw Error('Client must not apply mining durability');}},world:{getState:()=>state,setState:(x,y,z,s)=>{state=s;writes.push(s);}},sound:{playBlockBreak:()=>sound.push('block'),playAtPlayer:()=>sound.push('item')},particles:{blockBreak(){}}};
 assert.equal(new Interaction(game).destroyBlockClient({x:1,y:64,z:2}),true);assert.deepEqual(tool,{id:123,count:1,damage:99});assert.deepEqual(writes,[0]);assert.deepEqual(sound,['block']);
});
