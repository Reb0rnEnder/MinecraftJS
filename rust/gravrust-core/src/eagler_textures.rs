//! Port of `client/js/game/eagler-textures.js`
//!
//! Handles Eaglercraft V3 skin and cape texture processing.
//! V2/V3 handshakes both use the V3 skin and cape channels.

use wasm_bindgen::prelude::*;
use serde::{Serialize, Deserialize};
use std::collections::HashMap;

/// Rearranges RGBA skin bytes from BGRA format (Eaglercraft V3 protocol).
/// Input is 16384 bytes (256x64x4 / 4 bytes per pixel for 64x256 texture data).
/// Output is also 16384 bytes but with RGBA byte order.
#[wasm_bindgen]
pub fn skin_pixels_v3(bytes: &[u8]) -> Vec<u8> {
    if bytes.len() != 16384 {
        web_sys::window()
            .unwrap()
            .console()
            .1
            .log_1(&format!("Invalid Eagler skin size: {} bytes", bytes.len()).into());
        return bytes.to_vec();
    }
    let mut out = vec![0u8; 16384];
    for i in (0..out.len()).step_by(4) {
        out[i] = bytes[i + 3];     // R <- original B
        out[i + 1] = bytes[i + 2]; // G <- original G
        out[i + 2] = bytes[i + 1]; // B <- original R
        out[i + 3] = bytes[i + 0]; // A <- original A (or 255)
    }
    out
}

/// Rearranges cape bytes from BGRA format (Eaglercraft V3 protocol).
/// Input is 1173 bytes, output is 64*32*4 = 8192 bytes (64x32 RGBA texture).
#[wasm_bindgen]
pub fn cape_pixels_v3(bytes: &[u8]) -> Vec<u8> {
    if bytes.len() != 1173 {
        web_sys::window()
            .unwrap()
            .console()
            .1
            .log_1(&format!("Invalid Eagler cape size: {} bytes", bytes.len()).into());
        return vec![0u8; 64 * 32 * 4];
    }
    let out_len = 64 * 32 * 4;
    let mut out = vec![0u8; out_len];
    // Copy pixel data: for each of the 17+11+10 = 38 cape pixels
    // First 17x22 pixels
    for y in 0..17 {
        for x in 0..22 {
            let src_idx = (y * 23 + x) * 3;
            let dst_idx = (y * 64 + x) * 4;
            out[dst_idx] = bytes[src_idx + 2];     // R
            out[dst_idx + 1] = bytes[src_idx + 1]; // G
            out[dst_idx + 2] = bytes[src_idx];     // B
            out[dst_idx + 3] = 255;                 // A
        }
    }
    // Next 11 pixels at row 22, starting at column 0, but offset to column 22
    for y in 0..11 {
        let src_idx = ((y + 6) * 23 + 22) * 3;
        let dst_idx = (22 * 64 + (y + 11)) * 4;
        out[dst_idx] = bytes[src_idx + 2];     // R
        out[dst_idx + 1] = bytes[src_idx + 1]; // G
        out[dst_idx + 2] = bytes[src_idx];     // B
        out[dst_idx + 3] = 255;                 // A
    }
    out
}

/// Eaglercraft skin/cape texture handling.
/// Port of the EaglerTextures class from client/js/game/eagler-textures.js.
/// 
/// In the full port, this would integrate with the game connection, asset manager,
/// and renderer. Here we provide the core texture processing functions.
#[wasm_bindgen]
pub struct EaglerTextures {
    /// Whether the connection is using Eagler protocol
    _active: bool,
    /// Record of texture UUIDs and their metadata
    records: HashMap<String, TextureRecord>,
    /// Cached preset skins and capes
    presets: HashMap<String, PresetTexture>,
}

