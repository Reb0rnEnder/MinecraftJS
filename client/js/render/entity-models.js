// Entity models (native 1.14.4). Their boxes come from the Minecraft client jar at build time (lib/modelextract.js runs the
// game's model constructors and records every part: bundles/entity-models.json); this file names the parts and holds
// the animation (ports of setRotationAngles / setLivingAnimations).
import { Part } from './boxmodel.js';
import { animateOcelot } from './ocelot-pose.js';

const PI = Math.PI;
const cos = Math.cos, sin = Math.sin, abs = Math.abs, sqrt = Math.sqrt;

let JAR = null;
// Models extracted from the jar ({ name: { fields, parts, nums } }), set once the assets are loaded
export function setJarModels(models) { JAR = models; }
export function hasJarModel(name) { return !!(JAR && JAR[name]); }

// Fresh Parts for a jar model. names[i] names its i-th ModelRenderer field (declaration order, superclass first; a
// field holding an array gives an array); null skips a field. Children come along as in the game.
export function J(name, names) {
  const m = JAR && JAR[name];
  if (!m) throw new Error(`Entity model "${name}" is missing from the assets: rebuild them (npm run assets)`);
  const made = new Map();
  const mk = (i) => {
    if (i === null || i === undefined) return null;
    if (made.has(i)) return made.get(i);
    const q = m.parts[i];
    const p = new Part(q.tw, q.th);
    p.mirror = q.mirror;
    p.visible = q.show;
    for (const b of q.boxes) p.boxes.push({ u: b[0], v: b[1], x: b[2], y: b[3], z: b[4], dx: b[5], dy: b[6], dz: b[7], inflate: b[8], mirror: b[9], quads: b[10] || null });
    p.px = q.p[0]; p.py = q.p[1]; p.pz = q.p[2];
    p.rx = q.r[0]; p.ry = q.r[1]; p.rz = q.r[2];
    made.set(i, p);
    for (const c of q.children) { const cp = mk(c); if (cp) p.add(cp); }
    return p;
  };
  const out = {};
  names.forEach((n, k) => { if (!n) return; const f = m.fields[k]; out[n] = Array.isArray(f) ? f.map(mk) : mk(f); });
  Object.defineProperty(out, 'nums', { value: m.nums || [], enumerable: false });
  return out;
}

const BIPED = ['head', 'headwear', 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg'];
const QUADRUPED = ['head', 'body', 'leg1', 'leg2', 'leg3', 'leg4'];
const D2R = PI / 180;
const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const clamp = (value, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, finite(value)));

function animationArgs(args = {}) {
  const a = { ...args };
  for (const key of ['ls', 'lsa', 'age', 'yaw', 'pitch', 'partial']) a[key] = finite(a[key]);
  a.swing = Number.isFinite(a.swing) && a.swing >= 0 ? clamp(a.swing) : -9999;
  a.inWater = a.inWater ?? true;
  a.onGround = a.onGround ?? true;
  return a;
}

// New adapters retain the jar hierarchy, including parts reachable only through children. A root is
// never also a child (building it twice overwrites Part.obj and leaves a stale, unanimated mesh behind).
// Reset the constructor pose each tick: switching swimming/standing/attacking must not leave stale angles.
// animate's optional showParts is a {partName: boolean} override, or a whitelist of names; arrays of
// parts (saddleParts/reins) can be addressed by their group name. A whitelist preserves ancestors.
function jarAdapter(name, names, pose, options = {}) {
  const p = J(name, names);
  if (JAR[name].fields.length !== names.length) {
    throw new Error(`${name}: unexpected jar field layout; rebuild the assets for this Minecraft version`);
  }
  const all = new Set(), children = new Set();
  const visit = (part) => {
    if (!(part instanceof Part)) throw new Error(`${name}: unexpected jar field layout`);
    if (all.has(part)) return;
    all.add(part);
    for (const child of part.children) { children.add(child); visit(child); }
  };
  Object.values(p).flat().forEach(visit);
  const roots = [...all].filter((part) => !children.has(part));
  const keys = ['px', 'py', 'pz', 'rx', 'ry', 'rz', 'visible'];
  const rest = [...all].map((part) => [part, keys.map((key) => part[key])]);
  const m = {
    parts: p, roots, jarModel: name, modelScale: 1, materialOptions: { cull: false }, ...options,
    animate(model, args) {
      for (const [part, values] of rest) keys.forEach((key, i) => { part[key] = values[i]; });
      const a = animationArgs(args);
      pose(model, a);
      const show = a.showParts;
      if (Array.isArray(show)) {
        const selected = new Set(show.flatMap((key) => model.parts[key] || []));
        const reveal = (part, inherited) => {
          const chosen = inherited || selected.has(part);
          const descendants = part.children.map((child) => reveal(child, chosen));
          part.visible = selected.has(part) || (inherited && part.visible) || descendants.some(Boolean);
          return part.visible;
        };
        model.roots.forEach((part) => reveal(part, false));
      } else if (show && typeof show === 'object') {
        for (const [key, visible] of Object.entries(show)) {
          for (const part of [].concat(model.parts[key] || [])) part.visible = !!visible;
        }
      }
    },
  };
  m.animate(m);
  return m;
}

// ---------------------------------------------------------------- Biped family

// ModelBiped from the jar: 'biped' (64x32), 'armorInner' / 'armorOuter' (inflated 0.5 / 1), or a subclass
export function biped(name = 'biped') {
  const p = J(name, BIPED);
  return { parts: p, roots: BIPED.map((k) => p[k]), animate: animateBiped };
}

// ModelBiped.setRotationAngles (1.12). Arm poses: a.rightPose / a.leftPose = 'empty' | 'item' | 'block' | 'bow'
// (a.heldRight: legacy 0 / 1 = empty / item); a.swingSide: arm that swings (1 right, -1 left);
// a.elytra: elytra flying for more than 4 ticks, a.speedSq: squared motion (slows the limb swing)
export function animateBiped(m, a) {
  a = animationArgs(a);
  const p = m.parts;
  const { ls, lsa, age, yaw, pitch, swing } = a;
  p.head.ry = yaw * PI / 180;
  const swim = clamp(a.swimAmount ?? (a.swimming ? 1 : 0));
  p.head.rx = a.elytra ? -PI / 4 : swim > 0 ? lerpAngle(p.head.rx, a.swimming ? -PI / 4 : pitch * D2R, swim) : pitch * D2R;
  let f = 1;
  if (a.elytra) { f = (a.speedSq || 0) / 0.2; f = f * f * f; }
  if (f < 1) f = 1;
  p.rightArm.rx = cos(ls * 0.6662 + PI) * 2 * lsa * 0.5 / f;
  p.leftArm.rx = cos(ls * 0.6662) * 2 * lsa * 0.5 / f;
  p.rightArm.rz = 0; p.leftArm.rz = 0;
  p.rightLeg.rx = cos(ls * 0.6662) * 1.4 * lsa / f;
  p.leftLeg.rx = cos(ls * 0.6662 + PI) * 1.4 * lsa / f;
  p.rightLeg.ry = 0; p.leftLeg.ry = 0;
  if (a.riding) {
    p.rightArm.rx += -PI / 5; p.leftArm.rx += -PI / 5;
    p.rightLeg.rx = -PI * 2 / 5; p.leftLeg.rx = -PI * 2 / 5;
    p.rightLeg.ry = PI / 10; p.leftLeg.ry = -PI / 10;
  }
  const rp = a.rightPose || (a.heldRight ? 'item' : 'empty'), lp = a.leftPose || 'empty';
  p.rightArm.ry = 0; p.leftArm.ry = 0;
  if (lp === 'block') { p.leftArm.rx = p.leftArm.rx * 0.5 - 0.9424779; p.leftArm.ry = 0.5235988; }
  else if (lp === 'item') p.leftArm.rx = p.leftArm.rx * 0.5 - PI / 10;
  else if (lp === 'spear') { p.leftArm.rx = p.leftArm.rx * 0.5 - PI; p.leftArm.ry = 0; }
  if (rp === 'block') { p.rightArm.rx = p.rightArm.rx * 0.5 - 0.9424779; p.rightArm.ry = -0.5235988; }
  else if (rp === 'item') p.rightArm.rx = p.rightArm.rx * 0.5 - PI / 10;
  else if (rp === 'spear') { p.rightArm.rx = p.rightArm.rx * 0.5 - PI; p.rightArm.ry = 0; }
  p.body.ry = 0;
  p.rightArm.pz = 0; p.rightArm.px = -5; p.leftArm.pz = 0; p.leftArm.px = 5;
  if (swing > -9990) {
    const side = a.swingSide || 1;
    const arm = side > 0 ? p.rightArm : p.leftArm;
    let f1 = swing;
    p.body.ry = sin(sqrt(f1) * PI * 2) * 0.2 * side;
    p.rightArm.pz = sin(p.body.ry) * 5; p.rightArm.px = -cos(p.body.ry) * 5;
    p.leftArm.pz = -sin(p.body.ry) * 5; p.leftArm.px = cos(p.body.ry) * 5;
    p.rightArm.ry += p.body.ry; p.leftArm.ry += p.body.ry; p.leftArm.rx += p.body.ry;
    f1 = 1 - swing; f1 *= f1; f1 *= f1; f1 = 1 - f1;
    const f2 = sin(f1 * PI);
    const f3 = sin(swing * PI) * -(p.head.rx - 0.7) * 0.75;
    arm.rx = arm.rx - (f2 * 1.2 + f3);
    arm.ry += p.body.ry * 2;
    arm.rz += sin(swing * PI) * -0.4;
  }
  const yOff = m.yOff || 0;
  if (a.sneak) {
    p.body.rx = 0.5;
    p.rightArm.rx += 0.4; p.leftArm.rx += 0.4;
    p.rightLeg.pz = 4; p.leftLeg.pz = 4;
    p.rightLeg.py = 9 + yOff; p.leftLeg.py = 9 + yOff;
    p.head.py = 1 + yOff;
  } else {
    p.body.rx = 0;
    p.rightLeg.pz = 0.1; p.leftLeg.pz = 0.1;
    p.rightLeg.py = 12 + yOff; p.leftLeg.py = 12 + yOff;
    p.head.py = yOff;
  }
  p.rightArm.rz += cos(age * 0.09) * 0.05 + 0.05;
  p.leftArm.rz -= cos(age * 0.09) * 0.05 + 0.05;
  p.rightArm.rx += sin(age * 0.067) * 0.05;
  p.leftArm.rx -= sin(age * 0.067) * 0.05;
  if (rp === 'bow' || (a.aimedBow && lp !== 'bow')) {
    p.rightArm.ry = -0.1 + p.head.ry; p.leftArm.ry = 0.1 + p.head.ry + 0.4;
    p.rightArm.rx = -PI / 2 + p.head.rx; p.leftArm.rx = -PI / 2 + p.head.rx;
  } else if (lp === 'bow') {
    p.rightArm.ry = -0.1 + p.head.ry - 0.4; p.leftArm.ry = 0.1 + p.head.ry;
    p.rightArm.rx = -PI / 2 + p.head.rx; p.leftArm.rx = -PI / 2 + p.head.rx;
  }
  const crossbowRight=rp==='crossbow_charge'||rp==='crossbow_hold',crossbowLeft=lp==='crossbow_charge'||lp==='crossbow_hold';
  if(crossbowRight||crossbowLeft){
    const sign=crossbowRight?1:-1,main=crossbowRight?p.rightArm:p.leftArm,off=crossbowRight?p.leftArm:p.rightArm;
    if((crossbowRight?rp:lp)==='crossbow_charge'){
      main.ry=-.8*sign;main.rx=-.97079635;off.rx=main.rx;const f=Math.min(1,(a.useTicks||0)/(a.crossbowChargeDuration||25));
      off.ry=(.4+(.85-.4)*f)*sign;off.rx=main.rx+(-PI/2-main.rx)*f;
    }else{main.ry=-.3*sign+p.head.ry;off.ry=.6*sign+p.head.ry;main.rx=-PI/2+p.head.rx+.1;off.rx=-1.5+p.head.rx;}
  }
  if (swim > 0) animateSwim(p, a, swim);
  p.headwear.copyAngles(p.head);
}

