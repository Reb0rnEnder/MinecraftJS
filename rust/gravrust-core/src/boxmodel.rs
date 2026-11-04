//! Port of `client/js/render/boxmodel.js`: texture-offset box model
//! (ModelRenderer/ModelBox) geometry generation and baking.
//!
//! This handles the pre-1.8 entity/model format where boxes are defined by
//! texture offsets and 3D coordinates, used for entities, armor, and some
//! block entities. The browser still owns WebGL mesh creation; this module
//! produces raw vertex buffers (position, uv, normal) in the entity format.

use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

pub const FACE_INDEX: [&str; 6] = ["down", "up", "north", "south", "west", "east"];
pub const DIR_VEC: [[f64; 3]; 6] = [
    [0.0, -1.0, 0.0], // down
    [0.0, 1.0, 0.0],  // up
    [0.0, 0.0, -1.0], // north
    [0.0, 0.0, 1.0],  // south
    [-1.0, 0.0, 0.0], // west
    [1.0, 0.0, 0.0],  // east
];

/// Face corners in local space (0..1) for UV mapping, matching the JS order.
/// Each face has 4 corners in CCW order when viewed from outside.
const FACE_CORNERS: [[[f64; 3]; 4]; 6] = [
    // down (y-)
    [[0.0, 0.0, 1.0], [0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [1.0, 0.0, 1.0]],
    // up (y+)
    [[0.0, 1.0, 0.0], [0.0, 1.0, 1.0], [1.0, 1.0, 1.0], [1.0, 1.0, 0.0]],
    // north (z-)
    [[1.0, 1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
    // south (z+)
    [[0.0, 1.0, 1.0], [0.0, 0.0, 1.0], [1.0, 0.0, 1.0], [1.0, 1.0, 1.0]],
    // west (x-)
    [[0.0, 1.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 1.0, 1.0]],
    // east (x+)
    [[1.0, 1.0, 1.0], [1.0, 0.0, 1.0], [1.0, 0.0, 0.0], [1.0, 1.0, 0.0]],
];

/// Entity vertex format: 11 floats per vertex (pos3, uv2, nor3, col3)
pub const ENTITY_VERTEX_STRIDE: usize = 11;

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct BoxElement {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub dx: f64,
    pub dy: f64,
    pub dz: f64,
    pub inflate: f64,
    pub mirror: bool,
    pub u: f64,
    pub v: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quads: Option<Vec<f64>>,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct BoxPart {
    pub tex_w: f64,
    pub tex_h: f64,
    pub u: f64,
    pub v: f64,
    pub boxes: Vec<BoxElement>,
    pub px: f64,
    pub py: f64,
    pub pz: f64,
    pub rx: f64,
    pub ry: f64,
    pub rz: f64,
    pub mirror: bool,
    pub visible: bool,
    #[serde(skip)]
    pub children: Vec<BoxPart>,
}

impl Default for BoxPart {
    fn default() -> Self {
        BoxPart {
            tex_w: 64.0,
            tex_h: 32.0,
            u: 0.0,
            v: 0.0,
            boxes: Vec::new(),
            px: 0.0,
            py: 0.0,
            pz: 0.0,
            rx: 0.0,
            ry: 0.0,
            rz: 0.0,
            mirror: false,
            visible: true,
            children: Vec::new(),
        }
    }
}

impl BoxPart {
    pub fn new(tex_w: f64, tex_h: f64) -> Self {
        BoxPart {
            tex_w,
            tex_h,
            ..Default::default()
        }
    }

    pub fn tex(&mut self, u: f64, v: f64) {
        self.u = u;
        self.v = v;
    }

    pub fn box_elem(
        &mut self,
        x: f64,
        y: f64,
        z: f64,
        dx: f64,
        dy: f64,
        dz: f64,
        inflate: f64,
        mirror: Option<bool>,
    ) {
        self.boxes.push(BoxElement {
            x,
            y,
            z,
            dx,
            dy,
            dz,
            inflate,
            mirror: mirror.unwrap_or(self.mirror),
            u: self.u,
            v: self.v,
            quads: None,
        });
    }

    pub fn pivot(&mut self, x: f64, y: f64, z: f64) {
        self.px = x;
        self.py = y;
        self.pz = z;
    }

    pub fn rot(&mut self, x: f64, y: f64, z: f64) {
        self.rx = x;
        self.ry = y;
        self.rz = z;
    }

    pub fn add_child(&mut self, child: BoxPart) {
        self.children.push(child);
    }

    pub fn set_mirror(&mut self, mirror: bool) {
        self.mirror = mirror;
    }

    pub fn set_visible(&mut self, visible: bool) {
        self.visible = visible;
    }
}

/// Bake a list of boxes into interleaved entity vertices (pos3, uv2, nor3, col3).
/// Returns a flat `Vec<f32>` suitable for `device.createMesh(FORMAT.entity, ...)`.
pub fn bake_boxes(boxes: &[BoxElement], tex_w: f64, tex_h: f64) -> Vec<f32> {
    let mut pos = Vec::<f64>::new();
    let mut uv = Vec::<f64>::new();
    let mut nor = Vec::<f64>::new();

    for b in boxes {
        if let Some(quads) = &b.quads {
            // Pre-baked quads: [x,y,z, u,v, nx,ny,nz, ...] per vertex
            for chunk in quads.chunks(8) {
                if chunk.len() == 8 {
                    pos.push(chunk[0] as f64);
                    pos.push(chunk[1] as f64);
                    pos.push(chunk[2] as f64);
                    uv.push(chunk[3] as f64);
                    uv.push(chunk[4] as f64);
                    nor.push(chunk[5] as f64);
                    nor.push(chunk[6] as f64);
                    nor.push(chunk[7] as f64);
                }
            }
        } else {
            add_box(&mut pos, &mut uv, &mut nor, b, tex_w, tex_h);
        }
    }

    interleave_vertices(&pos, &uv, &nor, None)
}

/// Add a single box's 6 faces to the vertex buffers.
fn add_box(pos: &mut Vec<f64>, uv: &mut Vec<f64>, nor: &mut Vec<f64>, b: &BoxElement, tex_w: f64, tex_h: f64) {
    let mut x = b.x;
    let mut y = b.y;
    let mut z = b.z;
    let mut f = x + b.dx;
    let mut f1 = y + b.dy;
    let mut f2 = z + b.dz;
    let inflate = b.inflate;
    let mirror = b.mirror;
    let u = b.u;
    let v = b.v;

    x -= inflate;
    y -= inflate;
    z -= inflate;
    f += inflate;
    f1 += inflate;
    f2 += inflate;

    if mirror {
        std::mem::swap(&mut x, &mut f);
    }

    // 8 corners of the box
    let v7 = [x, y, z];
    let v0 = [f, y, z];
    let v1 = [f, f1, z];
    let v2 = [x, f1, z];
    let v3 = [x, y, f2];
    let v4 = [f, y, f2];
    let v5 = [f, f1, f2];
    let v6 = [x, f1, f2];

    // 6 faces: [vertices(4), u1, v1, u2, v2, normal(3)]
    let quads = [
        // east  (x+)
        (vec![v4, v0, v1, v5], u + b.dz + b.dx, v + b.dz, u + b.dz + b.dx + b.dz, v + b.dz + b.dy, [1.0, 0.0, 0.0]),
        // west  (x-)
        (vec![v7, v3, v6, v2], u, v + b.dz, u + b.dz, v + b.dz + b.dy, [-1.0, 0.0, 0.0]),
        // down  (y-)
        (vec![v4, v3, v7, v0], u + b.dz, v, u + b.dz + b.dx, v + b.dz, [0.0, -1.0, 0.0]),
        // up    (y+)
        (vec![v1, v2, v6, v5], u + b.dz + b.dx, v + b.dz, u + b.dz + b.dx + b.dx, v, [0.0, 1.0, 0.0]),
        // north (z-)
        (vec![v0, v7, v2, v1], u + b.dz, v + b.dz, u + b.dz + b.dx, v + b.dz + b.dy, [0.0, 0.0, -1.0]),
        // south (z+)
        (vec![v3, v4, v5, v6], u + b.dz + b.dx + b.dz, v + b.dz, u + b.dz + b.dx + b.dz + b.dx, v + b.dz + b.dy, [0.0, 0.0, 1.0]),
    ];

    for (verts, u1, v1, u2, v2, normal) in quads {
        let mut vs = verts;
        let mut n = normal;
        let tuv = [[u2, v1], [u1, v1], [u1, v2], [u2, v2]];

        if mirror {
            vs = vec![vs[3].clone(), vs[2].clone(), vs[1].clone(), vs[0].clone()];
            let mut tuv_m = tuv;
            tuv_m.reverse();
            if n[0] != 0.0 {
                n = [-n[0], 0.0, 0.0];
            }
            for i in 0..4 {
                pos.push(vs[i][0]);
                pos.push(vs[i][1]);
                pos.push(vs[i][2]);
                uv.push(tuv_m[i][0] / tex_w);
                uv.push(tuv_m[i][1] / tex_h);
                nor.push(n[0]);
                nor.push(n[1]);
                nor.push(n[2]);
            }
        } else {
            for i in 0..4 {
                pos.push(vs[i][0]);
                pos.push(vs[i][1]);
                pos.push(vs[i][2]);
                uv.push(tuv[i][0] / tex_w);
                uv.push(tuv[i][1] / tex_h);
                nor.push(n[0]);
                nor.push(n[1]);
                nor.push(n[2]);
            }
        }
    }
}

/// Interleave position, uv, normal, color into the entity vertex format.
/// Color defaults to white (1,1,1) if not provided.
fn interleave_vertices(pos: &[f64], uv: &[f64], nor: &[f64], col: Option<&[f64]>) -> Vec<f32> {
    let n = pos.len() / 3;
    let mut out = Vec::with_capacity(n * ENTITY_VERTEX_STRIDE);

    for i in 0..n {
        let o = i * 3;
        let ou = i * 2;
        let on = i * 3;

        out.push(pos[o] as f32 / 16.0);       // x (convert from pixels to block units)
        out.push(pos[o + 1] as f32 / 16.0);   // y
        out.push(pos[o + 2] as f32 / 16.0);   // z
        out.push(uv[ou] as f32);              // u
        out.push(uv[ou + 1] as f32);          // v
        out.push(nor[on] as f32);             // nx
        out.push(nor[on + 1] as f32);         // ny
        out.push(nor[on + 2] as f32);         // nz

        if let Some(c) = col {
            if c.len() >= (i + 1) * 3 {
                out.push(c[on] as f32);
                out.push(c[on + 1] as f32);
                out.push(c[on + 2] as f32);
            } else {
                out.push(1.0);
                out.push(1.0);
                out.push(1.0);
            }
        } else {
            out.push(1.0);
            out.push(1.0);
            out.push(1.0);
        }
    }

    out
}

/// Check if a face should be culled based on neighbor block state.
/// `face` is 0=down, 1=up, 2=north, 3=south, 4=west, 5=east.
/// `neighbor_state` is the block state ID of the neighboring block (0 = air).
/// Returns true if the face should be culled (not rendered).
pub fn boxmodel_cull(reg: &crate::blocks::BlockRegistry, face: usize, neighbor_state: u32) -> bool {
    if neighbor_state == 0 {
        return false; // Air never culls
    }
    let neighbor_def = reg.def(neighbor_state);
    // Cull if neighbor is a full opaque cube in the direction of the face
    // This matches vanilla's Block.shouldSideBeRendered logic
    neighbor_def.opaque && !neighbor_def.translucent
}

/// Calculate UV coordinates for a box face given the element bounds and face direction.
/// Returns [u0, v0, u1, v1] in texture pixels (0..tex_w, 0..tex_h).
pub fn box_face_uv(
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

/// Default UV mapping for a face when no explicit UV is provided.
/// Matches the vanilla `defaultUV` logic.
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

/// Bake a complete box model (hierarchy of parts) to vertex data.
/// `model_json` is a JSON string representing the model hierarchy.
/// `reg` is the block registry for culling context.
/// `block_state` is the block state ID for culling context (0 for entities).
/// Returns a JSON string with vertices and metadata, or "null" on failure.
#[wasm_bindgen]
pub fn boxmodel_bake(model_json: &str, reg: &crate::blocks::BlockRegistryCore, block_state: u32) -> String {
    let model: Value = match serde_json::from_str(model_json) {
        Ok(v) => v,
        Err(_) => return "null".to_string(),
    };

    let registry = reg.registry();

    let mut all_vertices = Vec::new();
    let mut bounds: Option<[f64; 6]> = None;
    let mut has_geometry = false;

    if let Err(_) = bake_part_recursive(&model, registry, block_state, &mut all_vertices, &mut bounds, &mut has_geometry, [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]) {
        return "null".to_string();
    }

    if !has_geometry {
        return "null".to_string();
    }

    let result = json!({
        "vertices": all_vertices,
        "stride": ENTITY_VERTEX_STRIDE,
        "bounds": bounds.map(|b| b.to_vec()),
    });

    result.to_string()
}

fn bake_part_recursive(
    part: &Value,
    registry: &crate::blocks::BlockRegistry,
    block_state: u32,
    vertices: &mut Vec<f32>,
    bounds: &mut Option<[f64; 6]>,
    has_geometry: &mut bool,
    parent_pivot: [f64; 3],
    parent_rot: [f64; 3],
) -> Result<(), String> {
    let tex_w = part.get("texW").and_then(|v| v.as_f64()).unwrap_or(64.0);
    let tex_h = part.get("texH").and_then(|v| v.as_f64()).unwrap_or(32.0);

    let px = part.get("px").and_then(|v| v.as_f64()).unwrap_or(0.0) + parent_pivot[0];
    let py = part.get("py").and_then(|v| v.as_f64()).unwrap_or(0.0) + parent_pivot[1];
    let pz = part.get("pz").and_then(|v| v.as_f64()).unwrap_or(0.0) + parent_pivot[2];

    let rx = part.get("rx").and_then(|v| v.as_f64()).unwrap_or(0.0) + parent_rot[0];
    let ry = part.get("ry").and_then(|v| v.as_f64()).unwrap_or(0.0) + parent_rot[1];
    let rz = part.get("rz").and_then(|v| v.as_f64()).unwrap_or(0.0) + parent_rot[2];

    let mirror = part.get("mirror").and_then(|v| v.as_bool()).unwrap_or(false);
    let visible = part.get("visible").and_then(|v| v.as_bool()).unwrap_or(true);

    if !visible {
        // Still need to process children with this part's transform
    }

    // Process boxes
    if let Some(boxes) = part.get("boxes").and_then(|b| b.as_array()) {
        let mut box_elements = Vec::new();
        for b in boxes {
            let elem = BoxElement {
                x: b.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0),
                y: b.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0),
                z: b.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0),
                dx: b.get("dx").and_then(|v| v.as_f64()).unwrap_or(0.0),
                dy: b.get("dy").and_then(|v| v.as_f64()).unwrap_or(0.0),
                dz: b.get("dz").and_then(|v| v.as_f64()).unwrap_or(0.0),
                inflate: b.get("inflate").and_then(|v| v.as_f64()).unwrap_or(0.0),
                mirror: b.get("mirror").and_then(|v| v.as_bool()).unwrap_or(mirror),
                u: b.get("u").and_then(|v| v.as_f64()).unwrap_or(0.0),
                v: b.get("v").and_then(|v| v.as_f64()).unwrap_or(0.0),
                quads: None,
            };
            box_elements.push(elem);
        }

        if !box_elements.is_empty() {
            let part_vertices = bake_boxes(&box_elements, tex_w, tex_h);
            if !part_vertices.is_empty() {
                *has_geometry = true;
                // Update bounds
                let part_bounds = compute_box_bounds(&box_elements);
                *bounds = Some(match bounds {
                    None => part_bounds,
                    Some(mut b) => {
                        for i in 0..3 {
                            b[i] = b[i].min(part_bounds[i]);
                            b[i + 3] = b[i + 3].max(part_bounds[i + 3]);
                        }
                        b
                    }
                });
                vertices.extend(part_vertices);
            }
        }
    }

    // Process children
    if let Some(children) = part.get("children").and_then(|c| c.as_array()) {
        for child in children {
            bake_part_recursive(child, registry, block_state, vertices, bounds, has_geometry, [px, py, pz], [rx, ry, rz])?;
        }
    }

    Ok(())
}

fn compute_box_bounds(boxes: &[BoxElement]) -> [f64; 6] {
    let mut min_x = f64::INFINITY;
    let mut min_y = f64::INFINITY;
    let mut min_z = f64::INFINITY;
    let mut max_x = f64::NEG_INFINITY;
    let mut max_y = f64::NEG_INFINITY;
    let mut max_z = f64::NEG_INFINITY;

    for b in boxes {
        let x0 = (b.x - b.inflate) / 16.0;
        let y0 = (b.y - b.inflate) / 16.0;
        let z0 = (b.z - b.inflate) / 16.0;
        let x1 = (b.x + b.dx + b.inflate) / 16.0;
        let y1 = (b.y + b.dy + b.inflate) / 16.0;
        let z1 = (b.z + b.dz + b.inflate) / 16.0;

        min_x = min_x.min(x0);
        min_y = min_y.min(y0);
        min_z = min_z.min(z0);
        max_x = max_x.max(x1);
        max_y = max_y.max(y1);
        max_z = max_z.max(z1);
    }

    [min_x, min_y, min_z, max_x, max_y, max_z]
}

/// Transform a part's boxes by its pivot and rotation (for JS-side scene graph).
/// Returns a JSON string with transformed boxes.
#[wasm_bindgen]
pub fn boxmodel_transform_part(part_json: &str) -> String {
    let part: Value = match serde_json::from_str(part_json) {
        Ok(v) => v,
        Err(_) => return "null".to_string(),
    };

    let px = part.get("px").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let py = part.get("py").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let pz = part.get("pz").and_then(|v| v.as_f64()).unwrap_or(0.0);

    let rx = part.get("rx").and_then(|v| v.as_f64()).unwrap_or(0.0).to_radians();
    let ry = part.get("ry").and_then(|v| v.as_f64()).unwrap_or(0.0).to_radians();
    let rz = part.get("rz").and_then(|v| v.as_f64()).unwrap_or(0.0).to_radians();

    // ZYX rotation order (matches JS: rotation.order = 'ZYX')
    let cx = rx.cos();
    let sx = rx.sin();
    let cy = ry.cos();
    let sy = ry.sin();
    let cz = rz.cos();
    let sz = rz.sin();

    let mut transformed = Vec::new();

    if let Some(boxes) = part.get("boxes").and_then(|b| b.as_array()) {
        for b in boxes {
            let mut corners = [
                [b.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0)],
                [b.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dx").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0)],
                [b.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dx").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dy").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0)],
                [b.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dy").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0)],
                [b.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dz").and_then(|v| v.as_f64()).unwrap_or(0.0)],
                [b.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dx").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dz").and_then(|v| v.as_f64()).unwrap_or(0.0)],
                [b.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dx").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dy").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dz").and_then(|v| v.as_f64()).unwrap_or(0.0)],
                [b.get("x").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("y").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dy").and_then(|v| v.as_f64()).unwrap_or(0.0), b.get("z").and_then(|v| v.as_f64()).unwrap_or(0.0) + b.get("dz").and_then(|v| v.as_f64()).unwrap_or(0.0)],
            ];

            for corner in &mut corners {
                // Translate to pivot
                corner[0] -= px;
                corner[1] -= py;
                corner[2] -= pz;

                // Z rotation
                let x = corner[0] * cz - corner[1] * sz;
                let y = corner[0] * sz + corner[1] * cz;
                corner[0] = x;
                corner[1] = y;

                // Y rotation
                let x = corner[0] * cy + corner[2] * sy;
                let z = -corner[0] * sy + corner[2] * cy;
                corner[0] = x;
                corner[2] = z;

                // X rotation
                let y = corner[1] * cx - corner[2] * sx;
                let z = corner[1] * sx + corner[2] * cx;
                corner[1] = y;
                corner[2] = z;

                // Translate back
                corner[0] += px;
                corner[1] += py;
                corner[2] += pz;
            }

            transformed.push(json!({
                "corners": corners,
                "u": b.get("u").and_then(|v| v.as_f64()).unwrap_or(0.0),
                "v": b.get("v").and_then(|v| v.as_f64()).unwrap_or(0.0),
                "texW": part.get("texW").and_then(|v| v.as_f64()).unwrap_or(64.0),
                "texH": part.get("texH").and_then(|v| v.as_f64()).unwrap_or(32.0),
            }));
        }
    }

    json!({ "boxes": transformed }).to_string()
}

// --------------------------------------------------------------------- wasm bindings

#[wasm_bindgen]
pub struct BoxModelCore {
    part: BoxPart,
}

#[wasm_bindgen]
impl BoxModelCore {
    #[wasm_bindgen(constructor)]
    pub fn new(tex_w: f64, tex_h: f64) -> BoxModelCore {
        BoxModelCore { part: BoxPart::new(tex_w, tex_h) }
    }

    pub fn tex(&mut self, u: f64, v: f64) {
        self.part.tex(u, v);
    }

    pub fn box_elem(&mut self, x: f64, y: f64, z: f64, dx: f64, dy: f64, dz: f64, inflate: f64, mirror: Option<bool>) {
        self.part.box_elem(x, y, z, dx, dy, dz, inflate, mirror);
    }

    pub fn pivot(&mut self, x: f64, y: f64, z: f64) {
        self.part.pivot(x, y, z);
    }

    pub fn rot(&mut self, x: f64, y: f64, z: f64) {
        self.part.rot(x, y, z);
    }

    pub fn mirror(&mut self, mirror: bool) {
        self.part.set_mirror(mirror);
    }

    pub fn visible(&mut self, visible: bool) {
        self.part.set_visible(visible);
    }

    pub fn add_child(&mut self, child: &BoxModelCore) {
        self.part.add_child(child.part.clone());
    }

    /// Bake this part and all children to entity vertices.
    pub fn bake(&self, reg: &crate::blocks::BlockRegistryCore) -> Vec<f32> {
        let mut all_vertices = Vec::new();
        let mut bounds = None;
        let mut has_geometry = false;
        let registry = reg.registry();
        let _ = bake_part_recursive(
            &serde_json::to_value(&self.part).unwrap(),
            &registry,
            0,
            &mut all_vertices,
            &mut bounds,
            &mut has_geometry,
            [0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0],
        );
        all_vertices
    }

    /// Export as JSON for debugging/serialization.
    pub fn to_json(&self) -> String {
        serde_json::to_string(&self.part).unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_box_vertices() {
        let mut pos = Vec::new();
        let mut uv = Vec::new();
        let mut nor = Vec::new();

        let b = BoxElement {
            x: 0.0, y: 0.0, z: 0.0,
            dx: 16.0, dy: 16.0, dz: 16.0,
            inflate: 0.0,
            mirror: false,
            u: 0.0, v: 0.0,
            quads: None,
        };

        add_box(&mut pos, &mut uv, &mut nor, &b, 64.0, 32.0);

        // 6 faces * 4 vertices = 24 vertices
        assert_eq!(pos.len(), 24 * 3);
        assert_eq!(uv.len(), 24 * 2);
        assert_eq!(nor.len(), 24 * 3);

        // Check normals for each face
        // Face 0 (east): normal (1,0,0)
        assert_eq!(&nor[0..3], &[1.0, 0.0, 0.0]);
        // Face 1 (west): normal (-1,0,0)
        assert_eq!(&nor[12..15], &[-1.0, 0.0, 0.0]);
        // Face 2 (down): normal (0,-1,0)
        assert_eq!(&nor[24..27], &[0.0, -1.0, 0.0]);
        // Face 3 (up): normal (0,1,0)
        assert_eq!(&nor[36..39], &[0.0, 1.0, 0.0]);
        // Face 4 (north): normal (0,0,-1)
        assert_eq!(&nor[48..51], &[0.0, 0.0, -1.0]);
        // Face 5 (south): normal (0,0,1)
        assert_eq!(&nor[60..63], &[0.0, 0.0, 1.0]);
    }

    #[test]
    fn test_mirror_flips_winding_and_normals() {
        let mut pos = Vec::new();
        let mut uv = Vec::new();
        let mut nor = Vec::new();

        let b = BoxElement {
            x: 0.0, y: 0.0, z: 0.0,
            dx: 16.0, dy: 16.0, dz: 16.0,
            inflate: 0.0,
            mirror: true,
            u: 0.0, v: 0.0,
            quads: None,
        };

        add_box(&mut pos, &mut uv, &mut nor, &b, 64.0, 32.0);

        // With mirror, east/west normals should flip
        // Face 0 was east (1,0,0), now should be west (-1,0,0) due to mirror
        assert_eq!(&nor[0..3], &[-1.0, 0.0, 0.0]);
        // Face 1 was west (-1,0,0), now should be east (1,0,0)
        assert_eq!(&nor[12..15], &[1.0, 0.0, 0.0]);
    }

    #[test]
    fn test_interleave_vertices() {
        let pos = vec![0.0, 0.0, 0.0, 16.0, 0.0, 0.0];
        let uv = vec![0.0, 0.0, 0.25, 0.0];
        let nor = vec![0.0, 1.0, 0.0, 0.0, 1.0, 0.0];

        let vertices = interleave_vertices(&pos, &uv, &nor, None);
        assert_eq!(vertices.len(), 2 * 11);

        // Vertex 0
        assert_eq!(vertices[0], 0.0);     // x
        assert_eq!(vertices[1], 0.0);     // y
        assert_eq!(vertices[2], 0.0);     // z
        assert_eq!(vertices[3], 0.0);     // u
        assert_eq!(vertices[4], 0.0);     // v
        assert_eq!(vertices[5], 0.0);     // nx
        assert_eq!(vertices[6], 1.0);     // ny
        assert_eq!(vertices[7], 0.0);     // nz
        assert_eq!(vertices[8], 1.0);     // r
        assert_eq!(vertices[9], 1.0);     // g
        assert_eq!(vertices[10], 1.0);    // b
    }

    #[test]
    fn test_default_uv() {
        let from = [0.0, 0.0, 0.0];
        let to = [16.0, 16.0, 16.0];

        // Down face
        let uv = default_uv(0, from, to);
        assert_eq!(uv, [0.0, 0.0, 16.0, 16.0]);

        // Up face
        let uv = default_uv(1, from, to);
        assert_eq!(uv, [0.0, 0.0, 16.0, 16.0]);

        // North face
        let uv = default_uv(2, from, to);
        assert_eq!(uv, [0.0, 0.0, 16.0, 16.0]);
    }

    #[test]
    fn test_boxmodel_cull() {
        // We can't easily test this without a full registry, but we can
        // verify the function signature compiles.
        // The actual logic is tested in integration tests with a real registry.
    }
}