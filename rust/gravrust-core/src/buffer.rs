//! Port of the primitive half of `client/js/net/buffer.js`
//! (Reader/Writer: integers, VarInt/VarLong, strings, UUIDs, positions).
//!
//! The packet-body decoders are not here: those still live in JavaScript and
//! consume typed JS objects. A Rust protocol stack uses these primitives
//! natively; the parity suite checks them against the JS reader/writer.

use wasm_bindgen::prelude::*;

/// Read errors mirror the JS `Reader` exceptions. Keeping them as a plain Rust
/// value lets native tests exercise failure paths; wasm-bindgen converts them to
/// thrown JS errors at the boundary.
#[derive(Debug, Clone)]
pub struct BufferError(pub String);

impl From<BufferError> for JsValue {
    fn from(error: BufferError) -> JsValue {
        JsValue::from_str(&error.0)
    }
}

fn underflow() -> BufferError {
    BufferError("Packet underflow".to_string())
}

#[wasm_bindgen]
pub struct PacketReader {
    data: Vec<u8>,
    offset: usize,
}

impl PacketReader {
    fn take(&mut self, count: usize) -> Result<&[u8], BufferError> {
        if self.offset + count > self.data.len() {
            return Err(underflow());
        }
        let start = self.offset;
        self.offset += count;
        Ok(&self.data[start..start + count])
    }

    fn next_u8(&mut self) -> Result<u8, BufferError> {
        Ok(self.take(1)?[0])
    }

    fn next_u16(&mut self) -> Result<u16, BufferError> {
        let bytes = self.take(2)?;
        Ok(u16::from_be_bytes([bytes[0], bytes[1]]))
    }

    fn next_u32(&mut self) -> Result<u32, BufferError> {
        let bytes = self.take(4)?;
        Ok(u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
    }

    fn next_u64(&mut self) -> Result<u64, BufferError> {
        let bytes = self.take(8)?;
        Ok(u64::from_be_bytes([
            bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
        ]))
    }
}

#[wasm_bindgen]
impl PacketReader {
    #[wasm_bindgen(constructor)]
    pub fn new(bytes: &[u8]) -> PacketReader {
        PacketReader {
            data: bytes.to_vec(),
            offset: 0,
        }
    }

    pub fn remaining(&self) -> usize {
        self.data.len().saturating_sub(self.offset)
    }

    pub fn offset(&self) -> usize {
        self.offset
    }

    pub fn i8(&mut self) -> Result<i8, BufferError> {
        Ok(self.next_u8()? as i8)
    }

    pub fn u8(&mut self) -> Result<u8, BufferError> {
        self.next_u8()
    }

    pub fn read_bool(&mut self) -> Result<bool, BufferError> {
        Ok(self.next_u8()? != 0)
    }

    pub fn i16(&mut self) -> Result<i16, BufferError> {
        Ok(self.next_u16()? as i16)
    }

    pub fn u16(&mut self) -> Result<u16, BufferError> {
        self.next_u16()
    }

    pub fn i32(&mut self) -> Result<i32, BufferError> {
        Ok(self.next_u32()? as i32)
    }

    pub fn i64(&mut self) -> Result<i64, BufferError> {
        Ok(self.next_u64()? as i64)
    }

    pub fn f32(&mut self) -> Result<f32, BufferError> {
        Ok(f32::from_bits(self.next_u32()?))
    }

    pub fn f64(&mut self) -> Result<f64, BufferError> {
        Ok(f64::from_bits(self.next_u64()?))
    }

    /// Signed VarInt, matching `Reader.varint()`.
    pub fn varint(&mut self) -> Result<i32, BufferError> {
        let mut value: u32 = 0;
        let mut shift = 0;
        loop {
            let byte = self.next_u8()?;
            value |= ((byte & 0x7f) as u32) << shift;
            if byte & 0x80 == 0 {
                return Ok(value as i32);
            }
            shift += 7;
            if shift > 35 {
                return Err(BufferError("VarInt too big".to_string()));
            }
        }
    }

