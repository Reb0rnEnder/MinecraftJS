//! `crate::i18n` — compatibility tree matching `client/js/i18n/`.
//!
//! The JavaScript i18n layer loads the active language file through the asset
//! pipeline and formats `%s`/`%1$s` placeholders. The lookup itself is
//! browser-bound, so this module provides the portable part: a translation
//! table with the same placeholder substitution the JS performs, plus the
//! `tr(key)` entry point the ported modules call.

use std::collections::HashMap;
use std::sync::{LazyLock, RwLock};

/// JS: `translate(key, args)` — substitute `%s` / `%1$s`-style placeholders.
///
/// The JavaScript `i18n.js` supports both the legacy sequential `%s` form and
/// the positional `%1$s` form. Both are handled here in the same order.
pub fn format_translation(template: &str, args: &[String]) -> String {
    let mut out = String::with_capacity(template.len());
    let chars: Vec<char> = template.chars().collect();
    let mut i = 0usize;
    let mut sequential = 0usize;

    while i < chars.len() {
        if chars[i] != '%' {
            out.push(chars[i]);
            i += 1;
            continue;
        }
        // `%%` is a literal percent sign.
        if i + 1 < chars.len() && chars[i + 1] == '%' {
            out.push('%');
            i += 2;
            continue;
        }
        // Positional form: `%1$s`, `%2$s`, ...
        let mut j = i + 1;
        let mut digits = String::new();
        while j < chars.len() && chars[j].is_ascii_digit() {
            digits.push(chars[j]);
            j += 1;
        }
        if !digits.is_empty() && j + 1 < chars.len() && chars[j] == '$' && chars[j + 1] == 's' {
            if let Ok(idx) = digits.parse::<usize>() {
                // JS positional placeholders are 1-based.
                if idx >= 1 && idx <= args.len() {
                    out.push_str(&args[idx - 1]);
                }
                i = j + 2;
                continue;
            }
        }
        // Sequential form: `%s`.
        if i + 1 < chars.len() && chars[i + 1] == 's' {
            if sequential < args.len() {
                out.push_str(&args[sequential]);
                sequential += 1;
            }
            i += 2;
            continue;
        }
        // Not a recognised placeholder: emit the percent sign literally, as JS does.
        out.push('%');
        i += 1;
    }
    out
}

/// The active translation table. The JS reads this from the loaded language
/// file; the host installs it here.
static TRANSLATIONS: LazyLock<RwLock<HashMap<String, String>>> =
    LazyLock::new(|| RwLock::new(HashMap::new()));

/// Install the active language table (replacing any previous one).
pub fn set_translations(table: HashMap<String, String>) {
    if let Ok(mut guard) = TRANSLATIONS.write() {
        *guard = table;
    }
}

/// JS: `translate(key)` — look up a key, falling back to the key itself.
///
/// The JavaScript returns the key unchanged when it is absent, which is what
/// makes missing-translation strings visible in the UI.
pub fn tr(key: &str) -> String {
    match TRANSLATIONS.read() {
        Ok(guard) => guard.get(key).cloned().unwrap_or_else(|| key.to_string()),
        Err(_) => key.to_string(),
    }
}

/// JS: `translate(key, args)`.
pub fn tr_args(key: &str, args: &[String]) -> String {
    format_translation(&tr(key), args)
}
