//! Port of `client/js/net/command-tree.js` (Brigadier `DeclareCommands`).
//!
//! The JS module parses the node array and returns plain objects. This port
//! mirrors that shape as JSON so the result can be compared directly with the
//! JavaScript parser and, if desired, `JSON.parse`d by the caller.

use wasm_bindgen::prelude::*;

const SIMPLE: &[&str] = &[
    "brigadier:bool",
    "minecraft:game_profile",
    "minecraft:block_pos",
    "minecraft:column_pos",
    "minecraft:vec3",
    "minecraft:vec2",
    "minecraft:block_state",
    "minecraft:block_predicate",
    "minecraft:item_stack",
    "minecraft:item_predicate",
    "minecraft:color",
    "minecraft:component",
    "minecraft:message",
    "minecraft:nbt",
    "minecraft:nbt_path",
    "minecraft:objective",
    "minecraft:objective_criteria",
    "minecraft:operation",
    "minecraft:particle",
    "minecraft:rotation",
    "minecraft:scoreboard_slot",
    "minecraft:swizzle",
    "minecraft:team",
    "minecraft:item_slot",
    "minecraft:resource_location",
    "minecraft:mob_effect",
    "minecraft:function",
    "minecraft:entity_anchor",
    "minecraft:int_range",
    "minecraft:float_range",
    "minecraft:item_enchantment",
    "minecraft:entity_summon",
    "minecraft:dimension",
    "minecraft:nbt_tag",
    "minecraft:nbt_compound_tag",
    "minecraft:time",
];

#[derive(Debug, Clone, Default)]
struct Properties {
    min: Option<f64>,
    max: Option<f64>,
    mode: Option<i32>,
    flags: Option<u8>,
}

#[derive(Debug, Clone)]
struct Node {
    kind: u8,
    children: Vec<i32>,
    executable: bool,
    redirect: Option<i32>,
    name: Option<String>,
    parser: Option<String>,
    properties: Option<Properties>,
    suggestions: Option<String>,
}

struct Cursor<'a> {
    data: &'a [u8],
    offset: usize,
}

impl<'a> Cursor<'a> {
    fn new(data: &'a [u8]) -> Self {
        Cursor { data, offset: 0 }
    }

    fn take(&mut self, len: usize) -> Option<&'a [u8]> {
        let end = self.offset.checked_add(len)?;
        let slice = self.data.get(self.offset..end)?;
        self.offset = end;
        Some(slice)
    }

    fn u8(&mut self) -> Option<u8> {
        Some(self.take(1)?[0])
    }

    fn i32(&mut self) -> Option<i32> {
        let bytes = self.take(4)?;
        Some(i32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    fn i64(&mut self) -> Option<i64> {
        let bytes = self.take(8)?;
        Some(i64::from_be_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        ]))
    }

    fn f32(&mut self) -> Option<f32> {
        Some(f32::from_bits(self.i32()? as u32))
    }

    fn f64(&mut self) -> Option<f64> {
        Some(f64::from_bits(self.i64()? as u64))
    }

    fn varint(&mut self) -> Option<i32> {
        let mut value: i32 = 0;
        let mut shift = 0;
        loop {
            let byte = self.u8()?;
            value |= ((byte & 0x7f) as i32) << shift;
            shift += 7;
            if shift > 35 {
                return None;
            }
            if byte & 0x80 == 0 {
                return Some(value);
            }
        }
    }

    fn string(&mut self) -> Option<String> {
        let len = self.varint()?;
        if len < 0 {
            return None;
        }
        Some(crate::utf8::decode(self.take(len as usize)?))
    }
}

fn read_properties(cursor: &mut Cursor, parser: &str) -> Option<Properties> {
    let mut properties = Properties::default();
    match parser {
        "brigadier:float" | "brigadier:double" | "brigadier:integer" | "brigadier:long" => {
            let bounds = cursor.u8()?;
            let read = |cursor: &mut Cursor| -> Option<f64> {
                match parser {
                    "brigadier:float" => cursor.f32().map(|value| value as f64),
                    "brigadier:double" => cursor.f64(),
                    "brigadier:long" => cursor.i64().map(|value| value as f64),
                    _ => cursor.i32().map(|value| value as f64),
                }
            };
            if bounds & 1 != 0 {
                properties.min = Some(read(cursor)?);
            }
            if bounds & 2 != 0 {
                properties.max = Some(read(cursor)?);
            }
        }
        "brigadier:string" => properties.mode = Some(cursor.varint()?),
        "minecraft:entity" | "minecraft:score_holder" => properties.flags = Some(cursor.u8()?),
        other if SIMPLE.contains(&other) => {}
        _ => return None,
    }
    Some(properties)
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
        out.push_str(&value.to_string());
    } else {
        out.push_str("null");
    }
}

