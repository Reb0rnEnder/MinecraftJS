//! Port of `client/js/world/chunk-1.15.2.js`.
//! Protocol-578 chunk section decoding for Java 1.15.2.

//! BLOCK_STATE_COUNT_578=11337; AIR_STATES_578=[0,9129,9130]

/// Block state count for 1.15.2 (11337 = Minecraft 1.15.2 block IDs).
pub const BLOCK_STATE_COUNT_578: u32 = 11337;

/// Air block states for 1.15.2.
#[cfg_attr(not(feature = "no_hash"), doc = "```")]
#[cfg(feature = "no_hash")]
pub const AIR_STATES_578: [u32; 3] = [0, 9129, 9130];

/// Decode 1.15.2 chunk data packet into section blocks and biomes.
///
/// This is the direct port of `decodeChunkData578` from
/// `client/js/world/chunk-1.15.2.js`.
///
/// The packet format expected:
/// - `bitMap`: u16 terrain section mask (bit y means section y is present)
/// - `chunkData`: byte array of the chunk data payload
/// - `biomes`: optional biome array from the packet
///
/// Returns `(sections, biomes)` where:
/// - `sections` is an array of 16 entries, each containing `blocks: [u32; 4096]`,
///   `nonAir: u32`, `wireNonAir: u32`
/// - `biomes` is `Option<Vec<u32>>` containing the biome data, or `None` if not provided
///
/// # Errors
///
/// Returns `Err` if the packet format is invalid or has trailing data.
pub fn decode_chunk_data_578(
    bit_map: u16,
    chunk_data: &[u8],
    biomes: Option<&[u32]>,
) -> Result<(Vec<SectionData_578>, Option<Vec<u32>>), String> {
    if chunk_data.is_empty() {
        return Err("chunk data is empty".to_string());
    }

    let state_count = BLOCK_STATE_COUNT_578;
    let global_bits = ((state_count - 1).ilog2() + 1) as usize; // ceil(log2(stateCount))

    let mut r = ChunkReader578::new(chunk_data);
    let mut sections = Vec::with_capacity(16);
    sections.resize(16, SectionData_578::default());

    let mut bit_map_processed = bit_map;
    for y in 0..16 {
        if bit_map_processed & (1 << y) == 0 {
            continue;
        }

    const wire_non_air = r.read_u16()?;
        let bits = r.read_u8()?;

        if bits < 4 || (bits > 8 && bits != global_bits) {
            return Err(format!("Invalid palette bit width: {}", bits));
        }

        let palette = if bits <= 8 {
            let n = r.read_varint()? as usize;
            if n < 1 || n > 1 << bits {
                return Err(format!("Invalid local palette size: {}", n));
            }
            let mut palette_arr = vec![0u32; n];
            for i in 0..n {
                let id = r.read_varint()? as u32;
                if id >= state_count {
                    return Err(format!("Invalid registry state: {}", id));
                }
                palette_arr[i] = id;
            }
            Some(palette_arr)
        } else {
            // flattened global registry state ids (bits > 8)
            None
        };

        let longs_count = r.read_varint()? as usize;
        if longs_count != 64 * bits {
            return Err(format!("Invalid packed section length: expected {} got {}", 64 * bits, longs_count));
        }

        let mut words = vec![0u32; longs_count * 2];
        for i in 0..longs_count {
            let lo = r.read_i32()? as u32;
            let hi = r.read_i32()? as u32;
            words[i * 2 + 1] = lo;
            words[i * 2] = hi;
        }

        let mut blocks = vec![0u32; 4096];
        let mask = if bits >= 32 {
            u32::MAX
        } else {
            (1u32 << bits) - 1
        };

        for i in 0..4096 {
            let offset = i * bits;
            let word_idx = offset >> 5;
            let shift = (offset & 31) as u32;
            let mut value = words.get(word_idx).copied().unwrap_or(0) >> shift;
            if shift + bits > 32 {
                let next_word = words.get(word_idx + 1).copied().unwrap_or(0);
                value |= next_word << (32 - shift);
            }
            value &= mask;

            if let Some(palette_arr) = &palette {
                if value >= palette_arr.len() {
                    return Err(format!("Invalid local palette index: {}", value));
                }
                value = palette_arr[value as usize];
            } else if value >= state_count {
                return Err(format!("Invalid registry state: {}", value));
            }
            blocks[i] = value;
        }

        let mut non_air = 0;
        for &state in &blocks {
            if !matches!(state, 0 | 9129 | 9130) {
                non_air += 1;
            }
        }

        sections[y] = SectionData_578 {
            blocks,
            non_air,
            wire_non_air,
        };
    }

    // Check for trailing data - 1.15.2 is strict
    if r.has_remaining() {
        return Err("Trailing 578 section data".to_string());
    }

    // Biomes from packet
    let biomes_out = match biomes {
        Some(b) => Some(b.to_vec()),
        None => None,
    };

    Ok((sections, biomes_out))
}

