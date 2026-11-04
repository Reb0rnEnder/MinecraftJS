//! Splash screen logic ported from `client/js/render/splash.js` and `client/js/gui/screens/menus.js`.
//!
//! This module provides pure algorithmic functions for:
//! - Startup splash (Mojang logo) scale and positioning calculations
//! - Title screen splash text selection (with special date handling)
//! - Title screen splash text animation parameters

use wasm_bindgen::prelude::*;
use js_sys::{Date, Array};

/// Startup splash configuration (ported from splash.js)
#[derive(Debug, Clone, Copy, PartialEq)]
#[wasm_bindgen]
pub struct SplashConfig {
    /// Logo texture size (256x256 for mojang.png)
    pub logo_size: u32,
    /// Base scale factor (2x for high-DPI)
    pub base_scale: f64,
}

impl Default for SplashConfig {
    fn default() -> Self {
        Self {
            logo_size: 256,
            base_scale: 2.0,
        }
    }
}

/// Result of startup splash scale calculation
#[derive(Debug, Clone, Copy, PartialEq)]
#[wasm_bindgen]
pub struct SplashScale {
    /// Computed integer scale factor
    pub scale: u32,
    /// Scaled viewport width (css pixels / scale)
    pub scaled_width: f64,
    /// Scaled viewport height (css pixels / scale)
    pub scaled_height: f64,
    /// X offset to center logo
    pub logo_x: f64,
    /// Y offset to center logo
    pub logo_y: f64,
}

/// Calculate the startup splash scale and logo position.
///
/// Ported from `client/js/render/splash.js` lines 46-48, 51.
/// Returns null on invalid input for JS fallback.
#[wasm_bindgen]
pub fn splash_scale(viewport_width: f64, viewport_height: f64, dpr: f64, config: Option<SplashConfig>) -> Option<SplashScale> {
    if viewport_width <= 0.0 || viewport_height <= 0.0 || dpr <= 0.0 {
        return None;
    }

    let cfg = config.unwrap_or_default();
    let logo_size = cfg.logo_size as f64;

    // scale = max(1, round(base_scale * dpr))
    let mut scale = (cfg.base_scale * dpr).round() as u32;
    if scale < 1 {
        scale = 1;
    }

    // Reduce scale until logo fits
    while scale > 1 && (logo_size * scale as f64) > viewport_width.min(viewport_height) {
        scale -= 1;
    }

    let scaled_width = viewport_width / scale as f64;
    let scaled_height = viewport_height / scale as f64;

    // Center the logo
    let logo_x = ((scaled_width - logo_size) / 2.0).floor();
    let logo_y = ((scaled_height - logo_size) / 2.0).floor();

    Some(SplashScale {
        scale,
        scaled_width,
        scaled_height,
        logo_x,
        logo_y,
    })
}

/// Internal implementation for splash text selection (works with native slices for testing).
fn splash_text_impl(splashes: &[String], index: usize, month: u32, date: u32) -> Option<String> {
    if splashes.is_empty() {
        return None;
    }

    // Check for special dates (ported from menus.js lines 31-34)
    if month == 11 && date == 24 {
        // Merry X-mas!
        return Some("Merry X-mas!".to_string());
    }
    if month == 0 && date == 1 {
        // Happy new year!
        return Some("Happy new year!".to_string());
    }

    // Use provided index (modulo length for safety)
    let idx = index % splashes.len();
    Some(splashes[idx].clone())
}

