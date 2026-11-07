// Port of `client/js/game/squid-animation.js`.
//
// Squid.aiStep, client branch. The server owns movement and sends status 19
// when a cycle completes; clients clamp rather than wrapping independently.
//
// The JS keeps `f = Math.fround` around every operation to reproduce the
// float32 rounding of the vanilla code; each `f(...)` here is an explicit
// `f32` round-trip.

use crate::jrandom::JavaRandom;
use crate::math as mat4;
use crate::physics::mc_sin;

/// JS: `const f=Math.fround` — round a value through float32.
#[inline]
fn f32_round(v: f64) -> f64 {
    v as f32 as f64
}

/// JS: `const PI=f(Math.PI)`.
const PI: f64 = std::f32::consts::PI as f64;
/// JS: `const TAU=f(Math.PI*2)`.
const TAU: f64 = (std::f32::consts::PI * 2.0) as f64;
/// JS: `const RAD=Math.PI/180`.
const RAD: f64 = std::f64::consts::PI / 180.0;

/// JS: the mutable `e.squid` state object.
#[derive(Debug, Clone, Copy)]
pub struct SquidState {
    pub phase: f32,
    pub speed: f32,
    pub tentacle: f32,
    pub old_tentacle: f32,
    pub x_rot: f32,
    pub old_x_rot: f32,
    pub z_rot: f32,
    pub old_z_rot: f32,
    pub rotate_speed: f32,
}

impl Default for SquidState {
    fn default() -> Self {
        SquidState {
            phase: 0.0,
            speed: 0.0,
            tentacle: 0.0,
            old_tentacle: 0.0,
            x_rot: 0.0,
            old_x_rot: 0.0,
            z_rot: 0.0,
            old_z_rot: 0.0,
            rotate_speed: 0.0,
        }
    }
}

/// The entity surface the squid functions read and write. The JS mutates
/// `e.*` directly; the host maps these onto its entity type.
pub trait SquidEntity {
    /// JS: `e.kind === 'mob'`.
    fn kind(&self) -> &str;
    /// JS: `e.type === 94 || e.entityName === 'glow_squid'`.
    fn type_id(&self) -> i32;
    fn entity_name(&self) -> &str;
    /// JS: `e.id` (the JavaRandom seed).
    fn id(&self) -> i64;
    /// JS: `e.squid` read/write.
    fn squid(&self) -> Option<SquidState>;
    fn set_squid(&mut self, s: SquidState);
    /// JS: `e.motionX || 0` etc.
    fn motion(&self) -> (f64, f64, f64);
    /// JS: `e.bodyYaw || 0` read/write.
    fn body_yaw(&self) -> f64;
    fn set_body_yaw(&mut self, v: f64);
    /// JS: `e.yaw` write.
    fn set_yaw(&mut self, v: f64);
    /// JS: `e.ticks || 0`.
    fn ticks(&self) -> i64;
    /// JS: `e.width || .8`, `e.height || .8`.
    fn width(&self) -> f64;
    fn height(&self) -> f64;
    /// JS: `e.x, e.y, e.z`.
    fn pos(&self) -> (f64, f64, f64);
}

/// JS: `export const isSquid=e=>e.kind==='mob'&&(e.type===94||e.entityName==='glow_squid');`
pub fn is_squid(e: &dyn SquidEntity) -> bool {
    e.kind() == "mob" && (e.type_id() == 94 || e.entity_name() == "glow_squid")
}

/// JS: `export function initSquid(e)`.
pub fn init_squid(e: &mut dyn SquidEntity) {
    // JS: const random=new JavaRandom(e.id);
    let mut random = JavaRandom::new(e.id() as u32);
    // JS: e.squid={phase:0,speed:f(f(1/f(random.nextFloat()+1))*f(.2)),tentacle:0,oldTentacle:0,xRot:0,oldXRot:0,zRot:0,oldZRot:0,rotateSpeed:0};
    let speed = f32_round(f32_round(1.0 / f32_round(random.next_float() + 1.0)) * f32_round(0.2));
    e.set_squid(SquidState {
        phase: 0.0,
        speed: speed as f32,
        tentacle: 0.0,
        old_tentacle: 0.0,
        x_rot: 0.0,
        old_x_rot: 0.0,
        z_rot: 0.0,
        old_z_rot: 0.0,
        rotate_speed: 0.0,
    });
}

