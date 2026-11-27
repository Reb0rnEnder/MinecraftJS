// Native 26.3 Dialog screen. The server sends either an inline dialog graph or a holder id from
// the synchronized minecraft:dialog registry; this presents the dialog types the client can
// round-trip today: notice, confirmation, multi_action, dialog_list and server_links.
// Input widgets and item icons are still tracked in docs/parity-checklist-26.3.md; unsupported
// actions are skipped rather than guessed.
import {Screen} from './manager.js';
import {Button} from '../widgets.js';
import {tr} from '../i18n.js';
import {chatToLegacy} from '../chat.js';
import {platform} from '../../platform/platform.js';
import {writeClipboard} from '../../platform/clipboard.js';
import {C} from '../../net/packets.js';
import {parseDialog263, parseDialogRegistry263} from '../../net/dialog-26.3.js';

function componentText(component) {
  return component == null ? '' : chatToLegacy(component, {parsed: true});
}

export {parseDialog263, parseDialogRegistry263};

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
    this.resetView();
  }

  resetView() {
    this.view = {x: 10, y: 33, width: Math.max(1, this.width - 20), height: Math.max(1, this.height - 62)};
  }

  get titleText() { return componentText(this.dialog?.title); }

  init() {
    if (!this.dialog) {
      this.buttons.push(new Button(0, this.width / 2 - 75, this.height - 28, 150, 20, tr('gui.ok'), () => this.game.screens.close()));
      return;
    }
    this.lines = this.layoutBody();
    this.placeButtons();
  }

  onResize() {
    this.resetView();
    super.onResize();
  }

  layoutBody() {
    const lines = [];
    for (const body of this.dialog.bodies) {
      if (body.type === 'item') {
        const name = body.itemId ? tr('item.minecraft.' + body.itemId) : '';
        lines.push({text: name || '[item]', color: 0xffffff});
        if (body.description) for (const line of this.wrapBody(componentText(body.description), body.width || 200)) lines.push({text: line, color: 0xa0a0a0});
      } else {
        for (const line of this.wrapBody(componentText(body.component), body.width || 200)) lines.push({text: line, color: 0xffffff});
      }
    }
    return lines;
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

  renderContent(gui) {
    if (!this.dialog) {
      gui.textCentered(tr('minecraftjs.dialog.unsupported'), this.width / 2, 15, 0xff5555, true);
      return;
    }
    gui.textCentered(this.titleText, Math.floor(this.width / 2), 15, 0xffffff, true);
    const lineHeight = 9;
    const maxScroll = Math.max(0, this.lines.length - Math.floor(this.view.height / lineHeight));
    this.scroll = Math.max(0, Math.min(this.scroll, maxScroll));
    gui.scissor(this.view.x, this.view.y, this.view.width, this.view.height);
    let y = this.view.y - this.scroll * lineHeight;
    for (const line of this.lines) {
      gui.text(line.text, this.view.x, y, line.color, true);
      y += lineHeight;
    }
    gui.clearScissor();
    if (maxScroll > 0) {
      const trackH = this.view.height;
      const thumbH = Math.max(10, Math.floor(trackH * this.view.height / (this.lines.length * lineHeight)));
      const thumbY = this.view.y + Math.floor((trackH - thumbH) * this.scroll / maxScroll);
      gui.rect(this.width - 8, this.view.y, this.width - 6, this.view.y + trackH, 0x80000000);
      gui.rect(this.width - 8, thumbY, this.width - 6, thumbY + thumbH, 0xffa0a0a0);
    }
  }

  wheel(delta) {
    const lineHeight = 9;
    const maxScroll = Math.max(0, this.lines.length - Math.floor(this.view.height / lineHeight));
    this.scroll = Math.max(0, Math.min(maxScroll, this.scroll + (delta > 0 ? -2 : 2)));
  }

  // Dialog.onCancel and after_action. An open_dialog action replaces this screen instead of
  // closing it, so the nested dialog keeps the same modal stack.
  runAction(action) {
    const opened = action ? this.perform(action) : false;
    if (opened) return;
    if (this.dialog?.afterAction !== 'none') this.game.screens.close();
  }

  perform(action) {
    switch (action.type) {
      case 'open_url':
        platform().openUrl(action.url);
        return false;
      case 'run_command':
        this.game.send(C.chat(action.command.startsWith('/') ? action.command : '/' + action.command));
        return false;
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
