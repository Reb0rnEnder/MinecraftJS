import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bookshelfSlot774, bookshelfUse774 } from '../client/js/game/bookshelf-1.21.11.js';
import { Items } from '../client/js/game/items.js';
import { RegistryTags } from '../client/js/game/tags.js';
import { Interaction } from '../client/js/game/interaction.js';
import { createItemStack774 } from '../client/js/net/item-components-1.21.11.js';
import { initBlocks, findState, getStateProperties } from '../client/js/world/blocks.js';

const read = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const native = read('tools/fixtures/bookshelf-1.21.11.json');
const data = Object.fromEntries(['items', 'blocks', 'blockCollisionShapes'].map((n) => [n, read('client/data/' + n + '.json')]));
initBlocks(data.blocks, data.blockCollisionShapes);
const items = new Items({ data });
const tags = new RegistryTags();
const target = (row) => ({ type: 'block', x: -3, y: 64, z: 7, face: row.face, hit: row.point });

test('every bookshelf facing, row/column boundary and rejected face matches native getHitSlot', () => {
  for (const row of native.hits) {
    assert.equal(bookshelfSlot774(target(row), row.facing), row.slot, JSON.stringify(row));
  }
});

test('all native client bookshelf insertion/removal/empty-slot outcomes use server item tags', () => {
  const game = { items, tags };
  for (const row of native.uses) {
    const hit = native.hits[row.hit];
    const held = row.item === 'minecraft:air' ? null : createItemStack774(items.byName.get(row.item.slice(10)).id);
    const props = { facing: hit.facing, ['slot_' + hit.slot + '_occupied']: String(row.occupied) };
    const result = bookshelfUse774(game, target(hit), props, held);
    assert.equal(result !== null, row.consumes, JSON.stringify(row));
    assert.equal(result === true, row.swing, JSON.stringify(row));
  }
  assert.deepEqual(
    tags.registries.items.get('minecraft:bookshelf_books').map((id) => 'minecraft:' + items.name(id)).sort(),
    native.books.slice().sort()
  );
});

function fixture(item = 'book', occupied = false) {
  let state = findState('chiseled_bookshelf', { facing: 'south', slot_0_occupied: String(occupied) });
  const held = item ? createItemStack774(items.byName.get(item).id, 2) : null;
  const sent = [], sound = [];
  const g = {
    items,
    tags: new RegistryTags(),
    player: { sneaking: false },
    gameMode: 0,
    inventory: { held: () => held, getHand: (hand) => hand === 0 ? held : null, offhand: null },
    world: { getState: () => state },
    send: (p) => sent.push(p),
    sound: { play: (...a) => sound.push(a) },
    cooldownFraction: () => 0
  };
  const it = new Interaction(g);
  const hit = { type: 'block', x: 0, y: 0, z: 0, face: 3, hit: [0.2, 0.8, 1] };
  it.target = hit;
  return { g, it, hit, held, sent, sound, setState: (s) => { state = s; }, state: () => state };
}

test('one bookshelf click sends one block use, preserves authoritative occupancy/counts and swings only when native does', () => {
  for (const occupied of [false, true]) {
    for (const item of ['book', 'stone', null]) {
      const f = fixture(item, occupied), s = f.state();
      let swings = 0;
      f.it.swing = () => swings++;
      f.it._canPlaceBlockOnSide = () => { throw Error('front interaction must precede placement'); };
      f.it.rightClickMouse();
      assert.equal(f.sent.length, 1);
      assert.equal(swings, occupied || item === 'book' ? 1 : 0);
      assert.equal(f.state(), s);
      assert.equal(f.held?.count, item ? 2 : undefined);
      assert.equal(f.sound.length, 0);
      assert.equal(f.it.predictedBlocks.size, 0);
      assert.equal(f.it.predictedDoors.size, 0);
      // A server rejection/update must remain visible instead of being restored
      // by optimistic shelf occupancy or a second offhand interaction.
      f.setState(findState('chiseled_bookshelf', { facing: 'south', slot_0_occupied: String(!occupied) }));
      assert.equal(getStateProperties(f.state()).slot_0_occupied, String(!occupied));
    }
  }
});

test('server tag replacement, secondary use and the offhand default-use restriction remain native', () => {
  const f = fixture('stone'), props = getStateProperties(f.state());
  f.g.tags.replace({ items: { 'minecraft:bookshelf_books': [f.held.id] } });
  assert.equal(bookshelfUse774(f.g, f.hit, props, f.held), true);
  const book = createItemStack774(items.byName.get('book').id);
  assert.equal(bookshelfUse774(f.g, f.hit, props, book), 'consume');
  assert.equal(bookshelfUse774(f.g, f.hit, props, book, 1), null);
  assert.equal(bookshelfUse774(f.g, f.hit, props, f.held, 1), true);
  f.g.player.sneaking = true;
  let gate = 0;
  f.it._canPlaceBlockOnSide = () => { gate++; return false; };
  assert.equal(f.it.onPlayerRightClick(f.hit), false);
  assert.equal(gate, 1);
  assert.equal(f.sent.length, 0);
});
