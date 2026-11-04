//! Port of the FOV easing in `client/js/game/zoom.js`.
//!
//! OptiFine hold-zoom uses a 150 ms smoothstep between 1x and 0.25x. The
//! JavaScript keeps the transient lens object (`from`, `to`, `started`) on the
//! game; this kernel computes the next factor and the updated state.

use wasm_bindgen::prelude::*;

/// Returns `[fov, from, to, started]`.
#[wasm_bindgen]
pub fn zoom_fov(now: f64, fov: f64, target: f64, from: f64, to: f64, started: f64) -> Vec<f64> {
    let t = ((now - started) / 150.0).clamp(0.0, 1.0);
    let factor = from + (to - from) * t * t * (3.0 - 2.0 * t);
    if target != to {
        vec![fov * factor, factor, target, now]
    } else {
        vec![fov * factor, from, to, started]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_at_the_current_factor() {
        let values = zoom_fov(1000.0, 70.0, 1.0, 1.0, 1.0, 1000.0);
        assert_eq!(values[0], 70.0);
        assert_eq!(&values[1..], &[1.0, 1.0, 1000.0]);
    }

    #[test]
    fn eases_to_the_target_over_150_ms() {
        let start = zoom_fov(0.0, 70.0, 0.25, 1.0, 1.0, 0.0);
        assert_eq!(start[0], 70.0);
        assert_eq!(start[2], 0.25);
        let mid = zoom_fov(75.0, 70.0, 0.25, start[1], start[2], start[3]);
        assert!(mid[0] < 70.0 && mid[0] > 17.5);
        let end = zoom_fov(150.0, 70.0, 0.25, mid[1], mid[2], mid[3]);
        assert!((end[0] - 17.5).abs() < 1e-9, "{}", end[0]);
    }

    #[test]
    fn clamps_after_the_animation_window() {
        let values = zoom_fov(1000.0, 70.0, 0.25, 1.0, 0.25, 850.0);
        assert!((values[0] - 17.5).abs() < 1e-9);
        assert_eq!(&values[1..], &[1.0, 0.25, 850.0]);
    }
}
