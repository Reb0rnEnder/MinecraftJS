// Account manager: offline names and Microsoft accounts (signed in through the proxy with the OAuth
// device code flow). Stored through the platform settings store on this device only.
import { platform } from '../platform/platform.js';
import { proxyRoute } from '../net/proxies.js';

// Microsoft sign in is relayed by the selected proxy (the Microsoft and Xbox services send no CORS headers)
function authPost(path, body) {
  const url = proxyRoute(path);
  if (!url) return Promise.reject(new Error('Signing in needs a MinecraftJS proxy: add one in Proxy Servers'));
  return platform().postJson(url, body);
}

const KEY = 'minecraftjs.accounts';
const REFRESH_MARGIN = 5 * 60 * 1000;

export class Accounts {
  constructor(settings) {
    this.settings = settings;
    this.list = [];
    this.activeId = null;
    try {
      const saved = JSON.parse(platform().loadSetting(KEY) || platform().loadSetting('minekampf.accounts') || 'null');
      if (saved) { this.list = saved.list || []; this.activeId = saved.active || null; }
    } catch (e) { /* corrupt store: start fresh */ }
    if (!this.list.length) this.addOffline(settings.username || 'WebPlayer');
    if (!this.active()) this.activeId = this.list[0].id;
  }

  save() { platform().saveSetting(KEY, JSON.stringify({ list: this.list, active: this.activeId })); }

  active() { return this.list.find((a) => a.id === this.activeId) || this.list[0] || null; }

  setActive(id) {
    this.activeId = id;
    const a = this.active();
    if (a) { this.settings.username = a.name; this.settings.save(); }
    this.save();
  }

  addOffline(name) {
    name = String(name).replace(/[^A-Za-z0-9_]/g, '').slice(0, 16) || 'Player';
    let a = this.list.find((x) => x.type === 'offline' && x.name === name);
    if (!a) { a = { id: 'offline:' + name, type: 'offline', name }; this.list.push(a); }
    this.save();
    return a;
  }

  addMicrosoft(acc) {
    const id = 'ms:' + acc.uuid;
    const a = { id, ...acc };
    const i = this.list.findIndex((x) => x.id === id);
    if (i >= 0) this.list[i] = a; else this.list.push(a);
    this.save();
    return a;
  }

  remove(id) {
    this.list = this.list.filter((a) => a.id !== id);
    if (!this.list.length) this.addOffline(this.settings.username || 'WebPlayer');
    if (this.activeId === id) this.activeId = this.list[0].id;
    this.save();
  }

  // Valid Minecraft token for a Microsoft account (refreshing it when it is about to expire)
  async ensureFresh(a) {
    if (a.type !== 'microsoft') return a;
    if (a.accessToken && a.expiresAt - Date.now() > REFRESH_MARGIN) return a;
    const r = await authPost('/auth/refresh', { refreshToken: a.refreshToken });
    if (!r.json || !r.json.account) throw new Error((r.json && r.json.error) || 'Could not refresh the Microsoft session');
    return this.addMicrosoft(r.json.account);
  }

  // Device code sign in: returns { userCode, verificationUri, deviceCode, interval, expiresIn }
  async startDeviceLogin() {
    const r = await authPost('/auth/device', {});
    if (!r.json || !r.json.deviceCode) throw new Error((r.json && r.json.error) || 'Could not reach Microsoft');
    return r.json;
  }

  // Resolves to an account once signed in, null while still pending; throws on failure
  async pollDeviceLogin(deviceCode) {
    const r = await authPost('/auth/poll', { deviceCode });
    if (r.status !== 200) throw new Error((r.json && r.json.error) || 'Sign in failed');
    return r.json.account ? this.addMicrosoft(r.json.account) : null;
  }
}
