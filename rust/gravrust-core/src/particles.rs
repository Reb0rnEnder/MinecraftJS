//! Port of `client/js/render/particles.js` algorithmic core.
//!
//! This module contains the pure particle physics, lifetime management,
//! and factory functions. Browser-bound parts (WebGL batching, texture
//! lookups, rendering) remain in JavaScript.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::jrandom::JavaRandom;
use crate::physics::{calc_x_offset, calc_y_offset, calc_z_offset};

// ============================================================================
// Constants and configuration
// ============================================================================

const MAX_PARTICLES: usize = 4000;
const SIMPLE_SPRITES: &[(i32, &str)] = &[
    (0, "mycelium"),
    (32, "bubble"),
    (48, "flame"),
    (49, "lava"),
    (64, "note"),
    (65, "crit"),
    (66, "enchanted_hit"),
    (80, "heart"),
    (81, "angry_villager"),
    (82, "happy_villager"),
    (112, "falling_water"),
    (113, "dripping_water"),
];

// ============================================================================
// Particle data structures (plain Rust, not wasm_bindgen)
// ============================================================================

/// Core particle state that gets ticked every frame.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Particle {
    // Position
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub prev_x: f64,
    pub prev_y: f64,
    pub prev_z: f64,

    // Motion
    pub mx: f64,
    pub my: f64,
    pub mz: f64,

    // Lifetime
    pub age: i32,
    pub max_age: i32,

    // Visual
    pub scale: f64,
    pub r: f64,
    pub g: f64,
    pub b: f64,
    pub a: f64,

    // Physics
    pub gravity: f64,
    pub drag: f64,
    pub collide: bool,
    pub on_ground: bool,

    // Optional extended properties
    pub sprite: Option<String>,
    pub sprite_mode: Option<String>,
    pub atlas: Option<[f64; 4]>,
    pub explosion_frame: Option<i32>,
    pub tex: Option<i32>,
    pub full_bright: bool,
    pub footprint: bool,
    pub important: bool,
    pub invisible: bool,
    pub barrier: bool,
    pub barrier_key: Option<String>,

    // Custom behavior (stored as type tags for WASM)
    pub update_type: Option<ParticleUpdateType>,
    pub size_fn_type: Option<SizeFnType>,
    pub alpha_fn_type: Option<AlphaFnType>,
    pub tex_fn_type: Option<TexFnType>,

    // Extra data for specific particle types
    pub base_scale: Option<f64>,
    pub delay: Option<i32>,
    pub phase: Option<String>,
    pub sx: Option<f64>,
    pub sy: Option<f64>,
    pub sz: Option<f64>,
    pub fade: Option<[f64; 3]>,
    pub trail: bool,
    pub twinkle: bool,
}

impl Default for Particle {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            z: 0.0,
            prev_x: 0.0,
            prev_y: 0.0,
            prev_z: 0.0,
            mx: 0.0,
            my: 0.0,
            mz: 0.0,
            age: 0,
            max_age: 0,
            scale: 1.0,
            r: 1.0,
            g: 1.0,
            b: 1.0,
            a: 1.0,
            gravity: 0.0,
            drag: 0.98,
            collide: true,
            on_ground: false,
            sprite: None,
            sprite_mode: None,
            atlas: None,
            explosion_frame: None,
            tex: None,
            full_bright: false,
            footprint: false,
            important: false,
            invisible: false,
            barrier: false,
            barrier_key: None,
            update_type: None,
            size_fn_type: None,
            alpha_fn_type: None,
            tex_fn_type: None,
            base_scale: None,
            delay: None,
            phase: None,
            sx: None,
            sy: None,
            sz: None,
            fade: None,
            trail: false,
            twinkle: false,
        }
    }
}

/// Types of built-in update functions.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ParticleUpdateType {
    Default,
    Crit,
    Smoke,
    Flame,
    Lava,
    WaterDrop { splash: bool },
    Bubble,
    Spell,
    Portal,
    Enchant,
    Reddust,
    Drip { lava: bool },
    HoneyDrip,
    Poof,
    Spark,
    FireworkStarter,
    CampfireSmoke { signal: bool },
    FallingDrop { lava: bool, landing: bool },
    Native { kind: NativeParticleKind },
    SimpleRising,
}

/// Native particle kinds from `nativeParticle`.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NativeParticleKind {
    Flash,
    Sneeze,
    EndRod,
    TotemOfUndying,
    DamageIndicator,
    DragonBreath,
    Spit,
    SquidInk,
    SweepAttack,
    BubblePop,
    CurrentDown,
    BubbleColumnUp,
    Dolphin,
    Nautilus,
}

/// Size function types.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SizeFnType {
    Default,
    Crit,
    Flame,
    Lava,
    Portal,
    Enchant,
    Spark,
    Flash,
    CampfireSmoke,
    FallingDrop,
    HoneyDrip,
    Native { kind: NativeParticleKind },
}

/// Alpha function types.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AlphaFnType {
    Default,
    Spark,
    Flash,
    CampfireSmoke,
}

/// Texture function types.
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TexFnType {
    Default,
    Smoke,
    Spell { instant: bool, witch: bool },
    Poof,
    Spark,
    Reddust,
    Drip { lava: bool },
    HoneyDrip,
    Native { kind: NativeParticleKind },
    SimpleRising,
}

/// Particle emitter for crit/magicCrit effects.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticleEmitter {
    pub entity_x: f64,
    pub entity_y: f64,
    pub entity_z: f64,
    pub entity_width: f64,
    pub entity_height: f64,
    pub magic: bool,
    pub age: i32,
}

/// Explosion emitter for huge explosions.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExplosionEmitter {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub age: i32,
}

// ============================================================================
// Random number generation (matches JS Math.random behavior)
// ============================================================================

/// A fast RNG that mimics JS's Math.random() for deterministic porting.
/// Uses a simple xorshift64* algorithm.
pub struct JsRandom {
    state: u64,
}

impl JsRandom {
    pub fn new(seed: Option<u64>) -> JsRandom {
        JsRandom {
            state: seed.unwrap_or_else(|| {
                // Use a time-based seed if none provided
                // We can't use js_sys in core, so use a fixed seed + address randomization
                0x9e3779b97f4a7c15_u64.wrapping_mul(
                    std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .as_nanos() as u64
                )
            }),
        }
    }

    /// Returns a random f64 in [0, 1), matching Math.random().
    pub fn random(&mut self) -> f64 {
        self.state ^= self.state << 13;
        self.state ^= self.state >> 7;
        self.state ^= self.state << 17;
        (self.state as f64) / (u64::MAX as f64)
    }

    /// Returns a random f64 in [-1, 1).
    pub fn random_signed(&mut self) -> f64 {
        self.random() * 2.0 - 1.0
    }

    /// Gaussian random using Box-Muller transform (matches JS gauss()).
    pub fn gauss(&mut self) -> f64 {
        let mut u = 0.0;
        let mut v = 0.0;
        while u == 0.0 {
            u = self.random();
        }
        while v == 0.0 {
            v = self.random();
        }
        (-2.0 * u.ln()).sqrt() * (2.0 * std::f64::consts::PI * v).cos()
    }
}

// ============================================================================
// Core physics: move_particle (ported from particle-collision.js)
// ============================================================================

/// Internal helper: move a particle with collision against a list of AABBs.
/// Boxes are flattened: [x0, y0, z0, x1, y1, z1, ...]
fn move_particle_internal(
    x: f64,
    y: f64,
    z: f64,
    motion_x: f64,
    motion_y: f64,
    motion_z: f64,
    width: f64,
    height: f64,
    collide: bool,
    boxes: &[f64],
) -> (f64, f64, f64, f64, f64, f64, bool) {
    let dx = if motion_x == 0.0 { 0.0 } else { motion_x };
    let dy = if motion_y == 0.0 { 0.0 } else { motion_y };
    let dz = if motion_z == 0.0 { 0.0 } else { motion_z };

    if !collide {
        return (x + dx, y + dy, z + dz, motion_x, motion_y, motion_z, false);
    }

    let radius = width / 2.0;
    let mut bb = [
        x - radius,
        y,
        z - radius,
        x + radius,
        y + height,
        z + radius,
    ];

    let mut move_x = dx;
    let mut move_y = dy;
    let mut move_z = dz;

    // Y axis first
    for chunk in boxes.chunks_exact(6) {
        move_y = calc_y_offset(chunk, &bb, move_y);
    }
    bb[1] += move_y;
    bb[4] += move_y;

    // X axis
    for chunk in boxes.chunks_exact(6) {
        move_x = calc_x_offset(chunk, &bb, move_x);
    }
    bb[0] += move_x;
    bb[3] += move_x;

    // Z axis
    for chunk in boxes.chunks_exact(6) {
        move_z = calc_z_offset(chunk, &bb, move_z);
    }
    bb[2] += move_z;
    bb[5] += move_z;

    let on_ground = dy < 0.0 && move_y != dy;
    let out_motion_x = if move_x != dx { 0.0 } else { motion_x };
    let out_motion_y = if move_y != dy { 0.0 } else { motion_y };
    let out_motion_z = if move_z != dz { 0.0 } else { motion_z };

    let new_x = (bb[0] + bb[3]) / 2.0;
    let new_y = bb[1];
    let new_z = (bb[2] + bb[5]) / 2.0;

    (new_x, new_y, new_z, out_motion_x, out_motion_y, out_motion_z, on_ground)
}

