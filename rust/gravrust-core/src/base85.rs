//! Port of `client/js/util/base85.js` (the raw-text-safe base85 used by packed
//! single-file builds). The JS bootstrap still decodes the payload before WASM
//! exists, so this is exposed for parity and future builds.

use wasm_bindgen::prelude::*;

const ALPHABET: &[u8] = br##"!"#$%'()*+,-./0123456789:;=?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\]^_`abcdefghijklmnopqrstuvwx"##;

fn value_of(byte: u8) -> Option<u8> {
    ALPHABET.iter().position(|candidate| *candidate == byte).map(|index| index as u8)
}

/// Decode `text` to exactly `length` bytes. Returns `None` for malformed data,
/// an invalid length, or a word above 32 bits.
#[wasm_bindgen]
pub fn decode_base85(text: &str, length: usize) -> Option<Vec<u8>> {
    let expected = length.div_ceil(4) * 5;
    if text.len() != expected {
        return None;
    }
    let mut out = vec![0u8; length];
    let mut position = 0usize;
    let bytes = text.as_bytes();
    for chunk in bytes.chunks_exact(5) {
        let mut value: u64 = 0;
        for byte in chunk {
            let digit = value_of(*byte)? as u64;
            value = value.checked_mul(85)?.checked_add(digit)?;
            if value > u32::MAX as u64 {
                return None;
            }
        }
        for shift in (0..4).rev() {
            if position >= length {
                break;
            }
            out[position] = (value >> (shift * 8)) as u8;
            position += 1;
        }
    }
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn encode(bytes: &[u8]) -> String {
        let mut out = String::new();
        for chunk in bytes.chunks(4) {
            let mut value = 0u32;
            for i in 0..4 {
                value = (value << 8) | chunk.get(i).copied().unwrap_or(0) as u32;
            }
            let mut digits = [0u8; 5];
            for i in (0..5).rev() {
                digits[i] = ALPHABET[(value % 85) as usize];
                value /= 85;
            }
            out.push_str(std::str::from_utf8(&digits).unwrap());
        }
        out
    }

    #[test]
    fn roundtrips_every_length() {
        for length in 0..80 {
            let bytes: Vec<u8> = (0..length).map(|i| (i * 37 + 11) as u8).collect();
            assert_eq!(decode_base85(&encode(&bytes), length).as_deref(), Some(bytes.as_slice()));
        }
    }

    #[test]
    fn rejects_bad_lengths_and_characters() {
        assert_eq!(decode_base85("!!!!", 3), None);
        assert_eq!(decode_base85("<!!!!", 4), None);
    }
}
