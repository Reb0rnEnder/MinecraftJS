//! Port of `client/js/net/snbt.js`: typed SNBT for chat hover payloads.
//!
//! Results use the same `{ t, v }` shape as the JavaScript parser. Numeric
//! longs are emitted as JSON numbers (the JavaScript side exposes them as
//! BigInt, which JSON cannot carry; callers that need exact 64-bit values use
//! the typed NBT path instead).

use wasm_bindgen::prelude::*;

const MAX_LENGTH: usize = 262_144;
const MAX_DEPTH: u32 = 128;

struct Parser {
    chars: Vec<char>,
    index: usize,
}

impl Parser {
    fn new(text: &str) -> Parser {
        Parser {
            chars: text.chars().collect(),
            index: 0,
        }
    }

    fn peek(&self) -> Option<char> {
        self.chars.get(self.index).copied()
    }

    fn next(&mut self) -> Option<char> {
        let value = self.peek()?;
        self.index += 1;
        Some(value)
    }

    fn skip(&mut self) {
        while matches!(self.peek(), Some(c) if c.is_whitespace()) {
            self.index += 1;
        }
    }

    fn quoted(&mut self) -> Option<String> {
        let quote = self.next()?;
        let mut out = String::new();
        loop {
            let c = self.next()?;
            if c == quote {
                return Some(out);
            }
            if c == '\\' {
                let escaped = self.next()?;
                if escaped != quote && escaped != '\\' {
                    return None;
                }
                out.push(escaped);
            } else {
                out.push(c);
            }
        }
    }

    fn token(&mut self) -> Option<String> {
        let start = self.index;
        while let Some(c) = self.peek() {
            if c.is_whitespace() || c == ',' || c == ']' || c == '}' {
                break;
            }
            self.index += 1;
        }
        if self.index == start {
            return None;
        }
        Some(self.chars[start..self.index].iter().collect())
    }

    fn number(&self, text: &str) -> Tag {
        let string = || Tag {
            t: 8,
            v: Value::String(text.to_string()),
        };
        let (numeric, suffix) = match text.chars().last() {
            Some(c) if "bslfdBSLFD".contains(c) && text.len() > 1 => {
                (&text[..text.len() - c.len_utf8()], Some(c.to_ascii_lowercase()))
            }
            _ => (text, None),
        };
        let is_integer_literal = {
            let bytes = numeric.as_bytes();
            let mut start = 0;
            if bytes.first() == Some(&b'+') || bytes.first() == Some(&b'-') {
                start = 1;
            }
            start < bytes.len() && bytes[start..].iter().all(|b| b.is_ascii_digit())
        };
        let Some(value) = numeric.parse::<f64>().ok() else {
            return string();
        };
        if !value.is_finite() {
            return string();
        }
        let kind = match suffix {
            Some('b') => 1,
            Some('s') => 2,
            Some('l') => 4,
            Some('f') => 5,
            Some('d') => 6,
            _ => {
                if is_integer_literal {
                    3
                } else {
                    6
                }
            }
        };
        if matches!(kind, 1 | 2 | 3) && value.fract() != 0.0 {
            return string();
        }
        if kind == 4 {
            // JavaScript `BigInt("...")` only accepts integer literals.
            match numeric.parse::<i64>() {
                Ok(value) => Tag {
                    t: 4,
                    v: Value::Number(value as f64),
                },
                Err(_) => string(),
            }
        } else {
            Tag {
                t: kind,
                v: Value::Number(value),
            }
        }
    }

