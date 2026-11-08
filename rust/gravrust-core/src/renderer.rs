//! Port of `client/js/render/renderer.js`.
//!
//! Device-agnostic 3D world renderer calculations: view/projection matrix composition,
//! alpha test thresholds, LOD texture bias, and torch flicker dynamics.

use crate::math::{identity_matrix, multiply, perspective};

pub const LOD_BIAS: f32 = 1.5;
pub const ALPHA_TEST_SOLID: f32 = 0.0;
pub const ALPHA_TEST_CUTOUT: f32 = 0.1;
pub const ALPHA_TEST_TRANSLUCENT: f32 = 0.004;

#[derive(Debug, Clone)]
pub struct CameraMatrices {
    pub view: [f32; 16],
    pub proj: [f32; 16],
    pub view_proj: [f32; 16],
    pub sky_view: [f32; 16],
    pub sky_proj: [f32; 16],
}

impl Default for CameraMatrices {
    fn default() -> Self {
        Self {
            view: identity_matrix(),
            proj: identity_matrix(),
            view_proj: identity_matrix(),
            sky_view: identity_matrix(),
            sky_proj: identity_matrix(),
        }
    }
}

impl CameraMatrices {
    pub fn update(&mut self, view: [f32; 16], proj: [f32; 16], aspect: f64, fov_rad: f64) {
        self.view = view;
        self.proj = proj;
        self.view_proj = multiply(&proj, &view);

        // Sky view has camera translation zeroed out
        let mut sky_view = view;
        sky_view[12] = 0.0;
        sky_view[13] = 0.0;
        sky_view[14] = 0.0;
        self.sky_view = sky_view;

        // Sky projection with far plane pushed out
        self.sky_proj = perspective(fov_rad, aspect, 0.05, 512.0);
    }
}

/// Torch light flickering simulation.
#[derive(Debug, Clone, Copy, Default)]
pub struct TorchFlicker {
    pub flicker_x: f32,
    pub flicker_dx: f32,
}

impl TorchFlicker {
    pub fn tick(&mut self, rand_val1: f32, rand_val2: f32, rand_val3: f32, rand_val4: f32) {
        self.flicker_dx += (rand_val1 - rand_val2) * rand_val3 * rand_val4 * 0.1;
        self.flicker_dx *= 0.9;
        self.flicker_x += self.flicker_dx;
        self.flicker_x = self.flicker_x.clamp(-1.0, 1.0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_camera_matrices_update() {
        let mut cm = CameraMatrices::default();
        let view = identity_matrix();
        let proj = identity_matrix();
        cm.update(view, proj, 1.333, 70.0 * std::f64::consts::PI / 180.0);
        assert_eq!(cm.view, identity_matrix());
        assert_eq!(cm.view_proj, identity_matrix());
        assert_eq!(cm.sky_view[12], 0.0);
    }

    #[test]
    fn test_torch_flicker() {
        let mut tf = TorchFlicker::default();
        tf.tick(0.8, 0.2, 0.5, 0.5);
        assert!(tf.flicker_dx > 0.0);
        assert!(tf.flicker_x > 0.0);
    }
}
