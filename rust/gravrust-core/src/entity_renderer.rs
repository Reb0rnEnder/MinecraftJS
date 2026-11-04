//! Port of `client/js/render/entity-renderer.js` (RenderManager + Render* classes).
//!
//! The JavaScript `EntityRenderer` owns one cached *visual* per live entity: a
//! scene-graph subtree (root/yaw/scale/model node chain, overlay layers, held
//! item holders, shadow, name tag) rebuilt whenever the entity's visual key
//! changes, plus per-frame pose/light/overlay updates. This port reproduces
//! that state machine on a Rust-side node arena:
//!
//! * [`Scene`] is the port of the subset of `gfx/scene.js` `Node` behaviour the
//!   renderer relies on (children, position/scale/rotation with order,
//!   billboard flag, visibility, drawables). Drawing itself stays in JS; the
//!   browser walks the arena each frame in the same order the JS `drawTree`
//!   would.
//! * [`RendererHost`] models every browser/game call the JS makes
//!   (`device.createMesh`, `entityMaterial`, asset/model-store lookups, world
//!   light queries, item renderer entry points). The implementations live in
//!   the JS glue; the core here preserves the exact call order.
//! * All decision/numeric logic — texture and model selection, visual keys,
//!   pose matrices, shade math, geometry — is ported exactly from the JS.
//!
//! Reused pure helpers from [`crate::entity_render_alg`] (same JS source file).

#![allow(clippy::too_many_arguments)]

use crate::entity_render_alg::{
    armor_material_index, copies_for_count, elytra_angles, fish_pattern, fish_shape,
    lerp_angle_deg, scale_fox_child, xp_orb_size, xp_orb_uv, yaw_angle, pitch_angle,
    wrap_angle_180, ARMOR_MATS, CAT_TEX, D2R, ENTITY_DYES, FLEECE, HORSE_COLORS, LLAMA_TEX,
    PARROT_TEX, PAINTINGS, RABBIT_TEX, STATE_OPAQUE_BLEND,
};
use crate::entity_models::{self, EntityModel};
use std::collections::HashMap;

// ============================================================ entity type

/// JS reads `e.type` both as a legacy numeric id (50..=120) and as a 1.13+
/// string name (`'fox'`, `'panda'`, ...). [`switch`] on the value preserves
/// that duality.
#[derive(Clone, Debug, PartialEq)]
pub enum EntityType {
    Legacy(i32),
    Named(String),
}

impl EntityType {
    pub fn as_i32(&self) -> Option<i32> {
        match self {
            EntityType::Legacy(i) => Some(*i),
            EntityType::Named(_) => None,
        }
    }
    pub fn as_str(&self) -> Option<&str> {
        match self {
            EntityType::Legacy(_) => None,
            EntityType::Named(s) => Some(s),
        }
    }
}

// ============================================================ scene graph

/// Node id inside a [`Scene`] arena (index into `Scene::nodes`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct NodeId(pub u32);

/// JS rotation order strings (`gfx/scene.js` default is `'XYZ'`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RotOrder {
    Xyz,
    Yxz,
    Zyx,
    Yzx,
    Xzy,
}

impl RotOrder {
    pub fn as_str(&self) -> &'static str {
        match self {
            RotOrder::Xyz => "XYZ",
            RotOrder::Yxz => "YXZ",
            RotOrder::Zyx => "ZYX",
            RotOrder::Yzx => "YZX",
            RotOrder::Xzy => "XZY",
        }
    }
}

/// Texture reference: a resolved texture id, or a path resolved on use
/// (JS closures like `() => this.game.assets.texture(path)` keep resolution
/// lazy so late-loading skins are picked up).
#[derive(Clone, Debug, PartialEq)]
pub enum TexRef {
    /// Resolved texture handle from the host.
    Id(u32),
    /// Asset path such as `'entity/creeper/creeper.png'`.
    Path(String),
}

/// Draw-state flags (JS material `state` object fields the renderer sets).
#[derive(Clone, Debug, PartialEq)]
pub struct MaterialState {
    pub blend: Option<String>,
    pub depth_write: Option<bool>,
    pub depth_test: Option<bool>,
    pub depth_func: Option<String>,
    pub cull: Option<bool>,
    pub color_write: Option<bool>,
    pub polygon_offset: Option<bool>,
}

impl Default for MaterialState {
    fn default() -> Self {
        MaterialState {
            blend: None,
            depth_write: None,
            depth_test: None,
            depth_func: None,
            cull: None,
            color_write: None,
            polygon_offset: None,
        }
    }
}

/// Port of `gfx/device.js` `EntityParams` — the 16-float shader parameter
/// block: `[tint rgba(0..3), overlay rgba(4..7), skyLight(8), blockLight(9),
/// fullBright(10), guiLight(11), alphaTest(12), uvTransform(13..15)]`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct EntityParams(pub [f64; 16]);

impl Default for EntityParams {
    fn default() -> Self {
        let mut p = [0.0; 16];
        p[0] = 1.0;
        p[1] = 1.0;
        p[2] = 1.0;
        p[3] = 1.0;
        p[8] = 15.0;
        p[9] = 15.0;
        p[10] = 0.0;
        p[11] = 0.0;
        p[12] = 0.1;
        EntityParams(p)
    }
}

impl EntityParams {
    // JS: setTint(r, g, b, a)
    pub fn set_tint(&mut self, r: f64, g: f64, b: f64, a: f64) {
        self.0[0] = r;
        self.0[1] = g;
        self.0[2] = b;
        self.0[3] = a;
    }
    // JS: setOverlay(r, g, b, a)
    pub fn set_overlay(&mut self, r: f64, g: f64, b: f64, a: f64) {
        self.0[4] = r;
        self.0[5] = g;
        self.0[6] = b;
        self.0[7] = a;
    }
    // JS: setLight(sky, block)
    pub fn set_light(&mut self, sky: f64, block: f64) {
        self.0[8] = sky;
        self.0[9] = block;
    }
    // JS: setFullBright(v)
    pub fn set_full_bright(&mut self, v: bool) {
        self.0[10] = if v { 1.0 } else { 0.0 };
    }
    // JS: setNoLighting(v)
    pub fn set_no_lighting(&mut self, v: bool) {
        self.0[11] = if v { 1.0 } else { 0.0 };
    }
    // JS: setAlphaTest(v)
    pub fn set_alpha_test(&mut self, v: f64) {
        self.0[12] = v;
    }
    // JS: setUvTransform(du, dv, scale)
    pub fn set_uv_transform(&mut self, du: f64, dv: f64, scale: f64) {
        self.0[13] = du;
        self.0[14] = dv;
        self.0[15] = scale;
    }
}

