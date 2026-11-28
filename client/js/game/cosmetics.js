// Local skins and capes for offline-mode ("cracked") accounts, using the MCJS preset library.
// Records live in this browser's settings store. On MCJS servers the local player's skin is
// drawn from here; other players never receive it, just like a client-side skin mod.
import { platform } from '../platform/platform.js';
import { decodeBase64 } from '../util/base64.js';
import { decodePng } from '../util/png.js';
import { EAGLER_CAPES, EAGLER_SKINS } from '../net/eagler-presets.js';
import { parseUserSkin } from '../render/entity-renderer.js';

const KEY = 'minecraftjs.cosmetics';

function sameUuid(a, b) {
  return !!a && !!b && String(a).replace(/-/g, '').toLowerCase() === String(b).replace(/-/g, '').toLowerCase();
}

function read() {
  try {
    const data = JSON.parse(platform().loadSetting(KEY) || '{}');
    return { version: 1, accounts: data && typeof data.accounts === 'object' ? data.accounts : {} };
  } catch (e) {
    return { version: 1, accounts: {} };
  }
}

export function presetSkin(id) { return EAGLER_SKINS.find((p) => p.id === Number(id)) || null; }
export function presetCape(id) { return EAGLER_CAPES.find((p) => p.id === Number(id)) || null; }

export class Cosmetics {
  constructor(game) {
    this.game = game;
    this.data = read();
    this.cache = new Map(); // account id -> { skin: {version, texture}, cape: {version, texture} }
  }

  save() { platform().saveSetting(KEY, JSON.stringify(this.data)); }

  entry(accountId) { return this.data.accounts[accountId] || null; }

  _update(accountId, patch) {
    const old = this.entry(accountId) || {};
    this.data.accounts[accountId] = { ...old, ...patch, updatedAt: Date.now() };
    this.save();
    this.refresh();
  }

  setSkin(accountId, pngBase64, slim = false, presetId = null) {
    if (!accountId || !pngBase64) return null;
    this._update(accountId, { skin: String(pngBase64), slim: !!slim, skinPreset: presetId });
    return this.entry(accountId);
  }

  setCape(accountId, pngBase64, presetId = null) {
    if (!accountId) return null;
    if (!pngBase64) { this.clearCape(accountId); return this.entry(accountId); }
    this._update(accountId, { cape: String(pngBase64), capePreset: presetId });
    return this.entry(accountId);
  }

  setSlim(accountId, slim) {
    const e = this.entry(accountId);
    if (!e || !e.skin) return null;
    this._update(accountId, { slim: !!slim });
    return this.entry(accountId);
  }

  clearSkin(accountId) {
    const e = this.entry(accountId);
    if (!e) return;
    delete e.skin; delete e.skinPreset; delete e.slim;
    if (!e.cape) delete this.data.accounts[accountId]; else e.updatedAt = Date.now();
    this.save(); this.refresh();
  }

  clearCape(accountId) {
    const e = this.entry(accountId);
    if (!e) return;
    delete e.cape; delete e.capePreset;
    if (!e.skin) delete this.data.accounts[accountId]; else e.updatedAt = Date.now();
    this.save(); this.refresh();
  }

  applyPresetSkin(account, preset) {
    if (!account || !preset) return null;
    return this.setSkin(account.id, preset.png, !!preset.slim, preset.id);
  }

  applyPresetCape(account, preset) {
    if (!account || !preset) return null;
    return this.setCape(account.id, preset.png, preset.id);
  }

  activeAccount() {
    return this.game.accounts && this.game.accounts.active();
  }

  // Only the local player can wear a local skin; other players keep their server/skin-provider textures.
  _localAccount(uuid) {
    const g = this.game, acc = this.activeAccount();
    if (!acc || !uuid || !g.playerUuid || !sameUuid(uuid, g.playerUuid)) return null;
    return acc;
  }

  // MCJS preset or uploaded skin for the active offline account.
  localSkin(uuid) {
    const acc = this._localAccount(uuid);
    if (!acc || acc.type === 'microsoft') return null;
    const e = this.entry(acc.id);
    if (!e || !e.skin) return null;
    const texture = this._texture(acc.id, 'skin', e);
    if (!texture) return null;
    return { path: e.slim ? 'entity/alex.png' : 'entity/steve.png', slim: !!e.slim, texture, cape: this._texture(acc.id, 'cape', e) || null };
  }

  // A local cape is allowed for any account: Mojang has no custom-cape upload, so this is the
  // client-side custom cape (and the MCJS cape library for offline accounts).
  localCape(uuid) {
    const acc = this._localAccount(uuid);
    if (!acc) return null;
    const e = this.entry(acc.id);
    if (!e || !e.cape) return null;
    return this._texture(acc.id, 'cape', e) || null;
  }

