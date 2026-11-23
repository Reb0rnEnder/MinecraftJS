import {ConfirmLinkScreen} from './chat.js';
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
    // PauseScreen.createPauseMenu: 2-column GridLayout, cell padding 4/4/4/0, 50px above the
    // first row, aligned by FrameLayout.alignInRectangle(..., 0.5, 0.25).
    const gridW = 212, gridH = 70 + 4 * 24; // first row's 50px top padding replaces the default 4
    const left = Math.floor((this.width - gridW) * .5) + 4, top = Math.floor((this.height - gridH) * .25) + 50;
    const row = (i) => top + i * 24, col = (i) => left + i * 106;
    this.buttons.push(new Button(4, col(0), row(0), 204, 20, tr('menu.returnToGame'), () => this.close()));
    this.buttons.push(new Button(5, col(0), row(1), 98, 20, tr('gui.advancements'), () => g.openAdvancements(this)));
    this.buttons.push(new Button(6, col(1), row(1), 98, 20, tr('gui.stats'), () => {
      import('./stats.js').then((m) => g.screens.open(new m.StatsScreen(g, this)));
    }));
    this.buttons.push(new Button(12,col(0),row(2),98,20,tr('menu.sendFeedback'),()=>g.screens.open(new ConfirmLinkScreen(g,this,'https://aka.ms/javafeedback?ref=game',true))));
    this.buttons.push(new Button(13,col(1),row(2),98,20,tr('menu.reportBugs'),()=>g.screens.open(new ConfirmLinkScreen(g,this,'https://aka.ms/snapshotbugs?ref=game',true))));
    this.buttons.push(new Button(0, col(0), row(3), 98, 20, tr('menu.options'), () => {
      import('./options.js').then((m) => g.screens.open(new m.OptionsScreen(g, this)));
    }));
    // Remote servers (the only kind this client joins) get Player Reporting instead of Open to LAN.
    this.buttons.push(new Button(7, col(1), row(3), 98, 20, tr('menu.playerReporting'), () => {
      import('./social.js').then((m) => { const s = new m.SocialInteractionsScreen(g); s.close = () => g.screens.open(this); g.screens.open(s); });
    }));
    this.buttons.push(new Button(1, col(0), row(4), 204, 20, tr('menu.disconnect'), () => g.disconnect(false)));
  }

  renderContent(gui) {
    gui.textCentered(tr('menu.game'), Math.floor(this.width / 2), 40, 0xffffff);
  }
}

// F3+Escape releases input without drawing the pause menu. Remote servers keep ticking.
export class InvisiblePauseScreen extends Screen {
  constructor(game){super(game);this.background='none';}
  render(){}
}