/// WASM export for particle collision (used by JS fallback too).
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn particle_move(
    x: f64,
    y: f64,
    z: f64,
    motion_x: f64,
    motion_y: f64,
    motion_z: f64,
    width: f64,
    height: f64,
    collide: bool,
    boxes: &[f64],
) -> Vec<f64> {
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) =
        move_particle_internal(x, y, z, motion_x, motion_y, motion_z, width, height, collide, boxes);
    vec![nx, ny, nz, nmx, nmy, nmz, if on_ground { 1.0 } else { 0.0 }]
}

// ============================================================================
// Particle update functions (the `update` closures from JS)
// ============================================================================

fn update_default(p: &mut Particle, boxes: &[f64]) {
    p.my -= 0.04 * p.gravity;
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    p.mx *= p.drag;
    p.my *= p.drag;
    p.mz *= p.drag;
    if p.on_ground {
        p.mx *= 0.7;
        p.mz *= 0.7;
    }
}

fn update_crit(p: &mut Particle, boxes: &[f64]) {
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    p.g *= 0.96;
    p.b *= 0.9;
    p.mx *= 0.7;
    p.my *= 0.7;
    p.mz *= 0.7;
    p.my -= 0.02;
    if p.on_ground {
        p.mx *= 0.7;
        p.mz *= 0.7;
    }
}

fn update_smoke(p: &mut Particle, boxes: &[f64]) {
    p.my += 0.004;
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    if p.y == p.prev_y {
        p.mx *= 1.1;
        p.mz *= 1.1;
    }
    p.mx *= 0.96;
    p.my *= 0.96;
    p.mz *= 0.96;
    if p.on_ground {
        p.mx *= 0.7;
        p.mz *= 0.7;
    }
}

fn update_flame(p: &mut Particle, boxes: &[f64]) {
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    p.mx *= 0.96;
    p.my *= 0.96;
    p.mz *= 0.96;
}

fn update_lava(p: &mut Particle, boxes: &[f64], rng: &mut JsRandom) -> Option<Particle> {
    // Spawn smoke occasionally
    let new_smoke = if rng.random() > p.age as f64 / p.max_age as f64 {
        Some(create_smoke_particle(p.x, p.y, p.z, p.mx, p.my, p.mz, 1.0, rng))
    } else {
        None
    };

    p.my -= 0.03;
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    p.mx *= 0.999;
    p.my *= 0.999;
    p.mz *= 0.999;
    if p.on_ground {
        p.mx *= 0.7;
        p.mz *= 0.7;
    }
    new_smoke
}

fn update_water_drop(p: &mut Particle, boxes: &[f64], splash: bool, rng: &mut JsRandom) -> bool {
    p.my -= if splash { 0.04 } else { 0.06 };
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    p.mx *= 0.98;
    p.my *= 0.98;
    p.mz *= 0.98;

    if p.on_ground {
        // 50% chance to die on landing
        if rng.random() < 0.5 {
            return false;
        }
        p.mx *= 0.7;
        p.mz *= 0.7;
    }
    true
}

fn update_bubble(p: &mut Particle, boxes: &[f64], in_fluid: bool) -> bool {
    if !in_fluid {
        return false;
    }
    p.my += 0.002;
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    p.mx *= 0.85;
    p.my *= 0.85;
    p.mz *= 0.85;
    true
}

fn update_spell(p: &mut Particle, boxes: &[f64]) {
    p.my += 0.004;
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    if p.y == p.prev_y {
        p.mx *= 1.1;
        p.mz *= 1.1;
    }
    p.mx *= 0.96;
    p.my *= 0.96;
    p.mz *= 0.96;
    if p.on_ground {
        p.mx *= 0.7;
        p.mz *= 0.7;
    }
}

fn update_portal(p: &mut Particle) {
    if let (Some(sx), Some(sy), Some(sz)) = (p.sx, p.sy, p.sz) {
        let f2 = p.age as f64 / p.max_age as f64;
        let f3 = f2;
        let f2 = -f2 + f2 * f2 * 2.0;
        let f2 = 1.0 - f2;
        p.x = sx + p.mx * f2;
        p.y = sy + p.my * f2 + (1.0 - f3);
        p.z = sz + p.mz * f2;
    }
}

fn update_enchant(p: &mut Particle) {
    if let (Some(sx), Some(sy), Some(sz)) = (p.sx, p.sy, p.sz) {
        let f2 = p.age as f64 / p.max_age as f64;
        let f2 = 1.0 - f2;
        let mut f3 = 1.0 - f2;
        f3 *= f3;
        f3 *= f3;
        p.x = sx + p.mx * f2;
        p.y = sy + p.my * f2 - f3 * 1.2;
        p.z = sz + p.mz * f2;
    }
}

fn update_reddust(p: &mut Particle, boxes: &[f64]) {
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    if p.y == p.prev_y {
        p.mx *= 1.1;
        p.mz *= 1.1;
    }
    p.mx *= 0.96;
    p.my *= 0.96;
    p.mz *= 0.96;
}

fn update_drip(p: &mut Particle, boxes: &[f64], lava: bool, rng: &mut JsRandom) -> (bool, Option<Particle>) {
    let mut new_particle = None;
    let mut alive = true;

    if let Some(delay) = p.delay {
        if delay > 0 {
            p.delay = Some(delay - 1);
            p.mx *= 0.02;
            p.my *= 0.02;
            p.mz *= 0.02;
            p.tex = Some(113);
        } else {
            p.sprite = Some(if lava { "falling_lava" } else { "falling_water" }.to_string());
            p.tex = Some(112);
            p.my -= 0.06 * 0.5;
            p.delay = None;
        }
    }

    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    p.mx *= 0.98;
    p.my *= 0.98;
    p.mz *= 0.98;

    if p.on_ground {
        if !lava {
            new_particle = Some(create_splash_particle(p.x, p.y, p.z, 0.0, 0.0, 0.0, rng));
        }
        alive = false;
    }

    (alive, new_particle)
}

fn update_honey_drip(p: &mut Particle, boxes: &[f64], rng: &mut JsRandom) -> (bool, Option<Particle>) {
    let mut new_particle = None;
    let mut alive = true;

    match p.phase.as_deref() {
        Some("landing") => {
            alive = true; // landing particles just fade out
        }
        Some("dripping") => {
            if p.age >= 100 {
                p.phase = Some("falling".to_string());
                p.sprite = Some("falling_honey".to_string());
                p.age = 0;
                p.max_age = ((64.0 / (rng.random() * 0.8 + 0.2)).floor()) as i32;
                p.r = 0.582;
                p.g = 0.448;
                p.b = 0.082;
            } else {
                p.my -= 0.06 * 0.02 * 0.01; // fround chain from JS
                let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
                    p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
                );
                p.x = nx;
                p.y = ny;
                p.z = nz;
                p.mx = nmx * 0.02;
                p.my = nmy * 0.02;
                p.mz = nmz * 0.02;
                p.on_ground = on_ground;
            }
        }
        Some("falling") => {
            p.my -= 0.01;
            let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
                p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
            );
            p.x = nx;
            p.y = ny;
            p.z = nz;
            p.mx = nmx;
            p.my = nmy;
            p.mz = nmz;
            p.on_ground = on_ground;
            p.mx *= 0.98;
            p.my *= 0.98;
            p.mz *= 0.98;
            if p.on_ground {
                p.phase = Some("landing".to_string());
                p.sprite = Some("landing_honey".to_string());
                p.age = 0;
                p.max_age = ((128.0 / (rng.random() * 0.8 + 0.2)).floor()) as i32;
                p.r = 0.522;
                p.g = 0.408;
                p.b = 0.082;
                p.mx = 0.0;
                p.my = 0.0;
                p.mz = 0.0;
                // Sound would be played by JS
            }
        }
        _ => {}
    }

    (alive, new_particle)
}

