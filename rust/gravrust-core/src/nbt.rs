//! Port of `client/js/net/nbt.js`.
//!
//! Typed NBT (big-endian, uncompressed) exactly as the JavaScript keeps it:
//! compounds preserve field order, lists keep their element type (even when
//! empty), byte arrays are signed, and longs are 64-bit.
//!
//! The JavaScript call sites still consume typed JS objects, so this is
//! exposed as a round-trip/validator kernel for now: it lets the client move
//! NBT work into WASM without changing every NBT consumer at once.

use wasm_bindgen::prelude::*;

pub const TAG_END: u8 = 0;
pub const TAG_BYTE: u8 = 1;
pub const TAG_SHORT: u8 = 2;
pub const TAG_INT: u8 = 3;
pub const TAG_LONG: u8 = 4;
pub const TAG_FLOAT: u8 = 5;
pub const TAG_DOUBLE: u8 = 6;
pub const TAG_BYTE_ARRAY: u8 = 7;
pub const TAG_STRING: u8 = 8;
pub const TAG_LIST: u8 = 9;
pub const TAG_COMPOUND: u8 = 10;
pub const TAG_INT_ARRAY: u8 = 11;
pub const TAG_LONG_ARRAY: u8 = 12;

const MAX_DEPTH: u32 = 512;
const MAX_ELEMENTS: i32 = 16 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq)]
pub enum Tag {
    Byte(i8),
    Short(i16),
    Int(i32),
    Long(i64),
    Float(f32),
    Double(f64),
    ByteArray(Vec<i8>),
    String(String),
    List {
        element_type: u8,
        items: Vec<Tag>,
    },
    Compound(Vec<(String, Tag)>),
    IntArray(Vec<i32>),
    LongArray(Vec<i64>),
}

impl Tag {
    pub fn type_id(&self) -> u8 {
        match self {
            Tag::Byte(_) => TAG_BYTE,
            Tag::Short(_) => TAG_SHORT,
            Tag::Int(_) => TAG_INT,
            Tag::Long(_) => TAG_LONG,
            Tag::Float(_) => TAG_FLOAT,
            Tag::Double(_) => TAG_DOUBLE,
            Tag::ByteArray(_) => TAG_BYTE_ARRAY,
            Tag::String(_) => TAG_STRING,
            Tag::List { .. } => TAG_LIST,
            Tag::Compound(_) => TAG_COMPOUND,
            Tag::IntArray(_) => TAG_INT_ARRAY,
            Tag::LongArray(_) => TAG_LONG_ARRAY,
        }
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct Root {
    pub name: String,
    pub value: Tag,
}

#[derive(Debug, PartialEq, Eq)]
pub struct NbtError;

struct Reader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn new(data: &'a [u8]) -> Self {
        Reader { data, pos: 0 }
    }

    fn take(&mut self, len: usize) -> Result<&'a [u8], NbtError> {
        let end = self.pos.checked_add(len).ok_or(NbtError)?;
        let slice = self.data.get(self.pos..end).ok_or(NbtError)?;
        self.pos = end;
        Ok(slice)
    }

    fn u8(&mut self) -> Result<u8, NbtError> {
        Ok(self.take(1)?[0])
    }

    fn i8(&mut self) -> Result<i8, NbtError> {
        Ok(self.u8()? as i8)
    }

    fn u16(&mut self) -> Result<u16, NbtError> {
        let b = self.take(2)?;
        Ok(u16::from_be_bytes([b[0], b[1]]))
    }

    fn i16(&mut self) -> Result<i16, NbtError> {
        Ok(self.u16()? as i16)
    }

    fn i32(&mut self) -> Result<i32, NbtError> {
        let b = self.take(4)?;
        Ok(i32::from_be_bytes([b[0], b[1], b[2], b[3]]))
    }

