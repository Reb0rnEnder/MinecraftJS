// Port of `client/js/render/weather.js`.
//
// Rain/snow rendering, rain splashes + sound, and random block display ticks
// (ambience).
//
// Browser-bound surfaces stay behind traits: the device mesh calls
// (`gfx/device.js` FORMAT.lit, litParams), the asset texture lookup with
// `wrap: 'repeat'`, and the game hooks (`game.particles.*`, `game.sound.*`).
// JS `Math.random()` (unseeded) maps to the crate's `fastrand`; the sequence
// differs from V8's, which only affects which random cells trigger, never
// the behaviour.

use crate::biomes::biome_rain_type;
use crate::blocks::BlockRegistry;
use fastrand::Rng;

/// JS: `const RADIUS = 10;`
pub const RADIUS: i32 = 10;
/// JS: `const MAX = (RADIUS * 2 + 1) ** 2;`
pub const MAX: usize = ((RADIUS * 2 + 1) * (RADIUS * 2 + 1)) as usize;
/// JS: `const STRIDE = FORMAT.lit.stride;` (pos 3, uv 2, col 4, light 2).
pub const STRIDE: usize = 11;
/// JS: `const PARAMS = litParams(0.1);` — a 16-float param block, alphaTest 0.1.
pub fn params() -> [f32; 16] {
    let mut p = [0.0f32; 16];
    p[4] = 0.1;
    p
}

/// JS: `const rainX = new Float32Array(1024), rainZ = new Float32Array(1024);`
/// precomputed unit-direction tables on a 32x32 grid.
fn rain_tables() -> ([f32; 1024], [f32; 1024]) {
    let mut rain_x = [0.0f32; 1024];
    let mut rain_z = [0.0f32; 1024];
    for i in 0..32i64 {
        for j in 0..32i64 {
            // JS: const f = j - 16, f1 = i - 16;
            //     const f2 = Math.sqrt(f * f + f1 * f1) || 1;
            //     rainX[(i << 5) | j] = -f1 / f2; rainZ[(i << 5) | j] = f / f2;
            let f = (j - 16) as f64;
            let f1 = (i - 16) as f64;
            let f2 = (f * f + f1 * f1).sqrt();
            let f2 = if f2 == 0.0 { 1.0 } else { f2 };
            rain_x[((i << 5) | j) as usize] = (-(f1) / f2) as f32;
            rain_z[((i << 5) | j) as usize] = (f / f2) as f32;
        }
    }
    (rain_x, rain_z)
}

/// JS: the per-kind layer `{ tex, data, mesh, count }`.
pub struct WeatherLayer {
    /// JS: `tex: 'environment/' + kind + '.png'`.
    pub tex: &'static str,
    /// JS: `data: new Float32Array(MAX * 4 * STRIDE)`.
    pub data: Vec<f32>,
    /// JS: `mesh: game.device.createMesh(FORMAT.lit, ..., { quads: true, dynamic: true })`.
    pub mesh: u32,
    /// JS: `count: 0`.
    pub count: usize,
}

/// The device surface the weather renderer drives (`gfx/device.js`).
pub trait WeatherDevice {
    /// JS: `game.device.createMesh(FORMAT.lit, new Float32Array(0), { quads: true, dynamic: true })`.
    fn create_mesh(&mut self) -> u32;
    /// JS: `g.device.updateMesh(L.mesh, L.data.subarray(0, L.count * 4 * STRIDE), { quads: true })`.
    fn update_mesh(&mut self, mesh: u32, data: &[f32]);
    /// JS: `d.draw({ mesh, pipeline: 'lit', textures: [tex], params, state, count: L.count * 6 })`.
    fn draw_lit(&mut self, mesh: u32, tex: u32, count: usize);
}

