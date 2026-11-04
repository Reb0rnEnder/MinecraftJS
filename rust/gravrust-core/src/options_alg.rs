//! Port of `client/js/gui/screens/options.js` — the pure algorithmic layer.
//!
//! Everything in this module is maths and string formatting taken verbatim
//! from options.js, plus the small pieces of `client/js/gui/widgets.js`
//! (Button/Slider geometry), `client/js/gui/option-focus.js` (Tab focus) and
//! `client/js/gui/slot-list.js` (GuiSlot scroll math) that the options
//! screens lean on. The option definitions live in [`crate::options`]; the
//! screen layouts live in [`crate::options_screen`].
//!
//! `tr` mirrors `client/js/gui/i18n.js` with its default translator
//! (`let translateFn = (key) => key;`): keys pass through unchanged until the
//! host installs a real translator.

use std::cmp::Ordering;
use wasm_bindgen::prelude::*;

// --------------------------------------------------------------- i18n helpers

// JS: tr(key) (client/js/gui/i18n.js) with the default identity translator.
pub fn tr(key: &str) -> String {
    key.to_string()
}

// JS: trOption(key, value) — "Label: VALUE" like vanilla's GameSettings.getKeyBinding.
pub fn tr_option(key: &str, value: &str) -> String {
    format!("{}: {}", tr(key), value)
}

// JS: const onOff = (v) => tr(v ? 'options.on' : 'options.off');
pub fn on_off(v: bool) -> String {
    tr(if v { "options.on" } else { "options.off" })
}

// ------------------------------------------------------------ JS number semantics

// JS: Math.round(x) — Math.round(-0.5) is -0 (i.e. 0), unlike Rust's
// half-away-from-zero `f64::round`, so emulate `floor(x + 0.5)`.
pub fn js_round(x: f64) -> f64 {
    (x + 0.5).floor()
}

// JS: Math.floor(x) — identical to Rust for f64.
pub fn js_floor(x: f64) -> f64 {
    x.floor()
}

// JS: Number.prototype.toFixed(2) as used by the mouse-wheel sensitivity
// formatter. The spec picks the n/100 closest to x and, on a tie, the larger n
// (so 0.125 -> "0.13"); Rust's `{:.2}` rounds half-to-even ("0.12"), hence the
// manual implementation. Values here are always > 0 (10 ** (v*2-1)).
pub fn js_to_fixed2(x: f64) -> String {
    let n = (x * 100.0).round() as i64;
    format!("{}.{:02}", n / 100, (n % 100).abs())
}

// ------------------------------------------------------------- label formatters

// JS: const pct = (key) => (v) => trOption(key, v === 0 ? tr('options.off') : Math.round(v * 100) + '%')
// Value part (SoundScreen volume sliders).
pub fn sound_volume_label_value(v: f64) -> String {
    if v == 0.0 {
        tr("options.off")
    } else {
        percent_label_value(v)
    }
}

// JS: Math.round(v * 100) + '%' — the generic percent formatter.
pub fn percent_label_value(v: f64) -> String {
    format!("{}%", js_round(v * 100.0) as i64)
}

// JS: fovLabel = (v) => { const f = Math.round(30 + v * 80); return trOption('options.fov',
// f === 70 ? tr('options.fov.min') : f === 110 ? tr('options.fov.max') : f); } — value part.
pub fn fov_label_value(v: f64) -> String {
    let f = js_round(30.0 + v * 80.0);
    if f == 70.0 {
        tr("options.fov.min")
    } else if f == 110.0 {
        tr("options.fov.max")
    } else {
        format!("{}", f as i64)
    }
}

// JS: Slider value of the FOV slider: (s.fov - 30) / 80.
pub fn fov_value(fov: i32) -> f64 {
    (fov as f64 - 30.0) / 80.0
}

// JS: (v) => { s.fov = Math.round(30 + v * 80); }
pub fn fov_set(v: f64) -> i32 {
    js_round(30.0 + v * 80.0) as i32
}

// JS: sensitivity label value: v === 0 ? tr('options.sensitivity.min')
//      : v === 1 ? tr('options.sensitivity.max') : Math.round(v * 200) + '%'
pub fn sensitivity_label_value(v: f64) -> String {
    if v == 0.0 {
        tr("options.sensitivity.min")
    } else if v == 1.0 {
        tr("options.sensitivity.max")
    } else {
        format!("{}%", js_round(v * 200.0) as i64)
    }
}

// JS: mouseWheelSensitivity label value: Math.pow(10, v * 2 - 1).toFixed(2)
pub fn mouse_wheel_label_value(v: f64) -> String {
    js_to_fixed2(10f64.powf(v * 2.0 - 1.0))
}

// JS: value: () => (Math.log10(s.mouseWheelSensitivity || 1) + 1) / 2
// (JS `|| 1` also maps 0/NaN to 1.)
pub fn mouse_wheel_value(sensitivity: f64) -> f64 {
    let s = if sensitivity != 0.0 && sensitivity.is_finite() {
        sensitivity
    } else {
        1.0
    };
    (s.log10() + 1.0) / 2.0
}

// JS: set: v => { s.mouseWheelSensitivity = Math.pow(10, v * 2 - 1); }
pub fn mouse_wheel_set(v: f64) -> f64 {
    10f64.powf(v * 2.0 - 1.0)
}

// JS: renderDistance label value: Math.round(2 + v * 30) + ' chunks'
pub fn render_distance_label_value(v: f64) -> String {
    format!("{} chunks", js_round(2.0 + v * 30.0) as i64)
}

// JS: value: () => (s.renderDistance - 2) / 30
pub fn render_distance_value(render_distance: i32) -> f64 {
    (render_distance as f64 - 2.0) / 30.0
}

// JS: set: (v) => { s.renderDistance = Math.round(2 + v * 30); }
pub fn render_distance_set(v: f64) -> i32 {
    js_round(2.0 + v * 30.0) as i32
}

// JS: framerateLimit label value: f = Math.round(10 + v * 250);
//     f >= 260 ? tr('options.framerateLimit.max') : f + ' fps'
pub fn fps_limit_label_value(v: f64) -> String {
    let f = js_round(10.0 + v * 250.0);
    if f >= 260.0 {
        tr("options.framerateLimit.max")
    } else {
        format!("{} fps", f as i64)
    }
}

