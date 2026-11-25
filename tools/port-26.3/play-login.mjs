// Native 26.3 Play Login decode. Field order comes from javap on ClientboundLoginPacket:
// playerId(INT) hardcore(BOOL) levels(set of dimension keys) maxPlayers chunkRadius simulationDistance
// reducedDebugInfo showDeathScreen doLimitedCrafting commonPlayerSpawnInfo onlineMode enforcesSecureChat.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Reader} from '../../client/js/net/buffer.js';
import {PLAY_CLIENTBOUND_26_3} from '../../client/js/net/protocol-26.3-ids.js';
import {root} from './prepare.mjs';

const fixture=JSON.parse(await readFile(join(root,'tools/port-26.3/fixtures/login-config-26.3.json'),'utf8'));
const play=fixture.frames.find(frame=>frame.phase==='play');
assert.ok(play,'Play Login frame must exist in the fixture');

const reader=new Reader(Buffer.from(play.hex,'hex'));
assert.equal(reader.varint(),PLAY_CLIENTBOUND_26_3.login,'packet id must be Play Login');

const playerId=reader.i32();
const hardcore=reader.bool();
const levelCount=reader.varint();
const levels=[];
for(let i=0;i<levelCount;i++)levels.push(reader.string());
const maxPlayers=reader.varint();
const chunkRadius=reader.varint();
const simulationDistance=reader.varint();
const reducedDebugInfo=reader.bool();
const showDeathScreen=reader.bool();
const doLimitedCrafting=reader.bool();

// CommonPlayerSpawnInfo
const dimensionTypeId=reader.varint();
const dimension=reader.string();
const seed=reader.i64();
const gameMode=reader.i8();
const previousGameMode=reader.i8();
const isDebug=reader.bool();
const isFlat=reader.bool();
const hasLastDeath=reader.bool();
let lastDeath=null;
if(hasLastDeath)lastDeath={dimension:reader.string(),position:reader.position()};
const portalCooldown=reader.varint();
const seaLevel=reader.varint();

const onlineMode=reader.bool();
const enforcesSecureChat=reader.bool();
const trailing=reader.remaining();

assert.equal(trailing,0,'Play Login must be fully consumed; leftover bytes mean the field order is wrong');
assert.ok(levels.includes('minecraft:overworld'),'level set must contain the overworld');
assert.ok(levels.includes('minecraft:the_end'),'level set must contain the end');
assert.equal(dimension,'minecraft:overworld','spawn dimension must be the overworld');
assert.ok(maxPlayers>=1&&maxPlayers<=1000,'max players must be plausible');
assert.ok(chunkRadius>=2&&chunkRadius<=32,'chunk radius must be plausible');
assert.ok(simulationDistance>=2&&simulationDistance<=32,'simulation distance must be plausible');
assert.ok(gameMode>=0&&gameMode<=3,'game mode must be a known id');

console.log(JSON.stringify({
  playerId,hardcore,levels,maxPlayers,chunkRadius,simulationDistance,
  reducedDebugInfo,showDeathScreen,doLimitedCrafting,
  spawn:{dimensionTypeId,dimension,seed:String(seed),gameMode,previousGameMode,isDebug,isFlat,lastDeath,portalCooldown,seaLevel},
  onlineMode,enforcesSecureChat,trailingBytes:trailing
},null,2));
console.log('Native 26.3 Play Login decoded: '+levels.length+' levels, '+dimension+', '+reader.offset+' bytes consumed');
