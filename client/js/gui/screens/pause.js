// GuiIngameMenu
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button } from '../widgets.js';

export class PauseScreen extends Screen {
  constructor(game) {
    super(game);
  }

  init() {
    const g = this.game;
    const cx = this.width / 2, y = this.height / 4;
    this.buttons.push(new Button(4, cx - 100, y + 24 - 16, 200, 20, tr('menu.returnToGame'), () => this.close()));
    // 1.12: advancements replaced achievements
    this.buttons.push(new Button(5, cx - 100, y + 48 - 16, 98, 20, tr('gui.advancements'), () => g.openAdvancements(this)));
    this.buttons.push(new Button(6, cx + 2, y + 48 - 16, 98, 20, tr('gui.stats'), () => {
      import('./stats.js').then((m) => g.screens.open(new m.StatsScreen(g, this)));
    }));
    this.buttons.push(new Button(0, cx - 100, y + 96 - 16, 98, 20, tr('menu.options'), () => {
      import('./options.js').then((m) => g.screens.open(new m.OptionsScreen(g, this)));
    }));
    const lan = new Button(7, cx + 2, y + 96 - 16, 98, 20, tr('menu.shareToLan'));
    lan.enabled = false;
    this.buttons.push(lan);
    this.buttons.push(new Button(1, cx - 100, y + 120 - 16, 200, 20, tr('menu.disconnect'), () => g.disconnect(false)));
  }

  renderContent(gui) {
    gui.textCentered(tr('menu.game'), this.width / 2, 40, 0xffffff);
  }
}
