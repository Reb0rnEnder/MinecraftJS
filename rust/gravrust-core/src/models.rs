//! Port of `client/js/render/models.js`: block/item model resolution and
//! baking (vanilla `FaceBakery`), plus the variant and multipart selection
//! used by the chunk mesher and the inventory renderer.
//!
//! The atlas is passed as a lookup table (`{ name: { uv: [u0,v0,u1,v1], alpha } }`)
//! so baking is pure data in Rust; the browser still owns texture uploads.

use std::collections::HashMap;

use serde_json::{json, Map, Value};
use wasm_bindgen::prelude::*;

pub const FACE_INDEX: [&str; 6] = ["down", "up", "north", "south", "west", "east"];
pub const DIR_VEC: [[f64; 3]; 6] = [
    [0.0, -1.0, 0.0],
    [0.0, 1.0, 0.0],
    [0.0, 0.0, -1.0],
    [0.0, 0.0, 1.0],
    [-1.0, 0.0, 0.0],
    [1.0, 0.0, 0.0],
];
const FACE_CORNERS: [[[f64; 3]; 4]; 6] = [
    [[0.0, 0.0, 1.0], [0.0, 0.0, 0.0], [1.0, 0.0, 0.0], [1.0, 0.0, 1.0]],
    [[0.0, 1.0, 0.0], [0.0, 1.0, 1.0], [1.0, 1.0, 1.0], [1.0, 1.0, 0.0]],
    [[1.0, 1.0, 0.0], [1.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 1.0, 0.0]],
    [[0.0, 1.0, 1.0], [0.0, 0.0, 1.0], [1.0, 0.0, 1.0], [1.0, 1.0, 1.0]],
    [[0.0, 1.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 1.0], [0.0, 1.0, 1.0]],
    [[1.0, 1.0, 1.0], [1.0, 0.0, 1.0], [1.0, 0.0, 0.0], [1.0, 1.0, 0.0]],
];

fn resource_name(name: &str) -> &str {
    name.strip_prefix("minecraft:").unwrap_or(name)
}

fn num(value: &Value) -> f64 {
    value.as_f64().unwrap_or(0.0)
}

fn arr3(value: &Value) -> [f64; 3] {
    [
        value.get(0).map(num).unwrap_or(0.0),
        value.get(1).map(num).unwrap_or(0.0),
        value.get(2).map(num).unwrap_or(0.0),
    ]
}

#[derive(Clone, Debug)]
pub struct AtlasEntry {
    pub uv: [f64; 4],
    pub alpha: bool,
}

#[derive(Clone, Debug)]
pub struct ResolvedModel {
    pub name: String,
    pub textures: Map<String, Value>,
    pub elements: Option<Vec<Value>>,
    pub ao: bool,
    pub gui_light: String,
    pub display: Value,
    pub builtin: Option<String>,
    pub overrides: Value,
}

impl ResolvedModel {
    fn resolve_tex(&self, texture: Option<&Value>) -> Option<String> {
        let mut current = texture?.as_str()?.to_string();
        let mut guard = 0;
        while current.starts_with('#') && guard < 16 {
            guard += 1;
            let key = &current[1..];
            current = self.textures.get(key)?.as_str()?.to_string();
        }
        if current.is_empty() {
            return None;
        }
        Some(resource_name(&current).to_string())
    }
}

#[derive(Clone, Debug)]
pub struct ModelStore {
    models: Map<String, Value>,
    blockstates: Map<String, Value>,
    atlas: HashMap<String, AtlasEntry>,
    resolved: HashMap<String, ResolvedModel>,
    baked: HashMap<String, Value>,
    variants: HashMap<String, Vec<(String, Map<String, Value>, Value)>>,
}

