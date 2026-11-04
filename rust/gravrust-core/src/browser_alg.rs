//! Port of `client/js/platform/browser.js`: pure algorithmic sections.
//!
//! `browser.js` mixes browser DOM/network calls with self-contained state
//! machines and math. This module ports the portable parts verbatim so they can
//! be unit-tested and reused; `browser.rs` owns the browser-bound calls and
//! feeds them through these functions. Every function below names its JS origin.
//!
//! Contents (in `browser.js` order):
//! - `POTATO_PIXELS`, `_resize()` layout math (`resize_layout`, `potato_size`, `px_scale`)
//! - `Emitter` / `SocketEmitter` (the event machinery `BrowserPlatform extends`)
//! - wheel delta normalization, keydown blocking/decoding, mouse coordinate scaling
//! - `launchParams()` URLSearchParams parsing
//! - `info()` user-agent decoding
//! - `createGraphicsDevice()` ordering + fallback state machine
//! - `loadConfig()` merge + `postJson` response pairing
//! - `embeddedAssets()` decoding (base85 / base64)
//! - `IdbFiles` legacy-migration decision, `hasTouchscreen`, `cpuCount`,
//!   `WebAudio.play` option resolution, the vsync-off `MessageChannel` frame
//!   queue, the `launchParams` object fold and the `fetchJson` error string

use std::collections::HashMap;

use once_cell::sync::Lazy;
use regex::Regex;
use wasm_bindgen::prelude::*;

use crate::platform_contract::{
    GraphicsSelection, KeydownEvent, MemoryInfo, PlatformInfo, PlayOptions, PostJsonResponse,
};

// JS: `const POTATO_PIXELS = 854 * 480; // Super Potato Mode: internal resolution cap`
pub const POTATO_PIXELS: u32 = 854 * 480;

// JS: `const dpr = window.devicePixelRatio || 1;` — JS truthiness for numbers:
// 0, NaN (and -0) fall back.
#[inline]
pub fn truthy_or(value: f64, fallback: f64) -> f64 {
    if value == 0.0 || value.is_nan() {
        fallback
    } else {
        value
    }
}

/// JS: `e.movementX || 0` (a falsy delta becomes 0; `-0` becomes `0` like JS).
#[inline]
pub fn truthy_or_zero(value: f64) -> f64 {
    truthy_or(value, 0.0)
}

// ---------------------------------------------------------------- resize math

/// Result of JS `_resize()` for one pass. The canvas CSS size is set from the
/// full-resolution backing store *before* potato scaling shrinks the canvas.
#[derive(Clone, Debug, PartialEq)]
pub struct ResizeLayout {
    /// JS: `this.dpr = dpr`.
    pub dpr: f64,
    /// JS: `canvas.style.width = (w / dpr) + 'px'` (pre-potato, may be fractional).
    pub css_width: f64,
    pub css_height: f64,
    /// JS: `canvas.width` / `device.resize(w, h)` (post-potato).
    pub width: u32,
    pub height: u32,
    /// JS: `canvas.style.imageRendering = this.potato ? 'pixelated' : ''`.
    pub image_rendering: &'static str,
}

/// JS: `const s = Math.min(1, Math.sqrt(POTATO_PIXELS / (w * h)));`
/// `w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));`
pub fn potato_size(w: u32, h: u32) -> (u32, u32) {
    let s = (1.0f64).min((POTATO_PIXELS as f64 / (w as f64 * h as f64)).sqrt());
    let scaled_w = (w as f64 * s).round() as u32;
    let scaled_h = (h as f64 * s).round() as u32;
    (scaled_w.max(1), scaled_h.max(1))
}

/// JS `_resize()` core math. Reads come from the `window` snapshot the caller
/// provides (`window.devicePixelRatio || 1`, `Math.max(1, window.innerWidth)`).
///
/// JS sets `canvas.width = NaN` to `0` for a NaN viewport; that cannot happen
/// with a real `innerWidth`, and Rust clamps it to 1 instead (documented).
pub fn resize_layout(inner_width: f64, inner_height: f64, dpr_raw: f64, potato: bool) -> ResizeLayout {
    // JS: `const dpr = window.devicePixelRatio || 1;`
    let dpr = truthy_or(dpr_raw, 1.0);
    // JS: `const cw = Math.max(1, window.innerWidth), ch = Math.max(1, window.innerHeight);`
    let cw = inner_width.max(1.0);
    let ch = inner_height.max(1.0);
    // JS: `let w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));`
    let w = ((cw * dpr).round() as u32).max(1);
    let h = ((ch * dpr).round() as u32).max(1);
    // JS: `this.canvas.style.width = (w / dpr) + 'px';` (before potato scaling)
    let css_width = w as f64 / dpr;
    let css_height = h as f64 / dpr;
    let (width, height) = if potato { potato_size(w, h) } else { (w, h) };
    ResizeLayout {
        dpr,
        css_width,
        css_height,
        width,
        height,
        image_rendering: if potato { "pixelated" } else { "" },
    }
}

/// JS: `this.pxScale = this.canvas.width / cw;` — canvas pixels per CSS pixel
/// for mouse positions (the software device renders below device resolution).
pub fn px_scale(canvas_width: f64, css_width: f64) -> f64 {
    canvas_width / css_width
}

/// JS: `e.deltaY / (e.deltaMode === 0 ? 100 : e.deltaMode === 1 ? 3 : 1)`, guarded
/// by `if (e.deltaY)` — a falsy delta emits nothing (`None`).
pub fn wheel_delta(delta_y: f64, delta_mode: f64) -> Option<f64> {
    if delta_y == 0.0 || delta_y.is_nan() {
        return None;
    }
    let divisor = if delta_mode == 0.0 {
        100.0
    } else if delta_mode == 1.0 {
        3.0
    } else {
        1.0
    };
    Some(delta_y / divisor)
}

// ---------------------------------------------------------------- emitters

/// JS: `class Emitter { constructor() { this.handlers = {}; }
/// on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
/// emit(ev, a) { const h = this.handlers[ev]; if (h) for (const fn of h) fn(a); } }`
pub struct Emitter<A> {
    handlers: HashMap<String, Vec<Box<dyn FnMut(&A)>>>,
}

impl<A> Emitter<A> {
    pub fn new() -> Self {
        Emitter {
            handlers: HashMap::new(),
        }
    }

    /// JS: `on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }`
    pub fn on(&mut self, event: &str, handler: Box<dyn FnMut(&A)>) {
        self.handlers.entry(event.to_string()).or_default().push(handler);
    }

    /// JS: `emit(ev, a) { const h = this.handlers[ev]; if (h) for (const fn of h) fn(a); }`
    ///
    /// Handlers are taken out while emitting (Rust cannot iterate them
    /// reentrantly). A handler registered *during* an emit keeps the overall
    /// registration order but runs from the next emit onward — the JS loop over
    /// the live array would call it in the same pass (documented deviation).
    pub fn emit(&mut self, event: &str, payload: &A) {
        let mut taken = match self.handlers.remove(event) {
            Some(handlers) => handlers,
            None => return,
        };
        for handler in taken.iter_mut() {
            handler(payload);
        }
        // Original handlers keep their order; anything registered during the
        // emit is appended after them.
        let mut restored = taken;
        restored.extend(self.handlers.remove(event).unwrap_or_default());
        self.handlers.insert(event.to_string(), restored);
    }

    /// JS: `this.handlers[ev]?.length` — used by `SocketEmitter.emit`.
    pub fn has_handlers(&self, event: &str) -> bool {
        self.handlers.get(event).map_or(false, |handlers| !handlers.is_empty())
    }

