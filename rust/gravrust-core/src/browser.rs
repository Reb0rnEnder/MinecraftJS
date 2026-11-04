//! Port of `client/js/platform/browser.js`: the `BrowserPlatform` reference
//! implementation of the platform contract ([`crate::platform_contract`]).
//!
//! `browser.js` mixes self-contained state machines with browser API calls.
//! The state machines and every observable behavior live here (the math and
//! decoding run through [`crate::browser_alg`]); the browser *transports* stay
//! in JavaScript per `docs/rust-wasm-port.md` ("browser API calls … stay in
//! JavaScript"): the DOM canvas and its event listeners, IndexedDB, fetch,
//! WebSocket, workers, the AudioContext node graph and the fullscreen /
//! pointer-lock / clipboard requests. Every method below quotes the exact JS
//! it models and states what stays on the JS side; nothing is silently stubbed.
//!
//! The glue shape (mirroring the JS runtime):
//! - the JS side feeds window/navigator/location snapshots through
//!   [`BrowserPlatform::set_viewport`], [`set_navigator`](BrowserPlatform::set_navigator)
//!   and [`set_location`](BrowserPlatform::set_location),
//! - the JS event listeners call the `on_*` methods (the handler bodies are
//!   ported 1:1 and emit the [`PlatformEvent`] payloads of the contract),
//! - async outcomes (the config.json fetch, the embedded asset element) are
//!   mirrored through setters before the consuming call, so the synchronous
//!   contract methods stay total.
//!
//! Deviations from the JS source:
//! - [`Platform`] is the trait of `platform_contract.rs` (JS is duck-typed);
//!   the `Emitter<A>` / `SocketEmitter<A>` of `browser_alg.rs` replace the JS
//!   classes (this file does not re-declare them).
//! - `id`-element reads (`#Gravrust-assets`, `#Gravrust-config`, `#loading*`)
//!   and asynchronous results arrive through explicit setters, documented per
//!   method.

use std::collections::HashMap;

use wasm_bindgen::prelude::*;

use crate::browser_alg::{self, Emitter, FrameQueue, SocketEmitter};
use crate::platform_contract::{
    Audio, AudioVoice, GraphicsSelection, KeydownEvent, KeyupEvent, MemoryInfo, MouseButtonEvent,
    MouseMoveEvent, PickFilesOptions, PickedFile, Platform, PlatformEvent, PlatformEventKind,
    PlatformFiles, PlatformInfo, PlatformSocket, PlayOptions, PostJsonResponse, SocketCloseEvent,
    SocketEvent, SocketEventKind, Worker,
};

// ---------------------------------------------------------------- audio model

// JS: `this.ctx.state` — the AudioContext states the platform observes
// (`resume()` on a suspended context, the `running` getter).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AudioContextState {
    Suspended,
    Running,
}

// JS: `setListener(pos, f, up)` state (the `positionX/Y/Z` + `forwardX/Y/Z` +
// `upX/Y/Z` property writes, or the legacy `setPosition`/`setOrientation` calls).
#[derive(Clone, Debug, PartialEq)]
pub struct AudioListenerState {
    pub position: [f64; 3],
    pub forward: [f64; 3],
    pub up: [f64; 3],
}

// JS (browser.js `WebAudio`): `this.ctx` is created lazily by `_ctx()`. The
// `window.AudioContext || window.webkitAudioContext` feature check, the node
// graph (`master` gain → destination, `src → gain → [panner] → master`),
// `decodeAudioData` and the listener property writes stay browser-bound; this
// model carries the observable state machine (context state, decoded-buffer
// handles, voice parameters).
pub struct BrowserAudio {
    // JS: `this.ctx = null` — created on the first resume/decode/play.
    context: Option<AudioContextState>,
    // Handles for decoded buffers (JS: the `decodeAudioData` AudioBuffer, which
    // stays on the JS side).
    next_buffer: u32,
    // JS: the `ctx.listener` writes of `setListener` (ignored before the context exists).
    listener: Option<AudioListenerState>,
}

impl BrowserAudio {
    pub fn new() -> Self {
        BrowserAudio {
            context: None,
            next_buffer: 0,
            listener: None,
        }
    }

    // JS: `_ctx()` — lazily creates `this.ctx` (and the `master` gain connected
    // to `ctx.destination`); a fresh context starts suspended. The model cannot
    // fail here: the missing-API case is the JS feature check in `createAudio`.
    fn ensure_context(&mut self) {
        self.context.get_or_insert(AudioContextState::Suspended);
    }

    // JS: `resume() { const c = this._ctx(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }`
    // — `_ctx()` creates the context on first use. (The resume promise resolves
    // asynchronously in JS; the model applies the running state immediately.)
    pub fn resume(&mut self) {
        let state = self.context.get_or_insert(AudioContextState::Suspended);
        if *state == AudioContextState::Suspended {
            *state = AudioContextState::Running;
        }
    }

    // JS: `get running() { return !!this.ctx && this.ctx.state === 'running'; }`
    pub fn running(&self) -> bool {
        self.context == Some(AudioContextState::Running)
    }

    // JS: `setListener(pos, f, up) { if (!this.ctx) return; … }` — the property
    // writes stay in JS; the model stores the state.
    pub fn set_listener(&mut self, pos: &[f64; 3], forward: &[f64; 3], up: &[f64; 3]) {
        if self.context.is_none() {
            return; // JS: `if (!this.ctx) return;`
        }
        self.listener = Some(AudioListenerState {
            position: *pos,
            forward: *forward,
            up: *up,
        });
    }

    // JS: `this.ctx` exists after the first resume/decode/play.
    pub fn context_created(&self) -> bool {
        self.context.is_some()
    }

    pub fn listener(&self) -> Option<&AudioListenerState> {
        self.listener.as_ref()
    }
}

impl Default for BrowserAudio {
    fn default() -> Self {
        BrowserAudio::new()
    }
}

impl Audio for BrowserAudio {
    // The decoded-buffer handle (the AudioBuffer itself stays on the JS side).
    type Buffer = u32;

    // JS: `async decode(bytes) { const c = this._ctx(); if (!c) return null; const copy = bytes.slice().buffer; return c.decodeAudioData(copy); }`
    // — the byte copy and the decode stay in JS; the model issues a handle.
    fn decode(&mut self, bytes: &[u8]) -> Option<u32> {
        let _ = bytes; // JS: `bytes.slice().buffer` — copied on the JS side
        self.ensure_context();
        let handle = self.next_buffer;
        self.next_buffer += 1;
        Some(handle)
    }

    // JS: `play(buffer, opts = {})` — `if (!c || !buffer) return null;`, then the
    // node chain resolved by `browser_alg::play_chain` (`src.playbackRate`, the
    // gain, an optional panner) and `src.start()`. The graph stays in JS; the
    // model returns the voice state.
    fn play(&mut self, buffer: &u32, opts: PlayOptions) -> Option<Box<dyn AudioVoice>> {
        let _ = buffer; // JS: `!buffer` — checked on the JS side (handles only here)
        let chain = browser_alg::play_chain(&opts);
        self.ensure_context();
        Some(Box::new(PlayVoice {
            playback_rate: chain.playback_rate,
            gain: chain.gain,
            panner: chain.panner.map(|panner| panner.position),
            on_end: opts.on_end,
            ended: false,
        }))
    }

    fn set_listener(&mut self, pos: &[f64; 3], forward: &[f64; 3], up: &[f64; 3]) {
        BrowserAudio::set_listener(self, pos, forward, up);
    }

    fn resume(&mut self) {
        BrowserAudio::resume(self);
    }

    fn running(&self) -> bool {
        BrowserAudio::running(self)
    }
}

// JS (browser.js `play` voice): `{ stop(), ended, setVolume(v), setPitch(v),
// setPosition([x,y,z]) }`.
pub struct PlayVoice {
    // JS: `src.playbackRate.value` (initially `opts.pitch || 1`).
    playback_rate: f64,
    // JS: `gain.gain.value` (initially `opts.volume === undefined ? 1 : opts.volume`).
    gain: f64,
    // JS: the panner position (absent when `opts.pos` was not given).
    panner: Option<[f64; 3]>,
    // JS: `opts.onEnd` — fired from `src.onended`.
    on_end: Option<Box<dyn FnMut()>>,
    // JS: `voice.ended` — set by `src.onended`.
    ended: bool,
}

impl PlayVoice {
    pub fn gain(&self) -> f64 {
        self.gain
    }

    pub fn playback_rate(&self) -> f64 {
        self.playback_rate
    }

    pub fn panner_position(&self) -> Option<&[f64; 3]> {
        self.panner.as_ref()
    }
}

impl AudioVoice for PlayVoice {
    // JS: `stop: () => { try { src.stop(); } catch (e) {} }` — halting playback
    // fires `src.onended` (→ `voice.ended = true`, then `opts.onEnd`); the model
    // applies that transition here (no audio thread exists to defer it).
    fn stop(&mut self) {
        self.ended = true;
        if let Some(mut on_end) = self.on_end.take() {
            on_end();
        }
    }

    // JS: `setVolume: (v) => { gain.gain.value = v; }`
    fn set_volume(&mut self, v: f64) {
        self.gain = v;
    }

    // JS: `setPitch: (v) => { src.playbackRate.value = v; }`
    fn set_pitch(&mut self, v: f64) {
        self.playback_rate = v;
    }

    // JS: `setPosition: (pos) => { if (!panner) return; … }`
    fn set_position(&mut self, pos: &[f64; 3]) {
        if let Some(panner) = self.panner.as_mut() {
            *panner = *pos;
        }
    }

    fn ended(&self) -> bool {
        self.ended
    }

    // The getters mirror the inherent methods on PlayVoice so the state is
    // readable through the `Box<dyn AudioVoice>` handle.
    fn gain(&self) -> f64 {
        self.gain
    }

    fn playback_rate(&self) -> f64 {
        self.playback_rate
    }

    fn panner_position(&self) -> Option<&[f64; 3]> {
        self.panner.as_ref()
    }
}

// ---------------------------------------------------------------- socket model

// JS: the WebSocket readyState constants (0 CONNECTING, 1 OPEN, 2 CLOSING, 3 CLOSED).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SocketReadyState {
    Connecting,
    Open,
    Closing,
    Closed,
}

