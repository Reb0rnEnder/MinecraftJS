// Server resource packs (1.8 NetHandlerPlayClient.handleResourcePack, ResourcePackRepository.downloadResourcePack,
// HttpUtil.downloadResourcePack). The pack is fetched through the proxy (most pack hosts send no CORS headers), cached
// under server-packs/<hash> ("legacy" when the hash isn't 40 lowercase hex digits; the newest 10 are kept) and put on
// top of the user's packs until the player leaves the server. A cached file is only reused when its SHA-1 matches.
import { tr } from '../gui/i18n.js';
import { Screen } from '../gui/screens/manager.js';
import { ConfirmScreen } from '../gui/screens/menus.js';
import { platform } from '../platform/platform.js';
import { proxyRoute } from '../net/proxies.js';
import { sha1 } from '../util/mccrypto.js';
import { ResourcePack } from '../assets.js';

const PREFIX = 'server-packs/';
const MAX_SIZE = 52428800; // 50 MiB
const KEEP = 10;
const ORDER_KEY = 'minecraftjs.serverPacks';

// C19PacketResourcePackStatus.Action
export const PACK_STATUS = { SUCCESSFULLY_LOADED: 0, DECLINED: 1, FAILED_DOWNLOAD: 2, ACCEPTED: 3 };

const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
async function sha1Hex(bytes) {
  try { if (globalThis.crypto && crypto.subtle) return hex(new Uint8Array(await crypto.subtle.digest('SHA-1', bytes))); } catch (e) { /* fall back */ }
  return hex(sha1(bytes));
}

// GuiScreenWorking: the title at y 70 and "stage N%" at y 90; closes itself once the work is done
export class WorkingScreen extends Screen {
  constructor(game) {
    super(game);
    this.background = game.inWorld ? 'world' : 'dirt';
    this.title = ''; this.stage = ''; this.progress = 0; this.done = false;
  }
  resetProgressAndMessage(s) { this.title = s; this.displayLoadingString('Working...'); }
  displayLoadingString(s) { this.stage = s; this.progress = 0; }
  setLoadingProgress(p) { this.progress = p; }
  setDoneWorking() { this.done = true; if (this.game.screens.current === this) this.game.screens.open(null); }
  renderContent(gui) {
    gui.textCentered(this.title, this.width / 2, 70, 0xffffff, true);
    gui.textCentered(this.stage + ' ' + this.progress + '%', this.width / 2, 90, 0xffffff, true);
  }
  key() { return true; } // GuiScreenWorking ignores Escape
}

export class ServerPacks {
  constructor(game) {
    this.game = game;
    this.pack = null;     // the active server pack (ResourcePack)
    this.request = 0;     // bumps to cancel a running download
  }

  // NetHandlerPlayClient.handleResourcePack (1.8 does not validate the URL; a bad one fails to download)
  handle(url, hash, send) {
    const g = this.game;
    // level:// packs are files in the saves folder; there is none here
    if (url.startsWith('level://')) { send(PACK_STATUS.FAILED_DOWNLOAD); return; }
    const entry = this._serverEntry();
    const mode = entry ? entry.resourceMode || 'prompt' : 'prompt';
    if (entry && mode === 'enabled') { send(PACK_STATUS.ACCEPTED); this._download(url, hash, send); return; }
    if (entry && mode !== 'prompt') { send(PACK_STATUS.DECLINED); return; }
    const conn = g.conn;
    g.screens.open(new ConfirmScreen(g, (yes) => {
      if (g.conn !== conn) return;
      const e = this._serverEntry();
      if (e) { e.resourceMode = yes ? 'enabled' : 'disabled'; g.settings.save(); }
      send(yes ? PACK_STATUS.ACCEPTED : PACK_STATUS.DECLINED);
      g.screens.open(null);
      if (yes) this._download(url, hash, send);
    }, tr('multiplayer.texturePrompt.line1'), tr('multiplayer.texturePrompt.line2')));
  }

  // Minecraft.getCurrentServerData: the saved server list entry for this connection (none for direct connect)
  _serverEntry() {
    const a = this.game.serverAddress;
    if (!a) return null;
    return (this.game.settings.servers || []).find((s) => s.host === a.host && s.port === a.port) || null;
  }

