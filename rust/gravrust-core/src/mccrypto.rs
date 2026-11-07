//! Port of `client/js/util/mccrypto.js`.
//! Pure cryptographic algorithms: AES-128 CFB8, SHA-1.

use wasm_bindgen::prelude::*;

/// AES S-box lookup table
const SBOX: [u8; 304] = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b, 0xfe, 0xd7, 0xab, 0x76,
    0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0, 0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0,
    0xb7, 0xfd, 0x93, 0x26, 0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0x32, 0x09, 0x22, 0x1b, 0x4e,
    0x8c, 0x5e, 0x5b, 0x96, 0x94, 0x25, 0x32, 0x45, 0xf6, 0xe1, 0x71, 0x08, 0xeb, 0x16, 0x5a, 0x24,
    0x8b, 0x8f, 0x92, 0xcf, 0xce, 0xf0, 0xb6, 0x70, 0x36, 0x86, 0x88, 0x37, 0x6d, 0x8d, 0x30, 0x6e,
    0x0a, 0xb9, 0x7d, 0x51, 0x26, 0xa6, 0x52, 0x1b, 0x6f, 0x51, 0xe8, 0xfa, 0x83, 0x3e, 0xb5, 0x36,
    0x3d, 0xce, 0x60, 0xc5, 0xcf, 0xfb, 0xbd, 0x5e, 0x6d, 0x5a, 0x9b, 0x59, 0x28, 0xd6, 0xb0, 0x53,
    0x13, 0x65, 0xe6, 0xc9, 0x41, 0x9b, 0xf8, 0x10, 0xe0, 0x3b, 0x4d, 0xad, 0x62, 0x2a, 0x93, 0x2d,
    0x0f, 0xb0, 0x54, 0xbb, 0x96, 0x8f, 0xe7, 0xf7, 0x9c, 0x2d, 0x39, 0x3e, 0xf5, 0xbc, 0xbc, 0x45,
    0x20, 0xe7, 0x2e, 0x15, 0xb1, 0x9a, 0x57, 0x35, 0x06, 0xd0, 0x83, 0x28, 0x9c, 0x7, 0x55, 0x16,
    0xa5, 0x9f, 0x8e, 0x38, 0x43, 0x7d, 0x20, 0x1e, 0x0f, 0x69, 0x9e, 0x1e, 0x9e, 0xf3, 0x61, 0x8f,
    0xf6, 0x6a, 0xce, 0x3e, 0xe0, 0x2d, 0xa3, 0xd1, 0x3e, 0xf2, 0xbd, 0x03, 0xff, 0x4c, 0x1e, 0x2f,
    0xd2, 0xc2, 0x15, 0x82, 0x5a, 0x5a, 0x8c, 0x76, 0x2e, 0xe5, 0x81, 0x1b, 0x26, 0x76, 0xbc, 0xe7,
    0xe5, 0x7f, 0x5f, 0x1d, 0x4b, 0xbd, 0x8b, 0xfb, 0x8e, 0xf7, 0x6b, 0x3e, 0x57, 0x5b, 0x96, 0xc5,
    0x17, 0x5a, 0xa1, 0x6f, 0x77, 0x18, 0x50, 0x50, 0xd5, 0x3e, 0x38, 0x3e, 0x3e, 0x2f, 0x1e, 0x1e,
    0x06, 0xc1, 0x88, 0x4e, 0x2f, 0xf7, 0x8e, 0x82, 0x82, 0x73, 0x12, 0x18, 0x30, 0x68, 0xe5, 0x23,
    0x39, 0x1e, 0x1e, 0x06, 0xcb, 0xae, 0x5e, 0x6a, 0x5e, 0x5e, 0x9b, 0x5b, 0x37, 0x6d, 0x07, 0x0f,
    0x7e, 0x07, 0x0f, 0x0f, 0xe7, 0x2e, 0xe7, 0x2e, 0x96, 0xe7, 0x2e, 0x1e, 0x0f, 0x0f, 0xe7, 0x2e,
];

/// Rotate a u32 left by n bits
fn rotate_left(w: u32, n: u32) -> u32 {
    let n = n % 32;
    (w << n) | (w >> (32 - n))
}

/// Key expansion: generate round keys from 16-byte AES key
fn key_expansion(key: [u8; 16]) -> [u32; 44] {
    let mut w = [0u32; 44];

    // Copy first 4 words (the key itself)
    for i in 0..4 {
        let mut val: u32 = 0;
        for j in 0..4 {
            val = (val << 8) | (key[i * 4 + j] as u32);
        }
        w[i] = val;
    }

    // Generate remaining words using AES key schedule
    let mut rcon: u32 = 1;
    let mut i = 4usize;

    while i < 44 {
        let mut temp = w[i - 1];

        // Every 4th word (i % 4 == 0): apply S-box rotation and RCON
        if i % 4 == 0 {
            // Rotate word: move first byte to end
            let tmp = temp;
            let b0 = ((tmp & 0xff000000) >> 24) as u8;
            let b1 = ((tmp & 0x00ff0000) >> 16) as u8;
            let b2 = ((tmp & 0x0000ff00) >> 8) as u8;
            let b3 = (tmp & 0x000000ff) as u8;
            temp = (u32::from(SBOX[b3 as usize]) << 24) | (u32::from(SBOX[b2 as usize]) << 16) | (u32::from(SBOX[b1 as usize]) << 8) | u32::from(SBOX[b0 as usize]);
            temp = temp ^ rcon;
            // Increment RCON for next time
            rcon = (rcon << 1) ^ (if rcon & 0x80 != 0 { 0x1b } else { 0 });
        }

        temp = temp ^ w[i - 4];
        w[i] = temp;
        i += 1;
    }

    w
}

