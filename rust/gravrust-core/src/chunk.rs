//! Port of `client/js/world/chunk.js` (section decoding, light nibbles) and
//! `client/js/world/native-light.js` (sky light column lookup).
//!
//! Coordinates and index order match the JavaScript original:
//! `(y << 8) | (z << 4) | x`.

use wasm_bindgen::prelude::*;

/// Cells in one 16^3 section.
pub const SECTION_VOLUME: usize = 4096;
/// Bytes in one nibble light array (two values per byte).
pub const LIGHT_BYTES: usize = 2048;

#[derive(Debug, PartialEq, Eq)]
pub struct DecodeError;

/// Minecraft VarInt as used by `Reader.varint()` in `net/buffer.js`.
fn read_varint(data: &[u8], offset: &mut usize) -> Result<u32, DecodeError> {
    let mut value: u32 = 0;
    let mut shift: u32 = 0;
    loop {
        let byte = *data.get(*offset).ok_or(DecodeError)?;
        *offset += 1;
        value |= ((byte & 0x7f) as u32) << shift;
        if byte & 0x80 == 0 {
            return Ok(value);
        }
        shift += 7;
        if shift > 35 {
            return Err(DecodeError);
        }
    }
}

/// Decode the block states of one chunk section (1.9+ `ChunkSection`).
///
/// This is the inner loop of `Chunk.load`: a palette bit width, an optional
/// local palette (for widths <= 8), the packed big-endian longs, and the
/// per-cell unpacking. It returns the number of input bytes consumed (the
/// caller then reads the two 2048-byte light arrays), or 0 when the input is
/// malformed so the JavaScript caller can fall back.
///
/// `out` must be the section's `Uint32Array(4096)`.
#[wasm_bindgen]
pub fn decode_section(data: &[u8], out: &mut [u32]) -> u32 {
    if out.len() != SECTION_VOLUME {
        return 0;
    }
    match decode_section_at(data, 0, out) {
        Ok(consumed) => consumed as u32,
        Err(_) => {
            out.fill(0);
            0
        }
    }
}

/// Rust-testable entry point over a larger buffer.
pub fn decode_section_at(data: &[u8], offset: usize, out: &mut [u32]) -> Result<usize, DecodeError> {
    if out.len() != SECTION_VOLUME || offset > data.len() {
        return Err(DecodeError);
    }
    let mut o = offset;
    let bit_width = *data.get(o).ok_or(DecodeError)?;
    o += 1;
    let mut bits = bit_width as u32;

    // 1.13 global palettes write no palette header.
    let palette_len = if bit_width <= 8 {
        read_varint(data, &mut o)? as usize
    } else {
        0
    };
    let mut palette: Option<Vec<u32>> = None;
    if palette_len > 0 {
        if palette_len > 1 << 20 {
            return Err(DecodeError);
        }
        let mut values = Vec::with_capacity(palette_len);
        for _ in 0..palette_len {
            values.push(read_varint(data, &mut o)?);
        }
        palette = Some(values);
    }

    if bits < 4 {
        bits = 4;
    }
    if bits > 8 {
        palette = None; // flattened global registry state ids
    }
    if bits > 32 {
        return Err(DecodeError);
    }

    let long_count = read_varint(data, &mut o)? as usize;
    if long_count > 8192 {
        return Err(DecodeError);
    }
    let long_bytes = long_count.checked_mul(8).ok_or(DecodeError)?;
    if data.len() < o + long_bytes {
        return Err(DecodeError);
    }

    // Big-endian longs -> (lo, hi) 32-bit words, low word first (as in the JS).
    let mut words = vec![0u32; long_count * 2];
    for i in 0..long_count {
        let b = &data[o + i * 8..o + i * 8 + 8];
        words[i * 2 + 1] = u32::from_be_bytes([b[0], b[1], b[2], b[3]]);
        words[i * 2] = u32::from_be_bytes([b[4], b[5], b[6], b[7]]);
    }
    o += long_bytes;

    let mask: u32 = if bits >= 32 {
        u32::MAX
    } else {
        (1u32 << bits) - 1
    };
    for (i, slot) in out.iter_mut().enumerate() {
        let bit = i * bits as usize;
        let word = bit >> 5;
        let shift = (bit & 31) as u32;
        let mut value = words.get(word).copied().unwrap_or(0) >> shift;
        if shift + bits > 32 {
            let next = words.get(word + 1).copied().unwrap_or(0);
            value |= next << (32 - shift);
        }
        value &= mask;
        *slot = match &palette {
            // JS: `palette[v] || 0`
            Some(values) => values.get(value as usize).copied().unwrap_or(0),
            None => value,
        };
    }

    Ok(o - offset)
}

