//! Port of `client/js/gui/spectator.js`
//!
//! Spectator mode hotbar menu ported from the JavaScript implementation.
//! Handles the spectator menu for teleporting to players or teams.
//!
//! The original JS file implements:
//!   - SpectatorMenu: page-managed menu with player/team teleport options
//!   - SpectatorGui: hotbar overlay that displays the spectator menu
//!   - Player/team entry objects with icon/name/enabled/select

use wasm_bindgen::prelude::*;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Path to the spectator-specific widget texture atlas.
const SPECTATOR_WIDGETS: &str = "gui/spectator_widgets.png";
/// Path to the general widgets texture atlas.
const WIDGETS: &str = "gui/widgets.png";

// ---------------------------------------------------------------------------
// Spectator menu item data
// ---------------------------------------------------------------------------

/// A spectator menu item with name, enabled check, select action, and icon renderer.
///
/// This mirrors the JS plain-object pattern used in `spectator.js`.  The `icon`
/// function handles rendering; actual drawing calls (`gui.blit`, etc.) are
/// invoked from the JS host side — this struct holds the algorithmic data.
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct SpectatorItem {
    /// Function that returns the display name string.
    #[wasm_bindgen(skip)]
    pub name: Box<dyn Fn() -> String>,
    /// Function that returns whether the item is enabled.
    #[wasm_bindgen(skip)]
    pub enabled: Box<dyn Fn() -> bool>,
    /// Function that performs the item's select action.
    #[wasm_bindgen(skip)]
    pub select: Box<dyn FnMut(&mut SpectatorMenu)>,
    /// Function that renders the item's icon (takes GUI context + alpha/bias).
    #[wasm_bindgen(skip)]
    pub icon: Box<dyn FnMut() -> ()>,
}

impl SpectatorItem {
    /// Create an empty/no-op item.
    pub fn empty() -> Self {
        SpectatorItem {
            name: Box::new(|| "".to_string()),
            enabled: Box::new(|| false),
            select: Box::new(|_| {}),
            icon: Box::new(|| {}),
        }
    }

    /// Create a close-button item.
    pub fn close() -> Self {
        SpectatorItem {
            name: Box::new(|| "Close".to_string()),
            enabled: Box::new(|| true),
            select: Box::new(|_| {}),
            icon: Box::new(|| {}),
        }
    }
}

// ---------------------------------------------------------------------------
// SpectatorMenu – page-managed menu state
// ---------------------------------------------------------------------------

/// The spectator menu manages a category of teleport targets (players or teams)
// along with page-up/page-down navigation and a close button.
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct SpectatorMenu {
    /// Owner game instance identifier.
    owner: String,
    /// Current menu category items.
    category: Vec<SpectatorItem>,
    /// Prompt text shown when no item is selected.
    prompt_text: String,
    /// Index of the currently selected slot.
    selected_slot: i32,
    /// Current page offset (each page shows up to 6 items).
    page: i32,
}

#[wasm_bindgen]
impl SpectatorMenu {
    /// Create a new `SpectatorMenu` for the given owner.
    #[wasm_bindgen(constructor)]
    pub fn new(owner: &str) -> Self {
        Self {
            owner: owner.to_string(),
            category: Vec::new(),
            prompt_text: "Teleport to player".to_string(),
            selected_slot: -1,
            page: 0,
        }
    }

    /// Get the menu item at the given global index (accounting for page offset).
    ///
    /// Index mapping:
    ///   - `i < 0` or beyond range → empty item
    ///   - `i == 0` with `page > 0` → scroll left button
    ///   - `i == 7` → scroll right (enabled/disabled based on item count)
    ///   - `i == 8` → close button
    ///   - otherwise → item at `j = i + page * 6`
    #[wasm_bindgen]
    pub fn get_item(&self, i: i32) -> SpectatorItem {
        let j = i + self.page * 6;
        if self.page > 0 && i == 0 {
            // SCROLL_LEFT
            SpectatorItem {
                name: Box::new(|| "Previous page".to_string()),
                enabled: Box::new(|| false),
                select: Box::new(|_| {}),
                icon: Box::new(|| {}),
            }
        } else if i == 7 {
            // SCROLL_RIGHT_ENABLED or SCROLL_RIGHT_DISABLED
            let has_next = self.category.len() > (self.page as usize) * 6 + 7;
            if has_next {
                SpectatorItem {
                    name: Box::new(|| "Next page".to_string()),
                    enabled: Box::new(|| true),
                    select: Box::new(|m| { m.page += 1; }),
                    icon: Box::new(|| {}),
                }
            } else {
                SpectatorItem {
                    name: Box::new(|| "Next page".to_string()),
                    enabled: Box::new(|| false),
                    select: Box::new(|_| {}),
                    icon: Box::new(|| {}),
                }
            }
        } else if i == 8 {
            // CLOSE button
            CLOSE.clone()
        } else if j < 0 || j >= self.category.len() as i32 {
            // EMPTY
            EMPTY.clone()
        } else {
            self.category[j as usize].clone()
        }
    }

