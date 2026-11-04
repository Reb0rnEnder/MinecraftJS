//! Port of `client/js/render/fire-overlay.js`.
//!
//! Fire overlay effect when the player is in fire/lava.
//! Generates a full-screen quad with animated fire texture using two
//! intersecting planes, and the perspective projection matrix for rendering.

use wasm_bindgen::prelude::*;
use crate::math::{multiply, invert, perspective, ortho};

/// Result of fire overlay geometry generation.
/// Returns a flat array of f32: [x, y, z, u, v, r, g, b, a, ...] per vertex.
/// Two intersecting planes, 4 vertices each = 8 vertices = 72 floats.
#[wasm_bindgen]
pub struct FireOverlayGeometryResult {
    vertices: Vec<f32>,
    vertex_count: u32,
}

#[wasm_bindgen]
impl FireOverlayGeometryResult {
    /// Get the vertices as a flat array (9 floats per vertex: x,y,z, u,v, r,g,b,a).
    #[wasm_bindgen(getter)]
    pub fn vertices(&self) -> Vec<f32> {
        self.vertices.clone()
    }

    /// Number of vertices (always 8 for the fire overlay: 2 planes × 4 vertices).
    #[wasm_bindgen(getter)]
    pub fn vertex_count(&self) -> u32 {
        self.vertex_count
    }

    /// Returns true if there are no vertices (empty result).
    #[wasm_bindgen(getter)]
    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }
}

