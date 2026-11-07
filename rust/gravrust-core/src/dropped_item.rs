//! Port of `client/js/game/dropped-item.js` (upstream MinecraftJS 1.8.9).
//!
//! Native ItemEntity movement, using swept block shapes instead of an
//! opaque-cell test. Uses the real `calc{X,Y,Z}Offset` from
//! [`crate::physics`] (ported 1:1 from upstream `physics.js`).

use crate::physics::{calc_x_offset, calc_y_offset, calc_z_offset};

/// JS: `const MODERN_REST = false;` — the 1.14 rest optimization is off for
/// the 1.8.9 target: older clients move every tick.
const MODERN_REST: bool = false;

/// JS: `const GRAVITY = Math.fround(.04)`.
const GRAVITY: f64 = 0.04f32 as f64;
/// JS: `const VERTICAL_DRAG = Math.fround(.98)`.
const VERTICAL_DRAG: f64 = 0.98f32 as f64;

/// JS: `const f = Math.fround`.
#[inline]
fn fround(v: f64) -> f64 {
    v as f32 as f64
}

/// The world surface `tickDroppedItem` needs. `bb()`-style geometry is passed
/// explicitly; block definitions are reduced to the one field this module
/// reads (`slipperiness`, defaulting to 0.6 like the JS `?? .6`).
pub trait DroppedItemWorld {
    /// JS: `world.getCollisions(swept, e)` — block shapes overlapping `swept`.
    fn get_collisions(&self, swept: &[f64; 6]) -> Vec<[f64; 6]>;
    /// JS: `world.getBlockDef(x, y, z)?.slipperiness ?? .6`.
    fn slipperiness_at(&self, x: i64, y: i64, z: i64) -> f64;
}

/// The entity fields this module mutates. Mirrors the JS ItemEntity surface.
#[derive(Debug, Clone)]
pub struct DroppedItem {
    pub id: i64,
    pub ticks: i64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub motion_x: f64,
    pub motion_y: f64,
    pub motion_z: f64,
    pub width: f64,
    pub height: f64,
    pub no_gravity: bool,
    pub on_ground: bool,
}

impl Default for DroppedItem {
    fn default() -> Self {
        DroppedItem {
            id: 0,
            ticks: 0,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            motion_x: 0.0,
            motion_y: 0.0,
            motion_z: 0.0,
            width: 0.25,  // JS: (e.width || .25)
            height: 0.25, // JS: (e.height || .25)
            no_gravity: false,
            on_ground: false,
        }
    }
}

