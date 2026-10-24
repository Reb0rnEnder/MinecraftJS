// Offline, pinned Java 1.13.2 creative catalog extraction. No JDK or downloaded mappings.
// Execute the jar's registration, tab and fillItemGroup bytecode with a narrowly scoped
// JVM adapter. Peripheral rendering/entity constructors are replaced by recorders; the
// category predicates, variant loops, enchantment levels and tab getters run unmodified.
// node tools/creative-dump/extract-1.13.2.mjs --check | --write
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ZipFile } from '../../lib/zip.js';
import { walk } from '../../lib/bytecode.js';
import { Jvm, JObject, JList, JMap } from '../../lib/jvm.js';

export const JAR_SHA1 = '30bfe37a8db404db11c7edf02cb5165817afb4d9';
const root = new URL('../../', import.meta.url);
const list = (items = []) => Object.assign(new JList(), { items });
const tag = (t, v) => ({ t, v });

class CreativeJvm extends Jvm {
  constructor(jar) {
    super(jar);
    this.items = new Map(); this.potions = new Map(); this.effects = new Map(); this.enchantments = new Map();
    this.blockItems = new JMap();
    this.eggs = {};
  }

  // Named singleton holders have simple ldc-name / putstatic sequences. Reading these
  // avoids bootstrapping worlds, entity factories, sounds or rendering at extraction time.
  namedFields(name, resolve, stringFilter = s => /^[a-z0-9_]+$/.test(s)) {
    const out = {}, c = this.cls(name);
    let key;
    for (const i of walk(c.methods.find(m => m.name === '<clinit>').code)) {
      if (i.op === 0x12 || i.op === 0x13) {
        const k = c.constant(i.op === 0x12 ? i.u1 : i.u2);
        if (k.type === 'string' && stringFilter(k.value)) key = k.value;
      } else if (i.op === 0xb3 && key) {
        const f = c.ref(i.u2);
        out[name + '.' + f.name] = resolve(key);
      }
    }
    return out;
  }

  staticsOf(name) {
    if (this.statics.has(name)) return this.statics.get(name);
    const out = {};
    this.statics.set(name, out);
    const named = {
      bct: key => Object.assign(new JObject('bcs'), { key }),
      atf: key => { assert.ok(this.items.has(key), 'item singleton ' + key); return this.items.get(key); },
      aem: key => { assert.ok(this.effects.has(key), 'effect singleton ' + key); return this.effects.get(key); },
      auw: key => { assert.ok(this.potions.has(key), 'potion singleton ' + key); return this.potions.get(key); },
      aev: key => Object.assign(new JObject('aev'), { key }),
      ank: key => key,
    };
    if (named[name]) Object.assign(out, this.namedFields(name, named[name], name === 'ank' ? s => s.startsWith('generic.') : undefined));
    else if (name === 'ary') {
      // Unlike the shared model JVM, never swallow a failed relevant initializer.
      this.invoke(name, '<clinit>', '()V', undefined, [], false);
    } else if (name === 'fc') {
      out['fc.s'] = this.items; out['fc.j'] = this.potions; out['fc.q'] = this.enchantments;
    } else {
      // Opaque singleton/enum values are only compared by identity in this slice.
      for (const f of this.cls(name)?.fields || []) if (f.access & 8 && f.desc.startsWith('L')) {
        out[name + '.' + f.name] = new JObject(f.desc.slice(1, -1));
      }
      if (name === 'ate') out['ate.a'] = null;
    }
    return out;
  }

