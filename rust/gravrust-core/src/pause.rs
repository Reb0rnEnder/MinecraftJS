//! Port of `client/js/gui/screens/pause.js`.
//! Pause screen implementation for the Minecraft GUI.

use crate::i18n::tr;
use crate::gui::{Gui, Button, Screen};
use crate::platform::platform;

/// Pause screen shown when the player presses Esc.
///
/// Ported from `client/js/gui/screens/pause.js` `PauseScreen` class.
/// Provides buttons to return to game, open stats, go to options, disconnect, etc.
pub struct PauseScreen {
    /// Reference to the game instance.
    game: crate::game::Game,
    /// Screen width.
    width: u32,
    /// Screen height.
    height: u32,
    /// Buttons in the pause menu.
    buttons: Vec<Box<dyn Button>>,
    /// Background type ('world', 'dirt', or 'none' for invisible).
    background: String,
}

impl PauseScreen {
    /// Create a new PauseScreen.
    pub fn new(game: crate::game::Game, width: u32, height: u32) -> Self {
        let cx = width / 2;
        let y = height / 4;

        let mut buttons = Vec::new();
        // Return to game button
        buttons.push(Box::new(Button::new(
            4,
            cx - 100,
            y + 24 - 16,
            200,
            20,
            tr("menu.returnToGame"),
            || { /* close button callback */ }
        )));
        // Advancements button (1.12 replaced achievements)
        buttons.push(Box::new(Button::new(
            5,
            cx - 100,
            y + 48 - 16,
            98,
            20,
            tr("gui.advancements"),
            || { /* open advancements callback */ }
        )));
        // Stats button
        buttons.push(Box::new(Button::new(
            6,
            cx + 2,
            y + 48 - 16,
            98,
            20,
            tr("gui.stats"),
            || { /* open stats callback */ }
        )));
        // Send feedback button
        buttons.push(Box::new(Button::new(
            12,
            cx - 100,
            y + 72 - 16,
            98,
            20,
            tr("menu.sendFeedback"),
            || { platform().open_url("https://feedback.minecraft.net/"); }
        )));
        // Report bugs button
        buttons.push(Box::new(Button::new(
            13,
            cx + 2,
            y + 72 - 16,
            98,
            20,
            tr("menu.reportBugs"),
            || { platform().open_url("https://bugs.mojang.com/"); }
        )));
        // Options button
        buttons.push(Box::new(Button::new(
            0,
            cx - 100,
            y + 96 - 16,
            98,
            20,
            tr("menu.options"),
            || { /* open options callback */ }
        )));
        // Share to LAN button (disabled)
        let lan = Button::new(
            7,
            cx + 2,
            y + 96 - 16,
            98,
            20,
            tr("menu.shareToLan"),
        );
        let lan_disabled = Button::new_disabled(lan);
        buttons.push(Box::new(lan_disabled));
        // Disconnect button
        buttons.push(Box::new(Button::new(
            1,
            cx - 100,
            y + 120 - 16,
            200,
            20,
            tr("menu.disconnect"),
            || { /* disconnect callback */ }
        ));

        PauseScreen {
            game,
            width,
            height,
            buttons,
            background: "world".to_string(),
        }
    }

    /// Initialize the pause screen.
    pub fn init(&mut self) {
        // Buttons already initialized in new(), but can be re-initialized here
    }

    /// Render the pause screen content.
    pub fn render_content(&self, gui: &mut Gui, _mx: u32, _my: u32, _partial: f32) {
        gui.text_centered(tr("menu.game"), self.width / 2, 40, 0xffffff);
    }
}

impl Screen for PauseScreen {
    fn game(&self) -> &crate::game::Game {
        &self.game
    }

    fn init(&mut self) {
        // Re-initialize buttons if needed
    }

    fn on_close(&mut self) {
        // Cleanup when closing the pause screen
    }

    fn background(&self) -> &str {
        &self.background
    }

    fn set_background(&mut self, bg: String) {
        self.background = bg;
    }
}

/// Invisible pause screen that doesn't render anything.
/// Used for F3+Escape to release input without drawing the pause menu.
///
/// Ported from `client/js/gui/screens/pause.js` `InvisiblePauseScreen` class.
pub struct InvisiblePauseScreen {
    /// Reference to the game instance.
    game: crate::game::Game,
}

impl InvisiblePauseScreen {
    /// Create a new InvisiblePauseScreen.
    pub fn new(game: crate::game::Game) -> Self {
        InvisiblePauseScreen { game }
    }
}

impl Screen for InvisiblePauseScreen {
    fn game(&self) -> &crate::game::Game {
        &self.game
    }

    fn init(&mut self) {}

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
        false // Invisible pause doesn't tick the game
    }

    fn render(&self, _gui: &mut crate::gui::Gui, _mx: u32, _my: u32, _partial: f32) {
        // Don't render anything - invisible
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pause_screen_creation() {
        // Test that PauseScreen can be created
        // Note: full test would require a game instance
    }

    #[test]
    fn test_invisible_pause_screen() {
        // Test that InvisiblePauseScreen exists and implements Screen
        let _screen = InvisiblePauseScreen::new(crate::game::Game::default());
    }
}