// Display entities (block_display, item_display, text_display), following native Display (1.19.4+):
// synced data with native defaults, the start-tick / duration / render-state update flags applied on the client
// tick, and the interpolated render state the renderer reads (transformation, text opacity and background).
const f32 = Math.fround;

const BASE_KEYS = {
  DATA_TRANSFORMATION_INTERPOLATION_START_DELTA_TICKS_ID: 'startDelta',
  DATA_TRANSFORMATION_INTERPOLATION_DURATION_ID: 'duration',
  // 1.19.4 names
  DATA_INTERPOLATION_START_DELTA_TICKS_ID: 'startDelta', DATA_INTERPOLATION_DURATION_ID: 'duration',
  DATA_POS_ROT_INTERPOLATION_DURATION_ID: 'posRotDuration',
  DATA_TRANSLATION_ID: 'translation', DATA_SCALE_ID: 'scale', DATA_LEFT_ROTATION_ID: 'leftRotation', DATA_RIGHT_ROTATION_ID: 'rightRotation',
  DATA_BILLBOARD_RENDER_CONSTRAINTS_ID: 'billboard', DATA_BRIGHTNESS_OVERRIDE_ID: 'brightness', DATA_VIEW_RANGE_ID: 'viewRange',
  DATA_SHADOW_RADIUS_ID: 'shadowRadius', DATA_SHADOW_STRENGTH_ID: 'shadowStrength', DATA_WIDTH_ID: 'width', DATA_HEIGHT_ID: 'height',
  DATA_GLOW_COLOR_OVERRIDE_ID: 'glowColor',
  // text_display
  DATA_TEXT_ID: 'text', DATA_LINE_WIDTH_ID: 'lineWidth', DATA_BACKGROUND_COLOR_ID: 'background', DATA_TEXT_OPACITY_ID: 'textOpacity', DATA_STYLE_FLAGS_ID: 'styleFlags',
  // block_display / item_display
  DATA_BLOCK_STATE_ID: 'blockState', DATA_ITEM_STACK_ID: 'item', DATA_ITEM_DISPLAY_ID: 'itemDisplay',
};
// Display.RENDER_STATE_IDS plus each subclass's render-state data
const RENDER_STATE = new Set(['translation', 'scale', 'leftRotation', 'rightRotation', 'billboard', 'brightness', 'shadowRadius', 'shadowStrength',
  'text', 'lineWidth', 'background', 'textOpacity', 'styleFlags', 'blockState', 'item', 'itemDisplay']);

export const BILLBOARD = ['fixed', 'vertical', 'horizontal', 'center'];
// ItemDisplayContext ordinals
export const ITEM_DISPLAY = ['none', 'thirdperson_lefthand', 'thirdperson_righthand', 'firstperson_lefthand', 'firstperson_righthand', 'head', 'gui', 'ground', 'fixed'];

// 1.19.4 keeps interpolators from construction instead of building render states on the tick
const INTERPOLATED_1194 = new Set(['translation', 'scale', 'leftRotation', 'rightRotation', 'shadowRadius', 'shadowStrength', 'textOpacity', 'background']);
const isLegacy = (ids) => !!ids && ids.DATA_INTERPOLATION_DURATION_ID !== undefined;

export function isDisplay(e) { return e.kind === 'display'; }

export function initDisplay(e, ids = null) {
  e.display = {
    startDelta: 0, duration: 0, posRotDuration: 0,
    translation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 }, leftRotation: { x: 0, y: 0, z: 0, w: 1 }, rightRotation: { x: 0, y: 0, z: 0, w: 1 },
    billboard: 0, brightness: -1, viewRange: 1, shadowRadius: 0, shadowStrength: 1, width: 0, height: 0, glowColor: -1,
    text: '', lineWidth: 200, background: 0x40000000, textOpacity: -1, styleFlags: 0,
    blockState: 0, item: null, itemDisplay: 0,
    ticks: 0, startTick: 0, interpolationDuration: 0, lastProgress: 0,
    updateStartTick: false, updateDuration: false, updateRenderState: false, renderState: null,
    legacy: isLegacy(ids), pendingInterpolation: false,
  };
  if (e.display.legacy) e.display.renderState = freshState(e.display);
  e.width = e.height = 0; e.noCulling = true; e.eyeHeight = 0;
}

