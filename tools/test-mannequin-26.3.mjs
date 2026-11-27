// Native 26.3 mannequin: ResolvableProfile stream, skin patch asset ids, metadata indices
// and the shared Avatar/player renderer classification.
// Sources: cache/port-26.3/client.jar (Mannequin, ClientMannequin, ResolvableProfile,
// PlayerSkin.Patch, AvatarRenderer, EntityDataSerializers).
import test from 'node:test';
import assert from 'node:assert/strict';
import {Writer26_3, Reader26_3} from '../client/js/net/configuration-26.3.js';
import {PLAY_CLIENTBOUND_26_3} from '../client/js/net/protocol-26.3-ids.js';
import {decodePlayPacket} from '../client/js/net/play-codec-26.3.js';
import {
  readResolvableProfile26_3, profileUuid, skinPatchAsset
} from '../client/js/net/resolvable-profile-26.3.js';
import {NATIVE_METADATA_26_3} from '../client/js/game/entity-metadata-26.3.js';
import {ENTITIES_BY_NAME} from '../client/js/game/entity-types.js';
import {nameUuid} from '../client/js/util/uuid-md5.js';
import {readFileSync} from 'node:fs';
import {extractModels} from '../lib/model-extract-26.3.js';
import * as M from '../client/js/render/entity-models.js';

const UUID = '12345678-1234-5678-9abc-def012345678';

function writeSkinPatch(w, {body = null, cape = null, elytra = null, model = null} = {}) {
  for (const id of [body, cape, elytra]) { w.bool(id !== null); if (id !== null) w.string(id); }
  w.bool(model !== null);
  if (model !== null) w.bool(model === 'slim');
  return w;
}

function writeFullProfile(w) {
  return writeSkinPatch(
    w.bool(true).uuid(UUID).string('Mannequin').varint(1)
      .string('textures').string('dGVzdA==').bool(false),
    {body: 'minecraft:entity/player/slim/alex', model: 'slim'}
  );
}

test('26.3 ResolvableProfile decodes a full profile and its skin patch', () => {
  const w = writeFullProfile(new Writer26_3());
  const decoded = readResolvableProfile26_3(new Reader26_3(w.build()));
  assert.equal(decoded.profile.id, UUID);
  assert.equal(decoded.profile.name, 'Mannequin');
  assert.deepEqual(decoded.profile.properties, [{name: 'textures', value: 'dGVzdA==', signature: null}]);
  assert.deepEqual(decoded.skinPatch, {
    body: 'minecraft:entity/player/slim/alex', cape: null, elytra: null, model: 'slim'
  });
  assert.equal(decoded.dynamic, false);
  assert.equal(skinPatchAsset(decoded.skinPatch.body), 'entity/player/slim/alex.png');
  assert.equal(profileUuid(decoded.profile), UUID);
});

test('26.3 dynamic partial profiles use the offline player UUID for the default skin', () => {
  const byName = new Writer26_3().bool(false).bool(true).string('Notch').bool(false).varint(0);
  writeSkinPatch(byName);
  const named = readResolvableProfile26_3(new Reader26_3(byName.build()));
  assert.equal(named.dynamic, true);
  assert.equal(named.profile.id, null);
  assert.equal(profileUuid(named.profile), nameUuid(new TextEncoder().encode('Notch')));

  const byId = new Writer26_3().bool(false).bool(false).bool(true).uuid(UUID).varint(0);
  writeSkinPatch(byId);
  const idOnly = readResolvableProfile26_3(new Reader26_3(byId.build()));
  assert.equal(idOnly.dynamic, true);
  assert.equal(profileUuid(idOnly.profile), UUID);

  const empty = new Writer26_3().bool(false).bool(false).bool(false).varint(0);
  writeSkinPatch(empty);
  const nil = readResolvableProfile26_3(new Reader26_3(empty.build()));
  assert.equal(nil.dynamic, false);
  assert.equal(profileUuid(nil.profile), '00000000-0000-0000-0000-000000000000');
});

test('26.3 set_entity_data decodes the mannequin metadata indices', () => {
  const w = new Writer26_3();
  w.varint(PLAY_CLIENTBOUND_26_3.set_entity_data).varint(42);
  w.u8(17).varint(41); writeFullProfile(w);
  w.u8(18).varint(8).bool(true);
  w.u8(15).varint(42).varint(0); // LEFT
  w.u8(16).varint(0).varint(0x7f);
  w.u8(0xff);
  const packet = decodePlayPacket(new Reader26_3(w.build()));
  assert.equal(packet.name, 'set_entity_data');
  const metadata = packet.data.metadata;
  assert.equal(metadata[17].profile.name, 'Mannequin');
  assert.equal(metadata[17].skinPatch.body, 'minecraft:entity/player/slim/alex');
  assert.equal(metadata[18], true);
  assert.equal(metadata[15], 0);
  assert.equal(metadata[16], 0x7f);
});

test('26.3 mannequin metadata indices and entity definition are native', () => {
  assert.deepEqual(
    ['DATA_PROFILE', 'DATA_IMMOVABLE', 'DATA_DESCRIPTION', 'DATA_PLAYER_MAIN_HAND', 'DATA_PLAYER_MODE_CUSTOMISATION']
      .map(key => NATIVE_METADATA_26_3.mannequin[key]),
    [17, 18, 19, 15, 16]
  );
  const def = ENTITIES_BY_NAME.mannequin;
  assert.equal(def.mob, true);
  assert.deepEqual([def.width, def.height, def.eyeHeight], [0.6, 1.8, 1.62]);
  const jar = readFileSync(new URL('../cache/port-26.3/client.jar', import.meta.url));
  const {models, errors} = extractModels({data: jar});
  assert.deepEqual(errors, []);
  M.setJarModels(models);
  assert.equal(M.playerModel(true).slim, true);
  assert.equal(M.playerModel(false).slim, false);
});
