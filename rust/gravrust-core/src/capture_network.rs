//! Port of `client/js/debug/capture-network.js`.
//!
//! Local-only bounded diagnostics for network traffic. Captures packets,
//! decode errors, and handler events with a bounded circular buffer.
//! Never collects sensitive data (chat, credentials, UUIDs, raw payloads,
//! server URLs).
//!
//! The Rust core provides the capture data structures and WASM-bound API.
//! The JS-side hooking (monkey-patching game methods) is bridged through
//! the `record` and `count_packet` methods.

use serde_json::Value;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

/// The ACTIVE symbol key used to store the capture result on the game object.
pub const ACTIVE_KEY: &str = "minecraftjs.networkCapture";

/// Default event buffer limit.
const DEFAULT_LIMIT: usize = 512;
/// Minimum allowed limit.
const MIN_LIMIT: usize = 32;
/// Maximum allowed limit.
const MAX_LIMIT: usize = 4096;

/// A single captured network event.
#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
pub struct NetworkEvent {
    /// Milliseconds since capture started.
    pub ms: u64,
    /// Event type (e.g. "unsupported", "decode_error", "handler_error", packet name).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub r#type: Option<String>,
    /// Packet ID (for unsupported packets).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<u32>,
    /// Packet name (for unsupported packets).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub packet_name: Option<String>,
    /// Payload byte length (for unsupported packets).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes: Option<u32>,
    /// Packet fields (for handler events).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub packet: Option<Value>,
    /// Error message (for handler_error).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Game state snapshot after the event.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub after: Option<Value>,
}

/// Snapshot of game state at a point in time.
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct GameSnapshot {
    pub dimension: Option<String>,
    pub world_name: Option<String>,
    pub min_y: i32,
    pub height: i32,
    pub biome_registry_size: Option<usize>,
    pub position: Option<Vec<f64>>,
    pub game_mode: Option<String>,
    pub camera_entity: Option<u32>,
    pub riding_entity_id: Option<u32>,
    pub chunks: Option<usize>,
    pub done_loading_terrain: Option<bool>,
}

/// The captured network data result (returned by `dump` / `stop`).
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct CaptureResult {
    pub version: Option<String>,
    pub initial: GameSnapshot,
    pub counts: HashMap<String, u32>,
    pub events: Vec<NetworkEvent>,
    pub current: GameSnapshot,
}

/// Active network capture session.
pub struct CaptureNetwork {
    events: Vec<NetworkEvent>,
    counts: HashMap<String, u32>,
    initial: GameSnapshot,
    started_ms: u64,
    limit: usize,
    active: bool,
    chunk_samples: u32,
}

impl Default for GameSnapshot {
    fn default() -> Self {
        Self {
            dimension: None,
            world_name: None,
            min_y: 0,
            height: 256,
            biome_registry_size: None,
            position: None,
            game_mode: None,
            camera_entity: None,
            riding_entity_id: None,
            chunks: None,
            done_loading_terrain: None,
        }
    }
}

impl CaptureNetwork {
    fn new(limit: usize) -> Self {
        Self {
            events: Vec::new(),
            counts: HashMap::new(),
            initial: GameSnapshot::default(),
            started_ms: now_ms(),
            limit,
            active: true,
            chunk_samples: 0,
        }
    }

    fn record(&mut self, mut event: NetworkEvent) {
        if !self.active {
            return;
        }
        event.ms = now_ms().saturating_sub(self.started_ms);
        self.events.push(event);
        if self.events.len() > self.limit {
            self.events.remove(0);
        }
    }

    fn count_packet(&mut self, name: &str) {
        *self.counts.entry(name.to_string()).or_insert(0) += 1;
    }

    fn dump(&self) -> CaptureResult {
        CaptureResult {
            version: None,
            initial: self.initial.clone(),
            counts: self.counts.clone(),
            events: self.events.clone(),
            current: GameSnapshot::default(),
        }
    }

    fn stop(&mut self) -> CaptureResult {
        self.active = false;
        self.dump()
    }
}

/// WASM-bound wrapper for CaptureNetwork.
#[wasm_bindgen]
pub struct CaptureNetworkCore {
    inner: CaptureNetwork,
}

#[wasm_bindgen]
impl CaptureNetworkCore {
    /// Start capturing network events with an optional event limit.
    #[wasm_bindgen(constructor)]
    pub fn new(limit: Option<u32>) -> CaptureNetworkCore {
        let limit = limit
            .map(|l| l as usize)
            .unwrap_or(DEFAULT_LIMIT)
            .clamp(MIN_LIMIT, MAX_LIMIT);
        CaptureNetworkCore {
            inner: CaptureNetwork::new(limit),
        }
    }

