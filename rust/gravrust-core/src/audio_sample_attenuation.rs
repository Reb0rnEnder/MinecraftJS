//! Port of `client/js/audio/sample-attenuation.js` (upstream MinecraftJS 1.8.9).
//!
//! Native SoundEngine uses sample attenuation, not the network SoundEvent
//! fixed range.

/// JS: `sampleAttenuation(volume, sample)` — `Math.fround(max(1, fround(volume)) * 16)`.
pub fn sample_attenuation(volume: f64, _sample: f64) -> f64 {
    (1.0f32 as f64).max(volume as f32 as f64) * 16.0
}

#[cfg(test)]
mod tests {
    #[test]
    fn matches_js() {
        assert_eq!(super::sample_attenuation(0.5, 0.0), 16.0); // max(1, .5) * 16
        assert_eq!(super::sample_attenuation(2.0, 0.0), 32.0);
    }
}
