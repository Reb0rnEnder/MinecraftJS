//! Port of `client/js/render/glsl-preprocessor.js`: conditional selection for
//! shader sources. Expressions are tokenised and evaluated as integers; the
//! shader text itself is never evaluated as code.

use std::collections::HashMap;

use wasm_bindgen::prelude::*;

fn tokenize(expression: &str) -> Vec<String> {
    let len = expression.len();
    let bytes = expression.as_bytes();
    let mut tokens = Vec::new();
    let mut i = 0usize;
    while i < len {
        let c = expression[i..].chars().next().unwrap();
        if c.is_whitespace() {
            i += c.len_utf8();
            continue;
        }
        if bytes[i..].starts_with(b"0x") || bytes[i..].starts_with(b"0X") {
            let mut j = i + 2;
            while j < len && bytes[j].is_ascii_hexdigit() {
                j += 1;
            }
            tokens.push(expression[i..j].to_string());
            i = j;
            continue;
        }
        if c.is_ascii_digit() || (c == '.' && bytes.get(i + 1).is_some_and(|b| b.is_ascii_digit())) {
            let mut j = i;
            let mut seen_dot = false;
            while j < len {
                let b = bytes[j];
                if b.is_ascii_digit() {
                    j += 1;
                } else if b == b'.' && !seen_dot {
                    seen_dot = true;
                    j += 1;
                } else {
                    break;
                }
            }
            tokens.push(expression[i..j].to_string());
            i = j;
            continue;
        }
        if c.is_ascii_alphabetic() || c == '_' {
            let mut j = i + c.len_utf8();
            while j < len {
                let next = expression[j..].chars().next().unwrap();
                if next.is_ascii_alphanumeric() || next == '_' {
                    j += next.len_utf8();
                } else {
                    break;
                }
            }
            tokens.push(expression[i..j].to_string());
            i = j;
            continue;
        }
        let two = expression.get(i..i + 2);
        if matches!(two, Some("&&") | Some("||") | Some("==") | Some("!=") | Some("<=") | Some(">=") | Some("<<") | Some(">>")) {
            tokens.push(two.unwrap().to_string());
            i += 2;
            continue;
        }
        tokens.push(c.to_string());
        i += c.len_utf8();
    }
    tokens
}

fn rank(op: &str) -> Option<i32> {
    Some(match op {
        "||" => 1,
        "&&" => 2,
        "|" => 3,
        "^" => 4,
        "&" => 5,
        "==" | "!=" => 6,
        "<" | ">" | "<=" | ">=" => 7,
        "<<" | ">>" => 8,
        "+" | "-" => 9,
        "*" | "/" | "%" => 10,
        _ => return None,
    })
}

fn to_i32(value: f64) -> i32 {
    if value.is_nan() || value.is_infinite() {
        0
    } else {
        value as i64 as i32
    }
}

fn apply(op: &str, a: f64, b: f64) -> f64 {
    match op {
        "||" => {
            if a != 0.0 || b != 0.0 {
                1.0
            } else {
                0.0
            }
        }
        "&&" => {
            if a != 0.0 && b != 0.0 {
                1.0
            } else {
                0.0
            }
        }
        "|" => (to_i32(a) | to_i32(b)) as f64,
        "^" => (to_i32(a) ^ to_i32(b)) as f64,
        "&" => (to_i32(a) & to_i32(b)) as f64,
        "==" => {
            if a == b {
                1.0
            } else {
                0.0
            }
        }
        "!=" => {
            if a != b {
                1.0
            } else {
                0.0
            }
        }
        "<" => {
            if a < b {
                1.0
            } else {
                0.0
            }
        }
        ">" => {
            if a > b {
                1.0
            } else {
                0.0
            }
        }
        "<=" => {
            if a <= b {
                1.0
            } else {
                0.0
            }
        }
        ">=" => {
            if a >= b {
                1.0
            } else {
                0.0
            }
        }
        "<<" => (to_i32(a) << ((to_i32(b) as u32) & 31)) as f64,
        ">>" => (to_i32(a) >> ((to_i32(b) as u32) & 31)) as f64,
        "+" => a + b,
        "-" => a - b,
        "*" => a * b,
        "/" => (a / b).trunc(),
        "%" => a % b,
        _ => 0.0,
    }
}

struct Parser<'a> {
    tokens: Vec<String>,
    at: usize,
    macros: &'a HashMap<String, String>,
    chain: &'a [String],
}

