//! Port of `client/js/render/entity-models.js`: entity model definitions,
//! hierarchy, animations, and pose calculations.
//!
//! This module provides pure data + algorithmic model definitions for all
//! Minecraft entity types. The browser still owns WebGL mesh creation and
//! texture binding; this module produces transformed part hierarchies for
//! rendering.

use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::f64::consts::PI;
use wasm_bindgen::prelude::*;

// ============================================================================
// Constants
// ============================================================================

const D2R: f64 = PI / 180.0;

fn finite(value: f64, fallback: f64) -> f64 {
    if value.is_finite() { value } else { fallback }
}

fn clamp(value: f64, lo: f64, hi: f64) -> f64 {
    value.max(lo).min(hi)
}

fn lerp_angle(from: f64, to: f64, amount: f64) -> f64 {
    let mut delta = (to - from) % (2.0 * PI);
    if delta < -PI { delta += 2.0 * PI; }
    if delta >= PI { delta -= 2.0 * PI; }
    from + amount * delta
}

fn mix(from: f64, to: f64, t: f64) -> f64 {
    from + (to - from) * t
}

// ============================================================================
// Core Data Structures
// ============================================================================

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
pub struct ModelPart {
    pub name: String,
    pub tex_w: f64,
    pub tex_h: f64,
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
    pub children: Vec<ModelPart>,
    #[serde(skip)]
    pub parent: Option<String>,
}

impl ModelPart {
    pub fn new(name: &str, tex_w: f64, tex_h: f64) -> Self {
        Self {
            name: name.to_string(),
            tex_w,
            tex_h,
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
            parent: None,
        }
    }

    pub fn add_box(&mut self, x: f64, y: f64, z: f64, dx: f64, dy: f64, dz: f64, inflate: f64, u: f64, v: f64, mirror: bool) {
        self.boxes.push(BoxElement {
            x, y, z, dx, dy, dz, inflate, mirror, u, v, quads: None,
        });
    }

    pub fn set_pivot(&mut self, x: f64, y: f64, z: f64) {
        self.px = x; self.py = y; self.pz = z;
    }

    pub fn set_rotation(&mut self, x: f64, y: f64, z: f64) {
        self.rx = x; self.ry = y; self.rz = z;
    }

    pub fn add_child(&mut self, mut child: ModelPart) {
        child.parent = Some(self.name.clone());
        self.children.push(child);
    }

    pub fn copy_angles(&mut self, other: &ModelPart) {
        self.rx = other.rx;
        self.ry = other.ry;
        self.rz = other.rz;
    }
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct AnimationKeyframe {
    pub time: f64,
    pub values: Vec<f64>, // [rx, ry, rz, px, py, pz] for each part
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct Animation {
    pub name: String,
    pub loop_animation: bool,
    pub keyframes: Vec<AnimationKeyframe>,
    pub duration: f64,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize)]
pub struct EntityModel {
    pub name: String,
    pub parts: HashMap<String, ModelPart>,
    pub root_names: Vec<String>,
    pub animations: HashMap<String, Animation>,
    pub model_scale: f64,
    pub model_translate_y: f64,
    pub model_translate_z: f64,
    pub texture: String,
    pub child_scale: f64,
    pub child_y: f64,
    pub child_z: f64,
    pub slim: bool,
    pub quadruped: bool,
    pub horse_type: Option<String>,
    pub puff_state: Option<u8>,
    pub pattern: bool,
    pub material_options: ModelMaterialOptions,
}

#[derive(Clone, Debug, serde::Serialize, serde::Deserialize, Default)]
pub struct ModelMaterialOptions {
    pub cull: bool,
}

impl Default for EntityModel {
    fn default() -> Self {
        Self {
            name: String::new(),
            parts: HashMap::new(),
            root_names: Vec::new(),
            animations: HashMap::new(),
            model_scale: 1.0,
            model_translate_y: 0.0,
            model_translate_z: 0.0,
            texture: String::new(),
            child_scale: 0.5,
            child_y: 0.0,
            child_z: 0.0,
            slim: false,
            quadruped: false,
            horse_type: None,
            puff_state: None,
            pattern: false,
            material_options: ModelMaterialOptions::default(),
        }
    }
}

// ============================================================================
// Animation Arguments
// ============================================================================

#[derive(Clone, Debug, Default, serde::Serialize, serde::Deserialize)]
#[serde(default)]
pub struct AnimationArgs {
    pub ls: f64,
    pub lsa: f64,
    pub age: f64,
    pub yaw: f64,
    pub pitch: f64,
    pub partial: f64,
    pub swing: f64,
    pub in_water: bool,
    pub on_ground: bool,
    pub swimming: bool,
    pub swim_amount: Option<f64>,
    pub elytra: bool,
    pub speed_sq: f64,
    pub riding: bool,
    pub right_pose: Option<String>,
    pub left_pose: Option<String>,
    pub swing_side: f64,
    pub held_right: bool,
    pub sneak: bool,
    pub y_off: f64,
    pub aimed_bow: bool,
    pub use_ticks: f64,
    pub crossbow_charge_duration: f64,
    pub rearing: f64,
    pub grazing: f64,
    pub mouth_open: f64,
    pub tail_wag: bool,
    pub saddled: bool,
    pub has_rider: bool,
    pub chested: bool,
    pub child: bool,
    pub carrying: bool,
    pub screaming: bool,
    pub hide_hat: bool,
    pub witch_drinking: bool,
    pub angry: bool,
    pub has_stung: bool,
    pub bee_roll: f64,
    pub flying: bool,
    pub dancing: bool,
    pub sitting: bool,
    pub flap: Option<f64>,
    pub laying_egg: bool,
    pub entity_id: f64,
    pub rowing: Option<Vec<f64>>,
    pub rot: Option<Vec<f64>>,
    pub charging: bool,
    pub spellcasting: bool,
    pub attacking: bool,
    pub show_hat: Option<bool>,
    pub pose: Option<String>,
    pub attack_timer: f64,
    pub arms_raised: bool,
    pub throwing: bool,
    pub left_handed: bool,
    pub progress: f64,
    pub poses: Option<HashMap<String, Vec<f64>>>,
    pub show_arms: bool,
    pub no_base_plate: bool,
    pub eating_grass: f64,
    pub moving: Option<bool>,
    pub py: Option<f64>,
    pub peek: f64,
    pub in_water_bool: bool,
}

impl AnimationArgs {
    pub fn normalize(mut self) -> Self {
        self.ls = finite(self.ls, 0.0);
        self.lsa = finite(self.lsa, 0.0);
        self.age = finite(self.age, 0.0);
        self.yaw = finite(self.yaw, 0.0);
        self.pitch = finite(self.pitch, 0.0);
        self.partial = finite(self.partial, 0.0);
        self.swing = if self.swing.is_finite() && self.swing >= 0.0 {
            clamp(self.swing, 0.0, 1.0)
        } else {
            -9999.0
        };
        self.in_water = self.in_water || self.in_water_bool;
        self.on_ground = self.on_ground;
        self
    }
}

// ============================================================================
// Model Builders - Ported from JS J() and jarAdapter()
// ============================================================================

// BIPED and QUADRUPED part names
const BIPED: &[&str] = &["head", "headwear", "body", "rightArm", "leftArm", "rightLeg", "leftLeg"];
const QUADRUPED: &[&str] = &["head", "body", "leg1", "leg2", "leg3", "leg4"];

/// Static model data storage (populated by JS via set_jar_models)
static mut JAR_MODELS: Option<HashMap<String, Value>> = None;

#[wasm_bindgen]
pub fn set_jar_models(models_json: &str) -> bool {
    let models: HashMap<String, Value> = match serde_json::from_str(models_json) {
        Ok(m) => m,
        Err(_) => return false,
    };
    unsafe { JAR_MODELS = Some(models); }
    true
}

#[wasm_bindgen]
pub fn has_jar_model(name: &str) -> bool {
    unsafe { JAR_MODELS.as_ref().map(|m| m.contains_key(name)).unwrap_or(false) }
}

fn get_jar_model(name: &str) -> Option<&'static Value> {
    unsafe { JAR_MODELS.as_ref().and_then(|m| m.get(name)) }
}

