//! Port of `client/js/render/particle-sprites.js` algorithmic core.
//!
//! This module contains particle sprite definitions, UV coordinate lookup,
//! and animation frame calculation. The actual texture atlas is built in
//! JavaScript (browser-bound), but the sprite registry and frame selection
//! logic are ported here for deterministic behavior.

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

// ============================================================================
// Particle sprite definitions (ported from particles/*.json resource files)
// ============================================================================

/// A particle sprite definition listing the texture frames for a particle type.
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticleSprite {
    /// Texture names for each animation frame (e.g., "particle/smoke_0", "particle/smoke_1", ...)
    pub textures: Vec<String>,
}

/// Registry of all known particle sprite definitions.
/// Key: particle type name (e.g., "smoke", "flame", "portal")
/// Value: ParticleSprite with texture frame list.
static PARTICLE_SPRITES: Lazy<HashMap<&'static str, ParticleSprite>> = Lazy::new(|| {
    let mut map = HashMap::new();

    // Basic particles (single frame)
    map.insert("poof", ParticleSprite { textures: vec!["particle/poof".into()] });
    map.insert("mycelium", ParticleSprite { textures: vec!["particle/mycelium".into()] });
    map.insert("bubble", ParticleSprite { textures: vec!["particle/bubble".into()] });
    map.insert("flame", ParticleSprite { textures: vec!["particle/flame".into()] });
    map.insert("lava", ParticleSprite { textures: vec!["particle/lava".into()] });
    map.insert("note", ParticleSprite { textures: vec!["particle/note".into()] });
    map.insert("heart", ParticleSprite { textures: vec!["particle/heart".into()] });
    map.insert("angry_villager", ParticleSprite { textures: vec!["particle/angry_villager".into()] });
    map.insert("happy_villager", ParticleSprite { textures: vec!["particle/happy_villager".into()] });
    map.insert("falling_water", ParticleSprite { textures: vec!["particle/falling_water".into()] });
    map.insert("dripping_water", ParticleSprite { textures: vec!["particle/dripping_water".into()] });
    map.insert("falling_lava", ParticleSprite { textures: vec!["particle/falling_lava".into()] });
    map.insert("dripping_lava", ParticleSprite { textures: vec!["particle/dripping_lava".into()] });
    map.insert("landing_lava", ParticleSprite { textures: vec!["particle/landing_lava".into()] });
    map.insert("landing_water", ParticleSprite { textures: vec!["particle/landing_water".into()] });
    map.insert("splash", ParticleSprite { textures: vec!["particle/splash".into()] });
    map.insert("rain", ParticleSprite { textures: vec!["particle/rain".into()] });
    map.insert("end_rod", ParticleSprite { textures: vec!["particle/end_rod".into()] });
    map.insert("totem_of_undying", ParticleSprite { textures: vec!["particle/totem_of_undying".into()] });
    map.insert("dragon_breath", ParticleSprite { textures: vec!["particle/dragon_breath".into()] });
    map.insert("spit", ParticleSprite { textures: vec!["particle/spit".into()] });
    map.insert("squid_ink", ParticleSprite { textures: vec!["particle/squid_ink".into()] });
    map.insert("sweep_attack", ParticleSprite { textures: vec!["particle/sweep_attack".into()] });
    map.insert("bubble_pop", ParticleSprite { textures: vec!["particle/bubble_pop".into()] });
    map.insert("current_down", ParticleSprite { textures: vec!["particle/current_down".into()] });
    map.insert("bubble_column_up", ParticleSprite { textures: vec!["particle/bubble_column_up".into()] });
    map.insert("dolphin", ParticleSprite { textures: vec!["particle/dolphin".into()] });
    map.insert("nautilus", ParticleSprite { textures: vec!["particle/nautilus".into()] });
    map.insert("flash", ParticleSprite { textures: vec!["particle/flash".into()] });
    map.insert("sneeze", ParticleSprite { textures: vec!["particle/sneeze".into()] });
    map.insert("damage_indicator", ParticleSprite { textures: vec!["particle/damage_indicator".into()] });
    map.insert("falling_honey", ParticleSprite { textures: vec!["particle/falling_honey".into()] });
    map.insert("landing_honey", ParticleSprite { textures: vec!["particle/landing_honey".into()] });
    map.insert("dripping_honey", ParticleSprite { textures: vec!["particle/dripping_honey".into()] });
    map.insert("firework", ParticleSprite { textures: vec!["particle/firework".into()] });

    // Animated particles (multiple frames)
    // Smoke: 8 frames (smoke_0 through smoke_7)
    map.insert("smoke", ParticleSprite {
        textures: (0..8).map(|i| format!("particle/smoke_{}", i)).collect()
    });
    map.insert("large_smoke", ParticleSprite {
        textures: (0..8).map(|i| format!("particle/large_smoke_{}", i)).collect()
    });

    // Crit / enchanted hit: single frame but random selection from variants
    map.insert("crit", ParticleSprite { textures: vec!["particle/crit".into()] });
    map.insert("enchanted_hit", ParticleSprite { textures: vec!["particle/enchanted_hit".into()] });

    // Portal: 16 frames (portal_0 through portal_15)
    map.insert("portal", ParticleSprite {
        textures: (0..16).map(|i| format!("particle/portal_{}", i)).collect()
    });

    // Enchant: 16 frames
    map.insert("enchant", ParticleSprite {
        textures: (0..16).map(|i| format!("particle/enchant_{}", i)).collect()
    });

    // Dust / reddust: 8 frames
    map.insert("dust", ParticleSprite {
        textures: (0..8).map(|i| format!("particle/dust_{}", i)).collect()
    });

    // Spell effects
    map.insert("effect", ParticleSprite {
        textures: (0..8).map(|i| format!("particle/effect_{}", i)).collect()
    });
    map.insert("instant_effect", ParticleSprite {
        textures: (0..8).map(|i| format!("particle/instant_effect_{}", i)).collect()
    });
    map.insert("witch", ParticleSprite {
        textures: (0..8).map(|i| format!("particle/witch_{}", i)).collect()
    });

    // Campfire smoke: 8 frames
    map.insert("campfire_signal_smoke", ParticleSprite {
        textures: (0..8).map(|i| format!("particle/campfire_signal_smoke_{}", i)).collect()
    });
    map.insert("campfire_cosy_smoke", ParticleSprite {
        textures: (0..8).map(|i| format!("particle/campfire_cosy_smoke_{}", i)).collect()
    });

    map
});

