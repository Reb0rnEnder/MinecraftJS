//! Port of `client/js/game/scoreboard.js` (Scoreboard, objectives, teams, players).
//!
//! Manages player list (tab), scoreboard objectives/scores, and teams.

use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::*;

// Legacy color codes (matching TEAM_COLORS in scoreboard.js)
const TEAM_COLORS: [&str; 16] = [
    "black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple", "gold", "gray",
    "dark_gray", "blue", "green", "aqua", "red", "light_purple", "yellow", "white",
];

const COLOR_CODES: [char; 16] = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f',
];

// ------------------------------------------------------------ chat to legacy (simplified)

fn style_codes(style: &serde_json::Value) -> String {
    let mut s = String::new();
    // Check for false flags that need reset
    let has_false = ["obfuscated", "bold", "strikethrough", "underlined", "italic"]
        .iter()
        .any(|k| style.get(k).and_then(|v| v.as_bool()) == Some(false));
    if has_false {
        s.push_str("§r");
    }
    if let Some(color) = style.get("color").and_then(|v| v.as_str()) {
        if let Some(idx) = TEAM_COLORS.iter().position(|&c| c == color) {
            s.push('§');
            s.push(COLOR_CODES[idx]);
        }
    }
    if style.get("obfuscated").and_then(|v| v.as_bool()) == Some(true) {
        s.push_str("§k");
    }
    if style.get("bold").and_then(|v| v.as_bool()) == Some(true) {
        s.push_str("§l");
    }
    if style.get("strikethrough").and_then(|v| v.as_bool()) == Some(true) {
        s.push_str("§m");
    }
    if style.get("underlined").and_then(|v| v.as_bool()) == Some(true) {
        s.push_str("§n");
    }
    if style.get("italic").and_then(|v| v.as_bool()) == Some(true) {
        s.push_str("§o");
    }
    s
}

fn inherit(parent: &serde_json::Value, child: &serde_json::Value) -> serde_json::Value {
    let mut st = parent.clone();
    for k in ["color", "bold", "italic", "underlined", "strikethrough", "obfuscated"] {
        if let Some(v) = child.get(k) {
            if !v.is_null() {
                st[k] = if k == "color" {
                    v.clone()
                } else {
                    serde_json::Value::Bool(v.as_bool().unwrap_or(false) || v == "true")
                };
            }
        }
    }
    st
}

fn root_style(c: &serde_json::Value, parent: &serde_json::Value) -> serde_json::Value {
    if c.is_array() {
        if let Some(first) = c.as_array().and_then(|a| a.first()) {
            return root_style(first, parent);
        }
        return parent.clone();
    }
    if c.is_object() {
        return inherit(parent, c);
    }
    parent.clone()
}

fn to_text(c: &serde_json::Value, parent_style: &serde_json::Value) -> String {
    if c.is_null() {
        return String::new();
    }
    if c.is_string() {
        let text = c.as_str().unwrap_or("");
        if text.is_empty() {
            return String::new();
        }
        return style_codes(parent_style) + text;
    }
    if c.is_number() || c.as_bool().is_some() {
        let text = c.to_string();
        if text.is_empty() {
            return String::new();
        }
        return style_codes(parent_style) + &text;
    }
    if c.is_array() {
        let arr = c.as_array().unwrap();
        if arr.is_empty() {
            return String::new();
        }
        let base = root_style(&arr[0], parent_style);
        let mut out = String::new();
        for (i, x) in arr.iter().enumerate() {
            let part = to_text(x, if i == 0 { parent_style } else { &base });
            if !part.is_empty() {
                if !out.is_empty() {
                    out.push_str("§r");
                }
                out.push_str(&part);
            }
        }
        return out;
    }
    let style = inherit(parent_style, c);
    let codes = style_codes(&style);
    let mut text = String::new();
    if let Some(t) = c.get("text").and_then(|v| v.as_str()) {
        text = t.to_string();
    } else if let Some(translate) = c.get("translate").and_then(|v| v.as_str()) {
        // Simplified: just use the translate key as text
        text = translate.to_string();
    } else if let Some(score) = c.get("score") {
        if let Some(value) = score.get("value").and_then(|v| v.as_str()) {
            text = value.to_string();
        }
    } else if let Some(selector) = c.get("selector").and_then(|v| v.as_str()) {
        text = selector.to_string();
    } else if let Some(keybind) = c.get("keybind").and_then(|v| v.as_str()) {
        text = keybind.to_string();
    }
    let mut out = if text.is_empty() { String::new() } else { codes + &text };
    if let Some(extra) = c.get("extra").and_then(|v| v.as_array()) {
        for e in extra {
            let part = to_text(e, &style);
            if !part.is_empty() {
                if !out.is_empty() {
                    out.push_str("§r");
                }
                out.push_str(&part);
            }
        }
    }
    out
}

