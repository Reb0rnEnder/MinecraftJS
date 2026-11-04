//! Port of `client/js/gui/widgets.js` — pure geometry, hit-testing and slider
//! value mapping helpers (the `Button` / `Slider` / `TextField` math that does
//! not touch the drawing device).
//!
//! Everything here is a hand-checked transcription of one JS expression; the
//! widget structs in [`crate::widgets`] call these. Slider value<->position
//! mapping and step quantization use `js_min`/`js_max` because JS `Math.min`
//! /`Math.max` propagate NaN (unlike `f64::min`/`f64::max`), which matters for
//! degenerate slider widths.
//!
//! JS source: `client/js/gui/widgets.js` (all functions below quote the exact
//! line they port).

// ------------------------------------------------------------ JS number semantics

/// JS: `Math.max(a, b)` — NaN when either argument is NaN (`f64::max` returns
/// the other operand instead).
pub fn js_max(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a > b {
        a
    } else {
        b
    }
}

/// JS: `Math.min(a, b)` — NaN when either argument is NaN.
pub fn js_min(a: f64, b: f64) -> f64 {
    if a.is_nan() || b.is_nan() {
        f64::NAN
    } else if a < b {
        a
    } else {
        b
    }
}

// ------------------------------------------------------------ hit testing

/// JS: `Button.hovered(mx, my)` —
/// `return mx >= this.x && my >= this.y && mx < this.x + this.w && my < this.y + this.h;`
///
/// Half-open rectangle: the right/bottom edges are excluded.
pub fn button_hovered(mx: f64, my: f64, x: f64, y: f64, w: f64, h: f64) -> bool {
    mx >= x && my >= y && mx < x + w && my < y + h
}

/// JS: `TextField.mouseDown(mx, my, gui)` —
/// `const inside = mx >= this.x && mx < this.x + this.w && my >= this.y && my < this.y + this.h;`
///
/// Same half-open rectangle as [`button_hovered`], duplicated in the JS too.
pub fn text_field_hit(mx: f64, my: f64, x: f64, y: f64, w: f64, h: f64) -> bool {
    mx >= x && my >= y && mx < x + w && my < y + h
}

/// JS: `Button.render(gui, mx, my)` — the `hovered` argument of
/// `gui.button(...)`: `this.enabled && (this.focused||this.hovered(mx, my))`.
pub fn button_hover_state(enabled: bool, focused: bool, hovered: bool) -> bool {
    enabled && (focused || hovered)
}

// ------------------------------------------------------------ slider mapping

/// JS: `Slider.render(gui, mx, my)` —
/// `const kx = this.x + Math.floor(this.value * (this.w - 8));`
///
/// Thumb left edge (the thumb is drawn as two 4 px halves at `kx` / `kx + 4`).
pub fn slider_thumb_x(x: f64, value: f64, w: f64) -> f64 {
    x + (value * (w - 8.0)).floor()
}

/// JS: `Slider._set(mx)` —
/// `let v = (mx - (this.x + 4)) / (this.w - 8); v = Math.min(1, Math.max(0, v));`
///
/// Mouse X -> value in [0, 1] (NaN in, NaN out, like JS).
pub fn slider_value_at(mx: f64, x: f64, w: f64) -> f64 {
    let v = (mx - (x + 4.0)) / (w - 8.0);
    js_min(1.0, js_max(0.0, v))
}

/// JS: `Slider.key(e, game)` —
/// `const value = Math.max(0, Math.min(1, this.value + (e.code === 'ArrowRight' ? 1 : -1) / (this.w - 8)));`
///
/// `dir` is +1 for ArrowRight, -1 for ArrowLeft (see
/// [`crate::widgets_alg3::slider_key_dir`]).
pub fn slider_key_value(dir: i32, value: f64, w: f64) -> f64 {
    js_max(0.0, js_min(1.0, value + dir as f64 / (w - 8.0)))
}

// ------------------------------------------------------------ text field layout

/// JS: `TextField.render(gui)` —
/// `const innerW = this.drawBackground ? this.w - 8 : this.w;`
pub fn text_field_inner_width(w: f64, draw_background: bool) -> f64 {
    if draw_background {
        w - 8.0
    } else {
        w
    }
}

/// JS: `TextField.render(gui)` —
/// `const tx = this.drawBackground ? this.x + 4 : this.x;`
/// `const ty = this.drawBackground ? this.y + (this.h - 8) / 2 : this.y;`
///
/// Returns `(tx, ty)`. `ty` is fractional for odd inner heights (e.g. the
/// 9 px sign fields land on `y + 0.5`).
pub fn text_field_origin(x: f64, y: f64, h: f64, draw_background: bool) -> (f64, f64) {
    if draw_background {
        (x + 4.0, y + (h - 8.0) / 2.0)
    } else {
        (x, y)
    }
}

/// JS: `TextField.render(gui)` —
/// `const color = this.enabled ? this.textColor : 0x707070;`
pub fn text_field_text_color(enabled: bool, text_color: u32) -> u32 {
    if enabled {
        text_color
    } else {
        0x707070
    }
}

/// JS: `TextField.render(gui)` —
/// `this.focused && Math.floor(this.cursorCounter / 6) % 2 === 0`
///
/// The cursor blinks on for 6 ticks, off for 6.
pub fn cursor_blink_on(cursor_counter: u64) -> bool {
    (cursor_counter / 6) % 2 == 0
}

