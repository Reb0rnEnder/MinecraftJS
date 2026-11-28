// Derive native 1.21.11 option arrays through the mapped Options getters.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { cache, root, target, verify } from './prepare.mjs';

verify(await readFile(join(cache, 'client.jar')), target.downloads.client, 'client jar');
verify(await readFile(join(cache, 'client.txt')), target.downloads.client_mappings, 'client mappings');

const mapping = await readFile(join(cache, 'client.txt'), 'utf8');
const classes = new Map([...mapping.matchAll(/^(\S+) -> (\S+):$/gm)].map((m) => [m[1], m[2]]));
const names = {
  options: 'net.minecraft.client.Options',
  accessibilityOptions: 'net.minecraft.client.gui.screens.options.AccessibilityOptionsScreen',
  chatOptions: 'net.minecraft.client.gui.screens.options.ChatOptionsScreen',
  videoOptions: 'net.minecraft.client.gui.screens.options.VideoSettingsScreen',
  mouseOptions: 'net.minecraft.client.gui.screens.options.MouseSettingsScreen',
  fontOptions: 'net.minecraft.client.gui.screens.options.FontOptionsScreen',
  controlsScreen: 'net.minecraft.client.gui.screens.options.controls.ControlsScreen'
};
const aliases = Object.fromEntries(Object.entries(names).map(([k, v]) => [k, classes.get(v)]));
for (const [k, v] of Object.entries(aliases)) {
  if (!v) throw Error('Missing class mapping for ' + k + ' (' + names[k] + ')');
}

const output = join(cache, 'gui-src');
await mkdir(output, { recursive: true });
const needDecompile = Object.values(aliases).some((cls) => !existsSync(join(output, cls + '.java')));
if (needDecompile) {
  const jarInput = existsSync(join(cache, 'client-unsigned.jar')) ? join(cache, 'client-unsigned.jar') : join(cache, 'client.jar');
  execFileSync(
    process.env.JAVA || 'java',
    [
      '-jar',
      process.env.CFR_JAR || join(homedir(), '.cache/minecraftjs-parity-tools/cfr.jar'),
      jarInput,
      '--jarfilter',
      '^(' + Object.values(aliases).map((s) => s.replace(/\$/g, '\\$')).join('|') + ')$',
      '--outputdir',
      output,
      '--silent',
      'true'
    ],
    { stdio: 'pipe' }
  );
}

const source = await readFile(join(output, aliases.options + '.java'), 'utf8');
const fields = new Map();
const optClass = classes.get('net.minecraft.client.OptionInstance');
const optRe = new RegExp(`(?:private final ${optClass}<[^;\\n]+> |this\\.)(\\w+)\\s*=\\s*(?:new ${optClass}<[^\\n]*?>|${optClass}\\.\\w+)\\("([^"]+)"`, 'g');
for (const m of source.matchAll(optRe)) fields.set(m[1], m[2]);
const optReMulti = new RegExp(`(?:private final ${optClass}<[^;\\n]+> |this\\.)(\\w+)\\s*=\\s*new ${optClass}<[^;\\n]+>\\([^)]*"([^"]+)"`, 'gs');
for (const m of source.matchAll(optReMulti)) if (!fields.has(m[1])) fields.set(m[1], m[2]);

const getters = new Map();
const getterRe = new RegExp(`public ${optClass}<[^\\n]+> (\\w+)\\(\\) \\{\\s*return this\\.(\\w+);\\s*\\}`, 'g');
for (const m of source.matchAll(getterRe)) {
  if (fields.has(m[2])) getters.set(m[1], fields.get(m[2]));
}

const readArrays = async (key) => {
  const code = await readFile(join(output, aliases[key] + '.java'), 'utf8');
  const arrays = [...code.matchAll(new RegExp(`new ${optClass}\\[\\]\\{([^}]+)\\}`, 'g'))];
  if (!arrays.length) throw Error('No native option array ' + key);
  return arrays.map((arr) =>
    [...arr[1].matchAll(/\$\$\d+\.(\w+)\(\)/g)].map((m) => {
      const caption = getters.get(m[1]);
      if (!caption) throw Error('Unresolved native option ' + key + '.' + m[1]);
      return caption;
    })
  );
};

const [videoQuality, videoDisplay, videoPrefs] = await readArrays('videoOptions');
const videoPreset = getters.get('i') || 'options.graphics.preset';
const [accessibilityOptions] = await readArrays('accessibilityOptions');
const [chatOptions] = await readArrays('chatOptions');
const [mouseBase] = await readArrays('mouseOptions');
const rawMouseGetter = [...getters.entries()].find(([, cap]) => cap === 'options.rawMouseInput')?.[0];
const mouseOptions = rawMouseGetter && !mouseBase.includes('options.rawMouseInput')
  ? [...mouseBase, 'options.rawMouseInput']
  : mouseBase;
const [fontOptions] = await readArrays('fontOptions');
const [controlOptions] = await readArrays('controlsScreen');

const data = {
  videoOptions: ['options.fullscreen.resolution', ...videoDisplay, videoPreset, ...videoQuality, ...videoPrefs],
  accessibilityOptions,
  chatOptions,
  mouseOptions,
  fontOptions,
  controlOptions
};

const file = join(root, 'client/js/gui/vanilla-layout.js');
const old = JSON.parse((await readFile(file, 'utf8')).split('export const VANILLA_UI = ')[1].replace(/;\s*$/, ''));
const result = {
  ...old,
  ...data,
  version: target.minecraftVersion,
  packFormat: 75,
  clientJarSha1: target.downloads.client.sha1,
  controlsLayout: { ...old.controlsLayout, listTop: 20 }
};

const text = '// Native 1.21.11 option arrays, derived from the pinned jar and mapped getters.\nexport const VANILLA_UI = ' +
  JSON.stringify(result, null, 2) + ';\n';
if (process.argv.includes('--check')) {
  if (await readFile(file, 'utf8') !== text) throw Error('Stale native option arrays');
} else {
  await writeFile(file, text);
}
await writeFile(join(cache, 'gui-order.json'), JSON.stringify({ source: target.downloads.client.sha1, ...data }, null, 2) + '\n');
console.log('Native 1.21.11 option order:', Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v.length])));