/// `Section.recount()`: number of non-air cells.
///
/// The JS original used `AIR_STATES_498.includes()` for every cell; the air
/// list is passed in so the registry stays in JavaScript.
#[wasm_bindgen]
pub fn count_non_air(blocks: &[u32], air_states: &[u32]) -> u32 {
    blocks
        .iter()
        .filter(|state| !air_states.iter().any(|air| air == *state))
        .count() as u32
}

/// `Section.getSky(i)` (nibble order: low nibble is the even index).
#[wasm_bindgen]
pub fn get_sky_light(light: &[u8], index: u32) -> u8 {
    let byte_index = (index >> 1) as usize;
    let byte = light.get(byte_index).copied().unwrap_or(0);
    (byte >> ((index & 1) << 2)) & 15
}

#[wasm_bindgen]
pub fn get_block_light(light: &[u8], index: u32) -> u8 {
    get_sky_light(light, index)
}

#[wasm_bindgen]
pub fn set_sky_light(light: &mut [u8], index: u32, value: u8) {
    let byte_index = (index >> 1) as usize;
    if let Some(byte) = light.get_mut(byte_index) {
        let value = value & 15;
        if index & 1 == 1 {
            *byte = (*byte & 0x0f) | (value << 4);
        } else {
            *byte = (*byte & 0xf0) | value;
        }
    }
}

#[wasm_bindgen]
pub fn set_block_light(light: &mut [u8], index: u32, value: u8) {
    set_sky_light(light, index, value);
}