// JS (`openSocket`): the socket wrapper `BrowserPlatform` hands out — a
// `SocketEmitter` over the WebSocket. `sendText`/`sendBinary` only send at
// `readyState 1` and `close()` calls `ws.close()`; the WebSocket transport and
// its promise (`onopen` resolve / `onerror` reject) stay in JS. This model
// carries the ready-state gating plus the buffered event emitter (server-first
// protocols (Wisp) can send their greeting in the same network turn as open).
pub struct BrowserSocket {
    url: String,
    // JS: `ws.readyState` (the model starts at CONNECTING like `new WebSocket`).
    ready_state: SocketReadyState,
    // JS: the `SocketEmitter` instance wrapping the socket.
    events: SocketEmitter<SocketEvent>,
}

impl BrowserSocket {
    // JS: `const sock = new SocketEmitter();` (with `ws.binaryType = 'arraybuffer'`).
    pub fn new(url: &str) -> Self {
        BrowserSocket {
            url: url.to_string(),
            ready_state: SocketReadyState::Connecting,
            events: SocketEmitter::new(),
        }
    }

    pub fn url(&self) -> &str {
        &self.url
    }

    pub fn ready_state(&self) -> SocketReadyState {
        self.ready_state
    }

    // JS: `sock.sendText = (s) => { if (ws.readyState === 1) ws.send(s); };` — the
    // gate the model exposes (the actual `ws.send` stays in JS).
    pub fn can_send(&self) -> bool {
        self.ready_state == SocketReadyState::Open
    }

    // JS: `ws.onopen = () => resolve(sock);`
    pub fn on_open(&mut self) {
        self.ready_state = SocketReadyState::Open;
    }

    // JS: `else sock.emit('binary', new Uint8Array(e.data));` (onmessage).
    pub fn on_binary(&mut self, bytes: &[u8]) {
        self.events.emit("binary", SocketEvent::Binary(bytes.to_vec()));
    }

    // JS: `if (typeof e.data === 'string') sock.emit('text', e.data);` (onmessage).
    pub fn on_text(&mut self, text: &str) {
        self.events.emit("text", SocketEvent::Text(text.to_string()));
    }

    // JS: `ws.onclose = (e) => sock.emit('close', { code: e.code, reason: e.reason });`
    pub fn on_close(&mut self, code: u16, reason: &str) {
        self.ready_state = SocketReadyState::Closed;
        self.events.emit(
            "close",
            SocketEvent::Close(SocketCloseEvent {
                code,
                reason: reason.to_string(),
            }),
        );
    }

    // JS: `this.pending[ev]` — how many values are buffered for an event.
    pub fn pending_len(&self, event: &str) -> usize {
        self.events.pending_len(event)
    }
}

impl PlatformSocket for BrowserSocket {
    // JS: `sock.sendText = (s) => { if (ws.readyState === 1) ws.send(s); };` — the
    // WebSocket send stays in JS; the model carries the readyState gate
    // ([`BrowserSocket::can_send`]).
    fn send_text(&self, _s: &str) {}

    // JS: `sock.sendBinary = (b) => { if (ws.readyState === 1) ws.send(b); };`
    fn send_binary(&self, _b: &[u8]) {}

    // JS: `sock.close = () => ws.close();` — browser-bound; the close event
    // arrives through [`BrowserSocket::on_close`].
    fn close(&self) {}

    // JS: `on(ev, fn)` (the SocketEmitter, with pending replay).
    fn on(&mut self, event: SocketEventKind, handler: Box<dyn FnMut(&SocketEvent)>) {
        self.events.on(event.as_str(), handler);
    }
}

// ---------------------------------------------------------------- file store

// JS (browser.js `IdbFiles`): the persistent binary store — the 'Gravrust'
// database (version 1, 'files' object store) with the legacy 'minekampf'
// copy-once migration. The IndexedDB transport (open/upgrade, the cursor walk,
// the transactions and the best-effort `catch (e) {}` around the migration)
// stays in JS; this model carries the names, the observable key/value semantics
// the contract exposes, and the migration decision.
pub struct IdbFiles {
    // JS: `constructor(dbName, legacyName)` — `new IdbFiles('Gravrust', 'minekampf')`.
    db_name: String,
    legacy_name: Option<String>,
    // The synced store contents. JS: `get` of a missing key resolves null.
    entries: HashMap<String, Vec<u8>>,
}

impl IdbFiles {
    pub fn new(db_name: &str, legacy_name: Option<&str>) -> Self {
        IdbFiles {
            db_name: db_name.to_string(),
            legacy_name: legacy_name.map(str::to_string),
            entries: HashMap::new(),
        }
    }

    pub fn db_name(&self) -> &str {
        &self.db_name
    }

    pub fn legacy_name(&self) -> Option<&str> {
        self.legacy_name.as_deref()
    }

    // JS (IdbFiles constructor): the legacy database is copied into the new one
    // only when the new store is empty and the legacy store has entries — the
    // decision is `browser_alg::legacy_copy_required` (the migration itself is
    // best-effort in JS and its failures are swallowed).
    pub fn migrate_from(&mut self, legacy: &IdbFiles) {
        if browser_alg::legacy_copy_required(self.entries.len(), legacy.entries.len()) {
            for (key, value) in &legacy.entries {
                self.entries.insert(key.clone(), value.clone());
            }
        }
    }
}

impl PlatformFiles for IdbFiles {
    // JS: `put(name, bytes) { return this._tx('readwrite', (s) => s.put(bytes, name)); }`
    fn put(&mut self, name: &str, bytes: &[u8]) -> Result<(), String> {
        self.entries.insert(name.to_string(), bytes.to_vec());
        Ok(())
    }

    // JS: `async get(name) { const r = await this._tx('readonly', (s) => s.get(name)); return r ? new Uint8Array(r) : null; }`
    fn get(&mut self, name: &str) -> Result<Option<Vec<u8>>, String> {
        Ok(self.entries.get(name).cloned())
    }

    // JS: `async list(prefix = '') { const keys = await this._tx('readonly', (s) => s.getAllKeys()); return (keys || []).filter((k) => String(k).startsWith(prefix)); }`
    // (IndexedDB `getAllKeys` returns keys in ascending order; the model sorts.)
    fn list(&mut self, prefix: &str) -> Result<Vec<String>, String> {
        let mut keys: Vec<String> = self
            .entries
            .keys()
            .filter(|key| key.starts_with(prefix))
            .cloned()
            .collect();
        keys.sort();
        Ok(keys)
    }

    // JS: `delete(name) { return this._tx('readwrite', (s) => s.delete(name)); }`
    fn delete(&mut self, name: &str) -> Result<(), String> {
        self.entries.remove(name);
        Ok(())
    }
}

// ---------------------------------------------------------------- glue inputs

// JS: the `window.innerWidth` / `window.innerHeight` / `window.devicePixelRatio`
// reads of `_resize()` (and its `resize` + devicePixelRatio matchMedia watchers).
// The reads stay in JS; the glue mirrors the current values before
// [`BrowserPlatform::refresh_size`].
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Viewport {
    pub inner_width: f64,
    pub inner_height: f64,
    pub dpr: f64,
}

impl Default for Viewport {
    // The defaults model an empty window: the backing store clamps to 1x1
    // (`Math.max(1, …)`) and a falsy DPR falls back to 1.
    fn default() -> Self {
        Viewport {
            inner_width: 0.0,
            inner_height: 0.0,
            dpr: 1.0,
        }
    }
}

// JS: the `navigator` / `performance` reads of `info()`, `cpuCount` and
// `hasTouchscreen`. The reads stay in JS; the glue mirrors them once (the
// defaults model an empty navigator).
#[derive(Clone, Debug, Default, PartialEq)]
pub struct NavigatorSnapshot {
    // JS: `navigator.userAgent`
    pub user_agent: String,
    // JS: `navigator.hardwareConcurrency`
    pub hardware_concurrency: Option<u32>,
    // JS: `navigator.userAgentData && navigator.userAgentData.platform`
    pub ua_platform: Option<String>,
    // JS: `navigator.platform`
    pub platform: Option<String>,
    // JS: `performance.memory` → `{ used: pm.usedJSHeapSize, total: pm.totalJSHeapSize, max: pm.jsHeapSizeLimit }`
    pub memory: Option<MemoryInfo>,
    // JS: `navigator.maxTouchPoints`
    pub max_touch_points: Option<u32>,
    // JS: `globalThis.matchMedia?.('(any-pointer: coarse)').matches`
    pub coarse_pointer: Option<bool>,
}

// JS: the `#loading` overlay state (`setLoading` / `hideLoading` / `setLoadingError`).
#[derive(Clone, Debug, PartialEq)]
pub struct LoadingState {
    // JS: `document.getElementById('loading-text').textContent`
    pub message: String,
    // JS: `#loading-bar` width (`percent + '%'`).
    pub percent: Option<f64>,
    // JS: `el.classList.add('error')`.
    pub error: bool,
}

// JS: the `#Gravrust-assets` element data the glue mirrors (`el.dataset.encoding`,
// `el.dataset.bytes`, `el.textContent`).
struct EmbeddedAssetsSource {
    encoding: Option<String>,
    bytes_attr: Option<String>,
    text: String,
}

// JS: `this.device` — only the pieces `_resize()` / `createGraphicsDevice` touch
// are modelled (`device.resize(w, h)` and `device.graphicsSelection`); the full
// draw-method surface is the gfx/device.js contract (webgl2.rs / webgpu.rs /
// software.rs).
#[derive(Clone, Debug, PartialEq)]
pub struct GraphicsDeviceModel {
    // JS: `this.device.graphicsSelection = { requested: preference, active: api, errors: [...errors] };`
    pub selection: GraphicsSelection,
}

// JS keydown handler result: whether `e.preventDefault()` ran, the emitted
// keydown payload, and the char emitted after it (see
// `browser_alg::decode_keydown`).
#[derive(Clone, Debug, PartialEq)]
pub struct KeydownOutcome {
    pub prevent_default: bool,
    pub event: KeydownEvent,
    pub emitted_char: Option<String>,
}

// ---------------------------------------------------------------- platform

