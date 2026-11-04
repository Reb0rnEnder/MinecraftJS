// Port of `client/js/game/entities.js`
//! application, and physics helpers.
//!
//! The JavaScript original owns the live `Map<entityId, Entity>` and the
//! renderer integration. This module provides the pure helpers: bounding boxes,
//! metadata decoding, motion simulation, interpolation, and the static tables.

use std::f64::consts::PI;
use serde_json::{json, Map, Value};
use wasm_bindgen::prelude::*;

// ------------------------------------------------------------ direction tables

pub const DIR_OFFSETS: [[i32; 3]; 6] = [
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
    [-1, 0, 0],
    [1, 0, 0],
];
pub const DIR_NAMES: [&str; 6] = ["down", "up", "north", "south", "west", "east"];
pub const OPPOSITE: [usize; 6] = [1, 0, 3, 2, 5, 4];

// ------------------------------------------------------------ static tables

const SNAP_KINDS: &[&str] = &[
    "item", "xp", "arrow", "projectile", "falling", "tnt", "fishhook",
    "trident", "spectral_arrow", "dragon_fireball", "shulker_bullet", "llama_spit",
];

// Entity type names for 1.13.2 (from entities.js)
const MOB_NAMES: &[(i32, &str)] = &[
    (50, "Creeper"),
    (51, "Skeleton"),
    (52, "Spider"),
    (53, "Giant"),
    (54, "Zombie"),
    (55, "Slime"),
    (56, "Ghast"),
    (57, "PigZombie"),
    (58, "Enderman"),
    (59, "CaveSpider"),
    (60, "Silverfish"),
    (61, "Blaze"),
    (62, "LavaSlime"),
    (63, "EnderDragon"),
    (64, "WitherBoss"),
    (65, "Bat"),
    (66, "Witch"),
    (67, "Endermite"),
    (68, "Guardian"),
    (90, "Pig"),
    (91, "Sheep"),
    (92, "Cow"),
    (93, "Chicken"),
    (94, "Squid"),
    (95, "Wolf"),
    (96, "MushroomCow"),
    (97, "SnowMan"),
    (98, "Ozelot"),
    (99, "VillagerGolem"),
    (100, "EntityHorse"),
    (101, "Rabbit"),
    (120, "Villager"),
];

fn mob_type_name(type_id: i32) -> Option<&'static str> {
    MOB_NAMES.iter().find(|(id, _)| *id == type_id).map(|(_, name)| *name)
}

// ------------------------------------------------------------ angle helpers

fn wrap_angle(a: f64) -> f64 {
    let mut a = a % 360.0;
    if a >= 180.0 {
        a -= 360.0;
    }
    if a < -180.0 {
        a += 360.0;
    }
    a
}

fn angle_lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (((b - a) % 360.0 + 540.0) % 360.0 - 180.0) * t
}

fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

// ------------------------------------------------------------ shulker box

/// `shulkerBox(e, peek)` → `[minX, minY, minZ, maxX, maxY, maxZ]` in block coordinates.
#[wasm_bindgen]
pub fn shulker_box(
    x: f64,
    y: f64,
    z: f64,
    peek: f64,
    attach_face: i32,
) -> Vec<f64> {
    let d = 0.5 - ((0.5 + peek) * PI).sin() * 0.5;
    let mut b = [x - 0.5, y, z - 0.5, x + 0.5, y + 1.0, z + 0.5];
    match attach_face {
        0 => b[4] += d,
        1 => b[1] -= d,
        2 => b[5] += d,
        3 => b[2] -= d,
        4 => b[3] += d,
        5 => b[0] -= d,
        _ => {}
    }
    b.to_vec()
}

/// Push direction per attach face: down, up, north, south, west, east.
pub static SHULKER_PUSH: [[f64; 3]; 6] = [
    [0.0, -1.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.0, 0.0, -1.0],
    [0.0, 0.0, 1.0],
    [-1.0, 0.0, 0.0],
    [1.0, 0.0, 0.0],
];

/// Shulker push vector for a given attach face (0..5).
#[wasm_bindgen]
pub fn shulker_push_vector(attach_face: i32) -> Vec<f64> {
    let idx = attach_face.clamp(0, 5) as usize;
    SHULKER_PUSH[idx].to_vec()
}

