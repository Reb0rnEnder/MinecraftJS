// Proxies: what connects the browser to vanilla (TCP) servers.
import { platform } from '../platform/platform.js';
import { proxyHttpBase } from './address.js';
import { wispUrl, wispPacket } from './wisp.js';

export const PROXY_TYPES = ['mcjs', 'relay', 'wisp', 'gravrust-via'];
export const proxyType = (p) => (p && PROXY_TYPES.includes(p.type) ? p.type : 'mcjs');

let selected = null;
let allProxies = [];
let routingSettings = null;

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

export function defaultProxies(config) {
  if (config && Array.isArray(config.proxies)) return config.proxies.map(normalizeProxy).filter(Boolean);
  const origin = platform().originSocketUrl ? platform().originSocketUrl() : null;
  return origin ? [{ name: 'This website', url: origin, type: 'mcjs' }] : [];
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

export function currentProxy() { return selected; }
export function currentProxyUrl() { return selected ? selected.url : null; }

export function proxyRoute(path) {
  const p = selected && proxyType(selected) === 'mcjs' ? selected : allProxies.find((x) => proxyType(x) === 'mcjs');
  const base = p ? proxyHttpBase(p.url) : null;
  return base ? base + path : null;
}

// ... rest of proxies.js (add gravrust-via support in testProxy)

export async function testProxy(p, timeout = 6000) {
  const type = proxyType(p);
  if (type === 'relay') return testRelay(p, timeout);
  if (type === 'wisp') return testWisp(p, timeout);
  if (type === 'gravrust-via') return testVia(p, timeout);
  // ... mcjs test
}

async function testVia(p, timeout) {
  const wsUrl = new URL(p.url);
  const healthUrl = `http://${wsUrl.host}/health`;
  const t0 = platform().now();
  try {
    const r = await withTimeout(platform().fetchJson(healthUrl), timeout);
    if (r && r.ok) return { ping: Math.round(platform().now() - t0), info: { name: 'Gravrust Via', protocol: r.protocol, version: r.version, target: r.target, viaVersion: r.version, viaRewind: true } };
    return { error: 'Not a Gravrust Via server' };
  } catch { return { error: 'Unreachable' }; }
}
