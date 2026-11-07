//! Port of `client/js/game/function-keys.js` (upstream MinecraftJS 1.8.9).
//!
//! Optional Chromebook function keys. Delay a plain F press until release so
//! a chord cannot swap hands before its number arrives. Text editors are
//! untouched (callers only feed this the keys they want processed).

use std::collections::HashMap;

/// JS: `const FUNCTION_CODES = { Digit1:'F1', ..., Equal:'F12' }`.
fn function_code_for(code: &str) -> Option<&'static str> {
    match code {
        "Digit1" => Some("F1"),
        "Digit2" => Some("F2"),
        "Digit3" => Some("F3"),
        "Digit4" => Some("F4"),
        "Digit5" => Some("F5"),
        "Digit6" => Some("F6"),
        "Digit7" => Some("F7"),
        "Digit8" => Some("F8"),
        "Digit9" => Some("F9"),
        "Digit0" => Some("F10"),
        "Minus" => Some("F11"),
        "Equal" => Some("F12"),
        _ => None,
    }
}

/// A keyboard event, narrowed to the fields this module reads or rewrites.
/// JS spreads `{...e}` to clone and override `code`/`key`; here the struct is
/// cloned and the same two fields are replaced.
#[derive(Debug, Clone, PartialEq)]
pub struct KeyEvent {
    pub code: String,
    pub key: String,
    pub ctrl: bool,
    pub alt: bool,
    pub repeat: bool,
    /// JS adds `chordReplay: true` when replaying the buffered F on release.
    pub chord_replay: bool,
}

impl KeyEvent {
    pub fn new(code: &str, key: &str, ctrl: bool, alt: bool, repeat: bool) -> Self {
        KeyEvent {
            code: code.to_string(),
            key: key.to_string(),
            ctrl,
            alt,
            repeat,
            chord_replay: false,
        }
    }

    fn with_function(mut self, code: &str, key: &str) -> Self {
        self.code = code.to_string();
        self.key = key.to_string();
        self
    }
}

/// JS: `export class FunctionKeyChords`.
#[derive(Debug, Default)]
pub struct FunctionKeyChords {
    /// JS: `this.prefix` — the buffered plain-F keydown event.
    prefix: Option<KeyEvent>,
    /// JS: `this.used` — whether any number arrived while F was held.
    used: bool,
    /// JS: `this.keys` — physical code -> function code (or null once replayed).
    keys: HashMap<String, Option<String>>,
}

impl FunctionKeyChords {
    pub fn new() -> Self {
        Self::default()
    }

    /// JS: `reset()`.
    pub fn reset(&mut self) {
        self.prefix = None;
        self.used = false;
        self.keys.clear();
    }

    /// JS: `keyDown(e, enabled) -> events`.
    pub fn key_down(&mut self, e: &KeyEvent, enabled: bool) -> Vec<KeyEvent> {
        // A second F while the prefix is buffered is swallowed.
        if e.code == "KeyF" && self.prefix.is_some() {
            return vec![];
        }
        // Repeat of an already-chorded physical key re-emits its function key.
        if let Some(code) = self.keys.get(&e.code) {
            return match code {
                Some(code) => vec![e.clone().with_function(code, code)],
                None => vec![],
            };
        }
        // Buffer a plain F press (no ctrl/alt) when the feature is enabled.
        if e.code == "KeyF" && enabled && !e.ctrl && !e.alt {
            if !e.repeat {
                self.prefix = Some(e.clone());
                self.used = false;
            }
            return vec![];
        }
        // A number/code arrives while F is buffered: emit the function key.
        if self.prefix.is_some() {
            if let Some(code) = function_code_for(&e.code) {
                self.used = true;
                self.keys.insert(e.code.clone(), Some(code.to_string()));
                return vec![e.clone().with_function(code, code)];
            }
        }
        vec![e.clone()]
    }

