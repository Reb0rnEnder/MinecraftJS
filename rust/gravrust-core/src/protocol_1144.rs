//! Port of `client/js/net/protocol-1.14.4.js` (native Java 1.14.4 protocol 498
//! codec) and its body decoders from `client/js/net/packet-bodies-1.14.4.js`.
//!
//! JS module layout and this port:
//! - `Reader498` / `Writer498` (protocol-specific reader/writer over the
//!   `buffer.js` primitives) -> the structs here. Reads reuse the same
//!   little-endian... rather big-endian wire format as `crate::buffer`;
//!   the reader keeps its own cursor because `Reader.slot()`/`optionalNbt()`
//!   rewind after peeking the NBT tag byte (the `crate::buffer::PacketReader`
//!   cursor cannot seek).
//! - the `decoders` map and `PACKET_BODIES_498` -> the two `match` dispatchers
//!   below. Bodies are built as dynamic `crate::protocol::Json` objects with
//!   the exact JS field names, because that is what the JS decoders return.
//! - `decodePacket498` -> `decode_packet_498` (plus a JSON facade for wasm).
//! - `C498` -> the `C498` builders (packet payloads reuse `crate::buffer` /
//!   `crate::technical` where the layouts match).
//!
//! JS: `export const PROTOCOL_498=498;`
pub const PROTOCOL_498: i32 = 498;

use crate::buffer::BufferError;
use crate::nbt::{read_root_consumed, Root};
use crate::protocol::{
    check_no_trailing, id_for_name, jarr, jbool, jint, jnull, jnum, jobj, jstr, name_for_id,
    position_json, read_array, read_particle_data, root_to_json, slot_json, Json, ParticleData,
    ParticleValue, Slot,
};
use crate::protocol_ids::{CLIENTBOUND_498, SERVERBOUND_498};
use wasm_bindgen::prelude::*;

// ------------------------------------------------------------- Reader498

/// JS `class Reader498 extends Reader` with the 498 overrides.
pub struct Reader498 {
    data: Vec<u8>,
    offset: usize,
}

impl Reader498 {
    /// JS: `new Reader498(bytes)`.
    pub fn new(bytes: &[u8]) -> Reader498 {
        Reader498 { data: bytes.to_vec(), offset: 0 }
    }

    /// JS `remaining()`.
    pub fn remaining(&self) -> usize {
        self.data.len() - self.offset
    }

    /// JS `offset`.
    pub fn offset(&self) -> usize {
        self.offset
    }

    fn take(&mut self, count: usize) -> Result<&[u8], BufferError> {
        if self.offset + count > self.data.len() {
            return Err(BufferError("Packet underflow".to_string()));
        }
        let start = self.offset;
        self.offset += count;
        Ok(&self.data[start..start + count])
    }

    pub fn u8(&mut self) -> Result<u8, BufferError> {
        Ok(self.take(1)?[0])
    }

    pub fn i8(&mut self) -> Result<i8, BufferError> {
        Ok(self.u8()? as i8)
    }

    /// JS `bool()`.
    pub fn bool(&mut self) -> Result<bool, BufferError> {
        Ok(self.u8()? != 0)
    }

    pub fn i16(&mut self) -> Result<i16, BufferError> {
        let bytes = self.take(2)?;
        Ok(i16::from_be_bytes([bytes[0], bytes[1]]))
    }

    pub fn u16(&mut self) -> Result<u16, BufferError> {
        let bytes = self.take(2)?;
        Ok(u16::from_be_bytes([bytes[0], bytes[1]]))
    }

    pub fn i32(&mut self) -> Result<i32, BufferError> {
        let bytes = self.take(4)?;
        Ok(i32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    /// JS `i64()` (returns a BigInt there; `i64` here).
    pub fn i64(&mut self) -> Result<i64, BufferError> {
        let bytes = self.take(8)?;
        Ok(i64::from_be_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        ]))
    }

    pub fn f32(&mut self) -> Result<f32, BufferError> {
        let bytes = self.take(4)?;
        Ok(f32::from_bits(u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])))
    }

    pub fn f64(&mut self) -> Result<f64, BufferError> {
        let bytes = self.take(8)?;
        Ok(f64::from_bits(u64::from_be_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        ])))
    }

    /// JS `varint()`.
    pub fn varint(&mut self) -> Result<i32, BufferError> {
        let mut value: u32 = 0;
        let mut shift = 0u32;
        loop {
            let byte = self.u8()?;
            // JS: `value |= (byte & 0x7f) << shift` — 32-bit wrapping shifts.
            value |= ((byte & 0x7f) as u32).wrapping_shl(shift);
            shift += 7;
            if shift > 35 {
                return Err(BufferError("VarInt too big".to_string()));
            }
            if byte & 0x80 == 0 {
                return Ok(value as i32);
            }
        }
    }

    /// JS `varlong()`.
    pub fn varlong(&mut self) -> Result<i64, BufferError> {
        let mut value: u64 = 0;
        let mut shift = 0u32;
        loop {
            let byte = self.u8()?;
            value |= ((byte & 0x7f) as u64) << shift;
            shift += 7;
            if shift >= 64 {
                return Err(BufferError("VarLong too big".to_string()));
            }
            if byte & 0x80 == 0 {
                return Ok(value as i64);
            }
        }
    }

    /// JS `string()`.
    pub fn string(&mut self) -> Result<String, BufferError> {
        let length = self.varint()?;
        if length < 0 {
            return Err(BufferError("Invalid byte length".to_string()));
        }
        let bytes = self.take(length as usize)?;
        Ok(crate::utf8::decode(bytes))
    }

    /// JS `bytesN(n)`.
    pub fn bytes_n(&mut self, count: usize) -> Result<Vec<u8>, BufferError> {
        Ok(self.take(count)?.to_vec())
    }

    /// JS `rest()`.
    pub fn rest(&mut self) -> Result<Vec<u8>, BufferError> {
        let remaining = self.remaining();
        self.bytes_n(remaining)
    }

    /// JS `uuid()`.
    pub fn uuid(&mut self) -> Result<String, BufferError> {
        let bytes = self.take(16)?;
        let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
        Ok(format!(
            "{}-{}-{}-{}-{}",
            &hex[0..8],
            &hex[8..12],
            &hex[12..16],
            &hex[16..20],
            &hex[20..32]
        ))
    }

    pub fn angle(&mut self) -> Result<f64, BufferError> {
        Ok(self.i8()? as f64 * 360.0 / 256.0)
    }

    /// JS `Reader498.position()` override:
    /// `{x:asIntN(26,bits>>38),y:asIntN(12,bits),z:asIntN(26,bits>>12)}`.
    /// (The base `Reader.position()` uses a different field order; 498 moves
    /// `y` to the low 12 bits.)
    pub fn position(&mut self) -> Result<Vec<i32>, BufferError> {
        let bits = self.i64()?;
        Ok(vec![
            sign_extend(bits >> 38, 26),
            sign_extend(bits, 12),
            sign_extend(bits >> 12, 26),
        ])
    }

    /// JS `Reader498.particleData(id)`.
    pub fn particle_data(&mut self, id: i32) -> Result<ParticleData, BufferError> {
        read_particle_data(self, id)
    }

    /// JS `Reader.particle()`.
    pub fn particle(&mut self) -> Result<ParticleValue, BufferError> {
        let particle_id = self.varint()?;
        Ok(ParticleValue { particle_id, data: self.particle_data(particle_id)? })
    }

    /// JS `Reader.slot()`: `{id, count, damage:0, nbt, nbtRaw}` or `null`.
    pub fn slot(&mut self) -> Result<Option<Slot>, BufferError> {
        if !self.bool()? {
            return Ok(None);
        }
        let id = self.varint()?;
        let count = self.i8()?;
        let start = self.offset;
        let tag = self.u8()?;
        let (nbt, nbt_raw) = if tag != 0 {
            let (root, consumed) =
                read_root_consumed(&self.data[start..]).map_err(|_| BufferError("Invalid NBT".to_string()))?;
            // `read_root_consumed` counts the tag byte we already consumed.
            self.offset = start + consumed;
            (root, Some(self.data[start..self.offset].to_vec()))
        } else {
            (None, None)
        };
        Ok(Some(Slot { id, count, damage: 0, nbt, nbt_raw }))
    }

    /// JS `Reader.optionalNbt()`.
    pub fn optional_nbt(&mut self) -> Result<Option<Root>, BufferError> {
        let start = self.offset;
        let tag = self.u8()?;
        if tag == 0 {
            return Ok(None);
        }
        let (root, consumed) =
            read_root_consumed(&self.data[start..]).map_err(|_| BufferError("Invalid NBT".to_string()))?;
        self.offset = start + consumed;
        Ok(root)
    }

    /// JS `Reader498.metadata()` override (19 typed readers).
    pub fn metadata(&mut self) -> Result<Vec<MetadataEntry>, BufferError> {
        let mut entries = Vec::new();
        loop {
            let index = self.u8()?;
            if index == 0xff {
                break;
            }
            let type_id = self.varint()?;
            let value = match type_id {
                0 => MetadataValue::Byte(self.i8()?),
                1 => MetadataValue::VarInt(self.varint()?),
                2 => MetadataValue::Float(self.f32()?),
                3 | 4 => MetadataValue::String(self.string()?), // string, chat component
                5 => MetadataValue::OptString(if self.bool()? { Some(self.string()?) } else { None }),
                6 => MetadataValue::Slot(self.slot()?),
                7 => MetadataValue::Bool(self.bool()?),
                8 => MetadataValue::Rotation {
                    pitch: self.f32()?,
                    yaw: self.f32()?,
                    roll: self.f32()?,
                },
                9 => MetadataValue::Position(self.position()?),
                10 => MetadataValue::OptPosition(if self.bool()? { Some(self.position()?) } else { None }),
                11 => MetadataValue::VarInt(self.varint()?), // direction
                12 => MetadataValue::OptUuid(if self.bool()? { Some(self.uuid()?) } else { None }),
                13 => MetadataValue::VarInt(self.varint()?), // optional block state; 0 = absent
                14 => MetadataValue::OptNbt(self.optional_nbt()?),
                15 => {
                    let particle = self.particle()?;
                    MetadataValue::Particle(ParticleValue {
                        particle_id: particle.particle_id,
                        data: particle.data,
                    })
                }
                16 => MetadataValue::Villager {
                    villager_type: self.varint()?,
                    villager_profession: self.varint()?,
                    level: self.varint()?,
                },
                17 => {
                    let value = self.varint()?;
                    MetadataValue::Pivot(if value == 0 { None } else { Some(value - 1) })
                }
                18 => MetadataValue::VarInt(self.varint()?),
                other => {
                    return Err(BufferError(format!("Unknown 498 metadata type {other}")));
                }
            };
            entries.push(MetadataEntry { index, value });
        }
        Ok(entries)
    }
}

fn sign_extend(value: i64, bits: u32) -> i32 {
    let shift = 64 - bits;
    ((value << shift) >> shift) as i32
}

/// One entity-metadata entry: `{index, value}` (the JS decoder returns a map
/// keyed by the numeric index; the JSON facade renders the same keys).
#[derive(Debug, Clone, PartialEq)]
pub struct MetadataEntry {
    pub index: u8,
    pub value: MetadataValue,
}

