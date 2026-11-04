//! Port of `client/js/render/entity-fire.js`.
//!
//! Fire geometry generation for burning entities.
//! The JS version builds quads on the CPU every frame; this WASM version
//! exposes the pure geometry computation so the browser can upload a single
//! dynamic buffer.

use wasm_bindgen::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json;

// Entity type IDs that are immune to fire (from JS: IMMUNE Set)
const IMMUNE_TYPES: &[u32] = &[56, 57, 61, 62, 63, 64];

/// UV coordinates for a fire texture in the atlas.
/// JS expects [u0, v0, u1, v1] where (u0,v0) is top-left and (u1,v1) is bottom-right.
#[derive(Clone, Copy, Debug, serde::Serialize, serde::Deserialize)]
#[wasm_bindgen]
pub struct FireUv {
    pub u0: f32,
    pub v0: f32,
    pub u1: f32,
    pub v1: f32,
}

impl FireUv {
    fn to_array(&self) -> [f32; 4] {
        [self.u0, self.v0, self.u1, self.v1]
    }
}

/// Input entity for fire rendering.
#[derive(Clone, Copy, Debug, serde::Serialize, serde::Deserialize)]
#[wasm_bindgen]
pub struct FireEntity {
    /// Entity unique ID (not used in geometry, but useful for debugging)
    pub id: u32,
    /// Entity kind: 0 = mob, 1 = player, 2 = other
    pub kind: u8,
    /// Entity type ID (for immunity check)
    pub entity_type: u32,
    /// Whether it's a wither (special case for type 51)
    pub wither: bool,
    /// Player gamemode (3 = spectator)
    pub gamemode: u8,
    /// Whether the entity is on fire
    pub on_fire: bool,
    /// Entity width (default 0.6)
    pub width: f32,
    /// Entity height (default 1.8)
    pub height: f32,
    /// Interpolated position X
    pub x: f32,
    /// Interpolated position Y
    pub y: f32,
    /// Interpolated position Z
    pub z: f32,
}

impl Default for FireEntity {
    fn default() -> Self {
        Self {
            id: 0,
            kind: 0,
            entity_type: 0,
            wither: false,
            gamemode: 0,
            on_fire: false,
            width: 0.6,
            height: 1.8,
            x: 0.0,
            y: 0.0,
            z: 0.0,
        }
    }
}

/// Check if an entity should render fire (ported from `EntityFire.burning`).
#[wasm_bindgen]
pub fn entity_should_burn(entity: &FireEntity) -> bool {
    if !entity.on_fire {
        return false;
    }
    match entity.kind {
        0 => { // mob
            if IMMUNE_TYPES.contains(&entity.entity_type) {
                return false;
            }
            if entity.entity_type == 51 && entity.wither {
                return false;
            }
        }
        1 => { // player
            if entity.gamemode == 3 { // spectator
                return false;
            }
        }
        _ => {}
    }
    true
}

/// Result of fire geometry generation.
/// Returns a flat Float32Array: [x, y, z, u, v, r, g, b, a, ...] per vertex.
/// Each quad has 4 vertices = 36 floats (9 per vertex * 4).
#[wasm_bindgen]
pub struct FireGeometryResult {
    vertices: Vec<f32>,
    vertex_count: u32,
}

#[wasm_bindgen]
impl FireGeometryResult {
    /// Get the vertices as a flat array (9 floats per vertex: x,y,z, u,v, r,g,b,a).
    #[wasm_bindgen(getter)]
    pub fn vertices(&self) -> Vec<f32> {
        self.vertices.clone()
    }

    /// Number of vertices (each quad = 4 vertices).
    #[wasm_bindgen(getter)]
    pub fn vertex_count(&self) -> u32 {
        self.vertex_count
    }

    /// Number of quads (each quad = 2 triangles = 6 indices).
    #[wasm_bindgen(getter)]
    pub fn quad_count(&self) -> u32 {
        self.vertex_count / 4
    }

    /// Returns true if there are no vertices (empty result).
    #[wasm_bindgen(getter)]
    pub fn is_empty(&self) -> bool {
        self.vertices.is_empty()
    }
}

