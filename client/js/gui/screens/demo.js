// GuiScreenDemo: the demo welcome screen a demo server opens (change game state 5, value 0)
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { platform } from '../../platform/platform.js';

export class DemoScreen extends Screen {
  init() {
    const cx = this.width / 2, y = this.height / 2 + 62 - 16;
    this.buttons.push(new Button(1, cx - 116, y, 114, 20, tr('demo.help.buy'), (b) => {
      b.enabled = false;
      platform().openUrl('http://www.minecraft.net/store?source=demo');
    }));
    this.buttons.push(new Button(2, cx + 2, y, 114, 20, tr('demo.help.later'), () => this.game.screens.close()));
  }

  render(gui, mx, my, partial) {
    gui.worldBackground();
    const x0 = Math.floor((this.width - 248) / 2), y0 = Math.floor((this.height - 166) / 2);
    gui.blit('gui/demo_background.png', x0, y0, 0, 0, 248, 166);
    const s = this.game.settings, key = (k) => s.keyName(s.keys[k]);
    const x = x0 + 10;
    let y = y0 + 8;
    gui.text(tr('demo.help.title'), x, y, 0x1f1f1f, false);
    y += 12;
    gui.text(tr('demo.help.movementShort', key('forward'), key('left'), key('back'), key('right')), x, y, 0x4f4f4f, false);
    gui.text(tr('demo.help.movementMouse'), x, y + 12, 0x4f4f4f, false);
    gui.text(tr('demo.help.jump', key('jump')), x, y + 24, 0x4f4f4f, false);
    gui.text(tr('demo.help.inventory', key('inventory')), x, y + 36, 0x4f4f4f, false);
    let yy = y + 68;
    for (const l of gui.font.wrap(tr('demo.help.fullWrapped'), 218)) { gui.text(l, x, yy, 0x1f1f1f, false); yy += 9; }
    for (const b of this.buttons) b.render(gui, mx, my);
  }
}
