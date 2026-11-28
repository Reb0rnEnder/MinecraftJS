// Account manager screens: account list, Microsoft sign in (OAuth device code), offline names.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { ListOf } from '../slot-list.js';
import { Button, TextField } from '../widgets.js';
import { platform } from '../../platform/platform.js';
import { fetchSkin } from '../../net/proxies.js';
import { decodeBase64 } from '../../util/base64.js';
import { decodePng } from '../../util/png.js';
import { chatToLegacy } from '../chat.js';
import { parseAddress } from '../../net/address.js';
import { parseUserSkin } from '../../render/entity-renderer.js';
import { Connection } from '../../net/connection.js';
import { currentPair, entryKey, findAutoLogin, listAutoLogins, maskedCommand, removeAutoLogin, saveAutoLogin } from '../../game/auto-login.js';

const ROW_H = 36;

// Skin face texture for an account (falls back to the default skins until loaded)
const faces = new Map();
export function accountFace(game, acc) {
  const fallback = acc && acc.slim ? 'entity/alex.png' : 'entity/steve.png';
  // Offline accounts wear the local MCJS skin; show it here too instead of the default face.
  const local = game.cosmetics && acc && game.cosmetics.skinTexture(acc);
  if (local) return local;
  if (!acc || !acc.skinUrl && !acc.uuid) return fallback;
  const key = acc.skinUrl + '@' + acc.uuid + '@' + (game.settings?.skinProxy||'') + '@' + game.assets.version;
  const cur = faces.get(key);
  if (cur) return cur.tex || fallback;
  const entry = { tex: null };
  faces.set(key, entry);
  fetchSkin(acc.skinUrl, acc.uuid).then((bytes) => {
    if (!bytes) return;
    const img = parseUserSkin(decodePng(bytes));
    entry.tex = game.assets.makeTexture('accountskin:' + acc.skinUrl, img.width, img.height, img.data);
  }).catch(() => {});
  return fallback;
}

// Face + hat layer at x, y with the given size
export function drawFace(gui, game, acc, x, y, size) {
  const t = gui.tex(accountFace(game, acc));
  if (!t) return;
  const k = t.width / 64;
  gui.drawImage(t, 8 * k, 8 * k, 8 * k, 8 * k, x, y, size, size);
  gui.drawImage(t, 40 * k, 8 * k, 8 * k, 8 * k, x, y, size, size);
}

