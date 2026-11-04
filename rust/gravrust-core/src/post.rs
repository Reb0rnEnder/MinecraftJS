//! Port of `client/js/render/post.js`
//! Post-processing effects for the Minecraft render pipeline.
//!
//! This module ported the post-processing chain definitions, shader programs,
//! and built-in effect chains from the JavaScript render pipeline. Used for
//! spectator modes (creeper, spider, enderman) and various post-processing
//! effects like blur, color convolution, inversion, and more.

use std::collections::HashMap;
use wasm_bindgen::prelude::*;

/// Shader programs for the post-processing pipeline.
/// Each program has a mode number and default uniform values.
/// Mode numbers correspond to the shader pass types used in the render pipeline.
#[derive(Clone, Debug)]
pub struct ProgramInfo {
    /// The program mode number
    pub mode: i32,
    /// Default uniform values indexed by slot
    pub uniforms: HashMap<String, Vec<f32>>,
}

/// All post-processing shader programs and their default uniforms.
/// Mode 0: blit (copy with modulation), 1: invert, 2: color convolve,
/// 3: bits (mosaic), 4: blur, 5: spider vision, 6: Sobel edge detect,
/// 7: deconverge, 8: phosphor, 9: bumpy, 10: blobs, 11: blobs2,
/// 12: antialias, 13: pincushion distort, 14: wobble, 15: outline soft,
/// 16: flip (color modulate)
pub const PROGRAMS: Lazy<HashMap<String, ProgramInfo>> = Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert("blit".to_string(), ProgramInfo {
        mode: 0,
        uniforms: [(
            "ColorModulate".to_string(),
            vec![1.0, 1.0, 1.0, 1.0],
        )
        .iter()
        .cloned()
        .collect(),
        ]),
    m.insert("invert".to_string(), ProgramInfo {
        mode: 1,
        uniforms: [("InverseAmount".to_string(), vec![0.0]).iter().cloned().collect()],
    });
    m.insert("color_convolve".to_string(), ProgramInfo {
        mode: 2,
        uniforms: [
            ("Saturation".to_string(), vec![1.8]),
            ("RedMatrix".to_string(), vec![1.0, 0.0, 0.0]),
            ("GreenMatrix".to_string(), vec![0.0, 1.0, 0.0]),
            ("BlueMatrix".to_string(), vec![0.0, 0.0, 1.0]),
        ]
        .iter()
        .cloned()
        .collect(),
    });
    m.insert("bits".to_string(), ProgramInfo {
        mode: 3,
        uniforms: [("Resolution".to_string(), vec![4.0]), ("Saturation".to_string(), vec![1.5]), ("MosaicSize".to_string(), vec![8.0])]
            .iter()
            .cloned()
            .collect(),
    });
    m.insert("blur".to_string(), ProgramInfo {
        mode: 4,
        uniforms: [("BlurDir".to_string(), vec![1.0, 1.0]), ("Radius".to_string(), vec![5.0])].iter().cloned().collect(),
    });
    m.insert("spider".to_string(), ProgramInfo {
        mode: 5,
        uniforms: [
            ("InRotation".to_string(), vec![0.0]),
            ("InScale".to_string(), vec![1.0, 1.0]),
            ("InOffset".to_string(), vec![0.0, 0.0]),
            ("Scissor".to_string(), vec![0.0, 0.0, 1.0, 1.0]),
            ("Vignette".to_string(), vec![0.0, 0.0, 1.0, 1.0]),
        ]
        .iter()
        .cloned()
        .collect(),
    });
    m.insert("sobel".to_string(), ProgramInfo {
        mode: 6,
        uniforms: HashMap::new(),
    });
    m.insert("deconverge".to_string(), ProgramInfo {
        mode: 7,
        uniforms: [
            ("ConvergeX".to_string(), vec![-4.0, 0.0, 2.0]),
            ("ConvergeY".to_string(), vec![0.0, -4.0, 2.0]),
            ("RadialConvergeX".to_string(), vec![1.0, 1.0, 1.0]),
            ("RadialConvergeY".to_string(), vec![1.0, 1.0, 1.0]),
        ]
        .iter()
        .cloned()
        .collect(),
    });
    m.insert("phosphor".to_string(), ProgramInfo {
        mode: 8,
        uniforms: [("Phosphor".to_string(), vec![0.3, 0.3, 0.3])].iter().cloned().collect(),
    });
    m.insert("bumpy".to_string(), ProgramInfo {
        mode: 9,
        uniforms: HashMap::new(),
    });
    m.insert("blobs".to_string(), ProgramInfo {
        mode: 10,
        uniforms: HashMap::new(),
    });
    m.insert("blobs2".to_string(), ProgramInfo {
        mode: 11,
        uniforms: [("Radius".to_string(), vec![7.0])].iter().cloned().collect(),
    });
    m.insert("antialias".to_string(), ProgramInfo {
        mode: 12,
        uniforms: HashMap::new(),
    });
    m.insert("scan_pincushion".to_string(), ProgramInfo {
        mode: 13,
        uniforms: HashMap::new(),
    });
    m.insert("wobble".to_string(), ProgramInfo {
        mode: 14,
        uniforms: [("Time".to_string(), vec![0.0]), ("Frequency".to_string(), vec![512.0, 288.0]), ("WobbleAmount".to_string(), vec![0.002, 0.002])]
            .iter()
            .cloned()
            .collect(),
    });
    m.insert("outline_soft".to_string(), ProgramInfo {
        mode: 15,
        uniforms: [("LumaRamp".to_string(), vec![16.0]), ("LumaLevel".to_string(), vec![4.0])].iter().cloned().collect(),
    });
    m.insert("flip".to_string(), ProgramInfo {
        mode: 16,
        uniforms: [("ColorModulate".to_string(), vec![1.0, 1.0, 1.0, 1.0])].iter().cloned().collect(),
    });
    m
});

