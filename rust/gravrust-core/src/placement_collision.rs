// Port of `client/js/game/placement-collision.js`
//!
//! Boxes are flattened `[x0,y0,z0,x1,y1,z1, ...]` arrays at the boundary.
//! Touching a face is allowed; strict overlap with any occupied shape box blocks placement.

use wasm_bindgen::prelude::*;

/// Strict overlap between an entity box and any occupied block-shape box.
/// Touching a face is allowed.
#[wasm_bindgen]
pub fn placement_intersects(boxes: &[f64], pos: &[f64], entity: &[f64]) -> bool {
    if pos.len() < 3 || entity.len() < 6 {
        return false;
    }
    boxes.chunks_exact(6).any(|b| {
        entity[3] > pos[0] + b[0]
            && entity[0] < pos[0] + b[3]
            && entity[4] > pos[1] + b[1]
            && entity[1] < pos[1] + b[4]
            && entity[5] > pos[2] + b[2]
            && entity[2] < pos[2] + b[5]
    })
}