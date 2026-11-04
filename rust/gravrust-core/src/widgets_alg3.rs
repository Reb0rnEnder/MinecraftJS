//! Port of `client/js/gui/widgets.js` — keyboard event classification shared by
//! `Button.key`, `Slider.key` and `TextField.key`.
//!
//! The JS widgets receive the platform keydown payload `{ code, ctrl, shift }`
//! (KeyboardEvent.code names; see `client/js/platform/platform.js` and its port
//! `platform_contract::KeydownEvent`). This module models that shape as
//! [`WidgetKeyEvent`] (kept local so the widget port does not depend on another
//! module's file) and turns the `TextField.key` switch + ctrl chords into a
//! typed action.
//!
//! JS source: `client/js/gui/widgets.js`.

/// JS keydown payload reaching the widget `key(e)` methods.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct WidgetKeyEvent {
    /// JS: `e.code` — KeyboardEvent.code names ('Enter', 'KeyA', 'ArrowLeft', …).
    pub code: String,
    /// JS: `e.ctrl`.
    pub ctrl: bool,
    /// JS: `e.shift`.
    pub shift: bool,
}

impl WidgetKeyEvent {
    pub fn new(code: &str, ctrl: bool, shift: bool) -> Self {
        WidgetKeyEvent { code: code.to_string(), ctrl, shift }
    }
}

// ------------------------------------------------------------ button / slider keys

/// JS: `Button.key(e, game)` —
/// `['Enter','NumpadEnter','Space'].includes(e.code)`
pub fn button_key_activates(code: &str) -> bool {
    matches!(code, "Enter" | "NumpadEnter" | "Space")
}

/// JS: `Slider.key(e, game)` —
/// `['ArrowLeft','ArrowRight'].includes(e.code)`; +1 for ArrowRight, -1 for
/// ArrowLeft, `None` for anything else.
pub fn slider_key_dir(code: &str) -> Option<i32> {
    match code {
        "ArrowRight" => Some(1),
        "ArrowLeft" => Some(-1),
        _ => None,
    }
}

// ------------------------------------------------------------ text field keys

/// JS: `TextField.key(e)` dispatch — ctrl chords first, then the code switch.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextFieldKeyAction {
    /// JS: `e.ctrl && e.code === 'KeyA'` — select all (`cursor = length`, `selEnd = 0`).
    SelectAll,
    /// JS: `e.ctrl && e.code === 'KeyC'` — copy selection to the clipboard.
    Copy,
    /// JS: `e.ctrl && e.code === 'KeyX'` — copy selection, then `insert('')`.
    Cut,
    /// JS: `e.ctrl && e.code === 'KeyV'` — returns true; insertion arrives
    /// through the paste event as a `char`.
    Paste,
    /// JS: `case 'Backspace'` — `word` selects to the previous word boundary (ctrl).
    Backspace { word: bool },
    /// JS: `case 'Delete'` — `word` selects to the next word boundary (ctrl).
    Delete { word: bool },
    /// JS: `case 'Home'`.
    Home,
    /// JS: `case 'End'`.
    End,
    /// JS: `case 'ArrowLeft'` — `word` = ctrl (word boundary jump).
    Left { word: bool },
    /// JS: `case 'ArrowRight'` — `word` = ctrl.
    Right { word: bool },
    /// JS: `case 'Enter': case 'NumpadEnter'`.
    Enter,
    /// JS: `default: return false` — the key is not consumed.
    Ignored,
}

/// JS: `TextField.key(e)` — ctrl chords (`e.ctrl && e.code === 'KeyA'` and
/// friends) take precedence over the switch; `Home`/`End`/`Enter` ignore ctrl;
/// `Backspace`/`Delete`/arrows use ctrl as the word-motion flag.
pub fn text_field_action(e: &WidgetKeyEvent) -> TextFieldKeyAction {
    if e.ctrl {
        match e.code.as_str() {
            "KeyA" => return TextFieldKeyAction::SelectAll,
            "KeyC" => return TextFieldKeyAction::Copy,
            "KeyX" => return TextFieldKeyAction::Cut,
            "KeyV" => return TextFieldKeyAction::Paste,
            _ => {}
        }
    }
    match e.code.as_str() {
        "Backspace" => TextFieldKeyAction::Backspace { word: e.ctrl },
        "Delete" => TextFieldKeyAction::Delete { word: e.ctrl },
        "Home" => TextFieldKeyAction::Home,
        "End" => TextFieldKeyAction::End,
        "ArrowLeft" => TextFieldKeyAction::Left { word: e.ctrl },
        "ArrowRight" => TextFieldKeyAction::Right { word: e.ctrl },
        "Enter" | "NumpadEnter" => TextFieldKeyAction::Enter,
        _ => TextFieldKeyAction::Ignored,
    }
}

// ------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn button_activates_on_enter_variants_and_space() {
        assert!(button_key_activates("Enter"));
        assert!(button_key_activates("NumpadEnter"));
        assert!(button_key_activates("Space"));
        assert!(!button_key_activates("KeyA"));
        assert!(!button_key_activates("Escape"));
        assert!(!button_key_activates("enter")); // case sensitive
    }

    #[test]
    fn slider_arrows_map_to_directions() {
        assert_eq!(slider_key_dir("ArrowRight"), Some(1));
        assert_eq!(slider_key_dir("ArrowLeft"), Some(-1));
        assert_eq!(slider_key_dir("ArrowUp"), None);
        assert_eq!(slider_key_dir("Home"), None);
    }

    #[test]
    fn ctrl_chords_take_precedence_over_the_switch() {
        let e = WidgetKeyEvent::new("KeyA", true, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::SelectAll);
        let e = WidgetKeyEvent::new("KeyC", true, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Copy);
        let e = WidgetKeyEvent::new("KeyX", true, true);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Cut);
        let e = WidgetKeyEvent::new("KeyV", true, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Paste);
        // Without ctrl these fall through to `default`.
        let e = WidgetKeyEvent::new("KeyA", false, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Ignored);
        let e = WidgetKeyEvent::new("KeyC", false, true);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Ignored);
    }

    #[test]
    fn navigation_keys_use_ctrl_as_word_flag() {
        let e = WidgetKeyEvent::new("Backspace", false, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Backspace { word: false });
        let e = WidgetKeyEvent::new("Backspace", true, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Backspace { word: true });
        let e = WidgetKeyEvent::new("Delete", true, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Delete { word: true });
        let e = WidgetKeyEvent::new("ArrowLeft", true, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Left { word: true });
        let e = WidgetKeyEvent::new("ArrowRight", false, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Right { word: false });
    }

    #[test]
    fn home_end_enter_ignore_ctrl() {
        let e = WidgetKeyEvent::new("Home", true, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Home);
        let e = WidgetKeyEvent::new("End", true, true);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::End);
        let e = WidgetKeyEvent::new("Enter", true, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Enter);
        let e = WidgetKeyEvent::new("NumpadEnter", false, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Enter);
        let e = WidgetKeyEvent::new("Tab", false, false);
        assert_eq!(text_field_action(&e), TextFieldKeyAction::Ignored);
    }
}