/// The `BrowserPlatform` port. See the module header for the JS-boundary map.
pub struct BrowserPlatform {
    // JS: `this.name = 'browser'`.
    name: String,
    // JS: `this.canvas` — the DOM element stays in JS; the model carries the
    // surface sizes `_resize()` computes.
    canvas_width: u32,
    canvas_height: u32,
    // JS: `canvas.style.width/height` (device-pixel backstore mapped back to CSS px).
    css_width: f64,
    css_height: f64,
    // JS: `canvas.style.imageRendering` ('pixelated' in potato mode).
    image_rendering: &'static str,
    // JS: `this.dpr` / `this.pxScale`.
    dpr: f64,
    px_scale: f64,
    // JS: `this.potato` (Super Potato Mode).
    potato: bool,
    // JS: `this.locked` (pointer lock) and the mirrored `document.fullscreenElement`.
    locked: bool,
    fullscreen: bool,
    // JS: `this.vsync` (undefined until the settings screen sets it).
    vsync: Option<bool>,
    // JS: `this.device`.
    device: Option<GraphicsDeviceModel>,
    // JS: `this._embedded` — `None` = not checked yet, `Some(None)` = checked and
    // absent (or a throwing decoder), `Some(Some(bytes))` = the decoded zip.
    embedded: Option<Option<Vec<u8>>>,
    embedded_source: Option<EmbeddedAssetsSource>,
    // JS: the `#Gravrust-config` element text (None when the element is absent).
    embedded_config_text: Option<String>,
    // JS: the `config.json` fetch outcome (Ok(None) models a not-ok response).
    pending_config_fetch: Option<Result<Option<String>, String>>,
    // JS: `this.files = new IdbFiles('Gravrust', 'minekampf')`.
    files: IdbFiles,
    // JS: `this.audio` (null until `createAudio()`).
    audio: Option<BrowserAudio>,
    // JS: the `Emitter` base class (`BrowserPlatform extends Emitter`).
    handlers: Emitter<PlatformEvent>,
    // JS: `this._mcq` (the vsync-off MessageChannel queue) and the
    // requestAnimationFrame queue (vsync on/undefined).
    frame_queue: FrameQueue,
    animation_queue: Vec<Box<dyn FnOnce(f64)>>,
    // JS: `this._mc` — the MessageChannel exists after the first vsync-off frame.
    mc_created: bool,
    // JS: localStorage (loadSetting/saveSetting) — the synced values.
    settings: HashMap<String, String>,
    // JS: the navigator/performance reads (mirrored by the glue).
    navigator: NavigatorSnapshot,
    // JS: `location.protocol` / `location.host` / `location.search`
    // (defaults model a file:// page: no origin proxy, no config.json fetch).
    location_protocol: String,
    location_host: String,
    location_search: String,
    // JS: `document.title` (mirrored by the glue).
    title: String,
    // JS: the `#loading` overlay state (None = hidden).
    loading: Option<LoadingState>,
    // JS: `console.warn(...)` lines (the glue forwards them).
    warnings: Vec<String>,
    // JS: the window reads of `_resize()`.
    viewport: Viewport,
    // Track whether the F key is currently held down (for F1-F9 via F+1-9).
    f_key_held: bool,
}

impl BrowserPlatform {
    // JS: `constructor()` — `this.name = 'browser'`, the `#game-canvas` element
    // setup (`document.createElement('canvas')`, `id`, `tabIndex = 0`,
    // `document.body.appendChild`), the `resize`/devicePixelRatio watchers and
    // `_bindInput()` stay in JavaScript; the glue drives the model through the
    // setters and `on_*` methods below. `this.files = new IdbFiles('Gravrust',
    // 'minekampf')` is ported as the [`IdbFiles`] state.
    pub fn new() -> Self {
        let mut platform = BrowserPlatform {
            name: "browser".to_string(),
            canvas_width: 1,
            canvas_height: 1,
            css_width: 1.0,
            css_height: 1.0,
            image_rendering: "",
            dpr: 1.0,
            px_scale: 1.0,
            potato: false,
            locked: false,
            fullscreen: false,
            vsync: None,
            device: None,
            embedded: None,
            embedded_source: None,
            embedded_config_text: None,
            pending_config_fetch: None,
            files: IdbFiles::new("Gravrust", Some("minekampf")),
            audio: None,
            handlers: Emitter::new(),
            frame_queue: FrameQueue::new(),
            animation_queue: Vec::new(),
            mc_created: false,
            settings: HashMap::new(),
            navigator: NavigatorSnapshot::default(),
            location_protocol: "file:".to_string(),
            location_host: String::new(),
            location_search: String::new(),
            title: String::new(),
            loading: None,
            warnings: Vec::new(),
            viewport: Viewport::default(),
            f_key_held: false,
        };
        // JS: `this._resize();` (no resize event on construction).
        platform.resize();
        platform
    }

    // JS: `_resize()` — the math is `browser_alg::resize_layout` (device-pixel
    // backing store, CSS size kept, potato cap) and `browser_alg::px_scale`
    // (`this.pxScale = this.canvas.width / cw`). With a device the JS path calls
    // `device.resize(w, h)` (all three devices round-assign `canvas.width/height`,
    // see software.js), without one it assigns the canvas directly — the model
    // applies the same sizes on both paths.
    fn resize(&mut self) {
        let layout = browser_alg::resize_layout(
            self.viewport.inner_width,
            self.viewport.inner_height,
            self.viewport.dpr,
            self.potato,
        );
        self.dpr = layout.dpr;
        self.css_width = layout.css_width;
        self.css_height = layout.css_height;
        self.image_rendering = layout.image_rendering;
        self.canvas_width = layout.width;
        self.canvas_height = layout.height;
        self.px_scale = browser_alg::px_scale(
            self.canvas_width as f64,
            self.viewport.inner_width.max(1.0),
        );
    }

    // JS: `refreshSize() { this._resize(); this.emit('resize'); }` — re-applies
    // the surface size.
    pub fn refresh_size(&mut self) {
        self.resize();
        self.handlers
            .emit(PlatformEventKind::Resize.as_str(), &PlatformEvent::Resize);
    }

    // JS: `setPotato(on) { this.potato = !!on; this.refreshSize(); }` — Super
    // Potato Mode renders below the display resolution (any graphics API; always
    // on for the CPU rasteriser) with the canvas stretched to the window.
    pub fn set_potato(&mut self, on: bool) {
        self.potato = on;
        self.refresh_size();
    }

    // JS: `replaceSurface()` — a canvas can only ever have one context type, so
    // switching APIs swaps in a fresh `#game-canvas` element (`id`, `tabIndex`,
    // `old.replaceWith(c)` — the DOM swap stays in JS) and drops the device
    // before `_resize()` re-applies the surface size.
    pub fn replace_surface(&mut self) {
        self.device = None;
        self.resize();
    }

    // JS: `createGraphicsDevice(preference = 'auto')` — the body is quoted in
    // `browser_alg::create_graphics_device_fallback`. The device constructors
    // (WebGL2Device / WebGPUDevice / SoftwareDevice) are the gfx layer and stay
    // in JavaScript per docs/rust-wasm-port.md; `make` receives
    // `'webgl2' | 'webgpu' | 'software'` and creates that device.
    pub fn create_graphics_device_with(
        &mut self,
        preference: &str,
        make: impl FnMut(&str) -> Result<(), String>,
    ) -> Result<(), String> {
        let mut warnings = Vec::new();
        let result = browser_alg::create_graphics_device_fallback(
            preference,
            make,
            // JS: `if (k > 0) this.replaceSurface();`
            || self.replace_surface(),
            &mut warnings,
        );
        self.warnings.extend(warnings);
        match result {
            Ok(((), selection)) => {
                // JS: `this.device = <device>; this.device.graphicsSelection = {…}; this._resize();`
                self.device = Some(GraphicsDeviceModel { selection });
                self.resize();
                Ok(())
            }
            // JS: `throw new Error('No graphics API could be initialized (' + errors.join('; ') + ')');`
            Err(message) => Err(message),
        }
    }

    // JS: `get hasTouchscreen()` — quoted in `browser_alg::has_touchscreen`; used
    // for the initial Touchscreen Mode default (explicit user preferences win).
    pub fn has_touchscreen(&self) -> bool {
        browser_alg::has_touchscreen(
            self.navigator.max_touch_points,
            self.navigator.coarse_pointer,
        )
    }

    // ------------------------------------------------------------- glue setters

    // JS: the `window.innerWidth`/`innerHeight`/`devicePixelRatio` reads of
    // `_resize()` — see [`Viewport`].
    pub fn set_viewport(&mut self, viewport: Viewport) {
        self.viewport = viewport;
    }

    // JS: the navigator/performance reads — see [`NavigatorSnapshot`].
    pub fn set_navigator(&mut self, navigator: NavigatorSnapshot) {
        self.navigator = navigator;
    }

    // JS: `location.protocol` / `location.host` / `location.search` — read live
    // in the browser; the glue mirrors them here. The defaults model a `file://`
    // page (no origin proxy, no config.json fetch).
    pub fn set_location(&mut self, protocol: &str, host: &str, search: &str) {
        self.location_protocol = protocol.to_string();
        self.location_host = host.to_string();
        self.location_search = search.to_string();
    }

    // JS: `this.vsync` — set by the settings screen ('Use VSync: OFF' → false);
    // undefined (frames follow the display) until then. See `request_frame`.
    pub fn set_vsync(&mut self, vsync: Option<bool>) {
        self.vsync = vsync;
    }

    // JS: `isFullscreen() { return !!document.fullscreenElement; }` — the
    // fullscreenchange events stay in JS; the glue mirrors the element state.
    pub fn set_fullscreen(&mut self, fullscreen: bool) {
        self.fullscreen = fullscreen;
    }

    // JS: `document.addEventListener('pointerlockchange', …)` — the element
    // comparison (`document.pointerLockElement === this.canvas`) stays in JS;
    // the glue passes the result.
    pub fn on_pointer_lock_change(&mut self, locked: bool) {
        self.locked = locked;
        self.handlers.emit(
            PlatformEventKind::PointerLock.as_str(),
            &PlatformEvent::PointerLock(locked),
        );
    }

    // JS: the `#Gravrust-assets` element — the glue calls this when the element
    // exists (an absent element is modelled by never calling it). The decoder
    // runs in [`Platform::embedded_assets`].
    pub fn set_embedded_assets_source(&mut self, encoding: Option<&str>, bytes_attr: Option<&str>, text: &str) {
        self.embedded_source = Some(EmbeddedAssetsSource {
            encoding: encoding.map(str::to_string),
            bytes_attr: bytes_attr.map(str::to_string),
            text: text.to_string(),
        });
    }

    // JS: `document.getElementById('Gravrust-config')` + `el.textContent` — the
    // read stays in JS (None when the element is absent).
    pub fn set_embedded_config(&mut self, text: Option<&str>) {
        self.embedded_config_text = text.map(str::to_string);
    }

    // JS: the `config.json` fetch of `loadConfig()` (only on http(s) pages,
    // `cache: 'no-cache'`) stays in JS; the glue queues the outcome before
    // `load_config` runs: `Ok(Some(body))` for an ok response, `Ok(None)` for a
    // not-ok one, `Err(message)` when the fetch itself threw.
    pub fn set_pending_config_fetch(&mut self, fetch: Result<Option<String>, String>) {
        self.pending_config_fetch = Some(fetch);
    }

