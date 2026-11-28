import { tr } from './i18n.js';

const BUNDLE_W = 96;
const SLOT_SIZE = 24;
const BAR_H = 13;
const BAR_FILL_W = 94;

// Native 1.21.11 ClientBundleTooltip: 4-column x 24px grid (max 12 shown, "+N" overflow badge),
// selected-slot highlight sprites, empty description wrap, and 96x13 progress bar sprites.
export function bundleTooltipLayout(data, gui = null) {
  const items = data?.items || [];
  if (!items.length) {
    const descLines = gui?.font ? gui.font.wrap(tr('item.minecraft.bundle.empty.description'), BUNDLE_W) : [tr('item.minecraft.bundle.empty.description'), ''];
    const descH = Math.max(1, descLines.length) * (gui?.font?.height || 9);
    return { empty: true, columns: 4, rows: 0, width: BUNDLE_W, height: descH + BAR_H + 8, descLines };
  }
  const shownCount = Math.min(12, items.length);
  const rows = Math.ceil(shownCount / 4);
  return { empty: false, columns: 4, rows, width: BUNDLE_W, height: rows * SLOT_SIZE + BAR_H + 8 };
}

export function drawBundleTooltip(gui, data, x, y, boxWidth = BUNDLE_W) {
  const layout = bundleTooltipLayout(data, gui);
  const left = x + Math.floor((boxWidth - BUNDLE_W) / 2);

  if (layout.empty) {
    const lineH = gui.font?.height || 9;
    let dy = y;
    for (const line of layout.descLines) {
      gui.text(line, left, dy, 0xffaaaaaa, true);
      dy += lineH;
    }
    _drawBar(gui, left, y + layout.descLines.length * lineH + 4, 0, tr('item.minecraft.bundle.empty'));
    return;
  }

  const items = data.items;
  const overflow = items.length > 12;
  const shown = items.slice(0, overflow ? 11 : 12);
  const selectedIndex = Number.isInteger(data.selectedIndex) ? data.selectedIndex : -1;
  const right = left + BUNDLE_W;
  const bottom = y + layout.rows * SLOT_SIZE;

  let slotOrdinal = 1;
  for (let r = 1; r <= layout.rows; r++) {
    for (let c = 1; c <= 4; c++) {
      const sx = right - c * SLOT_SIZE;
      const sy = bottom - r * SLOT_SIZE;
      if (overflow && r === 1 && c === 1) {
        const extra = items.slice(shown.length).reduce((sum, it) => sum + (it?.count ?? 1), 0);
        gui.textCentered('+' + extra, sx + 12, sy + 10, 0xffffffff, true);
        continue;
      }
      if (shown.length < slotOrdinal) continue;
      const idx = shown.length - slotOrdinal;
      const item = shown[idx];
      const selected = idx === selectedIndex;
      gui.sprite(selected ? 'container/bundle/slot_highlight_back' : 'container/bundle/slot_background', sx, sy, SLOT_SIZE, SLOT_SIZE);
      if (item && gui.game?.itemRenderer) {
        gui.game.itemRenderer.drawItem(gui, item, sx + 4, sy + 4, true);
      }
      if (selected) gui.sprite('container/bundle/slot_highlight_front', sx, sy, SLOT_SIZE, SLOT_SIZE);
      slotOrdinal++;
    }
  }

  const weight = data.weight ?? 0;
  const label = weight >= 64 ? tr('item.minecraft.bundle.full') : null;
  _drawBar(gui, left, y + layout.rows * SLOT_SIZE + 4, weight, label);
}

function _drawBar(gui, x, y, weight, label) {
  const full = weight >= 64;
  const fill = Math.max(0, Math.min(BAR_FILL_W, Math.floor((weight / 64) * BAR_FILL_W)));
  if (fill > 0) {
    gui.sprite(full ? 'container/bundle/bundle_progressbar_full' : 'container/bundle/bundle_progressbar_fill', x + 1, y, fill, BAR_H);
  }
  gui.sprite('container/bundle/bundle_progressbar_border', x, y, BUNDLE_W, BAR_H);
  if (label) gui.textCentered(label, x + 48, y + 3, 0xffffffff, true);
}
