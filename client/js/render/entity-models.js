// Vanilla 1.8.9 entity models (ports of ModelBase subclasses) built from texture-offset boxes.
import { Part } from './boxmodel.js';

const PI = Math.PI;
const cos = Math.cos, sin = Math.sin, abs = Math.abs, sqrt = Math.sqrt;

// ---------------------------------------------------------------- Biped family

export function biped(tw = 64, th = 32, inflate = 0, yOff = 0) {
  const p = {};
  p.head = new Part(tw, th).tex(0, 0).box(-4, -8, -4, 8, 8, 8, inflate).pivot(0, yOff, 0);
  p.headwear = new Part(tw, th).tex(32, 0).box(-4, -8, -4, 8, 8, 8, inflate + 0.5).pivot(0, yOff, 0);
  p.body = new Part(tw, th).tex(16, 16).box(-4, 0, -2, 8, 12, 4, inflate).pivot(0, yOff, 0);
  p.rightArm = new Part(tw, th).tex(40, 16).box(-3, -2, -2, 4, 12, 4, inflate).pivot(-5, 2 + yOff, 0);
  p.leftArm = new Part(tw, th).tex(40, 16); p.leftArm.mirror = true; p.leftArm.box(-1, -2, -2, 4, 12, 4, inflate).pivot(5, 2 + yOff, 0);
  p.rightLeg = new Part(tw, th).tex(0, 16).box(-2, 0, -2, 4, 12, 4, inflate).pivot(-1.9, 12 + yOff, 0);
  p.leftLeg = new Part(tw, th).tex(0, 16); p.leftLeg.mirror = true; p.leftLeg.box(-2, 0, -2, 4, 12, 4, inflate).pivot(1.9, 12 + yOff, 0);
  return { parts: p, roots: [p.head, p.headwear, p.body, p.rightArm, p.leftArm, p.rightLeg, p.leftLeg], animate: animateBiped };
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
  const m = biped(tw, th, 0, 0);
  const p = m.parts;
  // ModelPlayer: 64x64 skins have separate left limbs + overlay layers
  if (th === 64) {
    if (slim) {
      p.rightArm = new Part(tw, th).tex(40, 16).box(-2, -2, -2, 3, 12, 4).pivot(-5, 2.5, 0);
      p.leftArm = new Part(tw, th).tex(32, 48).box(-1, -2, -2, 3, 12, 4).pivot(5, 2.5, 0);
      p.rightArmwear = new Part(tw, th).tex(40, 32).box(-2, -2, -2, 3, 12, 4, 0.25).pivot(-5, 2.5, 10);
      p.leftArmwear = new Part(tw, th).tex(48, 48).box(-1, -2, -2, 3, 12, 4, 0.25).pivot(5, 2.5, 10);
    } else {
      p.leftArm = new Part(tw, th).tex(32, 48).box(-1, -2, -2, 4, 12, 4).pivot(5, 2, 0);
      p.leftArmwear = new Part(tw, th).tex(48, 48).box(-1, -2, -2, 4, 12, 4, 0.25).pivot(5, 2, 0);
      p.rightArmwear = new Part(tw, th).tex(40, 32).box(-3, -2, -2, 4, 12, 4, 0.25).pivot(-5, 2, 10);
    }
    p.leftLeg = new Part(tw, th).tex(16, 48).box(-2, 0, -2, 4, 12, 4).pivot(1.9, 12, 0);
    p.leftLegwear = new Part(tw, th).tex(0, 48).box(-2, 0, -2, 4, 12, 4, 0.25).pivot(1.9, 12, 0);
    p.rightLegwear = new Part(tw, th).tex(0, 32).box(-2, 0, -2, 4, 12, 4, 0.25).pivot(-1.9, 12, 0);
    p.bodywear = new Part(tw, th).tex(16, 32).box(-4, 0, -2, 8, 12, 4, 0.25);
    m.roots = [p.head, p.headwear, p.body, p.rightArm, p.leftArm, p.rightLeg, p.leftLeg, p.leftLegwear, p.rightLegwear, p.leftArmwear, p.rightArmwear, p.bodywear];
  }
  m.slim = slim;
  m.animate = (mm, a) => {
    animateBiped(mm, a);
    const q = mm.parts;
    if (q.leftLegwear) {
      q.leftLegwear.copyAngles(q.leftLeg); q.rightLegwear.copyAngles(q.rightLeg);
      q.leftArmwear.copyAngles(q.leftArm); q.rightArmwear.copyAngles(q.rightArm);
      q.bodywear.copyAngles(q.body);
    }
    if (slim) { q.rightArm.py = 2.5 + (a.sneak ? 0 : 0); q.leftArm.py = 2.5; if (q.rightArmwear) { q.rightArmwear.py = 2.5; q.leftArmwear.py = 2.5; } }
  };
  return m;
}

export function zombie(tw = 64, th = 64, villager = false) {
  let m;
  if (villager) {
    m = biped(tw, th);
    const p = m.parts;
    p.head = new Part(tw, th).tex(0, 32).box(-4, -10, -4, 8, 10, 8);
    p.head.add(new Part(tw, th).tex(24, 32).box(-1, -3, -6, 2, 4, 2));
    m.roots[0] = p.head;
    p.headwear.visible = false;
  } else m = biped(tw, th);
  m.animate = (mm, a) => {
    animateBiped(mm, a);
    const p = mm.parts;
    const f = sin(a.swing * PI);
    const f1 = sin((1 - (1 - a.swing) * (1 - a.swing)) * PI);
    p.rightArm.rz = 0; p.leftArm.rz = 0;
    p.rightArm.ry = -(0.1 - f * 0.6); p.leftArm.ry = 0.1 - f * 0.6;
    p.rightArm.rx = -PI / 2; p.leftArm.rx = -PI / 2;
    p.rightArm.rx -= f * 1.2 - f1 * 0.4; p.leftArm.rx -= f * 1.2 - f1 * 0.4;
    p.rightArm.rz += cos(a.age * 0.09) * 0.05 + 0.05; p.leftArm.rz -= cos(a.age * 0.09) * 0.05 + 0.05;
    p.rightArm.rx += sin(a.age * 0.067) * 0.05; p.leftArm.rx -= sin(a.age * 0.067) * 0.05;
  };
  return m;
}