impl ModelStore {
    pub fn new(models_json: &str, blockstates_json: &str, atlas_json: &str) -> Result<ModelStore, String> {
        let models = serde_json::from_str::<Value>(models_json)
            .map_err(|e| format!("models: {e}"))?
            .as_object()
            .cloned()
            .ok_or("models is not an object")?;
        let blockstates = serde_json::from_str::<Value>(blockstates_json)
            .map_err(|e| format!("blockstates: {e}"))?
            .as_object()
            .cloned()
            .ok_or("blockstates is not an object")?;
        let atlas_value = serde_json::from_str::<Value>(atlas_json).map_err(|e| format!("atlas: {e}"))?;
        let mut atlas = HashMap::new();
        if let Some(map) = atlas_value.as_object() {
            for (name, entry) in map {
                let uv = entry.get("uv").map(arr4).unwrap_or([0.0; 4]);
                atlas.insert(
                    name.clone(),
                    AtlasEntry { uv, alpha: entry.get("alpha").and_then(|v| v.as_bool()).unwrap_or(false) },
                );
            }
        }
        Ok(ModelStore {
            models,
            blockstates,
            atlas,
            resolved: HashMap::new(),
            baked: HashMap::new(),
            variants: HashMap::new(),
        })
    }

    pub fn atlas_uv(&self, name: &str) -> Option<[f64; 4]> {
        self.atlas
            .get(name)
            .or_else(|| self.atlas.get("block/stone"))
            .map(|e| e.uv)
    }

    /// Get blockstates map for mesher access
    pub fn blockstates(&self) -> &Map<String, Value> {
        &self.blockstates
    }

    pub fn atlas_has_alpha(&self, name: &str) -> bool {
        self.atlas.get(name).map(|e| e.alpha).unwrap_or(false)
    }

    pub fn resolve_model(&mut self, name: &str) -> ResolvedModel {
        let name = resource_name(name).to_string();
        if let Some(found) = self.resolved.get(&name) {
            return found.clone();
        }
        let mut chain: Vec<Value> = Vec::new();
        let mut current = name.clone();
        let mut guard = 0;
        while !current.is_empty() && guard < 32 {
            guard += 1;
            if current.starts_with("builtin/") {
                chain.push(json!({ "builtin": current }));
                break;
            }
            let found = self
                .models
                .get(&current)
                .or_else(|| self.models.get(&format!("block/{}", current)))
                .cloned();
            let Some(model) = found else { break };
            let parent = model
                .get("parent")
                .and_then(|p| p.as_str())
                .map(|p| resource_name(p).to_string());
            chain.push(model);
            match parent {
                Some(parent) => current = parent,
                None => break,
            }
        }

        let mut textures = Map::new();
        let mut elements: Option<Vec<Value>> = None;
        let mut ao = true;
        let mut gui_light = "side".to_string();
        let mut display = Value::Object(Map::new());
        let mut builtin = None;
        for model in chain.iter().rev() {
            if let Some(b) = model.get("builtin").and_then(|b| b.as_str()) {
                builtin = Some(b.to_string());
                continue;
            }
            if let Some(map) = model.get("textures").and_then(|t| t.as_object()) {
                for (k, v) in map {
                    textures.insert(k.clone(), v.clone());
                }
            }
            if let Some(list) = model.get("elements").and_then(|e| e.as_array()) {
                elements = Some(list.clone());
            }
            if model.get("ambientocclusion").and_then(|v| v.as_bool()) == Some(false) {
                ao = false;
            }
            if let Some(light) = model.get("gui_light").and_then(|v| v.as_str()) {
                gui_light = light.to_string();
            }
            if let Some(map) = model.get("display").and_then(|d| d.as_object()) {
                let mut merged = display.as_object().cloned().unwrap_or_default();
                for (k, v) in map {
                    merged.insert(k.clone(), v.clone());
                }
                display = Value::Object(merged);
            }
        }
        let overrides = chain
            .first()
            .filter(|m| m.get("builtin").is_none())
            .and_then(|m| m.get("overrides").cloned())
            .unwrap_or(Value::Null);

        let resolved = ResolvedModel { name: name.clone(), textures, elements, ao, gui_light, display, builtin, overrides };
        self.resolved.insert(name, resolved.clone());
        resolved
    }

