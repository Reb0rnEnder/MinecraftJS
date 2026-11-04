//! Ports of `client/js/game/placement-collision.js` and
//! `client/js/world/scaffolding.js`.
//!
//! Boxes are flattened `[x0,y0,z0,x1,y1,z1, ...]` arrays at the boundary.

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

const STABLE: &[f64] = &[
    0.0, 0.875, 0.0, 1.0, 1.0, 1.0, // top platform
    0.0, 0.0, 0.0, 0.125, 1.0, 0.125, // corner posts
    0.875, 0.0, 0.0, 1.0, 1.0, 0.125,
    0.0, 0.0, 0.875, 0.125, 1.0, 1.0,
    0.875, 0.0, 0.875, 1.0, 1.0, 1.0,
];

const BOTTOM: &[f64] = &[0.0, 0.0, 0.0, 1.0, 0.125, 1.0];

/// `ScaffoldingBlock.getCollisionShape` with the native `isAbove` check.
/// `feet` is the mover's bounding-box minimum Y; `Infinity` models no mover.
#[wasm_bindgen]
pub fn scaffolding_collision(
    distance: i32,
    bottom: bool,
    feet: f64,
    y: f64,
    sneaking: bool,
) -> Vec<f64> {
    if feet > y + 1.0 - 1e-5 && !sneaking {
        return STABLE.to_vec();
    }
    if distance != 0 && bottom && feet > y - 1e-5 {
        return BOTTOM.to_vec();
    }
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn placement_allows_touching_but_not_overlap() {
        let boxes = [0.0, 0.0, 0.0, 1.0, 1.0, 1.0];
        let pos = [0.0, 0.0, 0.0];
        assert!(!placement_intersects(&boxes, &pos, &[1.0, 0.0, 0.0, 2.0, 1.0, 1.0]));
        assert!(placement_intersects(&boxes, &pos, &[0.99, 0.0, 0.0, 2.0, 1.0, 1.0]));
    }

    #[test]
    fn scaffolding_returns_native_shapes() {
        assert_eq!(scaffolding_collision(0, false, 10.0, 0.0, false), STABLE);
        assert_eq!(scaffolding_collision(0, false, 10.0, 0.0, true), Vec::<f64>::new());
        assert_eq!(scaffolding_collision(1, true, 0.0, 0.0, false), BOTTOM);
        assert_eq!(scaffolding_collision(0, true, 0.0, 0.0, false), Vec::<f64>::new());
    }
}