  skinTexture(account) {
    if (!account) return null;
    const e = this.entry(account.id);
    if (!e || !e.skin) return null;
    return this._texture(account.id, 'skin', e);
  }

  capeTexture(account) {
    if (!account) return null;
    const e = this.entry(account.id);
    if (!e || !e.cape) return null;
    return this._texture(account.id, 'cape', e);
  }

  _texture(accountId, type, entry) {
    const version = type === 'skin' ? entry.updatedAt + ':s:' + (entry.skinPreset ?? '') : entry.updatedAt + ':c:' + (entry.capePreset ?? '');
    let group = this.cache.get(accountId);
    if (!group) { group = {}; this.cache.set(accountId, group); }
    let cached = group[type];
    if (cached && cached.version === version) return cached.texture;
    if (cached) {
      try { this.game.assets.device?.destroyTexture(cached.texture); } catch (e) { /* already gone */ }
      this.game.assets.textures?.delete('cosmetic-' + type + ':' + accountId);
    }
    try {
      const raw = decodePng(decodeBase64(type === 'skin' ? entry.skin : entry.cape));
      const img = type === 'skin' ? parseUserSkin(raw) : this._capeImage(raw);
      const texture = this.game.assets.makeTexture('cosmetic-' + type + ':' + accountId, img.width, img.height, img.data);
      group[type] = { version, texture };
      return texture;
    } catch (e) {
      group[type] = { version, texture: null };
      return null;
    }
  }

  // MCJS 32x32 cape preset layout -> the vanilla 64x32 cape texture.
  _capeImage(img) {
    if (img.width !== 32 || img.height !== 32) return img;
    const data = new Uint8Array(64 * 32 * 4);
    for (let y = 0; y < 32; y++) data.set(img.data.subarray(y * 128, y * 128 + 128), y * 256);
    return { width: 64, height: 32, data };
  }

  refresh() {
    const g = this.game;
    if (g.playerUuid) {
      g.entityRenderer?.skins?.delete(g.playerUuid);
      g.entityRenderer?._rebuild(g.playerUuid);
    }
    g.handRenderer?.invalidateSkin();
  }

  // MCJS profile data (skin_v1 / cape_v1) sent in the WebSocket login handshake. This is what
  // makes a cracked account's chosen skin/cape visible to the server and the other players.
  eaglerProfile() {
    return { skin: this.skinPacket(), cape: this.capePacket() };
  }

  skinPacket() {
    const acc = this.activeAccount(), e = acc && this.entry(acc.id);
    if (e && e.skinPreset != null && presetSkin(e.skinPreset)) {
      const id = Number(e.skinPreset) | 0;
      return new Uint8Array([0x01, (id >>> 24) & 255, (id >>> 16) & 255, (id >>> 8) & 255, id & 255]);
    }
    if (e && e.skin) {
      try {
        const img = parseUserSkin(decodePng(decodeBase64(e.skin)));
        const out = new Uint8Array(2 + 64 * 64 * 4);
        out[0] = 0x02;
        out[1] = e.slim ? 1 : 0;
        for (let i = 0; i < 64 * 64; i++) {
          out[2 + i * 4] = img.data[i * 4 + 3];     // A
          out[3 + i * 4] = img.data[i * 4];         // R
          out[4 + i * 4] = img.data[i * 4 + 1];     // G
          out[5 + i * 4] = img.data[i * 4 + 2];     // B
        }
        return out;
      } catch (err) { /* fall through to the default preset */ }
    }
    return new Uint8Array([0x01, 0, 0, 0, 0]);
  }

  capePacket() {
    const acc = this.activeAccount(), e = acc && this.entry(acc.id);
    if (e && e.capePreset != null && presetCape(e.capePreset)) {
      const id = Number(e.capePreset) | 0;
      return new Uint8Array([0x01, (id >>> 24) & 255, (id >>> 16) & 255, (id >>> 8) & 255, id & 255]);
    }
    if (e && e.cape) {
      try {
        const img = this._capeImage(decodePng(decodeBase64(e.cape)));
        const out = new Uint8Array(1 + 1173);
        out[0] = 0x02;
        const at = (x, y) => (y * 64 + x) * 4;
        for (let y = 0; y < 17; y++) for (let x = 0; x < 22; x++) {
          const i = at(x, y), o = 1 + (y * 23 + x) * 3;
          out[o] = img.data[i + 2]; out[o + 1] = img.data[i + 1]; out[o + 2] = img.data[i];
        }
        for (let y = 0; y < 11; y++) {
          const i = at(22, y + 11), o = 1 + ((y + 6) * 23 + 22) * 3;
          out[o] = img.data[i + 2]; out[o + 1] = img.data[i + 1]; out[o + 2] = img.data[i];
        }
        return out;
      } catch (err) { /* fall through to no cape */ }
    }
    return new Uint8Array([0x01, 0, 0, 0, 0]);
  }
}
