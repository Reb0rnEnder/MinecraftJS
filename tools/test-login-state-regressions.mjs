import {test} from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../client/js/game/game.js';
test('Join Game clears previous-server metadata and maximum health on reconnect and proxy transfer',()=>{
 const noop=()=>{},g={inWorld:false,gameMode:1,maxHealth:80,selfMetadata:{17:{old:true},11:8},world:{setDimension:noop,clear:noop},entities:{clear:noop},tileRenderer:{clear:noop},pistons:{clear:noop},_resetMeshing:noop,applyGameMode:noop,sendSettings:noop,send:noop};
 const packet={entityId:7,gameMode:0,dimension:0,difficulty:2,maxPlayers:20,levelType:'default',reducedDebugInfo:false};
 for(let i=0;i<2;i++){g.selfMetadata={17:{old:true},11:8};g.maxHealth=80;Game.prototype.on_login.call(g,packet);assert.deepEqual(g.selfMetadata,{});assert.equal(g.maxHealth,20);assert.equal(g.gameMode,0);}
});
