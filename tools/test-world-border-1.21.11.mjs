import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { WorldBorder774 } from '../client/js/world/world-border-1.21.11.js';
import { decodePlayBody774 } from '../client/js/net/play-codec-1.21.11.js';
import { Writer774 } from '../client/js/net/configuration-1.21.11.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/border-1.21.11.json', import.meta.url)));
const approx = (a,b) => assert.ok(Math.abs(a-b) < 1e-6, `${a} != ${b}`);

test('1.21.11 world-border tick progression matches pinned Java oracle', () => {
  for (const c of fixture.cases) {
    const border = new WorldBorder774();
    border.x = 4; border.z = -3;
    border.lerp(100, c.target, BigInt(c.duration));
    for (const sample of c.samples) {
      assert.equal(border.size, sample.getSize);
      assert.equal(Number(border.remaining), sample.getLerpTime);
      approx(border.speed, sample.getLerpSpeed);
      for (const [i,p] of [0,.25,.5,1].entries()) {
        const got = border.bounds(p), expected = sample.bounds[i];
        got.forEach((v,j) => approx(v, expected[j]));
      }
      border.tick();
    }
  }
});

test('long border lerp packet preserves exact VarLong tick count', () => {
  const packet = decodePlayBody774('world_border_lerp_size', new Writer774().f64(100).f64(200).varlong(5000000000n).build());
  assert.equal(packet.speed, 5000000000);
  const huge = decodePlayBody774('world_border_lerp_size', new Writer774().f64(100).f64(200).varlong(9007199254740993n).build());
  assert.equal(huge.speed, 9007199254740993n);
});

test('border tick is discrete and leaves interpolation to frame partial', () => {
  const b = new WorldBorder774(); b.lerp(100, 200, 4n);
  b.tick();
  assert.equal(b.size, 125);
  assert.deepEqual(b.bounds(0), [-50,-50,50,50]);
  assert.deepEqual(b.bounds(.5), [-56.25,-56.25,56.25,56.25]);
  assert.deepEqual(b.bounds(1), [-62.5,-62.5,62.5,62.5]);
});
