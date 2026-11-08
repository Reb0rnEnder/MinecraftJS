//! Port of `client/js/game/look-at.js` and `client/js/net/look-at.js`.
//!
//! Entity look-at packet decoder and angle calculation using nativeatan2.

use crate::native_angles::{native_atan2, wrap_native_degrees};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntityAnchor {
    Feet = 0,
    Eyes = 1,
}

#[derive(Debug, Clone, PartialEq)]
pub struct FacePlayerPacket {
    pub from_anchor: EntityAnchor,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub entity_target: Option<(i32, EntityAnchor)>,
}

/// Computes (yaw, pitch) for looking at a target position.
pub fn calculate_look_at(
    player_pos: [f64; 3],
    player_eye_height: f64,
    from_anchor: EntityAnchor,
    target_pos: [f64; 3],
    target_eye_height: f64,
    to_anchor: EntityAnchor,
) -> (f32, f32) {
    let from_y = player_pos[1] + if from_anchor == EntityAnchor::Eyes { player_eye_height } else { 0.0 };
    let to_y = target_pos[1] + if to_anchor == EntityAnchor::Eyes { target_eye_height } else { 0.0 };

    let dx = target_pos[0] - player_pos[0];
    let dy = to_y - from_y;
    let dz = target_pos[2] - player_pos[2];

    let xz_dist = (dx * dx + dz * dz).sqrt();
    let pitch = wrap_native_degrees((-native_atan2(dy, xz_dist) * 57.2957763671875) as f32);
    let yaw = wrap_native_degrees(((native_atan2(dz, dx) * 57.2957763671875) as f32) - 90.0);

    (yaw, pitch)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_look_at_straight_ahead() {
        let (yaw, pitch) = calculate_look_at(
            [0.0, 64.0, 0.0],
            1.62,
            EntityAnchor::Eyes,
            [0.0, 64.0, 10.0],
            1.62,
            EntityAnchor::Eyes,
        );
        assert!((pitch - 0.0).abs() < 1.0);
        assert!((yaw - 0.0).abs() < 1.0);
    }
}
