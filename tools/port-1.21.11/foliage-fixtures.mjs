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

export async function generateFoliage({ check = false } = {}) {
  const clientJar = await readFile(join(cache, 'client.jar'));
  const mappings = await readFile(join(cache, 'client.txt'));
  verify(clientJar, target.downloads.client, 'foliage client');
  verify(mappings, target.downloads.client_mappings, 'foliage mappings');

  const unsigned = join(cache, 'client-unsigned.jar');
  if (!existsSync(unsigned)) throw Error('Missing ' + unsigned);
  const cp = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes('META-INF/versions') && !entry.includes('META-INF\\versions'));
  cp[0] = unsigned;

  const javaPath = join(root, 'tools/port-1.21.11/ExtractFoliage12111.java');
  const outPath = join(cache, 'foliage-native.json');
  execFileSync(
    process.env.JAVA || 'java',
    ['-Xmx512M', '-cp', cp.join(delimiter), javaPath, outPath, join(cache, 'client.txt')],
    { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 }
  );

  const raw = canonical(JSON.parse(await readFile(outPath, 'utf8')));
  const fixture = {
    version: target.minecraftVersion,
    clientJarSha1: target.downloads.client.sha1,
    sourceSha256: sha256(await readFile(javaPath)),
    biomes: raw.biomes,
    noise: raw.noise,
    blocks: raw.blocks
  };
  const fixturePath = join(root, 'tools/fixtures/foliage-1.21.11.json');
  await mkdir(join(root, 'tools/fixtures'), { recursive: true });
  if (check) {
    if (JSON.stringify(JSON.parse(await readFile(fixturePath, 'utf8'))) !== JSON.stringify(fixture)) {
      throw Error('Stale foliage fixture ' + fixturePath);
    }
  } else {
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
  }
  console.log(`Foliage 1.21.11: ${Object.keys(fixture.biomes).length} biomes, ${Object.keys(fixture.blocks).length} blocks, ${fixture.noise.length} noise samples`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateFoliage({ check: process.argv.includes('--check') });
}
