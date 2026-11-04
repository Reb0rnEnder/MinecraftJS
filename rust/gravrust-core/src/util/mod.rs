//! `crate::util` — compatibility tree matching the `client/js/util/` layout.
//!
//! The ported modules reference `crate::util::<name>`, mirroring the JavaScript
//! directory structure. The implementations already exist as flat top-level
//! modules in this crate, so this tree re-exports them rather than duplicating
//! any logic. Each item below names the file that actually holds the code.

pub mod jrandom {
    //! `client/js/util/jrandom.js` -> `src/jrandom.rs`
    pub use crate::jrandom::*;
}

pub mod mccrypto {
    //! `client/js/util/mccrypto.js` -> `src/mccrypto.rs`
    pub use crate::mccrypto::*;
}

pub mod png {
    //! `client/js/util/png.js` -> `src/png.rs`
    pub use crate::png::*;
}

pub mod uuid {
    //! `client/js/util/uuid-md5.js` -> `src/uuid.rs`
    pub use crate::uuid::*;
}

pub mod base64 {
    //! `client/js/util/base64.js` -> `src/base64.rs`
    pub use crate::base64::*;
}

pub mod base85 {
    //! `client/js/util/base85.js` -> `src/base85.rs`
    pub use crate::base85::*;
}

pub mod utf8 {
    //! `client/js/util/utf8.js` -> `src/utf8.rs`
    pub use crate::utf8::*;
}

pub mod regex {
    //! `client/js/util/regex.js` — resource-name pattern helpers.
    //!
    //! The JavaScript module exposes a `resource(pattern)` helper that wraps a
    //! pattern for matching namespaced resource identifiers such as
    //! `minecraft:stone` or `block/stone`. It is ported here directly; no such
    //! helper existed in the crate before.

    use std::sync::LazyLock;

    /// JS: `export function resource(pattern){ return new RegExp('^(?:[a-z0-9_.-]+:)?' + pattern + '$'); }`
    ///
    /// Builds an anchored regex that optionally allows a `namespace:` prefix.
    /// Returns `None` when the supplied pattern is not a valid regex, so callers
    /// can fall back instead of panicking on bad asset data.
    pub fn resource(pattern: &str) -> Option<regex::Regex> {
        regex::Regex::new(&format!(r"^(?:[a-z0-9_.-]+:)?{}$", pattern)).ok()
    }

    /// A cached, always-valid variant for callers with a literal pattern.
    pub fn resource_cached(pattern: &'static str) -> &'static regex::Regex {
        static CACHE: LazyLock<std::sync::Mutex<std::collections::HashMap<&'static str, &'static regex::Regex>>> =
            LazyLock::new(|| std::sync::Mutex::new(std::collections::HashMap::new()));
        let mut cache = CACHE.lock().unwrap();
        cache.entry(pattern).or_insert_with(|| {
            Box::leak(Box::new(
                resource(pattern).expect("resource() pattern must be a valid regex"),
            ))
        })
    }
}