/// Values of the 19 JS metadata readers, in reader order.
#[derive(Debug, Clone, PartialEq)]
pub enum MetadataValue {
    Byte(i8),
    VarInt(i32),
    Float(f32),
    String(String),
    OptString(Option<String>),
    Slot(Option<Slot>),
    Bool(bool),
    Rotation { pitch: f32, yaw: f32, roll: f32 },
    Position(Vec<i32>),
    OptPosition(Option<Vec<i32>>),
    OptUuid(Option<String>),
    OptNbt(Option<Root>),
    Particle(ParticleValue),
    Villager { villager_type: i32, villager_profession: i32, level: i32 },
    Pivot(Option<i32>),
}

impl MetadataValue {
    /// The plain-JS value the JS metadata reader produces.
    pub fn to_json(&self) -> Json {
        match self {
            MetadataValue::Byte(value) => jint(*value as i64),
            MetadataValue::VarInt(value) => jint(*value as i64),
            MetadataValue::Float(value) => jnum(*value as f64),
            MetadataValue::String(value) => jstr(value),
            MetadataValue::OptString(value) => match value {
                Some(value) => jstr(value),
                None => jnull(),
            },
            MetadataValue::Slot(slot) => slot_json(slot),
            MetadataValue::Bool(value) => jbool(*value),
            MetadataValue::Rotation { pitch, yaw, roll } => jobj(vec![
                ("pitch", jnum(*pitch as f64)),
                ("yaw", jnum(*yaw as f64)),
                ("roll", jnum(*roll as f64)),
            ]),
            MetadataValue::Position(position) => position_json(position),
            MetadataValue::OptPosition(position) => match position {
                Some(position) => position_json(position),
                None => jnull(),
            },
            MetadataValue::OptUuid(value) => match value {
                Some(value) => jstr(value),
                None => jnull(),
            },
            MetadataValue::OptNbt(root) => match root {
                Some(root) => root_to_json(root),
                None => jnull(),
            },
            MetadataValue::Particle(particle) => particle_value_json(particle),
            MetadataValue::Villager { villager_type, villager_profession, level } => jobj(vec![
                ("villagerType", jint(*villager_type as i64)),
                ("villagerProfession", jint(*villager_profession as i64)),
                ("level", jint(*level as i64)),
            ]),
            MetadataValue::Pivot(value) => match value {
                Some(value) => jint(*value as i64),
                None => jnull(),
            },
        }
    }
}

/// JS metadata map -> JSON object with the numeric-string keys.
pub fn metadata_json(entries: &[MetadataEntry]) -> Json {
    jarr_or_obj(entries.iter().map(|entry| (entry.index.to_string(), entry.value.to_json())).collect())
}

/// The JS metadata result is an object; keep object semantics here too.
fn jarr_or_obj(pairs: Vec<(String, Json)>) -> Json {
    Json::Obj(pairs)
}

/// JS particle data object (`{blockState}` / dust fields / `{item}` / `{}`).
pub fn particle_data_json(data: &ParticleData) -> Json {
    match data {
        ParticleData::BlockState(state) => jobj(vec![("blockState", jint(*state as i64))]),
        ParticleData::Dust { red, green, blue, scale } => jobj(vec![
            ("red", jnum(*red as f64)),
            ("green", jnum(*green as f64)),
            ("blue", jnum(*blue as f64)),
            ("scale", jnum(*scale as f64)),
        ]),
        ParticleData::Item(slot) => jobj(vec![("item", slot_json(slot))]),
        ParticleData::None => jobj(vec![]),
    }
}

/// JS `Reader.particle()` result object.
pub fn particle_value_json(particle: &ParticleValue) -> Json {
    jobj(vec![
        ("particleId", jint(particle.particle_id as i64)),
        ("data", particle_data_json(&particle.data)),
    ])
}

// ------------------------------------------------------------- Writer498

/// JS `class Writer498 extends Writer` with the 498 `position` override.
#[derive(Debug)]
pub struct Writer498 {
    writer: crate::buffer::PacketWriter,
}

impl Default for Writer498 {
    fn default() -> Self {
        Self::new()
    }
}

impl Writer498 {
    pub fn new() -> Writer498 {
        Writer498 { writer: crate::buffer::PacketWriter::new() }
    }

    pub fn varint(&mut self, value: i32) -> &mut Self {
        self.writer.varint(value);
        self
    }

    pub fn varlong(&mut self, value: i64) -> &mut Self {
        self.writer.varlong(value);
        self
    }

    pub fn i8(&mut self, value: i8) -> &mut Self {
        self.writer.i8(value);
        self
    }

    pub fn u8(&mut self, value: u8) -> &mut Self {
        self.writer.u8(value);
        self
    }

    pub fn bool(&mut self, value: bool) -> &mut Self {
        self.writer.write_bool(value);
        self
    }

    pub fn i16(&mut self, value: i16) -> &mut Self {
        self.writer.i16(value);
        self
    }

    pub fn i32(&mut self, value: i32) -> &mut Self {
        self.writer.i32(value);
        self
    }

    pub fn i64(&mut self, value: i64) -> &mut Self {
        self.writer.i64(value);
        self
    }

    pub fn f32(&mut self, value: f32) -> &mut Self {
        self.writer.f32(value);
        self
    }

    pub fn f64(&mut self, value: f64) -> &mut Self {
        self.writer.f64(value);
        self
    }

    pub fn string(&mut self, value: &str) -> &mut Self {
        self.writer.string(value);
        self
    }

    pub fn raw(&mut self, bytes: &[u8]) -> &mut Self {
        self.writer.raw(bytes);
        self
    }

    pub fn uuid(&mut self, value: &str) -> &mut Self {
        self.writer.uuid(value);
        self
    }

    /// JS `Writer498.position(x,y,z)` override:
    /// `x<<38 | z<<12 | y` with the per-field range checks.
    pub fn position(&mut self, x: i32, y: i32, z: i32) -> Result<&mut Self, BufferError> {
        for (value, bits) in [(x, 26i32), (y, 12), (z, 26)] {
            let limit = 1i64 << (bits - 1);
            if (value as i64) < -limit || (value as i64) >= limit {
                return Err(BufferError("Packed position out of range".to_string()));
            }
        }
        let packed = (((x as i64) & 0x3ffffff) << 38)
            | (((z as i64) & 0x3ffffff) << 12)
            | ((y as i64) & 0xfff);
        self.writer.i64(packed);
        Ok(self)
    }

    /// JS `Writer.slot(item)`: `false` for absent / negative ids, then
    /// `varint(id) i8(count)` and the NBT tag (raw, typed, or an END byte).
    pub fn slot(&mut self, item: Option<&Slot>) -> &mut Self {
        let item = match item {
            Some(item) if item.id >= 0 => item,
            _ => {
                self.writer.write_bool(false);
                return self;
            }
        };
        self.writer.write_bool(true);
        self.writer.varint(item.id);
        self.writer.i8(item.count);
        if let Some(raw) = &item.nbt_raw {
            self.writer.raw(raw);
        } else if let Some(root) = &item.nbt {
            let bytes = crate::nbt::write_root(root);
            self.writer.raw(&bytes);
        } else {
            self.writer.u8(0);
        }
        self
    }

    /// JS `build()`.
    pub fn build(&self) -> Vec<u8> {
        self.writer.build()
    }
}

// ------------------------------------------------------------- light arrays

/// JS `lightArrays(r, mask)`: one 2048-byte array per set section bit,
/// keyed by `section - 1` (so section 0 produces the key `-1`).
pub fn light_arrays(r: &mut Reader498, mask: i32) -> Result<Vec<(i32, Vec<u8>)>, BufferError> {
    if !(0..=0x3ffff).contains(&mask) {
        return Err(BufferError("Invalid light mask".to_string()));
    }
    let mut result = Vec::new();
    for section in 0..18i32 {
        if mask & (1 << section) != 0 {
            let n = r.varint()?;
            if n != 2048 {
                return Err(BufferError("Invalid light array length".to_string()));
            }
            result.push((section - 1, r.bytes_n(n as usize)?));
        }
    }
    Ok(result)
}

/// JS light-arrays object (keys are the numeric section-1 strings).
pub fn light_arrays_json(arrays: &[(i32, Vec<u8>)]) -> Json {
    Json::Obj(
        arrays
            .iter()
            .map(|(section, bytes)| (section.to_string(), jarr(bytes.iter().map(|b| jint(*b as i64)).collect())))
            .collect(),
    )
}

// ------------------------------------------------------------- decoders

type Decoder = fn(&mut Reader498) -> Result<Json, BufferError>;

fn bytes_json(bytes: &[u8]) -> Json {
    jarr(bytes.iter().map(|byte| jint(*byte as i64)).collect())
}

fn vec3_json(x: i16, y: i16, z: i16) -> Json {
    jobj(vec![("x", jint(x as i64)), ("y", jint(y as i64)), ("z", jint(z as i64))])
}

fn strings(r: &mut Reader498) -> Result<Vec<String>, BufferError> {
    let n = r.varint()?;
    let mut out = Vec::new();
    for _ in 0..n {
        out.push(r.string()?);
    }
    Ok(out)
}

// JS: `const decoders={...}` (protocol-1.14.4.js)
fn decoder_for(name: &str) -> Option<Decoder> {
    Some(match name {
        "spawn_entity" => decode_spawn_entity,
        "statistics" => decode_statistics,
        "declare_commands" => decode_declare_commands,
        "login" => decode_login,
        "respawn" => decode_respawn,
        "difficulty" => decode_difficulty,
        "keep_alive" => decode_keep_alive,
        "kick_disconnect" => decode_kick_disconnect,
        "chat" => decode_chat,
        "custom_payload" => decode_custom_payload,
        "position" => decode_position,
        "spawn_position" => decode_spawn_position,
        "abilities" => decode_abilities,
        "held_item_slot" => decode_held_item_slot,
        "entity_status" => decode_entity_status,
        "update_view_position" => decode_update_view_position,
        "update_view_distance" => decode_update_view_distance,
        "update_time" => decode_update_time,
        "update_health" => decode_update_health,
        "map_chunk" => decode_map_chunk,
        "update_light" => decode_update_light,
        "unload_chunk" => decode_unload_chunk,
        "block_change" => decode_block_change,
        "block_break_animation" => decode_block_break_animation,
        "acknowledge_player_digging" => decode_acknowledge_player_digging,
        "entity_metadata" => decode_entity_metadata,
        "set_slot" => decode_set_slot,
        "window_items" => decode_window_items,
        "open_window" => decode_open_window,
        "open_horse_window" => decode_open_horse_window,
        "open_book" => decode_open_book,
        "entity_sound_effect" => decode_entity_sound_effect,
        "entity_effect" => decode_entity_effect,
        "map" => decode_map,
        "trade_list" => decode_trade_list,
        "declare_recipes" => decode_declare_recipes,
        "nbt_query_response" => decode_nbt_query_response,
        "tags" => decode_tags,
        _ => return None,
    })
}