  invoke(owner, name, desc, self, args, virtual) {
    const key = owner + '.' + name + desc;
    if (key === 'bcs.a(Lary;Lez;)V') assert.equal(self?.cls, 'bcs', 'creative block receiver ' + JSON.stringify(self));
    if (key === 'org/apache/commons/lang3/Validate.isInstanceOf(Ljava/lang/Class;Ljava/lang/Object;)V') {
      assert.equal(args[1]?.cls, 'bcs'); return; // block placeholders retain identity, not world behavior
    }
    if (self instanceof JList || self?.cls === 'iterator') return this.callExternal(owner, name, desc, self, args);
    if (owner === 'fc' && name === 'iterator') return this.callExternal('java/util/List', name, desc, list([...self.values()]), args);
    if (owner === 'aew' && name === 'values') return Object.values(this.staticsOf(owner));
    if (owner === 'pc' && name === '<init>') { self.key = args.join(':'); return; }
    if (key === 'ata.a(Lpc;Latd;)V') return; // renderer predicates are irrelevant to creative membership
    if (name === '<init>' && this.isSubclass(owner, 'ata') && owner !== 'ata' && !this.isSubclass(owner, 'arj')) {
      // Non-block creative readers use only Item.group. Run the real Item constructor;
      // skip subclass world/render machinery and record spawn-egg colors/entity. Block
      // item constructors and their block->item registrations execute normally.
      const props = args.find(a => a?.cls === 'ata$a');
      assert.ok(props, 'Item.Properties in ' + key);
      super.invoke('ata', '<init>', '(Lata$a;)V', self, [props], false);
      if (owner === 'auc') self.egg = [args[0].key, args[1], args[2]];
      return;
    }
    if (key === 'ata.a(Lbcs;Lata;)V' || key === 'ata.a(Ljava/lang/String;Lata;)V') {
      const [raw, item] = args, name = typeof raw === 'string' ? raw : raw.key;
      assert.ok(name && !this.items.has(name), 'unique item ' + name);
      item.key = name; item.id = this.items.size;
      this.items.set(name, item);
      if (this.isSubclass(item.cls, 'arj')) this.invoke('arj', 'a', '(Ljava/util/Map;Lata;)V', item, [this.blockItems, item], true);
      if (item.egg) {
        const [entity, primary, secondary] = item.egg;
        assert.equal(name, entity + '_spawn_egg');
        this.eggs['minecraft:' + entity] = [primary, secondary, entity];
      }
      return;
    }
    if (owner === 'ate' && name === '<init>' && desc === '(Laxx;)V') {
      const item = args[0].cls === 'bcs' ? this.blockItems.map.get(args[0]) : this.items.get(args[0].key);
      assert.ok(item, 'stack item ' + args[0].key);
      self.stack = [item.id, 0, null];
      return;
    }
    if (key === 'auv.a(Late;Laut;)Late;') {
      args[0].stack[2] = { Potion: tag(8, 'minecraft:' + args[1].key) };
      return args[0];
    }
    if (key === 'asi.a(Lawh;)Late;') {
      const enchantment = args[0].fields['awh.b'], level = args[0].fields['awh.c'];
      return Object.assign(new JObject('ate'), { stack: [this.items.get('enchanted_book').id, 0, {
        StoredEnchantments: tag(9, { et: 10, items: [{ id: tag(8, 'minecraft:' + enchantment.key), lvl: tag(2, level) }] }),
      }] });
    }
    if (key === 'awe.a(Ljava/lang/String;Lawe;)V') {
      args[1].key = args[0]; this.enchantments.set(args[0], args[1]); return;
    }
    if (owner === 'aek' && name === '<init>') {
      self.effect = [args[0].id, args[1], args[2] || 0]; return;
    }
    if (owner === 'aut' && name === '<init>') {
      self.baseName = args.length === 2 ? args[0] : null;
      self.effects = args.at(-1).map(e => e.effect);
      return;
    }
    if (key === 'aut.a()Ljava/util/List;') return list(self.effects);
    if (key === 'aut.a(Ljava/lang/String;Laut;)V') {
      args[1].key = args[0]; args[1].id = this.potions.size; this.potions.set(args[0], args[1]); return;
    }
    if (key === 'aej.a(ILjava/lang/String;Laej;)V') {
      args[2].id = args[0]; args[2].key = args[1]; this.effects.set(args[1], args[2]); return;
    }
    if (key === 'aej.a(Lafm;Ljava/lang/String;DI)Laej;') {
      (self.modifiers ||= []).push([args[0], self.cls === 'aeg' ? self.fields['aeg.a'] : args[2], args[3]]);
      return self;
    }
    return super.invoke(owner, name, desc, self, args, virtual);
  }
}

