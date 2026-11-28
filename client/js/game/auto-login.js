// Auto Login for offline-mode ("cracked") servers.
// A /login or /register command typed in chat is remembered per server + account name.
// Register commands are converted to the matching /login command. Everything is stored
// in this browser's settings store only.
import { platform } from '../platform/platform.js';
import { C } from '../net/packets.js';
import { tr } from '../gui/i18n.js';

const KEY = 'minecraftjs.autologin';
const MAX_COMMAND = 100;
const SEND_DELAY = 1500;

let timer = null;
let generation = 0;

function readStore() {
  try {
    const data = JSON.parse(platform().loadSetting(KEY) || '{}');
    return {
      version: 1,
      entries: Array.isArray(data.entries)
        ? data.entries.filter((e) => e && e.server && e.account && e.command)
        : [],
    };
  } catch (e) {
    return { version: 1, entries: [] };
  }
}

function writeStore(store) {
  platform().saveSetting(KEY, JSON.stringify(store));
}

function pairKey(server, account) {
  return String(server || '').trim().toLowerCase() + '\u0000' + String(account || '').trim().toLowerCase();
}

export function entryKey(entry) {
  return pairKey(entry.server, entry.account);
}

function serverName(addr) {
  if (!addr) return '';
  const host = String(addr.host || '').trim();
  if (!host) return '';
  return addr.port ? host + ':' + addr.port : host;
}

// The server and account a command typed or shown now belongs to.
export function currentPair(game) {
  const server = serverName(game.serverAddress || game.settings?.lastServer || null);
  const account = String(
    (game.inWorld && game.username) || game.accounts?.active()?.name || ''
  ).trim();
  return { key: pairKey(server, account), server, account };
}

export function listAutoLogins() {
  return readStore().entries
    .slice()
    .sort((a, b) => (a.server + '\u0000' + a.account).localeCompare(b.server + '\u0000' + b.account));
}

export function findAutoLogin(server, account) {
  const key = pairKey(server, account);
  return readStore().entries.find((e) => entryKey(e) === key) || null;
}

export function currentAutoLogin(game) {
  const pair = currentPair(game);
  return pair.server && pair.account ? findAutoLogin(pair.server, pair.account) : null;
}

// Only /login and /register commands are accepted. /register password becomes
// /login password so the next join can log in without registering again.
export function normalizeCommand(text) {
  const command = String(text || '').trim().slice(0, MAX_COMMAND);
  if (!/^\/(login|register)\b/i.test(command)) return '';
  const login = command.match(/^\/login\s+\S/i);
  if (login) return command.replace(/^\/login/i, '/login');
  const register = command.match(/^\/register\s+(\S+)/i);
  return register ? '/login ' + register[1] : '';
}

export function saveAutoLogin(server, account, text) {
  server = String(server || '').trim();
  account = String(account || '').trim();
  const command = normalizeCommand(text);
  if (!server || !account || !command) return null;
  const store = readStore();
  const key = pairKey(server, account);
  let entry = store.entries.find((e) => entryKey(e) === key);
  if (entry) {
    entry.command = command;
    entry.updatedAt = Date.now();
  } else {
    entry = { server, account, command, updatedAt: Date.now() };
    store.entries.push(entry);
  }
  writeStore(store);
  return entry;
}

export function removeAutoLogin(server, account) {
  const store = readStore();
  const key = pairKey(server, account);
  const before = store.entries.length;
  store.entries = store.entries.filter((e) => entryKey(e) !== key);
  if (store.entries.length === before) return false;
  writeStore(store);
  return true;
}

export function captureAutoLogin(game, text) {
  const command = normalizeCommand(text);
  if (!command) return null;
  const pair = currentPair(game);
  return pair.server && pair.account ? saveAutoLogin(pair.server, pair.account, command) : null;
}

export function maskedCommand(command) {
  const match = String(command || '').match(/^(\S+)\s+/);
  return match ? match[1] + ' ******' : String(command || '');
}

export function cancelAutoLogin() {
  generation++;
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
}

export function scheduleAutoLogin(game) {
  cancelAutoLogin();
  const entry = currentAutoLogin(game);
  if (!entry || !game.inWorld) return;
  const conn = game.conn;
  const gen = generation;
  timer = setTimeout(() => {
    timer = null;
    if (gen !== generation || game.conn !== conn || !game.inWorld) return;
    game.send(C.chat(entry.command));
    if (game.hud) game.hud.addChat('§a' + tr('minecraftjs.autologin.sent'), null, true);
  }, SEND_DELAY);
}
