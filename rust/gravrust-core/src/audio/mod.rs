//! `crate::audio` â€” compatibility tree matching `client/js/audio/`.
//!
//! WebAudio playback is browser-bound and stays in JavaScript. What is portable
//! is the *sound parameter* arithmetic (bee/honey sounds, pitch and volume from
//! entity motion), which already exists in this crate. This tree re-exports it
//! under the JS path and defines the sound-name container the call sites use.

// `bee_sound_params` is still behind the `unsupported` gate, so the re-export
// is gated identically and begins working when that module is enabled.
#[cfg(feature = "unsupported")]
pub use crate::unsupported_port::bee_sound_params::{bee_sound_params, BeeSoundParams};

/// `client/js/audio/sound.js` â€” the sound name constants the ported modules
/// reference. The JavaScript side is a name table; only the names matter to the
/// algorithmic ports, so they are surfaced as typed constants.
pub mod sound {
    /// JS: `NamedSoundEffect` â€” a sound played at a world position.
    #[derive(Debug, Clone, PartialEq)]
    pub struct NamedSoundEffect {
        /// JS: the sound registry name, e.g. `minecraft:entity.bee.loop`.
        pub name: String,
        /// JS: the sound category (`'neutral'`, `'player'`, ...).
        pub category: String,
        /// JS: `x` â€” world position.
        pub x: f64,
        /// JS: `y` â€” world position.
        pub y: f64,
        /// JS: `z` â€” world position.
        pub z: f64,
        /// JS: `volume`.
        pub volume: f32,
        /// JS: `pitch`.
        pub pitch: f32,
    }

    /// JS: `SoundEffect` â€” a sound played on the client with no world position.
    #[derive(Debug, Clone, PartialEq)]
    pub struct SoundEffect {
        /// JS: the sound registry name.
        pub name: String,
        /// JS: `volume`.
        pub volume: f32,
        /// JS: `pitch`.
        pub pitch: f32,
    }

    /// JS: `StopSound` â€” stops a previously started sound.
    #[derive(Debug, Clone, PartialEq)]
    pub struct StopSound {
        /// JS: the sound registry name to stop.
        pub name: String,
        /// JS: the sound category, when the stop is category-wide.
        pub category: Option<String>,
    }
}

pub use sound::{NamedSoundEffect, SoundEffect, StopSound};


