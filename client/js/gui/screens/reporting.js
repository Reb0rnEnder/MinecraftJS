// Native 1.20.6 player reporting screens (net.minecraft.client.gui.screens.reporting): ReportPlayerScreen, the
// chat/skin/name report forms (AbstractReportScreen with its discard warning and send flow), ChatSelectionScreen,
// ReportReasonSelectionScreen and GenericWaitingScreen, plus ReportingContext.draftReportHandled.
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

// ---- LinearLayout / FrameLayout arithmetic: elements are { w, h, place(x, y) }
const widget = (o, w = o.w, h = o.h) => ({ w, h, place(x, y) { o.x = x; o.y = y; } });
const label = (gui, text, out = {}) => Object.assign(out, { text, w: gui.font.width(text), h: 9, place(x, y) { out.x = x; out.y = y; } });
const spacer = (h) => ({ w: 0, h, place() {} });
// cells: [element, { t, b, l, r, align: 0 | 0.5 }]
function linear(vertical, spacing, cells, align = 0) {
  const items = cells.map((c) => (Array.isArray(c) ? { el: c[0], ...c[1] } : { el: c })).map((c) => ({ t: 0, b: 0, l: 0, r: 0, align, ...c }));
  const cw = (c) => c.el.w + c.l + c.r, ch = (c) => c.el.h + c.t + c.b;
  const w = vertical ? Math.max(0, ...items.map(cw)) : items.reduce((n, c, i) => n + cw(c) + (i ? spacing : 0), 0);
  const h = vertical ? items.reduce((n, c, i) => n + ch(c) + (i ? spacing : 0), 0) : Math.max(0, ...items.map(ch));
  return { w, h, place(x, y) {
    let at = vertical ? y : x;
    for (const c of items) {
      if (vertical) { c.el.place(x + c.l + Math.trunc(c.align * (w - c.el.w - c.l - c.r)), at + c.t); at += ch(c) + spacing; }
      else { c.el.place(at + c.l, y + c.t + Math.trunc(c.align * (h - c.el.h - c.t - c.b))); at += cw(c) + spacing; }
    }
  } };
}
const column = (spacing, cells, align) => linear(true, spacing, cells, align);
const row = (spacing, cells, align) => linear(false, spacing, cells, align);
const centerIn = (layout, w, h) => layout.place(Math.trunc((w - layout.w) * 0.5), Math.trunc((h - layout.h) * 0.5));
// CommonLayouts.labeledElement: label above, 4 pixels apart
const labeled = (gui, el, text, labels, cell = {}) => column(4, [label(gui, text, labels[labels.push({}) - 1]), [el, cell]]);

const buttonTooltip = (screen, gui, mx, my) => {
  for (const b of screen.buttons) if (b.visible !== false && b.tooltip && b.hovered(mx, my)) { gui.tooltip(gui.font.wrap(b.tooltip, 170), mx, my); return; }
};
const reasonTitle = (r) => tr('gui.abuseReport.reason.' + r);

// ReportingContext.draftReportHandled: an existing draft asks to continue editing it or discard it first
export function draftReportHandled(game, parent, proceed, quitting = false) {
  const ctx = game.reporting;
  if (!ctx?.draft) { proceed(); return; }
  const draft = ctx.draft.copy();
  game.screens.open(new ConfirmScreen(game, (edit) => {
    ctx.setDraft(null);
    if (edit) game.screens.open(reportScreen(game, parent, draft)); else proceed();
  }, tr(quitting ? 'gui.abuseReport.draft.quittotitle.title' : 'gui.abuseReport.draft.title'), tr(quitting ? 'gui.abuseReport.draft.quittotitle.content' : 'gui.abuseReport.draft.content'),
  tr('gui.abuseReport.draft.edit'), tr(quitting ? 'gui.abuseReport.draft.quittotitle.discard' : 'gui.abuseReport.draft.discard')));
}
const reportScreen = (game, parent, builder) => builder.type === 'chat' ? new ChatReportScreen(game, parent, builder) : builder.type === 'skin' ? new SkinReportScreen(game, parent, builder) : new NameReportScreen(game, parent, builder);

