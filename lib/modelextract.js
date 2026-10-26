// Entity and block entity models from the Minecraft client jar. In 1.13.2 they are Java code (ModelBase subclasses
// building ModelRenderer parts in their constructors), so the build runs those constructors in lib/jvm.js and records
// every box. Nothing obfuscated is hardcoded: ModelRenderer / ModelBase / ModelBox are found by their method shapes,
// ModelRenderer's fields by probing, and each model through the renderer class that loads its texture.
//
// Output per model: { fields: [part index | [part indices] | null] (the model's ModelRenderer fields in declaration
// order, superclass first), parts: [{ tw, th, p: [x, y, z], r: [x, y, z], mirror, show, boxes: [[u, v, x, y, z, dx, dy,
// dz, inflate, mirror]], children: [part index] }], nums: [the model's own number fields, declaration order] }
const { Jvm, JObject, JList } = require('./jvm');
const { walk } = require('./bytecode');

// Models the client draws, by the renderer that binds `texture` and constructs the model in its constructor
// (`nth`: which `new Model(...)` of that class, `desc`: or the one with this constructor, `args`: constructor arguments
// when the renderer's are not wanted, `alt`: one or more texture / nth alternatives for older jars). When the
// renderer gets its model from its creator (1.8: `new RenderPig(this, new ModelPig(), 0.7F)` in RenderManager), the
// model passed to it is used.
const SPECS = {
  creeper: { texture: 'textures/entity/creeper/creeper.png' },
  creeperArmor: { texture: 'textures/entity/creeper/creeper_armor.png' },
  skeleton: { texture: 'textures/entity/skeleton/skeleton.png' },
  strayOverlay: { texture: 'textures/entity/skeleton/stray_overlay.png' },
  spider: { texture: 'textures/entity/spider/spider.png' },
  zombie: { texture: 'textures/entity/zombie/zombie.png' },
  drowned: { texture: 'textures/entity/zombie/drowned.png' },
  drownedOuter: { texture: 'textures/entity/zombie/drowned_outer_layer.png' },
  zombieVillager: { texture: 'textures/entity/zombie_villager/zombie_villager.png', alt: { texture: 'textures/entity/zombie/zombie_villager.png', nth: 1 } },
  slime: { texture: 'textures/entity/slime/slime.png' },
  slimeOuter: { texture: 'textures/entity/slime/slime.png', layer: true },
  ghast: { texture: 'textures/entity/ghast/ghast.png' },
  enderman: { texture: 'textures/entity/enderman/enderman.png' },
  silverfish: { texture: 'textures/entity/silverfish.png' },
  blaze: { texture: 'textures/entity/blaze.png' },
  magmaCube: { texture: 'textures/entity/slime/magmacube.png' },
  wither: { texture: 'textures/entity/wither/wither.png' },
  witherSkull: { texture: 'textures/entity/wither/wither.png', owner: 'projectile' },
  bat: { texture: 'textures/entity/bat.png' },
  witch: { texture: 'textures/entity/witch.png' },
  endermite: { texture: 'textures/entity/endermite.png' },
  guardian: { texture: 'textures/entity/guardian.png' },
  shulker: { texture: 'textures/entity/shulker/shulker_white.png' },
  pig: { texture: 'textures/entity/pig/pig.png' },
  pigSaddle: { texture: 'textures/entity/pig/pig_saddle.png' },
  sheep: { texture: 'textures/entity/sheep/sheep.png' },
  sheepWool: { texture: 'textures/entity/sheep/sheep_fur.png' },
  cow: { texture: 'textures/entity/cow/cow.png' },
  chicken: { texture: 'textures/entity/chicken.png' },
  squid: { texture: 'textures/entity/squid.png' },
  cod: { texture: 'textures/entity/fish/cod.png' },
  salmon: { texture: 'textures/entity/fish/salmon.png' },
  // RenderPufferfish constructs big, small, medium, big (the first is passed to RenderLiving).
  pufferfishSmall: { texture: 'textures/entity/fish/pufferfish.png', nth: 1 },
  pufferfishMedium: { texture: 'textures/entity/fish/pufferfish.png', nth: 2 },
  pufferfishBig: { texture: 'textures/entity/fish/pufferfish.png', nth: 0 },
  // Tropical fish keep their texture table on the entity, not the renderer. The layer's actual
  // (F)V constructors supply the 0.008 inflation; do not reuse the uninflated base geometry.
  tropicalFishA: { texture: 'textures/entity/fish/tropical_a.png', entityTexture: true, nth: 0 },
  tropicalFishB: { texture: 'textures/entity/fish/tropical_b.png', entityTexture: true, nth: 2 },
  tropicalFishPatternA: { texture: 'textures/entity/fish/tropical_a_pattern_1.png', entityTexture: true, owner: 'layer', nth: 0 },
  tropicalFishPatternB: { texture: 'textures/entity/fish/tropical_b_pattern_1.png', entityTexture: true, owner: 'layer', nth: 1 },
  dolphin: { texture: 'textures/entity/dolphin.png' },
  turtle: { texture: 'textures/entity/turtle/big_sea_turtle.png' },
  phantom: { texture: 'textures/entity/phantom.png' },
  wolf: { texture: 'textures/entity/wolf/wolf.png' },
  snowman: { texture: 'textures/entity/snow_golem.png', alt: { texture: 'textures/entity/snowman.png' } },
  ocelot: { texture: 'textures/entity/cat/ocelot.png' },
  ironGolem: { texture: 'textures/entity/iron_golem.png' },
  // Ordinary and undead horses share ModelHorse. Donkeys/mules override its ears and add chests.
  horse: { texture: 'textures/entity/horse/horse_skeleton.png' },
  donkey: { texture: 'textures/entity/horse/donkey.png' },
  rabbit: { texture: 'textures/entity/rabbit/brown.png' },
  cat: { texture: 'textures/entity/cat/tabby.png', entityTexture:true },
  fox: { texture: 'textures/entity/fox/fox.png' },
  panda: { texture: 'textures/entity/panda/panda.png' },
  ravager: { texture: 'textures/entity/illager/ravager.png' },
  villager: { texture: 'textures/entity/villager/villager.png' },
  dragon: { texture: 'textures/entity/enderdragon/dragon.png' },
  polarBear: { texture: 'textures/entity/bear/polarbear.png' },
  llama: { texture: 'textures/entity/llama/creamy.png', alt: { texture: 'textures/entity/llama/llama_creamy.png' } },
  llamaDecor: { texture: 'textures/entity/llama/decor/white.png' },
  parrot: { texture: 'textures/entity/parrot/parrot_red_blue.png' },
  vex: { texture: 'textures/entity/illager/vex.png' },
  illager: { texture: 'textures/entity/illager/evoker.png' },
  armorStand: { texture: 'textures/entity/armorstand/wood.png' },
  elytra: { texture: 'textures/entity/elytra.png' },
  boat: { texture: 'textures/entity/boat/oak.png', alt: [{ texture: 'textures/entity/boat/boat_oak.png' }, { texture: 'textures/entity/boat.png' }] },
  minecart: { texture: 'textures/entity/minecart.png' },
  enderCrystal: { texture: 'textures/entity/end_crystal/end_crystal.png', alt: { texture: 'textures/entity/endercrystal/endercrystal.png' }, args: [0, 1] },
  enderCrystalNoBase: { texture: 'textures/entity/end_crystal/end_crystal.png', alt: { texture: 'textures/entity/endercrystal/endercrystal.png' }, args: [0, 0] },
  leash: { texture: 'textures/entity/lead_knot.png' },
  evokerFangs: { texture: 'textures/entity/illager/evoker_fangs.png', alt: { texture: 'textures/entity/illager/fangs.png' } },
  llamaSpit: { texture: 'textures/entity/llama/spit.png' },
  shulkerBullet: { texture: 'textures/entity/shulker/spark.png' },
  trident: { texture: 'textures/entity/trident.png', owner: 'projectile' },
  // block entities
  chest: { texture: 'textures/entity/chest/ender.png' },
  largeChest: { texture: 'textures/entity/chest/normal_double.png', nth: 1 },
  sign: { texture: 'textures/entity/signs/oak.png', alt: { texture: 'textures/entity/sign.png' } },
  book: { texture: 'textures/entity/enchanting_table_book.png' },
  bed: { texture: 'textures/entity/bed/' },
  skull: { texture: 'textures/entity/skeleton/wither_skeleton.png', owner: 'most', desc: '(IIII)V' },
  dragonHead: { texture: 'textures/entity/skeleton/wither_skeleton.png', owner: 'most', desc: '(F)V' },
  humanoidHead: { texture: 'textures/entity/skeleton/wither_skeleton.png', owner: 'most', desc: '()V' },
  // TileEntityBannerRenderer binds no texture of its own: ModelBanner is the model with the 20x40x1 slate
  banner: { shape: [20, 40, 1] },
  // ModelShield (TileEntityItemStackRenderer; its textures are named in BannerTextures): the 12x22x1 plate
  shield: { shape: [12, 22, 1] },
};

