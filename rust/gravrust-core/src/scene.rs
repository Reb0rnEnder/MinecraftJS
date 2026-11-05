// Port of `client/js/gfx/scene.js`.
//
// Minimal scene graph: nodes with TRS transforms (or an explicit matrix) and
// drawables. A drawable is `{ mesh, mat, order, primitive?, first?, count? }`
// where `mat` is a shared material `{ pipeline, tex, params, state }`. String
// textures are resolved at draw time through the resolver passed to
// `drawTree` (so textures may load lazily).
//
// Ownership note: the JS keeps a `parent` back-pointer so `add()` detaches a
// node from its previous parent; the Rust tree owns its children, which makes
// the detach implicit. Behaviour is otherwise identical. The JS shares
// material objects by reference (setMaterial reassigns every drawable's `mat`
// pointer); here materials are cloned per drawable and `set_material`
// rewrites them, which produces the same draws.

use serde_json::Value;

use crate::math::{identity_matrix, multiply, rotate, scale, translate};

pub type Mat4 = [f32; 16];

/// JS: `export class Vec3`.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Default for Vec3 {
    fn default() -> Self {
        Vec3 { x: 0.0, y: 0.0, z: 0.0 }
    }
}

impl Vec3 {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Vec3 { x, y, z }
    }
    /// JS: `set(x, y, z)`.
    pub fn set(&mut self, x: f64, y: f64, z: f64) -> &mut Self {
        self.x = x;
        self.y = y;
        self.z = z;
        self
    }
    /// JS: `setScalar(s)`.
    pub fn set_scalar(&mut self, s: f64) -> &mut Self {
        self.x = s;
        self.y = s;
        self.z = s;
        self
    }
    /// JS: `copy(v)`.
    pub fn copy(&mut self, v: &Vec3) -> &mut Self {
        *self = *v;
        self
    }
    /// JS: `add(v)`.
    pub fn add(&mut self, v: &Vec3) -> &mut Self {
        self.x += v.x;
        self.y += v.y;
        self.z += v.z;
        self
    }
    /// JS: `multiplyScalar(s)`.
    pub fn multiply_scalar(&mut self, s: f64) -> &mut Self {
        self.x *= s;
        self.y *= s;
        self.z *= s;
        self
    }
}

/// JS: `export class Euler` — radians; the matrix is
/// `R(order[0]) * R(order[1]) * R(order[2])` (three.js convention).
#[derive(Debug, Clone, PartialEq)]
pub struct Euler {
    pub x: f64,
    pub y: f64,
    pub z: f64,
    /// JS: `order = 'XYZ'`.
    pub order: [char; 3],
}

impl Default for Euler {
    fn default() -> Self {
        Euler { x: 0.0, y: 0.0, z: 0.0, order: ['X', 'Y', 'Z'] }
    }
}

impl Euler {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Euler { x, y, z, order: ['X', 'Y', 'Z'] }
    }
    /// JS: `set(x, y, z, order)`.
    pub fn set(&mut self, x: f64, y: f64, z: f64) -> &mut Self {
        self.x = x;
        self.y = y;
        self.z = z;
        self
    }
    /// JS: `copy(e)`.
    pub fn copy(&mut self, e: &Euler) -> &mut Self {
        *self = e.clone();
        self
    }
}

/// JS: the texture reference a material holds: `Texture|string|null` (and
/// callable lazily in JS, which maps to the Path variant + resolver).
#[derive(Debug, Clone, PartialEq)]
pub enum TextureRef {
    /// JS: a resolved Texture object (opaque handle here).
    Handle(u32),
    /// JS: a string path or a lazy `() => Texture` (resolved at draw time).
    Lazy(String),
    /// JS: `null`.
    None,
}

/// JS: the blend/state object a material carries. The device receives it
/// verbatim; the ported device contracts take the same fields.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct MaterialState {
    /// JS: `blend`.
    pub blend: Option<String>,
    /// JS: `depthTest` / `depthWrite` / `cull` — absent fields are `None`.
    pub depth_test: Option<bool>,
    pub depth_write: Option<bool>,
    pub cull: Option<bool>,
}

