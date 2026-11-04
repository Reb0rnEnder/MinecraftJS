//! Port of `client/js/game/commands.js`: client-side Brigadier command tree parsing.
//! Handles parsing, validation, and suggestions for Minecraft commands.
//! The server owns execution and permission checks; the client only parses for suggestions.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::{HashMap, HashSet};
use wasm_bindgen::prelude::*;
use regex::Regex;

// ------------------------------------------------------------ constants

const COLORS: [&str; 5] = ["§b", "§e", "§a", "§d", "§6"];
const COLOR_NAMES: [&str; 16] = [
    "black", "dark_blue", "dark_green", "dark_aqua", "dark_red", "dark_purple",
    "gold", "gray", "dark_gray", "blue", "green", "aqua", "red",
    "light_purple", "yellow", "white",
];

const PROTOCOL_VERSION: i32 = 578;

const VALID_ENTITY_KEYS: &[&str] = &[
    "x", "y", "z", "dx", "dy", "dz", "distance", "x_rotation", "y_rotation",
    "limit", "sort", "level", "gamemode", "name", "team", "type", "tag",
    "nbt", "scores", "advancements", "predicate",
];

const VALID_SORT: &[&str] = &["nearest", "furthest", "random", "arbitrary"];
const VALID_GAMEMODE: &[&str] = &["survival", "creative", "adventure", "spectator"];
const VALID_OPERATION: &[&str] = &["=", "+=", "-=", "*=", "/=", "%=", "<", ">", "><"];
const VALID_COLOR: &[&str] = &COLOR_NAMES;
const VALID_ENTITY_ANCHOR: &[&str] = &["eyes", "feet"];
const VALID_SCOREBOARD_SLOT: &[&str] = &[
    "list", "sidebar", "belowName",
    "sidebar.team.black", "sidebar.team.dark_blue", "sidebar.team.dark_green",
    "sidebar.team.dark_aqua", "sidebar.team.dark_red", "sidebar.team.dark_purple",
    "sidebar.team.gold", "sidebar.team.gray", "sidebar.team.dark_gray",
    "sidebar.team.blue", "sidebar.team.green", "sidebar.team.aqua",
    "sidebar.team.red", "sidebar.team.light_purple", "sidebar.team.yellow",
    "sidebar.team.white",
];
const VALID_SCOREBOARD_CRITERIA: &[&str] = &[
    "dummy", "trigger", "deathCount", "playerKillCount", "totalKillCount",
    "health", "food", "air", "armor", "xp", "level",
];
const VALID_ITEM_SLOT_FIXED: &[&str] = &[
    "weapon", "weapon.mainhand", "weapon.offhand", "armor.head", "armor.chest",
    "armor.legs", "armor.feet", "horse.saddle", "horse.armor", "horse.chest",
];
const ITEM_SLOT_SIZES: &[(&str, i32)] = &[
    ("container", 54), ("hotbar", 9), ("inventory", 27), ("enderchest", 27),
    ("villager", 8), ("horse", 15),
];

// ------------------------------------------------------------ helpers

fn normalize(s: &str) -> String {
    if s.contains(':') { s.to_string() } else { format!("minecraft:{}", s) }
}

fn matches(value: &str, prefix: &str) -> bool {
    value.to_lowercase().starts_with(&prefix.to_lowercase())
        || value.to_lowercase().contains(&format!("_{}", prefix.to_lowercase()))
}

fn numeric(value: &str, integer: bool) -> bool {
    if integer { value.parse::<i64>().is_ok() } else { value.parse::<f64>().is_ok() }
}

fn numeric_check(value: &str, integer: bool) -> bool {
    if integer { regex::Regex::new(r"^-?\d+$").unwrap().is_match(value) } else { regex::Regex::new(r"^-?(?:\d+(?:\.\d*)?|\.\d+)$").unwrap().is_match(value) }
}

fn selector_options(value: &str) -> Option<Map<String, Vec<String>>> {
    let raw = value.contains('[').then(|| &value[value.find('[')+1..value.len()-1]).unwrap_or("");
    let mut options: Map<String, Vec<String>> = Map::new();
    for part in split_options(raw) {
        if part.trim().is_empty() { continue; }
        let at = part.find('=');
        let key = if let Some(a) = at { &part[..a] } else { part.trim() };
        let v = if let Some(a) = at { &part[a+1..] } else { "" };
        if key == "predicate" { return None; }
        if at.is_none() || v.is_empty() { return None; }
        if options.contains_key(key) && !["tag", "nbt", "predicate"].iter().any(|k| *k == key)
            && !["name", "team", "type", "gamemode"].iter().any(|k| options[key].iter().all(|p| p.starts_with('!'))) {
            return None;
        }
        if key == "limit" {
            if let Ok(n) = v.parse::<i64>() { if n < 1 || n > 2147483647 { return None; } }
            else { return None; }
        }
        if key == "sort" && !["nearest", "furthest", "random", "arbitrary"].contains(&v) { return None; }
        if key == "gamemode" {
            let vm = v.trim_start_matches('!');
            !["survival", "creative", "adventure", "spectator"].contains(&vm) { return None; }
        }
        options.entry(key.to_string()).or_default().push(v.to_string());
    }
    Some(options)
}