// JS: value: () => (s.maxFps ? (s.maxFps - 10) / 250 : 1) — maxFps 0 (unlimited) is
// falsy in JS and maps to the right end of the slider.
pub fn fps_limit_value(max_fps: i32) -> f64 {
    if max_fps == 0 {
        1.0
    } else {
        (max_fps as f64 - 10.0) / 250.0
    }
}

// JS: set: (v) => { const f = Math.round(10 + v * 250); s.maxFps = f >= 260 ? 0 : f; }
pub fn fps_limit_set(v: f64) -> i32 {
    let f = js_round(10.0 + v * 250.0);
    if f >= 260.0 {
        0
    } else {
        f as i32
    }
}

// JS: gamma label value: v === 0 ? tr('options.gamma.min') : v === 1 ? tr('options.gamma.max')
//      : '+' + Math.round(v * 100) + '%'
pub fn gamma_label_value(v: f64) -> String {
    if v == 0.0 {
        tr("options.gamma.min")
    } else if v == 1.0 {
        tr("options.gamma.max")
    } else {
        format!("+{}%", js_round(v * 100.0) as i64)
    }
}

// JS: mipmapLevels label value: n = Math.round(v * 4); n === 0 ? tr('options.off') : n
pub fn mipmap_label_value(v: f64) -> String {
    let n = js_round(v * 4.0);
    if n == 0.0 {
        tr("options.off")
    } else {
        format!("{}", n as i64)
    }
}

// JS: value: () => s.mipmapLevels / 4
pub fn mipmap_value(levels: i32) -> f64 {
    levels as f64 / 4.0
}

// JS: set: (v) => { s.mipmapLevels = Math.round(v * 4); }
pub fn mipmap_set(v: f64) -> i32 {
    js_round(v * 4.0) as i32
}

// JS: LOD distance label value: k = Math.round(v * 31);
//     k >= 31 ? tr('options.off') : (16 + k * 16) + ' blocks'
pub fn lod_label_value(v: f64) -> String {
    let k = js_round(v * 31.0);
    if k >= 31.0 {
        tr("options.off")
    } else {
        format!("{} blocks", 16 + k as i64 * 16)
    }
}

// JS: value: () => s.lodDistance <= 0 ? 1 : Math.min(30, Math.max(0, (s.lodDistance - 16) / 16)) / 31
pub fn lod_value(lod_distance: i32) -> f64 {
    if lod_distance <= 0 {
        1.0
    } else {
        let k = ((lod_distance as f64 - 16.0) / 16.0).clamp(0.0, 30.0);
        k / 31.0
    }
}

// JS: set: (v) => { const k = Math.round(v * 31); s.lodDistance = k >= 31 ? 0 : 16 + k * 16; }
pub fn lod_set(v: f64) -> i32 {
    let k = js_round(v * 31.0);
    if k >= 31.0 {
        0
    } else {
        16 + k as i32 * 16
    }
}

// JS: biomeBlendRadius label value: r = Math.round(v * 7);
//     r === 0 ? tr('options.off') : (r * 2 + 1) + 'x' + (r * 2 + 1)
pub fn biome_blend_label_value(v: f64) -> String {
    let r = js_round(v * 7.0);
    if r == 0.0 {
        tr("options.off")
    } else {
        let r = r as i64;
        format!("{}x{}", r * 2 + 1, r * 2 + 1)
    }
}

// JS: value: () => s.biomeBlendRadius / 7
pub fn biome_blend_value(radius: i32) -> f64 {
    radius as f64 / 7.0
}

// JS: set: v => Math.round(v * 7) — callers apply g.applyGraphicsSettings() only when it differs.
pub fn biome_blend_set(v: f64) -> i32 {
    js_round(v * 7.0) as i32
}

// JS: chat.opacity label value: Math.round((v * .9 + .1) * 100) + '%'
pub fn chat_opacity_label_value(v: f64) -> String {
    percent_label_value(v * 0.9 + 0.1)
}

// JS: chat.scale / text_background_opacity label value: Math.round(v * 100) + '%'
pub fn chat_scale_label_value(v: f64) -> String {
    percent_label_value(v)
}

// JS: chat.width label value: Math.floor(v * 280 + 40) + 'px'
pub fn chat_width_label_value(v: f64) -> String {
    format!("{}px", js_floor(v * 280.0 + 40.0) as i64)
}

// JS: chat.height.focused / chat.height.unfocused label value: Math.floor(v * 160 + 20) + 'px'
pub fn chat_height_label_value(v: f64) -> String {
    format!("{}px", js_floor(v * 160.0 + 20.0) as i64)
}

// ------------------------------------------------------------------- graphics API

/// JS: s.graphicsApi — 'webgl2' | 'webgpu' | 'software'
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum GraphicsApi {
    Webgl2,
    Webgpu,
    Software,
}

impl GraphicsApi {
    // JS: const names = { webgl2: 'WebGL 2', webgpu: 'WebGPU', software: tr('Gravrust.options.graphicsApi.software') };
    pub fn display_name(self) -> String {
        match self {
            GraphicsApi::Webgl2 => "WebGL 2".to_string(),
            GraphicsApi::Webgpu => "WebGPU".to_string(),
            GraphicsApi::Software => tr("Gravrust.options.graphicsApi.software"),
        }
    }

    // JS: s.graphicsApi stored strings ('webgl2' | 'webgpu' | 'software').
    pub fn as_str(self) -> &'static str {
        match self {
            GraphicsApi::Webgl2 => "webgl2",
            GraphicsApi::Webgpu => "webgpu",
            GraphicsApi::Software => "software",
        }
    }

    pub fn parse(s: &str) -> Option<GraphicsApi> {
        match s {
            "webgl2" => Some(GraphicsApi::Webgl2),
            "webgpu" => Some(GraphicsApi::Webgpu),
            "software" => Some(GraphicsApi::Software),
            _ => None,
        }
    }
}

// JS: click: () => { const order = ['webgl2', 'webgpu', 'software'];
//        s.graphicsApi = order[(order.indexOf(s.graphicsApi) + 1) % order.length]; }
// An unknown value (indexOf -1) wraps to order[0] = 'webgl2'.
pub fn next_graphics_api(current: GraphicsApi) -> GraphicsApi {
    let order = [GraphicsApi::Webgl2, GraphicsApi::Webgpu, GraphicsApi::Software];
    order[((order.iter().position(|a| *a == current).map(|i| i as i32).unwrap_or(-1)) + 1) as usize % order.len()]
}