    /// Record a network event (called from JS hooking layer).
    /// `event_json` is a JSON string matching the NetworkEvent shape.
    pub fn record(&mut self, event_json: &str) {
        let event: NetworkEvent = serde_json::from_str(event_json).unwrap_or_default();
        self.inner.record(event);
    }

    /// Increment a packet name counter (called from JS hooking layer).
    pub fn count_packet(&mut self, name: &str) {
        self.inner.count_packet(name);
    }

    /// Dump all captured data as a JSON string.
    pub fn dump(&self) -> String {
        serde_json::to_string(&self.inner.dump()).unwrap_or_else(|_| "null".to_string())
    }

    /// Stop capturing and return the dump as a JSON string.
    pub fn stop(&mut self) -> String {
        serde_json::to_string(&self.inner.stop()).unwrap_or_else(|_| "null".to_string())
    }

    /// Number of events currently in the buffer.
    pub fn event_count(&self) -> usize {
        self.inner.events.len()
    }

    /// Current packet counts as a JSON string.
    pub fn counts(&self) -> String {
        serde_json::to_string(&self.inner.counts).unwrap_or_else(|_| "{}".to_string())
    }
}

/// Current time in milliseconds (from JS Date.now via wasm-bindgen).
fn now_ms() -> u64 {
    js_sys::Date::now() as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_capture_network_creation() {
        let capture = CaptureNetworkCore::new(Some(256));
        assert_eq!(capture.event_count(), 0);
    }

    #[test]
    fn test_limit_clamping() {
        // Limit below minimum should be clamped to MIN_LIMIT
        let capture = CaptureNetworkCore::new(Some(10));
        let _ = capture;
        // Limit above maximum should be clamped to MAX_LIMIT
        let capture = CaptureNetworkCore::new(Some(99999));
        let _ = capture;
    }

    #[test]
    fn test_record_and_dump() {
        let mut capture = CaptureNetworkCore::new(Some(1024));
        capture.count_packet("login");
        capture.count_packet("login");
        capture.count_packet("map_chunk");

        let dump = capture.dump();
        let value: Value = serde_json::from_str(&dump).unwrap();
        assert_eq!(value["counts"]["login"], 2);
        assert_eq!(value["counts"]["map_chunk"], 1);
        assert!(value["events"].as_array().unwrap().is_empty());
    }

    #[test]
    fn test_event_buffer_limit() {
        let mut capture = CaptureNetworkCore::new(Some(3));
        capture.record(&serde_json::to_string(&NetworkEvent {
            ms: 0,
            r#type: Some("login".to_string()),
            id: None,
            packet_name: None,
            bytes: None,
            packet: None,
            message: None,
            after: None,
        }).unwrap());
        capture.record(&serde_json::to_string(&NetworkEvent {
            ms: 1,
            r#type: Some("map_chunk".to_string()),
            id: None,
            packet_name: None,
            bytes: None,
            packet: None,
            message: None,
            after: None,
        }).unwrap());
        capture.record(&serde_json::to_string(&NetworkEvent {
            ms: 2,
            r#type: Some("position".to_string()),
            id: None,
            packet_name: None,
            bytes: None,
            packet: None,
            message: None,
            after: None,
        }).unwrap());
        // Buffer is at limit (3). Adding a 4th should drop the oldest.
        capture.record(&serde_json::to_string(&NetworkEvent {
            ms: 3,
            r#type: Some("camera".to_string()),
            id: None,
            packet_name: None,
            bytes: None,
            packet: None,
            message: None,
            after: None,
        }).unwrap());
        assert_eq!(capture.event_count(), 3);
        let dump = capture.dump();
        let value: Value = serde_json::from_str(&dump).unwrap();
        let events = value["events"].as_array().unwrap();
        assert_eq!(events.len(), 3);
        // First event (ms=0, login) should have been dropped.
        assert_eq!(events[0]["ms"], 1);
    }

    #[test]
    fn test_stop_disables_capture() {
        let mut capture = CaptureNetworkCore::new(Some(1024));
        let dump = capture.stop();
        assert!(!dump.is_empty());
        let value: Value = serde_json::from_str(&dump).unwrap();
        assert!(value["events"].as_array().unwrap().is_empty());
    }
}
