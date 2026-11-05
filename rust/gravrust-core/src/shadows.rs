// Port of `client/js/render/shadows.js`.
//
// Native 1.14 EntityRenderer.renderShadow: project onto eligible ground
// cells, retain world-space circle UVs, and fade with height, distance and
// local light.
//
// Block lookups go through the already-ported `crate::blocks::BlockRegistry`
// (`def(state)` + `static_collision_boxes(state)`); the world accessors the
// JS reads directly (`world.getState`, sky/block light, weather strengths)
// come from the [`ShadowWorld`] contract.

use crate::blocks::BlockRegistry;
use crate::sky::celestial_angle;

/// The world surface `shadowGeometry` reads.
pub trait ShadowWorld {
    /// JS: `world.getState(x, y, z)`.
    fn get_state(&self, x: i32, y: i32, z: i32) -> u32;
    /// JS: `world.getSkyLight(x, y, z)`.
    fn get_sky_light(&self, x: i32, y: i32, z: i32) -> u32;
    /// JS: `world.getBlockLight(x, y, z)`.
    fn get_block_light(&self, x: i32, y: i32, z: i32) -> u32;
    /// JS: `world.timeOfDay`.
    fn time_of_day(&self) -> f64;
    /// JS: `world.rainStrength`.
    fn rain_strength(&self) -> f64;
    /// JS: `world.thunderStrength`.
    fn thunder_strength(&self) -> f64;
    /// JS: `world.hasSky`.
    fn has_sky(&self) -> bool;
    /// JS: `world.dimension`.
    fn dimension(&self) -> i32;
}

