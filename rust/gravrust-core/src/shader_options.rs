// Port of `client/js/render/shader-options.js`

//! Shader pack options handling port from JavaScript.
//! Parses, validates, and applies `#define` and `const` shader option directives.

use std::collections::HashMap;
use std::collections::HashSet;
use regex::Regex;

/// Represents a parsed shader option.
///
/// Corresponds to the JS return value of `parseShaderOptions`:
/// - `name`: option name
/// - `values`: optional list of valid values (for range-constrained options)
/// - `default`: the default value
/// - `toggle`: whether this is a boolean toggle (on/off)
/// - `constant`: whether the option is a constant definition
#[derive(Clone, Debug)]
pub struct ShaderOption {
    pub name: String,
    pub values: Option<Vec<String>>,
    pub default: String,
    pub toggle: bool,
    pub constant: bool,
}

/// Port of `client/js/render/shader-options.js` `parseShaderOptions` function.
///
/// Parses shader option directives (`#define` and `const int/float`) from
/// source text. Options with `[val1 val2 val3]` in their comment are
/// range-constrained to those values.
pub fn parse_shader_options(source: &str) -> Vec<ShaderOption> {
    let token = Regex::new(r"^[A-Za-z_]\w*|-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$").unwrap();
    let mut options = Vec::new();
    let mut seen = HashSet::new();

    for line in source.lines() {
        let mut line = line;

        // Remove block comments /* ... */
        if let Some(start) = line.find("/*") {
            if let Some(end) = line[start + 2..].find("*/") {
                line = &line[..start] + &line[start + 2 + end..];
            } else {
                // unterminated block comment, skip rest of file
                break;
            }
        }

        // Line comment that undefines options - stop parsing
        if line.trim().starts_with("// Undefine") {
            break;
        }

        // Remove inline block comments /* ... */
        line = line.replace("/*", "");

        // match const pattern: const type name = value; comment
        let const_re =
            Regex::new(r"^\s*const\s+(?:int|float)\s+(\w+)\s*=\s*([^;]+);\s*(.*)$").unwrap();
        // match #define pattern: //#define NAME value comment or #define NAME value comment
        let define_re = Regex::new(r"^\s*(?://\s*)?#define\s+(\w+)(?:\s+([^/]*?))?$").unwrap();

        let (name, value, comment) = if let Some(c) = const_re.captures(line) {
            let n = c.get(1).unwrap().as_str().to_string();
            let v = c.get(2).unwrap().as_str().trim().to_string();
            let com = c.get(3).map_or("".to_string(), |m| m.as_str().to_string());
            (n, v, com)
        } else if let Some(m) = define_re.captures(line) {
            let n = m.get(1).unwrap().as_str().to_string();
            let v = m
                .get(2)
                .map_or_else(|| "".to_string(), |s| s.as_str().trim().to_string());
            let com = m
                .get(3)
                .map_or_else(|| "".to_string(), |s| s.as_str().trim().to_string());
            (n, v, com)
        } else {
            continue;
        };

        // check for range constraint [val1 val2 val3] in comment
        let range_re = Regex::new(r"\[([^\]]+)\]").unwrap();
        let (values, initial) = if let Some(range) = range_re.captures(&comment) {
            let vals = range[1]
                .trim()
                .split_whitespace()
                .collect::<Vec<&str>>();
            // validate all values match the token pattern and include the selected value
            if vals.iter().all(|v| token.is_match(v)) && vals.contains(&value.trim()) {
                (Some(vals.iter().map(|v| v.to_string()).collect()), value.trim().to_string())
            } else {
                // invalid range, fall back to just the value itself
                let mut opts = Vec::new();
                opts.push(value.trim().to_string());
                (Some(opts), value.trim().to_string())
            }
        } else if !value.is_empty() {
            // has a value, no range constraint
            let mut opts = Vec::new();
            opts.push(value.trim().to_string());
            (Some(opts), value.trim().to_string())
        } else {
            // no value - boolean toggle
            (None, value.trim().to_string())
        };

        if !seen.contains(&name) {
            options.push(ShaderOption {
                name: name.clone(),
                values,
                default: initial.clone(),
                toggle: values.is_none() && initial.trim().is_empty(),
                constant: false,
            });
            seen.insert(name);
        }
    }

    options
}

/// Port of `client/js/render/shader-options.js` `validateShaderOptions` function.
///
/// Validates that option values are valid for each option.
pub fn validate_shader_options(options: &[ShaderOption], values: &HashMap<String, String>) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for (name, value) in values.iter() {
        if let Some(o) = options.iter().find(|o| o.name == *name) {
            if o.values.as_ref().map_or(true, |v| v.contains(value)) {
                out.insert(name.clone(), value.clone());
            }
        }
    }
    out
}

/// Port of `client/js/render/shader-options.js` `applyShaderOptions` function.
///
/// Applies shader option values to source text, replacing `#define` and `const`
/// directives with the selected values.
pub fn apply_shader_options(source: &str, values: &HashMap<String, String>) -> String {
    if values.is_empty() {
        return source.to_string();
    }

    let options = parse_shader_options(source);
    let valid = validate_shader_options(&options, values);

    let mut result = String::new();
    let mut changed = HashSet::new();

    for line in source.lines() {
        let mut new_line = line.to_string();
        let mut modified = false;

        for o in &options {
            if changed.contains(&o.name) || valid.get(&o.name).is_none() {
                continue;
            }

            if o.constant {
                // Replace const int/float NAME = old_value; with the new value
                let name_escaped = o.name.replace("$", r"\$");
                let re = Regex::new(
                    &format!(
                        r"^\s*const\s+(?:int|float)\s+{}\s*=\s*[^;]+(;.*)$",
                        name_escaped
                    ),
                )
                .unwrap();

                if re.is_match(line) {
                    changed.insert(o.name.clone());
                    new_line = re
                        .replace(line, &format!("const {} = {};", &o.name, valid[&o.name]))
                        .to_string();
                    modified = true;
                    break;
                }
            } else {
                // Toggle option: //#define NAME or #define NAME
                // If new value is 'false', prepend // to comment it out
                let name_escaped = o.name.replace("$", r"\$");
                let re = Regex::new(
                    &format!(
                        r"^\s*(?://\s*)?#\s*{}\s*$",
                        name_escaped
                    ),
                )
                .unwrap();

                if re.is_match(line) {
                    changed.insert(o.name.clone());
                    let prefix = if valid[&o.name] == "false" {
                        "//"
                    } else {
                        ""
                    };
                    let defined_line = format!("#define {} {}\n", o.name, valid[&o.name]);
                    new_line = format!("{}{}", prefix, defined_line);
                    modified = true;
                    break;
                }
            }
        }

        if !modified {
            new_line = line.to_string();
        }
        result.push_str(&new_line);
    }

    result
}
