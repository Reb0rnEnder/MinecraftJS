import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { initBlocks } from '../../client/js/world/blocks.js';
import { setJarModels } from '../../client/js/render/entity-models.js';
import { EntityRenderer } from '../../client/js/render/entity-renderer.js';
import { ENTITY_TYPES, MOB_FAMILIES } from '../../client/js/game/entity-types.js';
import { villagerLayers } from '../../client/js/render/villager-layers.js';

const sourceRead = (name) => JSON.parse(readFileSync(new URL('../../client/data/' + name + '.json', import.meta.url)));

const NON_LIVING = new Set(
  'acacia_boat acacia_chest_boat area_effect_cloud armor_stand arrow bamboo_chest_raft bamboo_raft birch_boat birch_chest_boat block_display breeze_wind_charge cherry_boat cherry_chest_boat chest_minecart command_block_minecart dark_oak_boat dark_oak_chest_boat dragon_fireball egg ender_pearl end_crystal evoker_fangs experience_bottle experience_orb eye_of_ender falling_block fireball firework_rocket furnace_minecart glow_item_frame hopper_minecart interaction item item_display item_frame jungle_boat jungle_chest_boat leash_knot lightning_bolt llama_spit mangrove_boat mangrove_chest_boat mannequin marker minecart oak_boat oak_chest_boat ominous_item_spawner painting pale_oak_boat pale_oak_chest_boat splash_potion lingering_potion shulker_bullet small_fireball snowball spawner_minecart spectral_arrow spruce_boat spruce_chest_boat text_display tnt tnt_minecart trident wind_charge wither_skull player fishing_bobber'
    .split(' ')
);

export function validateVisualRuntime(jar, models, shapes = null, { pendingEntities = new Set(), dataDir = null } = {}) {
  const read = (name) => (dataDir ? JSON.parse(readFileSync(join(dataDir, name + '.json'))) : sourceRead(name));
  shapes ??= read('blockCollisionShapes');
  const hash = createHash('sha1').update(jar.data).digest('hex');
  const definitions = read('blocks');
  const count = Math.max(...definitions.map((b) => b.maxStateId)) + 1;
  const props = shapes.render;
  if (props?.source?.clientJarSha1 !== hash || props.states.length !== count) {
    throw Error('Native rendering table is missing/stale: regenerate runtime data from this jar');
  }
  for (let state = 0; state < count; state++) {
    const p = props.values[props.states[state]];
    if (
      !p ||
      typeof p.solid !== 'boolean' ||
      typeof p.viewBlocking !== 'boolean' ||
      !Number.isInteger(p.renderType) ||
      typeof p.collisionFull !== 'boolean' ||
      typeof p.occludes !== 'boolean' ||
      !Number.isFinite(p.shade) ||
      !Number.isInteger(p.lightBlock) ||
      !Number.isInteger(p.emission) ||
      !Array.isArray(p.occlusion) ||
      p.sound?.length !== 7 ||
      p.sound.some((s, i) => ([3, 4].includes(i) ? !Number.isFinite(s) : typeof s !== 'string'))
    ) {
      throw Error('Invalid native rendering/sound properties for state ' + state);
    }
  }
  initBlocks(definitions, shapes);
  setJarModels(models);
  const renderer = Object.create(EntityRenderer.prototype);
  renderer.game = { world: {} };
  const tested = new Set();
  const texture = (path) => {
    if (!jar.read('assets/minecraft/textures/' + path)) throw Error('Entity texture is absent from this jar: ' + path);
    tested.add(path);
  };
  let mobs = 0;
  const pending = [];
  for (const entry of Object.values(ENTITY_TYPES)) {
    if (pendingEntities.has(entry.name)) {
      if (!entry.mob) throw Error('Deferred entity is not classified as living: ' + entry.name);
      pending.push(entry.name);
      continue;
    }
    if (!entry.mob) {
      if (!NON_LIVING.has(entry.name)) throw Error('Entity needs a living/object renderer classification: ' + entry.name);
      continue;
    }
    const fam = MOB_FAMILIES[entry.name];
    const e = { kind: 'mob', entityName: entry.name, type: fam?.[0] || entry.name, ...fam?.[1] };
    mobs++;
    if (e.type === 63 || entry.name === 'ender_dragon') {
      texture('entity/enderdragon/dragon.png');
      continue;
    }
    texture(renderer._texFor(e));

    const model = renderer._modelFor(e);
    if (!model) throw Error('Missing living entity adapter: ' + entry.name);
    model.animate(model, { age: 0, yaw: 0, pitch: 0, ls: 0, lsa: 0, swing: 0, peek: 0, squish: 0, onGround: true, inWater: false, entityId: 1 });
    const seen = new Set();
    const visit = (part) => {
      if (!part || !Array.isArray(part.boxes)) throw Error('Missing model part for ' + entry.name);
      if (seen.has(part)) return;
      seen.add(part);
      for (const key of ['px', 'py', 'pz', 'rx', 'ry', 'rz']) {
        if (!Number.isFinite(part[key])) throw Error('Invalid model pose ' + entry.name + '.' + key);
      }
      for (const child of part.children) visit(child);
    };
    model.roots.forEach(visit);
  }
  for (const villagerZombie of [false, true]) {
    for (let type = 0; type < 7; type++) {
      for (let profession = 0; profession < 15; profession++) {
        for (let level = 1; level <= 5; level++) {
          for (const layer of villagerLayers({ villagerZombie, villagerType: type, profession, villagerLevel: level })) {
            texture(layer.texture);
          }
        }
      }
    }
  }
  return { states: count, mobs, nonMobs: NON_LIVING.size, textures: tested.size, pending };
}
