import {test} from 'node:test';import assert from 'node:assert/strict';
import {Game} from '../client/js/game/game.js';
import {decodePacket498,Writer498} from '../client/js/net/protocol-1.14.4.js';
import {CLIENTBOUND_498 as IN} from '../client/js/net/protocol-1.14.4-ids.js';
import {NATIVE_METADATA} from '../client/js/game/entity-metadata-1.14.4.js';
test('native player absorption and shoulder fields are distinct',()=>{assert.equal(NATIVE_METADATA.player.DATA_PLAYER_ABSORPTION_ID,13);assert.equal(NATIVE_METADATA.player.DATA_SHOULDER_LEFT,17);});
test('native respawn keeps the handler game mode and difficulty through survival, adventure and creative transfers',()=>{
 const g={dimension:0,gameMode:1,difficulty:2,player:{},world:{setDimension(){}},screens:{current:null},applyGameMode:Game.prototype.applyGameMode};
 for(const mode of [0,2,1,0]){
  const p=decodePacket498(new Writer498().varint(IN.respawn).i32(0).u8(mode).string('default').build());Game.prototype.on_respawn.call(g,p);
  assert.equal(g.gameMode,mode);assert.equal(g.player.creative,mode===1);assert.equal(g.difficulty,2);assert.equal(g.health,20);
 }
});
