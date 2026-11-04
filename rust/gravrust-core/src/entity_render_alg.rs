//! Port of `client/js/render/entity-renderer.js`: pure algorithmic sections.
//!
//! This module holds the data tables and pure helpers extracted from the
//! JavaScript entity renderer: the UUID hash for default skin selection, the
//! vanilla map-colour palette, the per-variant texture name tables, painting
//! sizes, rail geometry (`EntityMinecart.getPos`), the legacy skin repair
//! (`ImageBufferDownload.parseUserSkin`), map texture colour conversion, the
//! elytra angle targets, and the CPU-side mesh builders (arrow, UV box,
//! billboard sprite).
//!
//! The scene-graph/WebGL orchestration that consumes these lives in
//! [`crate::entity_renderer`]; drawing itself stays in JavaScript.

use wasm_bindgen::prelude::*;

/// JS (gfx/math.js): `D2R = Math.PI / 180`.
pub const D2R: f64 = core::f64::consts::PI / 180.0;

// ============================================================ constants

// JS: `const ARMOR_MATS = ['leather', 'chainmail', 'iron', 'diamond', 'gold', 'turtle'];`
pub const ARMOR_MATS: [&str; 6] = ["leather", "chainmail", "iron", "diamond", "gold", "turtle"];

// JS: Vanilla 1.8.9 MapColor base colors (r, g, b). Index 0 = NONE (transparent).
pub const MAP_BASE_COLORS: [[u8; 3]; 36] = [
    [0, 0, 0], [127, 178, 56], [247, 233, 163], [199, 199, 199], [255, 0, 0],
    [160, 160, 255], [167, 167, 167], [0, 124, 0], [255, 255, 255], [164, 168, 184],
    [151, 109, 77], [112, 112, 112], [64, 64, 255], [143, 119, 72], [255, 252, 245],
    [216, 127, 51], [178, 76, 216], [102, 153, 216], [229, 229, 51], [127, 204, 25],
    [242, 127, 165], [76, 76, 76], [153, 153, 153], [76, 127, 153], [127, 63, 178],
    [51, 76, 178], [102, 76, 51], [102, 127, 51], [153, 51, 51], [25, 25, 25],
    [250, 238, 77], [92, 219, 213], [74, 128, 255], [0, 217, 58], [129, 86, 49],
    [112, 2, 0],
];

// JS: Shade multipliers: variant 0 = 180/255, 1 = 220/255, 2 = 255/255, 3 = 135/255
pub const MAP_SHADES: [u8; 4] = [180, 220, 255, 135];

// JS: `const FLEECE = [[1, 1, 1], [0.85, 0.5, 0.2], ...]` (16 sheep wool colours)
pub const FLEECE: [[f64; 3]; 16] = [
    [1.0, 1.0, 1.0], [0.85, 0.5, 0.2], [0.7, 0.3, 0.85], [0.4, 0.6, 0.85],
    [0.9, 0.9, 0.2], [0.5, 0.8, 0.1], [0.95, 0.5, 0.65], [0.3, 0.3, 0.3],
    [0.6, 0.6, 0.6], [0.3, 0.5, 0.6], [0.5, 0.25, 0.7], [0.2, 0.3, 0.7],
    [0.4, 0.3, 0.2], [0.4, 0.5, 0.2], [0.6, 0.2, 0.2], [0.1, 0.1, 0.1],
];

// JS: `const VILLAGER_TEX = ['farmer', 'librarian', 'priest', 'smith', 'butcher'];`
pub const VILLAGER_TEX: [&str; 5] = ["farmer", "librarian", "priest", "smith", "butcher"];

// JS: `const HORSE_COLORS = ['white', 'creamy', 'chestnut', 'brown', 'black', 'gray', 'darkbrown'];`
pub const HORSE_COLORS: [&str; 7] = ["white", "creamy", "chestnut", "brown", "black", "gray", "darkbrown"];

// JS: `const RABBIT_TEX = ['brown', 'white', 'black', 'white_splotched', 'gold', 'salt'];`
pub const RABBIT_TEX: [&str; 6] = ["brown", "white", "black", "white_splotched", "gold", "salt"];

// JS: `const CAT_TEX = ['ocelot', 'black', 'red', 'siamese'];`
pub const CAT_TEX: [&str; 4] = ["ocelot", "black", "red", "siamese"];

// JS: `const ENTITY_DYES = ['white', ..., 'black'];` (the 16 dye colour names)
pub const ENTITY_DYES: [&str; 16] = [
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
    "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
];

// JS: `const PARROT_TEX = ['red_blue', 'blue', 'green', 'yellow_blue', 'grey'];`
pub const PARROT_TEX: [&str; 5] = ["red_blue", "blue", "green", "yellow_blue", "grey"];

// JS: `const LLAMA_TEX = ['creamy', 'white', 'brown', 'gray'];`
pub const LLAMA_TEX: [&str; 4] = ["creamy", "white", "brown", "gray"];

// JS: `const PAINTINGS = { Kebab: [16, 16, 0, 0], ... }` — [width, height, u, v] in texture pixels.
pub const PAINTINGS: [(&str, [i32; 4]); 26] = [
    ("Kebab", [16, 16, 0, 0]), ("Aztec", [16, 16, 16, 0]), ("Alban", [16, 16, 32, 0]),
    ("Aztec2", [16, 16, 48, 0]), ("Bomb", [16, 16, 64, 0]), ("Plant", [16, 16, 80, 0]),
    ("Wasteland", [16, 16, 96, 0]), ("Pool", [32, 16, 0, 32]), ("Courbet", [32, 16, 32, 32]),
    ("Sea", [32, 16, 64, 32]), ("Sunset", [32, 16, 96, 32]), ("Creebet", [32, 16, 128, 32]),
    ("Wanderer", [16, 32, 0, 64]), ("Graham", [16, 32, 16, 64]), ("Match", [32, 32, 0, 128]),
    ("Bust", [32, 32, 32, 128]), ("Stage", [32, 32, 64, 128]), ("Void", [32, 32, 96, 128]),
    ("SkullAndRoses", [32, 32, 128, 128]), ("Wither", [32, 32, 160, 128]),
    ("Fighters", [64, 32, 0, 96]), ("Pointer", [64, 64, 0, 192]), ("Pigscene", [64, 64, 64, 192]),
    ("BurningSkull", [64, 64, 128, 192]), ("Skeleton", [64, 48, 192, 64]),
    ("DonkeyKong", [64, 48, 192, 112]),
];

// JS: `const STATE_OPAQUE = { blend: 'none' };`
pub const STATE_OPAQUE_BLEND: &str = "none";
// JS: `const STATE_ALPHA = { blend: 'alpha', depthWrite: false };` (unused by the current JS body)
pub const STATE_ALPHA_BLEND: &str = "alpha";