// ============================================================================
// UV coordinate storage (populated from JavaScript after atlas build)
// ============================================================================

/// UV coordinates for a texture: [u0, v0, u1, v1]
pub type UvCoords = [f32; 4];

/// Thread-local storage for UV lookup table (populated by JS after atlas build).
/// Uses interior mutability for updates.
thread_local! {
    static UV_LOOKUP: std::cell::RefCell<HashMap<String, UvCoords>> = std::cell::RefCell::new(HashMap::new());
}

/// Initialize or update the UV lookup table from JavaScript.
/// Called by JS after building the texture atlas.
#[wasm_bindgen]
pub fn particle_sprites_set_uv_lookup(uv_data: &JsValue) -> Result<(), JsValue> {
    let lookup: HashMap<String, UvCoords> = serde_wasm_bindgen::from_value(uv_data.clone())?;
    UV_LOOKUP.with(|cell| {
        *cell.borrow_mut() = lookup;
    });
    Ok(())
}

/// Get UV coordinates for a texture name.
fn get_uv(texture_name: &str) -> Option<UvCoords> {
    UV_LOOKUP.with(|cell| cell.borrow().get(texture_name).copied())
}

/// Fallback UV coordinates (stone texture) when texture not found.
const FALLBACK_UV: UvCoords = [0.0, 0.0, 1.0, 1.0];