// ------------------------------------------------------------ hanging / item frame boxes

/// `hangingBox` for paintings: `[minX, minY, minZ, maxX, maxY, maxZ]`.
#[wasm_bindgen]
pub fn hanging_box(hx: i32, hy: i32, hz: i32, facing: i32, w_px: i32, h_px: i32) -> Vec<f64> {
    let front = match facing {
        0 => [0, 1],
        1 => [-1, 0],
        2 => [0, -1],
        3 => [1, 0],
        _ => [0, 1],
    };
    let ccw = match facing {
        0 => [1, 0],
        1 => [0, 1],
        2 => [-1, 0],
        3 => [0, -1],
        _ => [1, 0],
    };
    let off = |px: i32| if px % 32 == 0 { 0.5 } else { 0.0 };
    let cx = hx as f64 + 0.5 - front[0] as f64 * 0.46875 + off(w_px) as f64 * ccw[0] as f64;
    let cy = hy as f64 + 0.5 + off(h_px) as f64;
    let cz = hz as f64 + 0.5 - front[1] as f64 * 0.46875 + off(w_px) as f64 * ccw[1] as f64;
    let along_z = front[0] == 0;
    let hx2 = if along_z { w_px as f64 } else { 1.0 } / 32.0;
    let hy2 = h_px as f64 / 32.0;
    let hz2 = if along_z { 1.0 } else { w_px as f64 } / 32.0;
    vec![cx - hx2, cy - hy2, cz - hz2, cx + hx2, cy + hy2, cz + hz2]
}

/// `itemFrameBox` for item frames (6-direction facing).
#[wasm_bindgen]
pub fn item_frame_box(x: f64, y: f64, z: f64, face: i32) -> Vec<f64> {
    let d = match face {
        0 => [0.0, -1.0, 0.0],
        1 => [0.0, 1.0, 0.0],
        2 => [0.0, 0.0, -1.0],
        3 => [0.0, 0.0, 1.0],
        4 => [-1.0, 0.0, 0.0],
        5 => [1.0, 0.0, 0.0],
        _ => [0.0, 0.0, 1.0],
    };
    let c = [
        x.floor() + 0.5 - d[0] * 0.46875,
        y.floor() + 0.5 - d[1] * 0.46875,
        z.floor() + 0.5 - d[2] * 0.46875,
    ];
    let h = [
        if d[0] != 0.0 { 1.0 / 32.0 } else { 12.0 / 32.0 },
        if d[1] != 0.0 { 1.0 / 32.0 } else { 12.0 / 32.0 },
        if d[2] != 0.0 { 1.0 / 32.0 } else { 12.0 / 32.0 },
    ];
    vec![
        c[0] - h[0], c[1] - h[1], c[2] - h[2],
        c[0] + h[0], c[1] + h[1], c[2] + h[2],
    ]
}

// ------------------------------------------------------------ metadata helpers

/// Parse a VarInt from bytes (returns (value, bytes_read)).
fn read_varint(bytes: &[u8]) -> Option<(i32, usize)> {
    let mut result = 0i32;
    let mut shift = 0;
    for (i, &b) in bytes.iter().enumerate() {
        result |= ((b & 0x7F) as i32) << shift;
        if (b & 0x80) == 0 {
            return Some((result, i + 1));
        }
        shift += 7;
        if shift >= 35 {
            return None;
        }
    }
    None
}