// JS: `const CULLABLE = new Set(['player', 'mob', ...]);` — entity kinds subject to frustum/occlusion culling.
pub const CULLABLE: [&str; 18] = [
    "player", "mob", "armorstand", "item", "xp", "arrow", "spectral_arrow", "trident",
    "projectile", "llama_spit", "shulker_bullet", "dragon_fireball", "evoker_fangs", "falling",
    "tnt", "boat", "minecart", "crystal",
];

/// JS: `CULLABLE.has(e.kind)`.
pub fn is_cullable_kind(kind: &str) -> bool {
    CULLABLE.contains(&kind)
}

// JS: `const GLINT_PARAMS = new EntityParams().setTint(0.5*0.75, 0.25*0.75, 0.8*0.75, 1)
//      .setFullBright(true).setNoLighting(true).setAlphaTest(0);` (declared, only referenced via `void`)
pub const GLINT_TINT: [f64; 4] = [0.5 * 0.75, 0.25 * 0.75, 0.8 * 0.75, 1.0];

// JS (line 2046): EntityMinecart.MATRIX — the two exits of each named rail shape.
pub const RAIL_EXITS: [[[i32; 3]; 2]; 10] = [
    [[0, 0, -1], [0, 0, 1]],
    [[-1, 0, 0], [1, 0, 0]],
    [[-1, -1, 0], [1, 0, 0]],
    [[-1, 0, 0], [1, -1, 0]],
    [[0, 0, -1], [0, -1, 1]],
    [[0, -1, -1], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0]],
    [[0, 0, 1], [-1, 0, 0]],
    [[0, 0, -1], [-1, 0, 0]],
    [[0, 0, -1], [1, 0, 0]],
];

// JS (line 2048): `const RAILS = new Set(['rail', 'powered_rail', 'detector_rail', 'activator_rail']);`
pub const RAILS: [&str; 4] = ["rail", "powered_rail", "detector_rail", "activator_rail"];

// JS (line 2049): `const RAIL_SHAPES = ['north_south', ...];`
pub const RAIL_SHAPES: [&str; 10] = [
    "north_south", "east_west", "ascending_east", "ascending_west", "ascending_north",
    "ascending_south", "south_east", "south_west", "north_west", "north_east",
];

// ============================================================ small helpers

/// JS: `function uuidHash(uuid) { ... }` — UUID.hashCode for default skin selection.
///
/// Strips the dashes, splits the 32 hex digits into the most/least significant
/// 64-bit halves, XORs them, and combines the two signed 32-bit halves of the
/// result (`Number(BigInt.asIntN(32, hilo >> 32n)) ^ Number(BigInt.asIntN(32, hilo))`).
/// Malformed input (non-hex/short UUID, which would throw in JS) is tolerated
/// here: missing digits read as zero.
pub fn uuid_hash(uuid: &str) -> i32 {
    // JS: `const hex = uuid.replace(/-/g, '');`
    let hex: String = uuid.chars().filter(|c| *c != '-').collect();
    let mut buf = [b'0'; 32];
    for (i, b) in hex.bytes().take(32).enumerate() {
        buf[i] = b;
    }
    // JS: `const most = BigInt.asIntN(64, BigInt('0x' + hex.slice(0, 16)));`
    let most = u64::from_str_radix(core::str::from_utf8(&buf[..16]).unwrap_or("0"), 16).unwrap_or(0) as i64;
    // JS: `const least = BigInt.asIntN(64, BigInt('0x' + hex.slice(16)));`
    let least = u64::from_str_radix(core::str::from_utf8(&buf[16..]).unwrap_or("0"), 16).unwrap_or(0) as i64;
    // JS: `const hilo = most ^ least; return Number(...) ^ Number(...);`
    let hilo = most ^ least;
    ((hilo >> 32) as i32) ^ (hilo as i32)
}

/// JS: `const fishShape = e => ((e.fishVariant || 0) & 255) === 1 ? 1 : 0;`
#[wasm_bindgen]
pub fn fish_shape(fish_variant: i32) -> i32 {
    if fish_variant & 255 == 1 { 1 } else { 0 }
}

/// JS: `const fishPattern = e => Math.min(5, ((e.fishVariant || 0) >>> 8) & 255) + 1;`
/// (`>>>` is an unsigned shift, so the variant is treated as u32 here.)
#[wasm_bindgen]
pub fn fish_pattern(fish_variant: i32) -> i32 {
    let p = (((fish_variant as u32) >> 8) & 255) as i32;
    p.min(5) + 1
}

/// JS: `const yawAngle = (e, partial) => e.prevYaw + (e.yaw - e.prevYaw) * partial;`
pub fn yaw_angle(prev_yaw: f64, yaw: f64, partial: f64) -> f64 {
    prev_yaw + (yaw - prev_yaw) * partial
}

/// JS: `const pitchAngle = (e, partial) => e.prevPitch + (e.pitch - e.prevPitch) * partial;`
pub fn pitch_angle(prev_pitch: f64, pitch: f64, partial: f64) -> f64 {
    prev_pitch + (pitch - prev_pitch) * partial
}

/// JS (`_renderDragon`): `const wrap = (a) => { a %= 360; if (a >= 180) a -= 360; if (a < -180) a += 360; return a; }`
pub fn wrap_angle_180(mut a: f64) -> f64 {
    a %= 360.0;
    if a >= 180.0 { a -= 360.0; }
    if a < -180.0 { a += 360.0; }
    a
}

/// JS (`_renderLiving`): `const lerpAngle = (a, b) => { let d = b - a; while (d < -180) d += 360;
/// while (d >= 180) d -= 360; return a + d * partial; }`
pub fn lerp_angle_deg(a: f64, b: f64, partial: f64) -> f64 {
    let mut d = b - a;
    while d < -180.0 { d += 360.0; }
    while d >= 180.0 { d -= 360.0; }
    a + d * partial
}

/// JS: `function armorMaterialIndex(name)` — index into ARMOR_MATS for `*_helmet/chestplate/leggings/boots`,
/// -1 otherwise. Note the JS regex matches `golden_`, while ARMOR_MATS stores `gold` for texture paths.
pub fn armor_material_index(name: &str) -> i32 {
    const PREFIXES: [&str; 6] = ["leather", "chainmail", "iron", "diamond", "golden", "turtle"];
    const SUFFIXES: [&str; 4] = ["helmet", "chestplate", "leggings", "boots"];
    for suf in SUFFIXES {
        // `^(prefix)_(suffix)$`: the '_' separator must be present
        if let Some(prefix) = name.strip_suffix(suf).and_then(|p| p.strip_suffix('_')) {
            if let Some(idx) = PREFIXES.iter().position(|p| *p == prefix) {
                return idx as i32;
            }
        }
    }
    -1
}