// JS: g.device.name === 'WebGPU' ? 'webgpu' : g.device.name === 'Software' ? 'software' : 'webgl2'
pub fn graphics_api_from_device_name(device_name: &str) -> GraphicsApi {
    if device_name == "WebGPU" {
        GraphicsApi::Webgpu
    } else if device_name == "Software" {
        GraphicsApi::Software
    } else {
        GraphicsApi::Webgl2
    }
}

// JS: error.replace(/^[a-z0-9_-]+:\s*/i, '') — strips a leading "prefix: " tag
// (case-insensitive prefix of [a-z0-9_-], then ':' and whitespace).
pub fn strip_error_prefix(error: &str) -> String {
    let colon = match error.find(':') {
        Some(c) => c,
        None => return error.to_string(),
    };
    let prefix = &error[..colon];
    let ok = !prefix.is_empty()
        && prefix
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    if !ok {
        return error.to_string();
    }
    // JS \s: space, \t, \n, \v, \f, \r, unicode spaces.
    error[colon + 1..]
        .trim_start_matches(|c: char| {
            matches!(
                c,
                ' ' | '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | '\u{a0}' | '\u{1680}'
                    | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}'
                    | '\u{205f}' | '\u{3000}' | '\u{feff}'
            )
        })
        .to_string()
}

// --------------------------------------------------------------------- narrator

// JS: NARRATOR_MODES (client/js/gui/narrator.js)
pub const NARRATOR_MODES: [&str; 4] = [
    "options.narrator.off",
    "options.narrator.all",
    "options.narrator.chat",
    "options.narrator.system",
];

// JS: Narrator.label() — tr('options.narrator') + ': ' + (active ? tr(NARRATOR_MODES[n]) : tr('options.narrator.notavailable')).
// speechSynthesis availability is browser-bound; callers pass `active`.
pub fn narrator_label(mode: i32, active: bool) -> String {
    if !active {
        return format!("{}: {}", tr("options.narrator"), tr("options.narrator.notavailable"));
    }
    let name = NARRATOR_MODES.get(mode as usize).copied().unwrap_or("undefined");
    format!("{}: {}", tr("options.narrator"), tr(name))
}

// JS: Narrator.cycle() — s.narrator = this.active ? ((s.narrator | 0) + 1) % 4 : 0.
// Returns the new mode; the announceMode toast stays browser-bound.
pub fn narrator_cycle(mode: i32, active: bool) -> i32 {
    if active {
        (mode + 1) % 4
    } else {
        0
    }
}

// ------------------------------------------------------------------- difficulty

// JS: const diff = ['peaceful', 'easy', 'normal', 'hard'][g.difficulty] || 'normal';
// (an out-of-range index is undefined and falls back to 'normal')
pub fn difficulty_name(difficulty: i32) -> &'static str {
    match difficulty {
        0 => "peaceful",
        1 => "easy",
        2 => "normal",
        3 => "hard",
        _ => "normal",
    }
}

// ------------------------------------------------------------- widget geometry

/// JS: Button coordinates (client/js/gui/widgets.js): widgets are 150x20 (or 310x20
/// wide, 200x20 done), and the Button constructor floors fractional x/y so quad
/// edges land on pixels.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct WidgetRect {
    pub id: i32,
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl WidgetRect {
    pub fn new(id: i32, x: f64, y: f64, w: f64, h: f64) -> WidgetRect {
        WidgetRect { id, x: x.floor(), y: y.floor(), w, h }
    }
}

// JS: Button.hovered(mx, my) — mx >= x && my >= y && mx < x + w && my < y + h.
pub fn widget_hovered(r: &WidgetRect, mx: f64, my: f64) -> bool {
    mx >= r.x && my >= r.y && mx < r.x + r.w && my < r.y + r.h
}

// JS: Slider._set(mx) — v = (mx - (this.x + 4)) / (this.w - 8), clamped to [0, 1].
pub fn slider_value_from_mouse(x: f64, w: f64, mx: f64) -> f64 {
    let v = (mx - (x + 4.0)) / (w - 8.0);
    v.max(0.0).min(1.0)
}

// JS: Slider.key — ArrowLeft/ArrowRight step the value by 1 / (w - 8), clamped to [0, 1].
pub fn slider_key_step(value: f64, w: f64, right: bool) -> f64 {
    let next = value + (if right { 1.0 } else { -1.0 }) / (w - 8.0);
    next.max(0.0).min(1.0)
}

// JS: Slider.render — knob x = this.x + Math.floor(this.value * (this.w - 8)).
pub fn slider_knob_x(x: f64, w: f64, value: f64) -> f64 {
    x + js_floor(value * (w - 8.0))
}

// JS: OptionsBase.grid — x = this.width / 2 - 155 + (i % 2) * 160; y = y0 + 24 * (i >> 1).
pub fn grid_pos(i: usize, width: f64, y0: f64) -> (f64, f64) {
    let i = i as u64;
    (
        width / 2.0 - 155.0 + ((i % 2) as f64) * 160.0,
        y0 + 24.0 * ((i >> 1) as f64),
    )
}

// JS: const btn = (id, col, row, key, fn) => this.buttons.push(new Button(id,
//   cx + (col ? 5 : -155), h6 + 48 - 6 + 24 * row, 150, 20, ...));
pub fn category_button_pos(col: usize, row: usize, cx: f64, h6: f64) -> (f64, f64) {
    (
        cx + if col != 0 { 5.0 } else { -155.0 },
        h6 + 48.0 - 6.0 + 24.0 * row as f64,
    )
}

// JS: VideoScreen.init / MouseSettingsScreen.init row packing:
//   let col = 0; orderedItems.forEach((it, i) => {
//     if (it.wide && col === 1) col = 0;          // a wide option starts its own row
//     const b = makeOption(i, this.width / 2 - 155 + col * 160, 0, it);
//     if (col === 0) this.rows.push([b]); else this.rows[this.rows.length - 1].push(b);
//     col = it.wide ? 0 : 1 - col;
//   });
// The caller's column equals the item's position within its row.
pub fn pack_rows(wide: &[bool]) -> Vec<Vec<usize>> {
    let mut rows: Vec<Vec<usize>> = Vec::new();
    let mut col = 0usize;
    for (i, &is_wide) in wide.iter().enumerate() {
        if is_wide && col == 1 {
            col = 0;
        }
        if col == 0 {
            rows.push(vec![i]);
        } else {
            rows.last_mut().expect("row exists").push(i);
        }
        col = if is_wide { 0 } else { 1 - col };
    }
    rows
}

