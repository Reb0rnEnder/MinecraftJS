// GuiGameOver
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';
import { C } from '../../net/packets.js';

export class DeathScreen extends Screen {
  constructor(game, message) {
    super(game);
    this.message = message || '';
    this.background = 'none';
    this.enableTicks = 0;
  }

  init() {
    const g = this.game;
    const cx = this.width / 2;
    const hard = g.hardcore;
    this.respawn = new Button(0, cx - 100, this.height / 4 + 72, 200, 20, hard ? tr('minecraftjs.deathScreen.spectate') : tr('deathScreen.respawn'), () => {
      g.send(C.clientCommand(0));
      g.screens.close();
    });
    this.title = new Button(1, cx - 100, this.height / 4 + 96, 200, 20, tr('deathScreen.titleScreen'), () => g.disconnect(false));
    this.buttons.push(this.respawn, this.title);
    for (const b of this.buttons) b.enabled = false;
  }

  tick() {
    super.tick();
    this.enableTicks++;
    if (this.enableTicks === 20) for (const b of this.buttons) b.enabled = true;
  }

  render(gui, mx, my) {
    gui.gradient(0, 0, this.width, this.height, 0x60500000, 0xa0803030);
    gui.pushMatrix();
    gui.scaleBy(2, 2);
    gui.textCentered(this.game.hardcore ? tr('deathScreen.title.hardcore') : tr('deathScreen.title'), this.width / 2 / 2, 30, 0xffffff);
    gui.popMatrix();
    if (this.message) gui.textCentered(this.message, this.width / 2, 85, 0xffffff);
    gui.textCentered(tr('deathScreen.score') + ': §e' + (this.game.xpTotal || 0), this.width / 2, 100, 0xffffff);
    for (const b of this.buttons) b.render(gui, mx, my);
  }

  key(e) { return true; }
}
