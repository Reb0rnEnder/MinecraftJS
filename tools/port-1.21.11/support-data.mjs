import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { delimiter, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ZipFile } from '../../lib/zip.js';
import { nativeClasspath } from '../../lib/native-classpath.js';
import { root, cache, target, verify } from './prepare.mjs';

export async function supportData({
  check = false,
  output = join(cache, 'runtime-data/blockCollisionShapes.json')
} = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'support client');
  verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'support mappings');
  const unsignedPath = join(cache, 'client-unsigned.jar');
  if (!existsSync(unsignedPath)) {
    throw Error('Missing ' + unsignedPath + '; create unsigned client.jar omitting META-INF/*.{SF,RSA,DSA,EC}');
  }
  const jar = new ZipFile(join(cache, 'client.jar'));
  const unsigned = new ZipFile(unsignedPath);
  for (const n of jar.list('').filter((n) => n.endsWith('.class'))) {
    if (!jar.read(n).equals(unsigned.read(n))) throw Error('Modified native support class ' + n);
  }
  const localBlocks = join(dirname(output), 'blocks.json');
  const blocksPath = existsSync(localBlocks) ? localBlocks : join(cache, 'upstream/blocks.json');
  const blocks = JSON.parse(await readFile(blocksPath));
  const count = Math.max(...blocks.map((b) => b.maxStateId)) + 1;
  const cp = nativeClasspath(cache).split(delimiter);
  cp[0] = unsignedPath;
  const out = join(cache, 'support.json');
  execFileSync(
    process.env.JAVA || 'java',
    [
      '-cp',
      cp.join(delimiter),
      join(root, 'tools/port-1.21.11/ExtractSupport12111.java'),
      out,
      join(cache, 'client.txt'),
      String(count)
    ],
    { cwd: cache, stdio: 'pipe' }
  );
  const states = JSON.parse(await readFile(out));
  if (
    states.length !== count ||
    states.some((v) => !Array.isArray(v) || v.length !== 2 || v.some((n) => !Number.isInteger(n) || n < 0 || n > 63))
  ) {
    throw Error('Incomplete native support predicates');
  }
  const support = {
    source: { version: target.minecraftVersion, clientJarSha1: target.downloads.client.sha1 },
    states
  };
  const data = JSON.parse(await readFile(output));
  if (check) {
    if (JSON.stringify(data.support) !== JSON.stringify(support)) {
      throw Error('Stale native placement support data');
    }
  } else {
    data.support = support;
    await writeFile(output, JSON.stringify(data) + '\n');
  }
  console.log('Native placement support: ' + count + ' states');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await supportData({ check: process.argv.includes('--check') });
}
