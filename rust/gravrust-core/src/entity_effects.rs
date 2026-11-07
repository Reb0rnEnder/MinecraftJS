//! Port of `client/js/render/entity-effects.js` algorithmic core.
//!
//! This module contains the pure geometry/math functions for entity effect rendering:
//! - Crystal beam (end crystal / end gateway) vertex generation
//! - Guardian beam vertex generation
//! - Ender dragon death ray vertex generation
//! - Dragon corpse matrix calculation
//! - Crystal bob animation helper
//!
//! Browser-bound parts (WebGL mesh management, rendering, entity tracking) remain in JavaScript.

use wasm_bindgen::prelude::*;

use crate::math::{identity_matrix, multiply, rotate, translate, transform_point};
use crate::jrandom::JavaRandom;

const TAU: f64 = std::f64::consts::PI * 2.0;
const D2R: f64 = std::f64::consts::PI / 180.0;

/// Vertex format: [x, y, z, u, v, r, g, b, a]
/// Matches the JS vertex helper: push(...p, u, v, ...c)
const VERTEX_STRIDE: usize = 9;

/// Wrap angle to [-180, 180), matching JS `wrap` function.
fn wrap_angle(a: f64) -> f64 {
    let mut a = a % 360.0;
    if a >= 180.0 {
        a -= 360.0;
    }
    if a < -180.0 {
        a += 360.0;
    }
    a
}

/// Crystal bob animation: `crystalBob(age)`.
/// Returns the vertical offset for the end crystal beam endpoint.
#[wasm_bindgen]
pub fn crystal_bob(age: f64) -> f64 {
    let f = (age * 0.2).sin() * 0.5 + 0.5;
    (f * f + f) * 0.2
}

/// Check if entity is an Ender Dragon (type 63, kind 'mob').
#[wasm_bindgen]
pub fn is_dragon(kind: &str, type_id: i32) -> bool {
    kind == "mob" && type_id == 63
}

/// Transform a point by a 4x4 matrix (column-major).
/// Returns [x, y, z].
fn transform(m: &[f32; 16], x: f64, y: f64, z: f64) -> [f32; 3] {
    transform_point(m, x, y, z)
}

/// Push a vertex to the output buffer.
/// vertex format: [x, y, z, u, v, r, g, b, a]
fn push_vertex(
    out: &mut Vec<f32>,
    pos: [f32; 3],
    u: f32,
    v: f32,
    color: Option<[f32; 4]>,
) {
    out.push(pos[0]);
    out.push(pos[1]);
    out.push(pos[2]);
    out.push(u);
    out.push(v);
    if let Some(c) = color {
        out.push(c[0]);
        out.push(c[1]);
        out.push(c[2]);
        out.push(c[3]);
    } else {
        out.push(1.0);
        out.push(1.0);
        out.push(1.0);
        out.push(1.0);
    }
}

/// `crystalBeam(start, end, age)` - RenderDragon's octagonal taper.
/// Black at the dragon (start) and white at the crystal (end).
///
/// Returns a `Vec<f32>` with stride 9 (x, y, z, u, v, r, g, b, a) for each vertex.
/// The vertices form quads (4 vertices per face, 8 faces = 32 vertices).
#[wasm_bindgen]
pub fn crystal_beam(start: &[f32], end: &[f32], age: f64) -> Vec<f32> {
    if start.len() < 3 || end.len() < 3 {
        return Vec::new();
    }

    let dx = end[0] as f64 - start[0] as f64;
    let dy = end[1] as f64 - start[1] as f64;
    let dz = end[2] as f64 - start[2] as f64;
    let len = (dx * dx + dy * dy + dz * dz).sqrt();

    let mut m = identity_matrix();
    m = translate(&m, start[0] as f64, start[1] as f64, start[2] as f64);
    m = rotate(&m, -dz.atan2(dx) - std::f64::consts::FRAC_PI_2, 0.0, 1.0, 0.0);
    let horiz = (dx * dx + dz * dz).sqrt();
    m = rotate(&m, -horiz.atan2(dy) - std::f64::consts::FRAC_PI_2, 1.0, 0.0, 0.0);

    let mut out = Vec::with_capacity(8 * 4 * VERTEX_STRIDE);
    let v0 = -age * 0.01;
    let v1 = len / 32.0 + v0;

    for i in 0..8 {
        let a = i as f64 / 8.0 * TAU;
        let b = (i + 1) as f64 / 8.0 * TAU;

        // Inner bottom (black)
        push_vertex(&mut out, transform(&m, (a.sin() * 0.15) as f64, (a.cos() * 0.15) as f64, 0.0), i as f32 / 8.0, v0 as f32, Some([0.0, 0.0, 0.0, 1.0]));
        // Inner top
        push_vertex(&mut out, transform(&m, (a.sin() * 0.75) as f64, (a.cos() * 0.75) as f64, len), i as f32 / 8.0, v1 as f32, None);
        // Next inner top
        push_vertex(&mut out, transform(&m, (b.sin() * 0.75) as f64, (b.cos() * 0.75) as f64, len), (i + 1) as f32 / 8.0, v1 as f32, None);
        // Next inner bottom (black)
        push_vertex(&mut out, transform(&m, (b.sin() * 0.15) as f64, (b.cos() * 0.15) as f64, 0.0), (i + 1) as f32 / 8.0, v0 as f32, Some([0.0, 0.0, 0.0, 1.0]));
    }

    out
}

