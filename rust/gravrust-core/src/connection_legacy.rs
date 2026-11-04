//! Port of `client/js/net/connection.js`: socket link to the game server.
//!
//! Vanilla servers go through the selected proxy: a Gravrust proxy
//! (platform().openSocket, the proxy logs in), or a Java relay / Wisp server
//! carrying raw TCP (tcp.js, the client logs in); Eaglercraft servers
//! (ws:// / wss:// addresses) are reached directly over their own WebSocket
//! (eagler.js). All sockets look the same: binary frames carry raw play packets
//! (varint id + body), text frames JSON control messages.

use wasm_bindgen::prelude::*;

use crate::packets::{decodePacket, PROTOCOL_VERSION};
use crate::net::address::parseAddress;

// Events emitted by the Connection.
#[wasm_bindgen]
pub enum ConnectionEvent {
    Close,
    Control(js_sys::Object),
    Packet(js_sys::Object),
}

/// A socket to the selected proxy (Gravrust proxy, or a relay / Wisp link handled in the client).
#[wasm_bindgen]
pub struct Connection {
    /// Raw WebSocket connection (or TCP proxy)
    ws: Option<js_sys::WebSocket>,
    /// Registered event handlers: event name -> array of callbacks
    handlers: js_sys::Map,
    /// Current connection state
    state: String,
    /// Bytes received
    bytes_in: u64,
    /// Packets received
    packets_in: u64,
}

#[wasm_bindgen]
impl Connection {
    /// Create a new Connection.
    pub fn new() -> Connection {
        Connection {
            ws: None,
            handlers: js_sys::Map::new(),
            state: "idle".to_string(),
            bytes_in: 0,
            packets_in: 0,
        }
    }

    /// Register an event handler for the given event name.
    pub fn on(&mut self, ev: &str, fn_: js_sys::Function) {
        let handlers = self.handlers.clone();
        let existing: js_sys::Array = handlers.get(&js_sys::Value::from(ev)).unwrap_or_else(|| js_sys::Array::new());
        existing.push(&fn_);
        handlers.set(&js_sys::Value::from(ev), &existing);
    }

    /// Emit an event to all registered handlers.
    pub fn emit(&self, ev: &str, ...a: js_sys::Val) {
        if let Some(array) = self.handlers.get(&js_sys::Value::from(ev)).and_then(|v| v.dyn_into::<js_sys::Array>().ok()) {
            for i in 0..array.length() {
                if let Some(fn) = array.get(i).dyn_into::<js_sys::Function>().ok() {
                    let _ = fn.call1(&JsValue::NULL, &a);
                }
            }
        }
    }

    /// Open a socket connection (to be implemented by host).
    pub async fn open(&mut self) {
        // TODO: Implement socket opening - this is host-dependent
        // In a browser environment, this would create a WebSocket
        // In a native environment, this would use TCP
    }

    /// Connect to a host.
    pub async fn connect(&mut self, host: &str, port: u16, username: &str, auth: Option<js_sys::Object>) {
        let a = parseAddress(host);
        let eagler = a.map_or(false, |addr| addr.kind == "eagler");
        // TODO: Implement connection logic
        self.state = "login".to_string();
        if let Some(protocol) = PROTOCOL_VERSION {
            // TODO: Send connect packet
        }
    }

    /// Ping a host.
    pub async fn ping(&mut self, host: &str, port: u16) {
        let a = parseAddress(host);
        // TODO: Implement ping logic
    }

    /// Send bytes over the socket.
    pub fn send(&self, bytes: &[u8]) {
        // TODO: Implement send - depends on socket type
    }

    /// Close the socket.
    pub fn close(&mut self) {
        self.ws = None;
        self.state = "closed".to_string();
    }
}