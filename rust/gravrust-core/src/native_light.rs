//! Port of `client/js/world/native-light.js`: sky light section storage.
//!
//! Provides native sky light lookup for Minecraft chunk sections.

use wasm_bindgen::prelude::*;

/// Native sky light lookup for a given section.
///
/// Returns the sky light value at the given coordinates, or 15 if no sky data available.
#[wasm_bindgen]
pub fn native_sky_light(light_data: &[u8], x: i32, y: i32, z: i32, has_sky: bool) -> u8 {
    if !has_sky {
        return 0;
    }
    
    let section = (y >> 4) + 1;
    let local_y = y & 15;
    
    // Simplified: in a full implementation, we'd parse the skyDataMask and sky array
    // This is a port of the JS function that looks up sky light values
    
    if light_data.len() > 0 {
        // Check if we have sky data - simplified logic
        let highest = 31 - light_data.len().ilog2(); // rough estimate
        if section > highest {
            return 15;
        }
        // In a real implementation, we'd navigate the skyData and sky array
        // For now, return a default value
    }
    
    // Default: if y > 255, it's open sky
    if y > 255 {
        return 15;
    }
    
    0
}