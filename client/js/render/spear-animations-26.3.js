// Native 26.3 spear arm and item animation formulas (SpearAnimations).
// Sources: cache/port-26.3/client.jar net/minecraft/client/model/effects/SpearAnimations,
// HumanoidModel.setupAttackAnimation, ItemInHandLayer and FirstPersonHandsAndItemsRenderer.
import {D2R, mat4} from '../gfx/math.js';

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const progress = (time, start, end) => clamp((time - start) / (end - start));

const Ease = {
  inQuad: x => x * x,
  inOutSine: x => -(Math.cos(Math.PI * x) - 1) / 2,
  inOutExpo: x => x < 0.5 ? (x === 0 ? 0 : 2 ** (20 * x - 10) / 2) : (x === 1 ? 1 : (2 - 2 ** (-20 * x + 10)) / 2),
  inOutBack: x => {
    if (x < 0.5) return 4 * x * x * (7.189819 * x - 2.5949094) / 2;
    const t = 2 * x - 2;
    return (t * t * (3.5949094 * t + 2.5949094) + 2) / 2;
  },
  outBack: x => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2,
  outQuart: x => 1 - (1 - x) ** 4,
  outCubic: x => 1 - (1 - x) ** 3,
  inOutElastic: x => {
    if (x === 0 || x === 1) return x;
    const sin = Math.sin((20 * x - 11.125) * 1.3962634801864624);
    return x < 0.5 ? -(2 ** (20 * x - 10) * sin) / 2 : (2 ** (-20 * x + 10) * sin) / 2 + 1;
  },
  outCirc: x => Math.sqrt(Math.max(0, 1 - (x - 1) ** 2)),
  inCirc: x => -Math.sqrt(Math.max(0, 1 - x * x)) + 1
};

const conditionMax = condition => condition?.maxDurationTicks ?? 0;

// SpearAnimations.UseParams.fromKineticWeapon.
export function spearUseParams(kinetic, time) {
  const finishRaisingTick = kinetic?.delayTicks ?? 0;
  const finishSwayingTick = conditionMax(kinetic?.dismountConditions) + finishRaisingTick;
  const startSwayingTick = finishSwayingTick - 20;
  const finishLoweringTick = conditionMax(kinetic?.knockbackConditions) + finishRaisingTick;
  const startLoweringTick = finishLoweringTick - 40;
  const finishRaisingBackTick = conditionMax(kinetic?.damageConditions) + finishRaisingTick;
  const raiseProgress = progress(time, 0, finishRaisingTick);
  const raiseProgressStart = progress(raiseProgress, 0, 0.5);
  const raiseProgressMiddle = progress(raiseProgress, 0.5, 0.8);
  const raiseProgressEnd = progress(raiseProgress, 0.8, 1);
  const swayProgress = progress(time, startSwayingTick, finishSwayingTick);
  const lowerProgress = Ease.outCubic(Ease.inOutElastic(progress(time - 20, startLoweringTick, finishLoweringTick)));
  const raiseBackProgress = progress(time, finishRaisingBackTick - 5, finishRaisingBackTick);
  const swayIntensity = 2 * Ease.outCirc(swayProgress) - 2 * Ease.inCirc(raiseBackProgress);
  const swayScaleSlow = Math.sin(time * 19 * D2R) * swayIntensity;
  const swayScaleFast = Math.sin(time * 30 * D2R) * swayIntensity;
  return {
    raiseProgress, raiseProgressStart, raiseProgressMiddle, raiseProgressEnd,
    swayProgress, lowerProgress, raiseBackProgress,
    swayIntensity, swayScaleSlow, swayScaleFast
  };
}

export function spearHitFeedbackAmount(ticksSinceFeedbackStart) {
  return 0.4 * (
    Ease.outQuart(progress(ticksSinceFeedbackStart, 1, 3)) -
    Ease.inOutSine(progress(ticksSinceFeedbackStart, 3, 10))
  );
}

export function spearSwingProgress(animation) {
  return {
    prepare: Ease.inOutSine(progress(animation, 0, 0.05)),
    attack: Ease.inQuad(progress(animation, 0.05, 0.2)),
    retract: Ease.inOutExpo(progress(animation, 0.4, 1))
  };
}

// SpearAnimations.thirdPersonHandUse. arm and head are model parts.
export function spearThirdPersonHandUse(arm, head, side, kinetic, time, options = {}) {
  const invert = side > 0 ? 1 : -1;
  arm.ry = -0.1 * invert + head.ry;
  arm.rx = -Math.PI / 2 + head.rx + 0.8;
  if (options.fallFlying || (options.swimAmount ?? 0) > 0) arm.rx -= 0.9599311;
  arm.ry = D2R * clamp(arm.ry / D2R, -60, 60);
  arm.rx = D2R * clamp(arm.rx / D2R, -120, 30);
  if (!kinetic || !(time > 0) || options.inactiveUse) return;
  const p = spearUseParams(kinetic, time);
  arm.ry += -invert * p.swayScaleFast * D2R * p.swayIntensity;
  arm.rz += -invert * p.swayScaleSlow * D2R * p.swayIntensity * 0.5;
  arm.rx += D2R * (
    -40 * p.raiseProgressStart + 30 * p.raiseProgressMiddle - 20 * p.raiseProgressEnd +
    20 * p.lowerProgress + 10 * p.raiseBackProgress +
    0.6 * p.swayScaleSlow * p.swayIntensity
  );
}