/// JS (`_build` 'xp'): the experience-orb sprite row selected by the orb's value.
pub fn xp_orb_size(count: f64) -> i32 {
    if count >= 2477.0 { 10 }
    else if count >= 1237.0 { 9 }
    else if count >= 617.0 { 8 }
    else if count >= 307.0 { 7 }
    else if count >= 149.0 { 6 }
    else if count >= 73.0 { 5 }
    else if count >= 37.0 { 4 }
    else if count >= 17.0 { 3 }
    else if count >= 7.0 { 2 }
    else if count >= 3.0 { 1 }
    else { 0 }
}

/// JS (`_build` 'xp'): `const u0 = (size % 4) * 16 / 64, v0 = Math.floor(size / 4) * 16 / 64;`
/// Returns `(u0, v0)`.
pub fn xp_orb_uv(size: i32) -> (f64, f64) {
    let u0 = (size % 4) as f64 * 16.0 / 64.0;
    // JS: Math.floor(size / 4) — size/4 is already integer division here.
    let v0 = (size / 4) as f64 * 16.0 / 64.0;
    (u0, v0)
}

/// JS (`_renderItem`): `const copiesFor = count => count > 48 ? 5 : count > 32 ? 4 : count > 16 ? 3 : count > 1 ? 2 : 1;`
pub fn copies_for_count(count: i64) -> i32 {
    if count > 48 { 5 } else if count > 32 { 4 } else if count > 16 { 3 } else if count > 1 { 2 } else { 1 }
}

/// JS (`entity-models.js` `elytraAngles`, consumed by `_renderLiving`'s elytra layer):
/// ModelElytra.setRotationAngles targets `[x, y, z, rotationPointY]`.
pub fn elytra_angles(flying: bool, sneaking: bool, motion: [f64; 3]) -> [f64; 4] {
    let mut f = 0.2617994f64;
    let mut f1 = -0.2617994f64;
    let mut f2 = 0f64;
    let mut f3 = 0f64;
    if flying {
        let mut f4 = 1.0f64;
        if motion[1] < 0.0 {
            let l = (motion[0] * motion[0] + motion[1] * motion[1] + motion[2] * motion[2]).sqrt();
            let l = if l == 0.0 { 1.0 } else { l }; // JS: `|| 1`
            f4 = 1.0 - (-motion[1] / l).powf(1.5);
        }
        f = f4 * 0.34906584 + (1.0 - f4) * f;
        f1 = f4 * -(core::f64::consts::PI / 2.0) + (1.0 - f4) * f1;
    } else if sneaking {
        f = core::f64::consts::PI * 2.0 / 9.0;
        f1 = -(core::f64::consts::PI / 4.0);
        f2 = 3.0;
        f3 = 0.08726646;
    }
    [f, f3, f1, f2]
}

/// JS (fox-pose.js `scaleFoxChild`, called from `_renderLiving`): returns
/// `[(head_scale, head_py, head_pz), (body_scale, body_py, body_pz)]`.
pub fn scale_fox_child(child: bool) -> [(f64, f64, f64); 2] {
    let head = if child { 0.75 } else { 1.0 };
    let body = if child { 0.5 } else { 1.0 };
    [
        (head, if child { 6.0 } else { 0.0 }, if child { 3.35 * 0.75 } else { 0.0 }),
        (body, if child { 12.0 } else { 0.0 }, 0.0),
    ]
}

// ============================================================ map colours

/// JS (`mapTexture`): convert the 128x128 map colour indices into RGBA bytes.
/// Index `c`: `base = c >> 2` picks the palette colour, `c & 3` the shade;
/// base 0 (air) draws the faint checkerboard `((i + (i >> 7)) & 1) * 8 + 16`.
/// The JS loop always covers all 16384 pixels: `m.colors[i]` past the end of
/// the colour array is `undefined`, which coerces to 0 (base 0, the checker).
pub fn map_colors_to_rgba(colors: &[u8]) -> Vec<u8> {
    let mut rgba = vec![0u8; 128 * 128 * 4];
    for i in 0..128 * 128 {
        let c = colors.get(i).copied().unwrap_or(0);
        let base = (c >> 2) as usize;
        if base == 0 {
            // JS: MapColor.airColor: faint checker
            rgba[i * 4 + 3] = (((i + (i >> 7)) & 1) * 8 + 16) as u8;
            continue;
        }
        let col = MAP_BASE_COLORS.get(base).copied().unwrap_or([0, 0, 0]);
        let mul = MAP_SHADES[(c & 3) as usize] as u32;
        rgba[i * 4] = ((col[0] as u32 * mul / 255) & 0xff) as u8; // JS: `(col[0] * mul / 255) | 0`
        rgba[i * 4 + 1] = ((col[1] as u32 * mul / 255) & 0xff) as u8;
        rgba[i * 4 + 2] = ((col[2] as u32 * mul / 255) & 0xff) as u8;
        rgba[i * 4 + 3] = 255;
    }
    rgba
}

// ============================================================ rails

/// World queries needed by the rail helpers. The JS closures over
/// `w.getState` / `getBlock` / `getStateProperties` become trait methods.
pub trait RailWorld {
    /// JS: `w.getState(x, y, z)`
    fn state_at(&self, x: i32, y: i32, z: i32) -> u32;
    /// JS: `getBlock(st)` -> block definition name (None for unknown states)
    fn block_name(&self, state: u32) -> Option<String>;
    /// JS: `getStateProperties(st).shape` (a property value by name)
    fn state_property(&self, state: u32, key: &str) -> Option<String>;
}

/// JS: `function railShape(w, x, y, z)` — the RAIL_SHAPES index of the rail at
/// the position, or None when the block is not a rail. Flattened state IDs do
/// not contain a rail-shape metadata nibble.
pub fn rail_shape(w: &dyn RailWorld, x: i32, y: i32, z: i32) -> Option<usize> {
    let st = w.state_at(x, y, z);
    let name = w.block_name(st)?;
    if !RAILS.contains(&name.as_str()) {
        return None;
    }
    let shape = w
        .state_property(st, "shape")
        .and_then(|s| RAIL_SHAPES.iter().position(|r| *r == s));
    shape
}