// Display.onSyncedDataUpdated
export function applyDisplayMeta(e, wire, ids) {
  if (!e.display) initDisplay(e, ids);
  const d = e.display;
  let interpolated = false;
  for (const [symbol, key] of Object.entries(BASE_KEYS)) {
    const id = ids?.[symbol];
    if (id === undefined || wire[id] === undefined) continue;
    d[key] = wire[id];
    if (key === 'startDelta') d.updateStartTick = true;
    else if (key === 'duration') { if (d.legacy) d.interpolationDuration = d.duration; else d.updateDuration = true; }
    else if (key === 'width' || key === 'height') updateCulling(e);
    if (!RENDER_STATE.has(key)) continue;
    if (!d.legacy) d.updateRenderState = true;
    else if (INTERPOLATED_1194.has(key)) interpolated = true;
    else d.renderState[key] = d[key]; // 1.19.4: applied as soon as the data arrives
  }
  if (interpolated) {
    // 1.19.4 Display.onSyncedDataUpdated(List): a display that has not ticked yet snaps, otherwise the tick
    // restarts its interpolators from the values on screen
    if (d.ticks <= 0) d.renderState = freshState(d); else d.pendingInterpolation = true;
  }
}

function updateCulling(e) {
  const d = e.display;
  e.width = d.width; e.height = d.height;
  e.noCulling = d.width === 0 || d.height === 0;
}

// Display.tick (client side): tickCount has already advanced
export function tickDisplay(e) {
  const d = e.display;
  if (!d) return;
  d.ticks++;
  if (d.updateStartTick) { d.updateStartTick = false; d.startTick = d.ticks + d.startDelta; }
  if (d.updateDuration) { d.updateDuration = false; d.interpolationDuration = d.duration; }
  if (d.pendingInterpolation) { d.pendingInterpolation = false; d.renderState = interpolatedState(d, d.renderState, d.lastProgress); }
  if (d.updateRenderState) {
    d.updateRenderState = false;
    const interpolate = d.interpolationDuration !== 0;
    d.renderState = interpolate && d.renderState ? interpolatedState(d, d.renderState, d.lastProgress) : freshState(d);
  }
}

// Display.calculateInterpolationProgress
export function displayProgress(e, partial) {
  const d = e.display;
  const duration = d.interpolationDuration;
  if (duration <= 0) return 1;
  const t = f32(f32(d.ticks - d.startTick) + partial);
  d.lastProgress = Math.min(1, Math.max(0, f32(t / duration)));
  return d.lastProgress;
}

function transformation(d) {
  return { t: [d.translation.x, d.translation.y, d.translation.z], l: [d.leftRotation.x, d.leftRotation.y, d.leftRotation.z, d.leftRotation.w],
    s: [d.scale.x, d.scale.y, d.scale.z], r: [d.rightRotation.x, d.rightRotation.y, d.rightRotation.z, d.rightRotation.w] };
}

function freshState(d) {
  const current = transformation(d);
  return {
    transformation: { from: current, to: current }, billboard: d.billboard, brightness: d.brightness,
    shadowRadius: { from: d.shadowRadius, to: d.shadowRadius }, shadowStrength: { from: d.shadowStrength, to: d.shadowStrength },
    text: d.text, lineWidth: d.lineWidth, styleFlags: d.styleFlags, textOpacity: { from: d.textOpacity, to: d.textOpacity }, background: { from: d.background, to: d.background },
    blockState: d.blockState, item: d.item, itemDisplay: d.itemDisplay,
  };
}

// Display.createInterpolatedRenderState / TextDisplay.createInterpolatedTextRenderState: start from what was on
// screen at the last progress and move to the new values
function interpolatedState(d, prev, p) {
  const s = freshState(d);
  s.transformation.from = lerpTransformation(prev.transformation, p);
  s.shadowRadius.from = lerpFloat(prev.shadowRadius, p);
  s.shadowStrength.from = lerpFloat(prev.shadowStrength, p);
  s.textOpacity.from = lerpInt(prev.textOpacity, p);
  s.background.from = lerpColor(prev.background, p);
  return s;
}

