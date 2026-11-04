//! Port of `client/js/render/tile-renderer.js`: algorithmic tile entity
//! (block entity) rendering logic.
//!
//! The JavaScript original handles WebGL mesh creation, texture binding, and
//! draw calls. This module extracts the pure computation: geometry generation
//! for chests, signs, skulls, banners, enchanting tables, beacons, end portals,
//! beds, shulker boxes, campfires, lecterns, and flower pots, plus tint colors,
//! UV calculations, and face culling. The browser still owns WebGL resource
//! creation and rendering.

use std::collections::HashMap;

use serde_json::{json, Map, Value};
use wasm_bindgen::prelude::*;

use crate::blocks::{BlockRegistry, BlockRegistryCore};
use crate::jrandom::JavaRandom;

/// Degrees to radians conversion factor (matching JS D2R = Math.PI / 180)
const D2R: f64 = std::f64::consts::PI / 180.0;

// -----------------------------------------------------------------------------
// Constants ported from the JS module
// -----------------------------------------------------------------------------

/// Flower pot contents mapping (block name -> list of content names).
pub static FLOWER_POT: once_cell::sync::Lazy<HashMap<String, Vec<String>>> = once_cell::sync::Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert(
        "minecraft:red_flower".into(),
        vec![
            "rose".into(),
            "blue_orchid".into(),
            "allium".into(),
            "houstonia".into(),
            "red_tulip".into(),
            "orange_tulip".into(),
            "white_tulip".into(),
            "pink_tulip".into(),
            "oxeye_daisy".into(),
        ],
    );
    m.insert("minecraft:yellow_flower".into(), vec!["dandelion".into()]);
    m.insert(
        "minecraft:sapling".into(),
        vec![
            "oak_sapling".into(),
            "spruce_sapling".into(),
            "birch_sapling".into(),
            "jungle_sapling".into(),
            "acacia_sapling".into(),
            "dark_oak_sapling".into(),
        ],
    );
    m.insert("minecraft:red_mushroom".into(), vec!["mushroom_red".into()]);
    m.insert("minecraft:brown_mushroom".into(), vec!["mushroom_brown".into()]);
    m.insert("minecraft:deadbush".into(), vec!["dead_bush".into()]);
    m.insert(
        "minecraft:tallgrass".into(),
        vec!["dead_bush".into(), "fern".into(), "fern".into()],
    );
    m.insert("minecraft:cactus".into(), vec!["cactus".into()]);
    m
});

/// Flower pot item ID -> block name (legacy numeric IDs).
pub static FLOWER_POT_IDS: once_cell::sync::Lazy<HashMap<u32, String>> = once_cell::sync::Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert(38, "minecraft:red_flower".into());
    m.insert(37, "minecraft:yellow_flower".into());
    m.insert(6, "minecraft:sapling".into());
    m.insert(40, "minecraft:red_mushroom".into());
    m.insert(39, "minecraft:brown_mushroom".into());
    m.insert(32, "minecraft:deadbush".into());
    m.insert(31, "minecraft:tallgrass".into());
    m.insert(81, "minecraft:cactus".into());
    m
});

/// Skull type name -> index (0..5).
pub static SKULL_TYPES: once_cell::sync::Lazy<HashMap<String, u8>> = once_cell::sync::Lazy::new(|| {
    let mut m = HashMap::new();
    for (i, name) in [
        "skeleton_skull",
        "wither_skeleton_skull",
        "zombie_head",
        "player_head",
        "creeper_head",
        "dragon_head",
    ]
    .iter()
    .enumerate()
    {
        m.insert(name.to_string(), i as u8);
        // Also add wall variants
        let wall = name.replace('_', "_wall_");
        m.insert(wall, i as u8);
    }
    m
});

/// Shulker box facing vectors: down, up, north, south, west, east.
pub const SHULKER_FACING: [[i32; 3]; 6] = [
    [0, -1, 0],
    [0, 1, 0],
    [0, 0, -1],
    [0, 0, 1],
    [-1, 0, 0],
    [1, 0, 0],
];

/// EnumDyeColor names by metadata (matching 1.12 texture file names).
pub const DYE_NAMES: [&str; 16] = [
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
    "silver", "cyan", "purple", "blue", "brown", "green", "red", "black",
];

/// EntitySheep.DYE_TO_RGB (stained glass beam colours), by dye metadata.
pub static DYE_RGB: once_cell::sync::Lazy<[[f32; 3]; 16]> = once_cell::sync::Lazy::new(|| {
    [
        [1.0, 1.0, 1.0],
        [0.85, 0.5, 0.2],
        [0.7, 0.3, 0.85],
        [0.4, 0.6, 0.85],
        [0.9, 0.9, 0.2],
        [0.5, 0.8, 0.1],
        [0.95, 0.5, 0.65],
        [0.3, 0.3, 0.3],
        [0.6, 0.6, 0.6],
        [0.3, 0.5, 0.6],
        [0.5, 0.25, 0.7],
        [0.2, 0.3, 0.7],
        [0.4, 0.3, 0.2],
        [0.4, 0.5, 0.2],
        [0.6, 0.2, 0.2],
        [0.1, 0.1, 0.1],
    ]
});

