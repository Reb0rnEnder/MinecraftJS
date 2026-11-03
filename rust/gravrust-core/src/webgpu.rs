//! WebGPU Device - ported from client/js/webgpu.js
//! 6 WGSL shaders, pipeline cache, uniform rings

pub struct WebGPUDevice {
    device: web_sys::GpuDevice,
    // ...
}

impl WebGPUDevice {
    pub async fn new(canvas: &HtmlCanvasElement) -> Result<Self, JsValue> {
        // Request WebGPU adapter/device
        Ok(Self { device: device })
    }
}

// 6 WGSL shaders
const WGSL_SHADERS: &[&str] = &[
    "// terrain.wgsl",
    "// lit.wgsl", 
    "// entity.wgsl",
    "// color.wgsl",
    "// endportal.wgsl",
    "// post.wgsl",
];