export class AccountsScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
    const a = game.accounts.active();
    this.selected = Math.max(0, game.accounts.list.indexOf(a));
  }

  get list() { return this.game.accounts.list; }

  init() {
    const g = this.game, cx = this.width / 2;
    this.useBtn = new Button(1, cx - 154, this.height - 52, 150, 20, tr('minecraftjs.accounts.use'), () => this.use());
    this.buttons.push(this.useBtn);
    this.buttons.push(new Button(2, cx + 4, this.height - 52, 150, 20, tr('minecraftjs.accounts.addMicrosoft'), () => g.screens.open(new MicrosoftLoginScreen(g, this))));
    this.removeBtn = new Button(3, cx - 154, this.height - 28, 100, 20, tr('minecraftjs.accounts.remove'), () => this.removeSelected());
    this.buttons.push(this.removeBtn);
    this.buttons.push(new Button(4, cx - 50, this.height - 28, 100, 20, tr('minecraftjs.accounts.addOffline'), () => g.screens.open(new OfflineAccountScreen(g, this))));
    this.buttons.push(new Button(0, cx + 54, this.height - 28, 100, 20, tr('gui.done'), () => this.close()));
    this.buttons.push(new Button(5, this.width - 104, 4, 100, 20, tr('minecraftjs.autologin.button'), () => g.screens.open(new AutoLoginScreen(g, this))));
    this.buttons.push(new Button(6, this.width - 208, 4, 100, 20, tr('minecraftjs.skins.button'), () => {
      import('./skins.js').then((m) => g.screens.open(new m.SkinsScreen(g, this)));
    }));
    const old = this.slots;
    this.slots = new ListOf(this, 40, this.height - 64, ROW_H, {
      size: () => this.list.length,
      selected: (i) => i === this.selected,
      draw: (gui, i, x, y) => this._row(gui, this.list[i], x, y),
      click: (i, dbl) => { this.selected = i; if (dbl) this.use(); },
    });
    if (old) { this.slots.amountScrolled = old.amountScrolled; this.slots.clamp(); }
  }

  close() { this.game.screens.open(this.parent); }

  use() {
    const a = this.list[this.selected];
    if (a) this.game.accounts.setActive(a.id);
  }

  removeSelected() {
    const a = this.list[this.selected];
    if (!a) return;
    this.game.accounts.remove(a.id);
    this.selected = Math.min(this.selected, this.list.length - 1);
  }

  render(gui, mx, my) {
    const g = this.game;
    this.useBtn.enabled = !!this.list[this.selected] && this.list[this.selected] !== g.accounts.active();
    this.removeBtn.enabled = !!this.list[this.selected];
    this.slots.render(gui, mx, my);
    // The top-right Skins/Auto Login buttons leave no room for a centred title on the default GUI width.
    const title = tr('minecraftjs.accounts.title');
    if (this.width / 2 + gui.textWidth(title) / 2 < this.width - 212) gui.textCentered(title, this.width / 2, 12, 0xffffff);
    else gui.textCentered(title, this.width / 2, 26, 0xffffff);
    for (const b of this.buttons) b.render(gui, mx, my);
  }

  _row(gui, a, x, y) {
    const g = this.game, active = g.accounts.active();
    drawFace(gui, g, a, x, y, 32);
    gui.text(a.name + (a === active ? ' §a' + tr('minecraftjs.accounts.inUse') : ''), x + 35, y + 1, 0xffffff);
    let line;
    if (a.type === 'microsoft') line = '§7' + tr(a.expiresAt > Date.now() ? 'minecraftjs.accounts.microsoft' : 'minecraftjs.accounts.microsoftRefresh');
    else line = '§7' + tr('minecraftjs.accounts.offline');
    gui.text(line, x + 35, y + 12, 0x808080, false);
  }

  mouseDown(mx, my, button, e) { return super.mouseDown(mx, my, button) || this.slots.mouseDown(mx, my, button, e); }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); this.slots.mouseUp(); }
  mouseMove(mx, my) { this.slots.mouseMove(mx, my); }
  wheel(d) { this.slots.wheel(d); }
}

