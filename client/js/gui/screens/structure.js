// GuiEditStructure: the structure block screen (Save / Load / Corner / Data modes). It starts from the block's data the
// client already has (structure blocks send their full NBT with the chunk and on every change) and sends the dedicated structure update packet:
// action 1 update, 2 save, 3 load, 4 detect size.
import { tr } from '../i18n.js';
import { Screen } from './manager.js';
import { Button, TextField } from '../widgets.js';
import { C } from '../../net/packets.js';

const MODES = ['SAVE', 'LOAD', 'CORNER', 'DATA'];
const ROTATIONS = ['NONE', 'CLOCKWISE_90', 'CLOCKWISE_180', 'COUNTERCLOCKWISE_90'];
const MIRRORS = ['NONE', 'LEFT_RIGHT', 'FRONT_BACK'];
const MIRROR_LABELS = { NONE: '|', LEFT_RIGHT: '< >', FRONT_BACK: '^ v' };
// ChatAllowedCharacters.ILLEGAL_STRUCTURE_CHARACTERS
const ILLEGAL = new Set(['.', '\n', '\r', '\t', '\0', '\f', '`', '?', '*', '\\', '<', '>', '|', '"']);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v | 0));
const pick = (v, list, def) => (list.includes(v) ? v : def);

// DecimalFormat("0.0###")
function formatIntegrity(f) {
  let s = Number(f).toFixed(4).replace(/0+$/, '');
  if (s.endsWith('.')) s += '0';
  return s;
}

// Integer.parseInt / Float.valueOf / Long.valueOf, with vanilla's fallbacks
function parseIntJava(s) { return /^[+-]?\d+$/.test(s) && Math.abs(Number(s)) <= 2147483647 ? Number(s) : 0; }
function parseFloatJava(s) { const t = s.trim(); return /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[fFdD]?$/.test(t) ? Math.fround(parseFloat(t)) : 1; }
function parseLongJava(s) {
  if (!/^[+-]?\d+$/.test(s)) return 0n;
  const v = BigInt(s);
  return v >= -(2n ** 63n) && v < 2n ** 63n ? v : 0n;
}

export class StructureBlockScreen extends Screen {
  constructor(game, pos, data) {
    super(game);
    this.pos = pos;
    const d = data || {};
    // TileEntityStructure.readFromNBT
    this.tile = {
      name: String(d.name || ''),
      metadata: String(d.metadata || ''),
      posX: clamp(d.posX, -32, 32), posY: clamp(d.posY, -32, 32), posZ: clamp(d.posZ, -32, 32),
      sizeX: clamp(d.sizeX, 0, 32), sizeY: clamp(d.sizeY, 0, 32), sizeZ: clamp(d.sizeZ, 0, 32),
      rotation: pick(d.rotation, ROTATIONS, 'NONE'),
      mirror: pick(d.mirror, MIRRORS, 'NONE'),
      mode: pick(d.mode, MODES, 'DATA'),
      ignoreEntities: !!d.ignoreEntities,
      showAir: !!d.showair,
      showBoundingBox: !!d.showboundingbox,
      integrity: d.integrity !== undefined ? Number(d.integrity) : 1,
      seed: d.seed !== undefined ? BigInt(d.seed) : 0n,
    };
    this.saved = null;
  }