fn is_component(c: &serde_json::Value) -> bool {
    if c.is_string() || c.is_number() || c.as_bool().is_some() {
        return true;
    }
    if !c.is_object() {
        return false;
    }
    if c.is_array() {
        return c.as_array().map(|a| !a.is_empty() && a.iter().all(is_component)).unwrap_or(false);
    }
    let mut valid = false;
    if let Some(text) = c.get("text") {
        valid = text.is_string() || text.is_number() || text.as_bool().is_some();
    } else if let Some(translate) = c.get("translate") {
        valid = translate.is_string()
            && c.get("with").map(|w| w.is_array() && w.as_array().unwrap().iter().all(is_component)).unwrap_or(true);
    } else if let Some(score) = c.get("score") {
        valid = score.get("name").map(|n| n.is_string()).unwrap_or(false)
            && score.get("objective").map(|o| o.is_string()).unwrap_or(false)
            && score.get("value").map(|v| v.is_string() || v.is_number() || v.as_bool().is_some() || v.is_null()).unwrap_or(true);
    } else if let Some(selector) = c.get("selector") {
        valid = selector.is_string();
    } else if let Some(keybind) = c.get("keybind") {
        valid = keybind.is_string();
    }
    valid && c.get("extra").map(|e| e.is_array() && e.as_array().unwrap().iter().all(is_component)).unwrap_or(true)
}

fn chat_to_legacy(json: &serde_json::Value, style: Option<&serde_json::Value>) -> String {
    if json.is_null() {
        return String::new();
    }
    let style = style.cloned().unwrap_or(serde_json::json!({}));
    let s = to_text(json, &style);
    // Close structured formatting
    if json.is_object() || !style_codes(&style).is_empty() {
        if !s.replace("§.", "").is_empty() {
            if s.contains("§") {
                return s + "§r";
            }
            return s;
        }
        return String::new();
    }
    s
}

// ------------------------------------------------------------ data structures

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct PlayerInfo {
    uuid: String,
    name: String,
    properties: Option<serde_json::Value>,
    gamemode: i32,
    ping: i32,
    display_name: Option<String>,
}

