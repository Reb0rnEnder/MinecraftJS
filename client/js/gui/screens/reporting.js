// Native 1.19.4 chat reporting screens (net.minecraft.client.gui.screens.reporting): ChatReportScreen with its
// fixed 280x300 layout and DiscardReportWarningScreen, ChatSelectionScreen, ReportReasonSelectionScreen and
// GenericWaitingScreen, plus ReportingContext.draftReportHandled. 1.19.4 has chat reports only.
import { Screen } from './manager.js';
import { ConfirmScreen } from './menus.js';
import { ConfirmLinkScreen } from './chat.js';
import { Button } from '../widgets.js';
import { SlotList } from '../slot-list.js';
import { MultiLineEditBox } from '../multiline-edit-box.js';
import { tr } from '../i18n.js';
import { changeFocus } from '../focus-navigation.js';
import { platform } from '../../platform/platform.js';
import { chatTrustTag } from '../chat-tags.js';
import { REPORT_REASONS, ReportBuilder, ChatSelectionLogFiller, hasSignatureFrom, abuseReportRequestJson, reportErrorKey } from '../../game/reporting.js';

const reasonTitle = (r) => tr('gui.abuseReport.reason.' + r);
const buttonTooltip = (screen, gui, mx, my) => {
  for (const b of screen.buttons) if (b.visible !== false && b.tooltip && b.hovered(mx, my)) { gui.tooltip(gui.font.wrap(b.tooltip, 170), mx, my); return; }
};

// ReportingContext.draftReportHandled
export function draftReportHandled(game, parent, proceed, quitting = false) {
  const ctx = game.reporting;
  if (!ctx?.draft) { proceed(); return; }
  const draft = ctx.draft.copy();
  game.screens.open(new ConfirmScreen(game, (edit) => {
    ctx.setDraft(null);
    if (edit) game.screens.open(new ChatReportScreen(game, parent, draft)); else proceed();
  }, tr(quitting ? 'gui.chatReport.draft.quittotitle.title' : 'gui.chatReport.draft.title'), tr(quitting ? 'gui.chatReport.draft.quittotitle.content' : 'gui.chatReport.draft.content'),
  tr('gui.chatReport.draft.edit'), tr('gui.chatReport.draft.discard')));
}