/// JS: `export function tickSquid(e,inWater)`.
pub fn tick_squid(e: &mut dyn SquidEntity, in_water: bool) {
    // JS: if(!e.squid)initSquid(e);
    if e.squid().is_none() {
        init_squid(e);
    }
    let mut s = e.squid().unwrap_or_default();
    // JS: const s=e.squid;s.oldTentacle=s.tentacle;s.oldXRot=s.xRot;s.oldZRot=s.zRot;
    s.old_tentacle = s.tentacle;
    s.old_x_rot = s.x_rot;
    s.old_z_rot = s.z_rot;
    // JS: s.phase=f(s.phase+s.speed);if(s.phase>Math.PI*2)s.phase=TAU;
    s.phase = f32_round(s.phase as f64 + s.speed as f64) as f32;
    if s.phase as f64 > std::f64::consts::PI * 2.0 {
        s.phase = TAU as f32;
    }
    if in_water {
        // JS: if(s.phase<PI){const t=f(s.phase/PI);s.tentacle=f(f(mcSin(f(f(t*t)*PI))*PI)*f(.25));
        //      s.rotateSpeed=t>.75?1:f(s.rotateSpeed*f(.8));}
        if (s.phase as f64) < PI {
            let t = f32_round(s.phase as f64 / PI);
            s.tentacle = f32_round(f32_round(mc_sin(f32_round(f32_round(t * t) * PI) as f32) as f64 * PI) * f32_round(0.25)) as f32;
            s.rotate_speed = if t > 0.75 { 1.0 } else { f32_round(s.rotate_speed as f64 * f32_round(0.8)) as f32 };
        } else {
            // JS: else{s.tentacle=0;s.rotateSpeed=f(s.rotateSpeed*f(.99));}
            s.tentacle = 0.0;
            s.rotate_speed = f32_round(s.rotate_speed as f64 * f32_round(0.99)) as f32;
        }
        // JS: const mx=e.motionX||0,my=e.motionY||0,mz=e.motionZ||0;
        let (mx, my, mz) = e.motion();
        // JS: e.bodyYaw=f(f(e.bodyYaw||0)+f(f(f(-f(Math.atan2(mx,mz)))*f(57.295776)-f(e.bodyYaw||0))*f(.1)));
        let body = e.body_yaw();
        e.set_body_yaw(f32_round(f32_round(body) + f32_round(f32_round(f32_round(-f32_round(mx.atan2(mz))) * f32_round(57.295776) - f32_round(body)) * f32_round(0.1))));
        // JS: e.yaw=e.bodyYaw;
        e.set_yaw(e.body_yaw());
        // JS: s.zRot=f(s.zRot+Math.PI*s.rotateSpeed*1.5);
        s.z_rot = f32_round(s.z_rot as f64 + std::f64::consts::PI * s.rotate_speed as f64 * 1.5) as f32;
        // JS: s.xRot=f(s.xRot+f(f(f(-f(Math.atan2(Math.hypot(mx,mz),my)))*f(57.295776)-s.xRot)*f(.1)));
        s.x_rot = f32_round(s.x_rot as f64 + f32_round(f32_round(f32_round(-f32_round((mx.hypot(mz)).atan2(my))) * f32_round(57.295776) - s.x_rot as f64) * f32_round(0.1))) as f32;
    } else {
        // JS: else{s.tentacle=f(f(Math.abs(mcSin(s.phase))*PI)*f(.25));s.xRot=f(s.xRot+f(-90-s.xRot)*.02);}
        s.tentacle = f32_round(f32_round(mc_sin(s.phase).abs() as f64 * PI) * f32_round(0.25)) as f32;
        s.x_rot = f32_round(s.x_rot as f64 + f32_round(-90.0 - s.x_rot as f64) * 0.02) as f32;
    }
    e.set_squid(s);
}

