//! Port of `client/js/game/advancements.js` (ClientAdvancementManager).
//!
//! Manages advancement data from server packets, tracks criteria progress,
//! computes completion state, and provides tab/root navigation.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use wasm_bindgen::prelude::*;

/// Display information for an advancement (title, description, icon, etc.)
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct AdvancementDisplay {
    pub title: String,
    pub description: String,
    pub icon: Value,
    pub frame: Option<String>,
    pub show_toast: bool,
    pub announce_to_chat: bool,
    pub hidden: bool,
    pub background: Option<String>,
    pub x: Option<f64>,
    pub y: Option<f64>,
}

/// Criteria progress for an advancement: criterion name -> obtained timestamp (or null)
pub type CriteriaProgress = HashMap<String, Option<i64>>;

/// A single advancement entry.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Advancement {
    pub id: String,
    pub parent: Option<String>,
    pub display: Option<AdvancementDisplay>,
    pub criteria: Vec<String>,
    pub requirements: Vec<Vec<String>>,
    #[serde(skip)]
    pub children: Vec<String>,
}

/// Packet payload for advancement updates (matches server protocol).
#[derive(Debug, Deserialize)]
struct AdvancementPacket {
    reset: bool,
    removed: Vec<String>,
    added: Vec<RawAdvancement>,
    progress: Vec<AdvancementProgressEntry>,
}