fn split_options(value: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut start = 0;
    let mut depth = 0;
    let mut quote = None;
    let mut escape = false;
    for i in 0..value.len() {
        let c = value.as_bytes()[i] as char;
        if let Some(q) = quote {
            if escape { escape = false; }
            else if c == '\\' { escape = true; }
            else if c == q { quote = None; }
        } else if c == '"' || c == '\'' { quote = Some(c); }
        else if c == '{' || c == '[' { depth += 1; }
        else if c == '}' || c == ']' { depth -= 1; }
        else if c == ',' && depth == 0 {
            out.push(value[start..i].to_string());
            start = i + 1;
        }
    }
    out.push(value[start..].to_string());
    out
}

// Balanced string parsing (quotes, brackets, braces)
#[derive(Debug, Clone)]
struct BalancedResult {
    value: String,
    end: usize,
    error: Option<String>,
}

impl BalancedResult {
    fn error(start: usize, msg: &str) -> Self {
        Self { value: String::new(), end: start, error: Some(msg.to_string()) }
    }
}

fn balanced(text: &str, start: usize) -> BalancedResult {
    let mut stack: Vec<char> = Vec::new();
    let mut quote: Option<char> = None;
    let mut escaped = false;
    let mut end = start;
    let chars: Vec<char> = text.chars().collect();

    while end < chars.len() {
        let c = chars[end];
        if let Some(q) = quote {
            if escaped { escaped = false; }
            else if c == '\\' { escaped = true; }
            else if c == q { quote = None; }
        } else if c == '"' || c == '\'' {
            quote = Some(c);
        } else if c == '[' || c == '{' {
            stack.push(if c == '[' { ']' } else { '}' });
        } else if c == ']' || c == '}' {
            if stack.pop() != Some(c) {
                return BalancedResult::error(start, &format!("parsing.expected [{}]", c));
            }
        } else if c.is_whitespace() && stack.is_empty() {
            break;
        }
        end += 1;
    }
    if quote.is_some() || !stack.is_empty() {
        let expected = quote.or(stack.last().copied()).unwrap_or(' ');
        return BalancedResult::error(start, &format!("parsing.expected [{}]", expected));
    }
    BalancedResult { value: text[start..end].to_string(), end, error: None }
}