// ModelBiped (cot): a 26-tick breaststroke with pulls at 0..14,
// recovery at 14..22, and arms returning overhead at 22..26.
function lerpAngle(from, to, amount) {
  let delta = (to - from) % (2 * PI);
  if (delta < -PI) delta += 2 * PI;
  if (delta >= PI) delta -= 2 * PI;
  return from + amount * delta;
}
function animateSwim(p, a, swim) {
  const phase = a.ls % 26, right = a.swing > 0 ? 0 : swim;
  const mix = (from, to, t) => from + (to - from) * t;
  let rx, lz, rz;
  if (phase < 14) {
    const curve = (-65 * phase + phase * phase) / (-65 * 14 + 14 * 14);
    rx = 0; lz = PI + 1.8707964 * curve; rz = PI - 1.8707964 * curve;
  } else if (phase < 22) {
    const t = (phase - 14) / 8;
    rx = PI / 2 * t; lz = 5.012389 - 1.8707964 * t; rz = 1.2707963 + 1.8707964 * t;
  } else {
    rx = PI / 2 * (1 - (phase - 22) / 4); lz = rz = PI;
  }
  p.leftArm.rx = lerpAngle(p.leftArm.rx, rx, swim);
  p.leftArm.ry = lerpAngle(p.leftArm.ry, PI, swim);
  p.leftArm.rz = lerpAngle(p.leftArm.rz, lz, swim);
  p.rightArm.rx = mix(p.rightArm.rx, rx, right);
  p.rightArm.ry = mix(p.rightArm.ry, PI, right);
  p.rightArm.rz = mix(p.rightArm.rz, rz, right);
  p.leftLeg.rx = mix(p.leftLeg.rx, 0.3 * cos(a.ls / 3 + PI), swim);
  p.rightLeg.rx = mix(p.rightLeg.rx, 0.3 * cos(a.ls / 3), swim);
}

export function playerModel(slim, tw = 64, th = 64) {
  void tw;
  // 64x32 (legacy) skins: plain ModelBiped; 64x64: ModelPlayer with the separate left limbs and the overlay layers
  if (th !== 64) {
    const m = biped('biped');
    m.slim = false;
    return m;
  }
  const p = J(slim ? 'playerSlim' : 'player', [...BIPED, 'leftArmwear', 'rightArmwear', 'leftLegwear', 'rightLegwear', 'bodywear', 'cape', 'ears']);
  const m = {
    parts: p, slim,
    roots: [p.head, p.headwear, p.body, p.rightArm, p.leftArm, p.rightLeg, p.leftLeg, p.leftLegwear, p.rightLegwear, p.leftArmwear, p.rightArmwear, p.bodywear],
  };
  m.animate = (mm, a) => {
    animateBiped(mm, a);
    const q = mm.parts;
    q.leftLegwear.copyAngles(q.leftLeg); q.rightLegwear.copyAngles(q.rightLeg);
    q.leftArmwear.copyAngles(q.leftArm); q.rightArmwear.copyAngles(q.rightArm);
    q.bodywear.copyAngles(q.body);
    if (slim) { q.rightArm.py = 2.5; q.leftArm.py = 2.5; q.rightArmwear.py = 2.5; q.leftArmwear.py = 2.5; }
  };
  return m;
}

export function zombie(tw = 64, th = 64, villager = false) {
  void tw; void th;
  const m = biped(villager ? 'zombieVillager' : 'zombie');
  m.animate = (mm, a) => {
    animateBiped(mm, a);
    const p = mm.parts;
    const sw = a.swing > 0 ? a.swing : 0; // swingProgress (0 when not swinging)
    const f = sin(sw * PI);
    const f1 = sin((1 - (1 - sw) * (1 - sw)) * PI);
    p.rightArm.rz = 0; p.leftArm.rz = 0;
    p.rightArm.ry = -(0.1 - f * 0.6); p.leftArm.ry = 0.1 - f * 0.6;
    p.rightArm.rx = -PI / 2; p.leftArm.rx = -PI / 2;
    p.rightArm.rx -= f * 1.2 - f1 * 0.4; p.leftArm.rx -= f * 1.2 - f1 * 0.4;
    p.rightArm.rz += cos(a.age * 0.09) * 0.05 + 0.05; p.leftArm.rz -= cos(a.age * 0.09) * 0.05 + 0.05;
    p.rightArm.rx += sin(a.age * 0.067) * 0.05; p.leftArm.rx -= sin(a.age * 0.067) * 0.05;
  };
  return m;
}

export function skeleton() {
  return biped('skeleton');
}

export function enderman() {
  const m = biped('enderman');
  m.yOff = -14;
  m.animate = (mm, a) => {
    animateBiped(mm, { ...a, sneak: false });
    const q = mm.parts;
    q.head.visible = true;
    q.body.rx = 0; q.body.py = -14; q.body.pz = 0;
    q.rightLeg.rx -= 0; q.leftLeg.rx -= 0;
    q.rightArm.rx *= 0.5; q.leftArm.rx *= 0.5; q.rightLeg.rx *= 0.5; q.leftLeg.rx *= 0.5;
    const cl = (v) => Math.max(-0.4, Math.min(0.4, v));
    q.rightArm.rx = cl(q.rightArm.rx); q.leftArm.rx = cl(q.leftArm.rx); q.rightLeg.rx = cl(q.rightLeg.rx); q.leftLeg.rx = cl(q.leftLeg.rx);
    if (a.carrying) { q.rightArm.rx = -0.5; q.leftArm.rx = -0.5; q.rightArm.rz = 0.05; q.leftArm.rz = -0.05; }
    q.rightArm.pz = 0; q.leftArm.pz = 0; q.rightLeg.pz = 0; q.leftLeg.pz = 0;
    q.rightLeg.py = -5; q.leftLeg.py = -5;
    q.head.pz = 0; q.head.py = -13;
    q.headwear.px = q.head.px; q.headwear.py = q.head.py; q.headwear.pz = q.head.pz; q.headwear.rx = q.head.rx; q.headwear.ry = q.head.ry; q.headwear.rz = q.head.rz;
    if (a.screaming) { q.head.py -= 5; }
  };
  return m;
}

