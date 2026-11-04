//! `crate::assets` â€” compatibility tree matching `client/js/assets/`.
//!
//! The asset pipeline is browser-bound in the JavaScript client (`fetch`,
//! `ImageBitmap`, `DecompressionStream`). What is portable â€” pack selection and
//! the texture/metadata containers â€” already exists in this crate as the flat
//! modules `packs`, `atlas` and `eagler_textures`. This tree re-exports those
//! under the JS paths so the ported call sites resolve.

// `atlas` and `packs` are still behind the `unsupported` gate (they do not
// compile yet), so their re-exports are gated identically. When those modules
// move into the default build, these lines start working with no further edit.
#[cfg(feature = "unsupported")]
pub use crate::atlas::{TextureEntry, TextureImage, TextureMeta};

/// `client/js/assets/packs.js` â€” resource pack handling.
#[cfg(feature = "unsupported")]
pub mod packs {
    pub use crate::packs::*;
}

/// Texture lookup, as the JS `assets.texture(name, opts)` surface.
pub mod texture {
    /// Options accepted by the JS `assets.texture(name, { wrap })` call.
    ///
    /// The JavaScript passes an object literal; Rust call sites pass this
    /// struct instead.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
    pub struct TextureOptions {
        /// JS: `wrap: 'repeat' | 'clamp'`.
        pub wrap: TextureWrap,
    }

    /// JS: the `wrap` string.
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
    pub enum TextureWrap {
        /// JS: `'clamp'` (the default when `wrap` is absent).
        #[default]
        Clamp,
        /// JS: `'repeat'`.
        Repeat,
    }

    impl TextureOptions {
        /// JS: `{ wrap: 'repeat' }`.
        pub const REPEAT: TextureOptions =
            TextureOptions { wrap: TextureWrap::Repeat };
        /// JS: `{}` / absent options.
        pub const DEFAULT: TextureOptions =
            TextureOptions { wrap: TextureWrap::Clamp };
    }
}

/// The vanilla UI layout constants, from `client/js/assets/vanilla-layout.js`
/// (imported in JS as `VANILLA_UI`). The widget colours already live in
/// `crate::widgets`; they are surfaced here under the JS name.
pub mod vanilla_layout {
    pub use crate::widgets::{BUTTON_TEXT_HOVER, BUTTON_TEXT_NORMAL};

    /// JS: `VANILLA_UI` â€” the subset of the layout table the ported call sites
    /// read. Extend as more of the table is ported.
    #[derive(Debug, Clone, Copy)]
    pub struct VanillaUi {
        /// JS: `VANILLA_UI.buttonText.normal`.
        pub button_text_normal: u32,
        /// JS: `VANILLA_UI.buttonText.hover`.
        pub button_text_hover: u32,
    }

    /// JS: `VANILLA_UI`.
    pub const VANILLA_UI: VanillaUi = VanillaUi {
        button_text_normal: BUTTON_TEXT_NORMAL,
        button_text_hover: BUTTON_TEXT_HOVER,
    };
}

/// `VANILLA_UI` re-exported at the tree root, matching the JS import name.
pub use vanilla_layout::VANILLA_UI;

/// JS: a resource pack entry as returned by `assets.listPacks()`
/// (client/js/gui/screens/packs.js reads `p.id` and `pack.name`).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Pack {
    /// JS: `pack.id` — unique pack identifier used in `settings.resourcePacks`.
    pub id: String,
    /// JS: `pack.name` — display name shown in the packs screen.
    pub name: String,
}

/// JS: the `game.assets` object surface the screens consume
/// (`client/js/gui/screens/packs.js`: `A.listPacks()`).
///
/// The full asset pipeline is browser-bound (fetch, unzip, image decode) and
/// stays platform-side; this trait carries the pack-list contract the ported
/// screens call.
pub trait AssetManager {
    /// JS: `await A.listPacks()` — every discovered pack, selected or not.
    fn list_packs(&self) -> Vec<Pack>;
}

/// JS: a server resource pack (client/js/game/serverpacks.js flow: the server
/// sends a URL + hash; the client downloads, caches under server-packs/<sha1>
/// and applies it on top of the user's packs).
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ResourcePack {
    /// JS: the pack URL the server sent.
    pub url: String,
    /// JS: the required SHA-1 hash, when the server supplied one.
    pub hash: Option<String>,
}
