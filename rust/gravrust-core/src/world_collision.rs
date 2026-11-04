//! Collision boxes, swept collision queries and ray tracing for the Rust
//! world engine â€” the remaining algorithmic half of
//! `client/js/world/world.js`.
//!
//! The block registry supplies per-state shapes; `WorldCore` supplies chunk
//! storage and loaded-chunk tests. Entity colliders and shulker-box callbacks
//! stay in the caller and can be appended to the returned boxes.

use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

use crate::blocks::{BlockRegistry, BlockRegistryCore};
use crate::collision::scaffolding_collision;
use crate::world::WorldCore;

fn fluid_height(reg: &BlockRegistry, state: u32) -> Option<f64> {
    let def = reg.def(state);
    let level = reg
        .property(state, "level")
        .and_then(|v| v.parse::<i32>().ok())
        .unwrap_or(0);
    if def.is_liquid {
        return Some((8 - if level >= 8 { 0 } else { level }) as f64 / 9.0);
    }
    if reg.property(state, "waterlogged") == Some("true")
        || matches!(def.name.as_str(), "seagrass" | "tall_seagrass" | "kelp" | "kelp_plant")
    {
        return Some(8.0 / 9.0);
    }
    None
}

fn fluid_height_at(reg: &BlockRegistry, world: &WorldCore, x: i32, y: i32, z: i32) -> f64 {
    let state = world.get_state(x, y, z);
    let Some(height) = fluid_height(reg, state) else { return 0.0 };
    let above = fluid_height(reg, world.get_state(x, y + 1, z));
    match above {
        Some(_) => 1.0,
        None => height,
    }
}

/// `World.collisionBoxes` for the static-shape path. Scaffolding needs the
/// mover's feet/sneaking state, which the caller supplies.
pub fn collision_boxes(
    reg: &BlockRegistry,
    x: i32,
    y: i32,
    z: i32,
    state: u32,
    mover_feet: Option<f64>,
    sneaking: bool,
) -> Vec<[f64; 6]> {
    let def = reg.def(state);
    if def.id == 0 || def.name == "moving_piston" {
        return Vec::new();
    }
    let mut out = Vec::new();
    let boxes = if def.name == "scaffolding" {
        let distance = reg.property(state, "distance").unwrap_or("0");
        let bottom = reg.property(state, "bottom") == Some("true");
        let distance = distance.parse::<i32>().unwrap_or(0);
        let feet = mover_feet.unwrap_or(f64::INFINITY); // no mover -> Infinity, as in the JS helper
        scaffolding_collision(distance, bottom, feet, y as f64, sneaking)
            .chunks_exact(6)
            .map(|c| [c[0], c[1], c[2], c[3], c[4], c[5]])
            .collect::<Vec<[f64; 6]>>()
    } else {
        reg.static_collision_boxes(state)
    };
    for b in boxes {
        out.push([
            x as f64 + b[0],
            y as f64 + b[1],
            z as f64 + b[2],
            x as f64 + b[3],
            y as f64 + b[4],
            z as f64 + b[5],
        ]);
    }
    out
}

/// `World.getCollisions` without entity/moving-piston callbacks.
pub fn get_collisions(world: &WorldCore, reg: &BlockRegistry, bb: &[f64; 6]) -> Vec<[f64; 6]> {
    let mut out = Vec::new();
    let x0 = bb[0].floor() as i32 - 1;
    let x1 = (bb[3] + 1.0).floor() as i32 + 1;
    let y0 = bb[1].floor() as i32 - 1;
    let y1 = (bb[4] + 1.0).floor() as i32;
    let z0 = bb[2].floor() as i32 - 1;
    let z1 = (bb[5] + 1.0).floor() as i32 + 1;
    for x in x0..x1 {
        for z in z0..z1 {
            if !world.is_loaded(x >> 4, z >> 4) {
                for y in y0.max(0)..y1 {
                    out.push([x as f64, y as f64, z as f64, x as f64 + 1.0, y as f64 + 1.0, z as f64 + 1.0]);
                }
                continue;
            }
            for y in y0..y1 {
                let state = world.get_state(x, y, z);
                for c in collision_boxes(reg, x, y, z, state, None, false) {
                    if c[3] > bb[0] && c[0] < bb[3] && c[4] > bb[1] && c[1] < bb[4] && c[5] > bb[2] && c[2] < bb[5] {
                        out.push(c);
                    }
                }
            }
        }
    }
    out
}

pub fn selection_box(reg: &BlockRegistry, state: u32) -> Option<[f64; 6]> {
    let def = reg.def(state);
    if def.is_air || def.id == 0 || def.is_liquid {
        return None;
    }
    Some([0.0, 0.0, 0.0, 1.0, 1.0, 1.0])
}