/// Generate fire geometry for a list of entities.
///
/// This is the main WASM export that replaces `EntityFire.update`.
///
/// Parameters:
/// - `entities_json`: JSON array of FireEntity objects
/// - `view_yaw`: Camera yaw in degrees (player view Y rotation)
/// - `fire0_u0, fire0_v0, fire0_u1, fire0_v1`: UV for block/fire_0
/// - `fire1_u0, fire1_v0, fire1_u1, fire1_v1`: UV for block/fire_1
/// - `ticks`: Game ticks (used for potential future animation)
///
/// Returns FireGeometryResult with vertices and count, or an empty result on failure.
#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn entity_fire_geometry(
    entities_json: &str,
    view_yaw: f32,
    fire0_u0: f32, fire0_v0: f32, fire0_u1: f32, fire0_v1: f32,
    fire1_u0: f32, fire1_v0: f32, fire1_u1: f32, fire1_v1: f32,
    _ticks: u32,
) -> FireGeometryResult {
    let entities: Vec<FireEntity> = serde_json::from_str(entities_json).unwrap_or_default();
    
    let fire0_uv = FireUv { u0: fire0_u0, v0: fire0_v0, u1: fire0_u1, v1: fire0_v1 };
    let fire1_uv = FireUv { u0: fire1_u0, v0: fire1_v0, u1: fire1_u1, v1: fire1_v1 };

    // Early exit if no entities or invalid UVs
    if entities.is_empty() {
        return FireGeometryResult {
            vertices: Vec::new(),
            vertex_count: 0,
        };
    }

    // Convert view yaw to radians (negative because JS uses -viewYaw)
    let a = -view_yaw * std::f32::consts::PI / 180.0;
    let ca = a.cos();
    let sa = a.sin();

    // UV arrays
    let s0_uv = fire0_uv.to_array();
    let s1_uv = fire1_uv.to_array();

    let mut out = Vec::new();

    for entity in entities {
        if !entity_should_burn(&entity) {
            continue;
        }

        // Scale factor based on entity width (JS: f = (e.width || 0.6) * 1.4)
        let f = (entity.width.max(0.01)) * 1.4;

        // Fire layer parameters (JS: f1=0.5, f3=height/f, f4=0, f5=0)
        let mut f1 = 0.5;
        let mut f3 = entity.height / f;
        let mut f4 = 0.0;
        let mut f5 = 0.0;
        let mut i = 0;

        // Z offset (JS: -0.3 + Math.trunc(f3) * 0.02)
        let z_off = -0.3 + (f3.trunc() as i32) as f32 * 0.02;

        // Build fire layers while f3 > 0 (JS: while (f3 > 0))
        while f3 > 0.0 {
            // Alternate between fire_0 and fire_1 (JS: i % 2 === 0 ? s0 : s1)
            let uv = if i % 2 == 0 { s0_uv } else { s1_uv };
            let [u0, v0, u1, v1] = uv;

            // Mirror UV every other pair (JS: Math.floor(i / 2) % 2 === 0)
            let (u0, u1) = if (i / 2) % 2 == 0 { (u1, u0) } else { (u0, u1) };

            // Helper to add a vertex (JS: vert function)
            // Vertex format: x, y, z, u, v, r, g, b, a (9 floats)
            let mut add_vertex = |x: f32, y: f32, z: f32, u: f32, v: f32| {
                let z_pos = z + z_off;
                // Rotate around Y axis to face camera
                let rx = x * ca + z_pos * sa;
                let rz = -x * sa + z_pos * ca;
                out.push(entity.x + rx * f);
                out.push(entity.y + y * f);
                out.push(entity.z + rz * f);
                out.push(u);
                out.push(v);
                // White color with full alpha (JS: 1, 1, 1, 1)
                out.push(1.0);
                out.push(1.0);
                out.push(1.0);
                out.push(1.0);
            };

            // Build the quad (4 vertices, CCW winding for front face)
            // JS order: vert(f1, -f4, f5, u1, v1);
            //           vert(-f1, -f4, f5, u0, v1);
            //           vert(-f1, 1.4 - f4, f5, u0, v0);
            //           vert(f1, 1.4 - f4, f5, u1, v0);
            add_vertex(f1, -f4, f5, u1, v1);
            add_vertex(-f1, -f4, f5, u0, v1);
            add_vertex(-f1, 1.4 - f4, f5, u0, v0);
            add_vertex(f1, 1.4 - f4, f5, u1, v0);

            // Next layer parameters (JS: f3 -= 0.45; f4 -= 0.45; f1 *= 0.9; f5 += 0.03; i++)
            f3 -= 0.45;
            f4 -= 0.45;
            f1 *= 0.9;
            f5 += 0.03;
            i += 1;
        }
    }

    let vertex_count = (out.len() / 9) as u32;

    FireGeometryResult {
        vertices: out,
        vertex_count,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_immune_mob_no_fire() {
        let entity = FireEntity {
            kind: 0, // mob
            entity_type: 56, // immune type
            on_fire: true,
            ..Default::default()
        };
        assert!(!entity_should_burn(&entity));
    }

    #[test]
    fn test_wither_no_fire() {
        let entity = FireEntity {
            kind: 0,
            entity_type: 51,
            wither: true,
            on_fire: true,
            ..Default::default()
        };
        assert!(!entity_should_burn(&entity));
    }

    #[test]
    fn test_spectator_no_fire() {
        let entity = FireEntity {
            kind: 1, // player
            gamemode: 3, // spectator
            on_fire: true,
            ..Default::default()
        };
        assert!(!entity_should_burn(&entity));
    }

    #[test]
    fn test_normal_mob_burns() {
        let entity = FireEntity {
            kind: 0,
            entity_type: 1, // zombie
            on_fire: true,
            ..Default::default()
        };
        assert!(entity_should_burn(&entity));
    }

    #[test]
    fn test_fire_geometry_basic() {
        let fire0_uv = FireUv { u0: 0.0, v0: 0.0, u1: 0.5, v1: 0.5 };
        let fire1_uv = FireUv { u0: 0.5, v0: 0.0, u1: 1.0, v1: 0.5 };

        let entity = FireEntity {
            kind: 0,
            entity_type: 1,
            on_fire: true,
            width: 0.6,
            height: 1.8,
            x: 100.0,
            y: 64.0,
            z: 100.0,
            ..Default::default()
        };

        let result = entity_fire_geometry(
            &serde_json::to_string(&[entity]).unwrap(),
            0.0, fire0_uv.u0, fire0_uv.v0, fire0_uv.u1, fire0_uv.v1, fire1_uv.u0, fire1_uv.v0, fire1_uv.u1, fire1_uv.v1, 0
        );

        // Should have vertices (1.8 height / (0.6*1.4) â‰ˆ 2.14 layers, each 0.45 = ~4-5 layers)
        assert!(!result.is_empty());
        assert!(result.vertex_count > 0);
        assert_eq!(result.vertices.len() % 9, 0); // 9 floats per vertex
    }

    #[test]
    fn test_fire_geometry_empty_when_not_burning() {
        let fire0_uv = FireUv { u0: 0.0, v0: 0.0, u1: 0.5, v1: 0.5 };
        let fire1_uv = FireUv { u0: 0.5, v0: 0.0, u1: 1.0, v1: 0.5 };

        let entity = FireEntity {
            kind: 0,
            entity_type: 56, // immune
            on_fire: true,
            ..Default::default()
        };

        let result = entity_fire_geometry(
            &serde_json::to_string(&[entity]).unwrap(),
            0.0, fire0_uv.u0, fire0_uv.v0, fire0_uv.u1, fire0_uv.v1, fire1_uv.u0, fire1_uv.v0, fire1_uv.u1, fire1_uv.v1, 0
        );
        assert!(result.is_empty());
    }

    #[test]
    fn test_fire_geometry_view_yaw_rotation() {
        let fire0_uv = FireUv { u0: 0.0, v0: 0.0, u1: 0.5, v1: 0.5 };
        let fire1_uv = FireUv { u0: 0.5, v0: 0.0, u1: 1.0, v1: 0.5 };

        let entity = FireEntity {
            kind: 0,
            entity_type: 1,
            on_fire: true,
            width: 0.6,
            height: 1.8,
            x: 0.0,
            y: 0.0,
            z: 0.0,
            ..Default::default()
        };

        // 0 yaw
        let result0 = entity_fire_geometry(
            &serde_json::to_string(&[entity]).unwrap(),
            0.0, fire0_uv.u0, fire0_uv.v0, fire0_uv.u1, fire0_uv.v1, fire1_uv.u0, fire1_uv.v0, fire1_uv.u1, fire1_uv.v1, 0
        );
        // 90 yaw
        let result90 = entity_fire_geometry(
            &serde_json::to_string(&[entity]).unwrap(),
            90.0, fire0_uv.u0, fire0_uv.v0, fire0_uv.u1, fire0_uv.v1, fire1_uv.u0, fire1_uv.v0, fire1_uv.u1, fire1_uv.v1, 0
        );

        // Vertices should be different due to rotation
        assert_ne!(result0.vertices, result90.vertices);
    }
}
