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

export async function generatePots({ check = false } = {}) {
  const clientJar = await readFile(join(cache, 'client.jar'));
  const mappings = await readFile(join(cache, 'client.txt'));
  verify(clientJar, target.downloads.client, 'pots client');
  verify(mappings, target.downloads.client_mappings, 'pots mappings');

  const unsigned = join(cache, 'client-unsigned.jar');
  if (!existsSync(unsigned)) throw Error('Missing ' + unsigned);
  const cp = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes('META-INF/versions') && !entry.includes('META-INF\\versions'));
  cp[0] = unsigned;

  const javaPath = join(root, 'tools/port-1.21.11/ExtractPots12111.java');
  const outPath = join(cache, 'pots-native.json');
  await mkdir(join(root, 'tools/fixtures'), { recursive: true });
  execFileSync(
    process.env.JAVA || 'java',
    ['-Xmx512M', '-cp', cp.join(delimiter), javaPath, outPath, join(cache, 'client.txt')],
    { stdio: 'pipe', maxBuffer: 16 * 1024 * 1024 }
  );

  const raw = canonical(JSON.parse(await readFile(outPath, 'utf8')));
  const fixture = {
    version: target.minecraftVersion,
    clientJarSha1: target.downloads.client.sha1,
    oracleSha256: sha256(await readFile(javaPath)),
    ...raw
  };
  const fixturePath = join(root, 'tools/fixtures/pots-1.21.11.json');
  const potModule = `// Generated from the pinned native 1.21.11 DecoratedPotPatterns registry.\nexport const POT_PATTERNS_774=${JSON.stringify(raw.patterns)};\n`;
  const potPath = join(root, 'client/js/render/pot-data-1.21.11.js');

  if (check) {
    if (JSON.stringify(JSON.parse(await readFile(fixturePath, 'utf8'))) !== JSON.stringify(fixture)) {
      throw Error('Stale pots fixture ' + fixturePath);
    }
    if ((await readFile(potPath, 'utf8')) !== potModule) {
      throw Error('Stale pot-data module ' + potPath);
    }
  } else {
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
    await writeFile(potPath, potModule);
  }
  console.log(`Pots 1.21.11: ${Object.keys(raw.patterns).length} patterns, ${raw.frames.length} pot frames, ${raw.brushFrames.length} brush frames`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generatePots({ check: process.argv.includes('--check') });
}
