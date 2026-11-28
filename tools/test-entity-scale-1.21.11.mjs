// minecraft:scale on remote entities: attribute value with modifiers, clamped 0.0625-16, scaling hitbox and eye
// height on top of whatever metadata (baby, pose, size) sets, without compounding.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attributeValue, applyEntityScale, setScaleAttribute } from '../client/js/game/entity-scale.js';

const f = Math.fround;

test('modifiers and clamping', () => {
  assert.equal(attributeValue({ value: 1, modifiers: [{ operation: 0, amount: 1 }, { operation: 1, amount: 0.5 }, { operation: 2, amount: 1 }] }), (2 + 1) * 2);
  const e = { width: 0.6, height: 1.95, eyeHeight: 1.74 };
  setScaleAttribute(e, { value: 40, modifiers: [] });
  assert.equal(e.attrScale, 16);
});

test('scale multiplies the unscaled dimensions, follows later metadata changes and never compounds', () => {
  const e = { width: 0.6, height: 1.95, eyeHeight: 1.74 };
  setScaleAttribute(e, { value: 2, modifiers: [] });
  assert.deepEqual([e.width, e.height, e.eyeHeight], [f(1.2), f(3.9), f(3.48)]);
  applyEntityScale(e);
  applyEntityScale(e);
  assert.deepEqual([e.width, e.height], [f(1.2), f(3.9)], 'idempotent');
  e.width = 0.3;
  e.height = 0.975;
  e.eyeHeight = 0.87;
  applyEntityScale(e);
  assert.deepEqual([e.width, e.height], [f(0.6), f(1.95)], 'a baby update is rescaled');
  setScaleAttribute(e, { value: 1, modifiers: [] });
  assert.deepEqual([e.width, e.height], [f(0.3), f(0.975)]);
});
