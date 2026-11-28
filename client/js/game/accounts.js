// Account manager: offline names and Microsoft accounts (signed in through the proxy with the OAuth
// device code flow). Stored through the platform settings store on this device only.
import { platform } from '../platform/platform.js';
import { proxyRoute } from '../net/proxies.js';
import { rawRoute } from '../net/https.js';
import * as direct from './msauth-client.js';

// Microsoft sign in is relayed by the selected proxy (the Microsoft and Xbox services send no CORS headers)
function authPost(path, body) {
  const url = proxyRoute(path);
  if (!url) return Promise.reject(new Error('This needs a MinecraftJS proxy: add one in Proxy Servers'));
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
    this.onActiveChanged?.();
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
    this.onActiveChanged?.();
  }

  // Valid Minecraft token for a Microsoft account (refreshing it when it is about to expire)
  async ensureFresh(a, requireProxy = false) {
    if (a.type !== 'microsoft') return a;
    if (a.accessToken && a.expiresAt - Date.now() > REFRESH_MARGIN) return a;
    // Skin/cape changes must go through the MCJS relay even when a direct route is configured.
    if (!requireProxy && rawRoute()) return this.addMicrosoft(await direct.refresh(a.refreshToken));
    const r = await authPost('/auth/refresh', { refreshToken: a.refreshToken });
    if (!r.json || !r.json.account) throw new Error((r.json && r.json.error) || 'Could not refresh the Microsoft session');
    return this.addMicrosoft(r.json.account);
  }

  async socialPrivileges(account=this.active()) {
    if(account?.type!=='microsoft')return null;
    const fresh=await this.ensureFresh(account);if(rawRoute())return direct.socialPrivileges(fresh.accessToken);
    const r=await authPost('/auth/privileges',{accessToken:fresh.accessToken});
    if(r.status!==200||!r.json?.privileges)throw Error(r.json?.error||'Could not load account privileges');
    return r.json.privileges;
  }

  async blockedProfiles(account=this.active()) {
    if(account?.type!=='microsoft')return [];
    const fresh=await this.ensureFresh(account);if(rawRoute())return direct.blockedProfiles(fresh.accessToken);
    const r=await authPost('/auth/blocklist',{accessToken:fresh.accessToken});
    if(r.status!==200||!Array.isArray(r.json?.blockedProfiles))throw Error(r.json?.error||'Could not load the account block list');
    return r.json.blockedProfiles;
  }

  // AbuseReportSender.Services.send for the active Microsoft account (direct over the client's TLS, else the proxy)
  async reportAbuse(json,account=this.active()) {
    if(account?.type!=='microsoft')throw Object.assign(Error('Reporting needs a Microsoft account'),{unavailable:true});
    const fresh=await this.ensureFresh(account);if(rawRoute())return direct.reportAbuse(fresh.accessToken,json);
    const r=await authPost('/auth/report',{accessToken:fresh.accessToken,body:json});
    if(r.status===200)return;
    throw Object.assign(Error(r.json?.error||'Status: '+r.status),r.json?.status?{status:r.json.status}:{unavailable:true});
  }

  // AccountProfileKeyPairManager: the Mojang-signed chat key pair from player/certificates, reused until its
  // refreshedAfter time (kept in memory only: the private key is not written to settings)
  async profileKeys(account=this.active()) {
    if(account?.type!=='microsoft')return null;
    const cached=(this.keyPairs||=new Map()).get(account.id);
    if(cached&&Date.now()<cached.refreshedAfter)return cached;
    const fresh=await this.ensureFresh(account);let c;
    if(rawRoute())c=await direct.certificates(fresh.accessToken);
    else{const r=await authPost('/auth/certificates',{accessToken:fresh.accessToken});c=r.json?.certificates;if(r.status!==200||!c)throw Error(r.json?.error||'Could not load the chat signing key');}
    if(!c?.keyPair?.privateKey||!c?.keyPair?.publicKey||!c.publicKeySignatureV2)throw Error('Could not load the chat signing key');
    const {pemBytes}=await import('../net/chat-signing-1.19.4.js');
    const keys={privateKey:pemBytes(c.keyPair.privateKey),publicKey:pemBytes(c.keyPair.publicKey),signature:pemBytes(c.publicKeySignatureV2),expiresAt:Date.parse(c.expiresAt),refreshedAfter:Date.parse(c.refreshedAfter)};
    this.keyPairs.set(account.id,keys);
    return keys;
  }
  // AccountProfileKeyPairManager.shouldRefreshKeyPair
  shouldRefreshKeys(account=this.active()){const k=this.keyPairs?.get(account?.id);return !!k&&Date.now()>=k.refreshedAfter;}

  // Device code sign in: returns { userCode, verificationUri, deviceCode, interval, expiresIn }
  async startDeviceLogin() {
    if (rawRoute()) return direct.startDeviceCode();
    const r = await authPost('/auth/device', {});
    if (!r.json || !r.json.deviceCode) throw new Error((r.json && r.json.error) || 'Could not reach Microsoft');
    return r.json;
  }

  // Resolves to an account once signed in, null while still pending; throws on failure
  async pollDeviceLogin(deviceCode) {
    if (rawRoute()) { const account = await direct.pollDeviceCode(deviceCode); return account ? this.addMicrosoft(account) : null; }
    const r = await authPost('/auth/poll', { deviceCode });
    if (r.status !== 200) throw new Error((r.json && r.json.error) || 'Sign in failed');
    return r.json.account ? this.addMicrosoft(r.json.account) : null;
  }

  // Mojang profile, skin and cape changes go through the MCJS relay. The browser cannot call
  // api.minecraftservices.com directly (CORS), and the access token stays in the request body.
  async profile(account = this.active()) {
    if (!account || account.type !== 'microsoft') throw new Error('Only Microsoft accounts have a Mojang profile');
    const fresh = await this.ensureFresh(account, true);
    const r = await authPost('/auth/profile', { accessToken: fresh.accessToken });
    if (r.status !== 200 || !r.json?.profile) throw new Error((r.json && r.json.error) || 'Could not load the Minecraft profile');
    return this.applyProfile(fresh, r.json.profile);
  }

  applyProfile(account, profile) {
    const i = this.list.findIndex((a) => a.id === account.id);
    if (i < 0) return account;
    const skin = (profile.skins || []).find((s) => s.state === 'ACTIVE') || (profile.skins || [])[0] || null;
    const capes = Array.isArray(profile.capes) ? profile.capes : [];
    const cape = capes.find((c) => c.state === 'ACTIVE') || null;
    const updated = {
      ...this.list[i],
      name: profile.name || this.list[i].name,
      uuid: profile.id || this.list[i].uuid,
      skinUrl: skin ? skin.url : null,
      slim: !!(skin && skin.variant === 'SLIM'),
      capes,
      capeId: cape ? cape.id : null,
      capeUrl: cape ? cape.url : null,
    };
    this.list[i] = updated;
    this.save();
    return updated;
  }

  async setSkin(account, png, variant = 'classic') {
    if (!account || account.type !== 'microsoft') throw new Error('Only Microsoft accounts can upload a Mojang skin');
    const fresh = await this.ensureFresh(account, true);
    const r = await authPost('/auth/skin', { accessToken: fresh.accessToken, variant: variant === 'slim' ? 'slim' : 'classic', png });
    if (r.status !== 200 || !r.json?.profile) throw new Error((r.json && r.json.error) || 'Could not change the skin');
    return this.applyProfile(fresh, r.json.profile);
  }

  async resetSkin(account) {
    if (!account || account.type !== 'microsoft') throw new Error('Only Microsoft accounts can reset a Mojang skin');
    const fresh = await this.ensureFresh(account, true);
    const r = await authPost('/auth/skin/reset', { accessToken: fresh.accessToken });
    if (r.status !== 200) throw new Error((r.json && r.json.error) || 'Could not reset the skin');
    if (r.json && r.json.profile) return this.applyProfile(fresh, r.json.profile);
    return this.profile(fresh);
  }

  async setCape(account, capeId) {
    if (!account || account.type !== 'microsoft') throw new Error('Only Microsoft accounts can change a Mojang cape');
    const fresh = await this.ensureFresh(account, true);
    const r = await authPost('/auth/cape', { accessToken: fresh.accessToken, capeId });
    if (r.status !== 200 || !r.json?.profile) throw new Error((r.json && r.json.error) || 'Could not change the cape');
    return this.applyProfile(fresh, r.json.profile);
  }

  async hideCape(account) {
    if (!account || account.type !== 'microsoft') throw new Error('Only Microsoft accounts can change a Mojang cape');
    const fresh = await this.ensureFresh(account, true);
    const r = await authPost('/auth/cape/hide', { accessToken: fresh.accessToken });
    if (r.status !== 200) throw new Error((r.json && r.json.error) || 'Could not hide the cape');
    if (r.json && r.json.profile) return this.applyProfile(fresh, r.json.profile);
    return this.profile(fresh);
  }
}