// Uniform slot mappings for the post pipeline.
// Maps uniform names to their slot indices in the shader parameter buffer.
pub const SLOTS: Lazy<HashMap<String, usize>> = Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert("ColorModulate".to_string(), 4);
    m.insert("InverseAmount".to_string(), 1);
    m.insert("Saturation".to_string(), 1);
    m.insert("RedMatrix".to_string(), 4);
    m.insert("GreenMatrix".to_string(), 8);
    m.insert("BlueMatrix".to_string(), 12);
    m.insert("Resolution".to_string(), 1);
    m.insert("MosaicSize".to_string(), 3);
    m.insert("BlurDir".to_string(), 4);
    m.insert("Radius".to_string(), 6);
    m.insert("InRotation".to_string(), 1);
    m.insert("InScale".to_string(), 4);
    m.insert("InOffset".to_string(), 6);
    m.insert("Scissor".to_string(), 8);
    m.insert("Vignette".to_string(), 12);
    m.insert("ConvergeX".to_string(), 4);
    m.insert("ConvergeY".to_string(), 8);
    m.insert("RadialConvergeX".to_string(), 12);
    m.insert("RadialConvergeY".to_string(), 1);
    m.insert("Phosphor".to_string(), 4);
    m.insert("Time".to_string(), 1);
    m.insert("Frequency".to_string(), 4);
    m.insert("WobbleAmount".to_string(), 6);
    m.insert("LumaRamp".to_string(), 1);
    m.insert("LumaLevel".to_string(), 2);
    m
});

// SLOTS_BY_PROGRAM: per-program uniform slot overrides.
// Some programs override the default slot for specific uniforms.
pub const SLOTS_BY_PROGRAM: Lazy<HashMap<String, HashMap<String, usize>>> = Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert("bits".to_string(), [("Saturation".to_string(), 2)].iter().cloned().collect());
    m.insert("blobs2".to_string(), [("Radius".to_string(), 1)].iter().cloned().collect());
    m
});

