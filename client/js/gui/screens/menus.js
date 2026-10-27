// Title, multiplayer, connecting, disconnected and loading screens.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button, TextField } from '../widgets.js';
import { chatToLegacy } from '../chat.js';
import { platform } from '../../platform/platform.js';
import { decodeBase64 } from '../../util/base64.js';
import { decodePng } from '../../util/png.js';
import { AccountsScreen, drawFace } from './accounts.js';
import { SlotList } from '../slot-list.js';
import { ProxiesScreen } from './proxies.js';
import { parseAddress, formatAddress } from '../../net/address.js';
import { ensureTested } from '../../net/proxies.js';
import { PROTOCOL_VERSION } from '../../net/packets.js';

export class TitleScreen extends Screen {
  constructor(game, reason) {
    super(game);
    this.background = 'none';
    this.panorama = true;
    this.splash = null;
    this.reason = reason;
    this.minceraftRoll = Math.random(); // GuiMainMenu: rolled once per title screen
  }

  init() {
    const g = this.game;
    g.updateWindowTitle?.();
    const splashes = g.assets.splashes;
    if (!this.splash && splashes && splashes.length) {
      const d = new Date();
      if (d.getMonth() === 11 && d.getDate() === 24) this.splash = 'Merry X-mas!';
      else if (d.getMonth() === 0 && d.getDate() === 1) this.splash = 'Happy new year!';
      else this.splash = splashes[Math.floor(Math.random() * splashes.length)];
    }
    const cx = Math.floor(this.width / 2);
    const y = this.height / 4 + 48;
    const sp = new Button(1, cx - 100, y, 200, 20, tr('menu.singleplayer'));
    sp.enabled = false;
    this.buttons.push(sp);
    this.buttons.push(new Button(2, cx - 100, y + 24, 200, 20, tr('menu.multiplayer'), () => openMultiplayer(g,this)));
    const realms = new Button(14, cx - 100, y + 48, 200, 20, tr('menu.online'));
    realms.enabled = false;
    this.buttons.push(realms);
    this.buttons.push(new Button(0, cx - 100, y + 72 + 12, 98, 20, tr('menu.options'), () => {
      import('./options.js').then((m) => g.screens.open(new m.OptionsScreen(g, this)));
    }));
    const quit = new Button(4, cx + 2, y + 72 + 12, 98, 20, tr('menu.quit'), () => { if (platform().quit) platform().quit(); });
    this.buttons.push(quit);
    // GuiButtonLanguage: 20x20 globe left of Options
    const lang = new Button(5, cx - 124, y + 72 + 12, 20, 20, '', () => {
      import('./options.js').then((m) => g.screens.open(new m.LanguageScreen(g, this)));
    });
    lang.render = (gui, mx, my) => gui.blit('gui/widgets.png', lang.x, lang.y, 0, lang.hovered(mx, my) ? 126 : 106, 20, 20);
    this.buttons.push(lang);
    const accessibility=new Button(6,cx+104,y+84,20,20,'',()=>import('./options.js').then(m=>g.screens.open(new m.AccessibilityScreen(g,this))));
    accessibility.narration=()=>tr('options.accessibility.title');
    accessibility.render=(gui,mx,my)=>gui.blit('gui/accessibility.png',accessibility.x,accessibility.y,0,accessibility.focused||accessibility.hovered(mx,my)?20:0,20,20,32,64);
    this.buttons.push(accessibility);
    // Account manager (top right): current account's face and name
    const acct = new Button(20, this.width - 104, 4, 100, 20, '', () => g.screens.open(new AccountsScreen(g, this)));
    acct.render = (gui, mx, my) => {
      const a = g.accounts.active();
      const hov = acct.hovered(mx, my);
      gui.button(acct.x, acct.y, acct.w, acct.h, '', hov);
      drawFace(gui, g, a, acct.x + 4, acct.y + 4, 12);
      const name = gui.font.trimToWidth(a.name, acct.w - 24);
      gui.text(name, acct.x + 20, acct.y + 6, hov ? 0xffffa0 : 0xe0e0e0, true);
    };
    this.buttons.push(acct);
    // Proxy servers (below the account button), the selected proxy's ping bars on the left (no proxy: failed bars)
    const prox = new Button(21, this.width - 104, 28, 100, 20, '', () => g.screens.open(new ProxiesScreen(g, this)));
    prox.render = (gui, mx, my) => {
      const p = g.proxies.current();
      const r = p ? ensureTested(p) : { error: 'none' };
      const hov = prox.hovered(mx, my);
      gui.button(prox.x, prox.y, prox.w, prox.h, '', hov);
      gui.textCentered(tr('minecraftjs.proxies.title'), prox.x + 14 + (prox.w - 14) / 2 - 2, prox.y + 6, hov ? 0xffffa0 : 0xe0e0e0, true);
      let k = 0, l, hover;
      if (r.pending) {
        k = 1;
        l = Math.floor(platform().now() / 100) & 7;
        if (l > 4) l = 8 - l;
        hover = 'Pinging...';
      } else if (r.error) {
        l = 5;
        hover = p ? '(no connection)' : tr('minecraftjs.proxies.noneShort');
      } else {
        l = r.ping < 150 ? 0 : r.ping < 300 ? 1 : r.ping < 600 ? 2 : r.ping < 1000 ? 3 : 4;
        hover = r.ping + 'ms';
      }
      gui.blit('gui/icons.png', prox.x + 4, prox.y + 6, k * 10, 176 + l * 8, 10, 8);
      if (hov) this.hoverText = p ? p.name + ': ' + hover : hover;
    };
    this.buttons.push(prox);
  }

