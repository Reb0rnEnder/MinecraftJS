//! Port of `client/js/gui/screens/sign.js`.
//!
//! GuiEditSign: interactive 4-line sign text editor, line switching,
//! and board preview layout.

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SignEditState {
    pub x: i32,
    pub y: i32,
    pub z: i32,
    pub lines: [String; 4],
    pub current_line: usize,
    pub counter: u64,
}

impl SignEditState {
    pub fn new(x: i32, y: i32, z: i32, existing: Option<[String; 4]>) -> Self {
        Self {
            x,
            y,
            z,
            lines: existing.unwrap_or_else(|| [
                String::new(),
                String::new(),
                String::new(),
                String::new(),
            ]),
            current_line: 0,
            counter: 0,
        }
    }

    pub fn tick(&mut self) {
        self.counter += 1;
    }

    pub fn prev_line(&mut self) {
        self.current_line = (self.current_line + 3) % 4;
    }

    pub fn next_line(&mut self) {
        self.current_line = (self.current_line + 1) % 4;
    }

    pub fn set_line(&mut self, idx: usize, text: &str) {
        if idx < 4 {
            self.lines[idx] = text.chars().take(384).collect();
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SignPreviewLayout {
    pub board_x: i32,
    pub board_y: i32,
    pub board_w: i32,
    pub board_h: i32,
    pub done_btn_x: i32,
    pub done_btn_y: i32,
    pub done_btn_w: i32,
    pub done_btn_h: i32,
}

pub fn compute_sign_layout(screen_width: i32, screen_height: i32) -> SignPreviewLayout {
    let cx = screen_width / 2;
    let w = 104;
    let h = 56;
    let x0 = cx - w / 2;
    let y0 = 70;

    SignPreviewLayout {
        board_x: x0,
        board_y: y0,
        board_w: w,
        board_h: h,
        done_btn_x: cx - 100,
        done_btn_y: screen_height / 4 + 120,
        done_btn_w: 200,
        done_btn_h: 20,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sign_line_cycling() {
        let mut sign = SignEditState::new(0, 64, 0, None);
        assert_eq!(sign.current_line, 0);
        sign.next_line();
        assert_eq!(sign.current_line, 1);
        sign.prev_line();
        assert_eq!(sign.current_line, 0);
        sign.prev_line();
        assert_eq!(sign.current_line, 3);
    }
}
