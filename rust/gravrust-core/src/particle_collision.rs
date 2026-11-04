// Port of `client/js/game/particle-collision.js`
//! Particle collision using swept AABB and actual block shapes, not block opacity.

use crate::physics::{calc_x_offset, calc_y_offset, calc_z_offset};

/// Move a particle, handling collision with blocks using swept AABB.
/// This is a port of the `moveParticle` function from `client/js/render/particle-collision.js`.
///
/// # Arguments
/// * `p` - Particle with position (`x`, `y`, `z`), motion (`mx`, `my`, `mz`),
///   `width`, `height`, and `collide` fields.
/// * `world` - The world context providing block collision data.
pub fn move_particle(p: &mut Particle, world: &dyn WorldContext) {
    let dx: f64 = p.mx.unwrap_or(0.0);
    let dy: f64 = p.my.unwrap_or(0.0);
    let dz: f64 = p.mz.unwrap_or(0.0);
    p.on_ground = false;

    if !p.collide {
        p.x += dx;
        p.y += dy;
        p.z += dz;
        return;
    }

    let width = p.width.unwrap_or(0.2);
    let height = p.height.unwrap_or(0.2);
    let r = width / 2.0;
    // AABB: [x0, y0, z0, x1, y1, z1]
    let bb = [p.x - r, p.y, p.z - r, p.x + r, p.y + height, p.z + r];
    // Swept AABB: only extend in the direction of motion
    let swept = [
        bb[0] + dx.min(0.0),
        bb[1] + dy.min(0.0),
        bb[2] + dz.min(0.0),
        bb[3] + dx.max(0.0),
        bb[4] + dy.max(0.0),
        bb[5] + dz.max(0.0),
    ];
    let boxes = world.get_collisions(&swept);
    let mut x = dx;
    let mut y = dy;
    let mut z = dz;

    for box in &boxes {
        y = calc_y_offset(box, &bb, y);
        bb[1] += y;
        bb[4] += y;
    }
    for box in &boxes {
        x = calc_x_offset(box, &bb, x);
        bb[0] += x;
        bb[3] += x;
    }
    for box in &boxes {
        z = calc_z_offset(box, &bb, z);
        bb[2] += z;
        bb[5] += z;
    }

    p.x = (bb[0] + bb[3]) / 2.0;
    p.y = bb[1];
    p.z = (bb[2] + bb[5]) / 2.0;
    p.on_ground = dy < 0.0 && y != dy;

    if x != dx {
        p.mx = Some(0.0);
    }
    if y != dy {
        p.my = Some(0.0);
    }
    if z != dz {
        p.mz = Some(0.0);
    }
}

/// Particle fields needed for collision handling.
#[derive(Clone, Debug)]
pub struct Particle {
    /// X position
    pub x: f64,
    /// Y position
    pub y: f64,
    /// Z position
    pub z: f64,
    /// X motion (optional, defaults to 0)
    pub mx: Option<f64>,
    /// Y motion (optional, defaults to 0)
    pub my: Option<f64>,
    /// Z motion (optional, defaults to 0)
    pub mz: Option<f64>,
    /// Whether the particle should collide with blocks
    pub collide: bool,
    /// Particle width
    pub width: Option<f64>,
    /// Particle height
    pub height: Option<f64>,
    /// Whether the particle is on the ground
    pub on_ground: bool,
}

/// Trait providing world collision queries, matching the JS `world.getCollisions()` API.
pub trait WorldContext {
    /// Get colliding boxes for a swept AABB, equivalent to JS `world.getCollisions(swept)`.
    fn get_collisions(&self, swept: &[f64]) -> Vec<[f64; 6]>;
}

#[cfg(test)]
mod tests {
    use super::*;

    // Mock world for testing
    struct MockWorld;

    impl WorldContext for MockWorld {
        fn get_collisions(&self, _swept: &[f64]) -> Vec<[f64; 6]> {
            vec![]
        }
    }

    #[test]
    fn test_move_particle_no_collision() {
        let mut p = Particle {
            x: 1.0,
            y: 1.0,
            z: 1.0,
            mx: Some(0.5),
            my: Some(0.0),
            mz: Some(0.0),
            collide: true,
            width: Some(0.2),
            height: Some(0.2),
            on_ground: false,
        };
        let world = MockWorld;
        move_particle(&mut p, &world);
        assert_eq!(p.x, 1.5);
        assert_eq!(p.mx, Some(0.5));
    }

    #[test]
    fn test_move_particle_no_collide_flag() {
        let mut p = Particle {
            x: 1.0,
            y: 1.0,
            z: 1.0,
            mx: Some(0.5),
            my: Some(0.0),
            mz: Some(0.0),
            collide: false,
            width: Some(0.2),
            height: Some(0.2),
            on_ground: false,
        };
        let world = MockWorld;
        move_particle(&mut p, &world);
        assert_eq!(p.x, 1.5);
        assert_eq!(p.mx, Some(0.5));
    }
}