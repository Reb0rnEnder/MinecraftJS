//! Port of `client/js/render/glsl-functions.js`: the GLSL function selector,
//! the `block.properties` rule parser, its animation lookup table and the
//! desktop-to-ES float literal bridge.
//!
//! GLSL itself is compiled by the GPU. This module only decides which source
//! fragments are emitted, using a token scanner rather than evaluating any
//! shader text as code.

use std::collections::HashMap;

use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

#[derive(Clone, Debug)]
struct Token {
    text: String,
    start: usize,
    end: usize,
}

fn is_ident_start(c: char) -> bool {
    c.is_ascii_alphabetic() || c == '_'
}

fn is_ident_char(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '_'
}

fn is_identifier(text: &str) -> bool {
    let mut chars = text.chars();
    match chars.next() {
        Some(c) if is_ident_start(c) => chars.all(is_ident_char),
        _ => false,
    }
}

fn tokenize(source: &str) -> Vec<Token> {
    let len = source.len();
    let bytes = source.as_bytes();
    let mut tokens = Vec::new();
    let mut i = 0usize;
    while i < len {
        let line_start = i == 0 || bytes[i - 1] == b'\n';
        if line_start {
            let mut j = i;
            while j < len && (bytes[j] == b' ' || bytes[j] == b'\t') {
                j += 1;
            }
            if j < len && bytes[j] == b'#' {
                while j < len && bytes[j] != b'\n' {
                    j += 1;
                }
                i = j;
                continue;
            }
        }
        if source[i..].starts_with("/*") {
            i = match source[i + 2..].find("*/") {
                Some(k) => i + 2 + k + 2,
                None => len,
            };
            continue;
        }
        if source[i..].starts_with("//") {
            i = match source[i..].find('\n') {
                Some(k) => i + k,
                None => len,
            };
            continue;
        }
        let c = source[i..].chars().next().unwrap();
        if c.is_whitespace() {
            i += c.len_utf8();
            continue;
        }
        if is_ident_start(c) {
            let mut j = i + c.len_utf8();
            while j < len {
                let next = source[j..].chars().next().unwrap();
                if is_ident_char(next) {
                    j += next.len_utf8();
                } else {
                    break;
                }
            }
            tokens.push(Token { text: source[i..j].to_string(), start: i, end: j });
            i = j;
            continue;
        }
        let j = i + c.len_utf8();
        tokens.push(Token { text: c.to_string(), start: i, end: j });
        i = j;
    }
    tokens
}

fn match_at(tokens: &[Token], at: usize, open: &str, close: &str) -> Result<usize, String> {
    let mut depth = 0i32;
    for (index, token) in tokens.iter().enumerate().skip(at) {
        if token.text == open {
            depth += 1;
        }
        if token.text == close {
            depth -= 1;
            if depth == 0 {
                return Ok(index);
            }
        }
    }
    Err(format!("Unbalanced GLSL {}", open))
}

