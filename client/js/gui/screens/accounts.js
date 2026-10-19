// Account manager screens: account list, Microsoft sign in (OAuth device code), offline names.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button, TextField } from '../widgets.js';
import { platform } from '../../platform/platform.js';
import { fetchSkin } from '../../net/proxies.js';
import { decodePng } from '../../util/png.js';

const ROW_H = 36;

// Skin face texture for an account (falls back to the default skins until loaded)
const faces = new Map();
export function accountFace(game, acc) {
  const fallback = acc && acc.slim ? 'entity/alex.png' : 'entity/steve.png';
  if (!acc || !acc.skinUrl) return fallback;
  const key = acc.skinUrl + '@' + game.assets.version;
  const cur = faces.get(key);
  if (cur) return cur.tex || fallback;
  const entry = { tex: null };
  faces.set(key, entry);
  fetchSkin(acc.skinUrl).then((bytes) => {
    if (!bytes) return;
    const img = decodePng(bytes);
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
    this.scroll = 0;
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

  renderContent(gui, mx, my) {
    const g = this.game;
    const top = 32, bottom = this.height - 64;
    const active = g.accounts.active();
    this.useBtn.enabled = !!this.list[this.selected] && this.list[this.selected] !== active;
    this.removeBtn.enabled = !!this.list[this.selected];
    gui.rect(0, top, this.width, bottom, 0xa0000000);
    gui.textCentered(tr('minecraftjs.accounts.title'), this.width / 2, 12, 0xffffff);
    const listX = this.width / 2 - 110;
    gui.scissor(0, top, this.width, bottom - top);
    this.list.forEach((a, i) => {
      const y = top + 4 + i * ROW_H - this.scroll;
      if (i === this.selected) {
        gui.rect(listX - 2, y - 2, listX + 220 + 2, y + ROW_H - 2, 0xff808080);
        gui.rect(listX - 1, y - 1, listX + 220 + 1, y + ROW_H - 3, 0xff000000);
      }
      drawFace(gui, g, a, listX, y, 32);
      gui.text(a.name + (a === active ? ' §a' + tr('minecraftjs.accounts.inUse') : ''), listX + 35, y + 1, 0xffffff);
      let line;
      if (a.type === 'microsoft') line = '§7' + tr(a.expiresAt > Date.now() ? 'minecraftjs.accounts.microsoft' : 'minecraftjs.accounts.microsoftRefresh');
      else line = '§7' + tr('minecraftjs.accounts.offline');
      gui.text(line, listX + 35, y + 12, 0x808080, false);
    });
    gui.clearScissor();
    void mx; void my;
  }

  mouseDown(mx, my, button) {
    if (super.mouseDown(mx, my, button)) return true;
    const top = 32, bottom = this.height - 64, listX = this.width / 2 - 110;
    if (my < top || my >= bottom || mx < listX - 2 || mx > listX + 222) return false;
    const i = Math.floor((my - top - 4 + this.scroll) / ROW_H);
    if (i >= 0 && i < this.list.length) {
      const now = platform().now();
      if (i === this.selected && now - (this.lastClick || 0) < 300) this.use();
      this.selected = i;
      this.lastClick = now;
      return true;
    }
    return false;
  }

  wheel(d) {
    const max = Math.max(0, this.list.length * ROW_H + 8 - (this.height - 96));
    this.scroll = Math.max(0, Math.min(max, this.scroll + d * 18));
  }
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
