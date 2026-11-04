// Port of `client/js/game/key-names.js`.

/// Map of GLFW/KeyboardEvent key codes to their translated names.
/// Ported from the JS NAMES constant.
static NAMES: phf::Map<&'static str, &'static str> = phf::phf_map! {
    "ShiftLeft" => "left.shift",
    "ShiftRight" => "right.shift",
    "ControlLeft" => "left.control",
    "ControlRight" => "right.control",
    "AltLeft" => "left.alt",
    "AltRight" => "right.alt",
    "MetaLeft" => "left.win",
    "MetaRight" => "right.win",
    "Space" => "space",
    "Tab" => "tab",
    "Enter" => "enter",
    "Escape" => "escape",
    "Backspace" => "backspace",
    "Delete" => "delete",
    "Insert" => "insert",
    "Home" => "home",
    "End" => "end",
    "PageUp" => "page.up",
    "PageDown" => "page.down",
    "CapsLock" => "caps.lock",
    "NumLock" => "num.lock",
    "ScrollLock" => "scroll.lock",
    "ArrowUp" => "up",
    "ArrowDown" => "down",
    "ArrowLeft" => "left",
    "ArrowRight" => "right",
    "Pause" => "pause",
    "PrintScreen" => "print.screen",
    "Slash" => "slash",
    "Backslash" => "backslash",
    "Backquote" => "grave.accent",
    "Minus" => "minus",
    "Equal" => "equal",
    "BracketLeft" => "left.bracket",
    "BracketRight" => "right.bracket",
    "Semicolon" => "semicolon",
    "Quote" => "apostrophe",
    "Comma" => "comma",
    "Period" => "period",
    "NumpadAdd" => "keypad.add",
    "NumpadSubtract" => "keypad.subtract",
    "NumpadMultiply" => "keypad.multiply",
    "NumpadDivide" => "keypad.divide",
    "NumpadDecimal" => "keypad.decimal",
    "NumpadEnter" => "keypad.enter",
    "NumpadEqual" => "keypad.equal",
};

/// Port of the `keyName` function from `client/js/game/key-names.js`.
/// Translates a key code string into a human-readable name.
pub fn key_name(code: &str) -> &str {
    if code.starts_with("mouse") {
        let n = match code[5..].parse::<usize>() {
            Ok(n) => n,
            Err(_) => return code,
        };
        let name = ["left", "middle", "right"].get(n).unwrap_or(&(n + 1).to_string());
        if n < 3 {
            return &format!("key.mouse.{}", name);
        }
        return &format!("key.mouse", n + 1);
    }
    // GLFW supplies printable key names directly; the language file has no a-z/0-9 entries.
    if code.starts_with("Key") && code.len() > 3 {
        return &code[3..].to_lowercase();
    }
    if code.starts_with("Digit") && code.len() > 5 {
        return &code[5..];
    }
    let name = NAMES.get(code);
    if let Some(n) = name {
        return n;
    }
    if code.starts_with("Numpad") && code.len() > 6 {
        return &format!("keypad.{}", &code[6..]);
    }
    if code.starts_with("F") && code.len() > 1 {
        return &code.to_lowercase();
    }
    code
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_key_names() {
        assert_eq!(key_name("w"), "w");
        assert_eq!(key_name("KeyW"), "w");
        assert_eq!(key_name("Space"), "space");
        assert_eq!(key_name("ShiftLeft"), "left.shift");
        assert_eq!(key_name("ControlLeft"), "left.control");
        assert_eq!(key_name("ArrowUp"), "up");
        assert_eq!(key_name("NumpadAdd"), "keypad.add");
        assert_eq!(key_name("F1"), "f1");
        assert_eq!(key_name("Digit5"), "5");
        assert_eq!(key_name("mouse0"), "key.mouse.1");
        assert_eq!(key_name("mouse2"), "key.mouse.3");
    }
}