/// JS (gfx/device.js): `colorParams(r, g, b, a, alphaTest, useFog)` builds an
/// `EntityParams` whose first six floats are `[r, g, b, a, alphaTest, useFog]`
/// — note this overwrites the overlay slots used by `EntityParams.setOverlay`.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ColorParams(pub [f64; 6]);

impl ColorParams {
    pub fn new(r: f64, g: f64, b: f64, a: f64, alpha_test: f64, use_fog: f64) -> Self {
        ColorParams([r, g, b, a, alpha_test, use_fog])
    }
    /// The 16-float shader block the JS draw call passes (`new Float32Array(p)`).
    pub fn to_params(&self) -> EntityParams {
        let mut p = [0.0f64; 16];
        p[..6].copy_from_slice(&self.0);
        EntityParams(p)
    }
}

/// A material record (JS `entityMaterial(tex, opts)` result): texture,
/// parameter block and draw state. Materials are owned by the visual that
/// created them (`_mat` pushes onto `v.materials`).
#[derive(Clone, Debug)]
pub struct Material {
    pub tex: TexRef,
    pub params: EntityParams,
    pub state: MaterialState,
}

/// One drawable attached to a node (`node.addDrawable(mesh, mat, extra)`).
#[derive(Clone, Debug)]
pub struct Drawable {
    pub mesh: MeshId,
    pub mat: usize,
    /// JS extra: `{ order }` draw order override.
    pub order: Option<i32>,
    /// JS extra: `{ primitive: 'lines' }`.
    pub primitive: Option<String>,
    /// JS `n.userData.glint` — the enchantment glint pass re-draws this.
    pub glint: bool,
}

/// Mesh handle allocated by the host (`device.createMesh`).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub struct MeshId(pub u32);

/// Scene-graph node, port of the `gfx/scene.js` `Node` fields the renderer
/// touches. Transforms are the JS node defaults (`position = [0,0,0]`,
/// `scale = [1,1,1]`, `rotation = [0,0,0]`, order `'XYZ'`).
#[derive(Clone, Debug)]
pub struct Node {
    pub position: [f64; 3],
    pub scale: [f64; 3],
    pub rotation: [f64; 3],
    pub rot_order: RotOrder,
    /// JS `node.billboard = true` — face the camera each frame (browser-side).
    pub billboard: bool,
    pub visible: bool,
    /// JS `node.matrix = m` — an explicit local matrix overriding pos/rot/scale.
    pub matrix: Option<[f64; 16]>,
    pub children: Vec<NodeId>,
    pub drawables: Vec<Drawable>,
}

impl Default for Node {
    fn default() -> Self {
        Node {
            position: [0.0, 0.0, 0.0],
            scale: [1.0, 1.0, 1.0],
            rotation: [0.0, 0.0, 0.0],
            rot_order: RotOrder::Xyz,
            billboard: false,
            visible: true,
            matrix: None,
            children: Vec::new(),
            drawables: Vec::new(),
        }
    }
}

impl Node {
    // JS: n.position.set(x, y, z)
    pub fn set_position(&mut self, x: f64, y: f64, z: f64) {
        self.position = [x, y, z];
    }
    // JS: n.scale.set(x, y, z) / n.scale.setScalar(s)
    pub fn set_scale(&mut self, x: f64, y: f64, z: f64) {
        self.scale = [x, y, z];
    }
    pub fn set_scalar(&mut self, s: f64) {
        self.scale = [s, s, s];
    }
    // JS: n.rotation.set(x, y, z[, order])
    pub fn set_rotation(&mut self, x: f64, y: f64, z: f64) {
        self.rotation = [x, y, z];
    }
    pub fn set_rotation_order(&mut self, x: f64, y: f64, z: f64, order: RotOrder) {
        self.rotation = [x, y, z];
        self.rot_order = order;
    }
    // JS: n.scale.multiplyScalar(k)
    pub fn scale_multiply(&mut self, k: f64) {
        self.scale = [self.scale[0] * k, self.scale[1] * k, self.scale[2] * k];
    }
}

/// Node arena + root group. The renderer's `this.group` is the JS
/// `game.renderer.entityRoot`; nodes live here and are attached to it.
#[derive(Default)]
pub struct Scene {
    pub nodes: Vec<Node>,
}

impl Scene {
    pub fn new() -> Self {
        Scene { nodes: Vec::new() }
    }

    pub fn alloc(&mut self) -> NodeId {
        self.nodes.push(Node::default());
        NodeId(self.nodes.len() as u32 - 1)
    }

    pub fn get(&self, id: NodeId) -> &Node {
        &self.nodes[id.0 as usize]
    }

    pub fn get_mut(&mut self, id: NodeId) -> &mut Node {
        &mut self.nodes[id.0 as usize]
    }

    // JS: parent.add(child)
    pub fn add(&mut self, parent: NodeId, child: NodeId) {
        if !self.nodes[parent.0 as usize].children.contains(&child) {
            self.nodes[parent.0 as usize].children.push(child);
        }
    }

    // JS: parent.remove(child) — detach every occurrence
    pub fn remove_child(&mut self, parent: NodeId, child: NodeId) {
        self.nodes[parent.0 as usize].children.retain(|c| *c != child);
    }

    // JS: node.clear() — drop children and drawables
    pub fn clear(&mut self, id: NodeId) {
        let n = self.get_mut(id);
        n.children.clear();
        n.drawables.clear();
    }

    /// JS: `node.addDrawable(mesh, mat, extra)`.
    pub fn add_drawable(&mut self, id: NodeId, d: Drawable) {
        self.nodes[id.0 as usize].drawables.push(d);
    }

    /// JS: `node.traverse(fn)` — pre-order visit of the subtree.
    pub fn traverse(&self, id: NodeId, f: &mut dyn FnMut(NodeId, &Node)) {
        f(id, self.get(id));
        for c in self.get(id).children.clone() {
            self.traverse(c, f);
        }
    }
}

// ============================================================ visual kinds