/// Select a splash text from the list.
///
/// Ported from `client/js/gui/screens/menus.js` lines 29-35.
/// Handles special dates: Christmas (Dec 24) and New Year (Jan 1).
/// `index` is used for deterministic selection (e.g., from Java's Random).
/// Returns null/empty string on failure for JS fallback.
#[wasm_bindgen]
pub fn splash_text(splashes: &Array, index: usize) -> Option<String> {
    let len = splashes.length() as usize;
    if len == 0 {
        return None;
    }

    // Check for special dates
    let now = Date::new_0();
    let month = now.get_month(); // 0-11
    let date = now.get_date(); // 1-31

    if month == 11 && date == 24 {
        return Some("Merry X-mas!".to_string());
    }
    if month == 0 && date == 1 {
        return Some("Happy new year!".to_string());
    }

    // Use provided index (modulo length for safety)
    let idx = index % len;
    let val = splashes.get(idx as u32);
    if val.is_undefined() || val.is_null() {
        return None;
    }
    val.as_string()
}

/// Internal implementation for random splash text selection (works with native slices for testing).
fn splash_text_random_impl(splashes: &[String], month: u32, date: u32, random: f64) -> Option<String> {
    if splashes.is_empty() {
        return None;
    }

    if month == 11 && date == 24 {
        return Some("Merry X-mas!".to_string());
    }
    if month == 0 && date == 1 {
        return Some("Happy new year!".to_string());
    }

    let idx = (random * splashes.len() as f64).floor() as usize;
    Some(splashes[idx].clone())
}

/// Select a random splash text from the list (convenience function).
///
/// Uses JS Math.random() via wasm_bindgen for true randomness.
/// Returns null on failure for JS fallback.
#[wasm_bindgen]
pub fn splash_text_random(splashes: &Array) -> Option<String> {
    let len = splashes.length() as usize;
    if len == 0 {
        return None;
    }

    let now = Date::new_0();
    let month = now.get_month();
    let date = now.get_date();

    if month == 11 && date == 24 {
        return Some("Merry X-mas!".to_string());
    }
    if month == 0 && date == 1 {
        return Some("Happy new year!".to_string());
    }

    let idx = (js_sys::Math::random() * len as f64).floor() as usize;
    let val = splashes.get(idx as u32);
    if val.is_undefined() || val.is_null() {
        return None;
    }
    val.as_string()
}

/// Animation parameters for the title screen splash text.
///
/// Ported from `client/js/gui/screens/menus.js` lines 118-127.
#[derive(Debug, Clone, Copy, PartialEq)]
#[wasm_bindgen]
pub struct SplashAnimation {
    /// X translation (center of screen + 90)
    pub x: f64,
    /// Y translation (70px from top)
    pub y: f64,
    /// Rotation in radians (-20 degrees)
    pub rotation: f64,
    /// Scale factor (animated pulsing)
    pub scale: f64,
    /// Alpha (always 1.0 for splash text)
    pub alpha: f64,
}

/// Calculate title screen splash animation parameters.
///
/// `progress` is a time value in milliseconds (typically `Date.now() % 1000`).
/// `text_width` is the rendered width of the splash text in pixels.
/// `screen_width` is the canvas width.
///
/// Returns None on invalid input for JS fallback.
#[wasm_bindgen]
pub fn splash_animation(progress: f64, text_width: f64, screen_width: f64) -> Option<SplashAnimation> {
    if text_width <= 0.0 || screen_width <= 0.0 {
        return None;
    }

    // Animation cycle: 1000ms period
    let cycle = (progress % 1000.0) / 1000.0;
    let sine = (cycle * std::f64::consts::PI * 2.0).sin();

    // f = 1.8 - |sin(...)| * 0.1  (ported from line 122)
    let f = 1.8 - sine.abs() * 0.1;

    // f = f * 100 / (textWidth + 32)  (ported from line 123)
    let scale = f * 100.0 / (text_width + 32.0);

    // Translation: center + 90, 70 (ported from lines 119-120)
    let x = screen_width / 2.0 + 90.0;
    let y = 70.0;

    // Rotation: -20 degrees (ported from line 121)
    let rotation = -20.0 * std::f64::consts::PI / 180.0;

    Some(SplashAnimation {
        x,
        y,
        rotation,
        scale,
        alpha: 1.0,
    })
}

