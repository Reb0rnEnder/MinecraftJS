import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { KNOWN_PACK_774 } from '../../client/js/net/known-pack-1.21.11.js';
import { Reader774, Writer774 } from '../../client/js/net/configuration-1.21.11.js';
import { nativeClasspath } from '../../lib/native-classpath.js';
import { cache, root, target, verify } from './prepare.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (v) => Array.isArray(v) ? v.map(canonical) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);

function buildAdventureInputs() {
  const cases = [];
  for (const component of ['can_break', 'can_place_on']) {
    const compKey = 'minecraft:' + component;
    const add = (label, predicates, block = 'minecraft:stone', state = {}, extra = {}) => {
      const components = { [compKey]: predicates };
      if (extra.components) Object.assign(components, extra.components);
      const entry = {
        label: `${component} ${label}`,
        component,
        block,
        state,
        stack: { id: 'minecraft:diamond_pickaxe', count: 1, components }
      };
      if (extra.directEmpty) entry.directEmpty = true;
      if (extra.actualNbt !== undefined && extra.actualNbt !== null) entry.actualNbt = extra.actualNbt;
      cases.push(entry);
    };

    add('any', [{}]);
    add('none', [{ blocks: 'minecraft:stone' }], 'minecraft:stone', {}, { directEmpty: true });
    add('stone', [{ blocks: 'minecraft:stone' }]);
    add('mismatch', [{ blocks: 'minecraft:stone' }], 'minecraft:dirt');
    add('OR', [{ blocks: 'minecraft:stone' }, { blocks: 'minecraft:dirt' }], 'minecraft:dirt', {}, {
      components: { 'minecraft:tooltip_display': { hidden_components: [compKey] } }
    });
    add('ID set', [{ blocks: ['minecraft:stone', 'minecraft:dirt'] }], 'minecraft:dirt');
    add('logs oak_log', [{ blocks: '#minecraft:logs' }], 'minecraft:oak_log');
    add('logs birch_log', [{ blocks: '#minecraft:logs' }], 'minecraft:birch_log');
    add('logs stone', [{ blocks: '#minecraft:logs' }], 'minecraft:stone');

    for (const v of ['4', '04', '+4', '8', 'bad', '4.0']) {
      add(`exact age ${v}`, [{ state: { age: v } }], 'minecraft:wheat', { age: '4' });
    }
    add('exact missing 4', [{ state: { missing: '4' } }], 'minecraft:wheat', { age: '4' });

    for (const range of [
      { min: '2', max: '5' },
      { min: '5' },
      { max: '3' },
      { min: '04', max: '4' },
      {},
      { min: '-1' },
      { max: '8' },
      { min: 'bad' },
      { min: '7', max: '2' }
    ]) {
      add(`range ${JSON.stringify(range)}`, [{ state: { age: range } }], 'minecraft:wheat', { age: '4' });
    }

    for (const range of [
      { min: 'south', max: 'east' },
      { min: 'east', max: 'west' },
      { max: 'north' },
      { min: 'east' },
      { min: 'invalid' }
    ]) {
      add(`direction ${JSON.stringify(range)}`, [{ state: { facing: range } }], 'minecraft:oak_stairs', { facing: 'west' });
    }

    for (const range of [
      { min: 'false', max: 'true' },
      { min: 'true' },
      { max: 'false' },
      { min: 'TRUE' }
    ]) {
      add(`boolean ${JSON.stringify(range)}`, [{ state: { waterlogged: range } }], 'minecraft:oak_stairs', { waterlogged: 'false' });
    }

    add('state and blocks AND', [{ blocks: 'minecraft:stone', state: { age: {} } }], 'minecraft:stone');
    add('NBT missing', [{ blocks: 'minecraft:chest', nbt: '{}' }], 'minecraft:chest');
    add('NBT subset', [{ blocks: 'minecraft:chest', nbt: '{x:0,Items:[]}' }], 'minecraft:chest', {}, {
      actualNbt: '{id:"minecraft:chest",x:0,y:64,z:0,Items:[]}'
    });
    add('NBT wrong type', [{ blocks: 'minecraft:chest', nbt: '{x:0b}' }], 'minecraft:chest', {}, {
      actualNbt: '{id:"minecraft:chest",x:0,y:64,z:0,Items:[]}'
    });
  }

  cases.push(
    {
      label: 'tooltip duplicate blocks',
      component: 'can_break',
      block: 'minecraft:stone',
      state: {},
      stack: {
        id: 'minecraft:diamond_pickaxe',
        count: 1,
        components: { 'minecraft:can_break': [{ blocks: ['minecraft:stone', 'minecraft:dirt'] }, { blocks: 'minecraft:stone' }] }
      }
    },
    {
      label: 'tooltip unknown overrides list',
      component: 'can_break',
      block: 'minecraft:stone',
      state: {},
      stack: {
        id: 'minecraft:diamond_pickaxe',
        count: 1,
        components: { 'minecraft:can_break': [{ blocks: 'minecraft:stone' }, { state: { age: '1' } }] }
      }
    },
    {
      label: 'tooltip both permissions',
      component: 'can_break',
      block: 'minecraft:stone',
      state: {},
      stack: {
        id: 'minecraft:diamond_pickaxe',
        count: 1,
        components: {
          'minecraft:can_break': [{ blocks: 'minecraft:stone' }],
          'minecraft:can_place_on': [{ blocks: 'minecraft:dirt' }]
        }
      }
    },
    {
      label: 'tooltip hidden',
      component: 'can_break',
      block: 'minecraft:stone',
      state: {},
      stack: {
        id: 'minecraft:diamond_pickaxe',
        count: 1,
        components: {
          'minecraft:can_break': [{ blocks: 'minecraft:stone' }],
          'minecraft:tooltip_display': { hide_tooltip: true }
        }
      }
    },
    {
      label: 'tooltip hidden component',
      component: 'can_break',
      block: 'minecraft:stone',
      state: {},
      stack: {
        id: 'minecraft:diamond_pickaxe',
        count: 1,
        components: {
          'minecraft:can_break': [{ blocks: 'minecraft:stone' }],
          'minecraft:can_place_on': [{ blocks: 'minecraft:dirt' }],
          'minecraft:tooltip_display': { hidden_components: ['minecraft:can_break'] }
        }
      }
    }
  );
  return cases;
}

