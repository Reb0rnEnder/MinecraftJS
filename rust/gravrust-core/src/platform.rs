//! Port of `client/js/platform/platform.js`: the current-platform registry.
//!
//! JS source (whole file):
//!
//! ```js
//! let current = null;
//! export function setPlatform(p) { current = p; }
//! export function platform() {
//!   if (!current) throw new Error('Platform not initialised');
//!   return current;
//! }
//! ```
//!
//! The contract itself (`Platform` and its payload/socket/audio/worker types) is
//! ported in `platform_contract.rs`; this module holds the global `current`
//! platform — the JS runtime is single-threaded, so a thread-local replaces the
//! module-level variable. The throwing `platform()` accessor becomes a
//! `Result` carrying the original `'Platform not initialised'` message.

use std::cell::RefCell;
use std::rc::Rc;

use crate::platform_contract::Platform;

// JS: `let current = null;`
thread_local! {
    static CURRENT: RefCell<Option<Rc<RefCell<dyn Platform>>>> = const { RefCell::new(None) };
}

/// JS: `export function setPlatform(p) { current = p; }`.
pub fn set_platform(p: Rc<RefCell<dyn Platform>>) {
    CURRENT.with(|current| *current.borrow_mut() = Some(p));
}

/// JS: `export function platform() { if (!current) throw new Error('Platform not initialised'); return current; }`.
///
/// The JS throw becomes `Err("Platform not initialised")`.
pub fn platform() -> Result<Rc<RefCell<dyn Platform>>, String> {
    CURRENT
        .with(|current| current.borrow().clone())
        .ok_or_else(|| "Platform not initialised".to_string())
}

/// Whether a platform is installed (JS: `current != null`).
pub fn has_platform() -> bool {
    CURRENT.with(|current| current.borrow().is_some())
}

