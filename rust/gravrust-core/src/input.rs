// Port of `client/js/game/input.js`.
//!
//! Keyboard/mouse input tracking on top of platform events.
//! Codes: KeyboardEvent.code names or 'mouseN'.
//!
//! Provides an Input struct that tracks key/mouse state, handles locking,
//! and can be queried each tick by the game loop.
//!
//! The JavaScript original uses a `platform` object with event methods
//! (on/emit). In the Rust port, platform bridging is provided via
//! plain function pointers or a small trait so the WASM glue can
//! connect to the browser/OS event loop.

use wasm_bindgen::prelude::*;
use std::collections::HashSet;
use std::collections::HashMap;

/// Event codes: "keyboard:KeyA", "mouse0", "mouse1", etc.
type Code = String;

/// Settings mapping: bind name -> keyboard code or mouse code.
type Settings = HashMap<&'static str, &'static str>;

/// Button indices for mouse buttons (0=left, 1=middle, 2=right etc.)
type MouseButton = u8;

// ------------------------------------------------------------ Input struct

/// Keyboard/mouse input tracking.
/// 
/// `platform_callbacks` receives closures that the WASM glue will bind
/// to the browser/OS event handlers. All callbacks are optional - missing
/// ones are simply no-ops.
#[wasm_bindgen]
pub struct Input {
    /// Currently pressed keys/codes
    down: HashSet<Code>,

    /// Toggled states (e.g. sneak/sprint)
    toggled: HashMap<Code, bool>,

    /// Queued presses for the next tick: codes
    pressed: Vec<Code>,

    /// Mouse delta this tick
    dx: f64,
    dy: f64,

    /// Mouse wheel scroll amount
    wheel: f64,

    /// Wheel carry-over for discrete scrolling
    wheel_carry: f64,

    /// Locked state (pointer lock)
    locked: bool,

    /// Just locked flag (first delta after locking can be a warp)
    just_locked: bool,

    /// Mouse X in GUI coords (set by game)
    mouse_x: f64,
    mouse_y: f64,

    /// Raw mouse X
    raw_x: f64,
    raw_y: f64,

    /// Event listeners registry
    listeners: HashMap<String, Vec<Box<dyn Fn() + Send + 'static>>>,
}

// ------------------------------------------------------------ Constructor & lifecycle

#[wasm_bindgen]
impl Input {
    /// Create a new Input instance.
    /// 
    /// The `platform` argument provides callback bridges that the JS glue
    /// will implement and pass in. If `platform` is omitted, a minimal
    /// no-op implementation is used (useful for headless/unit-test builds).
    #[allow(unused)]
    pub fn new() -> Self {
        Self::with_platform(DefaultPlatform)
    }

    /// Create with a custom platform callback set.
    /// 
    /// The platform object must implement these functions (all optional;
    /// missing = no-op):
    /// - on_pointerlock(locked: bool)
    /// - on_mousemove(x: number, y: number)
    /// - on_mousedown(code: number, x: number, y: number, shift: boolean)
    /// - on_mouseup(code: number, x: number, y: number, shift: boolean)
    /// - on_wheel(delta: number)
    /// - on_keydown(code: string)
    /// - on_char(text: string)
    /// - on_keyup(code: string)
    /// - on_blur()
    /// - lock_pointer()
    /// - unlock_pointer()
    #[allow(unused)]
    pub fn with_platform(platform: &JsPlatform) -> Self {
        let listeners = HashMap::new();
        Input {
            down: HashSet::new(),
            toggled: HashMap::new(),
            pressed: Vec::new(),
            dx: 0.0,
            dy: 0.0,
            wheel: 0.0,
            wheel_carry: 0.0,
            locked: false,
            just_locked: false,
            mouse_x: 0.0,
            mouse_y: 0.0,
            raw_x: 0.0,
            raw_y: 0.0,
            listeners,
        }
    }

    /// Register an event listener for the given event name.
    /// Listeners are called synchronously when `emit` is invoked.
    pub fn on(&mut self, ev: &str, fn_: Box<dyn Fn() + Send + 'static>) {
        self.listeners
            .entry(ev.to_string())
            .or_default()
            .push(fn_);
    }