/// JS: `tickDroppedItem(e, world)` — 1:1.
pub fn tick_dropped_item(e: &mut DroppedItem, world: &dyn DroppedItemWorld) {
    if !e.no_gravity {
        e.motion_y -= GRAVITY;
    }
    // Introduced with the 1.14 item movement optimization; older clients move
    // every tick (MODERN_REST is false for 1.8.9, so this branch is dead —
    // kept for parity).
    if MODERN_REST
        && e.on_ground
        && e.motion_x * e.motion_x + e.motion_z * e.motion_z <= fround(1e-5)
        && ((e.ticks.max(0)) + e.id) % 4 != 0
    {
        return;
    }
    let mut dx = e.motion_x;
    let mut dy = e.motion_y;
    let mut dz = e.motion_z;

    // JS: half = (e.width || .25) / 2
    let half = if e.width != 0.0 { e.width } else { 0.25 } / 2.0;
    let bb: [f64; 6] = [
        e.x - half,
        e.y,
        e.z - half,
        e.x + half,
        e.y + if e.height != 0.0 { e.height } else { 0.25 },
        e.z + half,
    ];
    let swept: [f64; 6] = [
        bb[0] + dx.min(0.0),
        bb[1] + dy.min(0.0),
        bb[2] + dz.min(0.0),
        bb[3] + dx.max(0.0),
        bb[4] + dy.max(0.0),
        bb[5] + dz.max(0.0),
    ];
    let boxes = world.get_collisions(&swept);

    // Y first.
    for b in &boxes {
        dy = calc_y_offset(b, &bb, dy);
    }
    let mut bb = bb;
    bb[1] += dy;
    bb[4] += dy;

    // Modern Entity.collide resolves the larger horizontal displacement
    // first; 1.8.9 resolves X then Z (`zFirst` is a constant false).
    let z_first = false && dx.abs() < dz.abs();
    if z_first {
        for b in &boxes {
            dz = calc_z_offset(b, &bb, dz);
        }
        bb[2] += dz;
        bb[5] += dz;
    }
    for b in &boxes {
        dx = calc_x_offset(b, &bb, dx);
    }
    bb[0] += dx;
    bb[3] += dx;
    if !z_first {
        for b in &boxes {
            dz = calc_z_offset(b, &bb, dz);
        }
        bb[2] += dz;
        bb[5] += dz;
    }

    e.x = (bb[0] + bb[3]) / 2.0;
    e.y = bb[1];
    e.z = (bb[2] + bb[5]) / 2.0;

    // JS: e.onGround = dy !== e.motionY && e.motionY < 0
    e.on_ground = dy != e.motion_y && e.motion_y < 0.0;

    // Cancel motion on any axis the collision resolution changed.
    if dx != e.motion_x {
        e.motion_x = 0.0;
    }
    if dy != e.motion_y {
        e.motion_y = 0.0;
    }
    if dz != e.motion_z {
        e.motion_z = 0.0;
    }

    // JS: drag = fround(.98); on ground: fround(fround(slipperiness ?? .6) * fround(.98))
    let mut drag = fround(0.98);
    if e.on_ground {
        let slip = world.slipperiness_at((e.x.floor()) as i64, (e.y - 1.0).floor() as i64, (e.z.floor()) as i64);
        drag = fround(fround(slip) * fround(0.98));
    }
    e.motion_x *= drag;
    e.motion_y *= VERTICAL_DRAG;
    e.motion_z *= drag;

    // JS: if (e.onGround && e.motionY < 0) e.motionY *= -.5
    if e.on_ground && e.motion_y < 0.0 {
        e.motion_y *= -0.5;
    }

    e.ticks += 1;
}

/// A world of solid full blocks at floor positions — used by tests and as the
/// minimal host surface until the full world module is wired in.
pub struct SolidFloorWorld {
    pub floor_y: i64,
    pub slipperiness: f64,
}

impl DroppedItemWorld for SolidFloorWorld {
    fn get_collisions(&self, swept: &[f64; 6]) -> Vec<[f64; 6]> {
        if swept[1] <= (self.floor_y + 1) as f64 && swept[4] >= self.floor_y as f64 {
            vec!([0.0, self.floor_y as f64, 0.0, 1.0, (self.floor_y + 1) as f64, 1.0])
        } else {
            vec![]
        }
    }
    fn slipperiness_at(&self, _x: i64, _y: i64, _z: i64) -> f64 {
        self.slipperiness
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn item_falls_and_rests_on_floor() {
        let world = SolidFloorWorld { floor_y: 0, slipperiness: 0.6 };
        let mut e = DroppedItem { y: 3.0, ..Default::default() };
        for _ in 0..200 {
            tick_dropped_item(&mut e, &world);
        }
        assert!(e.on_ground, "item should land");
        assert!((e.y - 1.0).abs() < 1.0, "item rests on floor top, got {}", e.y);
        assert!(e.motion_y.abs() < 0.2, "bounce decays, got {}", e.motion_y);
    }

    #[test]
    fn gravity_constant_is_frounded() {
        // Math.fround(0.04) === 0.03999999910593033
        assert_eq!(GRAVITY, 0.03999999910593033);
        assert_eq!(VERTICAL_DRAG, 0.9800000190734863);
    }

    #[test]
    fn no_gravity_items_do_not_fall() {
        let world = SolidFloorWorld { floor_y: -100, slipperiness: 0.6 };
        let mut e = DroppedItem { y: 5.0, no_gravity: true, ..Default::default() };
        let y0 = e.y;
        tick_dropped_item(&mut e, &world);
        assert_eq!(e.y, y0); // motionY stays 0, no collisions below
    }
}
