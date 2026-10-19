// Entity models. Their boxes come from the Minecraft client jar at build time (lib/modelextract.js runs the
// game's model constructors and records every part: bundles/entity-models.json); this file names the parts and holds
// the animation (ports of setRotationAngles / setLivingAnimations).
import { Part } from './boxmodel.js';

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
    for (const b of q.boxes) p.boxes.push({ u: b[0], v: b[1], x: b[2], y: b[3], z: b[4], dx: b[5], dy: b[6], dz: b[7], inflate: b[8], mirror: b[9] });
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

// ---------------------------------------------------------------- Biped family

// ModelBiped from the jar: 'biped' (64x32), 'armorInner' / 'armorOuter' (inflated 0.5 / 1), or a subclass
export function biped(name = 'biped') {
  const p = J(name, BIPED);
  return { parts: p, roots: BIPED.map((k) => p[k]), animate: animateBiped };
}

export function animateBiped(m, a) {
  const p = m.parts;
  const { ls, lsa, age, yaw, pitch, swing } = a;
  p.head.ry = yaw * PI / 180; p.head.rx = pitch * PI / 180;
  p.rightArm.rx = cos(ls * 0.6662 + PI) * 2 * lsa * 0.5;
  p.leftArm.rx = cos(ls * 0.6662) * 2 * lsa * 0.5;
  p.rightArm.rz = 0; p.leftArm.rz = 0;
  p.rightLeg.rx = cos(ls * 0.6662) * 1.4 * lsa;
  p.leftLeg.rx = cos(ls * 0.6662 + PI) * 1.4 * lsa;
  p.rightLeg.ry = 0; p.leftLeg.ry = 0;
  if (a.riding) {
    p.rightArm.rx += -PI / 5; p.leftArm.rx += -PI / 5;
    p.rightLeg.rx = -PI * 2 / 5; p.leftLeg.rx = -PI * 2 / 5;
    p.rightLeg.ry = PI / 10; p.leftLeg.ry = -PI / 10;
  }
  if (a.heldLeft) p.leftArm.rx = p.leftArm.rx * 0.5 - PI / 10 * a.heldLeft;
  p.rightArm.ry = 0; p.leftArm.ry = 0;
  const hr = a.heldRight || 0;
  if (hr === 1) p.rightArm.rx = p.rightArm.rx * 0.5 - PI / 10 * hr;
  else if (hr === 3) { p.rightArm.rx = p.rightArm.rx * 0.5 - PI / 10 * hr; p.rightArm.ry = -0.5235988; }
  p.body.ry = 0;
  p.rightArm.pz = 0; p.rightArm.px = -5; p.leftArm.pz = 0; p.leftArm.px = 5;
  if (swing > -9990) {
    let f = swing;
    p.body.ry = sin(sqrt(f) * PI * 2) * 0.2;
    p.rightArm.pz = sin(p.body.ry) * 5; p.rightArm.px = -cos(p.body.ry) * 5;
    p.leftArm.pz = -sin(p.body.ry) * 5; p.leftArm.px = cos(p.body.ry) * 5;
    p.rightArm.ry += p.body.ry; p.leftArm.ry += p.body.ry; p.leftArm.rx += p.body.ry;
    f = 1 - swing; f *= f; f *= f; f = 1 - f;
    const f1 = sin(f * PI);
    const f2 = sin(swing * PI) * -(p.head.rx - 0.7) * 0.75;
    p.rightArm.rx = p.rightArm.rx - (f1 * 1.2 + f2);
    p.rightArm.ry += p.body.ry * 2;
    p.rightArm.rz += sin(swing * PI) * -0.4;
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
  if (a.aimedBow) {
    p.rightArm.rz = 0; p.leftArm.rz = 0;
    p.rightArm.ry = -0.1 + p.head.ry; p.leftArm.ry = 0.1 + p.head.ry + 0.4;
    p.rightArm.rx = -PI / 2 + p.head.rx; p.leftArm.rx = -PI / 2 + p.head.rx;
    p.rightArm.rz += cos(age * 0.09) * 0.05 + 0.05; p.leftArm.rz -= cos(age * 0.09) * 0.05 + 0.05;
    p.rightArm.rx += sin(age * 0.067) * 0.05; p.leftArm.rx -= sin(age * 0.067) * 0.05;
  }
  p.headwear.copyAngles(p.head);
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
  const p = J(witch ? 'witch' : 'villager', ['head', 'body', 'arms', 'rightLeg', 'leftLeg', 'nose', ...(witch ? ['mole', 'hat'] : [])]);
  return {
    parts: p, roots: [p.head, p.body, p.arms, p.rightLeg, p.leftLeg],
    animate: (m, a) => {
      const q = m.parts;
      q.head.ry = a.yaw * PI / 180; q.head.rx = a.pitch * PI / 180;
      q.arms.py = 3; q.arms.pz = -1; q.arms.rx = -0.75;
      q.rightLeg.rx = cos(a.ls * 0.6662) * 1.4 * a.lsa * 0.5;
      q.leftLeg.rx = cos(a.ls * 0.6662 + PI) * 1.4 * a.lsa * 0.5;
      q.rightLeg.ry = 0; q.leftLeg.ry = 0;
      if (witch) {
        q.nose.px = 0; q.nose.py = -2; q.nose.pz = 0;
        if (a.witchDrinking) { q.nose.py = -2 + sin(a.age * 0.8) * 1.5; }
      }
    },
  };
}

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
  return {
    parts: p, roots: [p.head, p.body, p.tail, p.tail2, p.backLeft, p.backRight, p.frontLeft, p.frontRight], childY: 10, childZ: 4,
    animate: (m, a) => {
      const q = m.parts;
      q.head.rx = a.pitch * PI / 180; q.head.ry = a.yaw * PI / 180;
      if (!a.sitting) {
        q.body.rx = PI / 2;
        q.backLeft.rx = cos(a.ls * 0.6662) * a.lsa; q.backRight.rx = cos(a.ls * 0.6662 + 0.3) * a.lsa;
        q.frontLeft.rx = cos(a.ls * 0.6662 + PI + 0.3) * a.lsa; q.frontRight.rx = cos(a.ls * 0.6662 + PI) * a.lsa;
        q.tail2.rx = 1.7278761 + PI / 10 * cos(a.ls) * a.lsa;
      } else {
        q.body.rx = PI / 4; q.body.py += 0;
      }
    },
  };
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

export function horse() {
  const p = J('horse', ['head', 'upperJaw', 'lowerJaw', 'leftEar', 'rightEar', 'muleLeftEar', 'muleRightEar', 'neck', 'faceRopes', 'mane', 'body',
    'tailBase', 'tailMiddle', 'tailTip', 'backLeftLeg', 'backLeftShin', 'backLeftHoof', 'backRightLeg', 'backRightShin', 'backRightHoof',
    'frontLeftLeg', 'frontLeftShin', 'frontLeftHoof', 'frontRightLeg', 'frontRightShin', 'frontRightHoof', 'muleLeftChest', 'muleRightChest',
    'saddle', 'saddleFront', 'saddleBack', 'leftSaddleRope', 'leftSaddleMetal', 'rightSaddleRope', 'rightSaddleMetal', 'leftFaceMetal',
    'rightFaceMetal', 'leftRein', 'rightRein']);
  // the jaws are children of the head; ModelHorse.setLivingAnimations keeps them closed at these points
  p.upperJaw.pivot(0, 0.02, 0.02).rot(0, 0, 0);
  p.lowerJaw.pivot(0, 0, 0).rot(0, 0, 0);
  const legs = ['backLeftLeg', 'backLeftShin', 'backLeftHoof', 'backRightLeg', 'backRightShin', 'backRightHoof',
    'frontLeftLeg', 'frontLeftShin', 'frontLeftHoof', 'frontRightLeg', 'frontRightShin', 'frontRightHoof'];
  return {
    parts: p,
    roots: [p.head, p.leftEar, p.rightEar, p.muleLeftEar, p.muleRightEar, p.neck, p.mane, p.body, p.tailBase, p.tailMiddle, p.tailTip, ...legs.map((k) => p[k]), p.saddle],
    animate: (m, a) => {
      const q = m.parts;
      const mule = a.horseType === 1 || a.horseType === 2;
      q.leftEar.visible = q.rightEar.visible = !mule;
      q.muleLeftEar.visible = q.muleRightEar.visible = mule;
      q.mane.visible = !mule;
      q.saddle.visible = !!a.saddled;
      const headX = 0.5235988 + a.pitch * PI / 180;
      const headY = a.yaw * PI / 180;
      for (const k of ['head', 'leftEar', 'rightEar', 'muleLeftEar', 'muleRightEar', 'neck', 'mane']) { q[k].rx = headX; q[k].ry = headY; }
      q.muleLeftEar.rz = 0.2617994; q.muleRightEar.rz = -0.2617994;
      const f = cos(a.ls * 0.6662 + PI) * 0.8 * a.lsa;
      const g = cos(a.ls * 0.6662) * 0.8 * a.lsa;
      q.backLeftLeg.rx = g; q.backLeftShin.rx = g; q.backLeftHoof.rx = g;
      q.backRightLeg.rx = f; q.backRightShin.rx = f; q.backRightHoof.rx = f;
      q.frontLeftLeg.rx = f; q.frontLeftShin.rx = f; q.frontLeftHoof.rx = f;
      q.frontRightLeg.rx = g; q.frontRightShin.rx = g; q.frontRightHoof.rx = g;
      // keep shins attached below the upper legs
      for (const [up, shin, hoof] of [['backLeftLeg', 'backLeftShin', 'backLeftHoof'], ['backRightLeg', 'backRightShin', 'backRightHoof'], ['frontLeftLeg', 'frontLeftShin', 'frontLeftHoof'], ['frontRightLeg', 'frontRightShin', 'frontRightHoof']]) {
        const L = q[up]; const len = up.startsWith('back') ? 7 : 7;
        q[shin].py = L.py + cos(L.rx) * len; q[shin].pz = L.pz + sin(L.rx) * len;
        q[hoof].py = q[shin].py; q[hoof].pz = q[shin].pz;
      }
      const tailSwing = cos(a.ls * 0.6662) * 0.3 * a.lsa;
      q.tailBase.ry = q.tailMiddle.ry = q.tailTip.ry = tailSwing;
    },
  };
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

// ---------------------------------------------------------------- Vehicles

// ModelBoat (1.8): five sides
export function boat() {
  const p = J('boat', ['sides']);
  return { parts: {}, roots: p.sides.filter(Boolean), animate() {} };
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
