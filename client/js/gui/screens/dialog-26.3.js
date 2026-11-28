// Native 26.3 Dialog screen. The server sends either an inline dialog graph or a holder id from
// the synchronized minecraft:dialog registry; this presents the dialog types the client can
// round-trip today: notice, confirmation, multi_action, dialog_list and server_links.
// Unsupported body widgets/actions are skipped rather than guessed.
import {Screen} from './manager.js';
import {Button, Slider, TextField} from '../widgets.js';
import {tr} from '../i18n.js';
import {chatSegments, chatToLegacy, wrapChatSegments} from '../chat.js';
import {platform} from '../../platform/platform.js';
import {writeClipboard} from '../../platform/clipboard.js';
import {C} from '../../net/packets.js';
import {parseDialog263, parseDialogRegistry263} from '../../net/dialog-26.3.js';

function componentText(component) {
  return component == null ? '' : chatToLegacy(component, {parsed: true});
}

// ServerLinks.KnownLinkType enum order; the packet sends the enum id for a known link.
const SERVER_LINK_TYPES = ['report_bug', 'community_guidelines', 'support', 'status', 'feedback', 'community', 'website', 'forums', 'news', 'announcements'];

function serverLinkLabel(link) {
  if (link.name) return link.name;
  const type = SERVER_LINK_TYPES[link.type];
  return type ? {translate: 'known_server_link.' + type} : {text: link.link || ''};
}

const formatNumber = value => {
  const integer = Math.trunc(value);
  return integer === value ? String(integer) : String(value);
};

function lerp(value, start, end) { return start + (end - start) * value; }
function inverseLerp(value, start, end) { return start === end ? 0.5 : (value - start) / (end - start); }

function scaledRangeValue(input, sliderValue) {
  const value = lerp(sliderValue, input.start, input.end);
  if (input.step == null) return value;
  const initial = input.initial ?? (input.start + input.end) / 2;
  let steps = Math.round((value - initial) / input.step);
  let result = initial + steps * input.step;
  if (inverseLerp(result, input.start, input.end) < 0 || inverseLerp(result, input.start, input.end) > 1) {
    steps -= Math.sign(steps);
    result = initial + steps * input.step;
  }
  return result;
}

