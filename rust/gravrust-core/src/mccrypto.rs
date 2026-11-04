//! Port of `client/js/util/mccrypto.js`.
//!
//! Online-mode login without a proxy needs three primitives the browser does
//! not expose in a usable form here: AES-128-CFB8 for the encrypted stream,
//! SHA-1 for the session server id, and RSA PKCS#1 v1.5 encryption of the
//! shared secret with the server's X.509 public key. All three are pure
//! algorithms and run in the Rust core.

use std::sync::OnceLock;

use num_bigint::BigUint;
use wasm_bindgen::prelude::*;

// --------------------------------------------------------------------- AES-128

fn sbox() -> &'static [u8; 256] {
    static SBOX: OnceLock<[u8; 256]> = OnceLock::new();
    SBOX.get_or_init(|| {
        let mut exp = [0u8; 512];
        let mut log = [0u8; 256];
        let mut x: u16 = 1;
        for i in 0..255 {
            exp[i] = x as u8;
            log[x as usize] = i as u8;
            x ^= (x << 1) ^ if x & 0x80 != 0 { 0x1b } else { 0 };
            x &= 0xff;
        }
        for i in 255..512 {
            exp[i] = exp[i - 255];
        }
        let mut table = [0u8; 256];
        for i in 0..256 {
            let mut value = if i == 0 {
                0u32
            } else {
                exp[255 - log[i] as usize] as u32
            };
            value = value
                ^ ((value << 1) | (value >> 7))
                ^ ((value << 2) | (value >> 6))
                ^ ((value << 3) | (value >> 5))
                ^ ((value << 4) | (value >> 4))
                ^ 0x63;
            table[i] = (value & 0xff) as u8;
        }
        table
    })
}

fn expand_key(key: &[u8]) -> Option<[u32; 44]> {
    if key.len() != 16 {
        return None;
    }
    let sbox = sbox();
    let mut w = [0u32; 44];
    for i in 0..4 {
        w[i] = u32::from_be_bytes([key[i * 4], key[i * 4 + 1], key[i * 4 + 2], key[i * 4 + 3]]);
    }
    let mut rcon: u16 = 1;
    for i in 4..44 {
        let mut t = w[i - 1];
        if i % 4 == 0 {
            t = ((sbox[((t >> 16) & 255) as usize] as u32) << 24)
                | ((sbox[((t >> 8) & 255) as usize] as u32) << 16)
                | ((sbox[(t & 255) as usize] as u32) << 8)
                | (sbox[(t >> 24) as usize] as u32);
            t ^= (rcon as u32) << 24;
            rcon = ((rcon << 1) ^ if rcon & 0x80 != 0 { 0x1b } else { 0 }) & 0xff;
        }
        w[i] = w[i - 4] ^ t;
    }
    Some(w)
}

fn add_round_key(state: &mut [u8; 16], w: &[u32; 44], round: usize) {
    for column in 0..4 {
        let word = w[round * 4 + column].to_be_bytes();
        for row in 0..4 {
            state[column * 4 + row] ^= word[row];
        }
    }
}

fn sub_bytes(state: &mut [u8; 16]) {
    let sbox = sbox();
    for value in state.iter_mut() {
        *value = sbox[*value as usize];
    }
}

fn shift_rows(state: &mut [u8; 16]) {
    let old = *state;
    for row in 0..4 {
        for column in 0..4 {
            state[column * 4 + row] = old[((column + row) % 4) * 4 + row];
        }
    }
}

fn xtime(value: u8) -> u8 {
    ((value << 1) ^ if value & 0x80 != 0 { 0x1b } else { 0 }) & 0xff
}

fn mix_columns(state: &mut [u8; 16]) {
    for column in 0..4 {
        let i = column * 4;
        let a = [state[i], state[i + 1], state[i + 2], state[i + 3]];
        let all = a[0] ^ a[1] ^ a[2] ^ a[3];
        state[i] ^= all ^ xtime(a[0] ^ a[1]);
        state[i + 1] ^= all ^ xtime(a[1] ^ a[2]);
        state[i + 2] ^= all ^ xtime(a[2] ^ a[3]);
        state[i + 3] ^= all ^ xtime(a[3] ^ a[0]);
    }
}

fn encrypt_block(w: &[u32; 44], block: &[u8; 16]) -> [u8; 16] {
    let mut state = *block;
    add_round_key(&mut state, w, 0);
    for round in 1..10 {
        sub_bytes(&mut state);
        shift_rows(&mut state);
        mix_columns(&mut state);
        add_round_key(&mut state, w, round);
    }
    sub_bytes(&mut state);
    shift_rows(&mut state);
    add_round_key(&mut state, w, 10);
    state
}

