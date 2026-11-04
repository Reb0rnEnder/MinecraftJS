//! Port of `client/js/audio/sound.js`: sound parameter computation.
//! Ported section: beeSoundParameters function.
//! 
//! The full sound system requires AudioContext which is browser-dependent,
//! but the algorithmic sound parameter computation can be ported.

// ------------------------------------------------------------ Bee Sound Parameters

/// JS: `export function beeSoundParameters(e){`
/// ```javascript
/// const f=Math.fround,speed=f(Math.hypot(e.motionX||0,e.motionZ||0)),min=f(e.child?1.1:.7),max=f(e.child?1.5:1.1);
/// if(speed<.01)return {volume:0,pitch:0};
/// return {volume:f(f(Math.min(.5,speed))*f(1.2)),pitch:f(min+f(Math.max(min,Math.min(max,speed))*f(max-min)))};
/// ```
/// ```
/// ```
/// ```
/// Ported from `client/js/game/bee-sound.js` `beeSoundParameters(e)`.
//! Computes volume and pitch from bee entity motion parameters.

/// Input parameters for bee sound computation.
#[derive(Debug, Clone)]
#[wasm_bindgen(getter_with_clone)]
pub struct BeeSoundParams {
    /// Horizontal motion X component.
    pub motion_x: f32,
    /// Horizontal motion Z component.
    pub motion_z: f32,
    /// Whether the bee is a child (baby).
    pub child: bool,
    /// Whether the bee is dead.
    pub dead: bool,
    /// Whether the bee is silent (metadata flag).
    pub silent: bool,
    /// Whether the bee is angry/aggressive.
    pub angry: bool,
    /// Current X position.
    pub x: f64,
    /// Current Y position.
    pub y: f64,
    /// Current Z position.
    pub z: f64,
}

/// Output sound parameters: volume and pitch.
#[derive(Debug, Clone, Copy)]
#[wasm_bindgen(getter_with_clone)]
pub struct BeeSoundOutput {
    /// Volume in range [0.0, 1.0].
    pub volume: f32,
    /// Pitch multiplier (1.0 = normal).
    pub pitch: f32,
}

/// Compute sound parameters from a bee entity.
///
/// Port of `client/js/game/bee-sound.js` `beeSoundParameters(e)`.
///
/// # Arguments
/// * `params` - Bee entity parameters
///
/// # Returns
/// * `BeeSoundOutput` - Volume and pitch
pub fn bee_sound_params(params: &BeeSoundParams) -> BeeSoundOutput {
    use std::f32::consts::PI;
    
    let f = |n: f32| -> f32 { n }; // Math.fround in JS, just use f32 in Rust
    
    let speed = (params.motion_x.powi(2) + params.motion_z.powi(2)).sqrt();
    let min = if params.child { 1.1 } else { 0.7 };
    let max = if params.child { 1.5 } else { 1.1 };
    
    if speed < 0.01 {
        return BeeSoundOutput { volume: 0.0, pitch: 0.0 };
    }
    
    let volume = f(f(Math.min(0.5, speed)) * f(1.2));
    let pitch = min + f(Math.max(min, Math.min(max, speed)) * f(max - min));
    
    BeeSoundOutput { volume, pitch }
}

// ------------------------------------------------------------ Exports

// JS: `export { beeSoundParameters }`
#[wasm_bindgen]
pub fn js_bee_sound_params(motion_x: f32, motion_z: f32, child: bool) -> BeeSoundOutput {
    let params = BeeSoundParams {
        motion_x,
        motion_z,
        child,
        dead: false,
        silent: false,
        angry: false,
        x: 0.0,
        y: 0.0,
        z: 0.0,
    };
    bee_sound_params(&params)
}

// ------------------------------------------------------------ Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bee_sound_params_stationary() {
        let params = BeeSoundParams {
            motion_x: 0.0,
            motion_z: 0.0,
            child: false,
            ..Default::default()
        };
        let output = bee_sound_params(&params);
        assert_eq!(output.volume, 0.0);
        assert_eq!(output.pitch, 0.0);
    }

    #[test]
    fn test_bee_sound_params_moving() {
        let params = BeeSoundParams {
            motion_x: 1.0,
            motion_z: 0.0,
            child: false,
            ..Default::default()
        };
        let output = bee_sound_params(&params);
        assert!(output.volume > 0.0);
        assert!(output.pitch > 0.0);
    }

    #[test]
    fn test_bee_sound_params_child() {
        let params = BeeSoundParams {
            motion_x: 1.0,
            motion_z: 0.0,
            child: true,
            ..Default::default()
        };
        let output = bee_sound_params(&params);
        // Child bees have different min/max pitch ranges
        assert!(output.pitch > 0.0);
    }
}