/// Decode entity metadata from a packet buffer.
/// Returns a Map of index -> Value (matching the JS wire format).
#[wasm_bindgen]
pub fn decode_entity_metadata(data: &[u8]) -> String {
    let mut meta = Map::new();
    let mut i = 0;
    while i < data.len() {
        let Some((key, consumed)) = read_varint(&data[i..]) else {
            break;
        };
        i += consumed;
        if i >= data.len() {
            break;
        }
        let type_id = data[i];
        i += 1;
        let value: Value = match type_id {
            0 => { // Byte
                if i >= data.len() { break; }
                let v = data[i] as i8;
                i += 1;
                json!(v)
            }
            1 => { // VarInt
                let Some((v, c)) = read_varint(&data[i..]) else { break; };
                i += c;
                json!(v)
            }
            2 => { // VarLong (read as string to avoid precision loss)
                let mut result = 0i64;
                let mut shift = 0;
                let start = i;
                while i < data.len() {
                    result |= ((data[i] & 0x7F) as i64) << shift;
                    if (data[i] & 0x80) == 0 {
                        i += 1;
                        break;
                    }
                    shift += 7;
                    if shift >= 63 {
                        i = start;
                        break;
                    }
                }
                json!(result.to_string())
            }
            3 => { // Float
                if i + 4 > data.len() { break; }
                let v = f32::from_le_bytes([data[i], data[i+1], data[i+2], data[i+3]]);
                i += 4;
                json!(v)
            }
            4 => { // String
                let Some((len, c)) = read_varint(&data[i..]) else { break; };
                i += c;
                if i + len as usize > data.len() { break; }
                let s = String::from_utf8_lossy(&data[i..i + len as usize]).to_string();
                i += len as usize;
                json!(s)
            }
            5 => { // Chat (NBT compound) - simplified to string
                let Some((len, c)) = read_varint(&data[i..]) else { break; };
                i += c;
                if i + len as usize > data.len() { break; }
                let s = String::from_utf8_lossy(&data[i..i + len as usize]).to_string();
                i += len as usize;
                json!(s)
            }
            6 => { // Slot (item stack)
                if i >= data.len() { break; }
                let item_id = data[i] as i16;
                i += 2;
                if item_id == -1 {
                    json!(null)
                } else {
                    let count = data[i] as u8;
                    i += 1;
                    let damage = data[i] as i16;
                    i += 2;
                    json!({ "id": item_id, "count": count, "damage": damage })
                }
            }
            7 => { // Boolean
                if i >= data.len() { break; }
                let v = data[i] != 0;
                i += 1;
                json!(v)
            }
            8 => { // Rotation (3 floats: x, y, z)
                if i + 12 > data.len() { break; }
                let x = f32::from_le_bytes([data[i], data[i+1], data[i+2], data[i+3]]);
                let y = f32::from_le_bytes([data[i+4], data[i+5], data[i+6], data[i+7]]);
                let z = f32::from_le_bytes([data[i+8], data[i+9], data[i+10], data[i+11]]);
                i += 12;
                json!([x, y, z])
            }
            9 => { // Position (3 varlongs)
                let mut coords = Vec::new();
                for _ in 0..3 {
                    let Some((v, c)) = read_varint(&data[i..]) else { break; };
                    i += c;
                    coords.push(v as i64);
                }
                json!(coords)
            }
            10 => { // Direction (VarInt)
                let Some((v, c)) = read_varint(&data[i..]) else { break; };
                i += c;
                json!(v)
            }
            11 => { // Optional UUID
                if i >= data.len() { break; }
                let has = data[i] != 0;
                i += 1;
                if has && i + 16 <= data.len() {
                    let uuid_bytes = &data[i..i+16];
                    i += 16;
                    // Format as standard UUID string
                    let mut uuid_str = String::new();
                    for (idx, &b) in uuid_bytes.iter().enumerate() {
                        if idx == 4 || idx == 6 || idx == 8 || idx == 10 {
                            uuid_str.push('-');
                        }
                        uuid_str.push_str(&format!("{:02x}", b));
                    }
                    json!(uuid_str)
                } else {
                    json!(null)
                }
            }
            12 => { // Optional block state (VarInt)
                let Some((v, c)) = read_varint(&data[i..]) else { break; };
                i += c;
                json!(v)
            }
            13 => { // Optional NBT
                let Some((len, c)) = read_varint(&data[i..]) else { break; };
                i += c;
                if i + len as usize > data.len() { break; }
                i += len as usize;
                json!(null) // We don't parse full NBT here
            }
            14 => { // Particle (VarInt + data)
                let Some((v, c)) = read_varint(&data[i..]) else { break; };
                i += c;
                json!(v)
            }
            15 => { // Villager data (compound)
                // Simplified - just skip
                json!(null)
            }
            _ => json!(null),
        };
        meta.insert(key.to_string(), value);
    }
    json!(meta).to_string()
}

// ------------------------------------------------------------ entity physics helpers