fn build_jar_model<S: AsRef<str>>(name: &str, part_names: &[S]) -> Option<HashMap<String, ModelPart>> {
    let model_data = get_jar_model(name)?;
    let parts_data = model_data.get("parts")?.as_array()?;
    let fields = model_data.get("fields")?.as_array()?;
    let nums = model_data.get("nums").and_then(|v| v.as_array());

    let mut made = HashMap::new();

    // Build parts recursively
    fn build_part(
        parts_data: &[Value],
        idx: usize,
        made: &mut HashMap<usize, ModelPart>,
    ) -> Option<ModelPart> {
        if made.contains_key(&idx) {
            return made.get(&idx).cloned();
        }
        let q = parts_data.get(idx)?;
        let mut p = ModelPart::new(
            &format!("part_{}", idx),
            q.get("tw").and_then(|v| v.as_f64()).unwrap_or(64.0),
            q.get("th").and_then(|v| v.as_f64()).unwrap_or(32.0),
        );
        p.mirror = q.get("mirror").and_then(|v| v.as_bool()).unwrap_or(false);
        p.visible = q.get("show").and_then(|v| v.as_bool()).unwrap_or(true);

        if let Some(boxes) = q.get("boxes").and_then(|b| b.as_array()) {
            for b in boxes {
                if let Some(arr) = b.as_array() {
                    if arr.len() >= 10 {
                        p.add_box(
                            arr[0].as_f64().unwrap_or(0.0),
                            arr[1].as_f64().unwrap_or(0.0),
                            arr[2].as_f64().unwrap_or(0.0),
                            arr[3].as_f64().unwrap_or(0.0),
                            arr[4].as_f64().unwrap_or(0.0),
                            arr[5].as_f64().unwrap_or(0.0),
                            arr[6].as_f64().unwrap_or(0.0),
                            arr[7].as_f64().unwrap_or(0.0),
                            arr[8].as_f64().unwrap_or(0.0),
                            arr[9].as_bool().unwrap_or(false),
                        );
                    }
                }
            }
        }

        if let Some(pivot) = q.get("p").and_then(|v| v.as_array()) {
            if pivot.len() >= 3 {
                p.set_pivot(
                    pivot[0].as_f64().unwrap_or(0.0),
                    pivot[1].as_f64().unwrap_or(0.0),
                    pivot[2].as_f64().unwrap_or(0.0),
                );
            }
        }
        if let Some(rot) = q.get("r").and_then(|v| v.as_array()) {
            if rot.len() >= 3 {
                p.set_rotation(
                    rot[0].as_f64().unwrap_or(0.0),
                    rot[1].as_f64().unwrap_or(0.0),
                    rot[2].as_f64().unwrap_or(0.0),
                );
            }
        }

        made.insert(idx, p.clone());

        if let Some(children) = q.get("children").and_then(|c| c.as_array()) {
            for c_idx in children {
                if let Some(child_idx) = c_idx.as_u64() {
                    if let Some(child) = build_part(parts_data, child_idx as usize, made) {
                        p.add_child(child);
                    }
                }
            }
        }

        Some(p)
    }

    let mut out = HashMap::new();
    for (k, name) in part_names.iter().enumerate() {
        if name.as_ref().is_empty() { continue; }
        if k >= fields.len() { continue; }
        let field = &fields[k];
        if field.is_array() {
            if let Some(arr) = field.as_array() {
                let parts: Vec<ModelPart> = arr.iter()
                    .filter_map(|v| v.as_u64().map(|i| build_part(parts_data, i as usize, &mut made)))
                    .flatten()
                    .collect();
                // For arrays, store with index suffix
                for (i, part) in parts.into_iter().enumerate() {
                    out.insert(format!("{}_{}", name.as_ref(), i), part);
                }
            }
        } else if let Some(idx) = field.as_u64() {
            if let Some(part) = build_part(parts_data, idx as usize, &mut made) {
                out.insert(name.as_ref().to_string(), part);
            }
        }
    }
    Some(out)
}

// ============================================================================
// Animation Functions
// ============================================================================

fn animate_swim(p: &mut HashMap<String, ModelPart>, a: &AnimationArgs, swim: f64) {
    let phase = (a.ls % 26.0) as i32;
    let right = if a.swing > 0.0 { 0.0 } else { swim };

    let (rx, lz, rz) = if phase < 14 {
        let curve = (-65.0 * phase as f64 + phase as f64 * phase as f64) / (-65.0 * 14.0 + 14.0 * 14.0);
        (0.0, PI + 1.8707964 * curve, PI - 1.8707964 * curve)
    } else if phase < 22 {
        let t = (phase as f64 - 14.0) / 8.0;
        (PI / 2.0 * t, 5.012389 - 1.8707964 * t, 1.2707963 + 1.8707964 * t)
    } else {
        (PI / 2.0 * (1.0 - (phase as f64 - 22.0) / 4.0), PI, PI)
    };

    if let Some(left_arm) = p.get_mut("leftArm") {
        left_arm.rx = lerp_angle(left_arm.rx, rx, swim);
        left_arm.ry = lerp_angle(left_arm.ry, PI, swim);
        left_arm.rz = lerp_angle(left_arm.rz, lz, swim);
    }
    if let Some(right_arm) = p.get_mut("rightArm") {
        right_arm.rx = mix(right_arm.rx, rx, right);
        right_arm.ry = mix(right_arm.ry, PI, right);
        right_arm.rz = mix(right_arm.rz, rz, right);
    }
    if let Some(left_leg) = p.get_mut("leftLeg") {
        left_leg.rx = mix(left_leg.rx, 0.3 * (a.ls / 3.0 + PI).cos(), swim);
    }
    if let Some(right_leg) = p.get_mut("rightLeg") {
        right_leg.rx = mix(right_leg.rx, 0.3 * (a.ls / 3.0).cos(), swim);
    }
}

