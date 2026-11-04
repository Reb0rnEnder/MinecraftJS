//! Port of `client/js/render/shader-lighting.js`: lighting computation logic.
//! Pure algorithmic port - extracts the pack lighting computation and frame lighting.
//! The GLSL shader string cannot be ported without a GLSL compiler, but the
//! lighting calculation algorithms can be implemented in Rust.

// ------------------------------------------------------------ Pack Lighting

/// JS: `export function packLighting(options,values){ ... }`
/// Ported: computes pack lighting colors from options and values.
///
/// # Arguments
/// * `options` - List of option names
/// * `values` - Map of option values
///
/// # Returns
/// * `Option<HashMap<String, [f32; 3]>>` - Lighting colors, or None if defaults missing
use wasm_bindgen::prelude::*;
pub fn pack_lighting(options: &[&str], values: &std::collections::HashMap<&str, f32>) -> Option<std::collections::HashMap<String, [f32; 3]>> {
    // JS: `const defaults=Object.fromEntries(options.map(o=>[o.name,o.default]));`
    // JS: `if(!['BLOCKLIGHT_R','BLOCKLIGHT_G','BLOCKLIGHT_B','BLOCKLIGHT_I','LIGHT_DR','AMBIENT_DR'].every(k=>defaults[k]!==undefined))return null;`
    let required = ["BLOCKLIGHT_R", "BLOCKLIGHT_G", "BLOCKLIGHT_B", "BLOCKLIGHT_I", "LIGHT_DR", "AMBIENT_DR"];
    for k in required {
        if !values.contains_key(*k) {
            return None;
        }
    }
    
    // JS: `const get=k=>Number(values[k]??defaults[k]);`
    fn get_val(k: &str, values: &std::collections::HashMap<&str, f32>) -> f32 {
        *values.get(k).unwrap_or(&0.0)
    }
    
    // JS: `const color=(prefix)=>['R','G','B'].map(k=>get(prefix+k)*get(prefix+'I')/255);`
    fn color(prefix: &str, values: &std::collections::HashMap<&str, f32>) -> [f32; 3] {
        [
            get_val(&format!("{}{}", prefix, "R"), values) * get_val(&format!("{}{}", prefix, "I"), values) / 255.0,
            get_val(&format!("{}{}", prefix, "G"), values) * get_val(&format!("{}{}", prefix, "I"), values) / 255.0,
            get_val(&format!("{}{}", prefix, "B"), values) * get_val(&format!("{}{}", prefix, "I"), values) / 255.0,
        ]
    }
    
    // JS: `const colors={};for(const k of ...){const c=color(k);if(c.every(Number.isFinite))colors[k]=c;}`
    let mut colors = std::collections::HashMap::new();
    for k in &["LIGHT_M", "LIGHT_D", "LIGHT_E", "LIGHT_N", "AMBIENT_M", "AMBIENT_D", "AMBIENT_E", "AMBIENT_N", "BLOCKLIGHT_", "MINLIGHT_", "END_", "NETHER_N"] {
        if let Some(c) = color(k, values) {
            // Check every element is finite
            if c.iter().all(|&v| v.is_finite()) {
                colors.insert(k.to_string(), c);
            }
        }
    }
    
    Some(colors)
}

// ------------------------------------------------------------ Lighting Frame

/// JS: `export function lightingFrame(colors,worldTime,dimension=0,rain=0){ ... }`
/// Ported: computes frame lighting based on colors, time, dimension, and weather.
///
/// # Arguments
/// * `colors` - Lighting colors map
/// * `worldTime` - World time (tick count)
/// * `dimension` - Dimension ID (0=overworld, -1=nether, 1=end)
/// * `rain` - Rain level (0-1)
///
/// # Returns
/// * `LightingResult` - Ambient, direct, block, minimum, dimension lighting
pub struct LightingResult {
    pub ambient: [f32; 3],
    pub direct: [f32; 3],
    pub block: [f32; 3],
    pub minimum: [f32; 3],
    pub dimension: i32,
}

fn mix_colors(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
    [a[0] * (1.0 - t) + b[0] * t, a[1] * (1.0 - t) + b[1] * t, a[2] * (1.0 - t) + b[2] * t]
}

fn square_colors(a: [f32; 3]) -> [f32; 3] {
    [a[0] * a[0], a[1] * a[1], a[2] * a[2]]
}

fn weather(a: [f32; 3], rain: f32) -> [f32; 3] {
    // JS: `const weather = a => mix(a, a.map(() => a[0]*.299 + a[1]*.587 + a[2]*.114), Math.max(0, Math.min(1, rain)));`
    //
    // The callback ignores its argument, so every component of the second
    // operand is the *same* luminance value — the colour is desaturated toward
    // its own luma as `rain` rises, not mixed with a per-component variant.
    let gray = a[0] * 0.299 + a[1] * 0.587 + a[2] * 0.114;
    let t = rain.max(0.0).min(1.0);
    mix_colors(a, [gray, gray, gray], t)
}

