//! Port of `client/js/main.js` — the `boot()` orchestration: the boot state
//! machine (every step of the JS function, in order, with its try/catch guard)
//! and the driver that sequences the setup stages from [`crate::main_boot2`]
//! against the collaborator models from [`crate::main_boot`], with the failure
//! path from [`crate::main_alg`].
//!
//! JS `await` is modeled as `Result`; a rejected promise is `Err(BootFailure)`.
//! The driver is host-driven: the JS side (client/js/wasm/ + the platform) stands
//! in as the [`BootEnv`] implementation, exactly like `P` stands in for the
//! browser in main.js.

use wasm_bindgen::prelude::*;

use crate::main_alg::{handle_boot_failure, BootFailure, BootLog, CrashGame, CrashState};
use crate::main_boot::{
    decide_launch, Assets, BootEnv, LaunchDecision, ProxyList, Settings,
};

// Every step of `boot()` (client/js/main.js), in source order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BootStep {
    // JS line 18: `await initWasm();` — load the Rust core before assets.
    InitWasm,
    // JS line 19: `setPlatform(new BrowserPlatform());`
    SetPlatform,
    // JS line 20: `const P = platform();`
    GetPlatform,
    // JS line 22: `let config = {}; try { config = P.loadConfig ? await P.loadConfig() : {}; } catch (e) { ... }`
    LoadConfig,
    // JS line 23: `const settings = new Settings(config);`
    NewSettings,
    // JS line 24: `const proxies = new ProxyList(settings);`
    NewProxyList,
    // JS line 26: `const assets = new Assets();` — start of the big `try`.
    NewAssets,
    // JS line 27: `const device = await P.createGraphicsDevice(settings.graphicsApi);`
    CreateGraphicsDevice,
    // JS line 29: `if (P.setPotato) P.setPotato(!!settings.superPotato || device.name === 'Software');`
    SetPotato,
    // JS line 30: `assets.setDevice(device);`
    AssetsSetDevice,
    // JS line 31: `assets.language = settings.language || 'en_us';`
    AssetsSetLanguage,
    // JS line 32: `try { await assets.activatePacks(settings.resourcePacks || []); } catch (e) { ... }`
    ActivatePacks,
    // JS line 34: `const splash = new Splash(device);`
    NewSplash,
    // JS line 35: `await splash.load(await assets.readBytes('...mojang.png').catch(() => null));`
    SplashLoadLogo,
    // JS line 36: `splash.start();`
    SplashStart,
    // JS line 37: `P.hideLoading();`
    HideLoading,
    // JS line 38: `await assets.load((msg) => console.log('[loading]', msg));`
    AssetsLoad,
    // JS line 39: `splash.stop();`
    SplashStop,
    // JS line 40: `if (assets.data.recipes) initRecipes(assets.data.recipes);`
    InitRecipes,
    // JS line 41: `const game = new Game(assets, settings, device);`
    NewGame,
    // JS line 42: `game.proxies = proxies;`
    GameSetProxies,
    // JS line 43: `game.shaderLibrary = new ShaderLibrary(game.shaderPack);`
    NewShaderLibrary,
    // JS line 44: `try { await game.shaderLibrary.load(); } catch (e) { ... }`
    ShaderLibraryLoad,
    // JS line 45: `globalThis.game = game; // debugging handle`
    PublishGlobalGame,
    // JS line 46: `const params = P.launchParams ? P.launchParams() : {};`
    ReadLaunchParams,
    // JS lines 47-52: the connect-vs-title branch.
    DecideLaunch,
}

pub const BOOT_STEPS: [BootStep; 26] = [
    BootStep::InitWasm,
    BootStep::SetPlatform,
    BootStep::GetPlatform,
    BootStep::LoadConfig,
    BootStep::NewSettings,
    BootStep::NewProxyList,
    BootStep::NewAssets,
    BootStep::CreateGraphicsDevice,
    BootStep::SetPotato,
    BootStep::AssetsSetDevice,
    BootStep::AssetsSetLanguage,
    BootStep::ActivatePacks,
    BootStep::NewSplash,
    BootStep::SplashLoadLogo,
    BootStep::SplashStart,
    BootStep::HideLoading,
    BootStep::AssetsLoad,
    BootStep::SplashStop,
    BootStep::InitRecipes,
    BootStep::NewGame,
    BootStep::GameSetProxies,
    BootStep::NewShaderLibrary,
    BootStep::ShaderLibraryLoad,
    BootStep::PublishGlobalGame,
    BootStep::ReadLaunchParams,
    BootStep::DecideLaunch,
];

