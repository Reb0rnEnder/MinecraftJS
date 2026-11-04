//! Port of `client/js/gui/widgets.js` — the GUI widget system
//! (`Button`, `Slider`, `TextField` with vanilla look & behaviour).
//!
//! Everything algorithmic is ported exactly: coordinate flooring, hit tests,
//! drag/slider mapping, text editing (selection, word boundaries, filters,
//! validation), cursor blink timing and scroll clamping. The drawing surface
//! (`gui.button`, `gui.blit`, `gui.text*`, `gui.font.*`, `gui.rect`,
//! `gui.setBlend`), the narrator and the clipboard are browser-bound and stay
//! behind the [`Gui`] / [`WidgetHost`] contracts here, with call order and
//! arguments preserved.
//!
//! Vanilla `buttonText` colours (from `vanilla-layout.js`, which the JS
//! imports as `VANILLA_UI`): `normal` = `16777215` (0xFFFFFF), `hover` =
//! `16777215` (0xFFFFFF).

use wasm_bindgen::prelude::*;

/// Vanilla `VANILLA_UI.buttonText` values (`client/js/gui/vanilla-layout.js`).
pub const BUTTON_TEXT_NORMAL: u32 = 16777215;
/// Vanilla `VANILLA_UI.buttonText.hover`.
pub const BUTTON_TEXT_HOVER: u32 = 16777215;

/// JS: `e.code` / `e.ctrl` / `e.shift` — the subset of the input event the
/// widgets read (from `client/js/game/input.js` key events).
#[derive(Debug, Clone)]
pub struct KeyEvent {
    /// JS: `e.code` (`'Enter'`, `'ArrowLeft'`, `'KeyA'`, ...).
    pub code: String,
    /// JS: `e.ctrl`.
    pub ctrl: bool,
    /// JS: `e.shift`.
    pub shift: bool,
}

// ------------------------------------------------------------- browser contracts

/// The `gui` surface the widgets draw through (browser-bound in JS).
///
/// JS call sites: `gui.narrator?.widget(...)`, `gui.button(...)`,
/// `gui.blit(...)`, `gui.textCentered(...)`, `gui.text(...)`, `gui.rect(...)`,
/// `gui.setBlend(...)`, `gui.font.width/trimToWidth`.
pub trait Gui {
    /// JS: `gui.narrator?.widget(widget, hovered, text, kind?)` — kind is
    /// `'slider'` for sliders, absent for buttons.
    fn narrator_widget(&mut self, id: i32, hovered: bool, text: &str, kind: Option<&str>);
    /// JS: `gui.button(x, y, w, h, label, highlighted, enabled)`.
    fn button(&mut self, x: i32, y: i32, w: i32, h: i32, label: &str, highlighted: bool, enabled: bool);
    /// JS: `gui.blit(texture, x, y, u, v, w, h)`.
    fn blit(&mut self, texture: &str, x: i32, y: i32, u: i32, v: i32, w: i32, h: i32);
    /// JS: `gui.textCentered(text, x, y, color)`.
    fn text_centered(&mut self, text: &str, x: i32, y: i32, color: u32);
    /// JS: `gui.text(text, x, y, color, shadow)`.
    fn text(&mut self, text: &str, x: f64, y: f64, color: u32, shadow: bool);
    /// JS: `gui.rect(x0, y0, x1, y1, color)`.
    fn rect(&mut self, x0: f64, y0: f64, x1: f64, y1: f64, color: u32);
    /// JS: `gui.setBlend('invert' | 'alpha')`.
    fn set_blend(&mut self, blend: &str);
    /// JS: `gui.font.width(text)`.
    fn font_width(&self, text: &str) -> f64;
    /// JS: `gui.font.trimToWidth(text, width)` — the trimmed prefix.
    fn font_trim_to_width(&self, text: &str, width: f64) -> String;
}

/// The game hooks the widgets call (browser-bound in JS).
pub trait WidgetHost {
    /// JS: `game.sound.playUi('ui.button.click', 1)`.
    fn play_ui_click(&mut self);
    /// JS: `platform().setClipboard(text)` (TextField Ctrl+C / Ctrl+X).
    fn set_clipboard(&mut self, text: &str);
}

