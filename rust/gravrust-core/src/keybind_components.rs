//! Port of `client/js/game/keybind-components.js`.
//!
//! Native KeyMapping.createNameSupplier: bindings resolver for translated chat / GUI text.
//! Respects Gravrust rebranding (`gravrust.key.zoom` instead of minecraftjs).

use std::collections::HashMap;
use once_cell::sync::Lazy;

pub static BINDING_KEYS: Lazy<HashMap<&'static str, &'static str>> = Lazy::new(|| {
    let mut m = HashMap::new();
    m.insert("key.attack", "attack");
    m.insert("key.use", "use");
    m.insert("key.forward", "forward");
    m.insert("key.left", "left");
    m.insert("key.back", "back");
    m.insert("key.right", "right");
    m.insert("key.jump", "jump");
    m.insert("key.sneak", "sneak");
    m.insert("key.sprint", "sprint");
    m.insert("key.drop", "drop");
    m.insert("key.inventory", "inventory");
    m.insert("key.chat", "chat");
    m.insert("key.playerlist", "playerlist");
    m.insert("key.pickItem", "pickItem");
    m.insert("key.command", "command");
    m.insert("key.screenshot", "screenshot");
    m.insert("key.togglePerspective", "perspective");
    m.insert("gravrust.key.zoom", "zoom");
    m.insert("minecraftjs.key.zoom", "zoom"); // compatibility
    m.insert("key.smoothCamera", "smoothCamera");
    m.insert("key.swapHands", "swapHands");
    m.insert("key.advancements", "advancements");
    m.insert("key.saveToolbarActivator", "saveToolbarActivator");
    m.insert("key.loadToolbarActivator", "loadToolbarActivator");
    m.insert("key.fullscreen", "fullscreen");
    m.insert("key.spectatorOutlines", "spectatorOutlines");

    m.insert("key.hotbar.1", "hotbar1");
    m.insert("key.hotbar.2", "hotbar2");
    m.insert("key.hotbar.3", "hotbar3");
    m.insert("key.hotbar.4", "hotbar4");
    m.insert("key.hotbar.5", "hotbar5");
    m.insert("key.hotbar.6", "hotbar6");
    m.insert("key.hotbar.7", "hotbar7");
    m.insert("key.hotbar.8", "hotbar8");
    m.insert("key.hotbar.9", "hotbar9");

    m
});

pub fn resolve_binding_field(binding_name: &str) -> Option<&'static str> {
    BINDING_KEYS.get(binding_name).copied()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_binding_key_resolution() {
        assert_eq!(resolve_binding_field("key.forward"), Some("forward"));
        assert_eq!(resolve_binding_field("key.jump"), Some("jump"));
        assert_eq!(resolve_binding_field("gravrust.key.zoom"), Some("zoom"));
        assert_eq!(resolve_binding_field("key.hotbar.1"), Some("hotbar1"));
        assert_eq!(resolve_binding_field("unknown.key"), None);
    }
}