    /// Number of handlers registered for an event (test/inspection helper).
    pub fn handler_count(&self, event: &str) -> usize {
        self.handlers.get(event).map_or(0, Vec::len)
    }
}

impl<A> Default for Emitter<A> {
    fn default() -> Self {
        Emitter::new()
    }
}

/// JS: `class SocketEmitter extends Emitter` — server-first protocols (Wisp) can
/// send their greeting in the same network turn as open. Keep those events until
/// the caller of openSocket has installed its listeners:
///
/// ```js
/// on(ev, fn) {
///   super.on(ev, fn);
///   const pending = this.pending[ev];
///   delete this.pending[ev];
///   if (pending) for (const value of pending) fn(value);
/// }
/// emit(ev, value) {
///   if (this.handlers[ev]?.length) super.emit(ev, value);
///   else (this.pending[ev] ||= []).push(value);
/// }
/// ```
pub struct SocketEmitter<A> {
    emitter: Emitter<A>,
    pending: HashMap<String, Vec<A>>,
}

impl<A> SocketEmitter<A> {
    pub fn new() -> Self {
        SocketEmitter {
            emitter: Emitter::new(),
            pending: HashMap::new(),
        }
    }

    /// JS `on`: register, then replay this event's buffered values (in order)
    /// through the freshly installed handler. Values only buffer while an event
    /// has no handlers, so replaying via the emitter reaches exactly that handler.
    pub fn on(&mut self, event: &str, handler: Box<dyn FnMut(&A)>) {
        self.emitter.on(event, handler);
        if let Some(queued) = self.pending.remove(event) {
            for value in &queued {
                self.emitter.emit(event, value);
            }
        }
    }

    /// JS `emit`: deliver when handled, buffer otherwise.
    pub fn emit(&mut self, event: &str, value: A) {
        if self.emitter.has_handlers(event) {
            self.emitter.emit(event, &value);
        } else {
            self.pending.entry(event.to_string()).or_default().push(value);
        }
    }

    /// How many values are buffered for an event (JS: `this.pending[ev]`).
    pub fn pending_len(&self, event: &str) -> usize {
        self.pending.get(event).map_or(0, Vec::len)
    }

    /// Number of handlers registered for an event.
    pub fn handler_count(&self, event: &str) -> usize {
        self.emitter.handler_count(event)
    }
}

impl<A> Default for SocketEmitter<A> {
    fn default() -> Self {
        SocketEmitter::new()
    }
}

// ---------------------------------------------------------------- key handling

/// JS: `const block = ['Tab', 'F1', 'F2', 'F3', 'F5', 'F11', 'Space', 'Slash',
/// 'Quote', 'Backspace', 'Escape', 'ArrowUp', 'ArrowDown'];`
pub const BLOCKED_KEYS: &[&str] = &[
    "Tab", "F1", "F2", "F3", "F5", "F11", "Space", "Slash", "Quote", "Backspace", "Escape",
    "ArrowUp", "ArrowDown",
];

/// JS: `e.ctrlKey && ['KeyW', 'KeyS', 'KeyD', 'KeyF', 'KeyB', 'Equal', 'Minus',
/// 'NumpadAdd', 'NumpadSubtract', 'Digit0'].includes(e.code)`
pub const CTRL_BLOCKED_CODES: &[&str] = &[
    "KeyW", "KeyS", "KeyD", "KeyF", "KeyB", "Equal", "Minus", "NumpadAdd", "NumpadSubtract",
    "Digit0",
];

/// JS keydown handler: `if (block.includes(e.code) || (e.ctrlKey && [...].includes(e.code)))
/// e.preventDefault();`
pub fn should_prevent_default(code: &str, ctrl: bool) -> bool {
    BLOCKED_KEYS.contains(&code) || (ctrl && CTRL_BLOCKED_CODES.contains(&code))
}

/// JS keydown handler body, in emit order:
///
/// ```js
/// this.emit('keydown', { code: e.code, key: e.key, repeat: e.repeat, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey });
/// if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) this.emit('char', e.key);
/// ```
///
/// Returns the keydown payload and, when present, the char to emit afterwards.
/// JS `key.length` counts UTF-16 code units, so an astral character (emoji) has
/// length 2 and emits no char — mirrored via the UTF-16 encoding width.
pub fn decode_keydown(
    code: &str,
    key: &str,
    repeat: bool,
    ctrl_key: bool,
    meta_key: bool,
    shift_key: bool,
    alt_key: bool,
) -> (KeydownEvent, Option<String>) {
    let event = KeydownEvent {
        code: code.to_string(),
        key: key.to_string(),
        repeat,
        ctrl: ctrl_key || meta_key,
        shift: shift_key,
        alt: alt_key,
    };
    let char_emitted = if key.encode_utf16().count() == 1 && !ctrl_key && !meta_key {
        Some(key.to_string())
    } else {
        None
    };
    (event, char_emitted)
}

/// JS: `e.clientX * (this.pxScale || this.dpr)` — client coordinates to canvas
/// pixels (a falsy `pxScale` falls back to the DPR).
pub fn mouse_coord(client: f64, px_scale: f64, dpr: f64) -> f64 {
    client * truthy_or(px_scale, dpr)
}

// ---------------------------------------------------------------- launch params

/// JS: `launchParams() { const out = {}; for (const [k, v] of new
/// URLSearchParams(location.search)) out[k] = v; return out; }`
///
/// Iteration order and duplicates are preserved here (the WHATWG parser skips
/// empty `&`-separated pieces, splits at the first `=`, turns `+` into a space
/// and percent-decodes both sides); `launch_params()` in `browser.rs` folds the
/// pairs into a map like the JS object assignment does.
pub fn parse_url_params(search: &str) -> Vec<(String, String)> {
    // `new URLSearchParams` ignores a single leading '?'.
    let input = search.strip_prefix('?').unwrap_or(search);
    let mut out = Vec::new();
    for piece in input.split('&') {
        if piece.is_empty() {
            continue;
        }
        let (name, value) = match piece.find('=') {
            Some(eq) => (&piece[..eq], &piece[eq + 1..]),
            None => (piece, ""),
        };
        out.push((percent_decode(name), percent_decode(value)));
    }
    out
}

/// WHATWG `application/x-www-form-urlencoded` percent-decoding: `+` is a space,
/// `%XX` decodes when both digits are hex (invalid escapes stay literal), and
/// the bytes are UTF-8 decoded (lossy, matching the JS string result).
pub fn percent_decode(input: &str) -> String {
    let bytes: Vec<u8> = input.bytes().map(|b| if b == b'+' { b' ' } else { b }).collect();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(high), Some(low)) = (hex_value(bytes[i + 1]), hex_value(bytes[i + 2])) {
                out.push(high * 16 + low);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// JS: `out[k] = v` in `launchParams()` — the URLSearchParams pairs fold into a
/// plain object, so a repeated key keeps its LAST value.
pub fn fold_params(pairs: &[(String, String)]) -> HashMap<String, String> {
    let mut out = HashMap::new();
    for (key, value) in pairs {
        out.insert(key.clone(), value.clone());
    }
    out
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

/// JS: `originSocketUrl()` — the proxy at the page's own server, or null for
/// file:// pages:
///
/// ```js
/// if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
/// return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/`;
/// ```
pub fn origin_socket_url(protocol: &str, host: &str) -> Option<String> {
    match protocol {
        "https:" => Some(format!("wss://{host}/")),
        "http:" => Some(format!("ws://{host}/")),
        _ => None,
    }
}

/// JS: `location.protocol === 'http:' || location.protocol === 'https:'`
/// (used by `loadConfig` to decide whether to fetch `config.json`).
pub fn is_http_like(protocol: &str) -> bool {
    protocol == "http:" || protocol == "https:"
}

// ---------------------------------------------------------------- info()

static RUNTIME_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(Edg|Firefox|Chrome|Safari)/([\d.]+)").unwrap());
static BITS_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"(?i)x64|Win64|WOW64|x86_64|aarch64|arm64").unwrap());

