// Port of `client/js/resource-models.js`.
//
// Pack traversal for models, blockstates and textures. The JS walks
// `pack.zip` (lib/zip.js) with a `pack.prefix`; the Rust port drives the
// already-ported `crate::zip::ZipArchive` the same way. JSON decoding uses
// serde_json (the JS `new TextDecoder().decode` + `JSON.parse`).

use std::collections::HashMap;

use crate::zip::ZipArchive;

/// JS: `export const resourceName=name=>typeof name==='string'?name.replace(/^minecraft:/,''):name;`
///
/// ResourceLocation's default namespace is minecraft; keep other namespaces
/// distinct.
pub fn resource_name(name: &str) -> String {
    name.strip_prefix("minecraft:").unwrap_or(name).to_string()
}

/// JS: the `packEntries` entry shape `{ name, key, read }` — the Rust port
/// returns the path and lets callers read through the archive.
#[derive(Debug, Clone)]
pub struct PackEntry {
    /// JS: `name` — the path under `kind/`.
    pub name: String,
    /// JS: `key` — the map key with the default namespace stripped.
    pub key: String,
    /// JS: `read: () => pack.zip.read(path)` — the archive path to read.
    pub path: String,
}

/// JS: `export function packEntries(pack,kind)`.
///
/// `pack.prefix` + `pack.zip` are the two fields used; the Rust caller passes
/// them separately.
pub fn pack_entries(pack: &ZipArchive, prefix: &str, kind: &str) -> Vec<PackEntry> {
    // JS: const prefix=pack.prefix+'assets/',out=[];
    let full_prefix = format!("{}assets/", prefix);
    let mut out = Vec::new();
    // JS: for(const path of pack.zip.list(prefix)){
    for path in pack.list(&full_prefix) {
        // JS: const relative=path.slice(prefix.length),slash=relative.indexOf('/');
        //     if(slash<1)continue;
        let relative = &path[full_prefix.len()..];
        let Some(slash) = relative.find('/') else { continue };
        if slash < 1 {
            continue;
        }
        // JS: const namespace=relative.slice(0,slash),rest=relative.slice(slash+1);
        //     if(!rest.startsWith(kind+'/'))continue;
        let namespace = &relative[..slash];
        let rest = &relative[slash + 1..];
        let kind_prefix = format!("{}/", kind);
        if !rest.starts_with(&kind_prefix) {
            continue;
        }
        // JS: const name=rest.slice(kind.length+1),
        //      key=(namespace==='minecraft'?'':namespace+':')+name;
        let name = &rest[kind.len() + 1..];
        let key = if namespace == "minecraft" {
            name.to_string()
        } else {
            format!("{}:{}", namespace, name)
        };
        out.push(PackEntry { name: name.to_string(), key, path });
    }
    out
}

/// JS: `export function applyPackModels(packs,models,blockstates)`.
///
/// `packs` is a list of `(prefix, archive)` pairs (the JS pack objects carry
/// exactly `prefix` and `zip`).
pub fn apply_pack_models(
    packs: &[(&str, &ZipArchive)],
    models: &mut HashMap<String, serde_json::Value>,
    blockstates: &mut HashMap<String, serde_json::Value>,
) {
    // JS: for(const pack of packs)for(const [kind,target]of [['models',models],['blockstates',blockstates]]){
    for (prefix, archive) in packs {
        for kind in ["models", "blockstates"] {
            let target = if kind == "models" { &mut *models } else { &mut *blockstates };
            // JS: for(const entry of packEntries(pack,kind))if(entry.name.endsWith('.json')){
            for entry in pack_entries(archive, prefix, kind) {
                if entry.name.ends_with(".json") {
                    // JS: try{target[entry.key.slice(0,-5)]=JSON.parse(new TextDecoder().decode(entry.read()));}
                    //     catch{ /* Ignore malformed optional files. */ }
                    if let Some(bytes) = archive.read(&entry.path) {
                        if let Ok(text) = std::str::from_utf8(&bytes) {
                            if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
                                target.insert(entry.key[..entry.key.len() - 5].to_string(), v);
                            }
                        }
                    }
                }
            }
        }
    }
}

/// JS: `export function applyPackTextures(packs,files,mcmeta,models)`.
pub fn apply_pack_textures(
    packs: &[(&str, &ZipArchive)],
    files: &mut HashMap<String, Vec<u8>>,
    mcmeta: &mut HashMap<String, serde_json::Value>,
    models: &HashMap<String, serde_json::Value>,
) {
    // JS: const referenced=new Set();
    // JS: for(const model of Object.values(models))
    //     for(const name of Object.values(model.textures||{}))
    //         if(typeof name==='string'&&!name.startsWith('#'))referenced.add(resourceName(name));
    let mut referenced = std::collections::HashSet::new();
    for model in models.values() {
        if let Some(textures) = model.get("textures").and_then(|t| t.as_object()) {
            for name in textures.values() {
                if let Some(s) = name.as_str() {
                    if !s.starts_with('#') {
                        referenced.insert(resource_name(s));
                    }
                }
            }
        }
    }
    // JS: for(const pack of packs)for(const entry of packEntries(pack,'textures')){
    for (prefix, archive) in packs {
        for entry in pack_entries(archive, prefix, "textures") {
            // JS: const png=entry.key.endsWith('.png'),metadata=entry.key.endsWith('.png.mcmeta');
            //     if(!png&&!metadata)continue;
            let png = entry.key.ends_with(".png");
            let metadata = entry.key.ends_with(".png.mcmeta");
            if !png && !metadata {
                continue;
            }
            // JS: const key=entry.key.slice(0,png?-4:-11);
            let key = if png {
                &entry.key[..entry.key.len() - 4]
            } else {
                &entry.key[..entry.key.len() - 11]
            };
            // JS: if(!/^(blocks?|items?)\//.test(entry.name)&&!referenced.has(key))continue;
            let in_standard_dir = entry.name.starts_with("block/")
                || entry.name.starts_with("blocks/")
                || entry.name.starts_with("item/")
                || entry.name.starts_with("items/");
            if !in_standard_dir && !referenced.contains(key) {
                continue;
            }
            // JS: if(png)files.set(key,entry.read);
            //     else try{mcmeta[key]=JSON.parse(new TextDecoder().decode(entry.read()));}
            //     catch{ /* Invalid animation metadata. */ }
            if png {
                if let Some(bytes) = archive.read(&entry.path) {
                    files.insert(key.to_string(), bytes);
                }
            } else if let Some(bytes) = archive.read(&entry.path) {
                if let Ok(text) = std::str::from_utf8(&bytes) {
                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(text) {
                        mcmeta.insert(key.to_string(), v);
                    }
                }
            }
        }
    }
}
