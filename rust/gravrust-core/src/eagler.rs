//! Port of `client/js/net/eagler.js`.
//!
//! Eaglercraft WebSocket handshake codecs and state machine:
//! - C 0x01 client version
//! - S 0x02 server version (or 0x03 version mismatch)
//! - C 0x04 request login
//! - S 0x05 allow login (or 0x06 deny)
//! - C 0x07 profile data (skin)
//! - C 0x08 finish login
//! - S 0x09 finish login -> play state
//! - S 0xFF error

pub const EAGLER_BRAND: &str = "Gravrust";
pub const EAGLER_VERSION: &str = "1.15.2";

pub const AUTH_NONE: u8 = 0;
pub const AUTH_PLAINTEXT: u8 = 255;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EaglerPacketId {
    ClientVersion = 0x01,
    ServerVersion = 0x02,
    VersionMismatch = 0x03,
    RequestLogin = 0x04,
    AllowLogin = 0x05,
    DenyLogin = 0x06,
    ProfileData = 0x07,
    FinishLoginClient = 0x08,
    FinishLoginServer = 0x09,
    Error = 0xFF,
}

/// Serializes client identification handshake (0x01).
pub fn encode_client_version(brand: &str, version: &str) -> Vec<u8> {
    let mut b = Vec::new();
    b.push(EaglerPacketId::ClientVersion as u8);
    // Protocol versions offered: v2 (0x02), v3 (0x03)
    b.push(3); // count of protocol versions
    b.push(1);
    b.push(2);
    b.push(3);
    // Str8 brand
    let brand_bytes = brand.as_bytes();
    b.push(brand_bytes.len().min(255) as u8);
    b.extend_from_slice(brand_bytes);
    // Str8 version
    let ver_bytes = version.as_bytes();
    b.push(ver_bytes.len().min(255) as u8);
    b.extend_from_slice(ver_bytes);
    b
}

/// Serializes login request handshake (0x04).
pub fn encode_request_login(username: &str) -> Vec<u8> {
    let mut b = Vec::new();
    b.push(EaglerPacketId::RequestLogin as u8);
    let u_bytes = username.as_bytes();
    b.push(u_bytes.len().min(255) as u8);
    b.extend_from_slice(u_bytes);
    b
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_client_version() {
        let pkt = encode_client_version("Gravrust", "1.15.2");
        assert_eq!(pkt[0], 0x01);
        assert!(pkt.len() > 10);
    }

    #[test]
    fn test_encode_request_login() {
        let pkt = encode_request_login("Steve");
        assert_eq!(pkt[0], 0x04);
        assert_eq!(pkt[1], 5); // "Steve".len()
        assert_eq!(&pkt[2..7], b"Steve");
    }
}