// Built-in post-processing chains.
// Each chain defines a sequence of render passes with target textures and uniforms.
// Used for spectator effects (creeper, spider) and super-secret settings chains.
#[derive(Clone, Debug)]
pub struct PassDef {
    /// Name of the shader program pass
    pub name: String,
    /// Input target texture name or 'minecraft:main'
    pub intarget: String,
    /// Output target texture name
    pub outtarget: String,
    /// Auxiliary target (e.g. for BlurSampler)
    pub auxtargets: Vec<AuxTarget>,
    /// Uniform values to pass to the shader program
    pub uniforms: Vec<UniformDef>,
}

#[derive(Clone, Debug)]
pub struct AuxTarget {
    /// Name of the auxiliary texture
    pub name: String,
    /// Slot ID for the auxiliary texture
    pub id: usize,
}

#[derive(Clone, Debug)]
pub struct UniformDef {
    /// Name of the uniform
    pub name: String,
    /// Values for the uniform
    pub values: Vec<f32>,
}

/// A single-pass chain (main -> swap with program -> blit back)
fn single(name: &str) -> PassDef {
    PassDef {
        name: name.to_string(),
        intarget: "minecraft:main".to_string(),
        outtarget: "swap".to_string(),
        auxtargets: Vec::new(),
        uniforms: vec![UniformDef {
            name: name.to_string(),
            values: vec![1.0, 1.0, 1.0, 1.0],
        }],
    }
}