// ---- ChatReportScreen
export class ChatReportScreen extends Screen {
  narrationTitle() { return tr('gui.chatReport.title'); }
  constructor(game, parent, builder) { super(game); this.parent = parent; this.builder = builder; }
  get ctx() { return this.game.reporting; }
  contentLeft() { return Math.trunc(this.width / 2) - 140; }
  contentTop() { return Math.max(Math.trunc((this.height - 300) / 2), 0); }
  contentBottom() { return Math.min(Math.trunc((this.height + 300) / 2), this.height); }
  selectChatTop() { return this.contentTop() + 40; }
  selectInfoTop() { return this.selectChatTop() + 10 + 20; }
  commentBoxTop() { return this.selectInfoTop() + 20 + 25 + (this.reasonLines ? (this.reasonLines.length + 1) * 9 : 0); }
  completeButtonTop() { return this.contentBottom() - 20 - 10; }
  commentBoxBottom() { return this.completeButtonTop() - 20; }
  init() {
    const g = this.game, b = this.builder, mid = Math.trunc(this.width / 2), left = this.contentLeft();
    this.reasonLines = b.reason ? this.gui.font.wrap(tr('gui.abuseReport.reason.' + b.reason + '.description'), 280) : null;
    const selected = b.report.reported.size;
    this.buttons.push(new Button(0, left, this.selectChatTop(), 280, 20, selected ? tr('gui.chatReport.selected_chat', String(selected)) : tr('gui.chatReport.select_chat'),
      () => g.screens.open(new ChatSelectionScreen(g, this, this.builder, (nb) => { this.builder = nb; }))));
    this.buttons.push(new Button(1, left, this.selectInfoTop(), 280, 20, b.reason ? reasonTitle(b.reason) : tr('gui.chatReport.select_reason'),
      () => g.screens.open(new ReportReasonSelectionScreen(g, this, this.builder.reason, (r) => { this.builder.setReason(r); }))));
    const box = this.box = new MultiLineEditBox(this.gui, left, this.commentBoxTop(), 280, this.commentBoxBottom() - this.commentBoxTop(), tr('gui.chatReport.describe'), tr('gui.chatReport.comments'), { limit: this.ctx.limits.maxOpinionCommentsLength, value: b.comments });
    box.onChange = (s) => { this.builder.setComments(s); this.onReportChanged(); };
    this.fields.push(box);
    this.buttons.push(new Button(2, mid - 120, this.completeButtonTop(), 120, 20, tr('gui.back'), () => this.close()));
    this.send = new Button(3, mid + 10, this.completeButtonTop(), 120, 20, tr('gui.chatReport.send'), () => this.sendReport());
    this.buttons.push(this.send);
    this.onReportChanged();
  }
  onReportChanged() { const p = this.builder.checkBuildable(); if (this.send) { this.send.enabled = !p; this.send.tooltip = p ? tr(p) : null; } }
  sendReport() {
    const g = this.game, built = this.builder.build(this.ctx);
    if (built.error) { this.showError(tr(built.error)); return; }
    let cancelled = false;
    const json = abuseReportRequestJson(built, this.ctx.environment);
    g.screens.open(GenericWaitingScreen.waiting(g, '§l' + tr('gui.abuseReport.sending.title'), tr('gui.cancel'), () => { cancelled = true; g.screens.open(this); }));
    g.accounts.reportAbuse(json).then(() => {
      if (cancelled) return;
      this.ctx.setDraft(null); this.sent = true;
      g.screens.open(GenericWaitingScreen.completed(g, '§l' + tr('gui.abuseReport.sent.title'), tr('gui.chatReport.report_sent_msg'), tr('gui.done'), () => g.screens.close()));
    }, (e) => {
      if (cancelled) return;
      console.error('Encountered error while sending abuse report', e);
      const k = reportErrorKey(e);
      this.showError(tr(k.key, ...(k.args || [])));
    });
  }
  showError(text) { const g = this.game; g.screens.open(GenericWaitingScreen.completed(g, '§l' + tr('gui.abuseReport.error.title'), '§c' + text.replace(/\n/g, '\n§c'), tr('gui.back'), () => g.screens.open(this))); }
  onClose() { if (!this.sent && this.builder.hasContent()) this.ctx.setDraft(this.builder.copy()); }
  close() { if (this.builder.hasContent()) this.game.screens.open(new DiscardReportWarningScreen(this.game, this)); else this.game.screens.open(this.parent); }
  renderContent(gui) {
    const mid = Math.trunc(this.width / 2), left = this.contentLeft();
    gui.textCentered(tr('gui.chatReport.title'), mid, 10, 0xffffff, true);
    gui.textCentered(tr('gui.chatReport.observed_what'), mid, this.selectChatTop() - 9 - 6, 0xffffff, true);
    (this.reasonLines || []).forEach((l, i) => gui.text(l, left, this.selectInfoTop() + 20 + 5 + i * 9, 0xffffff, true));
    gui.text(tr('gui.chatReport.more_comments'), left, this.commentBoxTop() - 9 - 6, 0xffffff, true);
  }
  render(gui, mx, my, partial) { super.render(gui, mx, my, partial); buttonTooltip(this, gui, mx, my); }
  mouseDown(mx, my, button) {
    const box = this.box, shift = !!(this.game.input?.down?.has('ShiftLeft') || this.game.input?.down?.has('ShiftRight'));
    if (button === 0 && box?.click(mx, my, this.gui, shift)) { box.focused = false; box.setFocused(true); changeFocus(this, box); this.dragging = true; this.lastY = my; return true; }
    return super.mouseDown(mx, my, button);
  }
  mouseMove(mx, my) { this.mx = mx; this.my = my; if (this.dragging) { this.box.drag(mx, my, my - this.lastY); this.lastY = my; } }
  mouseUp(mx, my, button) { this.box?.mouseUp(); this.dragging = false; super.mouseUp(mx, my, button); }
  wheel(d) { if (this.box?.inside(this.mx ?? -1, this.my ?? -1)) this.box.wheel(d); }
}

// ---- ChatReportScreen.DiscardReportWarningScreen (1.19.4 WarningScreen: 18-pixel message lines from y 70)
class DiscardReportWarningScreen extends Screen {
  constructor(game, report) { super(game); this.report = report; }
  narrationTitle() { return tr('gui.chatReport.discard.content'); }
  init() {
    const g = this.game, r = this.report, mid = Math.trunc(this.width / 2);
    this.lines = tr('gui.chatReport.discard.content').split('\n').flatMap((l) => (l ? this.gui.font.wrap(l, this.width - 100) : ['']));
    const textH = (this.lines.length + 1) * 18;
    this.buttons.push(new Button(0, mid - 155, 100 + textH, 150, 20, tr('gui.chatReport.discard.return'), () => g.screens.open(r)));
    this.buttons.push(new Button(1, mid + 5, 100 + textH, 150, 20, tr('gui.chatReport.discard.draft'), () => { r.ctx.setDraft(r.builder.copy()); r.sent = true; g.screens.open(r.parent); }));
    this.buttons.push(new Button(2, mid - 75, 130 + textH, 150, 20, tr('gui.chatReport.discard.discard'), () => { r.ctx.setDraft(null); r.sent = true; g.screens.open(r.parent); }));
  }
  renderContent(gui) {
    const mid = Math.trunc(this.width / 2), w = Math.max(0, ...this.lines.map((l) => gui.font.width(l))), x = mid - Math.trunc(w / 2);
    gui.text('§l' + tr('gui.chatReport.discard.title'), mid - 155, 30, 0xffffff, true);
    this.lines.forEach((l, i) => gui.text(l, x, 70 + i * 18, 0xffffff, true));
  }
  shouldCloseOnEsc() { return false; }
  close() { this.game.screens.open(this.report); }
}