/// `nativeSkyLight` from `world/native-light.js`.
///
/// `layers` mirrors the 18-entry `light.sky`/`light.block` arrays; `None` is a
/// hole (a section the server has not sent). This is kept as a pure Rust
/// function: the client's light columns are sparse JS arrays shared with
/// `Section`, so copying them into WASM per lookup would cost more than the
/// lookup itself.
pub fn native_sky_light(
    layers: &[Option<Vec<u8>>],
    sky_known: bool,
    sky_data_mask: u32,
    x: u32,
    y: i32,
    z: u32,
    has_sky: bool,
) -> u8 {
    if !has_sky {
        return 0;
    }
    let mut section = (y >> 4) + 1;
    let mut local_y = (y & 15) as u32;

    if sky_known {
        let highest = 31 - sky_data_mask.leading_zeros() as i32;
        if section > highest {
            return 15;
        }
        while section <= highest {
            if let Some(Some(bytes)) = layers.get(section as usize) {
                let i = ((local_y << 8) | (z << 4) | x) as usize;
                let byte = bytes.get(i >> 1).copied().unwrap_or(0);
                return (byte >> ((i & 1) << 2)) & 15;
            }
            section += 1;
            local_y = 0;
        }
        return 15;
    }

    match layers.get(section as usize) {
        Some(Some(bytes)) => {
            let i = ((local_y << 8) | (z << 4) | x) as usize;
            let byte = bytes.get(i >> 1).copied().unwrap_or(0);
            (byte >> ((i & 1) << 2)) & 15
        }
        _ => {
            if y > 255 {
                15
            } else {
                0
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn push_varint(out: &mut Vec<u8>, mut value: u32) {
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

    /// Build one section exactly like a 1.9+ Chunk Data packet.
    fn build_section(bits: u8, palette: &[u32], values: &[u32]) -> Vec<u8> {
        let mut out = vec![bits];
        if bits <= 8 {
            push_varint(&mut out, palette.len() as u32);
            for value in palette {
                push_varint(&mut out, *value);
            }
        }
        let long_count = (4096 * bits as usize).div_ceil(64);
        push_varint(&mut out, long_count as u32);
        let mask: u64 = if bits >= 64 { u64::MAX } else { (1u64 << bits) - 1 };
        let mut longs = vec![0u64; long_count];
        for (i, value) in values.iter().enumerate() {
            let bit = i * bits as usize;
            let word = bit / 64;
            let shift = bit % 64;
            longs[word] |= ((*value as u64) & mask) << shift;
            if shift + bits as usize > 64 {
                longs[word + 1] |= ((*value as u64) & mask) >> (64 - shift);
            }
        }
        for long in longs {
            out.extend_from_slice(&long.to_be_bytes());
        }
        out
    }

    #[test]
    fn decodes_local_palette() {
        let palette = [0u32, 42, 9129, 11270];
        let mut values = vec![0u32; 4096];
        for (i, value) in values.iter_mut().enumerate() {
            *value = (i % palette.len()) as u32;
        }
        let data = build_section(4, &palette, &values);
        let mut out = vec![7u32; 4096];
        let consumed = decode_section_at(&data, 0, &mut out).unwrap();
        assert_eq!(consumed, data.len());
        for i in 0..4096 {
            assert_eq!(out[i], palette[i % palette.len()]);
        }
    }

    #[test]
    fn decodes_global_palette() {
        let values: Vec<u32> = (0..4096).map(|i| (i * 3 % 11271) as u32).collect();
        let data = build_section(14, &[], &values);
        let mut out = vec![0u32; 4096];
        decode_section_at(&data, 0, &mut out).unwrap();
        assert_eq!(out, values);
    }

    #[test]
    fn decodes_section_at_offset_and_reports_consumed() {
        let values: Vec<u32> = (0..4096).map(|i| (i & 15) as u32).collect();
        let section = build_section(4, &(0..16).collect::<Vec<_>>(), &values);
        let mut data = vec![0xde, 0xad];
        data.extend_from_slice(&section);
        let mut out = vec![0u32; 4096];
        let consumed = decode_section_at(&data, 2, &mut out).unwrap();
        assert_eq!(consumed, section.len());
        assert_eq!(out, values);
    }

    #[test]
    fn rejects_truncated_section() {
        let values = vec![0u32; 4096];
        let data = build_section(8, &(0..256).collect::<Vec<_>>(), &values);
        let mut out = vec![0u32; 4096];
        assert!(decode_section_at(&data[..data.len() - 1], 0, &mut out).is_err());
    }

    #[test]
    fn counts_non_air() {
        let blocks: Vec<u32> = vec![0, 1, 9129, 9130, 55, 0];
        assert_eq!(count_non_air(&blocks, &[0, 9129, 9130]), 2);
    }

    #[test]
    fn nibble_light_roundtrip() {
        let mut bytes = vec![0u8; LIGHT_BYTES];
        for index in 0..4096u32 {
            let value = (index % 15) as u8;
            set_sky_light(&mut bytes, index, value);
        }
        for index in 0..4096u32 {
            assert_eq!(get_sky_light(&bytes, index), (index % 15) as u8);
        }
        // Low nibble is the even index, high nibble the odd one.
        set_block_light(&mut bytes, 0, 3);
        set_block_light(&mut bytes, 1, 12);
        assert_eq!(bytes[0], 0xc3);
        assert_eq!(get_block_light(&bytes, 0), 3);
        assert_eq!(get_block_light(&bytes, 1), 12);
    }

    fn layer(fill: u8) -> Option<Vec<u8>> {
        Some(vec![fill; LIGHT_BYTES])
    }

    #[test]
    fn native_sky_light_reads_the_requested_layer() {
        let mut layers: Vec<Option<Vec<u8>>> = (0..18).map(|_| None).collect();
        layers[1] = Some(vec![0x11; LIGHT_BYTES]); // y 0..15
        layers[2] = Some(vec![0xff; LIGHT_BYTES]); // y 16..31
        assert_eq!(native_sky_light(&layers, false, 0, 0, 0, 0, true), 1);
        assert_eq!(native_sky_light(&layers, false, 0, 3, 20, 4, true), 15);
        assert_eq!(native_sky_light(&layers, false, 0, 3, 20, 4, false), 0);
    }

    #[test]
    fn native_sky_light_treats_open_sky_above_the_mask_as_15() {
        let mut layers: Vec<Option<Vec<u8>>> = (0..18).map(|_| None).collect();
        layers[1] = layer(0x00);
        // Bit i of the mask is set when layer i is known; y 0 lives in layer 1.
        assert_eq!(native_sky_light(&layers, true, 0b10, 0, 0, 0, true), 0);
        assert_eq!(native_sky_light(&layers, true, 0b10, 0, 16, 0, true), 15);
        // A hole above a known layer keeps searching until the mask top.
        assert_eq!(native_sky_light(&layers, true, 0b110, 0, 16, 0, true), 15);
    }
}