// Built-in chains for various post-processing effects.
// These are the "Super Secret Settings" chains that can be selected
// via the F3 + T debug menu (not all are ported).
pub const BUILTIN_CHAINS: Lazy<HashMap<String, Vec<PassDef>>> = Lazy::new(|| {
    let mut chains = HashMap::new();

    // Creeper effect: desaturate then mosaic
    chains.insert(
        "creeper".to_string(),
        vec![
            PassDef {
                name: "color_convolve".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "swap".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![
                    UniformDef {
                        name: "RedMatrix".to_string(),
                        values: vec![0.0, 0.0, 0.0],
                    },
                    UniformDef {
                        name: "GreenMatrix".to_string(),
                        values: vec![0.3, 0.59, 0.11],
                    },
                    UniformDef {
                        name: "BlueMatrix".to_string(),
                        values: vec![0.0, 0.0, 0.0],
                    },
                ],
            },
            PassDef {
                name: "bits".to_string(),
                intarget: "swap".to_string(),
                outtarget: "minecraft:main".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![
                    UniformDef {
                        name: "Resolution".to_string(),
                        values: vec![16.0],
                    },
                    UniformDef {
                        name: "MosaicSize".to_string(),
                        values: vec![4.0],
                    },
                ],
            },
        ],
    );

    // Spider vision effect
    chains.insert(
        "spider".to_string(),
        vec![
            PassDef {
                name: "blur".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "temp".to_string(),
                auxtargets: vec![AuxTarget {
                    name: "BlurSampler".to_string(),
                    id: 0, // largeBlur
                }],
                uniforms: vec![
                    UniformDef {
                        name: "BlurDir".to_string(),
                        values: vec![1.0, 0.0],
                    },
                    UniformDef {
                        name: "Radius".to_string(),
                        values: vec![15.0],
                    },
                ],
            },
            PassDef {
                name: "blur".to_string(),
                intarget: "temp".to_string(),
                outtarget: "largeBlur".to_string(),
                auxtargets: vec![AuxTarget {
                    name: "BlurSampler".to_string(),
                    id: 1, // temp
                }],
                uniforms: vec![
                    UniformDef {
                        name: "BlurDir".to_string(),
                        values: vec![0.0, 1.0],
                    },
                    UniformDef {
                        name: "Radius".to_string(),
                        values: vec![15.0],
                    },
                ],
            },
            PassDef {
                name: "blur".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "temp".to_string(),
                auxtargets: vec![AuxTarget {
                    name: "BlurSampler".to_string(),
                    id: 2, // largeBlur
                }],
                uniforms: vec![
                    UniformDef {
                        name: "BlurDir".to_string(),
                        values: vec![1.0, 0.0],
                    },
                    UniformDef {
                        name: "Radius".to_string(),
                        values: vec![7.0],
                    },
                ],
            },
            PassDef {
                name: "blur".to_string(),
                intarget: "temp".to_string(),
                outtarget: "smallBlur".to_string(),
                auxtargets: vec![AuxTarget {
                    name: "BlurSampler".to_string(),
                    id: 3, // swap
                }],
                uniforms: vec![
                    UniformDef {
                        name: "BlurDir".to_string(),
                        values: vec![0.0, 1.0],
                    },
                    UniformDef {
                        name: "Radius".to_string(),
                        values: vec![7.0],
                    },
                ],
            },
            // spider pass with InScale, InOffset, Scissor, Vignette
            PassDef {
                name: "spider".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "temp".to_string(),
                auxtargets: vec![AuxTarget {
                    name: "BlurSampler".to_string(),
                    id: 4, // largeBlur
                }],
                uniforms: vec![
                    UniformDef {
                        name: "InScale".to_string(),
                        values: vec![1.25, 2.0],
                    },
                    UniformDef {
                        name: "InOffset".to_string(),
                        values: vec![-0.125, -0.1],
                    },
                    UniformDef {
                        name: "Scissor".to_string(),
                        values: vec![0.0, 0.0, 1.0, 1.0],
                    },
                    UniformDef {
                        name: "Vignette".to_string(),
                        values: vec![0.1, 0.1, 0.9, 0.9],
                    },
                ],
            },
            PassDef {
                name: "spider".to_string(),
                intarget: "smallBlur".to_string(),
                outtarget: "swap".to_string(),
                auxtargets: vec![AuxTarget {
                    name: "BlurSampler".to_string(),
                    id: 5, // temp
                }],
                uniforms: vec![
                    UniformDef {
                        name: "InScale".to_string(),
                        values: vec![2.35, 4.2],
                    },
                    UniformDef {
                        name: "InOffset".to_string(),
                        values: vec![-1.1, -1.5],
                    },
                    UniformDef {
                        name: "InRotation".to_string(),
                        values: vec![-45.0],
                    },
                    UniformDef {
                        name: "Scissor".to_string(),
                        values: vec![0.21, 0.0, 0.79, 1.0],
                    },
                    UniformDef {
                        name: "Vignette".to_string(),
                        values: vec![0.31, 0.1, 0.69, 0.9],
                    },
                ],
            },
            PassDef {
                name: "spider".to_string(),
                intarget: "smallBlur".to_string(),
                outtarget: "temp".to_string(),
                auxtargets: vec![AuxTarget {
                    name: "BlurSampler".to_string(),
                    id: 6, // swap
                }],
                uniforms: vec![
                    UniformDef {
                        name: "InScale".to_string(),
                        values: vec![2.35, 4.2],
                    },
                    UniformDef {
                        name: "InOffset".to_string(),
                        values: vec![0.45, -4.45],
                    },
                    UniformDef {
                        name: "InRotation".to_string(),
                        values: vec![45.0],
                    },
                    UniformDef {
                        name: "Scissor".to_string(),
                        values: vec![0.21, 0.0, 0.79, 1.0],
                    },
                    UniformDef {
                        name: "Vignette".to_string(),
                        values: vec![0.31, 0.1, 0.69, 0.9],
                    },
                ],
            },
            PassDef {
                name: "spider".to_string(),
                intarget: "smallBlur".to_string(),
                outtarget: "swap".to_string(),
                auxtargets: vec![AuxTarget {
                    name: "BlurSampler".to_string(),
                    id: 7, // temp
                }],
                uniforms: vec![
                    UniformDef {
                        name: "InScale".to_string(),
                        values: vec![2.35, 2.35],
                    },
                    UniformDef {
                        name: "InOffset".to_string(),
                        values: vec![-0.385, -1.29],
                    },
                    UniformDef {
                        name: "InRotation".to_string(),
                        values: vec![0.0],
                    },
                    UniformDef {
                        name: "Vignette".to_string(),
                        values: vec![0.31, 0.1, 0.69, 0.9],
                    },
                ],
            },
            PassDef {
                name: "spider".to_string(),
                intarget: "smallBlur".to_string(),
                outtarget: "temp".to_string(),
                auxtargets: vec![AuxTarget {
                    name: "BlurSampler".to_string(),
                    id: 8, // swap
                }],
                uniforms: vec![
                    UniformDef {
                        name: "InScale".to_string(),
                        values: vec![2.35, 2.35],
                    },
                    UniformDef {
                        name: "InOffset".to_string(),
                        values: vec![-0.965, -1.29],
                    },
                    UniformDef {
                        name: "Vignette".to_string(),
                        values: vec![0.31, 0.1, 0.69, 0.9],
                    },
                ],
            },
            // blit back to main with color modulate
            PassDef {
                name: "blit".to_string(),
                intarget: "temp".to_string(),
                outtarget: "minecraft:main".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![UniformDef {
                    name: "ColorModulate".to_string(),
                    values: vec![1.0, 0.8, 0.8, 1.0],
                }],
            },
        ],
    );

    // Invert chain
    chains.insert(
        "invert".to_string(),
        vec![
            PassDef {
                name: "invert".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "swap".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![UniformDef {
                    name: "InverseAmount".to_string(),
                    values: vec![0.8],
                }],
            },
            PassDef {
                name: "blit".to_string(),
                intarget: "swap".to_string(),
                outtarget: "minecraft:main".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![UniformDef {
                    name: "ColorModulate".to_string(),
                    values: vec![1.0, 1.0, 1.0, 1.0],
                }],
            },
        ],
    );

    // Desaturate chain
    chains.insert(
        "desaturate".to_string(),
        vec![
            PassDef {
                name: "color_convolve".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "swap".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![UniformDef {
                    name: "Saturation".to_string(),
                    values: vec![0.2],
                }],
            },
            PassDef {
                name: "blit".to_string(),
                intarget: "swap".to_string(),
                outtarget: "minecraft:main".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![UniformDef {
                    name: "ColorModulate".to_string(),
                    values: vec![1.0, 1.0, 1.0, 1.0],
                }],
            },
        ],
    );

    // Color convolve chain
    chains.insert(
        "color_convolve".to_string(),
        vec![
            PassDef {
                name: "color_convolve".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "swap".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![UniformDef {
                    name: "Saturation".to_string(),
                    values: vec![1.4],
                }],
            },
            PassDef {
                name: "blit".to_string(),
                intarget: "swap".to_string(),
                outtarget: "minecraft:main".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![UniformDef {
                    name: "ColorModulate".to_string(),
                    values: vec![1.0, 1.0, 1.0, 1.0],
                }],
            },
        ],
    );

    // Green scale chain
    chains.insert(
        "green".to_string(),
        vec![
            PassDef {
                name: "color_convolve".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "swap".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![
                    UniformDef {
                        name: "RedMatrix".to_string(),
                        values: vec![0.0, 0.0, 0.0],
                    },
                    UniformDef {
                        name: "GreenMatrix".to_string(),
                        values: vec![0.3, 0.59, 0.11],
                    },
                    UniformDef {
                        name: "BlueMatrix".to_string(),
                        values: vec![0.0, 0.0, 0.0],
                    },
                ],
            },
            PassDef {
                name: "bits".to_string(),
                intarget: "swap".to_string(),
                outtarget: "minecraft:main".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![],
            },
            PassDef {
                name: "scan_pincushion".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "swap".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![],
            },
            PassDef {
                name: "blit".to_string(),
                intarget: "swap".to_string(),
                outtarget: "minecraft:main".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![UniformDef {
                    name: "ColorModulate".to_string(),
                    values: vec![1.0, 1.0, 1.0, 1.0],
                }],
            },
        ],
    );

    // Blur chain
    chains.insert(
        "blur".to_string(),
        vec![
            PassDef {
                name: "blur".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "swap".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![
                    UniformDef {
                        name: "BlurDir".to_string(),
                        values: vec![1.0, 0.0],
                    },
                    UniformDef {
                        name: "Radius".to_string(),
                        values: vec![20.0],
                    },
                ],
            },
            PassDef {
                name: "blur".to_string(),
                intarget: "swap".to_string(),
                outtarget: "minecraft:main".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![
                    UniformDef {
                        name: "BlurDir".to_string(),
                        values: vec![0.0, 1.0],
                    },
                    UniformDef {
                        name: "Radius".to_string(),
                        values: vec![20.0],
                    },
                ],
            },
        ],
    );

    // Phosphor chain (uses previous frame)
    chains.insert(
        "phosphor".to_string(),
        vec![
            PassDef {
                name: "phosphor".to_string(),
                intarget: "minecraft:main".to_string(),
                outtarget: "swap".to_string(),
                auxtargets: vec![AuxTarget {
                    name: "PrevSampler".to_string(),
                    id: 0, // previous
                }],
                uniforms: vec![UniformDef {
                    name: "Phosphor".to_string(),
                    values: vec![0.95, 0.95, 0.95],
                }],
            },
            PassDef {
                name: "blit".to_string(),
                intarget: "swap".to_string(),
                outtarget: "previous".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![],
            },
            PassDef {
                name: "blit".to_string(),
                intarget: "swap".to_string(),
                outtarget: "minecraft:main".to_string(),
                auxtargets: Vec::new(),
                uniforms: vec![UniformDef {
                    name: "ColorModulate".to_string(),
                    values: vec![1.0, 1.0, 1.0, 1.0],
                }],
            },
        ],
    );

    // Single-program chains: main -> swap with program -> blit back
    chains.insert(
        "pencil".to_string(),
        vec![single("outline_soft")],
    );

    // Remaining one-program chains
    for name in &["bits", "flip", "wobble", "scan_pincushion", "sobel", "deconverge", "bumpy", "blobs", "blobs2", "antialias"] {
        chains.insert(name.to_string(), vec![single(name)]);
    }

    chains
});