// ============================================================================
// Frame selection logic (ported from particleSprite function)
// ============================================================================

/// Sprite animation mode.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpriteMode {
    /// Random frame selection (uses particle's random seed)
    Random,
    /// Sequential frame selection based on particle age
    Sequential,
    /// Single static frame (first frame)
    Static,
}

impl Default for SpriteMode {
    fn default() -> Self {
        SpriteMode::Sequential
    }
}

/// Calculate the frame index for a particle.
///
/// # Arguments
/// * `particle_type` - The particle type name (e.g., "smoke", "flame")
/// * `age` - Current particle age in ticks
/// * `max_age` - Maximum particle age in ticks
/// * `partial_tick` - Partial tick interpolation [0, 1)
/// * `sprite_mode` - Animation mode (random, sequential, static)
/// * `random_seed` - Random value in [0, 1) for random mode (from particle.spriteRandom)
///
/// # Returns
/// Frame index, or None if particle type not found.
pub fn particle_sprite_frame_index(
    particle_type: &str,
    age: i32,
    max_age: i32,
    partial_tick: f32,
    sprite_mode: SpriteMode,
    random_seed: f32,
) -> Option<usize> {
    let sprite = PARTICLE_SPRITES.get(particle_type)?;
    let frame_count = sprite.textures.len();
    if frame_count == 0 {
        return None;
    }

    let frame = match sprite_mode {
        SpriteMode::Random => {
            // Random frame: use particle's random seed
            let idx = (random_seed * frame_count as f32).floor() as usize;
            idx.min(frame_count - 1)
        }
        SpriteMode::Sequential => {
            // Sequential: animate based on age
            let progress = (age as f32 + partial_tick) / (max_age as f32 + 1.0);
            let idx = (progress * frame_count as f32).floor() as usize;
            idx.min(frame_count - 1)
        }
        SpriteMode::Static => 0,
    };

    Some(frame)
}

/// Get the texture name for a particle at a specific frame.
pub fn particle_sprite_texture_name(particle_type: &str, frame: usize) -> Option<String> {
    let sprite = PARTICLE_SPRITES.get(particle_type)?;
    sprite.textures.get(frame).cloned()
}

// ============================================================================
// WASM exports
// ============================================================================

/// Get UV coordinates for a particle sprite.
///
/// # Arguments
/// * `particle_type` - Particle type name (e.g., "smoke", "flame", "portal")
/// * `age` - Current particle age in ticks
/// * `max_age` - Maximum particle age in ticks
/// * `partial_tick` - Partial tick interpolation [0, 1)
/// * `sprite_mode` - 0=sequential, 1=random, 2=static
/// * `random_seed` - Random value in [0, 1) for random mode
///
/// # Returns
/// UV coordinates as [u0, v0, u1, v1], or null if particle type not found.
#[wasm_bindgen]
pub fn particle_sprite_get(
    particle_type: &str,
    age: i32,
    max_age: i32,
    partial_tick: f32,
    sprite_mode: u8,
    random_seed: f32,
) -> Option<Vec<f32>> {
    let mode = match sprite_mode {
        0 => SpriteMode::Sequential,
        1 => SpriteMode::Random,
        2 => SpriteMode::Static,
        _ => SpriteMode::Sequential,
    };

    let frame = particle_sprite_frame_index(particle_type, age, max_age, partial_tick, mode, random_seed)?;
    let texture_name = particle_sprite_texture_name(particle_type, frame)?;
    let uv = get_uv(&texture_name).unwrap_or(FALLBACK_UV);
    Some(uv.to_vec())
}

