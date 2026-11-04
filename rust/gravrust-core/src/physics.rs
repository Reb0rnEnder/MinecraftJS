//! Port of `client/js/game/physics.js`.
//!
//! Pure AABB sweep helpers, MathHelper sin/cos tables, fastInvSqrt, and
//! honey‑block factors. These are the portable parts that can be compiled
//! to WASM and used from the JavaScript client without depending on the
//! full Minecraft world model.

use wasm_bindgen::prelude::*;

/// `MathHelper.sin` via a 65536‑entry float table, matching vanilla behaviour.
const SIN_SCALE: f32 = 10430.378;
const F_PI: f32 = std::f32::consts::PI;
const DEG: f32 = 0.017453292;

fn sin_table() -> &'static [f32] {
    static TABLE: std::sync::OnceLock<Vec<f32>> = std::sync::OnceLock::new();
    TABLE.get_or_init(|| {
        (0..65536u32)
            .map(|i| ((i as f64) * std::f64::consts::PI * 2.0 / 65536.0).sin() as f32)
            .collect()
    })
}

/// `MathHelper.sin`: a 65536‑entry float table, not `sin()`.
pub fn mc_sin(value: f64) -> f64 {
    let scaled = ((value as f32) as f64 * SIN_SCALE as f64) as f32;
    let index = (scaled as f64).trunc() as i64 & 65535;
    sin_table()[index as usize] as f64
}

/// `MathHelper.cos`, i.e. the sin table offset by a quarter turn.
pub fn mc_cos(value: f64) -> f64 {
    let scaled = ((value as f32) as f64 * SIN_SCALE as f64) as f32;
    let shifted = (scaled as f64 + 16384.0) as f32;
    let index = (shifted as f64).trunc() as i64 & 65535;
    sin_table()[index as usize] as f64
}

/// `Entity.calculateXOffset`‑style sweep clamp on the X axis.
#[wasm_bindgen]
pub fn calc_x_offset(
    box_: &[f64],
    bb: &[f64],
    mut offset: f64,
) -> f64 {
    if bb.len() < 6 || box_.len() < 6 {
        return offset;
    }
    if bb[3] > box_[1] && bb[1] < box_[4] && bb[5] > box_[2] && bb[2] < box_[5] {
        if offset > 0.0 {
            if bb[3] <= box_[0] {
                let d = box_[0] - bb[3];
                if d < offset {
                    offset = d;
                }
            }
        } else if offset < 0.0 && bb[0] >= box_[3] {
            let d = box_[3] - bb[0];
            if d > offset {
                offset = d;
            }
        }
    }
    offset
}

/// `Entity.calculateYOffset`‑style sweep clamp on the Y axis.
#[wasm_bindgen]
pub fn calc_y_offset(
    box_: &[f64],
    bb: &[f64],
    mut offset: f64,
) -> f64 {
    if bb.len() < 6 || box_.len() < 6 {
        return offset;
    }
    if bb[3] > box_[0] && bb[0] < box_[3] && bb[5] > box_[2] && bb[2] < box_[5] {
        if offset > 0.0 {
            if bb[4] <= box_[1] {
                let d = box_[1] - bb[4];
                if d < offset {
                    offset = d;
                }
            }
        } else if offset < 0.0 && bb[1] >= box_[4] {
            let d = box_[4] - bb[1];
            if d > offset {
                offset = d;
            }
        }
    }
    offset
}

/// `Entity.calculateZOffset`‑style sweep clamp on the Z axis.
#[wasm_bindgen]
pub fn calc_z_offset(
    box_: &[f64],
    bb: &[f64],
    mut offset: f64,
) -> f64 {
    if bb.len() < 6 || box_.len() < 6 {
        return offset;
    }
    if bb[3] > box_[0] && bb[0] < box_[3] && bb[4] > box_[1] && bb[1] < box_[4] {
        if offset > 0.0 {
            if bb[5] <= box_[2] {
                let d = box_[2] - bb[5];
                if d < offset {
                    offset = d;
                }
            }
        } else if offset < 0.0 && bb[2] >= box_[5] {
            let d = box_[5] - bb[2];
            if d > offset {
                offset = d;
            }
        }
    }
    offset
}

/// `MathHelper.fastInvSqrt`: double bit trick plus one Newton step.
#[wasm_bindgen]
pub fn fast_inv_sqrt(value: f64) -> f64 {
    let half = 0.5 * value;
    let bits = value.to_bits();
    let magic = 6_910_469_410_427_058_090u64;
    let v = f64::from_bits(magic.wrapping_sub(bits >> 1));
    v * (1.5 - half * v * v)
}