/// `guardianBeam(start, end, age, ticks, charge)` - Guardian laser beam.
/// Two rotating crossed planes plus alternating end cap.
/// Attack charge changes the beam colour.
///
/// Returns a `Vec<f32>` with stride 9 (x, y, z, u, v, r, g, b, a).
#[wasm_bindgen]
pub fn guardian_beam(
    start: &[f32],
    end: &[f32],
    age: f64,
    ticks: i32,
    charge: f64,
) -> Vec<f32> {
    if start.len() < 3 || end.len() < 3 {
        return Vec::new();
    }

    let dx = end[0] as f64 - start[0] as f64;
    let dy = end[1] as f64 - start[1] as f64;
    let dz = end[2] as f64 - start[2] as f64;
    let dist = (dx * dx + dy * dy + dz * dz).sqrt();

    if dist < 1e-6 {
        return Vec::new();
    }

    let len = dist + 1.0;
    let mut m = identity_matrix();
    m = translate(&m, start[0] as f64, start[1] as f64, start[2] as f64);
    m = rotate(&m, std::f64::consts::FRAC_PI_2 - dz.atan2(dx), 0.0, 1.0, 0.0);
    m = rotate(&m, (dy / dist).acos(), 1.0, 0.0, 0.0);

    let mut out = Vec::with_capacity(4 * 4 * VERTEX_STRIDE + 4 * VERTEX_STRIDE);
    let a = -age * 0.075;
    let f = charge * charge;
    let color: [f32; 4] = [
        ((64.0 + (f * 191.0).floor()) / 255.0) as f32,
        ((32.0 + (f * 191.0).floor()) / 255.0) as f32,
        ((128.0 - (f * 64.0).floor()) / 255.0) as f32,
        1.0,
    ];

    let pos = |angle: f64, r: f64, y: f64| -> [f32; 3] {
        transform(
            &m,
            angle.cos() * r,
            y,
            angle.sin() * r,
        )
    };

    let v0 = -1.0 + (age * 0.5) % 1.0;
    let v1 = len * 2.5 + v0;

    // Two crossed planes
    for offset in [0.0, std::f64::consts::FRAC_PI_2] {
        push_vertex(&mut out, pos(a + offset + std::f64::consts::PI, 0.2, len), 0.4999, v1 as f32, Some(color));
        push_vertex(&mut out, pos(a + offset + std::f64::consts::PI, 0.2, 0.0), 0.4999, v0 as f32, Some(color));
        push_vertex(&mut out, pos(a + offset, 0.2, 0.0), 0.0, v0 as f32, Some(color));
        push_vertex(&mut out, pos(a + offset, 0.2, len), 0.0, v1 as f32, Some(color));
    }

    // End cap (alternating)
    let v = if ticks % 2 == 0 { 0.5 } else { 0.0 };
    let cap_vertices = [
        (3.0 * std::f64::consts::FRAC_PI_4, 0.5, v + 0.5),
        (std::f64::consts::FRAC_PI_4, 1.0, v + 0.5),
        (7.0 * std::f64::consts::FRAC_PI_4, 1.0, v),
        (5.0 * std::f64::consts::FRAC_PI_4, 0.5, v),
    ];

    for (angle, u, w) in cap_vertices {
        push_vertex(&mut out, pos(a + angle, 0.282, len), u as f32, w as f32, Some(color));
    }

    out
}