impl<'a> Parser<'a> {
    fn unary(&mut self) -> Result<f64, String> {
        let token = self
            .tokens
            .get(self.at)
            .cloned()
            .ok_or_else(|| "Unsupported shader condition: unexpected end".to_string())?;
        self.at += 1;
        match token.as_str() {
            "!" => {
                let value = self.unary()?;
                Ok(if value == 0.0 { 1.0 } else { 0.0 })
            }
            "~" => {
                let value = self.unary()?;
                Ok(!to_i32(value) as f64)
            }
            "-" => Ok(-self.unary()?),
            "+" => self.unary(),
            "(" => {
                let value = self.parse(0)?;
                if self.tokens.get(self.at).map(|s| s.as_str()) != Some(")") {
                    return Err("Unbalanced shader condition".into());
                }
                self.at += 1;
                Ok(value)
            }
            "defined" => {
                let paren = self.tokens.get(self.at).map(|s| s.as_str()) == Some("(");
                if paren {
                    self.at += 1;
                }
                let name = self
                    .tokens
                    .get(self.at)
                    .cloned()
                    .ok_or_else(|| "Invalid defined()".to_string())?;
                self.at += 1;
                if paren {
                    if self.tokens.get(self.at).map(|s| s.as_str()) != Some(")") {
                        return Err("Invalid defined()".into());
                    }
                    self.at += 1;
                }
                Ok(if self.macros.contains_key(&name) { 1.0 } else { 0.0 })
            }
            _ => {
                if let Some(hex) = token.strip_prefix("0x").or_else(|| token.strip_prefix("0X")) {
                    let value = i64::from_str_radix(hex, 16).unwrap_or(0);
                    return Ok(value as f64);
                }
                if token.chars().next().is_some_and(|c| c.is_ascii_digit() || c == '.') {
                    return token
                        .parse::<f64>()
                        .map_err(|_| format!("Unsupported shader condition token: {}", token));
                }
                let identifier = token
                    .chars()
                    .next()
                    .is_some_and(|c| c.is_ascii_alphabetic() || c == '_');
                if identifier {
                    let Some(value) = self.macros.get(&token) else {
                        return Ok(0.0);
                    };
                    if self.chain.iter().any(|name| name == &token) || self.chain.len() > 32 {
                        return Err(format!("Recursive shader condition macro: {}", token));
                    }
                    let mut chain: Vec<String> = self.chain.to_vec();
                    chain.push(token.clone());
                    let mut nested = Parser {
                        tokens: tokenize(value),
                        at: 0,
                        macros: self.macros,
                        chain: &chain,
                    };
                    let result = nested.parse(0)?;
                    if nested.at != nested.tokens.len() {
                        return Err(format!("Unsupported shader condition: {}", value));
                    }
                    return Ok(result);
                }
                Err(format!("Unsupported shader condition token: {}", token))
            }
        }
    }

    fn parse(&mut self, min: i32) -> Result<f64, String> {
        let mut value = self.unary()?;
        while let Some(op) = self.tokens.get(self.at).cloned() {
            let Some(precedence) = rank(&op) else { break };
            if precedence < min {
                break;
            }
            self.at += 1;
            let next = self.parse(precedence + 1)?;
            value = apply(&op, value, next);
        }
        Ok(value)
    }
}

pub fn glsl_condition(
    expression: &str,
    macros: &HashMap<String, String>,
    chain: &[String],
) -> Result<i64, String> {
    let mut parser = Parser { tokens: tokenize(expression), at: 0, macros, chain };
    let result = parser.parse(0)?;
    if parser.at != parser.tokens.len() {
        return Err(format!("Unsupported shader condition: {}", expression));
    }
    Ok(to_i32(result) as i64)
}

fn strip_comments(source: &str) -> String {
    let mut out = String::with_capacity(source.len());
    let bytes = source.as_bytes();
    let mut i = 0usize;
    while i < bytes.len() {
        if bytes[i..].starts_with(b"/*") {
            let mut j = i + 2;
            while j < bytes.len() && !bytes[j..].starts_with(b"*/") {
                if bytes[j] == b'\n' {
                    out.push('\n');
                } else {
                    out.push(' ');
                }
                j += 1;
            }
            i = (j + 2).min(bytes.len());
            continue;
        }
        if bytes[i..].starts_with(b"//") {
            let mut j = i;
            while j < bytes.len() && bytes[j] != b'\n' {
                out.push(' ');
                j += 1;
            }
            i = j;
            continue;
        }
        let c = source[i..].chars().next().unwrap();
        out.push(c);
        i += c.len_utf8();
    }
    out
}

