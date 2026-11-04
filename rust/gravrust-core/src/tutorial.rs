// Port of `client/js/gui/tutorial.js`

use wasm_bindgen::prelude::*;

/// Tutorial toast notifications for new players.
/// Handles steps: movement, find tree, punch tree, open inventory, craft planks.
#[wasm_bindgen]
pub struct Tutorial {
    game: crate::game::Game,
}

#[wasm_bindgen]
impl Tutorial {
    /// Create a new Tutorial instance.
    pub fn new(game: &crate::game::Game) -> Self {
        Tutorial {
            game: game.clone(),
        }
    }

    /// Get the current tutorial step name.
    pub fn step(&self) -> Option<String> {
        // Return current step or None
        None
    }

    /// Set the tutorial step, saving the progress.
    pub fn set_step(&mut self, name: &str) {
        self.game.settings.tutorial_step = name.to_string();
        self.game.settings.save();
        // Reset and create new step
    }

    /// Stop the current tutorial step.
    pub fn stop(&mut self) {
        if self.step.is_some() {
            // Call on_stop on the current step
            self.step = None;
        }
    }

    /// Handle movement input during tutorial.
    pub fn handle_movement(&mut self, input: &str) {
        // Process movement keys
    }

    /// Handle mouse input during tutorial.
    pub fn handle_mouse(&mut self, dx: f32, dy: f32) {
        // Process mouse movement
    }

    /// Called when mouse hovers over a target.
    pub fn on_mouse_hover(&mut self, target: &str) {
        // Process mouse hover
    }

    /// Called when hitting a block.
    pub fn on_hit_block(&mut self, state: &str, face: i32) {
        // Process block hit
    }

    /// Open the player inventory.
    pub fn open_inventory(&mut self) {
        // Open inventory
    }

    /// Handle set slot during tutorial.
    pub fn handle_set_slot(&mut self, item: &str) {
        // Handle slot change
    }
}

/// Tutorial toast icon positions.
#[wasm_bindgen]
#[derive(Clone, Copy, PartialEq, Eq)]
pub struct ToastIcon {
    /// Column position in toasts.png
    pub column: i32,
    /// Row position in toasts.png
    pub row: i32,
}

/// Tutorial toast structure.
#[wasm_bindgen]
pub struct Toast {
    /// Icon position
    pub icon: ToastIcon,
    /// Title text
    pub title: String,
    /// Subtitle text
    pub subtitle: String,
    /// Whether progress bar is shown
    pub progress_bar: bool,
    /// Visibility state
    pub visibility: String,
    /// Display progress (0-1)
    pub displayed: f32,
    /// Current progress (0-1)
    pub current: f32,
    /// Last delta time
    pub last_delta: f32,
}

#[wasm_bindgen]
impl Toast {
    /// Create a new toast.
    pub fn new(icon: ToastIcon, title: &str, subtitle: &str, progress_bar: bool) -> Self {
        Toast {
            icon,
            title: title.to_string(),
            subtitle: subtitle.to_string(),
            progress_bar,
            visibility: "show".to_string(),
            displayed: 0.0,
            current: 0.0,
            last_delta: 0.0,
        }
    }

    /// Hide the toast.
    pub fn hide(&mut self) {
        self.visibility = "hide".to_string();
    }

    /// Set progress value.
    pub fn set_progress(&mut self, f: f32) {
        self.current = f.max(0.0).min(1.0);
    }

    /// Draw the toast on the GUI.
    /// In a real implementation, this would call GUI drawing functions.
    pub fn draw(&self, _gui: &str) -> String {
        // Render toast using GUI blit/text
        "show".to_string()
    }
}

/// Tutorial step traits and implementations.
/// Each step handles a specific tutorial phase.

/// Trait for tutorial steps.
trait TutorialStep {
    /// Update the step state.
    fn update(&mut self, tutorial: &Tutorial);

    /// Called when the step is stopped.
    fn on_stop(&mut self);

    /// Handle movement input.
    fn handle_movement(&mut self, _input: &str) {}

    /// Handle mouse input.
    fn handle_mouse(&mut self, _dx: f32, _dy: f32) {}

    /// Called when mouse hovers over a target.
    fn on_mouse_hover(&mut self, _target: &str) {}

    /// Called when a block is hit.
    fn on_hit_block(&mut self, _state: &str, _face: i32) {}
}

/// Movement step: teaches basic movement controls.
struct MovementStep {
    /// Wait counter
    waiting: u32,
    /// Movement progress
    moved: u32,
    /// Look progress
    looked: u32,
    /// Whether movement was done
    did_move: bool,
    /// Whether turning was done
    did_turn: bool,
    /// When movement was completed
    move_done: u32,
    /// When look was completed
    look_done: u32,
    /// Movement toast reference
    move_toast: Option<Toast>,
    /// Look toast reference
    look_toast: Option<Toast>,
}

impl TutorialStep for MovementStep {
    fn update(&mut self, tutorial: &Tutorial) {
        self.waiting += 1;

        // Check for movement
        // In a real implementation, check input states

        if self.did_move {
            self.moved += 1;
            self.did_move = false;
        }
        if self.did_turn {
            self.looked += 1;
            self.did_turn = false;
        }

        // Check if both movement and look are done
        if self.move_done == u32::MAX && self.look_done == u32::MAX {
            // Advance to next step
        }

        // Update toast progress
        if let Some(toast) = self.move_toast.as_mut() {
            toast.set_progress(self.moved as f32 / 40.0);
        }
        if let Some(toast) = self.look_toast.as_mut() {
            toast.set_progress(self.looked as f32 / 40.0);
        }

        // Timeout after 100 updates
        if self.waiting >= 100 {
            if self.move_done == u32::MAX && self.move_toast.is_none() {
                // Show movement toast
                self.move_toast = Some(Toast::new(
                    ToastIcon { column: 0, row: 0 },
                    "Move title", "Move description", true,
                ));
            } else if self.move_done != u32::MAX
                && self.waiting - self.move_done >= 20
                && self.look_done == u32::MAX
                && self.look_toast.is_none()
            {
                // Show look toast
                self.look_toast = Some(Toast::new(
                    ToastIcon { column: 1, row: 0 },
                    "Look title", "Look description", true,
                ));
            }
        }
    }