  render(gui, mx, my, partial) {
    // Native TitleScreen overlay, shared with resource-pack replacements.
    const overlay=gui.tex('gui/title/background/panorama_overlay.png');
    if(overlay)gui.drawImage(overlay,0,0,overlay.width,overlay.height,0,0,this.width,this.height);
    const logo = 'gui/title/minecraft.png';
    const lx = this.width / 2 - 137, ly = 30;
    if (this.minceraftRoll < 1e-4) {
      // 1 in 10000: "Minceraft" (the "ec" pieces swapped)
      gui.blit(logo, lx, ly, 0, 0, 99, 44);
      gui.blit(logo, lx + 99, ly, 129, 0, 27, 44);
      gui.blit(logo, lx + 99 + 26, ly, 126, 0, 3, 44);
      gui.blit(logo, lx + 99 + 26 + 3, ly, 99, 0, 26, 44);
      gui.blit(logo, lx + 155, ly, 0, 45, 155, 44);
    } else {
      gui.blit(logo, lx, ly, 0, 0, 155, 44);
      gui.blit(logo, lx + 155, ly, 0, 45, 155, 44);
    }
    // 1.12 GuiMainMenu: the "Java Edition" banner under the logo (98x14 of a 128x16 texture)
    gui.blit('gui/title/edition.png', lx + 88, 67, 0, 0, 98, 14, 128, 16);
    if (this.splash) {
      gui.pushMatrix();
      gui.translate(this.width / 2 + 90, 70);
      gui.rotate(-20 * Math.PI / 180);
      let f = 1.8 - Math.abs(Math.sin((platform().now() % 1000) / 1000 * Math.PI * 2) * 0.1);
      f = f * 100 / (gui.textWidth(this.splash) + 32);
      gui.scaleBy(f, f);
      gui.textCentered(this.splash, 0, -8, 0xffff00, true);
      gui.popMatrix();
    }
    gui.text(tr('minecraftjs.version'), 2, this.height - 10, 0xffffff, true);
    // Where vanilla puts "Copyright Mojang AB. Do not distribute!"
    const legal = tr('minecraftjs.notAffiliated');
    gui.text(legal, this.width - gui.textWidth(legal) - 2, this.height - 10, 0xffffff, true);
    if (this.reason) gui.textCentered(this.reason, this.width / 2, this.height / 4 + 30, 0xff5555, true);
    this.hoverText = null;
    for (const b of this.buttons) b.render(gui, mx, my);
    if (this.hoverText) gui.tooltip([this.hoverText], mx, my);
  }

  key(e) { return false; }
}