// Auto Login editor: the current server/account plus every saved pair.
export class AutoLoginScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
    this.status = null;
  }

  init() {
    const g = this.game, cx = this.width / 2;
    this.current = currentPair(g);
    this.entries = listAutoLogins();
    this.selectedKey = this.current.key;
    this.selectedServer = this.current.server;
    this.selectedAccount = this.current.account;
    const entry = findAutoLogin(this.selectedServer, this.selectedAccount);
    this.field = new TextField(cx - 154, 98, 308, 20, {
      text: entry ? entry.command : '',
      maxLength: 100,
      focused: true,
      onEnter: () => this.save(),
    });
    this.fields.push(this.field);
    this.saveBtn = new Button(1, cx - 154, 122, 100, 20, tr('minecraftjs.autologin.save'), () => this.save());
    this.forgetBtn = new Button(2, cx - 50, 122, 100, 20, tr('minecraftjs.autologin.forget'), () => this.forget());
    this.currentBtn = new Button(3, cx + 54, 122, 100, 20, tr('minecraftjs.autologin.current'), () => this.useCurrent());
    this.buttons.push(this.saveBtn, this.forgetBtn, this.currentBtn);
    this.buttons.push(new Button(0, cx - 50, this.height - 24, 100, 20, tr('gui.done'), () => this.close()));
    this.pingServer();
    const old = this.list;
    this.list = new ListOf(this, 154, this.height - 30, 26, {
      size: () => this.entries.length,
      selected: (i) => entryKey(this.entries[i]) === this.selectedKey,
      draw: (gui, i, x, y) => this._row(gui, this.entries[i], x, y),
      click: (i) => { this.select(i); return true; },
    });
    if (old) { this.list.amountScrolled = old.amountScrolled; this.list.clamp(); }
  }

  select(i) {
    const entry = this.entries[i];
    if (!entry) return;
    this.selectedKey = entryKey(entry);
    this.selectedServer = entry.server;
    this.selectedAccount = entry.account;
    this.field.setText(entry.command);
    this.field.focused = true;
    this.status = null;
    this.pingServer();
  }

  useCurrent() {
    this.selectedKey = this.current.key;
    this.selectedServer = this.current.server;
    this.selectedAccount = this.current.account;
    const entry = findAutoLogin(this.selectedServer, this.selectedAccount);
    this.field.setText(entry ? entry.command : '');
    this.field.focused = true;
    this.status = null;
    this.pingServer();
  }

  accountFor(name) {
    const list = this.game.accounts.list;
    return list.find((a) => a.name.toLowerCase() === String(name || '').toLowerCase()) || this.game.accounts.active();
  }

  pingServer() {
    const server = this.selectedServer;
    if (!server) { this._pingKey = null; this.server = { error: tr('minecraftjs.autologin.noServer') }; return; }
    if (this._pingKey === server) return;
    this._pingKey = server;
    this.server = { pending: true };
    const addr = parseAddress(server);
    if (!addr) { this.server = { error: tr('minecraftjs.autologin.badServer') }; return; }
    new Connection().ping(addr.host, addr.port).then((r) => {
      if (this._pingKey !== server) return;
      this.server = r.error ? { error: r.error } : { status: r.status };
    }).catch((e) => { if (this._pingKey === server) this.server = { error: e.message || 'Offline' }; });
  }

  save() {
    const entry = saveAutoLogin(this.selectedServer, this.selectedAccount, this.field.text);
    if (!entry) {
      this.status = { text: tr('minecraftjs.autologin.invalid'), color: '§c' };
      return;
    }
    this.field.setText(entry.command);
    this.selectedKey = entryKey(entry);
    this.selectedServer = entry.server;
    this.selectedAccount = entry.account;
    this.entries = listAutoLogins();
    this.status = { text: tr('minecraftjs.autologin.savedStatus'), color: '§a' };
  }

  forget() {
    if (!removeAutoLogin(this.selectedServer, this.selectedAccount)) return;
    this.field.setText('');
    this.entries = listAutoLogins();
    this.status = { text: tr('minecraftjs.autologin.removedStatus'), color: '§a' };
  }

  close() { this.game.screens.open(this.parent); }

  _row(gui, entry, x, y) {
    gui.text(gui.font.trimToWidth(entry.server, 210), x, y + 1, 0xffffff, false);
    const line = entry.account + '  §8' + maskedCommand(entry.command);
    gui.text(gui.font.trimToWidth(line, 210), x, y + 12, 0x808080, false);
  }

  renderContent(gui, mx, my) {
    const cx = this.width / 2, x = cx - 154;
    this.pingServer();
    this.list.render(gui, mx, my);
    gui.textCentered(tr('minecraftjs.autologin.title'), cx, 8, 0xffffff);
    const hint = this.status
      ? this.status.color + this.status.text
      : '§7' + tr('minecraftjs.autologin.hint');
    gui.textCentered(hint, cx, 20, 0xffffff);

    // Server card: favicon + MOTD from the ping, so a saved login is tied to the right server at a glance.
    gui.rect(x, 30, x + 308, 72, 0x66000000);
    this._drawServerIcon(gui, x + 2, 35);
    const name = this.selectedServer || tr('minecraftjs.autologin.noServer');
    gui.text('§f' + gui.font.trimToWidth(name, 236), x + 40, 34, 0xffffff, false);
    const st = this.server && this.server.status;
    if (this.server && this.server.pending) {
      gui.text('§8' + tr('minecraftjs.autologin.pinging'), x + 40, 46, 0x808080, false);
    } else if (this.server && this.server.error) {
      gui.text('§c' + gui.font.trimToWidth(this.server.error, 236), x + 40, 46, 0xff5555, false);
    } else if (st) {
      if (st.players) gui.text('§7' + st.players.online + '/' + st.players.max, x + 308 - gui.textWidth(st.players.online + '/' + st.players.max) - 4, 34, 0x808080, false);
      const motd = typeof st.description === 'string' ? st.description : chatToLegacy(st.description);
      const lines = gui.font.wrap(motd, 236);
      for (let i = 0; i < Math.min(2, lines.length); i++) gui.text(lines[i], x + 40, 46 + i * 9, 0x808080, false);
    }

    // Account row with its current PFP (same face as the account list).
    const acc = this.accountFor(this.selectedAccount);
    drawFace(gui, this.game, acc, x, 76, 12);
    gui.text('§7' + tr('minecraftjs.autologin.account', this.selectedAccount || '-'), x + 16, 78, 0xffffff);
    gui.text(tr('minecraftjs.autologin.command'), x, 90, 0xa0a0a0);
    if (!this.entries.length) gui.textCentered('§7' + tr('minecraftjs.autologin.empty'), cx, 166, 0xffffff);
    this.saveBtn.enabled = this.field.text.trim().length > 0 && !!this.selectedServer && !!this.selectedAccount;
    this.forgetBtn.enabled = this.entries.some((e) => entryKey(e) === this.selectedKey);
    this.currentBtn.enabled = this.selectedKey !== this.current.key;
  }

  _drawServerIcon(gui, x, y) {
    const st = this.server && this.server.status;
    const src = st && st.favicon;
    if (st && st.iconPixels && this._iconFor !== 'pixels:' + (this.selectedServer || '')) {
      this._iconFor = 'pixels:' + (this.selectedServer || '');
      try { this._icon = this.game.assets.makeTexture('autologin-favicon-pixels:' + this._iconFor, 64, 64, st.iconPixels, { filter: 'linear' }); }
      catch (e) { this._icon = null; }
    } else if (src && this._iconFor !== src) {
      this._iconFor = src;
      this._icon = null;
      try {
        const img = decodePng(decodeBase64(src.replace(/^data:image\/png;base64,/, '')));
        this._icon = this.game.assets.makeTexture('autologin-favicon:' + this._iconFor.length + ':' + (this.selectedServer || ''), img.width, img.height, img.data, { filter: 'linear' });
      } catch (e) { this._icon = null; }
    }
    if (this._icon) gui.drawImage(this._icon, 0, 0, this._icon.width, this._icon.height, x, y, 32, 32);
    else gui.blit('misc/unknown_server.png', x, y, 0, 0, 32, 32, 32, 32);
  }

  mouseDown(mx, my, button, e) { return super.mouseDown(mx, my, button) || this.list.mouseDown(mx, my, button, e); }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); this.list.mouseUp(); }
  mouseMove(mx, my) { this.list.mouseMove(mx, my); }
  wheel(d) { this.list.wheel(d); }
}

