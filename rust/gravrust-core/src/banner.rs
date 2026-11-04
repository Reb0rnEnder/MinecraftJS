//! Port of `client/js/render/banner.js`.
//!
//! Banner pattern layering, UV coordinate generation, and compositing logic.

use wasm_bindgen::prelude::*;

/// Dye color map (0 = black ... 15 = white), matching DYE_MAP_COLORS from JS.
/// Values are RGB packed as 0xRRGGBB.
const DYE_MAP_COLORS: [u32; 16] = [
    0x191919, // black
    0x993333, // red
    0x66448E, // green
    0x3F7FBF, // brown
    0x334CBF, // blue
    0x7F3FBF, // purple
    0x4C7F4C, // cyan
    0x999999, // light_gray
    0x4C4C4C, // gray
    0xF2F22E, // pink
    0x7F7FBF, // lime
    0xE6E67F, // yellow
    0x4C66BF, // light_blue
    0xB266E6, // magenta
    0xD7D77F, // orange
    0xFFFFFF, // white
];

/// Banner pattern codes mapping short codes to pattern names.
/// Matches BANNER_CODES from JS.
const BANNER_CODES: &[(&str, &str)] = &[
    ("b", "base"),
    ("bl", "square_bottom_left"),
    ("br", "square_bottom_right"),
    ("tl", "square_top_left"),
    ("tr", "square_top_right"),
    ("bs", "stripe_bottom"),
    ("ts", "stripe_top"),
    ("ls", "stripe_left"),
    ("rs", "stripe_right"),
    ("cs", "stripe_center"),
    ("ms", "stripe_middle"),
    ("drs", "stripe_downright"),
    ("dls", "stripe_downleft"),
    ("ss", "small_stripes"),
    ("cr", "cross"),
    ("sc", "straight_cross"),
    ("bt", "triangle_bottom"),
    ("tt", "triangle_top"),
    ("bts", "triangles_bottom"),
    ("tts", "triangles_top"),
    ("ld", "diagonal_left"),
    ("rd", "diagonal_up_right"),
    ("lud", "diagonal_up_left"),
    ("rud", "diagonal_right"),
    ("mc", "circle"),
    ("mr", "rhombus"),
    ("vh", "half_vertical"),
    ("hh", "half_horizontal"),
    ("vhr", "half_vertical_right"),
    ("hhb", "half_horizontal_bottom"),
    ("bo", "border"),
    ("cbo", "curly_border"),
    ("cre", "creeper"),
    ("gra", "gradient"),
    ("gru", "gradient_up"),
    ("bri", "bricks"),
    ("glb", "globe"),
    ("sku", "skull"),
    ("flo", "flower"),
    ("moj", "mojang"),
];

/// Resolves a pattern short code to its full name.
fn pattern_name(code: &str) -> Option<&'static str> {
    BANNER_CODES.iter().find(|(c, _)| *c == code).map(|(_, n)| *n)
}

/// A single banner pattern layer: pattern code and dye color index (0-15).
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct BannerLayer {
    pub pattern: String,
    pub color: u8,
}

/// Banner configuration: base color + up to 6 pattern layers (max 7 total including base).
#[wasm_bindgen]
#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Banner {
    base_color: u8,
    patterns: Vec<BannerLayer>,
}

#[wasm_bindgen]
impl Banner {
    /// Create a new Banner with a base color (0-15).
    #[wasm_bindgen(constructor)]
    pub fn new(base_color: u8) -> Banner {
        Banner {
            base_color: base_color & 15,
            patterns: Vec::new(),
        }
    }

    /// Add a pattern layer.
    pub fn add_pattern(&mut self, pattern: &str, color: u8) {
        if self.patterns.len() < 6 {
            self.patterns.push(BannerLayer {
                pattern: pattern.to_string(),
                color: color & 15,
            });
        }
    }

    /// Get the base color.
    pub fn base_color(&self) -> u8 {
        self.base_color
    }

    /// Get the pattern count.
    pub fn pattern_count(&self) -> usize {
        self.patterns.len()
    }