// ---- GenericWaitingScreen
export class GenericWaitingScreen extends Screen {
  static waiting(game, title, button, callback) { return new GenericWaitingScreen(game, title, null, button, callback, 0); }
  static completed(game, title, message, button, callback) { return new GenericWaitingScreen(game, title, message, button, callback, 20); }
  constructor(game, title, message, button, callback, disableTicks) { super(game); Object.assign(this, { title, message, buttonLabel: button, callback, disableTicks }); }
  narrationTitle() { return [this.title, this.message || ''].join('. '); }
  init() {
    this.lines = this.message != null ? this.message.split('\n').flatMap((l) => (l ? this.gui.font.wrap(l, 360) : [''])) : null;
    const y = Math.min(120 + Math.max(this.lines ? this.lines.length : 1, 5) * 9, this.height - 40);
    this.button = new Button(0, Math.trunc((this.width - 150) / 2), y, 150, 20, this.buttonLabel, () => this.close());
    this.button.enabled = this.disableTicks === 0;
    this.buttons.push(this.button);
  }
  tick() { super.tick(); if (this.disableTicks > 0) this.disableTicks--; if (this.button) this.button.enabled = this.disableTicks === 0; }
  renderContent(gui) {
    gui.textCentered(this.title, Math.trunc(this.width / 2), 80, 0xffffff, true);
    if (!this.lines) gui.textCentered(['O o o', 'o O o', 'o o O', 'o O o'][Math.floor(platform().now() / 300) % 4], Math.trunc(this.width / 2), 120, 0xa0a0a0, true);
    else this.lines.forEach((l, i) => gui.textCentered(l, Math.trunc(this.width / 2), 120 + i * 9, 0xffffff, true));
  }
  shouldCloseOnEsc() { return this.lines != null && this.button?.enabled; }
  close() { this.callback(); }
}

// ---- ReportReasonSelectionScreen (list from y 40 to height - 95, description box above the buttons)
export class ReportReasonSelectionScreen extends Screen {
  narrationTitle() { return tr('gui.abuseReport.reason.title'); }
  constructor(game, parent, current, onSelected) { super(game); this.parent = parent; this.selected = current; this.onSelected = onSelected; }
  init() {
    const g = this.game, W = this.width, H = this.height, mid = Math.trunc(W / 2), screen = this;
    this.list = new (class extends SlotList {
      size() { return REPORT_REASONS.length; }
      isSelected(i) { return REPORT_REASONS[i] === screen.selected; }
      drawSlot(gui, i, x, y, h) { gui.text(reasonTitle(REPORT_REASONS[i]), x + 1, y + Math.trunc((h - 9) / 2) + 1, 0xffffff, true); }
      clicked(i) { screen.selected = REPORT_REASONS[i]; return true; }
      scrollBarX() { return this.slotLeft() + 320 - 2; }
    })(this, 40, H - 95, 18, { listWidth: 320, noBackground: true });
    this.buttons.push(new Button(0, mid - 155, H - 24, 150, 20, tr('gui.chatReport.read_info'), () => g.screens.open(new ConfirmLinkScreen(g, this, 'https://aka.ms/aboutjavareporting', true))));
    this.buttons.push(new Button(1, mid + 5, H - 24, 150, 20, tr('gui.done'), () => { if (this.selected) this.onSelected(this.selected); g.screens.open(this.parent); }));
  }
  renderContent(gui, mx, my) {
    const W = this.width, H = this.height, left = Math.trunc((W - 320) / 2), right = Math.trunc((W + 320) / 2), top = H - 95 + 4, bottom = H - 24 - 4;
    this.list.render(gui, mx, my);
    gui.textCentered(tr('gui.abuseReport.reason.title'), Math.trunc(W / 2), 16, 0xffffff, true);
    gui.rect(left, top, right, bottom, 0x7f000000);
    gui.text(tr('gui.abuseReport.reason.description'), left + 4, top + 4, 0x7f7f7f, true);
    if (this.selected) {
      const x0 = left + 4 + 16, x1 = right - 4, y0 = top + 4 + 9 + 2, y1 = bottom - 4, lines = gui.font.wrap(tr('gui.abuseReport.reason.' + this.selected + '.description'), x1 - x0);
      lines.forEach((l, i) => gui.text(l, x0, y0 + Math.trunc((y1 - y0 - lines.length * 9) / 2) + i * 9, 0xffffff, false));
    }
  }
  mouseDown(mx, my, button) { return this.list.mouseDown(mx, my, button) || super.mouseDown(mx, my, button); }
  mouseMove(mx, my) { this.list.mouseMove(mx, my); }
  mouseUp(mx, my, button) { this.list.mouseUp(); super.mouseUp(mx, my, button); }
  wheel(d) { this.list.wheel(d); }
  close() { this.game.screens.open(this.parent); }
}