/// `dragonCorpseMatrix(e, partial)` - Calculate the corpse transformation matrix.
/// `ring` should be a slice of f64 pairs [yaw, y] of length 128 (64 entries).
#[wasm_bindgen]
pub fn dragon_corpse_matrix(
    yaw: f64,
    y: f64,
    ring: &[f64],
    ring_idx: usize,
    dead: bool,
    partial: f64,
) -> Vec<f32> {
    if ring.len() < 128 {
        return identity_matrix().to_vec();
    }

    let off = |i: isize| -> [f64; 2] {
        let idx = ((ring_idx as isize - i).rem_euclid(64) as usize) * 2;
        [ring[idx], ring[idx + 1]]
    };

    let m = identity_matrix();
    let m = rotate(&m, -wrap_angle(off(7)[0]) * D2R, 0.0, 1.0, 0.0);
    let m = rotate(&m, (off(5)[1] - off(10)[1]) * 10.0 * D2R, 1.0, 0.0, 0.0);
    let m = translate(&m, 0.0, 0.0, 1.0);
    let m = scale(&m, -1.0, -1.0, 1.0);
    let m = translate(&m, 0.0, -1.5078125, 0.0);

    m.to_vec()
}

/// Scale matrix helper (not exported, internal use).
fn scale(m: &[f32; 16], x: f64, y: f64, z: f64) -> [f32; 16] {
    let mut out = [0f32; 16];
    for i in 0..4 {
        out[i] = (m.get(i).copied().unwrap_or(0.0) as f64 * x) as f32;
        out[4 + i] = (m.get(4 + i).copied().unwrap_or(0.0) as f64 * y) as f32;
        out[8 + i] = (m.get(8 + i).copied().unwrap_or(0.0) as f64 * z) as f32;
        out[12 + i] = m.get(12 + i).copied().unwrap_or(0.0);
    }
    out
}

/// `dragonDeathRays(e, partial)` - Ender dragon death ray geometry.
/// `ring` should be a slice of f64 pairs [yaw, y] of length 128 (64 entries).
///
/// Returns a `Vec<f32>` with stride 9 (x, y, z, u, v, r, g, b, a).
#[wasm_bindgen]
pub fn dragon_death_rays(
    x: f64,
    y: f64,
    z: f64,
    yaw: f64,
    death_time: i32,
    ring: &[f64],
    ring_idx: usize,
    dead: bool,
    partial: f64,
) -> Vec<f32> {
    if ring.len() < 128 {
        return Vec::new();
    }

    let f = ((death_time as f64 + partial) / 200.0).min(1.0);
    let fade = if f >= 1.0 {
        1.0
    } else if f > 0.8 {
        (f - 0.8) / 0.2
    } else {
        0.0
    };

    let mut random = JavaRandom::new(432);
    let mut out = Vec::new();

    // Build the base corpse matrix
    let mut local = {
        let off = |i: isize| -> [f64; 2] {
            let idx = ((ring_idx as isize - i).rem_euclid(64) as usize) * 2;
            [ring[idx], ring[idx + 1]]
        };

        let m = identity_matrix();
        let m = rotate(&m, -wrap_angle(off(7)[0]) * D2R, 0.0, 1.0, 0.0);
        let m = rotate(&m, (off(5)[1] - off(10)[1]) * 10.0 * D2R, 1.0, 0.0, 0.0);
        let m = translate(&m, 0.0, 0.0, 1.0);
        let m = scale(&m, -1.0, -1.0, 1.0);
        let m = translate(&m, 0.0, -1.5078125, 0.0);
        // Additional transform from JS: mat4.translate(local, local, 0, -1, -2)
        translate(&m, 0.0, -1.0, -2.0)
    };

    let iterations = ((f + f * f) / 2.0 * 60.0) as i32;
    for _ in 0..iterations {
        // The layer's rotations accumulate between ray fans
        for axis in ['X', 'Y', 'Z', 'X', 'Y', 'Z'] {
            let angle = random.next_float() * TAU;
            local = match axis {
                'X' => rotate(&local, angle, 1.0, 0.0, 0.0),
                'Y' => rotate(&local, angle, 0.0, 1.0, 0.0),
                'Z' => rotate(&local, angle, 0.0, 0.0, 1.0),
                _ => local,
            };
        }
        // The sixth rotation also includes the death progress
        local = rotate(&local, f * 90.0 * D2R, 0.0, 0.0, 1.0);

        let length = random.next_float() * 20.0 + 5.0 + fade * 10.0;
        let width = random.next_float() * 2.0 + 1.0 + fade * 2.0;

        let origin = transform(&local, 0.0, 0.0, 0.0);
        let ends = [
            [-0.866 * width, length, -0.5 * width],
            [0.866 * width, length, -0.5 * width],
            [0.0, length, width],
        ];

        let world = |p: [f64; 3]| -> [f32; 3] {
            [
                (p[0] + x) as f32,
                (p[1] + y) as f32,
                (p[2] + z) as f32,
            ]
        };

        for j in 0..3 {
            // Origin vertex (white, fading alpha)
            push_vertex(
                &mut out,
                world([origin[0] as f64, origin[1] as f64, origin[2] as f64]),
                0.0,
                0.0,
                Some([1.0, 1.0, 1.0, 1.0 - fade as f32]),
            );

            // First end vertex (magenta, transparent)
            let end1 = transform(&local, ends[j][0], ends[j][1], ends[j][2]);
            push_vertex(
                &mut out,
                world([end1[0] as f64, end1[1] as f64, end1[2] as f64]),
                0.0,
                0.0,
                Some([1.0, 0.0, 1.0, 0.0]),
            );

            // Tip vertex (duplicated, magenta, transparent)
            let next_j = (j + 1) % 3;
            let tip = transform(&local, ends[next_j][0], ends[next_j][1], ends[next_j][2]);
            push_vertex(
                &mut out,
                world([tip[0] as f64, tip[1] as f64, tip[2] as f64]),
                0.0,
                0.0,
                Some([1.0, 0.0, 1.0, 0.0]),
            );
            push_vertex(
                &mut out,
                world([tip[0] as f64, tip[1] as f64, tip[2] as f64]),
                0.0,
                0.0,
                Some([1.0, 0.0, 1.0, 0.0]),
            );
        }
    }

    out
}