export function villager(tw = 64, th = 64, witch = false) {
  void tw; void th;
  return jarAdapter(witch?'witch':'villager', ['head','hat','hatRim','body','jacket','arms','rightLeg','leftLeg','nose',...(witch?['mole']:[])], (m,a)=>{
    const p=m.parts;p.head.ry=a.yaw*D2R;p.head.rx=a.pitch*D2R;
    p.arms.py=3;p.arms.pz=-1;p.arms.rx=-.75;
    p.rightLeg.rx=cos(a.ls*.6662)*1.4*a.lsa*.5;p.leftLeg.rx=cos(a.ls*.6662+PI)*1.4*a.lsa*.5;
    if(a.hideHat){p.hat.visible=false;p.hatRim.visible=false;}
    if(witch&&a.witchDrinking){p.nose.py=-2+sin(a.age*.8)*1.5;}
  });
}

export function cat(){
  const animate=ocelot().animate;
  return jarAdapter('cat',['backLeft','backRight','frontLeft','frontRight','tail','tail2','head','body'],(m,a)=>animate(m,a),{modelScale:.8});
}

// Geometry, hierarchy and UVs come from the target BeeModel constructor.
export function bee(){
  return jarAdapter('bee',['bone','body','rightWing','leftWing','frontLeg','midLeg','backLeg','stinger','leftAntenna','rightAntenna'],(m,a={})=>{
    const p=m.parts,age=a.age||0,grounded=a.onGround&&(a.speedSq||0)<1e-7;
    p.stinger.visible=!a.hasStung;p.rightWing.rx=0;p.leftWing.rx=0;p.leftAntenna.rx=p.rightAntenna.rx=0;p.bone.rx=0;p.bone.py=19;
    if(grounded){p.rightWing.ry=-.2618;p.rightWing.rz=0;p.leftWing.ry=.2618;p.leftWing.rz=0;p.frontLeg.rx=p.midLeg.rx=p.backLeg.rx=0;}
    else{p.rightWing.ry=p.leftWing.ry=0;p.rightWing.rz=Math.cos(age*2.1)*Math.PI*.15;p.leftWing.rz=-p.rightWing.rz;p.frontLeg.rx=p.midLeg.rx=p.backLeg.rx=.7853982;p.bone.ry=p.bone.rz=0;}
    if(!a.angry){p.bone.rx=p.bone.ry=p.bone.rz=0;if(!grounded){const bob=Math.cos(age*.18);p.bone.rx=.1+bob*Math.PI*.025;p.leftAntenna.rx=p.rightAntenna.rx=bob*Math.PI*.03;p.frontLeg.rx=-bob*Math.PI*.1+.3926991;p.backLeg.rx=-bob*Math.PI*.05+.7853982;p.bone.py=19-bob*.9;}}
    if(a.beeRoll>0)p.bone.rx+=(3.0915928-p.bone.rx)*a.beeRoll;

  });
}
export function fox(){
  return jarAdapter('fox',['head','leftEar','rightEar','nose','body','rightHindLeg','leftHindLeg','rightFrontLeg','leftFrontLeg','tail'],(m,a)=>{
    const p=m.parts;p.head.rx=a.pitch*D2R;p.head.ry=a.yaw*D2R;
    for(const [key,phase] of [['rightHindLeg',0],['leftHindLeg',PI],['rightFrontLeg',PI],['leftFrontLeg',0]])p[key].rx=cos(a.ls*.6662+phase)*1.4*a.lsa;
  });
}
export function panda(){return jarAdapter('panda',QUADRUPED,(m,a)=>animateQuadruped(m,a),{quadruped:true,childY:8,childZ:4});}
export function ravager(){return jarAdapter('ravager',['head','mouth','body','leg1','leg2','leg3','leg4','neck'],(m,a)=>{
  const p=m.parts;p.head.rx=a.pitch*D2R;p.head.ry=a.yaw*D2R;
  for(const [key,phase] of [['leg1',0],['leg2',PI],['leg3',PI],['leg4',0]])p[key].rx=cos(a.ls*.6662+phase)*.4*a.lsa;
});}

// ---------------------------------------------------------------- Quadrupeds

// ModelQuadruped subclasses; nums = [childYOffset, childZOffset]
function quadruped(name) {
  const p = J(name, QUADRUPED);
  return {
    parts: p, roots: QUADRUPED.map((k) => p[k]), childY: p.nums[0], childZ: p.nums[1], quadruped: true,
    animate: animateQuadruped,
  };
}

function animateQuadruped(m, a) {
  const p = m.parts;
  p.head.rx = a.pitch * PI / 180; p.head.ry = a.yaw * PI / 180;
  p.body.rx = PI / 2;
  p.leg1.rx = cos(a.ls * 0.6662) * 1.4 * a.lsa;
  p.leg2.rx = cos(a.ls * 0.6662 + PI) * 1.4 * a.lsa;
  p.leg3.rx = cos(a.ls * 0.6662 + PI) * 1.4 * a.lsa;
  p.leg4.rx = cos(a.ls * 0.6662) * 1.4 * a.lsa;
}

export function pig() { return quadruped('pig'); }

export function cow() { return quadruped('cow'); }

export function sheep(wool) {
  const m = quadruped(wool ? 'sheepWool' : 'sheep');
  const base = m.animate;
  m.animate = (mm, a) => {
    base(mm, a);
    if (a.eatingGrass > 0) {
      const t = a.eatingGrass;
      const headY = t <= 0 ? 0 : t >= 4 && t <= 36 ? 1 : t < 4 ? (t - a.partial) / 4 : -(t - 40 - a.partial) / 4;
      mm.parts.head.py = 6 + headY * 9;
      mm.parts.head.rx = t > 4 && t <= 36 ? PI / 5 + PI * 7 / 100 * sin((t - 4 - a.partial) / 32 * 28.7) : (t > 0 ? PI / 5 : a.pitch * PI / 180);
    } else mm.parts.head.py = 6;
  };
  return m;
}

export function chicken() {
  const p = J('chicken', ['head', 'body', 'rightLeg', 'leftLeg', 'rightWing', 'leftWing', 'bill', 'chin']);
  return {
    parts: p, roots: [p.head, p.bill, p.chin, p.body, p.rightLeg, p.leftLeg, p.rightWing, p.leftWing], childY: 5, childZ: 2, chickenChild: true,
    animate: (m, a) => {
      const q = m.parts;
      for (const k of ['head', 'bill', 'chin']) { q[k].rx = a.pitch * PI / 180; q[k].ry = a.yaw * PI / 180; }
      q.body.rx = PI / 2;
      q.rightLeg.rx = cos(a.ls * 0.6662) * 1.4 * a.lsa;
      q.leftLeg.rx = cos(a.ls * 0.6662 + PI) * 1.4 * a.lsa;
      const w = a.onGround ? 0 : (sin(a.age * 1.5) + 1) * 0.8;
      q.rightWing.rz = w; q.leftWing.rz = -w;
    },
  };
}

export function wolf() {
  const p = J('wolf', ['head', 'body', 'leg1', 'leg2', 'leg3', 'leg4', 'tail', 'mane']);
  return {
    parts: p, roots: [p.head, p.body, p.mane, p.leg1, p.leg2, p.leg3, p.leg4, p.tail], childY: 5, childZ: 2, quadruped: true,
    animate: (m, a) => {
      const q = m.parts;
      if (a.sitting) {
        q.mane.py = 16; q.mane.px = -1; q.mane.pz = -3; q.mane.rx = PI * 2 / 5; q.mane.ry = 0;
        q.body.py = 18; q.body.pz = 0; q.body.rx = PI / 4;
        q.tail.py = 21; q.tail.pz = 6;
        q.leg1.px = -2.5; q.leg1.py = 22; q.leg1.pz = 2; q.leg1.rx = PI * 3 / 2;
        q.leg2.px = 0.5; q.leg2.py = 22; q.leg2.pz = 2; q.leg2.rx = PI * 3 / 2;
        q.leg3.rx = 5.811947; q.leg3.px = -2.49; q.leg3.py = 17; q.leg3.pz = -4;
        q.leg4.rx = 5.811947; q.leg4.px = 0.51; q.leg4.py = 17; q.leg4.pz = -4;
      } else {
        q.body.py = 14; q.body.pz = 2; q.body.rx = PI / 2;
        q.mane.py = 14; q.mane.pz = -3; q.mane.px = -1; q.mane.rx = PI / 2; // ModelWolf: mane sits in front of the body
        q.tail.py = 12; q.tail.pz = 8;
        q.leg1.py = 16; q.leg1.pz = 7; q.leg2.py = 16; q.leg2.pz = 7; q.leg3.py = 16; q.leg3.pz = -4; q.leg4.py = 16; q.leg4.pz = -4;
        q.leg1.px = -2.5; q.leg2.px = 0.5; q.leg3.px = -2.5; q.leg4.px = 0.5;
        q.leg1.rx = cos(a.ls * 0.6662) * 1.4 * a.lsa; q.leg2.rx = cos(a.ls * 0.6662 + PI) * 1.4 * a.lsa;
        q.leg3.rx = cos(a.ls * 0.6662 + PI) * 1.4 * a.lsa; q.leg4.rx = cos(a.ls * 0.6662) * 1.4 * a.lsa;
      }
      q.head.rx = a.pitch * PI / 180; q.head.ry = a.yaw * PI / 180;
      q.head.rz = 0;
      q.tail.rx = a.tailRotation !== undefined ? a.tailRotation : PI / 5;
      q.tail.ry = a.angry ? 0 : cos(a.ls * 0.6662) * 1.4 * a.lsa;
    },
  };
}