// Microsoft sign in with the OAuth device code flow
export class MicrosoftLoginScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
    this.state = 'starting';
    this.message = tr('minecraftjs.login.contacting');
    this.code = null;
    this.cancelled = false;
    this.begin();
  }

  async begin() {
    this.state = 'starting';
    this.message = tr('minecraftjs.login.contacting');
    try {
      this.code = await this.game.accounts.startDeviceLogin();
      if (this.cancelled) return;
      this.state = 'waiting';
      this.expires = Date.now() + this.code.expiresIn * 1000;
      this.poll();
    } catch (e) {
      this.fail(e.message);
    }
  }

  poll() {
    if (this.cancelled || this.state !== 'waiting') return;
    setTimeout(async () => {
      if (this.cancelled || this.state !== 'waiting') return;
      try {
        const acc = await this.game.accounts.pollDeviceLogin(this.code.deviceCode);
        if (this.cancelled) return;
        if (acc) {
          this.game.accounts.setActive(acc.id);
          this.state = 'done';
          this.message = '§a' + tr('minecraftjs.login.signedIn', acc.name);
          setTimeout(() => { if (!this.cancelled) this.game.screens.open(this.parent); }, 1200);
          return;
        }
        if (Date.now() > this.expires) { this.fail(tr('minecraftjs.login.expired')); return; }
        this.poll();
      } catch (e) {
        this.fail(e.message);
      }
    }, (this.code.interval || 5) * 1000);
  }

  fail(msg) { this.state = 'error'; this.message = '§c' + msg; }

  init() {
    const cx = this.width / 2, y = this.height / 2 + 40;
    this.openBtn = new Button(1, cx - 154, y, 150, 20, tr('minecraftjs.login.openLink'), () => this.code && platform().openUrl(this.code.verificationUri));
    this.copyBtn = new Button(2, cx + 4, y, 150, 20, tr('minecraftjs.login.copyCode'), () => { if (this.code) { platform().setClipboard(this.code.userCode); this.copied = true; } });
    this.retryBtn = new Button(3, cx - 154, y + 24, 150, 20, tr('minecraftjs.login.retry'), () => this.begin());
    this.buttons.push(this.openBtn, this.copyBtn, this.retryBtn);
    this.buttons.push(new Button(0, cx + 4, y + 24, 150, 20, tr('gui.cancel'), () => this.close()));
  }

  close() { this.cancelled = true; this.game.screens.open(this.parent); }

  renderContent(gui) {
    const cx = this.width / 2;
    const waiting = this.state === 'waiting';
    this.openBtn.enabled = this.copyBtn.enabled = waiting;
    this.retryBtn.enabled = this.state === 'error';
    gui.textCentered(tr('minecraftjs.login.title'), cx, 20, 0xffffff);
    if (waiting) {
      gui.textCentered(tr('minecraftjs.login.step1', '§b' + this.code.verificationUri + '§r'), cx, this.height / 2 - 60, 0xffffff);
      gui.textCentered(tr('minecraftjs.login.step2'), cx, this.height / 2 - 46, 0xffffff);
      gui.pushMatrix();
      gui.translate(cx, this.height / 2 - 28);
      gui.scaleBy(3, 3);
      gui.textCentered('§e' + this.code.userCode, 0, 0, 0xffffff);
      gui.popMatrix();
      const left = Math.max(0, Math.round((this.expires - Date.now()) / 1000));
      const dots = '.'.repeat(1 + Math.floor(Date.now() / 500) % 3);
      gui.textCentered('§7' + tr('minecraftjs.login.waiting') + dots + ' §8(' + Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0') + ')', cx, this.height / 2 + 4, 0xffffff);
      if (this.copied) gui.textCentered('§a' + tr('minecraftjs.login.copied'), cx, this.height / 2 + 18, 0xffffff);
    } else {
      gui.textCentered(this.message, cx, this.height / 2 - 20, 0xffffff);
    }
    gui.textCentered('§8' + tr('minecraftjs.login.privacy'), cx, this.height - 14, 0xffffff);
  }
}

