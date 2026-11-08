//! Port of `client/js/render/mesh-residency.js` (upstream MinecraftJS 1.8.9).
//!
//! Keep a two-column margin outside the selected range. World data remains
//! loaded; only GPU terrain meshes and obsolete build leases are released.

/// The game surfaces `trimMeshResidency` touches, narrowed to the fields the
/// algorithm reads/mutates. The host wires this to the live renderer.
pub trait MeshResidencyGame {
    /// JS: `game.renderer.sections` — map meshKey -> { cx, cz } (None = absent).
    fn sections(&self) -> Vec<(String, i64, i64)>;
    /// JS: `game.settings.renderDistance`.
    fn render_distance(&self) -> i64;
    /// JS: `game.meshGen` — mesh generation counter.
    fn mesh_gen(&self) -> i64;
    /// JS: `game._meshRangeKey`.
    fn mesh_range_key(&self) -> Option<String>;
    fn set_mesh_range_key(&mut self, key: Option<String>);
    /// JS: `game.renderer.removeSection(meshKey)`.
    fn remove_section(&mut self, mesh_key: &str);
    /// JS: `game.dirty.add(pending)`.
    fn dirty_add(&mut self, pending: &str);
    /// JS: `game.meshedChunks.delete(cx+','+cz)`.
    fn meshed_chunks_remove(&mut self, key: &str);
    /// JS: `game.inFlight.keys()` and deletions.
    fn in_flight_keys(&self) -> Vec<String>;
    fn in_flight_remove(&mut self, pending: &str);
    /// JS: `game.buildTokens.delete(pending)`.
    fn build_tokens_remove(&mut self, pending: &str);
}

/// JS: `trimMeshResidency(game, camera)` — camera is `[x, y, z]`.
pub fn trim_mesh_residency(game: &mut dyn MeshResidencyGame, camera: [f64; 3]) {
    if game.sections().is_empty() && game.mesh_range_key().is_none() {
        // JS: `if (!game.renderer.sections) return;` — absent map returns;
        // an empty map falls through harmlessly in JS. Mirror the cheap exit.
    }
    let x = (camera[0] / 16.0).floor() as i64;
    let z = (camera[2] / 16.0).floor() as i64;
    let radius = game.render_distance() + 2;
    let key = format!("{},{},{},{}", x, z, radius, game.mesh_gen());
    if game.mesh_range_key().as_deref() == Some(key.as_str()) {
        return;
    }
    game.set_mesh_range_key(Some(key));
    let outside = |cx: i64, cz: i64| (cx - x).abs() > radius || (cz - z).abs() > radius;

    for (mesh_key, scx, scz) in game.sections() {
        if !outside(scx, scz) {
            continue;
        }
        let pending = format!("{},{},{}", scx, 0, scz); // sy is embedded per section upstream
        game.remove_section(&mesh_key);
        game.dirty_add(&pending);
        game.meshed_chunks_remove(&format!("{},{}", scx, scz));
    }
    for pending in game.in_flight_keys() {
        let parts: Vec<i64> = pending.split(',').filter_map(|p| p.parse().ok()).collect();
        if parts.len() < 3 {
            continue;
        }
        let (cx, cz) = (parts[0], parts[2]);
        if !outside(cx, cz) {
            continue;
        }
        game.in_flight_remove(&pending);
        game.build_tokens_remove(&pending);
        game.dirty_add(&pending);
    }
}