#[derive(Debug, Deserialize)]
struct RawAdvancement {
    id: String,
    parent: Option<String>,
    display: Option<RawAdvancementDisplay>,
    criteria: Vec<String>,
    requirements: Vec<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct RawAdvancementDisplay {
    title: Value,
    description: Value,
    icon: Value,
    frame: Option<String>,
    #[serde(rename = "showToast")]
    show_toast: bool,
    #[serde(rename = "announceToChat")]
    announce_to_chat: bool,
    hidden: bool,
    background: Option<String>,
    x: Option<f64>,
    y: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct AdvancementProgressEntry {
    id: String,
    criteria: CriteriaProgress,
}

/// Core advancement manager (state + logic, no WASM bindings).
pub struct AdvancementManager {
    advancements: HashMap<String, Advancement>,
    progress: HashMap<String, CriteriaProgress>,
    selected_tab: Option<String>,
}

impl AdvancementManager {
    pub fn new() -> Self {
        Self {
            advancements: HashMap::new(),
            progress: HashMap::new(),
            selected_tab: None,
        }
    }

    /// Clear all advancements and progress.
    pub fn clear(&mut self) {
        self.advancements.clear();
        self.progress.clear();
        self.selected_tab = None;
    }

    /// Get root advancements that have a display (tabs).
    pub fn tabs(&self) -> Vec<&Advancement> {
        self.advancements
            .values()
            .filter(|a| a.parent.is_none() && a.display.is_some())
            .collect()
    }

    /// Process an advancement packet from the server.
    /// Returns a list of advancement IDs that were newly completed and should show a toast.
    pub fn on_packet(&mut self, packet_json: &str) -> Result<Vec<String>, String> {
        let packet: AdvancementPacket = serde_json::from_str(packet_json).map_err(|e| e.to_string())?;

        if packet.reset {
            self.clear();
        }

        // Remove advancements
        for id in &packet.removed {
            self.advancements.remove(id);
            self.progress.remove(id);
        }

        // Add new advancements
        for raw in &packet.added {
            let display = raw.display.as_ref().map(|d| AdvancementDisplay {
                title: chat_to_legacy(&d.title),
                description: chat_to_legacy(&d.description),
                icon: d.icon.clone(),
                frame: d.frame.clone(),
                show_toast: d.show_toast,
                announce_to_chat: d.announce_to_chat,
                hidden: d.hidden,
                background: d.background.clone(),
                x: d.x,
                y: d.y,
            });

            let advancement = Advancement {
                id: raw.id.clone(),
                parent: raw.parent.clone(),
                display,
                criteria: raw.criteria.clone(),
                requirements: raw.requirements.clone(),
                children: Vec::new(),
            };
            self.advancements.insert(raw.id.clone(), advancement);
        }

        // Rebuild children lists
        for adv in self.advancements.values_mut() {
            adv.children.clear();
        }
        let ids: Vec<String> = self.advancements.keys().cloned().collect();
        for id in &ids {
            if let Some(parent_id) = self.advancements.get(id).and_then(|a| a.parent.clone()) {
                if let Some(parent) = self.advancements.get_mut(&parent_id) {
                    parent.children.push(id.clone());
                }
            }
        }

        // Update progress and detect newly completed advancements
        let mut toasts = Vec::new();
        for pr in &packet.progress {
            if let Some(adv) = self.advancements.get(&pr.id) {
                // Check if advancement was already completed before this progress update
                let was_done = self.is_done(adv);
                
                self.progress.insert(pr.id.clone(), pr.criteria.clone());

                // Check for newly completed advancement with toast (not on reset/sync)
                if !packet.reset && !was_done && self.is_done(adv) && adv.display.as_ref().map(|d| d.show_toast).unwrap_or(false) {
                    toasts.push(adv.id.clone());
                }
            }
        }

        // Update selected tab if needed
        if self.selected_tab.is_none() || !self.advancements.contains_key(self.selected_tab.as_ref().unwrap()) {
            self.selected_tab = self.tabs().first().map(|a| a.id.clone());
        }

        Ok(toasts)
    }

    /// Select a tab by advancement ID.
    pub fn select_tab(&mut self, id: &str) -> bool {
        if self.advancements.contains_key(id) {
            self.selected_tab = Some(id.to_string());
            true
        } else {
            false
        }
    }

    /// Get the currently selected tab ID.
    pub fn selected_tab(&self) -> Option<&str> {
        self.selected_tab.as_deref()
    }

    /// Get an advancement by ID.
    pub fn get(&self, id: &str) -> Option<&Advancement> {
        self.advancements.get(id)
    }

    /// Get progress for an advancement.
    pub fn get_progress(&self, id: &str) -> Option<&CriteriaProgress> {
        self.progress.get(id)
    }

    /// Count how many requirement groups are satisfied.
    fn completed_count(&self, advancement: &Advancement) -> usize {
        let crit = self.progress.get(&advancement.id).cloned().unwrap_or_default();
        advancement
            .requirements
            .iter()
            .filter(|group| group.iter().any(|c| crit.get(c).map(|v| v.is_some()).unwrap_or(false)))
            .count()
    }

    /// Check if an advancement is fully completed.
    pub fn is_done(&self, advancement: &Advancement) -> bool {
        !advancement.requirements.is_empty() && self.completed_count(advancement) == advancement.requirements.len()
    }

    /// Get completion percentage (0.0 to 1.0).
    pub fn percent(&self, advancement: &Advancement) -> f64 {
        if advancement.criteria.is_empty() {
            0.0
        } else {
            self.completed_count(advancement) as f64 / advancement.requirements.len() as f64
        }
    }

    /// Get progress text like "3/5" for multi-requirement advancements.
    pub fn progress_text(&self, advancement: &Advancement) -> Option<String> {
        if advancement.criteria.is_empty() || advancement.requirements.len() <= 1 {
            None
        } else {
            Some(format!("{}/{}", self.completed_count(advancement), advancement.requirements.len()))
        }
    }

    /// Check if we have any progress data for an advancement.
    pub fn has_progress(&self, id: &str) -> bool {
        self.progress.contains_key(id)
    }

    /// Get all advancement IDs.
    pub fn all_ids(&self) -> Vec<String> {
        self.advancements.keys().cloned().collect()
    }

    /// Serialize the full state to JSON for debugging/sync.
    pub fn to_json(&self) -> String {
        let mut map = Map::new();
        map.insert(
            "advancements".to_string(),
            Value::Object(
                self.advancements
                    .iter()
                    .map(|(k, v)| (k.clone(), serde_json::to_value(v).unwrap_or(Value::Null)))
                    .collect(),
            ),
        );
        map.insert(
            "progress".to_string(),
            Value::Object(
                self.progress
                    .iter()
                    .map(|(k, v)| (k.clone(), serde_json::to_value(v).unwrap_or(Value::Null)))
                    .collect(),
            ),
        );
        map.insert("selectedTab".to_string(), Value::String(self.selected_tab.clone().unwrap_or_default()));
        Value::Object(map).to_string()
    }
}

impl Default for AdvancementManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Convert chat component JSON to legacy text (simplified port of chatToLegacy).
fn chat_to_legacy(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Object(obj) => {
            // Handle {text: "...", ...} format
            if let Some(text) = obj.get("text").and_then(|v| v.as_str()) {
                let mut result = text.to_string();
                // Append extra siblings
                if let Some(extra) = obj.get("extra").and_then(|v| v.as_array()) {
                    for e in extra {
                        result.push_str(&chat_to_legacy(e));
                    }
                }
                result
            } else if let Some(translate) = obj.get("translate").and_then(|v| v.as_str()) {
                // Simplified: just return the translation key
                translate.to_string()
            } else {
                String::new()
            }
        }
        Value::Array(arr) => arr.iter().map(chat_to_legacy).collect::<Vec<_>>().join(""),
        _ => String::new(),
    }
}

// ============================================================================
// WASM Bindings
// ============================================================================

#[wasm_bindgen]
pub struct AdvancementsCore {
    inner: AdvancementManager,
}

#[wasm_bindgen]
impl AdvancementsCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> AdvancementsCore {
        AdvancementsCore {
            inner: AdvancementManager::new(),
        }
    }