    pub fn bake_model(&mut self, model_name: &str, rx: i32, ry: i32, uvlock: bool) -> Value {
        let key = format!("{}|{}|{}|{}", model_name, rx, ry, if uvlock { 1 } else { 0 });
        if let Some(baked) = self.baked.get(&key) {
            return baked.clone();
        }
        let m = self.resolve_model(model_name);
        let mut quads: Vec<Value> = Vec::new();
        let mut bounds: Option<[f64; 6]> = None;
        if let Some(elements) = &m.elements {
            for el in elements {
                if let Some(faces) = el.get("faces").and_then(|f| f.as_object()) {
                    for (face_name, face) in faces {
                        let Some(dir) = FACE_INDEX.iter().position(|f| f == face_name) else { continue };
                        if let Some(q) = self.bake_face(&m, el, dir, face, rx, ry, uvlock) {
                            quads.push(q);
                        }
                    }
                }
                let from = arr3(el.get("from").unwrap_or(&Value::Null));
                let to = arr3(el.get("to").unwrap_or(&Value::Null));
                let bb = rotate_box(from, to, rx, ry);
                bounds = Some(match bounds {
                    None => bb,
                    Some(mut b) => {
                        for i in 0..3 {
                            b[i] = b[i].min(bb[i]);
                            b[i + 3] = b[i + 3].max(bb[i + 3]);
                        }
                        b
                    }
                });
            }
        }
        let particle = m.resolve_tex(m.textures.get("particle"));
        let baked = json!({
            "quads": quads,
            "ao": m.ao,
            "bounds": bounds.map(|b| b.to_vec()),
            "particle": particle,
            "builtin": m.builtin,
            "display": m.display,
        });
        self.baked.insert(key, baked.clone());
        baked
    }

    fn bake_face(
        &self,
        m: &ResolvedModel,
        el: &Value,
        dir: usize,
        face: &Value,
        rx: i32,
        ry: i32,
        uvlock: bool,
    ) -> Option<Value> {
        let tex = m.resolve_tex(face.get("texture"))?;
        let auv = self.atlas_uv(&tex)?;
        let from = arr3(el.get("from").unwrap_or(&Value::Null));
        let to = arr3(el.get("to").unwrap_or(&Value::Null));
        let mut pos = [[0.0f64; 3]; 4];
        for i in 0..4 {
            let c = FACE_CORNERS[dir][i];
            pos[i] = [
                if c[0] > 0.5 { to[0] } else { from[0] },
                if c[1] > 0.5 { to[1] } else { from[1] },
                if c[2] > 0.5 { to[2] } else { from[2] },
            ];
        }
        if let Some(rotation) = el.get("rotation") {
            apply_element_rotation(&mut pos, rotation);
        }
        if rx != 0 || ry != 0 {
            for corner in pos.iter_mut() {
                rotate_vertex(corner, rx, ry);
            }
        }
        let ndir = rotate_dir(dir, rx, ry);
        let mut cull = face
            .get("cullface")
            .and_then(|c| c.as_str())
            .and_then(|c| FACE_INDEX.iter().position(|f| *f == c))
            .map(|d| d as i64)
            .unwrap_or(-1);
        if cull >= 0 {
            cull = rotate_dir(cull as usize, rx, ry) as i64;
        }

        let uvs = match face.get("uv") {
            Some(v) => arr4(v),
            None => default_uv(dir, from, to),
        };
        let rotation = (num(face.get("rotation").unwrap_or(&Value::Null)) / 90.0) as i32;
        let mut uv = [[0.0f64; 2]; 4];
        if uvlock && (rx != 0 || ry != 0) {
            for i in 0..4 {
                let x = pos[i][0];
                let y = pos[i][1];
                let z = pos[i][2];
                let (u, v) = match ndir {
                    0 => (x, 16.0 - z),
                    1 => (x, z),
                    2 => (16.0 - x, 16.0 - y),
                    3 => (x, 16.0 - y),
                    4 => (z, 16.0 - y),
                    _ => (16.0 - z, 16.0 - y),
                };
                uv[i] = [u, v];
            }
        } else {
            for i in 0..4 {
                let j = ((i as i32 + rotation).rem_euclid(4)) as usize;
                let u = uvs[if j != 0 && j != 1 { 2 } else { 0 }];
                let v = uvs[if j != 0 && j != 3 { 3 } else { 1 }];
                uv[i] = [u, v];
            }
        }
        let du = (auv[2] - auv[0]) / 16.0;
        let dv = (auv[3] - auv[1]) / 16.0;
        for i in 0..4 {
            uv[i][0] = auv[0] + uv[i][0] * du;
            uv[i][1] = auv[1] + uv[i][1] * dv;
        }
        let flat_pos: Vec<f64> = pos.iter().flat_map(|p| [p[0] / 16.0, p[1] / 16.0, p[2] / 16.0]).collect();
        let flat_uv: Vec<f64> = uv.iter().flat_map(|p| [p[0], p[1]]).collect();
        Some(json!({
            "pos": flat_pos,
            "uv": flat_uv,
            "dir": ndir,
            "cull": cull,
            "tint": face.get("tintindex").map(|v| v.as_i64().unwrap_or(-1)).unwrap_or(-1),
            "shade": el.get("shade").and_then(|v| v.as_bool()).unwrap_or(true),
            "alpha": self.atlas_has_alpha(&tex),
            "tex": tex,
        }))
    }

