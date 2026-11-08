//! Port of `client/js/gui/screens/stats.js`.
//!
//! Re-exports statistic tracking from `statistics` and provides statistics screen
//! category tabs (General, Items, Mobs).

pub use crate::statistics::*;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatsTab {
    General,
    Items,
    Mobs,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StatsLayout {
    pub tab_general_x: i32,
    pub tab_items_x: i32,
    pub tab_mobs_x: i32,
    pub tab_y: i32,
    pub tab_width: i32,
    pub tab_height: i32,
    pub done_btn_x: i32,
    pub done_btn_y: i32,
    pub done_btn_width: i32,
    pub done_btn_height: i32,
}

pub fn compute_stats_layout(screen_width: i32, screen_height: i32) -> StatsLayout {
    let cx = screen_width / 2;
    StatsLayout {
        tab_general_x: cx - 120,
        tab_items_x: cx - 40,
        tab_mobs_x: cx + 40,
        tab_y: 10,
        tab_width: 80,
        tab_height: 20,
        done_btn_x: cx - 100,
        done_btn_y: screen_height - 28,
        done_btn_width: 200,
        done_btn_height: 20,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stats_layout() {
        let l = compute_stats_layout(800, 600);
        assert_eq!(l.done_btn_x, 300);
        assert_eq!(l.done_btn_y, 572);
        assert_eq!(l.done_btn_width, 200);
    }
}