// ------------------------------------------------- GuiSlot scroll math (slot-list.js)

/// JS: `new ListOf(this, top, bottom, slotHeight, fns, opts)` construction options
/// (client/js/gui/slot-list.js SlotList defaults).
#[derive(Clone, Debug, PartialEq)]
pub struct ListOpts {
    // JS: opts.header (header padding above the first slot)
    pub header: f64,
    // JS: opts.selectionBox !== false
    pub selection_box: bool,
    // JS: !!opts.scrollbarDragOnly
    pub scrollbar_drag_only: bool,
    // JS: opts.listWidth || 220
    pub list_width: f64,
    // JS: opts.scrollBarOffset || 0
    pub scroll_bar_offset: f64,
    // JS: opts.left !== undefined -> left = opts.left; right = opts.left + opts.width
    pub left_width: Option<(f64, f64)>,
}

impl Default for ListOpts {
    fn default() -> Self {
        ListOpts {
            header: 0.0,
            selection_box: true,
            scrollbar_drag_only: false,
            list_width: 220.0,
            scroll_bar_offset: 0.0,
            left_width: None,
        }
    }
}

/// Pure GuiSlot geometry from `client/js/gui/slot-list.js`. Rendering, dragging
/// and double-click timing stay browser-bound; these are the numbers they use.
#[derive(Clone, Debug, PartialEq)]
pub struct ListGeometry {
    pub top: f64,
    pub bottom: f64,
    pub slot_height: f64,
    pub left: f64,
    pub right: f64,
    pub header_padding: f64,
    pub list_width: f64,
    pub scroll_bar_offset: f64,
}

impl ListGeometry {
    // JS: SlotList constructor
    pub fn new(screen_width: f64, top: f64, bottom: f64, slot_height: f64, opts: &ListOpts) -> ListGeometry {
        let (left, right) = match opts.left_width {
            Some((left, width)) => (left, left + width),
            None => (0.0, screen_width),
        };
        ListGeometry {
            top,
            bottom,
            slot_height,
            left,
            right,
            header_padding: opts.header,
            list_width: opts.list_width,
            scroll_bar_offset: opts.scroll_bar_offset,
        }
    }

    // JS: get width() { return this.right - this.left; }
    pub fn width(&self) -> f64 {
        self.right - self.left
    }

    // JS: contentHeight() { return this.size() * this.slotHeight + this.headerPadding; }
    pub fn content_height(&self, size: usize) -> f64 {
        size as f64 * self.slot_height + self.header_padding
    }

    // JS: maxScroll() { return Math.max(0, this.contentHeight() - (this.bottom - this.top - 4)); }
    pub fn max_scroll(&self, size: usize) -> f64 {
        (self.content_height(size) - (self.bottom - self.top - 4.0)).max(0.0)
    }

    // JS: scrollBarX() { return this.left + Math.floor(this.width / 2) + 124 + this.scrollBarOffset; }
    pub fn scroll_bar_x(&self) -> f64 {
        self.left + js_floor(self.width() / 2.0) + 124.0 + self.scroll_bar_offset
    }

    // JS: slotLeft() { return this.left + Math.floor(this.width / 2) - Math.floor(this.listWidth / 2) + 2; }
    pub fn slot_left(&self) -> f64 {
        self.left + js_floor(self.width() / 2.0) - js_floor(self.list_width / 2.0) + 2.0
    }

    // JS: slotTop(i) { return this.top + 4 - Math.floor(this.amountScrolled) + i * this.slotHeight + this.headerPadding; }
    pub fn slot_top(&self, i: usize, amount_scrolled: f64) -> f64 {
        self.top + 4.0 - js_floor(amount_scrolled) + i as f64 * self.slot_height + self.header_padding
    }

    // JS: clamp() { this.amountScrolled = Math.max(0, Math.min(this.maxScroll(), this.amountScrolled)); }
    pub fn clamp(&self, amount_scrolled: f64, size: usize) -> f64 {
        amount_scrolled.max(0.0).min(self.max_scroll(size))
    }

    // JS: wheel(d) { this.amountScrolled += d * this.slotHeight / 2; this.clamp(); }
    pub fn wheel(&self, amount_scrolled: f64, d: f64, size: usize) -> f64 {
        self.clamp(amount_scrolled + d * self.slot_height / 2.0, size)
    }

    // JS: SlotList.key / GuiSlot scroll-into-view used by option-focus.js:
    //   const y = this.slotTop(this.focusedIndex);
    //   if (y < this.top) this.amountScrolled -= this.top - y;
    //   else if (y + this.slotHeight > this.bottom) this.amountScrolled += y + this.slotHeight - this.bottom;
    //   this.clamp();
    pub fn scroll_index_into_view(&self, amount_scrolled: f64, i: usize, size: usize) -> f64 {
        let y = self.slot_top(i, amount_scrolled);
        let mut next = amount_scrolled;
        if y < self.top {
            next -= self.top - y;
        } else if y + self.slot_height > self.bottom {
            next += y + self.slot_height - self.bottom;
        }
        self.clamp(next, size)
    }

    // JS: option-focus.js scroll-into-view for focused option widgets:
    //   let y = list.slotTop(target.optionRow), delta = y - list.top - 4 - list.slotHeight;
    //   if (delta < 0) list.amountScrolled += delta;
    //   y = list.slotTop(target.optionRow); delta = list.bottom - y - list.slotHeight * 2;
    //   if (delta < 0) list.amountScrolled -= delta;
    //   list.clamp();
    pub fn scroll_row_into_view(&self, amount_scrolled: f64, row: usize, size: usize) -> f64 {
        let y = self.slot_top(row, amount_scrolled);
        let mut next = amount_scrolled;
        let delta = y - self.top - 4.0 - self.slot_height;
        if delta < 0.0 {
            next += delta;
        }
        let y = self.slot_top(row, next);
        let delta = self.bottom - y - self.slot_height * 2.0;
        if delta < 0.0 {
            next -= delta;
        }
        self.clamp(next, size)
    }

