//! Port of `client/js/audio/sound-gain.js` (upstream MinecraftJS 1.8.9).
//!
//! Native 1.8.9 SoundManager clamps instance times sample volume first;
//! category and listener/master gains apply afterwards (unlike 1.12+).

/// JS: `soundGain(volume, category, settings)` — settings surface reduced to
/// the two fields read: `soundVolumes[category]` (default 1) and
/// `masterVolume`.
pub fn sound_gain(volume: f64, category: &str, category_volume: f64, master_volume: f64) -> f64 {
    let level = if category == "master" { 1.0 } else { category_volume };
    volume.clamp(0.0, 1.0) * level * master_volume
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn master_ignores_category() {
        assert_eq!(sound_gain(0.5, "master", 0.0, 0.8), 0.4);
    }

    #[test]
    fn category_and_master_multiply() {
        assert_eq!(sound_gain(0.5, "music", 0.4, 0.5), 0.1);
        assert_eq!(sound_gain(2.0, "music", 1.0, 1.0), 1.0); // clamped first
    }
}