/// Port of the free function `rayBox` in world.js. Returns `(t, face)`.
pub fn ray_box_world(origin: [f64; 3], dir: [f64; 3], min: [f64; 3], max: [f64; 3]) -> Option<(f64, i32)> {
    let mut tmin = f64::NEG_INFINITY;
    let mut tmax = f64::INFINITY;
    let mut face: i32 = -1;
    let axes = [
        (origin[0], dir[0], min[0], max[0], 4, 5),
        (origin[1], dir[1], min[1], max[1], 0, 1),
        (origin[2], dir[2], min[2], max[2], 2, 3),
    ];
    for (o, d, mn, mx, neg_face, pos_face) in axes {
        if d.abs() < 1e-12 {
            if o < mn || o > mx {
                return None;
            }
            continue;
        }
        let mut t1 = (mn - o) / d;
        let mut t2 = (mx - o) / d;
        let mut f1 = neg_face;
        let mut f2 = pos_face;
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
            return None;
        }
    }
    if tmax < 0.0 {
        return None;
    }
    if tmin < 0.0 {
        return Some((0.0, face));
    }
    Some((tmin, face))
}

pub struct RayHit {
    pub x: i32,
    pub y: i32,
    pub z: i32,
    pub face: i32,
    pub hit: [f64; 3],
    pub state: u32,
    pub dist: f64,
    pub box_: [f64; 6],
}

/// `World.raycast`. `liquid_mode`: 0 = skip fluids, 1 = source water/lava, 2 = any fluid surface.
pub fn raycast(
    world: &WorldCore,
    reg: &BlockRegistry,
    origin: [f64; 3],
    dir: [f64; 3],
    max_dist: f64,
    liquid_mode: u32,
    collider: bool,
) -> Option<RayHit> {
    let mut x = origin[0].floor() as i32;
    let mut y = origin[1].floor() as i32;
    let mut z = origin[2].floor() as i32;
    let step_x = if dir[0] > 0.0 { 1 } else if dir[0] < 0.0 { -1 } else { 0 };
    let step_y = if dir[1] > 0.0 { 1 } else if dir[1] < 0.0 { -1 } else { 0 };
    let step_z = if dir[2] > 0.0 { 1 } else if dir[2] < 0.0 { -1 } else { 0 };
    let t_delta_x = if step_x != 0 { (1.0 / dir[0]).abs() } else { f64::INFINITY };
    let t_delta_y = if step_y != 0 { (1.0 / dir[1]).abs() } else { f64::INFINITY };
    let t_delta_z = if step_z != 0 { (1.0 / dir[2]).abs() } else { f64::INFINITY };
    let mut t_max_x = if step_x != 0 {
        (if step_x > 0 { x as f64 + 1.0 - origin[0] } else { origin[0] - x as f64 }) * t_delta_x
    } else {
        f64::INFINITY
    };
    let mut t_max_y = if step_y != 0 {
        (if step_y > 0 { y as f64 + 1.0 - origin[1] } else { origin[1] - y as f64 }) * t_delta_y
    } else {
        f64::INFINITY
    };
    let mut t_max_z = if step_z != 0 {
        (if step_z > 0 { z as f64 + 1.0 - origin[2] } else { origin[2] - z as f64 }) * t_delta_z
    } else {
        f64::INFINITY
    };
    for _ in 0..200 {
        let state = world.get_state(x, y, z);
        if state != 0 {
            let def = reg.def(state);
            let mut boxes: Vec<[f64; 6]> = Vec::new();
            if def.is_liquid {
                if liquid_mode == 1 && reg.property(state, "level").unwrap_or("0") == "0" {
                    boxes.push([0.0, 0.0, 0.0, 1.0, 0.875, 1.0]);
                }
            } else if !collider {
                if let Some(b) = selection_box(reg, state) {
                    boxes.push(b);
                }
            }
            if collider {
                boxes = reg.static_collision_boxes(state);
            }
            if liquid_mode == 2 && fluid_height(reg, state).is_some() {
                boxes.push([0.0, 0.0, 0.0, 1.0, fluid_height_at(reg, world, x, y, z), 1.0]);
            }
            let mut nearest: Option<(f64, i32, [f64; 6])> = None;
            for b in &boxes {
                if let Some((t, face)) = ray_box_world(
                    origin,
                    dir,
                    [x as f64 + b[0], y as f64 + b[1], z as f64 + b[2]],
                    [x as f64 + b[3], y as f64 + b[4], z as f64 + b[5]],
                ) {
                    if t <= max_dist && nearest.as_ref().map(|n| t < n.0).unwrap_or(true) {
                        nearest = Some((t, face, *b));
                    }
                }
            }
            if let Some((t, face, b)) = nearest {
                return Some(RayHit {
                    x,
                    y,
                    z,
                    face,
                    hit: [origin[0] + dir[0] * t, origin[1] + dir[1] * t, origin[2] + dir[2] * t],
                    state,
                    dist: t,
                    box_: b,
                });
            }
        }
        if t_max_x < t_max_y && t_max_x < t_max_z {
            if t_max_x > max_dist {
                break;
            }
            x += step_x;
            t_max_x += t_delta_x;
        } else if t_max_y < t_max_z {
            if t_max_y > max_dist {
                break;
            }
            y += step_y;
            t_max_y += t_delta_y;
        } else {
            if t_max_z > max_dist {
                break;
            }
            z += step_z;
            t_max_z += t_delta_z;
        }
    }
    None
}

