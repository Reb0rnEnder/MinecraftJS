// EntityWolf / Wolf client animation: the begging head tilt, the wet state and the shake started by entity event 8,
// with WolfModel's head/upper body/body/tail roll and RenderWolf's wet darkening.
// NATIVE per version:
//   aliveGuard  - 1.14+: Wolf.tick returns early unless the wolf is alive
//   cancelEvent - 1.16+: entity event 56 cancels the shake and being wet no longer resets it on the client
//   brightness  - before 1.16 the wet shade is multiplied by Entity.getBrightness
//   collarShade - 1.15+: the shade tints the model, so the collar layer drawn through it darkens too
//   shade       - [base, scale] of base + lerp(shake) / 2 * scale (0.5/0.5 in 1.16-1.19, else 0.75/0.25)
export const NATIVE = { aliveGuard: true, cancelEvent: true, brightness: false, collarShade: true, shade: [0.5, 0.5] };
const f32 = Math.fround;

export function tickWolfShake(e, wetNow, splash) {
  if (NATIVE.aliveGuard && e.health !== undefined && e.health <= 0) return;
  const ia = e.interestedAngle || 0;
  e.interestedAngleO = ia;
  e.interestedAngle = f32(ia + f32(f32((e.begging ? 1 : 0) - ia) * f32(0.4)));
  if (wetNow) {
    e.isWet = true;
    if (!NATIVE.cancelEvent) { e.shaking = false; e.shakeAnim = 0; e.shakeAnimO = 0; }
    return;
  }
  if (!e.shaking) return;
  e.shakeAnim = e.shakeAnim || 0;
  e.shakeAnimO = e.shakeAnim;
  e.shakeAnim = f32(e.shakeAnim + f32(0.05));
  if (e.shakeAnimO >= 2) { e.isWet = false; e.shaking = false; e.shakeAnimO = 0; e.shakeAnim = 0; }
  if (e.shakeAnim > 0.4 && splash) {
    const n = Math.trunc(f32(Math.sin(f32(f32(e.shakeAnim - f32(0.4)) * f32(Math.PI))) * 7));
    const w = e.width || 0.6;
    for (let i = 0; i < n; i++) splash((Math.random() * 2 - 1) * w * 0.5, (Math.random() * 2 - 1) * w * 0.5);
  }
}

// handleStatusUpdate / handleEntityEvent; true when the event was the wolf's own
export function wolfShakeEvent(e, status) {
  if (status === 8) { e.shaking = true; e.shakeAnim = 0; e.shakeAnimO = 0; return true; }
  if (NATIVE.cancelEvent && status === 56) { e.shaking = false; e.shakeAnim = 0; e.shakeAnimO = 0; return true; }
  return false;
}

const lerp = (p, a, b) => a + p * (b - a);
// getInterestedAngle / getHeadRollAngle
export function wolfHeadRoll(e, p) { return f32(f32(lerp(p, e.interestedAngleO || 0, e.interestedAngle || 0)) * f32(0.15) * f32(Math.PI)); }
// getShakeAngle / getBodyRollAngle
export function wolfBodyRoll(e, p, offset) {
  let t = f32(f32(lerp(p, e.shakeAnimO || 0, e.shakeAnim || 0) + offset) / f32(1.8));
  t = Math.min(1, Math.max(0, t));
  return f32(f32(Math.sin(f32(t * f32(Math.PI))) * Math.sin(f32(t * f32(Math.PI) * 11))) * f32(0.15) * f32(Math.PI));
}
// getShadingWhileWet / getWetShade (times getBrightness before 1.16); 1 when dry
export function wolfWetShade(e, p, brightness = 1) {
  if (!e.isWet) return 1;
  const shade = f32(f32(NATIVE.shade[0]) + f32(f32(lerp(p, e.shakeAnimO || 0, e.shakeAnim || 0)) / 2) * f32(NATIVE.shade[1]));
  return NATIVE.brightness ? f32(brightness * shade) : Math.min(shade, 1);
}
