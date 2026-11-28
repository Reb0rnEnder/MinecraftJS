// 26.3's play adapter emits itemId from the native cooldown group; the shared handler still accepts
// the 1.20.6 itemID spelling. Guard both sides so a renamed field cannot silently store undefined.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Writer} from '../client/js/net/buffer.js';
import {readChunkBuffer} from '../client/js/net/chunk-26.3.js';
import {adaptPlay26_3} from '../client/js/net/play-adapter-26.3.js';
const read = (p) => readFileSync(new URL('../client/js/' + p, import.meta.url), 'utf8');
const game = read('game/game.js'), adapter = read('net/play-adapter-26.3.js');
test('26.3 cooldown adapter maps the native cooldown group to itemId', () => {
  assert.match(adapter, /cooldown\(packet\)[\s\S]{0,300}return \{itemId,cooldownTicks:packet\.duration\}/);
});
test('the shared cooldown handler accepts both itemID and itemId', () => {
  assert.match(game, /p\.itemID \?\? p\.itemId/);
});
test('26.3 ticking handlers read the native camelCase fields with snake_case fallbacks', () => {
  assert.match(game, /p\.tickRate \?\? p\.tick_rate/);
  assert.match(game, /p\.isFrozen \?\? p\.is_frozen/);
  assert.match(game, /p\.tickSteps \?\? p\.tick_steps/);
});
test('26.3 online-mode hello maps the native challenge into the encryption responder', () => {
  const socket = read('net/tcp-26.3.js');
  assert.match(socket, /serverId:packet\.serverId,publicKey:packet\.publicKey,verifyToken:packet\.challenge/);
});
test('26.3 play login resolves the resource-location dimension to a numeric id', () => {
  const out = adaptPlay26_3({name:'login',decoded:true,data:{playerId:1,hardcore:false,spawn:{dimensionType:0,dimension:'minecraft:overworld',seed:'0',gameMode:0,previousGameMode:-1,isDebug:false,isFlat:true,lastDeath:null,portalCooldown:0,seaLevel:63}}},{dimensionData:{effects:'minecraft:overworld'}});
  assert.equal(out.dimension,0);
  assert.equal(out.levelType,'flat');
  assert.equal(out.worldName,'minecraft:overworld');
  const end = adaptPlay26_3({name:'login',decoded:true,data:{playerId:1,hardcore:false,spawn:{dimensionType:1,dimension:'minecraft:the_end',seed:'0',gameMode:0,previousGameMode:-1,isDebug:false,isFlat:false,lastDeath:null,portalCooldown:0,seaLevel:63}}},{dimensionData:{effects:'minecraft:the_end'}});
  assert.equal(end.dimension,1);
  assert.equal(end.levelType,'default');
});
test('26.3 set_time keeps the day time when the packet carries no clock', () => {
  const tick = adaptPlay26_3({name:'set_time',decoded:true,data:{gameTime:'63539',clocks:{}}},null);
  assert.equal(tick.name,'update_time');
  assert.equal(tick.age,'63539');
  assert.equal(tick.time,null);
  const changed = adaptPlay26_3({name:'set_time',decoded:true,data:{gameTime:'63539',clocks:{0:{totalTicks:'6000',partialTick:0,rate:20}}}},null);
  assert.equal(changed.time,'6000');
});
test('26.3 chunk buffers decode every native section, including 16-section nether/end chunks', () => {
  const section = () => {
    const w = new Writer();
    w.i16(0).i16(0); // nonEmptyBlockCount, fluidCount
    w.u8(0).varint(0); // single-value block states
    w.u8(0).varint(0); // single-value biomes
    return w.build();
  };
  for (const count of [16, 24]) {
    const w = new Writer();
    for (let i = 0; i < count; i++) w.raw(section());
    assert.equal(readChunkBuffer(w.build()).length, count, `${count}-section chunk`);
  }
});