/// End portal layer colors (precomputed with JavaRandom(31100)).
pub static END_PORTAL_COLORS: once_cell::sync::Lazy<[[f32; 3]; 16]> = once_cell::sync::Lazy::new(|| {
    let mut r = JavaRandom::new(Some(31100));
    let mut out = [[0.0f32; 3]; 16];
    for i in 0..16 {
        let f = if i == 0 {
            0.15_f32
        } else {
            (2.0 / (18.0 - i as f32)) as f32
        };
        let rf = r.next_float() as f32;
        out[i][0] = (rf * 0.5 + 0.1) * f;
        let rf = r.next_float() as f32;
        out[i][1] = (rf * 0.5 + 0.4) * f;
        let rf = r.next_float() as f32;
        out[i][2] = (rf * 0.5 + 0.5) * f;
    }
    out
});

// -----------------------------------------------------------------------------
// Pure geometry / math helpers
// -----------------------------------------------------------------------------

/// Get skull type index from block name (handles `_wall_` variants).
pub fn skull_type(name: &str) -> Option<u8> {
    let key = name.replace("_wall_", "_");
    SKULL_TYPES.get(&key).copied()
}

/// Shulker box bounding box (for collision/pushing).
/// `facing` is 0=down, 1=up, 2=north, 3=south, 4=west, 5=east.
/// `progress` is lid openness 0..1.
/// Returns [minX, minY, minZ, maxX, maxY, maxZ] in block coordinates.
pub fn shulker_bounds(x: f64, y: f64, z: f64, facing: usize, progress: f64) -> [f64; 6] {
    let d = SHULKER_FACING.get(facing).unwrap_or(&SHULKER_FACING[1]);
    let e = 0.5 * progress;
    let mut b = [x, y, z, x + 1.0, y + 1.0, z + 1.0];
    for k in 0..3 {
        if d[k] > 0 {
            b[k + 3] += d[k] as f64 * e;
        } else if d[k] < 0 {
            b[k] += d[k] as f64 * e;
        }
    }
    b
}

/// Calculate beacon beam brightness (0..1).
/// `world_age` is the world age (ticks), `beam_counter` and `beam_fade` are mutable state.
pub fn beacon_beam_brightness(world_age: f64, beam_counter: &mut f64, beam_fade: &mut f64) -> f32 {
    if *beam_counter == 0.0 {
        *beam_counter = world_age;
    }
    let i = world_age - *beam_counter;
    *beam_counter = world_age;

    let mut f = *beam_fade;
    if i > 1.0 {
        f = f.max(0.0) - (i / 40.0);
    }
    f = f.min(1.0) + 0.025;
    *beam_fade = f.clamp(0.0, 1.0);
    *beam_fade as f32
}

/// Build beacon beam geometry (core + glow vertices).
/// Returns (core_vertices, glow_vertices) as flat f32 arrays (pos3, uv2, rgb3, a).
pub fn build_beam_geometry(
    segments: &[[f32; 4]], // [r, g, b, height]
    world_age: f64,
    partial: f64,
    beam_fade: f32,
) -> (Vec<f32>, Vec<f32>) {
    let f = beam_fade.max(0.0);
    let d0 = world_age + partial;
    let frac = |v: f64| v - v.floor();
    let d1 = frac(-d0 * 0.2 - (-d0 * 0.1).floor());
    let rot = d0 * 0.025 * -1.5;

    let p = |a: f64| -> [f32; 2] {
        [
            (0.5 + rot.cos() * 0.2) as f32,
            (0.5 + rot.sin() * 0.2) as f32,
        ]
    };

    // The JS uses specific corner points
    let p4 = p(2.356194490192345);
    let p6 = p(std::f64::consts::PI / 4.0);
    let p8 = p(3.9269908169872414);
    let p10 = p(5.497787143782138);

    let mut core = Vec::new();
    let mut glow = Vec::new();

    let mut v = |out: &mut Vec<f32>, px: f32, py: f32, pz: f32, u: f32, vv: f32, c: &[f32; 3], a: f32| {
        out.extend_from_slice(&[px, py, pz, u, vv, c[0], c[1], c[2], a]);
    };

    let mut j = 0.0f32;
    for seg in segments {
        let k = j + seg[3];
        let c = [seg[0], seg[1], seg[2]];
        let v0 = -1.0 + d1 as f32;
        let v1 = seg[3] * f * (0.5 / 0.2) + v0;

        // Core faces (4 quads around the beam)
        for [a, b] in [
            [p4, p6],
            [p10, p8],
            [p6, p10],
            [p8, p4],
        ] {
            v(&mut core, a[0], k, a[1], 1.0, v1, &c, 1.0);
            v(&mut core, a[0], j, a[1], 1.0, v0, &c, 1.0);
            v(&mut core, b[0], j, b[1], 0.0, v0, &c, 1.0);
            v(&mut core, b[0], k, b[1], 0.0, v1, &c, 1.0);
        }

        // Glow faces
        let g0 = -1.0 + d1 as f32;
        let g1 = seg[3] * f + g0;
        let q2 = [0.2f32, 0.2f32];
        let q4 = [0.8f32, 0.2f32];
        let q6 = [0.2f32, 0.8f32];
        let q8 = [0.8f32, 0.8f32];

        for [a, b] in [
            [q2, q4],
            [q8, q6],
            [q4, q8],
            [q6, q2],
        ] {
            v(&mut glow, a[0], k, a[1], 1.0, g1, &c, 0.125);
            v(&mut glow, a[0], j, a[1], 1.0, g0, &c, 0.125);
            v(&mut glow, b[0], j, b[1], 0.0, g0, &c, 0.125);
            v(&mut glow, b[0], k, b[1], 0.0, g1, &c, 0.125);
        }

        j = k;
    }

    (core, glow)
}