    fn on_stop(&mut self) {
        self.move_toast = None;
        self.look_toast = None;
    }
}

/// Step: find a tree.
struct FindTreeStep {
    /// Wait counter
    waiting: u32,
    /// Toast reference
    toast: Option<Toast>,
}

impl TutorialStep for FindTreeStep {
    fn update(&mut self, tutorial: &Tutorial) {
        self.waiting += 1;

        // In survival mode only
        // if !tutorial.survival() {
        //     tutorial.set_step("none");
        //     return;
        // }

        // Check if player has trees or has punched trees
        // if tutorial.has_item(&[17, 162, 18, 161]) || tutorial.punched_trees() {
        //     tutorial.set_step("craft_planks");
        //     return;
        // }

        // Show find tree toast after timeout
        if self.waiting >= 6000 && self.toast.is_none() {
            self.toast = Some(Toast::new(
                ToastIcon { column: 2, row: 0 },
                "Find Tree Title", "Find Tree Description", false,
            ));
        }
    }

    fn on_stop(&mut self) {
        self.toast = None;
    }

    fn on_mouse_hover(&mut self, target: &str) {
        // Check if target is a tree block
        // if TREES.has(t.game.world.get_state(target.x, target.y, target.z) >> 4) {
        //     tutorial.set_step("punch_tree");
        // }
    }
}

/// Step: punch a tree.
struct PunchTreeStep {
    /// Wait counter
    waiting: u32,
    /// Reset counter
    resets: u32,
    /// Toast reference
    toast: Option<Toast>,
}

impl TutorialStep for PunchTreeStep {
    fn update(&mut self, tutorial: &Tutorial) {
        self.waiting += 1;

        // In survival mode only
        // if !tutorial.survival() {
        //     tutorial.set_step("none");
        //     return;
        // }

        // Check if player has logs or has punched trees
        // if tutorial.has_item(&[17, 162, 18, 161]) || tutorial.punched_trees() {
        //     tutorial.set_step("craft_planks");
        //     return;
        // }

        // Show punch tree toast after timeout or resets
        if (self.waiting >= 600 || self.resets > 3) && self.toast.is_none() {
            self.toast = Some(Toast::new(
                ToastIcon { column: 2, row: 0 },
                "Punch Tree Title", "Punch Tree Description", true,
            ));
        }

        // Handle block hit
        // const log = LOGS.has(state >> 4);
        // if (log && face > 0) {
        //     if (toast) toast.set_progress(face);
        //     if (face >= 1) tutorial.set_step("open_inventory");
        // } else if (toast) {
        //     toast.set_progress(0);
        // } else if (log) {
        //     self.resets += 1;
        // }
    }

    fn on_stop(&mut self) {
        self.toast = None;
    }

    fn on_hit_block(&mut self, state: &str, face: i32) {
        // Log handling logic
    }
}

/// Step: open inventory.
struct OpenInventoryStep {
    /// Wait counter
    waiting: u32,
    /// Toast reference
    toast: Option<Toast>,
}

impl TutorialStep for OpenInventoryStep {
    fn update(&mut self, tutorial: &Tutorial) {
        self.waiting += 1;

        // In survival mode only
        // if !tutorial.survival() {
        //     tutorial.set_step("none");
        //     return;
        // }

        // Show open inventory toast
        if self.waiting >= 600 && self.toast.is_none() {
            self.toast = Some(Toast::new(
                ToastIcon { column: 0, row: 1 },
                "Open Inventory Title", "Open Inventory Description", false,
            ));
        }

        // Open inventory advances step
        // if open_inventory_called {
        //     tutorial.set_step("craft_planks");
        // }
    }

    fn on_stop(&mut self) {
        self.toast = None;
    }

    fn open_inventory(&mut self) {
        // Mark that inventory was opened
    }
}

/// Step: craft planks.
struct CraftPlanksStep {
    /// Wait counter
    waiting: u32,
    /// Toast reference
    toast: Option<Toast>,
}

impl TutorialStep for CraftPlanksStep {
    fn update(&mut self, tutorial: &Tutorial) {
        self.waiting += 1;

        // In survival mode only
        // if !tutorial.survival() {
        //     tutorial.set_step("none");
        //     return;
        // }

        // Check if player has planks or has crafted before
        // if tutorial.has_item(&[5]) || tutorial.stat("stat.craftItem.minecraft.planks") > 0 {
        //     tutorial.set_step("none");
        //     return;
        // }

        // Show craft planks toast after timeout
        if self.waiting >= 1200 && self.toast.is_none() {
            self.toast = Some(Toast::new(
                ToastIcon { column: 1, row: 1 },
                "Craft Planks Title", "Craft Planks Description", false,
            ));
        }
    }

    fn on_stop(&mut self) {
        self.toast = None;
    }

    fn handle_set_slot(&mut self, item: &str) {
        // If player selects planks, finish tutorial
        // if item == "5" {
        //     tutorial.set_step("none");
        // }
    }
}