/// Get UV coordinates for a particle sprite by explicit frame index.
///
/// # Arguments
/// * `particle_type` - Particle type name
/// * `frame` - Explicit frame index
///
/// # Returns
/// UV coordinates as [u0, v0, u1, v1], or null if particle type/frame not found.
#[wasm_bindgen]
pub fn particle_sprite_get_frame(particle_type: &str, frame: usize) -> Option<Vec<f32>> {
    let texture_name = particle_sprite_texture_name(particle_type, frame)?;
    let uv = get_uv(&texture_name).unwrap_or(FALLBACK_UV);
    Some(uv.to_vec())
}

/// Get the number of animation frames for a particle type.
#[wasm_bindgen]
pub fn particle_sprite_frame_count(particle_type: &str) -> usize {
    PARTICLE_SPRITES
        .get(particle_type)
        .map(|s| s.textures.len())
        .unwrap_or(0)
}

/// Check if a particle type exists in the registry.
#[wasm_bindgen]
pub fn particle_sprite_exists(particle_type: &str) -> bool {
    PARTICLE_SPRITES.contains_key(particle_type)
}

/// Get all registered particle type names.
#[wasm_bindgen]
pub fn particle_sprite_list() -> Vec<String> {
    PARTICLE_SPRITES.keys().map(|k| k.to_string()).collect()
}

/// Get the texture names for a particle type (for debugging/inspection).
#[wasm_bindgen]
pub fn particle_sprite_textures(particle_type: &str) -> Option<Vec<String>> {
    PARTICLE_SPRITES.get(particle_type).map(|s| s.textures.clone())
}

/// Serializable representation of the particle sprite registry (for debugging).
#[wasm_bindgen]
pub fn particle_sprite_registry_json() -> String {
    serde_json::to_string(&*PARTICLE_SPRITES).unwrap_or_default()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_contains_common_particles() {
        assert!(PARTICLE_SPRITES.contains_key("smoke"));
        assert!(PARTICLE_SPRITES.contains_key("flame"));
        assert!(PARTICLE_SPRITES.contains_key("portal"));
        assert!(PARTICLE_SPRITES.contains_key("poof"));
    }

    #[test]
    fn test_frame_index_sequential() {
        // 8 frames, age 0, max_age 7, partial 0 -> frame 0
        let frame = particle_sprite_frame_index("smoke", 0, 7, 0.0, SpriteMode::Sequential, 0.0);
        assert_eq!(frame, Some(0));

        // Age 3.5 (halfway) -> frame 4
        let frame = particle_sprite_frame_index("smoke", 3, 7, 0.5, SpriteMode::Sequential, 0.0);
        assert_eq!(frame, Some(4));

        // Age 7 (end) -> frame 7
        let frame = particle_sprite_frame_index("smoke", 7, 7, 0.0, SpriteMode::Sequential, 0.0);
        assert_eq!(frame, Some(7));
    }

    #[test]
    fn test_frame_index_random() {
        // Random mode with seed 0.5, 8 frames -> frame 4
        let frame = particle_sprite_frame_index("smoke", 0, 7, 0.0, SpriteMode::Random, 0.5);
        assert_eq!(frame, Some(4));

        // Seed 0.99 -> frame 7 (last)
        let frame = particle_sprite_frame_index("smoke", 0, 7, 0.0, SpriteMode::Random, 0.99);
        assert_eq!(frame, Some(7));
    }

    #[test]
    fn test_frame_count() {
        assert_eq!(particle_sprite_frame_count("smoke"), 8);
        assert_eq!(particle_sprite_frame_count("flame"), 1);
        assert_eq!(particle_sprite_frame_count("portal"), 16);
        assert_eq!(particle_sprite_frame_count("nonexistent"), 0);
    }

    #[test]
    fn test_texture_names() {
        let textures = particle_sprite_textures("smoke").unwrap();
        assert_eq!(textures.len(), 8);
        assert_eq!(textures[0], "particle/smoke_0");
        assert_eq!(textures[7], "particle/smoke_7");

        let textures = particle_sprite_textures("flame").unwrap();
        assert_eq!(textures.len(), 1);
        assert_eq!(textures[0], "particle/flame");
    }
}