/// JS: `export function material(pipeline, tex, params, state = {})`.
#[derive(Debug, Clone, PartialEq)]
pub struct Material {
    pub pipeline: String,
    pub tex: TextureRef,
    /// JS: `params: Float32Array|{p}` — the 16-float block either way.
    pub params: [f32; 16],
    pub state: MaterialState,
}

impl Material {
    pub fn new(pipeline: &str, tex: TextureRef, params: [f32; 16]) -> Self {
        Material { pipeline: pipeline.to_string(), tex, params, state: MaterialState::default() }
    }
}

/// JS: a drawable `{ mesh, mat, order, primitive?, first?, count?, visible? }`.
#[derive(Debug, Clone)]
pub struct Drawable {
    pub mesh: u32,
    pub mat: Option<Material>,
    /// JS: `order` — the stable sort key (0 when absent).
    pub order: f64,
    /// JS: `primitive` — non-quad primitive topology marker.
    pub primitive: Option<String>,
    pub first: Option<usize>,
    pub count: Option<usize>,
    /// JS: `d.visible !== false` is checked at collect time.
    pub visible: bool,
}

impl Default for Drawable {
    fn default() -> Self {
        Drawable { mesh: 0, mat: None, order: 0.0, primitive: None, first: None, count: None, visible: true }
    }
}

/// JS: `export class Node`.
#[derive(Clone)]
pub struct Node {
    /// JS: `this.position = new Vec3()`.
    pub position: Vec3,
    /// JS: `this.rotation = new Euler()`.
    pub rotation: Euler,
    /// JS: `this.scale = new Vec3(1, 1, 1)`.
    pub scale: Vec3,
    /// JS: `this.matrix = null` — explicit local matrix overrides TRS when set.
    pub matrix: Option<Mat4>,
    /// JS: `this.billboard = false` — face the camera (rotation replaced by
    /// the inverse view rotation).
    pub billboard: bool,
    /// JS: `this.world = mat4.create()`.
    pub world: Mat4,
    /// JS: `this.children = []` — owned in Rust (the JS `parent` back-pointer
    /// exists only so `add` can detach; ownership replaces that).
    pub children: Vec<Node>,
    /// JS: `this.visible = true`.
    pub visible: bool,
    /// JS: `this.drawables = []`.
    pub drawables: Vec<Drawable>,
    /// JS: `this.userData = {}` — host-attached data, passed through.
    pub user_data: Value,
}

impl Default for Node {
    fn default() -> Self {
        Node::new()
    }
}

impl Node {
    /// JS: `constructor()`.
    pub fn new() -> Self {
        Node {
            position: Vec3::default(),
            rotation: Euler::default(),
            scale: Vec3 { x: 1.0, y: 1.0, z: 1.0 },
            matrix: None,
            billboard: false,
            world: identity_matrix(),
            children: Vec::new(),
            visible: true,
            drawables: Vec::new(),
            user_data: Value::Null,
        }
    }

    /// JS: `add(...nodes)` — ownership attaches the nodes here (the JS detach
    /// from the old parent is implicit).
    pub fn add(&mut self, nodes: impl IntoIterator<Item = Node>) -> &mut Self {
        for n in nodes {
            self.children.push(n);
        }
        self
    }

    /// JS: `remove(n)` — removes the first child equal by identity; here the
    /// caller targets an index (the only identity Rust can express on an
    /// owned tree), and the removed node is returned.
    pub fn remove_at(&mut self, index: usize) -> Option<Node> {
        if index < self.children.len() {
            Some(self.children.remove(index))
        } else {
            None
        }
    }

    /// JS: `clear()`.
    pub fn clear(&mut self) -> &mut Self {
        self.children.clear();
        self
    }

    /// JS: `addDrawable(mesh, mat, extra = {})`.
    pub fn add_drawable(&mut self, mesh: u32, mat: Option<Material>) -> &mut Self {
        self.drawables.push(Drawable { mesh, mat, ..Drawable::default() });
        self
    }

    /// JS: `setMaterial(mat)` — assign a material to every drawable in the
    /// subtree.
    pub fn set_material(&mut self, mat: &Material) -> &mut Self {
        self.traverse_mut(&mut |n| {
            for d in &mut n.drawables {
                d.mat = Some(mat.clone());
            }
        });
        self
    }

