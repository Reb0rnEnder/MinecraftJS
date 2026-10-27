import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {BrowserPlatform} from '../client/js/platform/browser.js';
import {setPlatform} from '../client/js/platform/platform.js';
import {Settings} from '../client/js/game/settings.js';
import {ProxyList, fetchSkin} from '../client/js/net/proxies.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const uuid = '01234567-89ab-cdef-0123-456789abcdef';
const texture = 'https://textures.minecraft.net/texture/example';

test('config build preserves the custom skin proxy and unrelated site options', () => {
  const dir = mkdtempSync(join(tmpdir(), 'minecraftjs-site-config-'));
  try {
    const input = join(dir, 'config.json'), output = join(dir, 'built.json');
    const config = {skinProxy: 'https://cors.example/?url=%R', proxies: [], servers: []};
    writeFileSync(input, JSON.stringify(config));
    execFileSync(process.execPath, ['tools/build.js', 'config', '--config=' + input, '--out=' + output], {cwd: root});
    assert.deepEqual(JSON.parse(readFileSync(output)), config);
  } finally { rmSync(dir, {recursive: true, force: true}); }
});

test('external config overrides embedded defaults and reaches the skin fetcher; saved player choice wins', async t => {
  const old = Object.fromEntries(['document', 'location', 'fetch'].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  t.after(() => {
    for (const [key, descriptor] of Object.entries(old)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    new ProxyList({skinProxy: '', proxies: [], proxy: -1, save() {}});
  });
  const embedded = {skinProxy: 'https://embedded.example/%r', servers: []};
  globalThis.document = {getElementById: id => id === 'minecraftjs-config' ? {textContent: JSON.stringify(embedded)} : null};
  globalThis.location = {protocol: 'https:'};
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'config.json'); assert.equal(options.cache, 'no-cache');
    return {ok: true, json: async () => ({skinProxy: 'https://external.example/?url=%R', proxies: []})};
  };
  let saved = null; const requests = [];
  setPlatform({loadSetting: () => saved, fetchBytes: async url => {requests.push(url); return new Uint8Array([1]);}});
  const config = await BrowserPlatform.prototype.loadConfig();
  assert.deepEqual(config.servers, []);
  const settings = new Settings(config); new ProxyList(settings);
  await fetchSkin(texture, uuid);
  assert.equal(requests.pop(), 'https://external.example/?url=' + encodeURIComponent(texture));
  saved = JSON.stringify({skinProxy: 'https://players-choice.example/%u'});
  new ProxyList(new Settings(config)); await fetchSkin(texture, uuid);
  assert.equal(requests.pop(), 'https://players-choice.example/' + uuid.replaceAll('-', ''));
  saved = null;
  globalThis.location.protocol = 'file:';
  new ProxyList(new Settings(await BrowserPlatform.prototype.loadConfig()));
  await fetchSkin(texture, uuid);
  assert.equal(requests.pop(), 'https://embedded.example/' + texture);
});

test('an explicit empty proxy list on a static site does not invent a proxy at that origin',async()=>{
 const{defaultProxies}=await import('../client/js/net/proxies.js');setPlatform({originSocketUrl:()=> 'wss://static.example'});
 assert.deepEqual(defaultProxies({proxies:[]}),[]);
 assert.equal(defaultProxies({})[0].url,'wss://static.example');
});