export function ocelot() {
  const p = J('ocelot', ['backLeft', 'backRight', 'frontLeft', 'frontRight', 'tail', 'tail2', 'head', 'body']);
  return {parts:p, roots:Object.values(p), childY:10, childZ:4, animate:animateOcelot};
}

export function rabbit() {
  const p = J('rabbit', ['leftFoot', 'rightFoot', 'leftThigh', 'rightThigh', 'body', 'leftArm', 'rightArm', 'head', 'rightEar', 'leftEar', 'tail', 'nose']);
  return {
    parts: p, roots: Object.values(p), modelScale: 0.6, modelTranslateY: 16 * 0.0625 * (1 / 0.6 - 1) * 0.6,
    animate: (m, a) => {
      const q = m.parts;
      const yaw = a.yaw * PI / 180, pitch = a.pitch * PI / 180;
      for (const k of ['head', 'nose', 'rightEar', 'leftEar']) { q[k].rx = pitch; q[k].ry = yaw; }
      q.rightEar.ry = yaw - 0.2617994; q.leftEar.ry = yaw + 0.2617994;
      const jump = a.onGround ? 0 : sin(a.age * 0.5) * 0.5 + 0.5;
      q.leftThigh.rx = (jump * 50 - 21) * PI / 180; q.rightThigh.rx = q.leftThigh.rx;
      q.leftFoot.rx = jump * 50 * PI / 180; q.rightFoot.rx = q.leftFoot.rx;
      q.leftArm.rx = (jump * -40 - 11) * PI / 180; q.rightArm.rx = q.leftArm.rx;
    },
  };
}

// type is fixed at construction: 0/horse, 1/donkey, 2/mule, 3/zombie_horse, 4/skeleton_horse.
// The 1.13 base has NINE fields (two arrays), the donkey subclass ELEVEN; no detached shins/jaws.
// Saddle and reins remain children of body/neck; chests remain children of the donkey's body.
export function horse(type = 0) {
  const types = ['horse', 'donkey', 'mule', 'zombie_horse', 'skeleton_horse'];
  const kind = typeof type === 'string' ? (types.includes(type) ? type : 'horse') : (types[type] || 'horse');
  const chested = kind === 'donkey' || kind === 'mule';
  const names = ['body', 'neck', 'leftHindLeg', 'rightHindLeg', 'leftFrontLeg', 'rightFrontLeg', 'tail', 'saddleParts', 'reins'];
  const m = jarAdapter(chested ? 'donkey' : 'horse', [...names, ...(chested ? ['leftChest', 'rightChest'] : [])], (model, a) => {
    const q = model.parts, rear = clamp(a.rearing), graze = clamp(a.grazing), mouth = clamp(a.mouthOpen);
    const neutral = 1 - Math.max(rear, graze), down = 1 - rear;
    const yaw = clamp(a.yaw, -20, 20) * D2R;
    const pitch = a.pitch * D2R + (a.lsa > 0.2 ? cos(a.ls * 0.4) * 0.15 * a.lsa : 0);
    const gait = cos((a.inWater ? 0.2 : 1) * a.ls * 0.6662 + PI);
    q.neck.rx = rear * (PI / 12 + pitch) + graze * (2.1816616 + sin(a.age) * 0.05)
      + neutral * (PI / 6 + pitch + mouth * sin(a.age) * 0.05);
    q.neck.ry = (rear + neutral) * yaw;
    q.neck.py = rear * -4 + graze * 11 + neutral * 4;
    q.neck.pz = rear * -4 - (graze + neutral) * 12;
    q.body.rx = -rear * PI / 4;
    q.leftFrontLeg.py = q.rightFrontLeg.py = 2 * rear + 14 * down;
    q.leftFrontLeg.pz = q.rightFrontLeg.pz = -6 * rear - 10 * down;
    const paw = cos(a.age * 0.6 + PI), walk = gait * 0.8 * a.lsa;
    q.leftFrontLeg.rx = (-PI / 3 + paw) * rear + walk * down;
    q.rightFrontLeg.rx = (-PI / 3 - paw) * rear - walk * down;
    q.leftHindLeg.rx = PI / 12 * rear - gait * 0.5 * a.lsa * down;
    q.rightHindLeg.rx = PI / 12 * rear + gait * 0.5 * a.lsa * down;
    q.tail.rx = PI / 6 + a.lsa * 0.75;
    q.tail.py = -5 + a.lsa; q.tail.pz = 2 + a.lsa * 2;
    q.tail.ry = a.tailWag ? cos(a.age * 0.7) : 0;
    q.saddleParts.forEach((part) => { part.visible = !!a.saddled; });
    q.reins.forEach((part) => { part.visible = !!a.saddled && !!a.hasRider; });
    if (chested) q.leftChest.visible = q.rightChest.visible = !!a.chested && !a.child;
  }, {
    horseType: kind, modelScale: kind === 'donkey' ? 0.87 : kind === 'mule' ? 0.92 : 1,
    texture: 'entity/horse/' + ({ horse: 'horse_white', zombie_horse: 'horse_zombie', skeleton_horse: 'horse_skeleton' }[kind] || kind) + '.png',
  });
  const p = m.parts;
  [p.head, p.mane, p.muzzle, p.leftEar, p.rightEar] = p.neck.children;
  [p.saddle, p.leftBit, p.rightBit, p.faceRopes, p.noseBand] = p.saddleParts;
  [p.leftRein, p.rightRein] = p.reins;
  return m;
}

// ---------------------------------------------------------------- Previously unbound 1.10-1.12 families

// rearing: interpolated EntityPolarBear standing animation, 0..1.
export function polarBear() {
  return jarAdapter('polarBear', QUADRUPED, (m, a) => {
    animateQuadruped(m, a);
    const p = m.parts, stand = clamp(a.rearing) ** 2, down = 1 - stand;
    p.body.rx = PI / 2 - stand * PI * 0.35; p.body.py = 9 * down + 11 * stand;
    p.leg3.py = p.leg4.py = 14 * down - 6 * stand;
    p.leg3.pz = p.leg4.pz = -8 * down - 4 * stand;
    p.leg3.rx -= stand * PI * 0.45; p.leg4.rx -= stand * PI * 0.45;
    p.head.py = 10 * down - 12 * stand; p.head.pz = -16 * down - 3 * stand;
    p.head.rx += stand * PI * 0.15;
  }, { texture: 'entity/bear/polarbear.png', modelScale: 1.2, quadruped: true, childY: 8, childZ: 6 });
}

// decor=true is the jar's inflated LayerLlamaDecor model. Bind the chosen dye texture separately.
export function llama(decor = false) {
  return jarAdapter(decor ? 'llamaDecor' : 'llama', [...QUADRUPED, 'rightChest', 'leftChest'], (m, a) => {
    animateQuadruped(m, a);
    m.parts.rightChest.visible = m.parts.leftChest.visible = !!a.chested && !a.child;
  }, { texture: decor ? 'entity/llama/decor/white.png' : 'entity/llama/creamy.png', quadruped: true, childY: 8, childZ: 6 });
}

// age is ticks, flap is the renderer's interpolated wing amplitude (not ageInTicks). If omitted,
// flying derives a bounded flap from age. sitting and dancing take precedence over onGround.
export function parrot(variant = 0) {
  const colors = ['red_blue', 'blue', 'green', 'yellow_blue', 'grey'];
  return jarAdapter('parrot', ['body', 'tail', 'leftWing', 'rightWing', 'head', 'face', 'upperBeak', 'lowerBeak', 'crest', 'leftLeg', 'rightLeg'], (m, a) => {
    const p = m.parts, flying = a.flying ?? !a.onGround;
    const flap = finite(a.flap, flying ? (sin(a.age * 1.5) + 1) * 0.8 : 0);
    p.crest.rx = -0.2214; p.body.rx = 0.4937;
    p.leftWing.rx = p.rightWing.rx = -0.6981;
    p.leftWing.ry = p.rightWing.ry = -PI;
    p.leftLeg.rx = p.rightLeg.rx = -0.0299;
    p.head.rx = a.pitch * D2R; p.head.ry = a.yaw * D2R;
    if (a.dancing) {
      const x = cos(a.age), y = sin(a.age);
      p.head.px = p.body.px = p.tail.px = x;
      p.head.py += y; p.body.py += y; p.tail.py += y;
      p.head.rx = p.head.ry = 0; p.head.rz = y * 0.4;
      p.leftWing.px += x; p.rightWing.px += x;
      p.leftWing.py += y; p.rightWing.py += y;
      p.leftWing.rz = -0.0873 - flap; p.rightWing.rz = 0.0873 + flap;
      p.leftLeg.rz = -PI / 9; p.rightLeg.rz = PI / 9;
    } else if (a.sitting) {
      for (const part of [p.head, p.body, p.tail, p.leftWing, p.rightWing, p.leftLeg, p.rightLeg]) part.py += 1.9;
      p.tail.rx = 1.5388988; p.leftWing.rz = -0.0873; p.rightWing.rz = 0.0873;
      p.leftLeg.rx += PI / 2; p.rightLeg.rx += PI / 2;
    } else {
      const bob = flap * 0.3;
      for (const part of [p.head, p.body, p.tail, p.leftWing, p.rightWing, p.leftLeg, p.rightLeg]) part.py += bob;
      p.tail.rx = 1.015 + cos(a.ls * 0.6662) * 0.3 * a.lsa;
      p.leftWing.rz = -0.0873 - flap; p.rightWing.rz = 0.0873 + flap;
      if (flying) { p.leftLeg.rx += 0.6981317; p.rightLeg.rx += 0.6981317; }
      else {
        p.leftLeg.rx += cos(a.ls * 0.6662) * 1.4 * a.lsa;
        p.rightLeg.rx += cos(a.ls * 0.6662 + PI) * 1.4 * a.lsa;
      }
    }
  }, { texture: 'entity/parrot/parrot_' + (colors[variant] || colors[0]) + '.png' });
}

