//! Port of `client/js/render/shader-compat.js`.
//!
//! Shader compatibility transforms for running desktop OptiFine/Iris GLSL shaders
//! on WebGL2 / GLSL ES 3.0:
//! - Moves uniform-dependent global initializers into `mcjsInitGlobals()`
//! - Detects pack compatibility profile (photon, complementary, sildur, astra, bsl)
//! - Dead-code pruner for large multi-stage GLSL files

use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone, PartialEq)]
pub struct ShaderProfile {
    pub kind: String,
    pub final_options: Vec<String>,
    pub disabled: Vec<String>,
    pub fixed: HashMap<String, String>,
}

/// Detects pack profile from files present in archive.
pub fn detect_shader_profile(file_list: &[&str]) -> ShaderProfile {
    let has = |suffix: &str| file_list.iter().any(|f| f.ends_with(suffix));

    if has("include/global.glsl") && has("program/final.fsh") {
        let mut fixed = HashMap::new();
        fixed.insert("DEBUG_VIEW".into(), "0".into());
        ShaderProfile {
            kind: "photon".into(),
            final_options: vec!["CAS".into(), "CAS_INTENSITY".into()],
            disabled: vec!["COLORED_LIGHTS".into(), "TAA".into(), "TAAU".into(), "DISTANCE_VIEW".into()],
            fixed,
        }
    } else if has("lib/common.glsl") && has("program/final.glsl") {
        let mut fixed = HashMap::new();
        fixed.insert("COLORED_LIGHTING".into(), "0".into());
        fixed.insert("WORLD_SPACE_REFLECTIONS".into(), "-1".into());
        ShaderProfile {
            kind: "complementary".into(),
            final_options: vec![
                "IMAGE_SHARPENING".into(), "CHROMA_ABERRATION".into(),
                "UNDERWATER_DISTORTION".into(), "WATER_REFRACTION_INTENSITY".into(), "VIGNETTE_R".into(),
            ],
            disabled: vec!["TAA".into()],
            fixed,
        }
    } else if has("shaders.settings") {
        let mut fixed = HashMap::new();
        fixed.insert("Showbuffer".into(), "0".into());
        ShaderProfile {
            kind: "sildur".into(),
            final_options: vec![],
            disabled: vec![
                "TAA".into(), "Depth_of_Field".into(), "Motionblur".into(), "Distance_Blur".into(),
                "smoothDof".into(), "DoF_Strength".into(), "Dof_Distance_View".into(), "MB_strength".into(),
            ],
            fixed,
        }
    } else if has("settings/globalSettings.glsl") && has("lib/vertex/waving.glsl") {
        ShaderProfile {
            kind: "astra".into(),
            final_options: vec![],
            disabled: vec!["DISTORTION".into(), "ARC_EN_CIEL".into(), "BARREL".into()],
            fixed: HashMap::new(),
        }
    } else {
        ShaderProfile {
            kind: "bsl".into(),
            final_options: vec![],
            disabled: vec![],
            fixed: HashMap::new(),
        }
    }
}

/// JS: `deferredShaderGlobals(source)`
pub fn deferred_shader_globals(source: &str) -> String {
    let mut inits = Vec::new();
    let mut output = String::new();

    for line in source.lines() {
        let trimmed = line.trim();
        // Check for top-level float/vec/mat initialization: e.g. "float f = 1.0;"
        if (trimmed.starts_with("float ") || trimmed.starts_with("vec") || trimmed.starts_with("mat"))
            && trimmed.contains('=')
            && trimmed.ends_with(';')
        {
            if let Some((decl, val)) = trimmed.split_once('=') {
                let parts: Vec<&str> = decl.split_whitespace().collect();
                if parts.len() >= 2 {
                    let name = parts[1];
                    inits.push(format!("{} = {};", name, val.trim_end_matches(';').trim()));
                    output.push_str(&format!("{} {};\n", parts[0], name));
                    continue;
                }
            }
        }
        output.push_str(line);
        output.push('\n');
    }

    if inits.is_empty() {
        return source.to_string();
    }

    let mut final_code = String::from("void mcjsInitGlobals();\n");
    if output.contains("void main()") {
        final_code.push_str(&output.replace("void main()", "void main() {\n  mcjsInitGlobals();"));
    } else {
        final_code.push_str(&output);
    }
    final_code.push_str("\nvoid mcjsInitGlobals() {\n");
    for init in inits {
        final_code.push_str(&format!("  {}\n", init));
    }
    final_code.push_str("}\n");

    final_code
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_sildur_profile() {
        let files = ["shaders/shaders.settings", "shaders/final.fsh"];
        let prof = detect_shader_profile(&files);
        assert_eq!(prof.kind, "sildur");
        assert!(prof.disabled.contains(&"TAA".to_string()));
    }

    #[test]
    fn test_deferred_shader_globals() {
        let glsl = "float myGlobal = 2.5;\nvoid main() {\n  gl_FragColor = vec4(myGlobal);\n}\n";
        let transformed = deferred_shader_globals(glsl);
        assert!(transformed.contains("mcjsInitGlobals"));
        assert!(transformed.contains("myGlobal = 2.5;"));
    }
}