    pub fn find_variant(&mut self, file: &str, props: &Map<String, Value>, exact_key: Option<&str>) -> Option<Value> {
        let idx = self.variants_for(file);
        if idx.is_empty() {
            return None;
        }
        if let Some(key) = exact_key {
            if let Some((_, _, val)) = idx.iter().find(|(k, _, _)| k == key) {
                return Some(val.clone());
            }
        }
        let mut best: Option<Value> = None;
        let mut best_score: i64 = -1;
        for (_, variant_props, val) in idx.iter() {
            let mut ok = true;
            let mut score = 0i64;
            for (k, v) in variant_props {
                let Some(p) = props.get(k) else { continue };
                let textual = match p {
                    Value::String(s) => s.clone(),
                    Value::Bool(b) => b.to_string(),
                    Value::Number(n) => n.to_string(),
                    _ => p.to_string(),
                };
                if textual != v.as_str().unwrap_or("") {
                    ok = false;
                    break;
                }
                score += 1;
            }
            if ok && score > best_score {
                best = Some(val.clone());
                best_score = score;
            }
        }
        best.or_else(|| idx.first().map(|(_, _, v)| v.clone()))
    }

    fn variants_for(&mut self, file: &str) -> &Vec<(String, Map<String, Value>, Value)> {
        if !self.variants.contains_key(file) {
            let mut idx = Vec::new();
            if let Some(bs) = self.blockstates.get(file) {
                if let Some(variants) = bs.get("variants").and_then(|v| v.as_object()) {
                    for (key, val) in variants {
                        let mut props = Map::new();
                        if key != "normal" && key != "all" && key != "inventory" {
                            for kv in key.split(',') {
                                let mut parts = kv.splitn(2, '=');
                                let k = parts.next().unwrap_or("").to_string();
                                let v = parts.next().unwrap_or("").to_string();
                                props.insert(k, Value::String(v));
                            }
                        }
                        idx.push((key.clone(), props, val.clone()));
                    }
                }
            }
            self.variants.insert(file.to_string(), idx);
        }
        self.variants.get(file).unwrap()
    }

