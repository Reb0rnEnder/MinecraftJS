// GuiCommandBlock and GuiEditCommandBlockMinecart. The block screen opens with its buttons disabled and fills in when
// the server sends the block's data (update tile entity action 2, see Game.applyBlockEntity); the minecart screen
// reads the cart's synced command and last output. Done sends MC|AutoCmd (blocks) or MC|AdvCmd (minecarts).
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button, TextField } from '../widgets.js';
import { chatToPlain } from '../chat.js';
import { C } from '../../net/packets.js';
import { Writer } from '../../net/buffer.js';
import { getBlock } from '../../world/blocks.js';

// TileEntityCommandBlock.getMode from the block, isConditional from its state
const MODES = { command_block: 'REDSTONE', repeating_command_block: 'AUTO', chain_command_block: 'SEQUENCE' };
export const COMMAND_BLOCKS = new Set(Object.keys(MODES));

// CommandBlockBaseLogic.getLastOutput().getUnformattedText(): LastOutput is only kept while the output is tracked
function lastOutput(json) {
  if (!json) return null;
  return chatToPlain(json);
}

class BaseCommandScreen extends Screen {
  constructor(game) {
    super(game);
    this.trackOutput = true;   // CommandBlockBaseLogic.trackOutput (true unless the data says otherwise)
    this.output = null;        // last output (unformatted) or null
    this.command = '';
  }

  _fields(outputY) {
    const cx = this.width / 2;
    const text = this.commandField ? this.commandField.text : this.command;
    this.commandField = new TextField(cx - 150, 50, 300, 20, { text, maxLength: 32500, focused: true });
    this.outputField = new TextField(cx - 150, outputY, 276, 20, { text: '-', maxLength: 32500 });
    this.outputField.enabled = false;
    this.fields.push(this.commandField, this.outputField);
    this.doneBtn = new Button(0, cx - 4 - 150, this.height / 4 + 120 + 12, 150, 20, tr('gui.done'), () => this.done());
    this.cancelBtn = new Button(1, cx + 4, this.height / 4 + 120 + 12, 150, 20, tr('gui.cancel'), () => this.cancel());
    this.outputBtn = new Button(4, cx + 150 - 20, outputY, 20, 20, () => (this.trackOutput ? 'O' : 'X'), () => { this.trackOutput = !this.trackOutput; this.updateCmdOutput(); });
    this.buttons.push(this.doneBtn, this.cancelBtn, this.outputBtn);
  }

  // updateCmdOutput: "O" shows the last output, "X" stops tracking it
  updateCmdOutput() {
    if (this.trackOutput) { if (this.output !== null) this.outputField.setText(this.output); } else this.outputField.setText('-');
  }

  // GuiCommandBlock.actionPerformed(cancel): Cancel only puts the output tracking back
  cancel() { this.game.screens.close(); }
  close() { this.cancel(); }

  key(e) {
    if (e.code === 'Tab') { this.tabComplete(); return true; }
    this.tabMatches = null;
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (this.doneBtn.enabled) this.done(); return true; }
    if (e.code === 'Escape') { this.cancel(); return true; }
    return this.commandField.key(e);
  }

  // TabCompleter(commandField, true): completes as a command, with the block's position as the target
  tabComplete() {
    const g = this.game, f = this.commandField;
    if (this.tabMatches && this.tabMatches.length) {
      this.tabIndex = (this.tabIndex + 1) % this.tabMatches.length;
      this._applyTab();
      return;
    }
    const text = f.text.slice(0, f.cursor);
    this.tabPrefixStart = text.lastIndexOf(' ') + 1;
    this.tabBase = f.text;
    this.waitingTab = true;
    g.send(C.tabComplete(text, this.targetPos(), true));
  }

  onTabComplete(matches) {
    if (!this.waitingTab) return;
    this.waitingTab = false;
    if (!matches.length) return;
    if (matches.length > 1) this.game.hud.addChat(matches.join(', '), null, true);
    this.tabMatches = matches;
    this.tabIndex = 0;
    this._applyTab();
  }

  _applyTab() { this.commandField.setText(this.tabBase.slice(0, this.tabPrefixStart) + this.tabMatches[this.tabIndex]); }

  // drawScreen: title, "Console Command", the selector help and "Previous Output"
  _drawLabels(gui, outputGap) {
    const cx = this.width / 2;
    gui.textCentered(tr('advMode.setCommand'), cx, 20, 0xffffff, true);
    gui.text(tr('advMode.command'), cx - 150, 40, 0xa0a0a0, true);
    const lines = ['advMode.nearestPlayer', 'advMode.randomPlayer', 'advMode.allPlayers', 'advMode.allEntities', 'advMode.self'];
    let y = 75;
    lines.forEach((k, i) => gui.text(tr(k), cx - 140, y + i * 9, 0xa0a0a0, true));
    if (this.outputField.text) gui.text(tr('advMode.previousOutput'), cx - 150, y + lines.length * 9 + outputGap, 0xa0a0a0, true);
  }
}