    // ------------------------------------------------------------- event bodies

    // JS keydown handler, in emit order:
    //
    // ```js
    // this._userGesture();
    // if (block.includes(e.code) || (e.ctrlKey && […].includes(e.code))) e.preventDefault();
    // this.emit('keydown', { code: e.code, key: e.key, repeat: e.repeat, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey });
    // if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) this.emit('char', e.key);
    // ```
    //
    // The addEventListener wiring stays in JS; `ctrl_key`/`meta_key` are the raw
    // KeyboardEvent flags — the payload merges them, the block check uses
    // `e.ctrlKey` only.
    pub fn on_key_down(
        &mut self,
        code: &str,
        key: &str,
        repeat: bool,
        ctrl_key: bool,
        meta_key: bool,
        shift_key: bool,
        alt_key: bool,
    ) -> KeydownOutcome {
        self.user_gesture();
        let prevent_default = browser_alg::should_prevent_default(code, ctrl_key);
        
        // Handle F key + number key combination for F1-F9
        // Track F key state
        let mut code = code;
        let mut key = key;
        if code == "KeyF" {
            self.f_key_held = true;
        }
        
        // If F is held and a number key (Digit1-Digit9) is pressed, translate to F1-F9
        if self.f_key_held && code.starts_with("Digit") && code.len() == 6 {
            let digit = &code[5..];
            if let Ok(num) = digit.parse::<u8>() {
                if (1..=9).contains(&num) {
                    // Map Digit1->F1, Digit2->F2, ..., Digit9->F9
                    code = match num {
                        1 => "F1",
                        2 => "F2",
                        3 => "F3",
                        4 => "F4",
                        5 => "F5",
                        6 => "F6",
                        7 => "F7",
                        8 => "F8",
                        9 => "F9",
                        _ => code,
                    };
                    key = code; // Use the same value for key
                }
            }
        }
        
        let prevent_default = browser_alg::should_prevent_default(code, ctrl_key);
        let (event, emitted_char) =
            browser_alg::decode_keydown(code, key, repeat, ctrl_key, meta_key, shift_key, alt_key);
        self.handlers.emit(
            PlatformEventKind::Keydown.as_str(),
            &PlatformEvent::Keydown(event.clone()),
        );
        if let Some(emitted) = &emitted_char {
            self.handlers.emit(
                PlatformEventKind::Char.as_str(),
                &PlatformEvent::Char(emitted.clone()),
            );
        }
        KeydownOutcome {
            prevent_default,
            event,
            emitted_char,
        }
    }

    // JS: `window.addEventListener('keyup', (e) => this.emit('keyup', { code: e.code, key: e.key }));`
    pub fn on_key_up(&mut self, code: &str, key: &str) -> KeyupEvent {
        // Track F key release for the F1-F9 feature
        if code == "KeyF" {
            self.f_key_held = false;
        }
        
        let event = KeyupEvent {
            code: code.to_string(),
            key: key.to_string(),
        };
        self.handlers.emit(
            PlatformEventKind::Keyup.as_str(),
            &PlatformEvent::Keyup(event.clone()),
        );
        event
    }

    // JS: `window.addEventListener('mousemove', (e) => this.emit('mousemove',
    // { x: e.clientX * (this.pxScale || this.dpr), y: …, dx: e.movementX || 0, dy: e.movementY || 0 }));`
    pub fn on_mouse_move(
        &mut self,
        client_x: f64,
        client_y: f64,
        movement_x: f64,
        movement_y: f64,
    ) -> MouseMoveEvent {
        let event = MouseMoveEvent {
            x: browser_alg::mouse_coord(client_x, self.px_scale, self.dpr),
            y: browser_alg::mouse_coord(client_y, self.px_scale, self.dpr),
            dx: browser_alg::truthy_or_zero(movement_x),
            dy: browser_alg::truthy_or_zero(movement_y),
        };
        self.handlers.emit(
            PlatformEventKind::MouseMove.as_str(),
            &PlatformEvent::MouseMove(event.clone()),
        );
        event
    }

    // JS: `mousedown` (with `this._userGesture()`) / `mouseup` — payload
    // `{ button, x: e.clientX * (this.pxScale || this.dpr), y: …, shift: e.shiftKey }`.
    pub fn on_mouse_button(
        &mut self,
        down: bool,
        button: i32,
        client_x: f64,
        client_y: f64,
        shift: bool,
    ) -> MouseButtonEvent {
        if down {
            self.user_gesture(); // JS: only mousedown runs the gesture
        }
        let event = MouseButtonEvent {
            button,
            x: browser_alg::mouse_coord(client_x, self.px_scale, self.dpr),
            y: browser_alg::mouse_coord(client_y, self.px_scale, self.dpr),
            shift,
        };
        let (kind, payload) = if down {
            (PlatformEventKind::MouseDown, PlatformEvent::MouseDown(event.clone()))
        } else {
            (PlatformEventKind::MouseUp, PlatformEvent::MouseUp(event.clone()))
        };
        self.handlers.emit(kind.as_str(), &payload);
        event
    }

    // JS: `window.addEventListener('wheel', (e) => { e.preventDefault(); if (e.deltaY)
    // this.emit('wheel', e.deltaY/(e.deltaMode===0?100:e.deltaMode===1?3:1)); }, { passive: false });`
    // — `None` models a falsy delta (nothing emitted); the preventDefault stays in JS.
    pub fn on_wheel(&mut self, delta_y: f64, delta_mode: f64) -> Option<f64> {
        let delta = browser_alg::wheel_delta(delta_y, delta_mode)?;
        self.handlers
            .emit(PlatformEventKind::Wheel.as_str(), &PlatformEvent::Wheel(delta));
        Some(delta)
    }

    // JS: `document.addEventListener('paste', (e) => { const t = e.clipboardData &&
    // e.clipboardData.getData('text'); if (t) this.emit('char', t); });` — an empty
    // string is falsy in JS and emits nothing.
    pub fn on_paste(&mut self, text: &str) -> Option<String> {
        if text.is_empty() {
            return None;
        }
        self.handlers.emit(
            PlatformEventKind::Char.as_str(),
            &PlatformEvent::Char(text.to_string()),
        );
        Some(text.to_string())
    }

    // JS: `window.addEventListener('blur', () => this.emit('blur'));`
    pub fn on_blur(&mut self) {
        self.handlers
            .emit(PlatformEventKind::Blur.as_str(), &PlatformEvent::Blur);
    }

    // JS: `_userGesture() { if (this.audio) this.audio.resume(); }` — every
    // mousedown/keydown resumes a suspended AudioContext (autoplay policy).
    fn user_gesture(&mut self) {
        if let Some(audio) = self.audio.as_mut() {
            audio.resume();
        }
    }

    // ------------------------------------------------------------- frame pumps

    // JS: the `port1.onmessage` body of the vsync-off MessageChannel —
    // `const q = this._mcq; this._mcq = []; const t = performance.now(); for (const f of q) f(t);`
    pub fn drain_message_frames(&mut self, now: f64) -> usize {
        self.frame_queue.drain(now)
    }

    // JS: the requestAnimationFrame callback receives its own timestamp (`fn(t)`).
    pub fn drain_animation_frames(&mut self, now: f64) -> usize {
        let frames = std::mem::take(&mut self.animation_queue);
        let count = frames.len();
        for frame in frames {
            frame(now);
        }
        count
    }

    // JS: the `postJson` response pairing, applied to a completed fetch (the
    // glue calls this with `r.status` and the body text).
    pub fn parse_post_response(&self, status: u16, body: Option<&str>) -> PostJsonResponse {
        browser_alg::parse_post_json(status, body)
    }

    // ------------------------------------------------------------- state reads

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn potato(&self) -> bool {
        self.potato
    }

    pub fn dpr(&self) -> f64 {
        self.dpr
    }

    pub fn px_scale(&self) -> f64 {
        self.px_scale
    }

    // JS: `this.canvas.width` / `this.canvas.height`.
    pub fn canvas_size(&self) -> (u32, u32) {
        (self.canvas_width, self.canvas_height)
    }

    // JS: `canvas.style.width` / `canvas.style.height` (CSS pixels).
    pub fn css_size(&self) -> (f64, f64) {
        (self.css_width, self.css_height)
    }

    pub fn image_rendering(&self) -> &'static str {
        self.image_rendering
    }

    pub fn device(&self) -> Option<&GraphicsDeviceModel> {
        self.device.as_ref()
    }

    pub fn audio(&self) -> Option<&BrowserAudio> {
        self.audio.as_ref()
    }

    pub fn audio_mut(&mut self) -> Option<&mut BrowserAudio> {
        self.audio.as_mut()
    }

    // JS: `this._mc` — the MessageChannel exists after the first vsync-off frame.
    pub fn message_channel_created(&self) -> bool {
        self.mc_created
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn loading(&self) -> Option<&LoadingState> {
        self.loading.as_ref()
    }

    // JS: the `console.warn(...)` lines (config.json, graphics fallback); the
    // glue forwards them.
    pub fn take_warnings(&mut self) -> Vec<String> {
        std::mem::take(&mut self.warnings)
    }
}

impl Default for BrowserPlatform {
    fn default() -> Self {
        BrowserPlatform::new()
    }
}

// JS: `performance.now()` — resolved dynamically because this crate does not
// enable web-sys API features; the Reflect call works on any JS runtime and
// `None` models a missing performance object (native builds never call it).
fn performance_now() -> Option<f64> {
    let performance = js_sys::Reflect::get(&js_sys::global(), &JsValue::from_str("performance")).ok()?;
    let now = js_sys::Reflect::get(&performance, &JsValue::from_str("now")).ok()?;
    let now = now.dyn_into::<js_sys::Function>().ok()?;
    now.call0(&performance).ok()?.as_f64()
}

impl Platform for BrowserPlatform {
    // JS: `get width() { return this.canvas.width; }` / `get height() { return this.canvas.height; }`
    fn width(&self) -> u32 {
        self.canvas_width
    }

    fn height(&self) -> u32 {
        self.canvas_height
    }

    // JS: `on(event, fn)` (the Emitter base class) — the contract events of
    // `platform.js`. The emitting side is the `on_*` methods above.
    fn on(&mut self, event: PlatformEventKind, handler: Box<dyn FnMut(&PlatformEvent)>) {
        self.handlers.on(event.as_str(), handler);
    }

