// 1.20.3+ / 1.21.11 TickRateManager on the client: freeze/step state, the client tick length, and which entities freeze.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TickRateManager, clientTickMillis } from '../client/js/game/tick-rate.js';
import { Game } from '../client/js/game/game.js';

test('freezing stops game elements until steps are queued; each step runs one tick', () => {
  const m = new TickRateManager();
  m.tick();
  assert.equal(m.runsNormally(), true);
  m.setFrozen(true);
  m.tick();
  assert.equal(m.runsNormally(), false);
  m.setFrozenTicksToRun(2);
  m.tick();
  assert.equal(m.runsNormally(), true);
  m.tick();
  assert.equal(m.runsNormally(), true);
  m.tick();
  assert.equal(m.runsNormally(), false);
  m.setFrozen(false);
  m.tick();
  assert.equal(m.runsNormally(), true);
});

test('client ticks follow a slower server rate, never a faster one, and stay at 50 ms while frozen', () => {
  const m = new TickRateManager();
  m.setTickRate(5);
  m.tick();
  assert.equal(clientTickMillis(m, true), 200);
  m.setTickRate(100);
  assert.equal(clientTickMillis(m, true), 50);
  m.setTickRate(0.2);
  assert.equal(m.tickrate, 1);
  m.setTickRate(5);
  m.setFrozen(true);
  m.tick();
  assert.equal(clientTickMillis(m, true), 50);
  assert.equal(clientTickMillis(m, false), 50);
});

test('frozen: everything but players and entities carrying a player', () => {
  const m = new TickRateManager();
  m.setFrozen(true);
  m.tick();
  assert.equal(m.isEntityFrozen({ kind: 'mob' }, false), true);
  assert.equal(m.isEntityFrozen({ kind: 'player' }, false), false);
  assert.equal(m.isEntityFrozen({ kind: 'boat' }, true), false);
  m.setFrozen(false);
  m.tick();
  assert.equal(m.isEntityFrozen({ kind: 'mob' }, false), false);
});

test('a missing or invalid rate never stalls the client tick loop', () => {
  const m = new TickRateManager();
  m.setTickRate(undefined);
  m.setTickRate(NaN);
  assert.equal(m.tickrate, 20);
  assert.equal(clientTickMillis(m, true), 50);
  m.setFrozenTicksToRun(undefined);
  assert.equal(m.frozenTicksToRun, 0);
});

test('Game packet handlers accept 1.21.11 ticking state and step_tick packets', () => {
  const g = { tickRate: new TickRateManager(), serverStepTicks: 0 };
  Game.prototype.on_set_ticking_state.call(g, { tick_rate: 10, is_frozen: true });
  assert.equal(g.tickRate.tickrate, 10);
  assert.equal(g.tickRate.frozen, true);
  Game.prototype.on_step_tick.call(g, { tick_steps: 3 });
  assert.equal(g.serverStepTicks, 3);
  assert.equal(g.tickRate.frozenTicksToRun, 3);
});