    /// Signed VarLong, matching `Reader.varlong()`.
    pub fn varlong(&mut self) -> Result<i64, BufferError> {
        let mut value: u64 = 0;
        let mut shift = 0;
        loop {
            let byte = self.next_u8()?;
            value |= ((byte & 0x7f) as u64) << shift;
            if byte & 0x80 == 0 {
                return Ok(value as i64);
            }
            shift += 7;
            if shift >= 64 {
                return Err(BufferError("VarLong too big".to_string()));
            }
        }
    }

    pub fn string(&mut self) -> Result<String, BufferError> {
        let length = self.varint()? as usize;
        let bytes = self.take(length)?.to_vec();
        Ok(crate::utf8::decode(&bytes))
    }

    pub fn bytes_n(&mut self, count: usize) -> Result<Vec<u8>, BufferError> {
        Ok(self.take(count)?.to_vec())
    }

    pub fn rest(&mut self) -> Result<Vec<u8>, BufferError> {
        let remaining = self.remaining();
        Ok(self.take(remaining)?.to_vec())
    }

    pub fn uuid(&mut self) -> Result<String, BufferError> {
        let bytes = self.take(16)?.to_vec();
        let hex: String = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
        Ok(format!(
            "{}-{}-{}-{}-{}",
            &hex[0..8],
            &hex[8..12],
            &hex[12..16],
            &hex[16..20],
            &hex[20..32]
        ))
    }

    /// Packed block position -> [x, y, z].
    pub fn position(&mut self) -> Result<Vec<i32>, BufferError> {
        let value = self.next_u64()? as i64;
        Ok(vec![
            sign_extend(value >> 38, 26),
            sign_extend((value >> 26) & 0xfff, 12),
            sign_extend(value & 0x3ffffff, 26),
        ])
    }

    pub fn angle(&mut self) -> Result<f64, BufferError> {
        Ok(self.i8()? as f64 * 360.0 / 256.0)
    }
}

fn sign_extend(value: i64, bits: u32) -> i32 {
    let shift = 64 - bits;
    ((value << shift) >> shift) as i32
}

#[wasm_bindgen]
#[derive(Debug)]
pub struct PacketWriter {
    data: Vec<u8>,
}

impl Default for PacketWriter {
    fn default() -> Self {
        Self::new()
    }
}

#[wasm_bindgen]
impl PacketWriter {
    #[wasm_bindgen(constructor)]
    pub fn new() -> PacketWriter {
        PacketWriter { data: Vec::new() }
    }

    pub fn i8(&mut self, value: i8) {
        self.data.push(value as u8);
    }

    pub fn u8(&mut self, value: u8) {
        self.data.push(value);
    }

    pub fn write_bool(&mut self, value: bool) {
        self.data.push(if value { 1 } else { 0 });
    }

    pub fn i16(&mut self, value: i16) {
        self.data.extend_from_slice(&value.to_be_bytes());
    }

    pub fn u16(&mut self, value: u16) {
        self.data.extend_from_slice(&value.to_be_bytes());
    }

    pub fn i32(&mut self, value: i32) {
        self.data.extend_from_slice(&value.to_be_bytes());
    }

    pub fn i64(&mut self, value: i64) {
        self.data.extend_from_slice(&value.to_be_bytes());
    }

    pub fn f32(&mut self, value: f32) {
        self.data.extend_from_slice(&value.to_bits().to_be_bytes());
    }

    pub fn f64(&mut self, value: f64) {
        self.data.extend_from_slice(&value.to_bits().to_be_bytes());
    }

    pub fn varint(&mut self, value: i32) {
        let mut value = value as u32;
        loop {
            let mut byte = (value & 0x7f) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80;
            }
            self.data.push(byte);
            if value == 0 {
                break;
            }
        }
    }

    pub fn varlong(&mut self, value: i64) {
        let mut value = value as u64;
        loop {
            let mut byte = (value & 0x7f) as u8;
            value >>= 7;
            if value != 0 {
                byte |= 0x80;
            }
            self.data.push(byte);
            if value == 0 {
                break;
            }
        }
    }