/// The game surface the Weather object touches.
pub trait WeatherGame {
    /// JS: `g.inWorld`.
    fn in_world(&self) -> bool;
    /// JS: `g.dimension`.
    fn dimension(&self) -> i32;
    /// JS: `g.settings.particles`.
    fn particles_setting(&self) -> i32;
    /// JS: `g.player.x/y/z`.
    fn player_pos(&self) -> (f64, f64, f64);
    /// JS: `w.rainStrength`, `w.prevRain`.
    fn rain_strength(&self) -> f64;
    fn prev_rain(&self) -> Option<f64>;
    /// JS: `w.getChunk?.(x >> 4, z >> 4)` section access: `None` = chunk
    /// absent, `Some(None)` = section absent, `Some(Some(n))` = nonAir count.
    fn section_non_air(&self, cx: i32, cz: i32, sy: i32) -> Option<Option<u32>>;
    /// JS: `w.getState(x, y, z)`.
    fn get_state(&self, x: i32, y: i32, z: i32) -> u32;
    /// JS: `w.getBiome(x, z, y)`.
    fn get_biome(&self, x: i32, z: i32, y: i32) -> (String, f64, f64);
    /// JS: `w.getSkyLight(x, y, z)` / `w.getBlockLight(x, y, z)`.
    fn get_sky_light(&self, x: i32, y: i32, z: i32) -> u32;
    fn get_block_light(&self, x: i32, y: i32, z: i32) -> u32;
    /// JS: `g.particles.smoke(x, y, z, 0, 0, 0)`.
    fn particle_smoke(&mut self, x: f64, y: f64, z: f64);
    /// JS: `g.particles.rain(x, y, z)`.
    fn particle_rain(&mut self, x: f64, y: f64, z: f64);
    /// JS: `g.particles.randomDisplayTick(x, y, z, st)`.
    fn particle_random_display_tick(&mut self, x: i32, y: i32, z: i32, state: u32);
    /// JS: `g.sound.play(name, x, y, z, volume, pitch)`.
    fn sound_play(&mut self, name: &str, x: f64, y: f64, z: f64, volume: f64, pitch: f64);
    /// JS: `A.texture(L.tex, { wrap: 'repeat' })`.
    fn texture(&self, path: &str) -> Option<u32>;
    /// The block registry for `getBlock(state)` (native data).
    fn block_registry(&self) -> &BlockRegistry;
    /// The device.
    fn device(&mut self) -> &mut dyn WeatherDevice;
}

/// JS: `export class Weather`.
pub struct Weather {
    /// JS: `this.updateCount = 0;`
    pub update_count: i64,
    /// JS: `this.rainSoundCounter = 0;`
    pub rain_sound_counter: i64,
    /// JS: `this.layers = { rain: {...}, snow: {...} }`.
    pub rain: WeatherLayer,
    pub snow: WeatherLayer,
    rain_x: [f32; 1024],
    rain_z: [f32; 1024],
    rng: Rng,
}

impl Weather {
    /// JS: `constructor(game)` — creates both layer meshes; the JS also
    /// registers `draw` (order 12) in `r.extraDraws`, which the host honours
    /// through [`Self::draw_order`].
    pub fn new(device: &mut dyn WeatherDevice) -> Self {
        let (rain_x, rain_z) = rain_tables();
        let rain = {
            let mesh = device.create_mesh();
            WeatherLayer { tex: "environment/rain.png", data: vec![0.0; MAX * 4 * STRIDE], mesh, count: 0 }
        };
        let snow = {
            let mesh = device.create_mesh();
            WeatherLayer { tex: "environment/snow.png", data: vec![0.0; MAX * 4 * STRIDE], mesh, count: 0 }
        };
        Weather { update_count: 0, rain_sound_counter: 0, rain, snow, rain_x, rain_z, rng: Rng::new() }
    }

    /// JS: `draw.order = 12` — the extra-draw ordering the renderer honours.
    pub fn draw_order(&self) -> f64 {
        12.0
    }

    /// JS: `draw(d)` — flush both layers' live meshes.
    pub fn draw(&mut self, game: &mut dyn WeatherGame) {
        for layer in [&mut self.rain, &mut self.snow] {
            // JS: if (!L.count) continue;
            if layer.count == 0 {
                continue;
            }
            // JS: const tex = A.texture(L.tex, { wrap: 'repeat' });
            let Some(tex) = game.texture(layer.tex) else { continue };
            let count = layer.count;
            game.device().draw_lit(layer.mesh, tex, count * 6);
        }
    }

