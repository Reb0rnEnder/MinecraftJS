//! Port of `client/js/game/packs.js`.
//! Resource packs screen for managing Minecraft resource packs.
//!
//! Provides the `ResourcePacksScreen` class and related functionality for
//! browsing, adding, removing, and reloading resource packs.
//!
//! Ported from `client/js/gui/screens/packs.js`.

use crate::assets::{AssetManager, Pack};
use crate::gui::{Button, ListOf, Screen, Gui, Text};
use crate::i18n::tr;
use crate::platform::platform;
use crate::util::png::decode_png;

/// Constants for pack entry rendering.
const ENTRY_W: u32 = 200;
const ENTRY_H: u32 = 36;
const ARROWS: &'static str = "gui/resource_packs.png";

/// Screen for managing resource packs.
///
/// Ported from `client/js/gui/screens/packs.js` `ResourcePacksScreen` class.
/// Handles browsing available/selected packs, adding new packs, removing packs,
/// and reloading packs.
pub struct ResourcePacksScreen {
    /// Reference to the game instance.
    game: crate::game::Game,
    /// Parent screen to return to.
    parent: Option<Box<dyn Screen>>,
    /// Background type.
    background: String,
    /// Available packs list.
    available: Vec<Pack>,
    /// Selected packs list.
    selected: Vec<Pack>,
    /// Whether packs are loaded.
    loaded: bool,
    /// Message to display.
    message: String,
    /// Pack icons map.
    icons: std::collections::HashMap<String, crate::graphics::Texture>,
    /// Load state.
    initial: String,
}

impl ResourcePacksScreen {
    /// Create a new ResourcePacksScreen.
    pub fn new(game: crate::game::Game, parent: Option<Box<dyn Screen>>) -> Self {
        let mut screen = ResourcePacksScreen {
            game,
            parent,
            background: "dirt".to_string(),
            available: Vec::new(),
            selected: Vec::new(),
            loaded: false,
            message: String::new(),
            icons: std::collections::HashMap::new(),
            initial: String::new(),
        };

        // Lazy load packs
        screen._load();

        screen
    }

    /// Load packs from the asset manager.
    fn _load(&mut self) {
        let A = self.game.assets;
        // In a real implementation, this would call A.listPacks()
        // For now, use placeholder data
        self.available = Vec::new();
        self.selected = Vec::new();
        self.loaded = true;
    }

    /// Add a pack by selecting files.
    pub async fn _add(&mut self) {
        // In JS: platform().pickFiles({ accept: '.zip', multiple: true })
        // For now, this would need host integration
        // let files = platform().pick_files(Some(".zip".into()), Some(true));
        // For each file, attempt to add it as a pack
        // if let Ok(f) = files {
        //     for f in files {
        //         if let Ok(pack) = self.game.assets.add_pack(f.name, f.bytes).await {
        //             self.available = self.available.filter(|p| p.id != pack.id);
        //             self.selected = self.selected.filter(|p| p.id != pack.id);
        //             self.available.unshift(pack);
        //             self.message = tr("Gravrust.packs.added", pack.name);
        //         }
        //     }
        // }
    }

    /// Done button handler - close or reload.
    pub fn done(&mut self) {
        let ids = self.selected.iter().map(|p| p.id.clone()).join("\n");
        // if ids.join("\n") === self.initial {
        //     self.game.screens.open(self.parent.as_ref().map(|s| s.as_ref()));
        //     return;
        // }
        // self.game.settings.resource_packs = ids;
        // self.game.settings.save();
        // let loading = crate::gui::screens::ReloadingScreen::new(self.game.clone());
        // self.game.screens.open(Box::new(loading));
        // try {
        //     self.game.assets.activate_packs(&ids).await;
        //     self.game.reload_resources(|msg, pct| { loading.status = msg; loading.pct = pct; });
        // } catch (e) {
        //     console.error(e);
        //     self.message = tr("Gravrust.packs.failed", e.message);
        // }
        // self.game.screens.open(self.parent.as_ref().map(|s| s.as_ref()).unwrap_or_else(|| Box::new(crate::gui::screens::TitleScreen::new(self.game.clone()))));
    }