    /// JS: `keyUp(e) -> events`.
    pub fn key_up(&mut self, e: &KeyEvent) -> Vec<KeyEvent> {
        if let Some(code) = self.keys.remove(&e.code) {
            return match code {
                Some(code) => vec![e.clone().with_function(&code, &code)],
                None => vec![],
            };
        }
        if e.code == "KeyF" {
            if let Some(f) = self.prefix.take() {
                let mut events = Vec::new();
                if !self.used {
                    // F released alone: replay it, then pass the release through.
                    let mut replay = f.clone();
                    replay.repeat = false;
                    replay.chord_replay = true;
                    events.push(replay);
                    events.push(e.clone());
                } else {
                    // F released after a chord: emit keyups for every buffered
                    // function key, then park their physical codes as null.
                    let physical: Vec<(String, Option<String>)> =
                        self.keys.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
                    for (physical_code, code) in physical {
                        if let Some(code) = code {
                            events.push(e.clone().with_function(&code, &code).with_physical(&physical_code));
                        }
                        self.keys.insert(physical_code, None);
                    }
                }
                self.used = false;
                return events;
            }
        }
        vec![e.clone()]
    }
}

impl KeyEvent {
    /// JS `{...e, code, key}` keeps the ORIGINAL event's `code` field unless
    /// overridden — the spread order is `{...e, code, key: code}` where `code`
    /// is the function code, so both are overridden. This helper exists for
    /// the keyUp replay path which iterates `this.keys` (physical -> code):
    /// the emitted event keeps `e`'s fields but carries the function code.
    fn with_physical(mut self, _physical: &str) -> Self {
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plain_f_replays_on_release() {
        let mut chords = FunctionKeyChords::new();
        let f_down = KeyEvent::new("KeyF", "f", false, false, false);
        assert!(chords.key_down(&f_down, true).is_empty());
        let digit = KeyEvent::new("Digit1", "1", false, false, false);
        let emitted = chords.key_down(&digit, true);
        assert_eq!(emitted.len(), 1);
        assert_eq!(emitted[0].code, "F1");
        // F released after use: one keyup per buffered key (JS used-branch),
        // emitted from the F keyup event with the function code applied.
        let ups = chords.key_up(&f_down);
        assert_eq!(ups.len(), 1);
        assert_eq!(ups[0].code, "F1");
        assert_eq!(ups[0].key, "F1");
        // The physical Digit1 was parked as null: its keyup is swallowed.
        let ups = chords.key_up(&KeyEvent::new("Digit1", "1", false, false, false));
        assert!(ups.is_empty());
    }

    #[test]
    fn f_passes_through_when_disabled() {
        let mut chords = FunctionKeyChords::new();
        let f_down = KeyEvent::new("KeyF", "f", false, false, false);
        let out = chords.key_down(&f_down, false);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].code, "KeyF");
    }

    #[test]
    fn f_with_ctrl_passes_through() {
        let mut chords = FunctionKeyChords::new();
        let f_down = KeyEvent::new("KeyF", "f", true, false, false);
        let out = chords.key_down(&f_down, true);
        assert_eq!(out.len(), 1);
    }

    #[test]
    fn chord_keyup_emits_function_keyups() {
        let mut chords = FunctionKeyChords::new();
        chords.key_down(&KeyEvent::new("KeyF", "f", false, false, false), true);
        chords.key_down(&KeyEvent::new("Digit2", "2", false, false, false), true);
        // Physical keyup of a chorded key: emits its function key and DELETES
        // the map entry (JS keys.delete, not park-null).
        let ups = chords.key_up(&KeyEvent::new("Digit2", "2", false, false, false));
        assert_eq!(ups.len(), 1);
        assert_eq!(ups[0].code, "F2");
        // F release after use: no buffered keys remain -> no events.
        let ups = chords.key_up(&KeyEvent::new("KeyF", "f", false, false, false));
        assert_eq!(ups.len(), 0);
        // A later physical keyup of the already-deleted code passes through.
        let ups = chords.key_up(&KeyEvent::new("Digit2", "2", false, false, false));
        assert_eq!(ups.len(), 1);
        assert_eq!(ups[0].code, "Digit2");
    }
}
