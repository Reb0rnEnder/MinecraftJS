import { PAWS_DATA_774 } from './paws-data-1.21.11.js';

function isAngerEndActive(angerEndTime, worldAge = 0) {
  if (angerEndTime === undefined || angerEndTime === null) return false;
  const end = typeof angerEndTime === 'bigint' ? angerEndTime : BigInt(Math.trunc(Number(angerEndTime) || 0));
  if (end <= 0n) return false;
  const age = typeof worldAge === 'bigint' ? worldAge : BigInt(Math.trunc(Number(worldAge) || 0));
  return end > age;
}

export function applyPawsMetadata774(e, wire, worldAge = 0) {
  const ids = PAWS_DATA_774.metadata[e.entityName];
  if (!ids) return;
  const set = (symbol, key) => {
    if (wire[ids[symbol]] !== undefined) e[key] = wire[ids[symbol]];
  };
  set('DATA_HEALTH_ID', 'health');
  if (e.entityName === 'wolf') {
    set('DATA_VARIANT_ID', 'wolfVariant');
    set('DATA_SOUND_VARIANT_ID', 'wolfSoundVariant');
    set('DATA_INTERESTED_ID', 'begging');
    set('DATA_COLLAR_COLOR', 'collar');
    if (wire[ids.DATA_ANGER_END_TIME] !== undefined) {
      e.angerEndTime = wire[ids.DATA_ANGER_END_TIME];
    }
    if (wire[ids.DATA_FLAGS_ID] !== undefined) {
      const flags = wire[ids.DATA_FLAGS_ID];
      e.tamed = !!(flags & 4);
      e.sitting = !!(flags & 1);
    }
    e.angry = isAngerEndActive(e.angerEndTime, worldAge);
  }
  if (e.entityName === 'armadillo' && wire[ids.ARMADILLO_STATE] !== undefined) {
    const state = wire[ids.ARMADILLO_STATE];
    if (e.armadilloState !== state) {
      e.armadilloState = state;
      e.armadilloStateStart = e.ticks ?? 0;
      e.armadilloStateTicks = 0;
    }
  }
  if (wire[ids.DATA_BABY_ID] !== undefined) {
    e.child = !!wire[ids.DATA_BABY_ID];
    if (e.entityName === 'armadillo') {
      [e.width, e.height, e.eyeHeight] = PAWS_DATA_774.armadilloDimensions[e.child ? 'baby' : 'adult'].map(Math.fround);
    }
  }
}

export function wolfTailAngle774(e) {
  if (e.angry) return Math.fround(1.5393804);
  if (!e.tamed) return Math.fround(0.62831855);
  const f = Math.fround;
  const max = f(e.maxHealth ?? 40);
  const missing = f(f(max - f(e.health ?? max)) / max);
  return f(f(f(0.55) - f(missing * f(0.4))) * f(Math.PI));
}

export function tickWolf774(e, worldAge = 0) {
  if (e.angerEndTime !== undefined) {
    e.angry = isAngerEndActive(e.angerEndTime, worldAge);
  }
}

export function tickArmadillo774(e) {
  e.armadilloAnimationInitialized = true;
  const t = e.ticks ?? 0;
  const state = e.armadilloState ?? 0;
  const inStateTicks = e.armadilloStateTicks ?? 0;
  if (state === 0) {
    e.armadilloRollOutStart = undefined;
    e.armadilloRollUpStart = undefined;
    e.armadilloPeekStart = undefined;
  } else if (state === 3) {
    e.armadilloRollOutStart ??= t;
    e.armadilloRollUpStart = undefined;
    e.armadilloPeekStart = undefined;
  } else if (state === 1) {
    e.armadilloRollOutStart = undefined;
    e.armadilloRollUpStart ??= t;
    e.armadilloPeekStart = undefined;
  } else if (state === 2) {
    e.armadilloRollOutStart = undefined;
    e.armadilloRollUpStart = undefined;
    if (e.armadilloPeekReceived) {
      e.armadilloPeekStart = undefined;
      e.armadilloPeekReceived = false;
    }
    if (inStateTicks === 0) {
      e.armadilloPeekStart = t - (PAWS_DATA_774.states[2]?.duration ?? 50);
    } else {
      e.armadilloPeekStart ??= t;
    }
  }
  e.armadilloStateTicks = inStateTicks + 1;
}