    /// Get all layers (base + patterns) as a flat array for JS interop.
    /// Returns [base_pattern, base_color, pattern1_code, pattern1_color, ...]
    pub fn layers_flat(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(1 + self.patterns.len() * 2 + 1);
        out.push(self.base_color);
        for layer in &self.patterns {
            // Encode pattern code as length-prefixed bytes
            let code_bytes = layer.pattern.as_bytes();
            out.push(code_bytes.len() as u8);
            out.extend_from_slice(code_bytes);
            out.push(layer.color);
        }
        out.push(0xFF); // terminator
        out
    }
}

/// Generate UV coordinates for a banner pattern.
/// Returns [u0, v0, u1, v1] as f32 array, or empty vec if pattern not found.
#[wasm_bindgen]
pub fn banner_pattern_uv(pattern_name: &str, _layer: u32) -> Vec<f32> {
    // Banner patterns are laid out in a texture atlas.
    // The JS uses pattern names to look up UV coordinates.
    // Most patterns use a 16x16 grid (64x64 texture with 4x4 patterns).
    // Each pattern occupies a 16x16 region.
    
    let pattern_name = pattern_name.to_lowercase();
    
    // Find the pattern index
    let idx = BANNER_CODES.iter().position(|(_, name)| *name == pattern_name);
    
    if let Some(index) = idx {
        // Patterns are arranged in a grid. The base texture (banner_base.png) 
        // is separate. Pattern masks are in entity/banner/ folder.
        // For UV generation, we compute based on the pattern index.
        
        // Each pattern in the mask texture is typically 16x16 pixels in a larger atlas
        // Standard layout: 8 columns x 8 rows = 64 patterns max
        let cols = 8;
        let col = (index % cols) as f32;
        let row = (index / cols) as f32;
        
        // UV coordinates (normalized 0-1)
        // Each cell is 16/128 = 0.125 in UV space if atlas is 128x128
        // But typically banner patterns use 64x64 texture with 16x16 patterns = 4x4 grid
        let cell_size = 1.0 / 4.0; // 4x4 grid
        
        let u0 = col * cell_size;
        let v0 = row * cell_size;
        let u1 = u0 + cell_size;
        let v1 = v0 + cell_size;
        
        vec![u0, v0, u1, v1]
    } else {
        // Return empty vec as sentinel for "not found" - JS will fallback
        Vec::new()
    }
}

