import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ZipFile } from '../../lib/zip.js';
import { nativeClasspath } from '../../lib/native-classpath.js';
import { cache, root, target, verify } from './prepare.mjs';
import { patchSharedComponentTypes } from './generate-component-schema.mjs';
import { packetSample } from './packet-samples.mjs';
import { builderSamples } from './packet-builder-samples.mjs';
import { PLAY_SCHEMA_774 } from '../../client/js/net/play-schema-1.21.11.js';
import { PLAY_SERVERBOUND_774 } from '../../client/js/net/protocol-1.21.11-ids.js';
import {
  NATIVE_PLAY_CLIENTBOUND_NAMES_774,
  NATIVE_PLAY_SERVERBOUND_NAMES_774
} from '../../client/js/net/native-packet-names-1.21.11.js';
import { KNOWN_PACK_774 } from '../../client/js/net/known-pack-1.21.11.js';
import { decodePlayPacket774 } from '../../client/js/net/play-codec-1.21.11.js';

function cleanClientClasspath() {
  const unsignedPath = join(cache, 'client-unsigned.jar');
  const signed = new ZipFile(join(cache, 'client.jar'));
  const unsigned = new ZipFile(unsignedPath);
  for (const name of signed.list('').filter((n) => n.endsWith('.class'))) {
    assert.ok(signed.read(name).equals(unsigned.read(name)), 'Modified native class ' + name);
  }
  const parts = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes(join('bundler', 'META-INF', 'versions')));
  parts[0] = unsignedPath;
  return parts.map((entry) => resolve(entry)).join(delimiter);
}