/// AES/CFB8 with key = iv = the shared secret, matching
/// `CryptManager.createNetCipherInstance`.
#[wasm_bindgen]
pub struct Cfb8 {
    w: [u32; 44],
    iv: [u8; 16],
    decrypt: bool,
}

#[wasm_bindgen]
impl Cfb8 {
    #[wasm_bindgen(constructor)]
    pub fn new(secret: &[u8], decrypt: bool) -> Result<Cfb8, JsValue> {
        if secret.len() != 16 {
            return Err(JsValue::from_str("AES-128 secret must be 16 bytes"));
        }
        let w = expand_key(secret).ok_or_else(|| JsValue::from_str("invalid AES key"))?;
        let mut iv = [0u8; 16];
        iv.copy_from_slice(secret);
        Ok(Cfb8 { w, iv, decrypt })
    }

    pub fn update(&mut self, data: &[u8]) -> Vec<u8> {
        let mut out = Vec::with_capacity(data.len());
        for byte in data {
            let keystream = encrypt_block(&self.w, &self.iv);
            let value = if self.decrypt {
                out.push(byte ^ keystream[0]);
                *byte
            } else {
                let cipher = byte ^ keystream[0];
                out.push(cipher);
                cipher
            };
            self.iv.copy_within(1..16, 0);
            self.iv[15] = value;
        }
        out
    }
}

// ----------------------------------------------------------------------- SHA-1

fn sha1_digest(parts: &[&[u8]]) -> [u8; 20] {
    let len: usize = parts.iter().map(|part| part.len()).sum();
    let total = (len + 9 + 63) & !63;
    let mut message = vec![0u8; total];
    let mut offset = 0;
    for part in parts {
        message[offset..offset + part.len()].copy_from_slice(part);
        offset += part.len();
    }
    message[len] = 0x80;
    let bits = (len as u64).wrapping_mul(8);
    message[total - 8..].copy_from_slice(&bits.to_be_bytes());

    let mut h = [
        0x67452301u32,
        0xefcdab89,
        0x98badcfe,
        0x10325476,
        0xc3d2e1f0,
    ];
    let mut w = [0u32; 80];
    for block_start in (0..total).step_by(64) {
        for i in 0..16 {
            let b = block_start + i * 4;
            w[i] = u32::from_be_bytes([message[b], message[b + 1], message[b + 2], message[b + 3]]);
        }
        for i in 16..80 {
            let x = w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16];
            w[i] = x.rotate_left(1);
        }
        let (mut a, mut b, mut c, mut d, mut e) = (h[0], h[1], h[2], h[3], h[4]);
        for (i, word) in w.iter().enumerate() {
            let (f, k) = match i {
                0..=19 => ((b & c) | (!b & d), 0x5a82_7999u32),
                20..=39 => (b ^ c ^ d, 0x6ed9_eba1),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8f1b_bcdc),
                _ => (b ^ c ^ d, 0xca62_c1d6),
            };
            let t = a
                .rotate_left(5)
                .wrapping_add(f)
                .wrapping_add(e)
                .wrapping_add(k)
                .wrapping_add(*word);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = t;
        }
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
    }
    let mut out = [0u8; 20];
    for (i, value) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&value.to_be_bytes());
    }
    out
}

#[wasm_bindgen]
pub fn sha1(data: &[u8]) -> Vec<u8> {
    sha1_digest(&[data]).to_vec()
}

/// `new BigInteger(sha1(serverId, secret, publicKey)).toString(16)`:
/// two's-complement signed hex with no leading zeros.
#[wasm_bindgen]
pub fn server_hash(server_id: &str, secret: &[u8], public_key: &[u8]) -> String {
    let id: Vec<u8> = server_id
        .encode_utf16()
        .map(|unit| (unit & 0xff) as u8)
        .collect();
    let mut digest = sha1_digest(&[&id, secret, public_key]);
    let negative = digest[0] & 0x80 != 0;
    if negative {
        let mut carry = 1u16;
        for byte in digest.iter_mut().rev() {
            let value = (!*byte & 0xff) as u16 + carry;
            *byte = value as u8;
            carry = value >> 8;
        }
    }
    let hex: String = digest.iter().map(|byte| format!("{:02x}", byte)).collect();
    let hex = hex.trim_start_matches('0');
    format!("{}{}", if negative { "-" } else { "" }, if hex.is_empty() { "0" } else { hex })
}

// ------------------------------------------------------------------------ RSA

