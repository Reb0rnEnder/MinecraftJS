//! Port of `client/js/platform/platform.js`: the platform contract.
//!
//! Game code only talks to the host environment through this interface, so the
//! client can be ported by providing another implementation (`browser.rs` ports
//! the reference `BrowserPlatform` from `client/js/platform/browser.js`).
//!
//! The JS contract is duck-typed and event-driven (`on(event, fn)` with string
//! event names and ad-hoc payload objects); here it is modelled as traits plus
//! payload structs. The event payload shapes and the `Socket` surface below are
//! taken verbatim from the contract comment at the top of `platform.js`.
//!
//! Async methods in JS (`fetchBytes`, `pickFiles`, the `files` store, …) become
//! fallible synchronous contract methods: the browser implementation documents
//! the real async transport (fetch/IndexedDB/file input), which stays in JS.
//!
//! Deviations:
//! - `Platform::on` dispatches typed [`PlatformEvent`] payloads instead of
//!   `any` values keyed by string (the string names are preserved via
//!   [`PlatformEventKind::as_str`]).
//! - Worker messages are modelled as `serde_json::Value` (the JS side passes
//!   structured-clone values).

use std::collections::HashMap;

// ---------------------------------------------------------------- event payloads

/// JS: `on('keydown', { code, key, repeat, ctrl, shift, alt })` — `code` uses
/// KeyboardEvent.code names; JS binds `ctrl: e.ctrlKey || e.metaKey`.
#[derive(Clone, Debug, PartialEq)]
pub struct KeydownEvent {
    pub code: String,
    pub key: String,
    pub repeat: bool,
    pub ctrl: bool,
    pub shift: bool,
    pub alt: bool,
}

/// JS: `on('keyup', { code, key })`.
#[derive(Clone, Debug, PartialEq)]
pub struct KeyupEvent {
    pub code: String,
    pub key: String,
}

/// JS: `on('mousedown'/'mouseup', { button, x, y, shift })` — button: 0 left,
/// 1 middle, 2 right; x/y are canvas pixels (clientX * pxScale, see browser.js).
#[derive(Clone, Debug, PartialEq)]
pub struct MouseButtonEvent {
    pub button: i32,
    pub x: f64,
    pub y: f64,
    pub shift: bool,
}

/// JS: `on('mousemove', { x, y, dx, dy })` — dx/dy are raw deltas (valid while
/// the pointer is locked).
#[derive(Clone, Debug, PartialEq)]
pub struct MouseMoveEvent {
    pub x: f64,
    pub y: f64,
    pub dx: f64,
    pub dy: f64,
}

/// JS (browser.js `ws.onclose`): `sock.emit('close', { code, reason })`.
#[derive(Clone, Debug, PartialEq)]
pub struct SocketCloseEvent {
    pub code: u16,
    pub reason: String,
}

/// Every event the platform contract can deliver, with the payload shape from
/// `platform.js`. `'resize'` and `'blur'` carry no payload (JS passes `undefined`).
#[derive(Clone, Debug, PartialEq)]
pub enum PlatformEvent {
    Resize,
    Keydown(KeydownEvent),
    Keyup(KeyupEvent),
    /// Typed text, including pasted text.
    Char(String),
    MouseDown(MouseButtonEvent),
    MouseUp(MouseButtonEvent),
    MouseMove(MouseMoveEvent),
    /// JS: `on('wheel', delta)` — +1 down / -1 up (already normalized by the
    /// deltaMode divisor, see `browser_alg::wheel_delta`).
    Wheel(f64),
    Blur,
    PointerLock(bool),
}

/// The string event names used by the JS emitter, keyed exactly as in
/// `platform.js` (`on(event, fn)`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum PlatformEventKind {
    Resize,
    Keydown,
    Keyup,
    Char,
    MouseDown,
    MouseUp,
    MouseMove,
    Wheel,
    Blur,
    PointerLock,
}

