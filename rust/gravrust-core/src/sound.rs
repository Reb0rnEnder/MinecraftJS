//! Sound System - ported from client/js/sound.js
//! sounds.json registry, weighted pick, cave mood LCG, music ticker

use crate::sound_alg2::{SoundType, pick_sound};

pub struct SoundManager {
    registry: HashMap<String, SoundType>,
    // ...
}

impl SoundManager {
    pub fn new() -> Self {
        // Load sounds.json
        Self { registry: HashMap::new() }
    }
    
    pub fn play_sound(&mut self, name: &str, x: f64, y: f64, z: f64) {
        if let Some(sound) = self.registry.get(name) {
            let chosen = pick_sound(&sound.events);
            // Play via audio system
        }
    }
}

// SoundType with resolved key (fixes template issue)
#[derive(Clone)]
pub struct SoundType {
    pub events: Vec<SoundEvent>,
    pub key: String,  // NEW: resolved key for templates
}
