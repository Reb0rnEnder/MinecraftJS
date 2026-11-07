//! Gravrust Core - Minecraft 1.15.2 client ported to Rust/WASM
//!
//! This crate contains the core game logic ported from JavaScript to Rust,
//! compiled to WebAssembly for browser execution.

// Core ported modules (10 modules)
pub mod wasm_alg;
pub mod browser_alg;
pub mod platform;
pub mod platform_contract;
pub mod main_alg;
pub mod main_boot;
pub mod main_boot2;
pub mod boot_alg;
pub mod webgl2;
pub mod webgl2_alg;
pub mod webgpu;
pub mod webgpu_math;
pub mod sound;
pub mod sound_alg2;
pub mod music_system;
pub mod widgets;
pub mod widgets_alg;
pub mod widgets_alg2;
pub mod widgets_alg3;
pub mod entity_renderer;
pub mod entity_render_alg;
pub mod item_renderer;
pub mod hand_renderer;
pub mod protocol_1152;
pub mod protocol_1144;
pub mod protocol_1152_ids;
pub mod options;
pub mod options_alg;
pub mod options_screen;

// Pre-existing modules (not ported, but part of crate)
pub mod entity_effects;
pub mod entity_models;
pub mod particle_sprites;
pub mod physics;
pub mod blocks;
pub mod world;
pub mod game;
pub mod ui;

/// Gravrust version
pub const VERSION: &str = "0.2.0";

/// Initialize the Gravrust core
pub fn init() {
    #[cfg(target_arch = "wasm32")]
    {
        web_sys::console::log_1(&format!("GRAVRUST-core {}", VERSION).into());
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn version_check() {
        assert_eq!(VERSION, "0.2.0");
    }
}