/// Orthographic projection matrix for the startup splash.
///
/// Ported from `client/js/render/splash.js` line 58.
/// Returns a 16-element column-major matrix (WebGL compatible).
/// Returns None on invalid input for JS fallback.
#[wasm_bindgen]
pub fn splash_ortho_matrix(scaled_width: f64, scaled_height: f64) -> Option<Vec<f64>> {
    if scaled_width <= 0.0 || scaled_height <= 0.0 {
        return None;
    }

    // mat4.ortho(this.proj, 0, sw, sh, 0, -1, 1)
    // Column-major 4x4 matrix:
    // [ 2/right, 0, 0, 0 ]
    // [ 0, 2/top, 0, 0 ]
    // [ 0, 0, -2/depth, 0 ]
    // [ -1, -1, 0, 1 ]
    // where right=sw, top=sh, depth=2 (from -1 to 1)

    let right = scaled_width;
    let top = scaled_height;

    Some(vec![
        2.0 / right, 0.0, 0.0, 0.0,
        0.0, 2.0 / top, 0.0, 0.0,
        0.0, 0.0, -1.0, 0.0,
        -1.0, -1.0, 0.0, 1.0,
    ])
}

/// Vertex data for the startup splash logo quad.
///
/// Ported from `client/js/render/splash.js` lines 52-57.
/// Returns 36 floats (4 vertices * 9 components: x,y,z, u,v, r,g,b,a).
/// Returns None on invalid input for JS fallback.
#[wasm_bindgen]
pub fn splash_logo_vertices(logo_x: f64, logo_y: f64, logo_size: f64) -> Option<Vec<f64>> {
    if logo_size <= 0.0 {
        return None;
    }

    let x0 = logo_x;
    let y0 = logo_y;
    let x1 = logo_x + logo_size;
    let y1 = logo_y + logo_size;

    // Quad vertices (x, y, z, u, v, r, g, b, a) - 4 vertices
    // Bottom-left, top-left, top-right, bottom-right (for quads: true)
    Some(vec![
        x0, y0, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0,
        x0, y1, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0,
        x1, y1, 0.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0,
        x1, y0, 0.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0,
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_splash_scale_basic() {
        let result = splash_scale(800.0, 600.0, 1.0, None);
        assert!(result.is_some());
        let scale = result.unwrap();
        // base_scale=2, dpr=1 -> scale=2, but 256*2=512 > min(800,600)=600? No, 512 < 600 so scale=2
        assert_eq!(scale.scale, 2);
        assert!((scale.scaled_width - 400.0).abs() < 0.001);
        assert!((scale.scaled_height - 300.0).abs() < 0.001);
    }

    #[test]
    fn test_splash_scale_high_dpr() {
        let result = splash_scale(800.0, 600.0, 2.0, None);
        assert!(result.is_some());
        let scale = result.unwrap();
        // base_scale=2, dpr=2 -> scale=4, but 256*4=1024 > 600, reduce to 2 (512 < 600), then 3 (768 > 600) -> scale=2
        assert_eq!(scale.scale, 2);
    }

    #[test]
    fn test_splash_scale_small_window() {
        let result = splash_scale(300.0, 200.0, 1.0, None);
        assert!(result.is_some());
        let scale = result.unwrap();
        // scale=2 -> 512 > 200, reduce to 1
        assert_eq!(scale.scale, 1);
    }

    #[test]
    fn test_splash_scale_invalid() {
        assert!(splash_scale(0.0, 600.0, 1.0, None).is_none());
        assert!(splash_scale(800.0, 0.0, 1.0, None).is_none());
        assert!(splash_scale(800.0, 600.0, 0.0, None).is_none());
        assert!(splash_scale(800.0, 600.0, -1.0, None).is_none());
    }

    #[test]
    fn test_splash_text_empty() {
        let result = splash_text_impl(&[], 0, 6, 15); // June 15 (no special date)
        assert!(result.is_none());
    }

    #[test]
    fn test_splash_text_selection() {
        let splashes = vec!["A".to_string(), "B".to_string(), "C".to_string()];
        let result = splash_text_impl(&splashes, 1, 6, 15);
        assert_eq!(result, Some("B".to_string()));
    }

    #[test]
    fn test_splash_text_wraparound() {
        let splashes = vec!["A".to_string(), "B".to_string()];
        let result = splash_text_impl(&splashes, 5, 6, 15);
        assert_eq!(result, Some("B".to_string())); // 5 % 2 = 1
    }

    #[test]
    fn test_splash_text_christmas() {
        let splashes = vec!["A".to_string(), "B".to_string()];
        let result = splash_text_impl(&splashes, 0, 11, 24); // Dec 24
        assert_eq!(result, Some("Merry X-mas!".to_string()));
    }

    #[test]
    fn test_splash_text_new_year() {
        let splashes = vec!["A".to_string(), "B".to_string()];
        let result = splash_text_impl(&splashes, 0, 0, 1); // Jan 1
        assert_eq!(result, Some("Happy new year!".to_string()));
    }

    #[test]
    fn test_splash_text_random() {
        let splashes = vec!["A".to_string(), "B".to_string(), "C".to_string()];
        // Use a fixed random value for deterministic testing
        let result = splash_text_random_impl(&splashes, 6, 15, 0.5); // Should pick index 1 (0.5 * 3 = 1.5 -> floor = 1)
        assert_eq!(result, Some("B".to_string()));
    }

    #[test]
    fn test_splash_text_random_christmas() {
        let splashes = vec!["A".to_string(), "B".to_string()];
        let result = splash_text_random_impl(&splashes, 11, 24, 0.5);
        assert_eq!(result, Some("Merry X-mas!".to_string()));
    }

    #[test]
    fn test_splash_animation_basic() {
        let result = splash_animation(0.0, 200.0, 800.0);
        assert!(result.is_some());
        let anim = result.unwrap();
        assert!((anim.x - 490.0).abs() < 0.001); // 800/2 + 90
        assert!((anim.y - 70.0).abs() < 0.001);
        assert!((anim.rotation - (-20.0 * std::f64::consts::PI / 180.0)).abs() < 0.001);
        assert!(anim.scale > 0.0);
        assert!((anim.alpha - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_splash_animation_invalid() {
        assert!(splash_animation(0.0, 0.0, 800.0).is_none());
        assert!(splash_animation(0.0, 200.0, 0.0).is_none());
    }

    #[test]
    fn test_splash_ortho_matrix() {
        let result = splash_ortho_matrix(400.0, 300.0);
        assert!(result.is_some());
        let mat = result.unwrap();
        assert_eq!(mat.len(), 16);
        // Check column-major ortho matrix
        assert!((mat[0] - 2.0/400.0).abs() < 0.001);
        assert!((mat[5] - 2.0/300.0).abs() < 0.001);
        assert!((mat[10] - (-1.0)).abs() < 0.001);
        assert!((mat[12] - (-1.0)).abs() < 0.001);
        assert!((mat[13] - (-1.0)).abs() < 0.001);
        assert!((mat[15] - 1.0).abs() < 0.001);
    }

    #[test]
    fn test_splash_logo_vertices() {
        let result = splash_logo_vertices(100.0, 50.0, 256.0);
        assert!(result.is_some());
        let verts = result.unwrap();
        assert_eq!(verts.len(), 36); // 4 * 9
        // First vertex: x0, y0, 0, 0, 0, 1, 1, 1, 1
        assert!((verts[0] - 100.0).abs() < 0.001);
        assert!((verts[1] - 50.0).abs() < 0.001);
        // Last vertex: x1, y0, 0, 1, 0, 1, 1, 1, 1
        assert!((verts[32] - 356.0).abs() < 0.001);
        assert!((verts[33] - 50.0).abs() < 0.001);
    }
}