// Hermetic gate for the 26.3 login and configuration codecs: replay the committed native
// frames through the client's own decoders and require exact frame consumption.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {decodeLogin26_3,decodeConfiguration26_3,Reader26_3,Writer26_3} from '../../client/js/net/configuration-26.3.js';
import {CONFIGURATION_CLIENTBOUND_26_3 as CI} from '../../client/js/net/protocol-26.3-ids.js';
import {decodePlayPacket} from '../../client/js/net/play-codec-26.3.js';
import {root} from './prepare.mjs';

const fixture=JSON.parse(await readFile(join(root,'tools/port-26.3/fixtures/login-config-26.3.json'),'utf8'));
assert.equal(fixture.protocol,777,'fixture must be protocol 777');

// Configuration dialogs and server links were previously left raw. Build the native holder
// and either envelopes by hand from javap to pin their field order.
const inlineDialog=decodeConfiguration26_3(Uint8Array.from(new Writer26_3()
  .varint(CI.show_dialog).varint(0).raw([10,0]).build()));
assert.equal(inlineDialog.name,'show_dialog');
assert.equal(inlineDialog.dialogId,null,'inline dialogs have no registry id');
assert.equal(inlineDialog.dialog.t,10,'inline dialogs carry one anonymous compound');
const linkedDialog=decodeConfiguration26_3(Uint8Array.from(new Writer26_3().varint(CI.show_dialog).varint(4).build()));
assert.equal(linkedDialog.dialogId,3,'registry dialogs use id-1');
const links=decodeConfiguration26_3(Uint8Array.from(new Writer26_3()
  .varint(CI.server_links).varint(1).bool(true).varint(2).string('https://example.invalid/').build()));
assert.deepEqual(links.links,[{type:2,name:null,link:'https://example.invalid/'}],'server links decode a known type');

const names=[];
let profile=null,playLogin=null,registryFrames=0;
for(const frame of fixture.frames){
  const bytes=Uint8Array.from(Buffer.from(frame.hex,'hex'));
  if(frame.phase==='login'){
    const packet=decodeLogin26_3(bytes);
    names.push('login:'+packet.name);
    if(packet.name==='login_finished'){
      profile=packet;
      assert.equal(packet.id,2,'Login Finished is clientbound login packet 2');
      assert.match(packet.uuid,/^[0-9a-f-]{36}$/,'profile UUID');
      assert.match(packet.sessionId,/^[0-9a-f-]{36}$/,'session UUID');
      assert.ok(packet.username.length>0,'profile name');
    }
  }else if(frame.phase==='configuration'){
    const packet=decodeConfiguration26_3(bytes);
    names.push('configuration:'+packet.name);
    assert.ok(packet.decoded,'configuration packet '+packet.name+' stays decoded');
    if(packet.name==='registry_data'){
      registryFrames++;
      assert.ok(packet.entries.length>0,'registry '+packet.registry+' must list entries');
      const keys=new Set(packet.entries.map(entry=>entry.key));
      assert.equal(keys.size,packet.entries.length,'registry keys are unique within a frame');
    }
    if(packet.name==='custom_payload'&&packet.channel==='minecraft:brand')assert.ok(packet.brand.length>0,'brand payload decodes');
  }else if(frame.phase==='play'){
    const reader=new Reader26_3(bytes);
    const packet=decodePlayPacket(reader);
    assert.equal(packet.name,'login','the captured Play frame is Play Login');
    assert.ok(packet.decoded,'Play Login decodes');
    assert.equal(reader.remaining(),0,'Play Login consumes its frame exactly');
    playLogin=packet.data;
    names.push('play:login');
  }
}

assert.ok(profile,'fixture must contain Login Finished');
assert.ok(profile.sessionId!==profile.uuid,'26.3 adds a session UUID distinct from the profile UUID');
assert.ok(playLogin,'fixture must contain Play Login');
assert.ok(playLogin.levels.includes('minecraft:overworld'),'Play Login level set');
assert.equal(playLogin.spawn.dimension,'minecraft:overworld','Play Login spawn dimension');
assert.ok(names.includes('configuration:select_known_packs'),'fixture must contain Select Known Packs');
assert.ok(names.includes('configuration:finish_configuration'),'fixture must contain Finish Configuration');
assert.ok(registryFrames>0,'fixture must contain at least one registry_data frame');

console.log(JSON.stringify({frames:fixture.frames.length,names,registryFrames,username:profile.username},null,2));
console.log('Native 26.3 login/configuration frames decoded exactly by the client codecs ('+fixture.frames.length+' frames)');