// JS: `PACKET_BODIES_498` (packet-bodies-1.14.4.js)
fn body_decoder_for(name: &str) -> Option<Decoder> {
    Some(match name {
        "spawn_entity_experience_orb" => decode_spawn_entity_experience_orb,
        "spawn_entity_weather" => decode_spawn_entity_weather,
        "spawn_entity_living" => decode_spawn_entity_living,
        "spawn_entity_painting" => decode_spawn_entity_painting,
        "named_entity_spawn" => decode_named_entity_spawn,
        "animation" => decode_animation,
        "tile_entity_data" => decode_tile_entity_data,
        "block_action" => decode_block_action,
        "boss_bar" => decode_boss_bar,
        "multi_block_change" => decode_multi_block_change,
        "tab_complete" => decode_tab_complete,
        "transaction" => decode_transaction,
        "close_window" => decode_close_window,
        "craft_progress_bar" => decode_craft_progress_bar,
        "set_cooldown" => decode_set_cooldown,
        "named_sound_effect" => decode_named_sound_effect,
        "explosion" => decode_explosion,
        "game_state_change" => decode_game_state_change,
        "world_event" => decode_world_event,
        "world_particles" => decode_world_particles,
        "rel_entity_move" => decode_rel_entity_move,
        "entity_move_look" => decode_entity_move_look,
        "entity_look" => decode_entity_look,
        "entity" => decode_entity,
        "vehicle_move" => decode_vehicle_move,
        "open_sign_entity" => decode_open_sign_entity,
        "craft_recipe_response" => decode_craft_recipe_response,
        "combat_event" => decode_combat_event,
        "player_info" => decode_player_info,
        "unlock_recipes" => decode_unlock_recipes,
        "entity_destroy" => decode_entity_destroy,
        "remove_entity_effect" => decode_remove_entity_effect,
        "resource_pack_send" => decode_resource_pack_send,
        "entity_head_rotation" => decode_entity_head_rotation,
        "select_advancement_tab" => decode_select_advancement_tab,
        "world_border" => decode_world_border,
        "camera" => decode_camera,
        "scoreboard_display_objective" => decode_scoreboard_display_objective,
        "attach_entity" => decode_attach_entity,
        "entity_velocity" => decode_entity_velocity,
        "entity_equipment" => decode_entity_equipment,
        "experience" => decode_experience,
        "scoreboard_objective" => decode_scoreboard_objective,
        "set_passengers" => decode_set_passengers,
        "teams" => decode_teams,
        "scoreboard_score" => decode_scoreboard_score,
        "title" => decode_title,
        "sound_effect" => decode_sound_effect,
        "stop_sound" => decode_stop_sound,
        "playerlist_header" => decode_playerlist_header,
        "collect" => decode_collect,
        "entity_teleport" => decode_entity_teleport,
        "advancements" => decode_advancements,
        "entity_update_attributes" => decode_entity_update_attributes,
        _ => return None,
    })
}

fn decode_spawn_entity(r: &mut Reader498) -> Result<Json, BufferError> {
    // Wire order: entityId, objectUUID, type, x, y, z, pitch, yaw, objectData, velocity.
    let entity_id = r.varint()?;
    let object_uuid = r.uuid()?;
    let entity_type = r.varint()?;
    let x = r.f64()?;
    let y = r.f64()?;
    let z = r.f64()?;
    let pitch = r.angle()?;
    let yaw = r.angle()?;
    let object_data = r.i32()?;
    let velocity_x = r.i16()?;
    let velocity_y = r.i16()?;
    let velocity_z = r.i16()?;
    Ok(jobj(vec![
        ("entityId", jint(entity_id as i64)),
        ("objectUUID", jstr(&object_uuid)),
        ("type", jint(entity_type as i64)),
        ("x", jnum(x)),
        ("y", jnum(y)),
        ("z", jnum(z)),
        ("pitch", jnum(pitch)),
        ("yaw", jnum(yaw)),
        ("objectData", jint(object_data as i64)),
        ("velocity", vec3_json(velocity_x, velocity_y, velocity_z)),
    ]))
}

fn decode_statistics(r: &mut Reader498) -> Result<Json, BufferError> {
    let entries = read_array(r, |r| {
        Ok(jobj(vec![
            ("categoryId", jint(r.varint()? as i64)),
            ("statisticId", jint(r.varint()? as i64)),
            ("value", jint(r.varint()? as i64)),
        ]))
    })?;
    Ok(jobj(vec![("entries", jarr(entries))]))
}

/// JS: `declare_commands:r=>readCommandTree(r)`. The compiled
/// `crate::command_tree` kernel only exposes a whole-buffer entry point
/// without a consumed length, so this consumes the remaining bytes and
/// reports the tree as its simplified JSON string (documented deviation).
fn decode_declare_commands(r: &mut Reader498) -> Result<Json, BufferError> {
    match crate::command_tree::parse_command_tree(&r.rest()?) {
        Some(tree) => Ok(jobj(vec![("tree", jstr(&tree))])),
        None => Err(BufferError("Invalid command tree".to_string())),
    }
}

fn decode_login(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.i32()? as i64)),
        ("gameMode", jint(r.u8()? as i64)),
        ("dimension", jint(r.i32()? as i64)),
        ("maxPlayers", jint(r.u8()? as i64)),
        ("levelType", jstr(&r.string()?)),
        ("viewDistance", jint(r.varint()? as i64)),
        ("reducedDebugInfo", jbool(r.bool()?)),
    ]))
}

fn decode_respawn(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("dimension", jint(r.i32()? as i64)),
        ("gamemode", jint(r.u8()? as i64)),
        ("levelType", jstr(&r.string()?)),
    ]))
}

fn decode_difficulty(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("difficulty", jint(r.u8()? as i64)),
        ("difficultyLocked", jbool(r.bool()?)),
    ]))
}

fn decode_keep_alive(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("keepAliveId", jint(r.i64()?))]))
}

fn decode_kick_disconnect(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("reason", jstr(&r.string()?))]))
}

fn decode_chat(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("message", jstr(&r.string()?)),
        ("position", jint(r.i8()? as i64)),
    ]))
}

fn decode_custom_payload(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("channel", jstr(&r.string()?)),
        ("data", bytes_json(&r.rest()?)),
    ]))
}

fn decode_position(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("x", jnum(r.f64()?)),
        ("y", jnum(r.f64()?)),
        ("z", jnum(r.f64()?)),
        ("yaw", jnum(r.f32()? as f64)),
        ("pitch", jnum(r.f32()? as f64)),
        ("flags", jint(r.u8()? as i64)),
        ("teleportId", jint(r.varint()? as i64)),
    ]))
}

fn decode_spawn_position(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("location", position_json(&r.position()?))]))
}

fn decode_abilities(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("flags", jint(r.u8()? as i64)),
        ("flyingSpeed", jnum(r.f32()? as f64)),
        ("walkingSpeed", jnum(r.f32()? as f64)),
    ]))
}

fn decode_held_item_slot(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("slot", jint(r.i8()? as i64))]))
}

fn decode_entity_status(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.i32()? as i64)),
        ("entityStatus", jint(r.i8()? as i64)),
    ]))
}

fn decode_update_view_position(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("chunkX", jint(r.varint()? as i64)),
        ("chunkZ", jint(r.varint()? as i64)),
    ]))
}

fn decode_update_view_distance(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("viewDistance", jint(r.varint()? as i64))]))
}

fn decode_update_time(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("age", jint(r.i64()?)), ("time", jint(r.i64()?))]))
}

fn decode_update_health(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("health", jnum(r.f32()? as f64)),
        ("food", jint(r.varint()? as i64)),
        ("foodSaturation", jnum(r.f32()? as f64)),
    ]))
}

fn decode_map_chunk(r: &mut Reader498) -> Result<Json, BufferError> {
    let x = r.i32()?;
    let z = r.i32()?;
    let ground_up = r.bool()?;
    let bit_map = r.varint()?;
    let heightmaps = match r.optional_nbt()? {
        Some(root) => root_to_json(&root),
        None => jnull(),
    };
    let chunk_len = r.varint()?.max(0) as usize;
    let chunk_data = r.bytes_n(chunk_len)?;
    let block_entities = read_array(r, |r| match r.optional_nbt()? {
        Some(root) => Ok(root_to_json(&root)),
        None => Ok(jnull()),
    })?;
    Ok(jobj(vec![
        ("x", jint(x as i64)),
        ("z", jint(z as i64)),
        ("groundUp", jbool(ground_up)),
        ("bitMap", jint(bit_map as i64)),
        ("heightmaps", heightmaps),
        ("chunkData", bytes_json(&chunk_data)),
        ("blockEntities", jarr(block_entities)),
    ]))
}

fn decode_update_light(r: &mut Reader498) -> Result<Json, BufferError> {
    let chunk_x = r.varint()?;
    let chunk_z = r.varint()?;
    let sky_light_mask = r.varint()?;
    let block_light_mask = r.varint()?;
    let empty_sky_light_mask = r.varint()?;
    let empty_block_light_mask = r.varint()?;
    if !(0..=0x3ffff).contains(&empty_sky_light_mask)
        || !(0..=0x3ffff).contains(&empty_block_light_mask)
    {
        return Err(BufferError("Invalid empty light mask".to_string()));
    }
    if sky_light_mask & empty_sky_light_mask != 0 || block_light_mask & empty_block_light_mask != 0
    {
        return Err(BufferError("Conflicting light masks".to_string()));
    }
    let sky_light = light_arrays(r, sky_light_mask)?;
    let block_light = light_arrays(r, block_light_mask)?;
    Ok(jobj(vec![
        ("chunkX", jint(chunk_x as i64)),
        ("chunkZ", jint(chunk_z as i64)),
        ("skyLightMask", jint(sky_light_mask as i64)),
        ("blockLightMask", jint(block_light_mask as i64)),
        ("emptySkyLightMask", jint(empty_sky_light_mask as i64)),
        ("emptyBlockLightMask", jint(empty_block_light_mask as i64)),
        ("skyLight", light_arrays_json(&sky_light)),
        ("blockLight", light_arrays_json(&block_light)),
    ]))
}

fn decode_unload_chunk(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("chunkX", jint(r.i32()? as i64)),
        ("chunkZ", jint(r.i32()? as i64)),
    ]))
}

fn decode_block_change(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("location", position_json(&r.position()?)),
        ("state", jint(r.varint()? as i64)),
    ]))
}

fn decode_block_break_animation(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("location", position_json(&r.position()?)),
        ("destroyStage", jint(r.i8()? as i64)),
    ]))
}

fn decode_acknowledge_player_digging(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("location", position_json(&r.position()?)),
        ("block", jint(r.varint()? as i64)),
        ("status", jint(r.varint()? as i64)),
        ("successful", jbool(r.bool()?)),
    ]))
}

fn decode_entity_metadata(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("metadata", metadata_json(&r.metadata()?)),
    ]))
}

fn decode_set_slot(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("windowId", jint(r.i8()? as i64)),
        ("slot", jint(r.i16()? as i64)),
        ("item", slot_json(&r.slot()?)),
    ]))
}

fn decode_window_items(r: &mut Reader498) -> Result<Json, BufferError> {
    let window_id = r.u8()?;
    let count = r.i16()?;
    if count < 0 || count as usize > r.remaining() {
        return Err(BufferError("Invalid slot count".to_string()));
    }
    let mut items = Vec::new();
    for _ in 0..count {
        items.push(slot_json(&r.slot()?));
    }
    Ok(jobj(vec![
        ("windowId", jint(window_id as i64)),
        ("items", jarr(items)),
    ]))
}

fn decode_open_window(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("windowId", jint(r.varint()? as i64)),
        ("inventoryType", jint(r.varint()? as i64)),
        ("windowTitle", jstr(&r.string()?)),
    ]))
}

