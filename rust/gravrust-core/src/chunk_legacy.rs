//! Port of the protocol-498 / 578 column decoders:
//! `client/js/world/chunk-1.14.4.js` and `chunk-1.15.2.js`.
//!
//! These are the wire formats used before the 1.16 heightmap/palette changes:
//! an optional section mask, then for each present section a transmitted
//! non-air count, bit width, optional local palette and 64*bits packed longs.
//! The 1.14.4 variant additionally carries a 256-entry ground-up biome array.

use wasm_bindgen::prelude::*;

pub const BLOCK_STATE_COUNT_498: u32 = 11271;
pub const BLOCK_STATE_COUNT_578: u32 = 11337;
pub const AIR_STATES: [u32; 3] = [0, 9129, 9130];

const SECTION_VOLUME: usize = 4096;

#[derive(Debug)]
struct Section {
    blocks: Vec<u32>,
    non_air: u32,
    wire_non_air: u32,
}

/// Decoded column. Sections are indexed by section Y (0..16).
#[wasm_bindgen]
pub struct ChunkColumn {
    sections: Vec<Option<Section>>,
    biomes: Option<Vec<u32>>,
}

#[wasm_bindgen]
impl ChunkColumn {
    pub fn present(&self, y: u32) -> bool {
        self.sections.get(y as usize).map(|section| section.is_some()).unwrap_or(false)
    }

    /// Block states for a section, or an empty vector when it is absent.
    pub fn blocks(&self, y: u32) -> Vec<u32> {
        self.sections
            .get(y as usize)
            .and_then(|section| section.as_ref())
            .map(|section| section.blocks.clone())
            .unwrap_or_default()
    }

    pub fn non_air(&self, y: u32) -> u32 {
        self.sections
            .get(y as usize)
            .and_then(|section| section.as_ref())
            .map(|section| section.non_air)
            .unwrap_or(0)
    }

    pub fn wire_non_air(&self, y: u32) -> u32 {
        self.sections
            .get(y as usize)
            .and_then(|section| section.as_ref())
            .map(|section| section.wire_non_air)
            .unwrap_or(0)
    }

    pub fn has_biomes(&self) -> bool {
        self.biomes.is_some()
    }

    pub fn biomes(&self) -> Vec<u32> {
        self.biomes.clone().unwrap_or_default()
    }
}