/// Generate vertices for banner rendering (pattern layering).
/// 
/// Input: `patterns` is a flat array of [pattern_code_len, pattern_code_bytes..., color, ...] terminated by 0xFF
///        `base_color` is the base dye color (0-15)
/// Returns: Flat array of vertices [x, y, z, u, v, r, g, b, a, ...] or empty vec on failure
#[wasm_bindgen]
pub fn banner_vertices(patterns: &[u8], base_color: u8) -> Vec<f32> {
    if patterns.is_empty() {
        return Vec::new();
    }
    
    let mut layers = Vec::new();
    let mut i = 0;
    
    // First entry is base color (already passed separately, but may be in array)
    // The JS bannerLayers produces: [{Pattern: 'b', Color: base}, ...patterns]
    // So we always have base as first layer with pattern 'b'
    
    // Add base layer
    layers.push(BannerLayer {
        pattern: "b".to_string(),
        color: base_color & 15,
    });
    
    // Parse additional patterns from the flat array
    while i < patterns.len() {
        let len = patterns[i] as usize;
        i += 1;
        
        if len == 0xFF || i + len > patterns.len() {
            break;
        }
        
        if let Ok(code) = std::str::from_utf8(&patterns[i..i+len]) {
            i += len;
            if i < patterns.len() {
                let color = patterns[i] & 15;
                i += 1;
                layers.push(BannerLayer {
                    pattern: code.to_string(),
                    color,
                });
            }
        } else {
            break;
        }
    }
    
    // Limit to 7 layers max (base + 6 patterns)
    if layers.len() > 7 {
        layers.truncate(7);
    }
    
    // Generate vertices for a banner quad
    // Banner is a 1x1 quad centered at origin, facing +Z
    // Vertices: position (x,y,z), UV (u,v), color (r,g,b,a)
    let mut vertices = Vec::with_capacity(layers.len() * 4 * 9); // 4 verts per layer, 9 floats each
    
    // Base quad corners (in banner local space, 1x2 aspect for hanging banner)
    let half_w = 0.5;
    let half_h = 1.0;
    
    let corners = [
        [-half_w, -half_h, 0.0], // bottom-left
        [ half_w, -half_h, 0.0], // bottom-right
        [ half_w,  half_h, 0.0], // top-right
        [-half_w,  half_h, 0.0], // top-left
    ];
    
    let uvs = [
        [0.0, 1.0], // bottom-left
        [1.0, 1.0], // bottom-right
        [1.0, 0.0], // top-right
        [0.0, 0.0], // top-left
    ];
    
    for layer in &layers {
        let pattern_name = pattern_name(&layer.pattern).unwrap_or("base");
        
        // Get UV for this pattern
        let pattern_uv = banner_pattern_uv(pattern_name, 0);
        let (u0, v0, u1, v1) = if pattern_uv.len() == 4 {
            (pattern_uv[0], pattern_uv[1], pattern_uv[2], pattern_uv[3])
        } else {
            // Default to full texture
            (0.0, 1.0, 1.0, 0.0)
        };
        
        // Get dye color
        let dye_rgb = DYE_MAP_COLORS[(layer.color & 15) as usize];
        let r = ((dye_rgb >> 16) & 0xFF) as f32 / 255.0;
        let g = ((dye_rgb >> 8) & 0xFF) as f32 / 255.0;
        let b = (dye_rgb & 0xFF) as f32 / 255.0;
        let a = 1.0f32;
        
        // Generate 4 vertices for this layer
        for (corner, uv) in corners.iter().zip(uvs.iter()) {
            // Interpolate UV within the pattern's texture region
            let u = u0 + uv[0] * (u1 - u0);
            let v = v0 + uv[1] * (v1 - v0);
            
            vertices.push(corner[0]);
            vertices.push(corner[1]);
            vertices.push(corner[2]);
            vertices.push(u);
            vertices.push(v);
            vertices.push(r);
            vertices.push(g);
            vertices.push(b);
            vertices.push(a);
        }
    }
    
    vertices
}