fn decode_open_horse_window(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("windowId", jint(r.u8()? as i64)),
        ("nbSlots", jint(r.varint()? as i64)),
        ("entityId", jint(r.i32()? as i64)),
    ]))
}

fn decode_open_book(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("hand", jint(r.varint()? as i64))]))
}

fn decode_entity_sound_effect(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("soundId", jint(r.varint()? as i64)),
        ("soundCategory", jint(r.varint()? as i64)),
        ("entityId", jint(r.varint()? as i64)),
        ("volume", jnum(r.f32()? as f64)),
        ("pitch", jnum(r.f32()? as f64)),
    ]))
}

fn decode_entity_effect(r: &mut Reader498) -> Result<Json, BufferError> {
    let entity_id = r.varint()?;
    let effect_id = r.u8()?;
    let amplifier = r.u8()?;
    let duration = r.varint()?;
    let flags = r.u8()?;
    Ok(jobj(vec![
        ("entityId", jint(entity_id as i64)),
        ("effectId", jint(effect_id as i64)),
        ("amplifier", jint(amplifier as i64)),
        ("duration", jint(duration as i64)),
        ("flags", jint(flags as i64)),
        ("ambient", jbool(flags & 1 != 0)),
        ("hideParticles", jbool(flags & 2 == 0)),
        ("showIcon", jbool(flags & 4 != 0)),
    ]))
}

fn decode_map(r: &mut Reader498) -> Result<Json, BufferError> {
    let item_damage = r.varint()?;
    let scale = r.i8()?;
    let tracking_position = r.bool()?;
    let locked = r.bool()?;
    let icons = read_array(r, |r| {
        Ok(jobj(vec![
            ("type", jint(r.varint()? as i64)),
            ("x", jint(r.i8()? as i64)),
            ("z", jint(r.i8()? as i64)),
            ("direction", jint(r.u8()? as i64)),
            (
                "displayName",
                if r.bool()? { jstr(&r.string()?) } else { jnull() },
            ),
        ]))
    })?;
    let columns = r.u8()?;
    let mut extra: Vec<(&str, Json)> = Vec::new();
    if columns != 0 {
        let rows = r.u8()?;
        let x = r.u8()?;
        let y = r.u8()?;
        let data_len = r.varint()?.max(0) as usize;
    let data = r.bytes_n(data_len)?;
        if columns > 128
            || rows > 128
            || x as u32 + columns as u32 > 128
            || y as u32 + rows as u32 > 128
            || data.len() != columns as usize * rows as usize
        {
            return Err(BufferError("Invalid map rectangle".to_string()));
        }
        extra.push(("rows", jint(rows as i64)));
        extra.push(("x", jint(x as i64)));
        extra.push(("y", jint(y as i64)));
        extra.push(("data", bytes_json(&data)));
    }
    let mut fields = vec![
        ("itemDamage", jint(item_damage as i64)),
        ("scale", jint(scale as i64)),
        ("trackingPosition", jbool(tracking_position)),
        ("locked", jbool(locked)),
        ("icons", jarr(icons)),
        ("columns", jint(columns as i64)),
    ];
    fields.extend(extra);
    Ok(jobj(fields))
}

fn decode_trade_list(r: &mut Reader498) -> Result<Json, BufferError> {
    let window_id = r.varint()?;
    let count = r.u8()?;
    let mut trades = Vec::new();
    for _ in 0..count {
        let a = r.slot()?;
        let out = r.slot()?;
        let b = if r.bool()? { r.slot()? } else { None };
        trades.push(jobj(vec![
            ("a", slot_json(&a)),
            ("out", slot_json(&out)),
            ("b", slot_json(&b)),
            ("disabled", jbool(r.bool()?)),
            ("uses", jint(r.i32()? as i64)),
            ("max", jint(r.i32()? as i64)),
            ("xp", jint(r.i32()? as i64)),
            ("specialPrice", jint(r.i32()? as i64)),
            ("priceMultiplier", jnum(r.f32()? as f64)),
            ("demand", jint(r.i32()? as i64)),
        ]));
    }
    Ok(jobj(vec![
        ("windowId", jint(window_id as i64)),
        ("trades", jarr(trades)),
        ("villagerLevel", jint(r.varint()? as i64)),
        ("experience", jint(r.varint()? as i64)),
        ("isRegularVillager", jbool(r.bool()?)),
        ("canRestock", jbool(r.bool()?)),
    ]))
}

/// JS: `declare_recipes:r=>({recipes:readRecipes(r,498)})`. The compiled
/// `crate::recipes` kernel only exposes a whole-buffer entry point without a
/// consumed length, so this consumes the remaining bytes and reports the
/// recipes as their simplified JSON string (documented deviation).
fn decode_declare_recipes(r: &mut Reader498) -> Result<Json, BufferError> {
    match crate::recipes::parse_recipes(&r.rest()?, 498) {
        Some(recipes) => Ok(jobj(vec![("recipes", jstr(&recipes))])),
        None => Err(BufferError("Invalid recipes".to_string())),
    }
}

fn decode_nbt_query_response(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("transactionId", jint(r.varint()? as i64)),
        (
            "nbt",
            match r.optional_nbt()? {
                Some(root) => root_to_json(&root),
                None => jnull(),
            },
        ),
    ]))
}

fn decode_tags(r: &mut Reader498) -> Result<Json, BufferError> {
    let mut tags = Vec::new();
    for kind in ["blocks", "items", "fluids", "entities"] {
        let entries = read_array(r, |r| {
            let name = r.string()?;
            let values = read_array(r, |r| Ok(r.varint()?))?;
            Ok((name, jarr(values.into_iter().map(|value| jint(value as i64)).collect())))
        })?;
        tags.push((
            kind,
            jobj(entries.iter().map(|(name, values)| (name.as_str(), values.clone())).collect()),
        ));
    }
    Ok(jobj(vec![("tags", jobj(tags))]))
}

// ------------------------------------------------------- packet bodies (498)

fn decode_spawn_entity_experience_orb(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("x", jnum(r.f64()?)),
        ("y", jnum(r.f64()?)),
        ("z", jnum(r.f64()?)),
        ("count", jint(r.i16()? as i64)),
    ]))
}

fn decode_spawn_entity_weather(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("type", jint(r.i8()? as i64)),
        ("x", jnum(r.f64()?)),
        ("y", jnum(r.f64()?)),
        ("z", jnum(r.f64()?)),
    ]))
}

fn decode_spawn_entity_living(r: &mut Reader498) -> Result<Json, BufferError> {
    let entity_id = r.varint()?;
    let entity_uuid = r.uuid()?;
    let entity_type = r.varint()?;
    let x = r.f64()?;
    let y = r.f64()?;
    let z = r.f64()?;
    let yaw = r.angle()?;
    let pitch = r.angle()?;
    let head_pitch = r.angle()?;
    let velocity_x = r.i16()?;
    let velocity_y = r.i16()?;
    let velocity_z = r.i16()?;
    let metadata = r.metadata()?;
    Ok(jobj(vec![
        ("entityId", jint(entity_id as i64)),
        ("entityUUID", jstr(&entity_uuid)),
        ("type", jint(entity_type as i64)),
        ("x", jnum(x)),
        ("y", jnum(y)),
        ("z", jnum(z)),
        ("yaw", jnum(yaw)),
        ("pitch", jnum(pitch)),
        ("headPitch", jnum(head_pitch)),
        ("velocity", vec3_json(velocity_x, velocity_y, velocity_z)),
        ("metadata", metadata_json(&metadata)),
    ]))
}

fn decode_spawn_entity_painting(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("entityUUID", jstr(&r.uuid()?)),
        ("title", jint(r.varint()? as i64)),
        ("location", position_json(&r.position()?)),
        ("direction", jint(r.u8()? as i64)),
    ]))
}

fn decode_named_entity_spawn(r: &mut Reader498) -> Result<Json, BufferError> {
    let entity_id = r.varint()?;
    let player_uuid = r.uuid()?;
    let x = r.f64()?;
    let y = r.f64()?;
    let z = r.f64()?;
    let yaw = r.angle()?;
    let pitch = r.angle()?;
    let metadata = r.metadata()?;
    Ok(jobj(vec![
        ("entityId", jint(entity_id as i64)),
        ("playerUUID", jstr(&player_uuid)),
        ("x", jnum(x)),
        ("y", jnum(y)),
        ("z", jnum(z)),
        ("yaw", jnum(yaw)),
        ("pitch", jnum(pitch)),
        ("metadata", metadata_json(&metadata)),
    ]))
}

fn decode_animation(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("animation", jint(r.u8()? as i64)),
    ]))
}

fn decode_tile_entity_data(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("location", position_json(&r.position()?)),
        ("action", jint(r.u8()? as i64)),
        (
            "nbtData",
            match r.optional_nbt()? {
                Some(root) => root_to_json(&root),
                None => jnull(),
            },
        ),
    ]))
}

fn decode_block_action(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("location", position_json(&r.position()?)),
        ("byte1", jint(r.u8()? as i64)),
        ("byte2", jint(r.u8()? as i64)),
        ("blockId", jint(r.varint()? as i64)),
    ]))
}

fn decode_boss_bar(r: &mut Reader498) -> Result<Json, BufferError> {
    let uuid = r.uuid()?;
    let action = r.varint()?;
    let mut fields = vec![("uuid", jstr(&uuid)), ("action", jint(action as i64))];
    if action == 0 {
        fields.push(("title", jstr(&r.string()?)));
        fields.push(("health", jnum(r.f32()? as f64)));
        fields.push(("color", jint(r.varint()? as i64)));
        fields.push(("dividers", jint(r.varint()? as i64)));
        fields.push(("flags", jint(r.u8()? as i64)));
    } else if action == 2 {
        fields.push(("health", jnum(r.f32()? as f64)));
    } else if action == 3 {
        fields.push(("title", jstr(&r.string()?)));
    } else if action == 4 {
        fields.push(("color", jint(r.varint()? as i64)));
        fields.push(("dividers", jint(r.varint()? as i64)));
    } else if action == 5 {
        fields.push(("flags", jint(r.u8()? as i64)));
    }
    Ok(jobj(fields))
}

fn decode_multi_block_change(r: &mut Reader498) -> Result<Json, BufferError> {
    let chunk_x = r.i32()?;
    let chunk_z = r.i32()?;
    let n = r.varint()?;
    let mut records = Vec::new();
    for _ in 0..n {
        let h = r.u8()?;
        let y = r.u8()?;
        records.push(jobj(vec![
            ("x", jint((h >> 4) as i64)),
            ("z", jint((h & 15) as i64)),
            ("y", jint(y as i64)),
            ("state", jint(r.varint()? as i64)),
        ]));
    }
    Ok(jobj(vec![
        ("chunkX", jint(chunk_x as i64)),
        ("chunkZ", jint(chunk_z as i64)),
        ("records", jarr(records)),
    ]))
}

fn decode_tab_complete(r: &mut Reader498) -> Result<Json, BufferError> {
    let transaction_id = r.varint()?;
    let start = r.varint()?;
    let length = r.varint()?;
    let n = r.varint()?;
    let mut matches = Vec::new();
    for _ in 0..n {
        matches.push(jobj(vec![
            ("match", jstr(&r.string()?)),
            ("tooltip", if r.bool()? { jstr(&r.string()?) } else { jnull() }),
        ]));
    }
    Ok(jobj(vec![
        ("transactionId", jint(transaction_id as i64)),
        ("start", jint(start as i64)),
        ("length", jint(length as i64)),
        ("matches", jarr(matches)),
    ]))
}