export function vex() {
  return jarAdapter('vex', [...BIPED, 'leftWing', 'rightWing'], (m, a) => {
    animateBiped(m, a);
    const p = m.parts;
    if (a.charging) p[a.leftHanded ? 'leftArm' : 'rightArm'].rx = PI * 1.2;
    p.rightLeg.rx += PI / 5;
    p.leftWing.py = p.rightWing.py = 1; p.leftWing.pz = p.rightWing.pz = 2;
    p.rightWing.ry = 0.47123894 + cos(a.age * 0.8) * PI * 0.05;
    p.leftWing.ry = -p.rightWing.ry;
    p.leftWing.rx = p.rightWing.rx = 0.47123894;
    p.leftWing.rz = -0.47123894; p.rightWing.rz = 0.47123894;
  }, { texture: 'entity/illager/vex.png', modelScale: 0.4 });
}

// pose: crossed (default), attacking, spellcasting, bow. Illusioners show the constructor-hidden hat.
export function illager(kind = 'evoker') {
  if (!['evoker', 'vindicator', 'illusioner','pillager'].includes(kind)) kind = 'evoker';
  return jarAdapter('illager', ['head', 'hat', 'body', 'arms', 'rightLeg', 'leftLeg', 'nose', 'rightArm', 'leftArm'], (m, a) => {
    const p = m.parts;
    const pose = a.pose || (a.spellcasting ? 'spellcasting' : a.attacking ? 'attacking' : a.aimedBow ? 'bow' : 'crossed');
    p.head.ry = a.yaw * D2R; p.head.rx = a.pitch * D2R;
    p.hat.visible = a.showHat ?? kind === 'illusioner';
    p.arms.py = 3; p.arms.pz = -1; p.arms.rx = -0.75;
    p.arms.visible = pose === 'crossed'; p.rightArm.visible = p.leftArm.visible = pose !== 'crossed';
    p.rightLeg.rx = cos(a.ls * 0.6662) * 0.7 * a.lsa;
    p.leftLeg.rx = cos(a.ls * 0.6662 + PI) * 0.7 * a.lsa;
    if (pose === 'attacking') {
      const sw = Math.max(0, a.swing), f = sin(sw * PI), g = sin((1 - (1 - sw) ** 2) * PI);
      const main = a.leftHanded ? p.leftArm : p.rightArm, off = a.leftHanded ? p.rightArm : p.leftArm;
      p.rightArm.ry = PI / 20; p.leftArm.ry = -PI / 20;
      main.rx = -1.8849558 + cos(a.age * 0.09) * 0.15 + f * 2.2 - g * 0.4;
      off.rx = cos(a.age * 0.19) * 0.5 + f * 1.2 - g * 0.4;
      p.rightArm.rz = cos(a.age * 0.09) * 0.05 + 0.05; p.leftArm.rz = -p.rightArm.rz;
      p.rightArm.rx += sin(a.age * 0.067) * 0.05; p.leftArm.rx -= sin(a.age * 0.067) * 0.05;
    } else if (pose === 'spellcasting') {
      p.rightArm.rx = p.leftArm.rx = cos(a.age * 0.6662) * 0.25;
      p.rightArm.rz = PI * 0.75; p.leftArm.rz = -PI * 0.75;
    } else if (pose === 'bow') {
      p.rightArm.ry = -0.1 + p.head.ry; p.rightArm.rx = -PI / 2 + p.head.rx;
      p.leftArm.rx = -0.9424779 + p.head.rx; p.leftArm.ry = p.head.ry - 0.4; p.leftArm.rz = PI / 2;
    }
  }, { texture: 'entity/illager/' + kind + '.png', modelScale: 0.9375 });
}

// ---------------------------------------------------------------- Monsters

export function creeper() {
  const p = J('creeper', ['head', null, 'body', 'leg1', 'leg2', 'leg3', 'leg4']);
  return { parts: p, roots: [p.head, p.body, p.leg1, p.leg2, p.leg3, p.leg4], animate: animateQuadrupedNoBody };
}

function animateQuadrupedNoBody(m, a) {
  const p = m.parts;
  p.head.ry = a.yaw * PI / 180; p.head.rx = a.pitch * PI / 180;
  p.leg1.rx = cos(a.ls * 0.6662) * 1.4 * a.lsa;
  p.leg2.rx = cos(a.ls * 0.6662 + PI) * 1.4 * a.lsa;
  p.leg3.rx = cos(a.ls * 0.6662 + PI) * 1.4 * a.lsa;
  p.leg4.rx = cos(a.ls * 0.6662) * 1.4 * a.lsa;
}

export function spider() {
  const p = J('spider', ['head', 'neck', 'body', 'leg1', 'leg2', 'leg3', 'leg4', 'leg5', 'leg6', 'leg7', 'leg8']);
  return {
    parts: p, roots: [p.head, p.neck, p.body, p.leg1, p.leg2, p.leg3, p.leg4, p.leg5, p.leg6, p.leg7, p.leg8],
    animate: (m, a) => {
      const q = m.parts;
      q.head.ry = a.yaw * PI / 180; q.head.rx = a.pitch * PI / 180;
      const f = PI / 4;
      q.leg1.rz = -f; q.leg2.rz = f; q.leg3.rz = -f * 0.74; q.leg4.rz = f * 0.74;
      q.leg5.rz = -f * 0.74; q.leg6.rz = f * 0.74; q.leg7.rz = -f; q.leg8.rz = f;
      const f2 = 0.3926991;
      q.leg1.ry = f2 * 2; q.leg2.ry = -f2 * 2; q.leg3.ry = f2; q.leg4.ry = -f2;
      q.leg5.ry = -f2; q.leg6.ry = f2; q.leg7.ry = -f2 * 2; q.leg8.ry = f2 * 2;
      const ls = a.ls, lsa = a.lsa;
      const f3 = -(cos(ls * 0.6662 * 2) * 0.4) * lsa;
      const f4 = -(cos(ls * 0.6662 * 2 + PI) * 0.4) * lsa;
      const f5 = -(cos(ls * 0.6662 * 2 + PI / 2) * 0.4) * lsa;
      const f6 = -(cos(ls * 0.6662 * 2 + PI * 3 / 2) * 0.4) * lsa;
      const f7 = abs(sin(ls * 0.6662) * 0.4) * lsa;
      const f8 = abs(sin(ls * 0.6662 + PI) * 0.4) * lsa;
      const f9 = abs(sin(ls * 0.6662 + PI / 2) * 0.4) * lsa;
      const f10 = abs(sin(ls * 0.6662 + PI * 3 / 2) * 0.4) * lsa;
      q.leg1.ry += f3; q.leg2.ry += -f3; q.leg3.ry += f4; q.leg4.ry += -f4;
      q.leg5.ry += f5; q.leg6.ry += -f5; q.leg7.ry += f6; q.leg8.ry += -f6;
      q.leg1.rz += f7; q.leg2.rz += -f7; q.leg3.rz += f8; q.leg4.rz += -f8;
      q.leg5.rz += f9; q.leg6.rz += -f9; q.leg7.rz += f10; q.leg8.rz += -f10;
    },
  };
}

export function slime(outer) {
  if (outer) {
    const p = J('slimeOuter', ['cube']);
    return { parts: p, roots: [p.cube], animate() {} };
  }
  const p = J('slime', ['cube', 'rightEye', 'leftEye', 'mouth']);
  return { parts: p, roots: [p.cube, p.rightEye, p.leftEye, p.mouth], animate() {} };
}

export function magmaCube() {
  const p = J('magmaCube', ['segs', 'core']);
  return {
    parts: p, roots: [p.core, ...p.segs],
    animate: (m, a) => {
      const f = a.squish || 0;
      for (let i = 0; i < 8; i++) m.parts.segs[i].py = -(4 - i) * f * 1.7;
    },
  };
}