export function skeleton(tw = 64, th = 32) {
  const m = biped(tw, th);
  const p = m.parts;
  p.rightArm = new Part(tw, th).tex(40, 16).box(-1, -2, -1, 2, 12, 2).pivot(-5, 2, 0);
  p.leftArm = new Part(tw, th).tex(40, 16); p.leftArm.mirror = true; p.leftArm.box(-1, -2, -1, 2, 12, 2).pivot(5, 2, 0);
  p.rightLeg = new Part(tw, th).tex(0, 16).box(-1, 0, -1, 2, 12, 2).pivot(-2, 12, 0);
  p.leftLeg = new Part(tw, th).tex(0, 16); p.leftLeg.mirror = true; p.leftLeg.box(-1, 0, -1, 2, 12, 2).pivot(2, 12, 0);
  m.roots = [p.head, p.headwear, p.body, p.rightArm, p.leftArm, p.rightLeg, p.leftLeg];
  return m;
}

export function enderman(tw = 64, th = 32) {
  const m = biped(tw, th, 0, -14);
  const p = m.parts;
  m.yOff = -14;
  p.headwear = new Part(tw, th).tex(0, 16).box(-4, -8, -4, 8, 8, 8, -0.5).pivot(0, -14, 0);
  p.body = new Part(tw, th).tex(32, 16).box(-4, 0, -2, 8, 12, 4).pivot(0, -14, 0);
  p.rightArm = new Part(tw, th).tex(56, 0).box(-1, -2, -1, 2, 30, 2).pivot(-3, -12, 0);
  p.leftArm = new Part(tw, th).tex(56, 0); p.leftArm.mirror = true; p.leftArm.box(-1, -2, -1, 2, 30, 2).pivot(5, -12, 0);
  p.rightLeg = new Part(tw, th).tex(56, 0).box(-1, 0, -1, 2, 30, 2).pivot(-2, -2, 0);
  p.leftLeg = new Part(tw, th).tex(56, 0); p.leftLeg.mirror = true; p.leftLeg.box(-1, 0, -1, 2, 30, 2).pivot(2, -2, 0);
  m.roots = [p.head, p.headwear, p.body, p.rightArm, p.leftArm, p.rightLeg, p.leftLeg];
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
  const p = {};
  p.head = new Part(tw, th).tex(0, 0).box(-4, -10, -4, 8, 10, 8);
  p.nose = new Part(tw, th).tex(24, 0).box(-1, -1, -6, 2, 4, 2).pivot(0, -2, 0);
  p.head.add(p.nose);
  p.body = new Part(tw, th).tex(16, 20).box(-4, 0, -3, 8, 12, 6);
  p.body.tex(0, 38).box(-4, 0, -3, 8, 18, 6, 0.5);
  p.arms = new Part(tw, th).tex(44, 22).box(-8, -2, -2, 4, 8, 4).tex(44, 22).box(4, -2, -2, 4, 8, 4).tex(40, 38).box(-4, 2, -2, 8, 4, 4).pivot(0, 3, -1).rot(-0.75, 0, 0);
  p.rightLeg = new Part(tw, th).tex(0, 22).box(-2, 0, -2, 4, 12, 4).pivot(-2, 12, 0);
  p.leftLeg = new Part(tw, th).tex(0, 22); p.leftLeg.mirror = true; p.leftLeg.box(-2, 0, -2, 4, 12, 4).pivot(2, 12, 0);
  if (witch) {
    p.mole = new Part(tw, th).tex(0, 0).box(0, 3, -6.75, 1, 1, 1, -0.25);
    p.nose.add(p.mole);
    const hat = new Part(tw, th).tex(0, 64).box(0, 0, 0, 10, 2, 10).pivot(-5, -10.03125, -5);
    const h1 = new Part(tw, th).tex(0, 76).box(0, 0, 0, 7, 4, 7).pivot(1.75, -4, 2).rot(-0.05235988, 0, 0.02617994);
    const h2 = new Part(tw, th).tex(0, 87).box(0, 0, 0, 4, 4, 4).pivot(1.75, -4, 2).rot(-0.10471976, 0, 0.05235988);
    const h3 = new Part(tw, th).tex(0, 95).box(0, 0, 0, 1, 2, 1, 0.25).pivot(1.75, -2, 2).rot(-0.20943952, 0, 0.10471976);
    h2.add(h3); h1.add(h2); hat.add(h1);
    p.head.add(hat);
  }
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

function quadruped(h, inflate = 0, tw = 64, th = 32) {
  const p = {};
  p.head = new Part(tw, th).tex(0, 0).box(-4, -4, -8, 8, 8, 8, inflate).pivot(0, 18 - h, -6);
  p.body = new Part(tw, th).tex(28, 8).box(-5, -10, -7, 10, 16, 8, inflate).pivot(0, 17 - h, 2);
  p.leg1 = new Part(tw, th).tex(0, 16).box(-2, 0, -2, 4, h, 4, inflate).pivot(-3, 24 - h, 7);
  p.leg2 = new Part(tw, th).tex(0, 16).box(-2, 0, -2, 4, h, 4, inflate).pivot(3, 24 - h, 7);
  p.leg3 = new Part(tw, th).tex(0, 16).box(-2, 0, -2, 4, h, 4, inflate).pivot(-3, 24 - h, -5);
  p.leg4 = new Part(tw, th).tex(0, 16).box(-2, 0, -2, 4, h, 4, inflate).pivot(3, 24 - h, -5);
  return {
    parts: p, roots: [p.head, p.body, p.leg1, p.leg2, p.leg3, p.leg4], childY: 8, childZ: 4, quadruped: true,
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

export function pig() {
  const m = quadruped(6);
  m.parts.head.tex(16, 16).box(-2, 0, -9, 4, 3, 1);
  m.childY = 4;
  return m;
}

export function cow() {
  const m = quadruped(12);
  const p = m.parts;
  p.head = new Part(64, 32).tex(0, 0).box(-4, -4, -6, 8, 8, 6).pivot(0, 4, -8);
  p.head.tex(22, 0).box(-5, -5, -4, 1, 3, 1).tex(22, 0).box(4, -5, -4, 1, 3, 1);
  p.body = new Part(64, 32).tex(18, 4).box(-6, -10, -7, 12, 18, 10).pivot(0, 5, 2);
  p.body.tex(52, 0).box(-2, 2, -8, 4, 6, 1);
  p.leg1.px -= 1; p.leg2.px += 1; p.leg3.px -= 1; p.leg4.px += 1; p.leg3.pz -= 1; p.leg4.pz -= 1;
  m.roots = [p.head, p.body, p.leg1, p.leg2, p.leg3, p.leg4];
  m.childZ = 6;
  return m;
}

export function sheep(wool) {
  const m = quadruped(12);
  const p = m.parts;
  if (!wool) {
    p.head = new Part(64, 32).tex(0, 0).box(-3, -4, -6, 6, 6, 8).pivot(0, 6, -8);
    p.body = new Part(64, 32).tex(28, 8).box(-4, -10, -7, 8, 16, 6).pivot(0, 5, 2);
  } else {
    p.head = new Part(64, 32).tex(0, 0).box(-3, -4, -4, 6, 6, 6, 0.6).pivot(0, 6, -8);
    p.body = new Part(64, 32).tex(28, 8).box(-4, -10, -7, 8, 16, 6, 1.75).pivot(0, 5, 2);
    for (const [k, x, z] of [['leg1', -3, 7], ['leg2', 3, 7], ['leg3', -3, -5], ['leg4', 3, -5]]) {
      p[k] = new Part(64, 32).tex(0, 16).box(-2, 0, -2, 4, 6, 4, 0.5).pivot(x, 12, z);
    }
  }
  m.roots = [p.head, p.body, p.leg1, p.leg2, p.leg3, p.leg4];
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
  const p = {};
  const T = (u, v) => new Part(64, 32).tex(u, v);
  p.head = T(0, 0).box(-2, -6, -2, 4, 6, 3).pivot(0, 15, -4);
  p.bill = T(14, 0).box(-2, -4, -4, 4, 2, 2).pivot(0, 15, -4);
  p.chin = T(14, 4).box(-1, -2, -3, 2, 2, 2).pivot(0, 15, -4);
  p.body = T(0, 9).box(-3, -4, -3, 6, 8, 6).pivot(0, 16, 0);
  p.rightLeg = T(26, 0).box(-1, 0, -3, 3, 5, 3).pivot(-2, 19, 1);
  p.leftLeg = T(26, 0).box(-1, 0, -3, 3, 5, 3).pivot(1, 19, 1);
  p.rightWing = T(24, 13).box(0, 0, -3, 1, 4, 6).pivot(-4, 13, 0);
  p.leftWing = T(24, 13).box(-1, 0, -3, 1, 4, 6).pivot(4, 13, 0);
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
  const p = {};
  const T = (u, v) => new Part(64, 32).tex(u, v);
  p.head = T(0, 0).box(-3, -3, -2, 6, 6, 4).pivot(-1, 13.5, -7);
  p.head.tex(16, 14).box(-3, -5, 0, 2, 2, 1).tex(16, 14).box(1, -5, 0, 2, 2, 1).tex(0, 10).box(-1.5, 0, -5, 3, 3, 4);
  p.body = T(18, 14).box(-4, -2, -3, 6, 9, 6).pivot(0, 14, 2);
  p.mane = T(21, 0).box(-4, -3, -3, 8, 6, 7).pivot(-1, 14, 2);
  p.leg1 = T(0, 18).box(-1, 0, -1, 2, 8, 2).pivot(-2.5, 16, 7);
  p.leg2 = T(0, 18).box(-1, 0, -1, 2, 8, 2).pivot(0.5, 16, 7);
  p.leg3 = T(0, 18).box(-1, 0, -1, 2, 8, 2).pivot(-2.5, 16, -4);
  p.leg4 = T(0, 18).box(-1, 0, -1, 2, 8, 2).pivot(0.5, 16, -4);
  p.tail = T(9, 18).box(-1, 0, -1, 2, 8, 2).pivot(-1, 12, 8);
  return {
    parts: p, roots: [p.head, p.body, p.mane, p.leg1, p.leg2, p.leg3, p.leg4, p.tail], childY: 5, childZ: 2, quadruped: true,
    animate: (m, a) => {
      const q = m.parts;
      if (a.sitting) {
        q.mane.py = 16; q.mane.px = -1; q.mane.rx = PI * 2 / 5; q.mane.ry = 0;
        q.body.py = 18; q.body.pz = 0; q.body.rx = PI / 4;
        q.tail.py = 21; q.tail.pz = 6;
        q.leg1.py = 22.7; q.leg1.pz = 2; q.leg1.rx = PI * 3 / 2;
        q.leg2.py = 22.7; q.leg2.pz = 2; q.leg2.rx = PI * 3 / 2;
        q.leg3.rx = 5.811947; q.leg3.px = -2.49; q.leg3.py = 17; q.leg3.pz = -4;
        q.leg4.rx = 5.811947; q.leg4.px = 0.51; q.leg4.py = 17; q.leg4.pz = -4;
      } else {
        q.body.py = 14; q.body.pz = 2; q.body.rx = PI / 2;
        q.mane.py = 14; q.mane.pz = 2; q.mane.px = -1; q.mane.rx = PI / 2;
        q.tail.py = 12; q.tail.pz = 8;
        q.leg1.py = 16; q.leg1.pz = 7; q.leg2.py = 16; q.leg2.pz = 7; q.leg3.py = 16; q.leg3.pz = -4; q.leg4.py = 16; q.leg4.pz = -4;
        q.leg3.px = -2.5; q.leg4.px = 0.5;
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
  const p = {};
  const T = (u, v) => new Part(64, 32).tex(u, v);
  p.head = T(0, 0).box(-2.5, -2, -3, 5, 4, 5).pivot(0, 15, -9);
  p.head.tex(0, 24).box(-1.5, 0, -4, 3, 2, 2).tex(0, 10).box(-2, -3, 0, 1, 1, 2).tex(6, 10).box(1, -3, 0, 1, 1, 2);
  p.body = T(20, 0).box(-2, 3, -8, 4, 16, 6).pivot(0, 12, -10).rot(PI / 2, 0, 0);
  p.tail = T(0, 15).box(-0.5, 0, 0, 1, 8, 1).pivot(0, 15, 8).rot(0.9, 0, 0);
  p.tail2 = T(4, 15).box(-0.5, 0, 0, 1, 8, 1).pivot(0, 20, 14);
  p.backLeft = T(8, 13).box(-1, 0, 1, 2, 6, 2).pivot(1.1, 18, 5);
  p.backRight = T(8, 13).box(-1, 0, 1, 2, 6, 2).pivot(-1.1, 18, 5);
  p.frontLeft = T(40, 0).box(-1, 0, 0, 2, 10, 2).pivot(1.2, 13.8, -5);
  p.frontRight = T(40, 0).box(-1, 0, 0, 2, 10, 2).pivot(-1.2, 13.8, -5);
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
  const p = {};
  const T = (u, v) => new Part(64, 32).tex(u, v);
  p.leftFoot = T(26, 24); p.leftFoot.mirror = true; p.leftFoot.box(-1, 5.5, -3.7, 2, 1, 7).pivot(3, 17.5, 3.7);
  p.rightFoot = T(8, 24); p.rightFoot.mirror = true; p.rightFoot.box(-1, 5.5, -3.7, 2, 1, 7).pivot(-3, 17.5, 3.7);
  p.leftThigh = T(30, 15); p.leftThigh.mirror = true; p.leftThigh.box(-1, 0, 0, 2, 4, 5).pivot(3, 17.5, 3.7).rot(-0.34906584, 0, 0);
  p.rightThigh = T(16, 15); p.rightThigh.mirror = true; p.rightThigh.box(-1, 0, 0, 2, 4, 5).pivot(-3, 17.5, 3.7).rot(-0.34906584, 0, 0);
  p.body = T(0, 0); p.body.mirror = true; p.body.box(-3, -2, -10, 6, 5, 10).pivot(0, 19, 8).rot(-0.34906584, 0, 0);
  p.leftArm = T(8, 15); p.leftArm.mirror = true; p.leftArm.box(-1, 0, -1, 2, 7, 2).pivot(3, 17, -1).rot(-0.17453292, 0, 0);
  p.rightArm = T(0, 15); p.rightArm.mirror = true; p.rightArm.box(-1, 0, -1, 2, 7, 2).pivot(-3, 17, -1).rot(-0.17453292, 0, 0);
  p.head = T(32, 0); p.head.mirror = true; p.head.box(-2.5, -4, -5, 5, 4, 5).pivot(0, 16, -1);
  p.rightEar = T(52, 0); p.rightEar.mirror = true; p.rightEar.box(-2.5, -9, -1, 2, 5, 1).pivot(0, 16, -1).rot(0, -0.2617994, 0);
  p.leftEar = T(58, 0); p.leftEar.mirror = true; p.leftEar.box(0.5, -9, -1, 2, 5, 1).pivot(0, 16, -1).rot(0, 0.2617994, 0);
  p.tail = T(52, 6); p.tail.mirror = true; p.tail.box(-1.5, -1.5, 0, 3, 3, 2).pivot(0, 20, 7).rot(-0.3490659, 0, 0);
  p.nose = T(32, 9); p.nose.mirror = true; p.nose.box(-0.5, -2.5, -5.5, 1, 1, 1).pivot(0, 16, -1);
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
  const p = {};
  const T = (u, v) => new Part(128, 128).tex(u, v);
  p.head = T(0, 0).box(-2.5, -10, -1.5, 5, 5, 7).pivot(0, 4, -10).rot(0.5235988, 0, 0);
  p.upperJaw = T(24, 18).box(-2, -10, -7, 4, 3, 6).pivot(0, 3.95, -10).rot(0.5235988, 0, 0);
  p.lowerJaw = T(24, 27).box(-2, -7, -6.5, 4, 2, 5).pivot(0, 4, -10).rot(0.5235988, 0, 0);
  p.head.add(p.upperJaw); p.head.add(p.lowerJaw);
  p.upperJaw.pivot(0, 0.02, 0.02).rot(0, 0, 0);
  p.lowerJaw.pivot(0, 0, 0).rot(0, 0, 0);
  p.leftEar = T(0, 0).box(0.45, -12, 4, 2, 3, 1).pivot(0, 4, -10).rot(0.5235988, 0, 0);
  p.rightEar = T(0, 0).box(-2.45, -12, 4, 2, 3, 1).pivot(0, 4, -10).rot(0.5235988, 0, 0);
  p.muleLeftEar = T(0, 12).box(-2, -16, 0.5, 2, 7, 1).pivot(0, 4, -10).rot(0.5235988, 0, 0.2617994);
  p.muleRightEar = T(0, 12).box(0, -16, 0.5, 2, 7, 1).pivot(0, 4, -10).rot(0.5235988, 0, -0.2617994);
  p.neck = T(0, 12).box(-2.05, -9.8, -2, 4, 14, 8).pivot(0, 4, -10).rot(0.5235988, 0, 0);
  p.mane = T(58, 0).box(-1, -11.5, 5, 2, 16, 4).pivot(0, 4, -10).rot(0.5235988, 0, 0);
  p.body = T(0, 34).box(-5, -8, -19, 10, 10, 24).pivot(0, 11, 9);
  p.tailBase = T(44, 0).box(-1, -1, 0, 2, 2, 3).pivot(0, 3, 14).rot(-1.134464, 0, 0);
  p.tailMiddle = T(38, 7).box(-1.5, -2, 3, 3, 4, 7).pivot(0, 3, 14).rot(-1.134464, 0, 0);
  p.tailTip = T(24, 3).box(-1.5, -4.5, 9, 3, 4, 7).pivot(0, 3, 14).rot(-1.40215, 0, 0);
  const leg = (u, v, bx, rx, rz) => T(u, v).box(...bx).pivot(rx, 9, rz);
  p.backLeftLeg = leg(78, 29, [-2.5, -2, -2.5, 4, 9, 5], 4, 11);
  p.backLeftShin = T(78, 43).box(-2, 0, -1.5, 3, 5, 3).pivot(4, 16, 11);
  p.backLeftHoof = T(78, 51).box(-2.5, 5.1, -2, 4, 3, 4).pivot(4, 16, 11);
  p.backRightLeg = leg(96, 29, [-1.5, -2, -2.5, 4, 9, 5], -4, 11);
  p.backRightShin = T(96, 43).box(-1, 0, -1.5, 3, 5, 3).pivot(-4, 16, 11);
  p.backRightHoof = T(96, 51).box(-1.5, 5.1, -2, 4, 3, 4).pivot(-4, 16, 11);
  p.frontLeftLeg = T(44, 29).box(-1.9, -1, -2.1, 3, 8, 4).pivot(4, 9, -8);
  p.frontLeftShin = T(44, 41).box(-1.9, 0, -1.6, 3, 5, 3).pivot(4, 16, -8);
  p.frontLeftHoof = T(44, 51).box(-2.4, 5.1, -2.1, 4, 3, 4).pivot(4, 16, -8);
  p.frontRightLeg = T(60, 29).box(-1.1, -1, -2.1, 3, 8, 4).pivot(-4, 9, -8);
  p.frontRightShin = T(60, 41).box(-1.1, 0, -1.6, 3, 5, 3).pivot(-4, 16, -8);
  p.frontRightHoof = T(60, 51).box(-1.6, 5.1, -2.1, 4, 3, 4).pivot(-4, 16, -8);
  p.saddle = T(80, 0).box(-5, 0, -3, 10, 1, 8).pivot(0, 2, 2);
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
  const p = {};
  const T = (u, v) => new Part(64, 32).tex(u, v);
  p.head = T(0, 0).box(-4, -8, -4, 8, 8, 8).pivot(0, 6, 0);
  p.body = T(16, 16).box(-4, 0, -2, 8, 12, 4).pivot(0, 6, 0);
  p.leg1 = T(0, 16).box(-2, 0, -2, 4, 6, 4).pivot(-2, 18, 4);
  p.leg2 = T(0, 16).box(-2, 0, -2, 4, 6, 4).pivot(2, 18, 4);
  p.leg3 = T(0, 16).box(-2, 0, -2, 4, 6, 4).pivot(-2, 18, -4);
  p.leg4 = T(0, 16).box(-2, 0, -2, 4, 6, 4).pivot(2, 18, -4);
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
  const p = {};
  const T = (u, v) => new Part(64, 32).tex(u, v);
  p.head = T(32, 4).box(-4, -4, -8, 8, 8, 8).pivot(0, 15, -3);
  p.neck = T(0, 0).box(-3, -3, -3, 6, 6, 6).pivot(0, 15, 0);
  p.body = T(0, 12).box(-5, -4, -6, 10, 8, 12).pivot(0, 15, 9);
  const L = (x0, px, pz) => T(18, 0).box(x0, -1, -1, 16, 2, 2).pivot(px, 15, pz);
  p.leg1 = L(-15, -4, 2); p.leg2 = L(-1, 4, 2); p.leg3 = L(-15, -4, 1); p.leg4 = L(-1, 4, 1);
  p.leg5 = L(-15, -4, 0); p.leg6 = L(-1, 4, 0); p.leg7 = L(-15, -4, -1); p.leg8 = L(-1, 4, -1);
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
  const p = {};
  const T = (u, v) => new Part(64, 32).tex(u, v);
  if (outer) {
    p.cube = T(0, 0).box(-4, 16, -4, 8, 8, 8);
    return { parts: p, roots: [p.cube], animate() {} };
  }
  p.cube = T(0, 16).box(-3, 17, -3, 6, 6, 6);
  p.rightEye = T(32, 0).box(-3.25, 18, -3.5, 2, 2, 2);
  p.leftEye = T(32, 4).box(1.25, 18, -3.5, 2, 2, 2);
  p.mouth = T(32, 8).box(0, 21, -3.5, 1, 1, 1);
  return { parts: p, roots: [p.cube, p.rightEye, p.leftEye, p.mouth], animate() {} };
}

export function magmaCube() {
  const p = {};
  const segs = [];
  for (let i = 0; i < 8; i++) {
    let u = 0, v = i;
    if (i === 2) { u = 24; v = 10; } else if (i === 3) { u = 24; v = 19; }
    segs.push(new Part(64, 32).tex(u, v).box(-4, 16 + i, -4, 8, 1, 8));
  }
  p.core = new Part(64, 32).tex(0, 16).box(-2, 18, -2, 4, 4, 4);
  return {
    parts: { ...p, segs }, roots: [p.core, ...segs],
    animate: (m, a) => {
      const f = a.squish || 0;
      for (let i = 0; i < 8; i++) m.parts.segs[i].py = -(4 - i) * f * 1.7;
    },
  };
}

export function silverfish() {
  const sizes = [[3, 2, 2], [4, 3, 2], [6, 4, 3], [3, 3, 3], [2, 2, 3], [2, 1, 2], [1, 1, 2]];
  const texs = [[0, 0], [0, 4], [0, 9], [0, 16], [0, 22], [11, 0], [13, 4]];
  const parts = [];
  const zs = [];
  let f = -3.5;
  for (let i = 0; i < 7; i++) {
    const s = sizes[i];
    parts.push(new Part(64, 32).tex(texs[i][0], texs[i][1]).box(s[0] * -0.5, 0, s[2] * -0.5, s[0], s[1], s[2]).pivot(0, 24 - s[1], f));
    zs.push(f);
    if (i < 6) f += (s[2] + sizes[i + 1][2]) * 0.5;
  }
  const wings = [
    new Part(64, 32).tex(20, 0).box(-5, 0, sizes[2][2] * -0.5, 10, 8, sizes[2][2]).pivot(0, 16, zs[2]),
    new Part(64, 32).tex(20, 11).box(-3, 0, sizes[4][2] * -0.5, 6, 4, sizes[4][2]).pivot(0, 20, zs[4]),
    new Part(64, 32).tex(20, 18).box(-3, 0, sizes[4][2] * -0.5, 6, 5, sizes[1][2]).pivot(0, 19, zs[1]),
  ];
  return {
    parts: { parts, wings }, roots: [...parts, ...wings],
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
  const sizes = [[4, 3, 2], [6, 4, 5], [3, 3, 1], [1, 2, 1]];
  const texs = [[0, 0], [0, 5], [0, 14], [0, 18]];
  const parts = [];
  let f = -3.5;
  for (let i = 0; i < 4; i++) {
    const s = sizes[i];
    parts.push(new Part(64, 32).tex(texs[i][0], texs[i][1]).box(s[0] * -0.5, 0, s[2] * -0.5, s[0], s[1], s[2]).pivot(0, 24 - s[1], f));
    if (i < 3) f += (s[2] + sizes[i + 1][2]) * 0.5;
  }
  return {
    parts: { parts }, roots: parts,
    animate: (m, a) => {
      for (let i = 0; i < 4; i++) {
        m.parts.parts[i].ry = cos(a.age * 0.9 + i * 0.15 * PI) * PI * 0.01 * (1 + abs(i - 2));
        m.parts.parts[i].px = sin(a.age * 0.9 + i * 0.15 * PI) * PI * 0.1 * abs(i - 2);
      }
    },
  };
}

export function blaze() {
  const p = {};
  p.head = new Part(64, 32).tex(0, 0).box(-4, -4, -4, 8, 8, 8);
  p.rods = [];
  for (let i = 0; i < 12; i++) p.rods.push(new Part(64, 32).tex(0, 16).box(0, 0, 0, 2, 8, 2));
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
  const p = {};
  p.body = new Part(64, 32).tex(0, 0).box(-8, -8, -8, 16, 16, 16).pivot(0, 8 + 0, 0);
  p.body.py = 8;
  // Tentacles with lengths from Random(1660)
  let seed = (1660n ^ 0x5DEECE66Dn) & ((1n << 48n) - 1n);
  const nextInt = (n) => {
    seed = (seed * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n);
    const r = Number(seed >> 17n);
    return r % n;
  };
  p.tentacles = [];
  for (let i = 0; i < 9; i++) {
    const len = nextInt(7) + 8;
    const t = new Part(64, 32).tex(0, 0).box(-1, 0, -1, 2, len, 2);
    t.px = ((i % 3) - (Math.floor(i / 3) % 2) * 0.5 + 0.25) / 2 * 2 * 5;
    t.pz = (Math.floor(i / 3) / 2 * 2 - 1) * 5;
    t.py = 24 - 7 + 8 - 1;
    p.tentacles.push(t);
  }
  return {
    parts: p, roots: [p.body, ...p.tentacles], modelScale: 4.5, ghast: true,
    animate: (m, a) => { for (let i = 0; i < 9; i++) m.parts.tentacles[i].rx = 0.2 * sin(a.age * 0.3 + i) + 0.4; },
  };
}

export function guardian() {
  const p = {};
  const T = (u, v) => new Part(64, 64).tex(u, v);
  p.body = T(0, 0).box(-6, 10, -8, 12, 12, 16).tex(0, 28).box(-8, 10, -6, 2, 12, 12).tex(0, 28).box(6, 10, -6, 2, 12, 12, 0, true)
    .tex(16, 40).box(-6, 8, -6, 12, 2, 12).tex(16, 40).box(-6, 22, -6, 12, 2, 12);
  p.spikes = [];
  const sx = [1.75, 0.25, 0, 0, 0.5, 0.5, 0.5, 0.5, 1.25, 0.75, 0, 0];
  const sy = [0, 0, 0, 0, 0.25, 1.75, 1.25, 0.75, 0, 0, 0, 0];
  const sz = [0, 0, 0.25, 1.75, 0, 0, 0, 0, 0, 0, 0.75, 1.25];
  const ox = [0, 0, 8, -8, -8, 8, 8, -8, 0, 0, 8, -8];
  const oy = [-8, -8, -8, -8, 0, 0, 0, 0, 8, 8, 8, 8];
  const oz = [8, -8, 0, 0, -8, -8, 8, 8, 8, -8, 0, 0];
  for (let i = 0; i < 12; i++) {
    const s = T(0, 0).box(-1, -4.5, -1, 2, 9, 2);
    s.rx = PI * sx[i]; s.ry = PI * sy[i]; s.rz = PI * sz[i];
    s.px = ox[i]; s.py = 16 + oy[i]; s.pz = oz[i];
    s._base = [ox[i], oy[i], oz[i]];
    p.body.add(s);
    p.spikes.push(s);
  }
  p.eye = T(8, 0).box(-1, 15, 0, 2, 2, 1).pivot(0, 0, -8.25);
  p.body.add(p.eye);
  p.tail = [T(40, 0).box(-2, 14, 7, 4, 4, 8), T(0, 54).box(0, 14, 0, 3, 3, 7), T(41, 32).box(0, 14, 0, 2, 2, 6).tex(25, 19).box(1, 10.5, 3, 1, 9, 9)];
  p.body.add(p.tail[0]); p.tail[0].add(p.tail[1]); p.tail[1].add(p.tail[2]);
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
  const p = {};
  const T = (u, v) => new Part(64, 64).tex(u, v);
  p.head = T(0, 0).box(-3, -3, -3, 6, 6, 6);
  p.rightEar = T(24, 0).box(-4, -6, -2, 3, 4, 1);
  p.leftEar = T(24, 0); p.leftEar.mirror = true; p.leftEar.box(1, -6, -2, 3, 4, 1);
  p.head.add(p.rightEar); p.head.add(p.leftEar);
  p.body = T(0, 16).box(-3, 4, -3, 6, 12, 6).tex(0, 34).box(-5, 16, 0, 10, 6, 1);
  p.rightWing = T(42, 0).box(-12, 1, 1.5, 10, 16, 1);
  p.rightWingTip = T(24, 16).box(-8, 1, 0, 8, 12, 1).pivot(-12, 1, 1.5);
  p.leftWing = T(42, 0); p.leftWing.mirror = true; p.leftWing.box(2, 1, 1.5, 10, 16, 1);
  p.leftWingTip = T(24, 16); p.leftWingTip.mirror = true; p.leftWingTip.box(0, 1, 0, 8, 12, 1).pivot(12, 1, 1.5);
  p.body.add(p.rightWing); p.body.add(p.leftWing);
  p.rightWing.add(p.rightWingTip); p.leftWing.add(p.leftWingTip);
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
  const p = {};
  p.body = new Part(64, 32).tex(0, 0).box(-6, -8, -6, 12, 16, 12).pivot(0, 8, 0);
  p.tentacles = [];
  for (let j = 0; j < 8; j++) {
    const t = new Part(64, 32).tex(48, 0).box(-1, 0, -1, 2, 18, 2);
    const d0 = j * PI * 2 / 8;
    t.px = cos(d0) * 5; t.pz = sin(d0) * 5; t.py = 15;
    t.ry = j * PI * -2 / 8 + PI / 2;
    p.tentacles.push(t);
  }
  return {
    parts: p, roots: [p.body, ...p.tentacles],
    animate: (m, a) => { for (const t of m.parts.tentacles) t.rx = a.tentacleAngle !== undefined ? a.tentacleAngle : (sin(a.age * 0.2) + 1) * 0.3; },
  };
}

export function ironGolem() {
  const p = {};
  const T = (u, v) => new Part(128, 128).tex(u, v);
  p.head = T(0, 0).box(-4, -12, -5.5, 8, 10, 8).tex(24, 0).box(-1, -5, -7.5, 2, 4, 2).pivot(0, -7, -2);
  p.body = T(0, 40).box(-9, -2, -6, 18, 12, 11).tex(0, 70).box(-4.5, 10, -3, 9, 5, 6, 0.5).pivot(0, -7, 0);
  p.rightArm = T(60, 21).box(-13, -2.5, -3, 4, 30, 6).pivot(0, -7, 0);
  p.leftArm = T(60, 58).box(9, -2.5, -3, 4, 30, 6).pivot(0, -7, 0);
  p.leftLeg = T(37, 0).box(-3.5, -3, -3, 6, 16, 5).pivot(-4, 11, 0);
  p.rightLeg = T(60, 0); p.rightLeg.mirror = true; p.rightLeg.box(-3.5, -3, -3, 6, 16, 5).pivot(5, 11, 0);
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
  const p = {};
  const T = (u, v) => new Part(64, 64).tex(u, v);
  p.head = T(0, 0).box(-4, -8, -4, 8, 8, 8, -0.5).pivot(0, 4, 0);
  p.rightHand = T(32, 0).box(-1, 0, -1, 12, 2, 2, -0.5).pivot(0, 6, 0);
  p.leftHand = T(32, 0).box(-1, 0, -1, 12, 2, 2, -0.5).pivot(0, 6, 0);
  p.body = T(0, 16).box(-5, -10, -5, 10, 10, 10, -0.5).pivot(0, 13, 0);
  p.bottomBody = T(0, 36).box(-6, -12, -6, 12, 12, 12, -0.5).pivot(0, 24, 0);
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
  const p = {};
  const T = (u, v) => new Part(64, 64).tex(u, v);
  p.shoulders = T(0, 16).box(-10, 3.9, -0.5, 20, 3, 3);
  p.spine = T(0, 22).box(0, 0, 0, 3, 10, 3).pivot(-2, 6.9, -0.5).rot(0.2, 0, 0);
  p.spine.tex(24, 22).box(-4, 1.5, 0.5, 11, 2, 2).tex(24, 22).box(-4, 4, 0.5, 11, 2, 2).tex(24, 22).box(-4, 6.5, 0.5, 11, 2, 2);
  p.tail = T(12, 22).box(0, 0, 0, 3, 6, 3).pivot(-2, 6.9 + cos(0.2) * 10, -0.5 + sin(0.2) * 10).rot(0.83, 0, 0);
  p.head1 = T(0, 0).box(-4, -4, -4, 8, 8, 8);
  p.head2 = T(32, 0).box(-4, -4, -4, 6, 6, 6).pivot(-8, 4, 0);
  p.head3 = T(32, 0).box(-4, -4, -4, 6, 6, 6).pivot(10, 4, 0);
  return {
    parts: p, roots: [p.shoulders, p.spine, p.tail, p.head1, p.head2, p.head3], modelScale: 2,
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
  const p = {};
  const T = (u, v) => new Part(64, 64).tex(u, v);
  p.head = T(0, 0).box(-1, -7, -1, 2, 7, 2).pivot(0, 1, 0);
  p.body = T(0, 26).box(-6, 0, -1.5, 12, 3, 3);
  p.rightArm = T(24, 0).box(-2, -2, -1, 2, 12, 2).pivot(-5, 2, 0);
  p.leftArm = T(32, 16); p.leftArm.mirror = true; p.leftArm.box(0, -2, -1, 2, 12, 2).pivot(5, 2, 0);
  p.rightLeg = T(8, 0).box(-1, 0, -1, 2, 11, 2).pivot(-1.9, 12, 0);
  p.leftLeg = T(40, 16); p.leftLeg.mirror = true; p.leftLeg.box(-1, 0, -1, 2, 11, 2).pivot(1.9, 12, 0);
  p.rightSide = T(16, 0).box(-3, 3, -1, 2, 7, 2);
  p.leftSide = T(48, 16).box(1, 3, -1, 2, 7, 2);
  p.waist = T(0, 48).box(-4, 10, -1, 8, 2, 2);
  p.base = T(0, 32).box(-6, 11, -6, 12, 1, 12).pivot(0, 12, 0);
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

export function boat() {
  const T = (u, v) => new Part(64, 32).tex(u, v);
  const s0 = T(0, 8).box(-12, -8, -3, 24, 16, 4).pivot(0, 4, 0).rot(PI / 2, 0, 0);
  const s1 = T(0, 0).box(-10, -7, -1, 20, 6, 2).pivot(-11, 4, 0).rot(0, PI * 3 / 2, 0);
  const s2 = T(0, 0).box(-10, -7, -1, 20, 6, 2).pivot(11, 4, 0).rot(0, PI / 2, 0);
  const s3 = T(0, 0).box(-10, -7, -1, 20, 6, 2).pivot(0, 4, -9).rot(0, PI, 0);
  const s4 = T(0, 0).box(-10, -7, -1, 20, 6, 2).pivot(0, 4, 9);
  return { parts: {}, roots: [s0, s1, s2, s3, s4], animate() {} };
}

export function minecart() {
  const T = (u, v) => new Part(64, 32).tex(u, v);
  const s0 = T(0, 10).box(-10, -8, -1, 20, 16, 2).pivot(0, 4, 0).rot(PI / 2, 0, 0);
  const s1 = T(0, 0).box(-8, -9, -1, 16, 8, 2).pivot(-9, 4, 0).rot(0, PI * 3 / 2, 0);
  const s2 = T(0, 0).box(-8, -9, -1, 16, 8, 2).pivot(9, 4, 0).rot(0, PI / 2, 0);
  const s3 = T(0, 0).box(-8, -9, -1, 16, 8, 2).pivot(0, 4, -7).rot(0, PI, 0);
  const s4 = T(0, 0).box(-8, -9, -1, 16, 8, 2).pivot(0, 4, 7);
  const s5 = T(44, 10).box(-9, -7, -1, 18, 14, 1).pivot(0, 4, 0).rot(-PI / 2, 0, 0);
  return { parts: {}, roots: [s0, s1, s2, s3, s4, s5], animate() {} };
}

// Armor model: biped with inflate (layer 1: 1.0, layer 2: 0.5)
export function armorModel(inflate) {
  const m = biped(64, 32, inflate);
  return m;
}

// ModelDragon geometry (256x256 texture). The neck and tail reuse one spine segment many times, so this
// returns factories; RenderDragon posing lives in the entity renderer.
export function dragonParts() {
  const T = 256, f = -16;
  const P = () => new Part(T, T);
  const head = P();
  head.tex(176, 44).box(-6, -1, -8 + f, 12, 5, 16);
  head.tex(112, 30).box(-8, -8, 6 + f, 16, 16, 16);
  head.mirror = true;
  head.tex(0, 0).box(-5, -12, 12 + f, 2, 4, 6);
  head.tex(112, 0).box(-5, -3, -6 + f, 2, 2, 4);
  head.mirror = false;
  head.tex(0, 0).box(3, -12, 12 + f, 2, 4, 6);
  head.tex(112, 0).box(3, -3, -6 + f, 2, 2, 4);
  const jaw = P().tex(176, 65).box(-6, 0, -16, 12, 4, 16).pivot(0, 4, 8 + f);
  head.add(jaw);
  const spine = () => P().tex(192, 104).box(-5, -5, -5, 10, 10, 10).tex(48, 0).box(-1, -9, -3, 2, 4, 6);
  const body = P().pivot(0, 4, 8);
  body.tex(0, 0).box(-12, 0, -16, 24, 24, 64);
  body.tex(220, 53).box(-1, -6, -10, 2, 6, 12).box(-1, -6, 10, 2, 6, 12).box(-1, -6, 30, 2, 6, 12);
  const limbs = () => {
    const wing = P().pivot(-12, 5, 2);
    wing.tex(112, 88).box(-56, -4, -4, 56, 8, 8);
    wing.tex(-56, 88).box(-56, 0, 2, 56, 0, 56);
    const wingTip = P().pivot(-56, 0, 0);
    wingTip.tex(112, 136).box(-56, -2, -2, 56, 4, 4);
    wingTip.tex(-56, 144).box(-56, 0, 2, 56, 0, 56);
    wing.add(wingTip);
    const frontLeg = P().tex(112, 104).box(-4, -4, -4, 8, 24, 8).pivot(-12, 20, 2);
    const frontLegTip = P().tex(226, 138).box(-3, -1, -3, 6, 24, 6).pivot(0, 20, -1);
    const frontFoot = P().tex(144, 104).box(-4, 0, -12, 8, 4, 16).pivot(0, 23, 0);
    frontLeg.add(frontLegTip); frontLegTip.add(frontFoot);
    const rearLeg = P().tex(0, 0).box(-8, -4, -8, 16, 32, 16).pivot(-16, 16, 42);
    const rearLegTip = P().tex(196, 0).box(-6, -2, 0, 12, 32, 12).pivot(0, 32, -4);
    const rearFoot = P().tex(112, 0).box(-9, 0, -20, 18, 6, 24).pivot(0, 31, 4);
    rearLeg.add(rearLegTip); rearLegTip.add(rearFoot);
    return { wing, wingTip, frontLeg, frontLegTip, frontFoot, rearLeg, rearLegTip, rearFoot };
  };
  return { head, jaw, body, spine, limbs };
}