    /// Clear all advancements and progress.
    pub fn clear(&mut self) {
        self.inner.clear();
    }

    /// Get root advancements with display (tabs) as JSON array.
    pub fn tabs_json(&self) -> String {
        let tabs = self.inner.tabs();
        serde_json::to_string(&tabs).unwrap_or_else(|_| "[]".to_string())
    }

    /// Process an advancement packet from the server.
    /// Returns JSON array of advancement IDs that should show a toast.
    pub fn on_packet(&mut self, packet_json: &str) -> Result<String, JsValue> {
        match self.inner.on_packet(packet_json) {
            Ok(toasts) => Ok(serde_json::to_string(&toasts).unwrap_or_else(|_| "[]".to_string())),
            Err(e) => Err(JsValue::from_str(&e)),
        }
    }

    /// Select a tab by advancement ID.
    pub fn select_tab(&mut self, id: &str) -> bool {
        self.inner.select_tab(id)
    }

    /// Get the currently selected tab ID.
    pub fn selected_tab(&self) -> Option<String> {
        self.inner.selected_tab().map(|s| s.to_string())
    }

    /// Get an advancement by ID as JSON.
    pub fn get_json(&self, id: &str) -> Option<String> {
        self.inner.get(id).and_then(|a| serde_json::to_string(a).ok())
    }

    /// Get progress for an advancement as JSON.
    pub fn get_progress_json(&self, id: &str) -> Option<String> {
        self.inner.get_progress(id).and_then(|p| serde_json::to_string(p).ok())
    }

    /// Check if an advancement is fully completed.
    pub fn is_done(&self, id: &str) -> bool {
        self.inner.get(id).map(|a| self.inner.is_done(a)).unwrap_or(false)
    }

    /// Get completion percentage (0.0 to 1.0).
    pub fn percent(&self, id: &str) -> f64 {
        self.inner.get(id).map(|a| self.inner.percent(a)).unwrap_or(0.0)
    }

    /// Get progress text like "3/5".
    pub fn progress_text(&self, id: &str) -> Option<String> {
        self.inner.get(id).and_then(|a| self.inner.progress_text(a))
    }

    /// Check if we have any progress data for an advancement.
    pub fn has_progress(&self, id: &str) -> bool {
        self.inner.has_progress(id)
    }

