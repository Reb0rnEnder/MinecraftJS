//! Port of `client/js/gui/screens/shader-tooltip.js`.
//!
//! OptiFine 1.15.2 G6 TooltipManager / TooltipProviderOptions coordinates.
//! Handles hover delay (700ms), description line wrapping, box positioning, and color highlights.

#[derive(Debug, Clone, Copy)]
pub struct TooltipMouseState {
    pub x: f64,
    pub y: f64,
    pub time_ms: f64,
}

/// Checks mouse movement threshold (> 5px) to reset hover delay timer.
pub fn update_tooltip_mouse(
    current_state: Option<TooltipMouseState>,
    mx: f64,
    my: f64,
    now_ms: f64,
) -> (TooltipMouseState, bool) {
    match current_state {
        None => (TooltipMouseState { x: mx, y: my, time_ms: now_ms }, false),
        Some(last) => {
            if (mx - last.x).abs() > 5.0 || (my - last.y).abs() > 5.0 {
                (TooltipMouseState { x: mx, y: my, time_ms: now_ms }, false)
            } else {
                let ready = now_ms - last.time_ms >= 700.0;
                (last, ready)
            }
        }
    }
}

/// Splits and formats raw shader option descriptions into bulleted lines.
pub fn format_shader_description(label: &str, description: &str) -> Vec<String> {
    let mut lines = Vec::new();
    if !label.is_empty() {
        lines.push(label.to_string());
    }
    let cleaned = description.trim_start_matches("//").trim();
    for sentence in cleaned.split(". ") {
        let s = sentence.trim();
        if !s.is_empty() {
            let bullet = format!("- {}", s.trim_end_matches('.'));
            lines.push(bullet);
        }
    }
    lines
}

/// Calculates tooltip box geometry: (x, y, width = 300, height = 94).
pub fn tooltip_layout(screen_width: f64, screen_height: f64, my: f64) -> (i32, i32, i32, i32) {
    let x = (screen_width / 2.0).floor() as i32 - 150;
    let mut y = (screen_height / 6.0).floor() as i32 - 7;
    if my <= (y + 98) as f64 {
        y += 105;
    }
    (x, y, 300, 94)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_update_tooltip_mouse_timer() {
        let state = TooltipMouseState { x: 100.0, y: 100.0, time_ms: 1000.0 };
        // Mouse moved slightly (within 5px), 600ms elapsed -> not ready
        let (s2, ready) = update_tooltip_mouse(Some(state), 102.0, 101.0, 1600.0);
        assert!(!ready);
        assert_eq!(s2.time_ms, 1000.0);

        // 800ms elapsed -> ready
        let (_, ready) = update_tooltip_mouse(Some(state), 102.0, 101.0, 1800.0);
        assert!(ready);

        // Mouse moved > 5px -> reset timer
        let (s3, ready) = update_tooltip_mouse(Some(state), 120.0, 100.0, 1800.0);
        assert!(!ready);
        assert_eq!(s3.time_ms, 1800.0);
    }

    #[test]
    fn test_format_shader_description() {
        let lines = format_shader_description("Shadows", "// Enables dynamic shadows. High performance impact.");
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "Shadows");
        assert_eq!(lines[1], "- Enables dynamic shadows");
        assert_eq!(lines[2], "- High performance impact");
    }

    #[test]
    fn test_tooltip_layout() {
        let (x, y, w, h) = tooltip_layout(800.0, 600.0, 200.0);
        assert_eq!(x, 250);
        assert_eq!(w, 300);
        assert_eq!(h, 94);
        assert!(y > 0);
    }
}