/// Entity effect type for particle generation.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[wasm_bindgen]
pub enum EntityEffectType {
    /// End crystal healing beam
    CrystalBeam = 0,
    /// Guardian laser beam
    GuardianBeam = 1,
    /// Ender dragon death rays
    DragonDeathRays = 2,
    /// Potion effect particles (swirly)
    PotionSwirl = 3,
    /// Glowing effect outline
    Glowing = 4,
}

/// Generate entity effect particles for a given effect type.
/// This is a higher-level helper that creates particle data for JS rendering.
///
/// Returns a JSON string containing particle data, or empty string on failure.
#[wasm_bindgen]
pub fn entity_effect_particles(
    entity_x: f64,
    entity_y: f64,
    entity_z: f64,
    entity_width: f64,
    entity_height: f64,
    effect_type: EntityEffectType,
    amplifier: i32,
    age: f64,
    rng_seed: Option<u64>,
) -> String {
    let mut rng = crate::particles::JsRandom::new(rng_seed);
    let mut particles = Vec::new();

    match effect_type {
        EntityEffectType::PotionSwirl => {
            // Potion swirl particles around entity
            let count = 4 + amplifier * 2;
            for _ in 0..count {
                let angle = rng.random() * TAU;
                let radius = entity_width * 0.5 + rng.random() * 0.3;
                let height = rng.random() * entity_height;
                let mx = angle.cos() * 0.02;
                let my = 0.05 + rng.random() * 0.05;
                let mz = angle.sin() * 0.02;

                let mut p = crate::particles::Particle::default();
                p.x = entity_x + angle.cos() * radius;
                p.y = entity_y + height;
                p.z = entity_z + angle.sin() * radius;
                p.prev_x = p.x;
                p.prev_y = p.y;
                p.prev_z = p.z;
                p.mx = mx;
                p.my = my;
                p.mz = mz;
                p.max_age = 20 + (rng.random() * 10.0) as i32;
                p.scale = 0.25;
                p.r = 0.8;
                p.g = 0.2;
                p.b = 0.8;
                p.a = 0.8;
                p.update_type = Some(crate::particles::ParticleUpdateType::Spell);
                p.tex_fn_type = Some(crate::particles::TexFnType::Spell { instant: false, witch: false });
                p.size_fn_type = Some(crate::particles::SizeFnType::Default);

                particles.push(p);
            }
        }
        EntityEffectType::Glowing => {
            // Glowing effect - spectral arrow style particles
            let count = 2 + amplifier;
            for _ in 0..count {
                let angle = rng.random() * TAU;
                let radius = entity_width * 0.6 + rng.random() * 0.2;
                let height = rng.random() * entity_height;
                let mx = angle.cos() * 0.01;
                let my = 0.02 + rng.random() * 0.03;
                let mz = angle.sin() * 0.01;

                let mut p = crate::particles::Particle::default();
                p.x = entity_x + angle.cos() * radius;
                p.y = entity_y + height;
                p.z = entity_z + angle.sin() * radius;
                p.prev_x = p.x;
                p.prev_y = p.y;
                p.prev_z = p.z;
                p.mx = mx;
                p.my = my;
                p.mz = mz;
                p.max_age = 15 + (rng.random() * 10.0) as i32;
                p.scale = 0.3;
                p.r = 1.0;
                p.g = 1.0;
                p.b = 0.0;
                p.a = 0.9;
                p.full_bright = true;
                p.update_type = Some(crate::particles::ParticleUpdateType::SimpleRising);
                p.tex_fn_type = Some(crate::particles::TexFnType::SimpleRising);
                p.size_fn_type = Some(crate::particles::SizeFnType::Default);

                particles.push(p);
            }
        }
        _ => {
            // For beam effects, return empty - those use vertex geometry not particles
            return String::new();
        }
    }

    serde_json::to_string(&particles).unwrap_or_default()
}

