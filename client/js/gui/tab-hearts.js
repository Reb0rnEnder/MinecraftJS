// PlayerTabOverlay.renderTablistHearts (1.20.2+ sprites) and its HealthState: hearts for a "hearts" list objective,
// blinking after a change (20 ticks when health drops, 10 when it rises) and catching up the displayed value once
// the score has been stable for 20 ticks; too narrow a column shows the value as text instead.
import {tr} from './i18n.js';

export class HealthState {
  constructor(health) { this.lastValue = health; this.displayedValue = health; this.lastUpdateTick = 0; this.blinkUntilTick = 0; }
  update(value, tick) {
    if (value !== this.lastValue) {
      this.blinkUntilTick = tick + (value < this.lastValue ? 20 : 10);
      this.lastValue = value;
      this.lastUpdateTick = tick;
    }
    if (tick - this.lastUpdateTick > 20) this.displayedValue = value;
  }
  isBlinking(tick) { return this.blinkUntilTick > tick && (this.blinkUntilTick - tick) % 6 >= 3; }
}

const ceilDiv = (a, b) => -Math.floor(-a / b);

export function renderTabHearts(gui, states, y, left, right, uuid, health, tick) {
  let state = states.get(uuid);
  if (!state) states.set(uuid, state = new HealthState(health));
  state.update(health, tick);
  const full = ceilDiv(Math.max(health, state.displayedValue), 2);
  const slots = Math.floor(Math.max(health, Math.max(state.displayedValue, 20)) / 2);
  const blink = state.isBlinking(tick);
  if (full <= 0) return;
  const step = Math.floor(Math.min((right - left - 4) / slots, 9));
  if (step <= 3) {
    // too narrow: the health as text, green to red
    const f = Math.min(1, Math.max(0, health / 20));
    const color = Math.trunc((1 - f) * 255) << 16 | Math.trunc(f * 255) << 8;
    const half = health / 2, label = tr('multiplayer.player.list.hp', [formatFloat(half)]);
    const text = right - gui.textWidth(label) >= left ? label : formatFloat(half);
    gui.text(text, Math.trunc((right + left - gui.textWidth(text)) / 2), y, color, true);
    return;
  }
  const container = blink ? 'hud/heart/container_blinking' : 'hud/heart/container';
  for (let i = full; i < slots; i++) gui.sprite(container, left + i * step, y, 9, 9);
  for (let i = 0; i < full; i++) {
    const x = left + i * step;
    gui.sprite(container, x, y, 9, 9);
    if (blink) {
      if (i * 2 + 1 < state.displayedValue) gui.sprite('hud/heart/full_blinking', x, y, 9, 9);
      if (i * 2 + 1 === state.displayedValue) gui.sprite('hud/heart/half_blinking', x, y, 9, 9);
    }
    if (i * 2 + 1 < health) gui.sprite(i >= 10 ? 'hud/heart/absorbing_full_blinking' : 'hud/heart/full', x, y, 9, 9);
    if (i * 2 + 1 === health) gui.sprite(i >= 10 ? 'hud/heart/absorbing_half_blinking' : 'hud/heart/half', x, y, 9, 9);
  }
}

// Float.toString for the values a health score can take
function formatFloat(v) { return Number.isInteger(v) ? v.toFixed(1) : String(v); }