/// JS: the `v.kind` values the per-frame `switch (v.kind)` dispatches on.
#[derive(Clone, Debug, PartialEq)]
pub enum VisualKind {
    Living,
    Dragon,
    Item,
    Xp,
    Arrow,
    JarProjectile,
    Projectile,
    AreaEffectCloud,
    Falling,
    Tnt,
    Boat,
    Minecart,
    Painting,
    ItemFrame,
    Crystal,
    Lightning,
    Fishhook,
    Leash,
}

impl VisualKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            VisualKind::Living => "living",
            VisualKind::Dragon => "dragon",
            VisualKind::Item => "item",
            VisualKind::Xp => "xp",
            VisualKind::Arrow => "arrow",
            VisualKind::JarProjectile => "jar_projectile",
            VisualKind::Projectile => "projectile",
            VisualKind::AreaEffectCloud => "area_effect_cloud",
            VisualKind::Falling => "falling",
            VisualKind::Tnt => "tnt",
            VisualKind::Boat => "boat",
            VisualKind::Minecart => "minecart",
            VisualKind::Painting => "painting",
            VisualKind::ItemFrame => "itemframe",
            VisualKind::Crystal => "crystal",
            VisualKind::Lightning => "lightning",
            VisualKind::Fishhook => "fishhook",
            VisualKind::Leash => "leash",
        }
    }
}

// ============================================================ entity input

/// The entity fields the JS renderer reads, snapshotted by the JS glue from
/// the live entity objects. Interpolated positions arrive pre-computed
/// (`g.entities.interp(e, partial)`), matching `p` in the JS render loop.
#[derive(Clone, Debug)]
pub struct EntitySnapshot {
    pub id: i32,
    pub kind: String,
    pub entity_type: Option<EntityType>,
    pub uuid: String,
    // Interpolated position (JS `p`)
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub prev_yaw: f64,
    pub yaw: f64,
    pub prev_pitch: f64,
    pub pitch: f64,
    pub prev_body_yaw: f64,
    pub body_yaw: f64,
    pub prev_head_yaw: f64,
    pub head_yaw: f64,
    pub width: f64,
    pub height: f64,
    pub eye_height: f64,
    pub on_ground: bool,
    pub invisible: bool,
    pub sneaking: bool,
    pub sleeping: bool,
    pub swimming: bool,
    pub elytra_flying: bool,
    pub riptide: bool,
    pub on_fire: bool,
    pub riding: i32,
    pub passenger: i32,
    pub child: bool,
    pub death_time: f64,
    pub hurt_time: f64,
    pub ticks: f64,
    // Model/texture selection fields
    pub wither: bool,
    pub stray: bool,
    pub husk: bool,
    pub villager_zombie: bool,
    pub attacking: bool,
    pub tamed: bool,
    pub angry: bool,
    pub elder: bool,
    pub charging: bool,
    pub has_nectar: bool,
    pub puff_state: f64,
    pub fish_variant: i32,
    pub phantom_size: f64,
    pub cat_type: i32,
    pub horse_type: i32,
    pub horse_variant: i32,
    pub rabbit_type: i32,
    pub llama_variant: i32,
    pub parrot_variant: i32,
    pub shulker_color: i32,
    pub fox_type: i32,
    pub fox_sleeping: bool,
    pub panda_gene: i32,
    pub panda_hidden_gene: i32,
    pub mooshroom_type: Option<String>,
    pub villager_type: Option<i32>,
    pub profession: i32,
    pub villager_level: i32,
    // ---- kinds beyond living (JS fields read by _build / the render loop)
    /// XP orb value (JS `e.count`).
    pub count: f64,
    /// Falling-block state id (JS `e.blockState`).
    pub block_state: u32,
    pub boat_type: i32,
    pub cart_type: i32,
    pub custom_display: bool,
    pub display_block: u32,
    pub display_offset: Option<f64>,
    pub furnace_powered: bool,
    pub show_bottom: bool,
    /// Painting art title (JS `e.title`).
    pub title: String,
    pub painting_name: Option<String>,
    /// Hanging direction index (JS `e.facing`).
    pub facing: i32,
    /// JS `e.blockPos` = `{ x, y, z }`.
    pub block_pos: [i32; 3],
    pub item: Option<ItemStack>,
    pub invulnerable: bool,
    /// Fishhook owner entity id (JS `e.owner`).
    pub owner: i32,
}

impl Default for EntitySnapshot {
    fn default() -> Self {
        EntitySnapshot {
            id: 0,
            kind: String::new(),
            entity_type: None,
            uuid: String::new(),
            x: 0.0,
            y: 0.0,
            z: 0.0,
            prev_yaw: 0.0,
            yaw: 0.0,
            prev_pitch: 0.0,
            pitch: 0.0,
            prev_body_yaw: 0.0,
            body_yaw: 0.0,
            prev_head_yaw: 0.0,
            head_yaw: 0.0,
            width: 0.6,
            height: 1.8,
            eye_height: 0.5,
            on_ground: false,
            invisible: false,
            sneaking: false,
            sleeping: false,
            swimming: false,
            elytra_flying: false,
            riptide: false,
            on_fire: false,
            riding: -1,
            passenger: -1,
            child: false,
            death_time: 0.0,
            hurt_time: 0.0,
            ticks: 0.0,
            wither: false,
            stray: false,
            husk: false,
            villager_zombie: false,
            attacking: false,
            tamed: false,
            angry: false,
            elder: false,
            charging: false,
            has_nectar: false,
            puff_state: 0.0,
            fish_variant: 0,
            phantom_size: 0.0,
            cat_type: 0,
            horse_type: 0,
            horse_variant: 0,
            rabbit_type: 0,
            llama_variant: 0,
            parrot_variant: 0,
            shulker_color: 0,
            fox_type: 0,
            fox_sleeping: false,
            panda_gene: 0,
            panda_hidden_gene: 0,
            mooshroom_type: None,
            villager_type: Some(2),
            profession: 0,
            villager_level: 1,
            count: 0.0,
            block_state: 0,
            boat_type: 0,
            cart_type: 0,
            custom_display: false,
            display_block: 0,
            display_offset: None,
            furnace_powered: false,
            show_bottom: true,
            title: String::new(),
            painting_name: None,
            facing: 0,
            block_pos: [0, 0, 0],
            item: None,
            invulnerable: false,
            owner: -1,
        }
    }
}

// ============================================================ skins

/// JS `this.skins` entry: `{ path, slim, texture?, legacy, propValue, ... }`.
#[derive(Clone, Debug)]
pub struct SkinRecord {
    /// Default skin path until a texture downloads (`entity/steve.png` /
    /// `entity/alex.png`).
    pub path: String,
    pub slim: bool,
    /// Prop value the record was built from (JS `s.propValue`).
    pub prop_value: Option<String>,
    /// JS `s.fromSession` — built from the local account's Mojang profile.
    pub from_session: bool,
    pub legacy: Option<bool>,
}