// ---- ReportPlayerScreen: chat / skin / name choices for one social-screen row
export class ReportPlayerScreen extends Screen {
  narrationTitle() { return tr('gui.abuseReport.title') + '. ' + tr('gui.abuseReport.message'); }
  constructor(game, parent, player) { super(game); this.parent = parent; this.player = player; }
  init() {
    const gui = this.gui, g = this.game, p = this.player, ctx = g.reporting;
    this.labels = [];
    const chat = new Button(0, 0, 0, 150, 20, tr('gui.abuseReport.type.chat'), () => g.screens.open(new ChatReportScreen(g, this.parent, new ReportBuilder('chat', p.uuid, {}, ctx.limits))));
    if (!p.chatReportable) { chat.enabled = false; chat.tooltip = tr('gui.socialInteractions.tooltip.report.not_reportable'); }
    else if (!p.hasRecentMessages) { chat.enabled = false; chat.tooltip = tr('gui.socialInteractions.tooltip.report.no_messages', p.name); }
    const skin = new Button(1, 0, 0, 150, 20, tr('gui.abuseReport.type.skin'), () => g.screens.open(new SkinReportScreen(g, this.parent, new ReportBuilder('skin', p.uuid, { skin: p.skin }, ctx.limits))));
    const name = new Button(2, 0, 0, 150, 20, tr('gui.abuseReport.type.name'), () => g.screens.open(new NameReportScreen(g, this.parent, new ReportBuilder('name', p.uuid, { name: p.name }, ctx.limits))));
    const cancel = new Button(3, 0, 0, 150, 20, tr('gui.cancel'), () => this.close());
    // MultiLineTextWidget without a width limit: explicit lines only, centred
    const lines = tr('gui.abuseReport.message').split('\n'), message = { lines, w: Math.max(...lines.map((l) => gui.font.width(l))), h: lines.length * 9 };
    message.place = (x, y) => { message.x = x; message.y = y; };
    this.message = message;
    centerIn(column(6, [[label(gui, tr('gui.abuseReport.title'), this.labels[this.labels.push({}) - 1]), { b: 6 }], [message, { b: 6 }], widget(chat), widget(skin), widget(name), spacer(20), widget(cancel)], 0.5), this.width, this.height);
    this.buttons.push(chat, skin, name, cancel);
  }
  renderContent(gui) {
    for (const l of this.labels) gui.text(l.text, l.x, l.y, 0xffffff, true);
    const m = this.message;
    m.lines.forEach((line, i) => gui.text(line, m.x + Math.trunc((m.w - gui.font.width(line)) / 2), m.y + i * 9, 0xffffff, true));
  }
  render(gui, mx, my, partial) { super.render(gui, mx, my, partial); buttonTooltip(this, gui, mx, my); }
  close() { this.game.screens.open(this.parent); }
}

