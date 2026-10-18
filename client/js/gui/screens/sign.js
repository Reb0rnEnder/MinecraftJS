// GuiEditSign
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { C } from '../../net/packets.js';

export class SignEditScreen extends Screen {
  constructor(game, pos) {
    super(game);
    this.pos = pos;
    this.lines = ['', '', '', ''];
    this.line = 0;
    this.counter = 0;
  }

  init() {
    this.buttons.push(new Button(0, this.width / 2 - 100, this.height / 4 + 120, 200, 20, tr('gui.done'), () => this.close()));
  }

  tick() { this.counter++; }

  key(e) {
    if (e.code === 'ArrowUp') { this.line = (this.line + 3) % 4; return true; }
    if (e.code === 'ArrowDown' || e.code === 'Enter' || e.code === 'NumpadEnter') { this.line = (this.line + 1) % 4; return true; }
    if (e.code === 'Backspace') { this.lines[this.line] = this.lines[this.line].slice(0, -1); return true; }
    if (e.code === 'Escape') { this.close(); return true; }
    return false;
  }

  char(c) {
    if (c < ' ' || c === '§') return false;
    const t = this.lines[this.line] + c;
    if (this.gui.textWidth(t) <= 90) this.lines[this.line] = t;
    return true;
  }

  onClose() {
    this.game.send(C.updateSign(this.pos.x, this.pos.y, this.pos.z, this.lines));
    this.game.tileRenderer.setSign(this.pos, this.lines.slice());
  }

  renderContent(gui) {
    gui.textCentered(tr('sign.edit') + ':', this.width / 2, 40, 0xffffff);
    // Sign board preview (vanilla renders the 3D sign; we draw the board texture)
    const cx = this.width / 2;
    const w = 104, h = 56, x0 = cx - w / 2, y0 = 70;
    const tex = gui.tex('entity/sign.png');
    if (tex) gui.drawImage(tex, 2 * tex.width / 64, 2 * tex.height / 32, 24 * tex.width / 64, 12 * tex.height / 32, x0, y0, w, h);
    else gui.rect(x0, y0, x0 + w, y0 + h, 0xff9c7c4c);
    for (let i = 0; i < 4; i++) {
      let s = this.lines[i];
      if (i === this.line && Math.floor(this.counter / 6) % 2 === 0) s = '> ' + s + ' <';
      gui.textCentered(s, cx, y0 + 6 + i * 11, 0x000000, false);
    }
  }
}