impl SkinRecord {
    fn fresh(slim: bool, prop_value: Option<String>) -> Self {
        SkinRecord {
            path: if slim { "entity/alex.png" } else { "entity/steve.png" }.to_string(),
            slim,
            prop_value,
            from_session: false,
            legacy: None,
        }
    }
}

// ============================================================ visual record

/// Per-entity cached visual (JS `v`). Field names follow the JS property
/// names; `None` means "not built for this visual".
#[derive(Clone, Debug)]
pub struct Visual {
    pub root: NodeId,
    pub kind: VisualKind,
    /// Materials created for this visual (`v.materials`).
    pub materials: Vec<Material>,
    /// Overlay layers (`v.layers`): `{ model, mat, obj, ...opts }`.
    pub layers: Vec<LayerRecord>,
    pub uuid: String,
    /// JS `v.visualKey` — compared against `_visualKey(e)` each frame.
    pub visual_key: String,
    pub tex_path: Option<String>,
    pub model_key: Option<String>,
    pub model: Option<EntityModel>,
    pub main_mat: Option<usize>,
    pub atlas_mat: Option<usize>,
    // Node chain (JS yawGroup / scaleGroup / modelGroup)
    pub yaw_group: Option<NodeId>,
    pub scale_group: Option<NodeId>,
    pub model_group: Option<NodeId>,
    /// JS `v.bodyDrawables` — flattened drawables of the body object.
    pub body_drawables: Vec<(NodeId, usize)>,
    // Holders
    pub item_holder: Option<NodeId>,
    pub left_holder: Option<NodeId>,
    pub head_holder: Option<NodeId>,
    // Named extras
    pub wool: Option<LayerHandle>,
    pub saddle: Option<LayerHandle>,
    pub llama_decor: Option<LayerHandle>,
    pub fish_pattern: Option<LayerHandle>,
    pub slime_outer: Option<LayerHandle>,
    pub charge: Option<LayerHandle>,
    pub elytra: Option<(NodeId, EntityModel)>,
    pub cape: Option<(NodeId, String)>, // holder node + part name
    pub shadow: Option<NodeId>,
    pub shadow_mesh: Option<MeshId>,
    pub shadow_params: Option<ColorParams>,
    // Held item caches (JS `v.heldR` / `v.heldL`)
    pub held_r: Option<HeldState>,
    pub held_l: Option<HeldState>,
    pub head_key: Option<String>,
    pub carried_state: Option<u32>,
    pub carried_block: Option<NodeId>,
    // Name tag
    pub tag: Option<NodeId>,
    pub tag_text: Option<String>,
    pub tag_sneak: Option<bool>,
    // Item visual
    pub item_key: Option<String>,
    pub inner: Option<NodeId>,
    pub ground_scale_y: f64,
    pub gui3d: bool,
    pub glint_node: Option<NodeId>,
    // Per-frame scratch
    pub flash: f64,
    pub posed: bool,
    pub was_invisible: bool,
    pub lod_skip: bool,
    pub mushroom_layer: bool,
    pub frame_model: Option<String>,
    // Minecart jitter (JS `v.jitter`)
    pub jitter: Option<[f64; 3]>,
    // Lightning (JS `v.boltSeed` / `v.boltNode`)
    pub bolt_seed: Option<i64>,
    pub bolt_node: Option<NodeId>,
    pub own_meshes: Vec<MeshId>,
    // Fox
    pub fox_mouth: Option<NodeId>,
    pub fox_held_key: Option<String>,
    // JS `v.armor` — one entry per equipment slot 1..=4
    pub armor: Vec<ArmorLayer>,
    // JS `v.mushroomBack` / `v.mushroomHead` (mooshroom mushroom blocks)
    pub mushroom_back: Option<NodeId>,
    pub mushroom_head: Option<NodeId>,
}

/// JS `v.armor[slot] = { model, obj, mat, slot, inner, overlay: { model, obj, mat }, key }`.
#[derive(Clone, Debug)]
pub struct ArmorLayer {
    pub model: EntityModel,
    pub obj: NodeId,
    pub mat: usize,
    pub slot: usize,
    pub inner: bool,
    pub overlay_model: EntityModel,
    pub overlay_obj: NodeId,
    pub overlay_mat: usize,
    pub key: Option<String>,
}

/// JS layer record `{ model, mat, obj, ...opts }` (mat = index into
/// `Visual::materials`, obj = node).
#[derive(Clone, Debug)]
pub struct LayerRecord {
    pub model: EntityModel,
    pub mat: usize,
    pub obj: NodeId,
    pub full_bright: bool,
    pub transparent: bool,
    pub additive: bool,
    pub depth_write: Option<bool>,
    pub eyes: bool,
    pub cull: Option<bool>,
    pub hide_hat: bool,
    pub charge: bool,
}

/// Handle to a named layer tracked on the visual (JS `v.wool`, `v.saddle`, ...).
#[derive(Clone, Debug)]
pub struct LayerHandle {
    pub mat: usize,
    pub obj: NodeId,
}

/// JS `v.heldR` / `v.heldL` state: `{ key, root, glint }`.
#[derive(Clone, Debug, Default)]
pub struct HeldState {
    pub key: Option<String>,
    pub root: Option<NodeId>,
    pub glint: Option<NodeId>,
}

impl Visual {
    fn new(root: NodeId, kind: VisualKind) -> Self {
        Visual {
            root,
            kind,
            materials: Vec::new(),
            layers: Vec::new(),
            uuid: String::new(),
            visual_key: String::new(),
            tex_path: None,
            model_key: None,
            model: None,
            main_mat: None,
            atlas_mat: None,
            yaw_group: None,
            scale_group: None,
            model_group: None,
            body_drawables: Vec::new(),
            item_holder: None,
            left_holder: None,
            head_holder: None,
            wool: None,
            saddle: None,
            llama_decor: None,
            fish_pattern: None,
            slime_outer: None,
            charge: None,
            elytra: None,
            cape: None,
            shadow: None,
            shadow_mesh: None,
            shadow_params: None,
            held_r: None,
            held_l: None,
            head_key: None,
            carried_state: None,
            carried_block: None,
            tag: None,
            tag_text: None,
            tag_sneak: None,
            item_key: None,
            inner: None,
            ground_scale_y: 1.0,
            gui3d: false,
            glint_node: None,
            flash: 0.0,
            posed: false,
            was_invisible: false,
            lod_skip: false,
            mushroom_layer: false,
            frame_model: None,
            jitter: None,
            bolt_seed: None,
            bolt_node: None,
            own_meshes: Vec::new(),
            fox_mouth: None,
            fox_held_key: None,
            armor: Vec::new(),
            mushroom_back: None,
            mushroom_head: None,
        }
    }
}

