import { createHash } from 'node:crypto';
import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { initBlocks, getStateProperties } from '../../client/js/world/blocks.js';
import { KNOWN_PACK_774 } from '../../client/js/net/known-pack-1.21.11.js';
import { nativeBiomeData } from './biome-data.mjs';
import { creativeData } from './creative-data.mjs';
import { supportData } from './support-data.mjs';
import { prepare, cache, root, target, verify } from './prepare.mjs';

const run = promisify(execFile);
const revision = target.minecraftData.revision;
const base = 'https://raw.githubusercontent.com/PrismarineJS/minecraft-data/' + revision + '/data/';
const output = join(cache, 'runtime-data');
const clientData = join(root, 'client', 'data');

async function getUpstream(localName, remotePath) {
  const file = join(cache, 'upstream', localName);
  const pinned = target.minecraftData?.inputs?.['upstream/' + localName];
  let data;
  try {
    data = await readFile(file);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const url = pinned?.url || base + remotePath;
    const result = await run(
      'curl',
      ['--fail', '--silent', '--show-error', '--location', '--retry', '3', url],
      { encoding: 'buffer', maxBuffer: 32 * 1024 * 1024 }
    );
    data = result.stdout;
    await mkdir(join(file, '..'), { recursive: true });
    await writeFile(file, data);
  }
  const sha1 = pinned
    ? verify(data, pinned, 'upstream/' + localName)
    : createHash('sha1').update(data).digest('hex');
  return { data: JSON.parse(data), sha1 };
}

