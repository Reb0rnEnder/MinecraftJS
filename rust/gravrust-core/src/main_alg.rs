//! Port of the failure half of `client/js/main.js` (the `catch` at the end of
//! `boot()`) plus the `client/js/crash.js` surface it calls: `buildCrashReport`
//! and `showCrashScreen`.
//!
//! `boot()` guards everything from `new Assets()` onward with one big try/catch:
//! a failure is logged with `console.error`, shown on the loading label as
//! `'Failed to load: ' + e.message`, and turned into a full-page crash report
//! built from `globalThis.game || null`. The steps before the `try` (initWasm,
//! setPlatform) reject the `boot()` promise with no handler — no crash screen.
//! JS `await` is modeled as `Result`; a rejected promise is `Err(BootFailure)`.

use wasm_bindgen::prelude::*;

use crate::main_boot::{BootEnv, Game, Screen};

// JS: an `Error` value; the catch blocks read `e.message` (main.js lines 44, 56).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BootFailure {
    pub message: String,
}

impl BootFailure {
    pub fn new(message: impl Into<String>) -> BootFailure {
        BootFailure { message: message.into() }
    }
}

// JS: the `console` calls boot() makes, recorded so hosts and tests can inspect them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConsoleEntry {
    // JS: `console.log('[loading]', msg)` — the `assets.load` progress callback.
    Loading(String),
    // JS: `console.warn('Config unavailable', e)` and its two siblings.
    Warn { label: String, detail: String },
    // JS: `console.error(e)` in the catch, and `showCrashScreen`'s `console.error(report)`.
    Error(String),
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct BootLog {
    pub entries: Vec<ConsoleEntry>,
}

impl BootLog {
    // JS: `console.log('[loading]', msg)`
    pub fn loading(&mut self, message: &str) {
        self.entries.push(ConsoleEntry::Loading(message.to_string()));
    }

    // JS: `console.warn(label, e)` / `console.warn(label, e.message)`
    pub fn warn(&mut self, label: &str, detail: &str) {
        self.entries.push(ConsoleEntry::Warn { label: label.to_string(), detail: detail.to_string() });
    }

    // JS: `console.error(e)` / `console.error(report)`
    pub fn error(&mut self, detail: &str) {
        self.entries.push(ConsoleEntry::Error(detail.to_string()));
    }
}

// JS: `'Failed to load: ' + e.message` (main.js line 56)
#[wasm_bindgen]
pub fn loading_error_message(message: &str) -> String {
    format!("Failed to load: {}", message)
}

// JS: `const COMMENTS = [...]` (crash.js) — one-liners for the report header.
pub const CRASH_COMMENTS: [&str; 12] = [
    "Well, that block was not supposed to go there.",
    "The creeper was inside the code all along.",
    "It worked fine in the last chunk.",
    "Somebody divided by a cactus.",
    "Have you tried turning the redstone off and on again?",
    "This is fine. Everything is on fire, but this is fine.",
    "The pixels went on strike.",
    "A wild exception appeared!",
    "Not my best tick.",
    "I promise this never happens in survival mode.",
    "Steve would like to apologise.",
    "Even the Ender Dragon has off days.",
];

// JS: `buildCrashReport(e, 'Starting the game', ...)` — the description boot() passes.
pub const CRASH_PHASE: &str = "Starting the game";

// The game snapshot `buildCrashReport` reads from `globalThis.game` (crash.js runs the
// `safe(label, fn)` accessors over it). Boot never enters a world, so the player and
// world fields stay 'none'/0 — they are kept so the report shape matches the JS.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CrashGame {
    // JS: `game.inWorld`
    pub in_world: bool,
    // JS: `game.serverAddress ? game.serverAddress.host + ':' + game.serverAddress.port : 'none'`
    pub server: Option<String>,
    // JS: `[game.player.x, game.player.y, game.player.z].map((v) => v.toFixed(3)).join(', ')`
    pub player: Option<String>,
    // JS: `game.world && game.world.dimension !== undefined ? game.world.dimension : 'none'`
    pub dimension: Option<String>,
    // JS: `game.gameMode`
    pub game_mode: u8,
    // JS: `game.screens && game.screens.current ? game.screens.current.constructor.name : 'none'`
    pub screen: Option<String>,
    // JS: `game.world && game.world.chunks ? game.world.chunks.size : 0`
    pub loaded_chunks: usize,
    // JS: `game.entities && game.entities.map ? game.entities.map.size : 0`
    pub entities: usize,
    // JS: `game.fps` — unset until the frame loop ticks.
    pub fps: Option<u32>,
    // JS: `game && game.device && game.device.name` (system details)
    pub device_name: Option<String>,
    // JS: `game.settings.superPotato || (game.device && game.device.name === 'Software')`
    pub super_potato: Option<bool>,
}

