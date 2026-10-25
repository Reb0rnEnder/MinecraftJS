// GuiEditSign
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button,TextField } from '../widgets.js';
import { C } from '../../net/packets.js';
import {getBlock} from '../../world/blocks.js';
import {signWood,signTextColor} from '../../game/signs-1.14.4.js';

export class SignEditScreen extends Screen {
  constructor(game, pos) {
    super(game);
    this.pos = pos;
    this.lines = game.tileRenderer.signs.get(`${pos.x},${pos.y},${pos.z}`)?.slice() || ['', '', '', ''];
    this.line = 0;
    this.counter = 0;
  }

  init() {
    this.buttons.push(new Button(0, this.width / 2 - 100, this.height / 4 + 120, 200, 20, tr('gui.done'), () => this.close()));
    this.fields=this.lines.map((text,i)=>new TextField(0,76+i*11,90,9,{text,maxLength:384,background:false,focused:i===this.line,validate:s=>this.gui.textWidth(s)<=90,onChange:s=>{this.lines[i]=s;}}));
  }

  tick() { this.counter++; super.tick(); }
  mouseDown(mx,my,button) {const handled=super.mouseDown(mx,my,button);const i=this.fields.findIndex(f=>f.focused);if(i>=0)this.line=i;return handled;}

  key(e) {
    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'Enter' || e.code === 'NumpadEnter') {
      this.line=(this.line+(e.code==='ArrowUp'?3:1))%4;this.fields.forEach((f,i)=>{f.focused=i===this.line;});return true;
    }
    if (e.code === 'Escape') { this.close(); return true; }
    return super.key(e);
  }

  char(c) {
    return super.char(c);
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
    const state=this.game.world.getState(this.pos.x,this.pos.y,this.pos.z),wood=signWood(getBlock(state).name);
    const tex = gui.tex('entity/signs/'+wood+'.png');
    if (tex) gui.drawImage(tex, 2 * tex.width / 64, 2 * tex.height / 32, 24 * tex.width / 64, 12 * tex.height / 32, x0, y0, w, h);
    else gui.rect(x0, y0, x0 + w, y0 + h, 0xff9c7c4c);
    for (let i = 0; i < 4; i++) {
      const f=this.fields[i];f.x=cx-gui.textWidth(f.text)/2;f.textColor=signTextColor(this.game.tileRenderer._get(this.pos.x,this.pos.y,this.pos.z)?.data?.Color);
    }
  }
}