// ---- AbstractReportScreen
class AbstractReportScreen extends Screen {
  constructor(game, parent, builder, title) { super(game); this.parent = parent; this.builder = builder; this.title = title; }
  narrationTitle() { return this.title; }
  get ctx() { return this.game.reporting; }
  commentBox(w) {
    const box = new MultiLineEditBox(this.gui, 0, 0, w, 9 * 8, tr('gui.abuseReport.describe'), tr('gui.abuseReport.comments'), { limit: this.ctx.limits.maxOpinionCommentsLength, value: this.builder.comments });
    box.onChange = (s) => { this.builder.setComments(s); this.onReportChanged(); };
    this.fields.push(box);
    return box;
  }
  reasonButton(w) {
    return new Button(10, 0, 0, w, 20, () => (this.builder.reason ? reasonTitle(this.builder.reason) : tr('gui.abuseReport.select_reason')),
      () => this.game.screens.open(new ReportReasonSelectionScreen(this.game, this, this.builder.reason, (r) => { this.builder.setReason(r); })));
  }
  footer() {
    const back = new Button(20, 0, 0, 120, 20, tr('gui.back'), () => this.close());
    this.send = new Button(21, 0, 0, 120, 20, tr('gui.abuseReport.send'), () => this.sendReport());
    this.buttons.push(back, this.send);
    return row(8, [widget(back), widget(this.send)]);
  }
  onReportChanged() {
    const problem = this.builder.checkBuildable();
    if (this.send) { this.send.enabled = !problem; this.send.tooltip = problem ? tr(problem) : null; }
  }
  // sendReport: build, then send while a cancellable waiting screen shows; success clears the draft
  sendReport() {
    const g = this.game, built = this.builder.build(this.ctx);
    if (built.error) { this.showError(tr(built.error)); return; }
    let cancelled = false;
    const json = abuseReportRequestJson(built, this.ctx.environment);
    g.screens.open(GenericWaitingScreen.waiting(g, '§l' + tr('gui.abuseReport.sending.title'), tr('gui.cancel'), () => { cancelled = true; g.screens.open(this); }));
    g.accounts.reportAbuse(json).then(() => {
      if (cancelled) return;
      this.ctx.setDraft(null); this.sent = true;
      g.screens.open(GenericWaitingScreen.completed(g, '§l' + tr('gui.abuseReport.sent.title'), tr('gui.abuseReport.report_sent_msg'), tr('gui.done'), () => g.screens.close()));
    }, (e) => {
      if (cancelled) return;
      console.error('Encountered error while sending abuse report', e);
      const k = reportErrorKey(e);
      this.showError(tr(k.key, ...(k.args || [])));
    });
  }
  showError(text) { const g = this.game; g.screens.open(GenericWaitingScreen.completed(g, '§l' + tr('gui.abuseReport.error.title'), '§c' + text.replace(/\n/g, '\n§c'), tr('gui.back'), () => g.screens.open(this))); }
  // removed(): an unfinished report stays as the draft
  onClose() { if (!this.sent && this.builder.hasContent()) this.ctx.setDraft(this.builder.copy()); }
  close() {
    if (this.builder.hasContent()) this.game.screens.open(new DiscardReportWarningScreen(this.game, this));
    else this.game.screens.open(this.parent);
  }
  render(gui, mx, my, partial) { super.render(gui, mx, my, partial); for (const l of this.labels || []) gui.text(l.text, l.x, l.y, l.color ?? 0xffffff, true); buttonTooltip(this, gui, mx, my); }
  mouseMove(mx, my) { this.mx = mx; this.my = my; if (this.dragBox) { this.dragBox.drag(mx, my, my - (this.lastY ?? my)); this.lastY = my; } }
  mouseDown(mx, my, button) {
    const box = this.fields[0];
    if (button === 0 && box?.click(mx, my, this.gui, !!(this.game.input?.down?.has('ShiftLeft') || this.game.input?.down?.has('ShiftRight')))) { box.focused = false; box.setFocused(true); changeFocus(this, box); this.dragBox = box; this.lastY = my; return true; }
    return super.mouseDown(mx, my, button);
  }
  mouseUp(mx, my, button) { this.dragBox?.mouseUp(); this.dragBox = null; super.mouseUp(mx, my, button); }
  wheel(d) { const box = this.fields[0]; if (box?.inside(this.mx ?? -1, this.my ?? -1)) box.wheel(d); }
}

