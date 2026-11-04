//! `crate::network` — compatibility tree matching `client/js/net/`.
//!
//! The protocol primitives, packet encoders and connection state already exist
//! as flat modules (`buffer`, `packets`, `protocol*`, plus the `net/` directory).
//! This tree re-exports them under the JS path and provides the transport
//! contract the JavaScript gets from the browser `WebSocket`/Wisp socket.

pub use crate::buffer;
pub use crate::packets;

/// `client/js/net/` — the connection layer.
pub mod net {
    pub use crate::net::*;
}

/// JS: the socket abstraction the JS `BrowserPlatform.openSocket` returns.
///
/// The JavaScript holds a live `WebSocket` (or a Wisp relay socket). That object
/// stays platform-side; Rust keeps the observable state and message traffic
/// contract so the ported protocol code can drive it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SocketState {
    /// JS: `WebSocket.CONNECTING`.
    Connecting,
    /// JS: `WebSocket.OPEN`.
    Open,
    /// JS: `WebSocket.CLOSING`.
    Closing,
    /// JS: `WebSocket.CLOSED`.
    Closed,
}

/// The transport contract, mirroring the subset of the browser socket API the
/// ported protocol code uses.
pub trait Socket {
    /// JS: `socket.send(data)`.
    fn send(&mut self, data: &[u8]);

    /// JS: `socket.close(code, reason)`.
    fn close(&mut self, code: u16, reason: &str);

    /// JS: `socket.readyState`.
    fn state(&self) -> SocketState;
}