/// JS: `export function squidTentacle(e,partial)`.
pub fn squid_tentacle(e: &dyn SquidEntity, partial: f64) -> f64 {
    // JS: const s=e.squid;return s?s.oldTentacle+(s.tentacle-s.oldTentacle)*partial:0;
    match e.squid() {
        Some(s) => s.old_tentacle as f64 + (s.tentacle - s.old_tentacle) as f64 * partial,
        None => 0.0,
    }
}

/// JS: `export function squidMatrix(e,bodyYaw,partial)` — returns the 16-float
/// matrix (JS `mat4.create()` layout matches `crate::math`).
pub fn squid_matrix(e: &dyn SquidEntity, body_yaw: f64, partial: f64) -> [f32; 16] {
    // JS: const s=e.squid,m=mat4.create();mat4.translate(m,m,0,.5,0);mat4.rotateY(m,m,(180-bodyYaw)*RAD);
    let s = e.squid();
    let mut m = crate::math::identity_matrix();
    m = mat4::translate(&m, 0.0, 0.5, 0.0);
    m = mat4::rotate(&m, (180.0 - body_yaw) * RAD, 0.0, 1.0, 0.0);
    if let Some(s) = s {
        // JS: mat4.rotateX(m,m,(s.oldXRot+(s.xRot-s.oldXRot)*partial)*RAD);
        //      mat4.rotateY(m,m,(s.oldZRot+(s.zRot-s.oldZRot)*partial)*RAD);
        let xr = (s.old_x_rot as f64 + (s.x_rot - s.old_x_rot) as f64 * partial) * RAD;
        m = mat4::rotate(&m, xr, 1.0, 0.0, 0.0);
        let zr = (s.old_z_rot as f64 + (s.z_rot - s.old_z_rot) as f64 * partial) * RAD;
        m = mat4::rotate(&m, zr, 0.0, 1.0, 0.0);
    }
    // JS: mat4.translate(m,m,0,-f(1.2),0);return m;
    m = mat4::translate(&m, 0.0, -f32_round(1.2), 0.0);
    m
}

/// The fluid/world surface `squidInWater` needs.
pub trait SquidWorld {
    /// JS: `isPointInFluid(world, x, y, z)`.
    fn is_point_in_fluid(&self, x: i32, y: f64, z: i32) -> bool;
}

/// JS: `export function squidInWater(e,world)`.
pub fn squid_in_water(e: &dyn SquidEntity, world: &dyn SquidWorld) -> bool {
    let (ex, ey, ez) = e.pos();
    // JS: const half=(e.width||.8)/2,lo=e.y+.001,hi=e.y+(e.height||.8)-.001;
    let half = (if e.width() != 0.0 { e.width() } else { 0.8 }) / 2.0;
    let lo = ey + 0.001;
    let hi = ey + (if e.height() != 0.0 { e.height() } else { 0.8 }) - 0.001;
    // JS: for(let x=Math.floor(e.x-half+.001);x<Math.ceil(e.x+half-.001);x++)
    //      for(let z=Math.floor(e.z-half+.001);z<Math.ceil(e.z+half-.001);z++)
    //       for(let y=Math.floor(lo);y<Math.ceil(hi);y++)
    //        if(isPointInFluid(world,x,Math.max(y,lo),z))return true;
    let mut x = (ex - half + 0.001).floor() as i32;
    while (x as f64) < (ex + half - 0.001).ceil() {
        let mut z = (ez - half + 0.001).floor() as i32;
        while (z as f64) < (ez + half - 0.001).ceil() {
            let mut y = lo.floor() as i32;
            while (y as f64) < hi.ceil() {
                if world.is_point_in_fluid(x, (y as f64).max(lo), z) {
                    return true;
                }
                y += 1;
            }
            z += 1;
        }
        x += 1;
    }
    // JS: return false;
    false
}