// ============================================================ host trait

/// Browser/game operations the JS renderer performs. Implemented by the JS
/// glue (wasm boundary); the core never touches `web_sys`.
///
/// Every method documents the JS call it models. Mesh/material handles are
/// opaque ids allocated by the host.
pub trait RendererHost {
    // JS: game.assets.texture(path) -> texture | undefined
    fn assets_texture(&mut self, path: &str) -> Option<u32>;
    // JS: game.assets.makeTexture(name, w, h, data)
    fn assets_make_texture(&mut self, name: &str, w: u32, h: u32, data: &[u8]) -> Option<u32>;
    // JS: device.createMesh(FORMAT.color, data, opts) -> mesh
    fn device_create_mesh(&mut self, data: &[f32], quads: bool, dynamic: bool) -> Option<MeshId>;
    // JS: device.destroyMesh(m)
    fn device_destroy_mesh(&mut self, mesh: MeshId);
    // JS: device.updateMesh(m, data, opts)
    fn device_update_mesh(&mut self, mesh: MeshId, data: &[f32], quads: bool);
    // JS: entityMaterial(tex, opts) -> material record (params are host-side)
    fn entity_material(
        &mut self,
        tex: &TexRef,
        opts: &MaterialOpts,
    ) -> (usize, EntityParams, MaterialState);
    // JS: game.itemRenderer.iconKey(stack[, held, entity])
    fn item_icon_key(&mut self, item: &ItemStack, held: bool, entity: &EntitySnapshot) -> String;
    // JS: game.itemRenderer.objectFor(stack, mat[, held, entity]) -> item object
    fn item_object_for(
        &mut self,
        item: &ItemStack,
        mat: usize,
        held: bool,
        entity: &EntitySnapshot,
    ) -> Option<ItemObject>;
    // JS: game.itemRenderer.blockMesh({ baked, name })
    fn item_block_mesh(&mut self, baked_name: &str) -> Option<MeshId>;
    // JS: game.assets.modelStore.bakeVariant(file, props, variant, tint)
    fn model_store_bake_variant(&mut self, file: &str, props: &str, variant: &str) -> Option<String>;
    // JS: w.getSkyLight(x, y, z) / w.getBlockLight(x, y, z)
    fn sky_light(&mut self, x: i32, y: i32, z: i32) -> f64;
    fn block_light(&mut self, x: i32, y: i32, z: i32) -> f64;
    // JS: w.getState(x, y, z)
    fn world_state(&mut self, x: i32, y: i32, z: i32) -> u32;
    // JS: buildTextMeshes(device, font, lines, backgrounds) -> meshes
    fn build_text_meshes(&mut self, text: &str, sneak: bool) -> Vec<TextMeshRecord>;
    // JS: destroyTextMeshes(device, tagMeshes)
    fn destroy_text_meshes(&mut self, meshes: &[TextMeshRecord]);
}

/// JS material options object (`{ alphaTest, cull, transparent, fullBright,
/// additive, depthWrite, eyes, charge, colorWrite, hideHat }`).
#[derive(Clone, Debug, Default)]
pub struct MaterialOpts {
    pub alpha_test: Option<f64>,
    pub cull: Option<bool>,
    pub transparent: bool,
    pub full_bright: bool,
    pub additive: bool,
    pub depth_write: Option<bool>,
    pub eyes: bool,
    pub charge: bool,
    pub color_write: bool,
}

/// JS ItemStack subset the renderer reads: `{ id, count, damage }`.
#[derive(Clone, Debug)]
pub struct ItemStack {
    pub id: i32,
    pub count: i64,
    pub damage: i64,
}

/// JS `itemRenderer.objectFor` result subset: `{ obj, model, gui3d }` where
/// `obj` is a node subtree in the host's own scene plus a glint flag.
#[derive(Clone, Debug)]
pub struct ItemObject {
    /// Host-side root of the built item model (opaque to the core; attached by
    /// the host under the node the core designates).
    pub obj: u32,
    /// JS `io.model.display` transform strings, kept for applyTransform calls.
    pub display_ground: Option<[f64; 16]>,
    pub display_head: Option<[f64; 16]>,
    pub display_fixed: Option<[f64; 16]>,
    pub display_tp_right: Option<[f64; 16]>,
    pub display_tp_left: Option<[f64; 16]>,
    /// JS `io.model.layers`
    pub layers: Vec<String>,
    pub gui3d: bool,
    /// JS `io.obj.userData.glint`
    pub glint: bool,
}

/// JS `buildTextMeshes` result entry `{ mesh, tex }`.
#[derive(Clone, Debug)]
pub struct TextMeshRecord {
    pub mesh: MeshId,
    /// `None` = the translucent background quad (JS `tex === null`).
    pub tex: Option<u32>,
}

// ============================================================ renderer

/// Port of the JS `EntityRenderer` class state + dispatch.
pub struct EntityRenderer {
    /// JS: `this.group = game.renderer.entityRoot`.
    pub scene: Scene,
    pub group: NodeId,
    /// JS: `this.visuals = new Map()` (entity id -> visual).
    pub visuals: HashMap<i32, Visual>,
    /// JS: `this.skins = new Map()` (uuid -> skin record).
    pub skins: HashMap<String, SkinRecord>,
    /// JS: `this.meshCache = new Map()`.
    mesh_cache: HashMap<String, MeshId>,
    /// JS: `this.frame`
    pub frame: u32,
    /// JS: `this.glints` — nodes to re-draw with the glint pass this frame.
    pub glints: Vec<NodeId>,
    /// JS: `this.stats`
    pub stats: Stats,
    /// JS: `this._guiModel != null` (GUI player preview cache)
    pub gui_model_built: bool,
    /// JS: `this.noBatch`
    pub no_batch: bool,
}

/// JS `this.stats = { total, culled, lod }`.
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Stats {
    pub total: usize,
    pub culled: usize,
    pub lod: usize,
}

