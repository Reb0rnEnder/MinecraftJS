// 1.8 GuiCommandBlock: one screen for command blocks and command block minecarts (CommandBlockLogic). It shows the
// data the client already has (the block's update tile entity data, or the cart's synced command and last output) and
// Done sends MC|AdvCdm.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button, TextField } from '../widgets.js';
import { chatToPlain } from '../chat.js';
import { C } from '../../net/packets.js';
import { Writer } from '../../net/buffer.js';

// CommandBlockLogic.getLastOutput().getUnformattedText()
function lastOutput(json) {
  if (!json) return null;
  try { return chatToPlain(typeof json === 'string' ? JSON.parse(json) : json); } catch (e) { return String(e.message); }
}

export class CommandBlockScreen extends Screen {
  // target: { pos, data } for a block (data: its tile entity NBT) or { entity } for a minecart
  constructor(game, target) {
    super(game);
    this.target = target;
    this.trackOutput = true;
    this.output = null;
    if (target.entity) {
      const m = target.entity.metadata || {};
      this.command = String(m[23] || '');
      this.output = m[24] ? lastOutput(m[24]) : null;
    } else {
      const d = target.data || {};
      this.command = String(d.Command || '');
      if (d.TrackOutput !== undefined) this.trackOutput = !!d.TrackOutput;
      this.output = this.trackOutput && d.LastOutput !== undefined ? lastOutput(d.LastOutput) : null;
    }
  }

  init() {
    const cx = this.width / 2;
    const text = this.commandField ? this.commandField.text : this.command;
    this.doneBtn = new Button(0, cx - 4 - 150, this.height / 4 + 120 + 12, 150, 20, tr('gui.done'), () => this.done());
    this.cancelBtn = new Button(1, cx + 4, this.height / 4 + 120 + 12, 150, 20, tr('gui.cancel'), () => this.game.screens.close());
    this.outputBtn = new Button(4, cx + 150 - 20, 150, 20, 20, () => (this.trackOutput ? 'O' : 'X'), () => { this.trackOutput = !this.trackOutput; this.updateCmdOutput(); });
    this.buttons.push(this.doneBtn, this.cancelBtn, this.outputBtn);
    this.commandField = new TextField(cx - 150, 50, 300, 20, { text, maxLength: 32767, focused: true });
    this.outputField = new TextField(cx - 150, 150, 276, 20, { text: '-', maxLength: 32767 });
    this.outputField.enabled = false;
    this.fields.push(this.commandField, this.outputField);
    this.updateCmdOutput();
    this._updateDone();
  }

  _updateDone() { this.doneBtn.enabled = this.commandField.text.trim().length > 0; }

  updateCmdOutput() {
    if (this.trackOutput) { if (this.output !== null) this.outputField.setText(this.output); } else this.outputField.setText('-');
  }

  done() {
    const w = new Writer();
    const t = this.target;
    if (t.entity) w.i8(1).i32(t.entity.id); // func_145751_f (1: minecart), func_145757_a
    else w.i8(0).i32(t.pos.x).i32(t.pos.y).i32(t.pos.z);
    w.string(this.commandField.text).bool(this.trackOutput);
    this.game.send(C.customPayload('MC|AdvCdm', w.build()));
    this.game.screens.close();
  }

  key(e) {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (this.doneBtn.enabled) this.done(); return true; }
    if (e.code === 'Escape') { this.game.screens.close(); return true; }
    const r = this.commandField.key(e);
    this._updateDone();
    return r;
  }

  char(c) { const r = super.char(c); this._updateDone(); return r; }

  renderContent(gui) {
    const cx = this.width / 2;
    gui.textCentered(tr('advMode.setCommand'), cx, 20, 0xffffff, true);
    gui.text(tr('advMode.command'), cx - 150, 37, 0xa0a0a0, true);
    const lines = ['advMode.nearestPlayer', 'advMode.randomPlayer', 'advMode.allPlayers', 'advMode.allEntities'];
    lines.forEach((k, i) => gui.text(tr(k), cx - 150, 75 + i * 9, 0xa0a0a0, true));
    if (this.outputField.text) gui.text(tr('advMode.previousOutput'), cx - 150, 75 + 5 * 9 + 16, 0xa0a0a0, true);
  }
}