/// Composites banner layers into a single texture (algorithm port from composeBanner).
/// 
/// This is the CPU-side compositing that the JS does with canvas.
/// Input: base texture (RGBA), pattern masks (RGBA), layers (pattern + color)
/// Output: Composite RGBA texture data, or empty vec on failure
#[wasm_bindgen]
pub fn banner_composite(
    base_texture: &[u8],
    base_width: u32,
    base_height: u32,
    pattern_masks: &[u8], // concatenated pattern masks
    pattern_width: u32,
    pattern_height: u32,
    layers: &[u8], // flat array: [pattern_len, pattern_bytes..., color, ...] terminated by 0xFF
) -> Vec<u8> {
    if base_texture.len() != (base_width * base_height * 4) as usize {
        return Vec::new();
    }
    
    if pattern_width != base_width || pattern_height != base_height {
        return Vec::new();
    }
    
    // Parse layers
    let mut parsed_layers = Vec::new();
    let mut i = 0;
    
    while i < layers.len() {
        let len = layers[i] as usize;
        i += 1;
        
        if len == 0xFF || i + len > layers.len() {
            break;
        }
        
        if let Ok(code) = std::str::from_utf8(&layers[i..i+len]) {
            i += len;
            if i < layers.len() {
                let color = layers[i] & 15;
                i += 1;
                parsed_layers.push((code.to_string(), color));
            }
        } else {
            break;
        }
    }
    
    if parsed_layers.is_empty() {
        return Vec::new();
    }
    
    // Limit to 7 layers
    if parsed_layers.len() > 7 {
        parsed_layers.truncate(7);
    }
    
    // Expected pattern mask count = layers - 1 (base has no mask)
    let expected_masks = parsed_layers.len().saturating_sub(1);
    let mask_size = (pattern_width * pattern_height * 4) as usize;
    
    if pattern_masks.len() < expected_masks * mask_size {
        return Vec::new();
    }
    
    // Start with base texture
    let mut output = base_texture.to_vec();
    let src = base_texture;
    
    // Apply each pattern layer (skip base)
    for (layer_idx, (pattern_code, color_idx)) in parsed_layers.iter().enumerate().skip(1) {
        let pattern_name = pattern_name(pattern_code);
        if pattern_name.is_none() {
            continue;
        }
        
        let mask_offset = (layer_idx - 1) * mask_size;
        let mask = &pattern_masks[mask_offset..mask_offset + mask_size];
        
        let dye_rgb = DYE_MAP_COLORS[*color_idx as usize];
        let r = ((dye_rgb >> 16) & 0xFF) as u8;
        let g = ((dye_rgb >> 8) & 0xFF) as u8;
        let b = (dye_rgb & 0xFF) as u8;
        
        // Composite: for each pixel, if mask blue channel > 0, blend
        for pixel_idx in 0..(base_width * base_height) as usize {
            let src_offset = pixel_idx * 4;
            let mask_offset_px = pixel_idx * 4;
            
            let mask_blue = mask[mask_offset_px + 2]; // Blue channel is the alpha mask
            if mask_blue == 0 {
                continue;
            }
            
            // Multiply base RGB by dye color, set alpha from mask blue
            let src_r = src[src_offset] as u16;
            let src_g = src[src_offset + 1] as u16;
            let src_b = src[src_offset + 2] as u16;
            
            output[src_offset] = ((src_r * r as u16) / 255) as u8;
            output[src_offset + 1] = ((src_g * g as u16) / 255) as u8;
            output[src_offset + 2] = ((src_b * b as u16) / 255) as u8;
            output[src_offset + 3] = mask_blue;
        }
    }
    
    output
}

/// Get the dye color RGB value for a color index (0-15).
#[wasm_bindgen]
pub fn dye_color_rgb(color_index: u8) -> u32 {
    DYE_MAP_COLORS[(color_index & 15) as usize]
}

/// Get all available pattern names.
#[wasm_bindgen]
pub fn banner_pattern_names() -> Vec<String> {
    BANNER_CODES.iter().map(|(_, n)| n.to_string()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dye_colors() {
        assert_eq!(dye_color_rgb(0), 0x191919); // black
        assert_eq!(dye_color_rgb(15), 0xFFFFFF); // white
        assert_eq!(dye_color_rgb(1), 0x993333); // red
    }

    #[test]
    fn test_pattern_names() {
        let names = banner_pattern_names();
        assert!(names.contains(&"base".to_string()));
        assert!(names.contains(&"creeper".to_string()));
        assert!(names.contains(&"mojang".to_string()));
        assert_eq!(names.len(), 38); // Total patterns
    }

    #[test]
    fn test_banner_vertices() {
        // Empty patterns should return empty
        let empty = banner_vertices(&[], 0);
        assert!(empty.is_empty());
        
        // Simple base only
        let base_only = banner_vertices(&[0xFF], 0); // terminator only
        // Should have 4 vertices * 9 floats = 36 floats
        assert_eq!(base_only.len(), 36);
    }

    #[test]
    fn test_banner_composite() {
        // 16x16 base texture (all white)
        let base = vec![255u8; 16*16*4];
        let masks = vec![0u8; 16*16*4]; // empty mask
        let layers = vec![0xFF]; // no additional layers
        
        let result = banner_composite(&base, 16, 16, &masks, 16, 16, &layers);
        assert_eq!(result.len(), 16*16*4);
    }

    #[test]
    fn test_pattern_uv() {
        let uv = banner_pattern_uv("base", 0);
        assert_eq!(uv.len(), 4);
        
        let uv = banner_pattern_uv("creeper", 0);
        assert_eq!(uv.len(), 4);
        
        let uv = banner_pattern_uv("nonexistent", 0);
        assert!(uv.is_empty());
    }
}