/// JS: `function railPos(w, x, y, z)` — EntityMinecart.getPos: the point on the
/// rail nearest to the position. Returns `[x, y, z]` or None when off-rail.
pub fn rail_pos(w: &dyn RailWorld, x: f64, y: f64, z: f64) -> Option<[f64; 3]> {
    let i = x.floor() as i32;
    let k = z.floor() as i32;
    let mut j = y.floor() as i32;
    // JS: `if (railShape(w, i, j - 1, k) !== null) j--;`
    if rail_shape(w, i, j - 1, k).is_some() {
        j -= 1;
    }
    let dir = rail_shape(w, i, j, k)?;
    let a = RAIL_EXITS[dir];
    let d0 = i as f64 + 0.5 + a[0][0] as f64 * 0.5;
    let d1 = j as f64 + 0.0625 + a[0][1] as f64 * 0.5;
    let d2 = k as f64 + 0.5 + a[0][2] as f64 * 0.5;
    let d3 = i as f64 + 0.5 + a[1][0] as f64 * 0.5;
    let d4 = j as f64 + 0.0625 + a[1][1] as f64 * 0.5;
    let d5 = k as f64 + 0.5 + a[1][2] as f64 * 0.5;
    let d6 = d3 - d0;
    let d7 = (d4 - d1) * 2.0;
    let d8 = d5 - d2;
    let d9: f64;
    if d6 == 0.0 {
        d9 = z - k as f64;
    } else if d8 == 0.0 {
        d9 = x - i as f64;
    } else {
        d9 = ((x - d0) * d6 + (z - d2) * d8) * 2.0;
    }
    let mut ry = d1 + d7 * d9;
    if d7 < 0.0 { ry += 1.0; }
    if d7 > 0.0 { ry += 0.5; }
    Some([d0 + d6 * d9, ry, d2 + d8 * d9])
}

/// JS: `function railPosOffset(w, x, y, z, offset)` — EntityMinecart.getPosOffset:
/// getPos `offset` blocks along the rail.
pub fn rail_pos_offset(w: &dyn RailWorld, x: f64, y: f64, z: f64, offset: f64) -> Option<[f64; 3]> {
    let i = x.floor() as i32;
    let k = z.floor() as i32;
    let mut j = y.floor() as i32;
    if rail_shape(w, i, j - 1, k).is_some() {
        j -= 1;
    }
    let dir = rail_shape(w, i, j, k)?;
    let mut y = j as f64;
    if (2..=5).contains(&dir) {
        y = j as f64 + 1.0; // ascending shapes
    }
    let a = RAIL_EXITS[dir];
    let mut d0 = (a[1][0] - a[0][0]) as f64;
    let mut d1 = (a[1][2] - a[0][2]) as f64;
    let d2 = (d0 * d0 + d1 * d1).sqrt();
    d0 /= d2;
    d1 /= d2;
    let x = x + d0 * offset;
    let z = z + d1 * offset;
    if a[0][1] != 0 && x.floor() as i64 - i as i64 == a[0][0] as i64 && z.floor() as i64 - k as i64 == a[0][2] as i64 {
        y += a[0][1] as f64;
    } else if a[1][1] != 0 && x.floor() as i64 - i as i64 == a[1][0] as i64 && z.floor() as i64 - k as i64 == a[1][2] as i64 {
        y += a[1][1] as f64;
    }
    rail_pos(w, x, y, z)
}

// ============================================================ skin repair

/// RGBA image (JS passes the `decodePng` result `{ width, height, data }`).
#[derive(Clone, Debug)]
pub struct RgbaImage {
    pub width: usize,
    pub height: usize,
    pub data: Vec<u8>,
}

/// JS: `parseUserSkin` result `{ width, height, data }`.
#[derive(Clone, Debug)]
pub struct ParsedSkin {
    pub width: usize,
    pub height: usize,
    pub data: Vec<u8>,
}

/// JS: `export function parseUserSkin(img)` — ImageBufferDownload.parseUserSkin
/// (1.8+): skins become 64x64 (times the HD factor). Legacy 64x32 skins get
/// their limbs copied (mirrored) into the separate left-limb areas. The base
/// layer is made opaque everywhere, and the hat layer cleared unless it already
/// has transparency (old skins painted it solid).
pub fn parse_user_skin(img: &RgbaImage) -> ParsedSkin {
    let mut w = 64usize;
    let mut h = 64usize;
    let mut k = 1usize;
    // JS: `while (W < img.width || H < img.height) { W *= 2; H *= 2; k *= 2; }`
    while w < img.width || h < img.height {
        w *= 2;
        h *= 2;
        k *= 2;
    }
    let mut d = vec![0u8; w * h * 4];
    // JS: copy each source row into the (larger) destination rows
    let rows = img.height.min(h);
    let cols = img.width.min(w);
    for y in 0..rows {
        let src = y * img.width * 4;
        let dst = y * w * 4;
        d[dst..dst + cols * 4].copy_from_slice(&img.data[src..src + cols * 4]);
    }
    if img.height == 32 * k {
        // JS: Graphics.drawImage(src, dx1, dy1, dx2, dy2, sx1, sy1, sx2, sy2):
        // dx1 > dx2 mirrors horizontally. In-place copy inside `d`.
        let draw = |d: &mut [u8], dx1: isize, dy1: isize, dx2: isize, dy2: isize, sx1: isize, sy1: isize, sx2: isize, sy2: isize| {
            let wpx = (dx2 - dx1).abs() as usize;
            let hpx = (dy2 - dy1) as usize;
            let flip = dx1 > dx2;
            let x0 = dx1.min(dx2) as usize;
            for y in 0..hpx {
                for x in 0..wpx {
                    let sx = sx1 + if flip { (wpx as isize - 1 - x as isize) } else { x as isize };
                    let sy = sy1 + y as isize;
                    let _ = sx2;
                    let _ = sy2;
                    let si = (sy as usize * w + sx as usize) * 4;
                    let di = ((dy1 as usize + y) * w + x0 + x) * 4;
                    d[di] = d[si];
                    d[di + 1] = d[si + 1];
                    d[di + 2] = d[si + 2];
                    d[di + 3] = d[si + 3];
                }
            }
        };
        // JS (line 2117): the 12 legacy limb rectangles, scaled by the HD factor.
        const RECTS: [[isize; 8]; 12] = [
            [24, 48, 20, 52, 4, 16, 8, 20], [28, 48, 24, 52, 8, 16, 12, 20],
            [20, 52, 16, 64, 8, 20, 12, 32], [24, 52, 20, 64, 4, 20, 8, 32],
            [28, 52, 24, 64, 0, 20, 4, 32], [32, 52, 28, 64, 12, 20, 16, 32],
            [40, 48, 36, 52, 44, 16, 48, 20], [44, 48, 40, 52, 48, 16, 52, 20],
            [36, 52, 32, 64, 48, 20, 52, 32], [40, 52, 36, 64, 44, 20, 48, 32],
            [44, 52, 40, 64, 40, 20, 44, 32], [48, 52, 44, 64, 52, 20, 56, 32],
        ];
        for r in RECTS {
            let vals: [isize; 8] = [
                r[0] * k as isize, r[1] * k as isize, r[2] * k as isize, r[3] * k as isize,
                r[4] * k as isize, r[5] * k as isize, r[6] * k as isize, r[7] * k as isize,
            ];
            draw(&mut d, vals[0], vals[1], vals[2], vals[3], vals[4], vals[5], vals[6], vals[7]);
        }
    }
    let opaque = |d: &mut [u8], x1: usize, y1: usize, x2: usize, y2: usize| {
        for y in y1..y2 {
            for x in x1..x2 {
                d[(y * w + x) * 4 + 3] = 255;
            }
        }
    };
    // JS: `transparent(...)` — leave the region untouched when any pixel is
    // already translucent (< 128), else clear its alpha entirely.
    let hat_is_opaque = {
        let mut all = true;
        'outer: for y in 0..32 * k {
            for x in 32 * k..64 * k {
                if d[(y * w + x) * 4 + 3] < 128 {
                    all = false;
                    break 'outer;
                }
            }
        }
        all
    };
    opaque(&mut d, 0, 0, 32 * k, 16 * k);
    if hat_is_opaque {
        for y in 0..32 * k {
            for x in 32 * k..64 * k {
                d[(y * w + x) * 4 + 3] = 0;
            }
        }
    }
    opaque(&mut d, 0, 16 * k, 64 * k, 32 * k);
    opaque(&mut d, 16 * k, 48 * k, 48 * k, 64 * k);
    ParsedSkin { width: w, height: h, data: d }
}

