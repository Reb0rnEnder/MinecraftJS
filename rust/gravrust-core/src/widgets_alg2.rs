//! Port of `client/js/gui/widgets.js` — `TextField` text algorithms plus the
//! JavaScript string-index helpers they need.
//!
//! JS positions (`cursor`, `selEnd`, `scroll`, `maxLength`, `String.slice`,
//! `String.length`) count **UTF-16 code units**. Rust `String` indices count
//! bytes, so this module provides the UTF-16 conversions every ported TextField
//! operation goes through. For BMP text (usernames, addresses, commands, chat —
//! everything the vanilla client types) the two agree; an astral-plane char
//! (e.g. emoji) counts as 2 units like in JS.
//!
//! Known deviation (documented at the slice helpers): a position that lands in
//! the *second* UTF-16 half of an astral char cannot be represented in a Rust
//! `String`; slicing clamps to the start of that char (JS would produce a lone
//! surrogate there). Positions produced by the widget logic (word boundaries,
//! arrow moves, trim results) are always char-aligned except `cursor - 1`
//! beside an astral char, which JS also only ever uses for slicing.
//!
//! JS source: `client/js/gui/widgets.js` (`class TextField`).

// ------------------------------------------------------------ UTF-16 string helpers

/// JS: `String.prototype.length` — number of UTF-16 code units.
pub fn utf16_len(s: &str) -> usize {
    s.chars().map(char::len_utf16).sum()
}

/// Maps a UTF-16 code-unit index to a byte offset in `s`, clamped to the start
/// of the char containing that index (so the result is always a char boundary).
/// Indices past the end clamp to `s.len()`.
pub fn utf16_byte_offset(s: &str, index: usize) -> usize {
    if index == 0 {
        return 0;
    }
    let mut units = 0usize;
    for (byte_off, ch) in s.char_indices() {
        let len = ch.len_utf16();
        if units + len > index {
            // Inside ch (second half of a surrogate pair in JS terms):
            // clamp to the char start, see module docs.
            return byte_off;
        }
        units += len;
        if units == index {
            return byte_off + ch.len_utf8();
        }
    }
    s.len()
}

/// JS: `String.prototype.slice(start, end)` on UTF-16 code units (widgets.js
/// only ever passes non-negative, ordered arguments). `start >= end` yields `''`
/// (JS behaviour), oversized `end` clamps to the string end.
pub fn utf16_slice(s: &str, start: usize, end: usize) -> &str {
    if start >= end {
        return "";
    }
    &s[utf16_byte_offset(s, start)..utf16_byte_offset(s, end)]
}

/// JS: `this.text[i]` — the UTF-16 code unit at `i`. The second half of an
/// astral char yields its low surrogate (exactly what JS indexing produces).
/// Past the end this returns 0 (JS `undefined`; both compare unequal to `' '`,
/// which is all `word_boundary` uses it for).
pub fn utf16_unit_at(s: &str, index: usize) -> u16 {
    let mut units = 0usize;
    for ch in s.chars() {
        let len = ch.len_utf16();
        if index < units + len {
            if len == 1 {
                return ch as u16;
            }
            let cp = ch as u32 - 0x1_0000;
            return if index == units {
                (0xd800 + (cp >> 10)) as u16
            } else {
                (0xdc00 + (cp & 0x3ff)) as u16
            };
        }
        units += len;
    }
    0
}

// ------------------------------------------------------------ selection

/// JS: `TextField.selection()` —
/// `return [Math.min(this.cursor, this.selEnd), Math.max(this.cursor, this.selEnd)];`
///
/// Returns the ordered `(a, b)` pair.
pub fn selection_range(cursor: usize, sel_end: usize) -> (usize, usize) {
    (cursor.min(sel_end), cursor.max(sel_end))
}

// ------------------------------------------------------------ insert filtering

/// JS: `TextField.insert(str)` —
/// `for (const ch of str) if (ch >= ' ' && ch !== '\u007f' && ch !== '§') s += ch;`
///
/// The built-in per-code-point filter: keeps `>= U+0020`, drops DEL and the
/// section-sign format prefix. (`for...of` iterates code points — `char`s here.)
pub fn insert_allows_char(ch: char) -> bool {
    (ch as u32) >= 0x20 && ch != '\u{7f}' && ch != '§'
}

/// JS: `TextField.insert(str)` — the two filter stages:
/// the built-in filter above, then
/// `if (this.filter) s = [...s].filter(this.filter).join('');` (the user filter
/// also receives code points).
///
/// `filter` is `&mut dyn FnMut` (not `&dyn Fn`) because the widget stores the
/// JS closure as a stateful `Box<dyn FnMut(char) -> bool>`.
pub fn filter_insert(s: &str, filter: Option<&mut dyn FnMut(char) -> bool>) -> String {
    let mut out = String::new();
    for ch in s.chars() {
        if insert_allows_char(ch) {
            out.push(ch);
        }
    }
    match filter {
        Some(f) => out.chars().filter(|c| f(*c)).collect(),
        None => out,
    }
}

// ------------------------------------------------------------ deletion