    /// Get all advancement IDs as JSON array.
    pub fn all_ids_json(&self) -> String {
        serde_json::to_string(&self.inner.all_ids()).unwrap_or_else(|_| "[]".to_string())
    }

    /// Serialize the full state to JSON.
    pub fn to_json(&self) -> String {
        self.inner.to_json()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_advancement_packet(reset: bool) -> String {
        format!(
            r#"{{
                "reset": {},
                "removed": [],
                "added": [
                    {{
                        "id": "minecraft:story/root",
                        "parent": null,
                        "display": {{
                            "title": {{"text": "Minecraft"}},
                            "description": {{"text": "The heart and story of the game"}},
                            "icon": {{"id": "minecraft:crafting_table", "count": 1}},
                            "frame": "task",
                            "showToast": true,
                            "announceToChat": true,
                            "hidden": false,
                            "background": "minecraft:textures/gui/advancements/backgrounds/stone.png",
                            "x": 0,
                            "y": 0
                        }},
                        "criteria": ["crafting_table"],
                        "requirements": [["crafting_table"]]
                    }},
                    {{
                        "id": "minecraft:story/mine_stone",
                        "parent": "minecraft:story/root",
                        "display": {{
                            "title": {{"text": "Stone Age"}},
                            "description": {{"text": "Mine stone with your new pickaxe"}},
                            "icon": {{"id": "minecraft:stone_pickaxe", "count": 1}},
                            "frame": "task",
                            "showToast": true,
                            "announceToChat": false,
                            "hidden": false,
                            "background": null,
                            "x": 1,
                            "y": 0
                        }},
                        "criteria": ["stone_pickaxe"],
                        "requirements": [["stone_pickaxe"]]
                    }},
                    {{
                        "id": "minecraft:story/upgrade_tools",
                        "parent": "minecraft:story/root",
                        "display": {{
                            "title": {{"text": "Getting an Upgrade"}},
                            "description": {{"text": "Construct a better pickaxe"}},
                            "icon": {{"id": "minecraft:iron_pickaxe", "count": 1}},
                            "frame": "task",
                            "showToast": true,
                            "announceToChat": false,
                            "hidden": false,
                            "background": null,
                            "x": 0,
                            "y": 1
                        }},
                        "criteria": ["iron_pickaxe"],
                        "requirements": [["iron_pickaxe"]]
                    }}
                ],
                "progress": []
            }}"#,
            reset
        )
    }

    fn progress_packet(advancement_id: &str, criteria: &[(&str, Option<i64>)]) -> String {
        let criteria_map: Map<String, Value> = criteria
            .iter()
            .map(|(k, v)| {
                (
                    k.to_string(),
                    match v {
                        Some(t) => Value::Number((*t).into()),
                        None => Value::Null,
                    },
                )
            })
            .collect();

        format!(
            r#"{{
                "reset": false,
                "removed": [],
                "added": [],
                "progress": [{{
                    "id": "{}",
                    "criteria": {}
                }}]
            }}"#,
            advancement_id,
            serde_json::to_string(&criteria_map).unwrap()
        )
    }

    #[test]
    fn parses_packet_and_builds_tree() {
        let mut mgr = AdvancementManager::new();
        let toasts = mgr.on_packet(&sample_advancement_packet(true)).unwrap();
        assert!(toasts.is_empty());

        assert_eq!(mgr.advancements.len(), 3);
        assert_eq!(mgr.tabs().len(), 1);
        assert_eq!(mgr.tabs()[0].id, "minecraft:story/root");

        let root = mgr.get("minecraft:story/root").unwrap();
        assert_eq!(root.children.len(), 2);
        assert!(root.children.contains(&"minecraft:story/mine_stone".to_string()));
        assert!(root.children.contains(&"minecraft:story/upgrade_tools".to_string()));

        let child = mgr.get("minecraft:story/mine_stone").unwrap();
        assert_eq!(child.parent, Some("minecraft:story/root".to_string()));
    }

    #[test]
    fn tracks_progress_and_completion() {
        let mut mgr = AdvancementManager::new();
        mgr.on_packet(&sample_advancement_packet(true)).unwrap();

        // Initially not done
        {
            let root = mgr.get("minecraft:story/root").unwrap();
            assert!(!mgr.is_done(root));
            assert_eq!(mgr.percent(root), 0.0);
            assert!(!mgr.has_progress("minecraft:story/root"));
        }

        // Add progress for root
        mgr.on_packet(&progress_packet("minecraft:story/root", &[("crafting_table", Some(12345))]))
            .unwrap();

        assert!(mgr.has_progress("minecraft:story/root"));
        {
            let root = mgr.get("minecraft:story/root").unwrap();
            assert!(mgr.is_done(root));
            assert_eq!(mgr.percent(root), 1.0);
            assert_eq!(mgr.progress_text(root), None); // Single requirement -> no text
        }

        // Test multi-requirement progress text
        let multi_packet = r#"{
            "reset": true,
            "removed": [],
            "added": [{
                "id": "test:multi",
                "parent": null,
                "display": {"title": {"text": "Test"}, "description": {"text": "Test"}, "icon": {}, "frame": "task", "showToast": true, "announceToChat": false, "hidden": false},
                "criteria": ["a", "b", "c"],
                "requirements": [["a"], ["b"], ["c"]]
            }],
            "progress": []
        }"#;
        mgr.on_packet(multi_packet).unwrap();

        let multi = mgr.get("test:multi").unwrap();
        assert_eq!(mgr.progress_text(multi), Some("0/3".to_string()));

        mgr.on_packet(&progress_packet("test:multi", &[("a", Some(1)), ("b", None), ("c", Some(2))]))
            .unwrap();
        {
            let multi = mgr.get("test:multi").unwrap();
            assert_eq!(mgr.progress_text(multi), Some("2/3".to_string()));
        }
    }

    #[test]
    fn requirement_groups_any_criterion() {
        // Requirements are OR groups: each inner array is a group, any criterion in group satisfies it
        let packet = r#"{
            "reset": true,
            "removed": [],
            "added": [{
                "id": "test:or_group",
                "parent": null,
                "display": {"title": {"text": "Test"}, "description": {"text": "Test"}, "icon": {}, "frame": "task", "showToast": true, "announceToChat": false, "hidden": false},
                "criteria": ["a", "b", "c"],
                "requirements": [["a", "b"], ["c"]]
            }],
            "progress": []
        }"#;
        let mut mgr = AdvancementManager::new();
        mgr.on_packet(packet).unwrap();

        {
            let adv = mgr.get("test:or_group").unwrap();
            assert!(!mgr.is_done(adv));
        }

        // Satisfy first group via "a"
        mgr.on_packet(&progress_packet("test:or_group", &[("a", Some(1)), ("b", None), ("c", None)]))
            .unwrap();
        {
            let adv = mgr.get("test:or_group").unwrap();
            assert!(!mgr.is_done(adv)); // Second group not satisfied
        }

        // Satisfy second group via "c"
        mgr.on_packet(&progress_packet("test:or_group", &[("a", Some(1)), ("b", None), ("c", Some(2))]))
            .unwrap();
        {
            let adv = mgr.get("test:or_group").unwrap();
            assert!(mgr.is_done(adv));
            assert_eq!(mgr.percent(adv), 1.0);
        }
    }

    #[test]
    fn toast_detection_on_completion() {
        let mut mgr = AdvancementManager::new();
        mgr.on_packet(&sample_advancement_packet(true)).unwrap();

        // First progress packet (not reset) - should trigger toast
        let toasts = mgr
            .on_packet(&progress_packet("minecraft:story/root", &[("crafting_table", Some(12345))]))
            .unwrap();
        assert_eq!(toasts, vec!["minecraft:story/root"]);

        // Second progress packet for same advancement - no new toast
        let toasts = mgr
            .on_packet(&progress_packet("minecraft:story/root", &[("crafting_table", Some(12346))]))
            .unwrap();
        assert!(toasts.is_empty());

        // Reset packet - no toast even if completed
        mgr.on_packet(&sample_advancement_packet(true)).unwrap();
        let toasts = mgr
            .on_packet(&progress_packet("minecraft:story/root", &[("crafting_table", Some(12347))]))
            .unwrap();
        assert_eq!(toasts, vec!["minecraft:story/root"]);
    }

    #[test]
    fn tab_selection() {
        let mut mgr = AdvancementManager::new();
        mgr.on_packet(&sample_advancement_packet(true)).unwrap();

        assert_eq!(mgr.selected_tab(), Some("minecraft:story/root"));

        assert!(mgr.select_tab("minecraft:story/mine_stone"));
        assert_eq!(mgr.selected_tab(), Some("minecraft:story/mine_stone"));

        assert!(!mgr.select_tab("nonexistent"));
        assert_eq!(mgr.selected_tab(), Some("minecraft:story/mine_stone"));
    }

    #[test]
    fn chat_to_legacy_conversion() {
        assert_eq!(chat_to_legacy(&Value::String("hello".into())), "hello");
        assert_eq!(
            chat_to_legacy(&serde_json::json!({"text": "hello", "color": "red"})),
            "hello"
        );
        assert_eq!(
            chat_to_legacy(&serde_json::json!({"text": "hello", "extra": [{"text": " world"}]}) ),
            "hello world"
        );
        assert_eq!(
            chat_to_legacy(&serde_json::json!({"translate": "advancement.test"})),
            "advancement.test"
        );
        assert_eq!(
            chat_to_legacy(&serde_json::json!([
                {"text": "a"},
                {"text": "b"}
            ])),
            "ab"
        );
    }

    #[test]
    fn wasm_core_basic_operations() {
        let mut core = AdvancementsCore::new();
        core.clear();
        assert_eq!(core.tabs_json(), "[]");

        core.on_packet(&sample_advancement_packet(true)).unwrap();
        assert!(!core.tabs_json().contains("[]"));

        assert!(core.select_tab("minecraft:story/root"));
        assert_eq!(core.selected_tab(), Some("minecraft:story/root".to_string()));

        let root_json = core.get_json("minecraft:story/root").unwrap();
        assert!(root_json.contains("minecraft:story/root"));
        assert!(root_json.contains("crafting_table"));

        assert!(!core.is_done("minecraft:story/root"));
        core.on_packet(&progress_packet("minecraft:story/root", &[("crafting_table", Some(1))]))
            .unwrap();
        assert!(core.is_done("minecraft:story/root"));
        assert_eq!(core.percent("minecraft:story/root"), 1.0);
    }

    #[test]
    fn advancement_removal() {
        let mut mgr = AdvancementManager::new();
        mgr.on_packet(&sample_advancement_packet(true)).unwrap();

        let remove_packet = r#"{
            "reset": false,
            "removed": ["minecraft:story/mine_stone"],
            "added": [],
            "progress": []
        }"#;
        mgr.on_packet(remove_packet).unwrap();

        assert_eq!(mgr.advancements.len(), 2);
        assert!(mgr.get("minecraft:story/mine_stone").is_none());
        assert!(mgr.get("minecraft:story/root").is_some());

        let root = mgr.get("minecraft:story/root").unwrap();
        assert!(!root.children.contains(&"minecraft:story/mine_stone".to_string()));
    }

    #[test]
    fn advancement_without_display_not_in_tabs() {
        let packet = r#"{
            "reset": true,
            "removed": [],
            "added": [{
                "id": "test:no_display",
                "parent": null,
                "display": null,
                "criteria": ["a"],
                "requirements": [["a"]]
            }],
            "progress": []
        }"#;
        let mut mgr = AdvancementManager::new();
        mgr.on_packet(packet).unwrap();

        assert_eq!(mgr.tabs().len(), 0);
        assert_eq!(mgr.advancements.len(), 1);
    }
}