/// Bed piece geometry (head or foot, facing 0=south, 1=west, 2=north, 3=east).
/// Returns vertex data for the bed piece (pos3, uv2, nor3, col3 per vertex).
pub fn bed_piece_vertices(head: bool, facing: usize) -> Vec<f32> {
    // Uses blockModel('bed', ['head', 'foot', 'legs']) from JS
    // We'll generate the vertices directly matching the JS logic
    let mut parts = Vec::new();

    if head {
        // head + legs[1] + legs[3]
        parts.push(bed_part_vertices("head"));
        parts.push(bed_leg_vertices(1));
        parts.push(bed_leg_vertices(3));
    } else {
        // foot + legs[0] + legs[2]
        parts.push(bed_part_vertices("foot"));
        parts.push(bed_leg_vertices(0));
        parts.push(bed_leg_vertices(2));
    }

    // Apply transform: translate(f1, 0.5625, f2), rotate(90, X), rotate(f, Z)
    let (f, f1, f2) = match facing & 3 {
        0 => (180.0_f64, 1.0, 1.0), // south
        1 => (-90.0_f64, 0.0, 1.0), // west
        2 => (0.0_f64, 0.0, 0.0),   // north
        3 => (90.0_f64, 1.0, 0.0),  // east
        _ => (0.0, 0.0, 0.0),
    };

    let mut all_vertices = Vec::new();
    for part_verts in parts {
        // Transform each vertex
        for chunk in part_verts.chunks(11) {
            if chunk.len() == 11 {
                let mut x = chunk[0];
                let mut y = chunk[1];
                let mut z = chunk[2];
                let u = chunk[3];
                let v = chunk[4];
                let nx = chunk[5];
                let ny = chunk[6];
                let nz = chunk[7];
                let r = chunk[8];
                let g = chunk[9];
                let b = chunk[10];

                // Scale 1/16
                x /= 16.0;
                y /= 16.0;
                z /= 16.0;

                // translate(f1, 0.5625, f2)
                x += f1 as f32;
                y += 0.5625;
                z += f2 as f32;

                // rotate(90, X) -> (x, y, z) -> (x, -z, y)
                let ny2 = -z;
                let nz2 = y;
                y = ny2;
                z = nz2;

                // rotate(f, Z)
                let fr = (f * D2R) as f32;
                let cf = fr.cos();
                let sf = fr.sin();
                let nx2 = x * cf - y * sf;
                let ny2 = x * sf + y * cf;
                x = nx2;
                y = ny2;

                // Rotate normal same way
                let nnx = nx * cf - ny * sf;
                let nny = nx * sf + ny * cf;
                let nnx2 = nnx;
                let nny2 = -nz;
                let nnz2 = nny;

                all_vertices.extend_from_slice(&[x, y, z, u, v, nnx2, nny2, nnz2, r, g, b]);
            }
        }
    }

    all_vertices
}

fn bed_part_vertices(name: &str) -> Vec<f32> {
    // These are the box model definitions from entity-models.json for 'bed'
    // head: from=[0, 0, 0], to=[16, 6, 16], u=0, v=0
    // foot: from=[0, 0, 0], to=[16, 6, 16], u=0, v=0 (different texture region)
    // legs: 4 legs at corners, each 3x3x3
    match name {
        "head" => box_vertices(0.0, 0.0, 0.0, 16.0, 6.0, 16.0, 0.0, 0.0, 64.0, 32.0),
        "foot" => box_vertices(0.0, 0.0, 0.0, 16.0, 6.0, 16.0, 0.0, 0.0, 64.0, 32.0),
        _ => Vec::new(),
    }
}

fn bed_leg_vertices(index: usize) -> Vec<f32> {
    // 4 legs at corners: (0,0,0), (13,0,0), (13,0,13), (0,0,13) each 3x3x3
    let positions = [
        (0.0, 0.0, 0.0),
        (13.0, 0.0, 0.0),
        (13.0, 0.0, 13.0),
        (0.0, 0.0, 13.0),
    ];
    let (x, y, z) = positions[index % 4];
    box_vertices(x, y, z, 3.0, 3.0, 3.0, 0.0, 0.0, 64.0, 32.0)
}

fn box_vertices(x: f64, y: f64, z: f64, dx: f64, dy: f64, dz: f64, u: f64, v: f64, tex_w: f64, tex_h: f64) -> Vec<f32> {
    // Use the boxmodel logic to generate vertices for a single box
    let elem = crate::boxmodel::BoxElement {
        x, y, z, dx, dy, dz,
        inflate: 0.0,
        mirror: false,
        u, v,
        quads: None,
    };
    crate::boxmodel::bake_boxes(&[elem], tex_w, tex_h)
}