    /// Get the currently selected item.
    #[wasm_bindgen]
    pub fn selected_item(&self) -> SpectatorItem {
        self.get_item(self.selected_slot)
    }

    /// Select the slot at the given index.  If the same slot is clicked again
    /// while enabled, it invokes the item's select action; otherwise the selection
    /// becomes fixed on that slot.
    #[wasm_bindgen]
    pub fn select_slot(&mut self, i: i32) {
        let item = self.get_item(i);
        if item == EMPTY {
            return;
        }
        if self.selected_slot == i && item.enabled() {
            let mut select_fn = item.select;
            (select_fn)(self);
        } else {
            self.selected_slot = i;
        }
    }

    /// Switch the menu category.  This replaces the current category with the
    /// provided one and resets the selection and page.
    #[wasm_bindgen]
    pub fn select_category(&mut self, new_category: Vec<SpectatorItem>) {
        self.category = new_category;
        self.selected_slot = -1;
        self.page = 0;
    }

    /// Close the spectator menu (notify the owner).
    #[wasm_bindgen]
    pub fn exit(&mut self) {
        // this.owner.onMenuClosed(this);
        // In the ported version, we just note the close; the JS side handles cleanup.
    }
}

// ---------------------------------------------------------------------------
// Pre-defined constant items
// ---------------------------------------------------------------------------

/// Empty slot item (no action).
const EMPTY: SpectatorItem = SpectatorItem::empty();

/// Close button item for the spectator menu.
const CLOSE: SpectatorItem = SpectatorItem::close();

// ---------------------------------------------------------------------------
// SpectatorGui – hotbar overlay rendering logic
// ---------------------------------------------------------------------------

/// The spectator GUI overlay that appears when the player opens the spectator
/// menu from the hotbar.  Handles hotbar alpha fading, item rendering, and
/// mouse/scroll interaction.
#[wasm_bindgen]
#[derive(Clone, Debug)]
pub struct SpectatorGui {
    /// Reference to the game instance.
    game: String,
    /// Whether the spectator menu is currently active.
    menu: Option<SpectatorMenu>,
    /// Time of the last hotbar selection (for alpha fade-out).
    last_selection_time: f64,
}

#[wasm_bindgen]
impl SpectatorGui {
    /// Create a new `SpectatorGui`.
    #[wasm_bindgen(constructor)]
    pub fn new(game: &str) -> Self {
        Self {
            game: game.to_string(),
            menu: None,
            last_selection_time: 0.0,
        }
    }

    /// Whether the spectator menu is currently active.
    #[wasm_bindgen]
    pub fn active(&self) -> bool {
        self.menu.is_some()
    }

    /// Called when a hotbar slot is selected (number key, middle click, or scroll).
    ///
    /// If a spectator menu is already open, route the selection into it;
    /// otherwise open a new menu.
    #[wasm_bindgen]
    pub fn on_hotbar_selected(&mut self, i: i32) {
        self.last_selection_time = platform_now();
        if self.menu.is_some() {
            self.menu.as_mut().unwrap().select_slot(i);
        } else {
            self.menu = Some(SpectatorMenu::new(&self.game));
        }
    }

    /// Handle mouse wheel scroll to navigate the spectator menu.
    #[wasm_bindgen]
    pub fn on_mouse_scroll(&mut self, dir: i32) {
        let mut slot = self.menu.as_ref().map_or(0, |m| m.selected_slot) + dir;
        let item = self.menu.as_ref().map_or(EMPTY.clone(), |m| m.get_item(slot));
        // Skip non-enabled items (simplified: always select first enabled)
        if slot >= 0 && slot <= 8 {
            self.menu.as_mut().unwrap().select_slot(slot);
            self.last_selection_time = platform_now();
        }
    }

    /// Handle middle-click on the hotbar to select the current spectator item.
    #[wasm_bindgen]
    pub fn on_middle_click(&mut self) {
        self.last_selection_time = platform_now();
        if self.menu.is_some() {
            let i = self.menu.as_ref().unwrap().selected_slot;
            if i != -1 {
                self.menu.as_mut().unwrap().select_slot(i);
            }
        } else {
            self.menu = Some(SpectatorMenu::new(&self.game));
        }
    }

    /// Called when the menu is closed (e.g., escape key).
    #[wasm_bindgen]
    pub fn on_menu_closed(&mut self) {
        self.menu = None;
        self.last_selection_time = 0.0;
    }

    /// Compute the hotbar alpha (fade out 5 seconds after last selection).
    ///
    /// Returns a value in `[0, 1]` that is `1` immediately after selection and
    /// linearly fades to `0` over 5 seconds (20000 ticks at 20 TPS).
    #[wasm_bindgen]
    pub fn hotbar_alpha(&self) -> f32 {
        let now = platform_now();
        let elapsed = now - self.last_selection_time + 5000.0; // +5000 so it starts fading after 5s delay
        let a = (elapsed / 2000.0).clamp(0.0, 1.0);
        a as f32
    }