pub fn animate_biped(p: &mut HashMap<String, ModelPart>, a: &AnimationArgs) {
    let swim = clamp(a.swim_amount.unwrap_or(if a.swimming { 1.0 } else { 0.0 }), 0.0, 1.0);
    let (head_ry, head_rx) = {
        let head = p.get_mut("head").unwrap();
        head.ry = a.yaw * D2R;
        head.rx = if a.elytra {
            -PI / 4.0
        } else if swim > 0.0 {
            lerp_angle(head.rx, if a.swimming { -PI / 4.0 } else { a.pitch * D2R }, swim)
        } else {
            a.pitch * D2R
        };
        (head.ry, head.rx)
    };

    let mut f = 1.0;
    if a.elytra {
        f = (a.speed_sq / 0.2).powi(3);
        if f < 1.0 { f = 1.0; }
    }

    if let Some(right_arm) = p.get_mut("rightArm") {
        right_arm.rx = (a.ls * 0.6662 + PI).cos() * 2.0 * a.lsa * 0.5 / f;
        right_arm.rz = 0.0;
    }
    if let Some(left_arm) = p.get_mut("leftArm") {
        left_arm.rx = (a.ls * 0.6662).cos() * 2.0 * a.lsa * 0.5 / f;
        left_arm.rz = 0.0;
    }
    if let Some(right_leg) = p.get_mut("rightLeg") {
        right_leg.rx = (a.ls * 0.6662).cos() * 1.4 * a.lsa / f;
        right_leg.ry = 0.0;
    }
    if let Some(left_leg) = p.get_mut("leftLeg") {
        left_leg.rx = (a.ls * 0.6662 + PI).cos() * 1.4 * a.lsa / f;
        left_leg.ry = 0.0;
    }

    if a.riding {
        if let Some(right_arm) = p.get_mut("rightArm") { right_arm.rx += -PI / 5.0; }
        if let Some(left_arm) = p.get_mut("leftArm") { left_arm.rx += -PI / 5.0; }
        if let Some(right_leg) = p.get_mut("rightLeg") { right_leg.rx = -PI * 2.0 / 5.0; right_leg.ry = PI / 10.0; }
        if let Some(left_leg) = p.get_mut("leftLeg") { left_leg.rx = -PI * 2.0 / 5.0; left_leg.ry = -PI / 10.0; }
    }

    let rp = a.right_pose.as_deref().unwrap_or(if a.held_right { "item" } else { "empty" });
    let lp = a.left_pose.as_deref().unwrap_or("empty");

    if let Some(right_arm) = p.get_mut("rightArm") { right_arm.ry = 0.0; }
    if let Some(left_arm) = p.get_mut("leftArm") { left_arm.ry = 0.0; }

    if lp == "block" {
        if let Some(left_arm) = p.get_mut("leftArm") {
            left_arm.rx = left_arm.rx * 0.5 - 0.9424779;
            left_arm.ry = 0.5235988;
        }
    } else if lp == "item" {
        if let Some(left_arm) = p.get_mut("leftArm") {
            left_arm.rx = left_arm.rx * 0.5 - PI / 10.0;
        }
    } else if lp == "spear" {
        if let Some(left_arm) = p.get_mut("leftArm") {
            left_arm.rx = left_arm.rx * 0.5 - PI;
            left_arm.ry = 0.0;
        }
    }

    if rp == "block" {
        if let Some(right_arm) = p.get_mut("rightArm") {
            right_arm.rx = right_arm.rx * 0.5 - 0.9424779;
            right_arm.ry = -0.5235988;
        }
    } else if rp == "item" {
        if let Some(right_arm) = p.get_mut("rightArm") {
            right_arm.rx = right_arm.rx * 0.5 - PI / 10.0;
        }
    } else if rp == "spear" {
        if let Some(right_arm) = p.get_mut("rightArm") {
            right_arm.rx = right_arm.rx * 0.5 - PI;
            right_arm.ry = 0.0;
        }
    }

    if let Some(body) = p.get_mut("body") { body.ry = 0.0; }

    if let Some(right_arm) = p.get_mut("rightArm") { right_arm.pz = 0.0; right_arm.px = -5.0; }
    if let Some(left_arm) = p.get_mut("leftArm") { left_arm.pz = 0.0; left_arm.px = 5.0; }

    if a.swing > -9990.0 {
        let side = if a.swing_side != 0.0 { a.swing_side } else { 1.0 };
        let arm_name = if side > 0.0 { "rightArm" } else { "leftArm" };
        let f1 = a.swing;

        if let Some(body) = p.get_mut("body") {
            body.ry = (f1.sqrt() * PI * 2.0).sin() * 0.2 * side;
        }

        let body_ry = p.get("body").map(|b| b.ry).unwrap_or(0.0);
        let sin_body_ry = body_ry.sin();
        let cos_body_ry = body_ry.cos();

        if let Some(right_arm) = p.get_mut("rightArm") {
            right_arm.pz = sin_body_ry * 5.0;
            right_arm.px = -cos_body_ry * 5.0;
        }
        if let Some(left_arm) = p.get_mut("leftArm") {
            left_arm.pz = -sin_body_ry * 5.0;
            left_arm.px = cos_body_ry * 5.0;
        }

        if let Some(right_arm) = p.get_mut("rightArm") { right_arm.ry += body_ry; }
        if let Some(left_arm) = p.get_mut("leftArm") { left_arm.ry += body_ry; left_arm.rx += body_ry; }

        let f1 = 1.0 - a.swing;
        let f1 = f1 * f1 * f1 * f1;
        let f1 = 1.0 - f1;
        let f2 = (f1 * PI).sin();
        let f3 = (a.swing * PI).sin() * -(head_rx - 0.7) * 0.75;

        if let Some(arm) = p.get_mut(arm_name) {
            arm.rx = arm.rx - (f2 * 1.2 + f3);
            arm.ry += body_ry * 2.0;
            arm.rz += (a.swing * PI).sin() * -0.4;
        }
    }

    let y_off = a.y_off;
    if a.sneak {
        if let Some(body) = p.get_mut("body") { body.rx = 0.5; }
        if let Some(right_arm) = p.get_mut("rightArm") { right_arm.rx += 0.4; }
        if let Some(left_arm) = p.get_mut("leftArm") { left_arm.rx += 0.4; }
        if let Some(right_leg) = p.get_mut("rightLeg") { right_leg.pz = 4.0; right_leg.py = 9.0 + y_off; }
        if let Some(left_leg) = p.get_mut("leftLeg") { left_leg.pz = 4.0; left_leg.py = 9.0 + y_off; }
        if let Some(head) = p.get_mut("head") { head.py = 1.0 + y_off; }
    } else {
        if let Some(body) = p.get_mut("body") { body.rx = 0.0; }
        if let Some(right_leg) = p.get_mut("rightLeg") { right_leg.pz = 0.1; right_leg.py = 12.0 + y_off; }
        if let Some(left_leg) = p.get_mut("leftLeg") { left_leg.pz = 0.1; left_leg.py = 12.0 + y_off; }
        if let Some(head) = p.get_mut("head") { head.py = y_off; }
    }

    if let Some(right_arm) = p.get_mut("rightArm") {
        right_arm.rz += (a.age * 0.09).cos() * 0.05 + 0.05;
    }
    if let Some(left_arm) = p.get_mut("leftArm") {
        left_arm.rz -= (a.age * 0.09).cos() * 0.05 + 0.05;
    }
    if let Some(right_arm) = p.get_mut("rightArm") {
        right_arm.rx += (a.age * 0.067).sin() * 0.05;
    }
    if let Some(left_arm) = p.get_mut("leftArm") {
        left_arm.rx -= (a.age * 0.067).sin() * 0.05;
    }

    if rp == "bow" || (a.aimed_bow && lp != "bow") {
        if let Some(right_arm) = p.get_mut("rightArm") { right_arm.ry = -0.1 + head_ry; right_arm.rx = -PI / 2.0 + head_rx; }
        if let Some(left_arm) = p.get_mut("leftArm") { left_arm.ry = 0.1 + head_ry + 0.4; left_arm.rx = -PI / 2.0 + head_rx; }
    } else if lp == "bow" {
        if let Some(right_arm) = p.get_mut("rightArm") { right_arm.ry = -0.1 + head_ry - 0.4; right_arm.rx = -PI / 2.0 + head_rx; }
        if let Some(left_arm) = p.get_mut("leftArm") { left_arm.ry = 0.1 + head_ry; left_arm.rx = -PI / 2.0 + head_rx; left_arm.rz = PI / 2.0; }
    }

    let crossbow_right = rp == "crossbow_charge" || rp == "crossbow_hold";
    let crossbow_left = lp == "crossbow_charge" || lp == "crossbow_hold";
    if crossbow_right || crossbow_left {
        let (sign, main, off) = if crossbow_right {
            (1.0, "rightArm", "leftArm")
        } else {
            (-1.0, "leftArm", "rightArm")
        };
        let is_charge = if crossbow_right { rp == "crossbow_charge" } else { lp == "crossbow_charge" };

        if is_charge {
            if let Some(main_part) = p.get_mut(main) { main_part.ry = -0.8 * sign; main_part.rx = -0.97079635; }
            if let Some(off_part) = p.get_mut(off) {
                off_part.rx = -0.97079635;
                let f = clamp(a.use_ticks / a.crossbow_charge_duration.max(1.0), 0.0, 1.0);
                off_part.ry = (0.4 + (0.85 - 0.4) * f) * sign;
                off_part.rx = -0.97079635 + (-PI / 2.0 + 0.97079635) * f;
            }
        } else {
            if let Some(main_part) = p.get_mut(main) { main_part.ry = -0.3 * sign + head_ry; main_part.rx = -PI / 2.0 + head_rx + 0.1; }
            if let Some(off_part) = p.get_mut(off) { off_part.ry = 0.6 * sign + head_ry; off_part.rx = -1.5 + head_rx; }
        }
    }

    if swim > 0.0 {
        animate_swim(p, a, swim);
    }

    let head_angles = p.get("head").map(|h| (h.rx, h.ry, h.rz));
    if let Some(headwear) = p.get_mut("headwear") {
        if let Some((hrx, hry, hrz)) = head_angles {
            headwear.rx = hrx; headwear.ry = hry; headwear.rz = hrz;
        }
    }
}

