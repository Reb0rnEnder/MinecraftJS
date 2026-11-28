import { ServerPacks, WorkingScreen } from './serverpacks.js';
import { ResourcePack } from '../assets.js';
import { platform } from '../platform/platform.js';
import { sha1 } from '../util/mccrypto.js';
import { tr } from '../gui/i18n.js';
import { ConfirmScreen, DisconnectedScreen } from '../gui/screens/menus.js';
import { packCompatibility } from '../resource-pack-compatibility.js';

export const PACK_STATUS_774 = Object.freeze({
  SUCCESSFULLY_LOADED: 0,
  DECLINED: 1,
  FAILED_DOWNLOAD: 2,
  ACCEPTED: 3,
  DOWNLOADED: 4,
  INVALID_URL: 5,
  FAILED_RELOAD: 6,
  DISCARDED: 7,
});

export const FORMAT_774 = 75;
export const MINOR_774 = 0;

function validPackFormat(pack) {
  if (!pack || typeof pack !== 'object') return false;
  return Number.isInteger(pack.pack_format) || pack.min_format !== undefined || pack.max_format !== undefined;
}

// Native DownloadedPackSource / ServerPackManager for 1.21.11 (pack format 75.0,
// 250 MiB download cap, multi-pack batching with UUID replacement and rollback).
export class ServerPacks774 extends ServerPacks {
  constructor(game, opts = {}) {
    super(game);
    this.entries = new Map();
    this.serial = 0;
    this.revision = 0;
    this.reloadPromise = Promise.resolve();
    this.reloadQueued = false;
    this.maxSize = opts.maxBytes ?? 0xFA00000;
    this.minecraftVersion = '1.21.11';
    this._customFetch = opts.fetch || null;
    this._customConfirm = opts.confirm || null;
    this._policyOverride = opts.policy || null;
  }

  push(packet, send) {
    const forced = Boolean(packet.forced ?? packet.required);
    let url;
    try {
      url = new URL(String(packet.url), globalThis.location?.href || 'http://localhost/');
      if (!['http:', 'https:'].includes(url.protocol)) throw Error('Invalid scheme');
    } catch {
      send(PACK_STATUS_774.INVALID_URL);
      return Promise.resolve();
    }
    this.pop(packet.uuid);
    const record = {
      ...packet,
      url: url.href,
      forced,
      send,
      conn: this.game?.conn ?? null,
      serial: ++this.serial,
      accepted: false,
      ready: false,
      loaded: false,
      terminal: false,
    };
    this.entries.set(packet.uuid, record);
    this.revision++;
    const mode = this._policyOverride || this._serverEntry()?.resourceMode || 'prompt';
    if (mode === 'enabled') this._accept(record);
    else if (mode === 'disabled' && !forced) {
      this._finish(record, PACK_STATUS_774.DECLINED);
      this.entries.delete(packet.uuid);
    } else if (this._customConfirm) {
      record.task = (async () => {
        const yes = forced ? true : await this._customConfirm(record);
        if (!this._live(record)) { this._finish(record, PACK_STATUS_774.DISCARDED); return; }
        if (yes) await this._accept(record);
        else {
          this._finish(record, PACK_STATUS_774.DECLINED);
          this.entries.delete(record.uuid);
        }
      })();
      return record.task;
    } else {
      this._prompt();
    }
    return record.task || Promise.resolve();
  }

  _live(record) {
    return this.entries.get(record.uuid) === record && (this.game?.conn ?? null) === record.conn;
  }

  _finish(record, status) {
    if (record.terminal) return;
    record.terminal = true;
    if ((this.game?.conn ?? null) === record.conn) record.send(status);
  }

  _prompt() {
    const pending = [...this.entries.values()].filter((record) => !record.accepted && !record.terminal);
    if (!pending.length) return;
    const g = this.game, conn = g.conn, forced = pending.some((r) => r.forced), last = pending.at(-1);
    g.screens.open(new ConfirmScreen(
      g,
      (yes) => {
        if (g.conn !== conn) return;
        const requests = [...this.entries.values()].filter((r) => !r.accepted && !r.terminal);
        const required = requests.some((r) => r.forced), entry = this._serverEntry();
        if (entry && (yes || !required)) {
          entry.resourceMode = yes ? 'enabled' : 'disabled';
          g.settings.save();
        }
        g.screens.open(null);
        for (const record of requests) {
          if (yes) this._accept(record);
          else {
            this._finish(record, PACK_STATUS_774.DECLINED);
            this.entries.delete(record.uuid);
          }
        }
        if (!yes && required) {
          g.disconnect(true);
          g.screens.open(new DisconnectedScreen(g, tr('disconnect.lost'), tr('multiplayer.requiredTexturePrompt.disconnect')));
        }
      },
      tr(forced ? 'multiplayer.requiredTexturePrompt.line1' : 'multiplayer.texturePrompt.line1'),
      this._promptText(forced, last.promptMessage),
      tr(forced ? 'gui.proceed' : 'gui.yes'),
      tr(forced ? 'menu.disconnect' : 'gui.no'),
    ));
  }