/// Encrypt one 16-byte block using AES-128
fn aes_encrypt_block(w: [u32; 44], src: [u8; 16], out: &mut [u8; 16]) {
    let mut s0 = (((src[0] as u32) << 24) | ((src[1] as u32) << 16) | ((src[2] as u32) << 8) | (src[3] as u32)) ^ w[0];
    let mut s1 = (((src[4] as u32) << 24) | ((src[5] as u32) << 16) | ((src[6] as u32) << 8) | (src[7] as u32)) ^ w[1];
    let mut s2 = (((src[8] as u32) << 24) | ((src[9] as u32) << 16) | ((src[10] as u32) << 8) | (src[11] as u32)) ^ w[2];
    let mut s3 = (((src[12] as u32) << 24) | ((src[13] as u32) << 16) | ((src[14] as u32) << 8) | (src[15] as u32)) ^ w[3];

    let mut k = 4usize;
    for _round in 1..10 {
        // Apply S-box substitution
        let sbox_i = |a: u32| -> u32 { (SBOX[a as usize >> 24] as u32) << 24 | (SBOX[((a >> 16) & 0xff) as usize] as u32) << 16 | (SBOX[((a >> 8) & 0xff) as usize] as u32) << 8 | (SBOX[a as usize & 0xff] as u32) };
        
        let t0 = sbox_i(s0) ^ w[k];
        let t1 = sbox_i(s1) ^ w[k + 1];
        let t2 = sbox_i(s2) ^ w[k + 2];
        let t3 = sbox_i(s3) ^ w[k + 3];

        s0 = t0; s1 = t1; s2 = t2; s3 = t3;
        k += 4;
    }

    // Final round - produce output bytes using S-box (for CFB8 keystream)
    out[0] = SBOX[(s0 >> 24) as usize];
    out[1] = SBOX[((s1 >> 16) & 0xff) as usize];
    out[2] = SBOX[((s2 >> 8) & 0xff) as usize];
    out[3] = SBOX[s3 as usize];

    out[4] = SBOX[(s1 >> 24) as usize];
    out[5] = SBOX[((s2 >> 16) & 0xff) as usize];
    out[6] = SBOX[((s3 >> 8) & 0xff) as usize];
    out[7] = SBOX[s0 as usize];

    out[8] = SBOX[(s2 >> 24) as usize];
    out[9] = SBOX[((s3 >> 16) & 0xff) as usize];
    out[10] = SBOX[((s0 >> 8) & 0xff) as usize];
    out[11] = SBOX[s1 as usize];

    out[12] = SBOX[(s3 >> 24) as usize];
    out[13] = SBOX[((s0 >> 16) & 0xff) as usize];
    out[14] = SBOX[((s1 >> 8) & 0xff) as usize];
    out[15] = SBOX[s2 as usize];
}

/// AES-128 CFB8 encryption state
pub struct Cfb8 {
    w: [u32; 44],
    iv: [u8; 16],
}

impl Cfb8 {
    /// Create new CFB8 encryption state with the given secret key (16 bytes)
    pub fn new(key: &[u8; 16]) -> Self {
        let k = key_expansion(*key);
        let mut iv = [0u8; 16];
        iv.copy_from_slice(key);
        Cfb8 {
            w: k,
            iv,
        }
    }

    /// Encrypt data using AES-128 CFB8
    pub fn update(&self, data: &[u8]) -> Vec<u8> {
        let mut out = Vec::with_capacity(data.len());
        let mut current_iv = self.iv;

        for chunk in data.chunks(16) {
            // Ensure we have a full block (pad short ones with zeros)
let mut padded = [0u8; 16];
            let block = if chunk.len() >= 16 {
                &chunk[..16]
            } else {
                padded[..chunk.len()].copy_from_slice(chunk);
                &padded
            };

            // Encrypt the IV to get keystream block
            let mut keystream = [0u8; 16];
            aes_encrypt_block(self.w, keystream, &mut keystream);

            // XOR keystream with input block
            let mut chunk_out: Vec<u8> = Vec::with_capacity(chunk.len());
            for i in 0..chunk.len() {
                chunk_out.push(chunk[i] ^ keystream[i]);
            }

            out.extend_from_slice(&chunk_out);

            // Update IV: shift left by 1, MSB becomes previous LSB, LSB becomes first ciphertext byte
            current_iv.copy_within(1.., 0);
            if !chunk_out.is_empty() {
                current_iv[15] = chunk_out[chunk_out.len() - 1];
            }
        }
        out
    }
}