/// JS: `gui.sound` sound name played on activation — `'ui.button.click'`.
pub const UI_BUTTON_CLICK: &str = "ui.button.click";

// --------------------------------------------------------------------- Button

/// Port of the JS `Button` class.
#[derive(Clone)]
pub struct Button {
    /// JS: `this.id`.
    pub id: i32,
    /// JS: `this.x` — `Math.floor(x)` (fractional coords bleed widgets.png rows).
    pub x: i32,
    /// JS: `this.y` — `Math.floor(y)`.
    pub y: i32,
    /// JS: `this.w`.
    pub w: i32,
    /// JS: `this.h`.
    pub h: i32,
    /// JS: `this.label` — string or `() => string`.
    pub label: Label,
    /// JS: `this.onClick`.
    pub on_click: Option<usize>,
    /// JS: `this.enabled`.
    pub enabled: bool,
    /// JS: `this.visible`.
    pub visible: bool,
    /// JS: `this.focused` (set by the screen's focus handling).
    pub focused: bool,
}

/// JS: `label` is a string or a `() => string` function.
#[derive(Clone)]
pub enum Label {
    /// JS: a plain string label.
    Text(String),
    /// JS: `typeof this.label === 'function'` — the index into the screen's
    /// label-function table (the host resolves it).
    Dynamic(usize),
}

impl Label {
    /// JS: `typeof this.label === 'function' ? this.label() : this.label`.
    pub fn resolve<'a>(&'a self, dynamic: &'a [Box<dyn Fn() -> String + 'a>]) -> String {
        match self {
            Label::Text(s) => s.clone(),
            // Dynamic labels are resolved by the host's function table.
            Label::Dynamic(i) => dynamic.get(*i).map(|f| f()).unwrap_or_default(),
        }
    }
}

impl Button {
    /// JS: `new Button(id, x, y, w, h, label, onClick)`.
    pub fn new(id: i32, x: f64, y: f64, w: i32, h: i32, label: Label, on_click: Option<usize>) -> Self {
        // JS: `Math.floor(x)`, `Math.floor(y)` — fractional quad edges bleed
        // neighbouring rows of widgets.png into the button.
        Button {
            id,
            x: x.floor() as i32,
            y: y.floor() as i32,
            w,
            h,
            label,
            on_click,
            enabled: true,
            visible: true,
            focused: false,
        }
    }

    /// JS: `hovered(mx, my)` — `mx >= x && my >= y && mx < x+w && my < y+h`.
    pub fn hovered(&self, mx: i32, my: i32) -> bool {
        mx >= self.x && my >= self.y && mx < self.x + self.w && my < self.y + self.h
    }

    /// JS: `render(gui, mx, my)`.
    pub fn render(&self, gui: &mut dyn Gui, dynamic: &[Box<dyn Fn() -> String + '_>], mx: i32, my: i32) {
        if !self.visible {
            return;
        }
        let label = self.label.resolve(dynamic);
        gui.narrator_widget(self.id, self.hovered(mx, my), &label, None);
        gui.button(
            self.x,
            self.y,
            self.w,
            self.h,
            &label,
            self.enabled && (self.focused || self.hovered(mx, my)),
            self.enabled,
        );
    }

    /// JS: `mouseDown(mx, my, game)` — returns whether the click was handled.
    pub fn mouse_down(&self, host: &mut dyn WidgetHost, mx: i32, my: i32) -> bool {
        if self.visible && self.enabled && self.hovered(mx, my) {
            host.play_ui_click();
            return true; // the screen dispatches `onClick(this)`
        }
        false
    }

    /// JS: `key(e, game)` — Enter / NumpadEnter / Space activate the button.
    pub fn key(&self, e: &KeyEvent, host: &mut dyn WidgetHost) -> bool {
        if self.enabled
            && self.visible
            && (e.code == "Enter" || e.code == "NumpadEnter" || e.code == "Space")
        {
            host.play_ui_click();
            return true; // the screen dispatches `onClick(this)`
        }
        false
    }
}

// --------------------------------------------------------------------- Slider

/// Port of the JS `Slider` class (`extends Button`).
#[derive(Clone)]
pub struct Slider {
    /// JS: `this.id`.
    pub id: i32,
    /// JS: `this.x` — floored like Button.
    pub x: i32,
    /// JS: `this.y` — floored like Button.
    pub y: i32,
    /// JS: `this.w`.
    pub w: i32,
    /// JS: `this.h`.
    pub h: i32,
    /// JS: `this.labelFn` — `(value) => string` (host table index).
    pub label_fn: usize,
    /// JS: `this.value` — normalized 0..=1.
    pub value: f64,
    /// JS: `this.onChange` (host table index).
    pub on_change: Option<usize>,
    /// JS: `this.dragging`.
    pub dragging: bool,
    /// JS: `this.enabled`.
    pub enabled: bool,
    /// JS: `this.visible`.
    pub visible: bool,
    /// JS: `this.focused`.
    pub focused: bool,
}

impl Slider {
    /// JS: `new Slider(id, x, y, w, h, labelFn, value, onChange)`.
    pub fn new(id: i32, x: f64, y: f64, w: i32, h: i32, label_fn: usize, value: f64, on_change: Option<usize>) -> Self {
        Slider {
            id,
            x: x.floor() as i32,
            y: y.floor() as i32,
            w,
            h,
            label_fn,
            value,
            on_change,
            dragging: false,
            enabled: true,
            visible: true,
            focused: false,
        }
    }