#[derive(Debug, Default)]
pub struct SectionData_578 {
    /// The 4096 block state values for this section.
    pub blocks: Vec<u32>,
    /// Number of non-air cells (excluding air 0 and fluid states 9129/9130).
    pub non_air: u32,
    /// The wire protocol non-air count (includes fluids).
    pub wire_non_air: u32,
}

/// Internal reader for 1.15.2 chunk data (Protocol-578).
struct ChunkReader578 {
    data: Vec<u8>,
    pos: usize,
}

impl ChunkReader578 {
    fn new(data: &[u8]) -> Self {
        ChunkReader578 {
            data: data.to_vec(),
            pos: 0,
        }
    }

    fn read_u16(&mut self) -> Result<u16, String> {
        if self.pos + 2 > self.data.len() {
            return Err("read_u16: unexpected end of data".to_string());
        }
        let val = u16::from_le_bytes([self.data[self.pos], self.data[self.pos + 1]]);
        self.pos += 2;
        Ok(val)
    }

    fn read_u8(&mut self) -> Result<u8, String> {
        if self.pos + 1 > self.data.len() {
            return Err("read_u8: unexpected end of data".to_string());
        }
        let val = self.data[self.pos];
        self.pos += 1;
        Ok(val)
    }

    fn read_varint(&mut self) -> Result<u32, String> {
        let mut value: u32 = 0;
        let mut shift: u32 = 0;
        loop {
            if self.pos >= self.data.len() {
                return Err("read_varint: unexpected end of data".to_string());
            }
            let byte = self.data[self.pos] as u32;
            self.pos += 1;
            value |= (byte & 0x7f) << shift;
            if byte & 0x80 == 0 {
                return Ok(value);
            }
            shift += 7;
            if shift > 35 {
                return Err("read_varint: varint too long".to_string());
            }
        }
    }

    fn read_i32(&mut self) -> Result<u32, String> {
        if self.pos + 4 > self.data.len() {
            return Err("read_i32: unexpected end of data".to_string());
        }
        let val = u32::from_le_bytes([
            self.data[self.pos],
            self.data[self.pos + 1],
            self.data[self.pos + 2],
            self.data[self.pos + 3],
        ]);
        self.pos += 4;
        Ok(val)
    }

    fn has_remaining(&self) -> bool {
        self.pos < self.data.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_air_states_constant() {
        assert_eq!(AIR_STATES_578, [0, 9129, 9130]);
    }

    #[test]
    fn test_block_state_count() {
        assert_eq!(BLOCK_STATE_COUNT_578, 11337);
    }

    #[test]
    fn test_decode_empty() {
        let result = decode_chunk_data_578(0, &[], None);
        assert!(result.is_err());
    }

    #[test]
    fn test_air_states_filter() {
        let blocks: Vec<u32> = vec![0, 1, 9129, 9130, 55, 0];
        let non_air = blocks
            .iter()
            .filter(|&&state| !matches!(state, 0 | 9129 | 9130))
            .count() as u32;
        assert_eq!(non_air, 2);
    }
}