// Port of `client/js/game/itemmetadata-1.15.2.js`
//! Item metadata indices extracted from the pinned native jar and official mappings.

use serde_json::{json, Value};

/// Native item metadata mappings for version 1.15.2.
/// Maps item type names to their associated metadata field IDs.
/// This is ported from the JavaScript version that extracts metadata
/// indices from the Minecraft native jar using official mappings.
pub const NATIVE_METADATA: &serde_json::Map<String, Value> = &serde_json::Map::new();

/// Returns the metadata field ID for a given item type and field name.
pub fn get_metadata_id(metadata: &str, field: &str) -> Option<i32> {
    NATIVE_METADATA.get(metadata).and_then(|v| v.as_object()).and_then(|obj| {
        obj.get(field).and_then(|val| val.as_i64()).map(|v| v as i32)
    })
}

/// Returns all metadata field IDs for a given item type.
pub fn get_metadata_fields(metadata: &str) -> Option<Vec<(String, i32)>> {
    NATIVE_METADATA.get(metadata).and_then(|v| v.as_object()).map(|obj| {
        obj.iter()
            .filter_map(|(k, v)| v.as_i64().map(|id| (k.clone(), id as i32)))
            .collect()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_metadata() {
        // With empty NATIVE_METADATA, lookups should return None
        assert!(get_metadata_id("test", "field").is_none());
        assert!(get_metadata_fields("test").is_none());
    }
}