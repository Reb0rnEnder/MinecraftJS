// GuiWinGame: the end poem (texts/end.txt) and credits (texts/credits.txt) scrolling over a darkened dirt
// background, from the active resource packs or the vanilla jar. Esc or reaching the end respawns.
import { Screen } from './manager.js';
import { C } from '../../net/packets.js';
import { JavaRandom } from '../../util/jrandom.js';

const WIDTH = 274;
const SPEED = 0.5; // field_146578_s

export class CreditsScreen extends Screen {
  constructor(game) {
    super(game);
    this.background = 'none';
    this.time = 0; // field_146581_h, ticks
    this.lines = null;
    this.totalHeight = 0;
    this.isCredits = true; // MusicTicker plays music.game.end.credits while this is open
    this._load();
  }

  async _load() {
    const g = this.game, A = g.assets;
    const name = g.username || (g.accounts && g.accounts.active() && g.accounts.active().name) || 'Player';
    const font = g.gui.font;
    const lines = [];
    try {
      const end = await A.readText('texts/end.txt');
      // the scrambled bits: "§f§k§a§b" marks are replaced by 3-6 obfuscated X's (seeded like vanilla)
      const mark = '§f§k§a§b';
      const rnd = new JavaRandom(8124371);
      for (let s of (end || '').split(/\r?\n/)) {
        s = s.split('PLAYERNAME').join(name);
        while (s.includes(mark)) {
          const j = s.indexOf(mark);
          s = s.slice(0, j) + '§f§k' + 'XXXXXXXX'.slice(0, rnd.nextInt(4) + 3) + s.slice(j + mark.length);
        }
        lines.push(...font.wrap(s, WIDTH), '');
      }
      for (let k = 0; k < 8; k++) lines.push('');
      const credits = await A.readText('texts/credits.txt');
      for (let s of (credits || '').split(/\r?\n/)) {
        s = s.split('PLAYERNAME').join(name).split('\t').join('    ');
        lines.push(...font.wrap(s, WIDTH), '');
      }
    } catch (e) {
      console.error("Couldn't load credits", e);
    }
    this.lines = lines;
    this.totalHeight = lines.length * 12;
  }

  _end() { return (this.totalHeight + this.height + this.height + 24) / SPEED; }

  tick() {
    super.tick();
    if (!this.lines) return;
    this.time++;
    if (this.time > this._end()) this.respawn();
  }

  respawn() {
    if (this.done) return;
    this.done = true;
    this.game.send(C.clientCommand(0));
    this.game.screens.open(null);
  }

  key(e) {
    if (e.code === 'Escape') { this.respawn(); return true; }
    return true;
  }

  close() { this.respawn(); }

  render(gui, mx, my, partial) {
    const W = this.width, H = this.height;
    const t = this.time + partial;
    // drawWinGameScreen: scrolling options background, fading in and out
    const bg = this.game.assets.texture('gui/options_background.png', { wrap: 'repeat' });
    const f = 0 - t * 0.5 * SPEED, f1 = H - t * 0.5 * SPEED, f2 = 0.015625;
    let f3 = t * 0.02;
    const f5 = (this._end() - 20 - t) * 0.005;
    if (f5 < f3) f3 = f5;
    if (f3 > 1) f3 = 1;
    f3 = Math.max(0, f3 * f3) * 96 / 255;
    if (bg) gui.quad(bg, 0, 0, W, H, 0, f1 * f2, W * f2, f * f2, [f3, f3, f3, 1]);
    else gui.rect(0, 0, W, H, 0xff000000);
    if (!this.lines) return;
    const x = Math.floor(W / 2 - WIDTH / 2);
    const k = H + 50;
    const off = -t * SPEED;
    gui.pushMatrix();
    gui.translate(0, off);
    const logo = 'gui/title/minecraft.png';
    gui.blit(logo, x, k, 0, 0, 155, 44);
    gui.blit(logo, x + 155, k, 0, 45, 155, 44);
    let l = k + 200;
    for (let i = 0; i < this.lines.length; i++) {
      if (i === this.lines.length - 1) {
        // the last line stops in the middle of the screen
        const f1b = l + off - (Math.floor(H / 2) - 6);
        if (f1b < 0) gui.translate(0, -f1b);
      }
      if (l + off + 12 + 8 > 0 && l + off < H) {
        const s = this.lines[i];
        if (s.startsWith('[C]')) {
          const c = s.slice(3);
          gui.text(c, x + Math.floor((WIDTH - gui.textWidth(c)) / 2), l, 0xffffff, true);
        } else gui.text(s, x, l, 0xffffff, true);
      }
      l += 12;
    }
    gui.popMatrix();
    // vignette, blended (ZERO, ONE_MINUS_SRC_COLOR)
    const v = gui.tex('misc/vignette.png');
    if (v) {
      gui.setBlend('darken');
      gui.quad(v, 0, 0, W, H, 0, 0, 1, 1, [1, 1, 1, 1]);
      gui.setBlend('alpha');
    }
  }
}