export function silverfish() {
  const p = J('silverfish', ['parts', 'wings']);
  return {
    parts: p, roots: [...p.parts, ...p.wings],
    animate: (m, a) => {
      for (let i = 0; i < 7; i++) {
        m.parts.parts[i].ry = cos(a.age * 0.9 + i * 0.15 * PI) * PI * 0.05 * (1 + abs(i - 2));
        m.parts.parts[i].px = sin(a.age * 0.9 + i * 0.15 * PI) * PI * 0.2 * abs(i - 2);
      }
      m.parts.wings[0].ry = m.parts.parts[2].ry; m.parts.wings[1].ry = m.parts.parts[4].ry; m.parts.wings[1].px = m.parts.parts[4].px;
      m.parts.wings[2].ry = m.parts.parts[1].ry; m.parts.wings[2].px = m.parts.parts[1].px;
    },
  };
}

export function endermite() {
  const p = J('endermite', ['parts']);
  return {
    parts: p, roots: p.parts,
    animate: (m, a) => {
      for (let i = 0; i < 4; i++) {
        m.parts.parts[i].ry = cos(a.age * 0.9 + i * 0.15 * PI) * PI * 0.01 * (1 + abs(i - 2));
        m.parts.parts[i].px = sin(a.age * 0.9 + i * 0.15 * PI) * PI * 0.1 * abs(i - 2);
      }
    },
  };
}

export function blaze() {
  const p = J('blaze', ['rods', 'head']);
  return {
    parts: p, roots: [p.head, ...p.rods],
    animate: (m, a) => {
      const q = m.parts;
      let f = a.age * PI * -0.1;
      for (let i = 0; i < 4; i++) {
        q.rods[i].py = -2 + cos((i * 2 + a.age) * 0.25);
        q.rods[i].px = cos(f) * 9; q.rods[i].pz = sin(f) * 9;
        f++;
      }
      f = PI / 4 + a.age * PI * 0.03;
      for (let i = 4; i < 8; i++) {
        q.rods[i].py = 2 + cos((i * 2 + a.age) * 0.25);
        q.rods[i].px = cos(f) * 7; q.rods[i].pz = sin(f) * 7;
        f++;
      }
      f = 0.47123894 + a.age * PI * -0.05;
      for (let i = 8; i < 12; i++) {
        q.rods[i].py = 11 + cos((i * 1.5 + a.age) * 0.5);
        q.rods[i].px = cos(f) * 5; q.rods[i].pz = sin(f) * 5;
        f++;
      }
      q.head.ry = a.yaw * PI / 180; q.head.rx = a.pitch * PI / 180;
    },
  };
}

export function ghast() {
  const p = J('ghast', ['body', 'tentacles']);
  return {
    parts: p, roots: [p.body, ...p.tentacles], modelScale: 4.5, ghast: true,
    animate: (m, a) => { for (let i = 0; i < 9; i++) m.parts.tentacles[i].rx = 0.2 * sin(a.age * 0.3 + i) + 0.4; },
  };
}

// ModelGuardian: spines and tail hang off the body; the spines' directions (ModelGuardian's static tables) are set
// once here, their distance from the body each frame
export function guardian() {
  const p = J('guardian', ['body', 'eye', 'spikes', 'tail']);
  const sx = [1.75, 0.25, 0, 0, 0.5, 0.5, 0.5, 0.5, 1.25, 0.75, 0, 0];
  const sy = [0, 0, 0, 0, 0.25, 1.75, 1.25, 0.75, 0, 0, 0, 0];
  const sz = [0, 0, 0.25, 1.75, 0, 0, 0, 0, 0, 0, 0.75, 1.25];
  const ox = [0, 0, 8, -8, -8, 8, 8, -8, 0, 0, 8, -8];
  const oy = [-8, -8, -8, -8, 0, 0, 0, 0, 8, 8, 8, 8];
  const oz = [8, -8, 0, 0, -8, -8, 8, 8, 8, -8, 0, 0];
  p.spikes.forEach((s, i) => { s.rx = PI * sx[i]; s.ry = PI * sy[i]; s.rz = PI * sz[i]; s._base = [ox[i], oy[i], oz[i]]; });
  p.eye.pivot(0, 0, -8.25);
  p.tail[1].pivot(-1.5, 0.5, 14); p.tail[2].pivot(0.5, 0.5, 6);
  return {
    parts: p, roots: [p.body],
    animate: (m, a) => {
      const q = m.parts;
      q.body.ry = a.yaw * PI / 180; q.body.rx = a.pitch * PI / 180;
      const ext = 1 - (1 + cos(a.age * 0.1)) * 0.0;
      for (let i = 0; i < 12; i++) {
        const s = q.spikes[i];
        s.px = s._base[0] * (1 + cos(a.age * 1.5 + i) * 0.01 - ext * 0); s.py = 16 + s._base[1] * (1 + cos(a.age * 1.5 + i) * 0.01); s.pz = s._base[2] * (1 + cos(a.age * 1.5 + i) * 0.01);
      }
      const tailSwing = sin(a.age * 0.25) * PI * 0.05;
      q.tail[0].ry = tailSwing; q.tail[1].ry = tailSwing * 1.5; q.tail[2].ry = tailSwing * 2;
    },
  };
}

export function bat() {
  const p = J('bat', ['head', 'body', 'rightWing', 'leftWing', 'rightWingTip', 'leftWingTip']);
  return {
    parts: p, roots: [p.head, p.body], modelScale: 0.35,
    animate: (m, a) => {
      const q = m.parts;
      if (a.hanging) {
        q.head.rx = a.pitch * PI / 180; q.head.ry = PI - a.yaw * PI / 180; q.head.rz = PI;
        q.head.px = 0; q.head.py = -2; q.head.pz = 0;
        q.rightWing.px = -3; q.rightWing.py = 0; q.rightWing.pz = 3; q.leftWing.px = 3; q.leftWing.py = 0; q.leftWing.pz = 3;
        q.body.rx = PI; q.rightWing.rx = -0.15707964; q.rightWing.ry = -PI * 2 / 5; q.rightWingTip.ry = -1.7278761;
        q.leftWing.rx = q.rightWing.rx; q.leftWing.ry = -q.rightWing.ry; q.leftWingTip.ry = -q.rightWingTip.ry;
      } else {
        q.head.rx = a.pitch * PI / 180; q.head.ry = a.yaw * PI / 180; q.head.rz = 0;
        q.head.px = 0; q.head.py = 0; q.head.pz = 0;
        q.rightWing.px = 0; q.rightWing.py = 0; q.rightWing.pz = 0; q.leftWing.px = 0; q.leftWing.py = 0; q.leftWing.pz = 0;
        q.body.rx = PI / 4 + cos(a.age * 0.1) * 0.15; q.body.ry = 0;
        q.rightWing.ry = cos(a.age * 1.3) * PI * 0.25; q.leftWing.ry = -q.rightWing.ry;
        q.rightWingTip.ry = q.rightWing.ry * 0.5; q.leftWingTip.ry = -q.rightWing.ry * 0.5;
      }
    },
  };
}

export function squid() {
  const p = J('squid', ['body', 'tentacles']);
  return {
    parts: p, roots: [p.body, ...p.tentacles],
    animate: (m, a) => { for (const t of m.parts.tentacles) t.rx = a.tentacleAngle !== undefined ? a.tentacleAngle : (sin(a.age * 0.2) + 1) * 0.3; },
  };
}

export function ironGolem() {
  const p = J('ironGolem', ['head', 'body', 'rightArm', 'leftArm', 'leftLeg', 'rightLeg']);
  const tri = (x, y) => (abs(x % y - y * 0.5) - y * 0.25) / (y * 0.25);
  return {
    parts: p, roots: [p.head, p.body, p.rightArm, p.leftArm, p.leftLeg, p.rightLeg],
    animate: (m, a) => {
      const q = m.parts;
      q.head.ry = a.yaw * PI / 180; q.head.rx = a.pitch * PI / 180;
      q.leftLeg.rx = -1.5 * tri(a.ls, 13) * a.lsa;
      q.rightLeg.rx = 1.5 * tri(a.ls, 13) * a.lsa;
      q.leftLeg.ry = 0; q.rightLeg.ry = 0;
      if (a.attackTimer > 0) {
        q.rightArm.rx = -2 + 1.5 * tri(a.attackTimer - a.partial, 10);
        q.leftArm.rx = -2 + 1.5 * tri(a.attackTimer - a.partial, 10);
      } else {
        q.rightArm.rx = (-0.2 + 1.5 * tri(a.ls, 13)) * a.lsa;
        q.leftArm.rx = (-0.2 - 1.5 * tri(a.ls, 13)) * a.lsa;
      }
    },
  };
}

export function snowman() {
  const p = J('snowman', ['body', 'bottomBody', 'head', 'rightHand', 'leftHand']);
  return {
    parts: p, roots: [p.body, p.bottomBody, p.head, p.rightHand, p.leftHand],
    animate: (m, a) => {
      const q = m.parts;
      q.head.ry = a.yaw * PI / 180; q.head.rx = a.pitch * PI / 180;
      q.body.ry = a.yaw * PI / 180 * 0.25;
      const f = sin(q.body.ry), f1 = cos(q.body.ry);
      q.rightHand.rz = 1; q.leftHand.rz = -1;
      q.rightHand.ry = 0 + q.body.ry; q.leftHand.ry = PI + q.body.ry;
      q.rightHand.px = f1 * 5; q.rightHand.pz = -f * 5;
      q.leftHand.px = -f1 * 5; q.leftHand.pz = f * 5;
    },
  };
}