#[derive(Clone, Debug)]
struct TextureRecord {
    /// Path to the texture file (e.g., "entity/steve.png")
    path: String,
    /// Whether the skin is "slim" (Alex model, 64x32) vs wide (Steve, 64x64)
    slim: bool,
    /// Texture handle (null until loaded)
    texture: Option<wasm_bindgen::JsValue>,
    /// Whether this is a legacy texture
    legacy: bool,
    /// Additional image data
    image: Option<wasm_bindgen::JsValue>,
}

#[derive(Clone, Debug)]
struct PresetTexture {
    /// The PNG image data
    image: Vec<u8>,
    /// Whether the skin is slim variant
    slim: bool,
    /// Texture handle
    texture: wasm_bindgen::JsValue,
}

impl EaglerTextures {
    /// Create a new EaglerTextures instance
    #[wasm_bindgen(constructor)]
    pub fn new(active: bool) -> Self {
        EaglerTextures {
            _active: active,
            records: HashMap::new(),
            presets: HashMap::new(),
        }
    }

    /// Whether we're connected to an Eagler server
    pub fn active(&self) -> bool {
        self._active
    }

    /// Dispose of a texture record, cleaning up the associated texture
    fn _dispose(&mut self, uuid: &str, record: &mut TextureRecord) {
        // In a full port, would call: game.assets.device?.destroyTexture(texture)
        // and: game.assets.textures?.delete(key)
        // For now, just remove from records
        // The texture cleanup would be handled by the game engine
    }

    /// Clear all texture records and presets
    pub fn clear(&mut self) {
        for (uuid, record) in self.records.iter_mut() {
            self._dispose(uuid, record);
            // In full port: self.game.entityRenderer._rebuild(uuid);
        }
        self.records.clear();
        self.presets.clear();
        // In full port: self.game.handRenderer?.invalidateSkin();
    }

    /// Drop a single texture record by UUID
    pub fn drop(&mut self, uuid: &str) {
        if let Some(record) = self.records.get_mut(uuid) {
            self._dispose(uuid, record);
            self.records.remove(uuid);
            // In full port: self.game.entityRenderer._rebuild(uuid);
        }
    }

    /// Get a preset skin or cape texture by type and ID
    fn _preset(&mut self, type_str: &str, id: i32) -> Option<&PresetTexture> {
        let preset_type = if type_str == "skin" { "skin" } else { "cape" };
        let entries = if type_str == "skin" { /* EAGLER_SKINS */ } else { /* EAGLER_CAPES */ };
        // In full port, would look up from EAGLER_SKINS/EAGLER_CAPES arrays
        // For now, return None
        None
    }

    /// Request skin/cape textures from the server for a given UUID
    pub fn request(&mut self, uuid: &str) -> Option<String> {
        if !self._active {
            return None;
        }
        // Normalize UUID to lowercase
        let uuid_lower = uuid.to_lowercase();
        
        // Check if we already have a record
        if let Some(record) = self.records.get(&uuid_lower) {
            return Some(uuid_lower); // Return existing record path
        }
        
        // Max 512 records, evict oldest if full
        if self.records.len() >= 512 {
            let first_key = self.records.keys().next().unwrap().clone();
            let mut record = self.records.get_mut(&first_key).unwrap();
            self._dispose(&first_key, record);
            self.records.remove(&first_key);
            // In full port: self.game.entityRenderer._rebuild(&first_key);
        }
        
        // Create default record
        let record = TextureRecord {
            path: "entity/steve.png".to_string(),
            slim: false,
            texture: None,
            legacy: false,
            image: None,
        };
        self.records.insert(uuid_lower.clone(), record);
        
        // Send skin and cape request packets
        // In full port: 
        // this.game.send(C.customPayload(PROTOCOL_VERSION>=393?'eagler:skins-1-8':'EAG|Skins-1.8',bytes));
        // this.game.send(C.customPayload(PROTOCOL_VERSION>=393?'eagler:capes-1-8':'EAG|Capes-1.8',bytes));
        
        Some(uuid_lower)
    }