  _accept(record) {
    if (!this._live(record) || record.accepted) return record.task || Promise.resolve();
    record.accepted = true;
    record.send(PACK_STATUS_774.ACCEPTED);
    record.task = this._downloadBytes(record).then(
      (bytes) => {
        if (!this._live(record)) return;
        record.bytes = bytes;
        record.ready = true;
        record.send(PACK_STATUS_774.DOWNLOADED);
        return this._scheduleReload();
      },
      () => {
        if (!this._live(record)) return;
        this._finish(record, PACK_STATUS_774.FAILED_DOWNLOAD);
        this.entries.delete(record.uuid);
        this.revision++;
        for (const other of this.entries.values()) {
          if (other.accepted && !other.loaded) {
            this._finish(other, PACK_STATUS_774.DISCARDED);
            this.entries.delete(other.uuid);
          }
        }
        return this._scheduleReload();
      },
    );
    return record.task;
  }

  async _downloadBytes(record) {
    const want = /^[0-9a-f]{40}$/i.test(record.hash || '') ? record.hash.toLowerCase() : '';
    if (this._customFetch) {
      const res = await this._customFetch(record.url);
      if (!res?.ok) throw Error(`HTTP ${res?.status}`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.length > this.maxSize) throw Error('Server resource pack exceeds 250 MiB limit');
      if (!(await this._check(want, bytes))) throw Error('Hash mismatch');
      return bytes;
    }
    const files = platform().files;
    const key = 'server-packs/' + Array.from(sha1(new TextEncoder().encode(record.url)), (b) => b.toString(16).padStart(2, '0')).join('');
    let bytes = await files.get(key).catch(() => null);
    if (bytes && !(await this._check(want, bytes))) {
      await files.delete(key).catch(() => {});
      bytes = null;
    }
    if (!bytes) {
      await this._deleteOld();
      const screen = new WorkingScreen(this.game);
      this.game.screens.open(screen);
      try { bytes = await this._fetch(record.url, screen, () => this._live(record)); }
      finally { screen.setDoneWorking(); }
      if (!this._live(record)) return null;
      if (!(await this._check(want, bytes))) throw Error('Hash mismatch');
      await files.put(key, bytes).then(() => this._remember(key), () => {});
    }
    return bytes;
  }

  _makePack(record) {
    const pack = new ResourcePack('server/' + record.uuid + '/' + record.serial, record.bytes);
    const meta = JSON.parse(pack.zip.readText(pack.prefix + 'pack.mcmeta'));
    if (!validPackFormat(meta?.pack)) throw Error('Invalid server pack metadata');
    pack.minFormat = meta.pack.min_format;
    pack.maxFormat = meta.pack.max_format;
    const compat = packCompatibility(pack, FORMAT_774, MINOR_774);
    if (compat !== 'compatible') console.warn('Server pack compatibility:', record.uuid, compat);
    return pack;
  }

  _scheduleReload() {
    if (this.reloadQueued) return this.reloadPromise;
    this.reloadQueued = true;
    this.reloadPromise = this.reloadPromise.then(async () => {
      this.reloadQueued = false;
      const records = [...this.entries.values()].filter((r) => r.accepted && this._live(r));
      if (records.some((r) => !r.ready)) return;
      const a = this.game.assets, previous = a.serverPacks || [], active = records.sort((x, y) => y.serial - x.serial), revision = this.revision;
      const oldSet = new Set(previous), user = a.packs.filter((p) => !oldSet.has(p));
      try {
        for (const r of active) r.pack ??= this._makePack(r);
        const desired = active.map((r) => r.pack);
        if (desired.length === previous.length && desired.every((p, i) => p === previous[i])) return;
        a.serverPacks = desired;
        a.serverPack = desired[0] || null;
        a.packs = [...desired, ...user];
        await this.game.reloadResources();
        for (const r of active) {
          if (this._live(r) && !r.loaded) {
            r.loaded = true;
            this._finish(r, PACK_STATUS_774.SUCCESSFULLY_LOADED);
          }
        }
      } catch {
        a.serverPacks = previous;
        a.serverPack = previous[0] || null;
        a.packs = [...previous, ...user];
        for (const r of active) {
          if (this._live(r) && !r.loaded) {
            this._finish(r, PACK_STATUS_774.FAILED_RELOAD);
            this.entries.delete(r.uuid);
          }
        }
        try { await this.game.reloadResources(); }
        catch (rollback) { console.error('Server pack recovery failed', rollback); }
      }
      if (revision !== this.revision) return this._scheduleReload();
    });
    return this.reloadPromise;
  }

  pop(uuid = null) {
    let changed = false;
    for (const [id, record] of this.entries) {
      if (uuid !== null && id !== uuid) continue;
      this.entries.delete(id);
      record.terminal = true;
      changed = true;
    }
    if (changed) { this.revision++; return this._scheduleReload(); }
    return this.reloadPromise;
  }

  clear() { return this.pop(); }

  async whenIdle() {
    await Promise.all([...this.entries.values()].map((r) => r.task));
    await this.reloadPromise;
  }
}