/// `World.isRainingAt` with the biome precipitation passed in.
pub fn is_raining_at(
    world: &WorldCore,
    reg: &BlockRegistry,
    x: f64,
    y: f64,
    z: f64,
    precipitation: &str,
    rain_strength: f64,
) -> bool {
    let x = x.floor() as i32;
    let y = y.floor() as i32;
    let z = z.floor() as i32;
    if !world.has_sky() || rain_strength <= 0.2 || !world.is_loaded(x >> 4, z >> 4) {
        return false;
    }
    if precipitation != "rain" {
        return false;
    }
    for above in y.max(0)..256 {
        let def = reg.def(world.get_state(x, above, z));
        if def.bounding_box == "block" || def.is_liquid {
            return false;
        }
    }
    true
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub fn world_collision_boxes(
    world: &WorldCore,
    reg: &BlockRegistryCore,
    x: i32,
    y: i32,
    z: i32,
) -> Vec<f64> {
    let state = world.get_state(x, y, z);
    let boxes = collision_boxes(reg.registry(), x, y, z, state, None, false);
    boxes.into_iter().flatten().collect()
}

#[wasm_bindgen]
pub fn world_get_collisions(world: &WorldCore, reg: &BlockRegistryCore, bb: &[f64]) -> Vec<f64> {
    if bb.len() < 6 {
        return Vec::new();
    }
    let bb = [bb[0], bb[1], bb[2], bb[3], bb[4], bb[5]];
    get_collisions(world, reg.registry(), &bb).into_iter().flatten().collect()
}

#[wasm_bindgen]
pub fn world_raycast(
    world: &WorldCore,
    reg: &BlockRegistryCore,
    origin: &[f64],
    dir: &[f64],
    max_dist: f64,
    liquid_mode: u32,
    collider: bool,
) -> String {
    if origin.len() < 3 || dir.len() < 3 {
        return "null".into();
    }
    match raycast(
        world,
        reg.registry(),
        [origin[0], origin[1], origin[2]],
        [dir[0], dir[1], dir[2]],
        max_dist,
        liquid_mode,
        collider,
    ) {
        None => "null".into(),
        Some(hit) => json!({
            "x": hit.x, "y": hit.y, "z": hit.z,
            "face": hit.face,
            "hit": hit.hit,
            "state": hit.state,
            "dist": hit.dist,
            "box": hit.box_,
        })
        .to_string(),
    }
}

#[wasm_bindgen]
pub fn world_is_raining_at(
    world: &WorldCore,
    reg: &BlockRegistryCore,
    x: f64,
    y: f64,
    z: f64,
    precipitation: &str,
    rain_strength: f64,
) -> bool {
    is_raining_at(world, reg.registry(), x, y, z, precipitation, rain_strength)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ray_box_hits_faces() {
        // Straight down onto a cube's top face.
        let hit = ray_box_world([0.5, 2.0, 0.5], [0.0, -1.0, 0.0], [0.0, 0.0, 0.0], [1.0, 1.0, 1.0]);
        let (t, face) = hit.unwrap();
        assert!((t - 1.0).abs() < 1e-9);
        assert_eq!(face, 1);
    }

    #[test]
    fn ray_box_misses_parallel_lines() {
        assert!(ray_box_world([2.0, 2.0, 2.0], [0.0, -1.0, 0.0], [0.0, 0.0, 0.0], [1.0, 1.0, 1.0]).is_none());
    }

    #[test]
    fn ray_box_starts_inside() {
        let (t, _) = ray_box_world([0.5, 0.5, 0.5], [1.0, 0.0, 0.0], [0.0, 0.0, 0.0], [1.0, 1.0, 1.0]).unwrap();
        assert_eq!(t, 0.0);
    }
}
