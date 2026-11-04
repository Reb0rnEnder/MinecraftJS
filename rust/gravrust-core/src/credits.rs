// Port of `client/js/gui/screens/credits.js`:
// GuiWinGame: the end poem (texts/end.txt) and credits (texts/credits.txt) scrolling over a darkened dirt
// background, from the active resource packs or the vanilla jar. Esc or reaching the end respawns.

//! Credits screen rendering and tick logic ported from vanilla Minecraft.

use crate::gui::gui::Gui;

/// Width of the credits text area
const WIDTH: i32 = 274;
/// Scrolling speed field_146578_s
const SPEED: f32 = 0.5;

/// Credits screen state
pub struct CreditsScreen {
    /// Background color/state: 'none' or a texture reference
    background: String,
    /// Accumulated tick count
    time: i32,
    /// Rendered lines of credits text
    lines: Vec<String>,
    /// Total pixel height of all credit lines
    total_height: i32,
    /// Whether the credits music should play
    is_credits: bool,
}

impl CreditsScreen {
    /// Create a new credits screen
    pub fn new(background: String) -> Self {
        CreditsScreen {
            background,
            time: 0,
            lines: Vec::new(),
            total_height: 0,
            is_credits: true,
        }
    }

    /// Load the end poem and credits text from resource packs
    pub async fn load(&mut self, game: &crate::game::Game, font: &crate::gui::font::Font) {
        let g = game;
        let A = &g.assets;
        let name = g.username.clone()
            .or_else(|| {
                g.accounts
                    .as_ref()
                    .and_then(|a| a.active())
                    .map(|a| a.name.clone())
            })
            .unwrap_or_else(|| "Player".to_string());

        let mut lines: Vec<String> = Vec::new();

        // Load and process end.txt
        if let Ok(end) = A.read_text("texts/end.txt").await {
            let mark = "§f§k§a§b";
            let rnd = crate::util::jrandom::JavaRandom::new(8124371);
            for s in (end || "").split(/\r?\n/) {
                let s = s.replace("PLAYERNAME", &name);
                let mut s = s;
                while s.contains(mark) {
                    let j = s.index_of(mark);
                    let replacement = format!(
                        "§f§kXXXXXXXX".slice(0, rnd.next_int(4) + 3)
                    );
                    s = &s[..j] + &replacement + &s[j + mark.len()..];
                }
                lines.extend_from_slice(&font.wrap(s, WIDTH));
                lines.push("");
            }
        }

        // Add empty lines
        for _ in 0..8 {
            lines.push("");
        }

        // Load and process credits.txt
        if let Ok(credits) = A.read_text("texts/credits.txt").await {
            for s in (credits || "").split(/\r?\n/) {
                let s = s.replace("PLAYERNAME", &name).replace("\t", "    ");
                lines.extend_from_slice(&font.wrap(s, WIDTH));
                lines.push("");
            }
        }

        self.lines = lines;
        self.total_height = lines.len() * 12;
    }

    /// Check if the credits scrolling is complete
    pub fn end(&self) -> f32 {
        let h = self.total_height as f32 + self.height() as f32 + self.height() as f32 + 24;
        (h + self.height as f32 + 24) / SPEED
    }

    /// Get the height of the credits screen
    pub fn height(&self) -> i32 {
        // Placeholder - would be derived from GUI dimensions
        256
    }

    /// Tick the credits screen animation
    pub fn tick(&mut self) {
        self.time += 1;
        // if self.time > self.end() { self.respawn(); }
    }

    /// Handle keyboard input
    pub fn key(&mut self, code: &str) -> bool {
        if code == "Escape" {
            self.respawn();
            return true;
        }
        true
    }

    /// Close/respawn handler
    pub fn respawn(&mut self, game: &crate::game::Game) {
        if self.done() {
            return;
        }
        self.set_done(true);
        game.send(crate::net::packets::client_command(0));
        game.screens.open(None);
    }

    /// Check if already done
    fn done(&self) -> bool {
        // Placeholder
        false
    }

    fn set_done(&mut self, _: bool) {}

    /// Render the credits screen
    pub fn render(&self, gui: &mut Gui, mx: i32, my: i32, partial: f32) {
        let W = self.width();
        let H = self.height();
        let t = self.time + partial as i32;

        // Draw background
        let bg = game.assets.texture("gui/options_background.png", { wrap: 'repeat' });
        let f = 0 - t * 0.5 * SPEED;
        let f1 = H - t * 0.5 * SPEED;
        let f2 = 0.015625;
        let f3 = t * 0.02;
        let f5 = (self.end() - 20.0 - t as f32) * 0.005;
        if f5 < f3 {
            f3 = f5;
        }
        if f3 > 1.0 {
            f3 = 1.0;
        }
        let f3 = f3.max(0.0) * f3 * 96.0 / 255.0;

        if let Some(bg) = bg {
            gui.quad(bg, 0, 0, W, H, 0, f1 * f2, W * f2, f * f2, [f3, f3, f3, 1.0]);
        } else {
            gui.rect(0, 0, W, H, 0xff000000);
        }

        if !self.lines.is_empty() {
            let x = (W as f32 / 2.0 - WIDTH as f32 / 2.0).floor() as i32;
            let k = H + 50;
            let off = -t * SPEED as i32;
            gui.push_matrix();
            gui.translate(0, off);

            // Minecraft logo
            let logo = "gui/title/minecraft.png";
            gui.blit(logo, x, k, 0, 0, 155, 44);
            gui.blit(logo, x + 155, k, 0, 45, 155, 44);
            gui.blit(
                "gui/title/edition.png",
                x + 88,
                k + 37,
                0,
                0,
                98,
                14,
                128,
                16,
            );

            let mut l = k + 200;
            for (i, line) in self.lines.iter().enumerate() {
                if i == self.lines.len() - 1 {
                    // the last line stops in the middle of the screen
                    let f1b = l + off - ((H as f32 / 2.0) - 6.0);
                    if f1b < 0 {
                        gui.translate(0, -f1b);
                    }
                }
                if l + off + 12 + 8 > 0 && l + off < H {
                    let s = line.as_str();
                    if s.starts_with("[C]") {
                        let c = &s[3..];
                        gui.text(
                            c,
                            x + ((WIDTH as f32 - gui.text_width(c)) / 2.0).floor() as i32,
                            l,
                            0xffffff,
                            true,
                        );
                    } else {
                        gui.text(s, x, l, 0xffffff, true);
                    }
                }
                l += 12;
            }
            gui.pop_matrix();
        }

        // Vignette
        if let Some(v) = gui.tex("misc/vignette.png") {
            gui.set_blend("darken");
            gui.quad(v, 0, 0, W, H, 0, 0, 1, 1, [1.0, 1.0, 1.0, 1.0]);
            gui.set_blend("alpha");
        }
    }

    /// Get the screen width
    fn width(&self) -> i32 {
        274
    }
}

// Mock methods that would be implemented by the GUI framework
impl Gui {
    fn text_width(&self, s: &str) -> f32 {
        // Simple approximation
        s.len() as f32 * 8.0
    }
}