// ============================================================ mesh builders

/// Vertex formats used by the entity renderer's CPU-side mesh builders.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MeshFormat {
    /// `FORMAT.entity`: pos(3) uv(2) normal(3) colour(3) — 11 floats.
    Entity,
    /// `FORMAT.color`: pos(3) uv(2) colour(4) — 9 floats.
    Color,
}

impl MeshFormat {
    pub const fn stride(&self) -> usize {
        match self {
            MeshFormat::Entity => 11,
            MeshFormat::Color => 9,
        }
    }
}

/// A CPU-side mesh: interleaved vertex floats plus its format/quad flag
/// (the `opts` argument of `device.createMesh`).
#[derive(Clone, Debug)]
pub struct MeshData {
    pub format: MeshFormat,
    pub data: Vec<f32>,
    pub quads: bool,
}

/// JS (boxmodel.js `entityVertices`): interleave flat pos/uv/normal/colour
/// arrays into FORMAT.entity vertices (colour defaults to white when absent).
pub fn interleave_entity_vertices(pos: &[f32], uv: &[f32], nor: &[f32], col: Option<&[f32]>) -> Vec<f32> {
    let n = pos.len() / 3;
    let mut out = vec![0f32; n * 11];
    for i in 0..n {
        let o = i * 11;
        out[o] = pos[i * 3];
        out[o + 1] = pos[i * 3 + 1];
        out[o + 2] = pos[i * 3 + 2];
        out[o + 3] = uv[i * 2];
        out[o + 4] = uv[i * 2 + 1];
        out[o + 5] = nor[i * 3];
        out[o + 6] = nor[i * 3 + 1];
        out[o + 7] = nor[i * 3 + 2];
        if let Some(c) = col {
            out[o + 8] = c[i * 3];
            out[o + 9] = c[i * 3 + 1];
            out[o + 10] = c[i * 3 + 2];
        } else {
            out[o + 8] = 1.0;
            out[o + 9] = 1.0;
            out[o + 10] = 1.0;
        }
    }
    out
}

/// Per-face UV rectangles (texture pixels): `{ px, nx, py, ny, pz, nz: [u0, v0, u1, v1] }`.
#[derive(Clone, Copy, Debug, Default)]
pub struct UvFaces {
    pub px: Option<[f32; 4]>,
    pub nx: Option<[f32; 4]>,
    pub py: Option<[f32; 4]>,
    pub ny: Option<[f32; 4]>,
    pub pz: Option<[f32; 4]>,
    pub nz: Option<[f32; 4]>,
}

/// JS: `function uvBoxMesh(w, h, d, faces, texW, texH)` — box with explicit
/// per-face UV rectangles; vertex data only (the device mesh upload is
/// browser-bound). Face/vertex order matches the JS exactly.
pub fn uv_box_mesh(w: f64, h: f64, d: f64, faces: UvFaces, tex_w: f64, tex_h: f64) -> MeshData {
    let x0 = -w / 2.0;
    let x1 = w / 2.0;
    let y0 = -h / 2.0;
    let y1 = h / 2.0;
    let z0 = -d / 2.0;
    let z1 = d / 2.0;
    let mut pos: Vec<f32> = Vec::new();
    let mut uv: Vec<f32> = Vec::new();
    let mut nor: Vec<f32> = Vec::new();
    let mut face = |pts: [[f64; 3]; 4], r: Option<[f32; 4]>, n: [f64; 3]| {
        let r = match r {
            Some(r) => r,
            None => return, // JS: `if (!r) return;`
        };
        let t = [[r[0], r[1]], [r[0], r[3]], [r[2], r[3]], [r[2], r[1]]];
        for i in 0..4 {
            pos.extend_from_slice(&[pts[i][0] as f32, pts[i][1] as f32, pts[i][2] as f32]);
            uv.push(t[i][0] / tex_w as f32);
            uv.push(t[i][1] / tex_h as f32);
            nor.extend_from_slice(&[n[0] as f32, n[1] as f32, n[2] as f32]);
        }
    };
    face([[x0, y1, z1], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1]], faces.pz, [0.0, 0.0, 1.0]);
    face([[x1, y1, z0], [x1, y0, z0], [x0, y0, z0], [x0, y1, z0]], faces.nz, [0.0, 0.0, -1.0]);
    face([[x1, y1, z1], [x1, y0, z1], [x1, y0, z0], [x1, y1, z0]], faces.px, [1.0, 0.0, 0.0]);
    face([[x0, y1, z0], [x0, y0, z0], [x0, y0, z1], [x0, y1, z1]], faces.nx, [-1.0, 0.0, 0.0]);
    face([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], faces.py, [0.0, 1.0, 0.0]);
    face([[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]], faces.ny, [0.0, -1.0, 0.0]);
    MeshData { format: MeshFormat::Entity, data: interleave_entity_vertices(&pos, &uv, &nor, None), quads: true }
}

/// JS: `function spriteMesh(device, u0, v0, u1, v1, w = 1, h = 1)` — camera
/// facing unit quad in FORMAT.color (centred); vertex data only.
pub fn sprite_mesh(u0: f64, v0: f64, u1: f64, v1: f64, w: f64, h: f64) -> MeshData {
    let x = w / 2.0;
    let y = h / 2.0;
    let data: Vec<f32> = vec![
        (-x) as f32, y as f32, 0.0, u0 as f32, v0 as f32, 1.0, 1.0, 1.0, 1.0,
        (-x) as f32, (-y) as f32, 0.0, u0 as f32, v1 as f32, 1.0, 1.0, 1.0, 1.0,
        x as f32, (-y) as f32, 0.0, u1 as f32, v1 as f32, 1.0, 1.0, 1.0, 1.0,
        x as f32, y as f32, 0.0, u1 as f32, v0 as f32, 1.0, 1.0, 1.0, 1.0,
    ];
    MeshData { format: MeshFormat::Color, data, quads: true }
}