export async function runtimeData({ check = false } = {}) {
  await prepare();
  await mkdir(output, { recursive: true });
  await mkdir(clientData, { recursive: true });

  const dataPaths = (await getUpstream('dataPaths.json', 'dataPaths.json')).data.pc[target.minecraftVersion];
  if (!dataPaths) throw new Error('Missing minecraft-data paths for ' + target.minecraftVersion);

  const sources = {};
  const tables = {};
  const names = [
    'blocks',
    'items',
    'entities',
    'biomes',
    'foods',
    'effects',
    'enchantments',
    'windows',
    'particles',
    'materials',
    'recipes',
    'sounds'
  ];

  for (const name of names) {
    const remotePath = dataPaths[name] + '/' + name + '.json';
    const input = await getUpstream(name + '.json', remotePath);
    tables[name] = input.data;
    sources[name] = { path: remotePath, sha1: input.sha1 };
  }

  const shapesRemotePath = dataPaths.blockCollisionShapes + '/blockCollisionShapes.json';
  const shapesInput = await getUpstream('blockCollisionShapes.json', shapesRemotePath);
  sources.blockCollisionShapes = { path: shapesRemotePath, sha1: shapesInput.sha1 };

  tables.biomes = nativeBiomeData(tables.biomes);

  const reports = JSON.parse(await readFile(join(cache, 'generated', 'reports', 'registries.json'), 'utf8'));
  const blocks = JSON.parse(await readFile(join(cache, 'generated', 'reports', 'blocks.json'), 'utf8'));
  const itemsReport = JSON.parse(await readFile(join(cache, 'generated', 'reports', 'items.json'), 'utf8'));

  const nativeSound = reports['minecraft:sound_event'].entries;
  const oldSounds = new Map(tables.sounds.map((entry) => [entry.name, entry]));
  tables.sounds = Object.entries(nativeSound)
    .map(([name, entry]) => ({
      ...oldSounds.get(name.replace(/^minecraft:/, '')),
      id: entry.protocol_id,
      name: name.replace(/^minecraft:/, '')
    }))
    .sort((a, b) => a.id - b.id);

  for (const [file, registry] of [
    ['blocks', 'block'],
    ['items', 'item'],
    ['entities', 'entity_type'],
    ['sounds', 'sound_event'],
    ['particles', 'particle_type']
  ]) {
    const entries = reports['minecraft:' + registry].entries;
    if (tables[file].length !== Object.keys(entries).length) {
      throw new Error('Native registry count mismatch ' + file);
    }
    for (const entry of tables[file]) {
      const native = entries['minecraft:' + entry.name];
      if (native?.protocol_id !== entry.id) {
        throw new Error('Native registry mismatch ' + file + ' ' + entry.name);
      }
    }
  }

  if (tables.items.length !== Object.keys(itemsReport).length) {
    throw new Error('Native items report count mismatch');
  }

  for (const [file, registry] of [
    ['enchantments', 'minecraft:enchantment'],
    ['biomes', 'minecraft:worldgen/biome']
  ]) {
    const native = KNOWN_PACK_774.registries[registry];
    if (tables[file].length !== native.length) {
      throw new Error('Known-pack registry count mismatch ' + file);
    }
    for (let i = 0; i < native.length; i++) {
      if (tables[file][i].id !== i || 'minecraft:' + tables[file][i].name !== native[i].key) {
        throw new Error('Known-pack registry mismatch ' + file + ' at ' + i);
      }
    }
  }

  for (const block of tables.blocks) {
    const states = blocks['minecraft:' + block.name]?.states;
    if (
      !states ||
      states[0].id !== block.minStateId ||
      states.at(-1).id !== block.maxStateId ||
      states.find((state) => state.default)?.id !== block.defaultState
    ) {
      throw new Error('Native states mismatch ' + block.name);
    }
  }

  initBlocks(tables.blocks, null);
  for (const [name, block] of Object.entries(blocks)) {
    for (const state of block.states) {
      const actual = getStateProperties(state.id);
      const expected = state.properties || {};
      if (JSON.stringify(Object.entries(actual).sort()) !== JSON.stringify(Object.entries(expected).sort())) {
        throw new Error('Property mismatch ' + name + ' ' + state.id);
      }
    }
  }

  const commandRegistries = {};
  for (const name of ['minecraft:attribute', 'minecraft:point_of_interest_type']) {
    const registry = reports[name];
    if (registry) commandRegistries[name] = Object.keys(registry.entries).sort();
  }

  const stateCount = Object.values(blocks).reduce((total, block) => total + block.states.length, 0);
  const manifest = {
    version: target.minecraftVersion,
    protocol: target.protocol,
    dataVersion: target.dataVersion,
    clientJarSha1: target.downloads.client.sha1,
    serverJarSha1: target.downloads.server.sha1,
    minecraftDataRevision: revision,
    sources,
    counts: {
      blocks: tables.blocks.length,
      blockStates: stateCount,
      items: tables.items.length,
      entities: tables.entities.length,
      biomes: tables.biomes.length,
      sounds: tables.sounds.length,
      particles: tables.particles.length,
      enchantments: tables.enchantments.length,
      effects: tables.effects.length,
      recipes: Object.keys(tables.recipes).length
    }
  };

  const generatedFiles = {
    ...Object.fromEntries(Object.entries(tables).map(([name, data]) => [name + '.json', JSON.stringify(data) + '\n'])),
    'particleSprites.json': '{}\n',
    'commandRegistries.json': JSON.stringify(commandRegistries) + '\n',
    'runtime-source-1.21.11.json': JSON.stringify(manifest, null, 2) + '\n'
  };

  if (check) {
    for (const [filename, expected] of Object.entries(generatedFiles)) {
      const actual = await readFile(join(clientData, filename), 'utf8');
      if (actual !== expected) {
        throw new Error('Stale client/data/' + filename);
      }
    }
    const shapesFile = join(clientData, 'blockCollisionShapes.json');
    const shapesText = await readFile(shapesFile, 'utf8');
    const cachedShapesPath = join(output, 'blockCollisionShapes.json');
    if (existsSync(cachedShapesPath) && (await readFile(cachedShapesPath, 'utf8')) !== shapesText) {
      throw new Error('Stale client/data/blockCollisionShapes.json vs cache/port-1.21.11/runtime-data/blockCollisionShapes.json');
    }
    const shapes = JSON.parse(shapesText);
    if (
      shapes.render?.source?.clientJarSha1 !== target.downloads.client.sha1 ||
      shapes.render?.states?.length !== stateCount ||
      shapes.selection?.states?.length !== stateCount ||
      Object.keys(shapes.blocks || {}).length !== tables.blocks.length
    ) {
      throw new Error('Incomplete or stale native blockCollisionShapes.json');
    }
    await supportData({ check: true, output: shapesFile });
    await creativeData({ check: true });
  } else {
    for (const [filename, content] of Object.entries(generatedFiles)) {
      await writeFile(join(output, filename), content);
      await writeFile(join(clientData, filename), content);
    }
    execFileSync(process.execPath, [join(root, 'tools/port-1.21.11/visual-runtime.mjs')], {
      stdio: 'inherit',
      maxBuffer: 32 * 1024 * 1024
    });
    const shapesBytes = await readFile(join(output, 'blockCollisionShapes.json'));
    await writeFile(join(clientData, 'blockCollisionShapes.json'), shapesBytes);
    await creativeData({ check: false });
  }

  console.log(JSON.stringify(manifest, null, 2));
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await runtimeData({ check: process.argv.includes('--check') });
}