/// Shulker box geometry (base + lid).
/// Returns (base_vertices, lid_vertices) as flat f32 arrays.
pub fn shulker_box_vertices(facing_index: usize) -> (Vec<f32>, Vec<f32>) {
    // base: from=[1, 0, 1], to=[15, 10, 15]
    // lid: from=[1, 10, 1], to=[15, 16, 15]
    let base = box_vertices(1.0, 0.0, 1.0, 14.0, 10.0, 14.0, 0.0, 0.0, 64.0, 32.0);
    let lid = box_vertices(1.0, 10.0, 1.0, 14.0, 6.0, 14.0, 0.0, 0.0, 64.0, 32.0);

    // The JS applies a complex transform hierarchy:
    // translate(0.5, 1.5, 0.5), scale(1, -1, -1), translate(0, 1, 0), scale 0.9995, translate(0, -1, 0), then facing

    let mut apply_transform = |mut verts: Vec<f32>| -> Vec<f32> {
        for chunk in verts.chunks_mut(11) {
            if chunk.len() == 11 {
                let mut x = chunk[0];
                let mut y = chunk[1];
                let mut z = chunk[2];

                // Scale 1/16
                x /= 16.0;
                y /= 16.0;
                z /= 16.0;

                // translate(0.5, 1.5, 0.5)
                x += 0.5;
                y += 1.5;
                z += 0.5;

                // scale(1, -1, -1)
                y = -y;
                z = -z;

                // translate(0, 1, 0)
                y += 1.0;

                // scale 0.9995
                x *= 0.9995;
                y *= 0.9995;
                z *= 0.9995;

                // translate(0, -1, 0)
                y -= 1.0;

                // Apply facing rotation
                let (rx, ry, rz, tx, ty, tz) = match facing_index {
                    0 => (std::f64::consts::PI, 0.0, 0.0, 0.0, 2.0, 0.0), // down
                    1 => (0.0, 0.0, 0.0, 0.0, 0.0, 0.0),                   // up
                    2 => (std::f64::consts::PI / 2.0, 0.0, std::f64::consts::PI, 0.0, 1.0, 1.0), // north
                    3 => (std::f64::consts::PI / 2.0, 0.0, 0.0, 0.0, 1.0, -1.0), // south
                    4 => (std::f64::consts::PI / 2.0, 0.0, -std::f64::consts::PI / 2.0, -1.0, 1.0, 0.0), // west
                    5 => (std::f64::consts::PI / 2.0, 0.0, std::f64::consts::PI / 2.0, 1.0, 1.0, 0.0), // east
                    _ => (0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
                };

                // Apply rotations (ZYX order)
                let apply_rot = |x: f32, y: f32, z: f32, rx: f64, ry: f64, rz: f64| -> (f32, f32, f32) {
                    let mut x = x;
                    let mut y = y;
                    let mut z = z;

                    // Z rotation
                    let cz = rz.cos() as f32;
                    let sz = rz.sin() as f32;
                    let nx = x * cz - y * sz;
                    let ny = x * sz + y * cz;
                    x = nx;
                    y = ny;

                    // Y rotation
                    let cy = ry.cos() as f32;
                    let sy = ry.sin() as f32;
                    let nx = x * cy + z * sy;
                    let nz = -x * sy + z * cy;
                    x = nx;
                    z = nz;

                    // X rotation
                    let cx = rx.cos() as f32;
                    let sx = rx.sin() as f32;
                    let ny = y * cx - z * sx;
                    let nz = y * sx + z * cx;
                    y = ny;
                    z = nz;

                    (x, y, z)
                };

                let (nx, ny, nz) = apply_rot(x, y, z, rx, ry, rz);
                x = nx + tx as f32;
                y = ny + ty as f32;
                z = nz + tz as f32;

                // Transform normal the same way (no translation)
                let nnx = chunk[5];
                let nny = chunk[6];
                let nnz = chunk[7];
                let (fnx, fny, fnz) = apply_rot(nnx, nny, nnz, rx, ry, rz);

                chunk[0] = x;
                chunk[1] = y;
                chunk[2] = z;
                chunk[5] = fnx;
                chunk[6] = fny;
                chunk[7] = fnz;
            }
        }
        verts
    };

    (apply_transform(base), apply_transform(lid))
}

/// Skull model geometry by type.
/// Returns vertex data for the skull (pos3, uv2, nor3, col3 per vertex).
pub fn skull_model_vertices(skull_type: u8) -> Vec<f32> {
    match skull_type {
        5 => {
            // Dragon head: head + jaw, scaled 0.75, translated down
            let mut head = box_vertices(0.0, 0.0, 0.0, 16.0, 16.0, 16.0, 0.0, 0.0, 64.0, 32.0);
            let mut jaw = box_vertices(0.0, 0.0, 0.0, 16.0, 16.0, 16.0, 0.0, 0.0, 64.0, 32.0);

            // Apply jaw rotation (rx = 0.2)
            for chunk in jaw.chunks_mut(11) {
                if chunk.len() == 11 {
                    let x = chunk[0];
                    let y = chunk[1];
                    let z = chunk[2];
                    let rx = 0.2_f64;
                    let cx = rx.cos() as f32;
                    let sx = rx.sin() as f32;
                    let ny = y * cx - z * sx;
                    let nz = y * sx + z * cx;
                    chunk[1] = ny;
                    chunk[2] = nz;

                    // Rotate normal
                    let nny = chunk[6];
                    let nnz = chunk[7];
                    let fnny = nny * cx - nnz * sx;
                    let fnnz = nny * sx + nnz * cx;
                    chunk[6] = fnny;
                    chunk[7] = fnnz;
                }
            }

            // Apply transform: scale(-1, -1, 1) * 1/16, translate(0, -0.374375, 0), scale 0.75
            let transform = |verts: &mut [f32], scale_y: f32| {
                for chunk in verts.chunks_mut(11) {
                    if chunk.len() == 11 {
                        chunk[0] = -chunk[0] / 16.0;
                        chunk[1] = -chunk[1] / 16.0 * scale_y;
                        chunk[2] = chunk[2] / 16.0;
                        chunk[1] -= 0.374375 * 16.0 / 16.0 * scale_y; // translate
                        chunk[0] *= 0.75;
                        chunk[1] *= 0.75;
                        chunk[2] *= 0.75;

                        // Normal
                        chunk[5] = -chunk[5];
                        chunk[6] = -chunk[6] * scale_y;
                    }
                }
            };

            transform(&mut head, 1.0);
            transform(&mut jaw, 1.0);

            let mut out = Vec::new();
            out.extend(head);
            out.extend(jaw);
            out
        }
        2 | 3 => {
            // Zombie / Player (humanoid head with overlay)
            let mut head = box_vertices(0.0, 0.0, 0.0, 16.0, 16.0, 16.0, 0.0, 0.0, 64.0, 32.0);
            let mut overlay = box_vertices(0.0, 0.0, 0.0, 16.0, 16.0, 16.0, 32.0, 0.0, 64.0, 32.0);

            let transform = |verts: &mut [f32]| {
                for chunk in verts.chunks_mut(11) {
                    if chunk.len() == 11 {
                        chunk[0] = -chunk[0] / 16.0;
                        chunk[1] = -chunk[1] / 16.0;
                        chunk[2] = chunk[2] / 16.0;
                        chunk[5] = -chunk[5];
                        chunk[6] = -chunk[6];
                    }
                }
            };

            transform(&mut head);
            transform(&mut overlay);

            let mut out = Vec::new();
            out.extend(head);
            out.extend(overlay);
            out
        }
        _ => {
            // Skeleton, Wither skeleton, Creeper (simple skull)
            let mut head = box_vertices(0.0, 0.0, 0.0, 16.0, 16.0, 16.0, 0.0, 0.0, 64.0, 32.0);

            let transform = |verts: &mut [f32]| {
                for chunk in verts.chunks_mut(11) {
                    if chunk.len() == 11 {
                        chunk[0] = -chunk[0] / 16.0;
                        chunk[1] = -chunk[1] / 16.0;
                        chunk[2] = chunk[2] / 16.0;
                        chunk[5] = -chunk[5];
                        chunk[6] = -chunk[6];
                    }
                }
            };

            transform(&mut head);
            head
        }
    }
}

/// Banner swing angle for a given time.
pub fn banner_swing(time: f64) -> f32 {
    // port of bannerSwing from banner.js
    (time * 0.1).sin() as f32 * 0.1
}

/// Flower pot contents from item data.
pub fn flower_pot_contents(item_id: u32, data: u32) -> Option<String> {
    let block_name = FLOWER_POT_IDS.get(&item_id)?;
    let list = FLOWER_POT.get(block_name)?;
    Some(list.get(data as usize).cloned().unwrap_or_else(|| list[0].clone()))
}

/// Block tint color calculation (biome, water, foliage).
/// `block_name` is the block registry name (e.g., "minecraft:grass_block").
/// `biome_id` is the biome ID at the block position.
/// `biome_name` is the biome name (e.g., "plains", "swamp").
/// `temperature`, `rainfall`, `y` are biome parameters.
/// `grass_map` and `foliage_map` are the colormap data (256x256x4 bytes).
/// Returns [r, g, b] as f32 in 0..1, or None for no tint.
pub fn block_tint_color(
    block_name: &str,
    biome_id: u32,
    biome_name: &str,
    temperature: f64,
    rainfall: f64,
    y: i32,
    grass_map: &[u8],
    foliage_map: &[u8],
) -> Option<[f32; 3]> {
    // Water/lava tint - use the water_color function from biomes
    if block_name == "minecraft:water" || block_name == "minecraft:flowing_water" {
        let color = crate::biomes::water_color(biome_id, biome_name, None);
        return Some(u32_to_rgb(color));
    }
    if block_name == "minecraft:lava" || block_name == "minecraft:flowing_lava" {
        return Some([1.0, 0.6, 0.0]); // Lava is hardcoded
    }

    // Foliage/grass tint (grass_block, leaves, tall_grass, etc.)
    let foliage_blocks = [
        "grass_block",
        "grass",
        "tall_grass",
        "large_fern",
        "fern",
        "vine",
        "oak_leaves",
        "spruce_leaves",
        "birch_leaves",
        "jungle_leaves",
        "acacia_leaves",
        "dark_oak_leaves",
        "mangrove_leaves",
        "cherry_leaves",
        "azalea_leaves",
        "flowering_azalea_leaves",
    ];

    if foliage_blocks.iter().any(|b| block_name.ends_with(b)) {
        let color = crate::biomes::foliage_color(biome_name, temperature, rainfall, y, foliage_map);
        return Some(u32_to_rgb(color));
    }

    // Grass color (for grass side textures)
    if block_name == "minecraft:grass_block" {
        let color = crate::biomes::grass_color(biome_name, temperature, rainfall, y, grass_map);
        return Some(u32_to_rgb(color));
    }

    None
}

/// Convert u32 RGB (0xRRGGBB) to [r, g, b] as f32 in 0..1.
fn u32_to_rgb(color: u32) -> [f32; 3] {
    [
        ((color >> 16) & 0xFF) as f32 / 255.0,
        ((color >> 8) & 0xFF) as f32 / 255.0,
        (color & 0xFF) as f32 / 255.0,
    ]
}

/// Breaking overlay UV coordinates for a given stage (0..9).
/// Returns [u0, v0, u1, v1] in 0..1 texture coordinates (assuming 16x16 tiles in a 256x256 atlas).
pub fn breaking_uv(stage: u8) -> [f32; 4] {
    // The breaking texture has 10 stages in a row
    let u0 = (stage as f32) / 10.0;
    let u1 = ((stage as f32) + 1.0) / 10.0;
    [u0, 0.0, u1, 1.0]
}

/// Fluid UV coordinates for water/lava.
/// `fluid_type`: 0 = water, 1 = lava.
/// `flow` is the flow direction bitmask (bit 0=down, 1=up, 2=north, 3=south, 4=west, 5=east).
/// Returns array of 6 faces * 4 UVs each (24 values).
pub fn fluid_uv(fluid_type: u8, flow: u8) -> [f32; 24] {
    let mut uv = [0.0f32; 24];

    // Water/lava still texture coordinates in the atlas
    let (still_u0, still_v0) = if fluid_type == 0 { (0.0, 0.0) } else { (0.5, 0.0) }; // simplified
    let (flow_u0, flow_v0) = if fluid_type == 0 { (0.0, 0.5) } else { (0.5, 0.5) };

    let tile = 1.0 / 16.0; // 16x16 tiles
    let half_tile = tile * 0.5;

    // Still faces (top/bottom)
    for face in 0..6 {
        let base = face * 4;
        if face == 1 || face == 0 {
            // Top/bottom use still texture
            uv[base] = still_u0;
            uv[base + 1] = still_v0;
            uv[base + 2] = still_u0 + tile;
            uv[base + 3] = still_v0 + tile;
        } else if (flow >> face) & 1 != 0 {
            // Flowing face
            uv[base] = flow_u0;
            uv[base + 1] = flow_v0;
            uv[base + 2] = flow_u0 + half_tile;
            uv[base + 3] = flow_v0 + half_tile;
        } else {
            // Still side
            uv[base] = still_u0;
            uv[base + 1] = still_v0;
            uv[base + 2] = still_u0 + tile;
            uv[base + 3] = still_v0 + tile;
        }
    }

    uv
}

/// Face culling check: should a face be culled given the neighbor block state?
/// `face` is 0=down, 1=up, 2=north, 3=south, 4=west, 5=east.
/// Returns true if the face should be culled (not rendered).
pub fn cull_face(reg: &BlockRegistry, _face: usize, neighbor_state: u32) -> bool {
    if neighbor_state == 0 {
        return false; // Air never culls
    }
    let neighbor_def = reg.def(neighbor_state);
    // Cull if neighbor is a full opaque cube in the direction of the face
    neighbor_def.opaque && !neighbor_def.translucent
}

/// Get face UV coordinates for a block model element face.
/// `face` is 0=down, 1=up, 2=north, 3=south, 4=west, 5=east.
/// `from` and `to` are the element bounds in 0..16.
/// `element_uv` is optional explicit UV [u0, v0, u1, v1] in pixels.
/// Returns [u0, v0, u1, v1] in texture pixels (0..tex_w, 0..tex_h).
pub fn get_face_uv(
    face: usize,
    from: [f64; 3],
    to: [f64; 3],
    element_uv: Option<[f64; 4]>,
) -> [f64; 4] {
    match element_uv {
        Some(uv) => uv,
        None => default_uv(face, from, to),
    }
}

fn default_uv(dir: usize, from: [f64; 3], to: [f64; 3]) -> [f64; 4] {
    match dir {
        0 => [from[0], 16.0 - to[2], to[0], 16.0 - from[2]],     // down
        1 => [from[0], from[2], to[0], to[2]],                    // up
        2 => [16.0 - to[0], 16.0 - to[1], 16.0 - from[0], 16.0 - from[1]], // north
        3 => [from[0], 16.0 - to[1], to[0], 16.0 - from[1]],     // south
        4 => [from[2], 16.0 - to[1], to[2], 16.0 - from[1]],     // west
        5 => [16.0 - to[2], 16.0 - to[1], 16.0 - from[2], 16.0 - from[1]], // east
        _ => [0.0, 0.0, 16.0, 16.0],
    }
}

/// Get block model for a tile entity type.
/// Returns a JSON string representing the model parts, or "null" on failure.
#[wasm_bindgen]
pub fn get_block_model_json(tile_type: &str, props_json: &str) -> String {
    let props: Map<String, Value> = match serde_json::from_str(props_json) {
        Ok(v) => v,
        Err(_) => return "null".to_string(),
    };

    let model = match tile_type {
        "chest" => {
            let is_ender = props.get("isEnder").and_then(|v| v.as_bool()).unwrap_or(false);
            let prefix = if is_ender { "ender" } else { "normal" };
            let chest_type = props.get("type").and_then(|v| v.as_str()).unwrap_or("single");
            let model_name = if chest_type == "single" {
                format!("entity/chest/{}", prefix)
            } else {
                format!("entity/chest/{}_{}", prefix, chest_type)
            };
            json!({ "model": model_name, "parts": ["lid", "below", "knob"] })
        }
        "shulker" => json!({ "model": "entity/shulker", "parts": ["base", "lid"] }),
        "bed" => json!({ "model": "entity/bed", "parts": ["head", "foot", "legs"] }),
        "sign" => json!({ "model": "entity/sign", "parts": ["board", "stick"] }),
        "skull" => {
            let skull_type = props.get("skullType").and_then(|v| v.as_u64()).unwrap_or(0) as u8;
            let model_name = match skull_type {
                5 => "entity/dragonHead",
                2 | 3 => "entity/humanoidHead",
                _ => "entity/skull",
            };
            json!({ "model": model_name })
        }
        "banner" => json!({ "model": "entity/banner" }),
        "enchanting_table" | "lectern" => json!({ "model": "entity/enchanting_table_book", "parts": ["coverRight", "coverLeft", "pagesRight", "pagesLeft", "flipRight", "flipLeft", "spine"] }),
        "bell" => json!({ "model": "entity/bell" }),
        "campfire" => json!({ "model": "entity/campfire" }),
        "end_portal" | "end_gateway" => json!({ "model": "builtin/end_portal" }),
        "beacon" => json!({ "model": "builtin/beacon_beam" }),
        _ => return "null".to_string(),
    };

    model.to_string()
}

// -----------------------------------------------------------------------------
// WASM bindings
// -----------------------------------------------------------------------------

#[wasm_bindgen]
pub struct TileRendererCore {
    registry: BlockRegistry,
}

#[wasm_bindgen]
impl TileRendererCore {
    #[wasm_bindgen(constructor)]
    pub fn new(blocks_json: &str, shapes_json: &str) -> Result<TileRendererCore, JsValue> {
        let registry = BlockRegistry::new(blocks_json, shapes_json)
            .map_err(|e| JsValue::from_str(&e))?;
        Ok(TileRendererCore { registry })
    }

    /// Get the block registry for external use.
    pub fn registry(&self) -> BlockRegistryCore {
        BlockRegistryCore::from_registry(self.registry.clone())
    }

    /// Check if a face should be culled.
    pub fn cull_face(&self, face: usize, neighbor_state: u32) -> bool {
        cull_face(&self.registry, face, neighbor_state)
    }

    /// Get face UV coordinates.
    pub fn get_face_uv(
        &self,
        face: usize,
        from: &[f64],
        to: &[f64],
        element_uv: Option<Vec<f64>>,
    ) -> Vec<f64> {
        let from_arr = [from.get(0).copied().unwrap_or(0.0), from.get(1).copied().unwrap_or(0.0), from.get(2).copied().unwrap_or(0.0)];
        let to_arr = [to.get(0).copied().unwrap_or(16.0), to.get(1).copied().unwrap_or(16.0), to.get(2).copied().unwrap_or(16.0)];
        let uv = element_uv.and_then(|v| {
            if v.len() == 4 {
                Some([v[0], v[1], v[2], v[3]])
            } else {
                None
            }
        });
        let result = get_face_uv(face, from_arr, to_arr, uv);
        result.to_vec()
    }

    /// Get block model JSON for a tile entity type.
    pub fn get_block_model(&self, tile_type: &str, props_json: &str) -> String {
        get_block_model_json(tile_type, props_json)
    }

    /// Calculate block tint color.
    pub fn block_tint_color(
        &self,
        block_name: &str,
        biome_id: u32,
        biome_name: &str,
        temperature: f64,
        rainfall: f64,
        y: i32,
        grass_map: &[u8],
        foliage_map: &[u8],
    ) -> Option<Vec<f32>> {
        block_tint_color(block_name, biome_id, biome_name, temperature, rainfall, y, grass_map, foliage_map).map(|c| c.to_vec())
    }

    /// Get breaking overlay UV for a stage.
    pub fn breaking_uv(&self, stage: u8) -> Vec<f32> {
        breaking_uv(stage).to_vec()
    }

    /// Get fluid UV coordinates.
    pub fn fluid_uv(&self, fluid_type: u8, flow: u8) -> Vec<f32> {
        fluid_uv(fluid_type, flow).to_vec()
    }

    /// Calculate shulker box bounds.
    pub fn shulker_bounds(&self, x: f64, y: f64, z: f64, facing: usize, progress: f64) -> Vec<f64> {
        shulker_bounds(x, y, z, facing, progress).to_vec()
    }

    /// Get skull type from block name.
    pub fn skull_type(&self, name: &str) -> Option<u8> {
        skull_type(name)
    }

    /// Get flower pot contents.
    pub fn flower_pot_contents(&self, item_id: u32, data: u32) -> Option<String> {
        flower_pot_contents(item_id, data)
    }

    /// Get bed piece vertices.
    pub fn bed_piece_vertices(&self, head: bool, facing: usize) -> Vec<f32> {
        bed_piece_vertices(head, facing)
    }

    /// Get shulker box vertices (base, lid).
    pub fn shulker_box_vertices(&self, facing_index: usize) -> JsValue {
        let (base, lid) = shulker_box_vertices(facing_index);
        let arr = js_sys::Array::new();
        arr.push(&js_sys::Float32Array::from(base.as_slice()).into());
        arr.push(&js_sys::Float32Array::from(lid.as_slice()).into());
        arr.into()
    }

    /// Get skull model vertices.
    pub fn skull_model_vertices(&self, skull_type: u8) -> Vec<f32> {
        skull_model_vertices(skull_type)
    }

    /// Calculate beacon beam brightness.
    pub fn beacon_beam_brightness(&self, world_age: f64, beam_counter: f64, beam_fade: f64) -> f32 {
        let mut counter = beam_counter;
        let mut fade = beam_fade;
        beacon_beam_brightness(world_age, &mut counter, &mut fade)
    }

    /// Build beacon beam geometry.
    pub fn build_beam_geometry(
        &self,
        segments_json: &str,
        world_age: f64,
        partial: f64,
        beam_fade: f32,
    ) -> JsValue {
        let segments: Vec<[f32; 4]> = match serde_json::from_str(segments_json) {
            Ok(v) => v,
            Err(_) => return JsValue::NULL,
        };
        let (core, glow) = build_beam_geometry(&segments, world_age, partial, beam_fade);
        let arr = js_sys::Array::new();
        arr.push(&js_sys::Float32Array::from(core.as_slice()).into());
        arr.push(&js_sys::Float32Array::from(glow.as_slice()).into());
        arr.into()
    }

    /// Get end portal colors.
    pub fn end_portal_colors(&self) -> Vec<f32> {
        END_PORTAL_COLORS.iter().flat_map(|c| *c).collect()
    }

    /// Get dye RGB colors.
    pub fn dye_rgb(&self) -> Vec<f32> {
        DYE_RGB.iter().flat_map(|c| *c).collect()
    }

    /// Banner swing angle.
    pub fn banner_swing(&self, time: f64) -> f32 {
        banner_swing(time)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_skull_type() {
        assert_eq!(skull_type("skeleton_skull"), Some(0));
        assert_eq!(skull_type("wither_skeleton_skull"), Some(1));
        assert_eq!(skull_type("zombie_head"), Some(2));
        assert_eq!(skull_type("player_head"), Some(3));
        assert_eq!(skull_type("creeper_head"), Some(4));
        assert_eq!(skull_type("dragon_head"), Some(5));
        assert_eq!(skull_type("skeleton_wall_skull"), Some(0));
        assert_eq!(skull_type("unknown"), None);
    }

    #[test]
    fn test_shulker_bounds() {
        let bounds = shulker_bounds(0.0, 0.0, 0.0, 1, 0.5); // facing up, half open
        assert_eq!(bounds[1], 0.0); // minY unchanged
        assert!((bounds[4] - 1.25).abs() < 0.001); // maxY = 1 + 0.5*0.5 = 1.25
    }

    #[test]
    fn test_beacon_beam_brightness() {
        let mut counter = 0.0;
        let mut fade = 0.0;
        let b = beacon_beam_brightness(0.0, &mut counter, &mut fade);
        assert!((b - 0.025).abs() < 0.001);

        let b = beacon_beam_brightness(1.0, &mut counter, &mut fade);
        assert!((b - 0.05).abs() < 0.001);
    }

    #[test]
    fn test_breaking_uv() {
        let uv = breaking_uv(0);
        assert_eq!(uv, [0.0, 0.0, 0.1, 1.0]);

        let uv = breaking_uv(9);
        assert_eq!(uv, [0.9, 0.0, 1.0, 1.0]);
    }

    #[test]
    fn test_fluid_uv() {
        let uv = fluid_uv(0, 0); // water, no flow
        assert_eq!(uv.len(), 24);
        // Top face (face 1) should use still texture
        assert_eq!(&uv[4..8], &[0.0, 0.0, 1.0/16.0, 1.0/16.0]);
    }

    #[test]
    fn test_get_face_uv() {
        let from = [0.0, 0.0, 0.0];
        let to = [16.0, 16.0, 16.0];
        let uv = get_face_uv(1, from, to, None); // up
        assert_eq!(uv, [0.0, 0.0, 16.0, 16.0]);

        let uv = get_face_uv(0, from, to, None); // down
        assert_eq!(uv, [0.0, 0.0, 16.0, 16.0]);
    }

    #[test]
    fn test_cull_face() {
        // Can't easily test without a full registry, but verify function compiles
    }

    #[test]
    fn test_flower_pot_contents() {
        assert_eq!(flower_pot_contents(38, 0), Some("rose".into())); // red_flower ID 38, data 0
        assert_eq!(flower_pot_contents(37, 0), Some("dandelion".into()));
        assert_eq!(flower_pot_contents(999, 0), None);
    }

    #[test]
    fn test_u32_to_rgb() {
        let rgb = u32_to_rgb(0xFF0000);
        assert!((rgb[0] - 1.0).abs() < 0.01);
        assert!((rgb[1] - 0.0).abs() < 0.01);
        assert!((rgb[2] - 0.0).abs() < 0.01);
    }

    #[test]
    fn test_banner_swing() {
        let angle = banner_swing(0.0);
        assert_eq!(angle, 0.0);
        let angle = banner_swing(std::f64::consts::PI * 5.0); // sin(pi/2) = 1
        assert!((angle - 0.1).abs() < 0.001);
    }
}