//! Port of `client/js/net/packets.js` and related protocol files.
//!
//! This module provides packet serialization/deserialization for Minecraft protocol
//! versions 498 (1.14.4) and 578 (1.15.2). It includes:
//! - VarInt/VarLong encoding/decoding
//! - String encoding/decoding (UTF-8)
//! - Packet serialization (write) - converting objects to binary buffers
//! - Packet deserialization (read) - parsing binary buffers to objects
//! - NBT serialization (via nbt.rs)
//! - Packet ID mapping for protocol versions

use wasm_bindgen::prelude::*;
use crate::buffer::{PacketReader, PacketWriter};
use crate::protocol_ids::{packet_id_498, packet_name_498, packet_id_578, packet_name_578};

/// Protocol versions supported
pub const PROTOCOL_498: i32 = 498;
pub const PROTOCOL_578: i32 = 578;

/// Direction of packet flow
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[wasm_bindgen]
pub enum PacketDirection {
    Clientbound = 0,
    Serverbound = 1,
}

/// Supported protocol versions
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[wasm_bindgen]
pub enum ProtocolVersion {
    V498 = 498,
    V578 = 578,
}

impl ProtocolVersion {
    fn from_i32(v: i32) -> Option<Self> {
        match v {
            498 => Some(ProtocolVersion::V498),
            578 => Some(ProtocolVersion::V578),
            _ => None,
        }
    }
}

/// Result of packet deserialization
#[wasm_bindgen]
pub struct DecodedPacket {
    packet_id: i32,
    packet_name: Option<String>,
    data: Vec<u8>, // Raw remaining data for unsupported packets
}

#[wasm_bindgen]
impl DecodedPacket {
    pub fn packet_id(&self) -> i32 {
        self.packet_id
    }

    pub fn packet_name(&self) -> Option<String> {
        self.packet_name.clone()
    }

    pub fn data(&self) -> Vec<u8> {
        self.data.clone()
    }
}

/// Encode a VarInt (signed 32-bit)
#[wasm_bindgen]
pub fn varint_encode(value: i32) -> Vec<u8> {
    let mut writer = PacketWriter::new();
    writer.varint(value);
    writer.build()
}

/// Decode a VarInt from bytes
#[wasm_bindgen]
pub fn varint_decode(bytes: &[u8]) -> Result<i32, JsValue> {
    let mut reader = PacketReader::new(bytes);
    reader.varint().map_err(Into::into)
}

/// Encode a VarLong (signed 64-bit)
#[wasm_bindgen]
pub fn varlong_encode(value: i64) -> Vec<u8> {
    let mut writer = PacketWriter::new();
    writer.varlong(value);
    writer.build()
}

/// Decode a VarLong from bytes
#[wasm_bindgen]
pub fn varlong_decode(bytes: &[u8]) -> Result<i64, JsValue> {
    let mut reader = PacketReader::new(bytes);
    reader.varlong().map_err(Into::into)
}

/// Encode a UTF-8 string with VarInt length prefix
#[wasm_bindgen]
pub fn string_encode(value: &str) -> Vec<u8> {
    let mut writer = PacketWriter::new();
    writer.string(value);
    writer.build()
}

/// Decode a UTF-8 string with VarInt length prefix
#[wasm_bindgen]
pub fn string_decode(bytes: &[u8]) -> Result<String, JsValue> {
    let mut reader = PacketReader::new(bytes);
    reader.string().map_err(Into::into)
}