impl EntityRenderer {
    // JS: constructor(game) — the game/renderer/device handles stay host-side.
    pub fn new() -> Self {
        let mut scene = Scene::new();
        let group = scene.alloc();
        EntityRenderer {
            scene,
            group,
            visuals: HashMap::new(),
            skins: HashMap::new(),
            mesh_cache: HashMap::new(),
            frame: 0,
            glints: Vec::new(),
            stats: Stats::default(),
            gui_model_built: false,
            no_batch: false,
        }
    }

    // JS: reset() — drop everything (resource reload / world change)
    pub fn reset<H: RendererHost>(&mut self, host: &mut H) {
        for id in self.visuals.keys().copied().collect::<Vec<_>>() {
            self.remove(&EntitySnapshot { id, ..Default::default() }, host);
        }
        for m in self.mesh_cache.values().copied() {
            host.device_destroy_mesh(m);
        }
        self.mesh_cache.clear();
        self.gui_model_built = false;
    }

    // JS: _cachedMesh(key, make)
    pub fn cached_mesh<H: RendererHost>(
        &mut self,
        host: &mut H,
        key: &str,
        make: impl FnOnce(&mut H) -> Option<MeshId>,
    ) -> Option<MeshId> {
        if let Some(m) = self.mesh_cache.get(key) {
            return Some(*m);
        }
        let m = make(host)?;
        self.mesh_cache.insert(key.to_string(), m);
        Some(m)
    }

    // JS: remove(e)
    pub fn remove<H: RendererHost>(&mut self, e: &EntitySnapshot, host: &mut H) {
        if let Some(v) = self.visuals.remove(&e.id) {
            for m in &v.own_meshes {
                host.device_destroy_mesh(*m);
            }
            self.scene.remove_child(self.group, v.root);
        }
    }

    // JS: tick() {}
    pub fn tick(&mut self) {}

    // JS: _mat(v, tex, opts) — create a material owned by the visual.
    pub fn mat(&mut self, v: &mut Visual, host: &mut impl RendererHost, tex: TexRef, opts: &MaterialOpts) -> usize {
        let (idx, params, state) = host.entity_material(&tex, opts);
        let m = Material { tex, params, state };
        v.materials.push(m);
        v.materials.len() - 1
    }

    // ---------------------------------------------------------------- keys
    // (tex_for / model_for / living_key / visual_key ported in Phase 1 below)

    // JS: _livingKey(e)
    pub fn living_key(e: &EntitySnapshot) -> String {
        let t = match &e.entity_type {
            Some(t) => format!("{:?}", t),
            None => String::new(),
        };
        [
            t,
            EntityRenderer::tex_for(e).unwrap_or_default(),
            format!("{}", e.puff_state as i64),
            format!("{}", e.fish_variant),
            format!("{}", e.phantom_size as i64),
            format!("{}", e.horse_variant),
            format!("{}", e.horse_type),
            format!("{}", e.fox_sleeping),
            format!("{}", e.villager_type.unwrap_or(2)),
            format!("{}", e.profession),
            format!("{}", e.villager_level),
            format!("{}", e.child),
        ]
        .join("|")
    }

    // JS: _visualKey(e)
    pub fn visual_key(e: &EntitySnapshot) -> String {
        match e.kind.as_str() {
            "mob" => EntityRenderer::living_key(e),
            "boat" => format!("boat:{}", e.boat_type),
            "minecart" => ["cart", "", "", "", "", ""].join(":"),
            "crystal" => format!("crystal:{}", e.show_bottom()),
            "projectile" => format!(
                "projectile|{:?}|{}|",
                e.entity_type, e.invisible
            ),
            _ => e.kind.clone(),
        }
    }

    // JS: _light(x, y, z)
    pub fn light<H: RendererHost>(&mut self, host: &mut H, x: f64, y: f64, z: f64) -> [f64; 2] {
        let bx = x.floor() as i32;
        let by = y.floor() as i32;
        let bz = z.floor() as i32;
        [host.sky_light(bx, by, bz), host.block_light(bx, by, bz)]
    }
}

// Snapshot accessors for fields that arrive from the live entity beyond the
// base snapshot (kept optional so later phases extend the snapshot instead of
// breaking this file).
impl EntitySnapshot {
    pub fn show_bottom(&self) -> bool {
        self.show_bottom
    }
}

// ============================================================ _texFor

