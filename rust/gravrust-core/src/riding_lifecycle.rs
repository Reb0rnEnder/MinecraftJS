// Port of `client/js/game/riding-lifecycle.js`.
//
// Entity removal must detach riders even when no dismount packet arrives
// first.

/// One entity's riding links, as the entity manager holds them. The JS walks
/// `manager.map.values()` reading `entity.riding`, `entity.passenger` and
/// `entity.passengerList` directly.
#[derive(Debug, Clone, Default)]
pub struct RidingLinks {
    /// JS: `entity.riding` — the id this entity rides on (-1 = none).
    pub riding: i32,
    /// JS: `entity.passenger` — the id riding on this entity (-1 = none).
    pub passenger: i32,
    /// JS: `entity.passengerList` — the full passenger list, when tracked.
    pub passenger_list: Option<Vec<i32>>,
}

impl RidingLinks {
    fn detach_removed(&mut self, removed: &std::collections::HashSet<i32>) {
        // JS: if (removed.has(entity.riding)) entity.riding = -1;
        if removed.contains(&self.riding) {
            self.riding = -1;
        }
        // JS: if (removed.has(entity.passenger)) entity.passenger = -1;
        if removed.contains(&self.passenger) {
            self.passenger = -1;
        }
        // JS: if (entity.passengerList?.some(passenger => removed.has(passenger)))
        //         entity.passengerList = entity.passengerList.filter(passenger => !removed.has(passenger));
        if let Some(list) = &self.passenger_list {
            if list.iter().any(|p| removed.contains(p)) {
                self.passenger_list = Some(list.iter().copied().filter(|p| !removed.contains(p)).collect());
            }
        }
    }
}

/// The manager/game surface `detachRemovedEntities` touches.
pub trait RidingLifecycleManager {
    /// JS: `g.ridingEntityId` read + write.
    fn riding_entity_id(&self) -> i32;
    fn set_riding_entity_id(&mut self, id: i32);
    /// JS: `g.player?.ridingEntity?.id` — the local player's mount id, if any.
    fn player_riding_entity_id(&self) -> Option<i32>;
    /// JS: `if (g.player) { g.player.ridingEntity = null; g.player.ridingBoat = false; }`.
    fn clear_player_mount(&mut self);
    /// JS: `g._dropVehicle?.()`.
    fn drop_vehicle(&mut self);
    /// JS: `if (manager.self) manager.self.riding = -1;`.
    fn clear_self_riding(&mut self);
    /// JS: `for (const entity of manager.map.values())` — every tracked
    /// entity's links, in map order, mutated in place.
    fn for_each_entity_mut(&mut self, f: &mut dyn FnMut(&mut RidingLinks));
}

/// JS: `export function detachRemovedEntities(manager, ids)`.
pub fn detach_removed_entities(manager: &mut dyn RidingLifecycleManager, ids: &[i32]) {
    // JS: const removed = new Set(ids);
    let removed: std::collections::HashSet<i32> = ids.iter().copied().collect();
    // JS: if (removed.has(g.ridingEntityId) || removed.has(g.player?.ridingEntity?.id)) { ... }
    let player_mount = manager.player_riding_entity_id();
    let player_mount_removed = player_mount.map(|id| removed.contains(&id)).unwrap_or(false);
    if removed.contains(&manager.riding_entity_id()) || player_mount_removed {
        // JS: g.ridingEntityId = -1;
        manager.set_riding_entity_id(-1);
        // JS: if (g.player) { g.player.ridingEntity = null; g.player.ridingBoat = false; }
        manager.clear_player_mount();
        // JS: g._dropVehicle?.();
        manager.drop_vehicle();
        // JS: if (manager.self) manager.self.riding = -1;
        manager.clear_self_riding();
    }
    // JS: for (const entity of manager.map.values()) { ... }
    let mut f = |links: &mut RidingLinks| links.detach_removed(&removed);
    manager.for_each_entity_mut(&mut f);
}