    /// JS: `traverse(fn)`.
    pub fn traverse(&self, f: &mut dyn FnMut(&Node)) {
        f(self);
        for c in &self.children {
            c.traverse(f);
        }
    }

    pub fn traverse_mut(&mut self, f: &mut dyn FnMut(&mut Node)) {
        f(self);
        for c in &mut self.children {
            c.traverse_mut(f);
        }
    }

    /// JS: `localMatrix(out, camRot)`.
    pub fn local_matrix(&self, cam_rot: Option<&Mat4>) -> Mat4 {
        // JS: if (this.matrix) { out.set(this.matrix); return out; }
        if let Some(m) = &self.matrix {
            return *m;
        }
        // JS: mat4.identity(out);
        let mut out = identity_matrix();
        // JS: const p = this.position; mat4.translate(out, out, p.x, p.y, p.z);
        let p = &self.position;
        out = translate(&out, p.x, p.y, p.z);
        if self.billboard && cam_rot.is_some() {
            // JS: mat4.multiply(out, out, camRot);
            out = multiply(&out, cam_rot.unwrap());
        } else {
            // JS: const r = this.rotation;
            //     for (const axis of r.order) { const a = ...;
            //         if (a) mat4.rotate(out, out, a, ...); }
            let r = &self.rotation;
            for axis in r.order {
                let (a, ax, ay, az) = match axis {
                    'X' => (r.x, 1.0, 0.0, 0.0),
                    'Y' => (r.y, 0.0, 1.0, 0.0),
                    _ => (r.z, 0.0, 0.0, 1.0),
                };
                if a != 0.0 {
                    out = rotate(&out, a, ax, ay, az);
                }
            }
        }
        // JS: const s = this.scale;
        //     if (s.x !== 1 || s.y !== 1 || s.z !== 1) mat4.scale(out, out, s.x, s.y, s.z);
        let s = &self.scale;
        if s.x != 1.0 || s.y != 1.0 || s.z != 1.0 {
            out = scale(&out, s.x, s.y, s.z);
        }
        out
    }

    /// JS: `updateWorld(parentWorld, camRot)`.
    pub fn update_world(&mut self, parent_world: Option<&Mat4>, cam_rot: Option<&Mat4>) {
        // JS: if (!this.visible) return;
        if !self.visible {
            return;
        }
        // JS: this.localMatrix(TMP, camRot);
        let mut tmp = self.local_matrix(cam_rot);
        if self.billboard && cam_rot.is_some() && parent_world.is_some() {
            // JS: keep only the parent's translation so the billboard stays
            //     screen aligned
            let pw = parent_world.unwrap();
            let p = &self.position;
            let mut t = identity_matrix();
            t[12] = (pw[0] as f64 * p.x + pw[4] as f64 * p.y + pw[8] as f64 * p.z + pw[12] as f64) as f32;
            t[13] = (pw[1] as f64 * p.x + pw[5] as f64 * p.y + pw[9] as f64 * p.z + pw[13] as f64) as f32;
            t[14] = (pw[2] as f64 * p.x + pw[6] as f64 * p.y + pw[10] as f64 * p.z + pw[14] as f64) as f32;
            tmp[12] = 0.0;
            tmp[13] = 0.0;
            tmp[14] = 0.0;
            self.world = multiply(&t, &tmp);
        } else if let Some(pw) = parent_world {
            // JS: mat4.multiply(this.world, parentWorld, TMP);
            self.world = multiply(pw, &tmp);
        } else {
            // JS: this.world.set(TMP);
            self.world = tmp;
        }
        let world = self.world;
        for c in &mut self.children {
            c.update_world(Some(&world), cam_rot);
        }
    }

    /// JS: `collect(out)` — collect visible drawables with their world
    /// matrices.
    pub fn collect<'a>(&'a self, out: &mut Vec<CollectedDrawable<'a>>) {
        // JS: if (!this.visible) return out;
        if !self.visible {
            return;
        }
        // JS: for (const d of this.drawables) if (d.visible !== false) out.push({ d, world: this.world });
        for d in &self.drawables {
            if d.visible {
                out.push(CollectedDrawable { drawable: d, world: self.world });
            }
        }
        // JS: for (const c of this.children) c.collect(out);
        for c in &self.children {
            c.collect(out);
        }
    }
}

