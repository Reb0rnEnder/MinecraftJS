//! Shared codec helpers for the two protocol codec ports
//! (`protocol_1144.rs` / `protocol_1152.rs`).
//!
//! This file holds exactly the logic the two JavaScript codecs genuinely share:
//!
//! - the length-checked `array()` helper, duplicated verbatim in
//!   `client/js/net/protocol-1.14.4.js` and `protocol-1.15.2.js`
//! - the `encodeVarInt` helper from `protocol-1.15.2.js`, used by the 578
//!   re-prefix/remap paths
//! - the `particleData` registry, identical in `Reader498.particleData` and the
//!   578 `particleData` helper (ids 3/23 blockState, 14 dust, 32 item slot)
//! - the id <-> name reverse maps both codecs build from the pinned id tables
//! - the "trailing data" guard both decoders raise
//! - the single crate-wide `Slot` shape (JS `Reader.slot()`:
//!   `{id, count, damage: 0, nbt, nbtRaw}` or `null`)
//! - the small dynamic `Json` value the decoded packet bodies are built from
//!   (the JS decoders return plain dynamic objects, so the Rust decoders do too)
//!
//! JS sources:
//! - `client/js/net/protocol-1.14.4.js`
//! - `client/js/net/protocol-1.15.2.js`
//! - `client/js/net/buffer.js` (`Reader.slot()`)

use crate::buffer::BufferError;
use crate::nbt::{Root, Tag};
use crate::protocol_1144::Reader498;

// ------------------------------------------------------------ id <-> name maps
// JS builds these with `Object.fromEntries(Object.entries(TABLE).map(([name,id])=>[id,name]))`
// and looks values up with `names[id]` / `TABLE[name]`. The tables are small
// static slices, so linear scans replace the hash maps.

