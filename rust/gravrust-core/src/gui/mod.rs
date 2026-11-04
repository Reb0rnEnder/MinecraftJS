//! `crate::gui` — compatibility tree matching the `client/js/gui/` layout.
//!
//! The ported modules reference `crate::gui::<name>` because the JavaScript they
//! came from lives under `client/js/gui/`. In Rust the drawing surface is the
//! [`crate::widgets::Gui`] trait, and the algorithmic pieces are the flat
//! top-level modules. This tree re-exports both so the ported call sites
//! resolve, without duplicating any logic.
//!
//! Deliberately NOT provided here: a second `Gui` struct. The crate already has
//! `crate::widgets::Gui` as the drawing contract; inventing a competing type
//! would fork the architecture.

pub mod font;

// The drawing contract, re-exported under the JS path.
pub use crate::widgets::Gui;

/// The GUI screenshot/screen manager. The JS `client/js/gui/screens/manager.js`
/// is ported as the flat `src/screens.rs`.
pub mod screens {
    pub use crate::screens::*;
}