    fn value(&mut self, depth: u32) -> Option<Tag> {
        if depth > MAX_DEPTH {
            return None;
        }
        self.skip();
        let c = self.peek()?;
        if c == '"' || c == '\'' {
            return Some(Tag {
                t: 8,
                v: Value::String(self.quoted()?),
            });
        }
        if c == '{' {
            self.index += 1;
            self.skip();
            let mut fields = Vec::new();
            while self.peek() != Some('}') {
                self.skip();
                let key = if matches!(self.peek(), Some('"') | Some('\'')) {
                    self.quoted()?
                } else {
                    let start = self.index;
                    while matches!(self.peek(), Some(c) if c.is_alphanumeric() || c == '_' || c == '.' || c == '+' || c == '-')
                    {
                        self.index += 1;
                    }
                    if self.index == start {
                        return None;
                    }
                    self.chars[start..self.index].iter().collect()
                };
                self.skip();
                if self.next()? != ':' {
                    return None;
                }
                let value = self.value(depth + 1)?;
                fields.push((key, value));
                self.skip();
                match self.peek() {
                    Some(',') => {
                        self.index += 1;
                        self.skip();
                    }
                    Some('}') => {}
                    _ => return None,
                }
            }
            self.index += 1;
            return Some(Tag {
                t: 10,
                v: Value::Compound(fields),
            });
        }
        if c == '[' {
            self.index += 1;
            self.skip();
            let mut array = None;
            if matches!(self.peek(), Some('B') | Some('I') | Some('L'))
                && self.chars.get(self.index + 1) == Some(&';')
            {
                array = self.peek();
                self.index += 2;
                self.skip();
            }
            let mut entries = Vec::new();
            while self.peek() != Some(']') {
                // 1.8 NBTTagList.toString prefixes elements with their index.
                let start = self.index;
                while matches!(self.peek(), Some(c) if c.is_ascii_digit()) {
                    self.index += 1;
                }
                if self.index > start && self.peek() == Some(':') {
                    self.index += 1;
                } else {
                    self.index = start;
                }
                entries.push(self.value(depth + 1)?);
                self.skip();
                match self.peek() {
                    Some(',') => {
                        self.index += 1;
                        self.skip();
                    }
                    Some(']') => {}
                    _ => return None,
                }
            }
            self.index += 1;
            let element_type = entries.first().map(|entry| entry.t).unwrap_or(0);
            if entries.iter().any(|entry| entry.t != element_type) {
                return None;
            }
            if let Some(array) = array {
                let (tag_type, expected) = match array {
                    'B' => (7u8, 1u8),
                    'I' => (11, 3),
                    _ => (12, 4),
                };
                if entries.iter().any(|entry| entry.t != expected) {
                    return None;
                }
                return Some(Tag {
                    t: tag_type,
                    v: Value::Array(entries.into_iter().map(|entry| entry.v).collect()),
                });
            }
            return Some(Tag {
                t: 9,
                v: Value::List {
                    element_type,
                    items: entries.into_iter().map(|entry| entry.v).collect(),
                },
            });
        }
        let token = self.token()?;
        if token == "true" || token == "false" {
            return Some(Tag {
                t: 1,
                v: Value::Number(if token == "true" { 1.0 } else { 0.0 }),
            });
        }
        Some(self.number(&token))
    }
}

enum Value {
    Number(f64),
    String(String),
    Compound(Vec<(String, Tag)>),
    List {
        element_type: u8,
        items: Vec<Value>,
    },
    Array(Vec<Value>),
}

struct Tag {
    t: u8,
    v: Value,
}

fn json_string(out: &mut String, value: &str) {
    out.push('"');
    for c in value.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

fn json_number(out: &mut String, value: f64) {
    if value.is_finite() {
        if value.fract() == 0.0 && value.abs() < 1e15 {
            out.push_str(&(value as i64).to_string());
        } else {
            out.push_str(&value.to_string());
        }
    } else {
        out.push_str("null");
    }
}

fn write_value(out: &mut String, value: &Value) {
    match value {
        Value::Number(number) => json_number(out, *number),
        Value::String(text) => json_string(out, text),
        Value::Compound(fields) => {
            out.push('{');
            for (index, (key, tag)) in fields.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                json_string(out, key);
                out.push(':');
                write_tag(out, tag);
            }
            out.push('}');
        }
        Value::List {
            element_type,
            items,
        } => {
            out.push_str(&format!("{{\"et\":{},\"items\":[", element_type));
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_value(out, item);
            }
            out.push_str("]}");
        }
        Value::Array(values) => {
            out.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_value(out, value);
            }
            out.push(']');
        }
    }
}

fn write_tag(out: &mut String, tag: &Tag) {
    out.push_str(&format!("{{\"t\":{},\"v\":", tag.t));
    write_value(out, &tag.v);
    out.push('}');
}

/// Parse SNBT into a `{ t, v }` tree as JSON. `None` for malformed input.
#[wasm_bindgen]
pub fn parse_snbt(text: &str) -> Option<String> {
    if text.chars().count() > MAX_LENGTH {
        return None;
    }
    let mut parser = Parser::new(text);
    let root = parser.value(0)?;
    parser.skip();
    if parser.index != parser.chars.len() {
        return None;
    }
    let mut out = String::new();
    write_tag(&mut out, &root);
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_scalars_and_compounds() {
        let parsed = parse_snbt("{id:\"minecraft:stone\",Count:1b,tag:{display:{Name:\"x\"}}}")
            .expect("snbt");
        assert!(parsed.contains("\"t\":10"));
        assert!(parsed.contains("\"Count\""));
        assert!(parsed.contains("\"t\":1,\"v\":1"));
        assert!(parsed.contains("\"Name\""));
    }

    #[test]
    fn parses_arrays_and_indexed_lists() {
        let parsed = parse_snbt("[B;1b,2b,3b]").expect("byte array");
        assert_eq!(parsed, "{\"t\":7,\"v\":[1,2,3]}");
        let parsed = parse_snbt("[0:\"a\",1:\"b\"]").expect("list");
        assert!(parsed.contains("\"et\":8,\"items\":[\"a\",\"b\"]"));
    }

    #[test]
    fn rejects_malformed_input() {
        assert!(parse_snbt("{").is_none());
        assert!(parse_snbt("[B;1]").is_none());
        assert!(parse_snbt("\"unterminated").is_none());
        assert!(parse_snbt("{} trailing").is_none());
        assert!(parse_snbt("[1,\"a\"]").is_none());
    }
}