fn write_node(out: &mut String, node: &Node) {
    out.push_str("{\"type\":");
    out.push_str(&node.kind.to_string());
    out.push_str(",\"children\":[");
    for (index, child) in node.children.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        out.push_str(&child.to_string());
    }
    out.push_str("],\"executable\":");
    out.push_str(if node.executable { "true" } else { "false" });
    if let Some(redirect) = node.redirect {
        out.push_str(",\"redirect\":");
        out.push_str(&redirect.to_string());
    }
    if let Some(name) = &node.name {
        out.push_str(",\"name\":");
        json_string(out, name);
    }
    if let Some(parser) = &node.parser {
        out.push_str(",\"parser\":");
        json_string(out, parser);
    }
    if let Some(properties) = &node.properties {
        out.push_str(",\"properties\":{");
        let mut first = true;
        if let Some(min) = properties.min {
            out.push_str("\"min\":");
            json_number(out, min);
            first = false;
        }
        if let Some(max) = properties.max {
            if !first {
                out.push(',');
            }
            out.push_str("\"max\":");
            json_number(out, max);
            first = false;
        }
        if let Some(mode) = properties.mode {
            if !first {
                out.push(',');
            }
            out.push_str("\"mode\":");
            out.push_str(&mode.to_string());
            first = false;
        }
        if let Some(flags) = properties.flags {
            if !first {
                out.push(',');
            }
            out.push_str("\"flags\":");
            out.push_str(&flags.to_string());
        }
        out.push('}');
    }
    if let Some(suggestions) = &node.suggestions {
        out.push_str(",\"suggestions\":");
        json_string(out, suggestions);
    }
    out.push('}');
}

fn parse(data: &[u8]) -> Option<String> {
    let mut cursor = Cursor::new(data);
    let count = cursor.varint()?;
    if count < 0 || count > 65536 {
        return None;
    }
    let mut nodes = Vec::with_capacity(count as usize);
    for _ in 0..count {
        let flags = cursor.u8()?;
        let kind = flags & 3;
        let child_count = cursor.varint()?;
        if child_count < 0 || child_count > 65536 {
            return None;
        }
        let mut children = Vec::with_capacity(child_count as usize);
        for _ in 0..child_count {
            children.push(cursor.varint()?);
        }
        let mut node = Node {
            kind,
            children,
            executable: flags & 4 != 0,
            redirect: if flags & 8 != 0 {
                Some(cursor.varint()?)
            } else {
                None
            },
            name: None,
            parser: None,
            properties: None,
            suggestions: None,
        };
        if kind == 1 || kind == 2 {
            node.name = Some(cursor.string()?);
        }
        if kind == 2 {
            let parser = cursor.string()?;
            node.properties = Some(read_properties(&mut cursor, &parser)?);
            node.parser = Some(parser);
            if flags & 16 != 0 {
                node.suggestions = Some(cursor.string()?);
            }
        }
        nodes.push(node);
    }
    let root = cursor.varint()?;
    if root < 0 || root as usize >= nodes.len() {
        return None;
    }
    for node in &nodes {
        if node
            .children
            .iter()
            .any(|id| *id < 0 || *id as usize >= nodes.len())
        {
            return None;
        }
        if let Some(redirect) = node.redirect {
            if redirect < 0 || redirect as usize >= nodes.len() {
                return None;
            }
        }
    }

    let mut out = String::from("{\"root\":");
    out.push_str(&root.to_string());
    out.push_str(",\"nodes\":[");
    for (index, node) in nodes.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        write_node(&mut out, node);
    }
    out.push_str("]}");
    Some(out)
}

/// Parse a `DeclareCommands` payload into the same shape as the JS parser.
/// Returns `None` on an unsupported parser, truncation, or a broken reference.
#[wasm_bindgen]
pub fn parse_command_tree(data: &[u8]) -> Option<String> {
    parse(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn varint(out: &mut Vec<u8>, mut value: u32) {
        loop {
            let mut byte = (value & 0x7f) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80;
            }
            out.push(byte);
            if value == 0 {
                break;
            }
        }
    }

    fn string(out: &mut Vec<u8>, value: &str) {
        varint(out, value.len() as u32);
        out.extend_from_slice(value.as_bytes());
    }

    #[test]
    fn parses_literals_arguments_and_bounds() {
        let mut data = Vec::new();
        varint(&mut data, 3);
        // root: type 0, one child (1), executable
        data.extend_from_slice(&[4]);
        varint(&mut data, 1);
        varint(&mut data, 1);
        // literal "say": type 1, one child (2), executable
        data.extend_from_slice(&[5]);
        varint(&mut data, 1);
        varint(&mut data, 2);
        string(&mut data, "say");
        // argument: type 2, no children, name "amount", integer parser with min+max, suggestions
        data.extend_from_slice(&[22]);
        varint(&mut data, 0);
        string(&mut data, "amount");
        string(&mut data, "brigadier:integer");
        data.push(3);
        data.extend_from_slice(&(-5i32).to_be_bytes());
        data.extend_from_slice(&42i32.to_be_bytes());
        string(&mut data, "minecraft:ask_server");
        varint(&mut data, 0);

        let parsed = parse(&data).expect("tree");
        assert!(parsed.contains("\"root\":0"));
        assert!(parsed.contains("\"name\":\"say\""));
        assert!(parsed.contains("\"parser\":\"brigadier:integer\""));
        assert!(parsed.contains("\"min\":-5,\"max\":42"));
        assert!(parsed.contains("\"suggestions\":\"minecraft:ask_server\""));
        assert!(parsed.contains("\"executable\":true"));
    }

    #[test]
    fn rejects_broken_references_and_unknown_parsers() {
        let mut broken = Vec::new();
        varint(&mut broken, 1);
        broken.push(4);
        varint(&mut broken, 1);
        varint(&mut broken, 5);
        varint(&mut broken, 0);
        assert!(parse(&broken).is_none());

        let mut unknown = Vec::new();
        varint(&mut unknown, 1);
        unknown.push(2);
        varint(&mut unknown, 0);
        string(&mut unknown, "x");
        string(&mut unknown, "example:parser");
        varint(&mut unknown, 0);
        assert!(parse(&unknown).is_none());
    }
}
