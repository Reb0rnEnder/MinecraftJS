//! `crate::graphics` — compatibility tree matching `client/js/gfx/`.
//!
//! WebGL2/WebGPU device calls are browser-bound. The portable pieces (matrix and
//! frustum maths, the software rasteriser, shader preprocessing) already exist
//! as flat modules; this tree re-exports them under the JS path and provides the
//! texture handle type the ported call sites use.

pub use crate::math;

/// JS: `webgl2.js` / `webgpu.js` `Texture` — an uploaded GPU texture handle.
///
/// The JavaScript holds the live `WebGLTexture`/`GPUTexture` object. Rust keeps
/// only the identifying metadata plus the uploaded dimensions; the handle itself
/// stays on the platform side, reached through the drawing contract.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Texture {
    /// JS: the resource path the texture was loaded from, e.g. `gui/icons.png`.
    pub name: String,
    /// JS: `texture.width`.
    pub width: u32,
    /// JS: `texture.height`.
    pub height: u32,
}

impl Texture {
    /// A texture handle with the given identity and dimensions.
    pub fn new(name: impl Into<String>, width: u32, height: u32) -> Self {
        Texture { name: name.into(), width, height }
    }
}

/// `client/js/gfx/software.js` — the CPU rasteriser.
pub mod software {
    pub use crate::software::*;
}

/// `client/js/gfx/math.js` — mat4 + frustum.
pub mod math_ext {
    pub use crate::math::*;
}