/// JS: `current = null` — the JS module never clears the global; provided so
/// tests (and multi-boot glue) can reset the registry.
pub fn clear_platform() {
    CURRENT.with(|current| *current.borrow_mut() = None);
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform_contract::{
        KeydownEvent, MouseButtonEvent, MouseMoveEvent, PickFilesOptions, PlatformEvent,
        PlatformEventKind, PlatformFiles, PlatformInfo, PlatformSocket, PostJsonResponse,
    };
    use std::collections::HashMap;

    /// Minimal contract implementation used to exercise the registry.
    struct StubPlatform {
        surface: u32,
    }

    impl StubPlatform {
        fn new(surface: u32) -> Rc<RefCell<dyn Platform>> {
            Rc::new(RefCell::new(StubPlatform { surface }))
        }
    }

    impl Platform for StubPlatform {
        fn width(&self) -> u32 {
            self.surface
        }
        fn height(&self) -> u32 {
            self.surface
        }
        fn on(&mut self, _event: PlatformEventKind, _handler: Box<dyn FnMut(&PlatformEvent)>) {}
        fn lock_pointer(&mut self) {}
        fn unlock_pointer(&mut self) {}
        fn is_pointer_locked(&self) -> bool {
            false
        }
        fn toggle_fullscreen(&mut self) {}
        fn is_fullscreen(&self) -> bool {
            false
        }
        fn set_clipboard(&mut self, _text: &str) {}
        fn load_setting(&self, _key: &str) -> Option<String> {
            None
        }
        fn save_setting(&mut self, _key: &str, _value: &str) {}
        fn files(&mut self) -> &mut dyn PlatformFiles {
            unreachable!()
        }
        fn pick_files(&mut self, _options: &PickFilesOptions) -> Vec<crate::platform_contract::PickedFile> {
            Vec::new()
        }
        fn save_file(&self, _name: &str, _bytes: &[u8], _mime: &str) {}
        fn open_url(&mut self, _url: &str) {}
        fn fetch_bytes(&mut self, _path: &str) -> Option<Vec<u8>> {
            None
        }
        fn fetch_text(&mut self, _path: &str) -> Option<String> {
            None
        }
        fn post_json(&mut self, _path: &str, _body: &serde_json::Value) -> PostJsonResponse {
            PostJsonResponse {
                status: 0,
                json: None,
            }
        }
        fn probe(&mut self, _url: &str) -> bool {
            false
        }
        fn fetch_json(&mut self, _path: &str) -> Result<serde_json::Value, String> {
            Err("stub".into())
        }
        fn open_socket(&mut self, _url: &str) -> Result<Box<dyn PlatformSocket>, String> {
            Err("stub".into())
        }
        fn origin_socket_url(&self) -> Option<String> {
            None
        }
        fn embedded_assets(&mut self) -> Option<Vec<u8>> {
            None
        }
        fn load_config(&mut self) -> serde_json::Map<String, serde_json::Value> {
            serde_json::Map::new()
        }
        fn now(&self) -> f64 {
            0.0
        }
        fn request_frame(&mut self, _frame: Box<dyn FnOnce(f64)>) {}
        fn vsync(&self) -> Option<bool> {
            None
        }
        fn cpu_count(&self) -> u32 {
            4
        }
        fn info(&self) -> PlatformInfo {
            PlatformInfo {
                runtime: "Stub".into(),
                bits: 64,
                memory: None,
                cpu: "1x CPU".into(),
            }
        }
        fn create_graphics_device(&mut self, _preference: &str) -> Result<(), String> {
            Err("stub".into())
        }
        fn create_audio(&mut self) -> bool {
            false
        }
        fn create_worker(
            &mut self,
            _path: &str,
            _classic: bool,
        ) -> Option<Box<dyn crate::platform_contract::Worker>> {
            None
        }
        fn set_loading(&mut self, _message: &str, _percent: Option<f64>) {}
        fn hide_loading(&mut self) {}
        fn set_loading_error(&mut self, _message: &str) {}
        fn set_title(&mut self, _title: &str) {}
        fn launch_params(&self) -> HashMap<String, String> {
            HashMap::new()
        }
    }

    fn with_clean_registry<T>(run: impl FnOnce() -> T) -> T {
        clear_platform();
        let out = run();
        clear_platform();
        out
    }

    #[test]
    fn platform_before_set_matches_the_js_throw_message() {
        with_clean_registry(|| {
            assert_eq!(platform().err().unwrap(), "Platform not initialised");
            assert!(!has_platform());
        });
    }

    #[test]
    fn set_platform_then_platform_returns_the_same_instance() {
        with_clean_registry(|| {
            let p = StubPlatform::new(640);
            set_platform(p.clone());
            assert!(has_platform());
            let got = platform().unwrap();
            assert!(Rc::ptr_eq(&p, &got));
            // Game code reads the surface through the contract.
            assert_eq!(got.borrow().width(), 640);
            assert_eq!(got.borrow().height(), 640);
        });
    }

    #[test]
    fn set_platform_replaces_the_current_platform() {
        with_clean_registry(|| {
            set_platform(StubPlatform::new(1));
            set_platform(StubPlatform::new(2));
            assert_eq!(platform().unwrap().borrow().width(), 2);
        });
    }

    #[test]
    fn clear_platform_resets_the_registry() {
        with_clean_registry(|| {
            set_platform(StubPlatform::new(1));
            clear_platform();
            assert!(platform().is_err());
        });
    }

    #[test]
    fn keydown_payload_shape_matches_the_contract_comment() {
        // `{ code, key, repeat, ctrl, shift, alt }`
        let event = KeydownEvent {
            code: "KeyW".into(),
            key: "w".into(),
            repeat: false,
            ctrl: true,
            shift: false,
            alt: false,
        };
        assert_eq!(event.code, "KeyW");
        assert!(event.ctrl);
        // `{ button, x, y, shift }` and `{ x, y, dx, dy }` are plain data too.
        let mouse = MouseButtonEvent {
            button: 2,
            x: 1.0,
            y: 2.0,
            shift: true,
        };
        let move_event = MouseMoveEvent {
            x: 1.0,
            y: 2.0,
            dx: 3.0,
            dy: 4.0,
        };
        assert_eq!((mouse.button, move_event.dx), (2, 3.0));
        assert_eq!(PlatformEventKind::PointerLock.as_str(), "pointerlock");
    }
}