// How a step's failure is handled — the try/catch layout of main.js.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepGuard {
    // Before the big `try`: a rejection escapes `boot()` with no catch — an unhandled
    // promise rejection; the crash screen never shows. (InitWasm, SetPlatform.)
    Unhandled,
    // Inside the big `try` but wrapped in its own try/catch (or a `.catch(() => null)`):
    // logged with console.warn and boot continues.
    Warned,
    // Inside the big `try` with no inner catch: the crash-report catch handles it.
    Fatal,
    // JS: `if (assets.data.recipes)` — the step is skipped when the flag is falsy.
    Conditional,
    // Pure state updates the kernel cannot fail (the JS equivalents cannot throw in
    // any way the kernel models).
    Infallible,
}

impl BootStep {
    // The JS source each step models.
    pub fn label(self) -> &'static str {
        match self {
            BootStep::InitWasm => "await initWasm();",
            BootStep::SetPlatform => "setPlatform(new BrowserPlatform());",
            BootStep::GetPlatform => "const P = platform();",
            BootStep::LoadConfig => {
                "let config = {}; try { config = P.loadConfig ? await P.loadConfig() : {}; } catch (e) { console.warn('Config unavailable', e); }"
            }
            BootStep::NewSettings => "const settings = new Settings(config);",
            BootStep::NewProxyList => "const proxies = new ProxyList(settings);",
            BootStep::NewAssets => "const assets = new Assets();",
            BootStep::CreateGraphicsDevice => "const device = await P.createGraphicsDevice(settings.graphicsApi);",
            BootStep::SetPotato => "if (P.setPotato) P.setPotato(!!settings.superPotato || device.name === 'Software');",
            BootStep::AssetsSetDevice => "assets.setDevice(device);",
            BootStep::AssetsSetLanguage => "assets.language = settings.language || 'en_us';",
            BootStep::ActivatePacks => {
                "try { await assets.activatePacks(settings.resourcePacks || []); } catch (e) { console.warn('Resource packs unavailable', e); }"
            }
            BootStep::NewSplash => "const splash = new Splash(device);",
            BootStep::SplashLoadLogo => {
                "await splash.load(await assets.readBytes('textures/gui/title/mojang.png').catch(() => null));"
            }
            BootStep::SplashStart => "splash.start();",
            BootStep::HideLoading => "P.hideLoading();",
            BootStep::AssetsLoad => "await assets.load((msg) => console.log('[loading]', msg));",
            BootStep::SplashStop => "splash.stop();",
            BootStep::InitRecipes => "if (assets.data.recipes) initRecipes(assets.data.recipes);",
            BootStep::NewGame => "const game = new Game(assets, settings, device);",
            BootStep::GameSetProxies => "game.proxies = proxies;",
            BootStep::NewShaderLibrary => "game.shaderLibrary = new ShaderLibrary(game.shaderPack);",
            BootStep::ShaderLibraryLoad => {
                "try { await game.shaderLibrary.load(); } catch (e) { game.shaderPack.error = e.message; console.warn('Shader pack unavailable', e.message); }"
            }
            BootStep::PublishGlobalGame => "globalThis.game = game;",
            BootStep::ReadLaunchParams => "const params = P.launchParams ? P.launchParams() : {};",
            BootStep::DecideLaunch => {
                "if (params.connect) { ... parseAddress branch ... } else { game.screens.open(new TitleScreen(game)); }"
            }
        }
    }

    // Which catch (if any) handles a failure of this step.
    pub fn guard(self) -> StepGuard {
        match self {
            BootStep::InitWasm => StepGuard::Unhandled,
            BootStep::SetPlatform => StepGuard::Unhandled,
            BootStep::GetPlatform => StepGuard::Infallible,
            BootStep::LoadConfig => StepGuard::Warned,
            BootStep::NewSettings => StepGuard::Infallible,
            BootStep::NewProxyList => StepGuard::Infallible,
            BootStep::NewAssets => StepGuard::Infallible,
            BootStep::CreateGraphicsDevice => StepGuard::Fatal,
            BootStep::SetPotato => StepGuard::Infallible,
            BootStep::AssetsSetDevice => StepGuard::Infallible,
            BootStep::AssetsSetLanguage => StepGuard::Infallible,
            BootStep::ActivatePacks => StepGuard::Warned,
            BootStep::NewSplash => StepGuard::Infallible,
            BootStep::SplashLoadLogo => StepGuard::Warned,
            BootStep::SplashStart => StepGuard::Infallible,
            BootStep::HideLoading => StepGuard::Infallible,
            BootStep::AssetsLoad => StepGuard::Fatal,
            BootStep::SplashStop => StepGuard::Infallible,
            BootStep::InitRecipes => StepGuard::Conditional,
            BootStep::NewGame => StepGuard::Infallible,
            BootStep::GameSetProxies => StepGuard::Infallible,
            BootStep::NewShaderLibrary => StepGuard::Infallible,
            BootStep::ShaderLibraryLoad => StepGuard::Warned,
            BootStep::PublishGlobalGame => StepGuard::Infallible,
            BootStep::ReadLaunchParams => StepGuard::Infallible,
            BootStep::DecideLaunch => StepGuard::Infallible,
        }
    }
}

