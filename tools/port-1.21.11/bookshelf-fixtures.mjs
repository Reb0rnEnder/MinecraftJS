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

export async function generateBookshelf({ check = false } = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'bookshelf client');
  verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'bookshelf mappings');
  const unsigned = join(cache, 'client-unsigned.jar');
  if (!existsSync(unsigned)) throw Error('Missing ' + unsigned);
  const cp = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes('META-INF/versions') && !entry.includes('META-INF\\versions'));
  cp[0] = unsigned;

  const javaPath = join(root, 'tools/port-1.21.11/ExtractBookshelf12111.java');
  const outPath = join(cache, 'bookshelf-native.json');
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
  const fixturePath = join(root, 'tools/fixtures/bookshelf-1.21.11.json');
  await mkdir(join(root, 'tools/fixtures'), { recursive: true });
  if (check) {
    if (JSON.stringify(JSON.parse(await readFile(fixturePath, 'utf8'))) !== JSON.stringify(fixture)) {
      throw Error('Stale bookshelf fixture ' + fixturePath);
    }
  } else {
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
  }
  console.log(`Bookshelf 1.21.11: ${raw.hits.length} hits, ${raw.uses.length} uses, ${raw.books.length} books`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateBookshelf({ check: process.argv.includes('--check') });
}
