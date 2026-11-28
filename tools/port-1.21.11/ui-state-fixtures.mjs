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

export async function generateUiState({ check = false } = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'ui-state client');
  verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'ui-state mappings');
  const unsigned = join(cache, 'client-unsigned.jar');
  if (!existsSync(unsigned)) throw Error('Missing ' + unsigned);
  const cp = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes('META-INF/versions') && !entry.includes('META-INF\\versions'));
  cp[0] = unsigned;
  for (const jarName of ['lwjgl-3.3.3.jar', 'lwjgl-glfw-3.3.3.jar', 'lwjgl-opengl-3.3.3.jar', 'lwjgl-stb-3.3.3.jar', 'lwjgl-freetype-3.3.3.jar']) {
    const lp = join(cache, 'lwjgl', jarName);
    if (existsSync(lp)) cp.push(lp);
  }

  const javaPath = join(root, 'tools/port-1.21.11/ExtractUiState12111.java');
  const outPath = join(cache, 'ui-state-native.json');
  execFileSync(
    process.env.JAVA || 'java',
    ['-Xmx512M', '-cp', cp.join(delimiter), javaPath, outPath, join(cache, 'client.txt')],
    { stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 }
  );

  const raw = canonical(JSON.parse(await readFile(outPath, 'utf8')));
  const fixture = {
    version: target.minecraftVersion,
    clientJarSha1: target.downloads.client.sha1,
    oracleSha256: sha256(await readFile(javaPath)),
    ...raw
  };
  const fixturePath = join(root, 'tools/fixtures/ui-state-1.21.11.json');
  await mkdir(join(root, 'tools/fixtures'), { recursive: true });
  if (check) {
    if (JSON.stringify(JSON.parse(await readFile(fixturePath, 'utf8'))) !== JSON.stringify(fixture)) {
      throw Error('Stale ui-state fixture ' + fixturePath);
    }
  } else {
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
  }
  console.log(`UI State 1.21.11: ${raw.scales.length} scales, ${raw.titleFade.length} title fade ticks`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateUiState({ check: process.argv.includes('--check') });
}