fn decode_transaction(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("windowId", jint(r.i8()? as i64)),
        ("action", jint(r.i16()? as i64)),
        ("accepted", jbool(r.bool()?)),
    ]))
}

fn decode_close_window(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("windowId", jint(r.u8()? as i64))]))
}

fn decode_craft_progress_bar(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("windowId", jint(r.u8()? as i64)),
        ("property", jint(r.i16()? as i64)),
        ("value", jint(r.i16()? as i64)),
    ]))
}

fn decode_set_cooldown(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("itemId", jint(r.varint()? as i64)),
        ("cooldownTicks", jint(r.varint()? as i64)),
    ]))
}

fn decode_named_sound_effect(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("soundName", jstr(&r.string()?)),
        ("soundCategory", jint(r.varint()? as i64)),
        ("x", jnum(r.i32()? as f64 / 8.0)),
        ("y", jnum(r.i32()? as f64 / 8.0)),
        ("z", jnum(r.i32()? as f64 / 8.0)),
        ("volume", jnum(r.f32()? as f64)),
        ("pitch", jnum(r.f32()? as f64)),
    ]))
}

fn decode_explosion(r: &mut Reader498) -> Result<Json, BufferError> {
    let x = r.f32()?;
    let y = r.f32()?;
    let z = r.f32()?;
    let radius = r.f32()?;
    let n = r.i32()?;
    let mut records = Vec::new();
    for _ in 0..n {
        records.push(jobj(vec![
            ("x", jint(r.i8()? as i64)),
            ("y", jint(r.i8()? as i64)),
            ("z", jint(r.i8()? as i64)),
        ]));
    }
    Ok(jobj(vec![
        ("x", jnum(x as f64)),
        ("y", jnum(y as f64)),
        ("z", jnum(z as f64)),
        ("radius", jnum(radius as f64)),
        ("records", jarr(records)),
        ("motionX", jnum(r.f32()? as f64)),
        ("motionY", jnum(r.f32()? as f64)),
        ("motionZ", jnum(r.f32()? as f64)),
    ]))
}

fn decode_game_state_change(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("reason", jint(r.u8()? as i64)),
        ("value", jnum(r.f32()? as f64)),
    ]))
}

fn decode_world_event(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("effectId", jint(r.i32()? as i64)),
        ("location", position_json(&r.position()?)),
        ("data", jint(r.i32()? as i64)),
        ("global", jbool(r.bool()?)),
    ]))
}

fn decode_world_particles(r: &mut Reader498) -> Result<Json, BufferError> {
    let particle_id = r.i32()?;
    let long_distance = r.bool()?;
    let x = r.f32()?;
    let y = r.f32()?;
    let z = r.f32()?;
    let offset_x = r.f32()?;
    let offset_y = r.f32()?;
    let offset_z = r.f32()?;
    let particle_data = r.f32()?;
    let particles = r.i32()?;
    let data = r.particle_data(particle_id)?;
    Ok(jobj(vec![
        ("particleId", jint(particle_id as i64)),
        ("longDistance", jbool(long_distance)),
        ("x", jnum(x as f64)),
        ("y", jnum(y as f64)),
        ("z", jnum(z as f64)),
        ("offsetX", jnum(offset_x as f64)),
        ("offsetY", jnum(offset_y as f64)),
        ("offsetZ", jnum(offset_z as f64)),
        ("particleData", jnum(particle_data as f64)),
        ("particles", jint(particles as i64)),
        ("data", particle_data_json(&data)),
    ]))
}

fn decode_rel_entity_move(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("dX", jnum(r.i16()? as f64 / 4096.0)),
        ("dY", jnum(r.i16()? as f64 / 4096.0)),
        ("dZ", jnum(r.i16()? as f64 / 4096.0)),
        ("onGround", jbool(r.bool()?)),
    ]))
}

fn decode_entity_move_look(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("dX", jnum(r.i16()? as f64 / 4096.0)),
        ("dY", jnum(r.i16()? as f64 / 4096.0)),
        ("dZ", jnum(r.i16()? as f64 / 4096.0)),
        ("yaw", jnum(r.angle()?)),
        ("pitch", jnum(r.angle()?)),
        ("onGround", jbool(r.bool()?)),
    ]))
}

fn decode_entity_look(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("yaw", jnum(r.angle()?)),
        ("pitch", jnum(r.angle()?)),
        ("onGround", jbool(r.bool()?)),
    ]))
}

fn decode_entity(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("entityId", jint(r.varint()? as i64))]))
}

fn decode_vehicle_move(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("x", jnum(r.f64()?)),
        ("y", jnum(r.f64()?)),
        ("z", jnum(r.f64()?)),
        ("yaw", jnum(r.f32()? as f64)),
        ("pitch", jnum(r.f32()? as f64)),
    ]))
}

fn decode_open_sign_entity(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("location", position_json(&r.position()?))]))
}

fn decode_craft_recipe_response(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("windowId", jint(r.i8()? as i64)),
        ("recipe", jstr(&r.string()?)),
    ]))
}

fn decode_combat_event(r: &mut Reader498) -> Result<Json, BufferError> {
    let event = r.varint()?;
    let mut fields = vec![("event", jint(event as i64))];
    if event == 1 {
        fields.push(("duration", jint(r.varint()? as i64)));
        fields.push(("entityId", jint(r.i32()? as i64)));
    }
    if event == 2 {
        fields.push(("playerId", jint(r.varint()? as i64)));
        fields.push(("entityId", jint(r.i32()? as i64)));
        fields.push(("message", jstr(&r.string()?)));
    }
    Ok(jobj(fields))
}

fn decode_player_info(r: &mut Reader498) -> Result<Json, BufferError> {
    let action = r.varint()?;
    let n = r.varint()?;
    let mut data = Vec::new();
    for _ in 0..n {
        let uuid = r.uuid()?;
        let mut fields = vec![("uuid", jstr(&uuid))];
        if action == 0 {
            fields.push(("name", jstr(&r.string()?)));
            let properties_count = r.varint()?;
            let mut properties = Vec::new();
            for _ in 0..properties_count {
                let name = r.string()?;
                let value = r.string()?;
                let mut property = vec![("name", jstr(&name)), ("value", jstr(&value))];
                if r.bool()? {
                    property.push(("signature", jstr(&r.string()?)));
                }
                properties.push(jobj(property));
            }
            fields.push(("properties", jarr(properties)));
            fields.push(("gamemode", jint(r.varint()? as i64)));
            fields.push(("ping", jint(r.varint()? as i64)));
            if r.bool()? {
                fields.push(("displayName", jstr(&r.string()?)));
            }
        } else if action == 1 {
            fields.push(("gamemode", jint(r.varint()? as i64)));
        } else if action == 2 {
            fields.push(("ping", jint(r.varint()? as i64)));
        } else if action == 3 {
            fields.push((
                "displayName",
                if r.bool()? { jstr(&r.string()?) } else { jnull() },
            ));
        }
        data.push(jobj(fields));
    }
    Ok(jobj(vec![("action", jint(action as i64)), ("data", jarr(data))]))
}

fn decode_unlock_recipes(r: &mut Reader498) -> Result<Json, BufferError> {
    let action = r.varint()?;
    let mut fields = vec![
        ("action", jint(action as i64)),
        ("craftingBookOpen", jbool(r.bool()?)),
        ("filteringCraftable", jbool(r.bool()?)),
        ("smeltingBookOpen", jbool(r.bool()?)),
        ("filteringSmeltable", jbool(r.bool()?)),
        (
            "recipes",
            jarr(strings(r)?.into_iter().map(|value| jstr(&value)).collect()),
        ),
    ];
    if action == 0 {
        fields.push((
            "recipesToHighlight",
            jarr(strings(r)?.into_iter().map(|value| jstr(&value)).collect()),
        ));
    }
    Ok(jobj(fields))
}

fn decode_entity_destroy(r: &mut Reader498) -> Result<Json, BufferError> {
    let n = r.varint()?;
    let mut entity_ids = Vec::new();
    for _ in 0..n {
        entity_ids.push(jint(r.varint()? as i64));
    }
    Ok(jobj(vec![("entityIds", jarr(entity_ids))]))
}

fn decode_remove_entity_effect(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("effectId", jint(r.i8()? as i64)),
    ]))
}

fn decode_resource_pack_send(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("url", jstr(&r.string()?)),
        ("hash", jstr(&r.string()?)),
    ]))
}

fn decode_entity_head_rotation(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("headYaw", jnum(r.angle()?)),
    ]))
}

fn decode_select_advancement_tab(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("id", if r.bool()? { jstr(&r.string()?) } else { jnull() })]))
}

fn decode_world_border(r: &mut Reader498) -> Result<Json, BufferError> {
    let action = r.varint()?;
    let mut fields = vec![("action", jint(action as i64))];
    match action {
        0 => fields.push(("radius", jnum(r.f64()?))),
        1 => {
            fields.push(("oldRadius", jnum(r.f64()?)));
            fields.push(("newRadius", jnum(r.f64()?)));
            fields.push(("speed", jint(r.varlong()?)));
        }
        2 => {
            fields.push(("x", jnum(r.f64()?)));
            fields.push(("z", jnum(r.f64()?)));
        }
        3 => {
            fields.push(("x", jnum(r.f64()?)));
            fields.push(("z", jnum(r.f64()?)));
            fields.push(("oldRadius", jnum(r.f64()?)));
            fields.push(("newRadius", jnum(r.f64()?)));
            fields.push(("speed", jint(r.varlong()?)));
            fields.push(("portalBoundary", jint(r.varint()? as i64)));
            fields.push(("warningTime", jint(r.varint()? as i64)));
            fields.push(("warningBlocks", jint(r.varint()? as i64)));
        }
        4 => fields.push(("warningTime", jint(r.varint()? as i64))),
        5 => fields.push(("warningBlocks", jint(r.varint()? as i64))),
        _ => {}
    }
    Ok(jobj(fields))
}

fn decode_camera(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![("cameraId", jint(r.varint()? as i64))]))
}

fn decode_scoreboard_display_objective(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("position", jint(r.i8()? as i64)),
        ("objective", jstr(&r.string()?)),
    ]))
}

fn decode_attach_entity(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.i32()? as i64)),
        ("vehicleId", jint(r.i32()? as i64)),
    ]))
}

fn decode_entity_velocity(r: &mut Reader498) -> Result<Json, BufferError> {
    let x = r.i16()?;
    let y = r.i16()?;
    let z = r.i16()?;
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("velocity", vec3_json(x, y, z)),
    ]))
}

fn decode_entity_equipment(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("slot", jint(r.varint()? as i64)),
        ("item", slot_json(&r.slot()?)),
    ]))
}

fn decode_experience(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("experienceBar", jnum(r.f32()? as f64)),
        ("level", jint(r.varint()? as i64)),
        ("totalExperience", jint(r.varint()? as i64)),
    ]))
}

fn decode_scoreboard_objective(r: &mut Reader498) -> Result<Json, BufferError> {
    let objective = r.string()?;
    let action = r.i8()?;
    let mut fields = vec![
        ("objective", jstr(&objective)),
        ("action", jint(action as i64)),
    ];
    if action == 0 || action == 2 {
        fields.push(("displayText", jstr(&r.string()?)));
        fields.push(("type", jint(r.varint()? as i64)));
    }
    Ok(jobj(fields))
}