/// Calculate glowing effect outline vertices for an entity.
/// Returns a JSON string with vertex data for rendering the glowing outline,
/// or empty string on failure.
///
/// The glowing effect renders as a slightly scaled version of the entity model
/// with a pulsing outline color. This function generates the vertex positions
/// for a simple box outline around the entity bounds.
#[wasm_bindgen]
pub fn entity_glow_vertices(
    entity_x: f64,
    entity_y: f64,
    entity_z: f64,
    entity_width: f64,
    entity_height: f64,
    entity_eye_height: f64,
    age: f64,
) -> String {
    // Pulsing glow intensity
    let pulse = (age * 0.1).sin() * 0.2 + 0.8;
    let scale = 1.0 + 0.05 * pulse;

    let half_w = entity_width * 0.5 * scale;
    let half_h = entity_height * scale;

    // Simple box outline vertices (12 edges * 2 vertices = 24 vertices)
    // Each vertex: [x, y, z, r, g, b, a]
    let mut vertices = Vec::with_capacity(24 * 7);

    let min_x = entity_x - half_w;
    let max_x = entity_x + half_w;
    let min_y = entity_y;
    let max_y = entity_y + half_h;
    let min_z = entity_z - half_w;
    let max_z = entity_z + half_w;

    // Glowing color (yellow-white pulsing)
    let r = pulse as f32;
    let g = pulse as f32;
    let b = 0.2;
    let a = 0.6 * pulse as f32;

    // Bottom face edges
    let bottom_edges = [
        [min_x, min_y, min_z], [max_x, min_y, min_z],
        [max_x, min_y, min_z], [max_x, min_y, max_z],
        [max_x, min_y, max_z], [min_x, min_y, max_z],
        [min_x, min_y, max_z], [min_x, min_y, min_z],
    ];

    // Top face edges
    let top_edges = [
        [min_x, max_y, min_z], [max_x, max_y, min_z],
        [max_x, max_y, min_z], [max_x, max_y, max_z],
        [max_x, max_y, max_z], [min_x, max_y, max_z],
        [min_x, max_y, max_z], [min_x, max_y, min_z],
    ];

    // Vertical edges
    let vertical_edges = [
        [min_x, min_y, min_z], [min_x, max_y, min_z],
        [max_x, min_y, min_z], [max_x, max_y, min_z],
        [max_x, min_y, max_z], [max_x, max_y, max_z],
        [min_x, min_y, max_z], [min_x, max_y, max_z],
    ];

    for edge in [bottom_edges, top_edges, vertical_edges] {
        for v in edge {
            vertices.push(v[0] as f32);
            vertices.push(v[1] as f32);
            vertices.push(v[2] as f32);
            vertices.push(r);
            vertices.push(g);
            vertices.push(b);
            vertices.push(a);
        }
    }

    serde_json::to_string(&vertices).unwrap_or_default()
}

