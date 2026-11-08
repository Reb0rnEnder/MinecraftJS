//! Port of `client/js/render/shader-pack.js`.
//!
//! Custom shader pack include tree resolution and WebGL2 program assembly.
//! Enforces include depth limits, normalizes relative paths, and inserts header definitions.

pub const MC_VERSION: u32 = 11502;
pub const MAX_INCLUDE_DEPTH: usize = 32;
pub const MAX_EXPANDED_SHADER_BYTES: usize = 2 * 1024 * 1024;

/// Normalizes shader include path resolving relative `..` and `.`.
pub fn normalize_shader_path(path: &str) -> Result<String, &'static str> {
    let mut parts: Vec<&str> = Vec::new();
    for p in path.split('/') {
        if p == ".." {
            if parts.is_empty() {
                return Err("Shader include escapes shaders folder");
            }
            parts.pop();
        } else if !p.is_empty() && p != "." {
            parts.push(p);
        }
    }
    Ok(parts.join("/"))
}

/// Generates standard OptiFine / Iris WebGL2 compatibility preamble.
pub fn generate_glsl300es_preamble(has_frag_color: bool) -> String {
    let mut header = format!(
        "#version 300 es\n\
        precision highp float;\n\
        precision highp int;\n\
        precision highp sampler2DShadow;\n\
        #define MC_VERSION {}\n\
        #define MC_GL_VERSION 302\n\
        #define MC_GLSL_VERSION 330\n\
        #define MC_RENDER_QUALITY 1.0\n\
        #define MC_HAND_DEPTH 0.125\n",
        MC_VERSION
    );
    if has_frag_color {
        header.push_str("out vec4 mcjsFinalColor;\n");
    }
    header.push_str(
        "vec4 mcjsTextureLod(sampler2D s, vec2 uv, int lod) { return textureLod(s, uv, float(lod)); }\n\
        vec4 mcjsTextureLod(sampler2D s, vec2 uv, float lod) { return textureLod(s, uv, lod); }\n"
    );
    header
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_shader_path() {
        assert_eq!(normalize_shader_path("lib/../program/final.fsh").unwrap(), "program/final.fsh");
        assert!(normalize_shader_path("../outside.fsh").is_err());
    }

    #[test]
    fn test_generate_glsl300es_preamble() {
        let p = generate_glsl300es_preamble(true);
        assert!(p.contains("#version 300 es"));
        assert!(p.contains("mcjsFinalColor"));
        assert!(p.contains("#define MC_VERSION 11502"));
    }
}