    // JS: SlotList.isMouseYWithinSlotBounds -> inside(my, mx)
    pub fn inside(&self, my: f64, mx: f64) -> bool {
        my >= self.top && my <= self.bottom && mx >= self.left && mx <= self.right
    }

    // JS: slotAt(x, y) — index of the slot under the cursor, or -1.
    pub fn slot_at(&self, x: f64, y: f64, size: usize, amount_scrolled: f64) -> i32 {
        if !self.inside(y, x) {
            return -1;
        }
        let i0 = self.left + js_floor(self.width() / 2.0) - js_floor(self.list_width / 2.0);
        let i1 = self.left + js_floor(self.width() / 2.0) + js_floor(self.list_width / 2.0);
        let k = y - self.top - self.header_padding + js_floor(amount_scrolled) - 4.0;
        let l = js_floor(k / self.slot_height);
        let sb = self.scroll_bar_x();
        if x < sb && x >= i0 && x <= i1 && l >= 0.0 && k >= 0.0 && (l as usize) < size {
            l as i32
        } else {
            -1
        }
    }

    // JS: render scrollbar thumb height:
    //   const k1 = Math.max(32, Math.min(h - 8, Math.floor(h * h / this.contentHeight())));
    // (an empty list divides by zero; f64 gives Infinity exactly like JS, and the
    // caller only draws the thumb when maxScroll() > 0)
    pub fn thumb_height(&self, size: usize) -> f64 {
        let h = self.bottom - self.top;
        let raw = js_floor(h * h / self.content_height(size));
        raw.max(32.0).min(h - 8.0)
    }

    // JS: render scrollbar thumb y:
    //   const l1 = Math.max(this.top, Math.floor(Math.floor(this.amountScrolled) * (h - k1) / max) + this.top);
    pub fn thumb_y(&self, amount_scrolled: f64, size: usize) -> f64 {
        let h = self.bottom - self.top;
        let max = self.max_scroll(size).max(1.0);
        let k1 = self.thumb_height(size);
        (js_floor(js_floor(amount_scrolled) * (h - k1) / max) + self.top).max(self.top)
    }
}

// ------------------------------------------------------------------ Tab focusing

/// JS: focusOptionWidgets(screen, event, widgets) — the per-widget state it walks.
#[derive(Clone, Copy, Debug)]
pub struct FocusWidget {
    // JS: b.visible !== false
    pub visible: bool,
    // JS: b.enabled !== false
    pub enabled: bool,
    // JS: b.optionRow (scroll the focused row into view)
    pub option_row: Option<usize>,
}

// JS: focusOptionWidgets (client/js/gui/option-focus.js) — pure half:
// Tab cycles widgets inside each row, skipping invisible/disabled ones. The
// keyboard event plumbing and the `screen.focusedWidget` store stay in JS; this
// returns the next focused widget index (caller clears/sets `focused` flags).
pub fn focus_option_widgets(widgets: &[FocusWidget], focused: Option<usize>, shift: bool) -> Option<usize> {
    if !widgets.iter().any(|b| b.visible && b.enabled) {
        return None; // JS: return false
    }
    let step: isize = if shift { -1 } else { 1 };
    let len = widgets.len() as isize;
    let mut index = match focused {
        Some(i) if (i as isize) < len => i as isize,
        _ => {
            if step < 0 {
                0
            } else {
                -1
            }
        }
    };
    loop {
        index = (index + step + len) % len;
        let b = &widgets[index as usize];
        if b.visible && b.enabled {
            break;
        }
    }
    Some(index as usize)
}

// ------------------------------------------------------------- key binding sort

// JS: const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0; — Java
// String.compareTo, not locale collation. All keys here are ASCII, where
// Rust's byte-wise str order matches UTF-16 code-unit order.
pub fn compare_text(a: &str, b: &str) -> Ordering {
    a.cmp(b)
}

// JS: ControlsScreen.init — keys = Object.keys(KEY_BINDINGS).sort((a, b) => {
//   const ca = KEY_BINDINGS[a][1], cb = KEY_BINDINGS[b][1];
//   const order = VANILLA_UI.categoryOrder;
//   const c = order.length ? order.indexOf(ca) - order.indexOf(cb) : compareText(tr(ca), tr(cb));
//   return c || compareText(tr(KEY_BINDINGS[a][0]), tr(KEY_BINDINGS[b][0]));
// });
// `entries` is a list of (binding, descriptionKey, categoryKey); `category_order`
// is VANILLA_UI.categoryOrder. Missing categories index as -1 (Array.indexOf).
pub fn sort_bindings(
    mut entries: Vec<(&'static str, &'static str, &'static str)>,
    category_order: &[&str],
) -> Vec<(&'static str, &'static str, &'static str)> {
    let cat_index = |cat: &str| -> i32 {
        category_order
            .iter()
            .position(|c| *c == cat)
            .map(|i| i as i32)
            .unwrap_or(-1)
    };
    entries.sort_by(|a, b| {
        let c = cat_index(a.2).wrapping_sub(cat_index(b.2));
        if c != 0 {
            c.cmp(&0)
        } else {
            compare_text(a.1, b.1)
        }
    });
    entries
}

// JS: SnooperScreen.renderContent layout (super.renderContent draws the title at
// y=15): wrapped description lines start at y=23 and step 9, then a translucent
// rect covers (0, top, width, height - 40) and the data rows step 10 from top+4.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SnooperTableLayout {
    pub desc_y0: f64,
    pub line_step: f64,
    pub table_top: f64,
    pub table_height: f64,
    pub row_y0: f64,
    pub row_step: f64,
    pub key_x: f64,
    pub value_x: f64,
}

pub fn snooper_table_layout(desc_line_count: usize, height: f64) -> SnooperTableLayout {
    let top = 23.0 + desc_line_count as f64 * 9.0 + 6.0;
    SnooperTableLayout {
        desc_y0: 23.0,
        line_step: 9.0,
        table_top: top,
        table_height: height - 40.0,
        row_y0: top + 4.0,
        row_step: 10.0,
        key_x: 10.0,
        value_x: 220.0,
    }
}

// --------------------------------------------------------------- wasm exports

// JS: algorithmic core exposed to the JS glue (draft API names kept).
#[wasm_bindgen]
pub fn js_options_fov_label(value: f64) -> String {
    tr_option("options.fov", &fov_label_value(value))
}

