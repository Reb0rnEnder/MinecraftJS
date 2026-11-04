//! Port of `client/js/net/technical-packets.js`
//!
//! Payload builders for the 1.13+ command-block and structure-block editors.

use wasm_bindgen::prelude::*;

use crate::buffer::PacketWriter;

fn index_of(value: &str, values: &[&str]) -> i32 {
    values
        .iter()
        .position(|candidate| *candidate == value)
        .map(|index| index as i32)
        .unwrap_or(-1)
}

/// `update_command_block` payload (position, command, mode enum, flags).
#[wasm_bindgen]
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
) -> Vec<u8> {
    let mut writer = PacketWriter::new();
    writer.position(x, y, z);
    writer.string(command);
    writer.varint(index_of(mode, &["SEQUENCE", "AUTO", "REDSTONE"]));
    writer.u8((track as u8) | ((conditional as u8) << 1) | ((automatic as u8) << 2));
    writer.build()
}

/// `update_command_block_minecart` payload.
#[wasm_bindgen]
pub fn update_command_minecart(id: i32, command: &str, track: bool) -> Vec<u8> {
    let mut writer = PacketWriter::new();
    writer.varint(id);
    writer.string(command);
    writer.write_bool(track);
    writer.build()
}

/// `update_structure_block` payload. Enum names use the same strings as the
/// JavaScript caller; unknown values serialize as -1, exactly like `indexOf`.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn update_structure_block(
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
) -> Vec<u8> {
    let mut writer = PacketWriter::new();
    writer.position(x, y, z);
    writer.varint(action - 1);
    writer.varint(index_of(mode, &["SAVE", "LOAD", "CORNER", "DATA"]));
    writer.string(name);
    for value in [pos_x, pos_y, pos_z, size_x, size_y, size_z] {
        writer.i8(value);
    }
    writer.varint(index_of(mirror, &["NONE", "LEFT_RIGHT", "FRONT_BACK"]));
    writer.varint(index_of(
        rotation,
        &[
            "NONE",
            "CLOCKWISE_90",
            "CLOCKWISE_180",
            "COUNTERCLOCKWISE_90",
        ],
    ));
    writer.string(metadata);
    writer.f32(integrity);
    writer.varlong(seed);
    writer.u8(
        (ignore_entities as u8) | ((show_air as u8) << 1) | ((show_bounding_box as u8) << 2),
    );
    writer.build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn varint(value: u32) -> Vec<u8> {
        let mut out = Vec::new();
        let mut value = value;
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
        out
    }

    #[test]
    fn command_block_payload_has_the_native_layout() {
        let bytes = update_command_block(
            1,
            64,
            -2,
            "say hi",
            "REDSTONE",
            true,
            false,
            true,
        );
        let mut expected = Vec::new();
        let position = ((1i64 & 0x3ffffff) << 38)
            | ((64i64 & 0xfff) << 26)
            | ((-2i64) & 0x3ffffff);
        expected.extend_from_slice(&position.to_be_bytes());
        expected.push(6);
        expected.extend_from_slice(b"say hi");
        expected.extend_from_slice(&varint(2));
        expected.push(0b101);
        assert_eq!(bytes, expected);
    }

    #[test]
    fn structure_payload_uses_enum_indices_and_flags() {
        let bytes = update_structure_block(
            0, 0, 0, 1, "SAVE", "test", 0, 1, 0, 2, 3, 4, "LEFT_RIGHT", "CLOCKWISE_90",
            "meta", 0.5, -1, true, false, true,
        );
        // position(8) + action varint + mode varint + name + six i8s
        assert_eq!(&bytes[8..10], &[0, 0]);
        assert!(bytes.windows(4).any(|window| window == b"test"));
        assert!(bytes.ends_with(&[0b101]));
    }
}