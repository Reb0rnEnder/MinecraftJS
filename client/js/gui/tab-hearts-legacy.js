// GuiPlayerTabOverlay.drawScoreboardValues / PlayerTabOverlay.renderTablistScore hearts (1.8 - 1.20.1): the per-player
// lastHealth/displayHealth/blink state from icons.png, reset whenever the list is opened again; the displayed value
// catches up after a second, the hearts blink for 20 ticks after damage or 10 after healing, and too narrow a
// column shows "<health / 2>hp" instead.
const ICONS = 'gui/icons.png';

export function renderLegacyTabHearts(gui, states, openedAt, y, left, right, uuid, health, tick, now) {
  let s = states.get(uuid);
  if (!s) states.set(uuid, s = { lastHealth: 0, displayHealth: 0, lastHealthTime: 0, blinkUntil: 0, openedAt: -1 });
  if (s.openedAt === openedAt) {
    if (health < s.lastHealth) { s.lastHealthTime = now; s.blinkUntil = tick + 20; }
    else if (health > s.lastHealth) { s.lastHealthTime = now; s.blinkUntil = tick + 10; }
  }
  if (now - s.lastHealthTime > 1000 || s.openedAt !== openedAt) { s.lastHealth = health; s.displayHealth = health; s.lastHealthTime = now; }
  s.openedAt = openedAt; s.lastHealth = health;
  const full = Math.ceil(Math.max(health, s.displayHealth) / 2);
  const slots = Math.max(Math.trunc(health / 2), Math.max(Math.trunc(s.displayHealth / 2), 10));
  const blink = s.blinkUntil > tick && Math.trunc((s.blinkUntil - tick) / 3) % 2 === 1;
  if (full <= 0) return;
  const f = Math.min(Math.fround((right - left - 4) / slots), 9);
  if (f > 3) {
    for (let i = full; i < slots; i++) gui.blit(ICONS, left + i * f, y, blink ? 25 : 16, 0, 9, 9);
    for (let i = 0; i < full; i++) {
      const x = left + i * f;
      gui.blit(ICONS, x, y, blink ? 25 : 16, 0, 9, 9);
      if (blink) {
        if (i * 2 + 1 < s.displayHealth) gui.blit(ICONS, x, y, 70, 0, 9, 9);
        if (i * 2 + 1 === s.displayHealth) gui.blit(ICONS, x, y, 79, 0, 9, 9);
      }
      if (i * 2 + 1 < health) gui.blit(ICONS, x, y, i >= 10 ? 160 : 52, 0, 9, 9);
      if (i * 2 + 1 === health) gui.blit(ICONS, x, y, i >= 10 ? 169 : 61, 0, 9, 9);
    }
  } else {
    const c = Math.min(1, Math.max(0, health / 20));
    const color = Math.trunc((1 - c) * 255) << 16 | Math.trunc(c * 255) << 8;
    let text = String(health / 2 % 1 === 0 ? (health / 2).toFixed(1) : health / 2);
    if (right - gui.textWidth(text + 'hp') >= left) text += 'hp';
    gui.text(text, Math.trunc((right + left) / 2) - Math.trunc(gui.textWidth(text) / 2), y, color, true);
  }
}
