//! Port of `client/js/main.js`: the setup stages inside `boot()`'s guarded region —
//! graphics device + potato mode, asset preparation, the splash choreography, the
//! recipes gate, game + shader-library wiring, and running the launch decision.
//! The step sequencing lives in [`crate::boot_alg`]; the collaborator models and the
//! connect-vs-title decision live in [`crate::main_boot`].

use wasm_bindgen::prelude::*;

use crate::main_alg::{BootFailure, BootLog};
use crate::main_boot::{Assets, BootEnv, Game, GraphicsDevice, LaunchDecision, Settings, Splash};

// JS: `assets.readBytes('textures/gui/title/mojang.png')`
pub const MOJANG_LOGO: &str = "textures/gui/title/mojang.png";

// JS: `!!settings.superPotato || device.name === 'Software'` — Super Potato Mode is
// the setting, and always with the CPU rasteriser.
#[wasm_bindgen]
pub fn potato_decision(super_potato: bool, device_name: &str) -> bool {
    super_potato || device_name == "Software"
}

// JS: `if (P.setPotato) P.setPotato(!!settings.superPotato || device.name === 'Software');`
// — the member is optional (platform.js); absent means "skip entirely".
pub fn apply_potato(env: &mut dyn BootEnv, settings: &Settings, device: &GraphicsDevice) {
    let on = potato_decision(settings.super_potato, &device.name);
    let _ = env.set_potato(on);
}

// JS: `assets.setDevice(device);`
// JS: `assets.language = settings.language || 'en_us';`
// JS: `try { await assets.activatePacks(settings.resourcePacks || []); } catch (e)
//      { console.warn('Resource packs unavailable', e); }`
// Pack activation may fail — that is warned about and boot continues.
pub fn prepare_assets_stage(
    env: &mut dyn BootEnv,
    assets: &mut Assets,
    settings: &Settings,
    device: &GraphicsDevice,
    log: &mut BootLog,
) {
    assets.set_device(device.clone());
    assets.language = settings.effective_language();
    if let Err(error) = env.activate_packs(assets, &settings.resource_packs) {
        log.warn("Resource packs unavailable", &error.message);
    }
}

// JS: `const splash = new Splash(device);`
// JS: `await splash.load(await assets.readBytes('textures/gui/title/mojang.png').catch(() => null));`
// JS: `splash.start();`
// JS: `P.hideLoading();`
//
// The `.catch(() => null)` turns a failed (or absent) logo read into `null`, which
// `splash.load` treats as "draw plain white" — never a crash. Infallible.
pub fn start_splash_stage(env: &mut dyn BootEnv, device: &GraphicsDevice) -> Splash {
    let mut splash = Splash::new(device);
    let logo = env.read_bytes(MOJANG_LOGO).unwrap_or(None);
    splash.load(logo.as_deref());
    splash.start();
    env.hide_loading();
    splash
}

// JS: `await assets.load((msg) => console.log('[loading]', msg));`
// JS: `splash.stop();`
//
// A failure here is fatal (no inner catch) — and then `splash.stop()` never runs,
// so the splash keeps rendering until the crash screen takes over.
pub fn finish_splash_stage(
    env: &mut dyn BootEnv,
    assets: &mut Assets,
    splash: &mut Splash,
    log: &mut BootLog,
) -> Result<(), BootFailure> {
    let mut progress = |message: &str| log.loading(message);
    env.assets_load(assets, &mut progress)?;
    splash.stop();
    Ok(())
}

// JS: `initRecipes(assets.data.recipes);` (game/crafting.js). The crafting manager
// itself is ported in [`crate::crafting`]; the boot kernel records the call.
pub fn init_recipes(recipes: &str) {
    let _ = recipes;
}

// JS: `if (assets.data.recipes) initRecipes(assets.data.recipes);` — returns whether
// the call happened (the data is absent when the pack source had no recipes).
pub fn init_recipes_stage(assets: &Assets) -> bool {
    if !assets.has_recipes() {
        return false;
    }
    init_recipes(assets.data.recipes.as_deref().unwrap_or_default());
    true
}