export class ChatReportScreen extends AbstractReportScreen {
  constructor(game, parent, builder) { super(game, parent, builder, tr('gui.chatReport.title')); }
  init() {
    const gui = this.gui, g = this.game; this.labels = [];
    const select = new Button(11, 0, 0, 280, 20, () => (this.builder.report.reported.size ? tr('gui.chatReport.selected_chat', String(this.builder.report.reported.size)) : tr('gui.chatReport.select_chat')),
      () => g.screens.open(new ChatSelectionScreen(g, this, this.builder, (b) => { this.builder = b; })));
    const reason = this.reasonButton(280), box = this.commentBox(280);
    this.buttons.push(select, reason);
    centerIn(column(8, [label(gui, this.title, this.labels[this.labels.push({}) - 1]), widget(select), labeled(gui, widget(reason), tr('gui.abuseReport.observed_what'), this.labels), labeled(gui, widget(box), tr('gui.abuseReport.more_comments'), this.labels, { b: 12 }), this.footer()], 0.5), this.width, this.height);
    this.onReportChanged();
  }
}

export class NameReportScreen extends AbstractReportScreen {
  constructor(game, parent, builder) { super(game, parent, builder, tr('gui.abuseReport.name.title')); }
  init() {
    const gui = this.gui; this.labels = [];
    const reporting = label(gui, tr('gui.abuseReport.name.reporting', '§e' + this.builder.report.name + '§r'), this.labels[this.labels.push({}) - 1]);
    const box = this.commentBox(280);
    centerIn(column(8, [label(gui, this.title, this.labels[this.labels.push({}) - 1]), [reporting, { t: 8, b: 8, align: 0 }], labeled(gui, widget(box), tr('gui.abuseReport.more_comments'), this.labels, { b: 12 }), this.footer()], 0.5), this.width, this.height);
    this.onReportChanged();
  }
}

export class SkinReportScreen extends AbstractReportScreen {
  constructor(game, parent, builder) { super(game, parent, builder, tr('gui.abuseReport.skin.title')); this.rotX = -5; this.rotY = 30; }
  init() {
    const gui = this.gui; this.labels = [];
    const reason = this.reasonButton(178), box = this.commentBox(178);
    this.buttons.push(reason);
    this.skinBox = { w: 85, h: 120 }; this.skinBox.place = (x, y) => { this.skinBox.x = x; this.skinBox.y = y; };
    const form = column(8, [labeled(gui, widget(reason), tr('gui.abuseReport.observed_what'), this.labels), labeled(gui, widget(box), tr('gui.abuseReport.more_comments'), this.labels, { b: 12 })]);
    centerIn(column(8, [label(gui, this.title, this.labels[this.labels.push({}) - 1]), row(8, [this.skinBox, form], 0.5), this.footer()], 0.5), this.width, this.height);
    this.onReportChanged();
  }
  renderContent(gui, mx, my, partial) {
    const b = this.skinBox, er = this.game.entityRenderer;
    if (!er?.drawPlayerSkinPreview?.(gui, b.x, b.y, b.w, b.h, this.rotX, this.rotY, this.builder.report.skin, partial)) {
      // Without a model preview: the skin's face, scaled into the widget
      const skin = gui.tex(er?.skinImage?.(this.builder.report.skin?.player || { uuid: this.builder.report.reportedProfileId }));
      if (skin) { const k = skin.width / 64, s = 48; gui.drawImage(skin, 8 * k, 8 * k, 8 * k, 8 * k, b.x + (b.w - s) / 2, b.y + (b.h - s) / 2, s, s); }
    }
  }
  // PlayerSkinWidget: dragging turns the model (x clamped to +-50)
  mouseDown(mx, my, button) {
    const b = this.skinBox;
    if (button === 0 && mx >= b.x && mx < b.x + b.w && my >= b.y && my < b.y + b.h) { this.turning = { x: mx, y: my }; return true; }
    return super.mouseDown(mx, my, button);
  }
  mouseMove(mx, my) {
    if (this.turning) { this.rotX = Math.max(-50, Math.min(50, this.rotX - (my - this.turning.y) * 2.5)); this.rotY += (mx - this.turning.x) * 2.5; this.turning = { x: mx, y: my }; return; }
    super.mouseMove(mx, my);
  }
  mouseUp(mx, my, button) { this.turning = null; super.mouseUp(mx, my, button); }
}