// Java 1.15.2 SafetyScreen, using the target translations and checkbox sheet.
export function openMultiplayer(game,parent){game.screens.open(game.settings.skipMultiplayerWarning?new MultiplayerScreen(game,parent):new MultiplayerSafetyScreen(game,parent));}
export class MultiplayerSafetyScreen extends Screen {
 constructor(game,parent){super(game);this.parent=parent;this.background='dirt';this.skip=false;}
 init(){
  this.lines=this.gui.font.wrap(tr('multiplayerWarning.message'),this.width-50);const offset=(this.lines.length+1)*9,left=this.width/2-155;
  this.buttons.push(new Button(0,left,100+offset,150,20,tr('gui.proceed'),()=>{if(this.skip){this.game.settings.skipMultiplayerWarning=true;this.game.settings.save();}this.game.screens.open(new MultiplayerScreen(this.game,this.parent));}));
  this.buttons.push(new Button(1,left+160,100+offset,150,20,tr('gui.back'),()=>this.close()));
  const checkbox=new Button(2,left+80,76+offset,150,20,tr('multiplayerWarning.check'),()=>{this.skip=!this.skip;});
  checkbox.render=(gui)=>{gui.blit('gui/checkbox.png',checkbox.x,checkbox.y,0,this.skip?20:0,20,20,32,64);gui.text(tr('multiplayerWarning.check'),checkbox.x+24,checkbox.y+6,0xe0e0e0,true);};this.buttons.push(checkbox);
 }
 renderContent(gui){gui.textCentered('§l'+tr('multiplayerWarning.header'),this.width/2,30,0xffffff,true);this.lines.forEach((line,i)=>gui.textCentered(line,this.width/2,70+i*9,0xffffff,true));}
 close(){this.game.screens.open(this.parent);}
}

// GuiMultiplayer + ServerSelectionList (GuiListExtended) + ServerListEntryNormal / ServerListEntryLanScan
export class MultiplayerScreen extends Screen {
  constructor(game, parent) {
    super(game);
    this.parent = parent;
    this.background = 'dirt';
    this.selected = -1;
    this.pings = new Map();
    this.hoverText = null;
  }

  init() {
    const g = this.game;
    const cx = Math.floor(this.width / 2);
    this.servers = g.settings.servers;
    const prevScroll = this.list ? this.list.amountScrolled : 0;
    this.list = new ServerList(this);
    this.list.amountScrolled = prevScroll;
    this.joinBtn = new Button(1, cx - 154, this.height - 52, 100, 20, tr('selectServer.select'), () => this.join());
    this.buttons.push(this.joinBtn);
    this.buttons.push(new Button(4, cx - 50, this.height - 52, 100, 20, tr('selectServer.direct'), () => g.screens.open(new ServerEditScreen(g, this, null, true))));
    this.buttons.push(new Button(3, cx + 4 + 50, this.height - 52, 100, 20, tr('selectServer.add'), () => g.screens.open(new ServerEditScreen(g, this, null, false))));
    this.editBtn = new Button(7, cx - 154, this.height - 28, 70, 20, tr('selectServer.edit'), () => this.selected >= 0 && g.screens.open(new ServerEditScreen(g, this, this.selected, false)));
    this.buttons.push(this.editBtn);
    this.delBtn = new Button(2, cx - 74, this.height - 28, 70, 20, tr('selectServer.delete'), () => {
      const srv = this.servers[this.selected];
      if (!srv) return;
      g.screens.open(new ConfirmScreen(g, (yes) => {
        if (yes) { this.servers.splice(this.selected, 1); this.selected = -1; g.settings.save(); }
        g.screens.open(this);
      }, tr('selectServer.deleteQuestion'), "'" + srv.name + "' " + tr('selectServer.deleteWarning'), tr('selectServer.deleteButton'), tr('gui.cancel')));
    });
    this.buttons.push(this.delBtn);
    this.buttons.push(new Button(8, cx + 4, this.height - 28, 70, 20, tr('selectServer.refresh'), () => this.refresh()));
    this.buttons.push(new Button(0, cx + 4 + 76, this.height - 28, 75, 20, tr('gui.cancel'), () => g.screens.open(this.parent || null)));
  }

  refresh() { this.pings.clear(); }

  pingAll() {
    for (const srv of this.servers) {
      const key = srv.host + ':' + srv.port;
      if (this.pings.has(key)) continue;
      this.pings.set(key, { pending: true });
      import('../../net/connection.js').then(({ Connection }) => new Connection().ping(srv.host, srv.port)).then((r) => {
        this.pings.set(key, r.error ? { error: r.error } : { status: r.status });
      });
    }
  }