/// JS `names[id]` (id -> name reverse map).
pub fn name_for_id(table: &[(&'static str, i32)], id: i32) -> Option<&'static str> {
    table.iter().find(|(_, value)| *value == id).map(|(name, _)| *name)
}

/// JS `TABLE[name]` (name -> id lookup).
pub fn id_for_name(table: &[(&'static str, i32)], name: &str) -> Option<i32> {
    table.iter().find(|(key, _)| *key == name).map(|(_, value)| *value)
}

// ------------------------------------------------------------ VarInt encoding

/// Encode a signed 32-bit integer as a VarInt.
///
/// JS: `const encodeVarInt=value=>{const out=[];let v=value|0;do{let b=v&0x7f;v>>>=7;if(v)b|=0x80;out.push(b);}while(v);return Uint8Array.from(out);};`
/// (`protocol-1.15.2.js`); the `>>>=` unsigned shift is the `u32` cast here.
pub fn encode_var_int(value: i32) -> Vec<u8> {
    let mut out = Vec::new();
    let mut v = value as u32;
    loop {
        let mut byte = (v & 0x7f) as u8;
        v >>= 7;
        if v != 0 {
            byte |= 0x80;
        }
        out.push(byte);
        if v == 0 {
            break;
        }
    }
    out
}

// ------------------------------------------------------------ shared readers

/// Read a length-checked array of values.
///
/// JS (verbatim in both files): `const array=(r,read)=>{const n=r.varint();if(n<0||n>r.remaining())throw new RangeError('Invalid array length');return Array.from({length:n},()=>read(r));};`
pub fn read_array<T, F>(r: &mut Reader498, mut read: F) -> Result<Vec<T>, BufferError>
where
    F: FnMut(&mut Reader498) -> Result<T, BufferError>,
{
    let n = r.varint()?;
    if n < 0 || n as usize > r.remaining() {
        return Err(BufferError("Invalid array length".to_string()));
    }
    let mut items = Vec::new();
    for _ in 0..n {
        items.push(read(r)?);
    }
    Ok(items)
}

/// The one crate-wide slot shape, mirroring JS `Reader.slot()`:
/// `{ id, count, damage: 0, nbt, nbtRaw }` or `null`.
///
/// `nbt_raw` holds the tag bytes including the leading type byte, exactly like
/// the JS `bytes.slice(start, this.offset)`. `damage` is always `0` in this
/// protocol family but stays part of the JS object shape.
#[derive(Debug, Clone, PartialEq)]
pub struct Slot {
    pub id: i32,
    pub count: i8,
    pub damage: i32,
    /// Parsed NBT root, when the tag byte is non-zero.
    pub nbt: Option<Root>,
    /// Raw tag bytes (tag byte included), when NBT is present.
    pub nbt_raw: Option<Vec<u8>>,
}

impl Slot {
    /// An empty JS `null` slot has no Rust value; this is a present-but-plain
    /// item (`{id, count, damage: 0, nbt: null, nbtRaw: null}`).
    pub fn plain(id: i32, count: i8) -> Slot {
        Slot { id, count, damage: 0, nbt: None, nbt_raw: None }
    }
}

/// Particle parameters (`Reader498.particleData` == 578 `particleData`).
#[derive(Debug, Clone, PartialEq)]
pub enum ParticleData {
    /// ids 3 / 23: `{blockState: r.varint()}`
    BlockState(i32),
    /// id 14: `{red, green, blue, scale}`
    Dust { red: f32, green: f32, blue: f32, scale: f32 },
    /// id 32: `{item: r.slot()}` (null slot allowed, like JS)
    Item(Option<Slot>),
    /// every other id: `{}`
    None,
}

/// JS `Reader.particle()`: `{ particleId, data }`.
#[derive(Debug, Clone, PartialEq)]
pub struct ParticleValue {
    pub particle_id: i32,
    pub data: ParticleData,
}

/// JS: `id===3||id===23?{blockState:r.varint()}:id===14?{red:r.f32(),green:r.f32(),blue:r.f32(),scale:r.f32()}:id===32?{item:r.slot()}:{}`
pub fn read_particle_data(r: &mut Reader498, id: i32) -> Result<ParticleData, BufferError> {
    Ok(match id {
        3 | 23 => ParticleData::BlockState(r.varint()?),
        14 => ParticleData::Dust {
            red: r.f32()?,
            green: r.f32()?,
            blue: r.f32()?,
            scale: r.f32()?,
        },
        32 => ParticleData::Item(r.slot()?),
        _ => ParticleData::None,
    })
}

// ------------------------------------------------------------ shared guard

/// JS (both decoders): `if(r.remaining())throw new Error(\`Trailing data in ${ver} ${name}: ${r.remaining()} bytes\`);`
pub fn check_no_trailing(version: &str, name: &str, remaining: usize) -> Result<(), BufferError> {
    if remaining != 0 {
        return Err(BufferError(format!(
            "Trailing data in {} {}: {} bytes",
            version, name, remaining
        )));
    }
    Ok(())
}

// ------------------------------------------------------------ dynamic JSON value
// The JavaScript decoders return plain dynamic objects, so the Rust decoders
// build the same tree shape. Keys use the JS camelCase names for wire parity.

/// Dynamic decoded-body value (mirrors the plain JS objects the codecs build).
#[derive(Debug, Clone, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    /// JavaScript numbers that are exact integers on the wire (includes the
    /// BigInts `Reader.i64()`/`varlong()` return).
    Int(i64),
    /// JavaScript floating-point values (already divided/scaled like `/4096`).
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    /// Insertion-ordered object (JS object key order is preserved).
    Obj(Vec<(String, Json)>),
}

pub fn jnull() -> Json {
    Json::Null
}

pub fn jbool(value: bool) -> Json {
    Json::Bool(value)
}

pub fn jint(value: i64) -> Json {
    Json::Int(value)
}

pub fn jnum(value: f64) -> Json {
    Json::Num(value)
}

pub fn jstr(value: &str) -> Json {
    Json::Str(value.to_string())
}

pub fn jarr(values: Vec<Json>) -> Json {
    Json::Arr(values)
}

pub fn jobj(pairs: Vec<(&str, Json)>) -> Json {
    Json::Obj(pairs.into_iter().map(|(key, value)| (key.to_string(), value)).collect())
}

/// JS packed position object `{x, y, z}` from the `[x, y, z]` triple.
pub fn position_json(position: &[i32]) -> Json {
    jobj(vec![
        ("x", jint(position[0] as i64)),
        ("y", jint(position[1] as i64)),
        ("z", jint(position[2] as i64)),
    ])
}

/// JS slot object `{id, count, damage, nbt, nbtRaw}`; `null` slots stay null.
pub fn slot_json(slot: &Option<Slot>) -> Json {
    match slot {
        None => jnull(),
        Some(slot) => jobj(vec![
            ("id", jint(slot.id as i64)),
            ("count", jint(slot.count as i64)),
            ("damage", jint(slot.damage as i64)),
            (
                "nbt",
                match &slot.nbt {
                    Some(root) => root_to_json(root),
                    None => jnull(),
                },
            ),
            (
                "nbtRaw",
                match &slot.nbt_raw {
                    Some(raw) => jarr(raw.iter().map(|byte| jint(*byte as i64)).collect()),
                    None => jnull(),
                },
            ),
        ]),
    }
}

/// JS `readNbtRoot(r)` shape: `{ t, name, v }`, compounds map name -> `{t, v}`,
/// lists keep `{et, items}`, byte arrays stay signed.
pub fn root_to_json(root: &Root) -> Json {
    jobj(vec![
        ("t", jint(root.value.type_id() as i64)),
        ("name", jstr(&root.name)),
        ("v", tag_value_to_json(&root.value)),
    ])
}

fn tag_value_to_json(tag: &Tag) -> Json {
    match tag {
        Tag::Byte(value) => jint(*value as i64),
        Tag::Short(value) => jint(*value as i64),
        Tag::Int(value) => jint(*value as i64),
        Tag::Long(value) => jint(*value),
        Tag::Float(value) => jnum(*value as f64),
        Tag::Double(value) => jnum(*value),
        Tag::ByteArray(values) => jarr(values.iter().map(|value| jint(*value as i64)).collect()),
        Tag::String(value) => jstr(value),
        Tag::List { element_type, items } => jobj(vec![
            ("et", jint(*element_type as i64)),
            ("items", jarr(items.iter().map(tag_value_to_json).collect())),
        ]),
        Tag::Compound(fields) => jobj(
            fields
                .iter()
                .map(|(name, value)| {
                    (
                        name.as_str(),
                        jobj(vec![
                            ("t", jint(value.type_id() as i64)),
                            ("v", tag_value_to_json(value)),
                        ]),
                    )
                })
                .collect(),
        ),
        Tag::IntArray(values) => jarr(values.iter().map(|value| jint(*value as i64)).collect()),
        Tag::LongArray(values) => jarr(values.iter().map(|value| jint(*value)).collect()),
    }
}

/// Look a key up in a `Json::Obj` (JS `obj[key]`).
pub fn obj_get<'a>(json: &'a Json, key: &str) -> Option<&'a Json> {
    match json {
        Json::Obj(pairs) => pairs.iter().find(|(name, _)| name == key).map(|(_, value)| value),
        _ => None,
    }
}

/// Serialize the dynamic value as JSON (`JSON.stringify` semantics: NaN and
/// infinities become `null`).
pub fn json_string(json: &Json) -> String {
    let mut out = String::new();
    write_json(json, &mut out);
    out
}

fn write_json(json: &Json, out: &mut String) {
    match json {
        Json::Null => out.push_str("null"),
        Json::Bool(value) => out.push_str(if *value { "true" } else { "false" }),
        Json::Int(value) => out.push_str(&value.to_string()),
        Json::Num(value) => {
            if value.is_finite() {
                out.push_str(&value.to_string());
            } else {
                out.push_str("null");
            }
        }
        Json::Str(value) => write_json_string(value, out),
        Json::Arr(values) => {
            out.push('[');
            for (index, value) in values.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_json(value, out);
            }
            out.push(']');
        }
        Json::Obj(pairs) => {
            out.push('{');
            for (index, (key, value)) in pairs.iter().enumerate() {
                if index > 0 {
                    out.push(',');
                }
                write_json_string(key, out);
                out.push(':');
                write_json(value, out);
            }
            out.push('}');
        }
    }
}

fn write_json_string(value: &str, out: &mut String) {
    out.push('"');
    for character in value.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            control if (control as u32) < 0x20 => {
                out.push_str(&format!("\\u{:04x}", control as u32));
            }
            other => out.push(other),
        }
    }
    out.push('"');
}