    pub fn bake_variant(&mut self, file: &str, props: &Map<String, Value>, exact_key: Option<&str>, rand: f64) -> Value {
        if let Some(bs) = self.blockstates.get(file).cloned() {
            if let Some(parts) = bs.get("multipart").and_then(|p| p.as_array()) {
                return self.bake_multipart(file, parts, props, rand);
            }
        }
        let variant = self
            .find_variant(file, props, exact_key)
            .and_then(|v| pick_weighted(&v, rand))
            .unwrap_or(Value::Null);
        if !variant.is_object() {
            return Value::Null;
        }
        let model = variant.get("model").and_then(|m| m.as_str()).unwrap_or("");
        let rx = variant.get("x").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        let ry = variant.get("y").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
        self.bake_model(model, rx, ry, variant.get("uvlock").and_then(|v| v.as_bool()).unwrap_or(false))
    }

    fn bake_multipart(&mut self, file: &str, parts: &[Value], props: &Map<String, Value>, rand: f64) -> Value {
        let mut picks: Vec<String> = Vec::new();
        for (i, part) in parts.iter().enumerate() {
            if let Some(when) = part.get("when") {
                if !match_when(when, props) {
                    continue;
                }
            }
            let apply = part.get("apply").cloned().unwrap_or(Value::Null);
            if let Some(picked) = pick_weighted(&apply, rand) {
                let index = if apply.is_array() {
                    apply.as_array().and_then(|list| list.iter().position(|v| v == &picked)).unwrap_or(0)
                } else {
                    0
                };
                picks.push(format!("{}:{}", i, index));
            }
        }
        let key = format!("mp|{}|{}", file, picks.join(","));
        if let Some(baked) = self.baked.get(&key) {
            return baked.clone();
        }
        let mut quads: Vec<Value> = Vec::new();
        let mut bounds: Option<[f64; 6]> = None;
        let mut first: Option<Value> = None;
        for pick in &picks {
            let mut split = pick.split(':');
            let i: usize = split.next().unwrap_or("0").parse().unwrap_or(0);
            let k: usize = split.next().unwrap_or("0").parse().unwrap_or(0);
            let apply = parts[i].get("apply").cloned().unwrap_or(Value::Null);
            let variant = if apply.is_array() {
                apply.get(k).cloned().unwrap_or(Value::Null)
            } else {
                apply.clone()
            };
            if !variant.is_object() {
                continue;
            }
            let model = variant.get("model").and_then(|m| m.as_str()).unwrap_or("");
            let rx = variant.get("x").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let ry = variant.get("y").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            let uvlock = variant.get("uvlock").and_then(|v| v.as_bool()).unwrap_or(false);
            let baked = self.bake_model(model, rx, ry, uvlock);
            if first.is_none() {
                first = Some(baked.clone());
            }
            if let Some(list) = baked.get("quads").and_then(|q| q.as_array()) {
                quads.extend(list.iter().cloned());
            }
            if let Some(b) = baked.get("bounds").and_then(|b| b.as_array()) {
                let bb = [
                    b[0].as_f64().unwrap_or(0.0),
                    b[1].as_f64().unwrap_or(0.0),
                    b[2].as_f64().unwrap_or(0.0),
                    b[3].as_f64().unwrap_or(0.0),
                    b[4].as_f64().unwrap_or(0.0),
                    b[5].as_f64().unwrap_or(0.0),
                ];
                bounds = Some(match bounds {
                    None => bb,
                    Some(mut current) => {
                        for j in 0..3 {
                            current[j] = current[j].min(bb[j]);
                            current[j + 3] = current[j + 3].max(bb[j + 3]);
                        }
                        current
                    }
                });
            }
        }
        let baked = json!({
            "quads": quads,
            "ao": first.as_ref().and_then(|f| f.get("ao")).cloned().unwrap_or(json!(true)),
            "bounds": bounds.map(|b| b.to_vec()),
            "particle": first.as_ref().and_then(|f| f.get("particle")).cloned().unwrap_or(Value::Null),
            "builtin": Value::Null,
            "display": first.as_ref().and_then(|f| f.get("display")).cloned().unwrap_or(json!({})),
        });
        self.baked.insert(key, baked.clone());
        baked
    }