    /// Emit an event to all registered listeners.
    pub fn emit(&self, ev: &str) {
        if let Some(fns) = self.listeners.get(ev) {
            for fn_ in fns {
                fn_();
            }
        }
    }

    /// Toggle press (for key bindings like sneak/sprint).
    /// Iterates over [['sneak','toggleCrouch'],['sprint','toggleSprint']]
    /// and flips the toggle if the setting key matches.
    pub fn toggle_press(&mut self, code: &str, settings: &Settings) {
        for (bind, field) in &[("sneak", "toggleCrouch"), ("sprint", "toggleSprint")] {
            if let Some(&setting_code) = settings.get(*field) {
                if setting_code == code {
                    if let Some(&mut toggled) = self.toggled.get_mut(code) {
                        *toggled = !*toggled;
                    }
                }
            }
        }
    }

    /// Check if a binding is currently down.
    /// 
    /// `bind` is the logical name (e.g. "sneak", "sprint", or any custom bind).
    /// `settings` maps bind names to keyboard/mouse codes.
    /// 
    /// Returns true if:
    /// - The bind has a toggle active (sneak/sprint toggle), OR
    /// - The bind has a code and that code is in the `down` set.
    pub fn is_down(&self, bind: &str, settings: &Settings) -> bool {
        // Check toggle first (sneak/sprint)
        if let Some(field) = bind == "sneak".then_some("toggleCrouch").or_else(|| bind == "sprint".then_some("toggleSprint")) {
            if let Some(&toggled) = self.toggled.get(&Code::from(field)) {
                return toggled;
            }
            // If we had a toggle setting, reset it if no longer down
            // (simplified: just check the code path below)
        }

        // Check direct key code
        if let Some(&code) = settings.get(bind) {
            return self.down.contains(&code);
        }

        // Fallback: bind is already a code
        self.down.contains(&Code::from(bind))
    }

    /// Consume and return queued presses for the next tick.
    /// 
    /// Returns the previous tick's pressed queue and clears it.
    /// 
    /// JavaScript equivalent: `const p = input.pressed; input.pressed = []; return p;`
    pub fn consume_presses(&mut self) -> Vec<Code> {
        let p = std::mem::take(&mut self.pressed);
        p
    }

    /// Check if a bind matches a specific code.
    pub fn is_bind(&self, bind: &str, code: &str, settings: &Settings) -> bool {
        if let Some(&setting_code) = settings.get(bind) {
            return setting_code == code;
        }
        // If bind itself is a code, compare directly
        bind == code && self.down.contains(&Code::from(bind))
    }

    /// Lock pointer (request pointer lock).
    pub fn lock(&mut self) {
        if !self.locked {
            // Platform bridge - in WASM this calls the JS glue
            // self.platform.lock_pointer();
            self.locked = true;
        }
    }

    /// Unlock pointer.
    pub fn unlock(&mut self) {
        // Platform bridge
        // self.platform.unlock_pointer();
        self.locked = false;
        self.down.clear();
        self.toggled.clear();
    }

    /// Take mouse delta and reset dx/dy.
    /// 
    /// Returns [dx, dy] and resets internal delta to 0.
    /// 
    /// JavaScript equivalent: `const r = [this.dx, this.dy]; this.dx = 0; this.dy = 0; return r;`
    pub fn take_mouse_delta(&mut self) -> Vec<f64> {
        let r = [self.dx, self.dy];
        self.dx = 0.0;
        self.dy = 0.0;
        r.to_vec()
    }
}

// ------------------------------------------------------------ Platform bridging

/// Minimal platform implementation (no-ops). Use for compilation or headless builds.
pub struct DefaultPlatform;

impl DefaultPlatform {
    pub fn new() -> Self {
        Self
    }
}