pub fn active_glsl(source: &str, definitions: &HashMap<String, String>) -> Result<String, String> {
    let mut macros = HashMap::new();
    macros.insert("GL_ES".to_string(), "1".to_string());
    macros.insert("__VERSION__".to_string(), "300".to_string());
    for (key, value) in definitions {
        macros.insert(key.clone(), value.clone());
    }
    let clean = strip_comments(source);
    let originals: Vec<&str> = source.split('\n').collect();
    let cleaned: Vec<&str> = clean.split('\n').collect();
    let mut stack: Vec<(bool, bool)> = Vec::new();
    let mut active = true;
    let mut out: Vec<String> = Vec::new();
    for (index, original) in originals.iter().enumerate() {
        let line = cleaned.get(index).copied().unwrap_or("");
        let trimmed = line.trim_start();
        let Some(rest) = trimmed.strip_prefix('#') else {
            out.push(if active { original.to_string() } else { String::new() });
            continue;
        };
        let rest = rest.trim_start();
        let mut parts = rest.splitn(2, char::is_whitespace);
        let word = parts.next().unwrap_or("");
        let body = parts.next().unwrap_or("").trim();
        match word {
            "if" | "ifdef" | "ifndef" => {
                let yes = active
                    && match word {
                        "if" => glsl_condition(body, &macros, &[])? != 0,
                        "ifdef" => macros.contains_key(body),
                        _ => !macros.contains_key(body),
                    };
                stack.push((active, yes));
                active = yes;
                out.push(String::new());
            }
            "elif" | "else" | "endif" => {
                let Some(top) = stack.last_mut() else {
                    return Err(format!("Unmatched shader #{}", word));
                };
                if word == "endif" {
                    active = top.0;
                    stack.pop();
                } else {
                    let yes = word == "else" || glsl_condition(body, &macros, &[])? != 0;
                    active = top.0 && !top.1 && yes;
                    top.1 |= active;
                }
                out.push(String::new());
            }
            _ => {
                if !active {
                    out.push(String::new());
                    continue;
                }
                if word == "define" {
                    let mut define = body.splitn(2, char::is_whitespace);
                    let name = define.next().unwrap_or("");
                    let rest = define.next().unwrap_or("");
                    if !name.is_empty() {
                        let value = if name.contains('(') { "1" } else { rest.trim() };
                        macros.insert(name.to_string(), value.to_string());
                    }
                } else if word == "undef" {
                    macros.remove(body.trim());
                }
                out.push(original.to_string());
            }
        }
    }
    if !stack.is_empty() {
        return Err("Unclosed shader condition".into());
    }
    Ok(out.join("\n"))
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub fn glsl_condition_wasm(expression: &str, macros_json: &str) -> Result<i32, JsValue> {
    let macros: HashMap<String, String> = serde_json::from_str(macros_json).unwrap_or_default();
    glsl_condition(expression, &macros, &[])
        .map(|value| value as i32)
        .map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn active_glsl_wasm(source: &str, definitions_json: &str) -> Result<String, JsValue> {
    let definitions: HashMap<String, String> =
        serde_json::from_str(definitions_json).unwrap_or_default();
    active_glsl(source, &definitions).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn macros() -> HashMap<String, String> {
        let mut map = HashMap::new();
        map.insert("A".to_string(), "2".to_string());
        map.insert("B".to_string(), "A * 3".to_string());
        map
    }

    #[test]
    fn evaluates_arithmetic_and_comparisons() {
        let map = macros();
        assert_eq!(glsl_condition("1 + 2 * 3", &map, &[]).unwrap(), 7);
        assert_eq!(glsl_condition("B >= 4", &map, &[]).unwrap(), 1);
        assert_eq!(glsl_condition("0 || 0", &map, &[]).unwrap(), 0);
        assert_eq!(glsl_condition("!defined(A)", &map, &[]).unwrap(), 0);
        assert_eq!(glsl_condition("defined(ZZZ)", &map, &[]).unwrap(), 0);
        assert_eq!(glsl_condition("8 >> 2", &map, &[]).unwrap(), 2);
        assert_eq!(glsl_condition("0x10", &map, &[]).unwrap(), 16);
    }

    #[test]
    fn rejects_recursive_and_unbalanced_conditions() {
        let mut map = HashMap::new();
        map.insert("A".to_string(), "B".to_string());
        map.insert("B".to_string(), "A".to_string());
        assert!(glsl_condition("A", &map, &[]).is_err());
        assert!(glsl_condition("(1 + 2", &map, &[]).is_err());
        assert!(glsl_condition("1 2", &map, &[]).is_err());
    }

    #[test]
    fn selects_active_shader_lines() {
        let source = "#define WITH_NORMAL 1\n#ifdef WITH_NORMAL\nfloat normal = 1.0;\n#else\nfloat normal = 0.0;\n#endif\n// tail\n";
        let out = active_glsl(source, &HashMap::new()).unwrap();
        assert!(out.contains("float normal = 1.0;"));
        assert!(!out.contains("float normal = 0.0;"));
        assert!(out.contains("#define WITH_NORMAL 1"));
    }

    #[test]
    fn reports_unclosed_conditions() {
        assert!(active_glsl("#if 1\nfloat x;\n", &HashMap::new()).is_err());
    }
}
