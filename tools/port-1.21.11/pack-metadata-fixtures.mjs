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

const PACK_METADATA_CASES = [
  { label: 'filter_none', section: 'filter', value: { block: [] }, queries: [{ namespace: 'minecraft', path: 'textures/block/stone.png' }, { namespace: 'minecraft', path: 'lang/en_us.json' }] },
  { label: 'filter_textures', section: 'filter', value: { block: [{ namespace: '^minecraft$', path: '^textures/block/.*' }] }, queries: [{ namespace: 'minecraft', path: 'textures/block/stone.png' }, { namespace: 'minecraft', path: 'textures/item/stick.png' }] },
  { label: 'filter_namespace', section: 'filter', value: { block: [{ namespace: '^custom$' }] }, queries: [{ namespace: 'custom', path: 'anything.png' }, { namespace: 'minecraft', path: 'anything.png' }] },
  { label: 'overlay_legacy_supported', section: 'overlays', value: { entries: [{ formats: { min_inclusive: 34, max_inclusive: 75 }, directory: 'overlay_34_75' }, { formats: [70, 75], directory: 'overlay_70_75' }] }, formats: [[33, 0], [34, 0], [64, 0], [75, 0], [76, 0]] },
  { label: 'overlay_12111_min_max', section: 'overlays', value: { entries: [{ min_format: 65, max_format: 75, directory: 'ov_new' }, { min_format: [75, 0], max_format: [75, 2], directory: 'ov_minor' }] }, formats: [[64, 0], [65, 0], [75, 0], [75, 2], [75, 3], [76, 0]] },
  { label: 'pack_12111_valid', section: 'pack', value: { description: '1.21.11 pack', pack_format: 75, supported_formats: [65, 75], min_format: 75, max_format: 75 } },
  { label: 'pack_12111_min_max_only', section: 'pack', value: { description: '1.21.11 tuple pack', min_format: [75, 0], max_format: [75, 0] } }
];

export async function generatePackMetadata({ check = false } = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'pack metadata client');
  verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'pack metadata mappings');
  const unsigned = join(cache, 'client-unsigned.jar');
  if (!existsSync(unsigned)) throw Error('Missing ' + unsigned);
  const cp = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes('META-INF/versions') && !entry.includes('META-INF\\versions'));
  cp[0] = unsigned;

  const inputsPath = join(cache, 'pack-metadata-inputs.json');
  const outPath = join(cache, 'pack-metadata-native.json');
  const javaPath = join(root, 'tools/port-1.21.11/ExtractPackMetadata12111.java');
  await writeFile(inputsPath, JSON.stringify(PACK_METADATA_CASES, null, 2));
  execFileSync(
    process.env.JAVA || 'java',
    ['-Xmx512M', '-cp', cp.join(delimiter), javaPath, outPath, join(cache, 'client.txt'), inputsPath],
    { stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 }
  );

  const cases = canonical(JSON.parse(await readFile(outPath, 'utf8')));
  const fixture = {
    version: target.minecraftVersion,
    clientJarSha1: target.downloads.client.sha1,
    oracleSha256: sha256(await readFile(javaPath)),
    cases
  };
  const fixturePath = join(root, 'tools/fixtures/pack-metadata-1.21.11.json');
  await mkdir(join(root, 'tools/fixtures'), { recursive: true });
  if (check) {
    if (JSON.stringify(JSON.parse(await readFile(fixturePath, 'utf8'))) !== JSON.stringify(fixture)) {
      throw Error('Stale pack metadata fixture ' + fixturePath);
    }
  } else {
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
  }
  console.log(`Pack metadata 1.21.11: ${cases.length} cases`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generatePackMetadata({ check: process.argv.includes('--check') });
}