    /// JS: `hovered(mx, my)` (inherited from Button).
    pub fn hovered(&self, mx: i32, my: i32) -> bool {
        mx >= self.x && my >= self.y && mx < self.x + self.w && my < self.y + self.h
    }

    /// JS: `render(gui, mx, my)` — the vanilla slider sprite: left half, right
    /// half, then the 8px knob, then the centered label.
    pub fn render(&self, gui: &mut dyn Gui, labels: &[Box<dyn Fn(f64) -> String + '_>], mx: i32, my: i32) {
        if !self.visible {
            return;
        }
        let label = labels.get(self.label_fn).map(|f| f(self.value)).unwrap_or_default();
        gui.narrator_widget(self.id, self.hovered(mx, my), &label, Some("slider"));
        if self.dragging {
            // The screen calls `slider_set(this, mx)` on drag; render re-applies.
        }
        gui.blit("gui/widgets.png", self.x, self.y, 0, 46, self.w / 2, self.h);
        gui.blit("gui/widgets.png", self.x + self.w / 2, self.y, 200 - self.w / 2, 46, self.w / 2, self.h);
        let kx = self.x + (self.value * (self.w - 8) as f64).floor() as i32;
        gui.blit("gui/widgets.png", kx, self.y, 0, 66, 4, 20);
        gui.blit("gui/widgets.png", kx + 4, self.y, 196, 66, 4, 20);
        let color = if !self.enabled {
            0xa0a0a0
        } else if self.focused || self.hovered(mx, my) {
            BUTTON_TEXT_HOVER
        } else {
            BUTTON_TEXT_NORMAL
        };
        gui.text_centered(&label, self.x + self.w / 2, self.y + (self.h - 8) / 2, color);
    }

    /// JS: `key(e, game)` — ArrowLeft / ArrowRight step by `1 / (w - 8)`.
    pub fn key(&mut self, e: &KeyEvent, host: &mut dyn WidgetHost) -> bool {
        if self.enabled && self.visible && (e.code == "ArrowLeft" || e.code == "ArrowRight") {
            let step = 1.0 / (self.w - 8) as f64;
            let value = (self.value + if e.code == "ArrowRight" { step } else { -step }).clamp(0.0, 1.0);
            if value != self.value {
                self.value = value;
                // The screen dispatches `onChange(value)`.
            }
            let _ = host;
            return true;
        }
        false
    }

    /// JS: `_set(mx)` — slider position from the mouse x, clamped and quantized
    /// by the caller's `onChange` when it holds a stepped value.
    pub fn set_from_mouse(&mut self, mx: i32) -> Option<f64> {
        let v = ((mx - (self.x + 4)) as f64 / (self.w - 8) as f64).clamp(0.0, 1.0);
        if v != self.value {
            self.value = v;
            Some(v) // the screen dispatches `onChange(v)`
        } else {
            None
        }
    }

    /// JS: `mouseDown(mx, my, game)`.
    pub fn mouse_down(&mut self, host: &mut dyn WidgetHost, mx: i32, my: i32) -> bool {
        if self.visible && self.enabled && self.hovered(mx, my) {
            self.dragging = true;
            self.set_from_mouse(mx);
            host.play_ui_click();
            return true;
        }
        false
    }

    /// JS: `mouseUp()` — `this.dragging = false`.
    pub fn mouse_up(&mut self) {
        self.dragging = false;
    }
}

// ------------------------------------------------------------------ TextField

/// Port of the JS `TextField` class.
pub struct TextField {
    /// JS: `this.x` — floored.
    pub x: i32,
    /// JS: `this.y` — floored.
    pub y: i32,
    /// JS: `this.w`.
    pub w: i32,
    /// JS: `this.h`.
    pub h: i32,
    /// JS: `this.text`.
    pub text: String,
    /// JS: `this.maxLength` — `opts.maxLength || 32`.
    pub max_length: usize,
    /// JS: `this.focused`.
    pub focused: bool,
    /// JS: `this.cursor`.
    pub cursor: usize,
    /// JS: `this.selEnd`.
    pub sel_end: usize,
    /// JS: `this.scroll`.
    pub scroll: usize,
    /// JS: `this.drawBackground` — `opts.background !== false`.
    pub draw_background: bool,
    /// JS: `this.enabled`.
    pub enabled: bool,
    /// JS: `this.textColor` — `0xe0e0e0`.
    pub text_color: u32,
    /// JS: `this.cursorCounter`.
    pub cursor_counter: u32,
    /// JS: `this.filter` — `opts.filter || null` (host table index).
    pub filter: Option<usize>,
    /// JS: `this.onEnter` (host table index).
    pub on_enter: Option<usize>,
    /// JS: `this.onChange` (host table index).
    pub on_change: Option<usize>,
    /// JS: `this.validate` (host table index).
    pub validate: Option<usize>,
}

impl TextField {
    /// JS: `new TextField(x, y, w, h, opts = {})`.
    #[allow(clippy::too_many_arguments)]
    pub fn new(x: f64, y: f64, w: i32, h: i32, opts: TextFieldOpts) -> Self {
        let text = opts.text.unwrap_or_default();
        let cursor = text.chars().count();
        TextField {
            x: x.floor() as i32,
            y: y.floor() as i32,
            w,
            h,
            text,
            max_length: opts.max_length.unwrap_or(32),
            focused: opts.focused,
            cursor,
            sel_end: cursor,
            scroll: 0,
            draw_background: !opts.no_background,
            enabled: true,
            text_color: 0xe0e0e0,
            cursor_counter: 0,
            filter: opts.filter,
            on_enter: opts.on_enter,
            on_change: opts.on_change,
            validate: opts.validate,
        }
    }