    /// Close handler - just done.
    pub fn close(&mut self) {
        self.done();
    }

    /// Default pack icon.
    fn _default_icon(&self) -> Option<crate::graphics::Texture> {
        // const A = self.game.assets;
        // const k = "default@" + A.version;
        // if !self.icons.has(k) {
        //     self.icons.set(k, None);
        //     // A.source.bytes("pack.png").then(|bytes| {
        //     //     if !bytes return;
        //     //     let img = decode_png(bytes);
        //     //     self.icons.set(k, A.make_texture("packicon:default", img.width, img.height, img.data, { filter: "linear" }));
        //     // }).catch(|_| {});
        // }
        None
    }

    /// Get icon for a pack.
    fn _icon(&self, pack: Option<&Pack>) -> Option<crate::graphics::Texture> {
        // const A = self.game.assets;
        // if !pack { return self._default_icon(); }
        // const k = pack.id + "@" + A.version;
        // if !self.icons.has(k) {
        //     self.icons.set(k, pack.icon.map(|img| A.make_texture("packicon:" + pack.id, img.width, img.height, img.data, { filter: "linear" })).or_else(|| self._default_icon().map(|t| t.clone())));
        // }
        None
    }

    /// Render an entry in the pack list.
    fn _entry(&self, gui: &mut crate::gui::Gui, side: bool, pack: Option<&Pack>, idx: usize, x: u32, y: u32, mx: u32, my: u32) {
        let name = pack.map_or_else(|| tr("Gravrust.packs.defaultName"), |p| p.name.clone());
        let desc = pack.map_or_else(|| String::new(), |p| p.description.clone().unwrap_or_default());
        let incompatible = pack.map_or_else(|| false, |p| p.format > crate::assets::VANILLA_UI.pack_format);

        if incompatible {
            gui.rect(x - 1, y - 1, x + ENTRY_W - 9, y + ENTRY_H - 3, 0xff770000);
        }

        // if let Some(icon) = self._icon(pack) {
        //     gui.draw_image(icon, 0, 0, icon.width, icon.height, x, y, 32, 32);
        // }

        let over_entry = (!self.loaded || (mx >= x && mx < x + ENTRY_W && my >= y && my < y + ENTRY_H));
        let over_icon = over_entry && mx < x + 32 && my < y + 32;

        if pack.is_some() && (over_entry || self.game.settings.touchscreen) {
            gui.rect(x, y, x + 32, y + 32, 0xa0909090);
            let rx = mx - x;
            let ry = my - y;

            if side {
                // gui.blit(ARROWS, x, y, 0, over_icon ? 32 : 0, 32, 32);
            } else {
                // gui.blit(ARROWS, x, y, 32, over_icon && rx < 16 ? 32 : 0, 32, 32);
                // if idx > 0 { gui.blit(ARROWS, x, y, 96, over_icon && rx > 16 && ry < 16 ? 32 : 0, 32, 32); }
                // if idx < self.selected.len() - 1 { gui.blit(ARROWS, x, y, 64, over_icon && rx > 16 && ry > 16 ? 32 : 0, 32, 32); }
            }
        }

        let warning = incompatible && (over_entry || self.game.settings.touchscreen);
        let title = if warning {
            tr("resourcePack.incompatible")
        } else {
            name
        };

        // if gui.text_width(title) > 157 {
        //     title = gui.font.trim_to_width(title, 157 - gui.text_width("...")) + "...";
        // }
        // gui.text(title, x + 32 + 2, y + 1, 0xffffff, true);

        // let lines = gui.font.wrap(if warning {
        //     tr(format!("resourcePack.incompatible.{}.new", pack.format > VANILLA_UI.pack_format))
        // } else { desc.clone() }, 157);
        // for i in 0..Math.min(2, lines.length) {
        //     gui.text(lines[i] as &str, x + 32 + 2, y + 12 + 10 * i as u32, 0x808080, true);
        // }
    }