/// Ray/AABB slab test, same face numbering as `rayBox` (`DOWN/UP/NORTH/SOUTH/WEST/EAST`).
/// Returns `(hit, t, face)`; `hit` is false when the ray misses.
#[wasm_bindgen]
pub fn ray_box(
    ox: f64,
    oy: f64,
    oz: f64,
    dx: f64,
    dy: f64,
    dz: f64,
    x0: f64,
    y0: f64,
    z0: f64,
    x1: f64,
    y1: f64,
    z1: f64,
) -> Vec<f64> {
    // [hit(0/1), t, face]
    let axes = [
        (ox, dx, x0, x1, 4.0, 5.0),
        (oy, dy, y0, y1, 0.0, 1.0),
        (oz, dz, z0, z1, 2.0, 3.0),
    ];
    let mut tmin = f64::NEG_INFINITY;
    let mut tmax = f64::INFINITY;
    let mut face = -1.0;

    for (o, d, min, max, negative_face, positive_face) in axes {
        if d.abs() < 1e-12 {
            if o < min || o > max {
                return vec![0.0, 0.0, -1.0];
            }
            continue;
        }
        let mut t1 = (min - o) / d;
        let mut t2 = (max - o) / d;
        let mut f1 = negative_face;
        let mut f2 = positive_face;
        if t1 > t2 {
            std::mem::swap(&mut t1, &mut t2);
            std::mem::swap(&mut f1, &mut f2);
        }
        if t1 > tmin {
            tmin = t1;
            face = f1;
        }
        if t2 < tmax {
            tmax = t2;
        }
        if tmin > tmax {
            return vec![0.0, 0.0, -1.0];
        }
    }
    if tmax < 0.0 {
        return vec![0.0, 0.0, -1.0];
    }
    if tmin < 0.0 {
        vec![1.0, 0.0, face]
    } else {
        vec![1.0, tmin, face]
    }
}

// ------------------------------------------------------- MathHelper + honey

/// `HoneyBlock.onFallenUpon` multiplier.
pub fn honey_fall_multiplier(block_name: &str) -> f64 {
    if block_name == "honey_block" { 0.2 } else { 1.0 }
}

pub fn honey_jump_factor(block_name: &str) -> f64 {
    // `Math.fround(0.5)` is exactly 0.5.
    if block_name == "honey_block" { 0.5 } else { 1.0 }
}

pub fn honey_movement_factor(block_name: &str) -> f64 {
    // A plain JS literal: the double 0.4, not the float32 widened value.
    if block_name == "honey_block" { 0.4 } else { 1.0 }
}

/// `Entity.getVectorForRotation`, in vanilla float maths.
pub fn look_vec(pitch: f64, yaw: f64) -> [f64; 3] {
    let yaw_angle = ((-yaw as f32) * DEG) as f64 - F_PI as f64;
    let yaw_angle = yaw_angle as f32 as f64;
    let f = mc_cos(yaw_angle);
    let f1 = mc_sin(yaw_angle);
    let pitch_angle = ((-pitch as f32) * DEG) as f32 as f64;
    let f2 = -mc_cos(pitch_angle);
    let f3 = mc_sin(pitch_angle);
    [(f1 * f2) as f32 as f64, f3, (f * f2) as f32 as f64]
}

/// `offsetBB`: shift an AABB by (x, y, z).
pub fn offset_bb(bb: &[f64], x: f64, y: f64, z: f64) -> [f64; 6] {
    [
        bb[0] + x,
        bb[1] + y,
        bb[2] + z,
        bb[3] + x,
        bb[4] + y,
        bb[5] + z,
    ]
}

/// `addCoord`: grow the swept box only on the side the motion moves towards.
pub fn add_coord(bb: &[f64], x: f64, y: f64, z: f64) -> [f64; 6] {
    let mut out = [bb[0], bb[1], bb[2], bb[3], bb[4], bb[5]];
    if x < 0.0 { out[0] += x } else { out[3] += x }
    if y < 0.0 { out[1] += y } else { out[4] += y }
    if z < 0.0 { out[2] += z } else { out[5] += z }
    out
}

// ---------- WASM‑bound wrappers ----------

#[wasm_bindgen]
pub fn mc_sin_wasm(value: f64) -> f64 {
    mc_sin(value)
}

#[wasm_bindgen]
pub fn mc_cos_wasm(value: f64) -> f64 {
    mc_cos(value)
}

#[wasm_bindgen]
pub fn honey_fall_multiplier_wasm(block_name: &str) -> f64 {
    honey_fall_multiplier(block_name)
}

#[wasm_bindgen]
pub fn honey_jump_factor_wasm(block_name: &str) -> f64 {
    honey_jump_factor(block_name)
}

#[wasm_bindgen]
pub fn honey_movement_factor_wasm(block_name: &str) -> f64 {
    honey_movement_factor(block_name)
}

#[wasm_bindgen]
pub fn look_vec_wasm(pitch: f64, yaw: f64) -> Vec<f64> {
    look_vec(pitch, yaw).to_vec()
}