    fn i64(&mut self) -> Result<i64, NbtError> {
        let b = self.take(8)?;
        Ok(i64::from_be_bytes([
            b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7],
        ]))
    }

    fn f32(&mut self) -> Result<f32, NbtError> {
        Ok(f32::from_bits(self.i32()? as u32))
    }

    fn f64(&mut self) -> Result<f64, NbtError> {
        Ok(f64::from_bits(self.i64()? as u64))
    }

    fn utf(&mut self) -> Result<String, NbtError> {
        let len = self.u16()? as usize;
        let bytes = self.take(len)?;
        // Java modified UTF-8 is close enough to UTF-8 for display purposes,
        // matching the TextDecoder behavior of the JavaScript original.
        Ok(crate::utf8::decode(bytes))
    }

    fn payload(&mut self, type_id: u8, depth: u32) -> Result<Tag, NbtError> {
        if depth > MAX_DEPTH {
            return Err(NbtError);
        }
        match type_id {
            TAG_BYTE => Ok(Tag::Byte(self.i8()?)),
            TAG_SHORT => Ok(Tag::Short(self.i16()?)),
            TAG_INT => Ok(Tag::Int(self.i32()?)),
            TAG_LONG => Ok(Tag::Long(self.i64()?)),
            TAG_FLOAT => Ok(Tag::Float(self.f32()?)),
            TAG_DOUBLE => Ok(Tag::Double(self.f64()?)),
            TAG_BYTE_ARRAY => {
                let len = self.length()?;
                let bytes = self.take(len)?;
                Ok(Tag::ByteArray(bytes.iter().map(|b| *b as i8).collect()))
            }
            TAG_STRING => Ok(Tag::String(self.utf()?)),
            TAG_LIST => {
                let element_type = self.u8()?;
                let len = self.length()?;
                let mut items = Vec::with_capacity(len);
                for _ in 0..len {
                    if element_type == TAG_END {
                        return Err(NbtError);
                    }
                    items.push(self.payload(element_type, depth + 1)?);
                }
                Ok(Tag::List {
                    element_type,
                    items,
                })
            }
            TAG_COMPOUND => {
                let mut fields = Vec::new();
                loop {
                    let field_type = self.u8()?;
                    if field_type == TAG_END {
                        break;
                    }
                    let name = self.utf()?;
                    let value = self.payload(field_type, depth + 1)?;
                    fields.push((name, value));
                }
                Ok(Tag::Compound(fields))
            }
            TAG_INT_ARRAY => {
                let len = self.length()?;
                let mut values = Vec::with_capacity(len);
                for _ in 0..len {
                    values.push(self.i32()?);
                }
                Ok(Tag::IntArray(values))
            }
            TAG_LONG_ARRAY => {
                let len = self.length()?;
                let mut values = Vec::with_capacity(len);
                for _ in 0..len {
                    values.push(self.i64()?);
                }
                Ok(Tag::LongArray(values))
            }
            _ => Err(NbtError),
        }
    }

    fn length(&mut self) -> Result<usize, NbtError> {
        let len = self.i32()?;
        if !(0..=MAX_ELEMENTS).contains(&len) {
            return Err(NbtError);
        }
        let len = len as usize;
        // Every element is at least one byte, so this also bounds allocation
        // by the remaining payload size.
        if len > self.data.len() - self.pos {
            return Err(NbtError);
        }
        Ok(len)
    }
}

pub fn read_root(data: &[u8]) -> Result<Option<Root>, NbtError> {
    read_root_consumed(data).map(|(root, _)| root)
}

/// Parse one root and report how many bytes it used, so a containing packet
/// reader can continue after the tag (used by `net/recipes.js` slots).
pub fn read_root_consumed(data: &[u8]) -> Result<(Option<Root>, usize), NbtError> {
    let mut reader = Reader::new(data);
    let type_id = reader.u8()?;
    if type_id == TAG_END {
        return Ok((None, reader.pos));
    }
    let name = reader.utf()?;
    let value = reader.payload(type_id, 0)?;
    Ok((Some(Root { name, value }), reader.pos))
}

fn write_utf(out: &mut Vec<u8>, value: &str) {
    let bytes = value.as_bytes();
    let len = bytes.len().min(u16::MAX as usize);
    out.extend_from_slice(&(len as u16).to_be_bytes());
    out.extend_from_slice(&bytes[..len]);
}

fn write_payload(out: &mut Vec<u8>, tag: &Tag) {
    match tag {
        Tag::Byte(v) => out.push(*v as u8),
        Tag::Short(v) => out.extend_from_slice(&v.to_be_bytes()),
        Tag::Int(v) => out.extend_from_slice(&v.to_be_bytes()),
        Tag::Long(v) => out.extend_from_slice(&v.to_be_bytes()),
        Tag::Float(v) => out.extend_from_slice(&v.to_bits().to_be_bytes()),
        Tag::Double(v) => out.extend_from_slice(&v.to_bits().to_be_bytes()),
        Tag::ByteArray(values) => {
            out.extend_from_slice(&(values.len() as i32).to_be_bytes());
            out.extend(values.iter().map(|v| *v as u8));
        }
        Tag::String(value) => write_utf(out, value),
        Tag::List {
            element_type,
            items,
        } => {
            // The JavaScript writer writes element type 0 for an empty list.
            out.push(if items.is_empty() { 0 } else { *element_type });
            out.extend_from_slice(&(items.len() as i32).to_be_bytes());
            for item in items {
                write_payload(out, item);
            }
        }
        Tag::Compound(fields) => {
            for (name, value) in fields {
                out.push(value.type_id());
                write_utf(out, name);
                write_payload(out, value);
            }
            out.push(TAG_END);
        }
        Tag::IntArray(values) => {
            out.extend_from_slice(&(values.len() as i32).to_be_bytes());
            for value in values {
                out.extend_from_slice(&value.to_be_bytes());
            }
        }
        Tag::LongArray(values) => {
            out.extend_from_slice(&(values.len() as i32).to_be_bytes());
            for value in values {
                out.extend_from_slice(&value.to_be_bytes());
            }
        }
    }
}