export async function runPacketOracleCheck({ write = false, check = false } = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'client jar');
  verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'client mappings');

  const protocolPath = join(cache, 'upstream/protocol.json');
  verify(await readFile(protocolPath), target.minecraftData.inputs['upstream/protocol.json'], 'protocol schema');
  const protocol = JSON.parse(await readFile(protocolPath, 'utf8'));

  const serverTypes = { ...structuredClone(protocol.types), ...structuredClone(protocol.play.toServer.types) };
  patchSharedComponentTypes(serverTypes);
  if (serverTypes.packet_common_custom_click_action?.[0] === 'container') {
    const nbtField = serverTypes.packet_common_custom_click_action[1].find((f) => f.name === 'nbt' || f.name === 'payload');
    if (nbtField) nbtField.type = 'lengthPrefixedAnonOptionalNbt';
  }
  const serverIds = Object.fromEntries(
    Object.entries(serverTypes.packet[1][0].type[1].mappings).map(([id, name]) => [name, Number(id)])
  );
  for (const name of Object.keys(serverIds)) {
    serverTypes['packet_' + name] ??= serverTypes['packet_common_' + name];
  }
  assert.deepEqual(serverIds, PLAY_SERVERBOUND_774, 'SB ID map mismatch vs PLAY_SERVERBOUND_774');
  assert.equal(PLAY_SCHEMA_774.packets.length, 139, 'Expected 139 CB Play packets');
  assert.equal(Object.keys(serverIds).length, 66, 'Expected 66 SB Play packets');

  const serverSchema = {
    types: serverTypes,
    ids: serverIds,
    packets: Object.keys(serverIds).sort((a, b) => serverIds[a] - serverIds[b])
  };

  const sampleErrors = [];
  const samples = [];

  for (const [direction, schema] of [['CLIENTBOUND', PLAY_SCHEMA_774], ['SERVERBOUND', serverSchema]]) {
    const currentSamples = [];
    const add = (name, mode, overrides) => {
      const s = packetSample(schema, name, mode, overrides);
      s.direction = direction;
      s.label = direction + ':' + s.label;
      currentSamples.push(s);
      return s;
    };

    for (const name of schema.packets) {
      for (const mode of ['sparse', 'dense']) {
        try {
          add(name, mode);
        } catch (e) {
          sampleErrors.push({ direction, name, mode, error: e.message });
        }
      }
    }

    const seen = new Set();
    const branches = new Set();
    for (const s of currentSamples) {
      for (const t of s.trace) branches.add(s.name + '|' + t.path + '|' + String(t.current));
    }

    for (let at = 0; at < currentSamples.length && currentSamples.length < 3000; at++) {
      const current = currentSamples[at];
      if (!current.label.includes('dense')) continue;
      for (const t of current.trace) {
        for (const key of t.keys) {
          if (key === 'DedicatedServerTickTime') continue;
          const branchKey = current.name + '|' + t.path + '|' + String(key);
          if (branches.has(branchKey) || !t.control) continue;
          branches.add(branchKey);
          const v = key === 'true' ? true : key === 'false' ? false : /^-?\d+$/.test(String(key)) ? Number(key) : key;
          const overrides = { ...current.overrides, [t.control]: v };
          const sig = JSON.stringify([current.name, overrides], (_, val) => typeof val === 'bigint' ? String(val) : val);
          if (seen.has(sig)) continue;
          seen.add(sig);
          try {
            const next = add(current.name, 'dense', overrides);
            next.label = direction + ':' + current.name + ':dense:branch-' + currentSamples.length;
          } catch (error) {
            sampleErrors.push({ direction, name: current.name, branch: t.path, key, error: error.message });
          }
        }
      }
    }
    samples.push(...currentSamples);
  }

  // Edge-case matrices:
  // 1. Advancements display flags 0..7
  for (let mask = 0; mask < 8; mask++) {
    const prefix = 'packet_advancements.advancementMapping[].value.displayData?';
    const sample = packetSample(
      PLAY_SCHEMA_774,
      'advancements',
      'dense',
      Object.fromEntries(['has_background_texture', 'show_toast', 'hidden'].map((f, i) => [prefix + '.flags.' + f, (mask >> i) & 1]))
    );
    sample.label = 'CLIENTBOUND:advancements:flags-' + mask;
    samples.push(sample);
  }

  // 2. player_info 8-bit action masks (individual bits + combinations + all 255)
  const playerInfoMasks = new Set([0, 255]);
  for (let b = 0; b < 8; b++) playerInfoMasks.add(1 << b);
  for (let mask = 0; mask < 64; mask++) playerInfoMasks.add(mask);
  for (const mask of [...playerInfoMasks].sort((a, b) => a - b)) {
    const sample = packetSample(PLAY_SCHEMA_774, 'player_info', 'dense', { 'packet_player_info.action': mask });
    sample.label = 'CLIENTBOUND:player_info:actions-' + mask;
    samples.push(sample);
  }

  // 3. entity_metadata registry-backed serializers
  const metaRegistryTypes = [
    [21, 'cat_variant'],
    [22, 'cow_variant'],
    [23, 'wolf_variant'],
    [24, 'wolf_sound_variant'],
    [25, 'frog_variant'],
    [26, 'pig_variant'],
    [27, 'chicken_variant'],
    [28, 'zombie_nautilus_variant'],
    [30, 'painting_variant']
  ];
  for (const [typeId, typeName] of metaRegistryTypes) {
    for (const id of [0, 1]) {
      const s = packetSample(PLAY_SCHEMA_774, 'entity_metadata', 'dense', {
        'packet_entity_metadata.metadata[].type': typeId,
        ['packet_entity_metadata.metadata[].value=' + typeName]: id
      });
      s.label = 'CLIENTBOUND:entity_metadata:registry-' + typeId + '-id-' + id;
      samples.push(s);
    }
  }

  // 4. lpVec3 edge cases (zero, small, continuation varint scale > 3, negative)
  for (const [tag, vec] of [
    ['zero', { x: 0, y: 0, z: 0 }],
    ['unit', { x: 0.25, y: -0.5, z: 0.75 }],
    ['scaled', { x: 12.5, y: -40.25, z: 3.125 }],
    ['large_varint', { x: 500.5, y: -1200.25, z: 999.75 }]
  ]) {
    const vel = packetSample(PLAY_SCHEMA_774, 'entity_velocity', 'dense', { 'packet_entity_velocity.velocity': vec });
    vel.label = 'CLIENTBOUND:entity_velocity:lpvec3-' + tag;
    samples.push(vel);

    const sp = packetSample(PLAY_SCHEMA_774, 'spawn_entity', 'dense', { 'packet_spawn_entity.velocity': vec });
    sp.label = 'CLIENTBOUND:spawn_entity:lpvec3-' + tag;
    samples.push(sp);
  }

  // 5. u32 edge cases (PositionUpdateRelatives flags in position / entity_teleport)
  for (const [tag, val] of [['zero', 0], ['all_bits', 0x1ff], ['max_u32', 0xffffffff]]) {
    const pos = packetSample(PLAY_SCHEMA_774, 'position', 'dense', { 'packet_position.flags': val });
    pos.label = 'CLIENTBOUND:position:u32-' + tag;
    samples.push(pos);
  }

  samples.push(...builderSamples());

  // Run native Java oracle via JEP 330 single-file invocation
  const folder = join(cache, 'packet-audit');
  await mkdir(folder, { recursive: true });
  const orderPath = join(folder, 'registry-order.json');
  const inputPath = join(folder, 'input.json');
  const outputPath = join(folder, 'native.json');
  await writeFile(
    orderPath,
    JSON.stringify(
      Object.fromEntries(Object.entries(KNOWN_PACK_774.registries).map(([k, v]) => [k, v.map((e) => e.key)]))
    )
  );
  await writeFile(inputPath, JSON.stringify(samples, (_, v) => typeof v === 'bigint' ? String(v) : v));

  const cp = cleanClientClasspath();
  const javaPath = join(root, 'tools/port-1.21.11/PacketRoundtrip12111.java');
  try {
    execFileSync(
      process.env.JAVA || 'java',
      ['-Xmx768M', '-cp', cp, javaPath, outputPath, join(cache, 'client.txt'), orderPath, inputPath],
      { encoding: 'utf8', stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 }
    );
  } catch (e) {
    process.stderr.write(e.stdout || '');
    process.stderr.write(e.stderr || e.message);
    throw new Error('Native packet oracle failed');
  }

  const native = JSON.parse(await readFile(outputPath, 'utf8'));
  const byLabel = new Map(native.map((p) => [p.label, p]));
  const context = {
    features: ['minecraft:vanilla'],
    registries: new Map(
      Object.entries(KNOWN_PACK_774.registries).map(([k, v]) => [k, v.map((e, id) => ({ ...e, id }))])
    )
  };

  const results = samples.map((s) => {
    const n = byLabel.get(s.label);
    let decoded, jsError;
    try {
      if (s.direction === 'CLIENTBOUND') {
        decoded = decodePlayPacket774(Buffer.from(n.wire ?? s.wire, 'base64'), context);
      }
    } catch (e) {
      jsError = (e.cause || e).message;
    }
    const id = (s.direction === 'CLIENTBOUND' ? PLAY_SCHEMA_774.ids : serverIds)[s.name];
    const nativeNames = s.direction === 'CLIENTBOUND' ? NATIVE_PLAY_CLIENTBOUND_NAMES_774 : NATIVE_PLAY_SERVERBOUND_NAMES_774;
    const expectedNativeType = (s.direction === 'CLIENTBOUND' ? 'clientbound' : 'serverbound') + '/minecraft:' + nativeNames[id];
    const identityOk = n.nativeType === expectedNativeType;
    return {
      label: s.label,
      name: s.name,
      direction: s.direction,
      native: n,
      expectedNativeType,
      identityOk,
      jsError,
      normalizedName: decoded?.name,
      canonical: n.wire === s.wire,
      coverage: s.coverage
    };
  });

  const nativeErrors = results.filter((r) => r.native.error || r.native.remaining !== 0 || !r.identityOk);
  const jsErrors = results.filter((r) => r.jsError);
  const cbPackets = new Set(results.filter((r) => r.direction === 'CLIENTBOUND' && !r.native.error && r.native.remaining === 0 && r.identityOk && !r.jsError).map((r) => r.name));
  const sbPackets = new Set(results.filter((r) => r.direction === 'SERVERBOUND' && !r.native.error && r.native.remaining === 0 && r.identityOk).map((r) => r.name));

  const summary = {
    totalSamples: results.length,
    clientboundSamples: results.filter((r) => r.direction === 'CLIENTBOUND').length,
    serverboundSamples: results.filter((r) => r.direction === 'SERVERBOUND').length,
    cbPacketCoverage: cbPackets.size + '/' + PLAY_SCHEMA_774.packets.length,
    sbPacketCoverage: sbPackets.size + '/' + serverSchema.packets.length,
    sampleErrors,
    nativeErrorCount: nativeErrors.length,
    jsErrorCount: jsErrors.length,
    nativeErrors: nativeErrors.slice(0, 30),
    jsErrors: jsErrors.slice(0, 30)
  };

  await writeFile(
    join(folder, 'report.json'),
    JSON.stringify({
      target: target.minecraftVersion,
      clientJarSha1: target.downloads.client.sha1,
      oracleSha256: createHash('sha256').update(await readFile(javaPath)).digest('hex'),
      summary,
      results
    }, null, 2) + '\n'
  );

  console.log(JSON.stringify(summary, null, 2));

  assert.deepEqual(sampleErrors, [], 'Packet sample generation failed');
  assert.equal(nativeErrors.length, 0, 'Native packet roundtrip errors found (see report.json)');
  assert.equal(jsErrors.length, 0, 'JS decodePlayPacket774 errors found (see report.json)');
  assert.equal(cbPackets.size, 139, 'Expected all 139 clientbound Play packets to pass');
  assert.equal(sbPackets.size, 66, 'Expected all 66 serverbound Play packets to pass');

  const fixtures = {
    minecraftVersion: target.minecraftVersion,
    protocol: target.protocol,
    clientJarSha1: target.downloads.client.sha1,
    oracleSha256: createHash('sha256').update(await readFile(javaPath)).digest('hex'),
    scope: 'Play wire codecs (139 CB + 66 SB); sparse, dense, branch-switched, and edge-case samples decoded/re-encoded through native GameProtocols and decodePlayPacket774.',
    samples: results.map((r) => ({
      label: r.label,
      direction: r.direction,
      name: r.name,
      nativeType: r.native.nativeType,
      wire: r.native.wire,
      ...(r.normalizedName ? { normalizedName: r.normalizedName } : {})
    }))
  };

  const fixturePath = join(root, 'tools/fixtures/play-packets-1.21.11.json');
  const text = JSON.stringify(fixtures, null, 2) + '\n';
  if (write) {
    await writeFile(fixturePath, text);
    console.log('Wrote ' + results.length + ' samples to tools/fixtures/play-packets-1.21.11.json');
  } else if (check) {
    assert.equal(await readFile(fixturePath, 'utf8'), text, 'Stale tools/fixtures/play-packets-1.21.11.json');
    console.log('Verified ' + results.length + ' samples in tools/fixtures/play-packets-1.21.11.json');
  }

  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runPacketOracleCheck({
    write: process.argv.includes('--write'),
    check: process.argv.includes('--check')
  });
}
