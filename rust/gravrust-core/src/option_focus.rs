//! Port of `client/js/gui/option-focus.js`.
//!
//! Native ContainerObjectSelectionList: Tab visits widgets inside each row and
//! scrolls the focused row into view, skipping category headings and disabled resets.

/// State of a focusable widget candidate.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FocusableWidget {
    pub id: usize,
    pub visible: bool,
    pub enabled: bool,
    pub focused: bool,
    pub option_row: Option<i32>,
}

/// Computes the next focused widget index on Tab / Shift+Tab.
/// Returns Some(next_index) if focus changed, or None if not applicable.
pub fn next_focus_index(
    widgets: &[FocusableWidget],
    current_focus: Option<usize>,
    shift: bool,
) -> Option<usize> {
    if !widgets.iter().any(|b| b.visible && b.enabled) {
        return None;
    }
    let step = if shift { -1isize } else { 1isize };
    let mut index = match current_focus {
        Some(curr) => curr as isize,
        None => if shift { 0 } else { -1 },
    };

    let len = widgets.len() as isize;
    loop {
        index = (index + step + len) % len;
        let w = &widgets[index as usize];
        if w.visible && w.enabled {
            return Some(index as usize);
        }
    }
}

/// Computes scroll adjustments for keeping the focused option row in view.
pub fn compute_row_scroll_delta(
    slot_top: i32,
    slot_height: i32,
    list_top: i32,
    list_bottom: i32,
) -> i32 {
    let mut scroll_adjustment = 0;
    let delta_top = slot_top - list_top - 4 - slot_height;
    if delta_top < 0 {
        scroll_adjustment += delta_top;
    }
    let current_top = slot_top + scroll_adjustment;
    let delta_bottom = list_bottom - current_top - slot_height * 2;
    if delta_bottom < 0 {
        scroll_adjustment -= delta_bottom;
    }
    scroll_adjustment
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_next_focus_tab_forward() {
        let widgets = vec![
            FocusableWidget { id: 0, visible: true, enabled: true, focused: false, option_row: None },
            FocusableWidget { id: 1, visible: false, enabled: true, focused: false, option_row: None },
            FocusableWidget { id: 2, visible: true, enabled: true, focused: false, option_row: None },
        ];
        let next = next_focus_index(&widgets, Some(0), false);
        // Should skip id 1 (not visible) and focus id 2
        assert_eq!(next, Some(2));
    }

    #[test]
    fn test_next_focus_shift_tab() {
        let widgets = vec![
            FocusableWidget { id: 0, visible: true, enabled: true, focused: false, option_row: None },
            FocusableWidget { id: 1, visible: true, enabled: true, focused: false, option_row: None },
        ];
        let next = next_focus_index(&widgets, Some(0), true);
        assert_eq!(next, Some(1));
    }
}
