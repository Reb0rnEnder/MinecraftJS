//! Port of `client/js/gfx/inventory-lighting.js`.
//!
//! 1.15.2: native setupGui3DDiffuseLighting: RY(62) RX(185.5) S(1,-1,1) RY(-22.5) RX(135).

pub const INVENTORY_LIGHT0: [f64; 3] = [-0.962466053, -0.078723402, -0.259733945];
pub const INVENTORY_LIGHT1: [f64; 3] = [-0.268056283, -0.958095612, 0.100988249];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_inventory_lighting_constants() {
        assert_eq!(INVENTORY_LIGHT0.len(), 3);
        assert_eq!(INVENTORY_LIGHT1.len(), 3);
        assert!((INVENTORY_LIGHT0[0] - -0.962466053).abs() < 1e-6);
        assert!((INVENTORY_LIGHT1[0] - -0.268056283).abs() < 1e-6);
    }
}
