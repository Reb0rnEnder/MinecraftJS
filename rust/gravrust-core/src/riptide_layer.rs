// Port of `client/js/render/riptide-layer.js`.
//
// LayerRiptide: the jar's 64x64 ModelBox, with three counter-rotating scaled
// shells.
//
// The JS reaches `Node` (gfx/scene.js — ported as `crate::scene`),
// `Part`/`entityMaterial` (render/boxmodel.js). `entityMaterial` and the
// `EntityParams` block live in `client/js/render/boxmodel.js` /
// `client/js/gfx/device.js`; both are ported here as helpers with the exact
// field layout until those modules graduate as wholes. Mesh creation
// (`boxesMesh` -> device) is browser-bound and goes through the
// [`RiptideDevice`] contract.

use crate::scene::{Material, MaterialState, Node, TextureRef};

/// JS: `const D2R` from gfx/math.js — degrees to radians.
const D2R: f64 = std::f64::consts::PI / 180.0;

/// JS: `class EntityParams` from gfx/device.js — the 16-float entity param
/// block: tint 0-3, overlay 4-7, light 8-9, flags 10-11, alphaTest 12,
/// uvTransform 13-15.
pub fn entity_params() -> [f32; 16] {
    let mut p = [0.0f32; 16];
    // JS: this.setTint(1, 1, 1, 1); this.setLight(15, 15); this.p[12] = 0.1;
    p[0] = 1.0;
    p[1] = 1.0;
    p[2] = 1.0;
    p[3] = 1.0;
    p[8] = 15.0;
    p[9] = 15.0;
    p[12] = 0.1;
    p
}

/// JS: `export function entityMaterial(tex, opts = {})` from
/// client/js/render/boxmodel.js — pipeline 'entity', EntityParams, the
/// transparent/additive blend switch and the depthWrite/cull state.
pub fn entity_material(tex: &str, cull: bool, transparent: bool, additive: bool, alpha_test: Option<f32>) -> Material {
    // JS: const params = new EntityParams();
    //     params.setAlphaTest(opts.alphaTest !== undefined ? opts.alphaTest : 0.1);
    let mut params = entity_params();
    params[12] = alpha_test.unwrap_or(0.1);
    // JS: const state = { blend: opts.transparent ? (opts.additive ? 'add' : 'alpha') : 'none',
    //                     depthWrite: opts.depthWrite !== false, cull: !!opts.cull };
    let state = MaterialState {
        blend: Some(if transparent {
            if additive { "add".to_string() } else { "alpha".to_string() }
        } else {
            "none".to_string()
        }),
        depth_write: Some(true),
        cull: Some(cull),
        depth_test: None,
    };
    // JS: const m = material('entity', tex, params, state); m.order = opts.transparent ? 2 : 0;
    // (order is carried by the drawable in the Rust port; the shell drawables
    // default to 0, matching the non-transparent case used here.)
    Material::new("entity", TextureRef::Lazy(tex.to_string()), params)
        .with_state(state)
}

impl Material {
    /// JS: the material object's mutable `state` field.
    fn with_state(mut self, state: MaterialState) -> Self {
        self.state = state;
        self
    }
}

/// The entity surface `updateRiptide` reads.
pub trait RiptideEntity {
    /// JS: `e.kind !== 'player'`.
    fn kind(&self) -> &str;
    /// JS: `e.riptide`.
    fn riptide(&self) -> bool;
    /// JS: `(e.ticks || 0)`.
    fn ticks(&self) -> i64;
}

/// The view surface the layer builds on (the JS mutates `v.*` directly): the
/// model group the layer attaches to, the material list, and the shell nodes.
pub trait RiptideView {
    /// JS: `v.riptideLayer` — the layer root, when it exists.
    fn riptide_layer(&mut self) -> Option<&mut Node>;
    /// JS: `v.riptideLayer = root` — create and install the layer root.
    fn set_riptide_layer(&mut self, root: Node);
    /// JS: `v.modelGroup.add(root)`.
    fn model_group_add(&mut self, root: &mut Node);
    /// JS: `v.materials.push(mat)`.
    fn push_material(&mut self, mat: Material);
    /// JS: `v.riptideShells` — the three shell nodes, when built.
    fn shells(&mut self) -> Option<&mut Vec<Node>>;
    fn set_shells(&mut self, shells: Vec<Node>);
}

/// JS: the device path `boxesMesh(...)` -> `entityMesh(...)`:
/// `device.createMesh(FORMAT.entity, v, opts)`.
pub trait RiptideDevice {
    /// JS: `const m = device.createMesh(FORMAT.entity, v, opts); m.cpu = v;`
    /// — `v` is the interleaved FORMAT.entity vertex buffer (11 floats per
    /// vertex: pos 3, uv 2, normal 3, colour 3).
    fn create_entity_mesh(&mut self, vertices: &[f32]) -> u32;
}

