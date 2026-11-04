//! Port of `client/js/net/` - networking modules.
//!
//! This module contains the networking stack for connecting to Minecraft servers,
//! including the Connection class, address parsing, and socket handling.

pub mod connection;

pub use connection::Connection;