/// Generate fire overlay geometry (ported from `fireOverlayVertices`).
///
/// Parameters:
/// - `fire0_u0, fire0_v0, fire0_u1, fire0_v1`: UV for block/fire_0 texture (top-left, bottom-right)
/// - `fire1_u0, fire1_v0, fire1_u1, fire1_v1`: UV for block/fire_1 texture (top-left, bottom-right)
/// - `ticks`: Game ticks (used for frame animation selection between fire_0 and fire_1)
///
/// The JS alternates between fire_0 and fire_1 every tick. This function
/// generates geometry for both planes using the provided UVs, and the caller
/// can select which texture to bind per frame based on ticks.
///
/// Returns FireOverlayGeometryResult with vertices, or an empty result on failure.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn fire_overlay_geometry(
    fire0_u0: f32, fire0_v0: f32, fire0_u1: f32, fire0_v1: f32,
    fire1_u0: f32, fire1_v0: f32, fire1_u1: f32, fire1_v1: f32,
    _ticks: u32,
) -> FireOverlayGeometryResult {
    // UV arrays: fire0 = [u0, v0, u1, v1], fire1 = [u0, v0, u1, v1]
    // JS: const [u0,v0,u1,v1]=uv
    let s0_uv = [fire0_u0, fire0_v0, fire0_u1, fire0_v1];
    let s1_uv = [fire1_u0, fire1_v0, fire1_u1, fire1_v1];

    let mut vertices = Vec::with_capacity(72); // 8 vertices * 9 floats

    // JS: for(let side=0;side<2;side++){
    for side in 0..2 {
        // JS: const sign=side*2-1,angle=sign*Math.PI/18,c=Math.cos(angle),s=Math.sin(angle);
        let sign = (side * 2 - 1) as f32;
        let angle = sign * std::f32::consts::PI / 18.0; // +/- 10 degrees in radians
        let c = angle.cos();
        let s = angle.sin();

        // JS: for(const [x,y,u,v] of [[-.5,-.5,u1,v1],[.5,-.5,u0,v1],[.5,.5,u0,v0],[-.5,.5,u1,v0]])
        // The UV selection depends on the plane (side 0 uses fire1, side 1 uses fire0)
        // Wait, looking at JS more carefully:
        // side=0: sign=-1, uses u1,v1 then u0,v1 then u0,v0 then u1,v0 -> fire1 UV
        // side=1: sign=1, uses u1,v1 then u0,v1 then u0,v0 then u1,v0 -> fire0 UV
        // Actually the JS passes `uv` which is [u0,v0,u1,v1] for the current frame's texture
        // But the comment says "fire_0 and fire_1 alternating" - so the caller passes the UV for the current frame
        // The two planes use the same UV but with different orientations
        
        // Actually re-reading: the JS function takes a single `uv` parameter [u0,v0,u1,v1]
        // and generates two intersecting planes both using that UV.
        // The animation (alternating fire_0/fire_1) happens at the caller level by passing different UVs each frame.
        
        // So for our port, we accept both fire0 and fire1 UVs, but the geometry generation
        // uses the UV that corresponds to the current frame. The caller should pass the
        // appropriate UV set based on ticks. But the function signature takes both...
        
        // Looking at the JS usage: it calls fireOverlayVertices(uv) where uv is the current frame's UV.
        // The alternating is done by the caller: fireOverlayVertices(ticks % 2 === 0 ? fire0UV : fire1UV)
        // 
        // So our function should generate geometry for ONE set of UVs. But the task says:
        // "UV coordinates for fire_0 and fire_1 alternating" - this suggests the function
        // might need to handle the alternation.
        
        // Actually, re-reading the task: "Export `fire_overlay_geometry(view_size, fire0_uv, fire1_uv, ticks) -> vertices`"
        // This suggests the function takes both UVs and ticks, and handles the alternation internally.
        
        // Let me follow the task spec: the function takes both UV sets and ticks,
        // and generates geometry using the appropriate UV based on ticks.
        
        // But the JS function fireOverlayVertices only takes ONE uv set.
        // The alternation is: the caller calls it with fire0UV on even ticks, fire1UV on odd ticks.
        
        // Given the task spec says to take both fire0_uv and fire1_uv and ticks,
        // I'll generate geometry for the UV corresponding to the current tick.
        
        // Actually wait - the two planes in the JS are two intersecting planes that form an X shape.
        // They both use the SAME UV (the current frame's texture).
        // The "fire_0 and fire_1 alternating" refers to frame-by-frame animation, not the two planes.
        
        // So the correct interpretation: the function should use fire0_uv on even ticks, fire1_uv on odd ticks.
        // Both planes use the same UV (the one for the current frame).
        
        let current_uv = if _ticks % 2 == 0 { s0_uv } else { s1_uv };
        let [u0, v0, u1, v1] = current_uv;

        // The four corners of the quad in local space (-0.5 to 0.5)
        // JS order: [[-.5,-.5,u1,v1],[.5,-.5,u0,v1],[.5,.5,u0,v0],[-.5,.5,u1,v0]]
        let corners = [
            (-0.5, -0.5, u1, v1),  // bottom-left
            (0.5, -0.5, u0, v1),   // bottom-right
            (0.5, 0.5, u0, v0),    // top-right
            (-0.5, 0.5, u1, v0),   // top-left
        ];

        for (x, y, u, v) in corners {
            // JS: vertices.push(c*x-s*.5-sign*.24, y-.3, -s*x-c*.5, u, v, 1, 1, 1, .9);
            let vx = c * x - s * 0.5 - sign * 0.24;
            let vy = y - 0.3;
            let vz = -s * x - c * 0.5;
            
            vertices.push(vx);
            vertices.push(vy);
            vertices.push(vz);
            vertices.push(u);
            vertices.push(v);
            vertices.push(1.0); // r
            vertices.push(1.0); // g
            vertices.push(1.0); // b
            vertices.push(0.9); // a (0.9 alpha)
        }
    }

    let vertex_count = (vertices.len() / 9) as u32;

    FireOverlayGeometryResult {
        vertices,
        vertex_count,
    }
}