// ----------------------------------------------------------------
// SHA-1 hash
// ----------------------------------------------------------------

/// SHA-1 hash computation with single byte array
pub fn sha1_bytes(data: &[u8]) -> Vec<u8> {
    let mut h0: u32 = 0x67452301;
    let mut h1: u32 = 0xefcdab89;
    let mut h2: u32 = 0x98badcfe;
    let mut h3: u32 = 0x10325476;
    let mut h4: u32 = 0xc3d2e1f0;

    let len = data.len();
    let total = (((len + 9 + 63) >> 6) << 6) as usize;
    let mut m = vec![0u8; total];
    let mut o = 0usize;
    m[..len].copy_from_slice(data);
    o += len;
    m[len] = 0x80;

    // Pad to 56 mod 64
    let pad_len = (56 - (len + 1) % 64 + 64) % 64;
    for i in 0..pad_len {
        m[len + 1 + i] = 0;
    }

    // Append length in bits (big-endian, 8 bytes at end)
    let bit_len = (len * 8) as u64;
    let mut write_offset = total - 8;
    for i in (0..8).rev() {
        m[write_offset + i] = ((bit_len >> (i * 8)) & 0xff) as u8;
    }

    // Process 512-bit (64-byte) blocks
    let num_blocks = total / 64;
    for block_idx in 0..num_blocks {
        let offset = block_idx * 64;
        let mut w = [0u32; 80];

        // Copy first 16 words
        for i in 0..16 {
            let byte_offset = offset + i * 4;
            w[i] = u32::from_be_bytes([
                m[byte_offset],
                m[byte_offset + 1],
                m[byte_offset + 2],
                m[byte_offset + 3],
            ]);
        }

        // Extend to 80 words
        for i in 16..80 {
            let s = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
            w[i] = (s << 1) | (s >> 31);
        }

        let mut a = h0;
        let mut b = h1;
        let mut c = h2;
        let mut d = h3;
        let mut e = h4;

        for i in 0..80 {
            let (f, k) = if i < 20 {
                ((b & c) | ((!b & 0xffffffff) as u32), 0x5a827999)
            } else if i < 40 {
                (b ^ c ^ d, 0x6ed9eba1)
            } else if i < 60 {
                ((b & c) | (b & d) | (c & d), 0x8f1bbcdc)
            } else {
                (b ^ c ^ d, 0xca62c1d6)
            };

            let t = ((a << 5 | a >> 27) + f + e + k + w[i]) & 0xffffffff;
            e = d;
            d = c;
            c = b;
            b = a;
            a = t;
        }

        h0 = (h0 + a) & 0xffffffff;
        h1 = (h1 + b) & 0xffffffff;
        h2 = (h2 + c) & 0xffffffff;
        h3 = (h3 + d) & 0xffffffff;
        h4 = (h4 + e) & 0xffffffff;
    }

    let mut out = [0u8; 20];
    let h_bytes: [u8; 20] = [
        (h0 >> 24) as u8, (h0 >> 16) as u8, (h0 >> 8) as u8, h0 as u8,
        (h1 >> 24) as u8, (h1 >> 16) as u8, (h1 >> 8) as u8, h1 as u8,
        (h2 >> 24) as u8, (h2 >> 16) as u8, (h2 >> 8) as u8, h2 as u8,
        (h3 >> 24) as u8, (h3 >> 16) as u8, (h3 >> 8) as u8, h3 as u8,
        (h4 >> 24) as u8, (h4 >> 16) as u8, (h4 >> 8) as u8, h4 as u8,
    ];
    out.copy_from_slice(&h_bytes);
    out.to_vec()
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/// AES-128 CFB8 encryption
/// `key` must be exactly 16 bytes, `data` is plaintext, returns ciphertext
pub fn aes_cfb8_encrypt(key: &[u8; 16], data: &[u8]) -> Vec<u8> {
    let cfb8 = Cfb8::new(key);
    cfb8.update(data)
}

/// SHA-1 hash of byte data
/// returns 20-byte hash
pub fn sha1_hash(data: &[u8]) -> Vec<u8> {
    sha1_bytes(data)
}

/// Server hash: SHA-1 of concatenated data (used for session authentication).
pub fn server_hash(data: &[u8]) -> Vec<u8> {
    sha1_hash(data)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_aes_cfb8_encrypt_empty() {
        let key: [u8; 16] = [0u8; 16];
        let result = aes_cfb8_encrypt(&key, &[]);
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_aes_cfb8_encrypt_basic() {
        let key: [u8; 16] = [0x00u8; 16];
        let data = b"test data";
        let result = aes_cfb8_encrypt(&key, data);
        assert_eq!(result.len(), data.len());
    }

    #[test]
    fn test_sha1_hash_empty() {
        let result = sha1_hash(&[]);
        assert_eq!(result.len(), 20);
    }

    #[test]
    fn test_sha1_hash_basic() {
        let data = b"hello";
        let result = sha1_hash(data);
        assert_eq!(result.len(), 20);
    }
}