// JS: `globalThis.game = game;` is Browser-bound (stays in JS) — there is no global
// object in the kernel. What the kernel can model is the snapshot the crash report
// would read (`globalThis.game || null`), published onto [`CrashState`].
// JS: `console.log('[loading]', msg)` — recorded on [`BootLog`].

// What a completed boot leaves behind.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BootPublication {
    // JS: the connect-vs-title branch outcome.
    pub decision: LaunchDecision,
    // JS: `if (assets.data.recipes) initRecipes(assets.data.recipes);` — whether the
    // call happened.
    pub recipes_initialized: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BootOutcome {
    // JS: the connect/title branch ran to completion.
    Launched(BootPublication),
    // JS: the big `catch` ran — console.error + P.setLoadingError + showCrashScreen.
    Crashed { error: String, report: String },
    // JS: initWasm/setPlatform rejected before the `try` — the boot() promise rejects
    // with no handler (unhandled promise rejection; no crash screen).
    Aborted { step: BootStep, error: String },
}

// JS: `async function boot() { ... }` — the whole orchestration, in source order.
// `now` stands in for the `new Date()` stamp the crash report would print.
pub fn boot(env: &mut dyn BootEnv, log: &mut BootLog, crash: &mut CrashState, now: &str) -> BootOutcome {
    // JS: `await initWasm();` — load the Rust core before assets (PNG texture
    // decoding uses it when available). Before the `try`: no crash screen.
    if let Err(error) = env.init_wasm() {
        return BootOutcome::Aborted { step: BootStep::InitWasm, error: error.message };
    }
    // JS: `setPlatform(new BrowserPlatform()); const P = platform();`
    // Browser-bound (stays in JS): constructing the browser platform (canvas, input,
    // IndexedDB) and publishing the module-global platform handle. The kernel receives
    // the same surface as `env`.
    // JS: `let config = {}; try { config = P.loadConfig ? await P.loadConfig() : {}; }
    //      catch (e) { console.warn('Config unavailable', e); }`
    let config = crate::main_boot::load_config_stage(env, log);
    // JS: `const settings = new Settings(config);` — settings.js reads the saved
    // settings from platform storage inside the constructor.
    let saved = env
        .load_setting(crate::main_boot::SETTINGS_KEY)
        .or_else(|| env.load_setting(crate::main_boot::LEGACY_SETTINGS_KEY))
        .unwrap_or_default();
    let mut settings = Settings::new(&config, &saved);
    // JS: `const proxies = new ProxyList(settings);`
    let proxies = ProxyList::new(&mut settings);
    // JS: `try {` — the guarded region; the catch is at the end of `boot()`.
    match boot_guarded(env, log, &settings, proxies, crash) {
        Ok(launch) => BootOutcome::Launched(BootPublication {
            decision: launch.decision,
            recipes_initialized: launch.recipes_initialized,
        }),
        Err(error) => {
            // JS: `} catch (e) { console.error(e); P.setLoadingError('Failed to load: ' + e.message);
            //      showCrashScreen(buildCrashReport(e, 'Starting the game', globalThis.game || null)); }`
            let report = handle_boot_failure(env, log, &error, crash, now);
            BootOutcome::Crashed { error: error.message, report }
        }
    }
}