// ------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn button_hover_is_half_open() {
        // Button at (100, 50), 200x20 -> spans [100,300) x [50,70).
        assert!(button_hovered(150.0, 60.0, 100.0, 50.0, 200.0, 20.0));
        assert!(button_hovered(100.0, 50.0, 100.0, 50.0, 200.0, 20.0)); // top-left corner included
        assert!(button_hovered(299.999, 69.999, 100.0, 50.0, 200.0, 20.0));
        assert!(!button_hovered(300.0, 60.0, 100.0, 50.0, 200.0, 20.0)); // right edge excluded
        assert!(!button_hovered(150.0, 70.0, 100.0, 50.0, 200.0, 20.0)); // bottom edge excluded
        assert!(!button_hovered(99.999, 50.0, 100.0, 50.0, 200.0, 20.0)); // left of x
        assert!(!button_hovered(150.0, 49.999, 100.0, 50.0, 200.0, 20.0)); // above y
    }

    #[test]
    fn text_field_hit_matches_button_bounds() {
        assert!(text_field_hit(10.0, 20.0, 10.0, 20.0, 200.0, 20.0));
        assert!(!text_field_hit(210.0, 20.0, 10.0, 20.0, 200.0, 20.0));
    }

    #[test]
    fn hover_state_needs_enabled_and_hover_or_focus() {
        assert!(!button_hover_state(true, false, false));
        assert!(button_hover_state(true, true, false));
        assert!(button_hover_state(true, false, true));
        assert!(!button_hover_state(false, true, true));
    }

    #[test]
    fn thumb_x_is_floored_value_times_track() {
        // 0.5 * (200 - 8) = 96 exactly.
        assert_eq!(slider_thumb_x(100.0, 0.5, 200.0), 196.0);
        assert_eq!(slider_thumb_x(100.0, 0.0, 200.0), 100.0);
        assert_eq!(slider_thumb_x(100.0, 1.0, 200.0), 292.0);
        // Fractional case from a 201 px slider: floor(96.5) = 96.
        assert_eq!(slider_thumb_x(100.0, 0.5, 201.0), 196.0);
        // 12 px slider: 0.25 * 4 = 1.
        assert_eq!(slider_thumb_x(0.0, 0.25, 12.0), 1.0);
    }

    #[test]
    fn value_at_maps_track_plus_4px_thumb_inset() {
        // Track [x+4, x+w-4] maps to [0, 1].
        assert_eq!(slider_value_at(104.0, 100.0, 200.0), 0.0);
        assert_eq!(slider_value_at(296.0, 100.0, 200.0), 1.0);
        assert_eq!(slider_value_at(200.0, 100.0, 200.0), 0.5); // (200-104)/192
        assert_eq!(slider_value_at(250.0, 100.0, 200.0), 146.0 / 192.0);
        // Clamping outside the track.
        assert_eq!(slider_value_at(0.0, 100.0, 200.0), 0.0);
        assert_eq!(slider_value_at(1000.0, 100.0, 200.0), 1.0);
    }

    #[test]
    fn key_step_is_one_divided_by_track_width() {
        // w = 200 -> step 1/192.
        assert_eq!(slider_key_value(1, 0.5, 200.0), 0.5 + 1.0 / 192.0);
        assert_eq!(slider_key_value(-1, 0.5, 200.0), 0.5 - 1.0 / 192.0);
        // Clamped at both ends.
        assert_eq!(slider_key_value(1, 1.0, 200.0), 1.0);
        assert_eq!(slider_key_value(-1, 0.0, 200.0), 0.0);
        assert_eq!(slider_key_value(1, 0.0, 200.0), 1.0 / 192.0);
    }

    #[test]
    fn js_min_max_propagate_nan_like_js() {
        assert!(js_max(0.0, f64::NAN).is_nan());
        assert!(js_min(1.0, f64::NAN).is_nan());
        assert_eq!(js_max(0.0, f64::INFINITY), f64::INFINITY);
        assert_eq!(js_min(1.0, f64::INFINITY), 1.0);
        assert_eq!(js_max(0.0, f64::NEG_INFINITY), 0.0);
        assert!(slider_value_at(f64::NAN, 100.0, 200.0).is_nan());
    }

    #[test]
    fn text_field_layout_maths() {
        assert_eq!(text_field_inner_width(200.0, true), 192.0);
        assert_eq!(text_field_inner_width(200.0, false), 200.0);
        assert_eq!(text_field_origin(10.0, 20.0, 20.0, true), (14.0, 26.0));
        // 9 px sign field: fractional y.
        assert_eq!(text_field_origin(0.0, 76.0, 9.0, true), (4.0, 76.5));
        assert_eq!(text_field_origin(10.0, 20.0, 20.0, false), (10.0, 20.0));
        assert_eq!(text_field_text_color(true, 0xe0e0e0), 0xe0e0e0);
        assert_eq!(text_field_text_color(false, 0xe0e0e0), 0x707070);
    }

    #[test]
    fn cursor_blinks_every_six_ticks() {
        assert!(cursor_blink_on(0));
        assert!(cursor_blink_on(5)); // floor(5/6) = 0
        assert!(!cursor_blink_on(6));
        assert!(!cursor_blink_on(11)); // floor(11/6) = 1
        assert!(cursor_blink_on(12)); // floor(12/6) = 2
        assert!(!cursor_blink_on(18));
        assert!(cursor_blink_on(17)); // floor(17/6) = 2
    }
}