impl CrashGame {
    // JS: the crash.js `safe(...)`/`sys(...)` reads over the game handle. Boot never
    // enters a world, so player/world fields stay 'none' and the counters stay 0.
    pub fn from_game(game: &Game) -> CrashGame {
        CrashGame {
            in_world: game.in_world,
            server: game
                .server_address
                .as_ref()
                .map(|address| format!("{}:{}", address.host, address.port)),
            player: None,
            dimension: None,
            game_mode: game.game_mode,
            screen: game.current_screen.map(Screen::report_name).map(str::to_string),
            loaded_chunks: 0,
            entities: 0,
            fps: game.fps,
            device_name: Some(game.device.name.clone()),
            super_potato: Some(game.settings.super_potato || game.device.is_software()),
        }
    }
}

// JS: `globalThis.game = game;` (the debugging handle the crash report reads as
// `globalThis.game || null`) plus crash.js's module-level `shown` flag.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct CrashState {
    // Snapshot of the published game handle; None until `globalThis.game = game` runs.
    pub game: Option<CrashGame>,
    // JS: `let shown = false;` — the DOM crash screen is only built once.
    pub screen_shown: bool,
}

// JS: `COMMENTS[Math.floor(Math.random() * COMMENTS.length)]` — the kernel picks the
// index with fastrand; `build_crash_report` takes the index so tests stay deterministic.
pub fn random_comment_index() -> usize {
    fastrand::usize(0..CRASH_COMMENTS.len())
}

// JS: `buildCrashReport(error, description, game)` (crash.js). `now` is the
// `yyyy-MM-dd HH:mm:ss` stamp JS formats from `new Date()` (host-provided here);
// `comment_index` selects the header one-liner JS picks at random.
//
// Browser-bound (stays in JS): the `Browser` / `Screen` / `Memory` / `CPU threads` /
// `Page` lines read navigator, screen, window and performance (crash.js lines 63-67),
// and the renderer line needs `device.info` from the graphics device.
pub fn build_crash_report(
    error: &BootFailure,
    description: &str,
    game: Option<&CrashGame>,
    comment_index: usize,
    now: &str,
) -> String {
    let mut lines: Vec<String> = Vec::new();
    lines.push("---- Gravrust Crash Report ----".to_string());
    lines.push(format!("// {}", CRASH_COMMENTS[comment_index % CRASH_COMMENTS.len()]));
    lines.push(String::new());
    lines.push(format!("Time: {}", now));
    lines.push(format!("Description: {}", description));
    lines.push(String::new());
    // JS: `err.stack || (err.name + ': ' + err.message)`, re-indented. The kernel has
    // no JS stack, so the name/message form is used.
    lines.push(format!("Error: {}", error.message));
    lines.push(String::new());
    lines.push(String::new());
    lines.push(
        "A detailed walkthrough of the error, its code path and all known details is as follows:"
            .to_string(),
    );
    lines.push("-".repeat(104));
    lines.push(String::new());
    if let Some(game) = game {
        lines.push("-- Affected game --".to_string());
        lines.push("Details:".to_string());
        lines.push(format!("\tIn world: {}", if game.in_world { "Yes" } else { "No" }));
        lines.push(format!("\tServer: {}", game.server.as_deref().unwrap_or("none")));
        lines.push(format!("\tPlayer position: {}", game.player.as_deref().unwrap_or("none")));
        lines.push(format!("\tDimension: {}", game.dimension.as_deref().unwrap_or("none")));
        lines.push(format!("\tGame mode: {}", game.game_mode));
        lines.push(format!("\tScreen: {}", game.screen.as_deref().unwrap_or("none")));
        lines.push(format!("\tLoaded chunks: {}", game.loaded_chunks));
        lines.push(format!("\tEntities: {}", game.entities));
        lines.push(format!(
            "\tFPS: {}",
            game.fps.map(|fps| fps.to_string()).unwrap_or_else(|| "undefined".to_string())
        ));
        lines.push(String::new());
    }
    lines.push("-- System Details --".to_string());
    lines.push("Details:".to_string());
    // JS: `sys('Gravrust Version', () => tr('Gravrust.version'))`
    lines.push(format!("\tGravrust Version: {}", env!("CARGO_PKG_VERSION")));
    if let Some(name) = game.and_then(|game| game.device_name.as_deref()) {
        // JS: `sys('Graphics API', () => game && game.device && game.device.name)`
        lines.push(format!("\tGraphics API: {}", name));
    }
    if let Some(on) = game.and_then(|game| game.super_potato) {
        // JS: `sys('Super Potato Mode', ...)` — 'on'/'off'
        lines.push(format!("\tSuper Potato Mode: {}", if on { "on" } else { "off" }));
    }
    lines.join("\n")
}