  select(i) {
    this.selected = i;
  }

  join() {
    const srv = this.servers[this.selected];
    if (!srv) return;
    this.game.settings.lastServer = { host: srv.host, port: srv.port };
    this.game.settings.save();
    this.game.connect(srv.host, srv.port);
  }

  // func_175391_a / func_175393_b: swap with the neighbour (shift: with the first / last server)
  moveUp(i, shift) {
    const j = shift ? 0 : i - 1;
    this._swap(i, j);
  }
  moveDown(i, shift) {
    const j = shift ? this.servers.length - 1 : i + 1;
    this._swap(i, j);
  }
  _swap(i, j) {
    if (i === j || j < 0 || j >= this.servers.length) return;
    const s = this.servers;
    [s[i], s[j]] = [s[j], s[i]];
    if (this.selected === i) this.selected = j;
    this.game.settings.save();
  }

  render(gui, mx, my, partial) {
    this.pingAll();
    this.hoverText = null;
    const ok = this.selected >= 0 && this.selected < this.servers.length;
    this.joinBtn.enabled = this.editBtn.enabled = this.delBtn.enabled = ok;
    gui.dirtBackground();
    this.list.render(gui, mx, my);
    gui.textCentered(tr('multiplayer.title'), this.width / 2, 20, 0xffffff, true);
    for (const b of this.buttons) b.render(gui, mx, my);
    if (this.hoverText) gui.tooltip(this.hoverText.split('\n'), mx, my);
  }

  mouseDown(mx, my, button, e) {
    if (super.mouseDown(mx, my, button)) return true;
    return this.list.mouseDown(mx, my, button, e);
  }
  mouseUp(mx, my, button) { super.mouseUp(mx, my, button); this.list.mouseUp(); }
  mouseMove(mx, my) { this.list.mouseMove(mx, my); }
  wheel(d) { this.list.wheel(d); }

  key(e) {
    const n = this.servers.length;
    if (e.code === 'F5') { this.refresh(); return true; }
    if (this.selected >= 0) {
      const i = this.selected;
      if (e.code === 'ArrowUp') {
        if (e.shift) { if (i > 0) { this._swap(i, i - 1); this.list.amountScrolled -= this.list.slotHeight; } }
        else if (i > 0) { this.select(i - 1); this.list.amountScrolled -= this.list.slotHeight; }
        else this.select(-1);
        return true;
      }
      if (e.code === 'ArrowDown') {
        if (e.shift) { if (i < n - 1) { this._swap(i, i + 1); this.list.amountScrolled += this.list.slotHeight; } }
        else if (i < n - 1) { this.select(i + 1); this.list.amountScrolled += this.list.slotHeight; }
        else this.select(-1);
        return true;
      }
      if (e.code === 'Enter' || e.code === 'NumpadEnter') { this.join(); return true; }
    }
    return super.key(e);
  }

  close() { this.game.screens.open(this.parent || new TitleScreen(this.game)); }
}

class ServerList extends SlotList {
  constructor(screen) {
    super(screen, 32, screen.height - 64, 36, { listWidth: 220 + 85, scrollBarOffset: 30 });
  }
  size() { return this.screen.servers.length + 1; } // + the LAN scan row
  isSelected(i) { return i === this.screen.selected; }

