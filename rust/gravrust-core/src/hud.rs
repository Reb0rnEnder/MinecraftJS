//! Port of `client/js/gui/hud.js`.
//!
//! In-game Heads-Up Display: hotbar, health/armor/food/air bars, XP bar, crosshair,
//! action bar, titles & subtitles with fade-in/stay/fade-out, and heart jiggle RNG.

pub const HUD_ICONS_TEXTURE: &str = "gui/icons.png";
pub const HUD_WIDGETS_TEXTURE: &str = "gui/widgets.png";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HotbarLayout {
    pub hotbar_x: i32,
    pub hotbar_y: i32,
    pub hotbar_w: i32,
    pub hotbar_h: i32,
    pub selected_x: i32,
    pub selected_y: i32,
    pub offhand_x: i32,
    pub offhand_y: i32,
}

pub fn compute_hotbar_layout(screen_width: i32, screen_height: i32, held_slot: usize) -> HotbarLayout {
    let cx = screen_width / 2;
    let hotbar_x = cx - 91;
    let hotbar_y = screen_height - 22;
    let held_clamped = held_slot.min(8) as i32;

    HotbarLayout {
        hotbar_x,
        hotbar_y,
        hotbar_w: 182,
        hotbar_h: 22,
        selected_x: hotbar_x + held_clamped * 20 - 1,
        selected_y: hotbar_y - 1,
        offhand_x: hotbar_x - 29,
        offhand_y: screen_height - 23,
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StatusBarsLayout {
    pub health_x: i32,
    pub health_y: i32,
    pub armor_x: i32,
    pub armor_y: i32,
    pub food_x: i32,
    pub food_y: i32,
    pub air_x: i32,
    pub air_y: i32,
    pub exp_x: i32,
    pub exp_y: i32,
}

pub fn compute_status_bars_layout(screen_width: i32, screen_height: i32) -> StatusBarsLayout {
    let cx = screen_width / 2;
    StatusBarsLayout {
        health_x: cx - 91,
        health_y: screen_height - 39,
        armor_x: cx - 91,
        armor_y: screen_height - 49,
        food_x: cx + 82, // right-aligned / drawn backwards
        food_y: screen_height - 39,
        air_x: cx + 82,
        air_y: screen_height - 49,
        exp_x: cx - 91,
        exp_y: screen_height - 29,
    }
}

/// JS: Java Random-ish deterministic RNG for heart jiggle
pub fn heart_jiggle_offset(update_counter: u32, heart_index: u32, health: f32) -> i32 {
    if health > 4.0 {
        return 0;
    }
    let mut s = (update_counter.wrapping_mul(312871).wrapping_add(heart_index.wrapping_mul(1103515245)).wrapping_add(12345)) as u32;
    s = s.wrapping_mul(1103515245).wrapping_add(12345);
    let r = (s >> 16) % 3;
    r as i32 - 1
}

/// Title fade alpha (0.0 to 1.0) given current ticks and fadeIn/stay/fadeOut parameters.
pub fn title_alpha(ticks_remaining: i32, fade_in: i32, stay: i32, fade_out: i32) -> f32 {
    let total = fade_in + stay + fade_out;
    let elapsed = total - ticks_remaining;
    if elapsed < fade_in {
        (elapsed as f32) / (fade_in as f32).max(1.0)
    } else if elapsed < fade_in + stay {
        1.0
    } else if elapsed < total {
        let out_elapsed = elapsed - (fade_in + stay);
        (1.0 - (out_elapsed as f32) / (fade_out as f32).max(1.0)).max(0.0)
    } else {
        0.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hotbar_layout() {
        let l = compute_hotbar_layout(800, 600, 3);
        assert_eq!(l.hotbar_x, 400 - 91);
        assert_eq!(l.hotbar_y, 578);
        assert_eq!(l.selected_x, 400 - 91 + 60 - 1);
    }

    #[test]
    fn test_status_bars_layout() {
        let l = compute_status_bars_layout(800, 600);
        assert_eq!(l.health_x, 400 - 91);
        assert_eq!(l.health_y, 561);
        assert_eq!(l.exp_y, 571);
    }

    #[test]
    fn test_title_alpha() {
        // fade_in = 10, stay = 70, fade_out = 20 (total 100)
        // At start (100 remaining, 0 elapsed) -> 0.0
        assert_eq!(title_alpha(100, 10, 70, 20), 0.0);
        // Halfway through fade-in (95 remaining, 5 elapsed) -> 0.5
        assert_eq!(title_alpha(95, 10, 70, 20), 0.5);
        // During stay (50 remaining, 50 elapsed) -> 1.0
        assert_eq!(title_alpha(50, 10, 70, 20), 1.0);
        // Halfway through fade-out (10 remaining, 90 elapsed) -> 0.5
        assert_eq!(title_alpha(10, 10, 70, 20), 0.5);
    }
}
