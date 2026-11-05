// Port of `client/js/game/attachment-placement.js`.
//
// BlockPlaceContext promotes the opposite clicked face, then uses the
// player's nearest look directions. Both wall and standing item variants use
// this order.
//
// Block lookups go through the ported `crate::blocks` registry
// (`def(state)`, `find_state`, state properties); the native placement
// support bitmasks (from blockCollisionShapes.json, read by the JS
// `shapesData?.support?.states[state]`) reach the port through the
// [`PlacementSupport`] contract.

use crate::blocks::BlockRegistryCore;

/// JS: the direction constants from world/blocks.js —
/// `DIR_OFFSETS`, `DIR_NAMES`, `OPPOSITE` (already ported in blocks.rs).
pub use crate::blocks::{DIR_NAMES, DIR_OFFSETS, OPPOSITE};

/// JS: `shapesData?.support?.states[state]` — the native placement support
/// table: two bitmasks per state (index 0 = centre placement, 1 = edge), bit
/// N = face N is supported. Missing data is an error in the JS.
pub trait PlacementSupport {
    /// JS: `shapesData?.support?.states[state]` — `None` when the table has
    /// no entry for the state.
    fn support_bits(&self, state: u32) -> Option<[u8; 2]>;
}

/// JS: `export function blockFaceSupports(state,face,center=false)` from
/// world/blocks.js — ported here against the support contract.
pub fn block_face_supports(
    support: &dyn PlacementSupport,
    state: u32,
    face: usize,
    center: bool,
) -> Result<bool, String> {
    // JS: const native=shapesData?.support?.states[state];
    //     if(!native)throw Error('Missing native placement support data for state '+state);
    let Some(native) = support.support_bits(state) else {
        return Err(format!("Missing native placement support data for state {}", state));
    };
    // JS: return !!(native[center?0:1]&(1<<face));
    Ok(native[if center { 0 } else { 1 }] & (1 << face) != 0)
}

/// JS: the `player` fields the direction sort reads (`player.yaw`, `player.pitch`).
#[derive(Debug, Clone, Copy, Default)]
pub struct PlacementPlayer {
    pub yaw: f64,
    pub pitch: f64,
}

/// JS: the `block` fields used: `name` and `defaultState`.
#[derive(Debug, Clone)]
pub struct PlacementBlock {
    pub name: String,
    pub default_state: u32,
}

/// The world accessors the placement needs.
pub trait PlacementWorld {
    /// JS: `world.getState(x, y, z)`.
    fn get_state(&self, x: i32, y: i32, z: i32) -> u32;
}

/// JS: `export function attachmentDirections(player,face,replaceClicked)`.
///
/// Returns the six face indices, best-support first.
pub fn attachment_directions(player: &PlacementPlayer, face: usize, replace_clicked: bool) -> Vec<usize> {
    // JS: const yaw=(player.yaw||0)*Math.PI/180,pitch=(player.pitch||0)*Math.PI/180,
    //      look=[-Math.sin(yaw)*Math.cos(pitch),-Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
    let yaw = (if player.yaw != 0.0 { player.yaw } else { 0.0 }) * std::f64::consts::PI / 180.0;
    let pitch = (if player.pitch != 0.0 { player.pitch } else { 0.0 }) * std::f64::consts::PI / 180.0;
    let look = [
        -yaw.sin() * pitch.cos(),
        -pitch.sin(),
        yaw.cos() * pitch.cos(),
    ];
    // JS: const directions=[0,1,2,3,4,5].sort((a,b)=>
    //     DIR_OFFSETS[b].reduce((v,n,i)=>v+n*look[i],0)-DIR_OFFSETS[a].reduce((v,n,i)=>v+n*look[i],0));
    let dot = |dir: usize| -> f64 {
        DIR_OFFSETS[dir]
            .iter()
            .enumerate()
            .map(|(i, n)| *n as f64 * look[i])
            .sum()
    };
    let mut directions: Vec<usize> = vec![0, 1, 2, 3, 4, 5];
    directions.sort_by(|a, b| dot(*b).partial_cmp(&dot(*a)).unwrap_or(std::cmp::Ordering::Equal));
    // JS: if(!replaceClicked){const toward=OPPOSITE[face];
    //     directions.splice(directions.indexOf(toward),1);directions.unshift(toward);}
    if !replace_clicked {
        let toward = OPPOSITE[face];
        if let Some(i) = directions.iter().position(|d| *d == toward) {
            directions.remove(i);
        }
        directions.insert(0, toward);
    }
    directions
}

