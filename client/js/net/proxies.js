// MinecraftJS proxies: the WebSocket bridges that connect the browser to vanilla (TCP) servers and relay account
// sign in and skin downloads. The list lives in settings.proxies ([{ name, url }]), settings.proxy is the index of
// the selected one. Defaults come from config.json (site owners), else the server that hosts the page.
import { platform } from '../platform/platform.js';
import { proxyHttpBase } from './address.js';

let selectedUrl = null;

// Default list: config.json "proxies", else this page's own server when it is served over http(s)
export function defaultProxies(config) {
  if (config && Array.isArray(config.proxies) && config.proxies.length) {
    return config.proxies.filter((p) => p && p.url).map((p) => ({ name: String(p.name || p.url), url: String(p.url) }));
  }
  const origin = platform().originSocketUrl ? platform().originSocketUrl() : null;
  return origin ? [{ name: 'This website', url: origin }] : [];
}

export class ProxyList {
  constructor(settings) {
    this.settings = settings;
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
    selectedUrl = i >= 0 ? this.list[i].url : null;
  }
  select(i) { this.settings.proxy = i; this.clampSelection(); this.settings.save(); }
  current() { return this.index >= 0 ? this.list[this.index] : null; }
  save() { this.clampSelection(); this.settings.save(); }
}

// WebSocket URL of the selected proxy (null when there is none)
export function currentProxyUrl() { return selectedUrl; }

// URL of an HTTP route on the selected proxy ('/auth/device', '/skin?url=...'), or null without a proxy
export function proxyRoute(path) {
  const base = proxyHttpBase(selectedUrl);
  return base ? base + path : null;
}

// Mojang skin through the selected proxy (textures.minecraft.net sends no CORS headers)
export function fetchSkin(url) {
  const route = proxyRoute('/skin?url=' + encodeURIComponent(url));
  return route ? platform().fetchBytes(route) : Promise.reject(new Error('No proxy'));
}

// Latest test result per proxy url ({ pending } | { ping, info } | { error }), shared by the title screen button
// and the Proxy Servers screen; deleting an entry makes the next ensureTested() test that proxy again
export const proxyTests = new Map();
export function ensureTested(url) {
  if (!proxyTests.has(url)) {
    proxyTests.set(url, { pending: true });
    testProxy(url).then((r) => proxyTests.set(url, r));
  }
  return proxyTests.get(url);
}

// Test a proxy: connect and ask for its info. -> { ping, info } or { error }
export async function testProxy(url, timeout = 6000) {
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
