//! Port of `client/js/gfx/dynamic-lighting.js`.
//!
//! Client-only moving light sources. Six nearest holders fit in the existing
//! 256-byte WebGPU globals block without growing its alignment or buffer stride.

pub const EMPTY_DYNAMIC_LIGHTS: [f32; 24] = [0.0; 24];

/// Computes the dynamic block light at (x, y, z) given the 6 dynamic light sources.
pub fn dynamic_block_light(lights: &[f32], x: f64, y: f64, z: f64, base: f64) -> f64 {
    if lights.len() < 4 || lights[3] <= 0.0 {
        return base;
    }
    let mut value = base;
    for i in (0..lights.len().min(24)).step_by(4) {
        if i + 3 < lights.len() {
            let power = lights[i + 3] as f64;
            if power > 0.0 {
                let dx = x - lights[i] as f64;
                let dy = y - lights[i + 1] as f64;
                let dz = z - lights[i + 2] as f64;
                let distance = (dx * dx + dy * dy + dz * dz).sqrt();
                value = value.max(power * (0.0f64).max(1.0 - distance / 7.5));
            }
        }
    }
    value.min(15.0)
}

pub const DYNAMIC_GLSL: &str = r#"
uniform vec4 uDynamicLights[6];
float dynamicBlockLight(vec3 position,float base){
 if(uDynamicLights[0].w<=0.0)return base;
 float value=base;
 for(int i=0;i<6;i++){vec4 source=uDynamicLights[i];if(source.w>0.0)value=max(value,source.w*max(0.0,1.0-distance(position,source.xyz)/7.5));}
 return min(15.0,value);
}
"#;

pub const DYNAMIC_WGSL: &str = r#"
fn dynamicBlockLight(position:vec3f,base:f32)->f32{
 if(G.lights[0].w<=0.0){return base;}
 var value=base;
 for(var i=0u;i<6u;i++){let source=G.lights[i];if(source.w>0.0){value=max(value,source.w*max(0.0,1.0-distance(position,source.xyz)/7.5));}}
 return min(15.0,value);
}
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_dynamic_lights() {
        let l = EMPTY_DYNAMIC_LIGHTS;
        assert_eq!(l.len(), 24);
        assert_eq!(dynamic_block_light(&l, 0.0, 0.0, 0.0, 5.0), 5.0);
    }

    #[test]
    fn test_dynamic_block_light_calculation() {
        let mut lights = [0.0f32; 24];
        lights[0] = 0.0;
        lights[1] = 0.0;
        lights[2] = 0.0;
        lights[3] = 15.0; // level 15 at origin

        let at_origin = dynamic_block_light(&lights, 0.0, 0.0, 0.0, 0.0);
        assert!((at_origin - 15.0).abs() < 1e-6);

        let at_distance = dynamic_block_light(&lights, 7.5, 0.0, 0.0, 0.0);
        assert!((at_distance - 0.0).abs() < 1e-6);
    }
}
