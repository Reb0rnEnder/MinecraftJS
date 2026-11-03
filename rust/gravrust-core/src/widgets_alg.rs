//! Widget algorithm layer - hit testing, drag mapping, cursor blink

pub fn slider_value_from_x(slider: &Slider, mx: i32) -> f64 {
    let rel = (mx - slider.x) as f64 / slider.width as f64;
    slider.min + rel.clamp(0.0, 1.0) * (slider.max - slider.min)
}

pub fn textfield_cursor_blink(time: f64) -> bool {
    (time * 2.0) as i32 % 2 == 0
}