    pub fn export_state(&self) -> String {
        json!({ "models": self.models.len(), "blockstates": self.blockstates.len() }).to_string()
    }
}

fn arr4(value: &Value) -> [f64; 4] {
    [
        value.get(0).map(num).unwrap_or(0.0),
        value.get(1).map(num).unwrap_or(0.0),
        value.get(2).map(num).unwrap_or(0.0),
        value.get(3).map(num).unwrap_or(0.0),
    ]
}

fn default_uv(dir: usize, from: [f64; 3], to: [f64; 3]) -> [f64; 4] {
    match dir {
        0 => [from[0], 16.0 - to[2], to[0], 16.0 - from[2]],
        1 => [from[0], from[2], to[0], to[2]],
        2 => [16.0 - to[0], 16.0 - to[1], 16.0 - from[0], 16.0 - from[1]],
        3 => [from[0], 16.0 - to[1], to[0], 16.0 - from[1]],
        4 => [from[2], 16.0 - to[1], to[2], 16.0 - from[1]],
        5 => [16.0 - to[2], 16.0 - to[1], 16.0 - from[2], 16.0 - from[1]],
        _ => [0.0, 0.0, 16.0, 16.0],
    }
}

fn apply_element_rotation(pos: &mut [[f64; 3]; 4], r: &Value) {
    let origin = match r.get("origin") {
        Some(value) if value.is_array() => arr3(value),
        _ => [8.0, 8.0, 8.0],
    };
    let angle = num(r.get("angle").unwrap_or(&Value::Null)) * std::f64::consts::PI / 180.0;
    let c = angle.cos();
    let s = angle.sin();
    let axis = r.get("axis").and_then(|a| a.as_str()).unwrap_or("y");
    let mut scale = [1.0, 1.0, 1.0];
    if r.get("rescale").and_then(|v| v.as_bool()).unwrap_or(false) {
        let k = if num(r.get("angle").unwrap_or(&Value::Null)).abs() == 22.5 {
            1.0 / (std::f64::consts::PI / 8.0).cos() - 1.0
        } else {
            1.0 / (std::f64::consts::PI / 4.0).cos() - 1.0
        };
        scale = match axis {
            "x" => [1.0, 1.0 + k, 1.0 + k],
            "y" => [1.0 + k, 1.0, 1.0 + k],
            _ => [1.0 + k, 1.0 + k, 1.0],
        };
    }
    for p in pos.iter_mut() {
        let x = p[0] - origin[0];
        let y = p[1] - origin[1];
        let z = p[2] - origin[2];
        let (mut nx, mut ny, mut nz) = (x, y, z);
        match axis {
            "x" => {
                ny = y * c - z * s;
                nz = y * s + z * c;
            }
            "z" => {
                nx = x * c - y * s;
                ny = x * s + y * c;
            }
            _ => {
                nx = x * c + z * s;
                nz = -x * s + z * c;
            }
        }
        p[0] = nx * scale[0] + origin[0];
        p[1] = ny * scale[1] + origin[1];
        p[2] = nz * scale[2] + origin[2];
    }
}

fn rotate_vertex(p: &mut [f64; 3], rx: i32, ry: i32) {
    let mut x = p[0] - 8.0;
    let mut y = p[1] - 8.0;
    let mut z = p[2] - 8.0;
    if rx != 0 {
        let a = -(rx as f64) * std::f64::consts::PI / 180.0;
        let c = a.cos().round();
        let s = a.sin().round();
        let ny = y * c - z * s;
        let nz = y * s + z * c;
        y = ny;
        z = nz;
    }
    if ry != 0 {
        let a = -(ry as f64) * std::f64::consts::PI / 180.0;
        let c = a.cos().round();
        let s = a.sin().round();
        let nx = x * c + z * s;
        let nz = -x * s + z * c;
        x = nx;
        z = nz;
    }
    p[0] = x + 8.0;
    p[1] = y + 8.0;
    p[2] = z + 8.0;
}

