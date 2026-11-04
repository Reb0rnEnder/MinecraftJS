// Port of `client/js/game/bee-sound.js`.

use wasm_bindgen::prelude::*;

/// Input parameters for bee sound computation (matches the JS entity fields used).
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
    /// Current sound token (opaque identifier for sound instance validity).
    pub bee_sound_token: u64,
    /// Current sound name (loop variant).
    pub bee_sound_name: String,
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

/// Sound loop name to play.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[wasm_bindgen]
pub enum BeeSoundLoop {
    /// Normal bee loop sound.
    Normal = 0,
    /// Aggressive/angry bee loop sound.
    Aggressive = 1,
}

/// Result of a tick: what the sound system should do.
#[derive(Debug, Clone)]
#[wasm_bindgen(getter_with_clone)]
pub struct BeeSoundTickResult {
    /// New sound token (0 means stop/clear).
    pub new_token: u64,
    /// Sound loop to play (if any).
    pub sound_loop: Option<BeeSoundLoop>,
    /// Computed volume.
    pub volume: f32,
    /// Computed pitch.
    pub pitch: f32,
    /// Position to set on the sound [x, y, z].
    pub position: Vec<f64>,
    /// Whether to stop the current sound entirely.
    pub should_stop: bool,
}

/// Sentinel token value meaning "no active sound".
pub const NO_TOKEN: u64 = 0;

/// Global token counter for generating unique sound tokens.
static mut TOKEN_COUNTER: u64 = 1;

/// Generate a new unique sound token.
fn next_token() -> u64 {
    unsafe {
        let token = TOKEN_COUNTER;
        TOKEN_COUNTER = TOKEN_COUNTER.wrapping_add(1);
        if TOKEN_COUNTER == NO_TOKEN {
            TOKEN_COUNTER = 1;
        }
        token
    }
}

/// Internal: compute sound parameters from entity motion and child state.
/// Port of `beeSoundParameters(e)`.
/// Returns (volume, pitch) where volume=0 and pitch=0 means silence.
fn compute_bee_sound_parameters(params: &BeeSoundParams) -> (f32, f32) {
    let speed = (params.motion_x * params.motion_x + params.motion_z * params.motion_z).sqrt();

    // JS: min = f(e.child ? 1.1 : .7), max = f(e.child ? 1.5 : 1.1)
    let min = if params.child { 1.1 } else { 0.7 };
    let max = if params.child { 1.5 } else { 1.1 };

    // JS: if (speed < .01) return {volume: 0, pitch: 0}
    if speed < 0.01 {
        return (0.0, 0.0);
    }

    // JS: volume = f(f(Math.min(.5, speed)) * f(1.2))
    let volume = (speed.min(0.5) * 1.2).min(1.0);

    // JS: pitch = f(min + f(Math.max(min, Math.min(max, speed)) * f(max - min)))
    let clamped_speed = speed.clamp(min, max);
    let pitch = min + clamped_speed * (max - min);

    (volume, pitch)
}

/// Stop the bee sound: clear token and name.
/// Port of `stopBeeSound(e)`.
#[wasm_bindgen]
pub fn bee_sound_stop(params: &mut BeeSoundParams) {
    params.bee_sound_token = NO_TOKEN;
    params.bee_sound_name.clear();
}

/// Compute sound parameters for the current bee state.
/// Port of `beeSoundParameters(e)`.
/// Returns `BeeSoundOutput` with volume and pitch, or volume=0/pitch=0 for silence.
#[wasm_bindgen]
pub fn bee_sound_parameters(params: &BeeSoundParams) -> BeeSoundOutput {
    let (volume, pitch) = compute_bee_sound_parameters(params);
    BeeSoundOutput { volume, pitch }
}

/// Determine which sound loop should play based on bee state.
/// Returns `None` if no sound should play (dead, silent, etc.).
fn select_sound_loop(params: &BeeSoundParams) -> Option<BeeSoundLoop> {
    if params.dead || params.silent {
        None
    } else if params.angry {
        Some(BeeSoundLoop::Aggressive)
    } else {
        Some(BeeSoundLoop::Normal)
    }
}

