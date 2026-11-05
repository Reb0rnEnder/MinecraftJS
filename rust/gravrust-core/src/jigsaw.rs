//! Port of `client/js/gui/screens/jigsaw.js`:
//! Jigsaw screen for setting target pool, attachment type, and final state.

use crate::i18n::tr;
use crate::screens::manager::Screen;
use crate::widgets::{Button, TextField};
use crate::net::packets;
use crate::util::regex::resource;

/// Jigsaw screen for configuring jigsaw block parameters.
pub struct JigsawScreen {
    /// Position of the jigsaw block
    pos: (i32, i32, i32),
    /// Input fields for target pool, attachment type, and final state
    fields: Vec<TextField>,
    /// Done button
    done: Button,
}

impl JigsawScreen {
    /// Create a new JigsawScreen.
    pub fn new(game: &crate::game::Game, pos: (i32, i32, i32)) -> Self {
        let cx = game.gui.width() / 2;
        let mut fields = Vec::new();
        let mut values = vec![
            "minecraft:empty".to_string(),
            "minecraft:empty".to_string(),
            "minecraft:air".to_string(),
        ];

        // Initialize fields from default values (or constructor data)
        for (i, text) in values.iter().enumerate() {
            fields.push(TextField::new(
                cx - 150,
                50 + i as i32 * 40,
                300,
                20,
                text.clone(),
                Box::new(move |s| {
                    // onChange callback - would update values
                }),
            ));
        }

        let done = Button::new(
            0,
            cx - 154,
            180,
            150,
            20,
            tr("gui.done"),
            Box::new(|| {
                // this.save();
            }),
        );

        let cancel = Button::new(
            1,
            cx + 4,
            180,
            150,
            20,
            tr("gui.cancel"),
            Box::new(|| {
                // this.close();
            }),
        );

        Self { pos, fields, done }
    }

    /// Update button enabled state
    pub fn update_buttons(&self) {
        if let Some(done) = self.done.as_ref() {
            // done.enabled = resource(&self.values[0])
            //     && resource(&self.values[1])
            //     && !!self.values[2].trim();
        }
    }

    /// Save and close the screen
    pub fn save(&self) {
        // const [pool, type, state] = this.values;
        // this.game.send(C.updateJigsaw(this.pos, type, pool, state));
        // this.close();
    }
}

impl Screen for JigsawScreen {
    fn game(&self) -> &crate::game::Game {
        // &self.game - would need game reference
        unimplemented!()
    }

    fn init(&mut self) {
        // Fields already initialized in new(), but can be re-initialized here
    }

    fn on_close(&mut self) {
        // Cleanup when closing the screen
    }

    fn width(&self) -> u32 {
        self.game.gui.width()
    }

    fn height(&self) -> u32 {
        self.game.gui.height()
    }

    fn renders(&self, gui: &mut crate::gui::Gui, mx: u32, my: u32, partial: f32) {
        // renderContent logic
        let labels = [
            "jigsaw_block.target_pool",
            "jigsaw_block.attachement_type",
            "jigsaw_block.final_state",
        ];
        for (i, label) in labels.iter().enumerate() {
            gui.text(
                tr(label),
                self.width() as i32 / 2 - 150,
                40 + i as i32 * 40,
                0xa0a0a0,
            );
        }
    }
}

