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
pub fn key_name(code: &str) -> String {
    // JS: `if(!code)return tr('key.keyboard.unknown');`
    if code.is_empty() {
        return crate::i18n::tr("key.keyboard.unknown");
    }
    if code.starts_with("mouse") {
        // JS: `const n=Number(code.slice(5)),name=['left','middle','right'][n]||String(n+1);`
        let n: usize = code[5..].parse().unwrap_or(usize::MAX);
        let name = match ["left", "middle", "right"].get(n) {
            Some(s) => s.to_string(),
            None => (n.wrapping_add(1)).to_string(),
        };
        // JS: `return n < 3 ? tr('key.mouse.'+name) : tr('key.mouse', n+1);`
        if n < 3 {
            return crate::i18n::tr(&format!("key.mouse.{}", name));
        }
        return crate::i18n::tr_args("key.mouse", &[(n.wrapping_add(1)).to_string()]);
    }
    // GLFW supplies printable key names directly; the language file has no a-z/0-9 entries.
    // JS: `if(/^Key[A-Z]$/.test(code))return code.slice(3).toLowerCase();` (raw, not tr'd)
    if code.len() == 4 && code.starts_with("Key") {
        return code[3..].to_lowercase();
    }
    // JS: `if(/^Digit[0-9]$/.test(code))return code.slice(5);` (raw)
    if code.len() == 6 && code.starts_with("Digit") {
        return code[5..].to_string();
    }
    // JS: `const name=NAMES[code] || (/^Numpad[0-9]$/.test(code)?'keypad.'+code.slice(6)
    //        :/^F\d+$/.test(code)?code.toLowerCase():null);`
    let name = match NAMES.get(code) {
        Some(n) => Some(n.to_string()),
        None => {
            if code.len() == 7 && code.starts_with("Numpad") {
                Some(format!("keypad.{}", &code[6..]))
            } else if code.len() > 1 && code.starts_with('F') && code[1..].chars().all(|c| c.is_ascii_digit()) {
                Some(code.to_lowercase())
            } else {
                None
            }
        }
    };
    // JS: `return name?tr('key.keyboard.'+name):code;`
    match name {
        Some(n) => crate::i18n::tr(&format!("key.keyboard.{}", n)),
        None => code.to_string(),
    }
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