// ---- AbstractReportScreen.DiscardReportWarningScreen (WarningScreen layout, Escape does nothing)
class DiscardReportWarningScreen extends Screen {
  constructor(game, report) { super(game); this.report = report; }
  narrationTitle() { return tr('gui.abuseReport.discard.title') + '. ' + tr('gui.abuseReport.discard.content'); }
  init() {
    const gui = this.gui, g = this.game, r = this.report;
    this.title = '§l' + tr('gui.abuseReport.discard.title');
    const lines = tr('gui.abuseReport.discard.content').split('\n').flatMap((l) => gui.font.wrap(l, this.width - 100));
    this.text = { lines, w: Math.min(this.width - 100, Math.max(...lines.map((l) => gui.font.width(l)))), h: lines.length * 9 };
    this.text.place = (x, y) => { this.text.x = x; this.text.y = y; };
    const ret = new Button(0, 0, 0, 150, 20, tr('gui.abuseReport.discard.return'), () => g.screens.open(r));
    const draft = new Button(1, 0, 0, 150, 20, tr('gui.abuseReport.discard.draft'), () => { r.ctx.setDraft(r.builder.copy()); r.sent = true; g.screens.open(r.parent); });
    const discard = new Button(2, 0, 0, 150, 20, tr('gui.abuseReport.discard.discard'), () => { r.ctx.setDraft(null); r.sent = true; g.screens.open(r.parent); });
    this.titleLabel = label(gui, this.title);
    const buttons = column(8, [row(8, [widget(ret), widget(draft)]), widget(discard)], 0.5);
    centerIn(column(8, [this.titleLabel, [this.text, { t: 12, b: 12, l: 12, r: 12 }], column(8, [buttons], 0.5)], 0.5), this.width, this.height);
    this.buttons.push(ret, draft, discard);
  }
  renderContent(gui) {
    gui.text(this.title, this.titleLabel.x, this.titleLabel.y, 0xffffff, true);
    const { x, y, w, h, lines } = this.text, p = 12, o = 0xffa0a0a0;
    // FocusableTextWidget: black fill with a grey outline around the padded text
    gui.rect(x - p + 1, y - p, x + w + p, y + h + p, 0xff000000);
    gui.rect(x - p, y - p, x + w + p, y - p + 1, o); gui.rect(x - p, y + h + p - 1, x + w + p, y + h + p, o); gui.rect(x - p, y - p + 1, x - p + 1, y + h + p - 1, o); gui.rect(x + w + p - 1, y - p + 1, x + w + p, y + h + p - 1, o);
    lines.forEach((l, i) => gui.text(l, x, y + i * 9, 0xffffff, true));
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

// ---- ReportReasonSelectionScreen (HeaderAndFooterLayout: 33-pixel header and footer)
export class ReportReasonSelectionScreen extends Screen {
  narrationTitle() { return tr('gui.abuseReport.reason.title'); }
  constructor(game, parent, current, onSelected) { super(game); this.parent = parent; this.selected = current; this.onSelected = onSelected; }
  init() {
    const g = this.game, W = this.width, H = this.height, head = 33, foot = 33;
    const listHeight = H - head - foot - 62 - 8;
    const screen = this;
    this.list = new (class extends SlotList {
      size() { return REPORT_REASONS.length; }
      isSelected(i) { return REPORT_REASONS[i] === screen.selected; }
      drawSlot(gui, i, x, y, h) { gui.text(reasonTitle(REPORT_REASONS[i]), x + 1, y + Math.trunc((h - 9) / 2) + 1, 0xffffff, true); }
      clicked(i) { screen.selected = REPORT_REASONS[i]; return true; }
    })(this, head, head + listHeight, 18, { listWidth: 320 });
    const read = new Button(0, 0, 0, 150, 20, tr('gui.abuseReport.read_info'), () => g.screens.open(new ConfirmLinkScreen(g, this, 'https://aka.ms/aboutjavareporting')));
    const done = new Button(1, 0, 0, 150, 20, tr('gui.done'), () => { if (this.selected) this.onSelected(this.selected); g.screens.open(this.parent); });
    const footer = row(8, [widget(read), widget(done)]);
    footer.place(Math.trunc((W - footer.w) / 2), H - foot + Math.trunc((foot - footer.h) / 2));
    this.buttons.push(read, done);
  }
  renderContent(gui, mx, my) {
    const W = this.width, H = this.height;
    gui.textCentered(tr('gui.abuseReport.reason.title'), Math.trunc(W / 2), Math.trunc((33 - 9) / 2), 0xffffff, true);
    this.list.render(gui, mx, my);
    const left = Math.trunc((W - 320) / 2), right = Math.trunc((W + 320) / 2), bottom = H - 33 - 4, top = bottom - 62;
    gui.rect(left, top, right, bottom, 0xff000000);
    gui.rect(left, top, right, top + 1, 0xffffffff); gui.rect(left, bottom - 1, right, bottom, 0xffffffff); gui.rect(left, top + 1, left + 1, bottom - 1, 0xffffffff); gui.rect(right - 1, top + 1, right, bottom - 1, 0xffffffff);
    gui.text(tr('gui.abuseReport.reason.description'), left + 4, top + 4, 0xffffff, false);
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
    const g = this.game, W = this.width, H = this.height, ctx = g.reporting;
    this.contextLines = this.gui.font.wrap(tr('gui.chatSelection.context'), W - 16);
    const top = 40, height = H - (this.contextLines.length + 1) * 9 - 80, rowWidth = Math.min(350, W - 50);
    this.entries = []; this.previousHeading = null;
    const reported = this.builder.report.reportedProfileId;
    this.filler = new ChatSelectionLogFiller(ctx, (event) => hasSignatureFrom(event.message, reported));
    const screen = this;
    this.list = new (class extends SlotList {
      size() { return screen.entries.length; }
      drawSlot(gui, i, x, y, h, mx, my) { screen.drawEntry(gui, screen.entries[i], x, y, rowWidth, h, mx, my); }
      clicked(i) { return screen.clickEntry(screen.entries[i]); }
    })(this, top, top + height, 16, { listWidth: rowWidth, selectionBox: false });
    this.buttons.push(new Button(0, Math.trunc(W / 2) - 155, H - 32, 150, 20, tr('gui.back'), () => this.close()));
    this.done = new Button(1, Math.trunc(W / 2) - 155 + 160, H - 32, 150, 20, tr('gui.done'), () => { this.onSelected(this.builder); this.close(); });
    this.buttons.push(this.done);
    this.updateDone();
    this.extendLog();
    this.list.amountScrolled = this.list.maxScroll();
  }
  updateDone() { this.done.enabled = this.builder.report.reported.size > 0; }
  extendLog() { this.filler.fillNextPage(Math.ceil((this.list.bottom - this.list.top) / 16), this); }
  // ChatSelectionList.addEntryToTop keeps the view where it was
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
  clickEntry(e) {
    if (e?.kind !== 'message' || !e.canReport) return false;
    this.builder.toggleReported(e.id); this.updateDone(); return true;
  }
  drawEntry(gui, e, x, y, w, h, mx, my) {
    const g = this.game, font = gui.font;
    if (e.kind === 'message') {
      const reported = this.builder.isReported(e.id), hovered = mx >= x - 2 && mx < x + w - 2 && my >= y - 2 && my < y + h + 2 && this.list.inside(my, mx);
      if (hovered && e.canReport) {
        const x0 = this.list.left + Math.trunc((this.list.width - w) / 2), x1 = this.list.left + Math.trunc((this.list.width + w) / 2);
        gui.rect(x0, y - 2, x1, y + h + 2, 0xff808080); gui.rect(x0 + 1, y - 1, x1 - 1, y + h + 1, 0xff000000);
      }
      if (reported && e.canReport) gui.sprite('icon/checkmark', x, y + Math.trunc((h - 8) / 2), 9, 8);
      const tx = x + 11, max = w - 11 - 4 - (e.tag?.icon ? 9 + 4 : 0);
      let text = e.text, cut = false;
      if (font.width(text) > max) { text = font.trimToWidth(text, max - font.width('...')) + '...'; cut = true; }
      font.draw(text, tx, y + 1 + Math.trunc((h - 9) / 2), 0xffffff, true, e.canReport ? 1 : 0xa0 / 255);
      const ix = tx + font.width(text) + 4;
      if (e.tag?.icon) {
        const iy = y + Math.trunc((h - 9) / 2);
        gui.sprite('icon/chat_modified', ix, iy, 9, 9);
        if (mx >= ix && mx <= ix + 9 && my >= iy && my <= iy + 9) this.tooltip = [tr(e.tag.key), ...(e.tag.original !== undefined ? ['§o' + e.tag.original] : [])];
      }
      if (cut && hovered) this.tooltip = font.wrap(e.text, w);
    } else if (e.kind === 'heading') {
      const fx = x - 12 + 4, fy = y + Math.trunc((h - 12) / 2), skin = gui.tex(g.entityRenderer?.skinImage?.(g.scoreboard?.players?.get(e.sender) || { uuid: e.sender, name: e.profile.name }));
      if (skin) { const k = skin.width / 64; gui.drawImage(skin, 8 * k, 8 * k, 8 * k, 8 * k, fx, fy, 12, 12); gui.drawImage(skin, 40 * k, 8 * k, 8 * k, 8 * k, fx, fy, 12, 12); }
      gui.font.draw(e.text, fx + 12 + 4, y + 1 + Math.trunc((h - 9) / 2), 0xffffff, true, e.canReport ? 1 : 0xa0 / 255);
    } else if (e.kind === 'divider') {
      const right = x + w - 8, tw = font.width(e.text);
      gui.text(e.text, Math.trunc((x + right - tw) / 2), y + Math.trunc(h / 2) - 4, 0xa0a0a0, true);
    }
  }
  renderContent(gui, mx, my) {
    const W = this.width;
    this.tooltip = null;
    this.list.render(gui, mx, my);
    gui.textCentered(tr('gui.chatSelection.title'), Math.trunc(W / 2), 10, 0xffffff, true);
    gui.textCentered(tr('gui.chatSelection.selected', String(this.builder.report.reported.size), String(this.builder.limits.maxReportedMessageCount)), Math.trunc(W / 2), 16 + Math.trunc(9 * 3 / 2), 0xffffff, true);
    const footerTop = this.list.bottom + 9;
    this.contextLines.forEach((l, i) => gui.textCentered(l, Math.trunc(W / 2), footerTop + i * 9, 0xffffff, true));
  }
  render(gui, mx, my, partial) { super.render(gui, mx, my, partial); if (this.tooltip) gui.tooltip(this.tooltip, mx, my); }
  scrolled(before) { if (this.list.maxScroll() > 1e-5 && this.list.amountScrolled <= 1e-5 && before !== this.list.amountScrolled) this.extendLog(); }
  mouseDown(mx, my, button) { const before = this.list.amountScrolled; const hit = this.list.mouseDown(mx, my, button); this.scrolled(before); return hit || super.mouseDown(mx, my, button); }
  mouseMove(mx, my) { const before = this.list.amountScrolled; this.list.mouseMove(mx, my); this.scrolled(before); }
  mouseUp(mx, my, button) { this.list.mouseUp(); super.mouseUp(mx, my, button); }
  wheel(d) { const before = this.list.amountScrolled; this.list.wheel(d); this.scrolled(before); }
  close() { this.game.screens.open(this.parent); }
}