/// JS: `runtime: m ? (m[1] === 'Edg' ? 'Edge' : m[1]) + ' ' + m[2].split('.')[0] : 'Browser'`
/// — leftmost regex match, engine name with the `Edg` → `Edge` rename, major version.
pub fn ua_runtime(ua: &str) -> String {
    match RUNTIME_RE.captures(ua) {
        Some(caps) => {
            let name = if &caps[1] == "Edg" { "Edge" } else { &caps[1] };
            let major = caps[2].split('.').next().unwrap_or("");
            format!("{name} {major}")
        }
        None => "Browser".to_string(),
    }
}

/// JS: `bits: /x64|Win64|WOW64|x86_64|aarch64|arm64/i.test(ua) ? 64 : 32`.
pub fn ua_bits(ua: &str) -> u32 {
    if BITS_RE.is_match(ua) {
        64
    } else {
        32
    }
}

/// JS: `cpu: (navigator.hardwareConcurrency || '?') + 'x ' +
/// ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || 'CPU')`
pub fn format_cpu(
    hardware_concurrency: Option<u32>,
    ua_platform: Option<&str>,
    nav_platform: Option<&str>,
) -> String {
    let cores = match hardware_concurrency {
        Some(cores) if cores != 0 => cores.to_string(),
        _ => "?".to_string(),
    };
    let label = ua_platform
        .filter(|label| !label.is_empty())
        .or_else(|| nav_platform.filter(|label| !label.is_empty()))
        .unwrap_or("CPU");
    format!("{cores}x {label}")
}

/// JS `info()` — assembles the debug-screen record from navigator data.
pub fn runtime_info(
    ua: &str,
    hardware_concurrency: Option<u32>,
    ua_platform: Option<&str>,
    nav_platform: Option<&str>,
    memory: Option<MemoryInfo>,
) -> PlatformInfo {
    PlatformInfo {
        runtime: ua_runtime(ua),
        bits: ua_bits(ua),
        memory,
        cpu: format_cpu(hardware_concurrency, ua_platform, nav_platform),
    }
}

// ---------------------------------------------------------------- network helpers

/// JS: `try { json = await r.json(); } catch (e) { json = null; }`
pub fn parse_json_or_none(text: &str) -> Option<serde_json::Value> {
    serde_json::from_str(text).ok()
}

/// JS: `postJson` resolves `{ status: r.status, json }` — `json` is null when
/// the body fails to parse (or is empty).
pub fn parse_post_json(status: u16, body: Option<&str>) -> PostJsonResponse {
    PostJsonResponse {
        status,
        json: body.and_then(parse_json_or_none),
    }
}

/// JS: ``fetchJson(path)`` rejects with ``new Error(`Failed to load ${path} (${r.status})`)``
/// when the response is not ok — this builds that exact message.
pub fn fetch_json_error(path: &str, status: u16) -> String {
    format!("Failed to load {path} ({status})")
}

// ---------------------------------------------------------------- graphics device

/// JS: `const order = preference === 'webgpu' ? ['webgpu', 'webgl2', 'software']
/// : preference === 'software' ? ['software'] : ['webgl2', 'webgpu', 'software'];`
pub fn device_order(preference: &str) -> Vec<&'static str> {
    match preference {
        "webgpu" => vec!["webgpu", "webgl2", "software"],
        "software" => vec!["software"],
        _ => vec!["webgl2", "webgpu", "software"],
    }
}

/// JS `createGraphicsDevice(preference = 'auto')` loop:
///
/// ```js
/// for (const [k, api] of order.entries()) {
///   if (k > 0) this.replaceSurface();
///   try {
///     this.device = await <create>(this.canvas);
///     this.device.graphicsSelection = { requested: preference, active: api, errors: [...errors] };
///     this._resize();
///     return this.device;
///   } catch (e) {
///     console.warn(api + ' unavailable:', e.message);
///     errors.push(api + ': ' + e.message);
///   }
/// }
/// throw new Error('No graphics API could be initialized (' + errors.join('; ') + ')');
/// ```
///
/// `make(api)` creates a device for `'webgl2' | 'webgpu' | 'software'`
/// (browser-bound); `on_switch` is `replaceSurface()`. `warnings` collects the
/// `console.warn` lines in emit order.
pub fn create_graphics_device_fallback<D>(
    preference: &str,
    mut make: impl FnMut(&str) -> Result<D, String>,
    mut on_switch: impl FnMut(),
    warnings: &mut Vec<String>,
) -> Result<(D, GraphicsSelection), String> {
    let order = device_order(preference);
    let mut errors: Vec<String> = Vec::new();
    for (k, api) in order.iter().enumerate() {
        if k > 0 {
            on_switch();
        }
        match make(api) {
            Ok(device) => {
                // JS: errors is snapshotted at success time ([...errors]).
                return Ok((
                    device,
                    GraphicsSelection {
                        requested: preference.to_string(),
                        active: (*api).to_string(),
                        errors: errors.clone(),
                    },
                ));
            }
            Err(message) => {
                warnings.push(format!("{api} unavailable: {message}"));
                errors.push(format!("{api}: {message}"));
            }
        }
    }
    Err(format!(
        "No graphics API could be initialized ({})",
        errors.join("; ")
    ))
}

// ---------------------------------------------------------------- config

/// JS: `config = { ...config, ...(await r.json()) }` — a shallow override.
pub fn merge_config(
    base: &serde_json::Map<String, serde_json::Value>,
    over: &serde_json::Map<String, serde_json::Value>,
) -> serde_json::Map<String, serde_json::Value> {
    let mut merged = base.clone();
    for (key, value) in over {
        merged.insert(key.clone(), value.clone());
    }
    merged
}

/// JS `loadConfig()`:
///
/// ```js
/// let config = {};
/// const el = document.getElementById('Gravrust-config');
/// if (el) { try { config = JSON.parse(el.textContent); } catch (e) { console.warn('Bad embedded config', e); } }
/// if (location.protocol === 'http:' || location.protocol === 'https:') {
///   try {
///     const r = await fetch('config.json', { cache: 'no-cache' });
///     if (r.ok) config = { ...config, ...(await r.json()) };
///   } catch (e) { console.warn('Could not read config.json:', e.message); }
/// }
/// return config;
/// ```
///
/// The element text and the fetch result are passed in (browser-bound); the
/// parse/fallback/merge order and the warning strings are preserved. A parsed
/// non-object (JS spreads it to no keys) contributes nothing.
pub fn load_config_logic(
    embedded_text: Option<&str>,
    can_fetch: bool,
    fetch_config_json: impl FnOnce() -> Result<Option<serde_json::Value>, String>,
    warnings: &mut Vec<String>,
) -> serde_json::Map<String, serde_json::Value> {
    let mut config = serde_json::Map::new();
    if let Some(text) = embedded_text {
        match serde_json::from_str::<serde_json::Value>(text) {
            Ok(value) => {
                if let Some(object) = value.as_object() {
                    config = object.clone();
                }
            }
            Err(error) => warnings.push(format!("Bad embedded config {error}")),
        }
    }
    if can_fetch {
        match fetch_config_json() {
            Ok(Some(json)) => {
                if let Some(object) = json.as_object() {
                    config = merge_config(&config, object);
                }
            }
            // JS: `if (r.ok)` — a not-ok response leaves the config unchanged.
            Ok(None) => {}
            Err(message) => warnings.push(format!("Could not read config.json: {message}")),
        }
    }
    config
}