impl PlayerInfo {
    fn new() -> Self {
        PlayerInfo {
            uuid: String::new(),
            name: String::new(),
            properties: None,
            gamemode: 0,
            ping: 0,
            display_name: None,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct Objective {
    display_name: String,
    obj_type: String,
    scores: HashMap<String, i32>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct Team {
    name: String,
    players: HashSet<String>,
    display_name: Option<String>,
    prefix: Option<String>,
    suffix: Option<String>,
    collision_rule: String,
    friendly_fire: bool,
    name_tag_visibility: String,
    color: i32,
}

// ------------------------------------------------------------ scoreboard

pub struct Scoreboard {
    players: HashMap<String, PlayerInfo>,
    objectives: HashMap<String, Objective>,
    teams: HashMap<String, Team>,
    player_team: HashMap<String, String>, // player name -> team name
    list: Option<String>,
    default_sidebar: Option<String>,
    below_name: Option<String>,
    team_sidebars: [Option<String>; 16],
    header: String,
    footer: String,
    username: String,
}

impl Scoreboard {
    pub fn new(username: String) -> Scoreboard {
        Scoreboard {
            players: HashMap::new(),
            objectives: HashMap::new(),
            teams: HashMap::new(),
            player_team: HashMap::new(),
            list: None,
            default_sidebar: None,
            below_name: None,
            team_sidebars: Default::default(),
            header: String::new(),
            footer: String::new(),
            username,
        }
    }

    pub fn reset(&mut self) {
        self.players.clear();
        self.objectives.clear();
        self.teams.clear();
        self.player_team.clear();
        self.list = None;
        self.default_sidebar = None;
        self.below_name = None;
        self.team_sidebars = Default::default();
        self.header.clear();
        self.footer.clear();
    }

    pub fn set_username(&mut self, username: String) {
        self.username = username;
    }

    // --- Player Info ---

    pub fn on_player_info(&mut self, action: i32, data_json: &str) {
        let data: Vec<serde_json::Value> = match serde_json::from_str(data_json) {
            Ok(d) => d,
            Err(_) => return,
        };

        for d in data {
            match action {
                0 => {
                    // Add player
                    let uuid = d.get("uuid").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let name = d.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let properties = d.get("properties").cloned();
                    let gamemode = d.get("gamemode").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    let ping = d.get("ping").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                    let display_name = d.get("displayName").and_then(|v| {
                        if v.is_null() {
                            None
                        } else {
                            Some(chat_to_legacy(v, None))
                        }
                    });
                    if !uuid.is_empty() {
                        self.players.insert(
                            uuid.clone(),
                            PlayerInfo {
                                uuid,
                                name,
                                properties,
                                gamemode,
                                ping,
                                display_name,
                            },
                        );
                    }
                }
                1 => {
                    // Update gamemode
                    if let Some(uuid) = d.get("uuid").and_then(|v| v.as_str()) {
                        if let Some(pl) = self.players.get_mut(uuid) {
                            pl.gamemode = d.get("gamemode").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                        }
                    }
                }
                2 => {
                    // Update ping
                    if let Some(uuid) = d.get("uuid").and_then(|v| v.as_str()) {
                        if let Some(pl) = self.players.get_mut(uuid) {
                            pl.ping = d.get("ping").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
                        }
                    }
                }
                3 => {
                    // Update display name
                    if let Some(uuid) = d.get("uuid").and_then(|v| v.as_str()) {
                        if let Some(pl) = self.players.get_mut(uuid) {
                            pl.display_name = d.get("displayName").and_then(|v| {
                                if v.is_null() {
                                    None
                                } else {
                                    Some(chat_to_legacy(v, None))
                                }
                            });
                        }
                    }
                }
                4 => {
                    // Remove player
                    if let Some(uuid) = d.get("uuid").and_then(|v| v.as_str()) {
                        if let Some(pl) = self.players.get(uuid) {
                            let name = pl.name.clone();
                            self.players.remove(uuid);
                            // Also remove from player_team
                            self.player_team.remove(&name);
                        }
                    }
                }
                _ => {}
            }
        }
    }

    // --- Objectives ---

    pub fn on_objective(&mut self, action: i32, objective: &str, display_text: &str, obj_type: &str) {
        match action {
            0 => {
                // Create
                let display_name = chat_to_legacy(&serde_json::json!(display_text), None);
                self.objectives.insert(
                    objective.to_string(),
                    Objective {
                        display_name,
                        obj_type: obj_type.to_string(),
                        scores: HashMap::new(),
                    },
                );
            }
            1 => {
                // Remove
                self.objectives.remove(objective);
                if self.default_sidebar.as_deref() == Some(objective) {
                    self.default_sidebar = None;
                }
                for slot in &mut self.team_sidebars {
                    if slot.as_deref() == Some(objective) {
                        *slot = None;
                    }
                }
                if self.list.as_deref() == Some(objective) {
                    self.list = None;
                }
                if self.below_name.as_deref() == Some(objective) {
                    self.below_name = None;
                }
            }
            2 => {
                // Update
                if let Some(o) = self.objectives.get_mut(objective) {
                    o.display_name = chat_to_legacy(&serde_json::json!(display_text), None);
                    o.obj_type = obj_type.to_string();
                }
            }
            _ => {}
        }
    }

    pub fn on_score(&mut self, action: i32, score_name: &str, item_name: &str, value: i32) {
        match action {
            1 => {
                // Remove score
                if !score_name.is_empty() {
                    if let Some(o) = self.objectives.get_mut(score_name) {
                        o.scores.remove(item_name);
                    }
                } else {
                    // Remove from all objectives
                    for o in self.objectives.values_mut() {
                        o.scores.remove(item_name);
                    }
                }
            }
            _ => {
                // Set score (action 0 = change, action 2 = same)
                if let Some(o) = self.objectives.get_mut(score_name) {
                    o.scores.insert(item_name.to_string(), value);
                }
            }
        }
    }

    pub fn on_display(&mut self, position: i32, objective: Option<&str>) {
        let name = objective.map(|s| s.to_string());
        match position {
            0 => self.list = name,
            1 => self.default_sidebar = name,
            2 => self.below_name = name,
            p if (3..=18).contains(&p) => self.team_sidebars[(p - 3) as usize] = name,
            _ => {}
        }
    }

    pub fn get_sidebar(&self) -> Option<String> {
        // Find the sidebar for the current player's team
        let team_color = self.my_team_color();
        if team_color >= 0 && team_color < 16 {
            self.team_sidebars[team_color as usize].clone().or(self.default_sidebar.clone())
        } else {
            self.default_sidebar.clone()
        }
    }

    pub fn set_sidebar(&mut self, name: Option<String>) {
        self.default_sidebar = name;
    }

    fn my_team_color(&self) -> i32 {
        self.player_team
            .get(&self.username)
            .and_then(|team_name| self.teams.get(team_name))
            .map(|t| t.color)
            .unwrap_or(-1)
    }

    // --- Teams ---

    pub fn on_team(&mut self, mode: i32, team: &str, data_json: &str) {
        let data: serde_json::Value = match serde_json::from_str(data_json) {
            Ok(d) => d,
            Err(_) => return,
        };

        if mode == 0 {
            // Create team - first remove existing players from player_team
            if let Some(t) = self.teams.get(team) {
                for n in &t.players {
                    if self.player_team.get(n) == Some(&team.to_string()) {
                        self.player_team.remove(n);
                    }
                }
            }
            self.teams.insert(
                team.to_string(),
                Team {
                    name: team.to_string(),
                    players: HashSet::new(),
                    display_name: None,
                    prefix: None,
                    suffix: None,
                    collision_rule: "always".to_string(),
                    friendly_fire: true,
                    name_tag_visibility: "always".to_string(),
                    color: -1,
                },
            );
        }

        let Some(t) = self.teams.get_mut(team) else {
            return;
        };

        if mode == 0 || mode == 2 {
            // Update team info
            let color = data.get("color").and_then(|v| v.as_i64()).unwrap_or(-1) as i32;
            let style = if color >= 0 && color < 16 {
                serde_json::json!({ "color": TEAM_COLORS[color as usize] })
            } else {
                serde_json::json!({})
            };

            t.display_name = data.get("displayName").map(|v| chat_to_legacy(v, Some(&style)));
            t.prefix = data.get("prefix").map(|v| chat_to_legacy(v, Some(&style)));
            t.suffix = data.get("suffix").map(|v| chat_to_legacy(v, Some(&style)));
            t.collision_rule = data.get("collisionRule").and_then(|v| v.as_str()).unwrap_or("always").to_string();
            t.friendly_fire = data.get("friendlyFire").and_then(|v| v.as_bool()).unwrap_or(true);
            t.name_tag_visibility = data.get("nameTagVisibility").and_then(|v| v.as_str()).unwrap_or("always").to_string();
            t.color = color;
        }

        // Collect players to remove if mode == 1 BEFORE dropping t
        let players_to_remove = if mode == 1 {
            t.players.iter().cloned().collect::<Vec<String>>()
        } else {
            Vec::new()
        };

        // Drop the mutable borrow on t before handling other modes
        drop(t);

        if mode == 0 || mode == 3 {
            // Add players - collect names first to avoid double borrow
            let mut names_to_add = Vec::new();
            if let Some(players) = data.get("players").and_then(|v| v.as_array()) {
                for n in players {
                    if let Some(name) = n.as_str() {
                        names_to_add.push(name.to_string());
                    }
                }
            }
            for name in names_to_add {
                if let Some(old_team) = self.player_team.get(&name) {
                    if let Some(old_t) = self.teams.get_mut(old_team) {
                        old_t.players.remove(&name);
                    }
                }
                if let Some(t_mut) = self.teams.get_mut(team) {
                    t_mut.players.insert(name.clone());
                    self.player_team.insert(name, team.to_string());
                }
            }
        }

        if mode == 4 {
            // Remove players
            if let Some(players) = data.get("players").and_then(|v| v.as_array()) {
                for n in players {
                    if let Some(name) = n.as_str() {
                        if let Some(t_mut) = self.teams.get_mut(team) {
                            t_mut.players.remove(name);
                        }
                        if self.player_team.get(name) == Some(&team.to_string()) {
                            self.player_team.remove(name);
                        }
                    }
                }
            }
        }

        if mode == 1 {
            // Delete team - use pre-collected players_to_remove
            for n in &players_to_remove {
                if self.player_team.get(n) == Some(&team.to_string()) {
                    self.player_team.remove(n);
                }
            }
            self.teams.remove(team);
        }
    }

    // --- Name formatting ---

    pub fn format_name(&self, name: &str) -> String {
        if let Some(team_name) = self.player_team.get(name) {
            if let Some(t) = self.teams.get(team_name) {
                let color_code = if t.color >= 0 && t.color < 16 {
                    format!("§{}", COLOR_CODES[t.color as usize])
                } else {
                    String::new()
                };
                let prefix = t.prefix.as_deref().unwrap_or("");
                let suffix = t.suffix.as_deref().unwrap_or("");
                return format!("{}§r{}{}{}§r", prefix, color_code, name, suffix);
            }
        }
        name.to_string()
    }

    pub fn tab_name(&self, name: &str, display_name: Option<&str>) -> String {
        if let Some(dn) = display_name {
            return dn.to_string();
        }
        self.format_name(name)
    }

    pub fn display_name(&self, uuid: &str, fallback: Option<&str>) -> Option<String> {
        let player = self.players.get(uuid)?;
        let name = player.name.clone();
        if name.is_empty() {
            return fallback.map(|s| s.to_string());
        }

        // Check nametag visibility
        if let Some(team_name) = self.player_team.get(&name) {
            if let Some(t) = self.teams.get(team_name) {
                let my_team = self.player_team.get(&self.username);
                let v = &t.name_tag_visibility;
                if v == "never" {
                    return None;
                }
                if v == "hideForOtherTeams" && my_team != Some(team_name) {
                    return None;
                }
                if v == "hideForOwnTeam" && my_team.is_some() && my_team == Some(team_name) {
                    return None;
                }
            }
        }
        Some(self.format_name(&name))
    }

    /// Returns sorted player list for tab overlay (spectators last, then by team, then by name)
    pub fn sorted_players(&self) -> Vec<PlayerInfo> {
        let mut arr: Vec<PlayerInfo> = self.players.values().cloned().collect();
        arr.sort_by(|a, b| {
            let sa = if a.gamemode == 3 { 1 } else { 0 };
            let sb = if b.gamemode == 3 { 1 } else { 0 };
            if sa != sb {
                return sa.cmp(&sb);
            }
            let ta = self.player_team.get(&a.name);
            let tb = self.player_team.get(&b.name);
            let na = ta.map(|n| n.as_str()).unwrap_or("");
            let nb = tb.map(|n| n.as_str()).unwrap_or("");
            if na != nb {
                return na.cmp(nb);
            }
            a.name.cmp(&b.name)
        });
        arr.truncate(80);
        arr
    }

    // --- Getters for inspection ---

    pub fn get_players_json(&self) -> String {
        serde_json::to_string(&self.players).unwrap_or_default()
    }

    pub fn get_objectives_json(&self) -> String {
        serde_json::to_string(&self.objectives).unwrap_or_default()
    }

    pub fn get_teams_json(&self) -> String {
        serde_json::to_string(&self.teams).unwrap_or_default()
    }

    pub fn get_list(&self) -> Option<String> {
        self.list.clone()
    }

    pub fn get_below_name(&self) -> Option<String> {
        self.below_name.clone()
    }

    pub fn get_header(&self) -> String {
        self.header.clone()
    }

    pub fn set_header(&mut self, header: String) {
        self.header = header;
    }

    pub fn get_footer(&self) -> String {
        self.footer.clone()
    }

    pub fn set_footer(&mut self, footer: String) {
        self.footer = footer;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_team_colors() {
        assert_eq!(TEAM_COLORS.len(), 16);
        assert_eq!(TEAM_COLORS[0], "black");
        assert_eq!(TEAM_COLORS[15], "white");
    }

    #[test]
    fn test_chat_to_legacy_simple_string() {
        let json = serde_json::json!("hello");
        let result = chat_to_legacy(&json, None);
        assert_eq!(result, "hello");
    }

    #[test]
    fn test_chat_to_legacy_with_color() {
        let json = serde_json::json!({ "text": "hello", "color": "red" });
        let result = chat_to_legacy(&json, None);
        assert_eq!(result, "§chello§r");
    }

    #[test]
    fn test_chat_to_legacy_with_bold() {
        let json = serde_json::json!({ "text": "hello", "bold": true });
        let result = chat_to_legacy(&json, None);
        assert_eq!(result, "§lhello§r");
    }

    #[test]
    fn test_chat_to_legacy_nested() {
        let json = serde_json::json!({ "text": "hello", "extra": [{ "text": " world", "color": "blue" }] });
        let result = chat_to_legacy(&json, None);
        assert!(result.contains("hello"));
        assert!(result.contains("world"));
        assert!(result.contains("§9")); // blue
    }

    #[test]
    fn test_scoreboard_basic() {
        let mut sb = Scoreboard::new("Player1".to_string());
        
        // Add player
        sb.on_player_info(0, r#"[{"uuid": "123", "name": "Player1", "gamemode": 0, "ping": 50}]"#);
        assert!(sb.players.contains_key("123"));
        
        // Update gamemode
        sb.on_player_info(1, r#"[{"uuid": "123", "gamemode": 1}]"#);
        assert_eq!(sb.players.get("123").unwrap().gamemode, 1);
        
        // Remove player
        sb.on_player_info(4, r#"[{"uuid": "123"}]"#);
        assert!(!sb.players.contains_key("123"));
    }

    #[test]
    fn test_scoreboard_objectives() {
        let mut sb = Scoreboard::new("Player1".to_string());
        
        // Create objective
        sb.on_objective(0, "test", "Test Objective", "dummy");
        assert!(sb.objectives.contains_key("test"));
        assert_eq!(sb.objectives.get("test").unwrap().display_name, "Test Objective");
        
        // Update objective
        sb.on_objective(2, "test", "Updated", "dummy");
        assert_eq!(sb.objectives.get("test").unwrap().display_name, "Updated");
        
        // Remove objective
        sb.on_objective(1, "test", "", "");
        assert!(!sb.objectives.contains_key("test"));
    }

    #[test]
    fn test_scoreboard_scores() {
        let mut sb = Scoreboard::new("Player1".to_string());
        
        sb.on_objective(0, "test", "Test", "dummy");
        sb.on_score(0, "test", "Player1", 100);
        assert_eq!(sb.objectives.get("test").unwrap().scores.get("Player1"), Some(&100));
        
        sb.on_score(0, "test", "Player1", 200);
        assert_eq!(sb.objectives.get("test").unwrap().scores.get("Player1"), Some(&200));
        
        sb.on_score(1, "test", "Player1", 0);
        assert!(!sb.objectives.get("test").unwrap().scores.contains_key("Player1"));
    }

    #[test]
    fn test_scoreboard_display() {
        let mut sb = Scoreboard::new("Player1".to_string());
        
        sb.on_objective(0, "obj1", "Obj1", "dummy");
        sb.on_display(1, Some("obj1")); // sidebar
        assert_eq!(sb.get_sidebar(), Some("obj1".to_string()));
        
        sb.on_display(0, Some("obj1")); // list
        assert_eq!(sb.get_list(), Some("obj1".to_string()));
        
        sb.on_display(2, Some("obj1")); // below name
        assert_eq!(sb.get_below_name(), Some("obj1".to_string()));
        
        sb.on_display(3, Some("obj1")); // team sidebar 0
        sb.on_display(18, Some("obj1")); // team sidebar 15
    }

    #[test]
    fn test_scoreboard_teams() {
        let mut sb = Scoreboard::new("Player1".to_string());
        
        // Create team
        sb.on_team(0, "red", r#"{"color": 14, "prefix": "[Red]", "suffix": ""}"#);
        assert!(sb.teams.contains_key("red"));
        assert_eq!(sb.teams.get("red").unwrap().color, 14);
        
        // Add players
        sb.on_team(3, "red", r#"{"players": ["Player1", "Player2"]}"#);
        assert!(sb.teams.get("red").unwrap().players.contains("Player1"));
        assert_eq!(sb.player_team.get("Player1"), Some(&"red".to_string()));
        
        // Remove player
        sb.on_team(4, "red", r#"{"players": ["Player1"]}"#);
        assert!(!sb.teams.get("red").unwrap().players.contains("Player1"));
        assert!(!sb.player_team.contains_key("Player1"));
        
        // Delete team
        sb.on_team(1, "red", "{}");
        assert!(!sb.teams.contains_key("red"));
    }

    #[test]
    fn test_format_name() {
        let mut sb = Scoreboard::new("Player1".to_string());
        
        sb.on_team(0, "red", r#"{"color": 14, "prefix": "[Red]", "suffix": "]"}"#);
        sb.on_team(3, "red", r#"{"players": ["Player1"]}"#);
        
        let formatted = sb.format_name("Player1");
        assert!(formatted.contains("[Red]"));
        assert!(formatted.contains("Player1"));
        assert!(formatted.contains("§e")); // yellow (color 14)
    }

    #[test]
    fn test_tab_name() {
        let mut sb = Scoreboard::new("Player1".to_string());
        
        assert_eq!(sb.tab_name("Player1", Some("CustomName")), "CustomName");
        assert_eq!(sb.tab_name("Player1", None), "Player1");
    }

    #[test]
    fn test_display_name_nametag_visibility() {
        let mut sb = Scoreboard::new("Player1".to_string());
        
        sb.on_player_info(0, r#"[{"uuid": "123", "name": "Player2", "gamemode": 0, "ping": 50}]"#);
        
        // Team with never visibility
        sb.on_team(0, "hide", r#"{"nameTagVisibility": "never"}"#);
        sb.on_team(3, "hide", r#"{"players": ["Player2"]}"#);
        assert!(sb.display_name("123", Some("Player2")).is_none());
        
        // Team with hideForOtherTeams
        sb.on_team(0, "team1", r#"{"nameTagVisibility": "hideForOtherTeams"}"#);
        sb.on_team(3, "team1", r#"{"players": ["Player2"]}"#);
        // Player1 is not in team1, so should be hidden
        assert!(sb.display_name("123", Some("Player2")).is_none());
        
        // Add Player1 to team1
        sb.on_team(3, "team1", r#"{"players": ["Player1"]}"#);
        assert!(sb.display_name("123", Some("Player2")).is_some());
    }

    #[test]
    fn test_sorted_players() {
        let mut sb = Scoreboard::new("Player1".to_string());
        
        sb.on_player_info(0, r#"[{"uuid": "1", "name": "Player1", "gamemode": 0, "ping": 50}]"#);
        sb.on_player_info(0, r#"[{"uuid": "2", "name": "Player2", "gamemode": 1, "ping": 50}]"#);
        sb.on_player_info(0, r#"[{"uuid": "3", "name": "Spectator", "gamemode": 3, "ping": 50}]"#);
        sb.on_player_info(0, r#"[{"uuid": "4", "name": "Player3", "gamemode": 0, "ping": 50}]"#);
        
        let sorted = sb.sorted_players();
        assert_eq!(sorted.len(), 4);
        // Spectator should be last
        assert_eq!(sorted[3].name, "Spectator");
        // Others sorted by name
        assert_eq!(sorted[0].name, "Player1");
        assert_eq!(sorted[1].name, "Player2");
        assert_eq!(sorted[2].name, "Player3");
    }
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub struct ScoreboardCore {
    inner: Scoreboard,
}

#[wasm_bindgen]
impl ScoreboardCore {
    #[wasm_bindgen(constructor)]
    pub fn new(username: String) -> ScoreboardCore {
        ScoreboardCore {
            inner: Scoreboard::new(username),
        }
    }

    pub fn reset(&mut self) {
        self.inner.reset();
    }

    pub fn set_username(&mut self, username: String) {
        self.inner.set_username(username);
    }

    pub fn on_player_info(&mut self, action: i32, data_json: &str) {
        self.inner.on_player_info(action, data_json);
    }

    pub fn on_objective(&mut self, action: i32, objective: &str, display_text: &str, obj_type: &str) {
        self.inner.on_objective(action, objective, display_text, obj_type);
    }

    pub fn on_score(&mut self, action: i32, score_name: &str, item_name: &str, value: i32) {
        self.inner.on_score(action, score_name, item_name, value);
    }

    pub fn on_display(&mut self, position: i32, objective: Option<String>) {
        self.inner.on_display(position, objective.as_deref());
    }

    pub fn on_team(&mut self, mode: i32, team: &str, data_json: &str) {
        self.inner.on_team(mode, team, data_json);
    }

    pub fn format_name(&self, name: &str) -> String {
        self.inner.format_name(name)
    }

    pub fn tab_name(&self, name: &str, display_name: Option<String>) -> String {
        self.inner.tab_name(name, display_name.as_deref())
    }

    pub fn display_name(&self, uuid: &str, fallback: Option<String>) -> Option<String> {
        self.inner.display_name(uuid, fallback.as_deref())
    }

    pub fn get_sidebar(&self) -> Option<String> {
        self.inner.get_sidebar()
    }

    pub fn set_sidebar(&mut self, name: Option<String>) {
        self.inner.set_sidebar(name);
    }

    pub fn get_players_json(&self) -> String {
        self.inner.get_players_json()
    }

    pub fn get_objectives_json(&self) -> String {
        self.inner.get_objectives_json()
    }

    pub fn get_teams_json(&self) -> String {
        self.inner.get_teams_json()
    }

    pub fn get_list(&self) -> Option<String> {
        self.inner.get_list()
    }

    pub fn get_below_name(&self) -> Option<String> {
        self.inner.get_below_name()
    }

    pub fn get_header(&self) -> String {
        self.inner.get_header()
    }

    pub fn set_header(&mut self, header: String) {
        self.inner.set_header(header);
    }

    pub fn get_footer(&self) -> String {
        self.inner.get_footer()
    }

    pub fn set_footer(&mut self, footer: String) {
        self.inner.set_footer(footer);
    }

    pub fn sorted_players_json(&self) -> String {
        serde_json::to_string(&self.inner.sorted_players()).unwrap_or_default()
    }
}