    pub fn string(&mut self, value: &str) {
        let bytes = value.as_bytes();
        self.varint(bytes.len() as i32);
        self.data.extend_from_slice(bytes);
    }

    pub fn raw(&mut self, bytes: &[u8]) {
        self.data.extend_from_slice(bytes);
    }

    pub fn uuid(&mut self, value: &str) {
        let hex: Vec<u8> = value
            .chars()
            .filter(|c| *c != '-')
            .collect::<String>()
            .as_bytes()
            .chunks(2)
            .filter_map(|pair| {
                std::str::from_utf8(pair)
                    .ok()
                    .and_then(|s| u8::from_str_radix(s, 16).ok())
            })
            .collect();
        for index in 0..16 {
            self.data.push(hex.get(index).copied().unwrap_or(0));
        }
    }

    pub fn position(&mut self, x: i32, y: i32, z: i32) {
        let value = (((x as i64) & 0x3ffffff) << 38)
            | (((y as i64) & 0xfff) << 26)
            | ((z as i64) & 0x3ffffff);
        self.i64(value);
    }

    pub fn build(&self) -> Vec<u8> {
        self.data.clone()
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrips_primitives() {
        let mut writer = PacketWriter::new();
        writer.i8(-5);
        writer.u8(250);
        writer.write_bool(true);
        writer.i16(-1234);
        writer.u16(65000);
        writer.i32(-1234567);
        writer.i64(-9_000_000_000);
        writer.f32(1.5);
        writer.f64(-2.25);
        writer.varint(-1);
        writer.varint(300);
        writer.varlong(-1);
        writer.varlong(1 << 40);
        writer.string("héllo");
        writer.raw(&[1, 2, 3]);
        writer.uuid("12345678-90ab-cdef-1234-567890abcdef");
        writer.position(-20_000_000, 128, 33_000_000);
        let bytes = writer.build();

        let mut reader = PacketReader::new(&bytes);
        assert_eq!(reader.i8().unwrap(), -5);
        assert_eq!(reader.u8().unwrap(), 250);
        assert!(reader.read_bool().unwrap());
        assert_eq!(reader.i16().unwrap(), -1234);
        assert_eq!(reader.u16().unwrap(), 65000);
        assert_eq!(reader.i32().unwrap(), -1234567);
        assert_eq!(reader.i64().unwrap(), -9_000_000_000);
        assert_eq!(reader.f32().unwrap(), 1.5);
        assert_eq!(reader.f64().unwrap(), -2.25);
        assert_eq!(reader.varint().unwrap(), -1);
        assert_eq!(reader.varint().unwrap(), 300);
        assert_eq!(reader.varlong().unwrap(), -1);
        assert_eq!(reader.varlong().unwrap(), 1 << 40);
        assert_eq!(reader.string().unwrap(), "héllo");
        assert_eq!(reader.bytes_n(3).unwrap(), vec![1, 2, 3]);
        assert_eq!(reader.uuid().unwrap(), "12345678-90ab-cdef-1234-567890abcdef");
        assert_eq!(reader.position().unwrap(), vec![-20_000_000, 128, 33_000_000]);
        assert_eq!(reader.remaining(), 0);
    }

    #[test]
    fn varint_encoding_matches_the_wire_format() {
        let mut writer = PacketWriter::new();
        writer.varint(0);
        writer.varint(1);
        writer.varint(127);
        writer.varint(128);
        writer.varint(255);
        writer.varint(-1);
        assert_eq!(
            writer.build(),
            vec![0x00, 0x01, 0x7f, 0x80, 0x01, 0xff, 0x01, 0xff, 0xff, 0xff, 0xff, 0x0f]
        );
    }

    #[test]
    fn reads_are_bounds_checked() {
        let mut reader = PacketReader::new(&[0x01]);
        assert!(reader.i32().is_err());
        assert_eq!(reader.remaining(), 1);
        assert_eq!(reader.bytes_n(1).unwrap(), vec![0x01]);
        assert!(reader.string().is_err());
    }
}