// StringTag.escapeWithoutQuotes: command templates substitute text values with quotes and
// backslashes escaped, while boolean/number/enum values use their native strings unchanged.
function escapeTemplateValue(value) {
  return String(value).replace(/["'\\]/g, '\\$&').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

function instantiateTemplate(template, values) {
  let result = '';
  let start = 0;
  for (;;) {
    const index = template.indexOf('$(', start);
    if (index === -1) return result + template.slice(start);
    result += template.slice(start, index);
    const end = template.indexOf(')', index + 2);
    if (end === -1) return result + template.slice(index);
    const key = template.slice(index + 2, end);
    result += values[key]?.template ?? '';
    start = end + 1;
  }
}

// ClickEvent from a component style, mapped onto the same action model as dialog actions.
function clickActionFromEvent(event) {
  if (!event) return null;
  switch (event.action) {
    case 'open_url': return event.value ? {type: 'open_url', url: event.value} : null;
    case 'run_command': return event.value != null ? {type: 'run_command', command: event.value} : null;
    case 'suggest_command': return event.value != null ? {type: 'suggest_command', command: event.value} : null;
    case 'copy_to_clipboard': return event.value != null ? {type: 'copy_to_clipboard', value: event.value} : null;
    case 'custom': return event.id ? {type: 'custom', id: event.id, payload: event.payload || null} : null;
    default: return null;
  }
}

function nbtInputValue(input, value) {
  switch (input.type) {
    case 'boolean': return {t: 1, v: value ? 1 : 0};
    case 'number_range': return {t: 5, v: value};
    default: return {t: 8, v: String(value)};
  }
}

// TextInput.multiline uses MultiLineEditBox: Enter inserts a line break, the box keeps the
// server's height/max_lines, and editing stays inside the same max_length limit.
class DialogMultilineField extends TextField {
  insert(str) {
    let value = '';
    for (const ch of str) if (ch === '\n' || (ch >= ' ' && ch !== '\u007f' && ch !== '§')) value += ch;
    if (this.filter) value = [...value].filter(ch => ch === '\n' || this.filter(ch)).join('');
    const [a, b] = this.selection();
    const room = this.maxLength - this.text.length + (b - a);
    value = value.slice(0, Math.max(0, room));
    const next = this.text.slice(0, a) + value + this.text.slice(b);
    if (this.validate && !this.validate(next)) return;
    this.text = next;
    this.cursor = this.selEnd = a + value.length;
    if (this.onChange) this.onChange(this.text);
  }

  key(e) {
    if (e.code === 'Enter' || e.code === 'NumpadEnter') { this.insert('\n'); return true; }
    return super.key(e);
  }

  mouseDown(mx, my, gui) {
    const inside = mx >= this.x && mx < this.x + this.w && my >= this.y && my < this.y + this.h;
    this.focused = inside;
    if (inside) {
      const lines = this.text.split('\n');
      const line = Math.max(0, Math.min(lines.length - 1, Math.floor((my - this.y - 4) / 9)));
      let start = 0;
      for (let i = 0; i < line; i++) start += lines[i].length + 1;
      const rel = Math.max(0, mx - this.x - 4);
      this.cursor = this.selEnd = start + gui.font.trimToWidth(lines[line], rel).length;
    }
    return inside;
  }

  render(gui) {
    gui.rect(this.x - 1, this.y - 1, this.x + this.w + 1, this.y + this.h + 1, 0xffa0a0a0);
    gui.rect(this.x, this.y, this.x + this.w, this.y + this.h, 0xff000000);
    const innerW = this.w - 8;
    const lines = this.text.split('\n');
    let cursorLine = 0, cursorColumn = 0;
    for (let i = 0; i < lines.length; i++) {
      const start = lines.slice(0, i).reduce((sum, line) => sum + line.length + 1, 0);
      if (this.cursor >= start) { cursorLine = i; cursorColumn = this.cursor - start; }
    }
    for (let i = 0; i < lines.length && 4 + i * 9 < this.h; i++) {
      const visible = gui.font.trimToWidth(lines[i], innerW);
      gui.text(visible, this.x + 4, this.y + 4 + i * 9, this.textColor, true);
    }
    if (this.focused && Math.floor(this.cursorCounter / 6) % 2 === 0) {
      const prefix = gui.font.trimToWidth(lines[cursorLine] || '', innerW).slice(0, cursorColumn);
      const cx = this.x + 4 + gui.font.width(prefix);
      const cy = this.y + 4 + cursorLine * 9;
      gui.rect(cx, cy - 1, cx + 1, cy + 9, 0xffd0d0d0);
    }
  }
}

// A native Checkbox: 20x20 square, label to the right, Space/Enter toggles it.
class DialogCheckbox {
  constructor(x, y, label, selected) {
    this.x = x; this.y = y; this.w = 20; this.h = 20;
    this.label = label; this.selected = selected;
    this.focused = false; this.visible = true; this.enabled = true;
  }
  hovered(mx, my) { return mx >= this.x && my >= this.y && mx < this.x + this.w && my < this.y + this.h; }
  toggle() { this.selected = !this.selected; }
  render(gui, mx, my) {
    if (!this.visible) return;
    const border = this.enabled ? 0xffa0a0a0 : 0xff555555;
    gui.rect(this.x, this.y, this.x + 20, this.y + 20, 0xff000000);
    gui.rect(this.x, this.y, this.x + 20, this.y + 1, border);
    gui.rect(this.x, this.y + 19, this.x + 20, this.y + 20, border);
    gui.rect(this.x, this.y, this.x + 1, this.y + 20, border);
    gui.rect(this.x + 19, this.y, this.x + 20, this.y + 20, border);
    if (this.selected) {
      gui.rect(this.x + 5, this.y + 9, this.x + 15, this.y + 12, 0xffffffff);
      gui.rect(this.x + 9, this.y + 5, this.x + 12, this.y + 15, 0xffffffff);
    }
    gui.text(this.label, this.x + 26, this.y + 6, this.enabled ? 0xffffffff : 0xffa0a0a0, false);
  }
  mouseDown(mx, my, game) {
    if (!this.visible || !this.enabled || !this.hovered(mx, my)) return false;
    this.toggle();
    game?.sound?.playUi?.('ui.button.click', 1);
    return true;
  }
  key(e, game) {
    if (!this.visible || !this.enabled || !['Enter', 'NumpadEnter', 'Space'].includes(e.code)) return false;
    this.toggle();
    game?.sound?.playUi?.('ui.button.click', 1);
    return true;
  }
}

// The native DialogScreen's 20x20 warning button opens WarningScreen. This client has no
// connection access object, so the screen describes the server-data warning and offers the
// same Back/Disconnect choices against the current game connection.
export class DialogWarningScreen263 extends Screen {
  constructor(game, previousScreen = null) {
    super(game);
    this.previousScreen = previousScreen;
    this.background = 'dirt';
    this.pausesGame = true;
  }

  init() {
    this.buttons.push(new Button(0, this.width / 2 - 155, this.height - 28, 150, 20, tr('gui.back'), () => {
      if (this.previousScreen) this.game.screens.open(this.previousScreen);
      else this.game.screens.close();
    }));
    this.buttons.push(new Button(1, this.width / 2 + 5, this.height - 28, 150, 20, tr('menu.custom_screen_info.disconnect'), () => this.game.disconnect()));
  }

  renderContent(gui) {
    gui.textCentered(tr('menu.custom_screen_info.title'), this.width / 2, 20, 0xffffff, true);
    const lines = [tr('menu.custom_screen_info.contents')];
    let y = 55;
    for (const line of lines) {
      for (const wrapped of gui.font.wrap(line, Math.max(40, this.width - 40))) {
        gui.textCentered(wrapped, this.width / 2, y, 0xffffff, true);
        y += 9;
      }
    }
  }

  key(e) { if (e.code === 'Escape') { if (this.previousScreen) this.game.screens.open(this.previousScreen); else this.game.screens.close(); return true; } return super.key(e); }
}

export {parseDialog263, parseDialogRegistry263, instantiateTemplate, scaledRangeValue};

export class DialogScreen263 extends Screen {
  constructor(game, dialog, previousScreen = null) {
    super(game);
    this.dialog = dialog;
    this.previousScreen = previousScreen;
    this.background = 'none';
    this.isDialog263 = true;
    this.pausesGame = dialog?.pause !== false;
    this.scroll = 0;
    this.lines = [];
    this.controls = [];
    this.inputGetters = {};
    this.bodyHeight = 0;
    this.resetView();
  }

  resetView() {
    this.view = {x: 10, y: 33, width: Math.max(1, this.width - 20), height: Math.max(1, this.height - 62)};
  }

  get titleText() { return componentText(this.dialog?.title); }

  init() {
    this.buttons = [];
    this.fields = [];
    if (!this.dialog) {
      this.buttons.push(new Button(0, this.width / 2 - 75, this.height - 28, 150, 20, tr('gui.ok'), () => this.game.screens.close()));
      return;
    }
    // ServerLinksDialogScreen builds its buttons from the last server-links packet, not from
    // the dialog graph.
    if (this.dialog.type === 'server_links') {
      this.dialog.buttons = (this.game.serverLinks || []).map(link => ({
        label: serverLinkLabel(link),
        tooltip: null,
        width: this.dialog.buttonWidth || 150,
        action: {type: 'open_url', url: link.link}
      }));
    }
    this.lines = [];
    this.controls = [];
    this.inputGetters = {};
    this.layoutBody();
    this.placeButtons();
    this.positionControls();
    const warning = new Button(-1, Math.max(0, this.width - 30), 5, 20, 20, '!', () => {
      this.game.screens.open(new DialogWarningScreen263(this.game, this));
    });
    warning.tooltip = tr('menu.custom_screen_info.tooltip');
    this.buttons.push(warning);
  }

  onResize() {
    this.resetView();
    super.onResize();
  }

  layoutBody() {
    let y = 0;
    const pushText = (component, color, width = 200) => {
      const text = componentText(component);
      const wrapped = this.wrapBody(text, width);
      const segments = chatSegments(component);
      const mapped = segments ? wrapChatSegments(segments, wrapped) : null;
      wrapped.forEach((line, index) => {
        this.lines.push({text: line, color, relY: y, segments: mapped?.[index] || null});
        y += 9;
      });
    };
    for (const body of this.dialog.bodies) {
      if (body.type === 'item') {
        const name = body.itemId ? tr('item.minecraft.' + body.itemId) : '';
        const itemHeight = Math.max(9, body.height || 16);
        this.lines.push({
          text: name || '[item]', color: 0xffffff, relY: y, itemId: body.itemId, itemCount: body.count || 1,
          itemHeight, showDecorations: body.showDecorations !== false
        });
        y += itemHeight;
        if (body.description) pushText(body.description, 0xa0a0a0, body.descriptionWidth || 200);
      } else {
        pushText(body.component, 0xffffff, body.width || 200);
      }
    }
    for (const input of this.dialog.inputs || []) {
      const control = this.createInputControl(input);
      if (!control) continue;
      if (control.labelVisible) {
        this.lines.push({text: componentText(input.label), color: 0xffffff, relY: y});
        y += 9;
      }
      control.relY = y;
      this.controls.push(control);
      y += control.height + 10;
    }
    this.bodyHeight = y;
  }

  createInputControl(input) {
    const width = Math.max(1, Math.min(input.width || 200, this.view.width));
    switch (input.type) {
      case 'text': {
        const labelVisible = input.labelVisible !== false;
        const height = input.multiline
          ? Math.max(1, Math.min(512, input.multiline.height ?? Math.min(9 * (input.multiline.maxLines || 4) + 8, 512)))
          : 20;
        const FieldClass = input.multiline ? DialogMultilineField : TextField;
        const field = new FieldClass(0, 0, width, height, {
          text: input.initial || '',
          maxLength: input.maxLength || 32
        });
        field.label = componentText(input.label);
        this.fields.push(field);
        this.inputGetters[input.key] = () => ({
          value: field.text,
          template: escapeTemplateValue(field.text),
          tag: {t: 8, v: field.text}
        });
        return {widget: field, height, getter: this.inputGetters[input.key], labelVisible};
      }
      case 'boolean': {
        const checkbox = new DialogCheckbox(0, 0, componentText(input.label), input.initial === true);
        this.buttons.push(checkbox);
        this.inputGetters[input.key] = () => ({
          value: checkbox.selected,
          template: checkbox.selected ? input.onTrue : input.onFalse,
          tag: {t: 1, v: checkbox.selected ? 1 : 0}
        });
        return {widget: checkbox, height: 20, getter: this.inputGetters[input.key], labelVisible: false};
      }
      case 'number_range': {
        const initial = input.initial ?? (input.start + input.end) / 2;
        const initialSlider = input.start === input.end ? 0.5 : Math.max(0, Math.min(1, inverseLerp(initial, input.start, input.end)));
        const slider = new Slider(0, 0, width, 20, 20,
          value => tr(input.labelFormat || 'options.generic_value', componentText(input.label), formatNumber(scaledRangeValue(input, value))),
          initialSlider, () => {});
        this.buttons.push(slider);
        this.inputGetters[input.key] = () => {
          const value = scaledRangeValue(input, slider.value);
          return {value, template: formatNumber(value), tag: nbtInputValue(input, value)};
        };
        return {widget: slider, height: 20, getter: this.inputGetters[input.key], labelVisible: false};
      }
      case 'single_option': {
        let index = Math.max(0, input.entries.findIndex(entry => entry.initial));
        const valueLabel = () => {
          const entry = input.entries[index] || input.entries[0];
          return entry?.display ? componentText(entry.display) : (entry?.id || '');
        };
        const button = new Button(0, 0, width, 20, 20,
          () => input.labelVisible !== false ? componentText(input.label) + ': ' + valueLabel() : valueLabel(),
          () => { index = (index + 1) % input.entries.length; });
        this.buttons.push(button);
        this.inputGetters[input.key] = () => {
          const entry = input.entries[index] || input.entries[0];
          return {value: entry.id, template: entry.id, tag: {t: 8, v: entry.id}};
        };
        return {widget: button, height: 20, getter: this.inputGetters[input.key], labelVisible: false};
      }
      default:
        return null;
    }
  }

  // Controls live in Screen.buttons/fields, so scrolling and clipping have to move them
  // explicitly. Hidden text fields get parked outside the hit box because TextField has no
  // visible flag and would otherwise still take focus behind the scroll viewport.
  positionControls() {
    const scrollPx = this.scroll * 9;
    for (const control of this.controls) {
      const widget = control.widget;
      widget.x = Math.floor((this.width - widget.w) / 2);
      widget.y = Math.floor(this.view.y + control.relY - scrollPx);
      const visible = widget.y + control.height > this.view.y && widget.y < this.view.y + this.view.height;
      if (widget instanceof TextField) {
        widget.visible = visible;
        if (!visible) widget.y = -1000;
      } else {
        widget.visible = visible;
      }
    }
  }

  inputValues() {
    const values = {};
    for (const [key, getter] of Object.entries(this.inputGetters)) values[key] = getter();
    return values;
  }

  wrapBody(text, width) {
    const max = Math.max(20, Math.min(width, this.width - 20));
    return text ? this.gui.font.wrap(text, max) : [];
  }

  placeButtons() {
    const main = this.dialog.buttons || [];
    const footer = this.dialog.exitAction ? [...main, this.dialog.exitAction] : main;
    if (!footer.length) return;
    const columns = Math.max(1, Math.min(this.dialog.columns || 1, footer.length));
    const rows = Math.ceil(footer.length / columns);
    const gap = 8;
    const rowHeight = 20 + gap;
    const baseY = this.height - 5 - rows * 20 - (rows - 1) * gap;
    footer.forEach((data, index) => {
      const row = Math.floor(index / columns);
      const col = index % columns;
      const rowCount = Math.min(columns, footer.length - row * columns);
      const width = Math.max(1, Math.min(data.width || 150, this.width - 10));
      const total = rowCount * width + (rowCount - 1) * gap;
      const x = Math.floor((this.width - total) / 2) + col * (width + gap);
      const y = baseY + row * rowHeight;
      const label = componentText(data.label) || tr('gui.ok');
      const button = new Button(index, x, y, width, 20, label, () => this.runAction(data.action));
      button.tooltip = data.tooltip ? componentText(data.tooltip) : null;
      this.buttons.push(button);
    });
  }

  renderContent(gui, mx, my) {
    this.clickRegions = [];
    if (!this.dialog) {
      gui.textCentered(tr('minecraftjs.dialog.unsupported'), this.width / 2, 15, 0xff5555, true);
      return;
    }
    gui.textCentered(this.titleText, Math.floor(this.width / 2), 15, 0xffffff, true);
    const lineHeight = 9;
    this.bodyHeight = Math.max(this.bodyHeight, this.lines.length ? this.lines[this.lines.length - 1].relY + lineHeight : 0);
    const maxScroll = Math.max(0, Math.ceil((this.bodyHeight - this.view.height) / lineHeight));
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    this.positionControls();
    gui.scissor(this.view.x, this.view.y, this.view.width, this.view.height);
    for (const line of this.lines) {
      const y = this.view.y + line.relY - this.scroll * lineHeight;
      if (y + lineHeight < this.view.y || y > this.view.y + this.view.height) continue;
      if (line.itemId) {
        const item = this.game.assets?.itemsByName?.get?.(line.itemId) || this.game.assets?.itemsByName?.get?.(line.itemId.replace(/^minecraft:/, ''));
        if (item) this.game.itemRenderer?.drawItem(gui, {id: item.id, count: line.itemCount || 1}, this.view.x, y, false, 0, line.showDecorations ? null : '');
      }
      const textX = this.view.x + (line.itemId ? 18 : 0);
      if (line.segments?.length) {
        let x = textX;
        for (const segment of line.segments) {
          const width = gui.font.width(segment.text);
          if (segment.click || segment.hoverText) {
            this.clickRegions.push({
              x, y: y - 1, w: width, h: 9 + 2,
              action: clickActionFromEvent(segment.click),
              tooltip: segment.hoverText || null
            });
          }
          gui.text(segment.text, x, y, line.color, true);
          x += width;
        }
      } else {
        gui.text(line.text, textX, y, line.color, true);
      }
    }
    gui.clearScissor();
    if (maxScroll > 0) {
      const trackH = this.view.height;
      const thumbH = Math.max(10, Math.floor(trackH * this.view.height / this.bodyHeight));
      const thumbY = this.view.y + Math.floor((trackH - thumbH) * this.scroll / maxScroll);
      gui.rect(this.width - 8, this.view.y, this.width - 6, this.view.y + trackH, 0x80000000);
      gui.rect(this.width - 8, thumbY, this.width - 6, thumbY + thumbH, 0xffa0a0a0);
    }
    const hovered = this.clickRegions.find(region => mx >= region.x && mx < region.x + region.w && my >= region.y && my < region.y + region.h);
    if (hovered?.tooltip) gui.tooltip(gui.font.wrap(hovered.tooltip, Math.min(300, this.width - 20)), mx, my);
  }

  mouseDown(mx, my, button) {
    if (button === 0) {
      const region = this.clickRegions.find(r => mx >= r.x && mx < r.x + r.w && my >= r.y && my < r.y + r.h);
      if (region?.action) { this.runAction(region.action); return true; }
    }
    return super.mouseDown(mx, my, button);
  }

  wheel(delta) {
    const lineHeight = 9;
    const maxScroll = Math.max(0, Math.ceil((this.bodyHeight - this.view.height) / lineHeight));
    this.scroll = Math.max(0, Math.min(maxScroll, this.scroll + (delta > 0 ? -2 : 2)));
    this.positionControls();
  }

  // Dialog.onCancel and after_action. An open_dialog action replaces this screen instead of
  // closing it, so the nested dialog keeps the same modal stack.
  runAction(action) {
    const opened = action ? this.perform(action) : false;
    if (opened) return;
    // wait_for_response deliberately leaves the dialog up until clear_dialog; the native
    // client replaces it with a waiting screen, which this client models as the still-open
    // holder. None and close differ only in whether an action screen is closed.
    if (this.dialog?.afterAction === 'close') this.game.screens.close();
  }

  perform(action) {
    switch (action.type) {
      case 'open_url':
        platform().openUrl(action.url);
        return false;
      case 'run_command':
        this.game.send(C.chat(action.command.startsWith('/') ? action.command : '/' + action.command));
        return false;
      case 'dynamic_run_command': {
        const command = instantiateTemplate(action.template, this.inputValues());
        this.game.send(C.chat(command.startsWith('/') ? command : '/' + command));
        return false;
      }
      case 'suggest_command':
        // Native opens the chat with the command pre-filled.
        import('./chat.js').then(({ChatScreen}) => this.game.screens.open(new ChatScreen(this.game, '/' + action.command)));
        return true;
      case 'copy_to_clipboard':
        writeClipboard(action.value);
        return false;
      case 'custom':
        this.game.send(C.customClickAction(action.id, action.payload));
        return false;
      case 'dynamic_custom': {
        const additions = {...(action.additions?.v || {})};
        for (const [key, value] of Object.entries(this.inputValues())) additions[key] = value.tag;
        this.game.send(C.customClickAction(action.id, {t: 10, v: additions}));
        return false;
      }
      case 'open_dialog':
        this.game.screens.open(new DialogScreen263(this.game, action.dialog, this.previousScreen));
        return true;
      default:
        return false;
    }
  }

  key(e) {
    if (e.code === 'Escape') {
      if (!this.dialog?.canCloseWithEscape) return true;
      this.runAction(this.dialog?.onCancel || null);
      return true;
    }
    return super.key(e);
  }

  close() {
    this.runAction(this.dialog?.onCancel || null);
  }

  // ScreenManager calls onClose whenever a different screen replaces this one. Cancel actions
  // only belong to an explicit close, so leave this empty.
  onClose() {}
}
