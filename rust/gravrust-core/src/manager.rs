//! Port of `client/js/game/manager.js`
//!
//! Manager functionality ported from the Minecraft JavaScript implementation.

use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

// ------------------------------------------------------------ Manager

/// Manager entry point, mirroring the JS manager object shape.
#[derive(Debug, Clone)]
pub struct Manager {
    /// Internal state tracking.
    pub state: Value,
}

impl Manager {
    /// Create a new Manager with initial state.
    ///
    /// In the ported core, the initial state is provided by the caller.
    /// The JS original would load from platform settings; here the core
    /// crate remains platform-agnostic.
    pub fn new(initial_state: Value) -> Self {
        Self { state: initial_state }
    }

    /// Get the current manager state.
    pub fn state(&self) -> &Value {
        &self.state
    }

    /// Set the manager state.
    ///
    /// Mirrors updating the manager's internal state from the JS original.
    pub fn set_state(&mut self, state: Value) {
        self.state = state;
    }

    /// Perform a manager tick/update step.
    ///
    /// Mirrors `Manager.prototype.tick()` from the JS original.
    /// The JS implementation handles game state updates, rendering hooks,
    /// and platform interactions. In the core crate this is left as a
    /// placeholder for the platform layer to bridge.
    pub fn tick(&mut self) {
        // Platform bridging: delegate to glue code for actual game logic
    }
}

// ------------------------------------------------------------ Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_creates_manager() {
        let manager = Manager::new(json!({}));
        assert!(manager.state().is_object());
    }

    #[test]
    fn state_get_set() {
        let mut manager = Manager::new(json!({}));
        manager.set_state(json!({ "key": "value" }));
        assert_eq!(manager.state()["key"], Value::String("value".to_string()));
    }
}