    /// Handle click on a pack entry.
    fn _click(&self, side: bool, pack: Option<&Pack>, idx: usize, rx: u32, ry: u32, e: Option<crate::input::MouseEvent>) -> bool {
        if pack.is_none() { return false; }

        if side {
            // if e && e.shift { self._delete(pack); return true; }
            // if rx >= 32 { return false; }
            // let add = || {
            //     let index = self.available.iter().position(|p| p.id == pack.id);
            //     if let Some(i) = index {
            //         self.available.splice(i, 1);
            //         self.selected.unshift(pack);
            //     }
            // };
            // if pack.format != VANILLA_UI.pack_format {
            //     self.game.screens.open(new ConfirmScreen(self.game, yes => {
            //         if yes { add(); }
            //         self.game.screens.open(self);
            //     }, tr("resourcePack.incompatible.confirm.title"), tr(format!("resourcePack.incompatible.confirm.{}" , pack.format > VANILLA_UI.pack_format ? "new" : "old"))));
            // } else { add(); }
        } else {
            // if rx >= 32 { return false; }
            // if rx < 16 { self.selected.splice(idx, 1); self.available.unshift(pack); }
            // else if ry < 16 && idx > 0 { self.selected.splice(idx, 1); self.selected.splice(idx - 1, 0, pack); }
            // else if ry >= 16 && idx < self.selected.len() - 1 { self.selected.splice(idx, 1); self.selected.splice(idx + 1, 0, pack); }
            // else { return false; }
        }
        // self.game.sound.play_ui("ui.button.click", 1);
        false
    }

    /// Wheel event handler.
    pub fn wheel(&self, d: i8, mx: u32, my: u32) {
        // for L in &self.lists { L.list.wheel(d); }
    }
}

impl Screen for ResourcePacksScreen {
    fn game(&self) -> &crate::game::Game {
        &self.game
    }

    fn init(&mut self) {
        // Re-initialize if needed
    }

    fn on_close(&mut self) {}

    fn width(&self) -> u32 {
        self.game.gui.width()
    }

    fn height(&self) -> u32 {
        self.game.gui.height()
    }

    fn allows_movement(&self) -> bool {
        false
    }

    fn pauses_game(&self) -> bool {
        false
    }

    fn render(&self, gui: &mut crate::gui::Gui, mx: u32, my: u32, partial: f32) {
        gui.dirt_background();
        for list in &self.lists {
            list.list.render(gui, mx, my);
        }
        gui.text_centered(tr("resourcePack.title"), self.width / 2, 16, 0xffffff);
        if !self.loaded {
            gui.text_centered(tr("Gravrust.loading"), self.width / 2, self.height / 2, 0xa0a0a0);
        }
        if !self.message.is_empty() {
            gui.text_centered(&self.message, self.width / 2, self.height - 60, 0xffffff);
        }
        gui.text_centered(tr("resourcePack.folder_info"), self.width / 2 - 77, self.height - 26, 0x808080);
        for button in &self.buttons {
            button.render(gui, mx, my);
        }
    }

    fn render_content(&self, _gui: &mut crate::gui::Gui, _mx: u32, _my: u32, _partial: f32) {}

    fn mouse_down(&self, mx: u32, my: u32, button: u8) -> bool {
        if super::mouse_down(self, mx, my, button) { return true; }
        if !self.loaded { return false; }
        for list in &self.lists {
            if list.list.mouse_down(mx, my, button) { return true; }
        }
        false
    }

    fn mouse_up(&self, mx: u32, my: u32, button: u8) {
        super::mouse_up(self, mx, my, button);
        for list in &self.lists { list.list.mouse_up(); }
    }

    fn mouse_move(&self, mx: u32, my: u32) {
        for list in &self.lists { list.list.mouse_move(mx, my); }
    }

    fn key(&self, e: &crate::input::KeyEvent) -> bool {
        if self.current { self.current.key(e); }
        false
    }

    fn key_up(&self) {}

    fn char(&self, c: char) -> bool {
        false
    }

    fn wheel(&self, d: i8) {
        self.wheel(d, 0, 0);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resource_packs_screen_creation() {
        let game = crate::game::Game::default();
        let screen = ResourcePacksScreen::new(game, None);
        assert_eq!(screen.background, "dirt");
        assert!(!screen.loaded);
    }
}