export function wither() {
  const p = J('wither', ['upper', 'heads']);
  const [shoulders, spine, tail] = p.upper;
  const [head1, head2, head3] = p.heads;
  Object.assign(p, { shoulders, spine, tail, head1, head2, head3 });
  return {
    parts: p, roots: [shoulders, spine, tail, head1, head2, head3], modelScale: 2,
    animate: (m, a) => {
      const q = m.parts;
      const f = cos(a.age * 0.1);
      q.spine.rx = (0.065 + 0.05 * f) * PI;
      q.tail.px = -2; q.tail.py = 6.9 + cos(q.spine.rx) * 10; q.tail.pz = -0.5 + sin(q.spine.rx) * 10;
      q.tail.rx = (0.265 + 0.1 * f) * PI;
      q.head1.ry = a.yaw * PI / 180; q.head1.rx = a.pitch * PI / 180;
    },
  };
}

export function armorStand() {
  const p = J('armorStand', ['head', null, 'body', 'rightArm', 'leftArm', 'rightLeg', 'leftLeg', 'rightSide', 'leftSide', 'waist', 'base']);
  return {
    parts: p, roots: Object.values(p),
    animate: (m, a) => {
      const q = m.parts;
      const r = a.poses || {};
      const D = PI / 180;
      const set = (part, v, d) => { const x = v || d; part.rx = x[0] * D; part.ry = x[1] * D; part.rz = x[2] * D; };
      set(q.head, r.head, [0, 0, 0]); set(q.body, r.body, [0, 0, 0]);
      set(q.leftArm, r.leftArm, [-10, 0, -10]); set(q.rightArm, r.rightArm, [-15, 0, 10]);
      set(q.leftLeg, r.leftLeg, [-1, 0, -1]); set(q.rightLeg, r.rightLeg, [1, 0, 1]);
      q.rightSide.rx = q.leftSide.rx = q.waist.rx = q.body.rx; q.rightSide.ry = q.leftSide.ry = q.waist.ry = q.body.ry; q.rightSide.rz = q.leftSide.rz = q.waist.rz = q.body.rz;
      q.base.rx = 0; q.base.ry = 0; q.base.rz = 0;
      q.leftArm.visible = q.rightArm.visible = !!a.showArms;
      q.base.visible = !a.noBasePlate;
    },
  };
}

// ---------------------------------------------------------------- Update Aquatic

