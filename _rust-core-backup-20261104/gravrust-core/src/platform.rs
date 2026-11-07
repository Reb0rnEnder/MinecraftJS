//! BrowserPlatform - ported from client/js/platform/browser.js
//!
//! Reference implementation of the platform contract.

use crate::browser_alg::{self, Emitter, FrameQueue, SocketEmitter};
use crate::platform_contract::*;

// ... (BrowserPlatform implementation with F-key tracking)
// Key addition: f_key_held field and on_key_down/on_key_up handlers
// that translate F+Digit1..Digit9 -> F1..F9

pub struct BrowserPlatform {
    name: String,
    canvas_width: u32,
    canvas_height: u32,
    f_key_held: bool,  // NEW: Track F key for F+1..F9
    // ... other fields
}

impl BrowserPlatform {
    pub fn new() -> Self {
        Self {
            name: "browser".to_string(),
            f_key_held: false,
            // ...
        }
    }
    
    pub fn on_key_down(&mut self, code: &str, key: &str, repeat: bool, 
                       ctrl: bool, meta: bool, shift: bool, alt: bool) -> KeydownOutcome {
        self.user_gesture();
        
        // Track F key state
        if code == "KeyF" { self.f_key_held = true; }
        
        // F+1..F9 translation
        let (code, key) = if self.f_key_held && code.starts_with("Digit") && code.len() == 6 {
            let digit = &code[5..];
            if let Ok(n) = digit.parse::<u8>() {
                if (1..=9).contains(&n) {
                    let f_key = format!("F{}", n);
                    (f_key.as_str(), f_key.as_str())
                } else { (code, key) }
            } else { (code, key) }
        } else { (code, key) };
        
        let prevent = browser_alg::should_prevent_default(code, ctrl);
        let (event, char) = browser_alg::decode_keydown(code, key, repeat, ctrl, meta, shift, alt);
        // ... emit events
        KeydownOutcome { prevent_default: prevent, event, emitted_char: char }
    }
    
    pub fn on_key_up(&mut self, code: &str, key: &str) -> KeyupEvent {
        if code == "KeyF" { self.f_key_held = false; }
        KeyupEvent { code: code.into(), key: key.into() }
    }
}