fn update_poof(p: &mut Particle, boxes: &[f64]) {
    p.my += 0.004;
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    p.mx *= 0.9;
    p.my *= 0.9;
    p.mz *= 0.9;
    if p.on_ground {
        p.mx *= 0.7;
        p.mz *= 0.7;
    }
}

fn update_spark(p: &mut Particle, boxes: &[f64]) {
    let half = p.max_age / 2;
    if p.age > half {
        p.a = 1.0 - (p.age - half) as f64 / p.max_age as f64;
        if let Some(fade) = p.fade {
            p.r += (fade[0] - p.r) * 0.2;
            p.g += (fade[1] - p.g) * 0.2;
            p.b += (fade[2] - p.b) * 0.2;
        }
    }
    p.my += -0.004;
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    p.mx *= 0.91;
    p.my *= 0.91;
    p.mz *= 0.91;
    if p.on_ground {
        p.mx *= 0.7;
        p.mz *= 0.7;
    }
    // Trail spawning handled by JS caller
}

fn update_firework_starter(_p: &mut Particle) -> bool {
    // This is a special emitter particle that spawns fireworks
    // Returns false when done
    true // Handled by JS
}

fn update_campfire_smoke(p: &mut Particle, boxes: &[f64], rng: &mut JsRandom) -> bool {
    p.mx += (rng.random() / 5000.0) * if rng.random() < 0.5 { 1.0 } else { -1.0 };
    p.mz += (rng.random() / 5000.0) * if rng.random() < 0.5 { 1.0 } else { -1.0 };
    p.my -= 0.000003;
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    if p.age >= p.max_age - 60 {
        p.a -= 0.015;
    }
    p.a > 0.0
}

fn update_falling_drop(p: &mut Particle, boxes: &[f64], lava: bool, rng: &mut JsRandom) -> (bool, Option<Particle>) {
    let mut new_particle = None;
    let mut alive = true;

    if p.phase.as_deref() == Some("landing") {
        alive = false;
    } else {
        p.my -= 0.06;
        let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
            p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
        );
        p.x = nx;
        p.y = ny;
        p.z = nz;
        p.mx = nmx;
        p.my = nmy;
        p.mz = nmz;
        p.on_ground = on_ground;
        p.mx *= 0.98;
        p.my *= 0.98;
        p.mz *= 0.98;

        if p.on_ground {
            if lava {
                new_particle = Some(create_falling_drop_particle(p.x, p.y, p.z, true, true, rng));
            } else {
                new_particle = Some(create_splash_particle(p.x, p.y, p.z, 0.0, 0.0, 0.0, rng));
            }
            alive = false;
        }
    }

    (alive, new_particle)
}

fn update_simple_rising(p: &mut Particle, boxes: &[f64]) {
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    if p.y == p.prev_y {
        p.mx *= 1.1;
        p.mz *= 1.1;
    }
    p.mx *= 0.86;
    p.my *= 0.86;
    p.mz *= 0.86;
}

fn update_native(p: &mut Particle, boxes: &[f64]) {
    let (nx, ny, nz, nmx, nmy, nmz, on_ground) = move_particle_internal(
        p.x, p.y, p.z, p.mx, p.my, p.mz, 0.2, 0.2, p.collide, boxes,
    );
    p.x = nx;
    p.y = ny;
    p.z = nz;
    p.mx = nmx;
    p.my = nmy;
    p.mz = nmz;
    p.on_ground = on_ground;
    p.mx *= p.drag;
    p.my *= p.drag;
    p.mz *= p.drag;
    if p.on_ground {
        p.mx *= 0.7;
        p.mz *= 0.7;
    }
}

// ============================================================================
// Size function evaluation
// ============================================================================

fn eval_size_fn(p: &Particle, partial: f64, fn_type: SizeFnType) -> f64 {
    match fn_type {
        SizeFnType::Default => 0.1 * p.scale,
        SizeFnType::Crit => {
            if let Some(base) = p.base_scale {
                let f = (p.age as f64 + partial) / p.max_age as f64 * 32.0;
                base * f.clamp(0.0, 1.0)
            } else {
                0.1 * p.scale
            }
        }
        SizeFnType::Flame => {
            if let Some(base) = p.base_scale {
                let f = (p.age as f64 + partial) / p.max_age as f64;
                base * (1.0 - f * f * 0.5)
            } else {
                0.1 * p.scale
            }
        }
        SizeFnType::Lava => {
            if let Some(base) = p.base_scale {
                let f = (p.age as f64 + partial) / p.max_age as f64;
                base * (1.0 - f * f)
            } else {
                0.1 * p.scale
            }
        }
        SizeFnType::Portal => {
            if let Some(base) = p.base_scale {
                let mut f = (p.age as f64 + partial) / p.max_age as f64;
                f = 1.0 - f;
                f *= f;
                f = 1.0 - f;
                base * f * 2.0
            } else {
                0.1 * p.scale
            }
        }
        SizeFnType::Enchant => {
            if let Some(base) = p.base_scale {
                let f = (p.age as f64 + partial) / p.max_age as f64;
                let f2 = 1.0 - f;
                let mut f3 = 1.0 - f2;
                f3 *= f3;
                f3 *= f3;
                base * f2
            } else {
                0.1 * p.scale
            }
        }
        SizeFnType::Spark => 0.1 * p.scale,
        SizeFnType::Flash => {
            7.1 * ((p.age as f64 + partial - 1.0) * 0.25 * std::f64::consts::PI).sin() * 10.0
        }
        SizeFnType::CampfireSmoke => 0.1 * p.scale,
        SizeFnType::FallingDrop => 0.1 * p.scale,
        SizeFnType::HoneyDrip => 0.1 * p.scale,
        SizeFnType::Native { kind } => match kind {
            NativeParticleKind::Flash => {
                7.1 * ((p.age as f64 + partial - 1.0) * 0.25 * std::f64::consts::PI).sin() * 10.0
            }
            NativeParticleKind::SweepAttack => 10.0 * p.scale,
            _ => 0.1 * p.scale,
        },
    }
}

// ============================================================================
// Alpha function evaluation
// ============================================================================

fn eval_alpha_fn(p: &Particle, partial: f64, fn_type: AlphaFnType) -> f64 {
    match fn_type {
        AlphaFnType::Default => p.a * (1.0 - p.age as f64 / p.max_age as f64),
        AlphaFnType::Spark => {
            if p.twinkle && p.age >= p.max_age / 3 && ((p.age + p.max_age) / 3) % 2 != 0 {
                0.0
            } else {
                p.a
            }
        }
        AlphaFnType::Flash => {
            0.6 - (p.age as f64 + partial - 1.0) * 0.25 * 0.5
        }
        AlphaFnType::CampfireSmoke => p.a,
    }
}

// ============================================================================
// Texture function evaluation
// ============================================================================

fn eval_tex_fn(p: &Particle, fn_type: TexFnType) -> i32 {
    match fn_type {
        TexFnType::Default => p.tex.unwrap_or(0),
        TexFnType::Smoke => 7 - ((p.age * 8) as f64 / p.max_age as f64).floor() as i32,
        TexFnType::Spell { instant, witch: _ } => {
            let base = if instant { 144 } else { 128 };
            base + (7 - ((p.age * 8) as f64 / p.max_age as f64).floor() as i32)
        }
        TexFnType::Poof => ((7.0 - (p.age * 8) as f64 / p.max_age as f64).floor().max(0.0)) as i32,
        TexFnType::Spark => 160 + (8 - 1 - ((p.age * 8) as f64 / p.max_age as f64).floor() as i32),
        TexFnType::Reddust => 7 - ((p.age * 8) as f64 / p.max_age as f64).floor() as i32,
        TexFnType::Drip { lava: _ } => {
            if p.delay.unwrap_or(0) > 0 { 113 } else { 112 }
        }
        TexFnType::HoneyDrip => p.tex.unwrap_or(0),
        TexFnType::Native { kind } => match kind {
            NativeParticleKind::EndRod => 0,
            NativeParticleKind::TotemOfUndying => 0,
            NativeParticleKind::DragonBreath => 0,
            NativeParticleKind::SquidInk => 0,
            NativeParticleKind::CurrentDown => 0,
            NativeParticleKind::BubbleColumnUp => 0,
            NativeParticleKind::Dolphin => 0,
            NativeParticleKind::Nautilus => 0,
            _ => p.tex.unwrap_or(0),
        },
        TexFnType::SimpleRising => p.tex.unwrap_or(0),
    }
}