    /// Request a skin/cape texture from a URL
    pub fn request_url(&mut self, url: &str) -> Option<String> {
        if !self._active {
            return None;
        }
        if url.len() > 65535 {
            return None;
        }
        // Validate URL format
        // In full port: !['http:','https:'].includes(new URL(url).protocol)
        let has_valid_protocol = url.starts_with("http:") || url.starts_with("https:");
        if !has_valid_protocol {
            return None;
        }
        
        // Hash URL to UUID
        // In full port: uuid = nameUuid(new TextEncoder().encode('EaglercraftSkinURL:'+url));
        
        // Check existing record
        // In full port: let record = this.records.get(uuid);
        
        // Create default record
        let uuid_hash = "hashed-uuid"; // placeholder
        let record = TextureRecord {
            path: "entity/steve.png".to_string(),
            slim: false,
            texture: None,
            legacy: false,
            image: None,
        };
        // self.records.set(uuid, record);
        
        // Send packet
        // In full port:
        // const bytes = new TextEncoder().encode(url);
        // const packet = new Writer().u8(6).uuid(uuid).u16(bytes.length).raw(bytes).build();
        // this.game.send(C.customPayload(PROTOCOL_VERSION>=393?'eagler:skins-1-8':'EAG|Skins-1.8',packet));
        
        Some(uuid_hash.to_string())
    }

    /// Handle incoming texture data from the server
    pub fn handle(&mut self, channel: &str, bytes: &[u8]) -> bool {
        let skin = channel == "EAG|Skins-1.8" || channel == "eagler:skins-1.8";
        let cape = channel == "EAG|Capes-1.8" || channel == "eagler:capes-1.8";
        
        if !skin && !cape {
            return false;
        }
        if !self._active {
            return true;
        }
        
        // Read the first byte to determine type
        if bytes.is_empty() {
            return true;
        }
        let expected = bytes[0];
        // type 4 = preset skin/cape, type 5 = skin data, type 6 = URL skin
        
        if expected == 4 {
            // Preset skin/cape data
            // In full port: const r = new Reader(bytes), type = r.u8(), uuid = r.uuid()
            // let preset = r.i32(), asset = this._preset(skin?'skin':'cape',preset)
            // Would process preset texture data
            true
        } else if skin {
            // Skin data (type 5)
            // In full port: record.model = r.u8(); record.slim = record.model === 1;
            // record.image = {width:64,height:64,data:skinPixelsV3(r.rest())};
            // record.texture = this.game.assets.makeTexture('eagler-skin:'+uuid,64,64,record.image.data);
            true
        } else {
            // Cape data
            // In full port: const data = capePixelsV3(r.rest()); record.cape = this.game.assets.makeTexture('eagler-cape:'+uuid,64,32,data);
            true
        }
    }
}

// Default EaglerTextures instance (active = false by default unless connected to Eagler server)
impl Default for EaglerTextures {
    fn default() -> Self {
        EaglerTextures::new(false)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_skin_pixels_v3() {
        // Create test data: fill with known pattern
        let mut input = vec![0u8; 16384];
        for i in 0..16384 {
            input[i] = (i as u8).wrapping_neg();
        }
        let output = skin_pixels_v3(&input);
        assert_eq!(output.len(), 16384);
        // Verify byte swap: output[0] should equal input[3]
        assert_eq!(output[0], input[3]);
        assert_eq!(output[1], input[2]);
        assert_eq!(output[2], input[1]);
        assert_eq!(output[3], input[0]);
    }
    
    #[test]
    fn test_cape_pixels_v3() {
        // Create test cape data
        let mut input = vec![0u8; 1173];
        for i in 0..1173 {
            input[i] = (i as u8).wrapping_neg();
        }
        let output = cape_pixels_v3(&input);
        assert_eq!(output.len(), 64 * 32 * 4);
        // Verify first pixel
        assert_eq!(output[0], input[2]); // R
        assert_eq!(output[1], input[1]); // G
        assert_eq!(output[2], input[0]); // B
        assert_eq!(output[3], 255);     // A
    }
}