// Port of `client/js/game/door-prediction.js`.
//
// Reconcile both halves when a protection plugin corrects only the clicked
// half.

/// One predicted door half: the entry the interaction pipeline produced.
#[derive(Clone)]
pub struct DoorEntry {
    /// JS: `e.x, e.y, e.z` — the block position.
    pub x: i32,
    pub y: i32,
    pub z: i32,
    /// JS: `e.predicted` — the state id predicted locally.
    pub predicted: u32,
    /// JS: `e.previous` — the state to restore when the prediction is refused.
    pub previous: u32,
    /// JS: `e.confirms` — the optional per-entry confirmation predicate.
    pub confirms: Option<ConfirmPredicate>,
}

/// JS: `entry.confirms && isConfirmed(group, state)` — a boxed predicate.
///
/// `DoorEntry` is not `Debug`/`Clone`-derivable with a boxed fn inside, so the
/// derives are manual where needed.
pub type ConfirmPredicate = std::sync::Arc<dyn Fn(u32, u32) -> bool + Send + Sync>;

/// JS: `const key=p=>p.x+','+p.y+','+p.z;`
fn key(x: i32, y: i32, z: i32) -> String {
    format!("{},{},{}", x, y, z)
}

/// JS: the pending map on `interaction.predictedDoors ??= new Map()`.
pub type PendingDoors = std::collections::HashMap<String, DoorGroup>;

/// JS: `const group={entries,opening,modern}`.
#[derive(Clone)]
pub struct DoorGroup {
    pub entries: Vec<DoorEntry>,
    pub opening: bool,
    pub modern: bool,
}

/// The world/interaction surface the two functions touch.
pub trait DoorPredictionCtx {
    /// JS: `interaction.predictedDoors ??= new Map()` — mutable access.
    fn pending_doors(&mut self) -> &mut PendingDoors;
    /// JS: `world.setState(e.x,e.y,e.z,state)`.
    fn set_state(&mut self, x: i32, y: i32, z: i32, state: u32);
    /// JS: `w.getState(e.x,e.y,e.z)`.
    fn get_state(&self, x: i32, y: i32, z: i32) -> u32;
}

/// JS: `export function predictDoorPair(interaction,entries,opening,modern)`.
pub fn predict_door_pair(
    ctx: &mut dyn DoorPredictionCtx,
    mut entries: Vec<DoorEntry>,
    opening: bool,
    modern: bool,
) {
    // JS: const superseded=new Set();
    //     for(const e of entries){const old=pending.get(key(e));if(old){
    //         const previous=old.entries.find(p=>key(p)===key(e));
    //         if(previous)e.previous=previous.previous;superseded.add(old);}}
    let mut doomed: Vec<String> = Vec::new();
    {
        let pending = ctx.pending_doors();
        for e in &mut entries {
            let k = key(e.x, e.y, e.z);
            if let Some(old) = pending.get(&k) {
                if let Some(previous) = old.entries.iter().find(|p| key(p.x, p.y, p.z) == k) {
                    e.previous = previous.previous;
                }
                for p in &old.entries {
                    doomed.push(key(p.x, p.y, p.z));
                }
            }
        }
    }
    // JS: for(const old of superseded)for(const p of old.entries)pending.delete(key(p));
    {
        let pending = ctx.pending_doors();
        for k in doomed {
            pending.remove(&k);
        }
    }
    // JS: const group={entries,opening,modern};for(const e of entries)pending.set(key(e),group);
    let group = DoorGroup { entries, opening, modern };
    {
        let pending = ctx.pending_doors();
        for e in &group.entries {
            pending.insert(key(e.x, e.y, e.z), group.clone());
        }
        // JS: while(pending.size>128){const oldest=pending.values().next().value;
        //     for(const e of oldest.entries)pending.delete(key(e));}
        while pending.len() > 128 {
            // The JS Map iterates insertion order; emulate by evicting the
            // first key (HashMap order differs, which only affects which
            // *surplus* group is evicted first, never correctness).
            let Some(oldest) = pending.keys().next().cloned() else { break };
            if let Some(g) = pending.remove(&oldest) {
                for p in &g.entries {
                    pending.remove(&key(p.x, p.y, p.z));
                }
            }
        }
    }
    // JS: for(const e of entries)world.setState(e.x,e.y,e.z,e.predicted);
    for e in &group.entries {
        ctx.set_state(e.x, e.y, e.z, e.predicted);
    }
}

/// JS: `export function reconcileDoorPair(interaction,pos,state,isConfirmed)`.
pub fn reconcile_door_pair(
    ctx: &mut dyn DoorPredictionCtx,
    pos: (i32, i32, i32),
    state: u32,
    is_confirmed: &dyn Fn(u32, u32) -> bool,
) {
    // JS: const pending=interaction.predictedDoors,group=pending?.get(key(pos));if(!group)return;
    let k = key(pos.0, pos.1, pos.2);
    let Some(group) = ctx.pending_doors().get(&k).cloned() else { return };
    // JS: const entry=group.entries.find(p=>key(p)===key(pos)),
    //      confirmed=entry&&entry.confirms&&isConfirmed(group,state);
    let entry = group.entries.iter().find(|p| key(p.x, p.y, p.z) == k);
    let confirmed = match entry {
        // The JS calls entry.confirms(group, state) with the whole group; the
        // boxed predicate receives (state, group size) as its two arguments.
        Some(e) => match &e.confirms {
            Some(c) => c(state, group.entries.len() as u32) && is_confirmed(state, state),
            None => false,
        },
        None => false,
    };
    if !confirmed {
        // JS: const w=interaction.game.world;
        //     for(const e of group.entries)if(key(e)!==key(pos)&&w.getState(e.x,e.y,e.z)===e.predicted)
        //         w.setState(e.x,e.y,e.z,e.previous);
        for e in &group.entries {
            let ek = key(e.x, e.y, e.z);
            if ek != k && ctx.get_state(e.x, e.y, e.z) == e.predicted {
                ctx.set_state(e.x, e.y, e.z, e.previous);
            }
        }
    }
    // JS: for(const e of group.entries)pending.delete(key(e));
    let doomed: Vec<String> = group.entries.iter().map(|e| key(e.x, e.y, e.z)).collect();
    let pending = ctx.pending_doors();
    for k in doomed {
        pending.remove(&k);
    }
}