// Entity shader type mapping.
// Maps entity type IDs to post-processing shader names.
/// Entity type IDs that trigger special post-processing shaders.
/// Type 50 = creeper, 52/59 = spider, 58 = invert
pub const ENTITY_SHADER_TYPES: Lazy<HashMap<i32, &'static str>> = Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert(50, "creeper");
    m.insert(52, "spider");
    m.insert(59, "spider");
    m.insert(58, "invert");
    m
});

/// Returns the post-processing shader name for a given entity type, if applicable.
/// For non-player entities with a known type, returns the shader name;
/// otherwise returns null.
/// # Arguments
/// * `e` - Entity type ID (0 = none, player types excluded)
pub fn entity_shader_name(e: i32) -> Option<&'static str> {
    ENTITY_SHADER_TYPES.get(&e).copied()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_programs_exist() {
        assert!(PROGRAMS.get("blit").is_some());
        assert!(PROGRAMS.get("invert").is_some());
        assert!(PROGRAMS.get("color_convolve").is_some());
    }

    #[test]
    fn test_builtin_chains() {
        assert!(BUILTIN_CHAINS.contains_key("creeper"));
        assert!(BUILTIN_CHAINS.contains_key("spider"));
        assert!(BUILTIN_CHAINS.contains_key("invert"));
        assert!(BUILTIN_CHAINS.contains_key("desaturate"));
        assert!(BUILTIN_CHAINS.contains_key("color_convolve"));
        assert!(BUILTIN_CHAINS.contains_key("green"));
        assert!(BUILTIN_CHAINS.contains_key("blur"));
        assert!(BUILTIN_CHAINS.contains_key("phosphor"));
        assert!(BUILTIN_CHAINS.contains_key("pencil"));
    }

    #[test]
    fn test_entity_shader_types() {
        assert_eq!(entity_shader_name(50), Some("creeper"));
        assert_eq!(entity_shader_name(52), Some("spider"));
        assert_eq!(entity_shader_name(59), Some("spider"));
        assert_eq!(entity_shader_name(58), Some("invert"));
        assert_eq!(entity_shader_name(0), None);
    }
}