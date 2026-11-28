// Values a vanilla 1.20.6 client tolerates: unknown game modes (ByIdMap ZERO -> survival), difficulties (WRAP)
// and game event types (ignored). Seen from proxied servers that send out-of-range bytes.
import {test} from 'node:test';import assert from 'node:assert/strict';
import {Writer766} from '../client/js/net/configuration-1.20.6.js';
import {decodePlayBody766} from '../client/js/net/play-codec-1.20.6.js';
import {PLAY_CLIENTBOUND_766 as IDS} from '../client/js/net/protocol-1.20.6-ids.js';
const ctx={registries:new Map([['minecraft:dimension_type',{entries:[{key:'minecraft:overworld',value:{t:10,v:{}}}]}]])};
test('login with game mode -9 and previous game mode -9 decodes as survival, like GameType.byId',()=>{
  const w=new Writer766().i32(1).bool(false).varint(1).string('minecraft:overworld').varint(20).varint(10).varint(10).bool(false).bool(true).bool(false)
    .varint(0).string('minecraft:overworld').i64(0n).i8(-9).i8(-9).bool(false).bool(false).bool(false).varint(0).bool(false);
  let p;try{p=decodePlayBody766('login',w.build(),ctx);}catch(e){p=decodePlayBody766('login',w.build());}
  assert.equal(p.gameMode,0);assert.equal(p.previousGameMode,0);
});
test('difficulty wraps and unknown game events are ignored',()=>{
  const d=decodePlayBody766('difficulty',new Writer766().u8(6).bool(false).build());assert.equal(d.difficulty,2);
  const e=decodePlayBody766('game_state_change',new Writer766().u8(200).f32(0).build());assert.equal(e.reason,-1);
});