  // ResourcePackRepository.downloadResourcePack: reuse a cached file whose hash matches, else download it (the
  // download itself is not checked)
  async _download(url, hash, send) {
    const g = this.game, files = platform().files;
    const id = ++this.request, conn = g.conn;
    const live = () => this.request === id && g.conn === conn;
    hash = hash || '';
    const key = PREFIX + (/^[a-f0-9]{40}$/.test(hash) ? hash : 'legacy');
    try {
      let bytes = await files.get(key).catch(() => null);
      if (bytes && !(hash.length === 40 && (await sha1Hex(bytes)) === hash)) { await files.delete(key).catch(() => {}); bytes = null; }
      if (!bytes) {
        await this._deleteOld();
        const screen = new WorkingScreen(g);
        g.screens.open(screen);
        try {
          bytes = await this._fetch(url, screen, live);
        } finally { screen.setDoneWorking(); }
        if (!live()) return;
        await files.put(key, bytes).then(() => this._remember(key), (e) => console.warn('Could not cache server resource pack', e));
      }
      if (!live()) return;
      await this._apply(new ResourcePack('server', bytes));
      if (live()) send(PACK_STATUS.SUCCESSFULLY_LOADED);
    } catch (e) {
      console.warn('Server resource pack failed:', e);
      if (live()) send(PACK_STATUS.FAILED_DOWNLOAD);
    }
  }

  // HttpUtil.downloadResourcePack: "Downloading Resource Pack", "Making Request..." then "Downloading (x.xx MB)..."
  // with the percentage; refuses anything over 50 MiB
  async _fetch(url, screen, live) {
    screen.resetProgressAndMessage('Downloading Resource Pack');
    screen.displayLoadingString('Making Request...');
    const g = this.game;
    const headers = { 'X-Minecraft-Username': g.username || '', 'X-Minecraft-UUID': (g.playerUuid || '').replace(/-/g, ''), 'X-Minecraft-Version': '1.8.9' };
    const route = proxyRoute('/pack?url=' + encodeURIComponent(url));
    let res = null;
    if (route) { try { res = await fetch(route, { headers }); } catch (e) { res = null; } }
    if (!res || !res.ok) res = await fetch(url); // the host may allow CORS itself
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const total = Number(res.headers.get('content-length')) || 0;
    if (total > MAX_SIZE) throw new Error('Filesize is bigger than maximum allowed (file is ' + total + ', limit is ' + MAX_SIZE + ')');
    if (total) screen.displayLoadingString('Downloading file (' + (total / 1048576).toFixed(2) + ' MB)...');
    const reader = res.body.getReader();
    const chunks = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!live()) { reader.cancel().catch(() => {}); throw new Error('Cancelled'); }
      got += value.length;
      if (got > MAX_SIZE) { reader.cancel().catch(() => {}); throw new Error('Filesize was bigger than maximum allowed (got >= ' + got + ', limit was ' + MAX_SIZE + ')'); }
      chunks.push(value);
      if (total) screen.setLoadingProgress(Math.trunc(got / total * 100));
    }
    const out = new Uint8Array(got);
    let o = 0;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  // deleteOldServerResourcesPacks: keep the newest 10 (by when they were stored)
  // (oldest first; the order is kept in localStorage since the file store has no modification times)
  async _deleteOld() {
    const files = platform().files;
    const keys = await files.list(PREFIX).catch(() => []);
    const order = this._order().filter((k) => keys.includes(k));
    for (const k of keys) if (!order.includes(k)) order.unshift(k);
    while (order.length >= KEEP) await files.delete(order.shift()).catch(() => {});
    this._saveOrder(order);
  }

  _order() {
    try { const o = JSON.parse(localStorage.getItem(ORDER_KEY) || '[]'); return Array.isArray(o) ? o : []; } catch (e) { return []; }
  }
  _saveOrder(order) { try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)); } catch (e) { /* storage unavailable */ } }
  _remember(key) { this._saveOrder([...this._order().filter((k) => k !== key), key]); }

  // setServerResourcePack: on top of the user's packs, then refresh the resources
  async _apply(pack) {
    const a = this.game.assets;
    this.pack = pack;
    a.serverPack = pack;
    a.packs = [pack, ...a.packs.filter((p) => p !== a.serverPack && p.id !== 'server')];
    await this.game.reloadResources();
  }

  // ResourcePackRepository.clearResourcePack: cancel a download and drop the server pack (on leaving the server)
  clear() {
    this.request++;
    if (!this.pack) return;
    const a = this.game.assets;
    a.packs = a.packs.filter((p) => p !== this.pack);
    a.serverPack = null;
    this.pack = null;
    this.game.reloadResources().catch((e) => console.error(e));
  }
}
