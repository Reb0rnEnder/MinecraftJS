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

const BANNER_INPUTS = [
  {
    label: 'patterned blue banner',
    stack: {
      id: 'minecraft:blue_banner',
      count: 1,
      components: {
        'minecraft:banner_patterns': [
          { pattern: 'minecraft:stripe_center', color: 'red' },
          { pattern: 'minecraft:flower', color: 'yellow' }
        ]
      }
    }
  },
  {
    label: 'inline banner',
    stack: {
      id: 'minecraft:white_banner',
      count: 1,
      components: {
        'minecraft:banner_patterns': [
          { pattern: { asset_id: 'custom:art', translation_key: 'custom.pattern' }, color: 'lime' }
        ]
      }
    }
  },
  {
    label: 'patterned red shield',
    stack: {
      id: 'minecraft:shield',
      count: 1,
      components: {
        'minecraft:base_color': 'red',
        'minecraft:banner_patterns': [
          { pattern: 'minecraft:cross', color: 'white' }
        ]
      }
    }
  },
  {
    label: 'flow guster banner',
    stack: {
      id: 'minecraft:orange_banner',
      count: 1,
      components: {
        'minecraft:banner_patterns': [
          { pattern: 'minecraft:flow', color: 'cyan' },
          { pattern: 'minecraft:guster', color: 'white' }
        ]
      }
    }
  }
];

export async function generateBannerStacks({ check = false } = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'banner client');
  verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'banner mappings');
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

  const inputsPath = join(cache, 'banner-stack-inputs.json');
  const outPath = join(cache, 'banner-stacks-native.json');
  const javaPath = join(root, 'tools/port-1.21.11/ExtractBannerStacks12111.java');
  await writeFile(inputsPath, JSON.stringify(BANNER_INPUTS, null, 2));

  execFileSync(
    process.env.JAVA || 'java',
    ['-Xmx512M', '-cp', cp.join(delimiter), javaPath, outPath, join(cache, 'client.txt'), orderPath, inputsPath],
    { stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 }
  );

  const samples = canonical(JSON.parse(await readFile(outPath, 'utf8')));
  for (const sample of samples) {
    const bytes = Buffer.from(sample.wire, 'base64');
    const r = new Reader774(bytes);
    const parsed = r.slot();
    if (r.remaining() || !parsed) throw Error('Invalid banner wire for ' + sample.label);
    const reencoded = Buffer.from(new Writer774().slot(parsed).build());
    if (!reencoded.equals(bytes)) throw Error('Banner wire roundtrip differs for ' + sample.label);
  }

  const fixture = {
    minecraftVersion: target.minecraftVersion,
    clientJarSha1: target.downloads.client.sha1,
    extractorSha256: sha256(await readFile(javaPath)),
    samples
  };
  const fixturePath = join(root, 'tools/fixtures/banner-stacks-1.21.11.json');
  await mkdir(join(root, 'tools/fixtures'), { recursive: true });
  if (check) {
    if (JSON.stringify(JSON.parse(await readFile(fixturePath, 'utf8'))) !== JSON.stringify(fixture)) {
      throw Error('Stale banner stacks fixture ' + fixturePath);
    }
  } else {
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
  }
  console.log(`Banner stacks 1.21.11: ${samples.length} samples`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateBannerStacks({ check: process.argv.includes('--check') });
}
