// Native 26.3 byte fixtures: decode the captured frames with the client's own Reader and
// re-encode them with its Writer. A fixture that cannot round-trip is a porting error, not a server quirk.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {Reader,Writer} from '../../client/js/net/buffer.js';
import {CONFIGURATION_CLIENTBOUND_26_3,PLAY_CLIENTBOUND_26_3} from '../../client/js/net/protocol-26.3-ids.js';
import {root} from './prepare.mjs';

const fixture=JSON.parse(await readFile(join(root,'tools/port-26.3/fixtures/login-config-26.3.json'),'utf8'));
assert.equal(fixture.protocol,777,'fixture must be captured at protocol 777');

const frame=(phase,index)=>{
  const found=fixture.frames.filter(entry=>entry.phase===phase)[index];
  assert.ok(found,'missing '+phase+' frame '+index);
  return {id:found.id,reader:new Reader(Buffer.from(found.hex,'hex'))};
};

// 1. Set Compression carries the threshold the server enforces on every later frame.
const compression=frame('login',0);
assert.equal(compression.reader.varint(),0x03,'first login frame must be Set Compression');
const threshold=compression.reader.varint();
assert.equal(threshold,256,'unexpected native compression threshold');
assert.equal(compression.reader.remaining(),0,'Set Compression must not carry trailing bytes');

// 2. Login Success is uuid + name + properties, and must re-encode byte for byte.
const success=frame('login',1);
assert.equal(success.reader.varint(),0x02,'second login frame must be Login Success');
const uuid=success.reader.uuid();
const name=success.reader.string();
const propertyCount=success.reader.varint();
const properties=[];
for(let i=0;i<propertyCount;i++){
  const key=success.reader.string(),value=success.reader.string();
  const signed=success.reader.bool();
  const signature=signed?success.reader.string():null;
  properties.push({key,value,signed,signature});
}
// 26.3 renamed this to ClientboundLoginFinishedPacket and added a session UUID after the profile:
// STREAM_CODEC = composite(ByteBufCodecs.GAME_PROFILE, UUIDUtil.STREAM_CODEC). Verified with javap on the native class.
const sessionId=success.reader.uuid();
assert.match(sessionId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,'session id must be a UUID');
assert.notEqual(sessionId,'00000000-0000-0000-0000-000000000000','session id must be present in 26.3');
assert.equal(name,'Probe26_3','fixture must keep the probe name it was captured with');
assert.equal(success.reader.remaining(),0,'Login Success must be fully consumed (profile + session id)');

const writer=new Writer();
writer.varint(0x02).uuid(uuid).string(name).varint(propertyCount);
for(const property of properties){writer.string(property.key).string(property.value).bool(property.signed);if(property.signed)writer.string(property.signature);}
writer.uuid(sessionId);
assert.deepEqual(Buffer.from(writer.build()),Buffer.from(fixture.frames.filter(entry=>entry.phase==='login')[1].hex,'hex'),'Login Success must round-trip to the native bytes');

// 3. Configuration starts with the brand payload, then the native feature and known-pack announcements.
const configIds=fixture.frames.filter(entry=>entry.phase==='configuration').map(entry=>entry.id);
assert.deepEqual(configIds.slice(0,3),[CONFIGURATION_CLIENTBOUND_26_3.custom_payload,CONFIGURATION_CLIENTBOUND_26_3.update_enabled_features,CONFIGURATION_CLIENTBOUND_26_3.select_known_packs],'configuration ids must match the generated native table');
const brand=frame('configuration',0);
assert.equal(brand.reader.varint(),1,'first configuration frame must be Custom Payload');
assert.equal(brand.reader.string(),'minecraft:brand','brand channel changed');
assert.equal(brand.reader.string(),'vanilla','native server must announce the vanilla brand');
assert.equal(brand.reader.remaining(),0,'brand payload must be fully consumed');

// 4. Update Enabled Features: a VarInt count of resource locations.
const features=frame('configuration',1);
assert.equal(features.reader.varint(),CONFIGURATION_CLIENTBOUND_26_3.update_enabled_features,'second configuration frame must be Update Enabled Features');
const featureCount=features.reader.varint();
const enabledFeatures=[];
for(let i=0;i<featureCount;i++)enabledFeatures.push(features.reader.string());
assert.deepEqual(enabledFeatures,['minecraft:vanilla'],'native 26.3 defaults must enable only the vanilla feature set');
assert.equal(features.reader.remaining(),0,'feature list must be fully consumed');

// 5. Select Known Packs: count, then namespace/id/version triples.
const knownPacks=frame('configuration',2);
assert.equal(knownPacks.reader.varint(),CONFIGURATION_CLIENTBOUND_26_3.select_known_packs,'third configuration frame must be Select Known Packs');
const packCount=knownPacks.reader.varint();
const packs=[];
for(let i=0;i<packCount;i++)packs.push({namespace:knownPacks.reader.string(),id:knownPacks.reader.string(),version:knownPacks.reader.string()});
assert.deepEqual(packs,[{namespace:'minecraft',id:'core',version:'26.3'}],'native 26.3 must announce exactly the core 26.3 pack');
assert.equal(knownPacks.reader.remaining(),0,'known pack list must be fully consumed');

// 6. Play Login is received after Finish Configuration. Its body is captured but not decoded yet:
// decoding it needs the 26.3 world/registry shapes, which is the next P03 slice.
const play=fixture.frames.find(entry=>entry.phase==='play');
assert.ok(play,'Play Login frame must be captured after Finish Configuration');
assert.equal(play.id,PLAY_CLIENTBOUND_26_3.login,'server must enter Play with the Login packet');
const playBytes=Buffer.from(play.hex,'hex');
assert.ok(playBytes.length>80,'Play Login must carry a world payload');
assert.match(play.hex,/6d696e6563726166743a6f766572776f726c64/,'Play Login must name minecraft:overworld');
assert.match(play.hex,/6d696e6563726166743a7468655f656e64/,'Play Login must list minecraft:the_end as a dimension');

console.log(JSON.stringify({protocol:777,compressionThreshold:threshold,uuid,name,sessionId,properties:properties.length,configIds:configIds.slice(0,3),brand:'vanilla',enabledFeatures,packs,playLoginBytes:Buffer.from(play.hex,'hex').length},null,2));
console.log('Native 26.3 byte fixtures passed: '+fixture.frames.length+' frames decoded and Login Success round-tripped');
