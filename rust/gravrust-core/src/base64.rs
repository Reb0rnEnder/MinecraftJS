//! Port of `client/js/util/base64.js`.
//!
//! The client's decoder is deliberately forgiving: characters outside the
//! alphabet are skipped, padding is optional, and trailing bits that do not
//! form a full byte are dropped.

use wasm_bindgen::prelude::*;

const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn value_of(byte: u8) -> Option<u8> {
    match byte {
        b'A'..=b'Z' => Some(byte - b'A'),
        b'a'..=b'z' => Some(byte - b'a' + 26),
        b'0'..=b'9' => Some(byte - b'0' + 52),
        b'+' => Some(62),
        b'/' => Some(63),
        _ => None,
    }
}

pub fn base64_decode(value: &str) -> Vec<u8> {
    let mut out = Vec::with_capacity(value.len() * 3 / 4 + 3);
    let mut buffer: u32 = 0;
    let mut bits: u32 = 0;
    for byte in value.bytes() {
        let Some(symbol) = value_of(byte) else {
            continue;
        };
        buffer = ((buffer << 6) | symbol as u32) & 0x00ff_ffff;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buffer >> bits) & 0xff) as u8);
        }
    }
    out
}

#[wasm_bindgen]
pub fn decode_base64(value: &str) -> Vec<u8> {
    base64_decode(value)
}

#[wasm_bindgen]
pub fn encode_base64(bytes: &[u8]) -> String {
    let mut out = String::with_capacity((bytes.len() + 2) / 3 * 4);
    for chunk in bytes.chunks(3) {
        let a = chunk[0];
        let b = chunk.get(1).copied().unwrap_or(0);
        let c = chunk.get(2).copied().unwrap_or(0);
        out.push(ALPHABET[(a >> 2) as usize] as char);
        out.push(ALPHABET[(((a & 3) << 4) | (b >> 4)) as usize] as char);
        if chunk.len() > 1 {
            out.push(ALPHABET[(((b & 15) << 2) | (c >> 6)) as usize] as char);
        } else {
            out.push('=');
        }
        if chunk.len() > 2 {
            out.push(ALPHABET[(c & 63) as usize] as char);
        } else {
            out.push('=');
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use super::base64_decode as decode;

    #[test]
    fn decodes_standard_and_url_unfriendly_padding() {
        assert_eq!(decode("aGVsbG8="), b"hello");
        assert_eq!(decode("aGVsbG8"), b"hello");
        // '😩' (U+1F629) in UTF-8 — written as an escape so the file stays ASCII-safe.
        assert_eq!(decode("8J+YqQ=="), "\u{1f629}".as_bytes());
        assert_eq!(decode(""), b"");
    }

    #[test]
    fn ignores_non_alphabet_characters() {
        assert_eq!(decode("aG Vs\nbG8="), b"hello");
        assert_eq!(decode("!!!"), b"");
    }

    #[test]
    fn roundtrips_bytes() {
        for len in 0..40 {
            let bytes: Vec<u8> = (0..len).map(|i| (i * 37 + 11) as u8).collect();
            assert_eq!(decode(&encode_base64(&bytes)), bytes);
        }
    }
}
