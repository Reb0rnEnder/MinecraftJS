//! Port of `client/js/render/water-fog.js`.

use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

/// Water fog state parsed from the JS `state` object.
/// `biomeId` defaults to 1 when absent/null; `waterVision` defaults to 0.
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct WaterFogState {
    /// Biome ID (defaults to 1 if absent/null).
    pub biome_id: i32,
    /// Water vision level, clamped [0, 1].
    pub water_vision: f64,
}

/// Water fog transition returned by `water_fog`.
/// The renderer keeps the returned `transition` object between frames.
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct WaterFogTransition {
    /// Target color RGBA packed as u32.
    pub target: u32,
    /// Source color RGBA packed as u32 (during transition).
    pub from: u32,
    /// Time (ms) when this transition started.
    pub time: f64,
}

/// Result of `water_fog`: the transition and the fog color/density.
#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct WaterFogResult {
    /// The transition object kept between frames.
    pub transition: WaterFogTransition,
    /// RGB color channels as f64 in [0, 1].
    pub color: [f64; 3],
    /// Fog density.
    pub density: f64,
}

const WATER_BIOME_COLORS: &[(u32, u32)] = &[
    // (biome_id, bottom_color) - simplified from WATER_BIOMES JS module
    // Index 1 = plains color 329011, used as default.
    (1, 329011),
    // Other biome colors would be populated from the JS WATER_BIOMES import.
];

/// Port of `client/js/render/water-fog.js`.
///
/// JS signature: `waterFog(state, previous, now)`
/// - `state` has `biomeId` (nullish-coalesces to 1) and `waterVision` (clamped [0,1])
/// - `previous` is an optional transition object `{target, from, time}`
/// - `now` is current time in ms
/// Returns `{transition, color: [r,g,b], density}`
#[allow(clippy::too_many_arguments)]
pub fn water_fog(
    state: WaterFogState,
    previous: Option<WaterFogTransition>,
    now: f64,
) -> WaterFogResult {
    let id = state.biome_id.max(1); // JS: state.biomeId ?? 1
    let color = WATER_BIOME_COLORS
        .get(id as usize)
        .map_or_else(|| WATER_BIOME_COLORS.get(1).unwrap().1, |&(_, c)| c);

    let transition = previous.unwrap_or_else(|| WaterFogTransition {
        target: color,
        from: color,
        time: now,
    });

    let mix = ((now - transition.time) / 5000.0).max(0.0).min(1.0);
    let channels = [16u32, 8, 0].map(|shift| {
        ((transition.from >> shift) & 0xff) as f64 * (1.0 - mix)
            + ((transition.target >> shift) & 0xff) as f64 * mix
    });

    let next = if transition.target != color {
        let packed = channels
            .iter()
            .enumerate()
            .fold(0u32, |acc, (index, value)| {
                acc | ((value.floor() as u32) << [16, 8, 0][index])
            });
        WaterFogTransition {
            target: color,
            from: packed,
            time: now,
        }
    } else {
        transition
    };

    let vision = state.water_vision.max(0.0).min(1.0);
    let density = 0.05
        - vision * vision * 0.03
        + if [6, 134].contains(&id) {
            0.005
        } else {
            0.0
        };

    let color_arr = [channels[0] / 255.0, channels[1] / 255.0, channels[2] / 255.0];

    WaterFogResult {
        transition: next,
        color: color_arr,
        density,
    }
}

/// JSON-based wasm-bindgen wrapper around `water_fog`.
/// `state_json`: `{"biomeId": 1, "waterVision": 0.5}`; `previous_json`: `{"target":..,"from":..,"time":..}` or null.
#[wasm_bindgen]
pub fn water_fog_json(state_json: &str, previous_json: Option<String>, now: f64) -> String {
    let state: WaterFogState = serde_json::from_str(state_json)
        .unwrap_or(WaterFogState { biome_id: 1, water_vision: 0.0 });
    let previous: Option<WaterFogTransition> =
        previous_json.and_then(|s| serde_json::from_str(&s).ok());
    let result = water_fog(state, previous, now);
    serde_json::to_string(&result).unwrap_or_else(|_| "null".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_frame_starts_at_the_biome_color() {
        let state = WaterFogState {
            biome_id: 1,
            water_vision: 0.0,
        };
        let out = water_fog(state, None, 1000.0);
        assert_eq!(out.transition.target, 329011);
        assert_eq!(out.transition.from, 329011);
        assert_eq!(out.transition.time, 1000.0);
        assert_eq!(out.color, [5.0 / 255.0, 5.0 / 255.0, 51.0 / 255.0]); // 329011 = 0x050533
        assert_eq!(out.density, 0.05);
    }

    #[test]
    fn target_change_starts_a_transition() {
        // Swamp fog (2302743) target, previous was plains (329011), 2.5s in.
        let state = WaterFogState {
            biome_id: 6,
            water_vision: 0.5,
        };
        let out = water_fog(
            state,
            Some(WaterFogTransition {
                target: 2302743,
                from: 329011,
                time: 0.0,
            }),
            2500.0,
        );
        assert_eq!(out.transition.target, 2302743);
        assert_eq!(out.transition.time, 2500.0);
        // After 2.5s of 5s transition, mix = 0.5
        assert!(out.density > 0.04 && out.density < 0.05);
    }

    #[test]
    fn completed_transition_is_stable() {
        let state = WaterFogState {
            biome_id: 1,
            water_vision: 0.0,
        };
        let first = water_fog(
            state,
            Some(WaterFogTransition {
                target: 329011,
                from: 329011,
                time: 0.0,
            }),
            6000.0,
        );
        assert_eq!(first.transition.target, 329011);
        assert_eq!(first.transition.from, 329011);
    }
}