/// Simulate projectile motion for one tick (arrows, fireballs, etc.)
/// Returns new [x, y, z, motionX, motionY, motionZ].
#[wasm_bindgen]
pub fn simulate_projectile(
    x: f64,
    y: f64,
    z: f64,
    motion_x: f64,
    motion_y: f64,
    motion_z: f64,
    accel_x: f64,
    accel_y: f64,
    accel_z: f64,
    drag: f64,
    gravity: f64,
    no_gravity: bool,
    in_ground: bool,
    block_at_feet_opaque: bool,
) -> Vec<f64> {
    if in_ground {
        return vec![x, y, z, motion_x, motion_y, motion_z];
    }
    let nx = x + motion_x;
    let ny = y + motion_y;
    let nz = z + motion_z;
    let nmx = (motion_x + accel_x) * drag;
    let nmy = if no_gravity {
        (motion_y + accel_y) * drag
    } else {
        (motion_y + accel_y - gravity) * drag
    };
    let nmz = (motion_z + accel_z) * drag;

    // Stop at ground
    let (ny, nmy, nmx, nmz) = if block_at_feet_opaque {
        (ny.floor() + 1.0, 0.0, nmx * 0.5, nmz * 0.5)
    } else {
        (ny, nmy, nmx, nmz)
    };

    vec![nx, ny, nz, nmx, nmy, nmz]
}

/// Entity interpolation: `interp(e, partial)` → `{x, y, z}`.
#[wasm_bindgen]
pub fn interpolate_position(
    prev_x: f64,
    prev_y: f64,
    prev_z: f64,
    x: f64,
    y: f64,
    z: f64,
    partial: f64,
) -> Vec<f64> {
    vec![
        prev_x + (x - prev_x) * partial,
        prev_y + (y - prev_y) * partial,
        prev_z + (z - prev_z) * partial,
    ]
}

// ------------------------------------------------------------ mob collision helpers

/// Riding position offset for a vehicle (boat, minecart, horse, etc.)
/// Returns [x, y, z].
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn rider_position(
    v_x: f64,
    v_y: f64,
    v_z: f64,
    v_yaw: f64,
    v_kind: &str,
    v_type: i32,
    v_height: f64,
    rider_kind: &str,
    rider_index: i32,
    passenger_count: i32,
) -> Vec<f64> {
    let mounted = match v_kind {
        "boat" => -0.1,
        "minecart" => 0.0,
        "mob" => {
            if v_type == 90 { // pig
                0.9 * 0.75 - 0.3
            } else if v_type == 100 { // horse
                v_height * 0.75 - 0.25
            } else if v_type == 52 || v_type == 59 { // spider/cave_spider
                v_height * 0.5 - 0.15
            } else {
                v_height * 0.75 - 0.35
            }
        }
        _ => v_height * 0.75,
    };
    let y = v_y + mounted + if rider_kind == "player" { -0.35 } else { 0.0 };

    if v_kind != "boat" {
        return vec![v_x, y, v_z];
    }

    if passenger_count < 2 {
        return vec![v_x, y, v_z];
    }

    let f = if rider_index == 0 { 0.2 } else { -0.6 };
    // Animal passengers sit 0.2 further forward
    let f = f; // placeholder for animal adjustment
    let a = -(v_yaw * PI / 180.0) - PI / 2.0;
    vec![v_x + f * a.cos(), y, v_z - f * a.sin()]
}

// ------------------------------------------------------------ entity kind detection

#[wasm_bindgen]
pub fn is_snap_kind(kind: &str) -> bool {
    SNAP_KINDS.contains(&kind)
}

#[wasm_bindgen]
pub fn is_interactive_entity(kind: &str, entity_name: &str, held_item_name: Option<String>) -> bool {
    if kind == "mob" {
        if entity_name == "villager" {
            return true;
        }
        // Horses are interactive
        if matches!(entity_name, "horse" | "donkey" | "mule" | "llama" | "trader_llama") {
            return true;
        }
        if let Some(item) = held_item_name {
            if (entity_name == "cow" || entity_name == "mooshroom") && item == "bucket" {
                return true;
            }
            if entity_name == "sheep" && item == "shears" {
                return true;
            }
            if item == "name_tag" || item == "lead" {
                return true;
            }
        }
        // Tamed wolf/ocelot/cat/parrot
        if matches!(entity_name, "wolf" | "ocelot" | "cat" | "parrot") {
            return true; // tamed check would need metadata
        }
        if entity_name == "pig" {
            return true; // saddled check would need metadata
        }
    }
    matches!(kind, "itemframe" | "armorstand" | "minecart" | "boat")
}