fn words(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    for c in text.chars() {
        if is_ident_char(c) {
            current.push(c);
        } else if !current.is_empty() {
            out.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        out.push(current);
    }
    out
}

pub fn select_glsl_functions(source: &str, root: &str) -> Result<String, String> {
    let tokens = tokenize(source);
    let mut functions: HashMap<String, (usize, usize, String)> = HashMap::new();
    let mut constants: HashMap<String, (usize, usize, String)> = HashMap::new();
    let mut depth = 0i32;
    let mut i = 0usize;
    while i < tokens.len() {
        let text = tokens[i].text.clone();
        if depth == 0 && text == "const" {
            let mut j = i;
            while j < tokens.len() && tokens[j].text != ";" {
                j += 1;
            }
            if j == tokens.len() {
                return Err("Unterminated GLSL constant".into());
            }
            if let Some(name) = tokens.get(i + 2).map(|t| t.text.clone()) {
                let start = tokens[i].start;
                let end = tokens[j].end;
                constants.insert(name, (start, end, source[start..end].to_string()));
            }
            i = j + 1;
            continue;
        }
        if depth == 0 && text == "(" && i >= 2 && is_identifier(&tokens[i - 1].text) {
            let end_params = match_at(&tokens, i, "(", ")")?;
            if tokens.get(end_params + 1).map(|t| t.text.as_str()) == Some("{") {
                let end = match_at(&tokens, end_params + 1, "{", "}")?;
                let name = tokens[i - 1].text.clone();
                if functions.contains_key(&name) {
                    return Err(format!(
                        "GLSL function overloads are not supported by the selector: {}",
                        name
                    ));
                }
                let start = tokens[i - 2].start;
                let end_pos = tokens[end].end;
                functions.insert(name, (start, end_pos, source[start..end_pos].to_string()));
                i = end + 1;
                continue;
            }
        }
        if text == "{" {
            depth += 1;
        }
        if text == "}" {
            depth -= 1;
        }
        i += 1;
    }
    if !functions.contains_key(root) {
        return Err(format!("Missing GLSL entry function: {}", root));
    }

    let mut selected: HashMap<String, (usize, usize, String)> = HashMap::new();
    let mut order: Vec<String> = Vec::new();
    visit_glsl(
        root,
        &functions,
        &constants,
        &mut selected,
        &mut order,
    );
    let mut items: Vec<(usize, String)> = selected
        .values()
        .map(|(start, _, text)| (*start, text.clone()))
        .collect();
    items.sort_by_key(|(start, _)| *start);
    let source_out = items
        .into_iter()
        .map(|(_, text)| text)
        .collect::<Vec<_>>()
        .join("\n");
    let functions_out: Vec<String> = order
        .into_iter()
        .filter(|name| functions.contains_key(name))
        .collect();
    Ok(json!({ "source": source_out, "functions": functions_out }).to_string())
}

fn visit_glsl(
    name: &str,
    functions: &HashMap<String, (usize, usize, String)>,
    constants: &HashMap<String, (usize, usize, String)>,
    selected: &mut HashMap<String, (usize, usize, String)>,
    order: &mut Vec<String>,
) {
    if selected.contains_key(name) {
        return;
    }
    let item = functions.get(name).or_else(|| constants.get(name));
    let Some((start, end, text)) = item else { return };
    selected.insert(name.to_string(), (*start, *end, text.clone()));
    order.push(name.to_string());
    for word in words(text) {
        if word != name {
            visit_glsl(&word, functions, constants, selected, order);
        }
    }
}

// ------------------------------------------------------------- block rules

#[derive(Clone, Debug, PartialEq)]
pub struct BlockRule {
    pub id: u32,
    pub name: String,
    pub properties: Vec<(String, Vec<String>)>,
}

fn version_condition(expression: &str, version: i64) -> Result<bool, String> {
    let text = expression.trim();
    let rest = text
        .strip_prefix("MC_VERSION")
        .ok_or_else(|| format!("Unsupported block.properties condition: {}", text))?
        .trim_start();
    let (op, tail) = if let Some(r) = rest.strip_prefix(">=") {
        (">=", r)
    } else if let Some(r) = rest.strip_prefix("<=") {
        ("<=", r)
    } else if let Some(r) = rest.strip_prefix("==") {
        ("==", r)
    } else if let Some(r) = rest.strip_prefix('>') {
        (">", r)
    } else if let Some(r) = rest.strip_prefix('<') {
        ("<", r)
    } else {
        return Err(format!("Unsupported block.properties condition: {}", text));
    };
    let value: i64 = tail
        .trim()
        .parse()
        .map_err(|_| format!("Unsupported block.properties condition: {}", text))?;
    Ok(match op {
        ">=" => version >= value,
        "<=" => version <= value,
        "==" => version == value,
        ">" => version > value,
        _ => version < value,
    })
}

pub fn shader_block_rules(source: &str, version: i64) -> Result<Vec<BlockRule>, String> {
    let joined = source.replace("\\\r\n", " ").replace("\\\n", " ");
    let mut stack: Vec<(bool, bool)> = Vec::new();
    let mut active = true;
    let mut rules = Vec::new();
    for raw in joined.split('\n') {
        let line = raw.strip_suffix('\r').unwrap_or(raw);
        let trimmed = line.trim_start();
        if let Some(rest) = trimmed.strip_prefix('#') {
            let rest = rest.trim_start();
            let mut parts = rest.splitn(2, char::is_whitespace);
            let word = parts.next().unwrap_or("");
            let expression = parts.next().unwrap_or("").trim();
            match word {
                "if" => {
                    let yes = version_condition(expression, version)?;
                    stack.push((active, yes));
                    active = active && yes;
                }
                "elif" | "else" | "endif" => {
                    let Some(top) = stack.last_mut() else {
                        return Err(format!("Unmatched block.properties {}", word));
                    };
                    if word == "endif" {
                        active = top.0;
                        stack.pop();
                    } else {
                        let yes = word == "else" || version_condition(expression, version)?;
                        active = top.0 && !top.1 && yes;
                        top.1 |= yes;
                    }
                }
                _ => {}
            }
            continue;
        }
        if !active {
            continue;
        }
        let Some(rest) = line.trim_start().strip_prefix("block.") else {
            continue;
        };
        let mut split = rest.splitn(2, '=');
        let id_text = split.next().unwrap_or("").trim();
        let Some(selectors) = split.next() else { continue };
        let Ok(id) = id_text.parse::<u32>() else { continue };
        if id > 65535 {
            return Err("Block animation ID exceeds packed lookup range".into());
        }
        for selector in selectors.split_whitespace() {
            let parts: Vec<&str> = selector.split(':').collect();
            if parts.len() > 1 && !parts[1].contains('=') && parts[0] != "minecraft" {
                continue;
            }
            let (name, start) = if parts[0] == "minecraft" {
                (parts.get(1).copied().unwrap_or("").to_string(), 2usize)
            } else {
                (parts[0].to_string(), 1usize)
            };
            let mut properties = Vec::new();
            for part in parts.iter().skip(start) {
                // `const [key, value] = p.split('=')` takes only the first two
                // segments; a third `=` is discarded, exactly as in the JS.
                let mut kv = part.split('=');
                let key = kv.next().unwrap_or("");
                let Some(value) = kv.next() else {
                    return Err(format!("Unsupported block selector: {}", selector));
                };
                if key.is_empty() || value.is_empty() {
                    return Err(format!("Unsupported block selector: {}", selector));
                }
                properties.push((
                    key.to_string(),
                    value.split(',').map(|v| v.to_string()).collect(),
                ));
            }
            rules.push(BlockRule { id, name, properties });
        }
    }
    if !stack.is_empty() {
        return Err("Unclosed block.properties conditional".into());
    }
    Ok(rules)
}

#[derive(Clone, Debug)]
pub struct StateRef {
    pub id: u32,
    pub name: String,
    pub properties: Vec<(String, String)>,
}

/// Returns `(width, height, rgba)` matching `animationLookup`.
pub fn animation_lookup(rules: &[BlockRule], states: &[StateRef]) -> (usize, usize, Vec<u8>) {
    let height = (states.len() + 255) / 256;
    let mut data = vec![0u8; 256 * height * 4];
    for state in states {
        let mut id = 0u32;
        for rule in rules {
            if rule.name != state.name {
                continue;
            }
            let ok = rule.properties.iter().all(|(key, values)| {
                let actual = state
                    .properties
                    .iter()
                    .find(|(k, _)| k == key)
                    .map(|(_, v)| v.clone())
                    .unwrap_or_default();
                values.contains(&actual)
            });
            if ok {
                id = rule.id;
            }
        }
        let base = state.id as usize * 4;
        if base + 3 < data.len() {
            data[base] = (id & 255) as u8;
            data[base + 1] = (id >> 8) as u8;
            data[base + 3] = 255;
        }
    }
    (256, height, data)
}

// ------------------------------------------------------------ float bridge

pub fn glsl_float_literals(source: &str) -> String {
    let names: Vec<String> = {
        let mut seen: Vec<String> = Vec::new();
        let tokens = tokenize(&source.replace('\n', " "));
        let mut i = 0usize;
        while i + 1 < tokens.len() {
            let text = tokens[i].text.as_str();
            if matches!(text, "float" | "vec2" | "vec3" | "vec4" | "mat2" | "mat3" | "mat4")
                && is_identifier(&tokens[i + 1].text)
                && !seen.contains(&tokens[i + 1].text)
            {
                seen.push(tokens[i + 1].text.clone());
            }
            i += 1;
        }
        seen
    };
    if names.is_empty() {
        return source.to_string();
    }
    let in_names = |word: &str| names.iter().any(|n| n == word);
    let op_at = |s: &str, i: usize| -> Option<char> {
        s[i..].chars().next().filter(|c| matches!(c, '*' | '/' | '+' | '-'))
    };
    let ident_end = |s: &str, from: usize| -> usize {
        let mut j = from;
        while j < s.len() {
            let c = s[j..].chars().next().unwrap();
            if is_ident_char(c) {
                j += c.len_utf8();
            } else {
                break;
            }
        }
        j
    };
    let mut out = String::with_capacity(source.len() + 16);
    let mut i = 0usize;
    while i < source.len() {
        let prev_ok = i == 0
            || {
                let prev = source[..i].chars().next_back().unwrap();
                !(is_ident_char(prev) || prev == '.')
            };
        // number op name
        if prev_ok {
            let mut j = i;
            while j < source.len() && source.as_bytes()[j].is_ascii_digit() {
                j += 1;
            }
            if j > i {
                let number_end = j;
                while j < source.len() && source.as_bytes()[j] == b' ' {
                    j += 1;
                }
                if let Some(op) = op_at(source, j) {
                    j += 1;
                    while j < source.len() && source.as_bytes()[j] == b' ' {
                        j += 1;
                    }
                    let start = j;
                    j = ident_end(source, j);
                    if j > start && in_names(&source[start..j]) {
                        out.push_str(&source[i..number_end]);
                        out.push_str(".0 ");
                        out.push(op);
                        out.push(' ');
                        out.push_str(&source[start..j]);
                        i = j;
                        continue;
                    }
                }
            }
        }
        // name op number
        if prev_ok {
            let start = i;
            let j = ident_end(source, i);
            if j > start && in_names(&source[start..j]) {
                let mut k = j;
                while k < source.len() && source.as_bytes()[k] == b' ' {
                    k += 1;
                }
                if let Some(op) = op_at(source, k) {
                    k += 1;
                    while k < source.len() && source.as_bytes()[k] == b' ' {
                        k += 1;
                    }
                    let num_start = k;
                    while k < source.len() && source.as_bytes()[k].is_ascii_digit() {
                        k += 1;
                    }
                    if k > num_start {
                        let next = source[k..].chars().next();
                        let blocked = matches!(next, Some(c) if c == '.' || is_ident_char(c));
                        if !blocked {
                            out.push_str(&source[start..j]);
                            out.push(' ');
                            out.push(op);
                            out.push(' ');
                            out.push_str(&source[num_start..k]);
                            out.push_str(".0");
                            i = k;
                            continue;
                        }
                    }
                }
            }
        }
        let c = source[i..].chars().next().unwrap();
        out.push(c);
        i += c.len_utf8();
    }
    out
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub fn select_glsl_functions_wasm(source: &str, root: &str) -> Result<String, JsValue> {
    select_glsl_functions(source, root).map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn shader_block_rules_wasm(source: &str, version: i32) -> Result<String, JsValue> {
    let rules = shader_block_rules(source, version as i64).map_err(|e| JsValue::from_str(&e))?;
    let list: Vec<Value> = rules
        .iter()
        .map(|rule| {
            let mut properties = serde_json::Map::new();
            for (key, values) in &rule.properties {
                properties.insert(key.clone(), json!(values));
            }
            json!({ "id": rule.id, "name": rule.name, "properties": properties })
        })
        .collect();
    Ok(Value::Array(list).to_string())
}

#[wasm_bindgen]
pub fn animation_lookup_wasm(rules_json: &str, states_json: &str) -> String {
    let rules: Vec<BlockRule> = parse_rules(rules_json);
    let states: Vec<StateRef> = parse_states(states_json);
    let (width, height, data) = animation_lookup(&rules, &states);
    json!({ "width": width, "height": height, "data": data }).to_string()
}

fn parse_rules(json_text: &str) -> Vec<BlockRule> {
    let value: Value = serde_json::from_str(json_text).unwrap_or(Value::Null);
    let mut rules = Vec::new();
    if let Some(list) = value.as_array() {
        for entry in list {
            let id = entry["id"].as_u64().unwrap_or(0) as u32;
            let name = entry["name"].as_str().unwrap_or("").to_string();
            let mut properties = Vec::new();
            if let Some(map) = entry["properties"].as_object() {
                for (key, values) in map {
                    let list = values
                        .as_array()
                        .map(|v| v.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
                        .unwrap_or_default();
                    properties.push((key.clone(), list));
                }
            }
            rules.push(BlockRule { id, name, properties });
        }
    }
    rules
}

fn parse_states(json_text: &str) -> Vec<StateRef> {
    let value: Value = serde_json::from_str(json_text).unwrap_or(Value::Null);
    let mut states = Vec::new();
    if let Some(list) = value.as_array() {
        for entry in list {
            let id = entry["id"].as_u64().unwrap_or(0) as u32;
            let name = entry["name"].as_str().unwrap_or("").to_string();
            let mut properties = Vec::new();
            if let Some(map) = entry["properties"].as_object() {
                for (key, value) in map {
                    properties.push((key.clone(), value.as_str().unwrap_or("").to_string()));
                }
            }
            states.push(StateRef { id, name, properties });
        }
    }
    states
}

#[wasm_bindgen]
pub fn glsl_float_literals_wasm(source: &str) -> String {
    glsl_float_literals(source)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selects_root_and_dependencies_in_source_order() {
        let source = r#"
const float PI = 3.14159;
float helper(float x) { return x * PI; }
float unused(float x) { return x; }
float root(float x) {
  return helper(x) + 1.0;
}
"#;
        let json_text = select_glsl_functions(source, "root").unwrap();
        let value: Value = serde_json::from_str(&json_text).unwrap();
        let out = value["source"].as_str().unwrap();
        assert!(out.contains("const float PI"));
        assert!(out.contains("float helper"));
        assert!(out.contains("float root"));
        assert!(!out.contains("float unused"));
        let functions: Vec<String> = value["functions"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_str().unwrap().to_string())
            .collect();
        assert_eq!(functions, vec!["root", "helper"]);
    }

    #[test]
    fn rejects_missing_entry_points_and_overloads() {
        let err = select_glsl_functions("float a() { return 1.0; }", "b").unwrap_err();
        assert!(err.contains("Missing GLSL entry function"));
        let err = select_glsl_functions(
            "float a() { return 1.0; } float a(float x) { return x; }",
            "a",
        )
        .unwrap_err();
        assert!(err.contains("overloads"));
    }

    #[test]
    fn parses_block_properties_conditionals() {
        let source = "MC_VERSION >= 1\nblock.100 = minecraft:stone\n#if MC_VERSION >= 2\nblock.101 = water:level=0 lava\n#else\nblock.102 = dirt\n#endif\n";
        let rules = shader_block_rules(source, 2).unwrap();
        // block.100, plus the two selectors of block.101 ("water:level=0" and
        // "lava"); the `#else` branch is inactive at MC_VERSION 2.
        assert_eq!(rules.len(), 3);
        assert_eq!(rules[0].id, 100);
        assert_eq!(rules[0].name, "stone");
        assert_eq!(rules[1].id, 101);
        assert_eq!(rules[1].name, "water");
        assert_eq!(rules[1].properties[0], ("level".into(), vec!["0".into()]));
        assert_eq!(rules[2].name, "lava");
        assert!(rules[2].properties.is_empty());
        // At version 1 the `#if` is false, so the `#else` branch runs instead.
        let old = shader_block_rules(source, 1).unwrap();
        assert_eq!(old.len(), 2);
        assert_eq!(old[1].id, 102);
        assert_eq!(old[1].name, "dirt");
    }

    #[test]
    fn animation_lookup_takes_the_last_matching_rule() {
        let rules = vec![
            BlockRule { id: 1, name: "stone".into(), properties: vec![] },
            BlockRule {
                id: 7,
                name: "water".into(),
                properties: vec![("level".into(), vec!["0".into()])],
            },
        ];
        let states = vec![
            StateRef { id: 0, name: "stone".into(), properties: vec![] },
            StateRef {
                id: 1,
                name: "water".into(),
                properties: vec![("level".into(), "0".into())],
            },
            StateRef {
                id: 2,
                name: "water".into(),
                properties: vec![("level".into(), "3".into())],
            },
        ];
        let (width, height, data) = animation_lookup(&rules, &states);
        assert_eq!((width, height), (256, 1));
        assert_eq!(data[0], 1);
        assert_eq!(data[4], 7);
        assert_eq!(data[8], 0);
        assert_eq!(data[3], 255);
    }

    #[test]
    fn float_literals_add_a_fraction_to_int_operands() {
        // Names only bridge when they are declared as a float/vec/mat symbol;
        // an undeclared identifier leaves the source untouched, as in the JS.
        assert_eq!(glsl_float_literals("x = 2 * tint;"), "x = 2 * tint;");
        assert_eq!(
            glsl_float_literals("float tint;\nx = 2 * tint;"),
            "float tint;\nx = 2.0 * tint;"
        );
        assert_eq!(
            glsl_float_literals("float tint;\nx = tint / 2;"),
            "float tint;\nx = tint / 2.0;"
        );
        assert_eq!(glsl_float_literals("float tint;\nx = 2;"), "float tint;\nx = 2;");
        assert_eq!(
            glsl_float_literals("float tint;\nx = 2.5 * tint;"),
            "float tint;\nx = 2.5 * tint;"
        );
    }
}