// ---------------------------------------------------------------- embedded assets

const INVALID_PACKED_DATA_LENGTH: &str = "Invalid packed data length";
const INVALID_PACKED_DATA: &str = "Invalid packed data";
const INVALID_PACKED_WORD: &str = "Invalid packed word";

/// JS `embeddedAssets()` decode step (the `#Gravrust-assets` element read and
/// `el.remove()` stay browser-bound; `text` is `el.textContent`):
///
/// ```js
/// if (el.dataset.encoding === 'base85') this._embedded = decodeBase85(text, Number(el.dataset.bytes));
/// else if (Uint8Array.fromBase64) this._embedded = Uint8Array.fromBase64(text);
/// else { const bin = atob(text); … charCodeAt loop … }
/// ```
///
/// The JS base85 decoder *throws* on bad data — `'Invalid packed data length'`
/// (unsafe/negative length, or `text.length !== Math.ceil(length/4)*5`),
/// `'Invalid packed data'` (a character outside the 85-symbol alphabet) and
/// `'Invalid packed word'` (a chunk value above 32 bits) — which propagates out
/// of `embeddedAssets`; modelled as `Err`. `Number(dataset.bytes)`
/// semantics: `undefined` → NaN and `''` → 0; both must be safe non-negative
/// integers. Both base64 branches decode standard base64, replaced by the Rust
/// base64 module.
pub fn decode_embedded_assets(
    encoding: Option<&str>,
    bytes_attr: Option<&str>,
    text: &str,
) -> Result<Vec<u8>, String> {
    // JS: `const text = el.textContent.trim();`
    let text = text.trim();
    if encoding == Some("base85") {
        let raw = match bytes_attr {
            None => return Err(INVALID_PACKED_DATA_LENGTH.to_string()),
            Some(raw) => {
                let trimmed = raw.trim();
                if trimmed.is_empty() {
                    0.0 // Number('') === 0
                } else {
                    trimmed
                        .parse::<f64>()
                        .map_err(|_| INVALID_PACKED_DATA_LENGTH.to_string())?
                }
            }
        };
        // JS: `Number.isSafeInteger(length) && length >= 0`
        let is_safe_integer =
            raw.is_finite() && raw.fract() == 0.0 && raw.abs() <= 9007199254740991.0;
        if !is_safe_integer || raw < 0.0 {
            return Err(INVALID_PACKED_DATA_LENGTH.to_string());
        }
        // A length above the addressable byte count can never match the payload
        // (relevant on 32-bit targets, where JS lengths up to 2^53 are legal).
        if raw > usize::MAX as f64 {
            return Err(INVALID_PACKED_DATA_LENGTH.to_string());
        }
        let length = raw as usize;
        // JS: `text.length !== Math.ceil(length/4)*5` -> 'Invalid packed data
        // length'. Base85 payloads are ASCII, so byte length equals JS `text.length`.
        if text.len() != length.div_ceil(4) * 5 {
            return Err(INVALID_PACKED_DATA_LENGTH.to_string());
        }
        // JS: `const n = table[text.charCodeAt(i+j)]; if (n === undefined || n < 0)
        // throw Error('Invalid packed data');` — a character outside the 85-symbol
        // alphabet (char codes 33..=120 except '&', '<', '>').
        let in_alphabet = |b: u8| (33..=120).contains(&b) && b != b'&' && b != b'<' && b != b'>';
        if !text.bytes().all(in_alphabet) {
            return Err(INVALID_PACKED_DATA.to_string());
        }
        // JS: `if (value > 0xffffffff) throw Error('Invalid packed word');` — with
        // the length and the alphabet verified above, this is the only failure left.
        crate::base85::decode_base85(text, length).ok_or_else(|| INVALID_PACKED_WORD.to_string())
    } else {
        // JS: Uint8Array.fromBase64 (or the atob fallback).
        Ok(crate::base64::base64_decode(text))
    }
}

// ---------------------------------------------------------------- IdbFiles decision

/// JS (IdbFiles constructor): the legacy database ('minekampf') is copied into
/// the new one ('Gravrust') only when the new store is empty *and* the legacy
/// store has entries — `if (!existing.length) { … if (entries.length) { put all } }`.
/// The whole migration is best-effort (failures swallowed, `catch (e) {}`).
pub fn legacy_copy_required(existing_len: usize, legacy_len: usize) -> bool {
    existing_len == 0 && legacy_len > 0
}

// ---------------------------------------------------------------- misc

/// JS: `get hasTouchscreen() { return (navigator.maxTouchPoints || 0) > 0 ||
/// !!globalThis.matchMedia?.('(any-pointer: coarse)').matches; }` — used for the
/// initial Touchscreen Mode default; explicit user preferences win.
/// `None` models an absent navigator / matchMedia.
pub fn has_touchscreen(max_touch_points: Option<u32>, coarse_pointer: Option<bool>) -> bool {
    max_touch_points.unwrap_or(0) > 0 || coarse_pointer.unwrap_or(false)
}

/// JS: `get cpuCount() { return (typeof navigator !== 'undefined' &&
/// navigator.hardwareConcurrency) || 4; }` — logical CPU cores (sizes the mesh
/// worker pool). A falsy count (absent or 0) falls back to 4.
pub fn cpu_count(hardware_concurrency: Option<u32>) -> u32 {
    match hardware_concurrency {
        Some(cores) if cores != 0 => cores,
        _ => 4,
    }
}

/// One panner node of the JS play chain (`equalpower`, `linear` distance model,
/// `refDistance 1`, `rolloffFactor 1` are constant and stay browser-bound).
#[derive(Clone, Debug, PartialEq)]
pub struct PannerSetup {
    /// JS: `p.maxDistance = opts.maxDistance || 16`.
    pub max_distance: f64,
    /// JS: `p.positionX/Y/Z.value = opts.pos[0..3]` (or `setPosition(...pos)`).
    pub position: [f64; 3],
}

/// The resolved node parameters of JS `WebAudio.play(buffer, opts)`.
#[derive(Clone, Debug, PartialEq)]
pub struct PlayChain {
    /// JS: `src.playbackRate.value = opts.pitch || 1`.
    pub playback_rate: f64,
    /// JS: `gain.gain.value = opts.volume === undefined ? 1 : opts.volume`.
    pub gain: f64,
    /// JS: `if (opts.pos) { …gain.connect(p); out = p; }` — panner present only
    /// when a position was given.
    pub panner: Option<PannerSetup>,
}

/// JS `WebAudio.play` option resolution (the node graph wiring itself is
/// browser-bound: `src → gain → [panner] → master → destination`, then `src.start()`).
pub fn play_chain(opts: &PlayOptions) -> PlayChain {
    let playback_rate = match opts.pitch {
        Some(pitch) => truthy_or(pitch, 1.0),
        None => 1.0,
    };
    let gain = opts.volume.unwrap_or(1.0);
    let panner = opts.pos.map(|position| PannerSetup {
        max_distance: match opts.max_distance {
            Some(distance) => truthy_or(distance, 16.0),
            None => 16.0,
        },
        position,
    });
    PlayChain {
        playback_rate,
        gain,
        panner,
    }
}

// ---------------------------------------------------------------- vsync-off frame pump

/// JS `requestFrame` with `vsync === false`: frames queue on a MessageChannel
/// and all run on one message with the same `performance.now()` timestamp.
/// The channel creation/post is browser-bound (`this._mc.port2.postMessage(0)`);
/// this struct is the queue state machine.
#[derive(Default)]
pub struct FrameQueue {
    queue: Vec<Box<dyn FnOnce(f64)>>,
}