fn animate_quadruped(p: &mut HashMap<String, ModelPart>, a: &AnimationArgs) {
    if let Some(head) = p.get_mut("head") {
        head.rx = a.pitch * D2R;
        head.ry = a.yaw * D2R;
    }
    if let Some(body) = p.get_mut("body") { body.rx = PI / 2.0; }
    if let Some(leg1) = p.get_mut("leg1") { leg1.rx = (a.ls * 0.6662).cos() * 1.4 * a.lsa; }
    if let Some(leg2) = p.get_mut("leg2") { leg2.rx = (a.ls * 0.6662 + PI).cos() * 1.4 * a.lsa; }
    if let Some(leg3) = p.get_mut("leg3") { leg3.rx = (a.ls * 0.6662 + PI).cos() * 1.4 * a.lsa; }
    if let Some(leg4) = p.get_mut("leg4") { leg4.rx = (a.ls * 0.6662).cos() * 1.4 * a.lsa; }
}

// ============================================================================
// Entity Model Factory Functions
// ============================================================================

fn make_biped(name: &str) -> EntityModel {
    let mut model = EntityModel::default();
    model.name = name.to_string();
    model.root_names = BIPED.iter().map(|s| s.to_string()).collect();
    model.model_scale = 1.0;
    model.texture = format!("entity/{}.png", name);
    model.quadruped = false;

    if let Some(parts) = build_jar_model(name, BIPED) {
        model.parts = parts;
    }
    model
}

fn make_quadruped(name: &str) -> EntityModel {
    let mut model = EntityModel::default();
    model.name = name.to_string();
    model.root_names = QUADRUPED.iter().map(|s| s.to_string()).collect();
    model.model_scale = 1.0;
    model.texture = format!("entity/{}.png", name);
    model.quadruped = true;

    if let Some(parts) = build_jar_model(name, QUADRUPED) {
        model.parts = parts;
        if let Some(nums) = get_jar_model(name).and_then(|m| m.get("nums")).and_then(|v| v.as_array()) {
            if nums.len() >= 2 {
                model.child_y = nums[0].as_f64().unwrap_or(0.0);
                model.child_z = nums[1].as_f64().unwrap_or(0.0);
            }
        }
    }
    model
}

// ============================================================================
// Public Entity Model Constructors
// ============================================================================

// Biped family
pub fn biped_model(name: &str) -> EntityModel {
    make_biped(name)
}

