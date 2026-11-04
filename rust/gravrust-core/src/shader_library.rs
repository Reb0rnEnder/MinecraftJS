//! Port of `client/js/render/shader-library.js`: shader pack library
//! management (metadata, selection, persistence).

use std::collections::HashMap;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

/// Storage key for shader library metadata (for reference; JS side uses these keys)
#[allow(dead_code)]
const INDEX_KEY: &str = "shaderpacks/library";
/// Legacy storage key for final-stage shader pack (for reference; JS side uses these keys)
#[allow(dead_code)]
const LEGACY_KEY: &str = "shaderpacks/final-stage";

static ID_COUNTER: Lazy<std::sync::Mutex<u64>> = Lazy::new(|| std::sync::Mutex::new(0));

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShaderLibraryEntry {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub options: HashMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ShaderLibraryMetadata {
    #[serde(default)]
    pub entries: Vec<ShaderLibraryEntry>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub selected: Option<String>,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_enabled() -> bool {
    true
}

impl Default for ShaderLibraryMetadata {
    fn default() -> Self {
        Self {
            entries: Vec::new(),
            selected: None,
            enabled: true,
        }
    }
}

/// Generates a new shader pack ID matching the JS format:
/// `shaderpacks/pack/<base36-timestamp>-<base36-random>`
pub fn new_id() -> String {
    let mut counter = ID_COUNTER.lock().unwrap();
    *counter += 1;
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    format!(
        "shaderpacks/pack/{}-{}-{}",
        to_base36(timestamp),
        to_base36(*counter),
        to_base36(fastrand::u64(..))
    )
}

fn to_base36(mut value: u64) -> String {
    if value == 0 {
        return "0".to_string();
    }
    const CHARS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut result = Vec::new();
    while value > 0 {
        result.push(CHARS[(value % 36) as usize] as char);
        value /= 36;
    }
    result.reverse();
    result.into_iter().collect()
}

/// Validates and normalizes loaded metadata from storage.
pub fn normalize_metadata(value: Value) -> ShaderLibraryMetadata {
    let mut metadata = ShaderLibraryMetadata::default();

    if let Some(entries) = value.get("entries").and_then(|v| v.as_array()) {
        metadata.entries = entries
            .iter()
            .filter_map(|e| {
                let id = e.get("id")?.as_str()?;
                let name = e.get("name")?.as_str()?;
                if !id.starts_with("shaderpacks/pack/") {
                    return None;
                }
                let options = e
                    .get("options")
                    .and_then(|o| o.as_object())
                    .map(|o| o.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                    .unwrap_or_default();
                Some(ShaderLibraryEntry {
                    id: id.to_string(),
                    name: name.to_string(),
                    options,
                })
            })
            .collect();
    }

    metadata.selected = value
        .get("selected")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    metadata.enabled = value.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);

    metadata
}

/// Serializes metadata for storage.
pub fn serialize_metadata(metadata: &ShaderLibraryMetadata) -> String {
    json!(metadata).to_string()
}

/// Finds an entry by ID.
pub fn find_entry<'a>(entries: &'a [ShaderLibraryEntry], id: &str) -> Option<&'a ShaderLibraryEntry> {
    entries.iter().find(|e| e.id == id)
}

/// Result of a select operation.
#[derive(Debug, Serialize, Deserialize)]
pub struct SelectResult {
    /// Whether the selection was successful
    pub success: bool,
    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// The selected entry (if successful and not internal/clear)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry: Option<ShaderLibraryEntry>,
    /// Whether the pack should be enabled
    pub enabled: bool,
    /// Updated revision number
    pub revision: u32,
    /// Updated metadata for persistence
    pub metadata: ShaderLibraryMetadata,
}

/// Result of a remove operation.
#[derive(Debug, Serialize, Deserialize)]
pub struct RemoveResult {
    /// Whether the removal was successful
    pub success: bool,
    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// Updated revision number
    pub revision: u32,
    /// Updated metadata for persistence
    pub metadata: ShaderLibraryMetadata,
    /// ID of the deleted file (for platform.files.delete)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deleted_file_id: Option<String>,
}