fn decode_set_passengers(r: &mut Reader498) -> Result<Json, BufferError> {
    let entity_id = r.varint()?;
    let n = r.varint()?;
    let mut passengers = Vec::new();
    for _ in 0..n {
        passengers.push(jint(r.varint()? as i64));
    }
    Ok(jobj(vec![
        ("entityId", jint(entity_id as i64)),
        ("passengers", jarr(passengers)),
    ]))
}

fn decode_teams(r: &mut Reader498) -> Result<Json, BufferError> {
    let team = r.string()?;
    let mode = r.i8()?;
    let mut fields = vec![("team", jstr(&team)), ("mode", jint(mode as i64))];
    if mode == 0 || mode == 2 {
        fields.push(("displayName", jstr(&r.string()?)));
        fields.push(("friendlyFire", jint(r.i8()? as i64)));
        fields.push(("nameTagVisibility", jstr(&r.string()?)));
        fields.push(("collisionRule", jstr(&r.string()?)));
        fields.push(("color", jint(r.varint()? as i64)));
        fields.push(("prefix", jstr(&r.string()?)));
        fields.push(("suffix", jstr(&r.string()?)));
    }
    if mode == 0 || mode == 3 || mode == 4 {
        fields.push((
            "players",
            jarr(strings(r)?.into_iter().map(|value| jstr(&value)).collect()),
        ));
    }
    // JS body quirk: this decoder labels itself `scoreboard_team`, which
    // overrides the id-table name in the spread `{name, id, ...body}`.
    fields.push(("name", jstr("scoreboard_team")));
    Ok(jobj(fields))
}

fn decode_scoreboard_score(r: &mut Reader498) -> Result<Json, BufferError> {
    let item_name = r.string()?;
    let action = r.varint()?;
    let score_name = r.string()?;
    let mut fields = vec![
        ("itemName", jstr(&item_name)),
        ("action", jint(action as i64)),
        ("scoreName", jstr(&score_name)),
    ];
    if action != 1 {
        fields.push(("value", jint(r.varint()? as i64)));
    }
    Ok(jobj(fields))
}

fn decode_title(r: &mut Reader498) -> Result<Json, BufferError> {
    let action = r.varint()?;
    let mut fields = vec![("action", jint(action as i64))];
    if action <= 2 {
        fields.push(("text", jstr(&r.string()?)));
    }
    if action == 3 {
        fields.push(("fadeIn", jint(r.i32()? as i64)));
        fields.push(("stay", jint(r.i32()? as i64)));
        fields.push(("fadeOut", jint(r.i32()? as i64)));
    }
    Ok(jobj(fields))
}

fn decode_sound_effect(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("soundId", jint(r.varint()? as i64)),
        ("soundCategory", jint(r.varint()? as i64)),
        ("x", jnum(r.i32()? as f64 / 8.0)),
        ("y", jnum(r.i32()? as f64 / 8.0)),
        ("z", jnum(r.i32()? as f64 / 8.0)),
        ("volume", jnum(r.f32()? as f64)),
        ("pitch", jnum(r.f32()? as f64)),
    ]))
}

fn decode_stop_sound(r: &mut Reader498) -> Result<Json, BufferError> {
    let flags = r.i8()?;
    Ok(jobj(vec![
        ("flags", jint(flags as i64)),
        ("source", if flags & 1 != 0 { jint(r.varint()? as i64) } else { jnull() }),
        ("sound", if flags & 2 != 0 { jstr(&r.string()?) } else { jnull() }),
    ]))
}

fn decode_playerlist_header(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("header", jstr(&r.string()?)),
        ("footer", jstr(&r.string()?)),
    ]))
}

fn decode_collect(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("collectedEntityId", jint(r.varint()? as i64)),
        ("collectorEntityId", jint(r.varint()? as i64)),
        ("pickupItemCount", jint(r.varint()? as i64)),
    ]))
}

fn decode_entity_teleport(r: &mut Reader498) -> Result<Json, BufferError> {
    Ok(jobj(vec![
        ("entityId", jint(r.varint()? as i64)),
        ("x", jnum(r.f64()?)),
        ("y", jnum(r.f64()?)),
        ("z", jnum(r.f64()?)),
        ("yaw", jnum(r.angle()?)),
        ("pitch", jnum(r.angle()?)),
        ("onGround", jbool(r.bool()?)),
    ]))
}

fn decode_advancements(r: &mut Reader498) -> Result<Json, BufferError> {
    let reset = r.bool()?;
    let n = r.varint()?;
    let mut added = Vec::new();
    for _ in 0..n {
        let id = r.string()?;
        let parent = if r.bool()? { Some(r.string()?) } else { None };
        let display = if r.bool()? {
            let title = r.string()?;
            let description = r.string()?;
            let icon = r.slot()?;
            let frame = r.varint()?;
            let flags = r.i32()?;
            let background = if flags & 1 != 0 { Some(r.string()?) } else { None };
            let x = r.f32()?;
            let y = r.f32()?;
            Some(jobj(vec![
                ("title", jstr(&title)),
                ("description", jstr(&description)),
                ("icon", slot_json(&icon)),
                ("frame", jint(frame as i64)),
                ("flags", jint(flags as i64)),
                (
                    "background",
                    match background {
                        Some(background) => jstr(&background),
                        None => jnull(),
                    },
                ),
                ("showToast", jbool(flags & 2 != 0)),
                ("hidden", jbool(flags & 4 != 0)),
                ("x", jnum(x as f64)),
                ("y", jnum(y as f64)),
            ]))
        } else {
            None
        };
        let criteria = strings(r)?;
        let requirement_count = r.varint()?;
        let mut requirements = Vec::new();
        for _ in 0..requirement_count {
            requirements.push(jarr(
                strings(r)?.into_iter().map(|value| jstr(&value)).collect(),
            ));
        }
        added.push(jobj(vec![
            ("id", jstr(&id)),
            (
                "parent",
                match parent {
                    Some(parent) => jstr(&parent),
                    None => jnull(),
                },
            ),
            (
                "display",
                match display {
                    Some(display) => display,
                    None => jnull(),
                },
            ),
            (
                "criteria",
                jarr(criteria.into_iter().map(|value| jstr(&value)).collect()),
            ),
            ("requirements", jarr(requirements)),
        ]));
    }
    let removed = strings(r)?;
    let progress_count = r.varint()?;
    let mut progress = Vec::new();
    for _ in 0..progress_count {
        let id = r.string()?;
        let criterion_count = r.varint()?;
        let mut criteria = Vec::new();
        for _ in 0..criterion_count {
            let key = r.string()?;
            let value = if r.bool()? { jint(r.i64()?) } else { jnull() };
            criteria.push((key, value));
        }
        progress.push(jobj(vec![("id", jstr(&id)), ("criteria", Json::Obj(criteria))]));
    }
    Ok(jobj(vec![
        ("reset", jbool(reset)),
        ("added", jarr(added)),
        (
            "removed",
            jarr(removed.into_iter().map(|value| jstr(&value)).collect()),
        ),
        ("progress", jarr(progress)),
    ]))
}

fn decode_entity_update_attributes(r: &mut Reader498) -> Result<Json, BufferError> {
    let entity_id = r.varint()?;
    let n = r.i32()?;
    let mut properties = Vec::new();
    for _ in 0..n {
        let key = r.string()?;
        let value = r.f64()?;
        let modifier_count = r.varint()?;
        let mut modifiers = Vec::new();
        for _ in 0..modifier_count {
            modifiers.push(jobj(vec![
                ("uuid", jstr(&r.uuid()?)),
                ("amount", jnum(r.f64()?)),
                ("operation", jint(r.i8()? as i64)),
            ]));
        }
        properties.push(jobj(vec![
            ("key", jstr(&key)),
            ("value", jnum(value)),
            ("modifiers", jarr(modifiers)),
        ]));
    }
    // JS body quirk: this decoder labels itself `update_attributes`, which
    // overrides the id-table name `entity_update_attributes`.
    Ok(jobj(vec![
        ("entityId", jint(entity_id as i64)),
        ("properties", jarr(properties)),
        ("name", jstr("update_attributes")),
    ]))
}

// ------------------------------------------------------------- decodePacket498

/// JS `decodePacket498` result: a decoded packet object or the
/// `{name:'unsupported', packetName, id, data}` fallback.
#[derive(Debug, Clone, PartialEq)]
pub enum Decoded498 {
    Packet { id: i32, name: String, body: Json },
    Unsupported { id: i32, packet_name: Option<String>, data: Vec<u8> },
}

/// JS:
/// `const r=new Reader498(bytes),id=r.varint(),name=names[id];`
/// `const body = decoders[name] ? decoders[name](r) : PACKET_BODIES_498[name] ? PACKET_BODIES_498[name](r) : null;`
/// `if(!body)return {name:'unsupported',packetName:name||null,id,data:r.rest()};`
/// `const p={name,id,...body};`
/// `if(r.remaining())throw new Error(\`Trailing data in 498 ${name}: ${r.remaining()} bytes\`);`
pub fn decode_packet_498(bytes: &[u8]) -> Result<Decoded498, BufferError> {
    let mut r = Reader498::new(bytes);
    let id = r.varint()?;
    let name = name_for_id(CLIENTBOUND_498, id);
    let fields = match name {
        Some(name) => match decoder_for(name).or_else(|| body_decoder_for(name)) {
            Some(decode) => Some((name, decode(&mut r)?)),
            None => None,
        },
        None => None,
    };
    match fields {
        Some((name, fields)) => {
            check_no_trailing("498", name, r.remaining())?;
            let mut pairs = vec![
                ("name".to_string(), jstr(name)),
                ("id".to_string(), jint(id as i64)),
            ];
            if let Json::Obj(body_pairs) = fields {
                pairs.extend(body_pairs);
            }
            Ok(Decoded498::Packet { id, name: name.to_string(), body: Json::Obj(pairs) })
        }
        None => Ok(Decoded498::Unsupported {
            id,
            packet_name: name.map(|name| name.to_string()),
            data: r.rest()?,
        }),
    }
}

fn decoded_to_json(decoded: &Decoded498) -> Json {
    match decoded {
        Decoded498::Packet { body, .. } => body.clone(),
        Decoded498::Unsupported { id, packet_name, data } => jobj(vec![
            ("name", jstr("unsupported")),
            (
                "packetName",
                match packet_name {
                    Some(name) => jstr(name),
                    None => jnull(),
                },
            ),
            ("id", jint(*id as i64)),
            ("data", bytes_json(data)),
        ]),
    }
}

/// Wasm boundary: the decoded packet object as JSON (the JS callers consume a
/// plain object; `crate::recipes` established the JSON-string convention).
#[wasm_bindgen]
pub fn decode_packet_498_json(bytes: &[u8]) -> Result<String, JsValue> {
    let decoded = decode_packet_498(bytes)?;
    Ok(crate::protocol::json_string(&decoded_to_json(&decoded)))
}

// ------------------------------------------------------------- C498

/// JS: `const packet=name=>new Writer498().varint(OUT[name]);`
/// (An unknown name is a Rust `Err` instead of the JS `varint(undefined)` -> 0.)
fn packet_498(name: &str) -> Result<Writer498, BufferError> {
    let mut writer = Writer498::new();
    match id_for_name(SERVERBOUND_498, name) {
        Some(id) => {
            writer.varint(id);
            Ok(writer)
        }
        None => Err(BufferError(format!("Unknown 498 packet {name}"))),
    }
}

