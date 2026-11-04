//! Port of `client/js/wasm/core.js` — the WASM core loader.
//!
//! The JavaScript module keeps three pieces of state (`started`, `ready`,
//! `startPromise`), exposes `wasmReady()` and a single-flight `initWasm()`,
//! and decodes the module from an embedded base64 payload with `atob`
//! before instantiating it. Any failure leaves `ready === false` and the
//! client silently keeps running on the JavaScript fallbacks.
//!
//! The ES-module import and the `WebAssembly.instantiate` call themselves are
//! browser-bound and stay in JS; the host drives them through the closure
//! passed to [`WasmLoader::init`]. Everything else — the state machine, the
//! single-flight semantics, `atob` (WHATWG *forgiving-base64 decode* with its
//! throwing failure boundary), and the two console message formats — is
//! ported here exactly.

use wasm_bindgen::prelude::*;

// JS: `import init, * as core from './pkg/gravrust_core.js';`
//      `import { wasmBase64 } from './pkg/wasm-bytes.js';`
// Browser-bound (stays in JS): ES module graph. The host supplies the
// instantiated module's `core_version()` string and the payload size.

// ---------------------------------------------------------- atob (forgiving base64)

/// JS: `atob(wasmBase64)` — the WHATWG *forgiving-base64 decode* used by
/// `window.atob`. Unlike the crate's [`crate::base64`] decoder (which is the
/// client's own forgiving `util/base64.js`), `atob` **throws** on invalid
/// input: after stripping ASCII whitespace, any character outside the
/// standard alphabet, any `=` that is not 1–2 trailing padding characters,
/// or a remaining length that leaves a remainder of 1 is a failure.
pub fn atob_decode(payload: &str) -> Result<Vec<u8>, String> {
    // Spec: remove all ASCII whitespace before validation.
    let stripped: Vec<u8> = payload
        .bytes()
        .filter(|b| !matches!(b, b'\t' | b'\n' | b'\x0c' | b'\r' | b' '))
        .collect();
    let mut data = stripped;

    // Spec: if length % 4 == 0, drop one or two trailing '=' padding chars.
    let padding = match data.len() % 4 {
        0 => {
            let mut p = 0usize;
            while p < 2 && data.last() == Some(&b'=') {
                data.pop();
                p += 1;
            }
            p
        }
        // Spec: a remainder of 1 is a failure. Remainders of 2/3 are
        // unpadded input, which atob accepts.
        1 => return Err("InvalidCharacterError: length % 4 == 1".to_string()),
        _ => 0,
    };
    let _ = padding;

    let mut out = Vec::with_capacity(data.len() / 4 * 3 + 3);
    let mut buffer: u32 = 0;
    let mut bits: u32 = 0;
    for &byte in &data {
        let symbol = match byte {
            b'A'..=b'Z' => byte - b'A',
            b'a'..=b'z' => byte - b'a' + 26,
            b'0'..=b'9' => byte - b'0' + 52,
            b'+' => 62,
            b'/' => 63,
            // Spec: any remaining '=' (mid-payload or excess padding) fails,
            // as does any other character.
            _ => return Err("InvalidCharacterError: invalid base64 character".to_string()),
        };
        buffer = ((buffer << 6) | symbol as u32) & 0x00ff_ffff;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push(((buffer >> bits) & 0xff) as u8);
        }
    }
    Ok(out)
}

/// JS: `(bytes.length / 1024).toFixed(1)` — the KiB size shown in the ready log.
pub fn kib_label(bytes_len: usize) -> String {
    format!("{:.1}", bytes_len as f64 / 1024.0)
}

// ---------------------------------------------------------------- loader state

/// JS: `let started = false; let ready = false; let startPromise = null;`
///
/// The loader state machine. `started` guards the single-flight `initWasm()`;
/// `ready` is the `wasmReady()` flag; `outcome` records how the one attempt
/// ended, mirroring the resolved promise every later caller joins.
#[derive(Debug, Default, Clone)]
pub struct WasmLoader {
    started: bool,
    ready: bool,
    outcome: Option<InitOutcome>,
}

/// How the single initialization attempt ended.
#[derive(Debug, Clone, PartialEq)]
pub enum InitOutcome {
    /// JS: `ready = true; console.info(\`[wasm] GRAVRUST-core ${core.core_version()} (${(bytes.length / 1024).toFixed(1)} KiB)\`)`
    Ready { version: String, bytes_len: usize },
    /// JS: `ready = false; console.warn('[wasm] Rust core unavailable; using JS fallbacks:', error)`
    Failed { error: String },
}

impl WasmLoader {
    /// JS: fresh module state — `started = false, ready = false, startPromise = null`.
    pub fn new() -> Self {
        Self::default()
    }

    /// JS: `export function wasmReady() { return ready; }`
    pub fn wasm_ready(&self) -> bool {
        self.ready
    }

    /// Whether an attempt is (or was) in flight — JS: `startPromise !== null`.
    pub fn started(&self) -> bool {
        self.started
    }

