//! Port of `client/js/net/` - networking modules.
//!
//! This module contains the networking stack for connecting to Minecraft servers,
//! including the Connection class, address parsing, and socket handling.

pub mod connection;

/// `client/js/net/packets.js` -> the flat `src/packets.rs`.
pub mod packets {
    pub use crate::packets::*;
}

/// `client/js/net/address.js` -> the flat `src/address.rs`.
pub mod address {
    pub use crate::address::*;
}

pub use connection::Connection;

