//! Port of `client/js/game/tags.js`: registry tag system.
//!
//! The tag system maps tag names (e.g. "minecraft:logs") to sets of registry
//! entry IDs (blocks, items, fluids, entities), and provides the inverse
//! mapping from an entry ID to all tags containing it.

use std::collections::{HashMap, HashSet};
use serde_json::Value;
use wasm_bindgen::prelude::*;

/// The four registry kinds supported by the tag system.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum RegistryKind {
    Blocks,
    Items,
    Fluids,
    Entities,
}

impl RegistryKind {
    fn as_str(&self) -> &'static str {
        match self {
            RegistryKind::Blocks => "blocks",
            RegistryKind::Items => "items",
            RegistryKind::Fluids => "fluids",
            RegistryKind::Entities => "entities",
        }
    }

    fn from_str(s: &str) -> Option<Self> {
        match s {
            "blocks" => Some(RegistryKind::Blocks),
            "items" => Some(RegistryKind::Items),
            "fluids" => Some(RegistryKind::Fluids),
            "entities" => Some(RegistryKind::Entities),
            _ => None,
        }
    }
}

/// Internal storage for one registry kind.
#[derive(Clone, Debug, Default)]
struct KindData {
    /// tag name -> sorted list of entry IDs
    registries: HashMap<String, Vec<u32>>,
    /// entry ID -> sorted list of tag names
    by_entry: HashMap<u32, Vec<String>>,
}

impl KindData {
    fn new() -> Self {
        Self::default()
    }

    fn build(&mut self, tags: &HashMap<String, Vec<u32>>) {
        self.registries = tags.clone();
        self.by_entry.clear();

        for (tag_name, ids) in &self.registries {
            for &id in ids {
                self.by_entry.entry(id).or_default().push(tag_name.clone());
            }
        }

        // Sort tag names for each entry for consistent ordering
        for names in self.by_entry.values_mut() {
            names.sort();
        }
    }

    fn names(&self) -> Vec<String> {
        let mut out: Vec<String> = self.registries.keys().cloned().collect();
        out.sort();
        out
    }

    fn for_entry(&self, id: u32) -> Vec<String> {
        self.by_entry.get(&id).cloned().unwrap_or_default()
    }

    fn contains(&self, tag_name: &str, id: u32) -> bool {
        self.registries
            .get(tag_name)
            .map(|ids| ids.binary_search(&id).is_ok())
            .unwrap_or(false)
    }
}

/// The main tag registry, holding data for all four registry kinds.
#[derive(Clone, Debug, Default)]
pub struct RegistryTags {
    kinds: HashMap<RegistryKind, KindData>,
}

impl RegistryTags {
    /// Create a new empty RegistryTags.
    pub fn new() -> Self {
        let mut kinds = HashMap::new();
        kinds.insert(RegistryKind::Blocks, KindData::new());
        kinds.insert(RegistryKind::Items, KindData::new());
        kinds.insert(RegistryKind::Fluids, KindData::new());
        kinds.insert(RegistryKind::Entities, KindData::new());
        Self { kinds }
    }

    /// Replace all tag data from a parsed JSON value matching the DEFAULT_TAGS format.
    /// The expected structure is:
    /// ```json
    /// {
    ///   "blocks": { "tag:name": [id1, id2, ...], ... },
    ///   "items": { ... },
    ///   "fluids": { ... },
    ///   "entities": { ... }
    /// }
    /// ```
    pub fn replace(&mut self, tags_json: &Value) -> Result<(), String> {
        for kind in [
            RegistryKind::Blocks,
            RegistryKind::Items,
            RegistryKind::Fluids,
            RegistryKind::Entities,
        ] {
            let kind_str = kind.as_str();
            let kind_data = self.kinds.get_mut(&kind).unwrap();

            let tags_map = tags_json
                .get(kind_str)
                .and_then(|v| v.as_object())
                .ok_or_else(|| format!("Missing or invalid '{kind_str}' in tags JSON"))?;

            let mut parsed: HashMap<String, Vec<u32>> = HashMap::new();
            for (tag_name, ids_value) in tags_map {
                let ids = ids_value
                    .as_array()
                    .ok_or_else(|| format!("Tag '{tag_name}' in '{kind_str}' is not an array"))?
                    .iter()
                    .map(|v| {
                        v.as_u64()
                            .ok_or_else(|| format!("Non-integer ID in tag '{tag_name}'"))
                            .map(|n| n as u32)
                    })
                    .collect::<Result<Vec<u32>, _>>()?;
                // Sort IDs for binary search in contains()
                let mut ids = ids;
                ids.sort_unstable();
                parsed.insert(tag_name.clone(), ids);
            }

            kind_data.build(&parsed);
        }
        Ok(())
    }

