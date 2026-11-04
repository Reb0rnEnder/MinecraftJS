//! `crate::gui::font` — port of `client/js/gui/font.js` text measurement.
//!
//! `client/js/gui/font.js` is `FontRenderer`: glyph measurement, layout and the
//! line-wrapping used by the credits screen, chat hover tooltips and the packs
//! warning. The glyph *provisioning* (bitmap/unicode providers, atlas lookups)
//! is browser-bound and stays behind the [`GlyphMetrics`] contract; the
//! measurement and wrapping arithmetic below is ported exactly.

use std::borrow::Cow;

/// Glyph metrics source. The JavaScript `FontRenderer` reads character widths
/// from the loaded `font/ascii.png` and the unicode glyph pages; the host
/// supplies those widths here.
pub trait GlyphMetrics {
    /// JS: `this.charW(ch)` — advance width of one character, 0 when the glyph
    /// is absent.
    fn char_width(&self, ch: char) -> f64;

    /// JS: `set.glyph(ch, unicode).boldOffset` — extra advance added per
    /// character while the `§l` bold style is active. Vanilla uses 1.
    fn bold_offset(&self, ch: char) -> f64 {
        let _ = ch;
        1.0
    }

    /// Whether provider metrics are in use. JS: `!!this._providerSet()`.
    /// When true, `width()` rounds up (`Math.ceil`), matching the provider font
    /// path; the legacy renderer returns the raw sum.
    fn uses_providers(&self) -> bool {
        false
    }
}

/// A character-width table, the common case (the legacy `ascii.png` renderer).
///
/// JS: `this.charWidth = new Array(256).fill(0)`.
#[derive(Debug, Clone)]
pub struct WidthTable {
    /// Advance width per glyph index, matching the JS `charWidth` array.
    pub char_width: Vec<f64>,
    /// JS: `this.measuredVersion` — bumped when the font texture reloads.
    pub measured_version: i64,
}

impl WidthTable {
    /// A table of `size` zero-width entries, as `FontRenderer` starts with.
    pub fn new(size: usize) -> Self {
        WidthTable { char_width: vec![0.0; size], measured_version: -1 }
    }

    /// JS: `this.charWidth[i]`.
    pub fn get(&self, index: usize) -> f64 {
        self.char_width.get(index).copied().unwrap_or(0.0)
    }

    /// JS: `this.charWidth[i] = w`.
    pub fn set(&mut self, index: usize, width: f64) {
        if index < self.char_width.len() {
            self.char_width[index] = width;
        }
    }
}

impl GlyphMetrics for WidthTable {
    fn char_width(&self, ch: char) -> f64 {
        // Legacy path: characters above the 255-glyph table have no width.
        let code = ch as u32;
        if code > 255 {
            return 0.0;
        }
        self.get(code as usize)
    }
}

/// Port of `FontRenderer.width(text)` from `client/js/gui/font.js`.
///
/// ```js
/// width(text) {
///   if (!text) return 0;
///   let w = 0; let bold = false;
///   for (let i = 0; i < text.length; i++) {
///     const ch = String.fromCodePoint(text.codePointAt(i));
///     if (ch.length === 2) i++;
///     if (ch === '§' && i + 1 < text.length) {
///       const code = text[i + 1].toLowerCase();
///       if (code === 'l') bold = true;
///       else if (code === 'r' || '0123456789abcdef'.includes(code)) bold = false;
///       i++; continue;
///     }
///     const cw = this.charW(ch);
///     if (cw > 0) w += cw + (bold ? offset : 0);
///   }
///   return providerSet ? Math.ceil(w) : w;
/// }
/// ```
pub fn text_width<M: GlyphMetrics + ?Sized>(metrics: &M, text: &str) -> f64 {
    if text.is_empty() {
        return 0.0;
    }
    let mut w = 0.0_f64;
    let mut bold = false;
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        // JS: `if (ch === '§' && i + 1 < text.length)` — a section sign followed
        // by a formatting code is consumed as a pair and contributes no width.
        if ch == '\u{00a7}' {
            if let Some(&code_ch) = chars.peek() {
                let code = code_ch.to_ascii_lowercase();
                if code == 'l' {
                    bold = true;
                } else if code == 'r' || "0123456789abcdef".contains(code) {
                    bold = false;
                }
                chars.next();
                continue;
            }
            // Trailing lone `§`: falls through and is measured as a glyph, as in JS.
        }
        let cw = metrics.char_width(ch);
        if cw > 0.0 {
            w += cw + if bold { metrics.bold_offset(ch) } else { 0.0 };
        }
    }
    if metrics.uses_providers() {
        w.ceil()
    } else {
        w
    }
}

