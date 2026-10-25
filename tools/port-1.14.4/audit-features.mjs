// This is a diagnostic, not a parity test: known unsupported behavior is reported as a gap.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {Items} from '../../client/js/game/items.js';
import {LocalPlayer} from '../../client/js/game/physics.js';
import {Game} from '../../client/js/game/game.js';
import {RecipeBook} from '../../client/js/game/recipebook.js';
import {TileEntityRenderer} from '../../client/js/render/tile-renderer.js';
import {Particles} from '../../client/js/render/particles.js';
import {SoundManager} from '../../client/js/audio/sound.js';
import {ItemRenderer} from '../../client/js/render/item-renderer.js';
import {initBlocks, blocksByName, findState} from '../../client/js/world/blocks.js';
import {validateVisualRuntime} from './validate-visual-runtime.mjs';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const json = path => JSON.parse(read(path));
const data = name => json('client/data/' + name + '.json');
const require = createRequire(import.meta.url);
const {ZipFile} = require('../../lib/zip.js');

export function auditFeatures() {
  const target = json('tools/port-1.14.4/target.json');
  const jar = new ZipFile(fileURLToPath(new URL('cache/port-1.14.4/client.jar', root)));
  const sha1 = createHash('sha1').update(jar.data).digest('hex');
  if (sha1 !== target.downloads.client.sha1) throw Error('Audit requires the pinned native client jar');
  const registries = json('cache/port-1.14.4/generated/reports/registries.json');
  const entries = type => registries['minecraft:' + type].entries;
  const shapes = data('blockCollisionShapes');
  initBlocks(data('blocks'), shapes);
  const assets = {data: {items: data('items'), creative: data('creative'), enchantments: data('enchantments')}, translate: key => key};
  const items = new Items(assets);
  const stack = name => ({id: items.byName.get(name).id, count: 1, nbt: null});
  const probes = [];
  const probe = (id, expected, actual, evidence) => probes.push({id, result: JSON.stringify(expected) === JSON.stringify(actual) ? 'verified' : 'gap', expected, actual, evidence});
  const compareRegistry = (type, defs, allow = []) => {
    const native = entries(type), local = new Map(defs.map(d => ['minecraft:' + d.name, d.id]));
    return {native: Object.keys(native).length, local: defs.length,
      missing: Object.entries(native).filter(([n]) => !local.has(n) && !allow.includes(n)).map(([n]) => n),
      mismatchedIds: Object.entries(native).filter(([n, v]) => local.has(n) && local.get(n) !== v.protocol_id).map(([n, v]) => ({name:n, expected:v.protocol_id, actual:local.get(n)})),
      extra: [...local.keys()].filter(n => !native[n]), allowedOmissions:allow};
  };
  const registryChecks = {
    blocks: compareRegistry('block', data('blocks')),
    items: compareRegistry('item', data('items'), ['minecraft:air']),
    particles: compareRegistry('particle_type', data('particles')),
    enchantments: compareRegistry('enchantment', data('enchantments')),
  };
  probe('control.bow.use-action', 'bow', items.useAction(stack('bow')), 'client/js/game/items.js:useAction');
  probe('control.apple.use-action', 'eat', items.useAction(stack('apple')), 'client/js/game/items.js:useAction');
  probe('control.chicken-egg.colors', true, !!items.eggInfo(stack('chicken_spawn_egg')), 'client/js/game/items.js:eggInfo');
  for (const name of ['crossbow', 'sweet_berries', 'suspicious_stew']) {
    probe(name + '.use-action', name === 'crossbow' ? 'crossbow' : 'eat', items.useAction(stack(name)), 'client/js/game/items.js:useAction');
    probe(name + '.positive-use-duration', true, items.useDuration(stack(name)) > 0, 'client/js/game/items.js:useDuration');
  }
  for (const name of ['multishot', 'quick_charge', 'piercing', 'mending', 'vanishing_curse']) {
    const id = entries('enchantment')['minecraft:' + name].protocol_id;
    const label = items.enchantmentName(id, 1);
    probe('enchantment.' + name, 'enchantment.minecraft.' + name, label.replace(/^§c/, '').split(' ')[0], 'client/js/game/items.js:enchantmentName');
  }
  for (const id of [31,32]) probe('effect.' + id + '.runtime-definition', true, !!items.effects[id], 'client/js/game/items.js:Items.effects');
  for (const name of ['cat','fox','panda','pillager','ravager','trader_llama','wandering_trader']) {
    probe('spawn-egg.' + name + '.colors', true, !!items.eggInfo(stack(name + '_spawn_egg')), 'client/js/game/items.js:eggInfo');
  }
  const player = new LocalPlayer(); player.sneaking = true;
  player.updateSize({getCollisions: () => []});
  probe('sneaking.height', Math.fround(1.5), player.height, 'client/js/game/physics.js:updateSize');
  probe('sneaking.eye-height', Math.fround(1.27), player.eyeHeight(), 'client/js/game/physics.js:eyeHeight');
  const tiles = Object.assign(Object.create(TileEntityRenderer.prototype), {tiles:new Map()});
  for (const name of Object.keys(blocksByName).filter(n => /_sign$/.test(n))) {
    probe('sign.' + name + '.renderer-route', 'sign', tiles._ensure(0,0,0,blocksByName[name].defaultState)?.type ?? null, 'client/js/render/tile-renderer.js:_ensure');
    tiles.tiles.clear();
  }
  // Call the real dispatch method. A proxy records any particle emitter the packet invokes.
  for (const name of ['campfire_cosy_smoke','campfire_signal_smoke','composter','sneeze','flash','falling_lava','landing_lava','falling_water']) {
    const emitted = [];
    const p = new Proxy({game:{assets:{data:{particles:data('particles')}}}}, {get:(o,k) => k in o ? o[k] : (...args) => {emitted.push(String(k)); return {};}});
    Particles.prototype.onPacket.call(p,{particleId:entries('particle_type')['minecraft:' + name].protocol_id,particles:1,x:0,y:0,z:0,offsetX:0,offsetY:0,offsetZ:0,particleData:0,data:{}});
    probe('particle.' + name + '.dispatch', true, emitted.length > 0, 'client/js/render/particles.js:onPacket');
  }
  for (const name of ['iron_xylophone','cow_bell','didgeridoo','bit','banjo','pling']) {
    const played = [];
    // Native NoteBlock.playNote sends event 0/0; triggerEvent reads instrument/note from BlockState.
    const state = findState('note_block',{instrument:name,note:'12',powered:'false'});
    SoundManager.prototype.onBlockAction.call({game:{particles:{},world:{getState:()=>state}},play:n=>played.push(n)}, {blockId:blocksByName.note_block.id,byte1:0,byte2:0,location:{x:0,y:0,z:0}});
    probe('note-block.' + name, 'block.note_block.' + name, played[0], 'client/js/audio/sound.js:onBlockAction');
  }
  for (const name of ['open_horse_window','open_book','acknowledge_player_digging','entity_sound_effect']) {
    probe('packet.' + name + '.consumer', true, typeof Game.prototype['on_' + name] === 'function', 'client/js/game/game.js:packet dispatch');
  }
  const g = {assets:{itemsByName:items.byName,recipes:[{name:'audit_tag_recipe',type:'minecraft:crafting_shaped',pattern:['P'],key:{P:{tag:'minecraft:planks'}},result:{item:'minecraft:stick'}}]}};
  const book = new RecipeBook(g);book.categoryOf = () => 'misc';
  probe('recipe-book.tag-ingredient', true, book.recipe('minecraft:audit_tag_recipe').cells[0].length > 0, 'client/js/game/recipebook.js:_parse');
  const predicates = ItemRenderer.prototype._predicates.call({game:{items,player:{usingItem:false},inventory:{held:()=>null},settings:{}}},stack('crossbow'));
  probe('crossbow.charged-predicate', true, Object.hasOwn(predicates,'charged'), 'client/js/render/item-renderer.js:_predicates');
  probe('custom-model-data.predicate', true, Object.hasOwn(predicates,'custom_model_data'), 'client/js/render/item-renderer.js:_predicates');
  // Asset presence is a separate observation, never proof that a renderer uses the asset.
  const assetChecks = Object.fromEntries(['textures/particle/particles.png','textures/painting/paintings_kristoffer_zetterstrand.png','textures/painting/kebab.png','textures/entity/sign.png','textures/entity/signs/oak.png','particles/campfire_cosy_smoke.json'].map(p=>[p,!!jar.read('assets/minecraft/'+p)]));
  const nativeModels = require('../../lib/modelextract.js');
  const visuals = validateVisualRuntime(jar,nativeModels.assertCompleteModels(nativeModels.extractModels(jar)));
  const contentInventory = {
    blocks:data('blocks').map(b=>({name:b.name,id:b.id,states:b.maxStateId-b.minStateId+1,
      nativeBlockstate:!!jar.read('assets/minecraft/blockstates/'+b.name+'.json'),
      collisionShape:shapes.blocks[b.name]!==undefined,
      specialRenderer:tiles._ensure(b.id,0,0,b.defaultState)?.type ?? null})),
    items:data('items').map(i=>({name:i.name,id:i.id,nativeModel:!!jar.read('assets/minecraft/models/item/'+i.name+'.json'),useAction:items.useAction({id:i.id})})),
  };
  const features=json('tools/port-1.14.4/feature-checklist.json').features;
  const openTopics=features.filter(f=>!['verified','not-applicable'].includes(f.status)).map(f=>f.id);
  const patches=json('tools/port-1.14.4/patch-checklist.json');
  for(const patch of patches)for(const topic of patch.topics)if(!['verified','not-applicable'].includes(topic.status))openTopics.push(patch.version+':'+topic.section+':'+topic.topic);
  return {target:'1.14.4',protocol:498,clientJarSha1:sha1,method:'Offline runtime probes plus native data validation; no live server or visual parity certification.',review:{topics:features.length,openTopics},registryChecks,visuals,assetChecks,contentInventory,probes,
    totals:{verified:probes.filter(p=>p.result==='verified').length,gaps:probes.filter(p=>p.result==='gap').length}};
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = auditFeatures();
  if (process.argv.includes('--write')) writeFileSync(new URL('docs/feature-audit-1.14.4-results.json',root),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
  // --strict is suitable as a future parity gate; the default is a successful diagnostic run.
  if (process.argv.includes('--strict') && (result.review.openTopics.length || result.totals.gaps || Object.values(result.registryChecks).some(r=>r.missing.length || r.mismatchedIds.length || r.extra.length))) process.exitCode = 1;
}
