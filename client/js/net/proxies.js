// Proxies: what connects the browser to vanilla (TCP) servers. The list lives in settings.proxies
// ([{ name, url, type, token? }]), settings.proxy is the index of the selected one. Types:
//   minecraftjs  a MinecraftJS proxy (npm start): does the Minecraft login itself and also relays account sign in,
//                session joins and skin downloads
//   relay        an Eaglercraft 26.2 Java relay (raw TCP over WebSocket, wss://host/minecraft?target=)
//   wisp         a Wisp server (raw TCP streams multiplexed over one WebSocket)
// With relay and wisp the client speaks the Minecraft protocol itself (net/tcp.js). Defaults come from config.json
// (site owners), else the server that hosts the page. A config url of "origin" is the page's own server.
import { platform } from '../platform/platform.js';
import { proxyHttpBase } from './address.js';
import { wispUrl, wispPacket } from './wisp.js';

export const PROXY_TYPES = ['minecraftjs', 'relay', 'wisp'];
export const proxyType = (p) => (p && PROXY_TYPES.includes(p.type) ? p.type : 'minecraftjs');

let selected = null;
let allProxies = [];
let routingSettings = null;

// config.json entry -> list entry ("origin" resolves to the hosting page's server, dropped on file:// pages)
export function normalizeProxy(p) {
  if (!p || !p.url) return null;
  let url = String(p.url);
  if (url === 'origin') {
    url = platform().originSocketUrl ? platform().originSocketUrl() : null;
    if (!url) return null;
  }
  const out = { name: String(p.name || url), url, type: proxyType(p) };
  if (p.token) out.token = String(p.token);
  return out;
}

// Default list: config.json "proxies", else this page's own server when it is served over http(s)
export function defaultProxies(config) {
  if (config && Array.isArray(config.proxies) && config.proxies.length) return config.proxies.map(normalizeProxy).filter(Boolean);
  const origin = platform().originSocketUrl ? platform().originSocketUrl() : null;
  return origin ? [{ name: 'This website', url: origin, type: 'minecraftjs' }] : [];
}

export class ProxyList {
  constructor(settings) {
    this.settings = settings;
    routingSettings = settings;
    if (!Array.isArray(settings.proxies)) settings.proxies = defaultProxies(settings.config);
    this.clampSelection();
  }
  get list() { return this.settings.proxies; }
  get index() { return this.settings.proxy; }
  clampSelection() {
    const n = this.list.length;
    let i = this.settings.proxy | 0;
    if (i < 0 || i >= n) i = n ? 0 : -1;
    this.settings.proxy = i;
    for (const p of this.list) p.type = proxyType(p);
    selected = i >= 0 ? this.list[i] : null;
    allProxies = this.list;
  }
  select(i) { this.settings.proxy = i; this.clampSelection(); this.settings.save(); }
  current() { return this.index >= 0 ? this.list[this.index] : null; }
  save() { this.clampSelection(); this.settings.save(); }
}

// The selected proxy entry / its WebSocket URL (null when there is none)
export function currentProxy() { return selected; }
export function currentProxyUrl() { return selected ? selected.url : null; }

// URL of an HTTP route on a MinecraftJS proxy ('/auth/device', '/skin?url=...'): the selected one, else the first
// MinecraftJS proxy in the list (relays have no HTTP routes); null without one
export function proxyRoute(path) {
  const p = selected && proxyType(selected) === 'minecraftjs' ? selected : allProxies.find((x) => proxyType(x) === 'minecraftjs');
  const base = p ? proxyHttpBase(p.url) : null;
  return base ? base + path : null;
}

// %u: undashed player UUID; %r: original target URL; %R: percent-encoded target URL.
// %U remains a legacy alias for %r.
export function validSkinProxyTemplate(template) {
  if(typeof template!=='string')return false;
  if(!template.trim())return true;
  if(!/%[urRU]/.test(template))return false;
  try {
    const expanded=template.trim().replace(/%[urRU]/g,t=>t==='%u'?'00000000000000000000000000000000':t==='%R'?encodeURIComponent('https://textures.minecraft.net/texture/example'):'https://textures.minecraft.net/texture/example');
    return ['http:','https:'].includes(new URL(expanded).protocol);
  } catch {return false;}
}

export function uuidSkinProxyAvailable(template=routingSettings?.skinProxy||'') {
  return validSkinProxyTemplate(template)&&template.includes('%u')&&!/%[rRU]/.test(template);
}

export function skinProxyUrl(url,template=routingSettings?.skinProxy||'',uuid=null,kind='skin') {
  const target=url?new URL(url):null;
  if(target&&!['http:','https:'].includes(target.protocol))throw new Error('Invalid skin URL');
  if(target?.hostname==='textures.minecraft.net')target.protocol='https:';
  if(template.trim()) {
    if(!validSkinProxyTemplate(template))throw new Error('Invalid skin proxy template');
    // UUID image services return a skin PNG, not cape PNGs or session-profile JSON.
    if(kind!=='skin'&&uuidSkinProxyAvailable(template))return target?proxyRoute('/skin?url='+encodeURIComponent(target.href)):null;
    const id=String(uuid||'').replace(/-/g,'');
    if(template.includes('%u')&&!/^[0-9a-f]{32}$/i.test(id))throw new Error('Missing or invalid skin UUID');
    if(/%[rRU]/.test(template)&&!target)throw new Error('Missing texture URL');
    return template.trim().replace(/%[urRU]/g,t=>t==='%u'?id:t==='%R'?encodeURIComponent(target.href):target.href);
  }
  return target?proxyRoute('/skin?url='+encodeURIComponent(target.href)):null;
}