/// JS: `function arrowMesh()` — RenderArrow geometry in arrow pixel units
/// (scaled by 0.05625 and offset -4 on x); vertex data only.
pub fn arrow_mesh() -> MeshData {
    let mut pos: Vec<f32> = Vec::new();
    let mut uv: Vec<f32> = Vec::new();
    let mut nor: Vec<f32> = Vec::new();
    // JS: `const quad = (pts, uvs, n) => { ... pos.push(pts[i][0] - 4, ...) }`
    let mut quad = |pts: [[f64; 3]; 4], uvs: [[f64; 2]; 4], n: [f64; 3]| {
        for i in 0..4 {
            pos.push((pts[i][0] - 4.0) as f32);
            pos.push(pts[i][1] as f32);
            pos.push(pts[i][2] as f32);
            uv.push(uvs[i][0] as f32);
            uv.push(uvs[i][1] as f32);
            nor.push(n[0] as f32);
            nor.push(n[1] as f32);
            nor.push(n[2] as f32);
        }
    };
    let f = 0.0f64;
    let f1 = 0.5f64;
    let f2 = 0.0f64;
    let f3 = 5.0 / 32.0;
    let f4 = 0.0f64;
    let f5 = 0.15625f64;
    let f6 = 5.0 / 32.0;
    let f7 = 10.0 / 32.0;
    quad(
        [[-7.0, -2.0, -2.0], [-7.0, -2.0, 2.0], [-7.0, 2.0, 2.0], [-7.0, 2.0, -2.0]],
        [[f4, f6], [f5, f6], [f5, f7], [f4, f7]],
        [1.0, 0.0, 0.0],
    );
    quad(
        [[-7.0, 2.0, -2.0], [-7.0, 2.0, 2.0], [-7.0, -2.0, 2.0], [-7.0, -2.0, -2.0]],
        [[f4, f6], [f5, f6], [f5, f7], [f4, f7]],
        [-1.0, 0.0, 0.0],
    );
    for j in 0..4 {
        let a = (j as f64 + 1.0) * core::f64::consts::PI / 2.0;
        let c = a.cos();
        let s = a.sin();
        let rot = |p: [f64; 3]| -> [f64; 3] { [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c] };
        quad(
            [rot([-8.0, -2.0, 0.0]), rot([8.0, -2.0, 0.0]), rot([8.0, 2.0, 0.0]), rot([-8.0, 2.0, 0.0])],
            [[f, f2], [f1, f2], [f1, f3], [f, f3]],
            rot([0.0, 0.0, 1.0]),
        );
    }
    MeshData { format: MeshFormat::Entity, data: interleave_entity_vertices(&pos, &uv, &nor, None), quads: true }
}