  init() {
    const t = this.tile, cx = this.width / 2;
    const prev = this.edits;
    const field = (key, x, y, w, max, text) => {
      const f = new TextField(x, y, w, 20, { text: prev ? prev[key].text : text, maxLength: max });
      return f;
    };
    // The text boxes, in tab order
    this.edits = {
      name: field('name', cx - 152, 40, 300, 64, t.name),
      posX: field('posX', cx - 152, 80, 80, 15, String(t.posX)),
      posY: field('posY', cx - 72, 80, 80, 15, String(t.posY)),
      posZ: field('posZ', cx + 8, 80, 80, 15, String(t.posZ)),
      sizeX: field('sizeX', cx - 152, 120, 80, 15, String(t.sizeX)),
      sizeY: field('sizeY', cx - 72, 120, 80, 15, String(t.sizeY)),
      sizeZ: field('sizeZ', cx + 8, 120, 80, 15, String(t.sizeZ)),
      integrity: field('integrity', cx - 152, 120, 80, 15, formatIntegrity(t.integrity)),
      seed: field('seed', cx - 72, 120, 80, 31, t.seed.toString()),
      data: field('data', cx - 152, 120, 240, 128, t.metadata),
    };
    this.edits.name.filter = (c) => !ILLEGAL.has(c); // isValidCharacterForName
    this.tabOrder = Object.values(this.edits);
    // GuiEditStructure.actionPerformed(cancel) puts these back
    if (!this.saved) this.saved = { mirror: t.mirror, rotation: t.rotation, mode: t.mode, ignoreEntities: t.ignoreEntities, showAir: t.showAir, showBoundingBox: t.showBoundingBox };

    const on = (v) => tr(v ? 'options.on' : 'options.off');
    const b = (id, x, y, w, label, fn) => { const btn = new Button(id, x, y, w, 20, label, fn); this.buttons.push(btn); return btn; };
    this.doneButton = b(0, cx - 4 - 150, 210, 150, tr('gui.done'), () => { if (this.send(1)) this.game.screens.close(); });
    this.cancelButton = b(1, cx + 4, 210, 150, tr('gui.cancel'), () => this.cancel());
    this.saveButton = b(9, cx + 4 + 100, 185, 50, tr('structure_block.button.save'), () => { if (t.mode === 'SAVE') { this.send(2); this.game.screens.close(); } });
    this.loadButton = b(10, cx + 4 + 100, 185, 50, tr('structure_block.button.load'), () => { if (t.mode === 'LOAD') { this.send(3); this.game.screens.close(); } });
    this.modeButton = b(18, cx - 4 - 150, 185, 50, () => tr('structure_block.mode.' + t.mode.toLowerCase()), () => {
      t.mode = MODES[(MODES.indexOf(t.mode) + 1) % MODES.length];
      this.updateMode();
    });
    this.detectSizeButton = b(19, cx + 4 + 100, 120, 50, tr('structure_block.button.detect_size'), () => { if (t.mode === 'SAVE') { this.send(4); this.game.screens.close(); } });
    this.showEntitiesButton = b(20, cx + 4 + 100, 160, 50, () => on(!t.ignoreEntities), () => { t.ignoreEntities = !t.ignoreEntities; });
    this.mirrorButton = b(21, cx - 20, 185, 40, () => MIRROR_LABELS[t.mirror], () => { t.mirror = MIRRORS[(MIRRORS.indexOf(t.mirror) + 1) % MIRRORS.length]; });
    this.showAirButton = b(22, cx + 4 + 100, 80, 50, () => on(t.showAir), () => { t.showAir = !t.showAir; });
    this.showBoundingBoxButton = b(23, cx + 4 + 100, 80, 50, () => on(t.showBoundingBox), () => { t.showBoundingBox = !t.showBoundingBox; });
    const rot = (id, x, label, r) => b(id, x, 185, 40, label, () => { t.rotation = r; this.updateDirectionButtons(); });
    this.rotateButtons = [
      rot(11, cx - 1 - 40 - 1 - 40 - 20, '0', 'NONE'),
      rot(12, cx - 1 - 40 - 20, '90', 'CLOCKWISE_90'),
      rot(13, cx + 1 + 20, '180', 'CLOCKWISE_180'),
      rot(14, cx + 1 + 40 + 1 + 20, '270', 'COUNTERCLOCKWISE_90'),
    ];
    this.updateDirectionButtons();
    this.updateMode(!!prev);
  }

  updateDirectionButtons() {
    this.rotateButtons.forEach((btn, i) => { btn.enabled = ROTATIONS[i] !== this.tile.rotation; });
  }