impl FrameQueue {
    pub fn new() -> Self {
        FrameQueue { queue: Vec::new() }
    }

    /// JS: `this._mcq.push(fn); if (this._mcq.length === 1) this._mc.port2.postMessage(0);`
    /// — returns whether the caller must post to the channel (empty → non-empty).
    pub fn push(&mut self, frame: Box<dyn FnOnce(f64)>) -> bool {
        self.queue.push(frame);
        self.queue.len() == 1
    }

    /// JS: `const q = this._mcq; this._mcq = []; const t = performance.now();
    /// for (const f of q) f(t);` — returns the number of frames run; every frame
    /// observes the same timestamp. A frame queued from inside a frame goes to
    /// the fresh queue and triggers a new post (JS parity).
    pub fn drain(&mut self, now: f64) -> usize {
        let queue = std::mem::take(&mut self.queue);
        let count = queue.len();
        for frame in queue {
            frame(now);
        }
        count
    }

    pub fn len(&self) -> usize {
        self.queue.len()
    }

    pub fn is_empty(&self) -> bool {
        self.queue.is_empty()
    }
}

// ---------------------------------------------------------------- wasm kernels

/// JS `_resize()` math as a WASM kernel: returns
/// `[dpr, cssWidth, cssHeight, width, height, pxScale]` for the no-device path
/// (`pxScale = canvas.width / cw`; with a device the caller substitutes the
/// device's own `canvas.width`).
#[wasm_bindgen]
pub fn browser_potato_layout(inner_width: f64, inner_height: f64, dpr: f64, potato: bool) -> Vec<f64> {
    let layout = resize_layout(inner_width, inner_height, dpr, potato);
    let cw = inner_width.max(1.0);
    vec![
        layout.dpr,
        layout.css_width,
        layout.css_height,
        layout.width as f64,
        layout.height as f64,
        px_scale(layout.width as f64, cw),
    ]
}

/// JS wheel normalization as a WASM kernel (0 models the suppressed emit).
#[wasm_bindgen]
pub fn browser_wheel_delta(delta_y: f64, delta_mode: f64) -> f64 {
    wheel_delta(delta_y, delta_mode).unwrap_or(0.0)
}

/// JS keydown blocking as a WASM kernel.
#[wasm_bindgen]
pub fn browser_key_prevent_default(code: &str, ctrl: bool) -> bool {
    should_prevent_default(code, ctrl)
}