/// JS: `export function entityVertices(pos, uv, nor, col)` from
/// client/js/render/boxmodel.js — interleave flat arrays into FORMAT.entity
/// vertices (`col` null -> white).
pub fn entity_vertices(pos: &[f32], uv: &[f32], nor: &[f32], col: Option<&[f32]>) -> Vec<f32> {
    // JS: const n = pos.length / 3; const out = new Float32Array(n * 11);
    let n = pos.len() / 3;
    let mut out = vec![0.0f32; n * 11];
    for i in 0..n {
        let o = i * 11;
        // JS: out[o] = pos[i*3]; out[o+1] = pos[i*3+1]; out[o+2] = pos[i*3+2];
        out[o] = pos[i * 3];
        out[o + 1] = pos[i * 3 + 1];
        out[o + 2] = pos[i * 3 + 2];
        // JS: out[o + 3] = uv[i * 2]; out[o + 4] = uv[i * 2 + 1];
        out[o + 3] = uv[i * 2];
        out[o + 4] = uv[i * 2 + 1];
        // JS: out[o + 5] = nor[i * 3]; out[o + 6] = nor[i * 3 + 1]; out[o + 7] = nor[i * 3 + 2];
        out[o + 5] = nor[i * 3];
        out[o + 6] = nor[i * 3 + 1];
        out[o + 7] = nor[i * 3 + 2];
        // JS: if (col) { out[o + 8..10] = col[...]; } else { 1, 1, 1 }
        match col {
            Some(c) => {
                out[o + 8] = c[i * 3];
                out[o + 9] = c[i * 3 + 1];
                out[o + 10] = c[i * 3 + 2];
            }
            None => {
                out[o + 8] = 1.0;
                out[o + 9] = 1.0;
                out[o + 10] = 1.0;
            }
        }
    }
    out
}

/// JS: the `Part(64,64).box(-8,-16,-8,16,32,16)` shell geometry, baked
/// through `bake_boxes` (the ported boxmodel geometry) and interleaved.
fn shell_vertices() -> Vec<f32> {
    // JS: new Part(64, 64) with default u=v=0 and one box element.
    let mut part = crate::boxmodel::BoxPart::new(64.0, 64.0);
    // JS: part.box(-8, -16, -8, 16, 32, 16) — inflate 0, mirror false.
    part.box_elem(-8.0, -16.0, -8.0, 16.0, 32.0, 16.0, 0.0, Some(false));
    // JS: boxesMesh -> addBox per box -> entityVertices(pos, uv, nor, null).
    let boxes = part.boxes.clone();
    let verts = crate::boxmodel::bake_boxes(&boxes, 64.0, 64.0);
    // bake_boxes already emits the interleaved 11-float entity layout.
    verts
}

/// JS: `export function updateRiptide(e,v,partial)`.
pub fn update_riptide(
    e: &dyn RiptideEntity,
    v: &mut dyn RiptideView,
    device: &mut dyn RiptideDevice,
    partial: f64,
) {
    // JS: if(e.kind!=='player')return;
    if e.kind() != "player" {
        return;
    }
    // JS: if(!e.riptide){if(v.riptideLayer)v.riptideLayer.visible=false;return;}
    if !e.riptide() {
        if let Some(layer) = v.riptide_layer() {
            layer.visible = false;
        }
        return;
    }
    // JS: if(!v.riptideLayer) {
    //   const root=v.riptideLayer=new Node();v.modelGroup.add(root);v.riptideShells=[];
    //   const mat=entityMaterial('entity/trident_riptide.png',{cull:false});v.materials.push(mat);
    //   for(let i=0;i<3;i++) {
    //     const shell=new Node(),part=new Part(64,64).box(-8,-16,-8,16,32,16);
    //     shell.add(part.build());part.setMaterial(mat);root.add(shell);v.riptideShells.push(shell);
    //   }
    // }
    if v.riptide_layer().is_none() {
        let mut root = Node::new();
        let mat = entity_material("entity/trident_riptide.png", true, false, false, None);
        v.push_material(mat.clone());
        let mut shells: Vec<Node> = Vec::new();
        for _ in 0..3 {
            // JS: const shell=new Node(), part=new Part(64,64).box(-8,-16,-8,16,32,16);
            //     shell.add(part.build()); part.setMaterial(mat); root.add(shell);
            let mut shell = Node::new();
            let verts = shell_vertices();
            let mesh = device.create_entity_mesh(&verts);
            shell.add_drawable(mesh, Some(mat.clone()));
            shells.push(shell);
        }
        // Root takes ownership of the shells (JS: root.add(shell)).
        for shell in shells.iter_mut() {
            let cloned = shell.clone();
            root.add(std::iter::once(cloned));
        }
        v.set_shells(shells);
        v.model_group_add(&mut root);
        v.set_riptide_layer(root);
    }
    // JS: v.riptideLayer.visible=true;
    if let Some(layer) = v.riptide_layer() {
        layer.visible = true;
    }
    // JS: v.riptideShells.forEach((s,i)=>{const f=0.75*i;
    //     s.scale.setScalar(f);s.position.set(0,f*(-0.2+0.6*i)*16,0);
    //     s.rotation.y=((e.ticks||0)+partial)*-(45+i*5)*D2R;});
    if let Some(shells) = v.shells() {
        for (i, s) in shells.iter_mut().enumerate() {
            let f = 0.75 * i as f64;
            s.scale.set_scalar(f);
            s.position.set(0.0, f * (-0.2 + 0.6 * i as f64) * 16.0, 0.0);
            s.rotation.y = (e.ticks() as f64 + partial) * -((45 + i as i64 * 5) as f64) * D2R;
        }
    }
}