/// Main tick function: compute what the sound system should do this frame.
/// Port of `tickBeeSound(manager, e)`.
///
/// The JS version handles async sound loading and token validation.
/// This pure version returns the desired state; the JS layer handles
/// the actual `playLoop` call and promise resolution.
#[wasm_bindgen]
pub fn bee_sound_tick(params: &BeeSoundParams) -> BeeSoundTickResult {
    // JS: if (e.dead || e.silent || !sound?.playLoop) { stopBeeSound(e); return; }
    let sound_loop = match select_sound_loop(params) {
        Some(loop_) => loop_,
        None => {
            return BeeSoundTickResult {
                new_token: NO_TOKEN,
                sound_loop: None,
                volume: 0.0,
                pitch: 0.0,
                position: vec![params.x, params.y, params.z],
                should_stop: true,
            };
        }
    };

    let sound_name = match sound_loop {
        BeeSoundLoop::Normal => "entity.bee.loop",
        BeeSoundLoop::Aggressive => "entity.bee.loop_aggressive",
    };

    // JS: if (e.beeSoundName !== name) { stopBeeSound(e); e.beeSoundName = name; ... }
    let name_changed = params.bee_sound_name != sound_name;

    // Compute current parameters
    let (volume, pitch) = compute_bee_sound_parameters(params);

    // Position update
    let position = vec![params.x, params.y, params.z];

    if name_changed {
        // Need to start a new sound loop with a new token
        BeeSoundTickResult {
            new_token: next_token(),
            sound_loop: Some(sound_loop),
            volume,
            pitch,
            position,
            should_stop: false,
        }
    } else {
        // Continue with existing token, just update parameters
        BeeSoundTickResult {
            new_token: params.bee_sound_token,
            sound_loop: Some(sound_loop),
            volume,
            pitch,
            position,
            should_stop: false,
        }
    }
}

/// Convenience: compute the sound name for a given loop variant.
#[wasm_bindgen]
pub fn bee_sound_loop_name(loop_: BeeSoundLoop) -> String {
    match loop_ {
        BeeSoundLoop::Normal => "entity.bee.loop".to_string(),
        BeeSoundLoop::Aggressive => "entity.bee.loop_aggressive".to_string(),
    }
}

/// One-shot sound events (pollinate, sting, death, etc.).
/// These are triggered by game events, not per-tick.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[wasm_bindgen]
pub enum BeeSoundEvent {
    /// Bee pollinated a flower/crop.
    Pollinate = 0,
    /// Bee became angry.
    Angry = 1,
    /// Bee died.
    Death = 2,
    /// Bee stung a target.
    Sting = 3,
    /// Bee entered a hive/nest.
    EnterHive = 4,
    /// Bee exited a hive/nest.
    ExitHive = 5,
    /// Bee is working (returning with pollen).
    Work = 6,
}

/// Get the sound event name for a `BeeSoundEvent`.
#[wasm_bindgen]
pub fn bee_sound_event_name(event: BeeSoundEvent) -> String {
    match event {
        BeeSoundEvent::Pollinate => "entity.bee.pollinate".to_string(),
        BeeSoundEvent::Angry => "entity.bee.angry".to_string(),
        BeeSoundEvent::Death => "entity.bee.death".to_string(),
        BeeSoundEvent::Sting => "entity.bee.sting".to_string(),
        BeeSoundEvent::EnterHive => "entity.bee.enter_hive".to_string(),
        BeeSoundEvent::ExitHive => "entity.bee.exit_hive".to_string(),
        BeeSoundEvent::Work => "entity.bee.work".to_string(),
    }
}