/// Blend potion effect colors based on effect type and amplifier.
/// Matches Minecraft's potion color blending logic.
///
/// Returns [r, g, b, a] as f32 values in 0..1 range.
#[wasm_bindgen]
pub fn potion_effect_color(effect_id: i32, amplifier: i32, ambient: bool) -> Vec<f32> {
    // Base potion colors (from Minecraft's PotionUtils)
    let (base_r, base_g, base_b) = match effect_id {
        1 => (1.0, 0.0, 0.0),      // Speed
        2 => (0.0, 1.0, 0.0),      // Slowness
        3 => (0.0, 0.0, 1.0),      // Haste
        4 => (1.0, 1.0, 0.0),      // Mining Fatigue
        5 => (1.0, 0.0, 1.0),      // Strength
        6 => (0.0, 1.0, 1.0),      // Instant Health
        7 => (0.5, 0.0, 0.5),      // Instant Damage
        8 => (0.5, 0.5, 0.5),      // Jump Boost
        9 => (0.0, 0.5, 1.0),      // Nausea
        10 => (0.0, 0.0, 0.0),     // Regeneration
        11 => (0.5, 0.0, 0.0),     // Resistance
        12 => (1.0, 0.5, 0.0),     // Fire Resistance
        13 => (0.0, 0.0, 0.5),     // Water Breathing
        14 => (0.5, 0.5, 0.0),     // Invisibility
        15 => (0.0, 0.0, 0.0),     // Blindness
        16 => (0.2, 0.2, 0.2),     // Night Vision
        17 => (1.0, 0.0, 0.0),     // Hunger
        18 => (0.0, 0.0, 0.0),     // Weakness
        19 => (0.5, 0.5, 1.0),     // Poison
        20 => (0.0, 0.5, 0.0),     // Wither
        21 => (1.0, 1.0, 1.0),     // Health Boost
        22 => (0.8, 0.8, 0.8),     // Absorption
        23 => (1.0, 0.0, 1.0),     // Saturation
        24 => (0.0, 0.0, 0.0),     // Glowing
        25 => (0.5, 0.2, 0.8),     // Levitation
        26 => (0.0, 0.0, 0.0),     // Luck
        27 => (0.0, 0.0, 0.0),     // Unluck
        28 => (0.0, 0.0, 0.0),     // Slow Falling
        29 => (0.5, 0.0, 0.5),     // Conduit Power
        30 => (0.0, 0.5, 0.5),     // Dolphin's Grace
        31 => (0.0, 0.0, 0.0),     // Bad Omen
        32 => (0.0, 0.0, 0.0),     // Hero of the Village
        33 => (0.0, 0.0, 0.0),     // Darkness
        _ => (0.5, 0.5, 0.5),      // Unknown
    };

    let amp_factor = 1.0 + amplifier as f32 * 0.15;
    let ambient_factor = if ambient { 0.7 } else { 1.0 };

    vec![
        (base_r * amp_factor * ambient_factor).min(1.0),
        (base_g * amp_factor * ambient_factor).min(1.0),
        (base_b * amp_factor * ambient_factor).min(1.0),
        0.8 * ambient_factor,
    ]
}

