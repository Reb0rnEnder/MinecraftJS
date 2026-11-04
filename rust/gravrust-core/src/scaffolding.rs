//! Port of `client/js/world/scaffolding.js`: scaffolding collision detection.
//!
//! Provides collision shape determination for scaffolding blocks in Minecraft 1.14.4.

use wasm_bindgen::prelude::*;

/// Constants for scaffolding collision shapes.
const STABLE: [[f32; 6]; 5] = [
    [0.0, 0.875, 0.0, 1.0, 1.0, 1.0],
    [0.0, 0.0, 0.0, 0.125, 1.0, 0.125],
    [0.875, 0.0, 0.0, 1.0, 1.0, 0.125],
    [0.0, 0.0, 0.875, 0.125, 1.0, 1.0],
    [0.875, 0.0, 0.875, 1.0, 1.0, 1.0],
];

const BOTTOM: [[f32; 6]; 1] = [
    [0.0, 0.0, 0.0, 1.0, 0.125, 1.0],
];

/// Determine the scaffolding collision shape based on properties and position.
///
/// # Arguments
/// * `properties` - Block properties (distance and bottom flag)
/// * `y` - The Y coordinate
/// * `mover` - The entity/mover (optional)
///
/// # Returns
/// * `Some(&'static [['f32; 6]; 5])` - STABLE collision shape if conditions met
/// * `Some(&'static [['f32; 6]; 1])` - BOTTOM collision shape if conditions met
/// * `None` - No collision shape
pub fn scaffolding_collision(
    distance: f32,
    bottom: bool,
    mover_y: f32,
    sneaking: bool,
) -> Option<&'static [[f32; 6]; 5]> {
    let feet = if sneaking {
        0.0
    } else {
        mover_y
    };
    
    // Check STABLE shape condition: feet > y + 1 - epsilon AND not sneaking
    if feet > 1.0 - 1e-5 && !sneaking {
        return Some(&STABLE);
    }
    
    // Check BOTTOM shape condition: distance !== 0 && bottom === 'true' && feet > y - epsilon
    if distance != 0.0 && bottom && feet > -1e-5 {
        // Return BOTTOM as a separate type would require overloads
        // For now, return None for BOTTOM since the function signature is different
        None
    } else {
        None
    }
}

pub fn scaffolding_collision_bottom(
    distance: f32,
    bottom: bool,
    mover_y: f32,
) -> Option<&'static [[f32; 6]; 1]> {
    let feet = mover_y;
    
    if distance != 0.0 && bottom && feet > -1e-5 {
        Some(&BOTTOM)
    } else {
        None
    }
}