#[derive(Debug)]
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

    fn u8(&mut self) -> Option<u8> {
        let value = *self.data.get(self.offset)?;
        self.offset += 1;
        Some(value)
    }

    fn u16(&mut self) -> Option<u16> {
        let bytes = self.data.get(self.offset..self.offset + 2)?;
        self.offset += 2;
        Some(u16::from_be_bytes([bytes[0], bytes[1]]))
    }

    fn i32(&mut self) -> Option<i32> {
        let bytes = self.data.get(self.offset..self.offset + 4)?;
        self.offset += 4;
        Some(i32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
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
}

fn global_bits(state_count: u32) -> u32 {
    (state_count as f64).log2().ceil() as u32
}

fn decode_section(
    cursor: &mut Cursor,
    state_count: u32,
    bits_global: u32,
) -> Option<Section> {
    let wire_non_air = cursor.u16()? as u32;
    let bits = cursor.u8()? as u32;
    if bits < 4 || (bits > 8 && bits != bits_global) {
        return None;
    }
    let mut palette: Option<Vec<u32>> = None;
    if bits <= 8 {
        let len = cursor.varint()?;
        if len < 1 || len as u32 > (1u32 << bits) {
            return None;
        }
        let mut values = Vec::with_capacity(len as usize);
        for _ in 0..len {
            let id = cursor.varint()?;
            if id < 0 || id as u32 >= state_count {
                return None;
            }
            values.push(id as u32);
        }
        palette = Some(values);
    }
    let longs = cursor.varint()?;
    if longs != 64 * bits as i32 {
        return None;
    }
    let mut words = vec![0u32; longs as usize * 2];
    for i in 0..longs as usize {
        let high = cursor.i32()? as u32;
        let low = cursor.i32()? as u32;
        words[i * 2 + 1] = high;
        words[i * 2] = low;
    }
    let mask = (1u32 << bits) - 1;
    let mut blocks = vec![0u32; SECTION_VOLUME];
    for (i, slot) in blocks.iter_mut().enumerate() {
        let bit = i * bits as usize;
        let word = bit >> 5;
        let shift = (bit & 31) as u32;
        let mut value = words[word] >> shift;
        if shift + bits > 32 {
            value |= words[word + 1] << (32 - shift);
        }
        value &= mask;
        if let Some(palette) = &palette {
            *slot = *palette.get(value as usize)?;
        } else {
            if value >= state_count {
                return None;
            }
            *slot = value;
        }
    }
    let non_air = blocks
        .iter()
        .filter(|state| !AIR_STATES.contains(state))
        .count() as u32;
    Some(Section {
        blocks,
        non_air,
        wire_non_air,
    })
}

fn decode_498(data: &[u8], bit_map: u32, state_count: u32, ground_up: bool) -> Option<ChunkColumn> {
    if bit_map > 0xffff || state_count < 1 {
        return None;
    }
    let mut cursor = Cursor::new(data);
    let bits_global = global_bits(state_count);
    let mut sections = Vec::with_capacity(16);
    for y in 0..16 {
        if bit_map & (1 << y) != 0 {
            sections.push(Some(decode_section(&mut cursor, state_count, bits_global)?));
        } else {
            sections.push(None);
        }
    }
    let biomes = if ground_up {
        let mut values = Vec::with_capacity(256);
        for _ in 0..256 {
            values.push(cursor.i32()? as u32);
        }
        Some(values)
    } else {
        None
    };
    if cursor.remaining() != 0 {
        return None;
    }
    Some(ChunkColumn { sections, biomes })
}

fn decode_578(data: &[u8], bit_map: u32, state_count: u32) -> Option<ChunkColumn> {
    if bit_map > 0xffff || state_count < 1 {
        return None;
    }
    let mut cursor = Cursor::new(data);
    let bits_global = global_bits(state_count);
    let mut sections = Vec::with_capacity(16);
    for y in 0..16 {
        if bit_map & (1 << y) != 0 {
            sections.push(Some(decode_section(&mut cursor, state_count, bits_global)?));
        } else {
            sections.push(None);
        }
    }
    if cursor.remaining() != 0 {
        return None;
    }
    Some(ChunkColumn {
        sections,
        biomes: None,
    })
}

/// Decode a 1.14.4 (protocol 498) chunk column. `None` on any validation error.
#[wasm_bindgen]
pub fn decode_chunk_498(
    data: &[u8],
    bit_map: u32,
    state_count: u32,
    ground_up: bool,
) -> Option<ChunkColumn> {
    decode_498(data, bit_map, state_count, ground_up)
}

/// Decode a 1.15.2 (protocol 578) chunk column. Biomes live on the packet and
/// are not part of `data`.
#[wasm_bindgen]
pub fn decode_chunk_578(data: &[u8], bit_map: u32, state_count: u32) -> Option<ChunkColumn> {
    decode_578(data, bit_map, state_count)
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

    fn section(bits: u32, palette: &[u32], values: &[u32]) -> Vec<u8> {
        let mut out = Vec::new();
        out.extend_from_slice(&7u16.to_be_bytes());
        out.push(bits as u8);
        if bits <= 8 {
            varint(&mut out, palette.len() as u32);
            for id in palette {
                varint(&mut out, *id);
            }
        }
        varint(&mut out, 64 * bits);
        let mut longs = vec![0u64; (64 * bits) as usize];
        for (i, value) in values.iter().enumerate() {
            let bit = i * bits as usize;
            let word = bit / 64;
            let shift = (bit % 64) as u32;
            longs[word] |= (*value as u64) << shift;
            if shift + bits > 64 {
                longs[word + 1] |= (*value as u64) >> (64 - shift);
            }
        }
        for long in longs {
            out.extend_from_slice(&long.to_be_bytes());
        }
        out
    }

    #[test]
    fn decodes_a_local_palette_section() {
        let palette = [0, 42, 9129];
        let values: Vec<u32> = (0..4096).map(|i| (i % palette.len()) as u32).collect();
        let mut data = section(4, &palette, &values);
        data.extend(std::iter::repeat(0).take(256 * 4));
        let column = decode_498(&data, 1, BLOCK_STATE_COUNT_498, true).expect("column");
        assert!(column.present(0));
        assert!(!column.present(1));
        assert_eq!(column.blocks(0)[0], 0);
        assert_eq!(column.blocks(0)[1], 42);
        assert!(column.has_biomes());
        assert_eq!(column.biomes().len(), 256);
    }

    #[test]
    fn rejects_wrong_long_count_and_trailing_data() {
        let palette = [0u32];
        let values = vec![0u32; 4096];
        let mut data = section(4, &palette, &values);
        // Corrupt the long count (first varint after the palette).
        let mut bad = Vec::new();
        bad.extend_from_slice(&7u16.to_be_bytes());
        bad.push(4);
        varint(&mut bad, 1);
        varint(&mut bad, 0);
        varint(&mut bad, 64 * 4 - 1);
        assert!(decode_578(&bad, 1, BLOCK_STATE_COUNT_578).is_none());

        data.push(0);
        assert!(decode_578(&data, 1, BLOCK_STATE_COUNT_578).is_none());
    }

    #[test]
    fn decodes_global_palette_sections() {
        let bits = global_bits(BLOCK_STATE_COUNT_578);
        let values: Vec<u32> = (0..4096).map(|i| (i as u32 * 7) % BLOCK_STATE_COUNT_578).collect();
        let data = section(bits, &[], &values);
        let column = decode_578(&data, 1, BLOCK_STATE_COUNT_578).expect("column");
        assert_eq!(column.blocks(0)[..4], values[..4]);
        assert!(column.non_air(0) > 0);
    }
}