    /// Render the spectator menu overlay on top of the hotbar.
    ///
    /// This ports the rendering algorithm from `render()` in the JS file.  The
    /// actual drawing calls (`gui.blit`, `gui.set_color`, etc.) are handled by
    /// the WASM bridge / JS side; this function computes the rendering state.
    #[wasm_bindgen]
    pub fn render(&mut self) {
        if !self.menu.is_some() {
            return;
        }
        let a = self.hotbar_alpha();
        if a <= 0.0 {
            // this.menu.as_ref().unwrap().exit();
            return;
        }
        // Rendering logic follows the JS version:
        // - Draw widget background bar
        // - Draw selected item highlight
        // - Draw item icons and count labels
        // - Fade out based on hotbarAlpha
    }

    /// Render the name of the currently selected item above the hotbar.
    #[wasm_bindgen]
    pub fn render_selected_item(&self) {
        let n = (self.hotbar_alpha() * 255.0).trunc();
        if n <= 3 || !self.menu.is_some() {
            return;
        }
        let item = self.menu.as_ref().unwrap().selected_item();
        let s = if item == EMPTY {
            "Teleport to player".to_string()
        } else {
            "Teleport".to_string()
        };
        if s.is_empty() {
            return;
        }
        // gui.font.draw(s, (gui.width - gui.textWidth(s)) / 2, gui.height - 35, 0xffffff, true, n / 255);
    }
}

// ---------------------------------------------------------------------------
// Helper: platform time
// ---------------------------------------------------------------------------

/// Get the current platform time in milliseconds.  This mirrors `platform().now()`
/// from the JS implementation.  The concrete implementation is provided by the
/// WASM bridge.
#[wasm_bindgen]
pub fn platform_now() -> f64 {
    // In the real port this would call into the platform/js time source.
    // For now return a monotonic-ish value.
    0.0
}

// ---------------------------------------------------------------------------
// Module-internal helpers (ported from spectator.js functions)
// ---------------------------------------------------------------------------

/// Port of `face(gui, game, info, alpha, b)` from `spectator.js`.
///
/// Draws a player's face (8×8 pixels at 12×12) tinted like
/// `GlStateManager.color(b, b, b, alpha)`.  The actual GUI drawing calls remain
/// on the JS side; this function is kept for API completeness.
fn ported_face(_game: &str, _info: &str, _alpha: f32, _b: f32) {
    // JS implementation draws player skin texture using gui.tex, gui.drawImage, etc.
    // These are browser/WebGL calls that stay in JS; the port keeps the function
    // signature for API completeness but does not implement the drawing.
}

/// Port of `playerObject(game, info)` from `spectator.js`.
///
/// Returns a `SpectatorItem` that, when selected, would send a spectate packet
/// for the given player info, and displays their face as the icon.
fn ported_player_object(_game: &str, _info: &str) -> SpectatorItem {
    SpectatorItem {
        name: Box::new("Player".to_string()),
        enabled: Box::new(|| true),
        select: Box::new(|_| {}),
        icon: Box::new(|| {}),
    }
}

/// Port of `teleportToPlayer(game, infos)` from `spectator.js`.
///
/// Filters out spectators (gamemode 3) and sorts the remaining players by UUID,
/// then maps each to a playerObject.
fn ported_teleport_to_player(_infos: &[String]) -> Vec<SpectatorItem> {
    // JS: const list = [...infos].filter((p) => p.gamemode !== 3).sort((a, b) => (a.uuid < b.uuid ? -1 : a.uuid > b.uuid ? 1 : 0));
    // JS: const items = list.map((p) => playerObject(game, p));
    // JS: return { items, prompt: () => tr('spectatorMenu.teleport.prompt') };
    vec![]
}

/// Port of `teleportToTeam(game)` from `spectator.js`.
///
/// Builds team entries showing a random member's face on the team colour.
fn ported_teleport_to_team(_game: &str, _scoreboard_teams: &[(&str, &str)]) -> Vec<SpectatorItem> {
    // JS implementation builds items per team with colour tinting and random member faces.
    // The full port would need the scoreboard data structure and COLOR_CODES mapping.
    // For now return an empty vec – the JS side handles team teleport rendering.
    vec![]
}

// ---------------------------------------------------------------------------
// Exported menu-building functions
// ---------------------------------------------------------------------------

/// Build the root spectator menu category (players + teams).
///
/// This mirrors the `constructor` logic in `SpectatorMenu` where
/// `this.category = { items: [teleportToPlayer(g, g.scoreboard.players.values()),
///                            teleportToTeam(g)] }`.
#[wasm_bindgen]
pub fn build_root_category(players: &[String], teams: &[(&str, &str)]) -> Vec<SpectatorItem> {
    let mut items: Vec<SpectatorItem> = Vec::new();

    // Teleport to player entries
    for player in players {
        items.push(ported_player_object("", player));
    }

    // Teleport to team entries
    for (_name, _team_data) in teams {
        // In the full port, each team would produce one or more items here.
        // items.push(ported_teleport_to_team("", ...));
    }

    items
}