    /// Get all tag names for a registry kind, sorted.
    pub fn names(&self, kind: RegistryKind) -> Vec<String> {
        self.kinds
            .get(&kind)
            .map(|k| k.names())
            .unwrap_or_default()
    }

    /// Get all tag names for a registry kind (by string), sorted.
    pub fn names_str(&self, kind: &str) -> Vec<String> {
        RegistryKind::from_str(kind)
            .map(|k| self.names(k))
            .unwrap_or_default()
    }

    /// Get all tags containing the given entry ID for a registry kind.
    pub fn for_entry(&self, kind: RegistryKind, id: u32) -> Vec<String> {
        self.kinds
            .get(&kind)
            .map(|k| k.for_entry(id))
            .unwrap_or_default()
    }

    /// Get all tags containing the given entry ID for a registry kind (by string).
    pub fn for_entry_str(&self, kind: &str, id: u32) -> Vec<String> {
        RegistryKind::from_str(kind)
            .map(|k| self.for_entry(k, id))
            .unwrap_or_default()
    }

    /// Check if an entry ID is in a tag for a registry kind.
    pub fn contains(&self, kind: RegistryKind, tag_name: &str, id: u32) -> bool {
        self.kinds
            .get(&kind)
            .map(|k| k.contains(tag_name, id))
            .unwrap_or(false)
    }

    /// Check if an entry ID is in a tag for a registry kind (by string).
    pub fn contains_str(&self, kind: &str, tag_name: &str, id: u32) -> bool {
        RegistryKind::from_str(kind)
            .map(|k| self.contains(k, tag_name, id))
            .unwrap_or(false)
    }
}

// --------------------------------------------------------------------- wasm_bindgen exports

#[wasm_bindgen]
pub struct RegistryTagsCore {
    inner: RegistryTags,
}