export async function generateAdventure({ check = false } = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'adventure client');
  verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'adventure mappings');
  const unsigned = join(cache, 'client-unsigned.jar');
  if (!existsSync(unsigned)) throw Error('Missing ' + unsigned);
  const cp = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes('META-INF/versions') && !entry.includes('META-INF\\versions'));
  cp[0] = unsigned;

  const orderPath = join(cache, 'creative-registry-order.json');
  const registryOrder = Object.fromEntries(
    Object.entries(KNOWN_PACK_774.registries).map(([key, entries]) => [key, entries.map((e) => e.key)])
  );
  await writeFile(orderPath, JSON.stringify(registryOrder));

  const inputsPath = join(root, 'tools/port-1.21.11/adventure-inputs.json');
  const inputs = buildAdventureInputs();
  const inputsText = JSON.stringify(inputs, null, 2) + '\n';
  if (!check) await writeFile(inputsPath, inputsText);

  const outPath = join(cache, 'adventure-native.json');
  const javaPath = join(root, 'tools/port-1.21.11/ExtractAdventure12111.java');
  execFileSync(
    process.env.JAVA || 'java',
    ['-Xmx768M', '-cp', cp.join(delimiter), javaPath, outPath, join(cache, 'client.txt'), orderPath, inputsPath],
    { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 }
  );

  const raw = canonical(JSON.parse(await readFile(outPath, 'utf8')));
  for (let i = 0; i < raw.cases.length; i++) {
    const c = raw.cases[i];
    c.component = inputs[i].component;
    c.block = inputs[i].block;
    c.state = inputs[i].state;
    c.actualNbt = inputs[i].actualNbt ?? null;
    const bytes = Buffer.from(c.wire, 'base64');
    const r = new Reader774(bytes);
    const parsed = r.slot();
    if (r.remaining() || !parsed) throw Error('Invalid Adventure wire for ' + c.label);
    const reencoded = Buffer.from(new Writer774().slot(parsed).build());
    if (!reencoded.equals(bytes)) throw Error('Adventure wire roundtrip differs for ' + c.label);
  }

  const extractorSha256 = sha256(await readFile(javaPath));
  const inputsSha256 = sha256(await readFile(inputsPath));
  const propsData = {
    blockNames: raw.blockNames,
    clientJarSha1: target.downloads.client.sha1,
    minecraftVersion: target.minecraftVersion,
    properties: raw.properties,
    propertyTypes: raw.propertyTypes
  };
  const propsSrc = `// Native ${target.minecraftVersion} BlockState property domains and names. Generated by adventure-fixtures.mjs.\nexport const ADVENTURE_PROPERTIES_774=${JSON.stringify(propsData)};\n`;
  const fixture = {
    clientJarSha1: target.downloads.client.sha1,
    extractorSha256,
    inputsSha256,
    minecraftVersion: target.minecraftVersion,
    samples: raw.cases
  };

  const propsPath = join(root, 'client/js/game/adventure-properties-1.21.11.js');
  const fixPath = join(root, 'tools/fixtures/adventure-1.21.11.json');
  await mkdir(join(root, 'tools/fixtures'), { recursive: true });
  if (check) {
    if ((await readFile(inputsPath, 'utf8')) !== inputsText) throw Error('Stale ' + inputsPath);
    if ((await readFile(propsPath, 'utf8')) !== propsSrc) throw Error('Stale ' + propsPath);
    if (JSON.stringify(JSON.parse(await readFile(fixPath, 'utf8'))) !== JSON.stringify(fixture)) throw Error('Stale ' + fixPath);
  } else {
    await writeFile(propsPath, propsSrc);
    await writeFile(fixPath, JSON.stringify(fixture, null, 2) + '\n');
  }
  console.log(`Adventure 1.21.11: ${raw.cases.length} cases, ${Object.keys(raw.properties).length} property blocks, ${raw.propertyTypes.length} types`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateAdventure({ check: process.argv.includes('--check') });
}
