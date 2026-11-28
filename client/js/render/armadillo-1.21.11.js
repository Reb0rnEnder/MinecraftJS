import { PAWS_ANIMATIONS_774 } from './animations-paws-1.21.11.js';
import { animateKeyframes762 } from './keyframes-1.19.4.js';
import { PAWS_DATA_774 } from '../game/paws-data-1.21.11.js';

export function animateArmadillo774(model, a) {
  const p = model.parts, e = a.entity || {}, state = e.armadilloState ?? 0;
  const ticks = Math.max(0, (e.ticks ?? 0) - (e.armadilloStateStart ?? 0));
  const timeline = PAWS_DATA_774.states[state] ?? PAWS_DATA_774.states[0];
  const hidden = timeline.hidden[Math.min(Math.floor(e.armadilloStateTicks ?? ticks), timeline.hidden.length - 1)];
  p.body.skipDraw = hidden;
  p.left_hind_leg.visible = p.right_hind_leg.visible = p.tail.visible = !hidden;
  p.cube.visible = hidden;
  if (!hidden) {
    p.head.rx = Math.max(-22.5, Math.min(25, a.pitch)) * Math.PI / 180;
    p.head.ry = Math.max(-32.5, Math.min(32.5, a.yaw)) * Math.PI / 180;
  }
  const clips = PAWS_ANIMATIONS_774.armadillo;
  const play = (key, millis, weight = 1) => animateKeyframes762(p, clips[key], millis, weight);
  play('ARMADILLO_WALK', Math.fround(Math.fround(a.ls * 50) * 16.5), Math.min(Math.fround(a.lsa * 2.5), 1));
  const playState = (key, start) => { if (start !== undefined) play(key, (a.age - start) * 50); };
  if (e.armadilloAnimationInitialized) {
    playState('ARMADILLO_ROLL_UP', e.armadilloRollUpStart);
    playState('ARMADILLO_ROLL_OUT', e.armadilloRollOutStart);
    playState('ARMADILLO_PEEK', e.armadilloPeekStart);
  } else {
    const time = (a.age - (e.armadilloStateStart ?? 0)) * 50;
    if (state === 1) play('ARMADILLO_ROLL_UP', time);
    if (state === 3) play('ARMADILLO_ROLL_OUT', time);
    if (state === 2) play('ARMADILLO_PEEK', e.armadilloPeekStart === undefined ? time + timeline.duration * 50 : (a.age - e.armadilloPeekStart) * 50);
  }
}