  drawSlot(gui, i, x, y, h, mx, my) {
    const s = this.screen;
    if (i >= s.servers.length) { this._drawLanScan(gui, y, h); return; }
    const srv = s.servers[i];
    const key = srv.host + ':' + srv.port;
    const pr = s.pings.get(key);
    const g = s.game, lw = this.listWidth;
    let motd = '§8' + tr('minecraftjs.multiplayer.pinging');
    let population = '', playerList = null, ms = -2, version = null;
    if (pr && pr.status) {
      const st = pr.status;
      // The status response has already been JSON-decoded. A string description
      // is literal text, even if it looks like another serialized component.
      motd = chatToLegacy(st.description, { parsed: true });
      population = st.players ? `§7${st.players.online}§8/§7${st.players.max}` : '';
      if (st.players && st.players.sample && st.players.sample.length) playerList = st.players.sample.map((p) => p.name).join('\n');
      ms = st.ping;
      if (st.version && st.version.protocol !== PROTOCOL_VERSION) version = st.version;
      if (st.favicon && srv._iconSrc !== st.favicon) srv._iconSrc = st.favicon;
      if (st.iconPixels && srv._iconPx !== st.iconPixels) {
        srv._iconPx = st.iconPixels;
        srv._icon = g.assets.makeTexture('favicon:' + key, 64, 64, st.iconPixels, { filter: 'linear' });
      }
    } else if (pr && pr.error) {
      motd = '§4' + tr('minecraftjs.multiplayer.cantConnect');
      ms = -1;
    }
    gui.text(srv.name, x + 32 + 3, y + 1, 0xffffff, false);
    const lines = gui.font.wrap(motd, lw - 32 - 2);
    for (let l = 0; l < Math.min(2, lines.length); l++) gui.text(lines[l], x + 32 + 3, y + 12 + 9 * l, 0x808080, false);
    const right = version ? '§4' + (version.name || '') : population;
    const rw = gui.textWidth(right);
    gui.text(right, x + lw - rw - 15 - 2, y + 1, 0x808080, false);
    let k = 0, l, hover, hoverPlayers = null;
    if (version) {
      l = 5; hover = version.protocol > PROTOCOL_VERSION ? 'Client out of date!' : 'Server out of date!'; hoverPlayers = playerList;
    } else if (pr && !pr.pending && ms !== -2) {
      l = ms < 0 ? 5 : ms < 150 ? 0 : ms < 300 ? 1 : ms < 600 ? 2 : ms < 1000 ? 3 : 4;
      if (ms < 0) hover = '(no connection)';
      else { hover = ms + 'ms'; hoverPlayers = playerList; }
    } else {
      k = 1;
      l = (Math.floor(platform().now() / 100) + i * 2) & 7;
      if (l > 4) l = 8 - l;
      hover = 'Pinging...';
    }
    gui.blit('gui/icons.png', x + lw - 15, y, k * 10, 176 + l * 8, 10, 8);
    // server icon (favicon, decoded once per change)
    if (srv._iconSrc && srv._iconFor !== srv._iconSrc && !srv._iconPx) {
      srv._iconFor = srv._iconSrc;
      try {
        const img = decodePng(decodeBase64(srv._iconSrc.replace(/^data:image\/png;base64,/, '')));
        srv._icon = g.assets.makeTexture('favicon:' + key + ':' + srv._iconSrc.length, img.width, img.height, img.data, { filter: 'linear' });
      } catch (e) { srv._icon = null; }
    }
    if (srv._icon) gui.drawImage(srv._icon, 0, 0, srv._icon.width, srv._icon.height, x, y, 32, 32);
    else gui.blit('misc/unknown_server.png', x, y, 0, 0, 32, 32, 32, 32);
    const rx = mx - x, ry = my - y;
    if (my >= this.top && my <= this.bottom) {
      if (rx >= lw - 15 && rx <= lw - 5 && ry >= 0 && ry <= 8) s.hoverText = hover;
      else if (rx >= lw - rw - 15 - 2 && rx <= lw - 15 - 2 && ry >= 0 && ry <= 8) s.hoverText = hoverPlayers;
    }
    // Join / move arrows over the icon: GuiListExtended passes "mouse is over this entry" as isSelected
    if (g.settings.touchscreen || this.slotAt(mx, my) === i) {
      const SEL = 'gui/server_selection.png';
      gui.rect(x, y, x + 32, y + 32, 0xa0909090);
      const over = my >= this.top && my <= this.bottom;
      gui.blit(SEL, x, y, 0, over && rx < 32 && rx > 16 && ry >= 0 && ry < 32 ? 32 : 0, 32, 32);
      if (i > 0) gui.blit(SEL, x, y, 96, over && rx >= 0 && rx < 16 && ry >= 0 && ry < 16 ? 32 : 0, 32, 32);
      if (i < s.servers.length - 1) gui.blit(SEL, x, y, 64, over && rx >= 0 && rx < 16 && ry > 16 && ry < 32 ? 32 : 0, 32, 32);
    }
  }