    /// JS: `setText(t)` — clamps to maxLength, cursor to the end, fires onChange.
    pub fn set_text(&mut self, t: &str) -> Option<String> {
        self.text = t.chars().take(self.max_length).collect();
        self.cursor = self.text.chars().count();
        self.sel_end = self.cursor;
        self.on_change.map(|_| self.text.clone())
    }

    /// JS: `tick()` — `this.cursorCounter++`.
    pub fn tick(&mut self) {
        self.cursor_counter += 1;
    }

    /// JS: `selection()` — `[min(cursor, selEnd), max(cursor, selEnd)]`.
    pub fn selection(&self) -> (usize, usize) {
        (self.cursor.min(self.sel_end), self.cursor.max(self.sel_end))
    }

    /// JS: `insert(str)` — filter chars (`>= ' '`, not DEL, not `§`), apply the
    /// custom filter, respect the maxLength room, splice at the selection,
    /// validate, move the cursor, fire onChange.
    pub fn insert(
        &mut self,
        s: &str,
        filters: &[Box<dyn Fn(char) -> bool + '_>],
        validators: &[Box<dyn Fn(&str) -> bool + '_>],
    ) -> Option<String> {
        let mut filtered = String::new();
        for ch in s.chars() {
            // JS: `ch >= ' ' && ch !== '\u007f' && ch !== '§'`
            if ch >= ' ' && ch != '\u{7f}' && ch != '\u{a7}' {
                filtered.push(ch);
            }
        }
        if let Some(fi) = self.filter {
            if let Some(f) = filters.get(fi) {
                filtered = filtered.chars().filter(|c| f(*c)).collect();
            }
        }
        let (a, b) = self.selection();
        let len = self.text.chars().count();
        let room = self.max_length as i64 - len as i64 + (b - a) as i64;
        let insert: String = filtered.chars().take(room.max(0) as usize).collect();
        let next: String = self
            .text
            .chars()
            .take(a)
            .chain(insert.chars())
            .chain(self.text.chars().skip(b))
            .collect();
        if let Some(vi) = self.validate {
            if let Some(v) = validators.get(vi) {
                if !v(&next) {
                    return None;
                }
            }
        }
        self.text = next;
        self.cursor = a + insert.chars().count();
        self.sel_end = self.cursor;
        self.on_change.map(|_| self.text.clone())
    }

    /// JS: `deleteChars(n)` — selection delete routes through `insert('')`.
    pub fn delete_chars(
        &mut self,
        n: i64,
        validators: &[Box<dyn Fn(&str) -> bool + '_>],
    ) -> Option<String> {
        if self.text.is_empty() {
            return None;
        }
        let (a, b) = self.selection();
        if a != b {
            return self.insert("", &[], validators);
        }
        let len = self.text.chars().count();
        let (from, to) = if n < 0 {
            (self.cursor.saturating_sub((-n) as usize), self.cursor)
        } else {
            (self.cursor, (self.cursor + n as usize).min(len))
        };
        let next: String = self
            .text
            .chars()
            .take(from)
            .chain(self.text.chars().skip(to))
            .collect();
        self.text = next;
        self.cursor = from;
        self.sel_end = from;
        self.on_change.map(|_| self.text.clone())
    }

    /// JS: `wordBoundary(dir)` — skip adjacent spaces, then the word chars.
    pub fn word_boundary(&self, dir: i32) -> usize {
        let chars: Vec<char> = self.text.chars().collect();
        let mut i = self.cursor;
        if dir < 0 {
            while i > 0 && chars[i - 1] == ' ' {
                i -= 1;
            }
            while i > 0 && chars[i - 1] != ' ' {
                i -= 1;
            }
        } else {
            while i < chars.len() && chars[i] == ' ' {
                i += 1;
            }
            while i < chars.len() && chars[i] != ' ' {
                i += 1;
            }
        }
        i
    }

    /// JS: `key(e)` — Ctrl+A/C/X/V, Backspace/Delete (+Ctrl word), Home/End,
    /// ArrowLeft/Right (+Ctrl word), Enter/NumpadEnter. Returns whether handled.
    pub fn key(&mut self, e: &KeyEvent, host: &mut dyn WidgetHost) -> bool {
        if !self.focused {
            return false;
        }
        let shift = e.shift;
        // JS: `const move = pos => { this.cursor = pos; if (!shift) this.selEnd = pos; }`
        let mut move_to = |field: &mut TextField, pos: usize| {
            field.cursor = pos;
            if !shift {
                field.sel_end = pos;
            }
        };
        if e.ctrl && e.code == "KeyA" {
            self.cursor = self.text.chars().count();
            self.sel_end = 0;
            return true;
        }
        if e.ctrl && e.code == "KeyC" {
            let (a, b) = self.selection();
            let sel: String = self.text.chars().skip(a).take(b - a).collect();
            host.set_clipboard(&sel);
            return true;
        }
        if e.ctrl && e.code == "KeyX" {
            let (a, b) = self.selection();
            let sel: String = self.text.chars().skip(a).take(b - a).collect();
            host.set_clipboard(&sel);
            self.insert("", &[], &[]);
            return true;
        }
        if e.ctrl && e.code == "KeyV" {
            return true; // handled by the paste event -> char
        }
        match e.code.as_str() {
            "Backspace" => {
                if e.ctrl {
                    self.delete_chars(self.word_boundary(-1) as i64 - self.cursor as i64, &[]);
                } else {
                    self.delete_chars(-1, &[]);
                }
                true
            }
            "Delete" => {
                if e.ctrl {
                    self.delete_chars(self.word_boundary(1) as i64 - self.cursor as i64, &[]);
                } else {
                    self.delete_chars(1, &[]);
                }
                true
            }
            "Home" => {
                move_to(self, 0);
                true
            }
            "End" => {
                move_to(self, self.text.chars().count());
                true
            }
            "ArrowLeft" => {
                let pos = if e.ctrl {
                    self.word_boundary(-1)
                } else {
                    self.cursor.saturating_sub(1)
                };
                move_to(self, pos);
                true
            }
            "ArrowRight" => {
                let pos = if e.ctrl {
                    self.word_boundary(1)
                } else {
                    (self.cursor + 1).min(self.text.chars().count())
                };
                move_to(self, pos);
                true
            }
            "Enter" | "NumpadEnter" => {
                // The screen dispatches `onEnter(text)` via the host table.
                true
            }
            _ => false,
        }
    }

    /// JS: `char(c)` — typed character insert (focused + enabled gate).
    pub fn char(&mut self, c: &str) -> bool {
        if !self.focused || !self.enabled {
            return false;
        }
        self.insert(c, &[], &[]);
        true
    }

    /// JS: `mouseDown(mx, my, gui)` — focus follows the click; the cursor lands
    /// where `trimToWidth` cuts the visible text at the click offset.
    pub fn mouse_down(&mut self, gui: &dyn Gui, mx: i32, my: i32) -> bool {
        let inside = mx >= self.x && mx < self.x + self.w && my >= self.y && my < self.y + self.h;
        self.focused = inside;
        if inside {
            let rel = (mx - self.x - if self.draw_background { 4 } else { 0 }) as f64;
            let visible: String = self.text.chars().skip(self.scroll).collect();
            let t = gui.font_trim_to_width(&visible, rel);
            self.cursor = self.scroll + t.chars().count();
            self.sel_end = self.cursor;
        }
        inside
    }

    /// JS: `render(gui)` — background, scroll clamping, visible text, blinking
    /// cursor and the inverted selection rectangle. Mirrors the JS in mutating
    /// `this.scroll` while rendering.
    pub fn render(&mut self, gui: &mut dyn Gui, formatter: Option<&dyn Fn(&str, usize) -> String>) {
        if self.draw_background {
            gui.rect(
                (self.x - 1) as f64,
                (self.y - 1) as f64,
                (self.x + self.w + 1) as f64,
                (self.y + self.h + 1) as f64,
                0xffa0a0a0,
            );
            gui.rect(
                self.x as f64,
                self.y as f64,
                (self.x + self.w) as f64,
                (self.y + self.h) as f64,
                0xff000000,
            );
        }
        let inner_w = if self.draw_background { self.w - 8 } else { self.w } as f64;
        if self.cursor < self.scroll {
            self.scroll = self.cursor;
        }
        // JS: `while (gui.font.width(text.slice(scroll, cursor)) > innerW && scroll < cursor) scroll++`
        let chars: Vec<char> = self.text.chars().collect();
        while gui.font_width(&chars[self.scroll..self.cursor].iter().collect::<String>()) > inner_w
            && self.scroll < self.cursor
        {
            self.scroll += 1;
        }
        let visible: String = chars[self.scroll.min(chars.len())..].iter().collect();
        let visible = gui.font_trim_to_width(&visible, inner_w);
        let tx = if self.draw_background { self.x + 4 } else { self.x };
        let ty = if self.draw_background {
            self.y as f64 + (self.h - 8) as f64 / 2.0
        } else {
            self.y as f64
        };
        let color = if self.enabled { self.text_color } else { 0x707070 };
        let shown = formatter.map(|f| f(&visible, self.scroll)).unwrap_or_else(|| visible.clone());
        gui.text(&shown, tx as f64, ty, color, true);
        let cpos = self.cursor - self.scroll;
        let vis_chars: Vec<char> = visible.chars().collect();
        let cx = tx as f64 + gui.font_width(&vis_chars[..cpos.min(vis_chars.len())].iter().collect::<String>());
        // JS: `Math.floor(cursorCounter / 6) % 2 === 0`
        if self.focused && (self.cursor_counter / 6) % 2 == 0 {
            if self.cursor >= chars.len() {
                gui.text("_", cx, ty, color, true);
            } else {
                gui.rect(cx, ty - 1.0, cx + 1.0, ty + 1.0 + 9.0, 0xffd0d0d0);
            }
        }
        if self.sel_end != self.cursor {
            let a = (self.cursor.min(self.sel_end)).saturating_sub(self.scroll).max(0);
            let b = vis_chars.len().min(self.cursor.max(self.sel_end).saturating_sub(self.scroll));
            let x0 = tx as f64 + gui.font_width(&vis_chars[..a.min(vis_chars.len())].iter().collect::<String>());
            let x1 = tx as f64 + gui.font_width(&vis_chars[..b].iter().collect::<String>());
            // JS: vanilla inverts the selection with a logic op.
            gui.set_blend("invert");
            gui.rect(x0, ty - 1.0, x1, ty + 9.0, 0xffffffff);
            gui.set_blend("alpha");
        }
    }
}

/// JS: the `opts` object of `new TextField(x, y, w, h, opts)`.
#[derive(Default)]
pub struct TextFieldOpts {
    /// JS: `opts.text`.
    pub text: Option<String>,
    /// JS: `opts.maxLength`.
    pub max_length: Option<usize>,
    /// JS: `opts.focused`.
    pub focused: bool,
    /// JS: `opts.background === false`.
    pub no_background: bool,
    /// JS: `opts.filter` (host table index).
    pub filter: Option<usize>,
    /// JS: `opts.onEnter` (host table index).
    pub on_enter: Option<usize>,
    /// JS: `opts.onChange` (host table index).
    pub on_change: Option<usize>,
    /// JS: `opts.validate` (host table index).
    pub validate: Option<usize>,
}

// ----------------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;

    fn key(code: &str, ctrl: bool, shift: bool) -> KeyEvent {
        KeyEvent { code: code.to_string(), ctrl, shift }
    }

    struct NoHost;
    impl WidgetHost for NoHost {
        fn play_ui_click(&mut self) {}
        fn set_clipboard(&mut self, _text: &str) {}
    }

    // JS: `hovered` rectangle test.
    #[test]
    fn button_hover() {
        let b = Button::new(1, 10.0, 20.0, 50, 20, Label::Text("x".into()), None);
        assert!(b.hovered(10, 20));
        assert!(b.hovered(59, 39));
        assert!(!b.hovered(60, 39)); // mx < x + w
        assert!(!b.hovered(30, 40)); // my < y + h
        // JS: Math.floor on constructor coords
        assert_eq!((b.x, b.y), (10, 20));
        let f = Button::new(2, 10.7, 20.9, 50, 20, Label::Text("x".into()), None);
        assert_eq!((f.x, f.y), (10, 20));
    }

    // JS: `_set` slider mapping.
    #[test]
    fn slider_set_clamps() {
        let mut s = Slider::new(1, 0.0, 0.0, 100, 20, 0, 0.5, None);
        // JS: v = (mx - (x + 4)) / (w - 8) → (54 - 4) / 92 = 25/46.
        assert_eq!(s.set_from_mouse(54), Some(0.5434782608695652));
        assert_eq!(s.set_from_mouse(-100), Some(0.0)); // clamped low (0.5434 -> 0)
        assert_eq!(s.set_from_mouse(500), Some(1.0)); // clamped high
        assert_eq!(s.set_from_mouse(500), None); // unchanged → no onChange
        assert_eq!(s.set_from_mouse(50), Some(0.5)); // (50 - 4) / 92
    }

    // JS: `key` arrow step is 1/(w-8), clamped to [0,1].
    #[test]
    fn slider_arrow_keys() {
        let mut s = Slider::new(1, 0.0, 0.0, 100, 20, 0, 0.0, None);
        assert!(s.key(&key("ArrowRight", false, false), &mut NoHost));
        assert!((s.value - 1.0 / 92.0).abs() < 1e-12);
        s.value = 1.0;
        assert!(s.key(&key("ArrowRight", false, false), &mut NoHost));
        assert_eq!(s.value, 1.0); // clamped
        assert!(!s.key(&key("ArrowUp", false, false), &mut NoHost));
    }

    // JS: `insert` char filtering and maxLength room.
    #[test]
    fn textfield_insert_filter_and_room() {
        let mut t = TextField::new(0.0, 0.0, 100, 20, TextFieldOpts { max_length: Some(5), ..Default::default() });
        t.insert("ab§c\u{7f} d", &[], &[]); // § and DEL and control filtered; space kept
        assert_eq!(t.text, "abc d");
        let mut t2 = TextField::new(0.0, 0.0, 100, 20, TextFieldOpts { max_length: Some(5), ..Default::default() });
        t2.insert("hello", &[], &[]);
        t2.insert("world", &[], &[]); // room 0 → nothing inserted
        assert_eq!(t2.text, "hello");
        // selection replace frees room
        t2.cursor = 0;
        t2.sel_end = 2; // select "he"
        t2.insert("xyz!", &[], &[]); // room = 5 - 5 + 2 = 2 → "xy"
        assert_eq!(t2.text, "xyllo");
    }

    // JS: `deleteChars` negative/positive and selection delete.
    #[test]
    fn textfield_delete_chars() {
        let mut t = TextField::new(0.0, 0.0, 100, 20, TextFieldOpts::default());
        t.set_text("hello");
        t.cursor = 5;
        t.sel_end = 5;
        t.delete_chars(-1, &[]); // backspace
        assert_eq!(t.text, "hell");
        assert_eq!(t.cursor, 4);
        t.delete_chars(1, &[]); // delete forward at end → no-op
        assert_eq!(t.text, "hell");
        t.cursor = 0;
        t.sel_end = 0;
        t.delete_chars(2, &[]); // "he" deleted
        assert_eq!(t.text, "ll");
        // selection delete
        t.cursor = 0;
        t.sel_end = 1;
        t.delete_chars(-1, &[]);
        assert_eq!(t.text, "l");
    }

    // JS: `wordBoundary` skips spaces then word chars.
    #[test]
    fn textfield_word_boundary() {
        let mut t = TextField::new(0.0, 0.0, 100, 20, TextFieldOpts::default());
        t.set_text("one two three");
        t.cursor = 7; // the space after "two"
        assert_eq!(t.word_boundary(-1), 4); // start of "two"
        // JS: forward skips the space (7 -> 8) then walks "three" to the end.
        assert_eq!(t.word_boundary(1), 13);
        t.cursor = 0;
        assert_eq!(t.word_boundary(-1), 0);
    }

    // JS: Ctrl+A selects all; Ctrl+X cuts; KeyV claims the event.
    #[test]
    fn textfield_shortcuts() {
        struct Clip(Vec<String>);
        impl WidgetHost for Clip {
            fn play_ui_click(&mut self) {}
            fn set_clipboard(&mut self, text: &str) {
                self.0.push(text.to_string());
            }
        }
        let mut clip = Clip(vec![]);
        let mut t = TextField::new(0.0, 0.0, 100, 20, TextFieldOpts::default());
        t.focused = true; // JS: `key(e)` gates on this.focused
        t.set_text("hello");
        t.key(&key("KeyA", true, false), &mut clip);
        assert_eq!((t.cursor, t.sel_end), (5, 0));
        assert!(t.key(&key("KeyX", true, false), &mut clip));
        assert_eq!(clip.0, vec!["hello"]);
        assert_eq!(t.text, "");
        assert!(t.key(&key("KeyV", true, false), &mut clip));
        assert!(!t.key(&key("KeyQ", false, false), &mut clip));
    }

    // JS: `key` requires focus; char requires focus + enabled.
    #[test]
    fn textfield_focus_gates() {
        let mut t = TextField::new(0.0, 0.0, 100, 20, TextFieldOpts::default());
        assert!(!t.key(&key("Enter", false, false), &mut NoHost));
        assert!(!t.char("x"));
        t.focused = true;
        assert!(t.char("x"));
        assert_eq!(t.text, "x");
    }
}
