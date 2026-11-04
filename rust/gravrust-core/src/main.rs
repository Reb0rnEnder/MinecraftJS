//! GRAVRUST Core entry point.
//! This module is the Rust/WASM port of the main game bootstrap.
//! It is imported from client/js/main.js via initWasm().

use wasm_bindgen::prelude::*;

/// Initialize the Rust WASM core.
/// This is called from client/js/main.js before the game bootstraps.
#[wasm_bindgen]
pub fn init_wasm() {
    // Reset any global state or perform one-time setup here.
    // The JS side (main.js) handles the full application bootstrap,
    // but this hook allows Rust to prepare any state it needs.
}

/// Reset the Rust core state (e.g. when changing worlds/dimensions).
#[wasm_bindgen]
pub fn reset_core() {
    // Reset any persistent Rust state between game sessions.
}

fn main() {
    // The crate ships as a cdylib (WASM) — this binary stub only exists so
    // cargo's auto-detected bin target compiles on native hosts.
}