// Extracted native 1.15.2 tags.
//! Port of `client/js/game/default-tags.js`.
//!
//! Contains `DEFAULT_TAGS` - a mapping of block/item names to arrays of tag source IDs.
//!
//! The JavaScript source is a single-line JSON object; the Rust module provides
//! static access to these tag lookups without needing to parse JSON at runtime.

/// The full 1.15.2 native jar tag definitions.
/// Structure: `{"blocks": {name: [ids]}, ...}` as extracted from the client jar.
pub const DEFAULT_TAGS: phf::Map<&'static str, phf::Map<&'static str, Vec<i32>>> = {
    include_str!("default_tags_data.json")
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_tags_not_empty() {
        assert!(!DEFAULT_TAGS.is_empty());
    }

    #[test]
    fn acacia_logs_have_entries() {
        let tags = DEFAULT_TAGS.get("acacia_logs").expect("acacia_logs should exist");
        assert!(!tags.is_empty());
    }
}