#[wasm_bindgen]
pub fn offset_bb_wasm(bb: &[f64], x: f64, y: f64, z: f64) -> Vec<f64> {
    offset_bb(bb, x, y, z).to_vec()
}

#[wasm_bindgen]
pub fn add_coord_wasm(bb: &[f64], x: f64, y: f64, z: f64) -> Vec<f64> {
    add_coord(bb, x, y, z).to_vec()
}

#[wasm_bindgen]
pub fn fast_inv_sqrt_wasm(value: f64) -> f64 {
    fast_inv_sqrt(value)
}

// ------------------------------------------------------- Tests

#[cfg(test)]
mod tests {
    use super::*;

    const BOX: [f64; 6] = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0];

    #[test]
    fn clamps_a_positive_x_sweep() {
        // Entity box just west of the block, moving +x by 1.0: stop at x = 0.
        let bb = [-0.9, 0.1, 0.2, -0.5, 0.9, 0.8];
        let offset = calc_x_offset(&BOX, &bb, 1.0);
        assert!((offset - 0.5).abs() < 1e-12);
    }

    #[test]
    fn leaves_a_non_overlapping_axis_alone() {
        let bb = [-0.4, 2.0, 0.2, 0.2, 3.0, 0.8];
        assert_eq!(calc_x_offset(&BOX, &bb, 0.5), 0.5);
        let bb = [-0.4, 0.1, 0.2, 0.2, 0.9, 0.8];
        assert_eq!(calc_y_offset(&BOX, &bb, 0.5), 0.5);
    }

    #[test]
    fn clamps_negative_y_sweeps() {
        let bb = [0.2, 1.4, 0.2, 0.8, 2.2, 0.8];
        let offset = calc_y_offset(&BOX, &bb, -0.5);
        assert!((offset - -0.4).abs() < 1e-12);
    }

    #[test]
    fn fast_inv_sqrt_is_accurate() {
        for value in [0.25f64, 1.0, 2.0, 9.0, 1e6] {
            let expected = 1.0 / value.sqrt();
            let actual = fast_inv_sqrt(value);
            assert!((actual - expected).abs() / expected < 2e-3);
        }
    }

    #[test]
    fn ray_hits_and_reports_the_face() {
        let hit = ray_box(0.5, 0.5, -2.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0);
        assert_eq!(hit[0], 1.0);
        assert!((hit[1] - 2.0).abs() < 1e-12);
        assert_eq!(hit[2], 2.0); // north face
    }

    #[test]
    fn ray_misses_and_inside_hits() {
        let miss = ray_box(-2.0, 0.5, -2.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0);
        assert_eq!(miss[0], 0.0);
        let inside = ray_box(0.5, 0.5, 0.5, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0);
        assert_eq!(inside[0], 1.0);
        assert_eq!(inside[1], 0.0);
    }

    #[test]
    fn sin_table_matches_the_vanilla_quadrants() {
        // MathHelper.sin/cos take radians; the table itself has 65536 steps.
        let half_pi = std::f64::consts::FRAC_PI_2;
        assert!(mc_sin(0.0).abs() < 1e-4);
        assert!((mc_sin(half_pi) - 1.0).abs() < 1e-4);
        assert!(mc_sin(std::f64::consts::PI).abs() < 1e-4);
        assert!(mc_cos(0.0).abs() < 1e-4);
        assert!((mc_cos(half_pi)).abs() < 1e-4);
        assert!((mc_cos(std::f64::consts::PI) + 1.0).abs() < 1e-4);
    }

    #[test]
    fn honey_factors_only_apply_to_honey_blocks() {
        assert!((honey_fall_multiplier("honey_block") - 0.2).abs() < 1e-12);
        assert_eq!(honey_fall_multiplier("stone"), 1.0);
        assert!((honey_jump_factor("honey_block") - 0.5).abs() < 1e-7);
        assert!((honey_movement_factor("honey_block") - 0.4).abs() < 1e-7);
        assert_eq!(honey_movement_factor("ice"), 1.0);
    }

    #[test]
    fn look_vector_points_where_the_entity_faces() {
        // Vanilla yaw 0 looks south, i.e. towards +Z.
        let forward = look_vec(0.0, 0.0);
        assert!(forward[0].abs() < 1e-5);
        assert!(forward[1].abs() < 1e-5);
        assert!((forward[2] - 1.0).abs() < 1e-5);
        let down = look_vec(90.0, 0.0);
        assert!((down[1] + 1.0).abs() < 1e-5);
    }

    #[test]
    fn add_coord_only_grows_the_swept_box() {
        let bb = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0];
        assert_eq!(add_coord(&bb, -2.0, 0.0, 3.0), [-2.0, 0.0, 0.0, 1.0, 1.0, 4.0]);
        assert_eq!(offset_bb(&bb, 1.0, 2.0, 3.0), [1.0, 2.0, 3.0, 2.0, 3.0, 4.0]);
    }
}