  _drawLanScan(gui, y, h) {
    const s = this.screen;
    const ty = y + h / 2 - 9 / 2;
    const t = tr('lanServer.scanning');
    gui.text(t, s.width / 2 - gui.textWidth(t) / 2, ty, 0xffffff, false);
    const dots = ['O o o', 'o O o', 'o o O', 'o O o'][Math.floor(platform().now() / 300) % 4];
    gui.text(dots, s.width / 2 - gui.textWidth(dots) / 2, ty + 9, 0x808080, false);
  }

  // ServerListEntryNormal.mousePressed
  clicked(i, dbl, mx, my, rx, ry, e) {
    const s = this.screen;
    if (i >= s.servers.length) { s.select(-1); return; }
    const shift = !!(e && e.shift);
    if (rx <= 32) {
      if (rx < 32 && rx > 16) { s.select(i); s.join(); return; }
      if (rx < 16 && ry < 16 && i > 0) { s.moveUp(i, shift); return; }
      if (rx < 16 && ry > 16 && i < s.servers.length - 1) { s.moveDown(i, shift); return; }
    }
    s.select(i);
    if (dbl) s.join();
  }
}

// GuiYesNo
export class ConfirmScreen extends Screen {
  constructor(game, callback, line1, line2, yes = tr('gui.yes'), no = tr('gui.no')) {
    super(game);
    this.background = game.inWorld ? 'world' : 'dirt';
    this.callback = callback;
    this.line1 = line1; this.line2 = line2; this.yes = yes; this.no = no;
  }
  init() {
    this.buttons.push(new Button(0, this.width / 2 - 155, this.height / 6 + 96, 150, 20, this.yes, () => this.callback(true)));
    this.buttons.push(new Button(1, this.width / 2 - 155 + 160, this.height / 6 + 96, 150, 20, this.no, () => this.callback(false)));
  }
  renderContent(gui) {
    gui.textCentered(this.line1, this.width / 2, 70, 0xffffff, true);
    let y = 90;
    for (const l of gui.font.wrap(this.line2 || '', this.width - 50)) { gui.textCentered(l, this.width / 2, y, 0xffffff, true); y += 9; }
  }
  close() { this.callback(false); }
}

export class ServerEditScreen extends Screen {
  constructor(game, parent, index, direct) {
    super(game);
    this.parent = parent;
    this.index = index;
    this.direct = direct;
    this.background = 'dirt';
  }

  init() {
    const g = this.game;
    const cx = Math.floor(this.width / 2);
    const srv = this.index !== null ? g.settings.servers[this.index] : null;
    const last = g.settings.lastServer;
    if (!this.direct) {
      this.nameField = new TextField(cx - 100, 66, 200, 20, { text: srv ? srv.name : tr('selectServer.defaultName'), maxLength: 32, focused: true });
      this.fields.push(this.nameField);
    }
    const addr = srv ? formatAddress(srv.host, srv.port) : (this.direct && last ? formatAddress(last.host, last.port) : '');
    this.addrField = new TextField(cx - 100, this.direct ? 116 : 106, 200, 20, { text: addr, maxLength: 256, focused: this.direct, onEnter: () => this.done() });
    this.fields.push(this.addrField);
    // GuiScreenAddServer: "Server Resource Packs: Enabled / Disabled / Prompt" (ServerData.ServerResourceMode order)
    if (!this.direct) {
      if (!this.resourceMode) this.resourceMode = (srv && srv.resourceMode) || 'prompt';
      this.buttons.push(new Button(2, cx - 100, this.height / 4 + 72, 200, 20, () => tr('addServer.resourcePack') + ': ' + tr('addServer.resourcePack.' + this.resourceMode), () => {
        const modes = ['enabled', 'disabled', 'prompt'];
        this.resourceMode = modes[(modes.indexOf(this.resourceMode) + 1) % modes.length];
      }));
    }
    this.doneBtn = new Button(0, cx - 100, this.height / 4 + 96 + (this.direct ? 12 : 18), 200, 20, this.direct ? tr('selectServer.select') : tr('addServer.add'), () => this.done());
    this.buttons.push(this.doneBtn);
    this.buttons.push(new Button(1, cx - 100, this.height / 4 + 120 + (this.direct ? 12 : 18), 200, 20, tr('gui.cancel'), () => g.screens.open(this.parent)));
  }