// ------------------------------------------------------------ living entity update

/// `EntityLivingBase.onLivingUpdate` client-side parts: limb swing, cape, etc.
/// Returns [limb_swing, limb_swing_amount].
#[wasm_bindgen]
pub fn living_update(
    _prev_limb_swing: f64,
    _prev_limb_swing_amount: f64,
    limb_swing: f64,
    limb_swing_amount: f64,
    on_ground: bool,
    sprinting: bool,
    speed: f64,
) -> Vec<f64> {
    let prev_limb_swing_amount = limb_swing_amount;
    let prev_limb_swing = limb_swing;

    if on_ground {
        let f = if sprinting { speed * 0.8 } else { speed };
        let limb_swing_amount = limb_swing_amount + f * 0.5;
        let limb_swing = limb_swing + f;
        vec![limb_swing, limb_swing_amount]
    } else {
        vec![prev_limb_swing, prev_limb_swing_amount]
    }
}

// ------------------------------------------------------------ cape update

/// `EntityPlayer.updateCape` - cape trailing point.
/// Returns [chasingX, chasingY, chasingZ, prevChasingX, prevChasingY, prevChasingZ].
#[wasm_bindgen]
pub fn update_cape(
    chasing_x: f64,
    chasing_y: f64,
    chasing_z: f64,
    prev_chasing_x: f64,
    prev_chasing_y: f64,
    prev_chasing_z: f64,
    x: f64,
    y: f64,
    z: f64,
) -> Vec<f64> {
    let mut ncx = chasing_x;
    let mut ncy = chasing_y;
    let mut ncz = chasing_z;
    let mut npc_x = prev_chasing_x;
    let mut npc_y = prev_chasing_y;
    let mut npc_z = prev_chasing_z;

    // Snap if too far - X
    let d = x - ncx;
    if d > 10.0 || d < -10.0 {
        ncx = x;
        npc_x = ncx;
    }
    // Y
    let d = y - ncy;
    if d > 10.0 || d < -10.0 {
        ncy = y;
        npc_y = ncy;
    }
    // Z
    let d = z - ncz;
    if d > 10.0 || d < -10.0 {
        ncz = z;
        npc_z = ncz;
    }

    ncx += (x - ncx) * 0.25;
    ncy += (y - ncy) * 0.25;
    ncz += (z - ncz) * 0.25;

    vec![ncx, ncy, ncz, npc_x, npc_y, npc_z]
}

// ------------------------------------------------------------ dragon parts