export const lerpFloat = (i, p) => f32(i.from + p * (i.to - i.from));
// Mth.lerpInt: start + floor(delta * (end - start))
export const lerpInt = (i, p) => i.from + Math.floor(p * (i.to - i.from));
// FastColor.ARGB32.lerp: each channel with Mth.lerpInt
export function lerpColor(i, p) {
  let out = 0;
  for (const shift of [24, 16, 8, 0]) {
    const a = (i.from >>> shift) & 255, b = (i.to >>> shift) & 255;
    out |= ((a + Math.floor(p * (b - a))) & 255) << shift;
  }
  return out | 0;
}

function slerp(a, b, t) {
  // Quaternionf.slerp
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const abs = Math.abs(cos);
  let s0, s1;
  if (1 - abs > 1e-6) {
    const sin2 = 1 - abs * abs, inv = 1 / Math.sqrt(sin2), angle = Math.atan2(sin2 * inv, abs);
    s0 = Math.sin((1 - t) * angle) * inv; s1 = Math.sin(t * angle) * inv;
  } else { s0 = 1 - t; s1 = t; }
  s1 = cos >= 0 ? s1 : -s1;
  return [s0 * a[0] + s1 * b[0], s0 * a[1] + s1 * b[1], s0 * a[2] + s1 * b[2], s0 * a[3] + s1 * b[3]];
}

// TransformationInterpolator.get: the current transformation once complete, else Transformation.slerp
export function lerpTransformation(i, p) {
  if (p >= 1) return i.to;
  const a = i.from, b = i.to, lerp3 = (x, y) => x.map((v, k) => v + (y[k] - v) * p);
  return { t: lerp3(a.t, b.t), l: slerp(a.l, b.l, p), s: lerp3(a.s, b.s), r: slerp(a.r, b.r, p) };
}

function quatMatrix(q) {
  const [x, y, z, w] = q, n = x * x + y * y + z * z + w * w, s = n > 0 ? 2 / n : 0;
  const xx = x * x * s, yy = y * y * s, zz = z * z * s, xy = x * y * s, xz = x * z * s, yz = y * z * s, wx = w * x * s, wy = w * y * s, wz = w * z * s;
  return [1 - yy - zz, xy + wz, xz - wy, 0, xy - wz, 1 - xx - zz, yz + wx, 0, xz + wy, yz - wx, 1 - xx - yy, 0, 0, 0, 0, 1];
}
function mul(a, b) {
  const o = new Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

// Transformation.getMatrix: translation, left rotation, scale, right rotation (column-major)
export function transformationMatrix(tr) {
  let m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tr.t[0], tr.t[1], tr.t[2], 1];
  m = mul(m, quatMatrix(tr.l));
  m = mul(m, [tr.s[0], 0, 0, 0, 0, tr.s[1], 0, 0, 0, 0, tr.s[2], 0, 0, 0, 0, 1]);
  return mul(m, quatMatrix(tr.r));
}

// DisplayRenderer.calculateOrientation: rotationYXZ(-yaw, pitch, 0) where each angle comes from the entity or the
// camera depending on the billboard constraint (camera yaw - 180, -camera pitch)
export function billboardAngles(billboard, entityYaw, entityPitch, cameraYaw, cameraPitch) {
  const camY = cameraYaw - 180, camX = -cameraPitch;
  switch (BILLBOARD[billboard] || 'fixed') {
    case 'vertical': return [camY, entityPitch];
    case 'horizontal': return [entityYaw, camX];
    case 'center': return [camY, camX];
    default: return [entityYaw, entityPitch];
  }
}

// Quaternionf.rotationYXZ(-yaw, pitch, 0) as a column-major matrix
export function orientationMatrix(yawDeg, pitchDeg) {
  const y = -yawDeg * Math.PI / 180, x = pitchDeg * Math.PI / 180;
  const sy = Math.sin(y / 2), cy = Math.cos(y / 2), sx = Math.sin(x / 2), cx = Math.cos(x / 2);
  // q = qY * qX
  return quatMatrix([cy * sx, sy * cx, -sy * sx, cy * cx]);
}

export function multiply(a, b) { return mul(a, b); }

// TextDisplay style flags
export function textStyle(flags) {
  return { shadow: (flags & 1) !== 0, seeThrough: (flags & 2) !== 0, defaultBackground: (flags & 4) !== 0, align: flags & 8 ? 'left' : flags & 16 ? 'right' : 'center' };
}