pub fn write_root(root: &Root) -> Vec<u8> {
    let mut out = Vec::new();
    out.push(root.value.type_id());
    write_utf(&mut out, &root.name);
    write_payload(&mut out, &root.value);
    out
}

/// Parse and re-encode an NBT root. An empty result means the input was not
/// valid NBT (the JavaScript caller keeps its own parser for error messages).
#[wasm_bindgen]
pub fn nbt_roundtrip(bytes: &[u8]) -> Vec<u8> {
    match read_root(bytes) {
        Ok(Some(root)) => write_root(&root),
        Ok(None) => vec![TAG_END],
        Err(_) => Vec::new(),
    }
}

// -------------------------------------------------------------- simplification

fn json_number(out: &mut String, value: f64) {
    if value.is_finite() {
        // Rust's Display for f64 can print `1` for 1.0 and `1e21` for the
        // same value JavaScript stringifies as 1e+21; JSON.parse accepts both.
        out.push_str(&value.to_string());
    } else {
        // JSON.stringify turns NaN/Infinity into null, and so do we.
        out.push_str("null");
    }
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
            '\u{08}' => out.push_str("\\b"),
            '\u{0c}' => out.push_str("\\f"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

/// `simplify()` from the JavaScript module: compounds become objects, lists
/// become arrays, longs become numbers, everything else keeps its value.
pub fn simplify(tag: &Tag) -> String {
    let mut out = String::new();
    write_simplified(&mut out, tag);
    out
}

fn write_simplified(out: &mut String, tag: &Tag) {
    match tag {
        Tag::Byte(v) => out.push_str(&v.to_string()),
        Tag::Short(v) => out.push_str(&v.to_string()),
        Tag::Int(v) => out.push_str(&v.to_string()),
        Tag::Long(v) => json_number(out, *v as f64),
        Tag::Float(v) => json_number(out, *v as f64),
        Tag::Double(v) => json_number(out, *v),
        Tag::ByteArray(values) => {
            out.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                out.push_str(&value.to_string());
            }
            out.push(']');
        }
        Tag::String(value) => json_string(out, value),
        Tag::List { items, .. } => {
            out.push('[');
            for (index, item) in items.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_simplified(out, item);
            }
            out.push(']');
        }
        Tag::Compound(fields) => {
            out.push('{');
            for (index, (name, value)) in fields.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                json_string(out, name);
                out.push(':');
                write_simplified(out, value);
            }
            out.push('}');
        }
        Tag::IntArray(values) => {
            out.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                out.push_str(&value.to_string());
            }
            out.push(']');
        }
        Tag::LongArray(values) => {
            out.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                json_number(out, *value as f64);
            }
            out.push(']');
        }
    }
}

/// `simplify(readNbtRoot(bytes))` as JSON; `None` when the input is invalid.
#[wasm_bindgen]
pub fn nbt_simplify_json(bytes: &[u8]) -> Option<String> {
    match read_root(bytes) {
        Ok(Some(root)) => Some(simplify(&root.value)),
        _ => None,
    }
}

/// Root tag name, or an empty string when the input is not valid NBT.
#[wasm_bindgen]
pub fn nbt_root_name(bytes: &[u8]) -> String {
    match read_root(bytes) {
        Ok(Some(root)) => root.name,
        _ => String::new(),
    }
}

