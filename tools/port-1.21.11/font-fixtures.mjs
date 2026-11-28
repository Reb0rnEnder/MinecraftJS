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

const SAMPLE_CHARS = [
  'A', 'ą', 'Ą', 'ć', 'Ć', 'ę', 'Ę', 'ł', 'Ł', 'ń', 'Ń', 'ó', 'Ó', 'ś', 'Ś', 'ź', 'Ź', 'ż', 'Ż',
  'Ж', '→', '中', '文', '骨', '直', '令', 'あ', 'ｱ', '한', '😀', '🦨',
  '\u2000', '\u2001', '\u2002', '\u3000', '\u0000'
];

const SYNTHETIC_HEX = [8, 16, 24, 32]
  .map((w, i) => (0xe000 + i).toString(16).toUpperCase() + ':' + ('8' + '0'.repeat(w / 4 - 2) + '1').repeat(16) + '\n')
  .join('') + 'E004:' + '0'.repeat(32) + '\n';

function assetPath(index, key) {
  const obj = index.objects[key];
  if (!obj) throw Error('Missing asset index entry ' + key);
  const p = join(cache, 'objects', obj.hash.slice(0, 2), obj.hash);
  if (!existsSync(p)) throw Error('Missing cached asset object ' + key + ' at ' + p);
  return p;
}

export async function generateFonts({ check = false } = {}) {
  verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'fonts client');
  verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'fonts mappings');
  const unsigned = join(cache, 'client-unsigned.jar');
  if (!existsSync(unsigned)) throw Error('Missing ' + unsigned);
  const cp = nativeClasspath(cache)
    .split(delimiter)
    .filter((entry) => !entry.includes('META-INF/versions') && !entry.includes('META-INF\\versions'));
  cp[0] = unsigned;

  const assetIndex = JSON.parse(await readFile(join(cache, 'asset-index.json'), 'utf8'));
  const unifontJson = JSON.parse(await readFile(assetPath(assetIndex, 'minecraft/font/include/unifont.json'), 'utf8'));
  const jpDef = unifontJson.providers.find((p) => p.type === 'unihex' && p.hex_file === 'minecraft:font/unifont_jp.zip');
  const mainDef = unifontJson.providers.find((p) => p.type === 'unihex' && p.hex_file === 'minecraft:font/unifont.zip');
  if (!jpDef || !mainDef) throw Error('Expected native unihex providers missing from unifont.json');

  const inputs = [
    {
      label: 'japanese',
      definition: jpDef,
      path: assetPath(assetIndex, 'minecraft/font/unifont_jp.zip'),
      characters: SAMPLE_CHARS
    },
    {
      label: 'unifont',
      definition: mainDef,
      path: assetPath(assetIndex, 'minecraft/font/unifont.zip'),
      characters: SAMPLE_CHARS
    },
    {
      label: 'widths-and-overrides',
      definition: {
        type: 'unihex',
        hex_file: 'minecraft:font/synthetic.zip',
        size_overrides: [
          { from: '\uE001', to: '\uE003', left: -1, right: 16 },
          { from: '\uE002', to: '\uE004', left: 0, right: 7 }
        ]
      },
      hex: SYNTHETIC_HEX,
      characters: ['\uE000', '\uE001', '\uE002', '\uE003', '\uE004', '\uE005']
    }
  ];

  const inputsPath = join(cache, 'fonts-inputs.json');
  const outPath = join(cache, 'fonts-native.json');
  const javaPath = join(root, 'tools/port-1.21.11/ExtractFonts12111.java');
  await writeFile(inputsPath, JSON.stringify(inputs, null, 2));

  execFileSync(
    process.env.JAVA || 'java',
    ['-Xmx512M', '-cp', cp.join(delimiter), javaPath, outPath, join(cache, 'client.txt'), inputsPath],
    { stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 }
  );

  const samples = canonical(JSON.parse(await readFile(outPath, 'utf8')));
  const fixture = {
    minecraftVersion: target.minecraftVersion,
    clientJarSha1: target.downloads.client.sha1,
    extractorSha256: sha256(await readFile(javaPath)),
    samples
  };
  const fixturePath = join(root, 'tools/fixtures/fonts-1.21.11.json');
  await mkdir(join(root, 'tools/fixtures'), { recursive: true });
  if (check) {
    if (JSON.stringify(JSON.parse(await readFile(fixturePath, 'utf8'))) !== JSON.stringify(fixture)) {
      throw Error('Stale fonts fixture ' + fixturePath);
    }
  } else {
    await writeFile(fixturePath, JSON.stringify(fixture, null, 2) + '\n');
  }
  console.log(`Fonts 1.21.11: ${samples.length} providers, ${samples.reduce((n, s) => n + s.glyphs.length, 0)} glyphs`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateFonts({ check: process.argv.includes('--check') });
}