impl PlatformEventKind {
    pub fn as_str(self) -> &'static str {
        match self {
            PlatformEventKind::Resize => "resize",
            PlatformEventKind::Keydown => "keydown",
            PlatformEventKind::Keyup => "keyup",
            PlatformEventKind::Char => "char",
            PlatformEventKind::MouseDown => "mousedown",
            PlatformEventKind::MouseUp => "mouseup",
            PlatformEventKind::MouseMove => "mousemove",
            PlatformEventKind::Wheel => "wheel",
            PlatformEventKind::Blur => "blur",
            PlatformEventKind::PointerLock => "pointerlock",
        }
    }
}

/// JS (browser.js `SocketEmitter`): `on('text'|'binary'|'close', fn)`.
#[derive(Clone, Debug, PartialEq)]
pub enum SocketEvent {
    Text(String),
    Binary(Vec<u8>),
    Close(SocketCloseEvent),
}

/// JS socket event names.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SocketEventKind {
    Text,
    Binary,
    Close,
}

impl SocketEventKind {
    pub fn as_str(self) -> &'static str {
        match self {
            SocketEventKind::Text => "text",
            SocketEventKind::Binary => "binary",
            SocketEventKind::Close => "close",
        }
    }
}

// ---------------------------------------------------------------- value types

/// JS (browser.js `createGraphicsDevice`): `device.graphicsSelection = { requested, active, errors }`.
#[derive(Clone, Debug, PartialEq)]
pub struct GraphicsSelection {
    pub requested: String,
    pub active: String,
    pub errors: Vec<String>,
}

/// JS: `pickFiles({ accept, multiple })` — JS defaults are `accept = ''`,
/// `multiple = false`.
#[derive(Clone, Debug, PartialEq)]
pub struct PickFilesOptions {
    pub accept: String,
    pub multiple: bool,
}

impl Default for PickFilesOptions {
    fn default() -> Self {
        PickFilesOptions {
            accept: String::new(),
            multiple: false,
        }
    }
}

/// JS: `pickFiles` resolves `[{ name, bytes }]`.
#[derive(Clone, Debug, PartialEq)]
pub struct PickedFile {
    pub name: String,
    pub bytes: Vec<u8>,
}

/// JS (browser.js `postJson`): resolves `{ status, json }` where `json` is null
/// when the body does not parse as JSON.
#[derive(Clone, Debug, PartialEq)]
pub struct PostJsonResponse {
    pub status: u16,
    pub json: Option<serde_json::Value>,
}

/// JS: `info() -> { runtime, bits, memory: { used, total, max } | null, cpu }`.
#[derive(Clone, Debug, PartialEq)]
pub struct PlatformInfo {
    pub runtime: String,
    pub bits: u32,
    pub memory: Option<MemoryInfo>,
    pub cpu: String,
}

/// JS: `performance.memory` (only exposed on some engines).
#[derive(Clone, Debug, PartialEq)]
pub struct MemoryInfo {
    pub used: f64,
    pub total: f64,
    pub max: f64,
}

/// JS (browser.js `WebAudio.play` opts): `{ volume, pitch, pos: [x,y,z] | null, maxDistance, onEnd }`
/// plus `loop`. `onEnd` fires from `src.onended` (it is kept as a callback here).
pub struct PlayOptions {
    /// JS: `gain.gain.value = opts.volume === undefined ? 1 : opts.volume` —
    /// an explicit 0 is honoured (unlike `pitch`/`maxDistance` which use `||`).
    pub volume: Option<f64>,
    /// JS: `src.playbackRate.value = opts.pitch || 1` — 0/NaN fall back to 1.
    pub pitch: Option<f64>,
    /// JS: `pos: [x, y, z] | null` — a present value enables the panner.
    /// (JS tolerates shorter arrays via `setPosition(...pos)`; Rust always passes 3.)
    pub pos: Option<[f64; 3]>,
    /// JS: `p.maxDistance = opts.maxDistance || 16` — 0/NaN fall back to 16.
    pub max_distance: Option<f64>,
    /// JS: `if (opts.loop) src.loop = true`.
    pub r#loop: bool,
    /// JS: `opts.onEnd` — invoked from `src.onended` after `voice.ended = true`.
    pub on_end: Option<Box<dyn FnMut()>>,
}