/// Port of `FontRenderer.wrap(text, maxWidth)` from `client/js/gui/font.js`.
///
/// Formatting pairs (`§` + code) are indivisible, and the active style is
/// carried across the actual line break — including when a colour code appears
/// partway through a long word. Returns the wrapped lines with the carried
/// prefix prepended to each.
pub fn wrap_text<M: GlyphMetrics + ?Sized>(metrics: &M, text: &str, max_width: f64) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();

    // JS works on UTF-16 indices; operate on the equivalent character boundary
    // list so `slice()`-style ranges stay consistent.
    let chars: Vec<char> = text.chars().collect();
    let len = chars.len();
    let mut start = 0usize;
    let mut prefix = String::new();

    // JS: `const format = value => { ... }` — the currently active style suffix.
    let format = |value: &[char]| -> String {
        let mut active = String::new();
        let mut i = 0usize;
        while i < value.len() {
            if value[i] == '\u{00a7}' && i + 1 < value.len() {
                let code = value[i + 1].to_ascii_lowercase();
                if code.is_ascii_hexdigit() || code == 'r' {
                    // A colour (or reset) replaces the accumulated style.
                    active.clear();
                    active.push('\u{00a7}');
                    active.push(code);
                } else if "klmno".contains(code) {
                    // Formatting flags accumulate.
                    active.push('\u{00a7}');
                    active.push(code);
                }
                i += 2;
                continue;
            }
            i += 1;
        }
        active
    };

    let slice = |from: usize, to: usize| -> String { chars[from..to].iter().collect() };

    while start < len {
        let mut end = start;
        let mut space = usize::MAX;

        while end < len && chars[end] != '\n' {
            // JS: formatting pairs are skipped as a unit.
            if chars[end] == '\u{00a7}' && end + 1 < len {
                end += 2;
                continue;
            }
            let next = end + 1;
            let candidate = format!("{}{}", prefix, slice(start, next));
            if text_width(metrics, &candidate) > max_width {
                if space != usize::MAX && space >= start {
                    end = space;
                } else if text_width(metrics, &format!("{}{}", prefix, slice(start, end))) == 0.0 {
                    end = next;
                }
                break;
            }
            if chars[end] == ' ' {
                space = end;
            }
            end = next;
        }

        let line = format!("{}{}", prefix, slice(start, end));
        out.push(line.clone());
        prefix = format(&line.chars().collect::<Vec<char>>());
        start = end;
        if start < len && (chars[start] == '\n' || chars[start] == ' ') {
            start += 1;
        }
    }

    // JS: `if (!text.length || text.endsWith('\n')) out.push(prefix);`
    if text.is_empty() || text.ends_with('\n') {
        out.push(prefix);
    }
    out
}

/// Port of `FontRenderer.trimToWidth(text, w)`.
pub fn trim_to_width<M: GlyphMetrics + ?Sized>(metrics: &M, text: &str, w: f64) -> String {
    let mut s = String::new();
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        // JS: a `§` + code pair is treated as one indivisible unit.
        let unit: Cow<'_, str> = if ch == '\u{00a7}' {
            match chars.peek() {
                Some(&code) => {
                    chars.next();
                    Cow::Owned(format!("\u{00a7}{}", code))
                }
                None => Cow::Borrowed("\u{00a7}"),
            }
        } else {
            Cow::Owned(ch.to_string())
        };
        let candidate = format!("{}{}", s, unit);
        if text_width(metrics, &candidate) > w {
            break;
        }
        s = candidate;
    }
    s
}