export class CommandBlockScreen extends BaseCommandScreen {
  constructor(game, pos) {
    super(game);
    this.pos = pos;
    this.loaded = false;
    const state = game.world.getState(pos.x, pos.y, pos.z);
    const b = getBlock(state);
    this.mode = (b && MODES[b.name]) || 'REDSTONE';
    this.conditional = (state & 8) !== 0; // BlockCommandBlock.CONDITIONAL
    this.automatic = false;
  }

  targetPos() { return this.pos; }

  init() {
    const cx = this.width / 2;
    this._fields(135);
    this.modeBtn = new Button(5, cx - 50 - 100 - 4, 165, 100, 20, () => tr({ SEQUENCE: 'advMode.mode.sequence', AUTO: 'advMode.mode.auto', REDSTONE: 'advMode.mode.redstone' }[this.mode]),
      () => { this.mode = { SEQUENCE: 'AUTO', AUTO: 'REDSTONE', REDSTONE: 'SEQUENCE' }[this.mode]; });
    this.conditionalBtn = new Button(6, cx - 50, 165, 100, 20, () => tr(this.conditional ? 'advMode.mode.conditional' : 'advMode.mode.unconditional'),
      () => { this.conditional = !this.conditional; });
    this.autoBtn = new Button(7, cx + 50 + 4, 165, 100, 20, () => tr(this.automatic ? 'advMode.mode.autoexec.bat' : 'advMode.mode.redstoneTriggered'),
      () => { this.automatic = !this.automatic; });
    this.buttons.push(this.modeBtn, this.conditionalBtn, this.autoBtn);
    if (this.loaded) this.updateCmdOutput();
    this._enable(this.loaded);
  }

  _enable(on) { for (const b of [this.doneBtn, this.outputBtn, this.modeBtn, this.conditionalBtn, this.autoBtn]) b.enabled = on; }

  // updateGui: the block's data arrived
  updateGui(data) {
    this.commandField.setText(String(data.Command || ''));
    if (data.TrackOutput !== undefined) this.trackOutput = !!data.TrackOutput;
    this.output = this.trackOutput && data.LastOutput !== undefined ? lastOutput(data.LastOutput) : null;
    this.automatic = !!data.auto;
    const state = this.game.world.getState(this.pos.x, this.pos.y, this.pos.z);
    const b = getBlock(state);
    if (b && MODES[b.name]) { this.mode = MODES[b.name]; this.conditional = (state & 8) !== 0; }
    this.loaded = true;
    this.updateCmdOutput();
    this._enable(true);
  }

  done() {
    const w = new Writer();
    w.i32(this.pos.x).i32(this.pos.y).i32(this.pos.z);
    w.string(this.commandField.text).bool(this.trackOutput).string(this.mode).bool(this.conditional).bool(this.automatic);
    this.game.send(C.customPayload('minecraft:command_block', w.build()));
    this.game.screens.close();
  }

  renderContent(gui) { this._drawLabels(gui, 1 + 4); }
}

// GuiEditCommandBlockMinecart
export class CommandMinecartScreen extends BaseCommandScreen {
  constructor(game, entity, commandIndex, outputIndex) {
    super(game);
    this.entity = entity;
    const m = entity.metadata || {};
    this.command = String(m[commandIndex] || '');
    const out = m[outputIndex];
    this.output = out ? lastOutput(out) : null;
  }

  targetPos() { const e = this.entity; return { x: Math.floor(e.x), y: Math.floor(e.y + 0.5), z: Math.floor(e.z) }; }

  init() {
    this._fields(150);
    this.updateCmdOutput();
    this.doneBtn.enabled = !!this.commandField.text.trim();
  }

  key(e) {
    const r = super.key(e);
    if (this.doneBtn) this.doneBtn.enabled = !!this.commandField.text.trim();
    return r;
  }
  char(c) {
    const r = super.char(c);
    this.doneBtn.enabled = !!this.commandField.text.trim();
    return r;
  }

  done() {
    const w = new Writer();
    w.i8(1).i32(this.entity.id); // getCommandBlockType (1: minecart), fillInInfo
    w.string(this.commandField.text).bool(this.trackOutput);
    this.game.send(C.customPayload('minecraft:command_block', w.build()));
    this.game.screens.close();
  }

  renderContent(gui) { this._drawLabels(gui, 20); }
}