// ============================================================================
// Particle factory functions
// ============================================================================

fn apply_fx_randomization(p: &mut Particle, rng: &mut JsRandom) {
    p.mx += rng.random_signed() * 0.4;
    p.my += rng.random_signed() * 0.4;
    p.mz += rng.random_signed() * 0.4;

    let f = (rng.random() + rng.random() + 1.0) * 0.15;
    let f1 = (p.mx * p.mx + p.my * p.my + p.mz * p.mz).sqrt().max(1.0);
    p.mx = p.mx / f1 * f * 0.4;
    p.my = p.my / f1 * f * 0.4 + 0.1;
    p.mz = p.mz / f1 * f * 0.4;
}

fn create_base_particle(x: f64, y: f64, z: f64, rng: &mut JsRandom) -> Particle {
    let mut p = Particle {
        x,
        y,
        z,
        prev_x: x,
        prev_y: y,
        prev_z: z,
        ..Default::default()
    };
    apply_fx_randomization(&mut p, rng);
    p
}

pub fn create_crit_particle(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, magic: bool, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some(if magic { "enchanted_hit" } else { "crit" }.to_string());
    p.sprite_mode = Some("random".to_string());
    p.mx = p.mx * 0.1 + mx * 0.4;
    p.my = p.my * 0.1 + my * 0.4;
    p.mz = p.mz * 0.1 + mz * 0.4;
    let c = rng.random() * 0.30000001192092896 + 0.6000000238418579;
    p.r = c;
    p.g = c;
    p.b = c;
    if magic {
        p.r *= 0.3;
        p.g *= 0.8;
    }
    p.base_scale = Some((rng.random() * 0.5 + 0.5) * 2.0 * 0.75);
    p.scale = p.base_scale.unwrap();
    p.max_age = (6.0 / (rng.random() * 0.8 + 0.6)).floor() as i32;
    p.update_type = Some(ParticleUpdateType::Crit);
    p.size_fn_type = Some(SizeFnType::Crit);
    p
}

pub fn create_smoke_particle(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, scale_mul: f64, rng: &mut JsRandom) -> Particle {
    let mut p = Particle {
        x,
        y,
        z,
        prev_x: x,
        prev_y: y,
        prev_z: z,
        mx: mx + rng.random_signed() * 0.1 * 0.0,
        my,
        mz,
        ..Default::default()
    };
    p.mx = p.mx * 0.1 + mx;
    p.my = p.my * 0.1 + my;
    p.mz = p.mz * 0.1 + mz;
    let c = rng.random() * 0.3;
    p.r = c;
    p.g = c;
    p.b = c;
    p.sprite = Some(if scale_mul > 1.0 { "large_smoke" } else { "smoke" }.to_string());
    p.scale = (rng.random() * 0.5 + 0.5) * 2.0 * 0.75 * scale_mul;
    p.max_age = (8.0 / (rng.random() * 0.8 + 0.2) * scale_mul).floor() as i32;
    p.update_type = Some(ParticleUpdateType::Smoke);
    p.tex_fn_type = Some(TexFnType::Smoke);
    p
}

pub fn create_flame_particle(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.mx = mx * 0.01 + rng.random_signed() * 0.0;
    p.my = my * 0.01;
    p.mz = mz * 0.01;
    p.tex = Some(48);
    p.full_bright = true;
    p.base_scale = Some((rng.random() * 0.5 + 0.5) * 2.0);
    p.scale = p.base_scale.unwrap();
    p.max_age = ((8.0 / (rng.random() * 0.8 + 0.2)).floor() + 4.0) as i32;
    p.update_type = Some(ParticleUpdateType::Flame);
    p.size_fn_type = Some(SizeFnType::Flame);
    p.collide = false;
    p
}