fn der_read(bytes: &[u8], offset: usize) -> Option<(u8, usize, usize)> {
    let tag = *bytes.get(offset)?;
    let mut cursor = offset + 1;
    let mut len = *bytes.get(cursor)? as usize;
    cursor += 1;
    if len & 0x80 != 0 {
        let count = len & 0x7f;
        len = 0;
        for _ in 0..count {
            len = len.checked_mul(256)?.checked_add(*bytes.get(cursor)? as usize)?;
            cursor += 1;
        }
    }
    let end = cursor.checked_add(len)?;
    if end > bytes.len() {
        return None;
    }
    Some((tag, cursor, end))
}

fn parse_spki(der: &[u8]) -> Option<(BigUint, BigUint)> {
    let (_, outer_start, _) = der_read(der, 0)?;
    let (_, _, alg_end) = der_read(der, outer_start)?;
    let (_, bits_start, _) = der_read(der, alg_end)?;
    let (_, rsa_start, _) = der_read(der, bits_start + 1)?;
    let (_, n_start, n_end) = der_read(der, rsa_start)?;
    let (_, e_start, e_end) = der_read(der, n_end)?;
    Some((
        BigUint::from_bytes_be(&der[n_start..n_end]),
        BigUint::from_bytes_be(&der[e_start..e_end]),
    ))
}

/// PKCS#1 v1.5 type 2 encryption. `random` is consumed in stream order; a
/// zero padding byte advances to the next random byte, matching the JS
/// `random(1)` retry loop.
#[wasm_bindgen]
pub fn rsa_encrypt(spki: &[u8], data: &[u8], random: &[u8]) -> Option<Vec<u8>> {
    let (n, e) = parse_spki(spki)?;
    let k = (n.bits() as usize + 7) / 8;
    if k < 11 || data.len() > k - 11 {
        return None;
    }
    let mut em = vec![0u8; k];
    em[1] = 2;
    let pad = k - data.len() - 3;
    let base = random.get(..pad)?;
    let mut cursor = pad;
    for index in 0..pad {
        let mut byte = base[index];
        while byte == 0 {
            byte = *random.get(cursor)?;
            cursor += 1;
        }
        em[2 + index] = byte;
    }
    em[k - data.len()..].copy_from_slice(data);
    let m = BigUint::from_bytes_be(&em);
    let c = m.modpow(&e, &n);
    let bytes = c.to_bytes_be();
    let mut out = vec![0u8; k];
    let start = k.saturating_sub(bytes.len());
    out[start..].copy_from_slice(&bytes[bytes.len().saturating_sub(k)..]);
    Some(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hex(bytes: &[u8]) -> String {
        bytes.iter().map(|byte| format!("{:02x}", byte)).collect()
    }

    #[test]
    fn aes_fips_197_vector() {
        let key: Vec<u8> = (0..16).collect();
        let w = expand_key(&key).unwrap();
        let block: [u8; 16] = [
            0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd,
            0xee, 0xff,
        ];
        assert_eq!(
            hex(&encrypt_block(&w, &block)),
            "69c4e0d86a7b0430d8cdb78070b4c55a"
        );
    }

    #[test]
    fn cfb8_roundtrips_and_shifts_the_register() {
        let secret: Vec<u8> = (0..16).map(|i| i * 7 + 1).collect();
        let plain: Vec<u8> = (0..64).map(|i| i as u8).collect();
        let mut enc = Cfb8::new(&secret, false).unwrap();
        let cipher = enc.update(&plain);
        assert_ne!(cipher, plain);
        let mut dec = Cfb8::new(&secret, true).unwrap();
        assert_eq!(dec.update(&cipher), plain);
    }

    #[test]
    fn sha1_known_vectors() {
        assert_eq!(hex(&sha1(b"")), "da39a3ee5e6b4b0d3255bfef95601890afd80709");
        assert_eq!(hex(&sha1(b"abc")), "a9993e364706816aba3e25717850c26c9cd0d89d");
        assert_eq!(
            hex(&sha1(b"The quick brown fox jumps over the lazy dog")),
            "2fd4e1c67a2d28fced849ee1bb76e7391b93eb12"
        );
    }

    #[test]
    fn server_hash_is_signed_hex() {
        // SHA-1("id2") has the high bit set, so the BigInteger form is negative.
        assert_eq!(server_hash("id2", &[], &[]), "-7982a07eef075586229c28bbf0de8dbd9b0efbd0");
        assert_eq!(
            server_hash("Notch", &[], &[]),
            "4ed1f46bbe04bc756bcb17c0c7ce3e4632f06a48"
        );
    }
}