/// JS: `TextField.deleteChars(n)` — the no-selection branch:
/// `const from = n < 0 ? Math.max(0, this.cursor + n) : this.cursor;`
/// `const to = n < 0 ? this.cursor : Math.min(this.text.length, this.cursor + n);`
/// `this.text = this.text.slice(0, from) + this.text.slice(to);`
///
/// Returns `(new_text, from)`; the caller assigns `cursor = selEnd = from` and
/// fires `onChange` (JS does both unconditionally, even when nothing changed).
pub fn delete_chars(text: &str, cursor: usize, n: i64) -> (String, usize) {
    let len = utf16_len(text) as i64;
    let (from, to) = if n < 0 {
        ((cursor as i64 + n).max(0), cursor as i64)
    } else {
        (cursor as i64, (cursor as i64 + n).min(len))
    };
    let from = from.max(0) as usize;
    let to = to.max(0) as usize;
    let new_text =
        format!("{}{}", utf16_slice(text, 0, from), utf16_slice(text, to, len as usize));
    (new_text, from)
}

// ------------------------------------------------------------ word navigation

/// JS: `TextField.wordBoundary(dir)` —
/// `let i = this.cursor;`
/// `if (dir < 0) {`
/// `  while (i > 0 && this.text[i - 1] === ' ') i--;`
/// `  while (i > 0 && this.text[i - 1] !== ' ') i--;`
/// `} else {`
/// `  while (i < this.text.length && this.text[i] === ' ') i++;`
/// `  while (i < this.text.length && this.text[i] !== ' ') i++;`
/// `}`
/// `return i;`
pub fn word_boundary(text: &str, cursor: usize, dir: i32) -> usize {
    let len = utf16_len(text);
    let mut i = cursor;
    if dir < 0 {
        while i > 0 && utf16_unit_at(text, i - 1) == b' ' as u16 {
            i -= 1;
        }
        while i > 0 && utf16_unit_at(text, i - 1) != b' ' as u16 {
            i -= 1;
        }
    } else {
        while i < len && utf16_unit_at(text, i) == b' ' as u16 {
            i += 1;
        }
        while i < len && utf16_unit_at(text, i) != b' ' as u16 {
            i += 1;
        }
    }
    i
}

// ------------------------------------------------------------ render scroll window

/// JS: `TextField.render(gui)` — the horizontal scroll fix:
/// `if (this.cursor < this.scroll) this.scroll = this.cursor;`
/// `while (gui.font.width(this.text.slice(this.scroll, this.cursor)) > innerW && this.scroll < this.cursor) this.scroll++;`
///
/// `width` is the injected `font.width` measure.
pub fn text_field_scroll(
    scroll: usize,
    cursor: usize,
    text: &str,
    inner_w: f64,
    width: &dyn Fn(&str) -> f64,
) -> usize {
    let mut scroll = scroll;
    if cursor < scroll {
        scroll = cursor;
    }
    while width(utf16_slice(text, scroll, cursor)) > inner_w && scroll < cursor {
        scroll += 1;
    }
    scroll
}

