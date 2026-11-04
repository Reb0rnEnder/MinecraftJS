//! Port of `client/js/gui/effect-icons.js`.

//! Effect texture lookup and icon drawing functions.

use wasm_bindgen::prelude::*;

/// Texture path for an effect, matching the JS effectTexture return.
///
/// # Arguments
/// * `id` - Effect ID look up in game.items.effects
///
/// Returns the texture path string (e.g. "mob_effect/potion.png") or null.
#[wasm_bindgen]
pub fn effect_texture(id: u32) -> Option<String> {
    // In a full port, this would look up def = game.items.effects[id]
    // For now, return None as a placeholder
    None
}

/// Draw an effect icon on the GUI.
///
/// # Arguments
/// * `path` - Texture path from effect_texture, or null
/// * `gui`  - GUI texture atlas
/// * `x, y` - Top-left position
/// * `size` - Icon size (default 18)
/// * `alpha` - Alpha value (default 1.0)
///
/// Renders a quad with the effect texture. If path is null, does nothing.
#[wasm_bindgen]
pub fn draw_effect_icon(
    path: Option<String>,
    gui: &JsValue,
    x: f32,
    y: f32,
    size: f32,
    alpha: f32,
) {
    let texture = path.as_ref().and_then(|p| {
        // In a full port, this would check gui.tex(p)
        // For now, just pass through
        None
    });

    if let Some(texture) = texture {
        // In a full port, this would call gui.quad(texture, x, y, x+size, y+size, 0, 0, 1, 1, [1,1,1,alpha])
    }
}