// HumanoidModel.setupAttackAnimation STAB branch. Body rotation is already applied.
export function spearThirdPersonAttackArm(model, animation, side) {
  model.rightArm.ry -= model.body.ry;
  model.leftArm.ry -= model.body.ry;
  model.leftArm.rx -= model.body.ry;
  const {prepare, attack, retract} = spearSwingProgress(animation);
  const arm = side > 0 ? model.rightArm : model.leftArm;
  arm.rx += (90 * prepare - 120 * attack + 30 * retract) * D2R;
}

const rotateAround = (m, degrees, x, y, z, px, py, pz) => {
  mat4.translate(m, m, px, py, pz);
  mat4.rotate(m, m, degrees * D2R, x, y, z);
  mat4.translate(m, m, -px, -py, -pz);
};

// SpearAnimations.firstPersonUse.
export function spearFirstPersonUse(m, kinetic, time, side, hitFeedbackTicks) {
  if (!kinetic) return;
  const p = spearUseParams(kinetic, time);
  const invert = side > 0 ? 1 : -1;
  mat4.translate(m, m,
    invert * (p.raiseProgress * 0.15 + p.raiseProgressEnd * -0.05 + p.swayProgress * -0.1 + p.swayScaleSlow * 0.005),
    p.raiseProgress * -0.075 + p.raiseProgressMiddle * 0.075 + p.swayScaleFast * 0.01,
    p.raiseProgressStart * 0.05 + p.raiseProgressEnd * -0.05 + p.swayScaleSlow * 0.005
  );
  rotateAround(m, -65 * Ease.inOutBack(p.raiseProgress) - 35 * p.lowerProgress + 100 * p.raiseBackProgress - 0.5 * p.swayScaleFast, 1, 0, 0, 0, 0.1, 0);
  rotateAround(m, -(invert * (-90 * progress(p.raiseProgress, 0.5, 0.55) + 90 * p.swayProgress + 2 * p.swayScaleSlow)), 0, 1, 0, invert * 0.15, 0, 0);
  mat4.translate(m, m, 0, -spearHitFeedbackAmount(hitFeedbackTicks), 0);
}

// SpearAnimations.firstPersonAttack.
export function spearFirstPersonAttack(m, attack, side) {
  const invert = side > 0 ? 1 : -1;
  const {prepare: startingAmount, attack: middleAmount, retract: endingAmount} = {
    prepare: Ease.inOutSine(progress(attack, 0, 0.05)),
    attack: Ease.outBack(progress(attack, 0.05, 0.2)),
    retract: Ease.inOutExpo(progress(attack, 0.4, 1))
  };
  mat4.translate(m, m, invert * 0.1 * (startingAmount - middleAmount), -0.075 * (startingAmount - endingAmount), 0.65 * (startingAmount - middleAmount));
  mat4.rotate(m, m, -70 * (startingAmount - endingAmount) * D2R, 1, 0, 0);
  mat4.translate(m, m, 0, 0, -0.25 * (endingAmount - middleAmount));
}

// SpearAnimations.thirdPersonAttackItem.
export function spearThirdPersonAttackItem(m, kinetic, animation) {
  if (!(animation > 0)) return;
  const {attack, retract} = spearSwingProgress(animation);
  rotateAround(m, -(70 * (attack - retract)), 1, 0, 0, 0, -0.125, 0.125);
  mat4.translate(m, m, 0, (kinetic?.forwardMovement ?? 0) * (attack - retract), 0);
}

// SpearAnimations.thirdPersonUseItem. swingAnimation is the entity's swing progress.
export function spearThirdPersonUseItem(m, kinetic, time, side, hitFeedbackTicks, swingAnimation = 0) {
  if (!kinetic || !(time > 0)) return;
  const invert = side > 0 ? 1 : -1;
  const {attack, retract} = spearSwingProgress(swingAnimation);
  const p = spearUseParams(kinetic, time);
  const hitFeedback = spearHitFeedbackAmount(hitFeedbackTicks);
  const raiseModified = 1 - Ease.outBack(1 - p.raiseProgress);
  mat4.translate(m, m, 0,
    -hitFeedback * 0.4,
    -(kinetic.forwardMovement ?? 0) * (raiseModified - p.raiseBackProgress) + hitFeedback
  );
  rotateAround(m, -(70 * (p.raiseProgress - p.raiseBackProgress) - 40 * (attack - retract)), 1, 0, 0, 0, -0.03125, 0.125);
  rotateAround(m, invert * 90 * (p.raiseProgress - p.swayProgress + 3 * retract + attack), 0, 1, 0, 0, 0, 0.125);
}

export const SPEAR_EASE = Ease;
export const SPEAR_PROGRESS = progress;