pub fn player_model(slim: bool) -> EntityModel {
    let name = if slim { "playerSlim" } else { "player" };
    let mut model = make_biped(name);
    model.slim = slim;
    model.texture = if slim { "entity/steve.png" } else { "entity/alex.png" }.to_string();

    // Add extra parts for 64x64 skin
    let extra_parts = ["leftArmwear", "rightArmwear", "leftLegwear", "rightLegwear", "bodywear", "cape", "ears"];
    if let Some(parts) = build_jar_model(name, &[BIPED, extra_parts.as_slice()].concat()) {
        model.parts = parts;
        model.root_names = vec![
            "head", "headwear", "body", "rightArm", "leftArm",
            "rightLeg", "leftLeg", "leftLegwear", "rightLegwear",
            "leftArmwear", "rightArmwear", "bodywear"
        ].into_iter().map(String::from).collect();
    }
    model
}

pub fn zombie_model(villager: bool) -> EntityModel {
    let name = if villager { "zombieVillager" } else { "zombie" };
    let mut model = make_biped(name);
    model.texture = format!("entity/zombie/{}.png", if villager { "zombie_villager" } else { "zombie" });
    model
}

pub fn skeleton_model() -> EntityModel {
    make_biped("skeleton")
}

pub fn enderman_model() -> EntityModel {
    let mut model = make_biped("enderman");
    model.model_translate_y = -14.0;
    model.texture = "entity/enderman.png".to_string();
    model
}

pub fn villager_model(witch: bool) -> EntityModel {
    let name = if witch { "witch" } else { "villager" };
    let mut part_names = vec!["head", "hat", "hatRim", "body", "jacket", "arms", "rightLeg", "leftLeg", "nose"];
    if witch { part_names.push("mole"); }
    let mut model = EntityModel::default();
    model.name = name.to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = format!("entity/{}.png", if witch { "witch" } else { "villager" });
    model.quadruped = false;

    if let Some(parts) = build_jar_model(name, &part_names) {
        model.parts = parts;
    }
    model
}

// Cat/Ocelot
pub fn cat_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "cat".to_string();
    model.root_names = vec!["backLeft", "backRight", "frontLeft", "frontRight", "tail", "tail2", "head", "body"]
        .into_iter().map(String::from).collect();
    model.model_scale = 0.8;
    model.texture = "entity/cat/cat1.png".to_string();

    if let Some(parts) = build_jar_model("cat", &model.root_names) {
        model.parts = parts;
    }
    model
}

pub fn ocelot_model() -> EntityModel {
    let part_names = ["backLeft", "backRight", "frontLeft", "frontRight", "tail", "tail2", "head", "body"];
    let mut model = EntityModel::default();
    model.name = "ocelot".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.child_y = 10.0;
    model.child_z = 4.0;
    model.texture = "entity/ocelot.png".to_string();

    if let Some(parts) = build_jar_model("ocelot", &part_names) {
        model.parts = parts;
    }
    model
}

// Fox
pub fn fox_model() -> EntityModel {
    let part_names = ["head", "leftEar", "rightEar", "nose", "body", "rightHindLeg", "leftHindLeg", "rightFrontLeg", "leftFrontLeg", "tail"];
    let mut model = EntityModel::default();
    model.name = "fox".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/fox/red_fox.png".to_string();

    if let Some(parts) = build_jar_model("fox", &part_names) {
        model.parts = parts;
    }
    model
}

// Wolf
pub fn wolf_model() -> EntityModel {
    let part_names = ["head", "body", "leg1", "leg2", "leg3", "leg4", "tail", "mane"];
    let mut model = EntityModel::default();
    model.name = "wolf".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.child_y = 5.0;
    model.child_z = 2.0;
    model.quadruped = true;
    model.texture = "entity/wolf/wolf.png".to_string();

    if let Some(parts) = build_jar_model("wolf", &part_names) {
        model.parts = parts;
    }
    model
}

// Rabbit
pub fn rabbit_model() -> EntityModel {
    let part_names = ["leftFoot", "rightFoot", "leftThigh", "rightThigh", "body", "leftArm", "rightArm", "head", "rightEar", "leftEar", "tail", "nose"];
    let mut model = EntityModel::default();
    model.name = "rabbit".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.model_scale = 0.6;
    model.model_translate_y = 16.0 * 0.0625 * (1.0 / 0.6 - 1.0) * 0.6;
    model.texture = "entity/rabbit/rabbit_brown.png".to_string();

    if let Some(parts) = build_jar_model("rabbit", &part_names) {
        model.parts = parts;
    }
    model
}

// Horse family
pub fn horse_model(horse_type: &str) -> EntityModel {
    let types = ["horse", "donkey", "mule", "zombie_horse", "skeleton_horse"];
    let kind = if types.contains(&horse_type) { horse_type } else { "horse" };
    let chested = kind == "donkey" || kind == "mule";

    let mut part_names = vec!["body", "neck", "leftHindLeg", "rightHindLeg", "leftFrontLeg", "rightFrontLeg", "tail", "saddleParts", "reins"];
    if chested { part_names.push("leftChest"); part_names.push("rightChest"); }

    let base_name = if chested { "donkey" } else { "horse" };
    let mut model = EntityModel::default();
    model.name = kind.to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.horse_type = Some(kind.to_string());

    model.model_scale = match kind {
        "donkey" => 0.87,
        "mule" => 0.92,
        _ => 1.0,
    };

    let texture_name = match kind {
        "horse" => "horse_white",
        "zombie_horse" => "horse_zombie",
        "skeleton_horse" => "horse_skeleton",
        _ => kind,
    };
    model.texture = format!("entity/horse/{}.png", texture_name);

    if let Some(parts) = build_jar_model(base_name, &part_names) {
        model.parts = parts;
    }
    model
}

// Polar Bear
pub fn polar_bear_model() -> EntityModel {
    let mut model = make_quadruped("polarBear");
    model.texture = "entity/bear/polarbear.png".to_string();
    model.model_scale = 1.2;
    model.child_y = 8.0;
    model.child_z = 6.0;
    model
}

// Llama
pub fn llama_model(decor: bool) -> EntityModel {
    let name = if decor { "llamaDecor" } else { "llama" };
    let mut part_names = QUADRUPED.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    part_names.push("rightChest".to_string());
    part_names.push("leftChest".to_string());

    let mut model = EntityModel::default();
    model.name = name.to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = if decor { "entity/llama/decor/white.png" } else { "entity/llama/creamy.png" }.to_string();
    model.quadruped = true;
    model.child_y = 8.0;
    model.child_z = 6.0;

    if let Some(parts) = build_jar_model(name, &part_names) {
        model.parts = parts;
    }
    model
}