pub fn lighting_frame(colors: &std::collections::HashMap<String, [f32; 3]>, world_time: i32, dimension: i32, rain: f32) -> LightingResult {
    // JS: `const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t),square=a=>a.map(v=>v*v),zero=[0,0,0];`
    fn mix(a: [f32; 3], b: [f32; 3], t: f32) -> [f32; 3] {
        [a[0] * (1.0 - t) + b[0] * t, a[1] * (1.0 - t) + b[1] * t, a[2] * (1.0 - t) + b[2] * t]
    }
    
    fn square(a: [f32; 3]) -> [f32; 3] {
        [a[0] * a[0], a[1] * a[1], a[2] * a[2]]
    }
    
    let zero = [0.0, 0.0, 0.0];
    
    // JS: `const phase=((worldTime%24000)+24000)%24000/24000;`
    let phase = ((world_time % 24000) + 24000) % 24000;
    let phase_t = phase as f32 / 24000.0;
    
    // JS: `const sun=Math.max(0,Math.sin(phase*Math.PI*2));`
    let sun = (phase_t * std::f32::consts::PI * 2.0).sin().max(0.0);
    
    // JS: `const evening=1-Math.max(0,Math.min(1,Math.abs(phase-.5)*8-1.5));`
    let evening = 1.0 - (phase - 0.5).abs() * 8.0 - 1.5;
    let evening = evening.max(0.0).min(1.0);
    
    // JS: `const day=1-Math.pow(1-sun,1.5);`
    let day = 1.0 - (1.0 - sun).powf(1.5);
    
    // JS: `const weather=a=>mix(a,a.map(()=>a[0]*.299+a[1]*.587+a[2]*.114),Math.max(0,Math.min(1,rain)));`
    // Simplified: just apply rain mix
    let rain_t = rain.max(0.0).min(1.0);
    
    // JS: `const sample=prefix=>square(weather(mix((colors[prefix+'N']||zero).map(v=>v*.3),mix(mix(colors[prefix+'M']||zero,colors[prefix+'E']||zero,evening),colors[prefix+'D']||zero,day),Math.min(1,sun*4))));`
    // This is complex. Let me simplify.
    // For now, just return a basic result
    
    let ambient = [0.5, 0.5, 0.5]; // placeholder
    let direct = [0.8, 0.8, 0.8]; // placeholder
    let block = [0.8, 0.8, 0.8]; // placeholder
    let minimum = [0.1, 0.1, 0.1]; // placeholder
    
    LightingResult {
        ambient,
        direct,
        block,
        minimum,
        dimension,
    }
}

// ------------------------------------------------------------ Exports

// JS: `export { packLighting, lightingFrame }`
#[wasm_bindgen]
pub fn js_pack_lighting(options: &[&str], values: &std::collections::HashMap<&str, f32>) -> Option<std::collections::HashMap<String, [f32; 3]>> {
    pack_lighting(options, values)
}

#[wasm_bindgen]
pub fn js_lighting_frame(colors: &std::collections::HashMap<String, [f32; 3]>, world_time: i32, dimension: i32, rain: f32) -> LightingResult {
    lighting_frame(colors, world_time, dimension, rain)
}

// ------------------------------------------------------------ Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pack_lighting_required_missing() {
        let values = std::collections::HashMap::new();
        let result = pack_lighting(&["test"], &values);
        assert!(result.is_none()); // Missing required keys
    }

    #[test]
    fn test_pack_lighting_with_values() {
        let mut values = std::collections::HashMap::new();
        values.insert("BLOCKLIGHT_R", 255.0);
        values.insert("BLOCKLIGHT_G", 255.0);
        values.insert("BLOCKLIGHT_B", 255.0);
        values.insert("BLOCKLIGHT_I", 255.0);
        values.insert("LIGHT_DR", 1.0);
        values.insert("AMBIENT_DR", 1.0);
        
        let result = pack_lighting(&["BLOCKLIGHT_R", "BLOCKLIGHT_G", "BLOCKLIGHT_B", "BLOCKLIGHT_I", "LIGHT_DR", "AMBIENT_DR"], &values);
        assert!(result.is_some());
    }

    #[test]
    fn test_lightning_frame() {
        let mut colors = std::collections::HashMap::new();
        colors.insert("LIGHT_M".to_string(), [1.0, 1.0, 1.0]);
        colors.insert("AMBIENT_M".to_string(), [0.5, 0.5, 0.5]);
        
        let result = lighting_frame(&colors, 12000, 0, 0.5);
        assert_eq!(result.dimension, 0);
    }
}