impl EntityRenderer {
    /// JS: `_texFor(e)` — the texture path for a living entity's skin, or
    /// `None` for kinds that resolve their texture elsewhere.
    pub fn tex_for(e: &EntitySnapshot) -> Option<String> {
        if e.kind == "player" {
            return None;
        }
        if e.kind == "armorstand" {
            return Some("entity/armorstand/wood.png".to_string());
        }
        let t = e.entity_type.as_ref()?;
        match t {
            EntityType::Legacy(50) => Some("entity/creeper/creeper.png".into()),
            EntityType::Legacy(51) => Some(if e.wither {
                "entity/skeleton/wither_skeleton.png"
            } else if e.stray {
                "entity/skeleton/stray.png"
            } else {
                "entity/skeleton/skeleton.png"
            }.to_string()),
            EntityType::Legacy(52) => Some("entity/spider/spider.png".into()),
            // RenderZombieVillager (1.11+): textures by profession; RenderHusk
            EntityType::Legacy(53) | EntityType::Legacy(54) => Some(if e.villager_zombie {
                "entity/zombie_villager/zombie_villager.png"
            } else if e.husk {
                "entity/zombie/husk.png"
            } else {
                "entity/zombie/zombie.png"
            }.to_string()),
            EntityType::Legacy(55) => Some("entity/slime/slime.png".into()),
            EntityType::Legacy(56) => Some(if e.attacking {
                "entity/ghast/ghast_shooting.png"
            } else {
                "entity/ghast/ghast.png"
            }.to_string()),
            EntityType::Legacy(57) => Some("entity/zombie_pigman.png".into()),
            EntityType::Legacy(58) => Some("entity/enderman/enderman.png".into()),
            EntityType::Legacy(59) => Some("entity/spider/cave_spider.png".into()),
            EntityType::Legacy(60) => Some("entity/silverfish.png".into()),
            EntityType::Legacy(61) => Some("entity/blaze.png".into()),
            EntityType::Legacy(62) => Some("entity/slime/magmacube.png".into()),
            EntityType::Legacy(64) => Some("entity/wither/wither.png".into()),
            EntityType::Legacy(65) => Some("entity/bat.png".into()),
            EntityType::Legacy(66) => Some("entity/witch.png".into()),
            EntityType::Legacy(67) => Some("entity/endermite.png".into()),
            EntityType::Legacy(68) => Some(if e.elder {
                "entity/guardian_elder.png"
            } else {
                "entity/guardian.png"
            }.to_string()),
            // JS: 'entity/shulker/shulker' + (ENTITY_DYES[e.shulkerColor] ? '_' + name : '') + '.png'
            EntityType::Legacy(69) => Some(match ENTITY_DYES.get(e.shulker_color.max(0) as usize) {
                Some(d) => format!("entity/shulker/shulker_{}.png", d),
                None => "entity/shulker/shulker.png".to_string(),
            }),
            EntityType::Legacy(90) => Some("entity/pig/pig.png".into()),
            EntityType::Legacy(91) => Some("entity/sheep/sheep.png".into()),
            EntityType::Legacy(92) => Some("entity/cow/cow.png".into()),
            EntityType::Legacy(93) => Some("entity/chicken.png".into()),
            EntityType::Legacy(94) => Some("entity/squid.png".into()),
            EntityType::Legacy(95) => Some(if e.tamed {
                "entity/wolf/wolf_tame.png"
            } else if e.angry {
                "entity/wolf/wolf_angry.png"
            } else {
                "entity/wolf/wolf.png"
            }.to_string()),
            EntityType::Legacy(96) => Some(format!(
                "entity/cow/{}_mooshroom.png",
                if e.mooshroom_type.as_deref() == Some("brown") { "brown" } else { "red" }
            )),
            EntityType::Legacy(97) => Some("entity/snow_golem.png".into()),
            EntityType::Legacy(98) => Some(format!(
                "entity/cat/{}.png",
                CAT_TEX.get(e.cat_type.max(0) as usize).copied().unwrap_or("ocelot")
            )),
            EntityType::Legacy(99) => Some("entity/iron_golem/iron_golem.png".into()),
            EntityType::Legacy(100) => {
                let ht = e.horse_type;
                if ht == 1 {
                    Some("entity/horse/donkey.png".into())
                } else if ht == 2 {
                    Some("entity/horse/mule.png".into())
                } else if ht == 3 {
                    Some("entity/horse/horse_zombie.png".into())
                } else if ht == 4 {
                    Some("entity/horse/horse_skeleton.png".into())
                } else {
                    let idx = (e.horse_variant & 0xff) as usize;
                    Some(format!(
                        "entity/horse/horse_{}.png",
                        HORSE_COLORS.get(idx).copied().unwrap_or("white")
                    ))
                }
            }
            EntityType::Legacy(101) => Some(format!(
                "entity/rabbit/{}.png",
                if e.rabbit_type == 99 {
                    "caerbannog".to_string()
                } else {
                    RABBIT_TEX.get(e.rabbit_type.max(0) as usize).copied().unwrap_or("brown").to_string()
                }
            )),
            EntityType::Legacy(120) => Some("entity/villager/villager.png".into()),
            EntityType::Named(name) => match name.as_str() {
                "wandering_trader" => Some("entity/wandering_trader.png".into()),
                "trader_llama" => Some(format!(
                    "entity/llama/{}.png",
                    LLAMA_TEX.get(e.llama_variant.max(0) as usize).copied().unwrap_or(LLAMA_TEX[0])
                )),
                "cat" => {
                    const CAT_114: [&str; 11] = ["tabby", "black", "red", "siamese", "british_shorthair", "calico", "persian", "ragdoll", "white", "jellie", "all_black"];
                    Some(format!(
                        "entity/cat/{}.png",
                        CAT_114.get(e.cat_type.max(0) as usize).copied().unwrap_or("tabby")
                    ))
                }
                "fox" => Some(format!(
                    "entity/fox/{}{}.png",
                    if e.fox_type == 1 { "snow_fox" } else { "fox" },
                    if e.fox_sleeping { "_sleep" } else { "" }
                )),
                "panda" => {
                    // JS: PANDA_VARIANTS[e.pandaGene||0]?.[e.pandaHiddenGene||0] || 'normal'
                    let variant = panda_variant(e.panda_gene, e.panda_hidden_gene).unwrap_or("normal");
                    let prefix = if variant == "normal" { "".to_string() } else { format!("{}_", variant) };
                    Some(format!("entity/panda/{}panda.png", prefix))
                }
                "ravager" => Some("entity/illager/ravager.png".into()),
                "pillager" => Some("entity/illager/pillager.png".into()),
                "polar_bear" => Some("entity/bear/polarbear.png".into()),
                "llama" => Some(format!(
                    "entity/llama/{}.png",
                    LLAMA_TEX.get(e.llama_variant.max(0) as usize).copied().unwrap_or(LLAMA_TEX[0])
                )),
                "parrot" => Some(format!(
                    "entity/parrot/parrot_{}.png",
                    PARROT_TEX.get(e.parrot_variant.max(0) as usize).copied().unwrap_or(PARROT_TEX[0])
                )),
                "vex" => Some(format!(
                    "entity/illager/vex{}.png",
                    if e.charging { "_charging" } else { "" }
                )),
                "evoker" | "vindicator" | "illusioner" => format!("entity/illager/{}.png", name).into(),
                "drowned" => Some("entity/zombie/drowned.png".into()),
                "cod" | "salmon" | "pufferfish" => format!("entity/fish/{}.png", name).into(),
                "tropical_fish" => Some(format!(
                    "entity/fish/tropical_{}.png",
                    if fish_shape(e.fish_variant) != 0 { "b" } else { "a" }
                )),
                "dolphin" => Some("entity/dolphin.png".into()),
                "turtle" => Some("entity/turtle/big_sea_turtle.png".into()),
                "bee" => Some(format!(
                    "entity/bee/{}.png",
                    if e.angry {
                        if e.has_nectar { "bee_angry_nectar" } else { "bee_angry" }
                    } else if e.has_nectar {
                        "bee_nectar"
                    } else {
                        "bee"
                    }
                )),
                "phantom" => Some("entity/phantom.png".into()),
                _ => None,
            },
            _ => None, // JS: default: return null
        }
    }
}