/// Result of an add operation.
#[derive(Debug, Serialize, Deserialize)]
pub struct AddResult {
    /// Whether the addition was successful
    pub success: bool,
    /// Error message if failed
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    /// The new entry that was added
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry: Option<ShaderLibraryEntry>,
    /// Updated revision number
    pub revision: u32,
    /// Updated metadata for persistence
    pub metadata: ShaderLibraryMetadata,
    /// ID for the file to store (for platform.files.put)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_id: Option<String>,
    /// Bytes to store (passed through from input)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes: Option<Vec<u8>>,
}

/// Processes a legacy shader pack migration.
#[derive(Debug, Serialize, Deserialize)]
pub struct LegacyMigrationResult {
    /// Whether a legacy pack was found and migrated
    pub migrated: bool,
    /// The new entry created from legacy pack
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry: Option<ShaderLibraryEntry>,
    /// Updated metadata for persistence
    pub metadata: ShaderLibraryMetadata,
    /// File ID for the new entry (for platform.files.put)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_id: Option<String>,
    /// Legacy file bytes (for platform.files.put)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes: Option<Vec<u8>>,
    /// Legacy metadata name
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_name: Option<String>,
    /// Legacy metadata options
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_options: Option<HashMap<String, Value>>,
    /// Legacy metadata enabled state
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legacy_enabled: Option<bool>,
}

/// Selects a shader pack by ID.
/// Returns the updated metadata and any file operations needed.
pub fn select_shader_pack(
    metadata: &mut ShaderLibraryMetadata,
    revision: &mut u32,
    id: Option<&str>,
    enabled: bool,
) -> SelectResult {
    *revision += 1;
    let current_revision = *revision;

    match id {
        None => {
            // Clear selection
            metadata.selected = None;
            metadata.enabled = false;
            SelectResult {
                success: true,
                error: None,
                entry: None,
                enabled: false,
                revision: current_revision,
                metadata: metadata.clone(),
            }
        }
        Some("(internal)") => {
            // Internal shader (clear pack)
            metadata.selected = Some("(internal)".to_string());
            metadata.enabled = true;
            SelectResult {
                success: true,
                error: None,
                entry: None,
                enabled: true,
                revision: current_revision,
                metadata: metadata.clone(),
            }
        }
        Some(id) => {
            if let Some(entry) = find_entry(&metadata.entries, id).cloned() {
                metadata.selected = Some(id.to_string());
                metadata.enabled = enabled;
                SelectResult {
                    success: true,
                    error: None,
                    entry: Some(entry),
                    enabled,
                    revision: current_revision,
                    metadata: metadata.clone(),
                }
            } else {
                *revision -= 1; // Revert revision on failure
                SelectResult {
                    success: false,
                    error: Some("Shader pack is no longer in the library".to_string()),
                    entry: None,
                    enabled: false,
                    revision: *revision,
                    metadata: metadata.clone(),
                }
            }
        }
    }
}

/// Removes a shader pack by ID.
pub fn remove_shader_pack(
    metadata: &mut ShaderLibraryMetadata,
    revision: &mut u32,
    id: Option<&str>,
) -> RemoveResult {
    let id = id.or(metadata.selected.as_deref());
    let Some(id) = id else {
        return RemoveResult {
            success: true,
            error: None,
            revision: *revision,
            metadata: metadata.clone(),
            deleted_file_id: None,
        };
    };

    let entry_index = metadata.entries.iter().position(|e| e.id == id);
    let Some(index) = entry_index else {
        return RemoveResult {
            success: true,
            error: None,
            revision: *revision,
            metadata: metadata.clone(),
            deleted_file_id: None,
        };
    };

    let entry = metadata.entries.remove(index);
    let deleted_file_id = Some(entry.id.clone());

    if metadata.selected.as_deref() == Some(id) {
        metadata.selected = None;
        metadata.enabled = false;
    }

    *revision += 1;

    RemoveResult {
        success: true,
        error: None,
        revision: *revision,
        metadata: metadata.clone(),
        deleted_file_id,
    }
}