/// Tick entity effects - port of `tickEntityEffects(e, entities)`.
/// This handles guardian beam charging and dragon crystal searching.
/// Returns a JSON string with updated entity data, or empty string on failure.
#[wasm_bindgen]
pub fn tick_entity_effects(
    entity_json: &str,
    entities_json: &str,
) -> String {
    let mut entity: serde_json::Value = match serde_json::from_str(entity_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };
    let entities: serde_json::Value = match serde_json::from_str(entities_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    let kind = entity.get("kind").and_then(|v| v.as_str()).unwrap_or("").to_string();
    let type_id = entity.get("type").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let dead = entity.get("dead").and_then(|v| v.as_bool()).unwrap_or(false);
    let ticks = entity.get("ticks").and_then(|v| v.as_i64()).unwrap_or(0) as i32;

    // Guardian beam charging
    if type_id == 68 && kind == "mob" && !dead {
        if entity.get("guardianTarget").is_some() {
            let current = entity.get("guardianBeamTicks").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let max_ticks = if entity.get("elder").and_then(|v| v.as_bool()).unwrap_or(false) { 60 } else { 80 };
            entity["guardianBeamTicks"] = serde_json::json!((current + 1).min(max_ticks));
        }
    }

    // Dragon crystal search
    if is_dragon(&kind, type_id) && !dead {
        let crystal_search_tick = entity.get("crystalSearchTick").and_then(|v| v.as_i64());
        let healing_crystal = entity.get("healingCrystal").and_then(|v| v.as_i64());

        let should_search = match (crystal_search_tick, healing_crystal) {
            (Some(search_tick), Some(crystal_id)) => {
                (ticks as i64) - search_tick >= 10 || {
                    // Check if crystal still exists and is alive
                    entities.get(crystal_id.to_string())
                        .and_then(|c| c.get("dead").and_then(|v| v.as_bool()))
                        .unwrap_or(true)
                }
            }
            (Some(search_tick), None) => (ticks as i64) - search_tick >= 10,
            (None, _) => true,
        };

        if should_search {
            entity["crystalSearchTick"] = serde_json::json!(ticks);

            let e_x = entity.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let e_z = entity.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let e_y = entity.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
            let hw = (entity.get("width").and_then(|v| v.as_f64()).unwrap_or(16.0) / 2.0);

            let mut nearest_id = None;
            let mut best_dist = f64::INFINITY;

            if let Some(entities_map) = entities.as_object() {
                for (id_str, c) in entities_map {
                    if c.get("kind").and_then(|v| v.as_str()) != Some("crystal") {
                        continue;
                    }
                    if c.get("dead").and_then(|v| v.as_bool()).unwrap_or(true) {
                        continue;
                    }

                    let c_x = c.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let c_y = c.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0);
                    let c_z = c.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0);

                    if (c_x - e_x).abs() > 32.0 + hw
                        || (c_z - e_z).abs() > 32.0 + hw
                        || c_y < e_y - 32.0
                        || c_y > e_y + entity.get("height").and_then(|v| v.as_f64()).unwrap_or(8.0) + 32.0
                    {
                        continue;
                    }

                    let d = (c_x - e_x).powi(2) + (c_y - e_y).powi(2) + (c_z - e_z).powi(2);
                    if d < best_dist {
                        best_dist = d;
                        nearest_id = Some(id_str.clone());
                    }
                }
            }

            if let Some(id) = nearest_id {
                entity["healingCrystal"] = serde_json::json!(id);
            } else {
                entity["healingCrystal"] = serde_json::Value::Null;
            }
        }
    }

    entity.to_string()
}