#[wasm_bindgen]
impl RegistryTagsCore {
    #[wasm_bindgen(constructor)]
    pub fn new(tags_json: &str) -> Result<RegistryTagsCore, JsValue> {
        let value: Value = serde_json::from_str(tags_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let mut inner = RegistryTags::new();
        inner.replace(&value).map_err(|e| JsValue::from_str(&e))?;
        Ok(RegistryTagsCore { inner })
    }

    /// Create an empty RegistryTagsCore (no tags loaded).
    #[wasm_bindgen(js_name = newEmpty)]
    pub fn new_empty() -> RegistryTagsCore {
        RegistryTagsCore { inner: RegistryTags::new() }
    }

    /// Replace all tag data from a JSON string.
    pub fn replace(&mut self, tags_json: &str) -> Result<(), JsValue> {
        let value: Value = serde_json::from_str(tags_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner.replace(&value).map_err(|e| JsValue::from_str(&e))
    }

    /// Get all tag names for a registry kind ("blocks", "items", "fluids", "entities").
    pub fn names(&self, kind: &str) -> Vec<String> {
        self.inner.names_str(kind)
    }

    /// Get all tags containing the given entry ID for a registry kind.
    pub fn for_entry(&self, kind: &str, id: u32) -> Vec<String> {
        self.inner.for_entry_str(kind, id)
    }

    /// Check if an entry ID is in a tag for a registry kind.
    pub fn contains(&self, kind: &str, tag_name: &str, id: u32) -> bool {
        self.inner.contains_str(kind, tag_name, id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn test_tags_json() -> Value {
        json!({
            "blocks": {
                "minecraft:logs": [1, 2, 3, 4],
                "minecraft:stones": [1, 5, 6],
                "minecraft:dirt": [7, 8]
            },
            "items": {
                "minecraft:swords": [10, 11, 12],
                "minecraft:tools": [10, 13, 14]
            },
            "fluids": {
                "minecraft:water": [100],
                "minecraft:lava": [101]
            },
            "entities": {
                "minecraft:animals": [1000, 1001],
                "minecraft:monsters": [1002, 1003]
            }
        })
    }

    #[test]
    fn builds_registry_from_json() {
        let tags = RegistryTags::new();
        let mut tags = tags;
        tags.replace(&test_tags_json()).unwrap();

        // Check blocks
        assert_eq!(tags.names(RegistryKind::Blocks).len(), 3);
        assert!(tags.names(RegistryKind::Blocks).contains(&"minecraft:logs".to_string()));

        // Check items
        assert_eq!(tags.names(RegistryKind::Items).len(), 2);

        // Check fluids
        assert_eq!(tags.names(RegistryKind::Fluids).len(), 2);

        // Check entities
        assert_eq!(tags.names(RegistryKind::Entities).len(), 2);
    }

    #[test]
    fn names_are_sorted() {
        let mut tags = RegistryTags::new();
        tags.replace(&test_tags_json()).unwrap();

        let blocks = tags.names(RegistryKind::Blocks);
        let mut sorted = blocks.clone();
        sorted.sort();
        assert_eq!(blocks, sorted);
    }

    #[test]
    fn for_entry_returns_tags_for_id() {
        let mut tags = RegistryTags::new();
        tags.replace(&test_tags_json()).unwrap();

        // ID 1 is in "minecraft:logs" and "minecraft:stones"
        let entry_tags = tags.for_entry(RegistryKind::Blocks, 1);
        assert_eq!(entry_tags.len(), 2);
        assert!(entry_tags.contains(&"minecraft:logs".to_string()));
        assert!(entry_tags.contains(&"minecraft:stones".to_string()));

        // ID 7 is only in "minecraft:dirt"
        let dirt_tags = tags.for_entry(RegistryKind::Blocks, 7);
        assert_eq!(dirt_tags, vec!["minecraft:dirt"]);

        // Non-existent ID returns empty
        assert!(tags.for_entry(RegistryKind::Blocks, 999).is_empty());
    }

    #[test]
    fn for_entry_tags_are_sorted() {
        let mut tags = RegistryTags::new();
        tags.replace(&test_tags_json()).unwrap();

        // ID 10 is in "minecraft:swords" and "minecraft:tools"
        let entry_tags = tags.for_entry(RegistryKind::Items, 10);
        assert_eq!(entry_tags, vec!["minecraft:swords", "minecraft:tools"]);
    }

    #[test]
    fn contains_works() {
        let mut tags = RegistryTags::new();
        tags.replace(&test_tags_json()).unwrap();

        assert!(tags.contains(RegistryKind::Blocks, "minecraft:logs", 1));
        assert!(tags.contains(RegistryKind::Blocks, "minecraft:logs", 4));
        assert!(!tags.contains(RegistryKind::Blocks, "minecraft:logs", 5));
        assert!(!tags.contains(RegistryKind::Blocks, "minecraft:logs", 999));
        assert!(!tags.contains(RegistryKind::Blocks, "nonexistent", 1));
    }

    #[test]
    fn string_api_works() {
        let mut tags = RegistryTags::new();
        tags.replace(&test_tags_json()).unwrap();

        assert_eq!(tags.names_str("blocks").len(), 3);
        assert_eq!(tags.names_str("invalid"), Vec::<String>::new());

        let entry_tags = tags.for_entry_str("blocks", 1);
        assert_eq!(entry_tags.len(), 2);

        assert!(tags.contains_str("blocks", "minecraft:logs", 1));
        assert!(!tags.contains_str("blocks", "minecraft:logs", 5));
        assert!(!tags.contains_str("invalid", "tag", 1));
    }

    #[test]
    fn wasm_core_constructor_works() {
        let json = test_tags_json().to_string();
        let core = RegistryTagsCore::new(&json).unwrap();
        assert_eq!(core.names("blocks").len(), 3);
        assert!(core.contains("blocks", "minecraft:logs", 1));
    }

    #[test]
    fn wasm_core_new_empty_works() {
        let core = RegistryTagsCore::new_empty();
        assert!(core.names("blocks").is_empty());
        assert!(core.for_entry("blocks", 1).is_empty());
        assert!(!core.contains("blocks", "tag", 1));
    }

    #[test]
    fn wasm_core_replace_works() {
        let mut core = RegistryTagsCore::new_empty();
        core.replace(&test_tags_json().to_string()).unwrap();
        assert_eq!(core.names("blocks").len(), 3);
        assert!(core.contains("blocks", "minecraft:logs", 1));
    }
}