export function fetchSkin(url,uuid=null,kind='skin') {
  try {const route=skinProxyUrl(url,undefined,uuid,kind);return route?platform().fetchBytes(route):Promise.reject(new Error('No skin proxy configured'));}
  catch(error){return Promise.reject(error);}
}

export function fetchSkinProfile(uuid) {
  const id=String(uuid).replace(/-/g,'');
  if(!/^[0-9a-f]{32}$/i.test(id))return Promise.reject(new Error('Invalid profile UUID'));
  try {
    const route=routingSettings?.skinProxy&&!uuidSkinProxyAvailable()
      ?skinProxyUrl('https://sessionserver.mojang.com/session/minecraft/profile/'+id,undefined,id,'profile')
      :proxyRoute('/profile?uuid='+id);
    return route?platform().fetchJson(route):Promise.reject(new Error('No profile proxy configured'));
  } catch(error){return Promise.reject(error);}
}

// Latest test result per proxy url ({ pending } | { ping, info } | { error }), shared by the title screen button
// and the Proxy Servers screen; deleting an entry makes the next ensureTested() test that proxy again
export const proxyTests = new Map();
const testKey = (p) => proxyType(p) + ' ' + p.url;
export function ensureTested(p) {
  const k = testKey(p);
  if (!proxyTests.has(k)) {
    proxyTests.set(k, { pending: true });
    testProxy(p).then((r) => proxyTests.set(k, r));
  }
  return proxyTests.get(k);
}
export function forgetTest(p) { proxyTests.delete(testKey(p)); }

// Test a proxy -> { ping, info } or { error }
export async function testProxy(p, timeout = 6000) {
  const type = proxyType(p);
  if (type === 'relay') return testRelay(p, timeout);
  if (type === 'wisp') return testWisp(p, timeout);
  const url = p.url;
  const t0 = platform().now();
  let sock;
  try { sock = await platform().openSocket(url); } catch (e) { return { error: 'Unreachable' }; }
  const opened = platform().now();
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); sock.close(); resolve(r); };
    // Proxies from before the info message stay silent: the connection itself proves they work
    const timer = setTimeout(() => finish({ ping: Math.round(opened - t0), info: null }), Math.min(timeout, 2500));
    const sent = platform().now();
    sock.on('text', (t) => {
      let m; try { m = JSON.parse(t); } catch (e) { return; }
      if (m.type === 'info') finish({ ping: Math.round(platform().now() - sent), info: m });
    });
    sock.on('close', () => finish({ error: 'Closed the connection' }));
    sock.sendText(JSON.stringify({ type: 'info' }));
  });
}

// Java relay: GET /health ({ ok, protocol: "minecraft-java-byte-stream-v1" }); a relay whose /health sends no CORS
// headers counts as reachable when it answers at all
async function testRelay(p, timeout) {
  const base = proxyHttpBase(p.url.replace(/\/minecraft\/?$/, ''));
  const t0 = platform().now();
  try {
    const r = await withTimeout(platform().fetchJson(base + '/health'), timeout);
    if (r && r.ok) return { ping: Math.round(platform().now() - t0), info: { name: 'Java relay', protocol: r.protocol, public: r.public } };
    return { error: 'Not a Java relay' };
  } catch (e) { /* no CORS or no /health */ }
  if (!platform().probe) return { error: 'Unreachable' };
  try {
    const t1 = platform().now();
    await withTimeout(platform().probe(base + '/health'), timeout);
    return { ping: Math.round(platform().now() - t1), info: { name: 'Java relay' } };
  } catch (e) { return { error: 'Unreachable' }; }
}

// Wisp: the server speaks first (CONTINUE on stream 0, or INFO for v2)
async function testWisp(p, timeout) {
  let sock;
  const t0 = platform().now();
  try { sock = await withTimeout(platform().openSocket(wispUrl(p.url)), timeout); } catch (e) { return { error: 'Unreachable' }; }
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (done) return; done = true; clearTimeout(timer); sock.close(); resolve(r); };
    const timer = setTimeout(() => finish({ error: 'Not a Wisp server' }), Math.min(timeout, 3000));
    sock.on('binary', (b) => {
      const packet = wispPacket(b);
      if (packet && packet.id === 0 && (packet.type === 3 || packet.type === 5)) finish({ ping: Math.round(platform().now() - t0), info: { name: 'Wisp', version: b[0] === 0x05 ? 'v' + b[5] + '.' + b[6] : 'v1' } });
      else finish({ error: 'Not a Wisp server' });
    });
    sock.on('close', () => finish({ error: 'Closed the connection' }));
  });
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timed out')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}