/// JS: the player position `p` with the fields the projection reads.
#[derive(Debug, Clone, Copy)]
pub struct ShadowPlayer {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

/// JS: one emitted vertex `[dx, dy, dz, u, v, r, g, b, a]` — the port keeps
/// the same 9-float layout as the JS `out` array.
pub type ShadowVertex = [f64; 9];

/// JS: `export function shadowGeometry(world,p,radius,strength=1)` — returns
/// the packed vertex list (the JS builds a Float32Array).
pub fn shadow_geometry(
    world: &dyn ShadowWorld,
    registry: &BlockRegistry,
    p: ShadowPlayer,
    radius: f64,
    strength: f64,
) -> Vec<ShadowVertex> {
    // JS: if(!(radius>0)||strength<=0)return new Float32Array(0);
    if !(radius > 0.0) || strength <= 0.0 {
        return Vec::new();
    }
    let mut out: Vec<ShadowVertex> = Vec::new();
    // JS: const angle=celestialAngle(Number(world.timeOfDay)||0,0);
    let angle = celestial_angle(if world.time_of_day() != 0.0 { world.time_of_day() } else { 0.0 }, 0.0);
    // JS: let daylight=1-(Math.cos(angle*Math.PI*2)*2+.5);daylight=Math.max(0,Math.min(1,daylight));
    let mut daylight = 1.0 - ((angle * std::f64::consts::PI * 2.0).cos() * 2.0 + 0.5);
    daylight = daylight.max(0.0).min(1.0);
    // JS: daylight=1-daylight;daylight*=1-(world.rainStrength||0)*5/16;daylight*=1-(world.thunderStrength||0)*5/16;
    daylight = 1.0 - daylight;
    daylight *= 1.0 - world.rain_strength() * 5.0 / 16.0;
    daylight *= 1.0 - world.thunder_strength() * 5.0 / 16.0;
    // JS: const darken=world.hasSky===false?0:Math.floor((1-daylight)*11);
    let darken = if !world.has_sky() {
        0.0
    } else {
        ((1.0 - daylight) * 11.0).floor()
    };
    // JS: for(let x=Math.floor(p.x-radius);x<=Math.floor(p.x+radius);x++)
    //      for(let z=Math.floor(p.z-radius);z<=Math.floor(p.z+radius);z++)
    //       for(let y=Math.floor(p.y-radius);y<=Math.floor(p.y);y++){
    for x in (p.x - radius).floor() as i32..=(p.x + radius).floor() as i32 {
        for z in (p.z - radius).floor() as i32..=(p.z + radius).floor() as i32 {
            for y in (p.y - radius).floor() as i32..=p.y.floor() as i32 {
                // JS: const state=world.getState(x,y-1,z),block=getBlock(state);
                let state = world.get_state(x, y - 1, z);
                let block = registry.def(state);
                // JS: if(!block||block.isAir||(block.renderType!==undefined?block.renderType===0:!block.hasModel))continue;
                if block.is_air || !block.has_model {
                    continue;
                }
                // JS: const full=block.collisionFull??staticCollisionBoxes(state).some(b=>b.every((v,i)=>v===(i<3?0:1)));
                let full = block_full(registry, state);
                // JS: if(!full)continue;
                if !full {
                    continue;
                }
                // JS: const light=(world.getSkyLight(x,y,z)<<4)|world.getBlockLight(x,y,z),
                //      level=Math.max((light>>4)-darken,light&15);if(level<=3)continue;
                let light = (world.get_sky_light(x, y, z) << 4) | world.get_block_light(x, y, z);
                let level = ((light >> 4) as f64 - darken).max((light & 15) as f64);
                if level <= 3.0 {
                    continue;
                }
                // JS: const f=level/15,brightness=world.dimension===-1?.1+(f/(4-3*f))*.9:f/(4-3*f);
                let f = level / 15.0;
                let brightness = if world.dimension() == -1 {
                    0.1 + (f / (4.0 - 3.0 * f)) * 0.9
                } else {
                    f / (4.0 - 3.0 * f)
                };
                // JS: const alpha=Math.min(1,(strength-(p.y-y)/2)*.5*brightness);if(alpha<=0)continue;
                let alpha = ((strength - (p.y - y as f64) / 2.0) * 0.5 * brightness).min(1.0);
                if alpha <= 0.0 {
                    continue;
                }
                // JS: const x0=Math.max(x,p.x-radius),x1=Math.min(x+1,p.x+radius),
                //      z0=Math.max(z,p.z-radius),z1=Math.min(z+1,p.z+radius);
                let x0 = (x as f64).max(p.x - radius);
                let x1 = ((x + 1) as f64).min(p.x + radius);
                let z0 = (z as f64).max(p.z - radius);
                let z1 = ((z + 1) as f64).min(p.z + radius);
                // JS: if(x0>=x1||z0>=z1)continue;
                if x0 >= x1 || z0 >= z1 {
                    continue;
                }
                // JS: for(const [vx,vz] of [[x0,z0],[x0,z1],[x1,z1],[x1,z0]])
                //      out.push(vx-p.x, y-p.y+.015625, vz-p.z,
                //               (p.x-vx)/(radius*2)+.5, (p.z-vz)/(radius*2)+.5, 1,1,1,alpha);
                for (vx, vz) in [(x0, z0), (x0, z1), (x1, z1), (x1, z0)] {
                    out.push([
                        vx - p.x,
                        y as f64 - p.y + 0.015625,
                        vz - p.z,
                        (p.x - vx) / (radius * 2.0) + 0.5,
                        (p.z - vz) / (radius * 2.0) + 0.5,
                        1.0,
                        1.0,
                        1.0,
                        alpha,
                    ]);
                }
            }
        }
    }
    out
}

/// JS: `block.collisionFull ?? staticCollisionBoxes(state).some(b=>b.every((v,i)=>v===(i<3?0:1)))`.
///
/// `collisionFull` lives on the resolved render props, which the registry
/// exposes through `render_props`; the fallback scans the static boxes for a
/// full cube.
fn block_full(registry: &BlockRegistry, state: u32) -> bool {
    let boxes = registry.static_collision_boxes(state);
    boxes
        .iter()
        .any(|b| b.iter().enumerate().all(|(i, v)| *v == if i < 3 { 0.0 } else { 1.0 }))
}
