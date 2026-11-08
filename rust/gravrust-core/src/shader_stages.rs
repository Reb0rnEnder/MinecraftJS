//! Port of `client/js/render/shader-stages.js`.
//!
//! Discover shader pack pipeline stages, post-processing pass ordering,
//! sampler validation, and conditional program enable flags.

use std::collections::{HashMap, HashSet};
use once_cell::sync::Lazy;

pub static POST_SCENE_SAMPLERS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    ["colortex0", "gcolor", "depthtex0", "noisetex"].into_iter().collect()
});

#[derive(Debug, Clone, PartialEq)]
pub struct ShaderStagePlan {
    pub post: Vec<String>,
    pub geometry: Vec<String>,
    pub shadow: Vec<String>,
    pub files: HashMap<String, String>,
}

/// Discovers stage files from a shader pack file list.
pub fn shader_stage_plan(files: &[&str], dimension: i32) -> ShaderStagePlan {
    let world = match dimension {
        -1 => "world-1",
        1 => "world1",
        _ => "world0",
    };

    let mut stages = HashMap::new();

    for path in files {
        if !path.ends_with(".fsh") {
            continue;
        }
        let stripped = &path[..path.len() - 4];
        let (dim_prefix, name) = if let Some((dir, base)) = stripped.split_once('/') {
            (Some(dir), base)
        } else {
            (None, stripped)
        };

        if let Some(dp) = dim_prefix {
            if dp != world {
                continue;
            }
        }

        let is_dim_match = dim_prefix == Some(world);
        if !stages.contains_key(name) || is_dim_match {
            stages.insert(name.to_string(), path.to_string());
        }
    }

    let mut post: Vec<String> = stages
        .keys()
        .filter(|n| n.starts_with("deferred") || n.starts_with("composite"))
        .cloned()
        .collect();

    post.sort_by(|a, b| {
        let group_a = if a.starts_with("deferred") { 0 } else { 1 };
        let group_b = if b.starts_with("deferred") { 0 } else { 1 };
        if group_a != group_b {
            return group_a.cmp(&group_b);
        }
        let num_a = a.trim_start_matches(|c: char| !c.is_ascii_digit()).parse::<u32>().unwrap_or(0);
        let num_b = b.trim_start_matches(|c: char| !c.is_ascii_digit()).parse::<u32>().unwrap_or(0);
        num_a.cmp(&num_b)
    });

    let mut geometry: Vec<String> = stages
        .keys()
        .filter(|n| n.starts_with("gbuffers_"))
        .cloned()
        .collect();
    geometry.sort();

    let mut shadow: Vec<String> = stages
        .keys()
        .filter(|n| n.starts_with("shadow"))
        .cloned()
        .collect();
    shadow.sort();

    ShaderStagePlan {
        post,
        geometry,
        shadow,
        files: stages,
    }
}

/// Checks whether a program is enabled in shaders.properties.
pub fn shader_program_enabled(properties: &str, dimension: i32, name: &str) -> bool {
    let world = match dimension {
        -1 => "world-1",
        1 => "world1",
        _ => "world0",
    };

    let unwrapped = properties.replace("\\\r\n", " ").replace("\\\n", " ");
    let mut entries = HashMap::new();
    for line in unwrapped.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with('#') || trimmed.starts_with('!') || trimmed.is_empty() {
            continue;
        }
        if let Some((k, v)) = trimmed.split_once('=') {
            entries.insert(k.trim().to_string(), v.trim().to_string());
        }
    }

    let key1 = format!("program.{}/{}.enabled", world, name);
    let key2 = format!("program.{}.enabled", name);
    let val = entries.get(&key1).or_else(|| entries.get(&key2));

    match val.map(|s| s.as_str()) {
        Some("false") => false,
        _ => true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stage_ordering() {
        let files = &[
            "composite2.fsh",
            "deferred.fsh",
            "composite.fsh",
            "deferred1.fsh",
            "gbuffers_terrain.fsh",
            "shadow.fsh",
        ];
        let plan = shader_stage_plan(files, 0);
        assert_eq!(plan.post, vec!["deferred", "deferred1", "composite", "composite2"]);
        assert_eq!(plan.geometry, vec!["gbuffers_terrain"]);
        assert_eq!(plan.shadow, vec!["shadow"]);
    }

    #[test]
    fn test_dimension_filtering() {
        let files = &[
            "world0/deferred.fsh",
            "world1/deferred.fsh",
            "composite.fsh",
        ];
        let plan_overworld = shader_stage_plan(files, 0);
        assert_eq!(plan_overworld.files.get("deferred"), Some(&"world0/deferred.fsh".to_string()));

        let plan_end = shader_stage_plan(files, 1);
        assert_eq!(plan_end.files.get("deferred"), Some(&"world1/deferred.fsh".to_string()));
    }

    #[test]
    fn test_program_enabled() {
        let props = "program.composite.enabled = false\nprogram.deferred.enabled = true\n";
        assert!(!shader_program_enabled(props, 0, "composite"));
        assert!(shader_program_enabled(props, 0, "deferred"));
        assert!(shader_program_enabled(props, 0, "unknown"));
    }
}