fn index_of(value: &str, values: &[&str]) -> i32 {
    values
        .iter()
        .position(|candidate| *candidate == value)
        .map(|index| index as i32)
        .unwrap_or(-1)
}

/// JS `export const C498={...}` (including `...technicalPackets(packet)`).
pub struct C498;

impl C498 {
    /// JS: `queryBlockNbt:(id,pos)=>packet('query_block_nbt').varint(id).position(pos.x,pos.y,pos.z).build()`
    pub fn query_block_nbt(id: i32, x: i32, y: i32, z: i32) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("query_block_nbt")?;
        writer.varint(id);
        writer.position(x, y, z)?;
        Ok(writer.build())
    }

    /// JS: `queryEntityNbt:(id,entityId)=>packet('query_entity_nbt').varint(id).varint(entityId).build()`
    pub fn query_entity_nbt(id: i32, entity_id: i32) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("query_entity_nbt")?;
        writer.varint(id);
        writer.varint(entity_id);
        Ok(writer.build())
    }

    /// JS `technicalPackets`: `updateCommandBlock:(pos,command,mode,track,conditional,automatic)=>`
    /// `packet('update_command_block').position(pos.x,pos.y,pos.z).string(command)`
    /// `.varint(['SEQUENCE','AUTO','REDSTONE'].indexOf(mode))`
    /// `.u8((track?1:0)|(conditional?2:0)|(automatic?4:0)).build()`
    #[allow(clippy::too_many_arguments)]
    pub fn update_command_block(
        x: i32,
        y: i32,
        z: i32,
        command: &str,
        mode: &str,
        track: bool,
        conditional: bool,
        automatic: bool,
    ) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("update_command_block")?;
        writer.position(x, y, z)?;
        writer.string(command);
        writer.varint(index_of(mode, &["SEQUENCE", "AUTO", "REDSTONE"]));
        writer.u8((track as u8) | ((conditional as u8) << 1) | ((automatic as u8) << 2));
        Ok(writer.build())
    }

    /// JS: `updateCommandMinecart:(id,command,track)=>packet('update_command_block_minecart').varint(id).string(command).bool(track).build()`
    pub fn update_command_minecart(
        id: i32,
        command: &str,
        track: bool,
    ) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("update_command_block_minecart")?;
        writer.varint(id);
        writer.string(command);
        writer.bool(track);
        Ok(writer.build())
    }

    /// JS `updateStructure(pos,action,t)` for `update_structure_block`.
    #[allow(clippy::too_many_arguments)]
    pub fn update_structure(
        x: i32,
        y: i32,
        z: i32,
        action: i32,
        mode: &str,
        name: &str,
        pos_x: i8,
        pos_y: i8,
        pos_z: i8,
        size_x: i8,
        size_y: i8,
        size_z: i8,
        mirror: &str,
        rotation: &str,
        metadata: &str,
        integrity: f32,
        seed: i64,
        ignore_entities: bool,
        show_air: bool,
        show_bounding_box: bool,
    ) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("update_structure_block")?;
        writer.position(x, y, z)?;
        writer.varint(action - 1);
        writer.varint(index_of(mode, &["SAVE", "LOAD", "CORNER", "DATA"]));
        writer.string(name);
        for value in [pos_x, pos_y, pos_z, size_x, size_y, size_z] {
            writer.i8(value);
        }
        writer.varint(index_of(mirror, &["NONE", "LEFT_RIGHT", "FRONT_BACK"]));
        writer.varint(index_of(
            rotation,
            &["NONE", "CLOCKWISE_90", "CLOCKWISE_180", "COUNTERCLOCKWISE_90"],
        ));
        writer.string(metadata);
        writer.f32(integrity);
        writer.varlong(seed);
        writer.u8(
            (ignore_entities as u8) | ((show_air as u8) << 1) | ((show_bounding_box as u8) << 2),
        );
        Ok(writer.build())
    }

    /// JS: `editBook:(item,sign,hand)=>packet('edit_book').slot(item).bool(sign).varint(hand).build()`
    pub fn edit_book(
        item: Option<&Slot>,
        sign: bool,
        hand: i32,
    ) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("edit_book")?;
        writer.slot(item);
        writer.bool(sign);
        writer.varint(hand);
        Ok(writer.build())
    }

    /// JS: `teleportConfirm:id=>packet('teleport_confirm').varint(id).build()`
    pub fn teleport_confirm(id: i32) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("teleport_confirm")?;
        writer.varint(id);
        Ok(writer.build())
    }

    /// JS: `keepAlive:id=>packet('keep_alive').i64(id).build()`
    pub fn keep_alive(id: i64) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("keep_alive")?;
        writer.i64(id);
        Ok(writer.build())
    }

    /// JS: `settings:(locale='en_us',distance=4)=>packet('settings').string(locale).i8(distance).varint(0).bool(true).u8(127).varint(1).build()`
    pub fn settings(locale: &str, distance: i8) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("settings")?;
        writer.string(locale);
        writer.i8(distance);
        writer.varint(0);
        writer.bool(true);
        writer.u8(127);
        writer.varint(1);
        Ok(writer.build())
    }

    /// JS: `positionLook:(x,y,z,yaw,pitch,onGround)=>packet('position_look').f64(x).f64(y).f64(z).f32(yaw).f32(pitch).bool(onGround).build()`
    pub fn position_look(
        x: f64,
        y: f64,
        z: f64,
        yaw: f32,
        pitch: f32,
        on_ground: bool,
    ) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("position_look")?;
        writer.f64(x);
        writer.f64(y);
        writer.f64(z);
        writer.f32(yaw);
        writer.f32(pitch);
        writer.bool(on_ground);
        Ok(writer.build())
    }

    /// JS: `blockDig:(status,x,y,z,face)=>packet('block_dig').varint(status).position(x,y,z).i8(face).build()`
    pub fn block_dig(status: i32, x: i32, y: i32, z: i32, face: i8) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("block_dig")?;
        writer.varint(status);
        writer.position(x, y, z)?;
        writer.i8(face);
        Ok(writer.build())
    }

    /// JS: `blockPlace:(x,y,z,face,hand,cx,cy,cz,insideBlock=false)=>`
    /// `packet('block_place').varint(hand).position(x,y,z).varint(face).f32(cx).f32(cy).f32(cz).bool(insideBlock).build()`
    #[allow(clippy::too_many_arguments)]
    pub fn block_place(
        x: i32,
        y: i32,
        z: i32,
        face: i32,
        hand: i32,
        cx: f32,
        cy: f32,
        cz: f32,
        inside_block: bool,
    ) -> Result<Vec<u8>, BufferError> {
        let mut writer = packet_498("block_place")?;
        writer.varint(hand);
        writer.position(x, y, z)?;
        writer.varint(face);
        writer.f32(cx);
        writer.f32(cy);
        writer.f32(cz);
        writer.bool(inside_block);
        Ok(writer.build())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::obj_get;
    use crate::protocol_ids::SERVERBOUND_498 as OUT498;

    fn varint_bytes(value: i32) -> Vec<u8> {
        crate::protocol::encode_var_int(value)
    }

    #[test]
    fn position_uses_the_498_field_order() {
        // x in bits 38.., y in the low 12 bits, z at bits 12..38.
        // JS legal ranges: x/z in [-(2**25), 2**25), y in [-(2**11), 2**11);
        // these are the exact boundary values JS `Writer498.position` accepts.
        let mut writer = Writer498::new();
        writer.position(-33554432, -2048, 33554431).unwrap();
        let mut reader = Reader498::new(&writer.build());
        assert_eq!(reader.position().unwrap(), vec![-33554432, -2048, 33554431]);
        assert_eq!(reader.remaining(), 0);
    }

    #[test]
    fn position_out_of_range_is_a_range_error_like_js() {
        let mut writer = Writer498::new();
        assert_eq!(
            writer.position(1 << 25, 0, 0).unwrap_err().0,
            "Packed position out of range"
        );
        assert_eq!(
            writer.position(0, 2048, 0).unwrap_err().0,
            "Packed position out of range"
        );
    }

    #[test]
    fn slot_round_trips_empty_plain_and_nbt_items() {
        // null slot
        let mut writer = Writer498::new();
        writer.slot(None);
        let mut reader = Reader498::new(&writer.build());
        assert_eq!(reader.slot().unwrap(), None);

        // plain item
        let mut writer = Writer498::new();
        writer.slot(Some(&Slot::plain(745, 12)));
        let mut reader = Reader498::new(&writer.build());
        assert_eq!(reader.slot().unwrap(), Some(Slot::plain(745, 12)));

        // item with NBT: nbt and nbtRaw both populated, tag bytes preserved
        let root = Root {
            name: String::new(),
            value: crate::nbt::Tag::Compound(vec![(
                "display".to_string(),
                crate::nbt::Tag::String("enchanted".to_string()),
            )]),
        };
        let mut writer = Writer498::new();
        writer.slot(Some(&Slot { id: 278, count: 1, damage: 0, nbt: Some(root.clone()), nbt_raw: None }));
        let bytes = writer.build();
        let mut reader = Reader498::new(&bytes);
        let slot = reader.slot().unwrap().unwrap();
        assert_eq!(slot.id, 278);
        assert_eq!(slot.count, 1);
        assert_eq!(slot.damage, 0);
        assert_eq!(slot.nbt, Some(root));
        assert_eq!(slot.nbt_raw.unwrap(), crate::nbt::write_root(&Root {
            name: String::new(),
            value: crate::nbt::Tag::Compound(vec![(
                "display".to_string(),
                crate::nbt::Tag::String("enchanted".to_string()),
            )]),
        }));
        assert_eq!(reader.remaining(), 0);
    }

    #[test]
    fn metadata_reads_the_typed_registry_until_0xff() {
        // index 0 type 2 (f32), index 7 type 7 (bool), index 9 type 9 (position), terminator
        let mut bytes = Vec::new();
        bytes.push(0);
        bytes.extend(varint_bytes(2));
        bytes.extend_from_slice(&1.5f32.to_be_bytes());
        bytes.push(7);
        bytes.extend(varint_bytes(7));
        bytes.push(1);
        bytes.push(9);
        bytes.extend(varint_bytes(9));
        bytes.extend_from_slice(&0i64.to_be_bytes());
        bytes.push(0xff);
        let mut reader = Reader498::new(&bytes);
        let entries = reader.metadata().unwrap();
        assert_eq!(entries.len(), 3);
        assert_eq!(entries[0].index, 0);
        assert_eq!(entries[0].value, MetadataValue::Float(1.5));
        assert_eq!(entries[1].value, MetadataValue::Bool(true));
        assert_eq!(entries[2].value, MetadataValue::Position(vec![0, 0, 0]));
        assert_eq!(reader.remaining(), 0);
    }

    #[test]
    fn metadata_rejects_unknown_types_like_js() {
        let mut bytes = vec![3];
        bytes.extend(varint_bytes(19));
        let mut reader = Reader498::new(&bytes);
        assert_eq!(
            reader.metadata().unwrap_err().0,
            "Unknown 498 metadata type 19"
        );
    }

    #[test]
    fn decodes_chat_from_hand_built_bytes() {
        // CLIENTBOUND_498 chat = 14
        let mut bytes = varint_bytes(14);
        bytes.extend(varint_bytes(5));
        bytes.extend_from_slice(b"hello");
        bytes.push(0x01); // position 1
        let decoded = decode_packet_498(&bytes).unwrap();
        match &decoded {
            Decoded498::Packet { id, name, body } => {
                assert_eq!(*id, 14);
                assert_eq!(name, "chat");
                assert_eq!(obj_get(body, "message"), Some(&jstr("hello")));
                assert_eq!(obj_get(body, "position"), Some(&jint(1)));
                assert_eq!(obj_get(body, "name"), Some(&jstr("chat")));
                assert_eq!(obj_get(body, "id"), Some(&jint(14)));
            }
            other => panic!("expected packet, got {other:?}"),
        }
    }

    #[test]
    fn map_chunk_parses_nbt_heightmaps_and_block_entities() {
        let heightmaps_root = Root {
            name: String::new(),
            value: crate::nbt::Tag::Compound(vec![(
                "MOTION_BLOCKING".to_string(),
                crate::nbt::Tag::LongArray(vec![1, 2]),
            )]),
        };
        let mut bytes = varint_bytes(33); // map_chunk
        bytes.extend_from_slice(&3i32.to_be_bytes());
        bytes.extend_from_slice(&(-4i32).to_be_bytes());
        bytes.push(0); // groundUp false
        bytes.extend(varint_bytes(0x1234)); // bitMap
        bytes.extend_from_slice(&crate::nbt::write_root(&heightmaps_root));
        bytes.extend(varint_bytes(3)); // chunk data length
        bytes.extend_from_slice(&[9, 9, 9]);
        bytes.extend(varint_bytes(1)); // one block entity
        let block_entity = Root {
            name: String::new(),
            value: crate::nbt::Tag::Compound(vec![("id".to_string(), crate::nbt::Tag::String("minecraft:chest".to_string()))]),
        };
        bytes.extend_from_slice(&crate::nbt::write_root(&block_entity));

        let decoded = decode_packet_498(&bytes).unwrap();
        match &decoded {
            Decoded498::Packet { name, body, .. } => {
                assert_eq!(name, "map_chunk");
                assert_eq!(obj_get(body, "x"), Some(&jint(3)));
                assert_eq!(obj_get(body, "z"), Some(&jint(-4)));
                assert_eq!(obj_get(body, "groundUp"), Some(&jbool(false)));
                assert_eq!(obj_get(body, "bitMap"), Some(&jint(0x1234)));
                let heightmaps = obj_get(body, "heightmaps").unwrap();
                assert_eq!(obj_get(heightmaps, "t"), Some(&jint(10)));
                let motion = obj_get(obj_get(heightmaps, "v").unwrap(), "MOTION_BLOCKING").unwrap();
                assert_eq!(obj_get(motion, "t"), Some(&jint(12)));
                assert_eq!(
                    obj_get(motion, "v"),
                    Some(&jarr(vec![jint(1), jint(2)]))
                );
                assert_eq!(obj_get(body, "chunkData"), Some(&jarr(vec![jint(9), jint(9), jint(9)])));
                let block_entities = obj_get(body, "blockEntities").unwrap();
                match block_entities {
                    Json::Arr(entries) => assert_eq!(entries.len(), 1),
                    other => panic!("expected array, got {other:?}"),
                }
            }
            other => panic!("expected packet, got {other:?}"),
        }
    }

    #[test]
    fn update_light_validates_masks_and_reads_2048_byte_sections() {
        let mut bytes = varint_bytes(36); // update_light
        bytes.extend(varint_bytes(1)); // chunkX
        bytes.extend(varint_bytes(2)); // chunkZ
        bytes.extend(varint_bytes(1)); // skyLightMask -> section 0 -> key "-1"
        bytes.extend(varint_bytes(0)); // blockLightMask
        bytes.extend(varint_bytes(0)); // emptySkyLightMask
        bytes.extend(varint_bytes(0)); // emptyBlockLightMask
        bytes.extend(varint_bytes(2048));
        bytes.extend_from_slice(&vec![7u8; 2048]);
        let decoded = decode_packet_498(&bytes).unwrap();
        match &decoded {
            Decoded498::Packet { name, body, .. } => {
                assert_eq!(name, "update_light");
                let sky_light = obj_get(body, "skyLight").unwrap();
                assert_eq!(obj_get(sky_light, "-1"), Some(&jarr(vec![jint(7); 2048])));
                assert_eq!(obj_get(body, "blockLight"), Some(&Json::Obj(vec![])));
            }
            other => panic!("expected packet, got {other:?}"),
        }

        // conflicting masks raise the JS error
        let mut bytes = varint_bytes(36);
        bytes.extend(varint_bytes(1));
        bytes.extend(varint_bytes(2));
        bytes.extend(varint_bytes(1));
        bytes.extend(varint_bytes(0));
        bytes.extend(varint_bytes(1)); // emptySkyLightMask overlaps skyLightMask
        bytes.extend(varint_bytes(0));
        assert_eq!(
            decode_packet_498(&bytes).unwrap_err().0,
            "Conflicting light masks"
        );
    }

    #[test]
    fn trailing_data_raises_the_js_error() {
        let mut bytes = varint_bytes(14); // chat
        bytes.extend(varint_bytes(2));
        bytes.extend_from_slice(b"hi");
        bytes.push(0);
        bytes.push(0xAA); // trailing
        assert_eq!(
            decode_packet_498(&bytes).unwrap_err().0,
            "Trailing data in 498 chat: 1 bytes"
        );
    }

    #[test]
    fn unknown_ids_and_decoderless_names_report_unsupported() {
        // Unknown id: packetName null, rest as data.
        let mut bytes = varint_bytes(254);
        bytes.extend_from_slice(&[1, 2, 3]);
        match decode_packet_498(&bytes).unwrap() {
            Decoded498::Unsupported { id, packet_name, data } => {
                assert_eq!(id, 254);
                assert_eq!(packet_name, None);
                assert_eq!(data, vec![1, 2, 3]);
            }
            other => panic!("expected unsupported, got {other:?}"),
        }

        // Known name without a decoder (face_player): packetName set.
        let bytes = varint_bytes(52);
        match decode_packet_498(&bytes).unwrap() {
            Decoded498::Unsupported { id, packet_name, data } => {
                assert_eq!(id, 52);
                assert_eq!(packet_name.as_deref(), Some("face_player"));
                assert!(data.is_empty());
            }
            other => panic!("expected unsupported, got {other:?}"),
        }
    }

    #[test]
    fn c498_builders_prefix_the_serverbound_ids() {
        let bytes = C498::teleport_confirm(1234).unwrap();
        assert_eq!(bytes, [varint_bytes(id_for_name(OUT498, "teleport_confirm").unwrap()), varint_bytes(1234)].concat());

        let bytes = C498::keep_alive(-1).unwrap();
        assert_eq!(bytes.first().copied(), Some(id_for_name(OUT498, "keep_alive").unwrap() as u8));
        assert_eq!(bytes.len(), 9);

        let bytes = C498::settings("en_us", 4).unwrap();
        let mut reader = Reader498::new(&bytes);
        assert_eq!(reader.varint().unwrap(), id_for_name(OUT498, "settings").unwrap());
        assert_eq!(reader.string().unwrap(), "en_us");
        assert_eq!(reader.i8().unwrap(), 4);
        assert_eq!(reader.varint().unwrap(), 0);
        assert!(reader.bool().unwrap());
        assert_eq!(reader.u8().unwrap(), 127);
        assert_eq!(reader.varint().unwrap(), 1);
        assert_eq!(reader.remaining(), 0);

        let bytes = C498::block_dig(0, 1, 2, 3, 5).unwrap();
        let mut reader = Reader498::new(&bytes);
        assert_eq!(reader.varint().unwrap(), id_for_name(OUT498, "block_dig").unwrap());
        assert_eq!(reader.varint().unwrap(), 0);
        assert_eq!(reader.position().unwrap(), vec![1, 2, 3]);
        assert_eq!(reader.i8().unwrap(), 5);
        assert_eq!(reader.remaining(), 0);

        // JS arg order (x,y,z,face,hand,...) with hand written first.
        let bytes = C498::block_place(1, 2, 3, 5, 0, 0.5, 0.5, 0.5, false).unwrap();
        let mut reader = Reader498::new(&bytes);
        assert_eq!(reader.varint().unwrap(), id_for_name(OUT498, "block_place").unwrap());
        assert_eq!(reader.varint().unwrap(), 0); // hand
        assert_eq!(reader.position().unwrap(), vec![1, 2, 3]);
        assert_eq!(reader.varint().unwrap(), 5); // face
        // JS writes `.f32(cx).f32(cy).f32(cz).bool(insideBlock)` after the face.
        assert_eq!(reader.f32().unwrap(), 0.5); // cx
        assert_eq!(reader.f32().unwrap(), 0.5); // cy
        assert_eq!(reader.f32().unwrap(), 0.5); // cz
        assert!(!reader.bool().unwrap()); // insideBlock=false
        assert_eq!(reader.remaining(), 0);
    }

    #[test]
    fn c498_edit_book_writes_the_slot_shape() {
        let bytes = C498::edit_book(Some(&Slot::plain(387, 1)), true, 0).unwrap();
        let mut reader = Reader498::new(&bytes);
        assert_eq!(reader.varint().unwrap(), id_for_name(OUT498, "edit_book").unwrap());
        assert_eq!(reader.slot().unwrap(), Some(Slot::plain(387, 1)));
        assert!(reader.bool().unwrap());
        assert_eq!(reader.varint().unwrap(), 0);
        assert_eq!(reader.remaining(), 0);
    }

    #[test]
    fn c498_technical_builders_use_the_498_position_layout() {
        let bytes = C498::update_command_block(10, 20, 30, "say hi", "AUTO", true, false, true)
            .unwrap();
        let mut reader = Reader498::new(&bytes);
        assert_eq!(
            reader.varint().unwrap(),
            id_for_name(OUT498, "update_command_block").unwrap()
        );
        assert_eq!(reader.position().unwrap(), vec![10, 20, 30]);
        assert_eq!(reader.string().unwrap(), "say hi");
        assert_eq!(reader.varint().unwrap(), 1); // AUTO
        assert_eq!(reader.u8().unwrap(), 1 | 4); // track | automatic
        assert_eq!(reader.remaining(), 0);
    }

    #[test]
    fn varint_and_string_round_trip_through_reader498() {
        for value in [0, 1, 127, 128, 2097151, i32::MAX, -1, i32::MIN] {
            let mut writer = Writer498::new();
            writer.varint(value);
            let mut reader = Reader498::new(&writer.build());
            assert_eq!(reader.varint().unwrap(), value);
        }
        let mut writer = Writer498::new();
        writer.string("héllo wörld");
        let mut reader = Reader498::new(&writer.build());
        assert_eq!(reader.string().unwrap(), "héllo wörld");
        assert_eq!(reader.remaining(), 0);
    }

    #[test]
    fn json_facade_serializes_decoded_packets() {
        let mut bytes = varint_bytes(14); // chat
        bytes.extend(varint_bytes(2));
        bytes.extend_from_slice(b"hi");
        bytes.push(1);
        let json = decode_packet_498_json(&bytes).unwrap();
        assert_eq!(
            json,
            "{\"name\":\"chat\",\"id\":14,\"message\":\"hi\",\"position\":1}"
        );
    }
}