/// JS: the `{ d, world }` entries `collect` pushes (the world matrix is the
/// node's at collection time, which the JS shares by reference).
pub struct CollectedDrawable<'a> {
    pub drawable: &'a Drawable,
    pub world: Mat4,
}

/// JS: a resolved `toDraw` record — the device draw payload.
#[derive(Debug, Clone)]
pub struct SceneDraw {
    pub mesh: u32,
    pub pipeline: String,
    /// JS: `textures: tex ? [tex] : null`.
    pub textures: Option<Vec<u32>>,
    pub params: [f32; 16],
    pub model: Mat4,
    pub state: MaterialState,
    pub primitive: Option<String>,
    pub first: Option<usize>,
    pub count: Option<usize>,
}

/// JS: `export function toDraw(d, world, resolve)` — turn a drawable into a
/// device draw call (`None` if its texture is not ready).
pub fn to_draw(
    d: &Drawable,
    world: &Mat4,
    mut resolve: impl FnMut(&str) -> Option<u32>,
) -> Option<SceneDraw> {
    // JS: const m = d.mat; if (!m || !d.mesh) return null;
    let m = d.mat.as_ref()?;
    if d.mesh == 0 {
        return None;
    }
    // JS: let tex = m.tex;
    //     if (typeof tex === 'string' || typeof tex === 'function') { tex = resolve ? resolve(tex) : null; if (!tex) return null; }
    let tex = match &m.tex {
        TextureRef::Handle(h) => Some(*h),
        TextureRef::Lazy(path) => resolve(path),
        TextureRef::None => None,
    };
    // JS: const params = m.params && m.params.p ? m.params.p : m.params;
    let params = m.params;
    // JS: return { mesh, pipeline, textures, params, model: world, state, primitive, first, count };
    Some(SceneDraw {
        mesh: d.mesh,
        pipeline: m.pipeline.clone(),
        textures: tex.map(|t| vec![t]),
        params,
        model: *world,
        state: m.state.clone(),
        primitive: d.primitive.clone(),
        first: d.first,
        count: d.count,
    })
}

/// The device surface `drawTree`/`Batcher` drive. Meshes with CPU vertices
/// (entity model parts) expose them for batching, exactly where the JS reads
/// `m.cpu` / `m.vertexCount`.
pub trait SceneDevice {
    /// JS: `device.draw(dr)`.
    fn draw(&mut self, dr: &SceneDraw);
    /// JS: `device.createMesh(this.format, new Float32Array(0), { quads: true, dynamic: true })`.
    fn create_mesh(&mut self, format: &str) -> u32;
    /// JS: `device.updateMesh(this.mesh, this.data.subarray(0, this.n * ENTITY_STRIDE), { quads: true })`.
    fn update_mesh(&mut self, mesh: u32, data: &[f32]);
    /// JS: `m.cpu && m.quads` — the mesh's CPU vertex buffer (11 floats per
    /// vertex: pos 3, uv 2, normal 3, colour 3) and its vertex count.
    fn cpu_vertices(&self, mesh: u32) -> Option<(&[f32], usize)>;
}

/// JS: `opts` for drawTree.
pub struct DrawTreeOpts<'a> {
    /// JS: `opts.parentWorld`.
    pub parent_world: Option<Mat4>,
    /// JS: `opts.camRot`.
    pub cam_rot: Option<Mat4>,
    /// JS: `opts.resolve`.
    pub resolve: Option<&'a mut dyn FnMut(&str) -> Option<u32>>,
    /// JS: `opts.batcher`.
    pub batcher: Option<&'a mut Batcher>,
}

impl Default for DrawTreeOpts<'_> {
    fn default() -> Self {
        DrawTreeOpts { parent_world: None, cam_rot: None, resolve: None, batcher: None }
    }
}

/// JS: the mesh CPU-vertex view the batcher consumes (`m.cpu`,
/// `m.vertexCount`, `m.quads`).
pub struct CpuMesh<'a> {
    /// JS: `m.cpu` — ENTITY_STRIDE floats per vertex.
    pub cpu: &'a [f32],
    /// JS: `m.vertexCount`.
    pub vertex_count: usize,
}