// Parrot
pub fn parrot_model(variant: u8) -> EntityModel {
    let colors = ["red_blue", "blue", "green", "yellow_blue", "grey"];
    let color = colors.get(variant as usize).unwrap_or(&colors[0]);

    let part_names = ["body", "tail", "leftWing", "rightWing", "head", "face", "upperBeak", "lowerBeak", "crest", "leftLeg", "rightLeg"];
    let mut model = EntityModel::default();
    model.name = "parrot".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = format!("entity/parrot/parrot_{}.png", color);

    if let Some(parts) = build_jar_model("parrot", &part_names) {
        model.parts = parts;
    }
    model
}

// Vex
pub fn vex_model() -> EntityModel {
    let mut part_names = BIPED.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    part_names.push("leftWing".to_string());
    part_names.push("rightWing".to_string());

    let mut model = EntityModel::default();
    model.name = "vex".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.model_scale = 0.4;
    model.texture = "entity/illager/vex.png".to_string();

    if let Some(parts) = build_jar_model("vex", &part_names) {
        model.parts = parts;
    }
    model
}

// Illager
pub fn illager_model(kind: &str) -> EntityModel {
    let kind = match kind {
        "evoker" | "vindicator" | "illusioner" | "pillager" => kind,
        _ => "evoker",
    };

    let part_names = ["head", "hat", "body", "arms", "rightLeg", "leftLeg", "nose", "rightArm", "leftArm"];
    let mut model = EntityModel::default();
    model.name = kind.to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.model_scale = 0.9375;
    model.texture = format!("entity/illager/{}.png", kind);

    if let Some(parts) = build_jar_model("illager", &part_names) {
        model.parts = parts;
    }
    model
}

// Creeper
pub fn creeper_model() -> EntityModel {
    let part_names = ["head", "", "body", "leg1", "leg2", "leg3", "leg4"];
    let mut model = EntityModel::default();
    model.name = "creeper".to_string();
    model.root_names = vec!["head", "body", "leg1", "leg2", "leg3", "leg4"].into_iter().map(String::from).collect();
    model.texture = "entity/creeper/creeper.png".to_string();

    if let Some(parts) = build_jar_model("creeper", &part_names) {
        model.parts = parts;
    }
    model
}

// Spider
pub fn spider_model() -> EntityModel {
    let part_names = ["head", "neck", "body", "leg1", "leg2", "leg3", "leg4", "leg5", "leg6", "leg7", "leg8"];
    let mut model = EntityModel::default();
    model.name = "spider".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/spider/spider.png".to_string();

    if let Some(parts) = build_jar_model("spider", &part_names) {
        model.parts = parts;
    }
    model
}

// Slime
pub fn slime_model(outer: bool) -> EntityModel {
    let name = if outer { "slimeOuter" } else { "slime" };
    let part_names = if outer { vec!["cube"] } else { vec!["cube", "rightEye", "leftEye", "mouth"] };

    let mut model = EntityModel::default();
    model.name = name.to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/slime/slime.png".to_string();

    if let Some(parts) = build_jar_model(name, &part_names) {
        model.parts = parts;
    }
    model
}

// Magma Cube
pub fn magma_cube_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "magmaCube".to_string();
    model.root_names = vec!["core", "seg0", "seg1", "seg2", "seg3", "seg4", "seg5", "seg6", "seg7"].into_iter().map(String::from).collect();
    model.texture = "entity/magma_cube/magma_cube.png".to_string();

    if let Some(parts) = build_jar_model("magmaCube", &["segs".to_string(), "core".to_string()]) {
        model.parts = parts;
    }
    model
}

// Silverfish
pub fn silverfish_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "silverfish".to_string();
    model.root_names = (0..7).map(|i| format!("part{}", i)).chain((0..3).map(|i| format!("wing{}", i))).collect();
    model.texture = "entity/silverfish.png".to_string();

    if let Some(parts) = build_jar_model("silverfish", &["parts".to_string(), "wings".to_string()]) {
        model.parts = parts;
    }
    model
}

// Endermite
pub fn endermite_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "endermite".to_string();
    model.root_names = (0..4).map(|i| format!("part{}", i)).collect();
    model.texture = "entity/endermite.png".to_string();

    if let Some(parts) = build_jar_model("endermite", &["parts".to_string()]) {
        model.parts = parts;
    }
    model
}

// Blaze
pub fn blaze_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "blaze".to_string();
    model.root_names = vec!["head".to_string()]
        .into_iter()
        .chain((0..12).map(|i| format!("rod{}", i)))
        .collect();
    model.texture = "entity/blaze/blaze.png".to_string();

    if let Some(parts) = build_jar_model("blaze", &["rods".to_string(), "head".to_string()]) {
        model.parts = parts;
    }
    model
}

// Ghast
pub fn ghast_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "ghast".to_string();
    model.root_names = vec!["body".to_string()]
        .into_iter()
        .chain((0..9).map(|i| format!("tentacle{}", i)))
        .collect();
    model.model_scale = 4.5;
    model.texture = "entity/ghast/ghast.png".to_string();

    if let Some(parts) = build_jar_model("ghast", &["body".to_string(), "tentacles".to_string()]) {
        model.parts = parts;
    }
    model
}

// Guardian
pub fn guardian_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "guardian".to_string();
    model.root_names = vec!["body".to_string()];
    model.texture = "entity/guardian.png".to_string();

    if let Some(parts) = build_jar_model("guardian", &["body".to_string(), "eye".to_string(), "spikes".to_string(), "tail".to_string()]) {
        model.parts = parts;
    }
    model
}

// Bat
pub fn bat_model() -> EntityModel {
    let part_names = ["head", "body", "rightWing", "leftWing", "rightWingTip", "leftWingTip"];
    let mut model = EntityModel::default();
    model.name = "bat".to_string();
    model.root_names = vec!["head", "body"].into_iter().map(String::from).collect();
    model.model_scale = 0.35;
    model.texture = "entity/bat.png".to_string();

    if let Some(parts) = build_jar_model("bat", &part_names) {
        model.parts = parts;
    }
    model
}

// Squid
pub fn squid_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "squid".to_string();
    model.root_names = vec!["body".to_string()].into_iter().chain((0..8).map(|i| format!("tentacle{}", i))).collect();
    model.texture = "entity/squid.png".to_string();

    if let Some(parts) = build_jar_model("squid", &["body".to_string(), "tentacles".to_string()]) {
        model.parts = parts;
    }
    model
}

// Iron Golem
pub fn iron_golem_model() -> EntityModel {
    let part_names = ["head", "body", "rightArm", "leftArm", "leftLeg", "rightLeg"];
    let mut model = EntityModel::default();
    model.name = "ironGolem".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/iron_golem.png".to_string();

    if let Some(parts) = build_jar_model("ironGolem", &part_names) {
        model.parts = parts;
    }
    model
}