// The guarded region (main.js lines 26-53). Every `?` is a fatal failure that the
// caller's catch turns into a crash report; the inner catches warn and continue.
struct GuardedLaunch {
    decision: LaunchDecision,
    recipes_initialized: bool,
}

fn boot_guarded(
    env: &mut dyn BootEnv,
    log: &mut BootLog,
    settings: &Settings,
    proxies: ProxyList,
    crash: &mut CrashState,
) -> Result<GuardedLaunch, BootFailure> {
    // JS: `const assets = new Assets();`
    let mut assets = Assets::new();
    // JS: `const device = await P.createGraphicsDevice(settings.graphicsApi);` — fatal.
    let device = env.create_graphics_device(&settings.graphics_api)?;
    // JS: `if (P.setPotato) P.setPotato(!!settings.superPotato || device.name === 'Software');`
    crate::main_boot2::apply_potato(env, settings, &device);
    // JS: `assets.setDevice(device); assets.language = settings.language || 'en_us';`
    // JS: `try { await assets.activatePacks(settings.resourcePacks || []); } catch (e) { ... }` — warned.
    crate::main_boot2::prepare_assets_stage(env, &mut assets, settings, &device, log);
    // JS: `const splash = new Splash(device);`
    // JS: `await splash.load(await assets.readBytes('textures/gui/title/mojang.png').catch(() => null));`
    // JS: `splash.start(); P.hideLoading();` — logo failures tolerated.
    let mut splash = crate::main_boot2::start_splash_stage(env, &device);
    // JS: `await assets.load((msg) => console.log('[loading]', msg));` — fatal.
    // JS: `splash.stop();` — skipped when the load failed (the splash keeps rendering).
    crate::main_boot2::finish_splash_stage(env, &mut assets, &mut splash, log)?;
    // JS: `if (assets.data.recipes) initRecipes(assets.data.recipes);` — conditional.
    // The crafting registration itself is ported in `crate::crafting`.
    let recipes_initialized = crate::main_boot2::init_recipes_stage(&assets);
    // JS: `const game = new Game(assets, settings, device);`
    let mut game = crate::main_boot2::create_game_stage(assets, settings.clone(), device.clone());
    // JS: `game.proxies = proxies;`
    game.set_proxies(proxies);
    // JS: `game.shaderLibrary = new ShaderLibrary(game.shaderPack);`
    // JS: `try { await game.shaderLibrary.load(); } catch (e) { ... }` — warned.
    crate::main_boot2::shader_stage(env, &mut game, log);
    // JS: `globalThis.game = game; // debugging handle`
    // Browser-bound (stays in JS): the global itself. The kernel publishes the
    // snapshot the crash report would read. (Every fatal failure above happens
    // before this line, so `globalThis.game || null` is null for boot crashes —
    // the snapshot plumbing exists because buildCrashReport is shared with the
    // game-loop catch.)
    crash.game = Some(CrashGame::from_game(&game));
    // JS: `const params = P.launchParams ? P.launchParams() : {};`
    let params = env.launch_params().unwrap_or_default();
    // JS: `if (params.connect) { const a = parseAddress(params.connect); ... }
    //      else { game.screens.open(new TitleScreen(game)); }`
    let decision = decide_launch(&params);
    crate::main_boot2::apply_launch(&mut game, &decision);
    Ok(GuardedLaunch { decision, recipes_initialized })
}

#[wasm_bindgen]
pub fn boot_step_count() -> u32 {
    BOOT_STEPS.len() as u32
}