/// Ender dragon part hitboxes (returns array of [id, name_idx, x, y, z, width, height]).
#[wasm_bindgen]
pub fn dragon_parts(
    entity_id: i32,
    x: f64,
    y: f64,
    z: f64,
    yaw: f64,
    ring: &[f64], // [yaw0, y0, yaw1, y1, ...] length 128 (64 pairs)
    ring_idx: usize,
    dead: bool,
    _anim_time: f64,
    _prev_anim_time: f64,
) -> Vec<f64> {
    if dead {
        return Vec::new();
    }

    let part_names = ["head", "body", "tail1", "tail2", "tail3", "wing1", "wing2"];
    let mut out = Vec::with_capacity(7 * 7);

    let off = |i: isize| {
        let idx = ((ring_idx as isize - i).rem_euclid(64) as usize) * 2;
        [ring[idx], ring[idx + 1]]
    };

    let wrap = |a: f64| {
        let mut a = a % 360.0;
        if a >= 180.0 {
            a -= 360.0;
        }
        if a < -180.0 {
            a += 360.0;
        }
        a
    };

    let set_part = |out: &mut Vec<f64>, name_idx: f64, px: f64, py: f64, pz: f64, w: f64, h: f64| {
        out.push(entity_id as f64 + 1.0); // id offset by name index in caller
        out.push(name_idx);
        out.push(px);
        out.push(py);
        out.push(pz);
        out.push(w);
        out.push(h);
    };

    let a5 = off(5);
    let a0 = off(0);
    let f1 = (a5[1] - a0[1]) * 10.0 / 180.0 * PI;
    let f2 = f1.cos();
    let f11 = -f1.sin();
    let f12 = yaw * PI / 180.0;
    let f13 = f12.sin();
    let f14 = f12.cos();

    // body (index 1)
    set_part(&mut out, 1.0, x + f13 * 0.5, y, z - f14 * 0.5, 5.0, 3.0);
    // wing1 (index 5)
    set_part(&mut out, 5.0, x + f14 * 4.5, y + 2.0, z + f13 * 4.5, 4.0, 2.0);
    // wing2 (index 6)
    set_part(&mut out, 6.0, x - f14 * 4.5, y + 2.0, z - f13 * 4.5, 4.0, 2.0);
    // head (index 0)
    set_part(
        &mut out,
        0.0,
        x + f13 * 5.5 * f2,
        y + (a0[1] - a5[1]) + f11 * 5.5,
        z - f14 * 5.5 * f2,
        3.0,
        3.0,
    );
    // tail1, tail2, tail3 (indices 2, 3, 4)
    for j in 0..3 {
        let a = off(12 + j * 2);
        let r = f12 + wrap(a[0] - a5[0]) * PI / 180.0;
        let f15 = r.sin();
        let f16 = r.cos();
        let f17 = 1.5;
        let f18 = (j + 1) as f64 * 2.0;
        set_part(
            &mut out,
            (2 + j) as f64,
            x - (f13 * f17 + f15 * f18) * f2,
            y + (a[1] - a5[1]) - (f18 + f17) * f11 + 1.5,
            z + (f14 * f17 + f16 * f18) * f2,
            2.0,
            2.0,
        );
    }

    out
}

// ------------------------------------------------------------ metadata application (simplified)

/// Apply entity metadata from wire format to entity state.
/// This is a simplified version - the full logic is in entities.js _applyMeta.
#[wasm_bindgen]
pub fn apply_metadata(entity_json: &str, metadata_json: &str) -> String {
    let mut entity: Value = serde_json::from_str(entity_json).unwrap_or(json!({}));
    let metadata: Map<String, Value> = serde_json::from_str(metadata_json).unwrap_or_default();

    // Index 0: flags byte
    if let Some(v) = metadata.get("0").and_then(|v| v.as_i64()) {
        entity["onFire"] = json!((v & 1) != 0);
        entity["sneaking"] = json!((v & 2) != 0);
        entity["sprinting"] = json!((v & 8) != 0);
        entity["swimming"] = json!((v & 16) != 0);
        entity["invisible"] = json!((v & 32) != 0);
        entity["glowing"] = json!((v & 64) != 0);
        entity["elytraFlying"] = json!((v & 128) != 0);
    }

    // Index 1: air
    if let Some(v) = metadata.get("1").and_then(|v| v.as_i64()) {
        entity["air"] = json!(v);
    }

    // Index 2: custom name (chat component)
    if let Some(v) = metadata.get("2") {
        entity["customName"] = v.clone();
    }

    // Index 3: name visible
    if let Some(v) = metadata.get("3").and_then(|v| v.as_bool()) {
        entity["nameVisible"] = json!(v);
    }

    // Index 4: silent
    if let Some(v) = metadata.get("4").and_then(|v| v.as_bool()) {
        entity["silent"] = json!(v);
    }

    // Index 5: no gravity
    if let Some(v) = metadata.get("5").and_then(|v| v.as_bool()) {
        entity["noGravity"] = json!(v);
    }

    // Index 6: pose / using item (for living)
    if let Some(v) = metadata.get("6").and_then(|v| v.as_i64()) {
        entity["usingItem"] = json!((v & 1) != 0);
        entity["activeHand"] = json!(if (v & 2) != 0 { 1 } else { 0 });
        entity["riptide"] = json!((v & 4) != 0);
    }

    // Index 7: health
    if let Some(v) = metadata.get("7").and_then(|v| v.as_f64()) {
        entity["health"] = json!(v);
        entity["dead"] = json!(v <= 0.0);
    }

    // Index 8: potion color
    if let Some(v) = metadata.get("8").and_then(|v| v.as_i64()) {
        entity["potionColor"] = json!(v);
    }

    // Index 9: potion ambient
    if let Some(v) = metadata.get("9").and_then(|v| v.as_bool()) {
        entity["potionAmbient"] = json!(v);
    }

    // Index 10: arrow count
    if let Some(v) = metadata.get("10").and_then(|v| v.as_i64()) {
        entity["arrowCount"] = json!(v);
    }

    entity.to_string()
}

