// 26.3's play adapter emits itemId from the native cooldown group; the shared handler still accepts
// the 1.20.6 itemID spelling. Guard both sides so a renamed field cannot silently store undefined.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = (p) => readFileSync(new URL('../client/js/' + p, import.meta.url), 'utf8');
const game = read('game/game.js'), adapter = read('net/play-adapter-26.3.js');
test('26.3 cooldown adapter maps the native cooldown group to itemId', () => {
  assert.match(adapter, /cooldown\(packet\)[\s\S]{0,300}return \{itemId,cooldownTicks:packet\.duration\}/);
});
test('the shared cooldown handler accepts both itemID and itemId', () => {
  assert.match(game, /p\.itemID \?\? p\.itemId/);
});
test('26.3 ticking handlers read the native camelCase fields with snake_case fallbacks', () => {
  assert.match(game, /p\.tickRate \?\? p\.tick_rate/);
  assert.match(game, /p\.isFrozen \?\? p\.is_frozen/);
  assert.match(game, /p\.tickSteps \?\? p\.tick_steps/);
});
