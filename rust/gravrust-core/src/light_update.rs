//! Port of `client/js/world/light-update.js`.
//!
//! Light section update equality checks. Server light is authoritative;
//! identical sections reuse their owned buffers.

/// Compares whether a 2048-byte light section has identical bytes.
pub fn same_light_bytes(previous: Option<&[u8]>, bytes: Option<&[u8]>) -> bool {
    match (previous, bytes) {
        (None, _) => false,
        (Some(prev), Some(cur)) => {
            if prev.len() < 2048 || cur.len() < 2048 {
                return false;
            }
            prev[..2048] == cur[..2048]
        }
        (Some(prev), None) => {
            if prev.len() < 2048 {
                return false;
            }
            prev[..2048].iter().all(|&b| b == 0)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_same_light_bytes() {
        let b1 = vec![0x12; 2048];
        let b2 = vec![0x12; 2048];
        let b3 = vec![0x34; 2048];
        let zeros = vec![0x00; 2048];

        assert!(same_light_bytes(Some(&b1), Some(&b2)));
        assert!(!same_light_bytes(Some(&b1), Some(&b3)));
        assert!(same_light_bytes(Some(&zeros), None));
        assert!(!same_light_bytes(Some(&b1), None));
        assert!(!same_light_bytes(None, Some(&b1)));
    }
}