impl Default for PlayOptions {
    fn default() -> Self {
        PlayOptions {
            volume: None,
            pitch: None,
            pos: None,
            max_distance: None,
            r#loop: false,
            on_end: None,
        }
    }
}

impl std::fmt::Debug for PlayOptions {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("PlayOptions")
            .field("volume", &self.volume)
            .field("pitch", &self.pitch)
            .field("pos", &self.pos)
            .field("max_distance", &self.max_distance)
            .field("loop", &self.r#loop)
            .field("on_end", &self.on_end.as_ref().map(|_| "…"))
            .finish()
    }
}

// ---------------------------------------------------------------- sub-contracts

/// JS: `files: persistent binary store -> async put(name, bytes), get(name),
/// list(prefix) -> [names], delete(name)`.
///
/// The browser transport is IndexedDB (`browser.rs::IdbFiles`, version 1, the
/// `'files'` object store, with the legacy `'minekampf'` database migration);
/// the contract here is fallible and synchronous, the async mapping stays in JS.
pub trait PlatformFiles {
    fn put(&mut self, name: &str, bytes: &[u8]) -> Result<(), String>;
    /// JS: `get(name)` returns `null` for a missing key (`r ? new Uint8Array(r) : null`).
    fn get(&mut self, name: &str) -> Result<Option<Vec<u8>>, String>;
    /// JS: `list(prefix)` — all keys filtered with `String(k).startsWith(prefix)`.
    fn list(&mut self, prefix: &str) -> Result<Vec<String>, String>;
    fn delete(&mut self, name: &str) -> Result<(), String>;
}

/// The part of a graphics device that `BrowserPlatform` itself drives: JS
/// `_resize()` calls `device.resize(w, h)` and `createGraphicsDevice` stamps
/// `device.graphicsSelection`. The full draw-method surface is the
/// `gfx/device.js` contract (ported in `webgl2.rs` / `webgpu.rs` / `software.rs`).
pub trait GraphicsSurface {
    /// JS: `device.resize(w, h)`. Returns the resulting `canvas.width` backing
    /// store size — a device may pick its own (the software device renders below
    /// device resolution), and `pxScale` is derived from that value.
    fn resize(&mut self, w: u32, h: u32) -> u32;
    /// JS: `this.device.graphicsSelection = { requested, active, errors }`.
    fn set_graphics_selection(&mut self, selection: GraphicsSelection);
}

/// JS (browser.js `WebAudio.play` voice): `{ stop(), ended, setVolume(v),
/// setPitch(v), setPosition([x,y,z]) }`.
pub trait AudioVoice {
    /// JS: `stop: () => { try { src.stop(); } catch (e) {} }` (already-stopped is swallowed).
    fn stop(&mut self);
    fn set_volume(&mut self, v: f64);
    fn set_pitch(&mut self, v: f64);
    fn set_position(&mut self, pos: &[f64; 3]);
    /// JS: `src.onended = () => { voice.ended = true; if (opts.onEnd) opts.onEnd(); }`.
    fn ended(&self) -> bool;
    /// The applied gain (the PlayOptions volume the voice started with).
    fn gain(&self) -> f64 {
        0.0
    }
    /// The applied playback rate (the PlayOptions pitch).
    fn playback_rate(&self) -> f64 {
        0.0
    }
    /// The applied panner position, when the voice is positional.
    fn panner_position(&self) -> Option<&[f64; 3]> {
        None
    }
}