#[wasm_bindgen]
pub fn js_options_difficulty_name(difficulty: i32) -> String {
    difficulty_name(difficulty).to_string()
}

#[wasm_bindgen]
pub fn js_options_render_distance_label(value: f64) -> String {
    tr_option("options.renderDistance", &render_distance_label_value(value))
}

#[wasm_bindgen]
pub fn js_options_mouse_wheel_label(value: f64) -> String {
    tr_option("options.mouseWheelSensitivity", &mouse_wheel_label_value(value))
}

#[wasm_bindgen]
pub fn js_options_gamma_label(value: f64) -> String {
    tr_option("options.gamma", &gamma_label_value(value))
}

// ----------------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn js_round_matches_math_round() {
        assert_eq!(js_round(2.5), 3.0);
        assert_eq!(js_round(-2.5), -2.0); // Math.round(-2.5) === -2
        assert_eq!(js_round(-0.5), 0.0);
        assert_eq!(js_round(15.5), 16.0);
        assert_eq!(js_round(2.4), 2.0);
    }

    #[test]
    fn to_fixed2_matches_number_to_fixed() {
        assert_eq!(js_to_fixed2(1.0), "1.00");
        assert_eq!(js_to_fixed2(0.1), "0.10");
        assert_eq!(js_to_fixed2(10.0), "10.00");
        assert_eq!(js_to_fixed2(0.125), "0.13"); // exact tie -> larger n (spec)
    }

    #[test]
    fn fov_label_and_mapping() {
        // JS: f = Math.round(30 + v * 80)
        assert_eq!(fov_label_value(0.0), "30"); // f=30, neither special value
        assert_eq!(fov_label_value(0.5), "options.fov.min"); // f=70
        assert_eq!(fov_label_value(1.0), "options.fov.max"); // f=110
        assert_eq!(fov_label_value(0.25), "50");
        assert_eq!(js_options_fov_label(0.5), "options.fov: options.fov.min");
        assert_eq!(fov_value(70), 0.5);
        assert_eq!(fov_value(110), 1.0);
        assert_eq!(fov_set(0.5), 70);
        assert_eq!(fov_set(1.0), 110);
    }

    #[test]
    fn sensitivity_label() {
        assert_eq!(sensitivity_label_value(0.0), "options.sensitivity.min");
        assert_eq!(sensitivity_label_value(1.0), "options.sensitivity.max");
        assert_eq!(sensitivity_label_value(0.5), "100%"); // Math.round(0.5 * 200)
        assert_eq!(sensitivity_label_value(0.75), "150%");
    }

    #[test]
    fn mouse_wheel_roundtrip() {
        assert_eq!(mouse_wheel_label_value(0.5), "1.00"); // 10 ** 0
        assert_eq!(mouse_wheel_label_value(0.0), "0.10"); // 10 ** -1
        assert_eq!(mouse_wheel_label_value(1.0), "10.00");
        assert_eq!(mouse_wheel_value(1.0), 0.5); // (log10(1)+1)/2
        assert_eq!(mouse_wheel_value(0.0), 0.5); // JS `|| 1`
        assert_eq!(mouse_wheel_value(10.0), 1.0);
        assert_eq!(mouse_wheel_set(0.5), 1.0);
        assert_eq!(mouse_wheel_set(0.0), 0.1);
        assert_eq!(js_options_mouse_wheel_label(0.5), "options.mouseWheelSensitivity: 1.00");
    }

    #[test]
    fn render_distance_mapping() {
        assert_eq!(render_distance_label_value(0.0), "2 chunks");
        assert_eq!(render_distance_label_value(1.0), "32 chunks");
        assert_eq!(render_distance_value(8), 0.2);
        assert_eq!(render_distance_value(2), 0.0);
        assert_eq!(render_distance_set(0.2), 8);
        assert_eq!(render_distance_set(1.0), 32);
        assert_eq!(js_options_render_distance_label(0.0), "options.renderDistance: 2 chunks");
    }

    #[test]
    fn fps_limit_mapping() {
        assert_eq!(fps_limit_label_value(1.0), "options.framerateLimit.max"); // f=260
        assert_eq!(fps_limit_label_value(0.0), "10 fps");
        assert_eq!(fps_limit_label_value(0.5), "135 fps");
        assert_eq!(fps_limit_value(0), 1.0); // unlimited sits at the right end
        assert_eq!(fps_limit_value(120), 0.44);
        assert_eq!(fps_limit_set(1.0), 0);
        assert_eq!(fps_limit_set(0.5), 135);
    }

    #[test]
    fn gamma_mipmap_lod_biome_labels() {
        assert_eq!(gamma_label_value(0.0), "options.gamma.min");
        assert_eq!(gamma_label_value(1.0), "options.gamma.max");
        assert_eq!(gamma_label_value(0.5), "+50%");
        assert_eq!(js_options_gamma_label(0.5), "options.gamma: +50%");

        assert_eq!(mipmap_label_value(0.0), "options.off");
        assert_eq!(mipmap_label_value(1.0), "4");
        assert_eq!(mipmap_value(4), 1.0);
        assert_eq!(mipmap_set(0.5), 2);

        assert_eq!(lod_label_value(0.0), "16 blocks");
        assert_eq!(lod_label_value(1.0), "options.off"); // k=31
        assert_eq!(lod_label_value(0.5), "272 blocks"); // k=16 -> 16+256
        assert_eq!(lod_value(0), 1.0);
        assert_eq!(lod_value(128), 7.0 / 31.0); // min(30, max(0, (128-16)/16)) / 31
        assert_eq!(lod_value(16), 0.0);
        assert_eq!(lod_value(512), 30.0 / 31.0); // clamped to 30 before OFF
        assert_eq!(lod_set(1.0), 0);
        assert_eq!(lod_set(0.5), 272);
        assert_eq!(lod_set(0.0), 16);

        assert_eq!(biome_blend_label_value(0.0), "options.off");
        assert_eq!(biome_blend_label_value(1.0), "15x15"); // r=7
        assert_eq!(biome_blend_label_value(2.0 / 7.0), "5x5"); // r=2
        assert_eq!(biome_blend_value(2), 2.0 / 7.0);
        assert_eq!(biome_blend_set(1.0), 7);
    }

    #[test]
    fn sound_and_chat_formatters() {
        assert_eq!(sound_volume_label_value(0.0), "options.off");
        assert_eq!(sound_volume_label_value(1.0), "100%");
        assert_eq!(sound_volume_label_value(0.25), "25%");
        assert_eq!(percent_label_value(0.5), "50%");
        assert_eq!(chat_opacity_label_value(0.0), "10%"); // (0*.9+.1)*100
        assert_eq!(chat_opacity_label_value(1.0), "100%");
        assert_eq!(chat_scale_label_value(0.5), "50%");
        assert_eq!(chat_width_label_value(1.0), "320px"); // floor(280+40)
        assert_eq!(chat_width_label_value(0.0), "40px");
        assert_eq!(chat_height_label_value(1.0), "180px"); // floor(160+20)
    }

    #[test]
    fn graphics_api_cycle_and_names() {
        assert_eq!(next_graphics_api(GraphicsApi::Webgl2), GraphicsApi::Webgpu);
        assert_eq!(next_graphics_api(GraphicsApi::Webgpu), GraphicsApi::Software);
        assert_eq!(next_graphics_api(GraphicsApi::Software), GraphicsApi::Webgl2);
        assert_eq!(GraphicsApi::Webgl2.display_name(), "WebGL 2");
        assert_eq!(GraphicsApi::Webgpu.display_name(), "WebGPU");
        assert_eq!(
            GraphicsApi::Software.display_name(),
            "Gravrust.options.graphicsApi.software"
        );
        assert_eq!(graphics_api_from_device_name("WebGPU"), GraphicsApi::Webgpu);
        assert_eq!(graphics_api_from_device_name("Software"), GraphicsApi::Software);
        assert_eq!(graphics_api_from_device_name("ANGLE (whatever)"), GraphicsApi::Webgl2);
    }

    #[test]
    fn error_prefix_stripping() {
        assert_eq!(strip_error_prefix("webgpu: device lost"), "device lost");
        assert_eq!(strip_error_prefix("WebGPU: out of memory"), "out of memory"); // /i flag
        assert_eq!(strip_error_prefix("a_b-c9: failed"), "failed");
        assert_eq!(strip_error_prefix("no prefix here"), "no prefix here");
        assert_eq!(strip_error_prefix(": leading colon"), ": leading colon");
        assert_eq!(strip_error_prefix("has space: x"), "has space: x");
    }

    #[test]
    fn narrator_label_and_cycle() {
        assert_eq!(narrator_label(0, true), "options.narrator: options.narrator.off");
        assert_eq!(narrator_label(2, true), "options.narrator: options.narrator.chat");
        assert_eq!(
            narrator_label(0, false),
            "options.narrator: options.narrator.notavailable"
        );
        assert_eq!(narrator_cycle(0, true), 1);
        assert_eq!(narrator_cycle(3, true), 0);
        assert_eq!(narrator_cycle(2, false), 0); // stays off without speech
    }

    #[test]
    fn difficulty_names() {
        assert_eq!(difficulty_name(0), "peaceful");
        assert_eq!(difficulty_name(1), "easy");
        assert_eq!(difficulty_name(2), "normal");
        assert_eq!(difficulty_name(3), "hard");
        assert_eq!(difficulty_name(4), "normal"); // JS: undefined || 'normal'
        assert_eq!(difficulty_name(-1), "normal");
        assert_eq!(js_options_difficulty_name(3), "hard");
    }

    #[test]
    fn grid_and_category_positions() {
        // JS: x = width / 2 - 155 + (i % 2) * 160; y = y0 + 24 * (i >> 1)
        assert_eq!(grid_pos(0, 640.0, 68.0), (165.0, 68.0));
        assert_eq!(grid_pos(1, 640.0, 68.0), (325.0, 68.0));
        assert_eq!(grid_pos(2, 640.0, 68.0), (165.0, 92.0));
        assert_eq!(grid_pos(3, 640.0, 68.0), (325.0, 92.0));
        assert_eq!(grid_pos(10, 640.0, 68.0), (165.0, 188.0)); // i=10 -> row 5, col 0
        // JS: cx + (col ? 5 : -155), h6 + 48 - 6 + 24 * row
        assert_eq!(category_button_pos(0, 0, 320.0, 80.0), (165.0, 122.0));
        assert_eq!(category_button_pos(1, 0, 320.0, 80.0), (325.0, 122.0));
        assert_eq!(category_button_pos(0, 3, 320.0, 80.0), (165.0, 194.0));
        assert_eq!(category_button_pos(1, 3, 320.0, 80.0), (325.0, 194.0));
    }

    #[test]
    fn row_packing_with_wide_options() {
        // The VideoScreen ordered list: biomeBlendRadius (wide) first, then pairs,
        // then the four unkeyed extras in two rows.
        let mut wide = vec![false; 19];
        wide[0] = true; // biomeBlendRadius
        let rows = pack_rows(&wide);
        let sizes: Vec<usize> = rows.iter().map(|r| r.len()).collect();
        assert_eq!(sizes, vec![1, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
        assert_eq!(rows[0], vec![0]);
        assert_eq!(rows[1], vec![1, 2]);
        assert_eq!(rows[9], vec![17, 18]);
        // No wide options: strict pairs (MouseSettingsScreen with 5 options).
        let rows = pack_rows(&[false; 5]);
        assert_eq!(rows, vec![vec![0, 1], vec![2, 3], vec![4]]);
    }

    #[test]
    fn widget_and_slider_math() {
        let r = WidgetRect::new(0, 165.5, 67.9, 150.0, 20.0);
        assert_eq!((r.x, r.y), (165.0, 67.0)); // Button floors coordinates
        assert!(widget_hovered(&r, 165.0, 67.0));
        assert!(widget_hovered(&r, 314.99, 86.99));
        assert!(!widget_hovered(&r, 315.0, 67.0));
        assert!(!widget_hovered(&r, 164.99, 67.0));

        // JS: (mx - (x + 4)) / (w - 8) clamped
        assert_eq!(slider_value_from_mouse(100.0, 150.0, 175.0), 0.5); // 71/142
        assert_eq!(slider_value_from_mouse(100.0, 150.0, 104.0), 0.0);
        assert_eq!(slider_value_from_mouse(100.0, 150.0, 300.0), 1.0);
        assert_eq!(slider_key_step(0.0, 150.0, true), 1.0 / 142.0);
        assert_eq!(slider_key_step(1.0 / 142.0, 150.0, false), 0.0);
        assert_eq!(slider_key_step(1.0, 150.0, true), 1.0);
        assert_eq!(slider_knob_x(165.0, 150.0, 0.5), 165.0 + 71.0);
    }

    #[test]
    fn list_geometry() {
        // MouseSettingsScreen / VideoScreen list: (32, height - 32, 25) with
        // listWidth 400, scrollBarOffset 32.
        let geo = ListGeometry::new(
            640.0,
            32.0,
            448.0,
            25.0,
            &ListOpts {
                list_width: 400.0,
                scroll_bar_offset: 32.0,
                selection_box: false,
                scrollbar_drag_only: true,
                ..ListOpts::default()
            },
        );
        assert_eq!(geo.width(), 640.0);
        assert_eq!(geo.slot_left(), 0.0 + 320.0 - 200.0 + 2.0);
        assert_eq!(geo.scroll_bar_x(), 320.0 + 124.0 + 32.0);
        assert_eq!(geo.slot_top(0, 0.0), 36.0);
        assert_eq!(geo.slot_top(2, 0.0), 86.0);
        assert_eq!(geo.max_scroll(5), 0.0); // 5 * 25 = 125 < 412
        assert_eq!(geo.max_scroll(20), 500.0 - 412.0); // 20 * 25 - (416 - 4)
        assert_eq!(geo.clamp(-5.0, 20), 0.0);
        assert_eq!(geo.clamp(500.0, 20), 88.0);
        assert_eq!(geo.wheel(0.0, 2.0, 20), 25.0); // d * slotHeight / 2
        assert_eq!(geo.slot_at(200.0, 40.0, 20, 0.0), 0);
        assert_eq!(geo.slot_at(200.0, 30.0, 20, 0.0), -1); // above the list
        assert_eq!(geo.slot_at(geo.scroll_bar_x(), 40.0, 20, 0.0), -1); // scrollbar column

        // option-focus.js scroll-into-view of a focused row.
        let scrolled = geo.scroll_row_into_view(0.0, 19, 20);
        // y = slotTop(19) = 32 + 4 - 0 + 19*25 = 511; delta = 511-32-4-25 = 450 > 0;
        // delta2 = 448 - 511 - 50 = -113 < 0 -> amount += 113 -> clamp(113) = 88.
        assert_eq!(scrolled, 88.0);
        let scrolled = geo.scroll_row_into_view(88.0, 0, 20);
        // y = slotTop(0, 88) = 36 - 88 = -52; delta = -52-32-4-25 = -113 < 0 -> 88-113 = -25 -> clamp 0.
        assert_eq!(scrolled, 0.0);
    }

    #[test]
    fn tab_focus_cycles_selectable_widgets() {
        let w = |flags: [(bool, bool, Option<usize>); 4]| -> Vec<FocusWidget> {
            flags
                .iter()
                .map(|&(visible, enabled, option_row)| FocusWidget { visible, enabled, option_row })
                .collect()
        };
        let all = [(true, true, Some(0)), (true, true, Some(0)), (true, true, Some(1)), (true, true, None)];
        // JS: index = widgets.indexOf(focused) (-1 when none), then do { index = (index+step+len) % len } while ...
        assert_eq!(focus_option_widgets(&w(all), None, false), Some(0));
        assert_eq!(focus_option_widgets(&w(all), Some(0), false), Some(1));
        assert_eq!(focus_option_widgets(&w(all), Some(2), false), Some(3));
        assert_eq!(focus_option_widgets(&w(all), Some(3), false), Some(0)); // wraps
        assert_eq!(focus_option_widgets(&w(all), Some(1), true), Some(0)); // shift goes back
        assert_eq!(focus_option_widgets(&w(all), Some(0), true), Some(3));
        // Disabled and invisible widgets are skipped (index 1 here).
        let skip = [(true, true, Some(0)), (true, false, Some(1)), (false, true, Some(1)), (true, true, Some(2))];
        assert_eq!(focus_option_widgets(&w(skip), Some(0), false), Some(3));
        assert_eq!(focus_option_widgets(&w(skip), Some(3), true), Some(0));
        // JS: return false when nothing is selectable.
        let none = [(true, false, None), (false, true, None), (true, false, None), (false, false, None)];
        assert_eq!(focus_option_widgets(&w(none), None, false), None);
    }

    #[test]
    fn binding_sort_uses_category_order_then_text() {
        let entries: Vec<(&'static str, &'static str, &'static str)> = vec![
            ("zoom", "Gravrust.key.zoom", "key.categories.misc"),
            ("sprint", "key.sprint", "key.categories.movement"),
            ("attack", "key.attack", "key.categories.gameplay"),
            ("forward", "key.forward", "key.categories.movement"),
            ("fullscreen", "key.fullscreen", "key.categories.misc"),
            ("hotbar1", "key.hotbar.1", "key.categories.inventory"),
        ];
        let order = [
            "key.categories.movement",
            "key.categories.gameplay",
            "key.categories.inventory",
            "key.categories.creative",
            "key.categories.multiplayer",
            "key.categories.ui",
            "key.categories.misc",
        ];
        let sorted = sort_bindings(entries, &order);
        let names: Vec<&str> = sorted.iter().map(|e| e.0).collect();
        // misc sorts by description text: 'G' (0x47) < 'k' (0x6b), so
        // "Gravrust.key.zoom" precedes "key.fullscreen" (Java compareTo, not locale).
        assert_eq!(
            names,
            vec!["forward", "sprint", "attack", "hotbar1", "zoom", "fullscreen"]
        );
        assert_eq!(compare_text("a", "b"), Ordering::Less);
        assert_eq!(compare_text("b", "a"), Ordering::Greater);
        assert_eq!(compare_text("a", "a"), Ordering::Equal);
    }

    #[test]
    fn snooper_layout() {
        let layout = snooper_table_layout(3, 480.0);
        assert_eq!(layout.desc_y0, 23.0);
        assert_eq!(layout.line_step, 9.0);
        assert_eq!(layout.table_top, 23.0 + 27.0 + 6.0); // y + 6 after the lines
        assert_eq!(layout.table_height, 440.0); // height - 40
        assert_eq!(layout.row_y0, layout.table_top + 4.0);
        assert_eq!(layout.row_step, 10.0);
        assert_eq!(layout.value_x, 220.0);
    }
}