  // updateMode: which boxes and buttons each mode shows (only the visible boxes take input)
  updateMode(keepFocus = false) {
    const e = this.edits, mode = this.tile.mode;
    const focused = keepFocus ? this.tabOrder.find((f) => f.focused) : null;
    for (const f of this.tabOrder) f.focused = false;
    const show = {
      SAVE: [e.name, e.posX, e.posY, e.posZ, e.sizeX, e.sizeY, e.sizeZ],
      LOAD: [e.name, e.posX, e.posY, e.posZ, e.integrity, e.seed],
      CORNER: [e.name],
      DATA: [e.data],
    }[mode];
    this.fields = show;
    const first = mode === 'DATA' ? e.data : e.name;
    if (focused && show.includes(focused)) focused.focused = true; else first.focused = true;
    const vis = {
      saveButton: mode === 'SAVE', loadButton: mode === 'LOAD', detectSizeButton: mode === 'SAVE',
      showEntitiesButton: mode === 'SAVE' || mode === 'LOAD', mirrorButton: mode === 'LOAD',
      showAirButton: mode === 'SAVE', showBoundingBoxButton: mode === 'LOAD',
    };
    for (const k in vis) this[k].visible = vis[k];
    for (const btn of this.rotateButtons) btn.visible = mode === 'LOAD';
    if (mode === 'LOAD') this.updateDirectionButtons();
  }

  // sendToServer: TileEntityStructure.writeCoordinates, then the action and every setting
  send(action) {
    const t = this.tile, e = this.edits;
    const values={...t,name:e.name.text,metadata:e.data.text,integrity:parseFloatJava(e.integrity.text),seed:parseLongJava(e.seed.text)};
    for(const k of ['posX','posY','posZ','sizeX','sizeY','sizeZ'])values[k]=parseIntJava(e[k].text);
    this.game.send(C.updateStructure(this.pos,action,values));
    return true;
  }

  cancel() {
    Object.assign(this.tile, this.saved);
    this.game.screens.close();
  }

  close() { this.cancel(); }

  key(e) {
    if (e.code === 'Tab') {
      // Tab moves to the next visible box (wrapping around)
      const vis = this.fields, i = vis.findIndex((f) => f.focused);
      if (i >= 0 && vis.length > 1) { vis[i].focused = false; vis[(i + 1) % vis.length].focused = true; }
      return true;
    }
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (this.send(1)) this.game.screens.close(); return true; }
    if (e.code === 'Escape') { this.cancel(); return true; }
    for (const f of this.fields) if (f.key(e)) return true;
    return false;
  }

  renderContent(gui) {
    const mode = this.tile.mode, cx = this.width / 2;
    const right = (s, y) => gui.text(s, cx + 154 - gui.textWidth(s), y, 0xa0a0a0, true);
    gui.textCentered(tr('tile.structureBlock.name'), cx, 10, 0xffffff, true);
    if (mode !== 'DATA') gui.text(tr('structure_block.structure_name'), cx - 153, 30, 0xa0a0a0, true);
    if (mode === 'LOAD' || mode === 'SAVE') {
      gui.text(tr('structure_block.position'), cx - 153, 70, 0xa0a0a0, true);
      right(tr('structure_block.include_entities'), 150);
    }
    if (mode === 'SAVE') {
      gui.text(tr('structure_block.size'), cx - 153, 110, 0xa0a0a0, true);
      right(tr('structure_block.detect_size'), 110);
      right(tr('structure_block.show_air'), 70);
    }
    if (mode === 'LOAD') {
      gui.text(tr('structure_block.integrity'), cx - 153, 110, 0xa0a0a0, true);
      right(tr('structure_block.show_boundingbox'), 70);
    }
    if (mode === 'DATA') gui.text(tr('structure_block.custom_data'), cx - 153, 110, 0xa0a0a0, true);
    gui.text(tr('structure_block.mode_info.' + mode.toLowerCase()), cx - 153, 174, 0xa0a0a0, true);
  }
}
