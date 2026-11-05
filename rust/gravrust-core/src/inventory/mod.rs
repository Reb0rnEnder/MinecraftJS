//! `crate::inventory` â€” compatibility tree matching `client/js/game/containers.js`.
//!
//! The container model (slot click handling, stack merging, transfer logic, NBT
//! comparison) is ported in `src/containers.rs` and `src/container_full.rs`.
//! This tree re-exports it under the JS path.

// `containers` is still behind the `unsupported` gate, so the re-export is
// gated identically and begins working when that module is enabled.
#[cfg(feature = "unsupported")]
pub use crate::unsupported_port::containers::*;

/// JS: a container slot holding an item stack.
///
/// This mirrors the JS container slot shape. The wire-level `Slot` used by the
/// protocol lives in `crate::protocol` and is re-exported here as
/// [`protocol_slot`] so the two are not confused.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Slot {
    /// JS: `slot.item` â€” the namespaced item id, empty when the slot is empty.
    pub item: String,
    /// JS: `slot.count` â€” stack size, 0 when the slot is empty.
    pub count: i32,
    /// JS: `slot.damage` â€” item damage/metadata.
    pub damage: i32,
    /// JS: `slot.nbt` â€” the serialised NBT tag, when present.
    pub nbt: Option<String>,
}

/// The protocol-level slot, re-exported to avoid a name clash with [`Slot`].
pub use crate::protocol::Slot as protocol_slot;

