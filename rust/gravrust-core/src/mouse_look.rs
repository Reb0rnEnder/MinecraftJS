//! Port of `client/js/game/mouse-look.js` (upstream MinecraftJS 1.8.9).
//!
//! Entity.turn and Boat.onPassengerTurned: mouse input changes both
//! interpolation endpoints, then the vehicle clamps rotation immediately,
//! between game ticks.
//!
//! JS uses `const f = Math.fround` around every operation to reproduce the
//! float32 rounding of the vanilla code; `fround` here is the same explicit
//! f32 round-trip.

/// JS: `const f = Math.fround`.
#[inline]
pub fn fround(v: f64) -> f64 {
    v as f32 as f64
}

/// JS: `export const BOAT_LOOK_LIMIT = null;` — native 1.8.9 boats do not
/// clamp passenger mouse rotation, so the limit is absent.
pub const BOAT_LOOK_LIMIT: Option<f64> = None;

/// The look state shared by players and vehicles. Mirrors the JS player
/// object surface this module touches.
#[derive(Debug, Clone, Copy, Default)]
pub struct PlayerLook {
    pub yaw: f64,
    pub pitch: f64,
    pub prev_yaw: f64,
    pub prev_pitch: f64,
}

/// JS: `clampBoatYaw(player, yaw)`.
///
/// With `BOAT_LOOK_LIMIT = null` the JS expression
/// `Math.max(-null, Math.min(null, delta))` evaluates to `0` (null coerces
/// to 0), so the limit is always 0 and the yaw delta is fully undone.
/// The function is ported faithfully including that dead-at-null behavior.
pub fn clamp_boat_yaw(player: &mut PlayerLook, yaw: f64) {
    let mut delta = fround(player.yaw - yaw);
    delta = fround(((delta + 180.0) % 360.0 + 360.0) % 360.0 - 180.0);
    let limit = match BOAT_LOOK_LIMIT {
        Some(l) => fround(delta.max(-l).min(l)),
        None => 0.0, // JS: Math.max(-null, Math.min(null, delta)) === 0
    };
    let correction = fround(limit - delta);
    player.prev_yaw = fround(player.prev_yaw + correction);
    player.yaw = fround(fround(player.yaw + limit) - delta);
}

/// JS: `turnPlayer(player, dx, dy)` — mouse input changes both interpolation
/// endpoints; native 1.8.9 boats do not clamp passenger mouse rotation.
pub fn turn_player(player: &mut PlayerLook, dx: f64, dy: f64) {
    let dx = fround(dx);
    let dy = fround(dy);
    player.yaw = fround(player.yaw + dx);
    player.pitch = fround(player.pitch + dy).max(-90.0).min(90.0);
    player.prev_yaw = fround(player.prev_yaw + dx);
    player.prev_pitch = fround(player.prev_pitch + dy).max(-90.0).min(90.0);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn turn_player_moves_both_endpoints() {
        let mut p = PlayerLook { yaw: 10.0, pitch: 0.0, prev_yaw: 10.0, prev_pitch: 0.0 };
        turn_player(&mut p, 5.0, 3.0);
        assert_eq!(p.yaw, 15.0);
        assert_eq!(p.prev_yaw, 15.0);
        assert_eq!(p.pitch, 3.0);
        assert_eq!(p.prev_pitch, 3.0);
    }

    #[test]
    fn turn_player_clamps_pitch_to_90() {
        let mut p = PlayerLook::default();
        turn_player(&mut p, 0.0, 500.0);
        assert_eq!(p.pitch, 90.0);
        turn_player(&mut p, 0.0, -1000.0);
        assert_eq!(p.pitch, -90.0);
    }

    #[test]
    fn clamp_boat_yaw_with_null_limit_undoes_delta() {
        // With BOAT_LOOK_LIMIT = null the limit is 0: yaw is pulled back by
        // the full clamped delta (JS null-coercion semantics, ported as-is).
        let mut p = PlayerLook { yaw: 30.0, pitch: 0.0, prev_yaw: 30.0, prev_pitch: 0.0 };
        clamp_boat_yaw(&mut p, 20.0);
        // delta = fround(30-20) = 10 (shortest wrap), limit = 0
        assert_eq!(p.prev_yaw, 20.0); // 30 + (0 - 10)
        assert_eq!(p.yaw, 20.0);      // f(f(30+0) - 10)
    }

    #[test]
    fn fround_matches_js() {
        assert_eq!(fround(0.1 + 0.2), 0.30000001192092896);
        assert_eq!(fround(1.0), 1.0);
    }
}