// ------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shulker_box_opens_correctly() {
        let box_closed = shulker_box(0.0, 0.0, 0.0, 0.0, 2); // facing north (2)
        let box_open = shulker_box(0.0, 0.0, 0.0, 1.0, 2);
        // When open (peek=1), the box extends further in the facing direction
        assert!(box_open[5] > box_closed[5]); // maxZ should be larger
    }

    #[test]
    fn hanging_box_painting() {
        let box_ = hanging_box(0, 64, 0, 0, 16, 16); // 1x1 painting facing south
        // Painting at block (0,64,0) facing south: center X=0.5, extends 0.5 each way
        assert!((box_[0] - 0.0).abs() < 0.01); // minX
        assert!((box_[3] - 1.0).abs() < 0.01); // maxX
    }

    #[test]
    fn item_frame_box_six_directions() {
        for face in 0..6 {
            let box_ = item_frame_box(100.3, 64.7, -50.2, face);
            assert_eq!(box_.len(), 6);
            // Frame is 1/16 thick in the facing direction
            // face: 0=down(Y), 1=up(Y), 2=north(Z), 3=south(Z), 4=west(X), 5=east(X)
            let thickness = match face {
                0 | 1 => box_[4] - box_[1], // Y thickness
                2 | 3 => box_[5] - box_[2], // Z thickness
                4 | 5 => box_[3] - box_[0], // X thickness
                _ => 0.0,
            };
            assert!((thickness - 1.0/16.0).abs() < 0.001);
        }
    }

    #[test]
    fn projectile_simulation_applies_gravity() {
        let result = simulate_projectile(
            0.0, 10.0, 0.0,
            1.0, 0.0, 0.0,
            0.0, 0.0, 0.0,
            0.99, 0.05, false, false, false
        );
        assert!(result[4] < 0.0); // motionY should be negative (gravity)
    }

    #[test]
    fn projectile_stops_at_ground() {
        let result = simulate_projectile(
            0.0, 10.0, 0.0,
            1.0, -0.1, 0.0,
            0.0, 0.0, 0.0,
            0.99, 0.05, false, false, true
        );
        // Starts at y=10, motionY=-0.1 -> new y=9.9, floor(9.9)=9, so y=9+1=10
        assert!((result[1] - 10.0).abs() < 0.01); // y = floor(9.9) + 1 = 10
        assert!((result[4]).abs() < 0.01); // motionY = 0
    }

    #[test]
    fn interpolation_basic() {
        let pos = interpolate_position(0.0, 0.0, 0.0, 10.0, 10.0, 10.0, 0.5);
        assert_eq!(pos, vec![5.0, 5.0, 5.0]);
    }

    #[test]
    fn angle_wrap() {
        assert_eq!(wrap_angle(180.0), -180.0);
        assert_eq!(wrap_angle(270.0), -90.0);
        assert_eq!(wrap_angle(-270.0), 90.0);
        assert_eq!(wrap_angle(720.0), 0.0);
    }

    #[test]
    fn angle_lerp_shortest() {
        // 350 -> 10 should go through 0 (20 degrees), not the long way (340)
        // angle_lerp returns unwrapped angle, so we wrap the result
        let result = angle_lerp(350.0, 10.0, 0.5);
        let wrapped = wrap_angle(result);
        assert!((wrapped - 0.0).abs() < 1.0);
    }

    #[test]
    fn metadata_flags_decode() {
        let entity = json!({});
        let meta = json!({ "0": 1 + 2 + 16 + 32 }); // onFire, sneaking, swimming, invisible
        let result = apply_metadata(&entity.to_string(), &meta.to_string());
        let e: Value = serde_json::from_str(&result).unwrap();
        assert_eq!(e["onFire"], true);
        assert_eq!(e["sneaking"], true);
        assert_eq!(e["swimming"], true);
        assert_eq!(e["invisible"], true);
        assert_eq!(e["sprinting"], false);
    }
}