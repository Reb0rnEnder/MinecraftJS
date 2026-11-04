// Debug targets: block and fluid raycasts from eye position
// Ported from client/js/game/debug-targets.js

// Similar to: export function debugTargets(game) {
//   const eye=game.eyePosition(0),look=game.lookVector(0);
//   return {
//     block:game.world.raycast(...eye,...look,20,false),
//     fluid:game.world.raycast(...eye,...look,20,'any'),
//   };
// }

/// Returns block and fluid raycast results from the player's eye position.
pub struct DebugTargets {
    /// Block raycast result (None if no block hit)
    pub block: Option<crate::math::Vec3>,
    /// Fluid raycast result (None if no fluid hit)
    pub fluid: Option<crate::math::Vec3>,
}

impl DebugTargets {
    pub fn new() -> Self {
        DebugTargets {
            block: None,
            fluid: None,
        }
    }
}
