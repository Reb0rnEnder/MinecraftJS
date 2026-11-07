//! GRAVRUST Core entry point.
//! This module is the Rust/WASM port of the main game bootstrap.
//! It exposes the core lifecycle hooks plus a pure-Rust software
//! renderer that paints a blocky Minecraft-style scene into a
//! framebuffer the browser blits onto a <canvas>.

use wasm_bindgen::prelude::*;

/// Initialize the Rust WASM core.
/// This is called from client/js/main.js before the game bootstraps.
#[wasm_bindgen]
pub fn init_wasm() {
    // One-time setup hook. The JS side drives the bootstrap; Rust
    // prepares any state it needs here.
}

/// Reset the Rust core state (e.g. when changing worlds/dimensions).
#[wasm_bindgen]
pub fn reset_core() {
    // Reset any persistent Rust state between game sessions.
}

// ------------------------------------------------------------------
// Pure-Rust software renderer
// ------------------------------------------------------------------

/// Deterministic block-type hash for column x: 0=air,1=grass,2=dirt,3=stone
fn terrain_height(x: i32) -> i32 {
    // layered sine "noise" -> smooth rolling hills
    let x = x as f32;
    let h = (x * 0.045).sin() * 6.0 + (x * 0.013 + 2.0).sin() * 10.0 + (x * 0.11).sin() * 1.5;
    (22.0 + h) as i32
}

fn put_pixel(buf: &mut [u8], w: u32, x: u32, y: u32, r: u8, g: u8, b: u8) {
    let idx = ((y * w + x) * 4) as usize;
    if idx + 3 < buf.len() {
        buf[idx] = r; buf[idx + 1] = g; buf[idx + 2] = b; buf[idx + 3] = 255;
    }
}

/// Render one frame of the blocky scene into an RGBA framebuffer.
/// `t` is time in seconds for animation (clouds drift, water shimmer).
fn render_scene(buf: &mut [u8], w: u32, h: u32, t: f32) {
    let horizon = (h as f32 * 0.45) as i32;

    for y in 0..h as i32 {
        for x in 0..w as i32 {
            // ---- sky gradient ----
            let fy = y as f32 / h as f32;
            let (r, g, b) = if y < horizon {
                let k = fy * 1.4;
                (
                    (60.0 + 60.0 * k) as u8,
                    (120.0 + 60.0 * k) as u8,
                    (200.0 + 40.0 * k) as u8,
                )
            } else {
                (0, 0, 0) // replaced below by terrain pass
            };

            if y < horizon {
                // ---- drifting blocky clouds ----
                let cloud_row = ((y as f32 - 20.0) / 14.0) as i32;
                let shift = (t * 12.0) as i32;
                let cx = ((x + shift) / 16) % 97;
                let cloud = (cx * 31 + cloud_row * 17) % 13 < 3 && y < horizon - 14;
                let (r2, g2, b2) = if cloud { (245, 248, 252) } else { (r, g, b) };
                put_pixel(buf, w, x as u32, y as u32, r2, g2, b2);
            } else {
                // ---- terrain layers ----
                let ground = terrain_height(x) + horizon - 20;
                let (r3, g3, b3) = if y < ground {
                    // grass top: two-tone checker for texture
                    let checker = ((x / 8) + (y / 8)) % 2 == 0;
                    if checker { (94, 157, 52) } else { (81, 141, 45) }
                } else if y < ground + 12 {
                    let dither = (x * 7 + y * 13) % 5;
                    match dither { 0 => (118, 85, 60), 1 => (134, 96, 67), _ => (126, 91, 64) }
                } else {
                    let dither = (x * 5 + y * 11) % 4;
                    match dither { 0 => (110, 110, 110), 1 => (125, 125, 125), _ => (100, 100, 100) }
                };
                put_pixel(buf, w, x as u32, y as u32, r3, g3, b3);
            }
        }
    }

    // ---- square sun ----
    let sun_x = (w as f32 * 0.78) as i32;
    let sun_y = 26i32;
    for dy in -7..=7 { for dx in -7..=7 {
        let px = sun_x + dx; let py = sun_y + dy;
        if px >= 0 && px < w as i32 && py >= 0 && py < h as i32 {
            let edge = dx.abs() == 7 || dy.abs() == 7;
            let (r, g, b) = if edge { (255, 214, 90) } else { (255, 236, 140) };
            put_pixel(buf, w, px as u32, py as u32, r, g, b);
        }
    }}
}

/// Persistent renderer state, driven from JS.
#[wasm_bindgen]
pub struct GameRenderer {
    w: u32,
    h: u32,
    t: f32,
    buf: Vec<u8>,
}

#[wasm_bindgen]
impl GameRenderer {
    #[wasm_bindgen(constructor)]
    pub fn new(w: u32, h: u32) -> GameRenderer {
        GameRenderer { w, h, t: 0.0, buf: vec![0u8; (w * h * 4) as usize] }
    }

    /// Advance time and re-render. Returns the RGBA framebuffer length.
    #[wasm_bindgen]
    pub fn tick(&mut self, dt: f32) -> usize {
        self.t += dt;
        render_scene(&mut self.buf, self.w, self.h, self.t);
        self.buf.len()
    }

    /// Borrow the framebuffer for zero-copy blitting.
    #[wasm_bindgen]
    pub fn frame(&self) -> *const u8 {
        self.buf.as_ptr()
    }

    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 { self.w }

    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 { self.h }
}

fn main() {
    // The crate ships as a cdylib (WASM) — this binary stub only exists so
    // cargo's auto-detected bin target compiles on native hosts.
}