#[wasm_bindgen]
pub fn nbt_valid(bytes: &[u8]) -> bool {
    matches!(read_root(bytes), Ok(Some(_)))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_root() -> Root {
        Root {
            name: "hello world".to_string(),
            value: Tag::Compound(vec![
                ("byte".to_string(), Tag::Byte(-5)),
                ("short".to_string(), Tag::Short(-1234)),
                ("int".to_string(), Tag::Int(123456)),
                ("long".to_string(), Tag::Long(-9_000_000_000)),
                ("float".to_string(), Tag::Float(1.5)),
                ("double".to_string(), Tag::Double(-2.25)),
                (
                    "bytes".to_string(),
                    Tag::ByteArray(vec![-128, -1, 0, 1, 127]),
                ),
                ("string".to_string(), Tag::String("héllo".to_string())),
                (
                    "list".to_string(),
                    Tag::List {
                        element_type: TAG_INT,
                        items: vec![Tag::Int(1), Tag::Int(2), Tag::Int(3)],
                    },
                ),
                (
                    "empty".to_string(),
                    Tag::List {
                        element_type: TAG_END,
                        items: vec![],
                    },
                ),
                (
                    "ints".to_string(),
                    Tag::IntArray(vec![-1, 0, 1, i32::MAX, i32::MIN]),
                ),
                (
                    "longs".to_string(),
                    Tag::LongArray(vec![i64::MIN, 0, i64::MAX]),
                ),
                (
                    "nested".to_string(),
                    Tag::Compound(vec![
                        ("x".to_string(), Tag::Int(1)),
                        ("y".to_string(), Tag::Int(2)),
                        (
                            "inner".to_string(),
                            Tag::List {
                                element_type: TAG_BYTE,
                                items: vec![Tag::Byte(7), Tag::Byte(8)],
                            },
                        ),
                    ]),
                ),
            ]),
        }
    }

    #[test]
    fn roundtrips_every_tag() {
        let root = sample_root();
        let bytes = write_root(&root);
        let parsed = read_root(&bytes).unwrap().unwrap();
        assert_eq!(parsed, root);
        assert_eq!(write_root(&parsed), bytes);
        assert_eq!(nbt_roundtrip(&bytes), bytes);
        assert_eq!(nbt_root_name(&bytes), "hello world");
    }

    #[test]
    fn roundtrips_flat_roots() {
        for tag in [
            Tag::Byte(1),
            Tag::Short(2),
            Tag::Int(3),
            Tag::Long(4),
            Tag::Float(0.5),
            Tag::Double(0.25),
            Tag::String("root".to_string()),
            Tag::IntArray(vec![1, 2, 3]),
            Tag::LongArray(vec![4, 5, 6]),
        ] {
            let root = Root {
                name: String::new(),
                value: tag,
            };
            let bytes = write_root(&root);
            assert_eq!(read_root(&bytes).unwrap().unwrap(), root);
        }
    }

    #[test]
    fn empty_root_is_tag_end() {
        let bytes = [0u8];
        assert_eq!(read_root(&bytes).unwrap(), None);
        assert_eq!(nbt_roundtrip(&bytes), vec![0u8]);
    }

    #[test]
    fn rejects_truncated_and_unknown_tags() {
        assert!(read_root(&[]).is_err());
        assert!(read_root(&[TAG_COMPOUND]).is_err());
        // Unknown tag type 13 with a name
        assert!(read_root(&[13, 0, 0]).is_err());
        // List of TAG_END with one element
        let mut bytes = vec![TAG_LIST, 0, 0, TAG_END];
        bytes.extend_from_slice(&1i32.to_be_bytes());
        assert!(read_root(&bytes).is_err());
    }

    #[test]
    fn list_element_type_roundtrip() {
        let root = Root {
            name: "list".to_string(),
            value: Tag::List {
                element_type: TAG_STRING,
                items: vec![Tag::String("a".to_string()), Tag::String("b".to_string())],
            },
        };
        let bytes = write_root(&root);
        let parsed = read_root(&bytes).unwrap().unwrap();
        match parsed.value {
            Tag::List {
                element_type,
                items,
            } => {
                assert_eq!(element_type, TAG_STRING);
                assert_eq!(items.len(), 2);
            }
            other => panic!("unexpected {:?}", other),
        }
    }

    #[test]
    fn compound_field_order_is_preserved() {
        let root = Root {
            name: "order".to_string(),
            value: Tag::Compound(vec![
                ("z".to_string(), Tag::Int(1)),
                ("a".to_string(), Tag::Int(2)),
                ("m".to_string(), Tag::Int(3)),
            ]),
        };
        let bytes = write_root(&root);
        let parsed = read_root(&bytes).unwrap().unwrap();
        let names: Vec<String> = match parsed.value {
            Tag::Compound(fields) => fields.into_iter().map(|(name, _)| name).collect(),
            _ => panic!(),
        };
        assert_eq!(names, ["z", "a", "m"]);
    }

    #[test]
    fn simplify_matches_javascript_shapes() {
        let root = sample_root();
        let simplified = simplify(&root.value);
        assert!(simplified.starts_with("{\"byte\":-5,\"short\":-1234"));
        assert!(simplified.contains("\"bytes\":[-128,-1,0,1,127]"));
        assert!(simplified.contains("\"list\":[1,2,3]"));
        assert!(simplified.contains("\"empty\":[]"));
        assert!(simplified.contains("\"nested\":{\"x\":1,\"y\":2"));
        assert_eq!(simplify(&Tag::Float(f32::NAN)), "null");
        assert_eq!(simplify(&Tag::String("a\"b\\c".to_string())), "\"a\\\"b\\\\c\"");
    }

    #[test]
    fn handles_large_byte_array_lengths_safely() {
        let mut bytes = vec![TAG_BYTE_ARRAY, 0, 0];
        bytes.extend_from_slice(&i32::MAX.to_be_bytes());
        assert!(read_root(&bytes).is_err());
    }
}