/// Adds a new shader pack.
pub fn add_shader_pack(
    metadata: &mut ShaderLibraryMetadata,
    revision: &mut u32,
    name: String,
    bytes: Vec<u8>,
) -> AddResult {
    // Save current state first (in JS this calls pack.load and saveCurrent)
    // In WASM we just update metadata

    let entry = ShaderLibraryEntry {
        id: new_id(),
        name,
        options: HashMap::new(),
    };
    let file_id = Some(entry.id.clone());
    let entry_clone = entry.clone();

    metadata.entries.push(entry);
    metadata.selected = Some(entry_clone.id.clone());
    metadata.enabled = true;

    *revision += 1;

    AddResult {
        success: true,
        error: None,
        entry: Some(entry_clone),
        revision: *revision,
        metadata: metadata.clone(),
        file_id,
        bytes: Some(bytes),
    }
}

/// Processes legacy shader pack migration.
pub fn migrate_legacy_pack(
    legacy_bytes: Option<Vec<u8>>,
    legacy_meta_json: Option<&str>,
) -> LegacyMigrationResult {
    let Some(bytes) = legacy_bytes.filter(|b| !b.is_empty()) else {
        return LegacyMigrationResult {
            migrated: false,
            entry: None,
            metadata: ShaderLibraryMetadata::default(),
            file_id: None,
            bytes: None,
            legacy_name: None,
            legacy_options: None,
            legacy_enabled: None,
        };
    };

    let meta: HashMap<String, Value> = legacy_meta_json
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let name = meta
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("Shader pack")
        .to_string();
    let options = meta
        .get("options")
        .and_then(|v| v.as_object())
        .map(|o| o.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
        .unwrap_or_default();
    let enabled = meta.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true);

    let entry = ShaderLibraryEntry {
        id: new_id(),
        name: name.clone(),
        options,
    };
    let file_id = Some(entry.id.clone());

    let mut metadata = ShaderLibraryMetadata::default();
    metadata.entries.push(entry.clone());
    metadata.selected = Some(entry.id.clone());
    metadata.enabled = enabled;

    LegacyMigrationResult {
        migrated: true,
        entry: Some(entry),
        metadata,
        file_id,
        bytes: Some(bytes),
        legacy_name: Some(name),
        legacy_options: Some(
            meta.get("options")
                .and_then(|v| v.as_object())
                .map(|o| o.iter().map(|(k, v)| (k.clone(), v.clone())).collect())
                .unwrap_or_default(),
        ),
        legacy_enabled: Some(enabled),
    }
}

// --------------------------------------------------------------------- wasm

/// Parses metadata JSON string.
fn parse_metadata(json_text: &str) -> ShaderLibraryMetadata {
    let value: Value = serde_json::from_str(json_text).unwrap_or(Value::Null);
    normalize_metadata(value)
}

#[wasm_bindgen]
pub fn shader_library_new_id() -> String {
    new_id()
}

#[wasm_bindgen]
pub fn shader_library_normalize_metadata(json_text: &str) -> String {
    let metadata = parse_metadata(json_text);
    serialize_metadata(&metadata)
}

#[wasm_bindgen]
pub fn shader_library_select(
    metadata_json: &str,
    revision: u32,
    id: Option<String>,
    enabled: bool,
) -> String {
    let mut metadata = parse_metadata(metadata_json);
    let mut rev = revision;
    let result = select_shader_pack(&mut metadata, &mut rev, id.as_deref(), enabled);
    json!(result).to_string()
}

#[wasm_bindgen]
pub fn shader_library_remove(metadata_json: &str, revision: u32, id: Option<String>) -> String {
    let mut metadata = parse_metadata(metadata_json);
    let mut rev = revision;
    let result = remove_shader_pack(&mut metadata, &mut rev, id.as_deref());
    json!(result).to_string()
}

