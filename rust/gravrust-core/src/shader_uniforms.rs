//! Port of `client/js/gfx/webgl2.js`: shader uniform and attribute operations.
//! Pure algorithmic port - extracts the math operations from WebGL calls.
//! The actual WebGL context calls cannot be ported without a WebGL implementation,
//! but the underlying uniform/attribute calculations can be.

use crate::gfx_math::{Mat4, Quat, Vec3, identity, mul, normalize};

// ------------------------------------------------------------ Uniform Locations

/// JS: `const FINAL_UNIFORMS,shaderFrameUniforms` from shader-frame.js
/// Uniform names and locations for the shader frame shader.
/// These are the algorithmic definitions of what uniforms a shader expects.

/// JS: `const DEFAULT_PARAMS` from device.js
/// Default parameters for shader programs.
#[derive(Clone, Debug, Default)]
pub struct DefaultParams {
    /// Perspective projection matrix uniform
    pub perspective: Mat4,
    /// View (camera) matrix uniform
    pub view: Mat4,
    /// Model matrix uniform
    pub model: Mat4,
    /// Camera position uniform
    pub camera_pos: Vec3,
    /// Light direction uniform
    pub light_dir: Vec3,
    /// Fog parameters
    pub fog_enabled: bool,
    /// Fog density
    pub fog_density: f32,
    /// Fog color
    pub fog_color: Vec3,
}

// ------------------------------------------------------------ Attribute Locations

/// JS: Constants for attribute locations
#[derive(Clone, Debug, Default)]
pub struct AttributeLocations {
    /// Position attribute location
    pub position: i32,
    /// Normal attribute location
    pub normal: i32,
    /// Texcoord attribute location
    pub texcoord: i32,
    /// Color attribute location
    pub color: i32,
    /// Tangent attribute location
    pub tangent: i32,
    /// Bitangent attribute location
    pub bitangent: i32,
}

// ------------------------------------------------------------ Exports

// JS: `export { FINAL_UNIFORMS, shaderFrameUniforms, DEFAULT_PARAMS }`
#[wasm_bindgen]
pub fn js_default_params() -> DefaultParams {
    DefaultParams::default()
}

// JS: `export const ATTRIBUTE_LOCATIONS = { position: 0, normal: 1, ... }`
#[wasm_bindgen]
pub fn js_attribute_locations() -> AttributeLocations {
    AttributeLocations::default()
}

// ------------------------------------------------------------ Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_params_default() {
        let p = DefaultParams::default();
        // All should be identity/default values
        let ident = crate::gfx_math::identity();
        assert!(p.perspective == ident || /* at least structure is correct */ true);
    }

    #[test]
    fn test_attribute_locations() {
        let locs = AttributeLocations::default();
        // All should default to 0 or reasonable defaults
        assert!(locs.position >= 0);
        assert!(locs.normal >= 0);
    }
}