    // JS: `lockPointer()` — `if (this.locked) return;` then
    // `this.canvas.requestPointerLock({ unadjustedMovement: true })` with a plain
    // `requestPointerLock()` retry when that rejects (both request chains and
    // their swallowed failures stay in JS); the pointerlockchange event mirrors
    // into `on_pointer_lock_change`.
    fn lock_pointer(&mut self) {
        if self.locked {
            return; // JS: `if (this.locked) return;`
        }
    }

    // JS: `unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }`
    // — the DOM call stays in JS.
    fn unlock_pointer(&mut self) {}

    // JS: `isPointerLocked() { return this.locked; }` (the cached pointerlockchange state).
    fn is_pointer_locked(&self) -> bool {
        self.locked
    }

    // JS: `toggleFullscreen() { if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    // else document.documentElement.requestFullscreen().catch(() => {}); }` — both
    // requests (and their swallowed rejections) stay in JS; the resulting
    // fullscreenchange mirrors into `set_fullscreen`.
    fn toggle_fullscreen(&mut self) {}

    // JS: `isFullscreen() { return !!document.fullscreenElement; }` (mirrored).
    fn is_fullscreen(&self) -> bool {
        self.fullscreen
    }

    // JS: `setClipboard(text) { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {}); }`
    // — the write (and its permission prompt) stays in JS.
    fn set_clipboard(&mut self, _text: &str) {}

    // JS: `loadSetting(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }`
    // — the localStorage transport (and the storage-disabled catch) stays in JS;
    // the model carries the synced values.
    fn load_setting(&self, key: &str) -> Option<String> {
        self.settings.get(key).cloned()
    }

    // JS: `saveSetting(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }`
    fn save_setting(&mut self, key: &str, value: &str) {
        self.settings.insert(key.to_string(), value.to_string());
    }

    // JS: `this.files = new IdbFiles('Gravrust', 'minekampf')` — see [`IdbFiles`].
    fn files(&mut self) -> &mut dyn PlatformFiles {
        &mut self.files
    }

    // JS: `pickFiles({ accept = '', multiple = false } = {})` — creates a file
    // input (`input.type/accept/multiple`), clicks it, and on change resolves
    // `[{ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }]`. The
    // dialog and the ArrayBuffer reads stay in JS (the contract models the empty
    // result as a cancelled picker); the option defaults live in
    // `platform_contract::PickFilesOptions`.
    fn pick_files(&mut self, _options: &PickFilesOptions) -> Vec<PickedFile> {
        Vec::new()
    }

    // JS: `saveFile(name, bytes, mime = 'application/octet-stream')` — Blob →
    // `URL.createObjectURL` → `a.download`/`a.href`/`a.click()` → revoke after
    // 5 s. The download chain stays in JS.
    fn save_file(&self, _name: &str, _bytes: &[u8], _mime: &str) {}

    // JS: `openUrl(url) { window.open(url, '_blank', 'noopener'); }` — browser-bound.
    fn open_url(&mut self, _url: &str) {}

    // JS: `async fetchBytes(path) { const r = await fetch(path); if (!r.ok) return null;
    // return new Uint8Array(await r.arrayBuffer()); }` — the fetch transport stays
    // in JS; the model reports "unavailable" (the JS null).
    fn fetch_bytes(&mut self, _path: &str) -> Option<Vec<u8>> {
        None
    }

    // JS: `async fetchText(path) { const r = await fetch(path); return r.ok ? r.text() : null; }`
    fn fetch_text(&mut self, _path: &str) -> Option<String> {
        None
    }

    // JS: `async postJson(path, body)` — `fetch(path, { method: 'POST', headers:
    // { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) })`
    // then `{ status: r.status, json }` with `json = null` when the body does not
    // parse (the pairing is `browser_alg::parse_post_json`, applied by
    // [`BrowserPlatform::parse_post_response`]). The transport stays in JS; the
    // model reports the "no response" pairing (status 0).
    fn post_json(&mut self, _path: &str, _body: &serde_json::Value) -> PostJsonResponse {
        PostJsonResponse { status: 0, json: None }
    }

    // JS: `async probe(url) { await fetch(url, { mode: 'no-cors', cache: 'no-store' }); return true; }`
    // — resolves true or rejects; the transport stays in JS and the model reports
    // the rejection (false, per the contract comment "reachability only").
    fn probe(&mut self, _url: &str) -> bool {
        false
    }

    // JS: `async fetchJson(path) { const r = await fetch(path); if (!r.ok) throw new
    // Error(`Failed to load ${path} (${r.status})`); return r.json(); }` — the
    // transport stays in JS; the error shape is `browser_alg::fetch_json_error`.
    fn fetch_json(&mut self, _path: &str) -> Result<serde_json::Value, String> {
        Err("the fetch transport stays in JavaScript".to_string())
    }

    // JS: `openSocket(url)` — `new WebSocket(url)` (rejecting 'Bad address <url>'
    // when the constructor throws) and the onopen/onerror promise stay browser-
    // bound. The model resolves with the socket state machine; its SocketEmitter
    // buffers greeting events (Wisp) until listeners install.
    fn open_socket(&mut self, url: &str) -> Result<Box<dyn PlatformSocket>, String> {
        Ok(Box::new(BrowserSocket::new(url)))
    }

    // JS: `originSocketUrl()` — quoted in `browser_alg::origin_socket_url`; the
    // `location.protocol`/`location.host` reads stay in JS (`set_location`).
    fn origin_socket_url(&self) -> Option<String> {
        browser_alg::origin_socket_url(&self.location_protocol, &self.location_host)
    }

    // JS: `embeddedAssets()` — the decode step is quoted in
    // `browser_alg::decode_embedded_assets`; the `#Gravrust-assets` element read
    // (`textContent`, `dataset.encoding`, `dataset.bytes`, `el.remove()`) stays
    // in JS (`set_embedded_assets_source`; an absent element is modelled by never
    // calling it). The `this._embedded` cache distinguishes `undefined` (not
    // checked), `null` (checked: absent element or throwing decoder) and the
    // decoded bytes — a throwing decoder (`Invalid packed data…`) propagates in
    // JS after `_embedded` was already nulled, so the null cache wins.
    fn embedded_assets(&mut self) -> Option<Vec<u8>> {
        if let Some(cached) = &self.embedded {
            return cached.clone(); // JS: `if (this._embedded !== undefined) return this._embedded;`
        }
        // JS: `this._embedded = null;` — set before decoding.
        self.embedded = Some(None);
        let source = match self.embedded_source.take() {
            Some(source) => source,
            None => return None, // JS: no element → the null cache stays
        };
        match browser_alg::decode_embedded_assets(
            source.encoding.as_deref(),
            source.bytes_attr.as_deref(),
            &source.text,
        ) {
            Ok(bytes) => {
                self.embedded = Some(Some(bytes.clone()));
                Some(bytes)
            }
            // JS: the decoder throws (surfaced by the glue); the model keeps the
            // null cache and reports nothing.
            Err(_) => None,
        }
    }

    // JS: `async loadConfig()` — quoted in `browser_alg::load_config_logic`. The
    // `#Gravrust-config` element text and the `config.json` fetch (only on
    // http(s) pages, `cache: 'no-cache'`) stay in JS; the glue mirrors the
    // element through `set_embedded_config` and queues the fetch outcome through
    // `set_pending_config_fetch` before this runs.
    fn load_config(&mut self) -> serde_json::Map<String, serde_json::Value> {
        let pending = self.pending_config_fetch.take();
        let mut warnings = Vec::new();
        let config = browser_alg::load_config_logic(
            self.embedded_config_text.as_deref(),
            // JS: `location.protocol === 'http:' || location.protocol === 'https:'`
            browser_alg::is_http_like(&self.location_protocol),
            || match pending {
                // No fetch queued: models a page that never fetched / a not-ok response.
                None => Ok(None),
                Some(Ok(body)) => match body {
                    // JS: `if (r.ok) config = { ...config, ...(await r.json()) };` —
                    // `r.json()` throwing is caught by the same try and warns.
                    Some(text) => serde_json::from_str(&text)
                        .map(Some)
                        .map_err(|error| error.to_string()),
                    None => Ok(None),
                },
                // JS: the fetch itself threw → `console.warn('Could not read config.json:', e.message)`.
                Some(Err(message)) => Err(message),
            },
            &mut warnings,
        );
        self.warnings.extend(warnings);
        config
    }

    // JS: `now() { return performance.now(); }`
    fn now(&self) -> f64 {
        performance_now().unwrap_or(0.0)
    }

    // JS: `requestFrame(fn)` — `if (this.vsync === false)` the frame joins the
    // MessageChannel queue (`this._mcq`), else it goes to requestAnimationFrame.
    // Both transports stay browser-bound; the model queues per transport and the
    // glue pumps with the frame timestamp (`drain_message_frames` /
    // `drain_animation_frames`).
    fn request_frame(&mut self, frame: Box<dyn FnOnce(f64)>) {
        if self.vsync == Some(false) {
            // JS: `if (!this._mc) { this._mc = new MessageChannel(); this._mcq = [];
            // this._mc.port1.onmessage = …; }` — created lazily.
            self.mc_created = true;
            // JS: `this._mcq.push(fn); if (this._mcq.length === 1) this._mc.port2.postMessage(0);`
            // (the returned bool is the post hint; the post itself stays in JS).
            let _post = self.frame_queue.push(frame);
        } else {
            // JS: `requestAnimationFrame(fn);`
            self.animation_queue.push(frame);
        }
    }

    // JS: `this.vsync` (undefined until set).
    fn vsync(&self) -> Option<bool> {
        self.vsync
    }

    // JS: `get cpuCount() { return (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4; }`
    fn cpu_count(&self) -> u32 {
        browser_alg::cpu_count(self.navigator.hardware_concurrency)
    }

    // JS: `info()` — the navigator reads stay in JS and are mirrored in
    // [`NavigatorSnapshot`]; the decoding is `browser_alg::runtime_info`.
    fn info(&self) -> PlatformInfo {
        let navigator = &self.navigator;
        browser_alg::runtime_info(
            &navigator.user_agent,
            navigator.hardware_concurrency,
            navigator.ua_platform.as_deref(),
            navigator.platform.as_deref(),
            navigator.memory.clone(),
        )
    }

    // JS: `async createGraphicsDevice(preference = 'auto')`. Without a gfx-layer
    // hook every API is unavailable — the model still runs the full selection
    // state machine (order, replaceSurface between attempts, graphicsSelection,
    // the joined error string) and reports the JS error. Real creation goes
    // through [`BrowserPlatform::create_graphics_device_with`].
    fn create_graphics_device(&mut self, preference: &str) -> Result<(), String> {
        self.create_graphics_device_with(preference, |_| {
            Err("the device constructors stay in JavaScript".to_string())
        })
    }

