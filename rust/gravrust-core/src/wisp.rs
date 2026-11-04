//! Port of `client/js/net/wisp.js`: Wisp protocol utilities.
//!
//! Wisp is a lightweight protocol for multiplexing TCP streams over WebSocket,
//! used by some Minecraft server implementations.

use wasm_bindgen::prelude::*;

/// Decode a Wisp packet from bytes.
///
/// Returns `None` if the bytes don't constitute a valid Wisp packet.
#[wasm_bindgen]
pub fn wisp_packet(bytes: &[u8]) -> Option<JsValue> {
    if bytes.len() < 5 {
        return None;
    }
    let view = web_sys::DataView::new_with_buffer_and_byte_offset(
        web_sys::JsValue::from(bytes.as_ptr() as u32),
        0u32,
        bytes.len() as u32,
    )
    .unwrap();
    let type_ = bytes[0];
    let id = view.get_u32(1, true);
    
    if type_ == 3 && bytes.len() != 9 {
        return None;
    }
    if type_ == 4 && bytes.len() != 6 {
        return None;
    }
    if type_ == 5 && bytes.len() < 7 {
        return None;
    }
    
    let payload = bytes.slice(5).to_vec();
    let credit = if type_ == 3 {
        Some(view.get_u32(5, true))
    } else {
        None
    };
    
    let result = js_sys::Object::new();
    result.set("type", &type_.into()).ok();
    result.set("id", &id.into()).ok();
    result.set("payload", &JsValue::from(payload.into())).ok();
    if let Some(c) = credit {
        result.set("credit", &c.into()).ok();
    }
    
    Some(result.into())
}

/// Create a Wisp CONNECT frame (type 0x01).
#[wasm_bindgen]
pub fn wisp_connect(host: &str, port: u16) -> Vec<u8> {
    let host_bytes = host.as_bytes();
    let mut result = Vec::with_capacity(3 + host_bytes.len());
    result.push(0x01); // type CONNECT
    result.push(port as u8);
    result.push((port >> 8) as u8);
    result.extend_from_slice(host_bytes);
    result
}

/// Create a Wisp INFO frame (type 0x05) with protocol version.
#[wasm_bindgen]
pub fn wisp_info(version: u8) -> Vec<u8> {
    let mut result = Vec::with_capacity(2);
    result.push(0x05); // type INFO
    result.push(version);
    result
}

/// Create a Wisp CONTINUE frame (type 0x02).
#[wasm_bindgen]
pub fn wisp_continue() -> Vec<u8> {
    vec![0x02]
}

/// Create a Wisp CLOSE frame (type 0x04) with reason code.
#[wasm_bindgen]
pub fn wisp_close(reason: u8) -> Vec<u8> {
    let mut result = Vec::with_capacity(2);
    result.push(0x04); // type CLOSE
    result.push(reason);
    result
}