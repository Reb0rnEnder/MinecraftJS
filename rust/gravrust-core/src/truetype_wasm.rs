//! Port of `client/js/lib/truetype-wasm.js`.
//!
//! Embedded stb_truetype WebAssembly module for TTF font rasterization.

pub const TRUETYPE_WASM_BASE64: &str = include_str!("../data/truetype.wasm.base64");

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_truetype_wasm_base64_not_empty() {
        assert!(!TRUETYPE_WASM_BASE64.is_empty());
        assert!(TRUETYPE_WASM_BASE64.starts_with("AGFzb"));
    }
}