/// Generate fire overlay projection matrix (ported from `fireOverlayProjection`).
///
/// Parameters:
/// - `width`: Viewport width
/// - `height`: Viewport height
///
/// Returns a column-major 4x4 matrix (16 floats) as Vec<f32>,
/// or an empty Vec on failure (for JS fallback).
///
/// The JS logic:
/// 1. Creates orthographic projection: mat4.ortho(0, width, height, 0, -400000, 400000)
/// 2. Inverts it
/// 3. Multiplies with perspective: mat4.perspective(70° FOV, width/height, 0.05, 10)
#[wasm_bindgen]
pub fn fire_overlay_projection(width: f32, height: f32) -> Vec<f32> {
    if width <= 0.0 || height <= 0.0 {
        return Vec::new();
    }

    // Step 1: GUI orthographic projection (matches JS: 0, width, height, 0, -400000, 400000)
    let gui = ortho(0.0, width as f64, height as f64, 0.0, -400000.0, 400000.0);

    // Step 2: Invert the orthographic matrix
    let inverse = match invert(&gui) {
        Some(m) => m,
        None => return Vec::new(),
    };

    // Step 3: Perspective matrix (70 degrees, width/height aspect, 0.05 near, 10 far)
    let aspect = width as f64 / height as f64;
    let fovy = 70.0 * std::f64::consts::PI / 180.0;
    let persp = perspective(fovy, aspect, 0.05, 10.0);

    // Step 4: Multiply inverse * perspective (JS: mat4.multiply(inverse, inverse, perspective))
    // Note: JS mat4.multiply(out, a, b) computes a * b
    // Our multiply(a, b) also computes a * b
    let result = multiply(&inverse, &persp);

    result.to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fire_overlay_geometry_vertex_count() {
        let result = fire_overlay_geometry(
            0.0, 0.0, 0.5, 0.5,  // fire0 UV
            0.5, 0.0, 1.0, 0.5,  // fire1 UV
            0,  // even tick -> fire0
        );
        assert!(!result.is_empty());
        assert_eq!(result.vertex_count, 8); // 2 planes * 4 vertices
        assert_eq!(result.vertices.len(), 72); // 8 * 9 floats
    }

    #[test]
    fn test_fire_overlay_geometry_alternates_by_tick() {
        let result0 = fire_overlay_geometry(
            0.0, 0.0, 0.5, 0.5,
            0.5, 0.0, 1.0, 0.5,
            0,  // even -> fire0
        );
        let result1 = fire_overlay_geometry(
            0.0, 0.0, 0.5, 0.5,
            0.5, 0.0, 1.0, 0.5,
            1,  // odd -> fire1
        );
        // UVs should be different (fire0 vs fire1)
        assert_ne!(result0.vertices, result1.vertices);
    }

    #[test]
    fn test_fire_overlay_geometry_vertex_format() {
        let result = fire_overlay_geometry(
            0.0, 0.0, 0.5, 0.5,
            0.5, 0.0, 1.0, 0.5,
            0,
        );
        // Each vertex: x, y, z, u, v, r, g, b, a (9 floats)
        assert_eq!(result.vertices.len() % 9, 0);
        
        // Check color values (white with 0.9 alpha)
        for i in (0..result.vertices.len()).step_by(9) {
            assert_eq!(result.vertices[i + 5], 1.0); // r
            assert_eq!(result.vertices[i + 6], 1.0); // g
            assert_eq!(result.vertices[i + 7], 1.0); // b
            assert_eq!(result.vertices[i + 8], 0.9); // a
        }
    }

    #[test]
    fn test_fire_overlay_projection_valid() {
        let proj = fire_overlay_projection(800.0, 600.0);
        assert_eq!(proj.len(), 16); // 4x4 matrix
    }

    #[test]
    fn test_fire_overlay_projection_invalid_size() {
        let proj = fire_overlay_projection(0.0, 600.0);
        assert!(proj.is_empty());
        let proj = fire_overlay_projection(800.0, 0.0);
        assert!(proj.is_empty());
    }

    #[test]
    fn test_fire_overlay_projection_changes_with_aspect() {
        let proj1 = fire_overlay_projection(800.0, 600.0); // 4:3
        let proj2 = fire_overlay_projection(1920.0, 1080.0); // 16:9
        // Different aspects should produce different projection matrices
        assert_ne!(proj1, proj2);
    }

    #[test]
    fn test_fire_overlay_two_planes_different_orientation() {
        // The two planes should have different vertex positions (intersecting at an angle)
        let result = fire_overlay_geometry(
            0.0, 0.0, 0.5, 0.5,
            0.5, 0.0, 1.0, 0.5,
            0,
        );
        let verts = result.vertices();
        
        // Plane 0 vertices (first 36 floats / 4 vertices)
        let p0_v0 = &verts[0..3];
        let p0_v1 = &verts[9..12];
        let p0_v2 = &verts[18..21];
        let p0_v3 = &verts[27..30];
        
        // Plane 1 vertices (next 36 floats / 4 vertices)
        let p1_v0 = &verts[36..39];
        let p1_v1 = &verts[45..48];
        let p1_v2 = &verts[54..57];
        let p1_v3 = &verts[63..66];
        
        // The two planes should be rotated in opposite directions (±10 degrees)
        // So their X coordinates should have opposite signs for corresponding vertices
        // (approximately, since there's also the sign*0.24 translation)
        assert_ne!(p0_v0[0], p1_v0[0]);
        assert_ne!(p0_v1[0], p1_v1[0]);
    }
}