    // JS: `createAudio() { if (!window.AudioContext && !window.webkitAudioContext) return null;
    // this.audio = new WebAudio(); return this.audio; }` — the feature check stays
    // in JS; the model always creates the audio state machine and reports success
    // (JS replaces an existing `this.audio` too).
    fn create_audio(&mut self) -> bool {
        self.audio = Some(BrowserAudio::new());
        true
    }

    // JS: `createWorker(path, opts = {})` — `typeof Worker === 'undefined'` guard,
    // then `new Worker(path, opts.classic ? {} : { type: 'module' })` in a
    // try/catch (null on failure). The worker transport stays in JS; the model
    // reports the JS null.
    fn create_worker(&mut self, _path: &str, _classic: bool) -> Option<Box<dyn Worker>> {
        None
    }

    // JS: `setLoading(message, percent)` — shows `#loading` (`display: flex`),
    // writes `#loading-text`, and sets the `#loading-bar` width to `percent + '%'`
    // only when `percent !== undefined`. The DOM writes stay in JS; the model
    // mirrors the visible state (a percent-less call keeps the previous bar, an
    // errored overlay keeps its class — `classList.add` is never undone here).
    fn set_loading(&mut self, message: &str, percent: Option<f64>) {
        let previous = self.loading.take();
        self.loading = Some(LoadingState {
            message: message.to_string(),
            percent: percent.or(previous.as_ref().and_then(|state| state.percent)),
            error: previous.map(|state| state.error).unwrap_or(false),
        });
    }

    // JS: `hideLoading() { const el = document.getElementById('loading'); if (el) el.style.display = 'none'; }`
    fn hide_loading(&mut self) {
        self.loading = None;
    }

    // JS: `setLoadingError(message)` — `display: flex`, `classList.add('error')`,
    // and the text write happens even without a `#loading` element (`if (t) …`);
    // the bar is untouched.
    fn set_loading_error(&mut self, message: &str) {
        let percent = self.loading.as_ref().and_then(|state| state.percent);
        self.loading = Some(LoadingState {
            message: message.to_string(),
            percent,
            error: true,
        });
    }

    // JS: `setTitle(t) { document.title = t; }` — the write stays in JS; the
    // model mirrors it.
    fn set_title(&mut self, title: &str) {
        self.title = title.to_string();
    }

    // JS: `launchParams() { const out = {}; for (const [k, v] of new
    // URLSearchParams(location.search)) out[k] = v; return out; }` (object
    // assignment → the last duplicate wins, `browser_alg::fold_params`). The
    // `location.search` read stays in JS (`set_location`).
    fn launch_params(&self) -> HashMap<String, String> {
        browser_alg::fold_params(&browser_alg::parse_url_params(&self.location_search))
    }
}