  // Vanilla "host[:port]", or an Eaglercraft ws:// / wss:// address (stored as typed, port 0)
  parse() {
    const a = parseAddress(this.addrField.text);
    if (!a) return null;
    return a.kind === 'eagler' ? { host: this.addrField.text.trim(), port: 0 } : { host: a.host, port: a.port };
  }

  done() {
    const a = this.parse();
    if (!a) return;
    const g = this.game;
    if (this.direct) {
      g.settings.lastServer = a;
      g.settings.save();
      g.connect(a.host, a.port);
      return;
    }
    const entry = { name: this.nameField.text || tr('selectServer.defaultName'), host: a.host, port: a.port, resourceMode: this.resourceMode };
    if (this.index !== null) g.settings.servers[this.index] = entry; else g.settings.servers.push(entry);
    g.settings.save();
    this.parent.pings.clear();
    g.screens.open(this.parent);
  }

  renderContent(gui) {
    this.doneBtn.enabled = !!this.parse();
    gui.textCentered(this.direct ? tr('selectServer.direct') : tr('addServer.title'), this.width / 2, this.direct ? 20 : 17, 0xffffff);
    if (!this.direct) gui.text(tr('addServer.enterName'), this.width / 2 - 100, 53, 0xa0a0a0);
    gui.text(tr('addServer.enterIp'), this.width / 2 - 100, this.direct ? 100 : 94, 0xa0a0a0);
    const a = parseAddress(this.addrField.text);
    if (a && a.kind === 'eagler') gui.text('§8' + gui.font.trimToWidth(tr('minecraftjs.multiplayer.eagler') + ' ' + a.url, 200), this.width / 2 - 100, (this.direct ? 116 : 106) + 24, 0x808080, false);
  }

  close() { this.game.screens.open(this.parent); }
}

export class ConnectingScreen extends Screen {
  constructor(game, host, port) {
    super(game);
    this.background = 'dirt';
    this.status = tr('connect.connecting');
    this.host = host; this.port = port;
  }
  init() {
    this.buttons.push(new Button(0, this.width / 2 - 100, this.height / 4 + 120 + 12, 200, 20, tr('gui.cancel'), () => this.game.disconnect()));
  }
  renderContent(gui) {
    gui.textCentered(this.status, this.width / 2, this.height / 2 - 50, 0xffffff);
  }
  key(e) { if (e.code === 'Escape') this.game.disconnect(); return true; }
}

export class DisconnectedScreen extends Screen {
  constructor(game, title, reason) {
    super(game);
    this.background = 'dirt';
    this.title = title;
    this.reason = reason || '';
  }
  init() {
    this.lines = this.gui.font.wrap(this.reason, this.width - 50);
    const h = this.lines.length * 9;
    this.buttons.push(new Button(0, this.width / 2 - 100, this.height / 2 + h / 2 + 9, 200, 20, tr('gui.toMenu'), () => {
      this.game.screens.open(new MultiplayerScreen(this.game, new TitleScreen(this.game)));
    }));
  }
  renderContent(gui) {
    const h = this.lines.length * 9;
    gui.textCentered(this.title, this.width / 2, this.height / 2 - h / 2 - 9 * 2, 0xaaaaaa);
    let y = this.height / 2 - h / 2;
    for (const l of this.lines) { gui.textCentered(l, this.width / 2, y, 0xffffff); y += 9; }
  }
  key(e) { return true; }
}

export class DownloadingTerrainScreen extends Screen {
  constructor(game) {
    super(game);
    this.background = 'dirt';
    this.terrainReady = false;
    this.ticks = 0;
  }
  tick() {
    this.ticks++;
    const g = this.game;
    if (this.terrainReady) {
      // Wait until the chunk the player stands in exists (vanilla closes as soon as position is received)
      const loaded = g.world.isLoaded(Math.floor(g.player.x), Math.floor(g.player.z));
      if (loaded || this.ticks > 200) g.screens.close();
    }
  }
  renderContent(gui) {
    gui.textCentered(tr('multiplayer.downloadingTerrain'), this.width / 2, this.height / 2 - 50, 0xffffff);
  }
  key(e) { return true; }
}
