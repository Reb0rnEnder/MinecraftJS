//! Port of `client/js/world/fluids.js`.
 //!
 //! Block identity and fluid identity are separate in 1.13+: waterlogged stairs
 //! and water plants expose source water without being liquid blocks.

 use crate::blocks::BlockRegistry;
 use wasm_bindgen::prelude::*;

 #[wasm_bindgen]
 pub struct FluidState {
     is_water: bool,
     is_lava: bool,
     level: i32,
     source: bool,
     height: f64,
 }

 #[wasm_bindgen]
 impl FluidState {
     #[wasm_bindgen(getter)]
     pub fn is_water(&self) -> bool {
         self.is_water
     }
     #[wasm_bindgen(getter)]
     pub fn is_lava(&self) -> bool {
         self.is_lava
     }
     #[wasm_bindgen(getter)]
     pub fn level(&self) -> i32 {
         self.level
     }
     #[wasm_bindgen(getter)]
     pub fn source(&self) -> bool {
         self.source
     }
     #[wasm_bindgen(getter)]
     pub fn height(&self) -> f64 {
         self.height
     }
 }

 fn make(lava: bool, level: i32) -> FluidState {
     let level = level.clamp(0, 15);
     FluidState {
         is_water: !lava,
         is_lava: lava,
         level,
         source: level == 0,
         height: (8 - if level >= 8 { 0 } else { level }) as f64 / 9.0,
     }
 }

 /// `getFluidState` with the block registry facts passed in explicitly.
 #[wasm_bindgen]
 pub fn fluid_state(
     is_liquid: bool,
     is_lava: bool,
     level: i32,
     waterlogged: bool,
     is_water_plant: bool,
 ) -> Option<FluidState> {
     if is_liquid {
         return Some(make(is_lava, level));
     }
     if waterlogged || is_water_plant {
         return Some(make(false, 0));
     }
     None
 }

 /// `fluidHeightAt` after the caller has looked up the cell above.
 #[wasm_bindgen]
 pub fn fluid_height(above_same_fluid: bool, height: f64) -> f64 {
     if above_same_fluid {
         1.0
     } else {
         height
     }
 }

 /// Check if a point is in fluid (water/lava). Used by `eyes_in_water`.
 /// Returns true if the block at the given position is water or lava.
 pub fn is_point_in_fluid(
     reg: &BlockRegistry,
     world_get_state: impl Fn(i32, i32, i32) -> u32,
     x: f64,
     y: f64,
     z: f64,
 ) -> bool {
     let ix = x.floor() as i32;
     let iy = y.floor() as i32;
     let iz = z.floor() as i32;
     let state = world_get_state(ix, iy, iz);
     let b = reg.def(state);
     b.is_water || b.is_lava
 }

 #[cfg(test)]
 mod tests {
     use super::*;
     use crate::blocks::BlockRegistry;

     fn test_reg() -> BlockRegistry {
         let blocks = r#"[
             {"id": 0, "name": "air", "boundingBox": "empty", "material": "air", "transparent": true},
             {"id": 1, "name": "stone", "boundingBox": "block", "material": "rock"},
             {"id": 8, "name": "water", "boundingBox": "empty", "material": "water", "transparent": true},
             {"id": 10, "name": "lava", "boundingBox": "empty", "material": "lava", "transparent": true}
         ]"#;
         let shapes = r#"{"blocks": {}, "shapes": {}}"#;
         BlockRegistry::new(blocks, shapes).unwrap()
     }

     #[test]
     fn fluid_state_water() {
         let reg = test_reg();
         let water = fluid_state(true, false, 0, false, false).unwrap();
         assert!(water.is_water());
         assert!(!water.is_lava());
         assert_eq!(water.level(), 0);
         assert!(water.source());
     }

     #[test]
     fn fluid_state_lava() {
         let reg = test_reg();
         let lava = fluid_state(true, true, 3, false, false).unwrap();
         assert!(!lava.is_water());
         assert!(lava.is_lava());
         assert_eq!(lava.level(), 3);
         assert!(!lava.source());
     }

     #[test]
     fn fluid_state_waterlogged() {
         let reg = test_reg();
         let water = fluid_state(false, false, 0, true, false).unwrap();
         assert!(water.is_water());
         assert!(water.source());
     }

     #[test]
     fn fluid_height_same_above() {
         assert_eq!(fluid_height(true, 0.5), 1.0);
     }

     #[test]
     fn fluid_height_not_same() {
         assert_eq!(fluid_height(false, 0.5), 0.5);
     }
 }