// Snowman
pub fn snowman_model() -> EntityModel {
    let part_names = ["body", "bottomBody", "head", "rightHand", "leftHand"];
    let mut model = EntityModel::default();
    model.name = "snowman".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/snowman.png".to_string();

    if let Some(parts) = build_jar_model("snowman", &part_names) {
        model.parts = parts;
    }
    model
}

// Wither
pub fn wither_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "wither".to_string();
    model.root_names = vec!["shoulders", "spine", "tail", "head1", "head2", "head3"].into_iter().map(String::from).collect();
    model.model_scale = 2.0;
    model.texture = "entity/wither/wither.png".to_string();

    if let Some(parts) = build_jar_model("wither", &["upper".to_string(), "heads".to_string()]) {
        model.parts = parts;
    }
    model
}

// Armor Stand
pub fn armor_stand_model() -> EntityModel {
    let part_names = ["head", "", "body", "rightArm", "leftArm", "rightLeg", "leftLeg", "rightSide", "leftSide", "waist", "base"];
    let mut model = EntityModel::default();
    model.name = "armorStand".to_string();
    model.root_names = part_names.iter().filter(|s| !s.is_empty()).map(|s| s.to_string()).collect();
    model.texture = "entity/armor_stand.png".to_string();

    if let Some(parts) = build_jar_model("armorStand", &part_names) {
        model.parts = parts;
    }
    model
}

// Drowned
pub fn drowned_model(outer: bool) -> EntityModel {
    let name = if outer { "drownedOuter" } else { "drowned" };
    let mut model = make_biped(name);
    model.texture = format!("entity/zombie/drowned{}.png", if outer { "_outer_layer" } else { "" });
    model
}

// Fish
pub fn cod_model() -> EntityModel {
    let part_names = ["body", "dorsalFin", "head", "nose", "rightFin", "leftFin", "tail"];
    let mut model = EntityModel::default();
    model.name = "cod".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/fish/cod.png".to_string();

    if let Some(parts) = build_jar_model("cod", &part_names) {
        model.parts = parts;
    }
    model
}

pub fn salmon_model() -> EntityModel {
    let part_names = ["body", "backBody", "head", "frontDorsalFin", "backDorsalFin", "tail", "rightFin", "leftFin"];
    let mut model = EntityModel::default();
    model.name = "salmon".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/fish/salmon.png".to_string();

    if let Some(parts) = build_jar_model("salmon", &part_names) {
        model.parts = parts;
    }
    model
}

pub fn pufferfish_model(size: u8) -> EntityModel {
    let index = size.min(2);
    let names = [
        vec!["body", "rightEye", "leftEye", "rightFin", "leftFin", "tail"],
        vec!["body", "rightFin", "leftFin", "topFrontSpikes", "topBackSpikes", "rightFrontSpikes", "rightBackSpikes", "leftBackSpikes", "leftFrontSpikes", "bottomBackSpikes", "bottomFrontSpikes"],
        vec!["body", "rightFin", "leftFin", "topFrontSpikes", "topMiddleSpikes", "topBackSpikes", "rightFrontSpikes", "leftFrontSpikes", "bottomFrontSpikes", "bottomBackSpikes", "bottomMiddleSpikes", "rightBackSpikes", "leftBackSpikes"],
    ];
    let model_names = ["pufferfishSmall", "pufferfishMedium", "pufferfishBig"];

    let mut model = EntityModel::default();
    model.name = model_names[index as usize].to_string();
    model.root_names = names[index as usize].iter().map(|s| s.to_string()).collect();
    model.texture = "entity/fish/pufferfish.png".to_string();
    model.puff_state = Some(index);

    if let Some(parts) = build_jar_model(model_names[index as usize], &names[index as usize]) {
        model.parts = parts;
    }
    model
}

pub fn tropical_fish_model(shape: u8, pattern: bool) -> EntityModel {
    let large = shape == 1;
    let suffix = if large { "B" } else { "A" };
    let model_name = format!("tropicalFish{}{}", if pattern { "Pattern" } else { "" }, suffix);

    let mut part_names = vec!["body", "tail", "rightFin", "leftFin", "topFin"];
    if large { part_names.push("bottomFin"); }

    let mut model = EntityModel::default();
    model.name = model_name.clone();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = format!("entity/fish/tropical_{}{}.png", suffix.to_lowercase(), if pattern { "_pattern_1" } else { "" });
    model.pattern = pattern;

    if let Some(parts) = build_jar_model(&model_name, &part_names) {
        model.parts = parts;
    }
    model
}

pub fn dolphin_model() -> EntityModel {
    let part_names = ["head", "body", "tail", "tailFin"];
    let mut model = EntityModel::default();
    model.name = "dolphin".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/dolphin.png".to_string();

    if let Some(parts) = build_jar_model("dolphin", &part_names) {
        model.parts = parts;
    }
    model
}

pub fn turtle_model() -> EntityModel {
    let mut part_names = QUADRUPED.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    part_names.push("eggBelly".to_string());

    let mut model = EntityModel::default();
    model.name = "turtle".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/turtle/big_sea_turtle.png".to_string();
    model.child_scale = 1.0 / 6.0;

    if let Some(parts) = build_jar_model("turtle", &part_names) {
        model.parts = parts;
    }
    model
}

pub fn phantom_model(size: u8) -> EntityModel {
    let part_names = ["body", "leftWing", "leftWingTip", "rightWing", "rightWingTip", "head", "tail", "tailTip"];
    let mut model = EntityModel::default();
    model.name = "phantom".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.model_scale = 1.0 + 0.15 * (size as f64).min(64.0);
    model.model_translate_y = 1.3125;
    model.model_translate_z = 0.1875;
    model.texture = "entity/phantom.png".to_string();

    if let Some(parts) = build_jar_model("phantom", &part_names) {
        model.parts = parts;
    }
    model
}

// Projectiles
pub fn trident_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "trident".to_string();
    model.root_names = vec!["shaft".to_string()];
    model.texture = "entity/trident.png".to_string();

    if let Some(parts) = build_jar_model("trident", &["shaft".to_string()]) {
        model.parts = parts;
    }
    model
}

pub fn llama_spit_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "llamaSpit".to_string();
    model.root_names = vec!["body".to_string()];
    model.texture = "entity/llama/spit.png".to_string();

    if let Some(parts) = build_jar_model("llamaSpit", &["body".to_string()]) {
        model.parts = parts;
    }
    model
}

pub fn shulker_bullet_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "shulkerBullet".to_string();
    model.root_names = vec!["body".to_string()];
    model.model_scale = 0.5;
    model.texture = "entity/shulker/spark.png".to_string();

    if let Some(parts) = build_jar_model("shulkerBullet", &["body".to_string()]) {
        model.parts = parts;
    }
    model
}