// ---- ChatSelectionScreen
export class ChatSelectionScreen extends Screen {
  narrationTitle() { return tr('gui.chatSelection.title') + '. ' + tr('gui.chatSelection.context'); }
  constructor(game, parent, builder, onSelected) { super(game); this.parent = parent; this.builder = builder.copy(); this.onSelected = onSelected; }
  init() {
    const g = this.game, W = this.width, H = this.height, ctx = g.reporting, screen = this;
    this.contextLines = this.gui.font.wrap(tr('gui.chatSelection.context'), W - 16);
    const rowWidth = Math.min(350, W - 50);
    this.entries = []; this.previousHeading = null;
    const reported = this.builder.report.reportedProfileId;
    this.filler = new ChatSelectionLogFiller(ctx, (event) => hasSignatureFrom(event.message, reported));
    this.list = new (class extends SlotList {
      size() { return screen.entries.length; }
      drawSlot(gui, i, x, y, h, mx, my) { screen.drawEntry(gui, screen.entries[i], x, y, rowWidth, h, mx, my); }
      clicked(i) { return screen.clickEntry(screen.entries[i]); }
      scrollBarX() { return Math.trunc((W + rowWidth) / 2); }
    })(this, 40, H - 40 - (this.contextLines.length + 1) * 9, 16, { listWidth: rowWidth, selectionBox: false, noBackground: true });
    this.buttons.push(new Button(0, Math.trunc(W / 2) - 155, H - 32, 150, 20, tr('gui.back'), () => this.close()));
    this.done = new Button(1, Math.trunc(W / 2) - 155 + 160, H - 32, 150, 20, tr('gui.done'), () => { this.onSelected(this.builder); this.close(); });
    this.buttons.push(this.done);
    this.updateDone();
    this.extendLog();
    this.list.amountScrolled = this.list.maxScroll();
  }
  updateDone() { this.done.enabled = this.builder.report.reported.size > 0; }
  extendLog() { this.filler.fillNextPage(Math.ceil((this.list.bottom - this.list.top) / 16), this); }
  addToTop(entry) { const fromBottom = this.list.maxScroll() - this.list.amountScrolled; this.entries.unshift(entry); this.list.amountScrolled = Math.max(0, this.list.maxScroll() - fromBottom); }
  acceptMessage(id, event) {
    const canReport = hasSignatureFrom(event.message, this.builder.report.reportedProfileId), tag = chatTrustTag(event.trust, event.message.content);
    this.addToTop({ kind: 'message', id, text: event.content, tag, canReport });
    const time = new Date(event.message.timestamp).toLocaleTimeString(this.game.reporting.environment.locale, { hour: 'numeric', minute: '2-digit' });
    const heading = { kind: 'heading', sender: event.profile.uuid, profile: event.profile, text: tr('gui.chatSelection.heading', event.profile.name, '§7§o' + time), canReport };
    this.addToTop(heading);
    if (this.previousHeading && this.previousHeading.sender === heading.sender) { const at = this.entries.indexOf(this.previousHeading); if (at >= 0) { const fromBottom = this.list.maxScroll() - this.list.amountScrolled; this.entries.splice(at, 1); this.list.amountScrolled = Math.max(0, this.list.maxScroll() - fromBottom); } }
    this.previousHeading = heading;
  }
  acceptDivider(d) {
    this.addToTop({ kind: 'padding' });
    this.addToTop({ kind: 'divider', text: (d.yellow ? '§e' : '') + tr(d.key, ...d.args.map(String)) });
    this.addToTop({ kind: 'padding' });
    this.previousHeading = null;
  }
  clickEntry(e) { if (e?.kind !== 'message' || !e.canReport) return false; this.builder.toggleReported(e.id); this.updateDone(); return true; }
  drawEntry(gui, e, x, y, w, h, mx, my) {
    const g = this.game, font = gui.font;
    if (e.kind === 'message') {
      const reported = this.builder.isReported(e.id), hovered = mx >= x - 2 && mx < x + w - 2 && my >= y - 2 && my < y + h + 2 && this.list.inside(my, mx);
      if (hovered && e.canReport) {
        const x0 = this.list.left + Math.trunc((this.list.width - w) / 2), x1 = this.list.left + Math.trunc((this.list.width + w) / 2);
        gui.rect(x0, y - 2, x1, y + h + 2, 0xff808080); gui.rect(x0 + 1, y - 1, x1 - 1, y + h + 1, 0xff000000);
      }
      if (reported && e.canReport) gui.blit('gui/checkmark.png', x, y + Math.trunc((h - 8) / 2), 0, 0, 9, 8, 9, 8);
      const tx = x + 11, max = w - 11 - 4 - (e.tag?.icon ? 9 + 4 : 0);
      let text = e.text, cut = false;
      if (font.width(text) > max) { text = font.trimToWidth(text, max - font.width('...')) + '...'; cut = true; }
      font.draw(text, tx, y + 1 + Math.trunc((h - 9) / 2), 0xffffff, true, e.canReport ? 1 : 0xa0 / 255);
      if (e.tag?.icon) {
        const ix = tx + font.width(text) + 4, iy = y + Math.trunc((h - 9) / 2);
        gui.blit('gui/chat_tags.png', ix, iy, 0, 0, 9, 9, 32, 32);
        if (mx >= ix && mx <= ix + 9 && my >= iy && my <= iy + 9) this.tooltip = [tr(e.tag.key), ...(e.tag.original !== undefined ? ['§o' + e.tag.original] : [])];
      }
      if (cut && hovered) this.tooltip = font.wrap(e.text, w);
    } else if (e.kind === 'heading') {
      const fx = x - 12 - 4, fy = y + Math.trunc((h - 12) / 2), skin = gui.tex(g.entityRenderer?.skinImage?.(g.scoreboard?.players?.get(e.sender) || { uuid: e.sender, name: e.profile.name }));
      if (skin) { const k = skin.width / 64; gui.drawImage(skin, 8 * k, 8 * k, 8 * k, 8 * k, fx, fy, 12, 12); gui.drawImage(skin, 40 * k, 8 * k, 8 * k, 8 * k, fx, fy, 12, 12); }
      font.draw(e.text, x, y + 1 + Math.trunc((h - 9) / 2), 0xffffff, true, e.canReport ? 1 : 0xa0 / 255);
    } else if (e.kind === 'divider') {
      const right = x + w - 8, tw = font.width(e.text);
      gui.text(e.text, Math.trunc((x + right - tw) / 2), y + Math.trunc(h / 2) - 4, 0xa0a0a0, true);
    }
  }
  renderContent(gui, mx, my) {
    const W = this.width;
    this.tooltip = null;
    this.list.render(gui, mx, my);
    gui.textCentered(tr('gui.chatSelection.title'), Math.trunc(W / 2), 16, 0xffffff, true);
    gui.textCentered(tr('gui.chatSelection.selected', String(this.builder.report.reported.size), String(this.builder.limits.maxReportedMessageCount)), Math.trunc(W / 2), 16 + Math.trunc(9 * 3 / 2), 0xa0a0a0, true);
    this.contextLines.forEach((l, i) => gui.textCentered(l, Math.trunc(W / 2), this.list.bottom + 9 + i * 9, 0xffffff, true));
  }
  render(gui, mx, my, partial) { super.render(gui, mx, my, partial); if (this.tooltip) gui.tooltip(this.tooltip, mx, my); }
  scrolled(before) { if (this.list.maxScroll() > 1e-5 && this.list.amountScrolled <= 1e-5 && before !== this.list.amountScrolled) this.extendLog(); }
  mouseDown(mx, my, button) { const before = this.list.amountScrolled; const hit = this.list.mouseDown(mx, my, button); this.scrolled(before); return hit || super.mouseDown(mx, my, button); }
  mouseMove(mx, my) { const before = this.list.amountScrolled; this.list.mouseMove(mx, my); this.scrolled(before); }
  mouseUp(mx, my, button) { this.list.mouseUp(); super.mouseUp(mx, my, button); }
  wheel(d) { const before = this.list.amountScrolled; this.list.wheel(d); this.scrolled(before); }
  close() { this.game.screens.open(this.parent); }
}