#[wasm_bindgen]
pub fn boot_step_label(index: u32) -> Option<String> {
    BOOT_STEPS.get(index as usize).map(|step| step.label().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::main_alg::{BootFailure, ConsoleEntry};
    use crate::main_boot::{BootConfig, GraphicsDevice, LaunchParams, ShaderLibrary};

    // Scripted platform + asset source; records every env call in order.
    struct FakeEnv {
        calls: Vec<String>,
        init_wasm: Result<(), String>,
        load_config: Option<Result<BootConfig, String>>,
        device: Option<Result<String, String>>,
        has_set_potato: bool,
        potato: Vec<bool>,
        saved: Option<String>,
        read_bytes: Result<Option<Vec<u8>>, String>,
        activate_packs: Result<(), String>,
        assets_load: Result<(), String>,
        fill_recipes: bool,
        shader_load: Result<(), String>,
        launch_params: Option<LaunchParams>,
        hidden_loading: usize,
        loading_errors: Vec<String>,
    }

    impl Default for FakeEnv {
        fn default() -> FakeEnv {
            FakeEnv {
                calls: Vec::new(),
                init_wasm: Ok(()),
                load_config: None,
                device: Some(Ok("WebGL2".to_string())),
                has_set_potato: true,
                potato: Vec::new(),
                saved: None,
                read_bytes: Ok(Some(vec![0x89, b'P', b'N', b'G'])),
                activate_packs: Ok(()),
                assets_load: Ok(()),
                fill_recipes: true,
                shader_load: Ok(()),
                launch_params: None,
                hidden_loading: 0,
                loading_errors: Vec::new(),
            }
        }
    }

    impl BootEnv for FakeEnv {
        fn init_wasm(&mut self) -> Result<(), BootFailure> {
            self.calls.push("initWasm".to_string());
            self.init_wasm.clone().map_err(BootFailure::new)
        }

        fn load_config(&mut self) -> Option<Result<BootConfig, BootFailure>> {
            match &self.load_config {
                // JS: `P.loadConfig ?` — absent members are never called.
                None => None,
                Some(result) => {
                    self.calls.push("loadConfig".to_string());
                    Some(result.clone().map_err(BootFailure::new))
                }
            }
        }

        fn create_graphics_device(&mut self, preference: &str) -> Result<GraphicsDevice, BootFailure> {
            self.calls.push(format!("createGraphicsDevice({})", preference));
            match &self.device {
                Some(Ok(name)) => Ok(GraphicsDevice::new(name)),
                Some(Err(message)) => Err(BootFailure::new(message.clone())),
                None => Err(BootFailure::new("no graphics API configured")),
            }
        }

        fn set_potato(&mut self, on: bool) -> Option<()> {
            if !self.has_set_potato {
                return None;
            }
            self.calls.push(format!("setPotato({})", on));
            self.potato.push(on);
            Some(())
        }

        fn hide_loading(&mut self) {
            self.calls.push("hideLoading".to_string());
            self.hidden_loading += 1;
        }

        fn set_loading_error(&mut self, message: &str) {
            self.calls.push(format!("setLoadingError({:?})", message));
            self.loading_errors.push(message.to_string());
        }

        fn launch_params(&mut self) -> Option<LaunchParams> {
            match &self.launch_params {
                None => None,
                Some(_) => {
                    self.calls.push("launchParams".to_string());
                    self.launch_params.clone()
                }
            }
        }

        fn load_setting(&mut self, key: &str) -> Option<String> {
            self.calls.push(format!("loadSetting({})", key));
            self.saved.clone()
        }

        fn read_bytes(&mut self, path: &str) -> Result<Option<Vec<u8>>, BootFailure> {
            self.calls.push(format!("readBytes({})", path));
            self.read_bytes.clone().map_err(BootFailure::new)
        }

        fn activate_packs(&mut self, _assets: &mut Assets, packs: &[String]) -> Result<(), BootFailure> {
            self.calls.push(format!("activatePacks({:?})", packs));
            self.activate_packs.clone().map_err(BootFailure::new)
        }

        fn assets_load(&mut self, assets: &mut Assets, progress: &mut dyn FnMut(&str)) -> Result<(), BootFailure> {
            self.calls.push("assets.load".to_string());
            progress("blocks");
            if self.fill_recipes {
                // JS: `this.data[n] = datas[i]` — assets.load fills data.recipes.
                assets.data.recipes = Some("[]".to_string());
            }
            self.assets_load.clone().map_err(BootFailure::new)
        }

        fn shader_library_load(&mut self, _library: &mut ShaderLibrary) -> Result<(), BootFailure> {
            self.calls.push("shaderLibrary.load".to_string());
            self.shader_load.clone().map_err(BootFailure::new)
        }
    }

    fn run(env: &mut FakeEnv) -> (BootOutcome, BootLog, CrashState) {
        let mut log = BootLog::default();
        let mut crash = CrashState::default();
        let outcome = boot(env, &mut log, &mut crash, "2024-05-06 07:08:09");
        (outcome, log, crash)
    }

    #[test]
    fn steps_match_the_js_source_order() {
        assert_eq!(BOOT_STEPS.len(), 26);
        assert_eq!(BOOT_STEPS[0], BootStep::InitWasm);
        assert_eq!(BOOT_STEPS[3], BootStep::LoadConfig);
        assert_eq!(BOOT_STEPS[6], BootStep::NewAssets);
        assert_eq!(BOOT_STEPS[7], BootStep::CreateGraphicsDevice);
        assert_eq!(BOOT_STEPS[12], BootStep::NewSplash);
        assert_eq!(BOOT_STEPS[16], BootStep::AssetsLoad);
        assert_eq!(BOOT_STEPS[19], BootStep::NewGame);
        assert_eq!(BOOT_STEPS[25], BootStep::DecideLaunch);
        for (index, step) in BOOT_STEPS.iter().enumerate() {
            assert_eq!(step.label().is_empty(), false, "step {} has no label", index);
        }
    }

    #[test]
    fn guards_match_the_js_try_catch_layout() {
        // Hand-checked against main.js: the prelude has no catch except loadConfig's
        // own; three inner catches warn; assets.load and the device creation are fatal.
        assert_eq!(BootStep::InitWasm.guard(), StepGuard::Unhandled);
        assert_eq!(BootStep::SetPlatform.guard(), StepGuard::Unhandled);
        assert_eq!(BootStep::LoadConfig.guard(), StepGuard::Warned);
        assert_eq!(BootStep::NewSettings.guard(), StepGuard::Infallible);
        assert_eq!(BootStep::CreateGraphicsDevice.guard(), StepGuard::Fatal);
        assert_eq!(BootStep::ActivatePacks.guard(), StepGuard::Warned);
        assert_eq!(BootStep::SplashLoadLogo.guard(), StepGuard::Warned);
        assert_eq!(BootStep::AssetsLoad.guard(), StepGuard::Fatal);
        assert_eq!(BootStep::InitRecipes.guard(), StepGuard::Conditional);
        assert_eq!(BootStep::ShaderLibraryLoad.guard(), StepGuard::Warned);
        assert_eq!(BootStep::DecideLaunch.guard(), StepGuard::Infallible);
    }

    #[test]
    fn wasm_step_introspection() {
        assert_eq!(boot_step_count(), 26);
        assert_eq!(boot_step_label(0).as_deref(), Some("await initWasm();"));
        assert_eq!(boot_step_label(25).as_deref().map(|l| l.starts_with("if (params.connect)")), Some(true));
        assert_eq!(boot_step_label(26), None);
    }

    #[test]
    fn happy_path_opens_the_title_screen() {
        let mut env = FakeEnv::default();
        let (outcome, log, _crash) = run(&mut env);
        // Exact env-call order, matching main.js line by line. loadConfig and
        // launchParams are absent, so they are never called; loadSetting runs twice
        // (Gravrust.settings, then the legacy fallback) inside `new Settings`.
        assert_eq!(env.calls, vec![
            "initWasm".to_string(),
            "loadSetting(Gravrust.settings)".to_string(),
            "loadSetting(minekampf.settings)".to_string(),
            "createGraphicsDevice(webgl2)".to_string(),
            "setPotato(false)".to_string(),
            "activatePacks([])".to_string(),
            "readBytes(textures/gui/title/mojang.png)".to_string(),
            "hideLoading".to_string(),
            "assets.load".to_string(),
            "shaderLibrary.load".to_string(),
        ]);
        assert_eq!(env.hidden_loading, 1);
        assert_eq!(
            outcome,
            BootOutcome::Launched(BootPublication {
                decision: LaunchDecision::OpenTitle,
                recipes_initialized: true,
            })
        );
        // JS: `(msg) => console.log('[loading]', msg)`
        assert_eq!(log.entries, vec![ConsoleEntry::Loading("blocks".to_string())]);
    }

    #[test]
    fn config_failures_are_warned_and_boot_continues() {
        // JS: `catch (e) { console.warn('Config unavailable', e); }` → config = {}.
        let mut env = FakeEnv::default();
        env.load_config = Some(Err("404".to_string()));
        let (outcome, log, _crash) = run(&mut env);
        assert_eq!(outcome, BootOutcome::Launched(BootPublication {
            decision: LaunchDecision::OpenTitle,
            recipes_initialized: true,
        }));
        assert!(log.entries.contains(&ConsoleEntry::Warn {
            label: "Config unavailable".to_string(),
            detail: "404".to_string(),
        }));
        // Absent member → no warning at all (JS: `P.loadConfig ? ... : {}`).
        let mut env = FakeEnv::default();
        let (_, log, _crash) = run(&mut env);
        assert!(!log.entries.iter().any(|entry| matches!(entry, ConsoleEntry::Warn { label, .. } if label == "Config unavailable")));
    }

    #[test]
    fn eagler_connect_params_pass_through() {
        let mut env = FakeEnv::default();
        env.launch_params = Some(LaunchParams {
            connect: Some("ws://s.example/play".to_string()),
            user: Some("Steve".to_string()),
        });
        let (outcome, _log, _crash) = run(&mut env);
        assert_eq!(
            outcome,
            BootOutcome::Launched(BootPublication {
                decision: LaunchDecision::ConnectEagler {
                    address: "ws://s.example/play".to_string(),
                    user: Some("Steve".to_string()),
                },
                recipes_initialized: true,
            })
        );
    }

    #[test]
    fn vanilla_connect_params_use_the_parsed_host_and_port() {
        let mut env = FakeEnv::default();
        env.launch_params = Some(LaunchParams {
            connect: Some("mc.example.com:25566".to_string()),
            user: Some("".to_string()), // JS: `params.user || null`
        });
        let (outcome, _log, _crash) = run(&mut env);
        assert_eq!(
            outcome,
            BootOutcome::Launched(BootPublication {
                decision: LaunchDecision::ConnectVanilla {
                    host: "mc.example.com".to_string(),
                    port: 25566,
                    user: None,
                },
                recipes_initialized: true,
            })
        );
        // Unparseable → localhost:25565 (JS: `a ? a.host : 'localhost'`).
        let mut env = FakeEnv::default();
        env.launch_params = Some(LaunchParams { connect: Some("no no".to_string()), user: None });
        let (outcome, _log, _crash) = run(&mut env);
        assert_eq!(outcome, BootOutcome::Launched(BootPublication {
            decision: LaunchDecision::ConnectVanilla {
                host: "localhost".to_string(),
                port: 25565,
                user: None,
            },
            recipes_initialized: true,
        }));
        // Empty connect → falsy → title screen.
        let mut env = FakeEnv::default();
        env.launch_params = Some(LaunchParams { connect: Some(String::new()), user: None });
        let (outcome, _log, _crash) = run(&mut env);
        assert_eq!(outcome, BootOutcome::Launched(BootPublication {
            decision: LaunchDecision::OpenTitle,
            recipes_initialized: true,
        }));
    }

    #[test]
    fn device_failures_crash_with_the_report() {
        let mut env = FakeEnv::default();
        env.device = Some(Err("no graphics API".to_string()));
        let (outcome, log, crash) = run(&mut env);
        match outcome {
            BootOutcome::Crashed { error, report } => {
                assert_eq!(error, "no graphics API");
                assert!(report.contains("Description: Starting the game"));
                assert!(report.contains("Error: no graphics API"));
                // `globalThis.game` was never published — no Affected game section.
                assert!(!report.contains("-- Affected game --"));
            }
            other => panic!("expected Crashed, got {:?}", other),
        }
        // JS: `P.setLoadingError('Failed to load: ' + e.message);`
        assert_eq!(env.loading_errors, vec!["Failed to load: no graphics API".to_string()]);
        // JS: `console.error(e)` then `showCrashScreen`'s `console.error(report)`.
        assert_eq!(log.entries, vec![
            ConsoleEntry::Error("no graphics API".to_string()),
            ConsoleEntry::Error(crash_screen_report_of(&log)),
        ]);
        assert!(crash.screen_shown);
        // The catch ran right after the failed step: setLoadingError is the last env
        // call, and no guarded step after createGraphicsDevice executed.
        assert_eq!(env.calls.last().map(String::as_str), Some("setLoadingError(\"Failed to load: no graphics API\")"));
        assert_eq!(env.calls.iter().filter(|call| call.starts_with("setLoadingError")).count(), 1);
        assert!(!env.calls.iter().any(|call| call.starts_with("setPotato") || call.starts_with("readBytes")));
    }

    // The crash screen logs the report as its last entry; extract it for assertions.
    fn crash_screen_report_of(log: &BootLog) -> String {
        match log.entries.last() {
            Some(ConsoleEntry::Error(report)) => report.clone(),
            other => panic!("expected report entry, got {:?}", other),
        }
    }

    #[test]
    fn assets_load_failures_crash_after_the_splash_started() {
        let mut env = FakeEnv::default();
        env.assets_load = Err("bad blocks.json".to_string());
        let (outcome, _log, crash) = run(&mut env);
        assert!(matches!(outcome, BootOutcome::Crashed { .. }));
        assert!(crash.screen_shown);
        // splash.start() and hideLoading already ran; splash.stop() did not.
        let hide = env.calls.iter().position(|call| call == "hideLoading").unwrap();
        let load = env.calls.iter().position(|call| call == "assets.load").unwrap();
        assert!(hide < load);
        assert!(!env.calls.iter().any(|call| call == "splash.stop"));
    }

    #[test]
    fn init_wasm_failure_is_an_unhandled_rejection_with_no_crash_screen() {
        let mut env = FakeEnv::default();
        env.init_wasm = Err("kernel unavailable".to_string());
        let (outcome, _log, crash) = run(&mut env);
        assert_eq!(
            outcome,
            BootOutcome::Aborted { step: BootStep::InitWasm, error: "kernel unavailable".to_string() }
        );
        assert!(env.loading_errors.is_empty()); // no setLoadingError call
        assert!(!crash.screen_shown); // no crash screen
        assert_eq!(env.calls, vec!["initWasm".to_string()]);
    }

    #[test]
    fn potato_follows_the_setting_and_the_device() {
        // JS: `!!settings.superPotato || device.name === 'Software'`
        let mut env = FakeEnv::default();
        env.saved = Some(r#"{"superPotato":true}"#.to_string());
        let (outcome, _log, _crash) = run(&mut env);
        assert!(matches!(outcome, BootOutcome::Launched(_)));
        assert_eq!(env.potato, vec![true]);

        let mut env = FakeEnv::default();
        env.device = Some(Ok("Software".to_string()));
        let (outcome, _log, _crash) = run(&mut env);
        assert!(matches!(outcome, BootOutcome::Launched(_)));
        assert_eq!(env.potato, vec![true]); // always with the CPU rasteriser

        // JS: `if (P.setPotato)` — an absent member skips the call entirely.
        let mut env = FakeEnv::default();
        env.has_set_potato = false;
        let (outcome, _log, _crash) = run(&mut env);
        assert!(matches!(outcome, BootOutcome::Launched(_)));
        assert!(env.potato.is_empty());
    }

    #[test]
    fn pack_and_shader_failures_are_warned_and_boot_continues() {
        let mut env = FakeEnv::default();
        env.activate_packs = Err("zip broken".to_string());
        let (outcome, log, _crash) = run(&mut env);
        assert!(matches!(outcome, BootOutcome::Launched(_)));
        assert!(log.entries.contains(&ConsoleEntry::Warn {
            label: "Resource packs unavailable".to_string(),
            detail: "zip broken".to_string(),
        }));

        let mut env = FakeEnv::default();
        env.shader_load = Err("bad GLSL".to_string());
        let (outcome, log, _crash) = run(&mut env);
        assert!(matches!(outcome, BootOutcome::Launched(_)));
        assert!(log.entries.contains(&ConsoleEntry::Warn {
            label: "Shader pack unavailable".to_string(),
            detail: "bad GLSL".to_string(),
        }));
    }

    #[test]
    fn logo_read_failures_keep_boot_alive() {
        // JS: `.catch(() => null)` → splash.load(null) → plain white splash.
        let mut env = FakeEnv::default();
        env.read_bytes = Err("404".to_string());
        let (outcome, _log, _crash) = run(&mut env);
        assert!(matches!(outcome, BootOutcome::Launched(_)));
    }

    #[test]
    fn recipes_only_initialize_when_the_data_is_present() {
        let mut env = FakeEnv::default();
        env.fill_recipes = false;
        let (outcome, _log, _crash) = run(&mut env);
        assert_eq!(outcome, BootOutcome::Launched(BootPublication {
            decision: LaunchDecision::OpenTitle,
            recipes_initialized: false,
        }));
    }
}
