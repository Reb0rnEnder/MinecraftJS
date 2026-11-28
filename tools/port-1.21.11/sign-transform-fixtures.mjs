import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nativeClasspath } from '../../lib/native-classpath.js';
import { cache, root, target, verify } from './prepare.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonical = (v) => Array.isArray(v) ? v.map(canonical) : (v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canonical(v[k])])) : v);

function findBlockState(reportsBlocks, blockId, wantProps) {
  const entry = reportsBlocks['minecraft:' + blockId];
  if (!entry) throw Error('Missing block report for ' + blockId);
  const found = entry.states.find((s) => Object.entries(wantProps).every(([k, v]) => String(s.properties?.[k]) === String(v)));
  if (!found) throw Error('Missing state ' + JSON.stringify(wantProps) + ' for ' + blockId);
  return found.id;
}

export async function generateSignTransforms({ check = false } = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'sign client');
  verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'sign mappings');
  const unsigned = join(cache, 'client-unsigned.jar');
  if (!existsSync(unsigned)) throw Error('Missing ' + unsigned);
  const cp = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes('META-INF/versions') && !entry.includes('META-INF\\versions'));
  cp[0] = unsigned;

  const reportsBlocks = JSON.parse(await readFile(join(cache, 'generated/reports/blocks.json'), 'utf8'));
  const inputs = [];
  for (const wood of ['oak', 'mangrove', 'cherry', 'bamboo', 'pale_oak']) {
    for (const rot of [0, 4, 8, 12]) {
      for (const attached of [false, true]) {
        inputs.push({
          label: `${wood} hanging ${rot} ${attached}`,
          state: findBlockState(reportsBlocks, `${wood}_hanging_sign`, { rotation: rot, attached, waterlogged: false })
        });
      }
    }
    for (const facing of ['north', 'south', 'east', 'west']) {
      inputs.push({
        label: `${wood} wall_sign ${facing}`,
        state: findBlockState(reportsBlocks, `${wood}_wall_sign`, { facing, waterlogged: false })
      });
      inputs.push({
        label: `${wood} wall_hanging_sign ${facing}`,
        state: findBlockState(reportsBlocks, `${wood}_wall_hanging_sign`, { facing, waterlogged: false })
      });
    }
    inputs.push({
      label: `${wood} standing 3`,
      state: findBlockState(reportsBlocks, `${wood}_sign`, { rotation: 3, waterlogged: false })
    });
  }

  const inputsPath = join(cache, 'sign-transform-inputs.json');
  const outPath = join(cache, 'sign-transforms-native.json');
  const javaPath = join(root, 'tools/port-1.21.11/ExtractSignTransforms12111.java');
  await writeFile(inputsPath, JSON.stringify(inputs, null, 2));

  execFileSync(
    process.env.JAVA || 'java',
    ['-Xmx512M', '-cp', cp.join(delimiter), javaPath, outPath, join(cache, 'client.txt'), inputsPath],
    { stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 }
  );

  const raw = canonical(JSON.parse(await readFile(outPath, 'utf8')));
  const fixture = {
    minecraftVersion: target.minecraftVersion,
    clientJarSha1: target.downloads.client.sha1,
    extractorSha256: sha256(await readFile(javaPath)),
    samples: raw.samples,
    signText: raw.signText
  };
  const fixturePath = join(root, 'tools/fixtures/sign-transforms-1.21.11.json');
  await mkdir(join(root, 'tools/fixtures'), { recursive: true });
  if (check) {
    if (JSON.stringify(JSON.parse(await readFile(fixturePath, 'utf8'))) !== JSON.stringify(fixture)) {
      throw Error('Stale sign transforms fixture ' + fixturePath);
    }
  } else {
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
  }
  console.log(`Sign transforms 1.21.11: ${raw.samples.length} states`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateSignTransforms({ check: process.argv.includes('--check') });
}
