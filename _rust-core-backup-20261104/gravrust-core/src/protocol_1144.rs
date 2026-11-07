//! Protocol 498 (1.14.4) base
//! VarInt with wrapping_shl fix

pub fn read_varint(data: &[u8]) -> (i32, usize) {
    let mut value = 0i32;
    let mut shift = 0;
    for (i, &byte) in data.iter().enumerate() {
        value |= ((byte & 0x7F) as i32).wrapping_shl(shift);  // FIX: wrapping_shl
        if byte & 0x80 == 0 {
            return (value, i + 1);
        }
        shift += 7;
    }
    (value, data.len())
}