pub fn evoker_fangs_model() -> EntityModel {
    let mut model = EntityModel::default();
    model.name = "evokerFangs".to_string();
    model.root_names = vec!["base", "upperJaw", "lowerJaw"].into_iter().map(String::from).collect();
    model.model_translate_y = -1.252;
    model.texture = "entity/illager/evoker_fangs.png".to_string();

    if let Some(parts) = build_jar_model("evokerFangs", &["base".to_string(), "upperJaw".to_string(), "lowerJaw".to_string()]) {
        model.parts = parts;
    }
    model
}

// Vehicles
pub fn elytra_model() -> EntityModel {
    let part_names = ["rightWing", "leftWing"];
    let mut model = EntityModel::default();
    model.name = "elytra".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/elytra.png".to_string();

    if let Some(parts) = build_jar_model("elytra", &part_names) {
        model.parts = parts;
    }
    model
}

pub fn shulker_model() -> EntityModel {
    let part_names = ["base", "lid", "head"];
    let mut model = EntityModel::default();
    model.name = "shulker".to_string();
    model.root_names = part_names.iter().map(|s| s.to_string()).collect();
    model.texture = "entity/shulker/shulker.png".to_string();

    if let Some(parts) = build_jar_model("shulker", &part_names) {
        model.parts = parts;
    }
    model
}

pub fn boat_model() -> EntityModel {
    let part_names = ["sides", "paddles", "noWater"];
    let mut model = EntityModel::default();
    model.name = "boat".to_string();
    model.root_names = vec!["side0","side1","side2","side3","side4","paddle0","paddle1"].into_iter().map(String::from).collect();
    model.texture = "entity/boat/oak.png".to_string();

    if let Some(parts) = build_jar_model("boat", &part_names) {
        model.parts = parts;
    }
    model
}

pub fn minecart_model() -> EntityModel {
    let part_names = ["sides"];
    let mut model = EntityModel::default();
    model.name = "minecart".to_string();
    model.root_names = (0..6).map(|i| format!("side{}", i)).collect();
    model.texture = "entity/minecart.png".to_string();

    if let Some(parts) = build_jar_model("minecart", &part_names) {
        model.parts = parts;
    }
    model
}

pub fn armor_model(inflate: f64) -> EntityModel {
    let name = if inflate < 0.75 { "armorInner" } else { "armorOuter" };
    make_biped(name)
}

pub fn entity_model_dragon_parts() -> Value {
    let names = ["head", "spine", "jaw", "body", "rearLeg", "frontLeg", "rearLegTip", "frontLegTip", "rearFoot", "frontFoot", "wing", "wingTip"];
    json!({ "names": names })
}

pub fn block_model(name: &str, part_names: Vec<String>) -> Option<HashMap<String, ModelPart>> {
    build_jar_model(name, &part_names.iter().map(|s| s.as_str()).collect::<Vec<_>>())
}

// ============================================================================
// Animation Exports
// ============================================================================

#[wasm_bindgen]
pub fn animate_biped_model(model_json: &str, args_json: &str) -> String {
    let mut model: EntityModel = match serde_json::from_str(model_json) {
        Ok(m) => m,
        Err(_) => return "null".to_string(),
    };
    let args: AnimationArgs = match serde_json::from_str::<AnimationArgs>(args_json) {
        Ok(a) => a.normalize(),
        Err(_) => return "null".to_string(),
    };

    animate_biped(&mut model.parts, &args);
    serde_json::to_string(&model).unwrap_or_else(|_| "null".to_string())
}

#[wasm_bindgen]
pub fn animate_quadruped_model(model_json: &str, args_json: &str) -> String {
    let mut model: EntityModel = match serde_json::from_str(model_json) {
        Ok(m) => m,
        Err(_) => return "null".to_string(),
    };
    let args: AnimationArgs = match serde_json::from_str::<AnimationArgs>(args_json) {
        Ok(a) => a.normalize(),
        Err(_) => return "null".to_string(),
    };

    animate_quadruped(&mut model.parts, &args);
    serde_json::to_string(&model).unwrap_or_else(|_| "null".to_string())
}

#[wasm_bindgen]
pub fn animate_zombie_model(model_json: &str, args_json: &str) -> String {
    let mut model: EntityModel = match serde_json::from_str(model_json) {
        Ok(m) => m,
        Err(_) => return "null".to_string(),
    };
    let args: AnimationArgs = match serde_json::from_str::<AnimationArgs>(args_json) {
        Ok(a) => a.normalize(),
        Err(_) => return "null".to_string(),
    };

    let mut model = make_biped("zombie");
    if let Some(parts) = build_jar_model("zombie", &["head", "", "body", "leg1", "leg2", "leg3", "leg4"]) {
        model.parts = parts;
    }
    animate_biped(&mut model.parts, &args);
    serde_json::to_string(&model).unwrap_or_else(|_| "null".to_string())
}

#[wasm_bindgen]
pub fn animate_skeleton_model(model_json: &str, args_json: &str) -> String {
    let mut model: EntityModel = match serde_json::from_str(model_json) {
        Ok(m) => m,
        Err(_) => return "null".to_string(),
    };
    let args: AnimationArgs = match serde_json::from_str::<AnimationArgs>(args_json) {
        Ok(a) => a.normalize(),
        Err(_) => return "null".to_string(),
    };

    let mut model = make_biped("skeleton");
    if let Some(parts) = build_jar_model("skeleton", &["head", "", "body", "leg1", "leg2", "leg3", "leg4"]) {
        model.parts = parts;
    }
    animate_biped(&mut model.parts, &args);
    serde_json::to_string(&model).unwrap_or_else(|_| "null".to_string())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_biped_model_has_parts() {
        let model = biped_model("test");
        assert!(!model.parts.is_empty());
        assert!(model.root_names.contains(&"head".to_string()));
    }

    #[test]
    fn test_animation_args_normalize() {
        let args = AnimationArgs {
            ls: 1.0,
            lsa: 0.5,
            age: 10.0,
            yaw: 45.0,
            pitch: 30.0,
            partial: 0.5,
            ..Default::default()
        };
        let normalized = args.normalize();
        assert!(normalized.ls.is_finite());
        assert!(normalized.age.is_finite());
    }

    #[test]
    fn test_frame_count() {
        let model = player_model(false);
        assert!(!model.parts.is_empty());
    }

    #[test]
    fn test_entity_model_default() {
        let model = EntityModel::default();
        assert!(model.name.is_empty());
        assert!(model.parts.is_empty());
        assert!(model.root_names.is_empty());
    }
}