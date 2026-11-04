//! Port of `client/js/util/uuid-md5.js` (Java `UUID.nameUUIDFromBytes`).
//!
//! Self-contained MD5 so the WASM core does not need a crypto dependency.
//! The digest is marked as a name-based UUID (version 3, RFC 4122 variant).

use wasm_bindgen::prelude::*;

const SHIFTS: [u32; 16] = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];

const K: [u32; 64] = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613,
    0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193,
    0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d,
    0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122,
    0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa,
    0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244,
    0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb,
    0xeb86d391,
];

fn md5(bytes: &[u8]) -> [u8; 16] {
    let bit_len = (bytes.len() as u64).wrapping_mul(8);
    let mut data = Vec::with_capacity(bytes.len() + 72);
    data.extend_from_slice(bytes);
    data.push(0x80);
    while data.len() % 64 != 56 {
        data.push(0);
    }
    data.extend_from_slice(&bit_len.to_le_bytes());

    let mut a0: u32 = 0x67452301;
    let mut b0: u32 = 0xefcdab89;
    let mut c0: u32 = 0x98badcfe;
    let mut d0: u32 = 0x10325476;

    for chunk in data.chunks_exact(64) {
        let mut words = [0u32; 16];
        for (index, word) in words.iter_mut().enumerate() {
            let offset = index * 4;
            *word = u32::from_le_bytes([
                chunk[offset],
                chunk[offset + 1],
                chunk[offset + 2],
                chunk[offset + 3],
            ]);
        }

        let (mut a, mut b, mut c, mut d) = (a0, b0, c0, d0);
        for index in 0..64 {
            let round = index / 16;
            let (f, g) = match round {
                0 => ((b & c) | (!b & d), index),
                1 => ((d & b) | (!d & c), (5 * index + 1) % 16),
                2 => (b ^ c ^ d, (3 * index + 5) % 16),
                _ => (c ^ (b | !d), (7 * index) % 16),
            };
            let shift = SHIFTS[round * 4 + index % 4];
            let sum = a
                .wrapping_add(f)
                .wrapping_add(K[index])
                .wrapping_add(words[g]);
            let next = b.wrapping_add(sum.rotate_left(shift));
            a = d;
            d = c;
            c = b;
            b = next;
        }

        a0 = a0.wrapping_add(a);
        b0 = b0.wrapping_add(b);
        c0 = c0.wrapping_add(c);
        d0 = d0.wrapping_add(d);
    }

    let mut digest = [0u8; 16];
    for (offset, value) in [a0, b0, c0, d0].iter().enumerate() {
        digest[offset * 4..offset * 4 + 4].copy_from_slice(&value.to_le_bytes());
    }
    digest
}

pub fn name_uuid_string(bytes: &[u8]) -> String {
    let mut digest = md5(bytes);
    digest[6] = (digest[6] & 0x0f) | 0x30;
    digest[8] = (digest[8] & 0x3f) | 0x80;
    let hex: String = digest.iter().map(|byte| format!("{byte:02x}")).collect();
    format!(
        "{}-{}-{}-{}-{}",
        &hex[0..8],
        &hex[8..12],
        &hex[12..16],
        &hex[16..20],
        &hex[20..32]
    )
}

#[wasm_bindgen]
pub fn name_uuid(bytes: &[u8]) -> String {
    name_uuid_string(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_name_is_a_v3_uuid() {
        assert_eq!(
            name_uuid_string(b""),
            "d41d8cd9-8f00-3204-a980-0998ecf8427e"
        );
    }

    #[test]
    fn offline_notch_matches_java() {
        assert_eq!(
            name_uuid_string(b"OfflinePlayer:Notch"),
            "b50ad385-829d-3141-a216-7e7d7539ba7f"
        );
    }
}
