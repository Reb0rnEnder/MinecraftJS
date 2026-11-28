import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { delimiter, join } from 'node:path';
import { nativeClasspath } from '../../lib/native-classpath.js';
import { cache, root, target, verify } from './prepare.mjs';

verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'border client');
verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'border mappings');
const cp = nativeClasspath(cache).split(delimiter).filter(p => !p.includes('META-INF/versions'));
cp[0] = join(cache, 'client-unsigned.jar');
const source = join(root, 'tools/port-1.21.11/ExtractBorder12111.java');
const output = join(cache, 'border-native.json');
execFileSync(process.env.JAVA || 'java', ['-Xmx512M', '-cp', cp.join(delimiter), source, output, join(cache, 'client.txt')], { stdio: 'pipe' });
const fixture = {
  version: target.minecraftVersion,
  clientJarSha1: target.downloads.client.sha1,
  oracleSha256: createHash('sha256').update(await readFile(source)).digest('hex'),
  ...JSON.parse(await readFile(output, 'utf8')),
};
const path = join(root, 'tools/fixtures/border-1.21.11.json');
if (process.argv.includes('--check')) {
  if (JSON.stringify(JSON.parse(await readFile(path, 'utf8'))) !== JSON.stringify(fixture)) throw Error('Stale border fixture');
} else await writeFile(path, JSON.stringify(fixture, null, 2) + '\n');
console.log(`WorldBorder 1.21.11: ${fixture.cases.length} native transitions`);
