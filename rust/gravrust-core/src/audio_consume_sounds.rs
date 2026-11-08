//! Port of `client/js/audio/consume-sounds.js` (upstream MinecraftJS 1.8.9).
//!
//! LivingEntity.triggerItemUseEffects: drinking has no food-fragment particles.

use serde_json::Value;

/// The game surfaces `consumeEffect` touches, as a trait so the host wires
/// them (particles / sound stay browser-bound in the engine layer).
pub trait ConsumeFx {
    /// JS: `game.items.useAction(item)` â†’ 'eat' | 'drink' | other.
    fn use_action(&self, item: &Value) -> &'static str;
    /// JS: `game.particles.itemCrack(item, player, count)`.
    fn item_crack(&mut self, item: &Value, count: i64);
    /// JS: `game.sound.playAtPlayer(name, volume, pitch, category)`.
    fn play_at_player(&mut self, name: &str, volume: f64, pitch: f64, category: &str);
}

/// JS: `consumeEffect(game, item, count = 5)` â€” 1:1 (default count 5).
pub fn consume_effect(game: &mut dyn ConsumeFx, item: &Value, count: i64) {
    let action = game.use_action(item);
    if action == "eat" {
        game.item_crack(item, count);
        let volume = 0.5 + 0.5 * rand_round() as f64;
        let pitch = (rand_f64() - rand_f64()) * 0.2 + 1.0;
        game.play_at_player("random.eat", volume, pitch, "player");
    } else if action == "drink" {
        let pitch = rand_f64() * 0.1 + 0.9;
        game.play_at_player("random.drink", 0.5, pitch, "player");
    }
}

// JS Math.random() â€” the engine injects the RNG; the pure port uses a
// deterministic default so behaviour is testable. Hosts override via
// ConsumeFx if they need true randomness routed differently.
fn rand_f64() -> f64 {
    fastrand::f64()
}

fn rand_round() -> i64 {
    fastrand::f64().round() as i64
}