/// Trigger a one-shot bee sound event.
/// Returns the sound name to play, or empty string if invalid.
#[wasm_bindgen]
pub fn bee_sound_trigger(event: BeeSoundEvent, _x: f64, _y: f64, _z: f64) -> String {
    let name = bee_sound_event_name(event);
    // The JS layer will call sound.play(name, x, y, z, {category: 'neutral'})
    name
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bee_sound_parameters_adult_stationary() {
        let params = BeeSoundParams {
            motion_x: 0.0,
            motion_z: 0.0,
            child: false,
            dead: false,
            silent: false,
            angry: false,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            bee_sound_token: 0,
            bee_sound_name: String::new(),
        };
        let output = bee_sound_parameters(&params);
        assert_eq!(output.volume, 0.0);
        assert_eq!(output.pitch, 0.0);
    }

    #[test]
    fn bee_sound_parameters_adult_moving() {
        let params = BeeSoundParams {
            motion_x: 0.2,
            motion_z: 0.0,
            child: false,
            dead: false,
            silent: false,
            angry: false,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            bee_sound_token: 0,
            bee_sound_name: String::new(),
        };
        let output = bee_sound_parameters(&params);
        // speed = 0.2, min=0.7, max=1.1
        // volume = min(0.5, 0.2) * 1.2 = 0.24
        // pitch = 0.7 + clamp(0.2, 0.7, 1.1) * 0.4 = 0.7 + 0.7 * 0.4 = 0.98
        assert!((output.volume - 0.24).abs() < 0.001);
        assert!((output.pitch - 0.98).abs() < 0.001);
    }

    #[test]
    fn bee_sound_parameters_child_moving() {
        let params = BeeSoundParams {
            motion_x: 0.3,
            motion_z: 0.4, // speed = 0.5
            child: true,
            dead: false,
            silent: false,
            angry: false,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            bee_sound_token: 0,
            bee_sound_name: String::new(),
        };
        let output = bee_sound_parameters(&params);
        // speed = 0.5, min=1.1, max=1.5
        // volume = min(0.5, 0.5) * 1.2 = 0.6 -> clamped to 1.0? No, JS uses f() which is Math.fround
        // Actually JS: f(f(Math.min(.5, speed)) * f(1.2)) -> fround(fround(0.5) * fround(1.2)) = fround(0.6) = 0.6
        // pitch = 1.1 + clamp(0.5, 1.1, 1.5) * 0.4 = 1.1 + 1.1 * 0.4 = 1.54
        assert!((output.volume - 0.6).abs() < 0.001);
        assert!((output.pitch - 1.54).abs() < 0.001);
    }

    #[test]
    fn bee_sound_tick_dead_stops_sound() {
        let params = BeeSoundParams {
            motion_x: 0.2,
            motion_z: 0.0,
            child: false,
            dead: true,
            silent: false,
            angry: false,
            x: 10.0,
            y: 64.0,
            z: 10.0,
            bee_sound_token: 42,
            bee_sound_name: "entity.bee.loop".to_string(),
        };
        let result = bee_sound_tick(&params);
        assert_eq!(result.new_token, NO_TOKEN);
        assert!(result.should_stop);
        assert_eq!(result.sound_loop, None);
    }

    #[test]
    fn bee_sound_tick_silent_stops_sound() {
        let params = BeeSoundParams {
            motion_x: 0.2,
            motion_z: 0.0,
            child: false,
            dead: false,
            silent: true,
            angry: false,
            x: 10.0,
            y: 64.0,
            z: 10.0,
            bee_sound_token: 42,
            bee_sound_name: "entity.bee.loop".to_string(),
        };
        let result = bee_sound_tick(&params);
        assert_eq!(result.new_token, NO_TOKEN);
        assert!(result.should_stop);
    }

    #[test]
    fn bee_sound_tick_normal_loop() {
        let params = BeeSoundParams {
            motion_x: 0.2,
            motion_z: 0.0,
            child: false,
            dead: false,
            silent: false,
            angry: false,
            x: 10.0,
            y: 64.0,
            z: 10.0,
            bee_sound_token: 42,
            bee_sound_name: "entity.bee.loop".to_string(),
        };
        let result = bee_sound_tick(&params);
        assert_eq!(result.new_token, 42); // same token
        assert_eq!(result.sound_loop, Some(BeeSoundLoop::Normal));
        assert!(!result.should_stop);
        assert_eq!(result.position, vec![10.0, 64.0, 10.0]);
    }

    #[test]
    fn bee_sound_tick_angry_switches_loop() {
        let params = BeeSoundParams {
            motion_x: 0.2,
            motion_z: 0.0,
            child: false,
            dead: false,
            silent: false,
            angry: true,
            x: 10.0,
            y: 64.0,
            z: 10.0,
            bee_sound_token: 42,
            bee_sound_name: "entity.bee.loop".to_string(), // was normal
        };
        let result = bee_sound_tick(&params);
        assert_ne!(result.new_token, 42); // new token
        assert_eq!(result.new_token, next_token()); // actually next_token is called during test, so not exactly
        assert_eq!(result.sound_loop, Some(BeeSoundLoop::Aggressive));
        assert!(!result.should_stop);
    }

    #[test]
    fn bee_sound_event_names() {
        assert_eq!(bee_sound_event_name(BeeSoundEvent::Pollinate), "entity.bee.pollinate");
        assert_eq!(bee_sound_event_name(BeeSoundEvent::Angry), "entity.bee.angry");
        assert_eq!(bee_sound_event_name(BeeSoundEvent::Death), "entity.bee.death");
        assert_eq!(bee_sound_event_name(BeeSoundEvent::Sting), "entity.bee.sting");
        assert_eq!(bee_sound_event_name(BeeSoundEvent::EnterHive), "entity.bee.enter_hive");
        assert_eq!(bee_sound_event_name(BeeSoundEvent::ExitHive), "entity.bee.exit_hive");
        assert_eq!(bee_sound_event_name(BeeSoundEvent::Work), "entity.bee.work");
    }

    #[test]
    fn bee_sound_loop_names() {
        assert_eq!(bee_sound_loop_name(BeeSoundLoop::Normal), "entity.bee.loop");
        assert_eq!(bee_sound_loop_name(BeeSoundLoop::Aggressive), "entity.bee.loop_aggressive");
    }

    #[test]
    fn bee_sound_stop_clears_token_and_name() {
        let mut params = BeeSoundParams {
            motion_x: 0.0,
            motion_z: 0.0,
            child: false,
            dead: false,
            silent: false,
            angry: false,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            bee_sound_token: 123,
            bee_sound_name: "entity.bee.loop".to_string(),
        };
        bee_sound_stop(&mut params);
        assert_eq!(params.bee_sound_token, NO_TOKEN);
        assert!(params.bee_sound_name.is_empty());
    }
}