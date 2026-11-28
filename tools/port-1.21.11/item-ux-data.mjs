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
const wireSignature = (b64) => {
  const slot = new Reader774(Buffer.from(b64, 'base64')).slot();
  for (const c of slot?.componentPatch?.added || []) {
    if (Array.isArray(c.data?.enchantments)) c.data.enchantments.sort((a, b) => a.id - b.id);
    if (Array.isArray(c.data?.levels)) c.data.levels.sort((a, b) => a.id - b.id);
  }
  return canonical(slot);
};
const normalizeCheckFixture = (fix) => ({
  ...fix,
  samples: fix.samples.map((s) => ({ ...s, wire: wireSignature(s.wire) }))
});

export async function generateItemUx({ check = false } = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'item ux client');
  verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'item ux mappings');
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

  const inputsPath = join(root, 'tools/port-1.21.11/item-ux-inputs.json');
  const javaPath = join(root, 'tools/port-1.21.11/ExtractItemUx12111.java');
  const outPath = join(cache, 'item-ux-native.json');
  execFileSync(
    process.env.JAVA || 'java',
    ['-Xmx768M', '-cp', cp.join(delimiter), javaPath, outPath, join(cache, 'client.txt'), orderPath, inputsPath],
    { stdio: 'pipe', maxBuffer: 32 * 1024 * 1024 }
  );

  const raw = canonical(JSON.parse(await readFile(outPath, 'utf8')));
  for (const s of raw.samples) {
    const bytes = Buffer.from(s.wire, 'base64');
    const r = new Reader774(bytes);
    const parsed = r.slot();
    if (r.remaining() || !parsed) throw Error('Invalid ItemUX wire for ' + s.label);
    const reencoded = Buffer.from(new Writer774().slot(parsed).build());
    if (!reencoded.equals(bytes)) throw Error('ItemUX wire roundtrip differs for ' + s.label);
  }

  const extractorSha256 = sha256(await readFile(javaPath));
  const inputsSha256 = sha256(await readFile(inputsPath));
  const data = {
    baseAttackDamageId: raw.baseAttackDamageId,
    baseAttackSpeedId: raw.baseAttackSpeedId,
    clientJarSha1: target.downloads.client.sha1,
    effects: raw.effects,
    eggs: raw.eggs,
    enchantmentOrder: raw.enchantmentOrder,
    extractorSha256,
    fireworkColors: raw.fireworkColors,
    inputsSha256,
    instruments: raw.instruments,
    items: raw.items,
    minecraftVersion: target.minecraftVersion,
    potions: raw.potions,
    registries: raw.registries
  };
  const fixture = {
    blendSamples: raw.blendSamples,
    clientJarSha1: target.downloads.client.sha1,
    extractorSha256,
    inputsSha256,
    minecraftVersion: target.minecraftVersion,
    samples: raw.samples
  };

  const dataPath = join(root, 'client/js/game/item-data-1.21.11.js');
  const fixPath = join(root, 'tools/fixtures/item-ux-1.21.11.json');
  const dataSrc = `// Generated native item UX metadata. See tools/port-1.21.11/item-ux-data.mjs.\nexport const ITEM_DATA_774 = ${JSON.stringify(data)};\n`;
  await mkdir(join(root, 'tools/fixtures'), { recursive: true });

  if (check) {
    if ((await readFile(dataPath, 'utf8')) !== dataSrc) throw Error('Stale ' + dataPath);
    if (JSON.stringify(normalizeCheckFixture(JSON.parse(await readFile(fixPath, 'utf8')))) !== JSON.stringify(normalizeCheckFixture(fixture))) {
      throw Error('Stale ' + fixPath);
    }
  } else {
    await writeFile(dataPath, dataSrc);
    await writeFile(fixPath, JSON.stringify(fixture, null, 2) + '\n');
  }
  console.log(`Item UX 1.21.11: ${Object.keys(data.items).length} items, ${Object.keys(data.effects).length} effects, ${Object.keys(data.potions).length} potions, ${fixture.samples.length} samples`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateItemUx({ check: process.argv.includes('--check') });
}
