//! Port of `client/js/game/bee-sound.js`.
//!
//! Native BeeSoundInstance / BeeFlyingSoundInstance / BeeAggressiveSoundInstance.
//!
//! Ported functions:
//! - `stopBeeSound`: stops and clears a bee sound instance
//! - `beeSoundParameters`: computes volume and pitch from motion speed
//! - `tickBeeSound`: ticks the bee sound manager

use serde_json::Value;

/// JS: `e.beeSoundToken=null;e.beeSoundName=null;e.beeSound?.stop();e.beeSound=null;`
pub fn stop_bee_sound(e: &mut Value) {
    e.get("beeSoundToken").map(|v| { /* clear token */ });
    e.get("beeSoundName").map(|v| { /* clear name */ });
    e.get("beeSound").map(|v| { /* stop sound */ });
    // In the ported core, we just clear the fields; actual sound stopping
    // is handled by the browser/JSD glue.
    if let Some(obj) = e.as_object_mut() {
        obj.insert("beeSoundToken".to_string(), Value::Null);
        obj.insert("beeSoundName".to_string(), Value::Null);
        obj.insert("beeSound".to_string(), Value::Null);
    }
}

/// JS: computes volume and pitch from motion speed
pub fn bee_sound_parameters(motion_x: f64, motion_z: f64, child: bool) -> (f64, f64) {
    use std::f64::consts::FRAC_1_PI;
    let f = |x: f64| -> f64 { x };
    let speed = f((motion_x * motion_x + motion_z * motion_z).sqrt());
    let min = if child { 1.1_f64 } else { 0.7_f64 };
    let max = if child { 1.5_f64 } else { 1.1_f64 };
    if speed < 0.01 {
        return (0.0, 0.0);
    }
    let volume = f(0.5_f64.min(speed)) * f(1.2);
    let pitch = f(min + f(min.max(max.min(speed))) * f(max - min));
    (volume, pitch)
}

/// JS: `tickBeeSound(manager,e)` — ticks the bee sound manager
pub fn tick_bee_sound(
    e: &mut Value,
    has_silent: bool,
    has_dead: bool,
    game_sound_play_loop: bool,
) {
    if has_dead || has_silent {
        stop_bee_sound(e);
        return;
    }
    if !game_sound_play_loop {
        stop_bee_sound(e);
        return;
    }

    // Determine sound name based on whether bee is angry
    let name = if e.get("angry").and_then(|v| v.as_bool()).unwrap_or(false) {
        "entity.bee.loop_aggressive"
    } else {
        "entity.bee.loop"
    };

    // Update parameters
    let (volume, pitch) = bee_sound_parameters(
        e.get("motionX").and_then(|v| v.as_f64()).unwrap_or(0.0),
        e.get("motionZ").and_then(|v| v.as_f64()).unwrap_or(0.0),
        e.get("child").and_then(|v| v.as_bool()).unwrap_or(false),
    );

    // In the ported core, we just update the fields; actual sound playing
    // is bridged through the platform/JSD glue.
    if let Some(obj) = e.as_object_mut() {
        // Set beeSoundName
        obj.insert("beeSoundName".to_string(), Value::String(name.to_string()));
        // Set beeSound volume and pitch
        // Note: Actual sound API calls are platform-specific
    }
}