// Port of `client/js/game/leash-knot.js`.

//! EntityLeashKnot / LeashFenceKnotEntity: spawn packets carry the fence BlockPos,
//! while rendering, rope endpoints, bounds and light sampling use its centre.

use wasm_bindgen::prelude::*;
use wasm_bindgen::JsValue;

/// Set up an EntityLeashKnot / LeashFenceKnotEntity with position and dimensions.
///
/// Mirrors `placeLeashKnot(e, x, z)` from the JavaScript original. The JS call
/// sites default `x` to the entity's `y` and `z` to its `z`; here both are
/// always supplied, and `y` is read from the entity when present.
#[wasm_bindgen]
pub fn place_leash_knot(e: &js_sys::Object, x: f64, z: f64) {
    let floor_x = x.floor();
    let floor_z = z.floor();

    // JS keeps the entity's current y as the knot's y.
    let y = js_sys::Reflect::get(e, &JsValue::from_str("y"))
        .ok()
        .and_then(|v| v.as_f64())
        .unwrap_or(0.0);

    let set = |key: &str, value: f64| {
        let _ = js_sys::Reflect::set(e, &JsValue::from_str(key), &JsValue::from_f64(value));
    };

    let cx = floor_x + 0.5;
    let cy = y;
    let cz = floor_z + 0.5;

    set("x", cx);
    set("prevX", cx);
    set("newX", cx);
    set("y", cy);
    set("prevY", cy);
    set("newY", cy);
    set("z", cz);
    set("prevZ", cz);
    set("newZ", cz);
    let _ = js_sys::Reflect::set(e, &JsValue::from_str("inc"), &JsValue::from_f64(0.0));
    set("width", 0.375);
    set("height", 0.5);
    set("eyeHeight", -0.0625);

    // box: [x-.1875, y-.125, z-.1875, x+.1875, y+.375, z+.1875]
    let arr = js_sys::Array::new();
    for v in [cx - 0.1875, cy - 0.125, cz - 0.1875, cx + 0.1875, cy + 0.375, cz + 0.1875] {
        arr.push(&JsValue::from_f64(v));
    }
    let _ = js_sys::Reflect::set(e, &JsValue::from_str("box"), &arr.into());
}

/// Centre of the leash knot block position, as used by rope endpoints.
#[wasm_bindgen]
pub fn leash_knot_center(bx: f64, by: f64, bz: f64) -> Vec<f64> {
    vec![bx.floor() + 0.5, by.floor() + 0.5, bz.floor() + 0.5]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_leash_knot_center() {
        let c = leash_knot_center(10.0, 64.0, -3.0);
        assert_eq!(c, vec![10.5, 64.5, -2.5]);
    }
}
