// Hermetic gate for the 26.3 Play adapter: rebuild the join context from the committed
// configuration frames, replay the committed Play frames, and require every adapted packet
// to target a handler that exists in game.js with the fields that handler reads.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Configuration26_3,Reader26_3,decodeConfiguration26_3} from '../../client/js/net/configuration-26.3.js';
import {decodePlayPacket} from '../../client/js/net/play-codec-26.3.js';
import {loginContext26_3} from '../../client/js/net/session-26.3.js';
import {adaptPlay26_3} from '../../client/js/net/play-adapter-26.3.js';
import {lightTo758} from '../../client/js/world/light-26.3.js';
import {root} from './prepare.mjs';

const loginFixture=JSON.parse(await readFile(join(root,'tools/port-26.3/fixtures/login-config-26.3.json'),'utf8'));
const playFixture=JSON.parse(await readFile(join(root,'tools/port-26.3/fixtures/play-26.3.json'),'utf8'));
const chunkFixture=JSON.parse(await readFile(join(root,'tools/port-26.3/fixtures/play-chunks-26.3.json'),'utf8'));
// Chunk frames are far above the 4 KiB cut of the small-frame fixture, so they are pinned
// separately from the same native capture.
playFixture.frames.push(...chunkFixture.frames);

const configuration=new Configuration26_3(()=>{},()=>{},new Map(),{knownPacks:[]});
let playLogin=null;
for(const frame of loginFixture.frames){
  const bytes=Uint8Array.from(Buffer.from(frame.hex,'hex'));
  if(frame.phase==='configuration')configuration.handle(bytes);
  if(frame.phase==='play')playLogin=decodePlayPacket(new Reader26_3(bytes)).data;
}
assert.ok(playLogin,'the fixture carries Play Login');
const context=loginContext26_3(configuration,playLogin);

const gameSource=await readFile(join(root,'client/js/game/game.js'),'utf8');
const handlers=new Set([...gameSource.matchAll(/^  on_([a-z0-9_]+)\(/gm)].map(match=>match[1]));
const adapted=[],skipped=new Map();
for(const frame of playFixture.frames){
  const reader=new Reader26_3(Uint8Array.from(Buffer.from(frame.hex,'hex')));
  const decoded=decodePlayPacket(reader);
  if(decoded.decoded)assert.equal(reader.remaining(),0,'frame '+frame.id+' ('+decoded.name+') must be consumed exactly');
  const packet=adaptPlay26_3(decoded,context);
  if(!packet){skipped.set(decoded.name,(skipped.get(decoded.name)||0)+1);continue;}
  adapted.push(packet);
}

// Entity path: two native add_entity frames resolve through the 26.3 entity_type registry,
// and every pinned set_entity_data frame decodes through the native serializer table.
const bats=adapted.filter(packet=>packet.name==='spawn_entity'&&packet.entityTypeName==='bat');
assert.equal(bats.length,2,'the native add_entity frames resolve to bats');
assert.deepEqual(bats.map(bat=>bat.type),[10,10],'both bats carry the native entity type id');
assert.ok(bats.every(bat=>bat.objectUUID&&Number.isFinite(bat.x)&&Number.isFinite(bat.z)),'spawn carries uuid and coordinates');
assert.equal(bats[0].objectData,0,'native object data');
const metadata=adapted.filter(packet=>packet.name==='entity_metadata').map(packet=>packet.metadata);
assert.equal(metadata.length,5,'every pinned set_entity_data frame adapts');
assert.equal(metadata[0][9],20,'float health at index 9 from the native frame');
assert.equal(metadata[1][9],6,'second native health value');
assert.equal(metadata[2][16],1,'native bat hanging flag is the byte 1 at index 16');

const login=adapted.find(packet=>packet.name==='login');
assert.ok(login,'Play Login adapts');
assert.equal(login.dimension,0,'login dimension is the numeric overworld id');
assert.equal(login.worldName,'minecraft:overworld','login keeps the native world name');
assert.equal(login.entityId,playLogin.playerId,'login entity id comes from the native player id');
assert.equal(login.blockStateRegistrySize,35723,'login carries the native block-state count');
assert.deepEqual(login.airStates,[0,18649,18650].sort((a,b)=>a-b),'login carries the native air states');
assert.equal(login.dimensionData.height,384,'login carries the overworld dimension type');
assert.equal(login.dimensionData.has_skylight,true,'overworld has skylight');
assert.equal(login.viewDistance,playLogin.chunkRadius,'view distance is the native chunk radius');
assert.equal(login.enableRespawnScreen,playLogin.showDeathScreen,'respawn screen flag');
// The committed fixture only keeps configuration frames up to 4 KiB, so the large biome
// registry is not in it; client-net.mjs asserts the real biome count from a live join.
assert.ok(login.biomeRegistrySize>=1,'biome registry size is at least the default entry');

const chunks=adapted.filter(packet=>packet.name==='map_chunk');
assert.equal(chunks.length,chunkFixture.frames.length,'every pinned chunk frame adapts');
for(const chunk of chunks){
  assert.equal(chunk.sections.length,24,chunk.chunkX+','+chunk.chunkZ+' has 24 sections');
  for(const section of chunk.sections){
    assert.equal(section.stateIds.length,4096,'section block states');
    assert.equal(section.biomeIds.length,64,'section biomes');
  }
  const light=lightTo758(chunk.light);
  for(const bytes of Object.values(light.skyLight))assert.equal(bytes.length,2048,'sky light section size');
  for(const bytes of Object.values(light.blockLight))assert.equal(bytes.length,2048,'block light section size');
}

const time=adapted.find(packet=>packet.name==='update_time');
if(time){
  assert.ok(Number.isFinite(Number(time.age)),'time age is numeric');
  // set_time only carries a clock entry when the day clock changed; otherwise the game keeps
  // its current timeOfDay and only advances worldAge.
  if(time.time!=null)assert.ok(Number(time.time)>=0,'daylight cycle is active');
}

const gameNames=new Set(adapted.map(packet=>packet.name));
for(const name of gameNames)assert.ok(handlers.has(name),'game.js has on_'+name+' for adapted packet '+name);

const skippedNames=[...skipped.keys()].sort();
console.log(JSON.stringify({
  frames:playFixture.frames.length,
  adapted:adapted.length,
  types:[...gameNames].sort(),
  chunks:chunks.length,
  skipped:Object.fromEntries(skippedNames.map(name=>[name,skipped.get(name)]))
},null,2));
console.log('26.3 Play frames adapt onto real game handlers ('+adapted.length+' packets, '+gameNames.size+' handler names, '+chunks.length+' chunks)');