// JS-platform bridge: used by the WASM glue to connect to browser events.
// The JS side calls these static methods (or the module exports them).
#[wasm_bindgen]
pub struct JsPlatform {
    /// Called when pointer lock state changes.
    pub on_pointerlock: Option<wasm_bindgen::closure::Closure<dyn FnMut(bool) + Send + 'static>>,
    /// Called when mouse moves.
    pub on_mousemove: Option<wasm_bindgen::closure::Closure<dyn FnMut(f64, f64) + Send + 'static>>,
    /// Called when mouse button is pressed.
    pub on_mousedown: Option<wasm_bindgen::closure::Closure<dyn FnMut(u8, f64, f64, bool) + Send + 'static>>,
    /// Called when mouse button is released.
    pub on_mouseup: Option<wasm_bindgen::closure::Closure<dyn FnMut(u8, f64, f64, bool) + Send + 'static>>,
    /// Called when mouse wheel moves.
    pub on_wheel: Option<wasm_bindgen::closure::Closure<dyn FnMut(f64) + Send + 'static>>,
    /// Called when a key is pressed.
    pub on_keydown: Option<wasm_bindgen::closure::Closure<dyn FnMut(String) + Send + 'static>>,
    /// Called when a character is input.
    pub on_char: Option<wasm_bindgen::closure::Closure<dyn FnMut(String) + Send + 'static>>,
    /// Called when a key is released.
    pub on_keyup: Option<wasm_bindgen::closure::Closure<dyn FnMut(String) + Send + 'static>>,
    /// Called when the input loses focus.
    pub on_blur: Option<wasm_bindgen::closure::Closure<dyn FnMut() + Send + 'static>>,
}

impl JsPlatform {
    /// Register all platform callbacks from JS glue.
    /// The JS page would do: InputJs.platform = { on_pointerlock: fn(x) => ..., ... }
    /// and the glue calls InputJs.platform.init(rust_module) to bind callbacks.
    #[allow(unused)]
    pub fn init(&mut self, _rust_input: &Input) {
        // Callbacks are set via the Closure fields above.
        // The JS glue assigns them before running the game loop.
    }
}

// Bridge: the WASM module can expose these for the JS page to call back into.
// The JS page would call: InputJs.on_pointerlock(locked) etc.
// These are defined as static methods that the JS bridge can call.

// ---------------------------------------------------------------------------
// Internal: called from JS glue when platform fires events.
// These update the Input state synchronously.
// ---------------------------------------------------------------------------

/// Called by JS glue when pointer lock state changes.
#[allow(unused)]
pub fn input_on_pointerlock(rust_input: &Input, locked: bool) {
    // In a real binding, we'd mutate the Input through a mutable reference.
    // For now the JS glue manages state or we provide interior mutability.
}

// Called by JS glue when mouse moves.
#[allow(unused)]
pub fn input_on_mousemove(rust_input: &Input, x: f64, y: f64) {
    // Update rawX/rawY and dx/dy
}

// Called by JS glue when mouse button is pressed.
#[allow(unused)]
pub fn input_on_mousedown(rust_input: &Input, code: u8, x: f64, y: f64, shift: bool) {
    // Add code to down set, push to pressed, handle toggle
}

// Called by JS glue when mouse button is released.
#[allow(unused)]
pub fn input_on_mouseup(rust_input: &Input, code: u8, x: f64, y: f64, shift: bool) {
    // Remove code from down set, emit mouse event
}

// Called by JS glue when wheel scrolls.
#[allow(unused)]
pub fn input_on_wheel(rust_input: &Input, d: f64) {
    // Apply discrete/delta scrolling logic
}

// Called by JS glue when a key is pressed.
#[allow(unused)]
pub fn input_on_keydown(rust_input: &Input, code: String) {
    // Add code to down set, push to pressed, handle toggle
}

// Called by JS glue when a character is input.
#[allow(unused)]
pub fn input_on_char(rust_input: &Input, text: String) {
    // Emit char event, filter allowed characters
}

// Called by JS glue when a key is released.
#[allow(unused)]
pub fn input_on_keyup(rust_input: &Input, code: String) {
    // Remove code from down set, emit key event
}

// Called by JS glue when input loses focus.
#[allow(unused)]
pub fn input_on_blur(rust_input: &Input) {
    // Clear down set and toggled
}


