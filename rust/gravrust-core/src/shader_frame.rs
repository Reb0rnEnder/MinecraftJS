//! Port of `client/js/render/shader-frame.js`.
//!
//! Evaluates the per-frame uniforms required by OptiFine / Iris custom shader packs
//! (gbufferProjection, cameraPosition, sunAngle, rainStrength, eyeBrightness, etc.).

use std::collections::HashSet;
use once_cell::sync::Lazy;
use crate::math::{invert, identity_matrix};
use crate::sky::celestial_angle;

pub static FINAL_UNIFORMS: Lazy<HashSet<&'static str>> = Lazy::new(|| {
    let list = [
        "gbufferProjection", "gbufferProjectionInverse", "cameraPosition", "view_res",
        "view_pixel_size", "near", "far", "eyeAltitude", "worldDay", "cloudHeight",
        "fogColor", "skyColor", "isElytraFlying", "heavyFog", "viewWidth", "viewHeight",
        "aspectRatio", "frameTimeCounter", "frameTime", "worldTime", "frameCounter",
        "isEyeInWater", "screenBrightness", "rainStrength", "eyeBrightnessSmooth",
        "mcjsEyeBrightness", "sunAngle", "gbufferModelView", "gbufferModelViewInverse",
        "blindness", "sprintingSmooth", "sneakSmooth", "burningSmooth", "rainStrengthS",
        "rainStrengthS2", "biomeHasRainSmooth", "biomeisNotColdSmooth", "biomeHasHeatSmooth",
        "biomeHasHeatSmooth2", "biomeHasHeatSmooth3", "moonPhase", "wetness", "isEyeInCave",
        "nightVision", "starter", "touchmybody",
    ];
    let mut set = HashSet::new();
    for name in list {
        set.insert(name);
    }
    set
});

/// Context parameters to evaluate shader frame uniforms.
#[derive(Debug, Clone)]
pub struct ShaderFrameContext {
    pub projection: [f32; 16],
    pub view: [f32; 16],
    pub eye_position: [f64; 3],
    pub view_width: f64,
    pub view_height: f64,
    pub render_distance: i32,
    pub time_of_day: i64,
    pub sky_light: u8,
    pub block_light: u8,
    pub rain_strength: f64,
    pub cloud_height: f64,
    pub fog_color: [f32; 3],
    pub sky_color: [f32; 3],
    pub is_elytra_flying: bool,
    pub has_blindness: bool,
    pub has_night_vision: bool,
    pub is_sprinting: bool,
    pub is_sneaking: bool,
    pub is_burning: bool,
    pub is_hurt: bool,
    pub dimension: i32,
    pub biome_temperature: f64,
    pub biome_precipitation: &'static str,
}

impl Default for ShaderFrameContext {
    fn default() -> Self {
        Self {
            projection: identity_matrix(),
            view: identity_matrix(),
            eye_position: [0.0, 64.0, 0.0],
            view_width: 800.0,
            view_height: 600.0,
            render_distance: 8,
            time_of_day: 6000,
            sky_light: 15,
            block_light: 0,
            rain_strength: 0.0,
            cloud_height: 192.0,
            fog_color: [0.7, 0.8, 1.0],
            sky_color: [0.5, 0.7, 1.0],
            is_elytra_flying: false,
            has_blindness: false,
            has_night_vision: false,
            is_sprinting: false,
            is_sneaking: false,
            is_burning: false,
            is_hurt: false,
            dimension: 0,
            biome_temperature: 0.8,
            biome_precipitation: "rain",
        }
    }
}

/// Evaluated shader uniforms values.
#[derive(Debug, Clone)]
pub struct EvaluatedShaderFrame {
    pub gbuffer_projection: [f32; 16],
    pub gbuffer_projection_inverse: [f32; 16],
    pub gbuffer_model_view: [f32; 16],
    pub gbuffer_model_view_inverse: [f32; 16],
    pub camera_position: [f64; 3],
    pub view_res: [f64; 2],
    pub view_pixel_size: [f64; 2],
    pub near: f64,
    pub far: f64,
    pub eye_altitude: f64,
    pub world_day: i64,
    pub cloud_height: f64,
    pub fog_color: [f32; 3],
    pub sky_color: [f32; 3],
    pub sun_angle: f64,
    pub rain_strength: f64,
    pub eye_brightness: [f32; 2],
    pub blindness: f32,
    pub night_vision: f32,
    pub sprinting_smooth: f32,
    pub sneak_smooth: f32,
    pub burning_smooth: f32,
    pub is_eye_in_cave: f64,
    pub moon_phase: i64,
    pub touchmybody: f32,
}

/// JS: `shaderFrameUniforms(game)`
pub fn evaluate_shader_frame(ctx: &ShaderFrameContext) -> EvaluatedShaderFrame {
    let proj_inv = invert(&ctx.projection).unwrap_or(identity_matrix());

    let mut view_no_trans = ctx.view;
    view_no_trans[12] = 0.0;
    view_no_trans[13] = 0.0;
    view_no_trans[14] = 0.0;
    let view_inv = invert(&view_no_trans).unwrap_or(identity_matrix());

    let far = 256.0f64.max(ctx.render_distance as f64 * 32.0);
    let brightness = [ctx.block_light as f32 * 16.0, ctx.sky_light as f32 * 16.0];

    EvaluatedShaderFrame {
        gbuffer_projection: ctx.projection,
        gbuffer_projection_inverse: proj_inv,
        gbuffer_model_view: view_no_trans,
        gbuffer_model_view_inverse: view_inv,
        camera_position: ctx.eye_position,
        view_res: [ctx.view_width.max(1.0), ctx.view_height.max(1.0)],
        view_pixel_size: [1.0 / ctx.view_width.max(1.0), 1.0 / ctx.view_height.max(1.0)],
        near: 0.05,
        far,
        eye_altitude: ctx.eye_position[1],
        world_day: ctx.time_of_day / 24000,
        cloud_height: ctx.cloud_height,
        fog_color: ctx.fog_color,
        sky_color: ctx.sky_color,
        sun_angle: celestial_angle(ctx.time_of_day as f64, 0.0) as f64,
        rain_strength: ctx.rain_strength,
        eye_brightness: brightness,
        blindness: if ctx.has_blindness { 1.0 } else { 0.0 },
        night_vision: if ctx.has_night_vision { 1.0 } else { 0.0 },
        sprinting_smooth: if ctx.is_sprinting { 1.0 } else { 0.0 },
        sneak_smooth: if ctx.is_sneaking { 1.0 } else { 0.0 },
        burning_smooth: if ctx.is_burning { 1.0 } else { 0.0 },
        is_eye_in_cave: 1.0 - (ctx.sky_light as f64 / 15.0),
        moon_phase: (ctx.time_of_day / 24000) % 8,
        touchmybody: if ctx.is_hurt { 0.4 } else { 0.0 },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_final_uniforms_set() {
        assert!(FINAL_UNIFORMS.contains("gbufferProjection"));
        assert!(FINAL_UNIFORMS.contains("sunAngle"));
        assert!(FINAL_UNIFORMS.contains("cameraPosition"));
    }

    #[test]
    fn test_evaluate_shader_frame() {
        let ctx = ShaderFrameContext::default();
        let evaluated = evaluate_shader_frame(&ctx);
        assert_eq!(evaluated.near, 0.05);
        assert_eq!(evaluated.far, 256.0);
        assert_eq!(evaluated.cloud_height, 192.0);
        assert_eq!(evaluated.is_eye_in_cave, 0.0);
    }
}