fn rotate_dir(dir: usize, rx: i32, ry: i32) -> usize {
    let mut v = [
        DIR_VEC[dir][0] * 8.0 + 8.0,
        DIR_VEC[dir][1] * 8.0 + 8.0,
        DIR_VEC[dir][2] * 8.0 + 8.0,
    ];
    rotate_vertex(&mut v, rx, ry);
    let x = (v[0] - 8.0).round();
    let y = (v[1] - 8.0).round();
    let z = (v[2] - 8.0).round();
    for (d, dv) in DIR_VEC.iter().enumerate() {
        if dv[0] * 8.0 == x && dv[1] * 8.0 == y && dv[2] * 8.0 == z {
            return d;
        }
    }
    dir
}

fn rotate_box(from: [f64; 3], to: [f64; 3], rx: i32, ry: i32) -> [f64; 6] {
    let mut a = from;
    let mut b = to;
    if rx != 0 || ry != 0 {
        rotate_vertex(&mut a, rx, ry);
        rotate_vertex(&mut b, rx, ry);
    }
    [
        a[0].min(b[0]) / 16.0,
        a[1].min(b[1]) / 16.0,
        a[2].min(b[2]) / 16.0,
        a[0].max(b[0]) / 16.0,
        a[1].max(b[1]) / 16.0,
        a[2].max(b[2]) / 16.0,
    ]
}

fn pick_weighted(value: &Value, rand: f64) -> Option<Value> {
    if !value.is_array() {
        return if value.is_null() { None } else { Some(value.clone()) };
    }
    let list = value.as_array()?;
    let total: i64 = list.iter().map(|e| e.get("weight").and_then(|w| w.as_i64()).unwrap_or(1)).sum();
    if total <= 0 {
        return list.first().cloned();
    }
    let mut r = rand.abs() as i64 % total;
    for e in list {
        r -= e.get("weight").and_then(|w| w.as_i64()).unwrap_or(1);
        if r < 0 {
            return Some(e.clone());
        }
    }
    list.first().cloned()
}

fn match_when(when: &Value, props: &Map<String, Value>) -> bool {
    if let Some(or) = when.get("OR").and_then(|o| o.as_array()) {
        return or.iter().any(|w| match_when(w, props));
    }
    if let Some(map) = when.as_object() {
        for (k, val) in map {
            let p = props
                .get(k)
                .map(|v| match v {
                    Value::String(s) => s.clone(),
                    Value::Bool(b) => b.to_string(),
                    Value::Number(n) => n.to_string(),
                    _ => v.to_string(),
                })
                .unwrap_or_else(|| "false".into());
            let wanted = match val {
                Value::String(s) => s.clone(),
                Value::Bool(b) => b.to_string(),
                Value::Number(n) => n.to_string(),
                _ => val.to_string(),
            };
            if !wanted.split('|').any(|v| v == p) {
                return false;
            }
        }
    }
    true
}

// --------------------------------------------------------------------- wasm

#[wasm_bindgen]
pub struct ModelStoreCore {
    inner: ModelStore,
}

impl ModelStoreCore {
    pub fn store(&mut self) -> &mut ModelStore {
        &mut self.inner
    }
}

#[wasm_bindgen]
impl ModelStoreCore {
    #[wasm_bindgen(constructor)]
    pub fn new(models_json: &str, blockstates_json: &str, atlas_json: &str) -> Result<ModelStoreCore, JsValue> {
        ModelStore::new(models_json, blockstates_json, atlas_json)
            .map(|inner| ModelStoreCore { inner })
            .map_err(|e| JsValue::from_str(&e))
    }