// ------------------------------------------------------------ data structures

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseResult {
    pub cursor: usize,
    pub spans: Vec<Span>,
    pub edges: Vec<Edge>,
    pub node: usize,
    pub incomplete: bool,
    pub error: Option<ParseError>,
    pub completion: Option<Completion>,
    pub has_exceptions: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Span {
    pub start: usize,
    pub end: usize,
    pub color: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub parent: usize,
    pub start: usize,
    pub end: usize,
    pub node: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParseError {
    pub start: usize,
    pub key: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Completion {
    pub node: usize,
    pub start: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestionResult {
    pub start: usize,
    pub end: usize,
    pub matches: Vec<SuggestionMatch>,
    pub ask_server: bool,
    pub parsed: ParseResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SuggestionMatch {
    pub match_str: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct Node {
    #[serde(rename = "type")]
    node_type: i32,
    name: Option<String>,
    redirect: Option<usize>,
    children: Vec<usize>,
    parser: Option<String>,
    properties: Option<Value>,
    executable: bool,
    suggestions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct GameAssets {
    data: AssetsData,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AssetsData {
    blocks: Vec<BlockData>,
    sounds: Vec<SoundData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct BlockData {
    name: String,
    states: Option<Vec<StateProperty>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StateProperty {
    name: String,
    #[serde(rename = "type")]
    prop_type: String,
    values: Option<Vec<String>>,
    num_values: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SoundData {
    name: String,
}

// ------------------------------------------------------------ CommandTree

#[wasm_bindgen]
pub struct CommandTree {
    nodes: Vec<Node>,
    root: usize,
    game_assets: Option<GameAssets>,
}

impl CommandTree {
    #[wasm_bindgen(constructor)]
    pub fn new(packet_json: &str, game_assets_json: &str) -> Result<CommandTree, JsValue> {
        let packet: Value = serde_json::from_str(packet_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let game_assets: Option<GameAssets> = if game_assets_json.is_empty() {
            None
        } else {
            serde_json::from_str(game_assets_json).ok()
        };

        let nodes = packet["nodes"].as_array()
            .map(|arr| arr.iter().map(|v| serde_json::from_value(v.clone()).unwrap()).collect())
            .unwrap_or_default();
        let root = packet["root"].as_u64().unwrap_or(0) as usize;

        Ok(CommandTree { nodes, root, game_assets })
    }

    fn registry(&self, kind: &str) -> Vec<String> {
        let data = self.game_assets.as_ref().map(|g| &g.data);
        match kind {
            "effects" => vec![
                "speed","slowness","haste","mining_fatigue","strength","instant_health",
                "instant_damage","jump_boost","nausea","regeneration","resistance",
                "fire_resistance","water_breathing","invisibility","blindness",
                "night_vision","hunger","weakness","poison","wither","health_boost",
                "absorption","saturation","glowing","levitation","luck","unluck",
                "slow_falling","conduit_power","dolphins_grace",
            ].iter().map(|s| normalize(s)).collect(),
            _ => {
                data.and_then(|d| d.get(kind))
                    .and_then(|v| v.as_array())
                    .map(|arr| arr.iter().filter_map(|d| d.get("name").and_then(|n| n.as_str())).filter(|s| !s.is_empty()).map(|s| normalize(s)).collect())
                    .unwrap_or_default()
            }
        }
    }

    fn argument(&self, node: &Node, text: &str, start: usize) -> BalancedResult {
        let parser = node.parser.as_deref().unwrap_or("");
        let p = node.properties.as_ref().unwrap_or(&Value::Null);

        // Message/string types
        if parser == "minecraft:message" || (parser == "brigadier:string" && p.get("mode").and_then(|v| v.as_i64()) == Some(2)) {
            if start < text.len() { return BalancedResult { value: text[start..].to_string(), end: text.len(), error: None }; }
            return BalancedResult::error(start, "command.unknown.argument");
        }

        let token = balanced(text, start);
        if token.error.is_some() { return token; }
        let value = token.value;
        let end = token.end;

        if value.is_empty() { return BalancedResult::error(start, "command.unknown.argument"); }

        // String types
        if parser == "brigadier:string" {
            let mode = p.get("mode").and_then(|v| v.as_i64()).unwrap_or(0);
            if mode == 2 { return BalancedResult { value: String::new(), end: text.len(), error: None }; }
            if mode == 0 && !regex::Regex::new(r"^[0-9A-Za-z_+.-]+$").unwrap().is_match(&value) {
                return BalancedResult::error(start, "command.unknown.argument");
            }
            if mode == 1 {
                if value.starts_with('"') {
                    if serde_json::from_str::<Value>(&value).is_err() {
                        return BalancedResult::error(start, "parsing.quote.expected.end");
                    }
                } else if !regex::Regex::new(r"^[0-9A-Za-z_+.-]+$").unwrap().is_match(&value) {
                    return BalancedResult::error(start, "command.unknown.argument");
                }
            }
            return BalancedResult { value: String::new(), end, error: None };
        }

        // NBT types
        if ["minecraft:nbt","minecraft:nbt_compound_tag","minecraft:nbt_tag"].contains(&parser) {
            match native_snbt(value) {
                Ok(tag) => {
                    if parser != "minecraft:nbt_tag" && tag.get("t").and_then(|v| v.as_i64()) != Some(10) {
                        return BalancedResult::error(start, "argument.nbt.invalid");
                    }
                }
                Err(_) => return BalancedResult::error(start, "argument.nbt.invalid"),
            }
            return BalancedResult { value: String::new(), end, error: None };
        }

        // Time
        if parser == "minecraft:time" {
            let re = Regex::new(r"^(-?(?:\d+(?:\.\d*)?|\.\d+))([dst]?)$").unwrap();
            if let Some(caps) = re.captures(value) {
                let num: f64 = caps[1].parse().unwrap_or(0.0);
                let unit = &caps[2];
                let mult = match unit { "d" => 24000.0, "s" => 20.0, "t" => 1.0, _ => 1.0 };
                let ticks = (num * mult).round() as i64;
                if ticks < 0 { return BalancedResult::error(start, "argument.time.invalid_tick_count"); }
                return BalancedResult { value: String::new(), end, error: None };
            }
            return BalancedResult::error(start, "argument.time.invalid_unit");
        }

        // JSON component
        if parser == "minecraft:component" {
            if serde_json::from_str::<Value>(value).is_ok() {
                return BalancedResult { value: String::new(), end, error: None };
            }
            return BalancedResult::error(start, "argument.component.invalid");
        }

        // Numbers
        if ["brigadier:integer","brigadier:float","brigadier:double"].contains(&parser) {
            let integer = parser == "brigadier:integer";
            let type_str = if integer { "int" } else { &parser[10..] };
            if let Ok(number) = value.parse::<f64>() {
                if !numeric_check(value, integer) || !number.is_finite() {
                    return BalancedResult::error(start, &format!("parsing.{}.invalid", type_str));
                }
                let min = p.get("min").and_then(|v| v.as_f64()).unwrap_or(if integer { -2147483648.0 } else { f64::NEG_INFINITY });
                let max = p.get("max").and_then(|v| v.as_f64()).unwrap_or(if integer { 2147483647.0 } else { f64::INFINITY });
                let key = if integer { "integer" } else { type_str };
                if number < min { return BalancedResult::error(start, &format!("argument.{}.low", key)); }
                if number > max { return BalancedResult::error(start, &format!("argument.{}.big", key)); }
                return BalancedResult { value: String::new(), end, error: None };
            }
        }

        // Boolean
        if parser == "brigadier:bool" {
            if ["true","false"].contains(&value) {
                return BalancedResult { value: String::new(), end, error: None };
            }
            return BalancedResult::error(start, "parsing.bool.invalid");
        }

        // Position types (block_pos, vec3, column_pos, vec2, rotation)
        let count = match parser.as_str() {
            "minecraft:block_pos" => 3,
            "minecraft:vec3" => 3,
            "minecraft:column_pos" => 2,
            "minecraft:vec2" => 2,
            "minecraft:rotation" => 2,
            _ => 0,
        };
        if count > 0 {
            let local = value.starts_with('^');
            let mut end = start;
            for i in 0..count {
                if i > 0 {
                    if end >= text.len() || text.chars().nth(end) != Some(' ') {
                        return BalancedResult::error(start, &format!("argument.pos{}d.incomplete", count));
                    }
                    while text.chars().nth(end) == Some(' ') { end += 1; }
                    let (val, new_end) = word(text, end);
                    let relative = val.starts_with(['^','~']);
                    let n = if relative { &val[1..] } else { &val };
                    if (val.starts_with('^') != local)
                        || (local && parser != "minecraft:vec3" && parser != "minecraft:block_pos")
                        || (!n.is_empty() && !numeric_check(n, parser == "minecraft:block_pos" && !relative)) {
                        return BalancedResult::error(start, "argument.pos.mixed");
                    }
                    if !relative && n.is_empty() {
                        return BalancedResult::error(start, "command.unknown.argument");
                    }
                    if parser == "minecraft:block_pos" && !relative {
                        if let Ok(n_val) = n.parse::<i64>() {
                            if n_val < -2147483648 || n_val > 2147483647 {
                                return BalancedResult::error(start, "command.unknown.argument");
                            }
                        }
                    }
                    end = new_end; // approximate
                }
                return BalancedResult { value: String::new(), end, error: None };
            }

            // Entity selectors
            if ["minecraft:entity","minecraft:game_profile","minecraft:score_holder"].contains(&parser) {
                if value.starts_with('@') {
                    if !regex::Regex::new(r"^@[pares](?:\[.*\])?$").unwrap().is_match(value) {
                        return BalancedResult::error(start, &format!("argument.entity.selector.unknown [{}]", &value[..2]));
                    }
                    let options = selector_options(value).ok_or_else(|| BalancedResult::error(start, "argument.entity.options.invalid"))?;
                    let limit = options.get("limit").and_then(|v| v[0].parse().ok()).unwrap_or(if value.starts_with("@p") || value.starts_with("@a") { i64::MAX } else { 1 });
                    let p = node.properties.as_ref().unwrap_or(&Value::Null);
                    let flags = p.get("flags").and_then(|v| v.as_i64()).unwrap_or(0);
                    if parser == "minecraft:entity" && (flags & 1) != 0 && limit > 1 {
                        return BalancedResult::error(start, "argument.entity.toomany");
                    }
                    if parser == "minecraft:entity" && (flags & 2) != 0 && value.starts_with("@e") && !["player","minecraft:player"].contains(&options.get("type").and_then(|v| v[0].as_str()).unwrap_or("")) {
                        return BalancedResult::error(start, "argument.player.entities");
                    }
                    return BalancedResult { value: String::new(), end, error: None };
                } else if !(parser == "minecraft:score_holder" && value == "*") && !regex::Regex::new(r"^[0-9A-Za-z_+.-]+$").unwrap().is_match(value) {
                    return BalancedResult::error(start, "command.unknown.argument");
                }
                return BalancedResult { value: String::new(), end, error: None };
            }

            // Range types
            if parser == "minecraft:int_range" || parser == "minecraft:float_range" {
                let pieces: Vec<&str> = value.split("..").collect();
                let integer = parser == "minecraft:int_range";
                if pieces.len() > 2 || pieces.iter().all(|s| s.is_empty()) || pieces.iter().any(|s| !s.is_empty() && !numeric_check(s, integer))
                    || pieces.len() == 2 && pieces.iter().all(|s| !s.is_empty()) && pieces[0].parse::<i64>().unwrap_or(0) > pieces[1].parse::<i64>().unwrap_or(0) {
                    return BalancedResult::error(start, "command.unknown.argument");
                }
                return BalancedResult { value: String::new(), end, error: None };
            }

            // Choice types
            let choices: Option<&[&str]> = match parser {
                "minecraft:color" => Some(&COLOR_NAMES),
                "minecraft:entity_anchor" => Some(&["eyes", "feet"]),
                "minecraft:operation" => Some(&["=", "+=", "-=", "*=", "/=", "%=", "<", ">", "><"]),
                "minecraft:scoreboard_slot" => Some(&[
                    "list", "sidebar", "belowName",
                    "sidebar.team.black", "sidebar.team.dark_blue", "sidebar.team.dark_green",
                    "sidebar.team.dark_aqua", "sidebar.team.dark_red", "sidebar.team.dark_purple",
                    "sidebar.team.gold", "sidebar.team.gray", "sidebar.team.dark_gray",
                    "sidebar.team.blue", "sidebar.team.green", "sidebar.team.aqua",
                    "sidebar.team.red", "sidebar.team.light_purple", "sidebar.team.yellow",
                    "sidebar.team.white",
                ]),
                _ => None,
            };
            if let Some(choices) = choices {
                if !choices.contains(&value) {
                    return BalancedResult::error(start, "command.unknown.argument");
                }
                return BalancedResult { value: String::new(), end, error: None };
            }

            // Item slot
            if parser == "minecraft:item_slot" {
                let fixed = ["weapon","weapon.mainhand","weapon.offhand","armor.head","armor.chest","armor.legs","armor.feet","horse.saddle","horse.armor","horse.chest"];
                let re = Regex::new(r"^(container|hotbar|inventory|enderchest|villager|horse)\.(\d+)$").unwrap();
                let sizes: HashMap<&str, i32> = ITEM_SLOT_SIZES.iter().cloned().collect();
                let sizes_map: HashMap<String, i32> = sizes.into_iter().collect();
                if !fixed.contains(&value) {
                    if let Some(caps) = Regex::new(r"^(container|hotbar|inventory|enderchest|villager|horse)\.(\d+)$").unwrap().captures(value) {
                        let slot_type = &caps[1];
                        let idx: i32 = caps[2].parse().unwrap_or(0);
                        if idx >= *sizes_map.get(slot_type).unwrap_or(&0) {
                            return BalancedResult::error(start, "slot.unknown");
                        }
                    } else {
                        return BalancedResult::error(start, "slot.unknown");
                    }
                }
                return BalancedResult { value: String::new(), end, error: None };
            }

            // Objective criteria
            if parser == "minecraft:objective_criteria" {
                let mut names = vec!["dummy","trigger","deathCount","playerKillCount","totalKillCount","health","food","air","armor","xp","level"];
                for c in COLOR_NAMES.iter() {
                    names.push(&format!("teamkill.{}", c));
                    names.push(&format!("killedByTeam.{}", c));
                }
                let regex = Regex::new(r"^minecraft\.(?:mined|crafted|used|broken|picked_up|dropped|killed|killed_by|custom):[a-z0-9_.]+(?:\.[a-z0-9_]+)+$").unwrap();
                if !names.contains(&value) && !regex.is_match(value) {
                    return BalancedResult::error(start, "argument.criteria.invalid");
                }
                return BalancedResult { value: String::new(), end, error: None };
            }

            // NBT path
            if parser == "minecraft:nbt_path" {
                let mut quote: Option<char> = None;
                let mut i = 0;
                let chars: Vec<char> = value.chars().collect();
                while i < chars.len() {
                    let c = chars[i];
                    if let Some(q) = quote {
                        if c == '\\' { i += 1; }
                        else if c == q { quote = None; }
                    } else if c == '"' || c == '\'' { quote = Some(c); }
                    else if c == '[' {
                        let mut end = i + 1;
                        let mut depth = 1;
                        let mut q: Option<char> = None;
                        while end < chars.len() {
                            let c = chars[end];
                            if let Some(q) = q {
                                if c == '\\' { end += 1; }
                                else if c == q { q = None; }
                            } else if c == '"' || c == '\'' { q = Some(c); }
                            else if c == '[' { depth += 1; }
                            else if c == ']' && { depth -= 1; depth == 0 } { break; }
                            end += 1;
                        }
                        let part = &value[i+1..end].trim();
                        if PROTOCOL_VERSION < 477 && !regex::Regex::new(r"^-?\d+$").unwrap().is_match(part) {
                            return BalancedResult::error(start, "command.unknown.argument");
                        }
                        if regex::Regex::new(r"^-?\d+$").unwrap().is_match(part) {
                            let num: i64 = part.parse().unwrap_or(0);
                            if num < -2147483648 || num > 2147483647 {
                                return BalancedResult::error(start, "command.unknown.argument");
                            }
                        }
                        if !part.is_empty() && !regex::Regex::new(r"^-?\d+$").unwrap().is_match(part) {
                            if let Err(_) = native_snbt(part) { return BalancedResult::error(start, "command.unknown.argument"); }
                        }
                        i = end;
                    }
                }
                return BalancedResult { value: String::new(), end, error: None };
            }

            // Swizzle
            if parser == "minecraft:swizzle" && (!regex::Regex::new(r"^[xyz]+$").unwrap().is_match(value) || value.chars().collect::<std::collections::HashSet<_>>().len() != value.len()) {
                return BalancedResult::error(start, "arguments.swizzle.invalid");
            }

            // Registry-based types (block_state, item_stack, etc.)
            let kind_map: HashMap<&str, &str> = [
                ("minecraft:block_state","blocks"),
                ("minecraft:block_predicate","blocks"),
                ("minecraft:item_stack","items"),
                ("minecraft:item_predicate","items"),
                ("minecraft:entity_summon","entities"),
                ("minecraft:mob_effect","effects"),
                ("minecraft:item_enchantment","enchantments"),
            ].into_iter().collect();

            if let Some(kind) = kind_map.get(parser) {
                let nbt_pos = value.find('{');
                if nbt_pos >= 0 {
                    if let Err(_) = native_snbt(&value[nbt_pos..]) { return BalancedResult::error(start, "command.unknown.argument"); }
                }
                let id = value.split(|c| c=='[' || c=='{').next().unwrap_or("");
                let tag = id.starts_with('#');
                let name = normalize(if tag { &id[1..] } else { id });
                let registry = self.registry(kind);
                if !regex::Regex::new(r"^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$").unwrap().is_match(if tag { &id[1..] } else { id }) {
                    return BalancedResult::error(start, "command.unknown.argument");
                }
                if tag {
                    // In real impl, check tags
                } else if !registry.is_empty() && !registry.contains(&name) {
                    return BalancedResult::error(start, "command.unknown.argument");
                }
                if kind == &"blocks" && value.contains('[') && !tag {
                    // Block state properties - simplified
                }
                return BalancedResult { value: String::new(), end, error: None };
            }

            // Resource location / dimension / function
            if ["minecraft:resource_location","minecraft:dimension","minecraft:function"].contains(&parser) {
                let id = if value.starts_with('#') { &value[1..] } else { value };
                if !regex::Regex::new(r"^(?:[a-z0-9_.-]+:)?[a-z0-9_./-]+$").unwrap().is_match(id) {
                    return BalancedResult::error(start, "command.unknown.argument");
                }
                return BalancedResult { value: String::new(), end, error: None };
            }

            // Particle
            if parser == "minecraft:particle" {
                let id = normalize(value);
                let particles = self.registry("particles");
                if !particles.is_empty() && !particles.contains(&id) {
                    return BalancedResult::error(start, "particle.notFound");
                }
                let extra: Vec<&str> = if id == "minecraft:dust" {
                    vec!["brigadier:float","brigadier:float","brigadier:float","brigadier:float"]
                } else if ["minecraft:block","minecraft:falling_dust"].contains(&id.as_str()) {
                    vec!["minecraft:block_state"]
                } else if id == "minecraft:item" {
                    vec!["minecraft:item_stack"]
                } else {
                    vec![]
                };
                // In real impl, parse extra arguments
                return BalancedResult { value: String::new(), end, error: None };
            }

            BalancedResult { value: String::new(), end, error: None }
        }
    }

    // ------------------------------------------------------------ public API

    #[wasm_bindgen]
    pub fn parse(&self, text: &str, slash: bool) -> Result<String, JsValue> {
        let start = if slash && text.starts_with('/') { 1 } else { 0 };
        let result = self.visit(self.root, start, vec![], vec![], 0, 0, text);
        let mut result_json = serde_json::to_string(&result).map_err(|e| JsValue::from_str(&e.to_string()))?;
        if !text.ends_with(' ') && result.error.is_none() && !result.edges.is_empty() {
            // Add completion
        }
        Ok(result_json)
    }

    fn visit(&self, id: usize, pos: usize, spans: Vec<Span>, edges: Vec<Edge>, depth: usize, color: usize, text: &str) -> ParseResult {
        if depth > 128 { return ParseResult { cursor: pos, spans, edges, node: id, incomplete: true, error: None, completion: None, has_exceptions: false }; }
        if pos >= text.len() {
            let node = &self.nodes[id];
            return ParseResult { cursor: pos, spans, edges, node: id, incomplete: !node.executable, error: None, completion: Some(Completion { node, start: pos }), has_exceptions: false };
        }

        let node = &self.nodes[id];
        let target = node.redirect.unwrap_or(id);
        let children: Vec<usize> = self.nodes.get(target).map(|n| n.children.clone()).unwrap_or_default();
        let context = Completion { node: target, start: pos };

        // Check literal
        let (word_val, _) = word(text, pos);
        let literal = children.iter().find(|cid| {
            self.nodes.get(*cid).map(|n| n.node_type == 1 && n.name.as_deref() == Some(&word_val)).unwrap_or(false)
        });

        let choices: Vec<usize> = if let Some(lit) = literal {
            vec![*lit]
        } else {
            children.iter().filter(|cid| self.nodes.get(*cid).map(|n| n.node_type == 2).unwrap_or(false)).copied().collect()
        };

        let mut best = ParseResult {
            cursor: pos, spans, edges,
            node: target,
            incomplete: !self.nodes[target].executable,
            error: Some(ParseError { start: pos, key: if target == self.root { "command.unknown.command".into() } else { "command.unknown.argument".into() }, args: vec![] }),
            completion: Some(context),
            has_exceptions: false,
        };

        let mut potentials = Vec::new();
        for child_id in choices {
            let child = &self.nodes[child_id];
            let part = if child.node_type == 1 {
                BalancedResult { value: String::new(), end: pos + child.name.as_deref().unwrap_or("").len(), error: None }
            } else {
                self.argument(child, text, pos)
            };
            if part.error.is_some() {
                if part.error.as_ref().unwrap() != "command.unknown.argument" { best.error = part.error; }
                continue;
            }
            let next_spans = if child.node_type == 2 {
                let mut s = spans.clone();
                s.push(Span { start: pos, end: part.end, color: COLORS[color % COLORS.len()] });
                s
            } else { spans.clone() };
            let next_edges = {
                let mut e = edges.clone();
                e.push(Edge { parent: target, start: pos, end: part.end, node: child_id });
                e
            };
            if part.end < text.len() && text.chars().nth(part.end) != Some(' ') { continue; }
            let remaining = text.len() - part.end;
            if remaining >= (if child.redirect.is_none() { 2 } else { 1 }) {
                potentials.push(self.visit(child_id, part.end + 1, next_spans, next_edges, depth + 1, if child.redirect.is_some() { 0 } else { color + if child.node_type == 2 { 1 } else { 0 } }, text));
            } else {
                let mut candidate = ParseResult { cursor: part.end, spans: next_spans, edges: next_edges, node: child_id, incomplete: !child.executable, has_exceptions: false, error: None, completion: None };
                if remaining > 0 {
                    candidate.error = Some(ParseError { start: part.end, key: "command.unknown.argument".into(), args: vec![] });
                    candidate.completion = Some(Completion { node: child_id, start: part.end + 1 });
                }
                potentials.push(candidate);
            }
        }

        potentials.sort_by(|a, b| {
            let a_end = if a.cursor < text.len() { 1 } else { 0 };
            let b_end = if b.cursor < text.len() { 1 } else { 0 };
            a_end.cmp(&b_end).then_with(|| (a.has_exceptions as i32).cmp(&(b.has_exceptions as i32)))
        });

        potentials.into_iter().next().unwrap_or({ best.has_exceptions = true; best })
    }

    #[wasm_bindgen]
    pub fn format(&self, text: &str, offset: usize, full: &str, slash: bool) -> String {
        if slash && !full.starts_with('/') { return text.to_string(); }
        let parse = self.parse(full, slash).unwrap_or_default();
        let mut events = Vec::new();
        if let Ok(parse) = self.parse(full, slash) {
            for span in parse.spans {
                events.push((span.start, span.color));
                events.push((span.end, 7)); // §7
            }
            if let Some(err) = parse.error {
                events.push((err.start, 12)); // §c
            }
            events.sort_by_key(|e| e.0);
            let mut color = "§7";
            let mut out = String::new();
            let mut pos = offset;
            for (at, next) in events {
                if at <= offset { color = match next { 0 => "§b", 1 => "§e", 2 => "§a", 3 => "§d", 4 => "§6", 5 => "§7", 6 => "§c", _ => "§7" }; continue; }
                if at >= offset + text.len() { break; }
                out.push_str(&format!("{}{}", if out.is_empty() { "" } else { color }, &text[(pos-offset)..(at-offset)]));
                out.push_str(&format!("§{}", match next { 0 => "b", 1 => "e", 2 => "a", 3 => "d", 4 => "6", 5 => "7", 6 => "c", _ => "7" }));
                pos = at;
            }
            // Append remaining text after last event, using the last color
            let remaining_start = pos - offset;
            if remaining_start < text.len() {
                out.push_str(&text[remaining_start..]);
            }
            if out.is_empty() { color.to_string() } else { out }
        } else {
            text.to_string()
        }
    }

    #[wasm_bindgen]
    pub fn suggestions(&self, text: &str, cursor: usize, slash: bool) -> Result<String, JsValue> {
        let prefix = &text[..cursor];
        let parse = self.parse(prefix, slash).unwrap_or_default();
        let context = parse.completion.unwrap_or(Completion { node: parse.node, start: cursor });
        let word = &prefix[context.start..];
        let mut names = Vec::new();
        let mut ask_server = false;

        let node = self.nodes.get(context.node);
        if let Some(node) = node {
            for child_id in &node.children {
                let child = &self.nodes[*child_id];
                if child.node_type == 1 {
                    names.push(child.name.clone().unwrap_or_default());
                    continue;
                }
                if let Some(suggestions) = &child.suggestions {
                    if suggestions == "minecraft:ask_server" { ask_server = true; }
                    else if suggestions == "minecraft:available_sounds" {
                        // Would need game assets
                    } else if suggestions == "minecraft:summonable_entities" {
                        // Would need registry
                    } else {
                        ask_server = true;
                    }
                    continue;
                }
                let parser = child.parser.as_deref().unwrap_or("");
                if parser == "brigadier:bool" { names.push("true"); names.push("false"); }
                if ["minecraft:entity","minecraft:game_profile","minecraft:score_holder"].contains(&parser) {
                    // Would need player list from scoreboard
                }
                if parser == "minecraft:color" { names.extend(COLOR_NAMES.iter().map(|s| s.to_string())); }
                if parser == "minecraft:entity_anchor" { names.push("eyes".into()); names.push("feet".into()); }
                if parser == "minecraft:dimension" { names.push("minecraft:overworld".into()); names.push("minecraft:the_nether".into()); names.push("minecraft:the_end".into()); }
                let kind_map: HashMap<&str, &str> = [
                    ("minecraft:block_state","block_state"),("minecraft:block_predicate","block_predicate"),
                    ("minecraft:item_stack","item_stack"),("minecraft:item_predicate","item_predicate"),
                    ("minecraft:mob_effect","mob_effect"),("minecraft:item_enchantment","item_enchantment"),
                    ("minecraft:entity_summon","entity_summon"),
                ].into_iter().collect();
                if let Some(kind) = kind_map.get(parser) {
                    // Would need registry
                }
                if parser == "minecraft:team" {
                    // Would need scoreboard teams
                }
                if parser == "minecraft:objective" {
                    // Would need scoreboard objectives
                }
                if parser == "minecraft:resource_location" || parser == "minecraft:function" {
                    ask_server = true;
                }
            }
        }
        let filtered: Vec<String> = names.into_iter().filter(|n| {
            let prefix_lower = word.to_lowercase();
            n.to_lowercase().starts_with(&prefix_lower) || n.to_lowercase().contains(&format!("_{}", prefix_lower))
        }).collect();
        filtered.sort_by(|a,b| a.to_lowercase().cmp(&b.to_lowercase()));
        let result = SuggestionResult { start: context.start, end: cursor, matches: filtered.into_iter().map(|m| SuggestionMatch { match_str: m }).collect(), ask_server, parsed: self.visit(context.node, 0, vec![], vec![], 0, 0, "") };
        serde_json::to_string(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    // Helper for block state properties in suggestions
    fn get_block_properties(&self, name: &str) -> Option<Value> {
        self.game_assets.as_ref()?.data.blocks.iter().find(|b| b.name == name).and_then(|b| b.states.clone().map(Value::Array))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn balanced_parsing() {
        assert!(balanced("abc", 0).error.is_none());
        assert!(balanced("\"hello\"", 0).error.is_none());
        assert!(balanced("'hello'", 0).error.is_none());
        assert!(balanced("{test}", 0).error.is_none());
        assert!balanced("[test]", 0).error.is_none());
        assert!balanced("{nested{inner}}", 0).error.is_none());
        assert!(balanced("unclosed{", 0).error.is_some());
        assert!balanced("unclosed[", 0).error.is_some());
    }

    #[test]
    fn normalize_test() {
        assert_eq!(normalize("stone"), "minecraft:stone");
        assert_eq!(normalize("minecraft:stone"), "minecraft:stone");
    }

    #[test]
    fn numeric_test() {
        assert!(numeric("123", true));
        assert!(!numeric("123.456", true));
        assert!(numeric("123.456", false));
        assert!(numeric("-42", false));
    }
}