import {test} from 'node:test';import assert from 'node:assert/strict';import {immediateChunkBuild} from '../client/js/render/chunk-build-policy.js';
test('native chunk builder modes retain player flags and strict center-distance threshold',()=>{
 for(const affected of [true,false])assert.equal(immediateChunkBuild('none',affected,0,0,0,[8,8,8]),false);
 assert.equal(immediateChunkBuild('byPlayer',false,0,0,0,[8,8,8]),false);assert.equal(immediateChunkBuild('byPlayer',true,500,0,500,[0,0,0]),true);
 assert.equal(immediateChunkBuild('nearby',false,0,0,0,[24,24,24]),false);assert.equal(immediateChunkBuild('nearby',false,0,0,0,[24,24,23.99]),true);assert.equal(immediateChunkBuild('nearby',true,500,0,500,[0,0,0]),true);
});