#[cfg(test)]
mod tests {
    use super::*;

    fn reader(bytes: &[u8]) -> Reader498 {
        Reader498::new(bytes)
    }

    #[test]
    fn encodes_varint_boundaries_like_javascript() {
        assert_eq!(encode_var_int(0), vec![0x00]);
        assert_eq!(encode_var_int(1), vec![0x01]);
        assert_eq!(encode_var_int(127), vec![0x7f]);
        assert_eq!(encode_var_int(128), vec![0x80, 0x01]);
        assert_eq!(encode_var_int(2097151), vec![0xff, 0xff, 0x7f]);
        // -1 | 0 >>> 0 == 0xffffffff -> five bytes
        assert_eq!(encode_var_int(-1), vec![0xff, 0xff, 0xff, 0xff, 0x0f]);
    }

    #[test]
    fn varint_prefix_round_trips_through_the_reader() {
        for value in [0, 1, 127, 128, 255, 498, 578, i32::MAX, -1, i32::MIN] {
            let encoded = encode_var_int(value);
            assert_eq!(reader(&encoded).varint().unwrap(), value);
        }
    }

    #[test]
    fn reads_arrays_with_the_js_length_check() {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&encode_var_int(3));
        bytes.extend_from_slice(&encode_var_int(10));
        bytes.extend_from_slice(&encode_var_int(20));
        bytes.extend_from_slice(&encode_var_int(30));
        let mut r = reader(&bytes);
        let values = read_array(&mut r, |r| r.varint()).unwrap();
        assert_eq!(values, vec![10, 20, 30]);
        assert_eq!(r.remaining(), 0);
    }

    #[test]
    fn rejects_invalid_array_lengths() {
        // negative length
        let mut r = reader(&[0xff, 0xff, 0xff, 0xff, 0x0f]);
        assert_eq!(
            read_array::<i32, _>(&mut r, |r| r.varint()).unwrap_err().0,
            "Invalid array length"
        );
        // length larger than the remaining byte count
        let mut r = reader(&encode_var_int(5));
        assert_eq!(
            read_array::<i32, _>(&mut r, |r| r.varint()).unwrap_err().0,
            "Invalid array length"
        );
    }

    #[test]
    fn particle_data_matches_the_registry() {
        // id 3 / 23: blockState
        let mut r = reader(&encode_var_int(345));
        assert_eq!(read_particle_data(&mut r, 3).unwrap(), ParticleData::BlockState(345));
        let mut r = reader(&encode_var_int(345));
        assert_eq!(read_particle_data(&mut r, 23).unwrap(), ParticleData::BlockState(345));
        // id 14: dust
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&1.5f32.to_be_bytes());
        bytes.extend_from_slice(&2.0f32.to_be_bytes());
        bytes.extend_from_slice(&2.5f32.to_be_bytes());
        bytes.extend_from_slice(&0.25f32.to_be_bytes());
        let mut r = reader(&bytes);
        assert_eq!(
            read_particle_data(&mut r, 14).unwrap(),
            ParticleData::Dust { red: 1.5, green: 2.0, blue: 2.5, scale: 0.25 }
        );
        // id 32: item slot (empty slot: bool false)
        let mut r = reader(&[0]);
        assert_eq!(read_particle_data(&mut r, 32).unwrap(), ParticleData::Item(None));
        // every other id: {}
        let mut r = reader(&encode_var_int(99));
        assert_eq!(read_particle_data(&mut r, 99).unwrap(), ParticleData::None);
        assert_eq!(r.remaining(), 1); // nothing consumed for unknown ids
    }

    #[test]
    fn id_and_name_lookups_mirror_the_reverse_maps() {
        use crate::protocol_ids::{CLIENTBOUND_578, SERVERBOUND_578};
        assert_eq!(name_for_id(CLIENTBOUND_578, 34), Some("map_chunk"));
        assert_eq!(name_for_id(CLIENTBOUND_578, 999), None);
        assert_eq!(id_for_name(SERVERBOUND_578, "block_place"), Some(44));
        assert_eq!(id_for_name(SERVERBOUND_578, "nope"), None);
    }

    #[test]
    fn trailing_data_guard_uses_the_js_message() {
        assert!(check_no_trailing("498", "chat", 0).is_ok());
        let error = check_no_trailing("498", "chat", 7).unwrap_err().0;
        assert_eq!(error, "Trailing data in 498 chat: 7 bytes");
    }

    #[test]
    fn slot_json_mirrors_the_js_object_shape() {
        let plain = Slot::plain(745, 3);
        let json = slot_json(&Some(plain));
        assert_eq!(obj_get(&json, "id"), Some(&jint(745)));
        assert_eq!(obj_get(&json, "count"), Some(&jint(3)));
        assert_eq!(obj_get(&json, "damage"), Some(&jint(0)));
        assert_eq!(obj_get(&json, "nbt"), Some(&jnull()));
        assert_eq!(obj_get(&json, "nbtRaw"), Some(&jnull()));
        assert_eq!(slot_json(&None), jnull());
    }

    #[test]
    fn root_to_json_uses_the_js_read_nbt_root_shape() {
        // Root compound: {t:10, name:"", v:{motd:{t:8,v:"hi"}}}
        let root = Root {
            name: String::new(),
            value: Tag::Compound(vec![(
                "motd".to_string(),
                Tag::String("hi".to_string()),
            )]),
        };
        let json = root_to_json(&root);
        assert_eq!(obj_get(&json, "t"), Some(&jint(10)));
        let value = obj_get(&json, "v").unwrap();
        let motd = obj_get(value, "motd").unwrap();
        assert_eq!(obj_get(motd, "t"), Some(&jint(8)));
        assert_eq!(obj_get(motd, "v"), Some(&jstr("hi")));
    }

    #[test]
    fn json_string_matches_json_stringify_for_bodies() {
        let body = jobj(vec![
            ("name", jstr("chat")),
            ("id", jint(14)),
            ("message", jstr("hi \"there\"\n")),
            ("ratio", jnum(0.5)),
            ("flags", jarr(vec![jbool(true), jnull()])),
        ]);
        assert_eq!(
            json_string(&body),
            "{\"name\":\"chat\",\"id\":14,\"message\":\"hi \\\"there\\\"\\n\",\"ratio\":0.5,\"flags\":[true,null]}"
        );
    }
}