    /// The resolved outcome of the in-flight attempt, if any.
    pub fn outcome(&self) -> Option<&InitOutcome> {
        self.outcome.as_ref()
    }

    /// JS: `export function initWasm() { if (started) return startPromise; ... }`
    ///
    /// Single-flight: when an attempt already started, the caller joins the
    /// same in-flight attempt, so this returns `None` and must not restart.
    /// Otherwise the one attempt runs `attempt()`:
    ///
    /// 1. JS: `if (typeof atob !== 'function') throw new Error('atob is unavailable');`
    /// 2. JS: decode the base64 payload into bytes.
    /// 3. JS: `await init({ module_or_path: bytes })` and log the ready line.
    /// 4. JS: any throw → `ready = false` + the fallback warning.
    ///
    /// The browser-bound `instantiate` step stays in JS; the host closure
    /// returns the module version string on success or the error message.
    pub fn init(
        &mut self,
        attempt: impl FnOnce() -> Result<(String, usize), String>,
    ) -> Option<&InitOutcome> {
        if self.started {
            // JS: `return startPromise;` — join, never restart.
            return None;
        }
        self.started = true;
        self.outcome = Some(match attempt() {
            Ok((version, bytes_len)) => {
                self.ready = true;
                InitOutcome::Ready { version, bytes_len }
            }
            Err(error) => {
                self.ready = false;
                InitOutcome::Failed { error }
            }
        });
        self.outcome.as_ref()
    }
}

// JS: `console.info(`[wasm] GRAVRUST-core ${core.core_version()} (${(bytes.length / 1024).toFixed(1)} KiB)`);`
pub fn ready_log_message(version: &str, bytes_len: usize) -> String {
    format!("[wasm] GRAVRUST-core {version} ({}) KiB", kib_label(bytes_len))
}

// JS: `console.warn('[wasm] Rust core unavailable; using JS fallbacks:', error);`
pub fn fallback_warn_message(error: &str) -> String {
    format!("[wasm] Rust core unavailable; using JS fallbacks: {error}")
}

// ------------------------------------------------------------- wasm-bindgen exports

/// JS: `export function wasmReady()` — host-facing ready query.
#[wasm_bindgen]
pub fn loader_ready(ready: bool) -> bool {
    ready
}

/// JS: `(bytes.length / 1024).toFixed(1)` — exposed for the JS glue's log line.
#[wasm_bindgen]
pub fn loader_kib_label(bytes_len: usize) -> String {
    kib_label(bytes_len)
}

// ------------------------------------------------------------------------ tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn atob_decodes_like_the_browser() {
        assert_eq!(atob_decode("aGVsbG8=").unwrap(), b"hello");
        assert_eq!(atob_decode("aGVsbG8").unwrap(), b"hello");
        assert_eq!(atob_decode("aG Vs\nbG8=").unwrap(), b"hello");
        assert_eq!(atob_decode("").unwrap(), b"");
    }

    #[test]
    fn atob_throws_on_invalid_input() {
        // Invalid character (util/base64.js would skip it; atob throws).
        assert!(atob_decode("aG!sbG8=").is_err());
        // Any '=' that is not 1-2 trailing chars fails.
        assert!(atob_decode("aG=sbG8=").is_err());
        assert!(atob_decode("aGVsbG8===").is_err());
        // Remainder of 1 after stripping whitespace (5 chars % 4 == 1).
        assert!(atob_decode("abcde").is_err());
    }

    #[test]
    fn init_is_single_flight() {
        let mut loader = WasmLoader::new();
        assert!(loader.init(|| Ok(("0.1.0".to_string(), 2048u32 as usize * 1024))).is_some());
        // JS: `if (started) return startPromise;` — the second call joins and
        // must not rerun the attempt (a failing attempt here proves it did not run).
        assert!(loader.init(|| Err("should not run".to_string())).is_none());
        assert!(loader.wasm_ready());
        assert_eq!(
            loader.outcome(),
            Some(&InitOutcome::Ready { version: "0.1.0".to_string(), bytes_len: 2048 * 1024 })
        );
    }

    #[test]
    fn failure_leaves_ready_false() {
        let mut loader = WasmLoader::new();
        loader.init(|| Err("atob is unavailable".to_string())).unwrap();
        assert!(!loader.wasm_ready());
        assert_eq!(
            loader.outcome(),
            Some(&InitOutcome::Failed { error: "atob is unavailable".to_string() })
        );
    }

    #[test]
    fn messages_match_the_js_formats() {
        assert_eq!(kib_label(0), "0.0");
        assert_eq!(kib_label(1024), "1.0");
        assert_eq!(kib_label(1864560), "1820.9");
        assert_eq!(ready_log_message("0.1.0", 2048), "[wasm] GRAVRUST-core 0.1.0 (2.0) KiB");
        assert_eq!(
            fallback_warn_message("boom"),
            "[wasm] Rust core unavailable; using JS fallbacks: boom"
        );
    }
}