/// JS: `Audio` — `decode(bytes) -> Promise<buffer>`, `play(buffer, opts) -> voice`,
/// `setListener(pos, forward, up)`, `resume()`, plus the `running` getter.
pub trait Audio {
    /// The decoded buffer handle (opaque in this contract; the browser keeps the
    /// `AudioBuffer` on the JS side).
    type Buffer;
    /// JS: copies the bytes (`bytes.slice().buffer`) then `decodeAudioData`;
    /// returns `null` without an AudioContext.
    fn decode(&mut self, bytes: &[u8]) -> Option<Self::Buffer>;
    /// JS: `play(buffer, opts = {})` — returns `null` without a context or buffer.
    fn play(&mut self, buffer: &Self::Buffer, opts: PlayOptions) -> Option<Box<dyn AudioVoice>>;
    /// JS: `setListener(pos, f, up)` — `positionX`-style properties when
    /// available, `setPosition`/`setOrientation` otherwise.
    fn set_listener(&mut self, pos: &[f64; 3], forward: &[f64; 3], up: &[f64; 3]);
    /// JS: `resume()` when `ctx.state === 'suspended'` (rejections swallowed).
    fn resume(&mut self);
    /// JS: `get running() { return !!this.ctx && this.ctx.state === 'running'; }`.
    fn running(&self) -> bool;
}

/// JS: `createWorker(path, { classic }) -> { postMessage(msg, transfer), onmessage } | null`
/// (a module script unless `classic`). Messages are structured-clone values;
/// modelled here as `serde_json::Value`.
pub trait Worker {
    fn post_message(&self, msg: &serde_json::Value);
    fn on_message(&mut self, handler: Box<dyn FnMut(&serde_json::Value)>);
}

/// JS: `openSocket(url) -> Promise<Socket>` — a WebSocket (a Gravrust proxy or
/// an Eaglercraft server). `sendText`/`sendBinary` only send at `readyState 1`.
pub trait PlatformSocket {
    fn send_text(&self, s: &str);
    fn send_binary(&self, b: &[u8]);
    fn close(&self);
    /// JS: `on('text'|'binary'|'close', fn)`.
    fn on(&mut self, event: SocketEventKind, handler: Box<dyn FnMut(&SocketEvent)>);
}

// ---------------------------------------------------------------- the contract

/// The platform contract of `platform.js`. Game code only talks to the host
/// environment through this interface, so the client can be ported by providing
/// another implementation.
pub trait Platform {
    // --- drawing surface -------------------------------------------------
    /// Drawing surface size (pixels).
    fn width(&self) -> u32;
    fn height(&self) -> u32;
    /// JS: `on(event, fn)` — register a handler for a contract event.
    fn on(&mut self, event: PlatformEventKind, handler: Box<dyn FnMut(&PlatformEvent)>);

    // --- pointer lock ----------------------------------------------------
    fn lock_pointer(&mut self);
    fn unlock_pointer(&mut self);
    fn is_pointer_locked(&self) -> bool;

    // --- fullscreen ------------------------------------------------------
    fn toggle_fullscreen(&mut self);
    fn is_fullscreen(&self) -> bool;

    // --- clipboard -------------------------------------------------------
    fn set_clipboard(&mut self, text: &str);

    // --- settings (localStorage in the browser impl) ----------------------
    /// JS: `loadSetting(key) -> string|null`.
    fn load_setting(&self, key: &str) -> Option<String>;
    fn save_setting(&mut self, key: &str, value: &str);

    // --- persistent binary store -----------------------------------------
    fn files(&mut self) -> &mut dyn PlatformFiles;

    // --- files & URLs ----------------------------------------------------
    /// JS: `pickFiles({ accept, multiple }) -> Promise<[{ name, bytes }]>`
    /// (an empty result models a cancelled picker).
    fn pick_files(&mut self, options: &PickFilesOptions) -> Vec<PickedFile>;
    fn save_file(&self, name: &str, bytes: &[u8], mime: &str);
    fn open_url(&mut self, url: &str);

