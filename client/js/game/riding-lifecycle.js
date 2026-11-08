// Entity removal must detach riders even when no dismount packet arrives first.
export function detachRemovedEntities(manager, ids) {
  const g = manager.game, removed = new Set(ids);
  if (removed.has(g.ridingEntityId) || removed.has(g.player?.ridingEntity?.id)) {
    g.ridingEntityId = -1;
    if (g.player) { g.player.ridingEntity = null; g.player.ridingBoat = false; }
    g._dropVehicle?.();
    if (manager.self) manager.self.riding = -1;
  }
  for (const entity of manager.map.values()) {
    if (removed.has(entity.riding)) entity.riding = -1;
    if (removed.has(entity.passenger)) entity.passenger = -1;
    if (entity.passengerList?.some(passenger => removed.has(passenger))) entity.passengerList = entity.passengerList.filter(passenger => !removed.has(passenger));
  }
}