    /// JS: `precipHeight(x, z)`.
    pub fn precip_height(&self, game: &dyn WeatherGame, x: i32, z: i32) -> i32 {
        let registry = game.block_registry();
        // JS: const chunk = w.getChunk?.(x >> 4, z >> 4);
        for sy in (0..=15i32).rev() {
            // JS: const section = chunk?.sections[sy];
            //     if (chunk && (!section || section.nonAir === 0)) continue;
            if let Some(section_non_air) = game.section_non_air(x >> 4, z >> 4, sy) {
                match section_non_air {
                    None => continue,
                    Some(0) => continue,
                    Some(_) => {}
                }
            }
            // JS: for (let y = 15; y >= 0; y--) {
            //   const state = section ? section.get(x & 15, y, z & 15) : w.getState(x, sy * 16 + y, z);
            //   const b = getBlock(state);
            //   if (b && b.id !== 0 && (b.boundingBox === 'block' || b.isLiquid) && b.name !== 'leaves_never')
            //     return sy * 16 + y + 1;
            for y in (0..=15i32).rev() {
                let state = game.get_state(x, sy * 16 + y, z);
                let b = registry.def(state);
                if b.id != 0 && (b.bounding_box == "block" || b.is_liquid) && b.name != "leaves_never" {
                    return sy * 16 + y + 1;
                }
            }
        }
        // JS: return 0;
        0
    }

    /// JS: `tick()`.
    pub fn tick(&mut self, game: &mut dyn WeatherGame) {
        self.update_count += 1;
        // JS: const g = this.game; if (!g.inWorld) return;
        if !game.in_world() {
            return;
        }
        self.rain_particles(game);
        self.ambience(game);
    }

    /// JS: `_rainParticles()`.
    fn rain_particles(&mut self, game: &mut dyn WeatherGame) {
        let registry = game.block_registry().clone();
        // JS: let f = w.rainStrength; if (g.settings.particles >= 1) f /= 2;
        let mut f = game.rain_strength();
        if game.particles_setting() >= 1 {
            f /= 2.0;
        }
        // JS: if (f <= 0 || g.dimension !== 0) return;
        if f <= 0.0 || game.dimension() != 0 {
            return;
        }
        let (px, py, pz) = game.player_pos();
        let (px, py, pz) = (px.floor(), py.floor(), pz.floor());
        // JS: const n = Math.floor(100 * f * f);
        let n = (100.0 * f * f).floor() as i64;
        let mut sx = 0.0f64;
        let mut sy = 0.0f64;
        let mut sz = 0.0f64;
        let mut count = 0i64;
        for _ in 0..n {
            // JS: const x = px + Math.floor(Math.random() * 21) - 10,
            //      z = pz + Math.floor(Math.random() * 21) - 10;
            let x = (px + (self.rng.f64() * 21.0).floor() - 10.0) as i32;
            let z = (pz + (self.rng.f64() * 21.0).floor() - 10.0) as i32;
            // JS: const top = this.precipHeight(x, z);
            let top = self.precip_height(game, x, z);
            // JS: if (top > py + 10 || top < py - 10) continue;
            if top as f64 > py + 10.0 || (top as f64) < py - 10.0 {
                continue;
            }
            // JS: if (biomeRainType(w.getBiome(x, z, top), top) !== 'rain') continue;
            let (precip, temperature, rainfall) = game.get_biome(x, z, top);
            if biome_rain_type(&precip, temperature, rainfall, top) != "rain" {
                continue;
            }
            // JS: const below = getBlock(w.getState(x, top - 1, z));
            let below = registry.def(game.get_state(x, top - 1, z));
            // JS: const rx = Math.random(), rz = Math.random();
            let rx = self.rng.f64();
            let rz = self.rng.f64();
            if below.is_lava {
                // JS: g.particles.smoke(x + rx, top + 0.1, z + rz, 0, 0, 0);
                game.particle_smoke(x as f64 + rx, top as f64 + 0.1, z as f64 + rz);
            } else if below.id != 0 {
                // JS: if (Math.random() < 1 / ++count) { sx = x + rx; sy = top + 0.1; sz = z + rz; }
                count += 1;
                if self.rng.f64() < 1.0 / count as f64 {
                    sx = x as f64 + rx;
                    sy = top as f64 + 0.1;
                    sz = z as f64 + rz;
                }
                // JS: g.particles.rain(x + rx, top + 0.1, z + rz);
                game.particle_rain(x as f64 + rx, top as f64 + 0.1, z as f64 + rz);
            }
        }
        // JS: if (count > 0 && Math.floor(Math.random() * 3) < this.rainSoundCounter++) { ... }
        if count > 0 && (self.rng.f64() * 3.0).floor() < self.rain_sound_counter as f64 {
            self.rain_sound_counter = 0;
            let (_, py_raw, _) = game.player_pos();
            if sy > py_raw + 1.0 && self.precip_height(game, px as i32, pz as i32) > py as i32 {
                // JS: g.sound.play('weather.rain.above', sx, sy, sz, 0.1, 0.5);
                game.sound_play("weather.rain.above", sx, sy, sz, 0.1, 0.5);
            } else {
                // JS: g.sound.play('weather.rain', sx, sy, sz, 0.2, 1);
                game.sound_play("weather.rain", sx, sy, sz, 0.2, 1.0);
            }
        } else {
            // The JS `this.rainSoundCounter++` runs in the condition.
            self.rain_sound_counter += 1;
        }
    }