// ============================================================ tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn uuid_hash_matches_java_xor() {
        // most = 0, least = 1 -> hilo = 1 -> hash 1 (even => Steve)
        assert_eq!(uuid_hash("00000000-0000-0000-0000-000000000001"), 1);
        // all ones: both halves -1, XOR = 0
        assert_eq!(uuid_hash("ffffffff-ffff-ffff-ffff-ffffffffffff"), 0);
        // 0x123456789ABCDEF0 ^ 0 -> high 0x12345678 ^ low 0x9ABCDEF0 = 0x88888888 (negative i32)
        assert_eq!(uuid_hash("12345678-9abc-def0-0000-000000000000"), -2004318072);
        // dashes anywhere are stripped
        assert_eq!(uuid_hash("123456789abcdef0-0000-0000-0000-0000"), -2004318072);
        // odd (bit 0 set) => slim
        assert_eq!(uuid_hash("00000000-0000-0000-0000-000000000003") & 1, 1);
    }

    #[test]
    fn map_tables_have_the_js_sizes() {
        assert_eq!(MAP_BASE_COLORS.len(), 36);
        assert_eq!(MAP_SHADES, [180, 220, 255, 135]);
        assert_eq!(FLEECE.len(), 16);
        assert_eq!(PAINTINGS.len(), 26);
        assert_eq!(ENTITY_DYES.len(), 16);
        assert_eq!(HORSE_COLORS.len(), 7);
    }

    #[test]
    fn map_color_conversion() {
        // base 0: faint checker alpha, no colour (needs the full map slice for
        // the i=128 checker index to exist)
        let mut colors = vec![0u8; 129];
        let out = map_colors_to_rgba(&colors);
        assert_eq!(out[3], 16); // i=0: ((0 + 0) & 1) * 8 + 16
        assert_eq!(out[4 * 1 + 3], 24); // i=1: ((1 + 0) & 1) * 8 + 16
        assert_eq!(out[4 * 128 + 3], 24); // i=128: ((128 + 1) & 1) * 8 + 16
        // JS reads m.colors[i] for ALL 16384 indices; entries past the end of a
        // short colour array are `undefined` (coerced to 0), so the checker
        // covers the rest of the texture even then.
        let out = map_colors_to_rgba(&[0, 0, 0]);
        assert_eq!(out[4 * 128 + 3], 24);
        // c = 22 -> base 5 -> [160,160,255], shade 2 = 255
        let out = map_colors_to_rgba(&[22]);
        assert_eq!(&out[0..4], &[160, 160, 255, 255]);
        // c = 21 -> base 5, shade 1 = 220: 160*220/255 = 138 (truncated)
        let out = map_colors_to_rgba(&[21]);
        assert_eq!(&out[0..4], &[138, 138, 220, 255]);
        // out-of-range base falls back to black
        let out = map_colors_to_rgba(&[253]);
        assert_eq!(&out[0..4], &[0, 0, 0, 255]);
    }

    #[test]
    fn fish_helpers_use_unsigned_shifts() {
        assert_eq!(fish_shape(1), 1);
        assert_eq!(fish_shape(0), 0);
        assert_eq!(fish_shape(0x101), 1); // low byte == 1
        assert_eq!(fish_pattern(0), 1);
        assert_eq!(fish_pattern(256), 2); // (256 >>> 8) & 255 = 1 -> min(5,1)+1
        assert_eq!(fish_pattern(0x0F00), 6); // 15 -> clamped to 5, +1
        assert_eq!(fish_pattern(-256), 6); // (-256 >>> 8) & 255 = 255 -> min(5, 255) + 1 = 6
    }

    #[test]
    fn angle_helpers() {
        assert_eq!(yaw_angle(10.0, 20.0, 0.5), 15.0);
        assert_eq!(pitch_angle(0.0, 45.0, 1.0), 45.0);
        assert_eq!(wrap_angle_180(190.0), -170.0);
        assert_eq!(wrap_angle_180(180.0), -180.0);
        assert_eq!(wrap_angle_180(-180.0), -180.0);
        assert_eq!(lerp_angle_deg(350.0, 10.0, 0.5), 360.0); // shortest arc +20
        assert_eq!(lerp_angle_deg(0.0, 90.0, 0.5), 45.0);
    }

    #[test]
    fn armor_material_index_matches_the_regex() {
        assert_eq!(armor_material_index("leather_helmet"), 0);
        assert_eq!(armor_material_index("chainmail_chestplate"), 1);
        assert_eq!(armor_material_index("iron_leggings"), 2);
        assert_eq!(armor_material_index("diamond_boots"), 3);
        assert_eq!(armor_material_index("golden_helmet"), 4);
        assert_eq!(armor_material_index("turtle_helmet"), 5);
        // 'gold_' does not match the JS regex (only 'golden_')
        assert_eq!(armor_material_index("gold_helmet"), -1);
        // not an armour piece
        assert_eq!(armor_material_index("iron_horse_armor"), -1);
        assert_eq!(armor_material_index("iron"), -1);
    }

    #[test]
    fn xp_orb_rows_and_uvs() {
        assert_eq!(xp_orb_size(0.0), 0);
        assert_eq!(xp_orb_size(2.0), 0);
        assert_eq!(xp_orb_size(3.0), 1);
        assert_eq!(xp_orb_size(7.0), 2);
        assert_eq!(xp_orb_size(17.0), 3);
        assert_eq!(xp_orb_size(37.0), 4);
        assert_eq!(xp_orb_size(73.0), 5);
        assert_eq!(xp_orb_size(149.0), 6);
        assert_eq!(xp_orb_size(307.0), 7);
        assert_eq!(xp_orb_size(617.0), 8);
        assert_eq!(xp_orb_size(1237.0), 9);
        assert_eq!(xp_orb_size(2477.0), 10);
        assert_eq!(xp_orb_size(2476.0), 9);
        // size 5: u0 = 1*16/64 = 0.25, v0 = floor(5/4)*16/64 = 0.25
        let (u0, v0) = xp_orb_uv(5);
        assert!((u0 - 0.25).abs() < 1e-12 && (v0 - 0.25).abs() < 1e-12);
        let (u0, v0) = xp_orb_uv(7);
        assert!((u0 - 0.75).abs() < 1e-12 && (v0 - 0.25).abs() < 1e-12);
    }

    #[test]
    fn copies_for_counts() {
        assert_eq!(copies_for_count(1), 1);
        assert_eq!(copies_for_count(2), 2);
        assert_eq!(copies_for_count(17), 3);
        assert_eq!(copies_for_count(33), 4);
        assert_eq!(copies_for_count(49), 5);
        // JS: 48 > 32 (and not > 48) -> 4
        assert_eq!(copies_for_count(48), 4);
    }

    #[test]
    fn elytra_angle_targets() {
        let idle = elytra_angles(false, false, [0.0, 0.0, 0.0]);
        assert_eq!(idle, [0.2617994, 0.0, -0.2617994, 0.0]);
        let sneak = elytra_angles(false, true, [0.0, 0.0, 0.0]);
        assert!((sneak[0] - core::f64::consts::PI * 2.0 / 9.0).abs() < 1e-12);
        assert!((sneak[1] - 0.08726646).abs() < 1e-12);
        assert!((sneak[2] + core::f64::consts::PI / 4.0).abs() < 1e-12);
        assert_eq!(sneak[3], 3.0);
        // flying straight down: f4 = 1 - 1 = 0 -> keeps idle angles
        let fly = elytra_angles(true, false, [0.0, -1.0, 0.0]);
        assert!((fly[0] - 0.2617994).abs() < 1e-9);
        // flying horizontally: f4 = 1 -> f = 0.34906584, f1 = -PI/2
        let fly = elytra_angles(true, false, [1.0, 0.0, 0.0]);
        assert!((fly[0] - 0.34906584).abs() < 1e-9);
        assert!((fly[2] + core::f64::consts::PI / 2.0).abs() < 1e-9);
    }

    #[test]
    fn fox_child_scaling() {
        let [head, body] = scale_fox_child(true);
        assert_eq!(head, (0.75, 6.0, 3.35 * 0.75));
        assert_eq!(body, (0.5, 12.0, 0.0));
        let [head, body] = scale_fox_child(false);
        assert_eq!(head, (1.0, 0.0, 0.0));
        assert_eq!(body, (1.0, 0.0, 0.0));
    }

    #[test]
    fn cullable_kinds() {
        assert!(is_cullable_kind("player"));
        assert!(is_cullable_kind("dragon_fireball"));
        assert!(!is_cullable_kind("painting"));
        assert!(!is_cullable_kind("lightning"));
    }

    #[test]
    fn uv_box_builds_the_front_face_first() {
        let mut faces = UvFaces::default();
        faces.pz = Some([0.0, 0.0, 16.0, 16.0]);
        let m = uv_box_mesh(1.0, 1.0, 1.0, faces, 16.0, 16.0);
        assert!(m.quads);
        assert_eq!(m.format, MeshFormat::Entity);
        assert_eq!(m.data.len(), 4 * 11); // one quad
        // first vertex: (-0.5, 0.5, 0.5) uv (0, 0) normal (0, 0, 1) colour white
        assert_eq!(&m.data[0..3], &[-0.5, 0.5, 0.5]);
        assert_eq!(&m.data[3..5], &[0.0, 0.0]);
        assert_eq!(&m.data[5..8], &[0.0, 0.0, 1.0]);
        assert_eq!(&m.data[8..11], &[1.0, 1.0, 1.0]);
        // second vertex uv: (r0, r3) = (0, 1)
        assert_eq!(&m.data[14..16], &[0.0, 1.0]);
        // fourth vertex uv: (r2, r1) = (1, 0)
        assert_eq!(&m.data[36..38], &[1.0, 0.0]);
    }

    #[test]
    fn sprite_mesh_layout() {
        let m = sprite_mesh(0.0, 0.0, 1.0, 1.0, 2.0, 1.0);
        assert_eq!(m.format, MeshFormat::Color);
        assert_eq!(m.data.len(), 36);
        // (-1, 0.5, 0, 0, 0, 1, 1, 1, 1)
        assert_eq!(&m.data[0..9], &[-1.0, 0.5, 0.0, 0.0, 0.0, 1.0, 1.0, 1.0, 1.0]);
        // (1, -0.5, 0, 1, 1, ...)
        assert_eq!(&m.data[18..23], &[1.0, -0.5, 0.0, 1.0, 1.0]);
    }

    #[test]
    fn arrow_mesh_shape() {
        let m = arrow_mesh();
        // JS: 2 caps + 4 fin quads = 6 quads x 4 verts x 11 floats (entity fmt).
        assert_eq!(m.data.len(), 6 * 4 * 11);
        // first cap vertex: (-7 - 4, -2, -2) uv (0, 5/32) normal (1,0,0)
        assert_eq!(&m.data[0..3], &[-11.0, -2.0, -2.0]);
        assert_eq!(&m.data[3..5], &[0.0, 5.0 / 32.0]);
        assert_eq!(&m.data[5..8], &[1.0, 0.0, 0.0]);
        // fin j=3 (270 deg): rot([-8,-2,0]) = [-8, -2*0 - 0*s, ...] -> rotated x stays -8; offset -4
        // vertex 3*16 (fins start at vertex 8): first fin vertex rot([-8,-2,0]) with a=PI/2:
        // c=0, s=1 -> [-8, 0*-2 - 0*1... ] = [-8, -0*1, -2*1 + 0*0] -> (-8, 0, -2) -> (-12, 0, -2)
        // fin j=3 (a = 2π): rot([-8,-2,0]) = [-8, -2*sin? ...] — the y term is
        // -2*c - 0*s = -2*cos(2π) ≈ -2 with a f64 sin(2π) residual on z; the x
        // offset gives -12. (JS Math.sin(2π) carries the same epsilon.)
        let o = 8 * 11;
        // fin j=0 (a = π/2): c = cos(π/2) = 6.12e-17 (f64 epsilon, same in JS
        // Math.cos), s = 1 → rot([-8,-2,0]) = [-8, -2c, -2] → x - 4 = -12.
        let v = &m.data[o..o + 3];
        assert!((v[0] - -12.0).abs() < 1e-6);
        assert!(v[1].abs() < 1e-6);
        assert!((v[2] - -2.0).abs() < 1e-6);
        assert_eq!(&m.data[o + 3..o + 5], &[0.0, 0.0]);
    }

    #[test]
    fn parse_user_skin_upgrades_legacy_64x32() {
        // all-opaque legacy skin
        let mut data = vec![0u8; 64 * 32 * 4];
        for px in data.chunks_mut(4) {
            px.copy_from_slice(&[1, 2, 3, 200]);
        }
        // mark the source rectangle of the first mirror op (4..8, 16..20) red
        for y in 16..20 {
            for x in 4..8 {
                let i = (y * 64 + x) * 4;
                data[i] = 255;
                data[i + 1] = 0;
                data[i + 2] = 0;
            }
        }
        let img = RgbaImage { width: 64, height: 32, data };
        let out = parse_user_skin(&img);
        assert_eq!(out.width, 64);
        assert_eq!(out.height, 64);
        // draw(24,48,20,52, 4,16,8,20): dest x0 = 20, flip; dest (20+j, 48) = src (7-j, 16)
        let at = |x: usize, y: usize| {
            let i = (y * 64 + x) * 4;
            (out.data[i], out.data[i + 1], out.data[i + 2], out.data[i + 3])
        };
        // The mirror copy carries the source RGB (and alpha 200), but JS then
        // runs opaque(16k,48k,48k,64k) over the leg region, so the final alpha
        // is 255 for every pixel in it.
        assert_eq!(at(20, 48), (255, 0, 0, 255)); // src (7, 16)
        assert_eq!(at(23, 48), (255, 0, 0, 255)); // src (4, 16)
        // base layer forced opaque (alpha was 200 -> 255)
        assert_eq!(at(0, 0).3, 255);
        // hat layer (32..64, 0..32) was fully opaque (>= 128) -> alpha cleared
        assert_eq!(at(40, 8).3, 0);
        // body region (0..64, 16..32) forced opaque
        assert_eq!(at(33, 20).3, 255);
        // left leg overlay area (16..48, 48..64) forced opaque — x must be
        // inside the region (the JS rect ends at x = 48 exclusive).
        assert_eq!(at(47, 50).3, 255);
        // Rows 32..48 of the upgraded canvas are never written by the legacy
        // draw ops or the opaque regions (JS starts from a zeroed Uint8Array).
        assert_eq!(at(0, 40).3, 0);
    }

    #[test]
    fn parse_user_skin_keeps_translucent_hat() {
        let mut data = vec![0u8; 64 * 32 * 4];
        for px in data.chunks_mut(4) {
            px.copy_from_slice(&[9, 9, 9, 255]);
        }
        // one translucent pixel in the hat region keeps the whole hat as-is
        data[(5 * 64 + 40) * 4 + 3] = 100;
        let img = RgbaImage { width: 64, height: 32, data };
        let out = parse_user_skin(&img);
        let at = |x: usize, y: usize| out.data[(y * 64 + x) * 4 + 3];
        assert_eq!(at(40, 5), 100); // untouched
        assert_eq!(at(41, 5), 255); // untouched (still original 255)
        assert_eq!(at(0, 0), 255); // base still made opaque
    }

    #[test]
    fn parse_user_skin_hd_factor() {
        // 128x128 source: doubles to 128? No: W starts 64 -> W=128, H=128, k=2
        let img = RgbaImage { width: 128, height: 128, data: vec![7; 128 * 128 * 4] };
        let out = parse_user_skin(&img);
        assert_eq!(out.width, 128);
        assert_eq!(out.height, 128);
    }

    #[test]
    fn rail_geometry_flat_and_ascending() {
        // A simple world: rail blocks north_south (shape 0) at y=64, ascending_east at y=70.
        struct W;
        impl RailWorld for W {
            fn state_at(&self, _x: i32, y: i32, _z: i32) -> u32 {
                if y == 64 { 1 } else if y == 70 { 2 } else { 0 }
            }
            fn block_name(&self, state: u32) -> Option<String> {
                match state {
                    1 | 2 => Some("rail".to_string()),
                    _ => None,
                }
            }
            fn state_property(&self, state: u32, key: &str) -> Option<String> {
                if key != "shape" {
                    return None;
                }
                match state {
                    1 => Some("north_south".to_string()),
                    2 => Some("ascending_east".to_string()),
                    _ => None,
                }
            }
        }
        let w = W;
        assert_eq!(rail_shape(&w, 5, 64, 7), Some(0));
        assert_eq!(rail_shape(&w, 5, 63, 7), None);
        // flat north_south: x centred, z slides along the rail
        let p = rail_pos(&w, 5.5, 64.0, 7.8).unwrap();
        assert_eq!(p, [5.5, 64.0625, 7.8]);
        // ascending_east rises towards +x: at x offset 0.5 -> y +0.5 (d7 > 0)
        let p = rail_pos(&w, 5.5, 70.5, 7.5).unwrap();
        assert_eq!(p, [5.5, 70.5625, 7.5]);
        // off-rail positions return None
        assert!(rail_pos(&w, 9.0, 9.0, 9.0).is_none());
    }
}
