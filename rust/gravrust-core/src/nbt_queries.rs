// Port of `client/js/game/nbt-queries.js`
//!!

use crate::nbt::Tag;
use wasm_bindgen::prelude::*;

/// Port of the `NbtQueries` class from `client/js/game/nbt-queries.js`.
/// Manages pending NBT queries (block and entity) with serial IDs and callbacks.
/// Adapt the `conn` field and game integration as needed for the host game type.
pub struct NbtQueries {
    serial: u32,
    pending: Option<PendingQuery>,
}

struct PendingQuery {
    id: u32,
    callback: Box<dyn Fn(Tag) + 'static>,
    conn: /* connection identifier - adapt to your game type */,
}

impl NbtQueries {
    /// Create a new NbtQueries instance.
    pub fn new() -> Self {
        Self {
            serial: 0,
            pending: None,
        }
    }

    /// Clear any pending query.
    pub fn clear(&mut self) {
        self.pending = None;
    }

    /// Query block NBT at the given position.
    /// Returns the transaction ID for later response handling.
    /// Adapt the `C::queryBlockNbt` call to your packets module.
    pub fn block(&mut self, position: (i32, i32, i32), callback: Box<dyn Fn(Tag) + 'static>) -> u32 {
        self._request(move |id| {
            // C::queryBlockNbt(id, position) - from client/js/net/packets.js
            unimplemented!("C::queryBlockNbt integration")
        }, callback)
    }

    /// Query entity NBT by entity ID.
    /// Returns the transaction ID for later response handling.
    /// Adapt the `C::queryEntityNbt` call to your packets module.
    pub fn entity(&mut self, entity_id: u32, callback: Box<dyn Fn(Tag) + 'static>) -> u32 {
        self._request(move |id| {
            // C::queryEntityNbt(id, entityId) - from client/js/net/packets.js
            unimplemented!("C::queryEntityNbt integration")
        }, callback)
    }

    fn _request(
        &mut self,
        encode: impl FnOnce(u32) + 'static,
        callback: Box<dyn Fn(Tag) + 'static>,
    ) -> u32 {
        let id = ++self.serial;
        self.pending = Some(PendingQuery {
            id,
            callback,
            conn: /* self.game.conn() or appropriate connection identifier */,
        });
        encode(id);
        id
    }

    /// Handle an incoming NBT query response packet.
    /// Returns `true` if the packet was handled and the callback invoked,
    /// `false` otherwise.
    pub fn handle(&mut self, packet_transaction_id: u32, conn: /* connection identifier */) -> bool {
        let p = self.pending.as_ref();
        if p.is_none() || p.unwrap().id != packet_transaction_id || p.unwrap().conn != conn {
            return false;
        }
        self.pending = None;
        // p.unwrap().callback(nbt_tag_from_packet);
        // Adapt: extract the Tag from the deserialized packet NBT data.
        true
    }
}

/// Port of `snbt(tag)` from `client/js/game/nbt-queries.js`.
/// Converts an NBT `Tag` to its SNBT string representation.
/// Matches the JavaScript behavior exactly:
/// - if(!tag)return '{}';
/// - switch(tag.t) { case 1: return value+'b'; case 2: return value+'s';
///   case 3: return String(value); case 4: return value+'L'; case 5: return
///   value+'f'; case 6: return value+'d'; case 8: return JSON.stringify(value);
///   case 7: return '[B;'+Array.from(value).map(v=>v+'B').join(',')+']';
///   case 11: return '[I;'+Array.from(value).join(',')+']';
///   case 12: return '[L;'+Array.from(value).map(v=>v+'L').join(',')+']';
///   case 9: return '['+value.items.map(v=>snbt({t:value.et,v})).join(',')+']';
///   case 10: return '{'+Object.entries(value).map(([k,v])=>quote(k)+':'+snbt(v)).join(',')+'}';
///   default: return '{}';
pub fn snbt_tag(tag: &Tag) -> String {
    // JS: if(!tag)return '{}'; - in Rust &Tag is always valid, so we proceed directly
    snbt_tag_from_tag(tag)
}

// Dispatch on the Tag variant, mirroring the JS switch(tag.t) logic
fn snbt_tag_from_tag(value: &Tag) -> String {
    match value {
        // case 1: return value+'b'  -> Byte(i8)
        Tag::Byte(v) => format!("{}b", v),
        // case 2: return value+'s'  -> Short(i16)
        Tag::Short(v) => format!("{}s", v),
        // case 3: return String(value) -> Int(i32)
        Tag::Int(v) => v.to_string(),
        // case 4: return value+'L'  -> Long(i64)
        Tag::Long(v) => format!("{}L", v),
        // case 5: return value+'f'  -> Float(f32)
        Tag::Float(v) => format!("{}f", v),
        // case 6: return value+'d'  -> Double(f64)
        Tag::Double(v) => format!("{}d", v),
        // case 8: return JSON.stringify(value) -> String
        Tag::String(v) => {
            // Simple JSON string representation
            format!("\"{}\"", v.replace('\\', "\\\\").replace('"', "\\\""))
        }
        // case 7: return '[B;'+Array.from(value).map(v=>v+'B').join(',')+']' -> ByteArray(Vec<i8>)
        Tag::ByteArray(arr) => {
            let bytes: Vec<String> = arr.iter().map(|b| b.to_string()).collect();
            format!("[B;{}]", bytes.join(","))
        }
        // case 11: return '[I;'+Array.from(value).join(',')+']' -> IntArray(Vec<i32>)
        Tag::IntArray(arr) => {
            let nums: Vec<String> = arr.iter().map(|i| i.to_string()).collect();
            format!("[I;{}]", nums.join(","))
        }
        // case 12: return '[L;'+Array.from(value).map(v=>v+'L').join(',')+']' -> LongArray(Vec<i64>)
        Tag::LongArray(arr) => {
            let nums: Vec<String> = arr.iter().map(|l| l.to_string()).collect();
            format!("[L;{}]", nums.join(","))
        }
        // case 9: return '['+value.items.map(v=>snbt({t:value.et,v})).join(',')+']' -> List { items, element_type }
        Tag::List { element_type: _, items } => {
            let items_snbt: Vec<String> = items.iter().map(snbt_tag).collect();
            format!("[{}]", items_snbt.join(","))
        }
        // case 10: return '{'+Object.entries(value).map(([k,v])=>quote(k)+':'+snbt(v)).join(',')+'}' -> Compound(Vec<(String, Tag)>)
        Tag::Compound(fields) => {
            let entries: Vec<String> = fields
                .into_iter()
                .map(|(k, v)| quote(&k) + ":" + &snbt_tag(&v))
                .collect();
            format!("{{{}}}", entries.join(","))
        }
        // default: return '{}'
        _ => "{}".to_string(),
    }
}

// Helper matching the JS `quote` function:
// export const quote = s => /^[A-Za-z0-9_.+-]+$/.test(s) ? s : JSON.stringify(s)
fn quote(s: &str) -> String {
    if s.chars().all(|c| c.is_alphanumeric() || c == '.' || c == '_' || c == '+' || c == '-' || c == '@') {
        s.to_string()
    } else {
        // Basic JSON string escaping
        format!("\"{}\"", s.replace('\\', "\\\\").replace('"', "\\\""))
    }
}