//! `crate::runtime` — compatibility tree matching `client/js/runtime/`.
//!
//! The JavaScript runtime layer wraps the worker pool and frame scheduling. The
//! portable profiling timers already exist in `src/profiling.rs`; this tree
//! re-exports them and provides the runtime description type the call sites use.

pub use crate::profiling::*;

/// JS: the runtime/environment description (`client/js/runtime/`).
///
/// The JavaScript reads these values from the live browser environment. The host
/// fills this in at boot so the ported code can branch on them without touching
/// browser globals directly.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct RuntimeInfo {
    /// JS: `navigator.userAgent`.
    pub user_agent: String,
    /// JS: `navigator.hardwareConcurrency` — worker pool sizing.
    pub hardware_concurrency: u32,
    /// JS: whether WebGL2 is available.
    pub has_webgl2: bool,
    /// JS: whether WebGPU is available.
    pub has_webgpu: bool,
    /// JS: whether the packed single-file build is in use.
    pub packed: bool,
}