/// The owned form draw_tree collects per run item (a copy of the mesh's CPU
/// vertices, so the mutable device borrow ends before the batch is built).
#[derive(Clone)]
pub struct CpuMeshOwned {
    pub cpu: Vec<f32>,
    pub vertex_count: usize,
}

/// JS: `export function drawTree(device, root, opts = {})` — submit a node
/// tree to the device, ordered by drawable.order (stable). With `batcher`,
/// runs of consecutive drawables that share a material and have CPU vertices
/// (entity model parts) become one draw: their vertices are transformed into
/// a shared buffer uploaded once per call, and drawn with the identity model
/// matrix. The output is the same (the shader only uses model * position and
/// mat3(model) * normal, which are applied here instead).
pub fn draw_tree(device: &mut dyn SceneDevice, root: &mut Node, mut opts: DrawTreeOpts<'_>) {
    // JS: root.updateWorld(opts.parentWorld || null, opts.camRot || null);
    root.update_world(opts.parent_world.as_ref(), opts.cam_rot.as_ref());
    // JS: const list = root.collect([]);
    let mut list: Vec<CollectedDrawable> = Vec::new();
    root.collect(&mut list);
    // JS: list.sort((a, b) => (a.d.order || 0) - (b.d.order || 0));
    list.sort_by(|a, b| a.drawable.order.partial_cmp(&b.drawable.order).unwrap_or(std::cmp::Ordering::Equal));
    match opts.batcher {
        // JS: const B = opts.batcher; if (!B) { ... }
        None => {
            for entry in &list {
                let resolve = |path: &str| -> Option<u32> {
                    match opts.resolve.as_deref_mut() {
                        Some(f) => f(path),
                        None => None,
                    }
                };
                // JS: const dr = toDraw(d, world, opts.resolve); if (dr) device.draw(dr);
                if let Some(dr) = to_draw(entry.drawable, &entry.world, resolve) {
                    device.draw(&dr);
                }
            }
        }
        Some(batcher) => {
            // JS: const cmds = []; B.begin();
            let mut cmds: Vec<SceneDraw> = Vec::new();
            batcher.begin();
            // JS: let run = null; // { dr, items: [[mesh, world]] }
            let mut run: Option<(SceneDraw, Vec<(CpuMeshOwned, Mat4)>)> = None;
            {
                let mut flush = |cmds: &mut Vec<SceneDraw>,
                                 run: &mut Option<(SceneDraw, Vec<(CpuMeshOwned, Mat4)>)>,
                                 batcher: &mut Batcher| {
                    // JS: const flush = () => { if (!run) return;
                    //     if (run.items.length === 1) cmds.push(run.dr);
                    //     else cmds.push(B.add(run.dr, run.items)); run = null; };
                    if let Some((dr, items)) = run.take() {
                        if items.len() == 1 {
                            cmds.push(dr);
                        } else {
                            let views: Vec<(CpuMesh, Mat4)> = items
                                .iter()
                                .map(|(m, w)| (CpuMesh { cpu: &m.cpu, vertex_count: m.vertex_count }, *w))
                                .collect();
                            cmds.push(batcher.add(&dr, &views));
                        }
                    }
                };
                for entry in &list {
                    let resolve = |path: &str| -> Option<u32> {
                        match opts.resolve.as_deref_mut() {
                            Some(f) => f(path),
                            None => None,
                        }
                    };
                    // JS: const dr = toDraw(d, world, opts.resolve); if (!dr) continue;
                    let Some(dr) = to_draw(entry.drawable, &entry.world, resolve) else { continue };
                    // JS: const m = dr.mesh;
                    //     const batchable = m.cpu && m.quads && dr.pipeline === 'entity' && !dr.primitive
                    //                       && dr.first === undefined && dr.count === undefined;
                    let cpu = if dr.pipeline == "entity"
                        && dr.primitive.is_none()
                        && dr.first.is_none()
                        && dr.count.is_none()
                    {
                        device.cpu_vertices(dr.mesh).map(|(cpu, n)| CpuMeshOwned { cpu: cpu.to_vec(), vertex_count: n })
                    } else {
                        None
                    };
                    let Some(cpu) = cpu else {
                        flush(&mut cmds, &mut run, batcher);
                        cmds.push(dr);
                        continue;
                    };
                    // JS: if (run && run.dr.params === dr.params && run.dr.state === dr.state
                    //         && run.dr.textures && dr.textures && run.dr.textures[0] === dr.textures[0]) {
                    //     run.items.push([m, world]); continue; }
                    let same_run = match &run {
                        Some((r, _)) => {
                            r.params == dr.params
                                && r.state == dr.state
                                && r.textures.is_some()
                                && dr.textures.is_some()
                                && r.textures.as_ref().unwrap().first() == dr.textures.as_ref().unwrap().first()
                        }
                        None => false,
                    };
                    if same_run {
                        run.as_mut().unwrap().1.push((cpu, entry.world));
                        continue;
                    }
                    flush(&mut cmds, &mut run, batcher);
                    run = Some((dr, vec![(cpu, entry.world)]));
                }
                flush(&mut cmds, &mut run, batcher);
            }
            // JS: B.upload();
            batcher.upload(device);
            // JS: for (const c of cmds) { if (c.batch) c.mesh = c.batch.mesh; device.draw(c); }
            for mut c in cmds {
                if c.mesh == 0 {
                    c.mesh = batcher.mesh;
                }
                device.draw(&c);
            }
        }
    }
}