    pub fn bake_model_json(&mut self, name: &str, rx: i32, ry: i32, uvlock: bool) -> String {
        self.inner.bake_model(name, rx, ry, uvlock).to_string()
    }

    pub fn bake_variant_json(&mut self, file: &str, props_json: &str, exact_key: &str, rand: f64) -> String {
        let props = serde_json::from_str::<Value>(props_json)
            .ok()
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default();
        let key = if exact_key.is_empty() { None } else { Some(exact_key) };
        self.inner.bake_variant(file, &props, key, rand).to_string()
    }

    pub fn find_variant_json(&mut self, file: &str, props_json: &str, exact_key: &str) -> String {
        let props = serde_json::from_str::<Value>(props_json)
            .ok()
            .and_then(|v| v.as_object().cloned())
            .unwrap_or_default();
        let key = if exact_key.is_empty() { None } else { Some(exact_key) };
        self.inner.find_variant(file, &props, key).unwrap_or(Value::Null).to_string()
    }

    pub fn stats(&self) -> String {
        self.inner.export_state()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store() -> ModelStore {
        let models = json!({
            "block/stone": {
                "textures": { "all": "block/stone", "particle": "#all" },
                "elements": [{
                    "from": [0, 0, 0], "to": [16, 16, 16],
                    "faces": {
                        "down": { "texture": "#all", "cullface": "down" },
                        "up": { "texture": "#all" },
                        "north": { "texture": "#all" },
                        "south": { "texture": "#all" },
                        "west": { "texture": "#all" },
                        "east": { "texture": "#all" }
                    }
                }]
            },
            "block/child": { "parent": "block/stone", "textures": { "all": "block/dirt" } },
            "block/cube_all": {
                "textures": { "all": "block/stone" },
                "elements": [{ "from": [0,0,0], "to": [16,16,16], "faces": { "up": { "texture": "#all" } } }]
            }
        })
        .to_string();
        let atlas = json!({
            "block/stone": { "uv": [0.0, 0.0, 0.25, 0.25], "alpha": false },
            "block/dirt": { "uv": [0.25, 0.0, 0.5, 0.25], "alpha": true }
        })
        .to_string();
        ModelStore::new(&models, "{}", &atlas).unwrap()
    }

    #[test]
    fn resolves_parent_chains() {
        let mut s = store();
        let m = s.resolve_model("block/child");
        assert_eq!(m.textures.get("all").unwrap(), "block/dirt");
        let baked = s.bake_model("block/child", 0, 0, false);
        assert_eq!(baked["quads"].as_array().unwrap().len(), 6);
        assert_eq!(baked["quads"][0]["tex"], "block/dirt");
        assert_eq!(baked["quads"][0]["alpha"], true);
        assert_eq!(baked["particle"], "block/dirt");
    }

    #[test]
    fn bakes_atlas_uvs_and_positions() {
        let mut s = store();
        let baked = s.bake_model("block/stone", 0, 0, false);
        let quad = &baked["quads"][0];
        assert_eq!(quad["dir"], 0);
        assert_eq!(quad["cull"], 0);
        let pos = quad["pos"].as_array().unwrap();
        assert!(pos.iter().all(|v| v.as_f64().unwrap() >= 0.0 && v.as_f64().unwrap() <= 1.0));
        let uv = quad["uv"].as_array().unwrap();
        assert!(uv[0].as_f64().unwrap() >= 0.0);
    }

    #[test]
    fn rotates_and_uvlocks() {
        let mut s = store();
        let baked = s.bake_model("block/stone", 90, 0, true);
        assert_eq!(baked["quads"].as_array().unwrap().len(), 6);
        let dirs: Vec<i64> = baked["quads"].as_array().unwrap().iter().map(|q| q["dir"].as_i64().unwrap()).collect();
        assert!(dirs.contains(&5));
    }
}