/// JS: `export function attachmentPlacement(world,block,pos,player,face,replaceClicked)`.
///
/// Returns an enum distinguishing the JS `undefined` (not a lantern/torch)
/// from `null` (no supported face) from a found state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AttachmentResult {
    /// JS: `undefined` — the block is not a lantern/torch; vanilla placement
    /// continues.
    NotApplicable,
    /// JS: `null` — no supported attachment face.
    None,
    /// JS: a found state id.
    State(u32),
}

pub fn attachment_placement(
    registry: &BlockRegistryCore,
    support: &dyn PlacementSupport,
    world: &dyn PlacementWorld,
    block: &PlacementBlock,
    pos: (i32, i32, i32),
    player: &PlacementPlayer,
    face: usize,
    replace_clicked: bool,
) -> AttachmentResult {
    // JS: const name=block.name,lantern=/^(soul_)?lantern$/.test(name),
    //      torch=/^(soul_|redstone_)?torch$/.test(name);
    let name = &block.name;
    let lantern = name == "lantern" || name == "soul_lantern";
    let torch = name == "torch" || name == "soul_torch" || name == "redstone_torch";
    // JS: if(!lantern&&!torch)return undefined;
    if !lantern && !torch {
        return AttachmentResult::NotApplicable;
    }
    // JS: const directions=attachmentDirections(player,face,replaceClicked),
    //      supported=(dir,center)=>{const d=DIR_OFFSETS[dir];
    //          return blockFaceSupports(world.getState(pos.x+d[0],pos.y+d[1],pos.z+d[2]),OPPOSITE[dir],center);};
    let directions = attachment_directions(player, face, replace_clicked);
    let supported = |dir: usize, center: bool| -> bool {
        let d = DIR_OFFSETS[dir];
        block_face_supports(
            support,
            world.get_state(pos.0 + d[0], pos.1 + d[1], pos.2 + d[2]),
            OPPOSITE[dir],
            center,
        )
        .unwrap_or(false)
    };
    // JS: const waterlogged=String(getBlock(world.getState(pos.x,pos.y,pos.z)).isWater===true);
    let waterlogged = (registry.registry().def(world.get_state(pos.0, pos.1, pos.2)).is_water).to_string();
    if lantern {
        // JS: for(const dir of directions)if(dir<2&&supported(dir,true)){
        //   const props={...getStateProperties(block.defaultState),hanging:String(dir===1)};
        //   if('waterlogged'in props)props.waterlogged=waterlogged;
        //   return findState(name,props);}
        for dir in &directions {
            if *dir < 2 && supported(*dir, true) {
                // The JS spreads the default state's properties; the registry
                // exposes them as JSON, which find_state consumes directly.
                let base = registry.properties_json(block.default_state);
                let mut props: serde_json::Map<String, serde_json::Value> =
                    serde_json::from_str(&base).unwrap_or_default();
                props.insert("hanging".into(), serde_json::Value::String((*dir == 1).to_string()));
                if props.contains_key("waterlogged") {
                    props.insert("waterlogged".into(), serde_json::Value::String(waterlogged.clone()));
                }
                return AttachmentResult::State(registry.find_state(name, &serde_json::Value::Object(props).to_string()));
            }
        }
        // JS: return null;
        return AttachmentResult::None;
    }
    // JS: // WallTorchBlock resolves its first supported horizontal face independently.
    //     let wall=null;const wallName=name.replace(/torch$/,'wall_torch');
    let wall_name = if name.ends_with("torch") {
        format!("{}wall_torch", &name[..name.len() - "torch".len()])
    } else {
        name.clone()
    };
    let mut wall: Option<u32> = None;
    // JS: for(const dir of directions)if(dir>=2&&supported(dir,false)){
    //   wall=findState(wallName,{facing:DIR_NAMES[OPPOSITE[dir]],...(name==='redstone_torch'?{lit:'true'}:{})});break;}
    for dir in &directions {
        if *dir >= 2 && supported(*dir, false) {
            let mut props = serde_json::Map::new();
            props.insert(
                "facing".into(),
                serde_json::Value::String(DIR_NAMES[OPPOSITE[*dir]].to_string()),
            );
            if name == "redstone_torch" {
                props.insert("lit".into(), serde_json::Value::String("true".into()));
            }
            wall = Some(registry.find_state(&wall_name, &serde_json::Value::Object(props).to_string()));
            break;
        }
    }
    // JS: for(const dir of directions){if(dir===1)continue;
    //     if(dir===0){if(supported(0,true))return block.defaultState;}
    //     else if(wall!==null)return wall;}
    for dir in &directions {
        if *dir == 1 {
            continue;
        }
        if *dir == 0 {
            if supported(0, true) {
                return AttachmentResult::State(block.default_state);
            }
        } else if let Some(w) = wall {
            return AttachmentResult::State(w);
        }
    }
    // JS: return null;
    AttachmentResult::None
}