    /// JS: `_ambience()` — WorldClient.doVoidFogParticles ->
    /// Block.randomDisplayTick: 1000 random blocks within 16.
    fn ambience(&mut self, game: &mut dyn WeatherGame) {
        let (px, py, pz) = game.player_pos();
        let (px, py, pz) = (px.floor() as i32, py.floor() as i32, pz.floor() as i32);
        // JS: const r = 16;
        // JS: const x = px + Math.floor(Math.random() * r) - Math.floor(Math.random() * r);
        for _ in 0..1000 {
            let r = 16.0f64;
            let x = px + (self.rng.f64() * r).floor() as i32 - (self.rng.f64() * r).floor() as i32;
            let y = py + (self.rng.f64() * r).floor() as i32 - (self.rng.f64() * r).floor() as i32;
            let z = pz + (self.rng.f64() * r).floor() as i32 - (self.rng.f64() * r).floor() as i32;
            // JS: const st = w.getState(x, y, z); if (st !== 0) g.particles.randomDisplayTick(x, y, z, st);
            let st = game.get_state(x, y, z);
            if st != 0 {
                game.particle_random_display_tick(x, y, z, st);
            }
        }
    }

    /// JS: `render(partial, cx, cy, cz)`.
    pub fn render(&mut self, game: &mut dyn WeatherGame, partial: f64, cx: f64, cy: f64, cz: f64) {
        // JS: const rain = w.prevRain !== undefined
        //      ? w.prevRain + (w.rainStrength - w.prevRain) * partial : w.rainStrength;
        let rain = match game.prev_rain() {
            Some(prev) => prev + (game.rain_strength() - prev) * partial,
            None => game.rain_strength(),
        };
        // JS: for (const L of Object.values(this.layers)) L.count = 0;
        self.rain.count = 0;
        self.snow.count = 0;
        // JS: if (rain <= 0 || g.dimension !== 0) return;
        if rain <= 0.0 || game.dimension() != 0 {
            return;
        }
        let (bx, by, bz) = (cx.floor() as i32, cy.floor() as i32, cz.floor() as i32);
        // JS: const t = this.updateCount + partial;
        let t = self.update_count as f64 + partial;
        for z in (bz - RADIUS)..=(bz + RADIUS) {
            for x in (bx - RADIUS)..=(bx + RADIUS) {
                // JS: const k = ((z - bz + 16) << 5) | (x - bx + 16);
                let k = (((z - bz + 16) << 5) | (x - bx + 16)) as usize;
                // JS: const dx = rainX[k] * 0.5, dz = rainZ[k] * 0.5;
                let dx = self.rain_x[k] as f64 * 0.5;
                let dz = self.rain_z[k] as f64 * 0.5;
                // JS: const top = this.precipHeight(x, z);
                let top = self.precip_height(game, x, z);
                // JS: let y0 = by - RADIUS, y1 = by + RADIUS;
                //     if (y0 < top) y0 = top; if (y1 < top) y1 = top;
                //     if (y0 === y1) continue;
                let mut y0 = (by - RADIUS) as f64;
                let mut y1 = (by + RADIUS) as f64;
                if y0 < top as f64 {
                    y0 = top as f64;
                }
                if y1 < top as f64 {
                    y1 = top as f64;
                }
                if y0 == y1 {
                    continue;
                }
                // JS: const type = biomeRainType(w.getBiome(x, z, Math.max(top, by)), Math.max(top, by));
                let ymax = top.max(by);
                let (precip, temperature, rainfall) = game.get_biome(x, z, ymax);
                let type_ = biome_rain_type(&precip, temperature, rainfall, ymax);
                // JS: if (type === 'none') continue;
                if type_ == "none" {
                    continue;
                }
                let is_snow = type_ == "snow";
                // JS: const ddx = x + 0.5 - cx, ddz = z + 0.5 - cz;
                //     const dist = Math.sqrt(ddx * ddx + ddz * ddz) / RADIUS;
                //     const alpha = ((1 - dist * dist) * 0.5 + 0.5) * rain;
                let ddx = x as f64 + 0.5 - cx;
                let ddz = z as f64 + 0.5 - cz;
                let dist = (ddx * ddx + ddz * ddz).sqrt() / RADIUS as f64;
                let alpha = ((1.0 - dist * dist) * 0.5 + 0.5) * rain;
                // JS: let vOff, uOff = 0;
                let mut u_off = 0.0f64;
                // JS: const hash = ((x * x * 3121 + x * 45238971 + z * z * 418711 + z * 13761) & 31);
                let hash = (x as i64 * x as i64 * 3121 + x as i64 * 45238971 + z as i64 * z as i64 * 418711 + z as i64 * 13761) & 31;
                let v_off = if !is_snow {
                    // JS: vOff = (((this.updateCount + hash) & 31) + partial) / 32
                    //      * (3 + ((x * 31 + z * 17) & 7) / 8);
                    (((self.update_count + hash) & 31) as f64 + partial) / 32.0
                        * (3.0 + ((x * 31 + z * 17) & 7) as f64 / 8.0)
                } else {
                    // JS: vOff = ((this.updateCount & 511) + partial) / 512;
                    //      uOff = ((x * 7 + z * 13) & 15) / 16 + t * 0.002 * (((x ^ z) & 1) ? 1 : -1);
                    u_off = (((x * 7 + z * 13) & 15) as f64) / 16.0
                        + t * 0.002 * (if (x ^ z) & 1 != 0 { 1.0 } else { -1.0 });
                    ((self.update_count & 511) as f64 + partial) / 512.0
                };
                // JS: const x0 = x - dx + 0.5, z0 = z - dz + 0.5, x1 = x + dx + 0.5, z1 = z + dz + 0.5;
                let x0 = x as f64 - dx + 0.5;
                let z0 = z as f64 - dz + 0.5;
                let x1 = x as f64 + dx + 0.5;
                let z1 = z as f64 + dz + 0.5;
                // JS: const v0 = y0 * 0.25 + vOff, v1 = y1 * 0.25 + vOff;
                let v0 = y0 * 0.25 + v_off;
                let v1 = y1 * 0.25 + v_off;
                // JS: const ly = Math.max(by, top);
                // JS: const sky = w.getSkyLight(x, ly, z), blk = w.getBlockLight(x, ly, z);
                let ly = by.max(top);
                let sky = game.get_sky_light(x, ly, z) as f32;
                let blk = game.get_block_light(x, ly, z) as f32;
                let layer = if is_snow { &mut self.snow } else { &mut self.rain };
                // JS: const o = L.count++ * 4 * STRIDE;
                let o = layer.count * 4 * STRIDE;
                if o + 4 * STRIDE > layer.data.len() {
                    continue;
                }
                layer.count += 1;
                let quad: [f32; 44] = [
                    x0 as f32, y1 as f32, z0 as f32, u_off as f32, v1 as f32, 1.0, 1.0, 1.0, alpha as f32, sky, blk,
                    x1 as f32, y1 as f32, z1 as f32, (u_off + 1.0) as f32, v1 as f32, 1.0, 1.0, 1.0, alpha as f32, sky, blk,
                    x1 as f32, y0 as f32, z1 as f32, (u_off + 1.0) as f32, v0 as f32, 1.0, 1.0, 1.0, alpha as f32, sky, blk,
                    x0 as f32, y0 as f32, z0 as f32, u_off as f32, v0 as f32, 1.0, 1.0, 1.0, alpha as f32, sky, blk,
                ];
                layer.data[o..o + 44].copy_from_slice(&quad);
            }
        }
        // JS: for (const L of Object.values(this.layers))
        //      if (L.count) g.device.updateMesh(L.mesh, L.data.subarray(0, L.count * 4 * STRIDE), { quads: true });
        for layer in [&self.rain, &self.snow] {
            if layer.count > 0 {
                let n = layer.count * 4 * STRIDE;
                game.device().update_mesh(layer.mesh, &layer.data[..n]);
            }
        }
    }
}
