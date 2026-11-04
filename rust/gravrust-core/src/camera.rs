//! Port of `client/js/render/camera-eye.js`.
//!
//! Vanilla stores the eye height as a float and eases halfway per tick. The
//! interpolation itself is done in double precision, matching the JS class.

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct CameraEye {
    current: Option<f32>,
    previous: Option<f32>,
}

#[wasm_bindgen]
impl CameraEye {
    #[wasm_bindgen(constructor)]
    pub fn new() -> CameraEye {
        CameraEye {
            current: None,
            previous: None,
        }
    }

    pub fn reset(&mut self) {
        self.current = None;
        self.previous = None;
    }

    pub fn tick(&mut self, height: f32) {
        match self.current {
            None => {
                self.current = Some(height);
                self.previous = Some(height);
            }
            Some(current) => {
                self.previous = Some(current);
                self.current = Some(current + (height - current) * 0.5);
            }
        }
    }

    pub fn height(&mut self, partial: f64, target: f64) -> f64 {
        if self.current.is_none() {
            self.tick(target as f32);
        }
        let previous = self.previous.unwrap_or(0.0) as f64;
        let current = self.current.unwrap_or(0.0) as f64;
        previous + (current - previous) * partial
    }
}

impl Default for CameraEye {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_tick_has_no_easing() {
        let mut eye = CameraEye::new();
        eye.tick(1.62);
        assert_eq!(eye.height(0.5, 1.62), 1.62_f32 as f64);
    }

    #[test]
    fn ticks_ease_halfway_in_float32() {
        let mut eye = CameraEye::new();
        eye.tick(1.62);
        eye.tick(1.8);
        let mid = eye.height(0.5, 1.8);
        assert!(mid > 1.62 && mid < 1.8);
        assert_eq!(eye.height(0.0, 1.8), 1.62_f32 as f64);
        assert_eq!(eye.height(1.0, 1.8), 1.71_f32 as f64);
    }

    #[test]
    fn reset_clears_both_samples() {
        let mut eye = CameraEye::new();
        eye.tick(1.0);
        eye.reset();
        assert_eq!(eye.height(0.25, 2.0), 2.0);
    }
}
