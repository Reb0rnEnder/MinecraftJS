//! Port of `client/js/net/proxies.js`.
//!
//! Re-exports the full proxy implementation from `proxies_js`.

pub use crate::proxies_js::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_proxy_types_available() {
        assert!(PROXY_TYPES.contains(&"gravrust-via"));
        assert!(PROXY_TYPES.contains(&"mcjs"));
        assert!(PROXY_TYPES.contains(&"relay"));
        assert!(PROXY_TYPES.contains(&"wisp"));
    }
}
