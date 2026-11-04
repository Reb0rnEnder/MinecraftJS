//! Port of `client/js/net/recipes.js` (vanilla recipe serializers for
//! protocols 404 / 498 / 578).
//!
//! Result is the same plain object tree the JS parser builds, encoded as JSON
//! (NBT inside slots uses the `nbt.rs` simplification, which is how the
//! JavaScript `simplify` helper exposes it).

use wasm_bindgen::prelude::*;

struct Cursor<'a> {
    data: &'a [u8],
    offset: usize,
}

impl<'a> Cursor<'a> {
    fn new(data: &'a [u8]) -> Self {
        Cursor { data, offset: 0 }
    }

    fn remaining(&self) -> usize {
        self.data.len() - self.offset
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

    fn i8(&mut self) -> Option<i8> {
        Some(self.u8()? as i8)
    }

    fn i32(&mut self) -> Option<i32> {
        let bytes = self.take(4)?;
        Some(i32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    fn f32(&mut self) -> Option<f32> {
        Some(f32::from_bits(self.i32()? as u32))
    }

    fn bool(&mut self) -> Option<bool> {
        Some(self.u8()? != 0)
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

    fn array<T>(
        &mut self,
        max: i32,
        mut read: impl FnMut(&mut Cursor<'a>) -> Option<T>,
    ) -> Option<Vec<T>> {
        let count = self.varint()?;
        if count < 0 || count > max || count as usize > self.remaining() {
            return None;
        }
        let mut out = Vec::with_capacity(count as usize);
        for _ in 0..count {
            out.push(read(self)?);
        }
        Some(out)
    }

    /// `Reader.slot()`: optional item, then NBT.
    fn slot(&mut self) -> Option<Slot> {
        if !self.bool()? {
            return Some(Slot::empty());
        }
        let id = self.varint()?;
        let count = self.i8()?;
        let tag = self.u8()?;
        let nbt = if tag == 0 {
            None
        } else {
            let (root, consumed) =
                crate::nbt::read_root_consumed(&self.data[self.offset - 1..]).ok()?;
            self.offset += consumed - 1;
            root.as_ref().map(|root| crate::nbt::simplify(&root.value))
        };
        Some(Slot {
            empty: false,
            id,
            count,
            damage: 0,
            nbt,
        })
    }
}

struct Slot {
    empty: bool,
    id: i32,
    count: i8,
    damage: i32,
    nbt: Option<String>,
}

impl Slot {
    fn empty() -> Slot {
        Slot {
            empty: true,
            id: 0,
            count: 0,
            damage: 0,
            nbt: None,
        }
    }

    fn json(&self) -> String {
        if self.empty {
            return "null".to_string();
        }
        format!(
            "{{\"id\":{},\"count\":{},\"damage\":{},\"nbt\":{}}}",
            self.id,
            self.count,
            self.damage,
            self.nbt.as_deref().unwrap_or("null")
        )
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
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

fn slots_json(slots: &[Slot]) -> String {
    let mut out = String::from("[");
    for (index, slot) in slots.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        out.push_str(&slot.json());
    }
    out.push(']');
    out
}

fn ingredient(cursor: &mut Cursor) -> Option<Vec<Slot>> {
    cursor.array(65536, |cursor| cursor.slot())
}

fn recipe_json(protocol: i32, cursor: &mut Cursor) -> Option<String> {
    let first = cursor.string()?;
    let second = cursor.string()?;
    let (type_name, recipe_id) = if protocol == 404 {
        (second, first)
    } else {
        (first, second)
    };
    let kind = type_name.strip_prefix("minecraft:").unwrap_or(&type_name);

    let mut data = String::from("{");
    let handled = match kind {
        "crafting_shaped" => {
            let width = cursor.varint()?;
            let height = cursor.varint()?;
            if !(1..=3).contains(&width) || !(1..=3).contains(&height) {
                return None;
            }
            let group = cursor.string()?;
            let mut ingredients = Vec::with_capacity((width * height) as usize);
            for _ in 0..width * height {
                ingredients.push(ingredient(cursor)?);
            }
            let result = cursor.slot()?;
            data.push_str(&format!(
                "\"width\":{},\"height\":{},\"group\":",
                width, height
            ));
            json_string(&mut data, &group);
            data.push_str(",\"ingredients\":[");
            for (index, slots) in ingredients.iter().enumerate() {
                if index > 0 {
                    data.push(',');
                }
                data.push_str(&slots_json(slots));
            }
            data.push_str("],\"result\":");
            data.push_str(&result.json());
            true
        }
        "crafting_shapeless" => {
            let group = cursor.string()?;
            let ingredients = cursor.array(9, ingredient)?;
            let result = cursor.slot()?;
            data.push_str("\"group\":");
            json_string(&mut data, &group);
            data.push_str(",\"ingredients\":[");
            for (index, slots) in ingredients.iter().enumerate() {
                if index > 0 {
                    data.push(',');
                }
                data.push_str(&slots_json(slots));
            }
            data.push_str("],\"result\":");
            data.push_str(&result.json());
            true
        }
        "smelting" | "blasting" | "smoking" | "campfire_cooking" => {
            let group = cursor.string()?;
            let ingredient = ingredient(cursor)?;
            let result = cursor.slot()?;
            let experience = cursor.f32()?;
            let cooking_time = cursor.varint()?;
            data.push_str("\"group\":");
            json_string(&mut data, &group);
            data.push_str(",\"ingredient\":");
            data.push_str(&slots_json(&ingredient));
            data.push_str(",\"result\":");
            data.push_str(&result.json());
            data.push_str(&format!(
                ",\"experience\":{},\"cookingTime\":{}",
                experience as f64, cooking_time
            ));
            true
        }
        "stonecutting" if protocol != 404 => {
            let group = cursor.string()?;
            let ingredient = ingredient(cursor)?;
            let result = cursor.slot()?;
            data.push_str("\"group\":");
            json_string(&mut data, &group);
            data.push_str(",\"ingredient\":");
            data.push_str(&slots_json(&ingredient));
            data.push_str(",\"result\":");
            data.push_str(&result.json());
            true
        }
        _ if kind.starts_with("crafting_special_") => true,
        _ => false,
    };
    if !handled {
        return None;
    }
    data.push('}');

    let mut out = String::from("{\"type\":");
    json_string(&mut out, &type_name);
    out.push_str(",\"recipeId\":");
    json_string(&mut out, &recipe_id);
    out.push_str(",\"data\":");
    out.push_str(&data);
    out.push('}');
    Some(out)
}

fn parse(data: &[u8], protocol: i32) -> Option<String> {
    let mut cursor = Cursor::new(data);
    let count = cursor.varint()?;
    if count < 0 || count > 65536 || count as usize > cursor.remaining() {
        return None;
    }
    let mut recipes = Vec::with_capacity(count as usize);
    for _ in 0..count {
        recipes.push(recipe_json(protocol, &mut cursor)?);
    }
    let mut out = String::from("[");
    for (index, recipe) in recipes.iter().enumerate() {
        if index > 0 {
            out.push(',');
        }
        out.push_str(recipe);
    }
    out.push(']');
    Some(out)
}

/// Parse a recipe array from a `DeclareRecipes` payload. `protocol` is 404,
/// 498 or 578; only 404 reorders the type/id pair.
#[wasm_bindgen]
pub fn parse_recipes(data: &[u8], protocol: i32) -> Option<String> {
    parse(data, protocol)
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

    fn empty_slot(out: &mut Vec<u8>) {
        out.push(1);
        varint(out, 1);
        out.push(1);
        out.push(0);
    }

    #[test]
    fn parses_a_shaped_recipe() {
        let mut data = Vec::new();
        varint(&mut data, 1);
        string(&mut data, "minecraft:crafting_shaped");
        string(&mut data, "minecraft:test");
        varint(&mut data, 2);
        varint(&mut data, 2);
        string(&mut data, "group");
        for _ in 0..4 {
            varint(&mut data, 1);
            empty_slot(&mut data);
        }
        empty_slot(&mut data);

        let parsed = parse(&data, 578).expect("recipe");
        assert!(parsed.contains("\"type\":\"minecraft:crafting_shaped\""));
        assert!(parsed.contains("\"width\":2,\"height\":2"));
        assert!(parsed.contains("\"ingredients\":[[{\"id\":1"));
    }

    #[test]
    fn reads_the_404_order_and_special_recipes() {
        let mut data = Vec::new();
        varint(&mut data, 1);
        string(&mut data, "minecraft:test");
        string(&mut data, "crafting_special_firework_rocket");

        let parsed = parse(&data, 404).expect("recipe");
        assert!(parsed.contains("\"type\":\"crafting_special_firework_rocket\""));
        assert!(parsed.contains("\"recipeId\":\"minecraft:test\""));
        assert!(parsed.contains("\"data\":{}"));
    }

    #[test]
    fn rejects_unknown_serializers_and_bad_sizes() {
        let mut data = Vec::new();
        varint(&mut data, 1);
        string(&mut data, "minecraft:nope");
        string(&mut data, "minecraft:test");
        assert!(parse(&data, 578).is_none());

        let mut shaped = Vec::new();
        varint(&mut shaped, 1);
        string(&mut shaped, "minecraft:crafting_shaped");
        string(&mut shaped, "minecraft:test");
        varint(&mut shaped, 4);
        varint(&mut shaped, 1);
        assert!(parse(&shaped, 578).is_none());
    }
}