#[wasm_bindgen]
pub fn shader_library_add(
    metadata_json: &str,
    revision: u32,
    name: &str,
    bytes_json: &str,
) -> String {
    let mut metadata = parse_metadata(metadata_json);
    let mut rev = revision;
    // bytes_json is a base64-encoded string from JS
    let bytes: Vec<u8> = serde_json::from_str(bytes_json).unwrap_or_default();
    let result = add_shader_pack(&mut metadata, &mut rev, name.to_string(), bytes);
    json!(result).to_string()
}

#[wasm_bindgen]
pub fn shader_library_migrate_legacy(
    legacy_bytes_json: Option<String>,
    legacy_meta_json: Option<String>,
) -> String {
    let legacy_bytes = legacy_bytes_json
        .and_then(|s| serde_json::from_str(&s).ok());
    let result = migrate_legacy_pack(legacy_bytes, legacy_meta_json.as_deref());
    json!(result).to_string()
}

#[wasm_bindgen]
pub fn shader_library_save_current(
    metadata_json: &str,
    revision: u32,
    pack_bytes_json: Option<String>,
    pack_options_json: Option<String>,
    pack_enabled: bool,
) -> String {
    let mut metadata = parse_metadata(metadata_json);
    let mut rev = revision;

    // If there's a selected entry and pack has bytes, save its options
    if let (Some(selected_id), Some(pack_bytes)) = (metadata.selected.as_ref(), pack_bytes_json) {
        if !pack_bytes.is_empty() {
            if let Some(entry) = metadata.entries.iter_mut().find(|e| e.id == *selected_id) {
                if let Ok(options) = serde_json::from_str(
                    pack_options_json.unwrap_or_else(|| "{}".to_string()).as_str(),
                ) {
                    entry.options = options;
                }
            }
        }
        metadata.enabled = pack_enabled;
    }

    rev += 1;
    let result = json!({
        "success": true,
        "revision": rev,
        "metadata": metadata,
    });
    result.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generates_unique_ids() {
        let id1 = new_id();
        let id2 = new_id();
        assert!(id1.starts_with("shaderpacks/pack/"));
        assert!(id2.starts_with("shaderpacks/pack/"));
        assert_ne!(id1, id2);
    }

    #[test]
    fn normalizes_valid_metadata() {
        let json = json!({
            "entries": [
                {"id": "shaderpacks/pack/abc123", "name": "Test Pack", "options": {"foo": 1}},
                {"id": "invalid/id", "name": "Invalid", "options": {}},
                {"id": "shaderpacks/pack/def456", "name": "Another", "options": {}}
            ],
            "selected": "shaderpacks/pack/abc123",
            "enabled": false
        })
        .to_string();

        let metadata = parse_metadata(&json);
        assert_eq!(metadata.entries.len(), 2);
        assert_eq!(metadata.entries[0].id, "shaderpacks/pack/abc123");
        assert_eq!(metadata.entries[1].id, "shaderpacks/pack/def456");
        assert_eq!(metadata.selected, Some("shaderpacks/pack/abc123".to_string()));
        assert!(!metadata.enabled);
    }

    #[test]
    fn normalizes_invalid_metadata() {
        let json = json!({
            "entries": "not an array",
            "selected": 123,
            "enabled": "yes"
        })
        .to_string();

        let metadata = parse_metadata(&json);
        assert!(metadata.entries.is_empty());
        assert_eq!(metadata.selected, None);
        assert!(metadata.enabled); // default
    }

    #[test]
    fn selects_valid_pack() {
        let mut metadata = ShaderLibraryMetadata {
            entries: vec![
                ShaderLibraryEntry {
                    id: "shaderpacks/pack/1".into(),
                    name: "Pack 1".into(),
                    options: HashMap::new(),
                },
                ShaderLibraryEntry {
                    id: "shaderpacks/pack/2".into(),
                    name: "Pack 2".into(),
                    options: HashMap::new(),
                },
            ],
            selected: Some("shaderpacks/pack/1".into()),
            enabled: true,
        };
        let mut revision = 0;

        let result = select_shader_pack(&mut metadata, &mut revision, Some("shaderpacks/pack/2"), false);
        assert!(result.success);
        assert_eq!(result.entry.as_ref().unwrap().id, "shaderpacks/pack/2");
        assert!(!result.enabled);
        assert_eq!(metadata.selected, Some("shaderpacks/pack/2".into()));
        assert_eq!(revision, 1);
    }

    #[test]
    fn selects_none_clears() {
        let mut metadata = ShaderLibraryMetadata {
            entries: vec![ShaderLibraryEntry {
                id: "shaderpacks/pack/1".into(),
                name: "Pack 1".into(),
                options: HashMap::new(),
            }],
            selected: Some("shaderpacks/pack/1".into()),
            enabled: true,
        };
        let mut revision = 5;

        let result = select_shader_pack(&mut metadata, &mut revision, None, false);
        assert!(result.success);
        assert!(result.entry.is_none());
        assert!(!result.enabled);
        assert_eq!(metadata.selected, None);
        assert!(!metadata.enabled);
        assert_eq!(revision, 6);
    }

    #[test]
    fn selects_internal() {
        let mut metadata = ShaderLibraryMetadata {
            entries: vec![ShaderLibraryEntry {
                id: "shaderpacks/pack/1".into(),
                name: "Pack 1".into(),
                options: HashMap::new(),
            }],
            selected: Some("shaderpacks/pack/1".into()),
            enabled: true,
        };
        let mut revision = 3;

        let result = select_shader_pack(&mut metadata, &mut revision, Some("(internal)"), true);
        assert!(result.success);
        assert!(result.entry.is_none());
        assert!(result.enabled);
        assert_eq!(metadata.selected, Some("(internal)".into()));
        assert_eq!(revision, 4);
    }

    #[test]
    fn selects_missing_pack_fails() {
        let mut metadata = ShaderLibraryMetadata {
            entries: vec![ShaderLibraryEntry {
                id: "shaderpacks/pack/1".into(),
                name: "Pack 1".into(),
                options: HashMap::new(),
            }],
            selected: Some("shaderpacks/pack/1".into()),
            enabled: true,
        };
        let mut revision = 2;

        let result = select_shader_pack(&mut metadata, &mut revision, Some("shaderpacks/pack/999"), true);
        assert!(!result.success);
        assert_eq!(result.error, Some("Shader pack is no longer in the library".to_string()));
        assert_eq!(revision, 2); // reverted
    }

    #[test]
    fn removes_selected_pack() {
        let mut metadata = ShaderLibraryMetadata {
            entries: vec![
                ShaderLibraryEntry {
                    id: "shaderpacks/pack/1".into(),
                    name: "Pack 1".into(),
                    options: HashMap::new(),
                },
                ShaderLibraryEntry {
                    id: "shaderpacks/pack/2".into(),
                    name: "Pack 2".into(),
                    options: HashMap::new(),
                },
            ],
            selected: Some("shaderpacks/pack/1".into()),
            enabled: true,
        };
        let mut revision = 10;

        let result = remove_shader_pack(&mut metadata, &mut revision, Some("shaderpacks/pack/1"));
        assert!(result.success);
        assert_eq!(result.deleted_file_id, Some("shaderpacks/pack/1".into()));
        assert_eq!(metadata.entries.len(), 1);
        assert_eq!(metadata.entries[0].id, "shaderpacks/pack/2");
        assert_eq!(metadata.selected, None);
        assert!(!metadata.enabled);
        assert_eq!(revision, 11);
    }

    #[test]
    fn removes_non_selected_pack() {
        let mut metadata = ShaderLibraryMetadata {
            entries: vec![
                ShaderLibraryEntry {
                    id: "shaderpacks/pack/1".into(),
                    name: "Pack 1".into(),
                    options: HashMap::new(),
                },
                ShaderLibraryEntry {
                    id: "shaderpacks/pack/2".into(),
                    name: "Pack 2".into(),
                    options: HashMap::new(),
                },
            ],
            selected: Some("shaderpacks/pack/1".into()),
            enabled: true,
        };
        let mut revision = 7;

        let result = remove_shader_pack(&mut metadata, &mut revision, Some("shaderpacks/pack/2"));
        assert!(result.success);
        assert_eq!(metadata.entries.len(), 1);
        assert_eq!(metadata.entries[0].id, "shaderpacks/pack/1");
        assert_eq!(metadata.selected, Some("shaderpacks/pack/1".into()));
        assert!(metadata.enabled);
        assert_eq!(revision, 8);
    }

    #[test]
    fn removes_none_id_uses_selected() {
        let mut metadata = ShaderLibraryMetadata {
            entries: vec![ShaderLibraryEntry {
                id: "shaderpacks/pack/1".into(),
                name: "Pack 1".into(),
                options: HashMap::new(),
            }],
            selected: Some("shaderpacks/pack/1".into()),
            enabled: true,
        };
        let mut revision = 0;

        let result = remove_shader_pack(&mut metadata, &mut revision, None);
        assert!(result.success);
        assert_eq!(metadata.entries.len(), 0);
        assert_eq!(metadata.selected, None);
    }

    #[test]
    fn adds_new_pack() {
        let mut metadata = ShaderLibraryMetadata::default();
        let mut revision = 0;
        let bytes = vec![1, 2, 3, 4];

        let result = add_shader_pack(&mut metadata, &mut revision, "New Pack".into(), bytes.clone());
        assert!(result.success);
        assert_eq!(result.entry.as_ref().unwrap().name, "New Pack");
        assert!(result.entry.as_ref().unwrap().id.starts_with("shaderpacks/pack/"));
        assert_eq!(metadata.entries.len(), 1);
        assert_eq!(metadata.selected, result.entry.as_ref().map(|e| e.id.clone()));
        assert!(metadata.enabled);
        assert_eq!(revision, 1);
        assert_eq!(result.bytes, Some(bytes));
    }

    #[test]
    fn migrates_legacy_pack() {
        let legacy_bytes = vec![10, 20, 30];
        let legacy_meta = json!({
            "name": "Legacy Pack",
            "options": {"custom": "value"},
            "enabled": false
        })
        .to_string();

        let result = migrate_legacy_pack(Some(legacy_bytes.clone()), Some(&legacy_meta));
        assert!(result.migrated);
        assert_eq!(result.entry.as_ref().unwrap().name, "Legacy Pack");
        assert_eq!(result.entry.as_ref().unwrap().options.get("custom").unwrap(), "value");
        assert_eq!(result.metadata.entries.len(), 1);
        assert_eq!(result.metadata.selected, result.entry.as_ref().map(|e| e.id.clone()));
        assert!(!result.metadata.enabled);
        assert_eq!(result.bytes, Some(legacy_bytes));
        assert_eq!(result.legacy_enabled, Some(false));
    }

    #[test]
    fn migrates_legacy_pack_with_empty_bytes() {
        let result = migrate_legacy_pack(Some(vec![]), None);
        assert!(!result.migrated);
        assert!(result.entry.is_none());
    }

    #[test]
    fn migrates_legacy_pack_with_no_bytes() {
        let result = migrate_legacy_pack(None, None);
        assert!(!result.migrated);
    }

    #[test]
    fn save_current_updates_entry_options() {
        let metadata = ShaderLibraryMetadata {
            entries: vec![ShaderLibraryEntry {
                id: "shaderpacks/pack/1".into(),
                name: "Pack 1".into(),
                options: HashMap::new(),
            }],
            selected: Some("shaderpacks/pack/1".into()),
            enabled: true,
        };
        let revision = 3;

        let pack_options = json!({"key": "value"}).to_string();
        let result_json = shader_library_save_current(
            &serialize_metadata(&metadata),
            revision,
            Some("[1,2,3]".to_string()), // non-empty bytes
            Some(pack_options),
            false,
        );

        let result: Value = serde_json::from_str(&result_json).unwrap();
        assert!(result["success"].as_bool().unwrap());
        assert_eq!(result["revision"].as_u64().unwrap(), 4);
        let updated_meta: ShaderLibraryMetadata = serde_json::from_value(result["metadata"].clone()).unwrap();
        assert_eq!(updated_meta.entries[0].options.get("key").unwrap(), "value");
        assert!(!updated_meta.enabled);
    }
}