pub fn create_lava_particle(x: f64, y: f64, z: f64, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.mx = rng.random_signed() * 0.4 * 0.8;
    p.my = rng.random() * 0.4 + 0.05;
    p.mz = rng.random_signed() * 0.4 * 0.8;
    p.tex = Some(49);
    p.full_bright = true;
    p.base_scale = Some((rng.random() * 2.0 + 0.2) * 1.0);
    p.scale = p.base_scale.unwrap();
    p.max_age = (16.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
    p.update_type = Some(ParticleUpdateType::Lava);
    p.size_fn_type = Some(SizeFnType::Lava);
    p
}

pub fn create_water_drop_particle(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, splash: bool, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some(if splash { "splash" } else { "rain" }.to_string());
    p.sprite_mode = Some("random".to_string());
    p.mx *= 0.3;
    p.my = rng.random() * 0.2 + 0.1;
    p.mz *= 0.3;
    if splash && my == 0.0 && (mx != 0.0 || mz != 0.0) {
        p.mx = mx;
        p.my = 0.1;
        p.mz = mz;
    }
    p.r = 1.0;
    p.g = 1.0;
    p.b = 1.0;
    p.max_age = (8.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
    p.update_type = Some(ParticleUpdateType::WaterDrop { splash });
    p
}

pub fn create_bubble_particle(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.tex = Some(32);
    p.mx = mx * 0.2 + rng.random_signed() * 0.02;
    p.my = my * 0.2 + rng.random_signed() * 0.02;
    p.mz = mz * 0.2 + rng.random_signed() * 0.02;
    p.scale = (rng.random() * 0.6 + 0.2) * 1.0;
    p.max_age = (8.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
    p.update_type = Some(ParticleUpdateType::Bubble);
    p
}

pub fn create_spell_particle(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, r: f64, g: f64, b: f64, instant: bool, witch: bool, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some(if witch { "witch" } else if instant { "instant_effect" } else { "effect" }.to_string());
    p.mx = mx;
    p.my = my * 0.2;
    p.mz = mz;
    if mx == 0.0 && mz == 0.0 {
        p.mx *= 0.1;
        p.mz *= 0.1;
    }
    p.scale = (rng.random() * 0.5 + 0.5) * 2.0 * 0.75;
    p.max_age = (8.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
    p.r = r;
    p.g = g;
    p.b = b;
    p.update_type = Some(ParticleUpdateType::Spell);
    p.tex_fn_type = Some(TexFnType::Spell { instant, witch });
    if witch {
        let f = rng.random() * 0.5 + 0.35;
        p.r = 1.0 * f;
        p.g = 0.0;
        p.b = 1.0 * f;
    }
    p
}

pub fn create_portal_particle(x: f64, y: f64, z: f64, _mx: f64, _my: f64, _mz: f64, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some("portal".to_string());
    p.sprite_mode = Some("random".to_string());
    p.collide = false;
    p.sx = Some(x);
    p.sy = Some(y);
    p.sz = Some(z);
    let f = rng.random() * 0.6 + 0.4;
    p.r = f * 0.9;
    p.g = f * 0.3;
    p.b = f;
    p.base_scale = Some(rng.random() * 0.2 + 0.5);
    p.scale = p.base_scale.unwrap();
    p.max_age = (rng.random() * 10.0).floor() as i32 + 40;
    p.update_type = Some(ParticleUpdateType::Portal);
    p.size_fn_type = Some(SizeFnType::Portal);
    p
}

pub fn create_enchant_particle(x: f64, y: f64, z: f64, _mx: f64, _my: f64, _mz: f64, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some("enchant".to_string());
    p.sprite_mode = Some("random".to_string());
    p.collide = false;
    p.sx = Some(x);
    p.sy = Some(y);
    p.sz = Some(z);
    let f = rng.random() * 0.6 + 0.4;
    p.r = f * 0.9;
    p.g = f * 0.9;
    p.b = f;
    p.base_scale = Some(rng.random() * 0.5 + 0.2);
    p.scale = p.base_scale.unwrap();
    p.max_age = (rng.random() * 10.0).floor() as i32 + 30;
    p.update_type = Some(ParticleUpdateType::Enchant);
    p.size_fn_type = Some(SizeFnType::Enchant);
    p
}

pub fn create_reddust_particle(x: f64, y: f64, z: f64, r: f64, g: f64, b: f64, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some("dust".to_string());
    let f = rng.random() * 0.4 + 0.6;
    p.mx = rng.random_signed() * 0.1 * 0.1;
    p.my = rng.random_signed() * 0.1 * 0.1;
    p.mz = rng.random_signed() * 0.1 * 0.1;
    p.r = (rng.random() * 0.2 + 0.8) * r * f;
    p.g = (rng.random() * 0.2 + 0.8) * g * f;
    p.b = (rng.random() * 0.2 + 0.8) * b * f;
    p.scale = (rng.random() * 0.5 + 0.5) * 2.0 * 0.75;
    p.max_age = (8.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
    p.update_type = Some(ParticleUpdateType::Reddust);
    p.tex_fn_type = Some(TexFnType::Reddust);
    p
}

pub fn create_drip_particle(x: f64, y: f64, z: f64, lava: bool, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some(if lava { "dripping_lava" } else { "dripping_water" }.to_string());
    p.mx = 0.0;
    p.my = 0.0;
    p.mz = 0.0;
    p.tex = Some(113);
    p.scale = 1.0;
    p.max_age = (64.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
    p.r = if lava { 1.0 } else { 0.0 };
    p.g = if lava { 0.2 } else { 0.0 };
    p.b = if lava { 0.0 } else { 1.0 };
    p.delay = Some(40);
    p.update_type = Some(ParticleUpdateType::Drip { lava });
    p.tex_fn_type = Some(TexFnType::Drip { lava });
    p
}

pub fn create_splash_particle(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, rng: &mut JsRandom) -> Particle {
    create_water_drop_particle(x, y, z, mx, my, mz, true, rng)
}

pub fn create_honey_drip_particle(x: f64, y: f64, z: f64, falling: bool, landing: bool, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    let phase = if landing { "landing" } else if falling { "falling" } else { "dripping" };
    p.phase = Some(phase.to_string());
    p.sprite = Some(format!("{}_honey", phase));
    p.mx = 0.0;
    p.my = 0.0;
    p.mz = 0.0;
    p.scale = 1.0;
    let colors = match phase {
        "dripping" => [0.622, 0.508, 0.082],
        "falling" => [0.582, 0.448, 0.082],
        "landing" => [0.522, 0.408, 0.082],
        _ => [0.5, 0.5, 0.5],
    };
    p.r = colors[0];
    p.g = colors[1];
    p.b = colors[2];
    p.max_age = if phase == "dripping" {
        100
    } else {
        ((if phase == "landing" { 128.0 } else { 64.0 }) / (rng.random() * 0.8 + 0.2)).floor() as i32
    };
    p.update_type = Some(ParticleUpdateType::HoneyDrip);
    p.size_fn_type = Some(SizeFnType::HoneyDrip);
    p.tex_fn_type = Some(TexFnType::HoneyDrip);
    p
}

pub fn create_poof_particle(x: f64, y: f64, z: f64, _mx: f64, _my: f64, _mz: f64, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.mx += rng.random_signed() * 0.05;
    p.my += rng.random_signed() * 0.05;
    p.mz += rng.random_signed() * 0.05;
    let c = rng.random() * 0.3 + 0.7;
    p.r = c;
    p.g = c;
    p.b = c;
    p.scale = rng.random() * rng.random() * 6.0 + 1.0;
    p.max_age = (16.0 / (rng.random() * 0.8 + 0.2)).floor() as i32 + 2;
    p.update_type = Some(ParticleUpdateType::Poof);
    p.tex_fn_type = Some(TexFnType::Poof);
    p
}

pub fn create_spark_particle(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, color: Option<u32>, fade: Option<u32>, trail: bool, twinkle: bool, important: bool, a: f64, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some("firework".to_string());
    p.full_bright = true;
    p.important = important;
    p.a = a;
    p.scale = (rng.random() * 0.5 + 0.5) * 2.0 * 0.75;
    p.max_age = 48 + (rng.random() * 12.0).floor() as i32;
    if let Some(color) = color {
        p.r = ((color >> 16) & 0xFF) as f64 / 255.0;
        p.g = ((color >> 8) & 0xFF) as f64 / 255.0;
        p.b = (color & 0xFF) as f64 / 255.0;
    }
    if let Some(fade) = fade {
        p.fade = Some([
            ((fade >> 16) & 0xFF) as f64 / 255.0,
            ((fade >> 8) & 0xFF) as f64 / 255.0,
            (fade & 0xFF) as f64 / 255.0,
        ]);
    }
    p.trail = trail;
    p.twinkle = twinkle;
    p.update_type = Some(ParticleUpdateType::Spark);
    p.size_fn_type = Some(SizeFnType::Spark);
    p.tex_fn_type = Some(TexFnType::Spark);
    p.alpha_fn_type = Some(AlphaFnType::Spark);
    p
}

pub fn create_explosion_particle(x: f64, y: f64, z: f64, radius: f64, rng: &mut JsRandom) -> (Particle, Vec<Particle>) {
    let mut main = create_base_particle(x, y, z, rng);
    main.explosion_frame = Some(0);
    main.max_age = 6 + (rng.random() * 4.0).floor() as i32;
    main.scale = 2.0 + radius * 0.5;
    main.collide = false;
    main.important = true;
    main.update_type = Some(ParticleUpdateType::Native { kind: NativeParticleKind::Flash }); // no-op update

    let mut smoke_particles = Vec::new();
    for _ in 0..16 {
        let sx = x + rng.random_signed() * radius;
        let sy = y + rng.random_signed() * radius;
        let sz = z + rng.random_signed() * radius;
        let smx = rng.random_signed() * 0.2;
        let smy = rng.random() * 0.1;
        let smz = rng.random_signed() * 0.2;
        smoke_particles.push(create_smoke_particle(sx, sy, sz, smx, smy, smz, 2.5, rng));
    }
    (main, smoke_particles)
}

pub fn create_large_explode_particle(x: f64, y: f64, z: f64, scale: f64, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.explosion_frame = Some(0);
    p.max_age = 6 + (rng.random() * 4.0).floor() as i32;
    p.scale = (rng.random() * 0.6 + 0.4) * 2.0 * scale;
    p.collide = false;
    p.update_type = Some(ParticleUpdateType::Native { kind: NativeParticleKind::Flash }); // no-op update
    p
}

pub fn create_campfire_smoke_particle(x: f64, y: f64, z: f64, signal: bool, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some(if signal { "campfire_signal_smoke" } else { "campfire_cosy_smoke" }.to_string());
    p.mx = 0.0;
    p.my = 0.07;
    p.mz = 0.0;
    p.a = 0.9;
    p.scale = 3.0 + rng.random() * 3.0;
    p.max_age = (rng.random() * 50.0).floor() as i32 + if signal { 280 } else { 80 };
    p.collide = false;
    p.update_type = Some(ParticleUpdateType::CampfireSmoke { signal });
    p.size_fn_type = Some(SizeFnType::CampfireSmoke);
    p.alpha_fn_type = Some(AlphaFnType::CampfireSmoke);
    p
}

pub fn create_falling_drop_particle(x: f64, y: f64, z: f64, lava: bool, landing: bool, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some(
        if landing { "landing_lava" }
        else if lava { "falling_lava" }
        else { "falling_water" }.to_string()
    );
    p.mx = 0.0;
    p.my = 0.0;
    p.mz = 0.0;
    p.scale = 1.0;
    if landing {
        p.max_age = (16.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
        p.update_type = Some(ParticleUpdateType::Native { kind: NativeParticleKind::Flash }); // no-op
    } else {
        p.max_age = (64.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
        p.update_type = Some(ParticleUpdateType::FallingDrop { lava, landing });
        p.size_fn_type = Some(SizeFnType::FallingDrop);
    }
    p.r = if lava { 1.0 } else { 0.2 };
    p.g = if lava { 0.285 } else { 0.3 };
    p.b = if lava { 0.083 } else { 1.0 };
    p.full_bright = lava;
    p.collide = !landing;
    p
}

pub fn create_native_particle(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, kind: NativeParticleKind, rng: &mut JsRandom) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.sprite = Some(match kind {
        NativeParticleKind::Flash => "flash",
        NativeParticleKind::Sneeze => "sneeze",
        NativeParticleKind::EndRod => "end_rod",
        NativeParticleKind::TotemOfUndying => "totem_of_undying",
        NativeParticleKind::DamageIndicator => "damage_indicator",
        NativeParticleKind::DragonBreath => "dragon_breath",
        NativeParticleKind::Spit => "spit",
        NativeParticleKind::SquidInk => "squid_ink",
        NativeParticleKind::SweepAttack => "sweep_attack",
        NativeParticleKind::BubblePop => "bubble_pop",
        NativeParticleKind::CurrentDown => "current_down",
        NativeParticleKind::BubbleColumnUp => "bubble_column_up",
        NativeParticleKind::Dolphin => "dolphin",
        NativeParticleKind::Nautilus => "nautilus",
    }.to_string());
    p.scale = 1.0;
    p.max_age = 20;
    p.drag = 0.96;
    p.collide = false;

    match kind {
        NativeParticleKind::Flash => {
            p.max_age = 4;
            p.scale = 7.1;
            p.update_type = Some(ParticleUpdateType::Native { kind });
            p.size_fn_type = Some(SizeFnType::Native { kind });
            p.alpha_fn_type = Some(AlphaFnType::Flash);
        }
        NativeParticleKind::Sneeze => {
            p.r = 200.0 / 255.0;
            p.g = 231.0 / 255.0;
            p.b = 193.0 / 255.0;
            p.a = 0.4;
            p.max_age = (8.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
            p.scale = 2.0;
        }
        NativeParticleKind::EndRod => {
            p.full_bright = true;
            p.max_age = 60 + (rng.random() * 12.0).floor() as i32;
            p.gravity = -0.0005;
        }
        NativeParticleKind::TotemOfUndying => {
            p.r = 0.1 + rng.random() * 0.2;
            p.g = 0.4 + rng.random() * 0.6;
            p.b = rng.random() * 0.2;
            p.max_age = 60 + (rng.random() * 12.0).floor() as i32;
            p.scale = 0.75;
            p.gravity = 0.1;
        }
        NativeParticleKind::DamageIndicator => {
            p.max_age = 20;
            p.scale = 2.0;
            p.gravity = 0.5;
        }
        NativeParticleKind::DragonBreath => {
            p.r = 0.7 + rng.random() * 0.3;
            p.g = 0.0;
            p.b = 0.5 + rng.random() * 0.5;
            p.max_age = 20 + (rng.random() * 20.0).floor() as i32;
        }
        NativeParticleKind::Spit => {
            p.gravity = 0.5;
        }
        NativeParticleKind::SquidInk => {
            p.r = 0.0; p.g = 0.0; p.b = 0.0;
            p.max_age = (12.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
            p.scale = 1.5;
        }
        NativeParticleKind::SweepAttack => {
            p.max_age = 4;
            p.scale = 10.0;
            p.update_type = Some(ParticleUpdateType::Native { kind });
            p.size_fn_type = Some(SizeFnType::Native { kind });
        }
        NativeParticleKind::BubblePop => {
            p.max_age = 4;
        }
        NativeParticleKind::CurrentDown => {
            p.my = -0.05;
            p.max_age = 30 + (rng.random() * 60.0).floor() as i32;
        }
        NativeParticleKind::BubbleColumnUp => {
            p.my = 0.06;
            p.max_age = 40 + (rng.random() * 40.0).floor() as i32;
        }
        NativeParticleKind::Dolphin => {
            p.r = 0.3; p.g = 0.5; p.b = 1.0;
            p.max_age = (16.0 / (rng.random() * 0.8 + 0.2)).floor() as i32;
        }
        NativeParticleKind::Nautilus => {
            p.full_bright = true;
            p.max_age = 30 + (rng.random() * 30.0).floor() as i32;
            p.scale = 0.75;
        }
    }
    p.tex_fn_type = Some(TexFnType::Native { kind });
    p
}

pub fn create_simple_rising_particle(
    x: f64, y: f64, z: f64, tex: i32,
    sprite: Option<String>, mx: f64, my: f64, mz: f64,
    max_age: i32, scale: f64, r: f64, g: f64, b: f64,
    rng: &mut JsRandom,
) -> Particle {
    let mut p = create_base_particle(x, y, z, rng);
    p.tex = Some(tex);
    p.sprite = sprite.or_else(|| {
        SIMPLE_SPRITES.iter().find(|(k, _)| *k == tex).map(|(_, v)| v.to_string())
    });
    p.mx = mx;
    p.my = my;
    p.mz = mz;
    p.max_age = max_age;
    p.scale = scale;
    p.r = r;
    p.g = g;
    p.b = b;
    p.collide = false;
    p.update_type = Some(ParticleUpdateType::SimpleRising);
    p.size_fn_type = Some(SizeFnType::Default);
    p.tex_fn_type = Some(TexFnType::SimpleRising);
    p
}

// ============================================================================
// Emitter logic
// ============================================================================

pub fn emit_crit_particles(
    emitter: &mut ParticleEmitter,
    rng: &mut JsRandom,
) -> Vec<Particle> {
    let mut particles = Vec::new();
    for _ in 0..16 {
        let dx = rng.random_signed();
        let dy = rng.random_signed();
        let dz = rng.random_signed();
        if dx * dx + dy * dy + dz * dz > 1.0 {
            continue;
        }
        let w = emitter.entity_width;
        let h = emitter.entity_height;
        let px = emitter.entity_x + dx * w / 4.0;
        let py = emitter.entity_y + h / 2.0 + dy * h / 4.0;
        let pz = emitter.entity_z + dz * w / 4.0;
        particles.push(create_crit_particle(px, py, pz, dx, dy + 0.2, dz, emitter.magic, rng));
    }
    emitter.age += 1;
    particles
}

// ============================================================================
// Main tick function (returns JSON string)
// ============================================================================

/// Tick all particles for one frame.
/// Returns updated particles and any newly spawned particles as JSON.
#[wasm_bindgen]
pub fn particle_tick(
    particles_json: &str,
    explosion_emitters_json: &str,
    emitters_json: &str,
    collision_boxes: &[f64],
    settings: i32, // 0=all, 1=reduced, 2=minimal
    rng_seed: Option<u64>,
) -> String {
    let mut particles: Vec<Particle> = serde_json::from_str(particles_json).unwrap_or_default();
    let mut explosion_emitters: Vec<ExplosionEmitter> = serde_json::from_str(explosion_emitters_json).unwrap_or_default();
    let mut emitters: Vec<ParticleEmitter> = serde_json::from_str(emitters_json).unwrap_or_default();
    let mut rng = JsRandom::new(rng_seed);

    let mut new_particles = Vec::new();
    let mut alive_particles = Vec::new();
    let mut alive_explosion_emitters = Vec::new();
    let mut alive_emitters = Vec::new();

    // Process explosion emitters (huge explosions)
    for mut em in explosion_emitters {
        for _ in 0..6 {
            let x = em.x + (rng.random() - rng.random()) * 4.0;
            let y = em.y + (rng.random() - rng.random()) * 4.0;
            let z = em.z + (rng.random() - rng.random()) * 4.0;
            let scale = 1.0 - em.age as f64 / 16.0;
            new_particles.push(create_large_explode_particle(x, y, z, scale, &mut rng));
        }
        em.age += 1;
        if em.age < 8 {
            alive_explosion_emitters.push(em);
        }
    }

    // Process regular emitters (crit/magicCrit)
    for mut em in emitters {
        let emitted = emit_crit_particles(&mut em, &mut rng);
        new_particles.extend(emitted);
        if em.age < 3 {
            alive_emitters.push(em);
        }
    }

    // Tick all particles
    for mut p in particles {
        p.prev_x = p.x;
        p.prev_y = p.y;
        p.prev_z = p.z;

        p.age += 1;
        if p.age >= p.max_age {
            continue; // Particle dies
        }

        // Particle settings filter
        if settings == 2 && !p.important {
            continue;
        }
        if settings == 1 && !p.important && rng.random() * 3.0 < 1.0 {
            continue;
        }

        // Run update function
        let mut alive = true;
        let mut spawned: Option<Particle> = None;

        if let Some(update_type) = p.update_type {
            match update_type {
                ParticleUpdateType::Default => update_default(&mut p, collision_boxes),
                ParticleUpdateType::Crit => update_crit(&mut p, collision_boxes),
                ParticleUpdateType::Smoke => update_smoke(&mut p, collision_boxes),
                ParticleUpdateType::Flame => update_flame(&mut p, collision_boxes),
                ParticleUpdateType::Lava => {
                    spawned = update_lava(&mut p, collision_boxes, &mut rng);
                }
                ParticleUpdateType::WaterDrop { splash } => {
                    alive = update_water_drop(&mut p, collision_boxes, splash, &mut rng);
                }
                ParticleUpdateType::Bubble => {
                    // in_fluid check done by JS
                    alive = update_bubble(&mut p, collision_boxes, true);
                }
                ParticleUpdateType::Spell => update_spell(&mut p, collision_boxes),
                ParticleUpdateType::Portal => update_portal(&mut p),
                ParticleUpdateType::Enchant => update_enchant(&mut p),
                ParticleUpdateType::Reddust => update_reddust(&mut p, collision_boxes),
                ParticleUpdateType::Drip { lava } => {
                    (alive, spawned) = update_drip(&mut p, collision_boxes, lava, &mut rng);
                }
                ParticleUpdateType::HoneyDrip => {
                    (alive, spawned) = update_honey_drip(&mut p, collision_boxes, &mut rng);
                }
                ParticleUpdateType::Poof => update_poof(&mut p, collision_boxes),
                ParticleUpdateType::Spark => update_spark(&mut p, collision_boxes),
                ParticleUpdateType::FireworkStarter => {
                    alive = update_firework_starter(&mut p);
                }
                ParticleUpdateType::CampfireSmoke { signal: _ } => {
                    alive = update_campfire_smoke(&mut p, collision_boxes, &mut rng);
                }
                ParticleUpdateType::FallingDrop { lava, .. } => {
                    (alive, spawned) = update_falling_drop(&mut p, collision_boxes, lava, &mut rng);
                }
                ParticleUpdateType::Native { .. } => {
                    update_native(&mut p, collision_boxes);
                }
                ParticleUpdateType::SimpleRising => update_simple_rising(&mut p, collision_boxes),
            }
        }

        if alive {
            alive_particles.push(p);
            if let Some(spawned) = spawned {
                new_particles.push(spawned);
            }
        }
    }

    // Build result as JSON manually to avoid wasm_bindgen struct issues
    let mut result = String::new();
    result.push_str("{\"particles\":");
    result.push_str(&serde_json::to_string(&alive_particles).unwrap_or_default());
    result.push_str(",\"new_particles\":");
    result.push_str(&serde_json::to_string(&new_particles).unwrap_or_default());
    result.push_str(",\"explosion_emitters\":");
    result.push_str(&serde_json::to_string(&alive_explosion_emitters).unwrap_or_default());
    result.push_str(",\"emitters\":");
    result.push_str(&serde_json::to_string(&alive_emitters).unwrap_or_default());
    result.push('}');
    result
}

// ============================================================================
// WASM-exported factory functions (return JSON strings)
// ============================================================================

#[wasm_bindgen]
pub fn particle_crit(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, magic: bool, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_crit_particle(x, y, z, mx, my, mz, magic, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_smoke(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, scale_mul: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_smoke_particle(x, y, z, mx, my, mz, scale_mul, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_flame(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_flame_particle(x, y, z, mx, my, mz, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_lava(x: f64, y: f64, z: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_lava_particle(x, y, z, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_rain(x: f64, y: f64, z: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_water_drop_particle(x, y, z, 0.0, 0.0, 0.0, false, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_splash(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_water_drop_particle(x, y, z, mx, my, mz, true, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_bubble(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_bubble_particle(x, y, z, mx, my, mz, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_spell(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, r: f64, g: f64, b: f64, instant: bool, witch: bool, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_spell_particle(x, y, z, mx, my, mz, r, g, b, instant, witch, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_portal(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_portal_particle(x, y, z, mx, my, mz, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_enchant(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_enchant_particle(x, y, z, mx, my, mz, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_reddust(x: f64, y: f64, z: f64, r: f64, g: f64, b: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_reddust_particle(x, y, z, r, g, b, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_drip(x: f64, y: f64, z: f64, lava: bool, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_drip_particle(x, y, z, lava, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_honey_drip(x: f64, y: f64, z: f64, falling: bool, landing: bool, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_honey_drip_particle(x, y, z, falling, landing, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_explosion(x: f64, y: f64, z: f64, radius: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let (main, smoke) = create_explosion_particle(x, y, z, radius, &mut rng);
    let mut all = vec![main];
    all.extend(smoke);
    serde_json::to_string(&all).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_poof(x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_poof_particle(x, y, z, mx, my, mz, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_large_explode(x: f64, y: f64, z: f64, scale: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_large_explode_particle(x, y, z, scale, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_campfire_smoke(x: f64, y: f64, z: f64, signal: bool, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_campfire_smoke_particle(x, y, z, signal, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_falling_drop(x: f64, y: f64, z: f64, lava: bool, landing: bool, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_falling_drop_particle(x, y, z, lava, landing, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_native(
    x: f64, y: f64, z: f64, mx: f64, my: f64, mz: f64,
    kind: &str, rng_seed: Option<u64>,
) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let kind = match kind {
        "flash" => NativeParticleKind::Flash,
        "sneeze" => NativeParticleKind::Sneeze,
        "end_rod" => NativeParticleKind::EndRod,
        "totem_of_undying" => NativeParticleKind::TotemOfUndying,
        "damage_indicator" => NativeParticleKind::DamageIndicator,
        "dragon_breath" => NativeParticleKind::DragonBreath,
        "spit" => NativeParticleKind::Spit,
        "squid_ink" => NativeParticleKind::SquidInk,
        "sweep_attack" => NativeParticleKind::SweepAttack,
        "bubble_pop" => NativeParticleKind::BubblePop,
        "current_down" => NativeParticleKind::CurrentDown,
        "bubble_column_up" => NativeParticleKind::BubbleColumnUp,
        "dolphin" => NativeParticleKind::Dolphin,
        "nautilus" => NativeParticleKind::Nautilus,
        _ => NativeParticleKind::Flash,
    };
    let p = create_native_particle(x, y, z, mx, my, mz, kind, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_simple_rising(
    x: f64, y: f64, z: f64, tex: i32,
    sprite: Option<String>, mx: f64, my: f64, mz: f64,
    max_age: i32, scale: f64, r: f64, g: f64, b: f64,
    rng_seed: Option<u64>,
) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let p = create_simple_rising_particle(x, y, z, tex, sprite, mx, my, mz, max_age, scale, r, g, b, &mut rng);
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_note(x: f64, y: f64, z: f64, pitch: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let f = pitch / 24.0;
    let r = (f * 2.0 * std::f64::consts::PI).sin() * 0.65 + 0.35;
    let g = ((f + 1.0 / 3.0) * 2.0 * std::f64::consts::PI).sin() * 0.65 + 0.35;
    let b = ((f + 2.0 / 3.0) * 2.0 * std::f64::consts::PI).sin() * 0.65 + 0.35;
    let p = create_simple_rising_particle(
        x + 0.5, y + 1.2, z + 0.5, 64, None,
        0.0, 0.2, 0.0, 6, 1.5, r, g, b, &mut rng
    );
    serde_json::to_string(&p).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_entity_effect(
    entity_x: f64, entity_y: f64, entity_z: f64,
    entity_width: f64, entity_height: f64,
    kind: &str, rng_seed: Option<u64>,
) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let mut particles = Vec::new();
    for _ in 0..7 {
        let x = entity_x + rng.random_signed() * entity_width;
        let y = entity_y + 0.5 + rng.random() * entity_height;
        let z = entity_z + rng.random_signed() * entity_width;
        let p = match kind {
            "heart" => create_simple_rising_particle(x, y, z, 80, None, 0.0, 0.1, 0.0, 16, 1.5, 1.0, 1.0, 1.0, &mut rng),
            "angryVillager" => create_simple_rising_particle(x, y, z, 81, None, 0.0, 0.1, 0.0, 16, 1.5, 1.0, 1.0, 1.0, &mut rng),
            "happyVillager" => create_simple_rising_particle(x, y, z, 82, None, 0.0, 0.05, 0.0, 16, 1.5, 1.0, 1.0, 1.0, &mut rng),
            "smoke" => create_smoke_particle(x, y, z, 0.0, 0.0, 0.0, 1.0, &mut rng),
            "witchMagic" => create_spell_particle(x, y, z, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, false, true, &mut rng),
            _ => create_simple_rising_particle(x, y, z, 0, None, 0.0, 0.1, 0.0, 16, 1.5, 1.0, 1.0, 1.0, &mut rng),
        };
        particles.push(p);
    }
    serde_json::to_string(&particles).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_entity_fire(entity_x: f64, entity_y: f64, entity_z: f64, entity_width: f64, entity_height: f64, rng_seed: Option<u64>) -> String {
    let mut rng = JsRandom::new(rng_seed);
    let mut particles = Vec::new();
    if rng.random() < 0.5 {
        let x = entity_x + rng.random_signed() * entity_width;
        let y = entity_y + rng.random() * entity_height;
        let z = entity_z + rng.random_signed() * entity_width;
        particles.push(create_smoke_particle(x, y, z, 0.0, 0.02, 0.0, 1.0, &mut rng));
    }
    serde_json::to_string(&particles).unwrap_or_default()
}

#[wasm_bindgen]
pub fn particle_huge_explode(x: f64, y: f64, z: f64) -> String {
    let em = ExplosionEmitter { x, y, z, age: 0 };
    serde_json::to_string(&vec![em]).unwrap_or_default()
}

// ============================================================================
// Size/alpha/tex evaluation for JS rendering
// ============================================================================

#[wasm_bindgen]
pub fn particle_eval_size(particle_json: &str, partial: f64) -> f64 {
    let p: Particle = serde_json::from_str(particle_json).unwrap_or_default();
    if let Some(fn_type) = p.size_fn_type {
        eval_size_fn(&p, partial, fn_type)
    } else {
        0.1 * p.scale
    }
}

#[wasm_bindgen]
pub fn particle_eval_alpha(particle_json: &str, partial: f64) -> f64 {
    let p: Particle = serde_json::from_str(particle_json).unwrap_or_default();
    if let Some(fn_type) = p.alpha_fn_type {
        eval_alpha_fn(&p, partial, fn_type)
    } else {
        p.a * (1.0 - p.age as f64 / p.max_age as f64)
    }
}

#[wasm_bindgen]
pub fn particle_eval_tex(particle_json: &str) -> i32 {
    let p: Particle = serde_json::from_str(particle_json).unwrap_or_default();
    if let Some(fn_type) = p.tex_fn_type {
        eval_tex_fn(&p, fn_type)
    } else {
        p.tex.unwrap_or(0)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn js_random_basic() {
        let mut rng = JsRandom::new(Some(42));
        for _ in 0..100 {
            let v = rng.random();
            assert!((0.0..1.0).contains(&v));
        }
    }

    #[test]
    fn js_random_gauss() {
        let mut rng = JsRandom::new(Some(42));
        for _ in 0..100 {
            let v = rng.gauss();
            assert!(v.is_finite());
        }
    }

    #[test]
    fn particle_move_no_collision() {
        let out = particle_move(0.0, 0.0, 0.0, 1.0, -2.0, 0.5, 0.2, 0.2, false, &[]);
        assert_eq!(out, vec![1.0, -2.0, 0.5, 1.0, -2.0, 0.5, 0.0]);
    }

    #[test]
    fn particle_move_floor_stops() {
        let floor = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0];
        let out = particle_move(0.5, 1.1, 0.5, 0.0, -0.2, 0.0, 0.2, 0.2, true, &floor);
        assert!((out[1] - 1.0).abs() < 1e-10);
        assert_eq!(out[4], 0.0);
        assert_eq!(out[6], 1.0);
    }

    #[test]
    fn crit_particle_created() {
        let json = particle_crit(0.0, 0.0, 0.0, 0.1, 0.1, 0.1, false, Some(42));
        let p: Particle = serde_json::from_str(&json).unwrap();
        assert_eq!(p.sprite, Some("crit".to_string()));
        assert!(p.max_age > 0);
        assert!(p.update_type == Some(ParticleUpdateType::Crit));
    }

    #[test]
    fn magic_crit_particle_created() {
        let json = particle_crit(0.0, 0.0, 0.0, 0.1, 0.1, 0.1, true, Some(42));
        let p: Particle = serde_json::from_str(&json).unwrap();
        assert_eq!(p.sprite, Some("enchanted_hit".to_string()));
        assert!(p.r < p.g); // magic tint
    }

    #[test]
    fn smoke_particle_created() {
        let json = particle_smoke(0.0, 0.0, 0.0, 0.0, 0.1, 0.0, 1.0, Some(42));
        let p: Particle = serde_json::from_str(&json).unwrap();
        assert_eq!(p.sprite, Some("smoke".to_string()));
        assert!(p.update_type == Some(ParticleUpdateType::Smoke));
    }

    #[test]
    fn large_smoke_particle_created() {
        let json = particle_smoke(0.0, 0.0, 0.0, 0.0, 0.1, 0.0, 2.5, Some(42));
        let p: Particle = serde_json::from_str(&json).unwrap();
        assert_eq!(p.sprite, Some("large_smoke".to_string()));
    }

    #[test]
    fn flame_particle_created() {
        let json = particle_flame(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, Some(42));
        let p: Particle = serde_json::from_str(&json).unwrap();
        assert_eq!(p.tex, Some(48));
        assert!(p.full_bright);
        assert!(!p.collide);
    }

    #[test]
    fn lava_particle_created() {
        let json = particle_lava(0.0, 0.0, 0.0, Some(42));
        let p: Particle = serde_json::from_str(&json).unwrap();
        assert_eq!(p.tex, Some(49));
        assert!(p.full_bright);
        assert!(p.update_type == Some(ParticleUpdateType::Lava));
    }

    #[test]
    fn explosion_creates_main_and_smoke() {
        let json = particle_explosion(0.0, 0.0, 0.0, 1.0, Some(42));
        let particles: Vec<Particle> = serde_json::from_str(&json).unwrap();
        assert_eq!(particles.len(), 17); // 1 main + 16 smoke
        assert!(particles[0].explosion_frame == Some(0));
        assert!(particles[0].important);
    }

    #[test]
    fn portal_particle_has_trajectory() {
        let json = particle_portal(10.0, 64.0, 10.0, 0.1, 0.1, 0.1, Some(42));
        let p: Particle = serde_json::from_str(&json).unwrap();
        assert_eq!(p.sprite, Some("portal".to_string()));
        assert!(p.sx.is_some());
        assert!(!p.collide);
    }

    #[test]
    fn enchant_particle_has_trajectory() {
        let json = particle_enchant(10.0, 64.0, 10.0, 0.1, 0.1, 0.1, Some(42));
        let p: Particle = serde_json::from_str(&json).unwrap();
        assert_eq!(p.sprite, Some("enchant".to_string()));
        assert!(p.sx.is_some());
        assert!(!p.collide);
    }

    #[test]
    fn native_particle_flash() {
        let json = particle_native(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, "flash", Some(42));
        let p: Particle = serde_json::from_str(&json).unwrap();
        assert_eq!(p.sprite, Some("flash".to_string()));
        assert_eq!(p.max_age, 4);
        assert_eq!(p.scale, 7.1);
    }

    #[test]
    fn size_fn_crit() {
        let mut p = Particle {
            base_scale: Some(1.0),
            age: 2,
            max_age: 6,
            scale: 1.0,
            ..Default::default()
        };
        let size = eval_size_fn(&p, 0.5, SizeFnType::Crit);
        // age+partial = 2.5, /6 * 32 = 13.33, clamped to 1.0
        assert!((size - 1.0).abs() < 1e-6);
    }

    #[test]
    fn size_fn_flame() {
        let mut p = Particle {
            base_scale: Some(1.0),
            age: 4,
            max_age: 8,
            scale: 1.0,
            ..Default::default()
        };
        let size = eval_size_fn(&p, 0.0, SizeFnType::Flame);
        // f = 4/8 = 0.5, size = 1 * (1 - 0.25 * 0.5) = 0.875
        assert!((size - 0.875).abs() < 1e-6);
    }

    #[test]
    fn size_fn_portal() {
        let mut p = Particle {
            base_scale: Some(1.0),
            age: 20,
            max_age: 40,
            scale: 1.0,
            ..Default::default()
        };
        let size = eval_size_fn(&p, 0.0, SizeFnType::Portal);
        // f = 0.5, f = 1-0.5=0.5, f*=f=0.25, f=1-0.25=0.75, size = 1 * 0.75 * 2 = 1.5
        assert!((size - 1.5).abs() < 1e-6);
    }

    #[test]
    fn alpha_fn_spark_twinkle() {
        let p = Particle {
            age: 20,
            max_age: 48,
            a: 1.0,
            twinkle: true,
            ..Default::default()
        };
        // age=20, max_age=48, max_age/3=16, age>=16 true
        // (20+48)/3 = 22, 22%2=0, so NOT twinkling out -> alpha = 1.0
        let alpha = eval_alpha_fn(&p, 0.0, AlphaFnType::Spark);
        assert!((alpha - 1.0).abs() < 1e-6);

        // age=17, (17+48)/3 = 21, 21%2=1 -> twinkling out
        let p2 = Particle { age: 17, max_age: 48, a: 1.0, twinkle: true, ..Default::default() };
        let alpha2 = eval_alpha_fn(&p2, 0.0, AlphaFnType::Spark);
        assert_eq!(alpha2, 0.0);
    }
}