// ---------------------------------------------------------------- tests

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;
    use std::rc::Rc;

    fn viewport(width: f64, height: f64, dpr: f64) -> Viewport {
        Viewport {
            inner_width: width,
            inner_height: height,
            dpr,
        }
    }

    #[test]
    fn constructor_matches_the_js_defaults() {
        // JS: `this.name = 'browser'`, `new IdbFiles('Gravrust', 'minekampf')`,
        // and the constructor's `this._resize()` on an (empty) window.
        let platform = BrowserPlatform::new();
        assert_eq!(platform.name(), "browser");
        assert_eq!(platform.files.db_name(), "Gravrust");
        assert_eq!(platform.files.legacy_name(), Some("minekampf"));
        assert_eq!(platform.canvas_size(), (1, 1)); // Math.max(1, …) on an empty window
        assert_eq!(platform.css_size(), (1.0, 1.0));
        assert_eq!(platform.dpr(), 1.0); // devicePixelRatio || 1
        assert_eq!(platform.px_scale(), 1.0);
        assert_eq!(platform.image_rendering(), "");
        assert!(!platform.potato());
        assert!(!platform.is_pointer_locked());
        assert!(!platform.is_fullscreen());
        assert_eq!(platform.vsync(), None);
        assert!(platform.device().is_none());
        assert!(platform.audio().is_none());
        assert_eq!(platform.title(), "");
        assert!(platform.loading().is_none());
    }

    #[test]
    fn resize_matches_the_device_pixel_math_and_emits_resize() {
        let mut platform = BrowserPlatform::new();
        let resizes: Rc<RefCell<usize>> = Rc::new(RefCell::new(0));
        let got = resizes.clone();
        platform.on(PlatformEventKind::Resize, Box::new(move |_| *got.borrow_mut() += 1));
        platform.set_viewport(viewport(1920.0, 1080.0, 2.0));
        platform.refresh_size();
        // Backing store in device pixels, CSS size kept.
        assert_eq!(platform.canvas_size(), (3840, 2160));
        assert_eq!(platform.css_size(), (1920.0, 1080.0));
        assert_eq!(platform.dpr(), 2.0);
        assert_eq!(platform.px_scale(), 2.0); // canvas.width / cw
        assert_eq!(*resizes.borrow(), 1);
        assert_eq!(platform.width(), 3840); // the contract getters
        assert_eq!(platform.height(), 2160);
    }

    #[test]
    fn potato_mode_caps_the_backing_store_and_pixelates() {
        let mut platform = BrowserPlatform::new();
        platform.set_viewport(viewport(1920.0, 1080.0, 1.0));
        platform.set_potato(true);
        // Hand-checked in browser_alg: 1920x1080 → 854x480 (854*480 = POTATO_PIXELS).
        assert_eq!(platform.canvas_size(), (854, 480));
        assert_eq!(platform.css_size(), (1920.0, 1080.0)); // set before potato scaling
        assert_eq!(platform.image_rendering(), "pixelated");
        assert_eq!(platform.px_scale(), 854.0 / 1920.0);
        // Below the cap the size is untouched (s = 1).
        platform.set_viewport(viewport(800.0, 450.0, 1.0));
        platform.refresh_size();
        assert_eq!(platform.canvas_size(), (800, 450));
        assert_eq!(platform.image_rendering(), "pixelated");
        // Off again: full resolution, no pixelated styling.
        platform.set_potato(false);
        assert_eq!(platform.canvas_size(), (800, 450));
        assert_eq!(platform.image_rendering(), "");
        assert!(!platform.potato());
    }

    #[test]
    fn key_events_run_the_js_handler_order() {
        let mut platform = BrowserPlatform::new();
        let seen: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        let keydowns = seen.clone();
        platform.on(PlatformEventKind::Keydown, Box::new(move |event| {
            if let PlatformEvent::Keydown(payload) = event {
                keydowns.borrow_mut().push(payload.code.clone());
            }
        }));
        let chars = seen.clone();
        platform.on(PlatformEventKind::Char, Box::new(move |event| {
            if let PlatformEvent::Char(text) = event {
                chars.borrow_mut().push(format!("char:{text}"));
            }
        }));

        // Ctrl+W: blocked (e.ctrlKey), merged into the payload ctrl, no char.
        let outcome = platform.on_key_down("KeyW", "w", false, true, false, false, false);
        assert!(outcome.prevent_default);
        assert!(outcome.event.ctrl);
        assert_eq!(outcome.emitted_char, None);
        // Plain 'a': not blocked, char emitted after the keydown.
        let outcome = platform.on_key_down("KeyA", "a", false, false, false, false, false);
        assert!(!outcome.prevent_default);
        assert_eq!(outcome.emitted_char.as_deref(), Some("a"));
        // Meta merges into ctrl for the payload but NOT for the block check (JS reads e.ctrlKey).
        let outcome = platform.on_key_down("KeyW", "w", false, false, true, false, false);
        assert!(!outcome.prevent_default);
        assert!(outcome.event.ctrl);
        assert_eq!(outcome.emitted_char, None);
        assert_eq!(
            *seen.borrow(),
            vec![
                "KeyW".to_string(),
                "KeyA".to_string(),
                "char:a".to_string(),
                "KeyW".to_string(),
            ]
        );
    }

    #[test]
    fn mouse_wheel_and_paste_payloads_match_the_js() {
        let mut platform = BrowserPlatform::new();
        platform.set_viewport(viewport(800.0, 600.0, 2.0));
        platform.refresh_size(); // pxScale = 1600 / 800 = 2
        let seen: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        let moves = seen.clone();
        platform.on(PlatformEventKind::MouseMove, Box::new(move |event| {
            if let PlatformEvent::MouseMove(m) = event {
                moves.borrow_mut().push(format!("move {} {} {} {}", m.x, m.y, m.dx, m.dy));
            }
        }));
        let downs = seen.clone();
        platform.on(PlatformEventKind::MouseDown, Box::new(move |event| {
            if let PlatformEvent::MouseDown(m) = event {
                downs.borrow_mut().push(format!("down {} {} {}", m.button, m.x, m.shift));
            }
        }));
        let ups = seen.clone();
        platform.on(PlatformEventKind::MouseUp, Box::new(move |event| {
            if let PlatformEvent::MouseUp(m) = event {
                ups.borrow_mut().push(format!("up {} {}", m.button, m.x));
            }
        }));
        let wheels = seen.clone();
        platform.on(PlatformEventKind::Wheel, Box::new(move |event| {
            if let PlatformEvent::Wheel(delta) = event {
                wheels.borrow_mut().push(format!("wheel {delta}"));
            }
        }));
        let chars = seen.clone();
        platform.on(PlatformEventKind::Char, Box::new(move |event| {
            if let PlatformEvent::Char(text) = event {
                chars.borrow_mut().push(format!("char {text}"));
            }
        }));

        // x/y scale by pxScale; dx/dy are the raw movement deltas.
        let mv = platform.on_mouse_move(10.0, 20.0, 3.0, -4.0);
        assert_eq!((mv.x, mv.y, mv.dx, mv.dy), (20.0, 40.0, 3.0, -4.0));
        let down = platform.on_mouse_button(true, 2, 5.0, 6.0, true);
        assert_eq!((down.button, down.x, down.y, down.shift), (2, 10.0, 12.0, true));
        let up = platform.on_mouse_button(false, 2, 5.0, 6.0, true);
        assert_eq!(up.button, 2);
        assert_eq!(platform.on_wheel(120.0, 0.0), Some(1.2)); // deltaMode 0 → /100
        assert_eq!(platform.on_wheel(0.0, 0.0), None); // JS: `if (e.deltaY)` — no emit
        assert_eq!(platform.on_paste("pasted"), Some("pasted".to_string()));
        assert_eq!(platform.on_paste(""), None); // JS: empty text is falsy
        assert_eq!(
            *seen.borrow(),
            vec![
                "move 20 40 3 -4".to_string(),
                "down 2 10 true".to_string(),
                "up 2 10".to_string(),
                "wheel 1.2".to_string(),
                "char pasted".to_string(),
            ]
        );
        // JS: keyup carries `{ code, key }`; blur carries no payload.
        let up_key = platform.on_key_up("KeyW", "w");
        assert_eq!((up_key.code.as_str(), up_key.key.as_str()), ("KeyW", "w"));
        platform.on_blur();
    }

    #[test]
    fn pointer_lock_fullscreen_and_settings_state() {
        let mut platform = BrowserPlatform::new();
        assert!(!platform.is_pointer_locked());
        platform.lock_pointer(); // JS: `if (this.locked) return;` — the request stays in JS
        platform.on_pointer_lock_change(true);
        assert!(platform.is_pointer_locked());
        platform.lock_pointer(); // JS: early return while locked
        platform.on_pointer_lock_change(false);
        assert!(!platform.is_pointer_locked());
        assert!(!platform.is_fullscreen());
        platform.set_fullscreen(true);
        assert!(platform.is_fullscreen());
        platform.toggle_fullscreen(); // JS: requestFullscreen/exitFullscreen stay in JS
        // Settings: the localStorage semantics (overwrite; missing → null).
        platform.save_setting("Gravrust.settings", "v1");
        assert_eq!(platform.load_setting("Gravrust.settings").as_deref(), Some("v1"));
        platform.save_setting("Gravrust.settings", "v2");
        assert_eq!(platform.load_setting("Gravrust.settings").as_deref(), Some("v2"));
        assert_eq!(platform.load_setting("missing"), None);
    }

    #[test]
    fn file_store_carries_the_idbfiles_semantics() {
        let mut files = IdbFiles::new("Gravrust", Some("minekampf"));
        files.put("saves/world.bin", &[1, 2, 3]).unwrap();
        files.put("saves/level.dat", &[4]).unwrap();
        files.put("screenshots/a.png", &[5]).unwrap();
        // JS: get of a missing key → null.
        assert_eq!(files.get("saves/world.bin").unwrap().as_deref(), Some(&[1u8, 2, 3][..]));
        assert_eq!(files.get("missing"), Ok(None));
        // JS: list(prefix) filters with startsWith (ascending key order).
        assert_eq!(
            files.list("saves/").unwrap(),
            vec!["saves/level.dat".to_string(), "saves/world.bin".to_string()]
        );
        assert_eq!(files.list("").unwrap().len(), 3);
        files.delete("saves/world.bin").unwrap();
        assert_eq!(files.get("saves/world.bin"), Ok(None));

        // Legacy migration: only fills an empty store.
        let mut fresh = IdbFiles::new("Gravrust", Some("minekampf"));
        let mut legacy = IdbFiles::new("minekampf", None);
        legacy.put("old.bin", &[9]).unwrap();
        fresh.migrate_from(&legacy);
        assert_eq!(fresh.get("old.bin").unwrap().as_deref(), Some(&[9u8][..]));
        let mut used = IdbFiles::new("Gravrust", Some("minekampf"));
        used.put("keep.bin", &[1]).unwrap();
        used.migrate_from(&legacy);
        assert_eq!(used.get("old.bin"), Ok(None)); // the store was not empty → untouched
        assert_eq!(used.get("keep.bin").unwrap().as_deref(), Some(&[1u8][..]));
    }

    #[test]
    fn socket_model_buffers_greeting_until_a_listener_installs() {
        let mut socket = BrowserSocket::new("wss://proxy/");
        assert_eq!(socket.url(), "wss://proxy/");
        assert_eq!(socket.ready_state(), SocketReadyState::Connecting);
        assert!(!socket.can_send()); // JS: `ws.readyState === 1`
        // A Wisp greeting arrives in the same network turn as open.
        socket.on_binary(&[1, 2]);
        socket.on_text("HELLO");
        assert_eq!(socket.pending_len("binary"), 1);
        assert_eq!(socket.pending_len("text"), 1);
        let seen: Rc<RefCell<Vec<String>>> = Rc::new(RefCell::new(Vec::new()));
        let got = seen.clone();
        socket.on(SocketEventKind::Binary, Box::new(move |event| {
            if let SocketEvent::Binary(bytes) = event {
                got.borrow_mut().push(format!("{bytes:?}"));
            }
        }));
        let got = seen.clone();
        socket.on(SocketEventKind::Text, Box::new(move |event| {
            if let SocketEvent::Text(text) = event {
                got.borrow_mut().push(text.clone());
            }
        }));
        // The buffered greeting replays in order; then events flow through.
        assert_eq!(*seen.borrow(), vec!["[1, 2]".to_string(), "HELLO".to_string()]);
        assert_eq!(socket.pending_len("binary"), 0);
        socket.on_open();
        assert!(socket.can_send());
        socket.on_close(1000, "bye");
        assert!(!socket.can_send());
        assert_eq!(socket.ready_state(), SocketReadyState::Closed);
    }

    #[test]
    fn open_socket_resolves_the_socket_model() {
        let mut platform = BrowserPlatform::new();
        // JS rejects 'Bad address <url>' / 'Could not connect to <url>' in the
        // browser; the model resolves with the socket state machine and its
        // event surface works through the trait.
        let mut socket = platform.open_socket("wss://proxy/").expect("socket resolves");
        let seen: Rc<RefCell<usize>> = Rc::new(RefCell::new(0));
        let got = seen.clone();
        socket.on(SocketEventKind::Close, Box::new(move |_event| *got.borrow_mut() += 1));
        socket.send_text("hi"); // JS: gated on readyState 1 (the transport stays in JS)
        socket.send_binary(&[1]);
        socket.close();
        assert_eq!(*seen.borrow(), 0); // nothing emitted yet (on_close drives it)
    }

    #[test]
    fn embedded_assets_cache_matches_the_js_null_semantics() {
        let mut platform = BrowserPlatform::new();
        // No element: the first call caches null (JS: `this._embedded = null`).
        assert_eq!(platform.embedded_assets(), None);
        // A late-arriving element is ignored — the cache already answered
        // (JS: `if (this._embedded !== undefined) return this._embedded;`).
        platform.set_embedded_assets_source(Some("base85"), Some("4"), "!!!!!");
        assert_eq!(platform.embedded_assets(), None);
    }

    #[test]
    fn embedded_assets_decode_once_and_cache_the_bytes() {
        let mut platform = BrowserPlatform::new();
        platform.set_embedded_assets_source(Some("base85"), Some("4"), "!!!!!");
        assert_eq!(platform.embedded_assets().as_deref(), Some(&[0u8, 0, 0, 0][..]));
        // The source element was consumed (`el.remove()`); the cache answers.
        assert_eq!(platform.embedded_assets().as_deref(), Some(&[0u8, 0, 0, 0][..]));
    }

    #[test]
    fn embedded_assets_cache_null_after_a_throwing_decoder() {
        let mut platform = BrowserPlatform::new();
        // Wrong payload length: JS decodeBase85 throws after `this._embedded = null`.
        platform.set_embedded_assets_source(Some("base85"), Some("4"), "!!!!");
        assert_eq!(platform.embedded_assets(), None);
        // The null cache wins over a later-good source.
        platform.set_embedded_assets_source(Some("base85"), Some("4"), "!!!!!");
        assert_eq!(platform.embedded_assets(), None);
    }

    #[test]
    fn load_config_merges_embedded_then_fetched() {
        let mut platform = BrowserPlatform::new();
        platform.set_location("https:", "example.com", "");
        platform.set_embedded_config(Some(r#"{"a": 1, "b": 2}"#));
        platform.set_pending_config_fetch(Ok(Some(r#"{"b": 3, "c": 4}"#.to_string())));
        let config = platform.load_config();
        assert_eq!(config.get("a"), Some(&serde_json::json!(1)));
        assert_eq!(config.get("b"), Some(&serde_json::json!(3)));
        assert_eq!(config.get("c"), Some(&serde_json::json!(4)));
        assert!(platform.take_warnings().is_empty());

        // A network failure warns like JS console.warn.
        let mut platform = BrowserPlatform::new();
        platform.set_location("http:", "example.com", "");
        platform.set_embedded_config(Some(r#"{"a": 5}"#));
        platform.set_pending_config_fetch(Err("offline".to_string()));
        let config = platform.load_config();
        assert_eq!(config.get("a"), Some(&serde_json::json!(5)));
        assert_eq!(
            platform.take_warnings(),
            vec!["Could not read config.json: offline".to_string()]
        );

        // file:// pages never fetch — the queued result is ignored.
        let mut platform = BrowserPlatform::new();
        platform.set_embedded_config(Some(r#"{"a": 7}"#));
        platform.set_pending_config_fetch(Ok(Some(r#"{"a": 9}"#.to_string())));
        let config = platform.load_config();
        assert_eq!(config.get("a"), Some(&serde_json::json!(7)));
    }

    #[test]
    fn load_config_warns_on_bad_embedded_json_and_bad_fetch_body() {
        // A bad embedded config warns but keeps an empty base.
        let mut platform = BrowserPlatform::new();
        platform.set_embedded_config(Some("{oops"));
        let config = platform.load_config();
        assert!(config.is_empty());
        let warnings = platform.take_warnings();
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].starts_with("Bad embedded config"));

        // r.ok but a non-JSON body: JS catches `r.json()` and warns.
        let mut platform = BrowserPlatform::new();
        platform.set_location("https:", "example.com", "");
        platform.set_pending_config_fetch(Ok(Some("not json".to_string())));
        let config = platform.load_config();
        assert!(config.is_empty());
        let warnings = platform.take_warnings();
        assert_eq!(warnings.len(), 1);
        assert!(warnings[0].starts_with("Could not read config.json:"));
    }

    #[test]
    fn graphics_device_selection_stamps_and_resizes() {
        let mut platform = BrowserPlatform::new();
        platform.set_viewport(viewport(800.0, 600.0, 1.0));
        let mut attempts: Vec<String> = Vec::new();
        platform
            .create_graphics_device_with("auto", |api| {
                attempts.push(api.to_string());
                if api == "webgl2" {
                    Err("no context".to_string())
                } else {
                    Ok(())
                }
            })
            .expect("webgpu succeeds");
        // JS: the order is webgl2 → webgpu → software and replaceSurface ran
        // before the second attempt (the model resets the device + resize).
        assert_eq!(attempts, vec!["webgl2".to_string(), "webgpu".to_string()]);
        let device = platform.device().expect("the device is stored");
        assert_eq!(device.selection.requested, "auto");
        assert_eq!(device.selection.active, "webgpu");
        assert_eq!(device.selection.errors, vec!["webgl2: no context".to_string()]);
        assert_eq!(
            platform.take_warnings(),
            vec!["webgl2 unavailable: no context".to_string()]
        );
        // JS: `this._resize()` after creation (device present — same rounded sizes).
        assert_eq!(platform.canvas_size(), (800, 600));
    }

    #[test]
    fn graphics_device_without_a_gfx_hook_reports_the_js_error() {
        let mut platform = BrowserPlatform::new();
        let error = Platform::create_graphics_device(&mut platform, "auto").unwrap_err();
        assert!(error.starts_with("No graphics API could be initialized (webgl2: "));
        assert!(error.contains("webgpu: the device constructors stay in JavaScript"));
        assert!(error.ends_with("software: the device constructors stay in JavaScript)"));
        assert!(platform.device().is_none());
        assert_eq!(platform.take_warnings().len(), 3); // one console.warn per API
    }

    #[test]
    fn request_frame_routes_by_vsync() {
        let mut platform = BrowserPlatform::new();
        let stamps: Rc<RefCell<Vec<f64>>> = Rc::new(RefCell::new(Vec::new()));
        // JS: vsync undefined → requestAnimationFrame.
        let got = stamps.clone();
        platform.request_frame(Box::new(move |t| got.borrow_mut().push(t)));
        assert!(!platform.message_channel_created());
        // JS: vsync === false → the MessageChannel queue.
        platform.set_vsync(Some(false));
        let got = stamps.clone();
        platform.request_frame(Box::new(move |t| got.borrow_mut().push(t)));
        assert!(platform.message_channel_created()); // JS: `if (!this._mc) …`
        assert_eq!(platform.drain_animation_frames(100.0), 1);
        assert_eq!(platform.drain_message_frames(16.6), 1);
        assert_eq!(*stamps.borrow(), vec![100.0, 16.6]);
        assert_eq!(platform.drain_animation_frames(1.0), 0);
        assert_eq!(platform.drain_message_frames(1.0), 0);
    }

    #[test]
    fn launch_params_fold_last_wins_and_origin_url_matches_the_scheme() {
        let mut platform = BrowserPlatform::new();
        platform.set_location("https:", "example.com", "?connect=a&connect=b&user=Name+X&flag");
        let params = Platform::launch_params(&platform);
        assert_eq!(params.get("connect").map(String::as_str), Some("b"));
        assert_eq!(params.get("user").map(String::as_str), Some("Name X"));
        assert_eq!(params.get("flag").map(String::as_str), Some(""));
        // JS: `originSocketUrl()` on the mirrored location.
        assert_eq!(platform.origin_socket_url().as_deref(), Some("wss://example.com/"));
        platform.set_location("http:", "localhost:8080", "");
        assert_eq!(platform.origin_socket_url().as_deref(), Some("ws://localhost:8080/"));
        // The default models a file:// page.
        let file_page = BrowserPlatform::new();
        assert_eq!(file_page.origin_socket_url(), None);
        assert!(Platform::launch_params(&file_page).is_empty());
    }

    #[test]
    fn loading_ui_state_mirrors_the_dom_writes() {
        let mut platform = BrowserPlatform::new();
        assert!(platform.loading().is_none());
        platform.set_loading("Loading assets", Some(40.0));
        let state = platform.loading().unwrap();
        assert_eq!(
            (state.message.as_str(), state.percent, state.error),
            ("Loading assets", Some(40.0), false)
        );
        // JS: a percent-less setLoading leaves the bar alone.
        platform.set_loading("Connecting", None);
        let state = platform.loading().unwrap();
        assert_eq!(state.percent, Some(40.0));
        // JS: setLoadingError keeps the bar and adds the error class.
        platform.set_loading_error("Boom");
        let state = platform.loading().unwrap();
        assert_eq!((state.message.as_str(), state.percent, state.error), ("Boom", Some(40.0), true));
        // JS: hideLoading hides the overlay.
        platform.hide_loading();
        assert!(platform.loading().is_none());
        // JS: setLoadingError without a visible overlay still writes the text.
        platform.set_loading_error("Fatal");
        let state = platform.loading().unwrap();
        assert_eq!((state.message.as_str(), state.percent, state.error), ("Fatal", None, true));
        // JS: setTitle writes document.title.
        platform.set_title("Gravrust");
        assert_eq!(platform.title(), "Gravrust");
    }

    #[test]
    fn navigator_snapshot_drives_info_cpu_count_and_touchscreen() {
        let mut platform = BrowserPlatform::new();
        // Empty navigator: JS `m ? … : 'Browser'`, bits 32, `'?x ' + 'CPU'`.
        assert_eq!(
            platform.info(),
            PlatformInfo {
                runtime: "Browser".into(),
                bits: 32,
                memory: None,
                cpu: "?x CPU".into(),
            }
        );
        assert_eq!(platform.cpu_count(), 4);
        assert!(!platform.has_touchscreen());
        platform.set_navigator(NavigatorSnapshot {
            user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.2210.91".into(),
            hardware_concurrency: Some(12),
            ua_platform: Some("Windows".into()),
            platform: Some("Win32".into()),
            memory: Some(MemoryInfo {
                used: 1.0,
                total: 2.0,
                max: 3.0,
            }),
            max_touch_points: Some(5),
            coarse_pointer: Some(false),
        });
        // Leftmost match wins on real Edge UAs (JS regex semantics).
        assert_eq!(platform.info().runtime, "Chrome 120");
        assert_eq!(platform.info().bits, 64);
        assert_eq!(platform.info().cpu, "12x Windows");
        assert_eq!(platform.info().memory.as_ref().unwrap().max, 3.0);
        assert_eq!(platform.cpu_count(), 12);
        assert!(platform.has_touchscreen()); // navigator.maxTouchPoints > 0
    }

    #[test]
    fn audio_state_machine_matches_the_js_webaudio() {
        let mut platform = BrowserPlatform::new();
        assert!(platform.audio().is_none()); // JS: `this.audio = null`
        assert!(platform.create_audio());
        assert!(!platform.audio().unwrap().running()); // `!!this.ctx && state === 'running'`
        // JS: setListener ignores writes before the context exists.
        platform
            .audio_mut()
            .unwrap()
            .set_listener(&[1.0, 2.0, 3.0], &[0.0, 0.0, -1.0], &[0.0, 1.0, 0.0]);
        assert!(platform.audio().unwrap().listener().is_none());
        // JS: resume() creates the context (suspended) and resumes it.
        platform.audio_mut().unwrap().resume();
        assert!(platform.audio().unwrap().running());
        assert!(platform.audio().unwrap().context_created());
        // The earlier listener write was dropped; a later one sticks.
        platform
            .audio_mut()
            .unwrap()
            .set_listener(&[1.0, 2.0, 3.0], &[0.0, 0.0, -1.0], &[0.0, 1.0, 0.0]);
        let listener = platform.audio().unwrap().listener().unwrap();
        assert_eq!(listener.position, [1.0, 2.0, 3.0]);
        assert_eq!(listener.up, [0.0, 1.0, 0.0]);
        // decode issues ascending handles (the AudioBuffer stays in JS).
        assert_eq!(platform.audio_mut().unwrap().decode(&[1, 2, 3]), Some(0));
        assert_eq!(platform.audio_mut().unwrap().decode(&[]), Some(1));
        // play resolves the option chain (browser_alg::play_chain) into a voice.
        let mut voice = platform
            .audio_mut()
            .unwrap()
            .play(
                &0,
                PlayOptions {
                    volume: Some(0.5),
                    pitch: Some(2.0),
                    pos: Some([4.0, 5.0, 6.0]),
                    ..Default::default()
                },
            )
            .expect("voice created");
        assert_eq!(voice.gain(), 0.5);
        assert_eq!(voice.playback_rate(), 2.0);
        assert_eq!(voice.panner_position(), Some(&[4.0, 5.0, 6.0]));
        assert!(!voice.ended());
        voice.set_pitch(3.0);
        voice.set_volume(0.25);
        voice.set_position(&[7.0, 8.0, 9.0]);
        assert_eq!(voice.playback_rate(), 3.0);
        assert_eq!(voice.gain(), 0.25);
        assert_eq!(voice.panner_position(), Some(&[7.0, 8.0, 9.0]));
        // stop() halts playback (JS: src.stop() → onended → ended + onEnd).
        let ended_flag = Rc::new(RefCell::new(false));
        let flag = ended_flag.clone();
        let mut voice = platform
            .audio_mut()
            .unwrap()
            .play(
                &1,
                PlayOptions {
                    on_end: Some(Box::new(move || *flag.borrow_mut() = true)),
                    ..Default::default()
                },
            )
            .unwrap();
        assert!(!*ended_flag.borrow());
        voice.stop();
        assert!(voice.ended());
        assert!(*ended_flag.borrow());
        // A voice without a panner ignores setPosition (JS: `if (!panner) return;`).
        let mut voice = platform
            .audio_mut()
            .unwrap()
            .play(&2, PlayOptions::default())
            .unwrap();
        assert_eq!(voice.gain(), 1.0); // default volume → 1
        assert_eq!(voice.playback_rate(), 1.0); // default pitch → 1
        voice.set_position(&[9.0, 9.0, 9.0]);
        assert_eq!(voice.panner_position(), None);
    }

    #[test]
    fn browser_platform_installs_into_the_platform_registry() {
        use crate::platform::{clear_platform, platform, set_platform};
        clear_platform();
        let registered: Rc<RefCell<dyn Platform>> = Rc::new(RefCell::new(BrowserPlatform::new()));
        set_platform(registered.clone());
        let got = platform().expect("the browser platform is installed");
        assert!(Rc::ptr_eq(&registered, &got));
        // The default viewport clamps to the 1x1 surface.
        assert_eq!(got.borrow().width(), 1);
        assert_eq!(got.borrow().height(), 1);
        clear_platform();
    }

    #[test]
    fn post_response_pairing_is_browser_alg_parse_post_json() {
        let platform = BrowserPlatform::new();
        let response = platform.parse_post_response(200, Some(r#"{"ok":true}"#));
        assert_eq!(response.status, 200);
        assert_eq!(response.json.unwrap()["ok"], serde_json::json!(true));
        assert_eq!(platform.parse_post_response(204, None).json, None);
    }
}