// ------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn utf16_len_counts_surrogate_pairs_twice() {
        assert_eq!(utf16_len(""), 0);
        assert_eq!(utf16_len("hello"), 5);
        // 'a' (1) + U+1F600 (2) + 'b' (1) = 4 UTF-16 units.
        assert_eq!(utf16_len("a\u{1f600}b"), 4);
        assert_eq!(utf16_len("§l"), 2); // format codes are ordinary chars here
    }

    #[test]
    fn utf16_byte_offset_walks_units() {
        let s = "a\u{1f600}b"; // units: a | high | low | b ; bytes: 0 1..5 5
        assert_eq!(utf16_byte_offset(s, 0), 0);
        assert_eq!(utf16_byte_offset(s, 1), 1); // emoji start
        assert_eq!(utf16_byte_offset(s, 2), 1); // low surrogate clamps to char start
        assert_eq!(utf16_byte_offset(s, 3), 5); // after the emoji
        assert_eq!(utf16_byte_offset(s, 4), 6); // after 'b'
        assert_eq!(utf16_byte_offset(s, 99), 6); // clamped
        assert_eq!(utf16_byte_offset("", 0), 0);
    }

    #[test]
    fn utf16_slice_matches_js_slice() {
        assert_eq!(utf16_slice("hello", 1, 3), "el");
        assert_eq!(utf16_slice("hello", 0, 5), "hello");
        assert_eq!(utf16_slice("hello", 0, 99), "hello"); // end clamps
        assert_eq!(utf16_slice("hello", 3, 2), ""); // start >= end -> ''
        assert_eq!(utf16_slice("hello", 4, 4), "");
        // Astral char: index 2 is the low surrogate; clamp gives 'a' (docs).
        assert_eq!(utf16_slice("a\u{1f600}b", 0, 2), "a");
        assert_eq!(utf16_slice("a\u{1f600}b", 3, 4), "b");
    }

    #[test]
    fn utf16_unit_at_splits_surrogate_pairs() {
        let s = "a\u{1f600}b";
        assert_eq!(utf16_unit_at(s, 0), 0x61);
        assert_eq!(utf16_unit_at(s, 1), 0xd83d); // high surrogate of U+1F600
        assert_eq!(utf16_unit_at(s, 2), 0xde00); // low surrogate = 0xDC00 + (0xF600 & 0x3FF)
        assert_eq!(utf16_unit_at(s, 3), 0x62);
        assert_eq!(utf16_unit_at(s, 4), 0); // past end
        assert_eq!(utf16_unit_at("h", 0), 0x68);
    }

    #[test]
    fn selection_orders_cursor_and_anchor() {
        assert_eq!(selection_range(2, 5), (2, 5));
        assert_eq!(selection_range(5, 2), (2, 5));
        assert_eq!(selection_range(3, 3), (3, 3));
    }

    #[test]
    fn builtin_filter_keeps_printable_but_not_del_or_section() {
        assert!(insert_allows_char(' ')); // ch >= ' ' keeps the space itself
        assert!(insert_allows_char('a'));
        assert!(insert_allows_char('~'));
        assert!(insert_allows_char('\u{1f600}')); // astral passes (>= ' ')
        assert!(!insert_allows_char('\n')); // < ' '
        assert!(!insert_allows_char('\t'));
        assert!(!insert_allows_char('\u{1f}'));
        assert!(!insert_allows_char('\u{7f}')); // DEL
        assert!(!insert_allows_char('§')); // format prefix
    }

    #[test]
    fn filter_insert_runs_both_stages() {
        assert_eq!(filter_insert("a\nb§c\u{7f}d", None), "abcd");
        assert_eq!(filter_insert("hello world", None), "hello world");
        let mut no_digits = |c: char| !c.is_ascii_digit();
        assert_eq!(filter_insert("a1b2c3", Some(&mut no_digits)), "abc");
        // The user filter cannot re-admit what the built-in stage removed.
        let mut keep_all = |_: char| true;
        assert_eq!(filter_insert("a§b", Some(&mut keep_all)), "ab");
    }

    #[test]
    fn delete_chars_slices_from_and_to() {
        // Backspace one before cursor 2 of "abcd": removes 'b'.
        assert_eq!(delete_chars("abcd", 2, -1), ("acd".to_string(), 1));
        // Delete one at cursor 2: removes 'c'.
        assert_eq!(delete_chars("abcd", 2, 1), ("abd".to_string(), 2));
        // n = 0 leaves the text and cursor alone.
        assert_eq!(delete_chars("abcd", 2, 0), ("abcd".to_string(), 2));
        // Clamp at both ends.
        // JS: backspace at cursor 0 is a no-op (from == to == 0).
        assert_eq!(delete_chars("abcd", 0, -1), ("abcd".to_string(), 0));
        // JS: delete at the end (cursor == len) is a no-op (from == to).
        assert_eq!(delete_chars("abcd", 4, 1), ("abcd".to_string(), 4));
        // JS: delete(99) at the end: to = min(len, cursor+99) = len = from → no-op.
        assert_eq!(delete_chars("abcd", 4, 99), ("abcd".to_string(), 4));
        assert_eq!(delete_chars("", 0, -1), ("".to_string(), 0));
    }

    #[test]
    fn word_boundaries_skip_and_cross_spaces() {
        assert_eq!(word_boundary("hello world", 5, 1), 11);
        assert_eq!(word_boundary("hello world", 11, -1), 6);
        assert_eq!(word_boundary("hello world", 0, 1), 5);
        assert_eq!(word_boundary("hello world", 6, -1), 0);
        // Double space: both spaces are crossed in one direction.
        assert_eq!(word_boundary("hello  world", 6, 1), 12);
        assert_eq!(word_boundary("hello  world", 12, -1), 7);
        // Trailing spaces: back from the end clears them, then the word.
        assert_eq!(word_boundary("abc   ", 6, -1), 0);
        // Leading spaces: skip both, then the word runs to the end (index 5).
        assert_eq!(word_boundary("  abc", 0, 1), 5);
        // Whole-word moves.
        assert_eq!(word_boundary("hello", 3, 1), 5);
        assert_eq!(word_boundary("hello", 3, -1), 0);
    }

    #[test]
    fn scroll_window_keeps_cursor_visible() {
        let width = |s: &str| 6.0 * s.chars().filter(|c| *c != '§').count() as f64;
        let text = "a".repeat(40);
        // 192 px fit 32 chars -> cursor 40 scrolls the window to 8.
        assert_eq!(text_field_scroll(0, 40, &text, 192.0, &width), 8);
        // Cursor left of the window snaps the window back.
        assert_eq!(text_field_scroll(8, 5, &text, 192.0, &width), 5);
        assert_eq!(text_field_scroll(8, 0, &text, 192.0, &width), 0);
        // A fitting cursor never scrolls.
        assert_eq!(text_field_scroll(0, 3, "abc", 192.0, &width), 0);
        // Tight fit: width("bc") = 12 == innerW stops the loop at 1.
        assert_eq!(text_field_scroll(0, 3, "abc", 12.0, &width), 1);
    }
}