// JS: `const game = new Game(assets, settings, device);` — JS passes the same asset,
// settings and device instances; the kernel clones the small handles.
pub fn create_game_stage(assets: Assets, settings: Settings, device: GraphicsDevice) -> Game {
    Game::new(assets, settings, device)
}

// JS: `game.shaderLibrary = new ShaderLibrary(game.shaderPack);`
// JS: `try { await game.shaderLibrary.load(); } catch (e) {
//        game.shaderPack.error = e.message; console.warn('Shader pack unavailable', e.message); }`
//
// A failed load is warned about and recorded on the shader pack; boot continues.
pub fn shader_stage(env: &mut dyn BootEnv, game: &mut Game, log: &mut BootLog) {
    game.set_shader_library();
    let result = match game.shader_library.as_mut() {
        Some(library) => {
            let result = env.shader_library_load(library);
            library.loaded = result.is_ok();
            result
        }
        None => Ok(()),
    };
    if let Err(error) = result {
        game.set_shader_pack_error(&error.message);
        log.warn("Shader pack unavailable", &error.message);
    }
}

// JS: `if (params.connect) { ... game.connect(...); } else {
//        game.screens.open(new TitleScreen(game)); }`
// The decision is computed by `crate::main_boot::decide_launch`; this runs it.
pub fn apply_launch(game: &mut Game, decision: &LaunchDecision) {
    match decision {
        // JS: `game.connect(params.connect, 0, params.user || null);`
        LaunchDecision::ConnectEagler { address, user } => game.connect(address, 0, user.as_deref()),
        // JS: `game.connect(a ? a.host : 'localhost', a ? a.port : 25565, params.user || null);`
        LaunchDecision::ConnectVanilla { host, port, user } => game.connect(host, *port, user.as_deref()),
        // JS: `game.screens.open(new TitleScreen(game));`
        LaunchDecision::OpenTitle => game.open_title_screen(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_boot::{BootConfig, Screen, Settings, ShaderLibrary};

    // Scripted env for the stage functions; every fallible knob is configurable.
    struct StageEnv {
        device: Option<GraphicsDevice>,
        potato: Vec<bool>,
        has_set_potato: bool,
        read_bytes: Result<Option<Vec<u8>>, String>,
        activate_packs: Result<(), String>,
        assets_load: Result<(), String>,
        shader_load: Result<(), String>,
        hidden_loading: usize,
    }

    impl Default for StageEnv {
        fn default() -> StageEnv {
            StageEnv {
                device: Some(GraphicsDevice::new("WebGL2")),
                potato: Vec::new(),
                has_set_potato: true,
                read_bytes: Ok(Some(vec![0x89, b'P', b'N', b'G'])),
                activate_packs: Ok(()),
                assets_load: Ok(()),
                shader_load: Ok(()),
                hidden_loading: 0,
            }
        }
    }

    impl BootEnv for StageEnv {
        fn init_wasm(&mut self) -> Result<(), BootFailure> {
            Ok(())
        }
        fn create_graphics_device(&mut self, _preference: &str) -> Result<GraphicsDevice, BootFailure> {
            self.device.clone().ok_or_else(|| BootFailure::new("no graphics API"))
        }
        fn set_potato(&mut self, on: bool) -> Option<()> {
            if !self.has_set_potato {
                return None;
            }
            self.potato.push(on);
            Some(())
        }
        fn hide_loading(&mut self) {
            self.hidden_loading += 1;
        }
        fn set_loading_error(&mut self, _message: &str) {}
        fn read_bytes(&mut self, _path: &str) -> Result<Option<Vec<u8>>, BootFailure> {
            self.read_bytes.clone().map_err(BootFailure::new)
        }
        fn activate_packs(&mut self, _assets: &mut Assets, _packs: &[String]) -> Result<(), BootFailure> {
            self.activate_packs.clone().map_err(BootFailure::new)
        }
        fn assets_load(&mut self, assets: &mut Assets, progress: &mut dyn FnMut(&str)) -> Result<(), BootFailure> {
            progress("blocks");
            assets.data.recipes = Some("[]".to_string());
            self.assets_load.clone().map_err(BootFailure::new)
        }
        fn shader_library_load(&mut self, _library: &mut ShaderLibrary) -> Result<(), BootFailure> {
            self.shader_load.clone().map_err(BootFailure::new)
        }
    }

    #[test]
    fn potato_is_the_setting_or_a_software_device() {
        assert!(potato_decision(true, "WebGL2"));
        assert!(potato_decision(false, "Software"));
        assert!(potato_decision(true, "Software"));
        assert!(!potato_decision(false, "WebGL2"));
        assert!(!potato_decision(false, "WebGPU"));
    }

    #[test]
    fn apply_potato_respects_the_optional_member() {
        let settings = Settings::new(&BootConfig::default(), "{}");
        let device = GraphicsDevice::new("WebGL2");
        let mut env = StageEnv::default();
        apply_potato(&mut env, &settings, &device);
        assert_eq!(env.potato, vec![false]); // superPotato off + hardware device

        let mut env = StageEnv::default();
        env.has_set_potato = false;
        apply_potato(&mut env, &settings, &device);
        assert!(env.potato.is_empty()); // JS: `if (P.setPotato)` — skipped

        let mut env = StageEnv::default();
        env.device = Some(GraphicsDevice::new("Software"));
        let software = GraphicsDevice::new("Software");
        apply_potato(&mut env, &settings, &software);
        assert_eq!(env.potato, vec![true]); // always with the CPU rasteriser
    }

    #[test]
    fn prepare_assets_applies_language_and_tolerates_pack_failures() {
        let mut env = StageEnv::default();
        let settings = Settings::new(&BootConfig::default(), r#"{"resourcePacks":["vanilla"]}"#);
        let device = GraphicsDevice::new("WebGL2");
        let mut assets = Assets::new();
        let mut log = BootLog::default();
        prepare_assets_stage(&mut env, &mut assets, &settings, &device, &mut log);
        assert_eq!(assets.device, Some(device.clone()));
        assert_eq!(assets.language, "en_us");
        assert!(log.entries.is_empty());

        // JS: catch → `console.warn('Resource packs unavailable', e)` — and continue.
        let mut env = StageEnv::default();
        env.activate_packs = Err("zip broken".to_string());
        let mut log = BootLog::default();
        prepare_assets_stage(&mut env, &mut assets, &settings, &device, &mut log);
        assert_eq!(
            log.entries,
            vec![crate::main_alg::ConsoleEntry::Warn {
                label: "Resource packs unavailable".to_string(),
                detail: "zip broken".to_string(),
            }]
        );
    }

    #[test]
    fn start_splash_tolerates_a_failed_logo_read() {
        let device = GraphicsDevice::new("WebGL2");
        // Logo loads: texture exists, splash running, loading hidden.
        let mut env = StageEnv::default();
        let splash = start_splash_stage(&mut env, &device);
        assert!(splash.texture);
        assert!(splash.running);
        assert_eq!(env.hidden_loading, 1);

        // JS: `.catch(() => null)` — the read failing leaves plain white, no crash.
        let mut env = StageEnv::default();
        env.read_bytes = Err("404".to_string());
        let splash = start_splash_stage(&mut env, &device);
        assert!(!splash.texture);
        assert!(splash.running);
        assert_eq!(env.hidden_loading, 1);

        // A null read (asset simply missing) behaves the same.
        let mut env = StageEnv::default();
        env.read_bytes = Ok(None);
        let splash = start_splash_stage(&mut env, &device);
        assert!(!splash.texture);
    }

    #[test]
    fn finish_splash_stops_only_after_a_successful_load() {
        let mut env = StageEnv::default();
        let device = GraphicsDevice::new("WebGL2");
        let mut splash = start_splash_stage(&mut env, &device);
        let mut assets = Assets::new();
        let mut log = BootLog::default();
        finish_splash_stage(&mut env, &mut assets, &mut splash, &mut log).unwrap();
        assert!(!splash.running);
        assert!(!splash.texture);
        // JS: `(msg) => console.log('[loading]', msg)`
        assert_eq!(log.entries, vec![crate::main_alg::ConsoleEntry::Loading("blocks".to_string())]);
        assert_eq!(assets.data.recipes.as_deref(), Some("[]"));

        // JS: `await assets.load(...)` throws → `splash.stop()` never runs (fatal).
        let mut env = StageEnv::default();
        env.assets_load = Err("bad blocks.json".to_string());
        let mut splash = start_splash_stage(&mut env, &device);
        let mut assets = Assets::new();
        let mut log = BootLog::default();
        let error = finish_splash_stage(&mut env, &mut assets, &mut splash, &mut log).unwrap_err();
        assert_eq!(error.message, "bad blocks.json");
        assert!(splash.running); // still rendering
    }

    #[test]
    fn recipes_gate_follows_the_data_flag() {
        let mut assets = Assets::new();
        assert!(!init_recipes_stage(&assets)); // JS: `if (assets.data.recipes)` falsy
        assets.data.recipes = Some("[]".to_string());
        assert!(init_recipes_stage(&assets));
    }

    #[test]
    fn shader_stage_records_failures_on_the_pack() {
        let device = GraphicsDevice::new("WebGL2");
        let mut game = create_game_stage(Assets::new(), Settings::new(&BootConfig::default(), "{}"), device);

        // Successful load: no error recorded, library marked loaded.
        let mut env = StageEnv::default();
        let mut log = BootLog::default();
        shader_stage(&mut env, &mut game, &mut log);
        assert_eq!(game.shader_pack.error, None);
        assert_eq!(game.shader_library.as_ref().map(|l| l.loaded), Some(true));
        assert!(log.entries.is_empty());

        // JS: catch → `game.shaderPack.error = e.message;` + warn — and continue.
        let mut env = StageEnv::default();
        env.shader_load = Err("bad GLSL".to_string());
        let mut log = BootLog::default();
        shader_stage(&mut env, &mut game, &mut log);
        assert_eq!(game.shader_pack.error.as_deref(), Some("bad GLSL"));
        assert_eq!(game.shader_library.as_ref().map(|l| l.loaded), Some(false));
        assert_eq!(
            log.entries,
            vec![crate::main_alg::ConsoleEntry::Warn {
                label: "Shader pack unavailable".to_string(),
                detail: "bad GLSL".to_string(),
            }]
        );
    }

    #[test]
    fn apply_launch_runs_each_decision() {
        // JS: `game.connect(params.connect, 0, params.user || null);` — port literal 0.
        let mut game = create_game_stage(
            Assets::new(),
            Settings::new(&BootConfig::default(), "{}"),
            GraphicsDevice::new("WebGL2"),
        );
        apply_launch(
            &mut game,
            &LaunchDecision::ConnectEagler {
                address: "ws://s.example/play".to_string(),
                user: Some("Steve".to_string()),
            },
        );
        assert_eq!(game.server_address.as_ref().map(|a| (a.host.as_str(), a.port)), Some(("ws://s.example/play", 0)));
        assert_eq!(game.connect_username.as_deref(), Some("Steve"));
        assert_eq!(game.current_screen, Some(Screen::ConnectingScreen));

        // JS: `game.connect(a.host, a.port, ...)`
        let mut game = create_game_stage(
            Assets::new(),
            Settings::new(&BootConfig::default(), "{}"),
            GraphicsDevice::new("WebGL2"),
        );
        apply_launch(
            &mut game,
            &LaunchDecision::ConnectVanilla {
                host: "mc.example.com".to_string(),
                port: 25566,
                user: None,
            },
        );
        assert_eq!(game.server_address.as_ref().map(|a| (a.host.as_str(), a.port)), Some(("mc.example.com", 25566)));

        // JS: `game.screens.open(new TitleScreen(game));`
        let mut game = create_game_stage(
            Assets::new(),
            Settings::new(&BootConfig::default(), "{}"),
            GraphicsDevice::new("WebGL2"),
        );
        apply_launch(&mut game, &LaunchDecision::OpenTitle);
        assert_eq!(game.current_screen, Some(Screen::TitleScreen));
    }
}