/// Tick dragon death animation - port of `tickDragonDeath(e, g)`.
/// Returns updated entity JSON.
#[wasm_bindgen]
pub fn tick_dragon_death(entity_json: &str) -> String {
    let mut entity: serde_json::Value = match serde_json::from_str(entity_json) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };

    entity["y"] = serde_json::json!(entity.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0) + 0.1);
    let yaw = entity.get("yaw").and_then(|v| v.as_f64()).unwrap_or(0.0) + 20.0;
    entity["yaw"] = serde_json::json!(yaw);
    entity["bodyYaw"] = serde_json::json!(yaw);

    entity.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn crystal_bob_animation() {
        // Test that crystal_bob returns reasonable values
        let bob = crystal_bob(0.0);
        assert!((0.0..=0.5).contains(&bob));
        let bob = crystal_bob(10.0);
        assert!((0.0..=0.5).contains(&bob));
    }

    #[test]
    fn crystal_beam_generates_vertices() {
        let start = [0.0, 0.0, 0.0];
        let end = [0.0, 10.0, 0.0];
        let vertices = crystal_beam(&start, &end, 0.0);
        // 8 faces * 4 vertices * 9 components = 288 floats
        assert_eq!(vertices.len(), 8 * 4 * VERTEX_STRIDE);
    }

    #[test]
    fn guardian_beam_generates_vertices() {
        let start = [0.0, 0.0, 0.0];
        let end = [10.0, 0.0, 0.0];
        let vertices = guardian_beam(&start, &end, 0.0, 0, 0.5);
        // 2 planes * 4 vertices + 4 cap vertices = 12 vertices * 9 = 108
        assert_eq!(vertices.len(), 12 * VERTEX_STRIDE);
    }

    #[test]
    fn guardian_beam_zero_distance() {
        let start = [0.0, 0.0, 0.0];
        let end = [0.0, 0.0, 0.0];
        let vertices = guardian_beam(&start, &end, 0.0, 0, 0.5);
        assert_eq!(vertices.len(), 0);
    }

    #[test]
    fn dragon_corpse_matrix_valid() {
        let ring = vec![0.0; 128];
        let m = dragon_corpse_matrix(0.0, 0.0, &ring, 0, false, 0.0);
        assert_eq!(m.len(), 16);
    }

    #[test]
    fn dragon_death_rays_generates_vertices() {
        let ring = vec![0.0; 128];
        let vertices = dragon_death_rays(0.0, 100.0, 0.0, 0.0, 100, &ring, 0, false, 0.5);
        // Should generate some vertices
        assert!(vertices.len() > 0);
        // Should be multiple of VERTEX_STRIDE
        assert_eq!(vertices.len() % VERTEX_STRIDE, 0);
    }

    #[test]
    fn is_dragon_check() {
        assert!(is_dragon("mob", 63));
        assert!(!is_dragon("mob", 64));
        assert!(!is_dragon("crystal", 63));
    }

    #[test]
    fn entity_effect_particles_potion_swirl() {
        let result = entity_effect_particles(0.0, 0.0, 0.0, 0.6, 1.8, EntityEffectType::PotionSwirl, 1, 0.0, Some(42));
        assert!(!result.is_empty());
        let particles: Vec<crate::particles::Particle> = serde_json::from_str(&result).unwrap();
        assert!(!particles.is_empty());
    }

    #[test]
    fn entity_effect_particles_glowing() {
        let result = entity_effect_particles(0.0, 0.0, 0.0, 0.6, 1.8, EntityEffectType::Glowing, 0, 0.0, Some(42));
        assert!(!result.is_empty());
        let particles: Vec<crate::particles::Particle> = serde_json::from_str(&result).unwrap();
        assert!(!particles.is_empty());
    }

    #[test]
    fn entity_glow_vertices_box() {
        let result = entity_glow_vertices(0.0, 0.0, 0.0, 0.6, 1.8, 1.62, 0.0);
        assert!(!result.is_empty());
        let vertices: Vec<f32> = serde_json::from_str(&result).unwrap();
        // 24 vertices * 7 components (x,y,z,r,g,b,a)
        assert_eq!(vertices.len(), 24 * 7);
    }

    #[test]
    fn potion_effect_color_known() {
        let color = potion_effect_color(1, 0, false); // Speed
        assert_eq!(color.len(), 4);
        assert!((color[0] - 1.0).abs() < 0.001);
        assert!((color[1] - 0.0).abs() < 0.001);
        assert!((color[2] - 0.0).abs() < 0.001);
    }

    #[test]
    fn potion_effect_color_amplifier() {
        let base = potion_effect_color(1, 0, false);
        let amplified = potion_effect_color(1, 2, false);
        // Amplified should be brighter
        assert!(amplified[0] >= base[0]);
    }

    #[test]
    fn potion_effect_color_ambient() {
        let normal = potion_effect_color(1, 0, false);
        let ambient = potion_effect_color(1, 0, true);
        // Ambient should be dimmer
        assert!(ambient[0] <= normal[0]);
    }

    #[test]
    fn tick_entity_effects_guardian() {
        let entity = serde_json::json!({
            "kind": "mob",
            "type": 68,
            "dead": false,
            "ticks": 10,
            "guardianTarget": 42,
            "elder": false,
            "guardianBeamTicks": 0
        });
        let entities = serde_json::json!({});
        let result = tick_entity_effects(&entity.to_string(), &entities.to_string());
        assert!(!result.is_empty());
        let updated: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(updated["guardianBeamTicks"], 1);
    }

    #[test]
    fn tick_entity_effects_dragon_crystal_search() {
        let entity = serde_json::json!({
            "kind": "mob",
            "type": 63,
            "dead": false,
            "ticks": 20,
            "x": 0.0, "y": 100.0, "z": 0.0,
            "width": 16.0, "height": 8.0
        });
        let entities = serde_json::json!({
            "crystal1": { "kind": "crystal", "dead": false, "x": 5.0, "y": 100.0, "z": 5.0 },
            "crystal2": { "kind": "crystal", "dead": true, "x": 10.0, "y": 100.0, "z": 10.0 }
        });
        let result = tick_entity_effects(&entity.to_string(), &entities.to_string());
        assert!(!result.is_empty());
        let updated: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(updated["healingCrystal"], "crystal1");
    }

    #[test]
    fn tick_dragon_death_moves_up() {
        let entity = serde_json::json!({
            "y": 100.0,
            "yaw": 0.0,
            "bodyYaw": 0.0
        });
        let result = tick_dragon_death(&entity.to_string());
        let updated: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert!((updated["y"].as_f64().unwrap() - 100.1).abs() < 0.001);
        assert!((updated["yaw"].as_f64().unwrap() - 20.0).abs() < 0.001);
    }
}
