import { ChatScreen } from './chat.js';
// GuiCommandBlock and GuiEditCommandBlockMinecart. The block screen opens with its buttons disabled and fills in when
// the server sends the block's data (update tile entity action 2, see Game.applyBlockEntity); the minecart screen
// reads the cart's synced command and last output. Done sends the dedicated block or minecart update packet.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button, TextField } from '../widgets.js';
import { chatToPlain } from '../chat.js';
import { C } from '../../net/packets.js';
import { getBlock,getStateProperties } from '../../world/blocks.js';

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
    this.completions?.onClose();
    this.completions = new ChatScreen(this.game, '', {commandOnly:true});
    this.completions.input = this.commandField;
    this.commandField.onChange = () => {if(!this.completions.applyingTab)this.completions.requestSuggestions();};
    this.requestSuggestions();
    this.commandField.formatter = (text,offset) => this.game.commands ? this.game.commands.format(text,offset,this.commandField.text,false) : text;

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

  render(gui,mx,my,partial) { super.render(gui,mx,my,partial);this.completions?.renderSuggestions(gui,mx,my); }
  key(e) {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (this.doneBtn.enabled) this.done(); return true; }
    if (e.code === 'Escape' && !this.completions.tabMatches) { this.cancel(); return true; }
    if(e.code==='Tab'||this.completions.tabMatches&&['ArrowUp','ArrowDown','Escape'].includes(e.code))return this.completions.key(e);
    const cursor=this.commandField.cursor,handled=this.commandField.key(e);
    if(cursor!==this.commandField.cursor)this.requestSuggestions();
    return handled;
  }
  requestSuggestions() { this.completions?.requestSuggestions(); }
  tabComplete() { this.completions.tabComplete(); }
  onTabComplete(packet) { this.completions?.onTabComplete(packet); }
  mouseDown(mx,my,button) {
    if(button===0){const row=this.completions?._suggestionRow(mx,my);if(row>=0){this.completions._selectTab(row);this.completions._applyTab();return true;}}
    const cursor=this.commandField.cursor,handled=super.mouseDown(mx,my,button);
    if(cursor!==this.commandField.cursor)this.requestSuggestions();
    return handled;
  }
  mouseMove(mx,my){this.completions?.mouseMove(mx,my);}
  wheel(delta){this.completions?.wheel(delta);}
  onClose(){this.completions?.onClose();}

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
    this.conditional = getStateProperties(state).conditional === 'true'; // BlockCommandBlock.CONDITIONAL
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
    if (b && MODES[b.name]) { this.mode = MODES[b.name]; this.conditional = getStateProperties(state).conditional === 'true'; }
    this.loaded = true;
    this.updateCmdOutput();
    this._enable(true);
  }

  done() {
    this.game.send(C.updateCommandBlock(this.pos,this.commandField.text,this.mode,this.trackOutput,this.conditional,this.automatic));
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
    this.command = String(entity.command ?? m[commandIndex] ?? '');
    const out = entity.lastOutput ?? m[outputIndex];
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
    this.game.send(C.updateCommandMinecart(this.entity.id,this.commandField.text,this.trackOutput));
    this.game.screens.close();
  }

  renderContent(gui) { this._drawLabels(gui, 20); }
}
