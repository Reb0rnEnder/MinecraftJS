//! Port of `client/js/gui/screens/demo.js`.
//!
//! GuiScreenDemo: the demo welcome screen a demo server opens (change game state 5, value 0).

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DemoScreenLayout {
    pub bg_x: i32,
    pub bg_y: i32,
    pub bg_width: i32,
    pub bg_height: i32,
    pub buy_btn_x: i32,
    pub buy_btn_y: i32,
    pub buy_btn_width: i32,
    pub buy_btn_height: i32,
    pub later_btn_x: i32,
    pub later_btn_y: i32,
    pub later_btn_width: i32,
    pub later_btn_height: i32,
    pub text_x: i32,
    pub text_y: i32,
}

pub fn compute_demo_layout(screen_width: i32, screen_height: i32) -> DemoScreenLayout {
    let cx = screen_width / 2;
    let y = screen_height / 2 + 62 - 16;
    let bg_x = (screen_width - 248) / 2;
    let bg_y = (screen_height - 166) / 2;

    DemoScreenLayout {
        bg_x,
        bg_y,
        bg_width: 248,
        bg_height: 166,
        buy_btn_x: cx - 116,
        buy_btn_y: y,
        buy_btn_width: 114,
        buy_btn_height: 20,
        later_btn_x: cx + 2,
        later_btn_y: y,
        later_btn_width: 114,
        later_btn_height: 20,
        text_x: bg_x + 10,
        text_y: bg_y + 8,
    }
}

pub const DEMO_BUY_URL: &str = "http://www.minecraft.net/store?source=demo";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_demo_layout() {
        let layout = compute_demo_layout(800, 600);
        assert_eq!(layout.bg_width, 248);
        assert_eq!(layout.bg_height, 166);
        assert_eq!(layout.bg_x, (800 - 248) / 2);
        assert_eq!(layout.buy_btn_width, 114);
        assert_eq!(layout.later_btn_width, 114);
    }
}