// Models found from another model: the biped base (armor, players) and the player model
const DERIVED = {
  biped: (ctx) => ctx.superOf(ctx.found.zombie),
  quadruped: (ctx) => ctx.superOf(ctx.found.pig),
  player: (ctx) => ctx.playerModel(),
};

function extractModels(jar) {
  const version = jar.read("version.json");
  if (version && JSON.parse(version.toString()).id === "1.15.2") return require("./model-extract-1.15.2").extractModels(jar);
  const all = jar.list('').filter((n) => n.endsWith('.class') && !n.includes('/')).map((n) => n.slice(0, -6));
  let BOX = null;
  const jvm = new Jvm(jar);
  // ModelRenderer: ctor (ModelBase, String), addBox (FFFIII) returning itself
  let R = null, B = null;
  for (const n of all) {
    const c = jvm.cls(n);
    const ctor = c.methods.find((m) => m.name === '<init>' && /^\(L\w+;Ljava\/lang\/String;\)V$/.test(m.desc));
    if (ctor && c.methods.some((m) => m.desc === '(FFFIII)L' + n + ';')) { R = n; B = ctor.desc.slice(2, ctor.desc.indexOf(';')); break; }
  }
  if (!R) throw new Error('ModelRenderer not found in the jar');
  // ModelBox: ctor (ModelRenderer, int u, int v, float x, y, z, int dx, dy, dz, float inflate[, boolean mirror])
  for (const n of all) {
    const c = jvm.cls(n);
    if (c.methods.some((m) => m.name === '<init>' && m.desc.startsWith('(L' + R + ';IIFFFIIIF'))) { BOX = n; break; }
  }
  if (!BOX) throw new Error('ModelBox not found in the jar');
  // Record only the full constructor (..., float inflate, boolean mirror): the shorter one is the jar's own code,
  // which reads the renderer's mirror flag and calls this one
  const full = jvm.cls(BOX).methods.find((m) => m.name === '<init>' && m.desc === '(L' + R + ';IIFFFIIIFZ)V');
  if (!full) throw new Error('ModelBox (..., boolean mirror) constructor not found');
  jvm.intercept[BOX + '.<init>' + full.desc] = (args, self) => {
    self.box = [args[1], args[2], args[3], args[4], args[5], args[6], args[7], args[8], args[9], !!args[10]];
  };
  let roles = null;
  const rmethod = (desc) => jvm.cls(R).methods.find((m) => m.desc === desc).name;

  // A bare ModelBase to construct probe parts with
  const newModel = (cls, desc, args) => {
    const o = new JObject(cls);
    jvm.invoke(cls, '<init>', desc, o, args, false);
    return o;
  };
  const base = newModel(B, '()V', []);

  // ModelRenderer field roles, by calling its methods with marker values
  {
    const p = new JObject(R);
    jvm.invoke(R, '<init>', '(L' + B + ';)V', p, [base], false);
    const before = { ...p.fields };
    jvm.invoke(R, rmethod('(FFF)V'), '(FFF)V', p, [101, 102, 103], true);
    const find = (v) => Object.keys(p.fields).find((k) => p.fields[k] === v);
    roles = { px: find(101), py: find(102), pz: find(103) };
    const fk = (name) => R + '.' + name;
    const texMethods = jvm.cls(R).methods.filter((m) => m.desc === '(II)L' + R + ';');
    for (const m of texMethods) jvm.invoke(R, m.name, m.desc, p, [201, 202], true);
    roles.u = find(201) && typeof before[find(201)] === 'number' ? Object.keys(p.fields).find((k) => p.fields[k] === 201 && Number.isInteger(p.fields[k])) : null;
    // texture size fields are floats set by the other (II) method: identify by probing them one at a time
    const p2 = new JObject(R);
    jvm.invoke(R, '<init>', '(L' + B + ';)V', p2, [base], false);
    for (const m of texMethods) {
      const snap = { ...p2.fields };
      jvm.invoke(R, m.name, m.desc, p2, [301, 302], true);
      const changed = Object.keys(p2.fields).filter((k) => p2.fields[k] !== snap[k]);
      const c = jvm.cls(R).fields;
      const typeOf = (k) => c.find((f) => fk(f.name) === k).desc;
      if (changed.every((k) => typeOf(k) === 'I')) { roles.setTexOffset = m.name; roles.u = changed.find((k) => p2.fields[k] === 301); roles.v = changed.find((k) => p2.fields[k] === 302); }
      else { roles.setTexSize = m.name; roles.tw = changed.find((k) => p2.fields[k] === 301); roles.th = changed.find((k) => p2.fields[k] === 302); }
    }
    const fields = jvm.cls(R).fields;
    const idx = fields.findIndex((f) => fk(f.name) === roles.pz);
    [roles.rx, roles.ry, roles.rz] = fields.slice(idx + 1, idx + 4).map((f) => fk(f.name));
    const lists = fields.filter((f) => f.desc === 'Ljava/util/List;').map((f) => fk(f.name));
    // cubeList fills on addBox, childModels on addChild
    const p3 = new JObject(R);
    jvm.invoke(R, '<init>', '(L' + B + ';)V', p3, [base], false);
    const bools = fields.filter((f) => f.desc === 'Z').map((f) => fk(f.name));
    roles.show = bools.find((k) => p3.fields[k] === 1);
    jvm.invoke(R, rmethod('(FFFIII)L' + R + ';'), '(FFFIII)L' + R + ';', p3, [0, 0, 0, 1, 1, 1], true);
    roles.cubes = lists.find((k) => p3.fields[k] && p3.fields[k].items.length === 1);
    roles.children = lists.find((k) => k !== roles.cubes);
    // mirror: the boolean that addBox passes on to ModelBox
    for (const k of bools.filter((x) => x !== roles.show)) {
      const p4 = new JObject(R);
      jvm.invoke(R, '<init>', '(L' + B + ';)V', p4, [base], false);
      p4.fields[k] = 1;
      roles.mirror = k;
      jvm.invoke(R, rmethod('(FFFIII)L' + R + ';'), '(FFFIII)L' + R + ';', p4, [0, 0, 0, 1, 1, 1], true);
      const b = p4.fields[roles.cubes].items[0];
      if (b && b.box && b.box[9]) break;
      roles.mirror = null;
    }
  }

  const ctx = {
    found: {},
    playerModel: () => all.find(n=>jvm.isSubclass(n,B)&&jvm.cls(n).methods.some(m=>m.name==='<init>'&&m.desc==='(FZ)V')&&jvm.cls(n).fields.filter(f=>f.desc==='L'+R+';').length>=7),
    superOf: (n) => jvm.cls(n).superName,
    subclassWithCtor: (sup, desc) => all.filter((n) => jvm.cls(n).superName === sup && jvm.cls(n).methods.some((m) => m.name === '<init>' && m.desc === desc)).sort((a,b)=>jvm.cls(b).fields.filter(f=>f.desc==='L'+R+';').length-jvm.cls(a).fields.filter(f=>f.desc==='L'+R+';').length)[0],
  };
  // Model constructions per class: [{ method, cls, args, outer: the class being constructed with it as an argument }]
  const sites = new Map();
  const constArg = (c, ins) => {
    if (ins.op >= 0x02 && ins.op <= 0x08) return ins.op - 3;
    if (ins.op >= 0x0b && ins.op <= 0x0d) return ins.op - 0x0b;
    if (ins.op === 0x10 || ins.op === 0x11) return ins.value;
    if (ins.op === 0x12) return c.constant(ins.u1).value;
    if (ins.op === 0x13 || ins.op === 0x14) return c.constant(ins.u2).value;
    return undefined;
  };
  const modelSites = (n) => {
    if (sites.has(n)) return sites.get(n);
    const c = jvm.cls(n), out = [];
    for (const m of c.methods) {
      if (!m.code) continue;
      let cur = null;
      const news = []; // classes being constructed (`new` seen, <init> not yet)
      for (const ins of walk(m.code)) {
        if (ins.op === 0xbb) {
          const k = c.constant(ins.u2).value;
          if (!cur && jvm.cls(k) && jvm.isSubclass(k, B)) cur = { method: m.name, cls: k, args: [], outer: news[news.length - 1] || null };
          else news.push(k);
        } else if (cur && ins.op === 0xb7 && c.ref(ins.u2).owner === cur.cls && c.ref(ins.u2).name === '<init>') { cur.desc = c.ref(ins.u2).desc; out.push(cur); cur = null; }
        else if (cur && ins.op !== 0x59) cur.args.push(constArg(c, ins));
        else if (ins.op === 0xb7 && c.ref(ins.u2).name === '<init>' && news[news.length - 1] === c.ref(ins.u2).owner) news.pop();
      }
    }
    sites.set(n, out);
    return out;
  };
  const owners = (tex) => all.filter((n) => jvm.cls(n).strings.includes(tex));

  const result = {};
  const run = (key, cls, desc, args) => {
    const model = new JObject(cls);
    jvm.steps = 0;
    jvm.invoke(cls, '<init>', desc, model, args, false);
    result[key] = serialize(model, cls);
    ctx.found[key] = cls;
  };
  const serialize = (model, cls) => {
    const parts = [], index = new Map();
    const partOf = (p) => {
      if (!p || !(p instanceof JObject) || p.cls !== R) return null;
      if (index.has(p)) return index.get(p);
      const i = parts.length;
      index.set(p, i);
      const out = {};
      parts.push(out);
      const F = p.fields;
      out.tw = F[roles.tw]; out.th = F[roles.th];
      out.p = [F[roles.px] || 0, F[roles.py] || 0, F[roles.pz] || 0];
      out.r = [F[roles.rx] || 0, F[roles.ry] || 0, F[roles.rz] || 0];
      out.mirror = !!F[roles.mirror];
      out.show = F[roles.show] !== 0;
      out.boxes = (F[roles.cubes] ? F[roles.cubes].items : []).map((b) => b.box).filter(Boolean);
      out.names = (F[roles.cubes] ? F[roles.cubes].items : []).map((b) => Object.values(b.fields).find((v) => typeof v === 'string') || null);
      out.children = (F[roles.children] ? F[roles.children].items : []).map(partOf);
      return i;
    };
    // fields in declaration order, superclass first (ModelBase's own fields excluded)
    const chain = [];
    for (let c = jvm.cls(cls); c && c.name !== B; c = jvm.cls(c.superName)) chain.unshift(c);
    const fields = [], nums = [];
    for (const c of chain) {
      for (const f of c.fields) {
        if (f.access & 0x0008) continue; // static
        if (f.desc === 'F' || f.desc === 'I') nums.push(model.fields[c.name + '.' + f.name] || 0);
        if (f.desc === 'L' + R + ';') fields.push(partOf(model.fields[c.name + '.' + f.name]));
        else if (f.desc === '[L' + R + ';') fields.push((model.fields[c.name + '.' + f.name] || []).map(partOf));
      }
    }
    // parts reachable only through children are already in `parts`
    for (const q of parts) delete q.names;
    return { fields, parts, nums };
  };

  // The renderer for a texture: of the classes that construct models and use it, the one with the fewest entity
  // textures (its own renderer), or the most (`owner: 'most'`: the skull renderer binds every skull texture)
  const texCount = (n) => jvm.cls(n).strings.filter((x) => x.startsWith('textures/entity/')).length;
  // RenderLiving: the superclass of the creeper's renderer; mob models prefer renderers below it (the wither's over
  // the wither skull projectile's)
  const creeperOwner = owners('textures/entity/creeper/creeper.png').filter((n) => modelSites(n).length).sort((a, b) => texCount(a) - texCount(b))[0];
  const living = creeperOwner ? jvm.cls(creeperOwner).superName : null;
  // models passed to a constructor: outer class -> sites (walks every class once, only when needed)
  let passed = null;
  const passedTo = (n) => {
    if (!passed) {
      passed = new Map();
      for (const k of all) {
        for (const x of modelSites(k)) if (x.outer) { if (!passed.has(x.outer)) passed.set(x.outer, []); passed.get(x.outer).push(x); }
      }
    }
    return passed.get(n) || [];
  };
  const pick = (spec) => {
    const rank = (n) => {
      if (spec.owner === 'most') return -texCount(n);
      const isLiving = !!living && jvm.isSubclass(n, living);
      return texCount(n) + (spec.owner === 'projectile' || spec.owner === 'layer' ? (isLiving ? 100 : 0) : (living && !isLiving ? 100 : 0));
    };
    const choose = (list, nth) => (spec.desc ? list.find((x) => x.desc === spec.desc) : list[nth || 0]) || null;
    for (const { texture: tex, nth } of [spec, ...[].concat(spec.alt || [])]) {
      const textureOwners = owners(tex);
      // Follow the entity argument of the renderer/layer's typed methods. This discovers both
      // RenderTropicalFish and LayerTropicalFishPattern without pinning obfuscated class names.
      const candidates = spec.entityTexture
        ? all.filter((n) => jvm.cls(n).methods.some((m) => textureOwners.some((e) => m.desc.startsWith('(L' + e + ';'))))
        : textureOwners;
      candidates.sort((a, b) => rank(a) - rank(b));
      const own = candidates.filter((n) => modelSites(n).length);
      for (const n of own) {
        const list = modelSites(n);
        // Prefer initializer sites. In 1.13.2 the skull renderer instead fills its model map in a synthetic
        // lambda helper: modelSites already finds those constructors without executing invokedynamic/renderer code.
        const site = choose(list.filter((x) => x.method === '<init>' || x.method === '<clinit>'), nth) || choose(list, nth);
        if (site) return site;
      }
      for (const n of candidates) {
        const site = choose(passedTo(n), nth);
        if (site) return site;
      }
    }
    return null;
  };
  const errors = [];
  const byShape = (dims) => {
    for (const n of all) {
      const c = jvm.cls(n);
      if (!jvm.isSubclass(n, B) || n === B || !c.methods.some((m) => m.name === '<init>' && m.desc === '()V')) continue;
      try {
        const o = new JObject(n);
        jvm.steps = 0;
        jvm.invoke(n, '<init>', '()V', o, [], false);
        const d = serialize(o, n);
        if (d.parts.some((q) => q.boxes.some((b) => b[5] === dims[0] && b[6] === dims[1] && b[7] === dims[2]))) return { cls: n, desc: '()V', args: [] };
      } catch (e) { /* not this one */ }
    }
    return null;
  };
  for (const [key, spec] of Object.entries(SPECS)) {
    try {
      let site = spec.shape ? byShape(spec.shape) : pick(spec);
      if (spec.layer) {
        // RenderSlime's layer: the outer slime model, built with no size (LayerSlimeGel)
        const inner = result.slime && ctx.found.slime;
        site = inner ? { cls: inner, desc: '(I)V', args: [0] } : null;
      }
      if (!site) { errors.push(key + ': no model for ' + (spec.texture || spec.shape)); continue; }
      const args = spec.args || site.args;
      if (args.some((a) => a === undefined)) { errors.push(key + ': non-constant constructor arguments'); continue; }
      run(key, site.cls, site.desc, args);
    } catch (e) { errors.push(key + ': ' + e.message); }
  }
  for (const [key, find] of Object.entries(DERIVED)) {
    try {
      const cls = find(ctx);
      if (!cls) { errors.push(key + ': not found'); continue; }
      const ctors = jvm.cls(cls).methods.filter((m) => m.name === '<init>').map((m) => m.desc);
      if (key === 'player') { run('player', cls, '(FZ)V', [0, 0]); run('playerSlim', cls, '(FZ)V', [0, 1]); }
      else if (key === 'biped') {
        run('biped', cls, '()V', []);
        run('armorInner', cls, '(F)V', [0.5]);
        run('armorOuter', cls, '(F)V', [1]);
      } else if (key === 'quadruped') void ctors;
    } catch (e) { errors.push(key + ': ' + e.message); }
  }
  return { models: result, errors, roles };
}

// Publishing a partial bundle defers an extraction failure until a player encounters
// that entity. Both build paths must reject it instead of logging and carrying on.
function assertCompleteModels({ models, errors }) {
  const problems = [...errors];
  const required = [...Object.keys(SPECS), 'biped', 'armorInner', 'armorOuter', 'player', 'playerSlim'];
  for (const name of required) {
    const model = models[name];
    if (!model || !model.parts || !model.parts.some((part) => part.boxes && part.boxes.length)) {
      problems.push(name + ': missing or empty model');
    }
  }
  if (problems.length) throw new Error('Incomplete entity model bundle:\n' + problems.join('\n'));
  return models;
}

module.exports = { extractModels, assertCompleteModels };
