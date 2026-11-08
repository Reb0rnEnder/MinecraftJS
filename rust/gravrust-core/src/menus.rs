//! Port of `client/js/gui/screens/menus.js`.
//!
//! Title screen, multiplayer server list, direct connect, and disconnected screens.
//! Includes Minceraft 1/10000 title easter egg and seasonal holiday splash overrides.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct TitleScreenLayout {
    pub singleplayer_btn: (i32, i32, i32, i32),
    pub multiplayer_btn: (i32, i32, i32, i32),
    pub realms_btn: (i32, i32, i32, i32),
    pub options_btn: (i32, i32, i32, i32),
    pub quit_btn: (i32, i32, i32, i32),
    pub language_btn: (i32, i32, i32, i32),
    pub accessibility_btn: (i32, i32, i32, i32),
}

pub fn compute_title_layout(screen_width: i32, screen_height: i32) -> TitleScreenLayout {
    let cx = screen_width / 2;
    let y = screen_height / 4 + 48;

    TitleScreenLayout {
        singleplayer_btn: (cx - 100, y, 200, 20),
        multiplayer_btn: (cx - 100, y + 24, 200, 20),
        realms_btn: (cx - 100, y + 48, 200, 20),
        options_btn: (cx - 100, y + 84, 98, 20),
        quit_btn: (cx + 2, y + 84, 98, 20),
        language_btn: (cx - 124, y + 84, 20, 20),
        accessibility_btn: (cx + 104, y + 84, 20, 20),
    }
}

/// JS: `this.minceraftRoll = Math.random();` — 1 in 10,000 chance for "Minceraft".
pub fn is_minceraft_roll(roll: f64) -> bool {
    roll < 1.0e-4
}

/// Seasonal holiday splash text check (Dec 24 / Jan 1).
pub fn seasonal_splash(month_0_indexed: u32, day_of_month: u32) -> Option<&'static str> {
    if month_0_indexed == 11 && day_of_month == 24 {
        Some("Merry X-mas!")
    } else if month_0_indexed == 0 && day_of_month == 1 {
        Some("Happy new year!")
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_title_layout() {
        let l = compute_title_layout(800, 600);
        assert_eq!(l.singleplayer_btn.0, 300);
        assert_eq!(l.singleplayer_btn.2, 200);
        assert_eq!(l.language_btn.0, 400 - 124);
        assert_eq!(l.accessibility_btn.0, 400 + 104);
    }

    #[test]
    fn test_seasonal_splash() {
        assert_eq!(seasonal_splash(11, 24), Some("Merry X-mas!"));
        assert_eq!(seasonal_splash(0, 1), Some("Happy new year!"));
        assert_eq!(seasonal_splash(5, 15), None);
    }

    #[test]
    fn test_minceraft() {
        assert!(is_minceraft_roll(0.00005));
        assert!(!is_minceraft_roll(0.5));
    }
}
