import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {SoundManager} from '../client/js/audio/sound.js';import {initBlocks,blocksByName} from '../client/js/world/blocks.js';
const read=n=>JSON.parse(readFileSync(new URL('../client/data/'+n+'.json',import.meta.url)));initBlocks(read('blocks'),read('blockCollisionShapes'));
test('mining hit uses its native version sound category, volume and pitch',()=>{
 const played=[],sound=Object.assign(Object.create(SoundManager.prototype),{play:(...args)=>played.push(args)});
 sound.playBlockHit(1,64,2,blocksByName.stone.defaultState);
 assert.equal(played.length,1);assert.deepEqual(played[0].slice(1,6),[1.5,64.5,2.5,.25,.5]);assert.equal(played[0][6]?.category,'block');
});
