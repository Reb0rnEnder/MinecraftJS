//! WebGL2 algorithm layer
//! Shader compilation, state management, uniform handling

pub fn compile_shader(gl: &WebGl2RenderingContext, src: &str, kind: u32) -> Result<WebGlShader, JsValue> {
    // ...
    Ok(shader)
}
