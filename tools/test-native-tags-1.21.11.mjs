import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_TAGS } from '../client/js/game/default-tags.js';
import { RegistryTags } from '../client/js/game/tags.js';
import { initBlocks, blocksByName } from '../client/js/world/blocks.js';

const json = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url)));
const target = json('tools/port-1.21.11/target.json');
const registries = json('cache/port-1.21.11/generated/reports/registries.json');

test('all vanilla fallback tag IDs belong to this exact native registry', () => {
  assert.deepEqual(DEFAULT_TAGS.source, {
    version: target.minecraftVersion,
    clientJarSha1: target.downloads.client.sha1
  });
  for (const [kind, name] of [['blocks', 'block'], ['items', 'item'], ['fluids', 'fluid'], ['entities', 'entity_type']]) {
    const ids = new Set(Object.values(registries['minecraft:' + name].entries).map((e) => e.protocol_id));
    for (const [tag, values] of Object.entries(DEFAULT_TAGS[kind])) {
      assert.equal(new Set(values).size, values.length, tag + ' uniqueness');
      for (const id of values) assert.ok(ids.has(id), kind + ' ' + tag + ' ' + id);
    }
  }
});

test('log, climbable and 1.21.11 item/entity tags resolve native names instead of inherited IDs', () => {
  initBlocks(json('client/data/blocks.json'), null);
  const tags = new RegistryTags();
  assert.equal(tags.contains('blocks', 'minecraft:logs', blocksByName.oak_log.id), true);
  assert.equal(tags.contains('blocks', 'minecraft:logs', blocksByName.cherry_log.id), true);
  assert.equal(tags.contains('blocks', 'minecraft:logs', blocksByName.pale_oak_log.id), true);
  assert.equal(tags.contains('blocks', 'minecraft:logs', blocksByName.nether_gold_ore.id), false);
  for (const name of ['ladder', 'vine', 'scaffolding', 'weeping_vines', 'twisting_vines', 'cave_vines', 'cave_vines_plant']) {
    assert.ok(tags.contains('blocks', 'minecraft:climbable', blocksByName[name].id), name);
  }
  const eye = registries['minecraft:item'].entries['minecraft:spider_eye'].protocol_id;
  assert.ok(tags.contains('items', 'minecraft:armadillo_food', eye));
  const spear = registries['minecraft:item'].entries['minecraft:copper_spear'].protocol_id;
  assert.ok(tags.contains('items', 'minecraft:spears', spear));
  const nautilus = registries['minecraft:entity_type'].entries['minecraft:nautilus'].protocol_id;
  assert.ok(tags.contains('entities', 'minecraft:can_wear_nautilus_armor', nautilus));
});

test('server replacement overrides all fallback kinds and reverse indices', () => {
  const tags = new RegistryTags();
  tags.replace({ blocks: { 'custom:only': [3] }, items: { 'custom:item': [7] }, fluids: {}, entities: {} });
  assert.deepEqual(tags.forEntry('blocks', 3), ['custom:only']);
  assert.equal(tags.contains('blocks', 'minecraft:logs', 3), false);
  assert.deepEqual(tags.forEntry('items', 7), ['custom:item']);
  assert.deepEqual(tags.names('entities'), []);
});