/// Serialize a packet by ID and data
#[wasm_bindgen]
pub fn packet_serialize(packet_id: i32, data: &[u8], protocol_version: i32, clientbound: bool) -> Result<Vec<u8>, JsValue> {
    let version = ProtocolVersion::from_i32(protocol_version).ok_or_else(|| JsValue::from_str("Unsupported protocol version"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.raw(data);
    Ok(writer.build())
}

/// Deserialize a packet from bytes
#[wasm_bindgen]
pub fn packet_deserialize(bytes: &[u8], protocol_version: i32, clientbound: bool) -> Result<DecodedPacket, JsValue> {
    let version = ProtocolVersion::from_i32(protocol_version).ok_or_else(|| JsValue::from_str("Unsupported protocol version"))?;
    
    let mut reader = PacketReader::new(bytes);
    let packet_id = reader.varint().map_err(|e| JsValue::from_str(&e.0))?;
    
    let packet_name = if clientbound {
        packet_name_578(packet_id, true) // Use 578 as primary, fallback handled in JS
    } else {
        packet_name_578(packet_id, false)
    };
    
    let remaining = reader.rest().map_err(|e| JsValue::from_str(&e.0))?;
    
    Ok(DecodedPacket {
        packet_id,
        packet_name,
        data: remaining,
    })
}

/// Helper to get packet ID by name for a given protocol version
#[wasm_bindgen]
pub fn get_packet_id(name: &str, protocol_version: i32, clientbound: bool) -> Option<i32> {
    match protocol_version {
        498 => packet_id_498(name, clientbound),
        578 => packet_id_578(name, clientbound),
        _ => None,
    }
}

/// Helper to get packet name by ID for a given protocol version
#[wasm_bindgen]
pub fn get_packet_name(id: i32, protocol_version: i32, clientbound: bool) -> Option<String> {
    match protocol_version {
        498 => packet_name_498(id, clientbound),
        578 => packet_name_578(id, clientbound),
        _ => None,
    }
}

// Convenience functions for common packet types (serverbound - client to server)

/// Create a settings packet
#[wasm_bindgen]
pub fn create_settings_packet(
    locale: &str,
    view_distance: i8,
    chat_flags: i32,
    chat_colors: bool,
    skin_parts: u8,
    main_hand: i32,
    protocol_version: i32,
) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("settings", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: settings"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.string(locale);
    writer.i8(view_distance);
    writer.varint(chat_flags);
    writer.write_bool(chat_colors);
    writer.u8(skin_parts);
    writer.varint(main_hand);
    Ok(writer.build())
}

/// Create a chat message packet
#[wasm_bindgen]
pub fn create_chat_packet(message: &str, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("chat", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: chat"))?;
    
    // Limit to 256 chars as per JS implementation
    let msg = if message.len() > 256 { &message[..256] } else { message };
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.string(msg);
    Ok(writer.build())
}

/// Create a flying packet (position + look)
#[wasm_bindgen]
pub fn create_flying_packet(on_ground: bool, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("flying", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: flying"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.write_bool(on_ground);
    Ok(writer.build())
}

/// Create a position packet
#[wasm_bindgen]
pub fn create_position_packet(x: f64, y: f64, z: f64, on_ground: bool, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("position", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: position"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.f64(x);
    writer.f64(y);
    writer.f64(z);
    writer.write_bool(on_ground);
    Ok(writer.build())
}

/// Create a look packet
#[wasm_bindgen]
pub fn create_look_packet(yaw: f32, pitch: f32, on_ground: bool, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("look", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: look"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.f32(yaw);
    writer.f32(pitch);
    writer.write_bool(on_ground);
    Ok(writer.build())
}

/// Create a position + look packet
#[wasm_bindgen]
pub fn create_position_look_packet(
    x: f64, y: f64, z: f64,
    yaw: f32, pitch: f32,
    on_ground: bool,
    protocol_version: i32,
) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("position_look", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: position_look"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.f64(x);
    writer.f64(y);
    writer.f64(z);
    writer.f32(yaw);
    writer.f32(pitch);
    writer.write_bool(on_ground);
    Ok(writer.build())
}

/// Create a keep alive packet
#[wasm_bindgen]
pub fn create_keep_alive_packet(keep_alive_id: i64, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("keep_alive", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: keep_alive"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.i64(keep_alive_id);
    Ok(writer.build())
}

/// Create a tab complete packet
#[wasm_bindgen]
pub fn create_tab_complete_packet(text: &str, transaction_id: i32, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("tab_complete", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: tab_complete"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(transaction_id);
    writer.string(text);
    Ok(writer.build())
}

/// Create a client command packet
#[wasm_bindgen]
pub fn create_client_command_packet(action: i32, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("client_command", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: client_command"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(action);
    Ok(writer.build())
}

/// Create a transaction packet
#[wasm_bindgen]
pub fn create_transaction_packet(window_id: i8, action: i16, accepted: bool, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("transaction", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: transaction"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.i8(window_id);
    writer.i16(action);
    writer.write_bool(accepted);
    Ok(writer.build())
}

/// Create a close window packet
#[wasm_bindgen]
pub fn create_close_window_packet(window_id: u8, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("close_window", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: close_window"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.u8(window_id);
    Ok(writer.build())
}

/// Create a custom payload packet
#[wasm_bindgen]
pub fn create_custom_payload_packet(channel: &str, data: &[u8], protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("custom_payload", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: custom_payload"))?;
    
    // Validate channel format (from JS: /^[a-z0-9_.-]+:[a-z0-9/._-]+$/)
    if !channel.matches(|c: char| c.is_ascii_lowercase() || c.is_ascii_digit() || "._-".contains(c) || c == ':').all(|_| true) 
        || !channel.contains(':') {
        return Err(JsValue::from_str(&format!("Invalid custom payload channel: {}", channel)));
    }
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.string(channel);
    writer.raw(data);
    Ok(writer.build())
}

/// Create a use entity packet
#[wasm_bindgen]
pub fn create_use_entity_packet(
    target: i32,
    mouse: i32,
    x: Option<f32>,
    y: Option<f32>,
    z: Option<f32>,
    hand: Option<i32>,
    protocol_version: i32,
) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("use_entity", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: use_entity"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(target);
    writer.varint(mouse);
    
    if mouse == 2 {
        // Attack with position
        writer.f32(x.unwrap_or(0.0));
        writer.f32(y.unwrap_or(0.0));
        writer.f32(z.unwrap_or(0.0));
    }
    
    if mouse != 1 {
        writer.varint(hand.unwrap_or(0));
    }
    
    Ok(writer.build())
}

/// Create an entity action packet
#[wasm_bindgen]
pub fn create_entity_action_packet(eid: i32, action: i32, jump_boost: i32, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("entity_action", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: entity_action"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(eid);
    writer.varint(action);
    writer.varint(jump_boost);
    Ok(writer.build())
}

/// Create a steer vehicle packet
#[wasm_bindgen]
pub fn create_steer_vehicle_packet(sideways: f32, forward: f32, flags: u8, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("steer_vehicle", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: steer_vehicle"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.f32(sideways);
    writer.f32(forward);
    writer.u8(flags);
    Ok(writer.build())
}

/// Create a resource pack status packet
#[wasm_bindgen]
pub fn create_resource_pack_status_packet(result: i32, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("resource_pack_receive", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: resource_pack_receive"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(result);
    Ok(writer.build())
}

/// Create a place recipe packet
#[wasm_bindgen]
pub fn create_place_recipe_packet(window_id: u8, recipe: &str, all: bool, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("craft_recipe_request", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: craft_recipe_request"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.u8(window_id);
    writer.string(recipe);
    writer.write_bool(all);
    Ok(writer.build())
}

/// Create a recipe info shown packet
#[wasm_bindgen]
pub fn create_recipe_info_shown_packet(recipe: &str, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("crafting_book_data", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: crafting_book_data"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(0); // type 0 = recipe shown
    writer.string(recipe);
    Ok(writer.build())
}

/// Create a recipe info settings packet
#[wasm_bindgen]
pub fn create_recipe_info_settings_packet(
    open: bool,
    filtering: bool,
    smelting_open: bool,
    smelting_filtering: bool,
    blasting_open: bool,
    blasting_filtering: bool,
    smoking_open: bool,
    smoking_filtering: bool,
    protocol_version: i32,
) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("crafting_book_data", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: crafting_book_data"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(1); // type 1 = settings
    writer.write_bool(open);
    writer.write_bool(filtering);
    writer.write_bool(smelting_open);
    writer.write_bool(smelting_filtering);
    writer.write_bool(blasting_open);
    writer.write_bool(blasting_filtering);
    writer.write_bool(smoking_open);
    writer.write_bool(smoking_filtering);
    Ok(writer.build())
}

/// Create a seen advancements packet
#[wasm_bindgen]
pub fn create_seen_advancements_packet(tab: Option<String>, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("advancement_tab", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: advancement_tab"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    
    match tab {
        Some(t) => {
            writer.varint(0); // type 0 = open tab
            writer.string(&t);
        }
        None => {
            writer.varint(1); // type 1 = close
        }
    }
    
    Ok(writer.build())
}

/// Create a select trade packet
#[wasm_bindgen]
pub fn create_select_trade_packet(index: i32, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("select_trade", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: select_trade"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(index);
    Ok(writer.build())
}

/// Create a name item packet
#[wasm_bindgen]
pub fn create_name_item_packet(name: &str, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("name_item", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: name_item"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.string(name);
    Ok(writer.build())
}

/// Create a set beacon effects packet
#[wasm_bindgen]
pub fn create_set_beacon_effects_packet(primary: i32, secondary: i32, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("set_beacon_effect", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: set_beacon_effect"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(primary);
    writer.varint(secondary);
    Ok(writer.build())
}

/// Create a held item slot packet
#[wasm_bindgen]
pub fn create_held_item_slot_packet(slot: i16, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("held_item_slot", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: held_item_slot"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.i16(slot);
    Ok(writer.build())
}

/// Create an arm animation packet
#[wasm_bindgen]
pub fn create_arm_animation_packet(hand: Option<i32>, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("arm_animation", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: arm_animation"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(hand.unwrap_or(0));
    Ok(writer.build())
}

/// Create a spectate packet
#[wasm_bindgen]
pub fn create_spectate_packet(uuid: &str, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("spectate", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: spectate"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.uuid(uuid);
    Ok(writer.build())
}

/// Create a use item packet
#[wasm_bindgen]
pub fn create_use_item_packet(hand: Option<i32>, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("use_item", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: use_item"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(hand.unwrap_or(0));
    Ok(writer.build())
}

/// Create a teleport confirm packet
#[wasm_bindgen]
pub fn create_teleport_confirm_packet(id: i32, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("teleport_confirm", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: teleport_confirm"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(id);
    Ok(writer.build())
}

/// Create a block dig packet
#[wasm_bindgen]
pub fn create_block_dig_packet(status: i32, x: i32, y: i32, z: i32, face: i8, protocol_version: i32) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("block_dig", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: block_dig"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(status);
    writer.position(x, y, z);
    writer.i8(face);
    Ok(writer.build())
}

/// Create a block place packet
#[wasm_bindgen]
pub fn create_block_place_packet(
    hand: i32,
    x: i32, y: i32, z: i32,
    face: i32,
    cursor_x: f32, cursor_y: f32, cursor_z: f32,
    inside_block: bool,
    protocol_version: i32,
) -> Result<Vec<u8>, JsValue> {
    let packet_id = get_packet_id("block_place", protocol_version, false)
        .ok_or_else(|| JsValue::from_str("Unknown packet: block_place"))?;
    
    let mut writer = PacketWriter::new();
    writer.varint(packet_id);
    writer.varint(hand);
    writer.position(x, y, z);
    writer.varint(face);
    writer.f32(cursor_x);
    writer.f32(cursor_y);
    writer.f32(cursor_z);
    writer.write_bool(inside_block);
    Ok(writer.build())
}

// Slot encoding for window_click etc.
/// Encode a slot (item) - simplified version
#[wasm_bindgen]
pub fn encode_slot(item_id: i32, count: i8, nbt_data: Option<Vec<u8>>) -> Vec<u8> {
    let mut writer = PacketWriter::new();
    
    if item_id < 0 {
        writer.write_bool(false);
        return writer.build();
    }
    
    writer.write_bool(true);
    writer.varint(item_id);
    writer.i8(count);
    
    if let Some(nbt) = nbt_data {
        writer.raw(&nbt);
    } else {
        writer.u8(0); // No NBT
    }
    
    writer.build()
}

/// Decode a slot from bytes
#[wasm_bindgen]
pub fn decode_slot(bytes: &[u8]) -> Result<Option<JsValue>, JsValue> {
    let mut reader = PacketReader::new(bytes);
    
    let present = reader.read_bool().map_err(|e| JsValue::from_str(&e.0))?;
    if !present {
        return Ok(None);
    }
    
    let item_id = reader.varint().map_err(|e| JsValue::from_str(&e.0))?;
    let count = reader.i8().map_err(|e| JsValue::from_str(&e.0))?;
    
    // Check if there's NBT data - peek at the next byte
    let current_offset = reader.offset();
    let tag = reader.u8().map_err(|e| JsValue::from_str(&e.0))?;
    
    let nbt_data = if tag != 0 {
        // Go back to the tag byte and read the rest
        let mut reader2 = PacketReader::new(&bytes[current_offset..]);
        let nbt_bytes = reader2.rest().map_err(|e| JsValue::from_str(&e.0))?;
        Some(nbt_bytes)
    } else {
        None
    };
    
    let result = js_sys::Object::new();
    js_sys::Reflect::set(&result, &"id".into(), &item_id.into())?;
    js_sys::Reflect::set(&result, &"count".into(), &count.into())?;
    if let Some(nbt) = nbt_data {
        js_sys::Reflect::set(&result, &"nbtRaw".into(), &js_sys::Uint8Array::from(nbt.as_slice()).into())?;
    }
    
    Ok(Some(result.into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_varint_roundtrip() {
        let values = [0, 1, 127, 128, 255, 2097151, -1, -2147483648];
        for v in values {
            let encoded = varint_encode(v);
            let decoded = varint_decode(&encoded).unwrap();
            assert_eq!(v, decoded, "VarInt roundtrip failed for {}", v);
        }
    }

    #[test]
    fn test_varlong_roundtrip() {
        let values = [0, 1, 127, 128, 255, (1i64 << 40), -1, -9_000_000_000i64, i64::MIN, i64::MAX];
        for v in values {
            let encoded = varlong_encode(v);
            let decoded = varlong_decode(&encoded).unwrap();
            assert_eq!(v, decoded, "VarLong roundtrip failed for {}", v);
        }
    }

    #[test]
    fn test_string_roundtrip() {
        let long_string = "a".repeat(1000);
        let strings = ["", "hello", "héllo", "🎮", "日本語", long_string.as_str()];
        for s in strings {
            let encoded = string_encode(s);
            let decoded = string_decode(&encoded).unwrap();
            assert_eq!(s, decoded, "String roundtrip failed for {:?}", s);
        }
    }

    #[test]
    fn test_packet_serialize_deserialize() {
        let mut writer = PacketWriter::new();
        writer.varint(42); // packet ID
        writer.string("test data");
        writer.varint(12345);
        let packet = writer.build();
        
        let decoded = packet_deserialize(&packet, 578, false).unwrap();
        assert_eq!(decoded.packet_id, 42);
    }

    #[test]
    fn test_create_chat_packet() {
        let packet = create_chat_packet("Hello world!", 578).unwrap();
        let decoded = packet_deserialize(&packet, 578, false).unwrap();
        assert_eq!(decoded.packet_id, get_packet_id("chat", 578, false).unwrap());
    }

    #[test]
    fn test_create_position_packet() {
        let packet = create_position_packet(100.5, 64.0, -200.25, true, 578).unwrap();
        let decoded = packet_deserialize(&packet, 578, false).unwrap();
        assert_eq!(decoded.packet_id, get_packet_id("position", 578, false).unwrap());
    }

    #[test]
    fn test_encode_decode_slot() {
        // Test empty slot
        let empty = encode_slot(-1, 0, None);
        let decoded = decode_slot(&empty).unwrap();
        assert!(decoded.is_none());
        
        // Test slot with item
        let slot = encode_slot(1, 64, None);
        let decoded = decode_slot(&slot).unwrap();
        assert!(decoded.is_some());
        let obj = js_sys::Object::from(decoded.unwrap());
        assert_eq!(js_sys::Reflect::get(&obj, &"id".into()).unwrap(), 1);
        assert_eq!(js_sys::Reflect::get(&obj, &"count".into()).unwrap(), 64);
    }
}