export class OfflineAccountScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
  }

  init() {
    const cx = this.width / 2;
    this.nameField = new TextField(cx - 100, this.height / 2 - 20, 200, 20, { text: '', maxLength: 16, focused: true, filter: (c) => /[A-Za-z0-9_]/.test(c) });
    this.fields.push(this.nameField);
    this.doneBtn = new Button(1, cx - 154, this.height / 2 + 20, 150, 20, tr('minecraftjs.offline.add'), () => this.done());
    this.buttons.push(this.doneBtn);
    this.buttons.push(new Button(0, cx + 4, this.height / 2 + 20, 150, 20, tr('gui.cancel'), () => this.close()));
  }

  done() {
    const name = this.nameField.text.trim();
    if (name.length < 3) return;
    const a = this.game.accounts.addOffline(name);
    this.game.accounts.setActive(a.id);
    this.close();
  }

  close() { this.game.screens.open(this.parent); }

  key(e) {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { this.done(); return true; }
    return super.key(e);
  }

  renderContent(gui) {
    const cx = this.width / 2;
    this.doneBtn.enabled = this.nameField.text.trim().length >= 3;
    gui.textCentered(tr('minecraftjs.offline.title'), cx, 20, 0xffffff);
    gui.text(tr('minecraftjs.offline.username'), cx - 100, this.height / 2 - 32, 0xa0a0a0);
    gui.textCentered('§7' + tr('minecraftjs.offline.info'), cx, this.height / 2 + 50, 0xffffff);
  }
}