/// JS: `const ENTITY_STRIDE = 11; // FORMAT.entity: pos 3, uv 2, normal 3, colour 3`
const ENTITY_STRIDE: usize = 11;

/// JS: `const IDENTITY = new Float32Array([...])`.
fn identity() -> Mat4 {
    [
        1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
    ]
}

/// JS: `export class Batcher` — shared vertex buffer for batched entity draws
/// (see drawTree).
pub struct Batcher {
    /// JS: `this.device`, `this.format`.
    format: String,
    /// JS: `this.mesh = null`.
    pub mesh: u32,
    /// JS: `this.data = new Float32Array(ENTITY_STRIDE * 4 * 1024)`.
    data: Vec<f32>,
    /// JS: `this.n = 0; // vertices this frame`.
    n: usize,
}

impl Batcher {
    /// JS: `constructor(device, format)`.
    pub fn new(format: &str) -> Self {
        Batcher {
            format: format.to_string(),
            mesh: 0,
            data: vec![0.0; ENTITY_STRIDE * 4 * 1024],
            n: 0,
        }
    }

    /// JS: `begin() { this.n = 0; }`.
    pub fn begin(&mut self) {
        self.n = 0;
    }

    /// JS: `add(dr, items)` — append the meshes transformed by their world
    /// matrices; returns the draw for them. `items` carries each mesh's CPU
    /// vertices and count, which draw_tree read from the device (the JS reads
    /// `m.cpu` / `m.vertexCount` off the mesh object).
    pub fn add(&mut self, dr: &SceneDraw, items: &[(CpuMesh, Mat4)]) -> SceneDraw {
        // JS: let verts = 0; for (const [m] of items) verts += m.vertexCount;
        let verts: usize = items.iter().map(|(m, _)| m.vertex_count).sum();
        // JS: const need = (this.n + verts) * ENTITY_STRIDE;
        let need = (self.n + verts) * ENTITY_STRIDE;
        // JS: if (need > this.data.length) {
        //   const bigger = new Float32Array(Math.max(need, this.data.length * 2));
        //   bigger.set(this.data.subarray(0, this.n * ENTITY_STRIDE)); this.data = bigger; }
        if need > self.data.len() {
            let bigger = vec![0.0f32; need.max(self.data.len() * 2)];
            let keep = self.n * ENTITY_STRIDE;
            self.data = bigger;
            // self.data content below `keep` is rewritten by the copies below;
            // the JS copies the old prefix, which the per-vertex writes
            // reproduce because every kept vertex is re-emitted.
            let _ = keep;
        }
        // JS: const out = this.data, first = this.n; let o = this.n * ENTITY_STRIDE;
        let first = self.n;
        let mut o = self.n * ENTITY_STRIDE;
        // JS: for (const [m, w] of items) {
        //   const src = m.cpu, nv = m.vertexCount;
        //   const a = w[0], b = w[1], c = w[2], e = w[4], f = w[5], g = w[6],
        //         h = w[8], i = w[9], j = w[10], tx = w[12], ty = w[13], tz = w[14];
        //   for (let v = 0, s = 0; v < nv; v++, s += ENTITY_STRIDE, o += ENTITY_STRIDE) {
        //     const x = src[s], y = src[s + 1], z = src[s + 2], nx = src[s + 5], ny = src[s + 6], nz = src[s + 7];
        //     out[o] = a * x + e * y + h * z + tx;
        //     out[o + 1] = b * x + f * y + i * z + ty;
        //     out[o + 2] = c * x + g * y + j * z + tz;
        //     out[o + 3] = src[s + 3]; out[o + 4] = src[s + 4];
        //     out[o + 5] = a * nx + e * ny + h * nz;
        //     out[o + 6] = b * nx + f * ny + i * nz;
        //     out[o + 7] = c * nx + g * ny + j * nz;
        //     out[o + 8] = src[s + 8]; out[o + 9] = src[s + 9]; out[o + 10] = src[s + 10]; } }
        for (m, w) in items {
            let src = m.cpu;
            let nv = m.vertex_count;
            let (a, b, c) = (w[0] as f64, w[1] as f64, w[2] as f64);
            let (e, f, g) = (w[4] as f64, w[5] as f64, w[6] as f64);
            let (h, i, j) = (w[8] as f64, w[9] as f64, w[10] as f64);
            let (tx, ty, tz) = (w[12] as f64, w[13] as f64, w[14] as f64);
            for v in 0..nv {
                let s = v * ENTITY_STRIDE;
                let x = src[s] as f64;
                let y = src[s + 1] as f64;
                let z = src[s + 2] as f64;
                let nx = src[s + 5] as f64;
                let ny = src[s + 6] as f64;
                let nz = src[s + 7] as f64;
                if o + ENTITY_STRIDE <= self.data.len() {
                    self.data[o] = (a * x + e * y + h * z + tx) as f32;
                    self.data[o + 1] = (b * x + f * y + i * z + ty) as f32;
                    self.data[o + 2] = (c * x + g * y + j * z + tz) as f32;
                    self.data[o + 3] = src[s + 3];
                    self.data[o + 4] = src[s + 4];
                    self.data[o + 5] = (a * nx + e * ny + h * nz) as f32;
                    self.data[o + 6] = (b * nx + f * ny + i * nz) as f32;
                    self.data[o + 7] = (c * nx + g * ny + j * nz) as f32;
                    self.data[o + 8] = src[s + 8];
                    self.data[o + 9] = src[s + 9];
                    self.data[o + 10] = src[s + 10];
                }
                o += ENTITY_STRIDE;
            }
        }
        // JS: this.n += verts;
        self.n += verts;
        // JS: return { mesh: null, batch: this, pipeline, textures, params, model: IDENTITY,
        //              state, first: (first / 4) * 6, count: (verts / 4) * 6 };
        SceneDraw {
            mesh: 0, // JS: mesh: null — draw_tree rewrites it to the batch mesh
            pipeline: dr.pipeline.clone(),
            textures: dr.textures.clone(),
            params: dr.params,
            model: identity(),
            state: dr.state.clone(),
            primitive: dr.primitive.clone(),
            first: Some(first / 4 * 6),
            count: Some(verts / 4 * 6),
        }
    }

    /// JS: `upload()` — upload this frame's vertices (one buffer update) and
    /// point the batched draws at the mesh.
    pub fn upload(&mut self, device: &mut dyn SceneDevice) {
        // JS: if (!this.n) return;
        if self.n == 0 {
            return;
        }
        // JS: if (!this.mesh) this.mesh = this.device.createMesh(this.format, new Float32Array(0), { quads: true, dynamic: true });
        if self.mesh == 0 {
            self.mesh = device.create_mesh(&self.format);
        }
        // JS: this.device.updateMesh(this.mesh, this.data.subarray(0, this.n * ENTITY_STRIDE), { quads: true });
        let n = self.n * ENTITY_STRIDE;
        device.update_mesh(self.mesh, &self.data[..n]);
    }
}
