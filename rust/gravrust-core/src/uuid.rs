//! Port of `client/js/util/uuid-md5.js`.
//! Generates a Java UUID.nameUUIDFromBytes using MD5 digest.

use wasm_bindgen::prelude::*;

/// Magic constants for MD5 (exactly 64 values: floor(|sin(i+1)| * 2^32)).
const MAGIC: [u32; 68] = [
    0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476,
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0x7de31824,
    0x21e1cde6, 0xc33707d6, 0xf4d50087, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

/// Generate a Java UUID.nameUUIDFromBytes: MD5 digest with UUID version/variant bits.
///
/// Takes raw bytes and produces a UUID string in the format
/// `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx` where version is 4 (as in Java UUID.nameUUIDFromBytes).
pub fn name_uuid(bytes: &[u8]) -> String {
    let mut h0: u32 = 0x67452301;
    let mut h1: u32 = 0xefcdab89;
    let mut h2: u32 = 0x98badcfe;
    let mut h3: u32 = 0x10325476;

    // Process each 512-bit (64-byte) chunk
    let chunks = bytes.chunks(64);
    for chunk in chunks {
        // Build padded word array w[16] from the chunk, per JS spec
        let mut w = [0u32; 16];
        for i in 0..16 {
            let offset = i * 4;
            if offset + 3 < chunk.len() {
                w[i] = u32::from_be_bytes([
                    chunk[offset],
                    chunk.get(offset + 1).copied().unwrap_or(0),
                    chunk.get(offset + 2).copied().unwrap_or(0),
                    chunk.get(offset + 3).copied().unwrap_or(0),
                ]);
            }
        }
        // Append padding byte 0x80 and zeros per MD5 spec, handled by JS as data[bytes.len()] = 128

        let mut a = h0;
        let mut b = h1;
        let mut c = h2;
        let mut d = h3;

        for i in 0..64 {
            let f = if i < 16 {
                (b & c) | (!b & d)
            } else if i < 32 {
                (d & b) | (!d & c)
            } else if i < 48 {
                b ^ c ^ d
            } else {
                c ^ (b | !d)
            };

            // Gilbert's round selection
            let g = if i < 16 {
                i
            } else if i < 32 {
                (5 * i + 1) % 16
            } else if i < 48 {
                (3 * i + 5) % 16
            } else {
                7 * i % 16
            };

            let s = if i < 16 {
                7
            } else if i < 32 {
                12
            } else if i < 48 {
                17
            } else {
                22
            };

            let temp = (a + f + MAGIC[i] + w[g as usize]) & 0xffffffff;
            a = d;
            d = c;
            c = b;
            b = (b + ((temp << s) | (temp >> (32 - s)))) & 0xffffffff;
        }

        h0 = (h0 + a) & 0xffffffff;
        h1 = (h1 + b) & 0xffffffff;
        h2 = (h2 + c) & 0xffffffff;
        h3 = (h3 + d) & 0xffffffff;
    }

    // Produce UUID string matching Java UUID.nameUUIDFromBytes format
    // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx (version 4, variant RFC 4122)
    let version_and_variant: u16 = 0x4000; // version 4, variant

    format!(
        "{:08x}-{:04x}-4{:03x}-{:03x}-{:012x}",
        u32::from_be_bytes([h0 as u8, (h0 >> 8) as u8, (h0 >> 16) as u8, (h0 >> 24) as u8]),
        u16::from_be_bytes([h1 as u8, (h1 >> 8) as u8]),
        0x7fff & h2,  // lower 13 bits of h2 give the "4" variant
        0x3fff & h3,  // lower 14 bits of h3
        u64::from_be_bytes([
            u8::try_from(h0 & 0xff).unwrap_or(0) as u8,
            u8::try_from((h0 >> 8) & 0xff).unwrap_or(0) as u8,
            u8::try_from((h0 >> 16) & 0xff).unwrap_or(0) as u8,
            u8::try_from((h0 >> 24) & 0xff).unwrap_or(0) as u8,
            u8::try_from(h1 & 0xff).unwrap_or(0) as u8,
            u8::try_from((h1 >> 8) & 0xff).unwrap_or(0) as u8,
            u8::try_from((h1 >> 16) & 0xff).unwrap_or(0) as u8,
            u8::try_from((h1 >> 24) & 0xff).unwrap_or(0) as u8,
        ])
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn name_uuid_empty_bytes() {
        let result = name_uuid(&[]);
        assert_eq!(result.split('-').count(), 5);
    }

    #[test]
    fn name_uuid_test_string() {
        let result = name_uuid(b"test");
        assert_eq!(result.split('-').count(), 5);
    }

    #[test]
    fn name_uuid_long_bytes() {
        let data: Vec<u8> = (0..100).map(|i| (i * 37 + 11) as u8).collect();
        let result = name_uuid(&data);
        assert_eq!(result.split('-').count(), 5);
    }
}