// JS: `showCrashScreen(report)`: logs the report, then builds the DOM crash screen once
// (guarded by the module-level `shown` flag, skipped without a `document`).
// Browser-bound (stays in JS): the DOM screen itself — style, textarea, and the
// copy/save/reload buttons.
pub fn show_crash_screen(report: &str, log: &mut BootLog, shown: &mut bool) {
    log.error(report); // JS: `console.error(report);` — unconditional
    if *shown {
        return; // JS: `if (shown || typeof document === 'undefined') return;`
    }
    *shown = true; // JS: `shown = true;` — the DOM build follows in JS
}

// JS: `} catch (e) { console.error(e); P.setLoadingError('Failed to load: ' + e.message);
// showCrashScreen(buildCrashReport(e, 'Starting the game', globalThis.game || null)); }`
// Returns the report text so the host can log or store it.
pub fn handle_boot_failure(
    env: &mut dyn BootEnv,
    log: &mut BootLog,
    error: &BootFailure,
    crash: &mut CrashState,
    now: &str,
) -> String {
    log.error(&error.message); // JS: `console.error(e);`
    env.set_loading_error(&loading_error_message(&error.message)); // JS: `P.setLoadingError(...)`
    let report = build_crash_report(error, CRASH_PHASE, crash.game.as_ref(), random_comment_index(), now);
    show_crash_screen(&report, log, &mut crash.screen_shown); // JS: `showCrashScreen(...)`
    report
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixes_the_loading_error() {
        assert_eq!(loading_error_message("boom"), "Failed to load: boom");
    }

    #[test]
    fn report_without_a_game_handle_skips_the_game_section() {
        let error = BootFailure::new("no webgl2");
        let report = build_crash_report(&error, CRASH_PHASE, None, 0, "2024-05-06 07:08:09");
        assert!(report.starts_with("---- Gravrust Crash Report ----\n// Well, that block was not supposed to go there."));
        assert!(report.contains("Time: 2024-05-06 07:08:09"));
        assert!(report.contains("Description: Starting the game"));
        assert!(report.contains("Error: no webgl2"));
        assert!(report.contains("-- System Details --"));
        assert!(report.contains("Gravrust Version: "));
        assert!(!report.contains("-- Affected game --"));
    }

    #[test]
    fn report_with_a_game_handle_prints_the_game_details() {
        let error = BootFailure::new("boom");
        let game = CrashGame {
            in_world: false,
            server: Some("mc.example.com:25565".to_string()),
            screen: Some("TitleScreen".to_string()),
            fps: None,
            device_name: Some("WebGL2".to_string()),
            super_potato: Some(true),
            ..CrashGame::default()
        };
        let report = build_crash_report(&error, CRASH_PHASE, Some(&game), 3, "2024-05-06 07:08:09");
        assert!(report.contains("-- Affected game --"));
        assert!(report.contains("\tIn world: No"));
        assert!(report.contains("\tServer: mc.example.com:25565"));
        assert!(report.contains("\tPlayer position: none"));
        assert!(report.contains("\tDimension: none"));
        assert!(report.contains("\tGame mode: 0"));
        assert!(report.contains("\tScreen: TitleScreen"));
        assert!(report.contains("\tLoaded chunks: 0"));
        assert!(report.contains("\tFPS: undefined"));
        assert!(report.contains("\tGraphics API: WebGL2"));
        assert!(report.contains("\tSuper Potato Mode: on"));
    }

    #[test]
    fn report_without_a_server_says_none() {
        let error = BootFailure::new("boom");
        let game = CrashGame { ..CrashGame::default() };
        let report = build_crash_report(&error, CRASH_PHASE, Some(&game), 11, "2024-05-06 07:08:09");
        assert!(report.contains("\tServer: none"));
        // JS: `COMMENTS[Math.floor(Math.random() * COMMENTS.length)]` — index 11 is the last.
        assert!(report.contains("// Even the Ender Dragon has off days."));
    }

    #[test]
    fn comment_index_wraps_instead_of_panicking() {
        let error = BootFailure::new("boom");
        let report = build_crash_report(&error, CRASH_PHASE, None, CRASH_COMMENTS.len() + 5, "t");
        assert!(report.contains(&format!("// {}", CRASH_COMMENTS[5])));
    }

    #[test]
    fn random_comment_index_stays_in_bounds() {
        for _ in 0..64 {
            assert!(random_comment_index() < CRASH_COMMENTS.len());
        }
    }

    #[test]
    fn the_crash_screen_shows_once() {
        // JS: `showCrashScreen` logs unconditionally but builds the DOM once.
        let mut log = BootLog::default();
        let mut shown = false;
        show_crash_screen("report-1", &mut log, &mut shown);
        assert!(shown);
        show_crash_screen("report-2", &mut log, &mut shown);
        assert!(shown);
        assert_eq!(log.entries, vec![
            ConsoleEntry::Error("report-1".to_string()),
            ConsoleEntry::Error("report-2".to_string()),
        ]);
    }
}