// The outer layer is an independent, 0.25-inflated jar model with identical part names/animation.
// swimAmount is 0..1; throwing or rightPose/leftPose='spear' raises the trident arm.
export function drowned(outer = false) {
  return jarAdapter(outer ? 'drownedOuter' : 'drowned', BIPED, (m, a) => {
    animateBiped(m, a);
    const p = m.parts, sw = Math.max(0, a.swing);
    const f = sin(sw * PI), g = sin((1 - (1 - sw) ** 2) * PI);
    p.rightArm.ry = -(0.1 - f * 0.6); p.leftArm.ry = -p.rightArm.ry;
    p.rightArm.rx = p.leftArm.rx = -PI / (a.armsRaised ? 1.5 : 2.25) - f * 1.2 + g * 0.4;
    p.rightArm.rz = cos(a.age * 0.09) * 0.05 + 0.05; p.leftArm.rz = -p.rightArm.rz;
    p.rightArm.rx += sin(a.age * 0.067) * 0.05; p.leftArm.rx -= sin(a.age * 0.067) * 0.05;
    const rightSpear = a.rightPose === 'spear' || (a.throwing && !a.leftHanded);
    const leftSpear = a.leftPose === 'spear' || (a.throwing && a.leftHanded);
    if (rightSpear) { p.rightArm.rx = p.rightArm.rx * 0.5 - PI; p.rightArm.ry = 0; }
    if (leftSpear) { p.leftArm.rx = p.leftArm.rx * 0.5 - PI; p.leftArm.ry = 0; }
    const swim = clamp(a.swimAmount ?? (a.swimming ? 1 : 0));
    if (swim > 0) {
      const lerpAngle = (from, to) => from + swim * (((to - from + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI);
      const kick = sin(a.age * 0.1);
      p.rightArm.rx = lerpAngle(p.rightArm.rx, -PI * 0.8) + swim * 0.35 * kick;
      p.leftArm.rx = lerpAngle(p.leftArm.rx, -PI * 0.8) - swim * 0.35 * kick;
      p.rightArm.rz = lerpAngle(p.rightArm.rz, -0.15); p.leftArm.rz = lerpAngle(p.leftArm.rz, 0.15);
      p.rightLeg.rx += swim * 0.55 * kick; p.leftLeg.rx -= swim * 0.55 * kick;
      p.head.rx = 0;
    }
    p.headwear.copyAngles(p.head);
  }, { texture: 'entity/zombie/drowned' + (outer ? '_outer_layer' : '') + '.png' });
}

export function cod() {
  return jarAdapter('cod', ['body', 'dorsalFin', 'head', 'nose', 'rightFin', 'leftFin', 'tail'], (m, a) => {
    m.parts.tail.ry = -(a.inWater ? 1 : 1.5) * 0.45 * sin(a.age * 0.6);
  }, { texture: 'entity/fish/cod.png' });
}

export function salmon() {
  return jarAdapter('salmon', ['body', 'backBody', 'head', 'frontDorsalFin', 'backDorsalFin', 'tail', 'rightFin', 'leftFin'], (m, a) => {
    // Tail/dorsal fin are backBody children; animate the joint, not a duplicate root fin.
    m.parts.backBody.ry = -(a.inWater ? 1 : 1.3) * 0.25 * sin((a.inWater ? 1 : 1.7) * a.age * 0.6);
  }, { texture: 'entity/fish/salmon.png' });
}

// size is fixed for this instance: 0/small, 1/medium, 2/big. Rebuild on puff-state change.
export function pufferfish(size = 0) {
  const state = typeof size === 'string' ? ['small', 'medium', 'big'].indexOf(size) : size;
  const index = Number.isInteger(state) && state >= 0 && state <= 2 ? state : 0;
  const names = [
    ['body', 'rightEye', 'leftEye', 'rightFin', 'leftFin', 'tail'],
    ['body', 'rightFin', 'leftFin', 'topFrontSpikes', 'topBackSpikes', 'rightFrontSpikes', 'rightBackSpikes', 'leftBackSpikes', 'leftFrontSpikes', 'bottomBackSpikes', 'bottomFrontSpikes'],
    ['body', 'rightFin', 'leftFin', 'topFrontSpikes', 'topMiddleSpikes', 'topBackSpikes', 'rightFrontSpikes', 'leftFrontSpikes', 'bottomFrontSpikes', 'bottomBackSpikes', 'bottomMiddleSpikes', 'rightBackSpikes', 'leftBackSpikes'],
  ];
  return jarAdapter(['pufferfishSmall', 'pufferfishMedium', 'pufferfishBig'][index], names[index], (m, a) => {
    m.parts.rightFin.rz = -0.2 + 0.4 * sin(a.age * 0.2);
    m.parts.leftFin.rz = 0.2 - 0.4 * sin(a.age * 0.2);
  }, { texture: 'entity/fish/pufferfish.png', puffState: index });
}

// shape: 0/'a' or 1/'b' (the low byte of the packed variant). pattern=true selects the
// actual 0.008-inflated geometry. The renderer binds pattern_1..6 and applies the two dye tints.
export function tropicalFish(shape = 0, pattern = false) {
  const large = shape === 1 || shape === 'b', suffix = large ? 'B' : 'A';
  return jarAdapter('tropicalFish' + (pattern ? 'Pattern' : '') + suffix,
    ['body', 'tail', 'rightFin', 'leftFin', 'topFin', ...(large ? ['bottomFin'] : [])], (m, a) => {
      m.parts.tail.ry = -(a.inWater ? 1 : 1.5) * 0.45 * sin(a.age * 0.6);
    }, { texture: 'entity/fish/tropical_' + suffix.toLowerCase() + (pattern ? '_pattern_1' : '') + '.png', shape: large ? 1 : 0, pattern: !!pattern });
}

export function dolphin() {
  const m = jarAdapter('dolphin', ['head', 'body', 'tail', 'tailFin'], (model, a) => {
    const p = model.parts;
    p.body.rx = a.pitch * D2R; p.body.ry = a.yaw * D2R;
    if (a.moving ?? (finite(a.speedSq) > 0 || a.lsa > 0)) {
      const wave = cos(a.age * 0.3);
      p.body.rx += -0.05 - 0.05 * wave;
      p.tail.rx = -0.1 * wave; p.tailFin.rx = -0.2 * wave;
    }
  }, { texture: 'entity/dolphin.png' });
  [m.parts.dorsalFin, m.parts.leftFin, m.parts.rightFin] = m.parts.body.children;
  m.parts.beak = m.parts.head.children[0];
  return m;
}

// leg1/2 are rear flippers, leg3/4 front flippers. hasEgg controls the extra belly geometry;
// child suppresses it and tells the caller to use the jar's 1/6 baby scale, not the usual 1/2.
export function turtle() {
  return jarAdapter('turtle', [...QUADRUPED, 'eggBelly'], (m, a) => {
    const p = m.parts;
    p.head.rx = a.pitch * D2R; p.head.ry = a.yaw * D2R;
    p.body.rx = p.eggBelly.rx = PI / 2;
    const swim = a.ls * 0.6662 * 0.6;
    p.leg1.rx = cos(swim) * 0.5 * a.lsa; p.leg2.rx = cos(swim + PI) * 0.5 * a.lsa;
    p.leg3.rz = cos(swim + PI) * 0.5 * a.lsa; p.leg4.rz = cos(swim) * 0.5 * a.lsa;
    if (!a.inWater && a.onGround) {
      const speed = a.layingEgg ? 4 : 1, amplitude = a.layingEgg ? 2 : 1;
      p.leg3.ry = cos(speed * a.ls * 5 + PI) * 8 * a.lsa * amplitude;
      p.leg4.ry = cos(speed * a.ls * 5) * 8 * a.lsa * amplitude;
      p.leg3.rz = p.leg4.rz = 0;
      p.leg1.ry = cos(a.ls * 5 + PI) * 3 * a.lsa; p.leg2.ry = cos(a.ls * 5) * 3 * a.lsa;
      p.leg1.rx = p.leg2.rx = 0;
    }
    p.eggBelly.visible = !!a.hasEgg && !a.child;
    m.modelTranslateY = p.eggBelly.visible ? -0.08 : 0;
  }, { texture: 'entity/turtle/big_sea_turtle.png', childScale: 1 / 6 });
}

// Entity-id phase keeps flocks from flapping in lockstep. Renderer applies modelScale, then the
// pre-render translation [0, 1.3125, 0.1875] before the normal living-model origin translation.
export function phantom(size = 0) {
  return jarAdapter('phantom', ['body', 'leftWing', 'leftWingTip', 'rightWing', 'rightWingTip', 'head', 'tail', 'tailTip'], (m, a) => {
    const p = m.parts, phase = (finite(a.entityId) * 3 + a.age) * 0.13;
    p.leftWing.rz = p.leftWingTip.rz = cos(phase) * 16 * D2R;
    p.rightWing.rz = p.rightWingTip.rz = -p.leftWing.rz;
    p.tail.rx = p.tailTip.rx = -(5 + cos(phase * 2) * 5) * D2R;
  }, { texture: 'entity/phantom.png', modelScale: 1 + 0.15 * clamp(size, 0, 64), modelTranslateY: 1.3125, modelTranslateZ: 0.1875 });
}

// ---------------------------------------------------------------- Jar-built projectiles

// Projectile world orientation belongs to the caller: trident uses yaw-90 about Y then pitch+90
// about Z, spit uses yaw-90 about Y then pitch about Z. These have no living-model Y translation.
export function trident() {
  return jarAdapter('trident', ['shaft'], () => {}, { texture: 'entity/trident.png' });
}

export function llamaSpit() {
  return jarAdapter('llamaSpit', ['body'], () => {}, { texture: 'entity/llama/spit.png' });
}

export function shulkerBullet() {
  return jarAdapter('shulkerBullet', ['body'], (m, a) => {
    m.parts.body.ry = a.yaw * D2R; m.parts.body.rx = a.pitch * D2R;
  }, { texture: 'entity/shulker/spark.png', modelScale: 0.5 });
}

// progress: EntityEvokerFangs animation progress 0..1. The caller controls warmup/lifetime
// visibility. At our usual 1/16 pixel unit the jar's scale(2)*unit(1/32) is modelScale=1;
// its -0.626 translation becomes -1.252. Read modelScale again after animate for the final shrink.
export function evokerFangs() {
  return jarAdapter('evokerFangs', ['base', 'upperJaw', 'lowerJaw'], (m, a) => {
    const p = m.parts, t = clamp(a.progress), open = 1 - Math.min(1, t * 2) ** 3;
    p.upperJaw.rz = PI - open * 0.35 * PI; p.lowerJaw.rz = PI + open * 0.35 * PI;
    p.lowerJaw.ry = PI;
    p.base.py = p.upperJaw.py = p.lowerJaw.py = 24 - (t + sin(t * 2.7)) * 0.6 * 12;
    m.modelScale = t > 0.9 ? (1 - t) * 10 : 1;
  }, { texture: 'entity/illager/evoker_fangs.png', modelTranslateY: -1.252 });
}

// ---------------------------------------------------------------- Vehicles

// ModelElytra (1.9): two wings; angles come from elytraAngles()
export function elytra() {
  const { leftWing, rightWing } = J('elytra', ['rightWing', 'leftWing']);
  return {
    parts: { leftWing, rightWing }, roots: [leftWing, rightWing],
    // a.rot: [x, y, z] of the left wing, a.py: rotation point y
    animate(m, a) {
      const [rx, ry, rz] = a.rot;
      leftWing.px = 5; leftWing.py = a.py; leftWing.rx = rx; leftWing.ry = ry; leftWing.rz = rz;
      rightWing.px = -5; rightWing.py = a.py; rightWing.rx = rx; rightWing.ry = -ry; rightWing.rz = -rz;
    },
  };
}

// ModelElytra.setRotationAngles targets: [x, y, z, rotationPointY]
export function elytraAngles(flying, sneaking, motion) {
  let f = 0.2617994, f1 = -0.2617994, f2 = 0, f3 = 0;
  if (flying) {
    let f4 = 1;
    if (motion[1] < 0) {
      const l = Math.hypot(motion[0], motion[1], motion[2]) || 1;
      f4 = 1 - Math.pow(-motion[1] / l, 1.5);
    }
    f = f4 * 0.34906584 + (1 - f4) * f;
    f1 = f4 * -(PI / 2) + (1 - f4) * f1;
  } else if (sneaking) {
    f = PI * 2 / 9; f1 = -(PI / 4); f2 = 3; f3 = 0.08726646;
  }
  return [f, f3, f1, f2];
}

// ModelShulker (1.11): base, lid (rises and turns with the peek amount) and the head inside (LayerShulkerHead)
export function shulker() {
  const { base, lid, head } = J('shulker', ['base', 'lid', 'head']);
  return {
    parts: { base, lid, head }, roots: [base, lid, head],
    // a.peek: EntityShulker.getClientPeekAmount(partial)
    animate(m, a) {
      const f1 = (0.5 + a.peek) * PI;
      const f2 = -1 + sin(f1);
      const f3 = f1 > PI ? sin(a.age * 0.1) * 0.7 : 0;
      lid.py = 16 + sin(f1) * 8 + f3;
      lid.ry = a.peek > 0.3 ? f2 * f2 * f2 * f2 * PI * 0.125 : 0;
      head.rx = a.pitch * PI / 180;
      head.ry = a.yaw * PI / 180;
    },
  };
}

// ModelBoat (1.9): five sides, two paddles and the depth-only "noWater" plate (renderMultipass)
export function boat() {
  const p = J('boat', ['sides', 'paddles', 'noWater']);
  const [p0, p1] = p.paddles;
  const noWater = p.noWater;
  const clampedLerp = (a, b, t) => (t < 0 ? a : t > 1 ? b : a + (b - a) * t);
  return {
    parts: { paddles: [p0, p1] }, roots: [...p.sides, p0, p1], noWater,
    // a.rowing: [EntityBoat.getRowingTime(0), getRowingTime(1)] (ModelBoat.renderPaddle)
    animate(m, a) {
      [p0, p1].forEach((pd, i) => {
        const f = a.rowing[i];
        pd.rx = clampedLerp(-1.0471975803375244, -0.2617993950843811, (Math.sin(-f) + 1) / 2);
        pd.ry = clampedLerp(-PI / 4, PI / 4, (Math.sin(-f + 1) + 1) / 2);
        if (i === 1) pd.ry = PI - pd.ry;
      });
    },
  };
}

export function minecart() {
  const p = J('minecart', ['sides']);
  // RenderMinecart renders with ageInTicks -0.1 and ModelMinecart.render sets sideModels[5].rotationPointY = 4 - that:
  // the floor sits 0.1 above the bottom plate instead of z-fighting with it
  p.sides[5].py = 4.1;
  return { parts: {}, roots: p.sides.filter(Boolean), animate() {} };
}

// Armor model: ModelBiped inflated by 0.5 (leggings) or 1 (the other pieces)
export function armorModel(inflate) {
  return biped(inflate < 0.75 ? 'armorInner' : 'armorOuter');
}

// ModelDragon (256x256 texture). The neck and tail reuse one spine segment many times, so this returns factories;
// RenderDragon posing lives in the entity renderer.
export function dragonParts() {
  const names = ['head', 'spine', 'jaw', 'body', 'rearLeg', 'frontLeg', 'rearLegTip', 'frontLegTip', 'rearFoot', 'frontFoot', 'wing', 'wingTip'];
  const p = J('dragon', names);
  const spine = () => J('dragon', names).spine;
  const limbs = () => {
    const q = J('dragon', names);
    return { wing: q.wing, wingTip: q.wingTip, frontLeg: q.frontLeg, frontLegTip: q.frontLegTip, frontFoot: q.frontFoot, rearLeg: q.rearLeg, rearLegTip: q.rearLegTip, rearFoot: q.rearFoot };
  };
  return { head: p.head, jaw: p.jaw, body: p.body, spine, limbs };
}

// Block entity and small entity models, by jar model name and field names
export function blockModel(name, names) { return J(name, names); }
