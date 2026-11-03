//! WebGPU math utilities - ported from webgpu.js math helpers

pub fn fog_factor(distance: f32, density: f32) -> f32 {
    // exp2 mode: 1.0 - exp(-density * distance)
    1.0 - (-density * distance).exp()
}