// ---------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;

    #[test]
    fn potato_pixels_matches_the_js_constant() {
        // JS: `const POTATO_PIXELS = 854 * 480;` — the internal resolution cap.
        assert_eq!(POTATO_PIXELS, 854 * 480);
        assert_eq!(POTATO_PIXELS, 409_920);
    }

    #[test]
    fn resize_matches_device_pixels_one_to_one() {
        // 1920x1080 window at dpr 1: backing store equals CSS pixels, pxScale 1.
        let layout = resize_layout(1920.0, 1080.0, 1.0, false);
        assert_eq!(layout.dpr, 1.0);
        assert_eq!(layout.width, 1920);
        assert_eq!(layout.height, 1080);
        assert_eq!(layout.css_width, 1920.0);
        assert_eq!(layout.css_height, 1080.0);
        assert_eq!(layout.image_rendering, "");
        assert_eq!(px_scale(1920.0, 1920.0), 1.0);
    }

    #[test]
    fn resize_scales_the_backing_store_by_dpr_but_keeps_css_size() {
        // dpr 2: canvas.style.width stays 1920px while the backing store doubles.
        let layout = resize_layout(1920.0, 1080.0, 2.0, false);
        assert_eq!(layout.width, 3840);
        assert_eq!(layout.height, 2160);
        assert_eq!(layout.css_width, 1920.0);
        assert_eq!(px_scale(3840.0, 1920.0), 2.0);
    }

    #[test]
    fn resize_rounds_half_up_like_math_round() {
        // Math.round(100.5) === 101 (half away from zero for positives).
        let layout = resize_layout(100.5, 10.0, 1.0, false);
        assert_eq!(layout.width, 101);
        // Math.round(0.4) === 0, clamped to 1 by Math.max(1, …).
        let tiny = resize_layout(0.4, 0.4, 1.0, false);
        assert_eq!((tiny.width, tiny.height), (1, 1));
    }

    #[test]
    fn falsy_dpr_falls_back_to_one() {
        // window.devicePixelRatio || 1
        assert_eq!(resize_layout(1920.0, 1080.0, 0.0, false).dpr, 1.0);
        assert_eq!(resize_layout(1920.0, 1080.0, f64::NAN, false).dpr, 1.0);
        // A zero/negative viewport clamps to 1 CSS pixel.
        let empty = resize_layout(0.0, 0.0, 1.0, false);
        assert_eq!((empty.width, empty.height, empty.css_width), (1, 1, 1.0));
    }

    #[test]
    fn potato_mode_caps_the_internal_resolution() {
        // 1920x1080 -> 854x480 (hand-checked: s = sqrt(409920/2073600) ≈ 0.44457).
        let layout = resize_layout(1920.0, 1080.0, 1.0, true);
        assert_eq!((layout.width, layout.height), (854, 480));
        assert_eq!(layout.image_rendering, "pixelated");
        // CSS size still reflects the full resolution (set before potato scaling).
        assert_eq!(layout.css_width, 1920.0);
        // Below the cap the size is untouched (s = 1).
        let small = resize_layout(800.0, 450.0, 1.0, true);
        assert_eq!((small.width, small.height), (800, 450));
        assert_eq!(small.image_rendering, "pixelated");
        assert_eq!(potato_size(854, 480), (854, 480));
    }

    #[test]
    fn wheel_delta_uses_the_delta_mode_divisor() {
        assert_eq!(wheel_delta(120.0, 0.0), Some(1.2));
        assert_eq!(wheel_delta(3.0, 1.0), Some(1.0));
        assert_eq!(wheel_delta(1.0, 2.0), Some(1.0));
        assert_eq!(wheel_delta(1.0, 7.0), Some(1.0));
        // JS: `if (e.deltaY)` — falsy deltas do not emit.
        assert_eq!(wheel_delta(0.0, 0.0), None);
        assert_eq!(wheel_delta(f64::NAN, 0.0), None);
        assert_eq!(wheel_delta(-120.0, 0.0), Some(-1.2));
    }

    #[test]
    fn key_blocking_matches_the_two_js_lists() {
        assert!(should_prevent_default("Tab", false));
        assert!(should_prevent_default("F5", false));
        assert!(should_prevent_default("Escape", false));
        assert!(should_prevent_default("ArrowDown", false));
        assert!(!should_prevent_default("KeyA", false));
        assert!(!should_prevent_default("F4", false)); // F4 is not in the block list
        assert!(should_prevent_default("KeyW", true));
        assert!(!should_prevent_default("KeyW", false));
        assert!(should_prevent_default("NumpadSubtract", true));
        assert!(should_prevent_default("Digit0", true));
        assert!(!should_prevent_default("Digit1", true));
    }

    #[test]
    fn keydown_decode_emits_keydown_then_maybe_char() {
        let (event, ch) = decode_keydown("KeyA", "a", false, false, false, false, false);
        assert_eq!(
            event,
            KeydownEvent {
                code: "KeyA".into(),
                key: "a".into(),
                repeat: false,
                ctrl: false,
                shift: false,
                alt: false,
            }
        );
        assert_eq!(ch.as_deref(), Some("a"));

        // Shifted punctuation is a single char and is emitted.
        let (_, ch) = decode_keydown("Slash", "?", false, false, false, true, false);
        assert_eq!(ch.as_deref(), Some("?"));

        // ctrl/meta merge into the `ctrl` field and suppress char emission.
        let (event, ch) = decode_keydown("KeyW", "w", true, true, false, false, false);
        assert!(event.ctrl);
        assert!(event.repeat);
        assert_eq!(ch, None);
        let (event, ch) = decode_keydown("KeyW", "w", false, false, true, false, false);
        assert!(event.ctrl); // JS: ctrl: e.ctrlKey || e.metaKey
        assert_eq!(ch, None);

        // Named keys and astral chars (UTF-16 length 2) emit no char.
        let (_, ch) = decode_keydown("Escape", "Escape", false, false, false, false, false);
        assert_eq!(ch, None);
        let (_, ch) = decode_keydown("Digit1", "\u{1F600}", false, false, false, false, false);
        assert_eq!(ch, None);
        // A BMP multi-byte char (é) is length 1 in UTF-16 and is emitted.
        let (_, ch) = decode_keydown("KeyA", "é", false, false, false, false, false);
        assert_eq!(ch.as_deref(), Some("é"));
    }

    #[test]
    fn mouse_coordinates_scale_with_pxscale_or_dpr() {
        assert_eq!(mouse_coord(100.0, 0.5, 2.0), 50.0);
        assert_eq!(mouse_coord(100.0, 2.0, 2.0), 200.0);
        // JS: (this.pxScale || this.dpr) — falsy pxScale falls back to the dpr.
        assert_eq!(mouse_coord(100.0, 0.0, 2.0), 200.0);
        assert_eq!(mouse_coord(100.0, f64::NAN, 1.5), 150.0);
        assert_eq!(mouse_coord(7.0, 1.0, 1.0), 7.0);
    }

    #[test]
    fn url_params_match_urlsearchparams_iteration() {
        assert_eq!(
            parse_url_params("?connect=host%3A25565&user=Name+X"),
            vec![
                ("connect".to_string(), "host:25565".to_string()),
                ("user".to_string(), "Name X".to_string()),
            ]
        );
        // Empty pieces are skipped.
        assert_eq!(
            parse_url_params("a=1&&b=2"),
            vec![("a".to_string(), "1".to_string()), ("b".to_string(), "2".to_string())]
        );
        // A key without '=' gets an empty value.
        assert_eq!(parse_url_params("flag"), vec![("flag".to_string(), String::new())]);
        // Only the FIRST '=' separates name and value.
        assert_eq!(parse_url_params("x=a%3Db"), vec![("x".to_string(), "a=b".to_string())]);
        // Percent-decoded UTF-8 survives.
        assert_eq!(parse_url_params("q=%E2%82%AC"), vec![("q".to_string(), "€".to_string())]);
        // Duplicates are kept (launchParams folds them last-wins).
        assert_eq!(parse_url_params("?a=1&a=2").len(), 2);
        // Only one leading '?' is stripped.
        assert_eq!(
            parse_url_params("??weird=1"),
            vec![("?weird".to_string(), "1".to_string())]
        );
        // Invalid escapes stay literal.
        assert_eq!(parse_url_params("%zz=1"), vec![("%zz".to_string(), "1".to_string())]);
        assert_eq!(percent_decode("100%"), "100%");
        assert_eq!(percent_decode("a+b%20c"), "a b c");
    }

    #[test]
    fn origin_socket_url_schemes_match_the_js() {
        assert_eq!(
            origin_socket_url("https:", "example.com:8080"),
            Some("wss://example.com:8080/".to_string())
        );
        assert_eq!(
            origin_socket_url("http:", "localhost"),
            Some("ws://localhost/".to_string())
        );
        assert_eq!(origin_socket_url("file:", ""), None);
        assert_eq!(origin_socket_url("about:", "blank"), None);
        assert!(is_http_like("http:"));
        assert!(is_http_like("https:"));
        assert!(!is_http_like("file:"));
    }

    #[test]
    fn ua_decoding_matches_the_js_regexes() {
        // On real Edge UAs 'Chrome' matches first (leftmost), exactly like JS.
        let edge = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91";
        assert_eq!(ua_runtime(edge), "Chrome 120");
        assert_eq!(ua_bits(edge), 64);
        // An Edg-first string exercises the Edg -> Edge rename branch.
        assert_eq!(ua_runtime("Mozilla/5.0 Edg/99.0.1.2"), "Edge 99");
        let firefox = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0";
        assert_eq!(ua_runtime(firefox), "Firefox 115");
        assert_eq!(ua_runtime("Mozilla/5.0 (iPad; CPU OS 17_0)"), "Browser");
        assert_eq!(ua_bits("Mozilla/5.0 (iPad; CPU OS 17_0)"), 32);
        assert_eq!(ua_bits("x86_64-pc"), 64);
        assert_eq!(ua_bits("arm64 mac"), 64); // case-insensitive /i
    }

    #[test]
    fn cpu_label_follows_the_js_fallback_chain() {
        assert_eq!(format_cpu(Some(8), Some("Windows"), Some("Win32")), "8x Windows");
        assert_eq!(format_cpu(None, None, Some("MacIntel")), "?x MacIntel");
        assert_eq!(format_cpu(Some(0), None, None), "?x CPU"); // 0 || '?' → '?'
        assert_eq!(format_cpu(None, Some(""), Some("Win32")), "?x Win32"); // empty is falsy
        assert_eq!(format_cpu(Some(4), Some("macOS"), None), "4x macOS");
    }

    #[test]
    fn runtime_info_assembles_the_debug_record() {
        let info = runtime_info(
            "Mozilla/5.0 Edg/99.0.1.2",
            Some(12),
            Some("Windows"),
            Some("Win32"),
            Some(MemoryInfo {
                used: 1.0,
                total: 2.0,
                max: 3.0,
            }),
        );
        assert_eq!(info.runtime, "Edge 99");
        // JS `bits`: the UA has no x64/Win64/WOW64/x86_64/aarch64/arm64 marker, so
        // `/x64|Win64|WOW64|x86_64|aarch64|arm64/i.test(ua)` is false -> 32.
        assert_eq!(info.bits, 32);
        assert_eq!(info.cpu, "12x Windows");
        assert_eq!(info.memory.unwrap().max, 3.0);
        let info = runtime_info("", None, None, None, None);
        assert_eq!(info.runtime, "Browser");
        assert_eq!(info.memory, None);
    }

    #[test]
    fn post_json_pairs_status_with_parsed_or_null_json() {
        let ok = parse_post_json(200, Some(r#"{"a":1}"#));
        assert_eq!(ok.status, 200);
        assert_eq!(ok.json.unwrap()["a"], 1);
        assert_eq!(parse_post_json(502, Some("not json")).json, None);
        assert_eq!(parse_post_json(204, None).json, None);
        assert_eq!(parse_json_or_none("[1,2]").unwrap().as_array().unwrap().len(), 2);
    }

    #[test]
    fn device_order_matches_the_js_preference_table() {
        assert_eq!(device_order("auto"), vec!["webgl2", "webgpu", "software"]);
        assert_eq!(device_order("webgl2"), vec!["webgl2", "webgpu", "software"]);
        assert_eq!(device_order("webgpu"), vec!["webgpu", "webgl2", "software"]);
        assert_eq!(device_order("software"), vec!["software"]);
        assert_eq!(device_order("nonsense"), vec!["webgl2", "webgpu", "software"]);
    }

    #[test]
    fn graphics_fallback_succeeds_on_the_first_api() {
        let mut switches = 0;
        let mut warnings = Vec::new();
        let (device, selection) = create_graphics_device_fallback(
            "auto",
            |api| match api {
                "webgl2" => Ok(7u32),
                _ => unreachable!(),
            },
            || switches += 1,
            &mut warnings,
        )
        .unwrap();
        assert_eq!(device, 7);
        assert_eq!(selection.active, "webgl2");
        assert_eq!(selection.requested, "auto");
        assert!(selection.errors.is_empty());
        assert_eq!(switches, 0); // replaceSurface never ran
        assert!(warnings.is_empty());
    }

    #[test]
    fn graphics_fallback_replaces_the_surface_between_attempts() {
        let mut switches = 0;
        let mut warnings = Vec::new();
        let (device, selection) = create_graphics_device_fallback(
            "auto",
            |api| match api {
                "webgl2" => Err("boom".to_string()),
                "webgpu" => Ok(9u32),
                _ => unreachable!(),
            },
            || switches += 1,
            &mut warnings,
        )
        .unwrap();
        assert_eq!(device, 9);
        assert_eq!(switches, 1); // before the second attempt
        assert_eq!(warnings, vec!["webgl2 unavailable: boom".to_string()]);
        // graphicsSelection snapshots the errors accumulated so far.
        assert_eq!(selection.errors, vec!["webgl2: boom".to_string()]);
    }

    #[test]
    fn graphics_fallback_fails_with_the_joined_error_list() {
        let mut switches = 0;
        let mut warnings = Vec::new();
        let error = create_graphics_device_fallback(
            "auto",
            |api| Err::<u32, _>(format!("{api} down")),
            || switches += 1,
            &mut warnings,
        )
        .unwrap_err();
        assert_eq!(
            error,
            "No graphics API could be initialized (webgl2: webgl2 down; webgpu: webgpu down; software: software down)"
        );
        assert_eq!(switches, 2);
        assert_eq!(warnings.len(), 3);
        assert_eq!(warnings[0], "webgl2 unavailable: webgl2 down");
    }

    #[test]
    fn config_merge_is_a_shallow_override() {
        let mut base = serde_json::Map::new();
        base.insert("a".into(), serde_json::json!(1));
        base.insert("b".into(), serde_json::json!(2));
        let mut over = serde_json::Map::new();
        over.insert("b".into(), serde_json::json!(3));
        over.insert("c".into(), serde_json::json!(4));
        let merged = merge_config(&base, &over);
        assert_eq!(
            merged,
            serde_json::json!({"a": 1, "b": 3, "c": 4})
                .as_object()
                .unwrap()
                .clone()
        );
    }

    #[test]
    fn load_config_embeds_then_overrides_then_warns() {
        let mut warnings = Vec::new();
        // Embedded JSON, overridden by a fetched config.
        let config = load_config_logic(
            Some(r#"{"a": 1, "b": 2}"#),
            true,
            || Ok(Some(serde_json::json!({"b": 3, "c": 4}))),
            &mut warnings,
        );
        assert_eq!(config["a"], 1);
        assert_eq!(config["b"], 3);
        assert_eq!(config["c"], 4);
        assert!(warnings.is_empty());

        // A bad embedded config warns but keeps an empty base.
        let mut warnings = Vec::new();
        let config = load_config_logic(Some("{oops"), false, || unreachable!(), &mut warnings);
        assert_eq!(config.len(), 0);
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].starts_with("Bad embedded config"));

        // A failed fetch warns with the config.json message; embedded survives.
        let mut warnings = Vec::new();
        let config = load_config_logic(
            Some(r#"{"a": 5}"#),
            true,
            || Err("offline".to_string()),
            &mut warnings,
        );
        assert_eq!(config["a"], 5);
        assert_eq!(warnings, vec!["Could not read config.json: offline".to_string()]);

        // A not-ok response (Ok(None)) leaves the config unchanged and silent.
        let mut warnings = Vec::new();
        let config =
            load_config_logic(Some(r#"{"a": 5}"#), true, || Ok(None), &mut warnings);
        assert_eq!(config["a"], 5);
        assert!(warnings.is_empty());

        // Non-http(s) pages never fetch.
        let mut warnings = Vec::new();
        let config =
            load_config_logic(Some(r#"{"a": 5}"#), false, || unreachable!(), &mut warnings);
        assert_eq!(config["a"], 5);
    }

    #[test]
    fn embedded_assets_decode_base85_with_js_number_semantics() {
        // '!' is index 0 in the base85 alphabet -> five zeros decode to 4 zero bytes.
        assert_eq!(
            decode_embedded_assets(Some("base85"), Some("4"), "!!!!!").unwrap(),
            vec![0u8, 0, 0, 0]
        );
        // Wrong length -> the JS decoder throws 'Invalid packed data length'.
        assert_eq!(
            decode_embedded_assets(Some("base85"), Some("4"), "!!!!").unwrap_err(),
            "Invalid packed data length"
        );
        // Number(undefined) = NaN -> not a safe integer -> same throw.
        assert_eq!(
            decode_embedded_assets(Some("base85"), None, "!!!!!").unwrap_err(),
            "Invalid packed data length"
        );
        // Number('') = 0 -> length 0 requires an empty payload.
        assert_eq!(
            decode_embedded_assets(Some("base85"), Some(""), "!!!!!").unwrap_err(),
            "Invalid packed data length"
        );
        assert_eq!(decode_embedded_assets(Some("base85"), Some("0"), "").unwrap(), Vec::<u8>::new());
        // Fractional lengths are not safe integers.
        assert_eq!(
            decode_embedded_assets(Some("base85"), Some("4.7"), "!!!!!").unwrap_err(),
            "Invalid packed data length"
        );
    }

    #[test]
    fn embedded_assets_decode_base64_fallback() {
        assert_eq!(
            decode_embedded_assets(None, None, "aGVsbG8=").unwrap(),
            b"hello".to_vec()
        );
        // Any encoding other than 'base85' takes the base64 branch.
        assert_eq!(
            decode_embedded_assets(Some("base64"), None, "aGVsbG8=").unwrap(),
            b"hello".to_vec()
        );
        assert_eq!(decode_embedded_assets(None, None, "").unwrap(), Vec::<u8>::new());
        // Text is trimmed like `el.textContent.trim()`.
        assert_eq!(
            decode_embedded_assets(None, None, "  aGVsbG8= \n").unwrap(),
            b"hello".to_vec()
        );
    }

    #[test]
    fn legacy_migration_only_fills_an_empty_store() {
        assert!(legacy_copy_required(0, 3));
        assert!(!legacy_copy_required(2, 3)); // new db already has entries
        assert!(!legacy_copy_required(0, 0)); // nothing to copy
    }

    #[test]
    fn touchscreen_detection_matches_the_js_fallbacks() {
        assert!(has_touchscreen(Some(2), None));
        assert!(has_touchscreen(Some(0), Some(true)));
        assert!(!has_touchscreen(Some(0), None));
        assert!(!has_touchscreen(None, Some(false)));
        assert!(!has_touchscreen(None, None)); // no navigator, no matchMedia
    }

    #[test]
    fn play_chain_resolves_the_js_option_fallbacks() {
        let chain = play_chain(&PlayOptions::default());
        assert_eq!(chain.playback_rate, 1.0);
        assert_eq!(chain.gain, 1.0);
        assert_eq!(chain.panner, None);

        // pitch uses || (0 falls back to 1); volume uses === undefined (0 wins).
        let chain = play_chain(&PlayOptions {
            pitch: Some(0.0),
            volume: Some(0.0),
            ..Default::default()
        });
        assert_eq!(chain.playback_rate, 1.0);
        assert_eq!(chain.gain, 0.0);

        // A position enables the panner; maxDistance uses || 16.
        let chain = play_chain(&PlayOptions {
            pos: Some([1.0, 2.0, 3.0]),
            ..Default::default()
        });
        assert_eq!(
            chain.panner,
            Some(PannerSetup {
                max_distance: 16.0,
                position: [1.0, 2.0, 3.0],
            })
        );
        let chain = play_chain(&PlayOptions {
            pos: Some([0.0, 0.0, 0.0]),
            max_distance: Some(32.0),
            ..Default::default()
        });
        assert_eq!(chain.panner.unwrap().max_distance, 32.0);
        let chain = play_chain(&PlayOptions {
            pos: Some([0.0, 0.0, 0.0]),
            max_distance: Some(0.0),
            ..Default::default()
        });
        assert_eq!(chain.panner.unwrap().max_distance, 16.0);
    }

    #[test]
    fn emitter_calls_handlers_in_registration_order() {
        let order: Rc<RefCell<Vec<&'static str>>> = Rc::new(RefCell::new(Vec::new()));
        let mut emitter: Emitter<i32> = Emitter::new();
        let first = order.clone();
        emitter.on(
            "wheel",
            Box::new(move |value| first.borrow_mut().push(if *value > 0 { "first" } else { "" })),
        );
        let second = order.clone();
        emitter.on(
            "wheel",
            Box::new(move |_| second.borrow_mut().push("second")),
        );
        emitter.emit("wheel", &5);
        assert_eq!(*order.borrow(), vec!["first", "second"]);
        assert!(emitter.has_handlers("wheel"));
        assert_eq!(emitter.handler_count("wheel"), 2);
        // Unknown events are a no-op.
        emitter.emit("missing", &1);
        assert_eq!(order.borrow().len(), 2);
    }

    #[test]
    fn emit_restores_handlers_so_repeated_emits_keep_working() {
        // Handlers are taken out during an emit and put back afterwards; a second
        // emit must therefore reach every handler again.
        let calls: Rc<RefCell<Vec<&'static str>>> = Rc::new(RefCell::new(Vec::new()));
        let mut emitter: Emitter<()> = Emitter::new();
        let first = calls.clone();
        emitter.on("e", Box::new(move |_| first.borrow_mut().push("h1")));
        let second = calls.clone();
        emitter.on("e", Box::new(move |_| second.borrow_mut().push("h2")));
        emitter.emit("e", &());
        emitter.emit("e", &());
        assert_eq!(*calls.borrow(), vec!["h1", "h2", "h1", "h2"]);
        assert_eq!(emitter.handler_count("e"), 2);
        // Emitting an event with no handlers neither panics nor allocates state.
        let mut empty: Emitter<()> = Emitter::new();
        empty.emit("missing", &());
        assert_eq!(empty.handler_count("missing"), 0);
    }

    #[test]
    fn socket_emitter_buffers_events_until_a_listener_arrives() {
        let seen: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        let mut sock: SocketEmitter<String> = SocketEmitter::new();
        // Greeting arrives before any listener (same network turn as open).
        sock.emit("text", "hello".to_string());
        sock.emit("text", "world".to_string());
        assert_eq!(sock.pending_len("text"), 2);
        // Installing the listener replays the buffered values in order.
        let got = seen.clone();
        sock.on("text", Box::new(move |value| got.borrow_mut().push(value.clone())));
        assert_eq!(*seen.borrow(), vec!["hello".to_string(), "world".to_string()]);
        assert_eq!(sock.pending_len("text"), 0);
        // After replay, emissions go straight through.
        sock.emit("text", "again".to_string());
        assert_eq!(*seen.borrow(), vec!["hello".to_string(), "world".to_string(), "again".to_string()]);
        // A second listener only sees future values (pending was drained).
        let second: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        let got2 = second.clone();
        sock.on("text", Box::new(move |value| got2.borrow_mut().push(value.clone())));
        assert!(second.borrow().is_empty());
        sock.emit("text", "both".to_string());
        assert_eq!(*second.borrow(), vec!["both".to_string()]);
        assert_eq!(sock.handler_count("text"), 2);
    }

    #[test]
    fn socket_emitter_keeps_events_separate() {
        let mut sock: SocketEmitter<u8> = SocketEmitter::new();
        sock.emit("binary", 1);
        sock.emit("close", 2);
        assert_eq!(sock.pending_len("binary"), 1);
        assert_eq!(sock.pending_len("close"), 1);
        let seen: Rc<RefCell<Vec<u8>>> = Rc::new(RefCell::new(Vec::new()));
        let got = seen.clone();
        sock.on("binary", Box::new(move |v| got.borrow_mut().push(*v)));
        assert_eq!(*seen.borrow(), vec![1]);
        // 'close' stays buffered for its own listener.
        assert_eq!(sock.pending_len("close"), 1);
    }

    #[test]
    fn frame_queue_posts_once_per_batch_and_shares_the_timestamp() {
        let stamps: Rc<RefCell<Vec<f64>>> = Rc::new(RefCell::new(Vec::new()));
        let mut queue = FrameQueue::new();
        let got = stamps.clone();
        assert!(queue.push(Box::new(move |t| got.borrow_mut().push(t))));
        // Both frames must observe the SAME timestamp (JS: `const t =
        // performance.now(); for (const f of q) f(t);`), so this one records too.
        let got2 = stamps.clone();
        assert!(!queue.push(Box::new(move |t| got2.borrow_mut().push(t)))); // second frame: no extra post
        assert_eq!(queue.len(), 2);
        assert_eq!(queue.drain(16.6), 2);
        assert_eq!(*stamps.borrow(), vec![16.6, 16.6]); // one shared timestamp
        assert!(queue.is_empty());
        assert_eq!(queue.drain(0.0), 0);
    }

    #[test]
    fn truthiness_helpers_match_js_coercions() {
        assert_eq!(truthy_or(0.0, 9.0), 9.0);
        assert_eq!(truthy_or(f64::NAN, 9.0), 9.0);
        assert_eq!(truthy_or(-0.0, 9.0), 9.0);
        assert_eq!(truthy_or(0.5, 9.0), 0.5);
        assert_eq!(truthy_or_zero(f64::NAN), 0.0);
        assert_eq!(truthy_or_zero(-0.0), 0.0);
        assert_eq!(truthy_or_zero(-3.0), -3.0); // negative deltas are truthy
    }

    #[test]
    fn cpu_count_falls_back_to_four_like_the_js_or() {
        assert_eq!(cpu_count(None), 4); // typeof navigator check fails
        assert_eq!(cpu_count(Some(0)), 4); // 0 is falsy in JS
        assert_eq!(cpu_count(Some(1)), 1);
        assert_eq!(cpu_count(Some(8)), 8);
    }

    #[test]
    fn param_folding_keeps_the_last_duplicate_like_object_assignment() {
        let pairs = parse_url_params("?connect=a&connect=b&user=Name+X&flag");
        let folded = fold_params(&pairs);
        assert_eq!(folded.get("connect").map(String::as_str), Some("b"));
        assert_eq!(folded.get("user").map(String::as_str), Some("Name X"));
        assert_eq!(folded.get("flag").map(String::as_str), Some(""));
        assert_eq!(folded.len(), 3);
        assert!(fold_params(&[]).is_empty());
    }

    #[test]
    fn fetch_json_error_matches_the_js_template_string() {
        assert_eq!(
            fetch_json_error("assets/blocks.json", 404),
            "Failed to load assets/blocks.json (404)"
        );
        assert_eq!(fetch_json_error("config.json", 500), "Failed to load config.json (500)");
    }
}
