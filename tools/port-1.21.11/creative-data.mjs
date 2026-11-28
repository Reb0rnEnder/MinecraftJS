import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { delimiter, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { nativeClasspath } from '../../lib/native-classpath.js';
import { KNOWN_PACK_774 } from '../../client/js/net/known-pack-1.21.11.js';
import { Reader774, Writer774 } from '../../client/js/net/configuration-1.21.11.js';
import { cache, root, target, verify } from './prepare.mjs';

function canonical(value) {
  if (typeof value === 'bigint') return { $big: String(value) };
  if (ArrayBuffer.isView(value)) {
    return {
      $ta: value.constructor.name,
      a: Array.from(value, (n) => (typeof n === 'bigint' ? String(n) : n))
    };
  }
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((k) => [k, canonical(value[k])]));
  }
  return value;
}

export async function creativeData({ check = false } = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'client jar');
  const unsigned = join(cache, 'client-unsigned.jar');
  if (!existsSync(unsigned)) {
    throw new Error('Missing ' + unsigned + '; create unsigned client.jar omitting META-INF/*.{SF,RSA,DSA,EC}');
  }
  const cp = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes('META-INF/versions') && !entry.includes('META-INF\\versions'));
  cp[0] = unsigned;

  const order = join(cache, 'creative-registry-order.json');
  const rawFile = join(cache, 'creative-native.json');
  const registryOrder = Object.fromEntries(
    Object.entries(KNOWN_PACK_774.registries).map(([key, entries]) => [key, entries.map((e) => e.key)])
  );
  await writeFile(order, JSON.stringify(registryOrder));

  const java = join(root, 'tools/port-1.21.11/ExtractCreative12111.java');
  execFileSync(
    process.env.JAVA || 'java',
    ['-Xmx768M', '-cp', cp.join(delimiter), java, rawFile, join(cache, 'client.txt'), order],
    { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 }
  );

  const raw = JSON.parse(await readFile(rawFile, 'utf8'));
  const decoded = new Map();
  const pool = new Map();

  const decode = (wire) => {
    if (decoded.has(wire)) return decoded.get(wire);
    const bytes = Buffer.from(wire, 'base64');
    const r = new Reader774(bytes);
    const s = r.slot();
    if (r.remaining() || !s) throw new Error('Invalid native Creative stack');
    if (!Buffer.from(new Writer774().slot(s).build()).equals(bytes)) {
      throw new Error('Native Creative stack codec round trip differs for item ' + s.id);
    }
    s.componentPatch.added.sort((a, b) => a.type.localeCompare(b.type));
    s.componentPatch.removed.sort();
    const tuple = canonical([s.id, 0, null, s.componentPatch]);
    const key = JSON.stringify(tuple);
    pool.set(key, tuple);
    decoded.set(wire, key);
    return key;
  };

  for (const c of raw.featureCatalogs) {
    for (const name of ['tabs', 'operatorTabs']) {
      for (const tab of c[name]) {
        decode(tab.icon);
        tab.items.forEach(decode);
      }
    }
  }

  const keys = [...pool.keys()].sort();
  const ids = new Map(keys.map((key, i) => [key, i]));
  const featureCatalogs = raw.featureCatalogs.map((c) => ({
    ...c,
    ...Object.fromEntries(
      ['tabs', 'operatorTabs'].map((name) => [
        name,
        c[name].map((tab) => ({
          ...tab,
          icon: ids.get(decode(tab.icon)),
          items: tab.items.map((wire) => ids.get(decode(wire)))
        }))
      ])
    )
  }));

  const output = {
    version: target.minecraftVersion,
    protocol: target.protocol,
    dataVersion: target.dataVersion,
    source: {
      clientJarSha1: target.downloads.client.sha1,
      extractorSha256: createHash('sha256').update(await readFile(java)).digest('hex'),
      serverJarSha1: KNOWN_PACK_774.serverSha1
    },
    stackFormat: 'native-components-774',
    registryOrder,
    stacks: keys.map((key) => pool.get(key)),
    tabs: featureCatalogs[0].tabs,
    operatorTabs: featureCatalogs[0].operatorTabs,
    featureCatalogs,
    potions: { 'minecraft:empty': { name: 'empty', effects: [] } },
    effects: {},
    eggs: {},
    itemMechanics: {},
    toolSpeeds: {},
    instruments: {}
  };

  const text = JSON.stringify(output) + '\n';
  const file = join(root, 'client/data/creative.json');
  if (check) {
    if ((await readFile(file, 'utf8')) !== text) {
      throw new Error('Stale native Creative catalogue');
    }
  } else {
    await mkdir(join(cache, 'runtime-data'), { recursive: true });
    await writeFile(file, text);
    await writeFile(join(cache, 'runtime-data/creative.json'), text);
  }
  console.log('Native Creative catalogue: ' + output.stacks.length + ' stacks / ' + featureCatalogs.length + ' feature combinations');
  return output;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await creativeData({ check: process.argv.includes('--check') });
}