    // --- assets served next to the client --------------------------------
    /// JS: `fetchBytes(path)` — `null` when the response is not ok.
    fn fetch_bytes(&mut self, path: &str) -> Option<Vec<u8>>;
    /// JS: `fetchText(path)` — `null` when the response is not ok.
    fn fetch_text(&mut self, path: &str) -> Option<String>;
    /// JS: `postJson(url, body) -> { status, json }` (requests to the proxy).
    fn post_json(&mut self, path: &str, body: &serde_json::Value) -> PostJsonResponse;
    /// JS: `probe(url) -> true` — reachability only; `false` models the JS
    /// rejection when an http(s) URL does not answer.
    fn probe(&mut self, url: &str) -> bool;
    /// JS: `fetchJson(path)` — throws `Failed to load ${path} (${r.status})`
    /// when the response is not ok.
    fn fetch_json(&mut self, path: &str) -> Result<serde_json::Value, String>;

    // --- sockets ---------------------------------------------------------
    /// JS: `openSocket(url) -> Promise<Socket>`; JS rejects with
    /// `'Bad address <url>'` / `'Could not connect to <url>'`.
    fn open_socket(&mut self, url: &str) -> Result<Box<dyn PlatformSocket>, String>;
    /// JS: `originSocketUrl() -> url | null` — the proxy hosting the page (the
    /// default proxy), `null` for file:// pages.
    fn origin_socket_url(&self) -> Option<String>;

    // --- bundled data ----------------------------------------------------
    /// JS: `embeddedAssets() -> Uint8Array | null` — asset zip bundled with the
    /// client (single-file build), decoded once.
    fn embedded_assets(&mut self) -> Option<Vec<u8>>;
    /// JS: `loadConfig() -> object` — site configuration (`config.json`).
    fn load_config(&mut self) -> serde_json::Map<String, serde_json::Value>;

    // --- timing / frames -------------------------------------------------
    /// JS: `now() -> ms` (`performance.now()`).
    fn now(&self) -> f64;
    /// JS: `requestFrame(fn)` — the callback receives the frame timestamp.
    fn request_frame(&mut self, frame: Box<dyn FnOnce(f64)>);
    /// JS: `vsync` — frames follow the display refresh when true; `None` models
    /// the JS `undefined` (browser.js checks `this.vsync === false`).
    fn vsync(&self) -> Option<bool>;

    // --- system ----------------------------------------------------------
    /// JS: `cpuCount` — logical CPU cores (sizes the mesh worker pool).
    fn cpu_count(&self) -> u32;
    /// JS: `info()` for the debug screen.
    fn info(&self) -> PlatformInfo;
    /// JS: `createGraphicsDevice(preference: 'auto'|'webgl2'|'webgpu')`.
    /// On success the implementation stores the device (browser.js keeps
    /// `this.device`); the full device method surface is the gfx/device.js
    /// contract, out of scope for this trait.
    fn create_graphics_device(&mut self, preference: &str) -> Result<(), String>;
    /// JS: `createAudio() -> Audio | null`; `false` models the JS `null`.
    fn create_audio(&mut self) -> bool;
    /// JS: `createWorker(path, { classic })` — `null` when Worker is missing.
    fn create_worker(&mut self, path: &str, classic: bool) -> Option<Box<dyn Worker>>;

    // --- loading UI / title / launch -------------------------------------
    /// JS: `setLoading(message, percent)`.
    fn set_loading(&mut self, message: &str, percent: Option<f64>);
    fn hide_loading(&mut self);
    /// JS: `setLoadingError(message)` (browser.js extra).
    fn set_loading_error(&mut self, message: &str);
    fn set_title(&mut self, title: &str);
    /// JS: `launchParams() -> { [key]: string }` — startup options (connect, user).
    fn launch_params(&self) -> HashMap<String, String>;
}