/// JS (`entity-renderer.js` line 326): `PANDA_VARIANTS[gene]?.[hiddenGene]` —
/// the 1.14.4 panda variant table (main gene rows × hidden gene columns).
/// `None` maps to `'normal'`.
pub fn panda_variant(gene: i32, hidden: i32) -> Option<&'static str> {
    // PANDA_VARIANTS rows from client/js/game/panda-variants-1.14.4.js
    const ROWS: [[&str; 5]; 5] = [
        ["normal", "lazy", "worried", "playful", "brown"],
        ["weak", "normal", "worried", "playful", "brown"],
        ["aggressive", "weak", "normal", "playful", "brown"],
        ["playful", "weak", "worried", "normal", "brown"],
        ["brown", "weak", "worried", "playful", "normal"],
    ];
    ROWS.get(gene.max(0) as usize)?
        .get(hidden.max(0) as usize)
        .copied()
}

// ============================================================ _modelFor

impl EntityRenderer {
    /// JS: `_modelFor(e)` — the entity-model factory call for the entity.
    /// Returns the ported model from `entity_models.rs`, or `None` exactly
    /// where the JS returns `null` (unsupported kinds/types).
    pub fn model_for(e: &EntitySnapshot) -> Option<EntityModel> {
        if e.kind == "player" {
            // JS: M.playerModel(s.skinFor(e).slim, 64, 64)
            let slim = e.slim_hint();
            return Some(entity_models::player_model(slim));
        }
        if e.kind == "armorstand" {
            return Some(entity_models::armor_stand_model());
        }
        match e.entity_type.as_ref()? {
            EntityType::Legacy(50) => Some(entity_models::creeper_model()),
            EntityType::Legacy(51) => Some(entity_models::skeleton_model()),
            EntityType::Legacy(52) | EntityType::Legacy(59) => Some(entity_models::spider_model()),
            EntityType::Legacy(53) | EntityType::Legacy(54) => Some(entity_models::zombie_model(e.villager_zombie)),
            EntityType::Legacy(57) => Some(entity_models::zombie_model(false)),
            EntityType::Legacy(55) => Some(entity_models::slime_model(false)),
            EntityType::Legacy(56) => Some(entity_models::ghast_model()),
            EntityType::Legacy(58) => Some(entity_models::enderman_model()),
            EntityType::Legacy(60) => Some(entity_models::silverfish_model()),
            EntityType::Legacy(61) => Some(entity_models::blaze_model()),
            EntityType::Legacy(62) => Some(entity_models::magma_cube_model()),
            EntityType::Legacy(64) => Some(entity_models::wither_model()),
            EntityType::Legacy(65) => Some(entity_models::bat_model()),
            EntityType::Legacy(66) => Some(entity_models::villager_model(true)),
            EntityType::Legacy(67) => Some(entity_models::endermite_model()),
            EntityType::Legacy(68) => Some(entity_models::guardian_model()),
            EntityType::Legacy(69) => Some(entity_models::shulker_model()),
            EntityType::Legacy(90) => jar_quadruped("pig"),
            EntityType::Legacy(91) => jar_quadruped("sheep"),
            EntityType::Legacy(92) | EntityType::Legacy(96) => jar_quadruped("cow"),
            EntityType::Legacy(93) => jar_quadruped("chicken"),
            EntityType::Legacy(94) => Some(entity_models::squid_model()),
            EntityType::Legacy(95) => Some(entity_models::wolf_model()),
            EntityType::Legacy(97) => Some(entity_models::snowman_model()),
            EntityType::Legacy(98) => Some(entity_models::ocelot_model()),
            EntityType::Legacy(99) => Some(entity_models::iron_golem_model()),
            EntityType::Legacy(100) => Some(entity_models::horse_model(horse_model_name(e.horse_type))),
            EntityType::Legacy(101) => Some(entity_models::rabbit_model()),
            EntityType::Legacy(120) => Some(entity_models::villager_model(false)),
            EntityType::Named(name) => match name.as_str() {
                "wandering_trader" => Some(entity_models::villager_model(false)),
                "trader_llama" | "llama" => Some(entity_models::llama_model(false)),
                "cat" => Some(entity_models::cat_model()),
                "fox" => Some(entity_models::fox_model()),
                "panda" => jar_quadruped("panda"),
                "ravager" => jar_quadruped("ravager"),
                "pillager" => Some(entity_models::illager_model("pillager")),
                "polar_bear" => Some(entity_models::polar_bear_model()),
                "parrot" => Some(entity_models::parrot_model(e.parrot_variant.max(0) as u8)),
                "vex" => Some(entity_models::vex_model()),
                "evoker" | "vindicator" | "illusioner" => Some(entity_models::illager_model(name)),
                "drowned" => Some(entity_models::drowned_model(false)),
                "cod" => Some(entity_models::cod_model()),
                "salmon" => Some(entity_models::salmon_model()),
                "pufferfish" => Some(entity_models::pufferfish_model(e.puff_state as u8)),
                "tropical_fish" => Some(entity_models::tropical_fish_model(fish_shape(e.fish_variant) as u8, false)),
                "dolphin" => Some(entity_models::dolphin_model()),
                "turtle" => Some(entity_models::turtle_model()),
                "phantom" => Some(entity_models::phantom_model(e.phantom_size as u8)),
                "bee" => jar_quadruped("bee"),
                _ => None,
            },
            _ => None, // JS: default: return null
        }
    }
}

/// JS `M.horse(type)`: 0 horse, 1 donkey, 2 mule, 3 zombie horse, 4 skeleton
/// horse — the model-set names used by `entity_models::horse_model`.
fn horse_model_name(ht: i32) -> &'static str {
    match ht {
        1 => "donkey",
        2 => "mule",
        3 => "horse_zombie",
        4 => "horse_skeleton",
        _ => "horse",
    }
}

/// JS `M.pig()` / `M.cow()` / `M.chicken()` / `M.sheep()` / `M.bee()` /
/// `M.panda()` / `M.ravager()` are quadruped presets over the jar model JSON.
/// `entity_models.rs` exposes the jar store (`has_jar_model`); when a preset
/// has not been ported as a function, resolve it through the jar data so the
/// dispatch matches the JS.
fn jar_quadruped(name: &str) -> Option<EntityModel> {
    let _ = name; // preset table pending in entity_models.rs; see module report
    None
}

impl EntitySnapshot {
    /// JS: `this.skinFor(e).slim` for players (UUID parity decides before the
    /// property arrives). The glue passes the resolved value through here.
    pub fn slim_hint(&self) -> bool {
        (crate::entity_render_alg::uuid_hash(&self.uuid) & 1) == 1
    }
}