export function extractCreative(jarPath = process.env.MC_JAR || fileURLToPath(new URL('cache/1.13.2.jar', root))) {
  const jar = new ZipFile(jarPath);
  assert.equal(createHash('sha1').update(jar.data).digest('hex'), JAR_SHA1, 'requires the original Java 1.13.2 client jar');
  const vm = new CreativeJvm(jar);
  const call = (owner, name, desc, self, args = []) => vm.invoke(owner, name, desc, self, args, !!self);
  call('aej', 'm', '()V');
  call('aut', 'b', '()V');
  call('awe', 'h', '()V');
  call('ata', 'r', '()V');
  const registry = JSON.parse(readFileSync(new URL('client/data/items.json', root)));
  assert.equal(registry.length, 789);
  assert.equal(vm.items.size, 790, 'air plus 789 native registry items');
  for (const def of registry) assert.equal(vm.items.get(def.name)?.id, def.id, 'native registration order: ' + def.name);
  const tabs = vm.staticsOf('ary')['ary.a'].map(t => {
    const get = (name, desc) => call('ary', name, desc, t);
    const label = get('b', '()Ljava/lang/String;'), entries = list();
    if (label !== 'hotbar' && label !== 'inventory') call('ary', 'a', '(Lez;)V', t, [entries]);
    return {
      index: get('a', '()I'), label, icon: get('f', '()Late;').stack,
      background: get('g', '()Ljava/lang/String;'), title: !!get('h', '()Z'), scrollbar: !!get('j', '()Z'),
      column: get('l', '()I'), top: !!get('m', '()Z'), right: !!get('n', '()Z'),
      items: entries.items.map(it => it.stack),
    };
  });
  const potions = Object.fromEntries([...vm.potions].map(([key, p]) => ['minecraft:' + key, { id: p.id, name: p.baseName || key, effects: p.effects }]));
  const effects = Object.fromEntries([...vm.effects].map(([key, e]) => [e.id, {
    key: 'minecraft:' + key, name: 'effect.minecraft.' + key, color: e.fields['aej.c'], bad: !!e.fields['aej.b'], modifiers: e.modifiers || [],
  }]));
  // Existing Items.eggInfo still asks for the old illager aliases. Keep these two
  // compatibility keys alongside the native entity names until that consumer migrates.
  const eggs = { ...vm.eggs, 'minecraft:evocation_illager': vm.eggs['minecraft:evoker'], 'minecraft:vindication_illager': vm.eggs['minecraft:vindicator'] };
  assert.equal(tabs.length, 12);
  assert.equal(vm.enchantments.size, 34);
  assert.equal(vm.potions.size, 43);
  assert.equal(vm.effects.size, 30);
  assert.equal(Object.keys(vm.eggs).length, 51);
  for (const t of tabs) for (const stack of [t.icon, ...t.items]) {
    assert.ok(stack && stack[0] >= 1 && stack[0] <= 789 && stack[1] === 0, 'native nonempty creative stack');
    assert.ok(jar.has('assets/minecraft/models/item/' + registry[stack[0] - 1].name + '.json'));
  }
  return { version: '1.13.2', protocol: 404, dataVersion: 1631, source: { clientJarSha1: JAR_SHA1 }, tabs, potions, effects, eggs };
}

export function formatCreative(data) {
  const { tabs, potions, effects, eggs, ...meta } = data;
  const lines = ['{', ...Object.entries(meta).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`), '  "tabs": ['];
  tabs.forEach(({ items, ...tab }, i) => {
    lines.push('    {', ...Object.entries(tab).map(([k, v]) => `      ${JSON.stringify(k)}: ${JSON.stringify(v)},`), '      "items": [');
    lines.push(...items.map((it, j) => '        ' + JSON.stringify(it) + (j < items.length - 1 ? ',' : '')));
    lines.push('      ]', '    }' + (i < tabs.length - 1 ? ',' : ''));
  });
  lines.push('  ],');
  for (const [key, values] of Object.entries({ potions, effects, eggs })) {
    lines.push(`  "${key}": {`, Object.entries(values).map(([k, v]) => `    ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n'), '  }' + (key === 'eggs' ? '' : ','));
  }
  return lines.concat('}', '').join('\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  assert.ok(process.argv.length === 3 && ['--check', '--write'].includes(process.argv[2]), 'usage: node tools/creative-dump/extract-1.13.2.mjs --check | --write');
  const data = extractCreative(), output = new URL('client/data/creative.json', root);
  if (process.argv[2] === '--write') writeFileSync(output, formatCreative(data));
  else assert.deepEqual(JSON.parse(readFileSync(output)), data, 'committed creative data matches jar extraction');
  console.log(JSON.stringify({ tabs: data.tabs.map(t => [t.label, t.items.length]), potions: Object.keys(data.potions).length, effects: Object.keys(data.effects).length, nativeEggs: Object.keys(data.eggs).length - 2 }));
}
