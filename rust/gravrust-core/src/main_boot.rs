//! Port of `client/js/main.js`: the boot collaborators — `Settings`
//! (game/settings.js), `ProxyList` (net/proxies.js), `Assets` (assets.js),
//! `Splash` (render/splash.js), `Game` (game/game.js), the platform surface
//! (platform/platform.js + browser.js) — and the connect-vs-title launch
//! decision built on the address parser ported in [`crate::address`].
//!
//! The models carry exactly the fields and call shapes `boot()` touches; the
//! step sequencing itself lives in [`crate::boot_alg`] and [`crate::main_boot2`].

use serde_json::Value;
use wasm_bindgen::prelude::*;

use crate::main_alg::{BootFailure, BootLog};

// JS (settings.js): `graphicsApi: 'webgl2'` — 'webgl2' | 'webgpu' | 'software'
pub const DEFAULT_GRAPHICS_API: &str = "webgl2";
// JS (settings.js/assets.js): `language: 'en_us'` (lowercase since 1.11)
pub const DEFAULT_LANGUAGE: &str = "en_us";
// JS: `game.connect(a ? a.host : 'localhost', a ? a.port : 25565, ...)`
pub const DEFAULT_PORT: u32 = 25565;
// JS (settings.js): `platform().loadSetting('Gravrust.settings')`
pub const SETTINGS_KEY: &str = "Gravrust.settings";
// JS (settings.js): the pre-rename store, still read as a fallback.
pub const LEGACY_SETTINGS_KEY: &str = "minekampf.settings";
// JS (net/proxies.js): `PROXY_TYPES = ['Gravrust', 'relay', 'wisp']`
pub const PROXY_TYPES: [&str; 3] = ["Gravrust", "relay", "wisp"];

// JS: `let config = {};` — the site configuration (config.json) returned by
// `P.loadConfig()`. boot() only passes it to Settings; ProxyList reads
// `config.proxies` for the default proxy list. (config.json `servers` and
// `skinProxy` shape the title-screen server list and skin proxy; they are
// consumed inside Settings' constructor, not by the boot steps themselves.)
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct BootConfig {
    // JS: `config.proxies` — entries for `defaultProxies(config)`.
    pub proxies: Vec<ProxyEntry>,
}

// JS (net/proxies.js): a proxy entry `{ name, url, type, token? }`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProxyEntry {
    pub name: String,
    pub url: String,
    // JS: `type` — one of PROXY_TYPES.
    pub kind: String,
    pub token: Option<String>,
}

impl ProxyEntry {
    // JS: `normalizeProxy(p)` — `url` required; `name` falls back to the url;
    // `type` defaults to 'Gravrust' unless it is one of PROXY_TYPES.
    pub fn from_json(value: &Value) -> Option<ProxyEntry> {
        let url = value.get("url")?.as_str()?.to_string();
        if url.is_empty() {
            return None; // JS: `if (!p || !p.url) return null;` — empty url is falsy
        }
        let name = match value.get("name").and_then(|v| v.as_str()) {
            Some(name) if !name.is_empty() => name.to_string(),
            _ => url.clone(), // JS: `String(p.name || url)`
        };
        let kind = match value.get("type").and_then(|v| v.as_str()) {
            Some(kind) if PROXY_TYPES.contains(&kind) => kind.to_string(),
            _ => "Gravrust".to_string(), // JS: `proxyType(p)`
        };
        let token = value.get("token").and_then(|v| v.as_str()).map(str::to_string);
        Some(ProxyEntry { name, url, kind, token })
    }
}

// JS: `const settings = new Settings(config);` (game/settings.js — the fields
// boot() reads). The DEFAULTS table provides every value; `Object.assign(this,
// defaults, saved)` overlays the settings saved in platform storage. Note that
// config.json contributes only `servers` and `skinProxy` — it cannot override
// these fields directly.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Settings {
    // JS: `this.config = config;`
    pub config: BootConfig,
    // JS: `graphicsApi: 'webgl2'`
    pub graphics_api: String,
    // JS: `superPotato: false`
    pub super_potato: bool,
    // JS: `language: 'en_us'`
    pub language: String,
    // JS: `resourcePacks: []` — active pack ids, highest priority first.
    pub resource_packs: Vec<String>,
    // JS: `proxies: null` — defaulted to `[]` here; ProxyList fills it from config.
    pub proxies: Vec<ProxyEntry>,
    // JS: `proxy: 0` — index of the selected proxy.
    pub proxy: i32,
}

impl Settings {
    // JS: `constructor(config)` — `saved` is the raw JSON string from
    // `platform().loadSetting('Gravrust.settings') || loadSetting('minekampf.settings')`;
    // a missing or unparsable string keeps the defaults (`catch (e) { saved = {}; }`).
    pub fn new(config: &BootConfig, saved: &str) -> Settings {
        let mut settings = Settings {
            config: config.clone(),
            graphics_api: DEFAULT_GRAPHICS_API.to_string(),
            super_potato: false,
            language: DEFAULT_LANGUAGE.to_string(),
            resource_packs: Vec::new(),
            proxies: Vec::new(),
            proxy: 0,
        };
        let Ok(value) = serde_json::from_str::<Value>(saved) else {
            return settings; // JS: `catch (e) { saved = {}; }`
        };
        let Some(object) = value.as_object() else {
            return settings;
        };
        if let Some(api) = object.get("graphicsApi").and_then(|v| v.as_str()) {
            settings.graphics_api = api.to_string();
        }
        if let Some(potato) = object.get("superPotato").and_then(|v| v.as_bool()) {
            settings.super_potato = potato;
        }
        if let Some(language) = object.get("language").and_then(|v| v.as_str()) {
            // JS: `this.language = this.language.toLowerCase()` (codes lowercase since 1.11)
            settings.language = language.to_ascii_lowercase();
        }
        if let Some(packs) = object.get("resourcePacks").and_then(|v| v.as_array()) {
            settings.resource_packs = packs.iter().filter_map(|v| v.as_str().map(str::to_string)).collect();
        }
        if let Some(list) = object.get("proxies").and_then(|v| v.as_array()) {
            let entries: Vec<ProxyEntry> = list.iter().filter_map(ProxyEntry::from_json).collect();
            if !entries.is_empty() {
                settings.proxies = entries; // JS: `Array.isArray(saved.proxies)`
            }
        }
        if let Some(index) = object.get("proxy").and_then(|v| v.as_i64()) {
            settings.proxy = index as i32;
        }
        settings
    }

    // JS: `assets.language = settings.language || 'en_us';` — an empty string is falsy.
    pub fn effective_language(&self) -> String {
        if self.language.is_empty() {
            DEFAULT_LANGUAGE.to_string()
        } else {
            self.language.clone()
        }
    }
}

// JS: `const proxies = new ProxyList(settings);` (net/proxies.js). The list lives in
// `settings.proxies` and the selection in `settings.proxy`; boot only constructs the
// list and hands it to the game (`game.proxies = proxies`).
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProxyList {
    // JS: `get list() { return this.settings.proxies; }`
    pub entries: Vec<ProxyEntry>,
    // JS: `get index() { return this.settings.proxy; }` — -1 when the list is empty.
    pub selected: i32,
}

impl ProxyList {
    // JS: `constructor(settings)`: `if (!Array.isArray(settings.proxies))
    // settings.proxies = defaultProxies(settings.config);` then `clampSelection()`
    // (which writes the clamped index back into `settings.proxy`).
    pub fn new(settings: &mut Settings) -> ProxyList {
        if settings.proxies.is_empty() {
            // JS: `defaultProxies(config)`: `config.proxies` entries, else the page's
            // own server. Browser-bound (stays in JS): the `originSocketUrl()` fallback
            // (a "This website" proxy) — the kernel has no page origin.
            settings.proxies = settings.config.proxies.clone();
        }
        let entries = settings.proxies.clone();
        // JS: `clampSelection()`: `let i = this.settings.proxy | 0; if (i < 0 || i >= n) i = n ? 0 : -1;`
        let count = entries.len() as i32;
        let mut index = settings.proxy;
        if index < 0 || index >= count {
            index = if count > 0 { 0 } else { -1 };
        }
        settings.proxy = index;
        ProxyList { entries, selected: index }
    }

    // JS: `current() { return this.index >= 0 ? this.list[this.index] : null; }`
    pub fn current(&self) -> Option<&ProxyEntry> {
        if self.selected < 0 {
            None
        } else {
            self.entries.get(self.selected as usize)
        }
    }
}

// JS: `const device = await P.createGraphicsDevice(settings.graphicsApi);` — the gfx
// device (gfx/device.js: WebGL2Device / WebGPUDevice / SoftwareDevice). boot() reads
// `device.name`; 'Software' (the CPU rasteriser) forces Super Potato Mode. JS shares
// one instance everywhere; the kernel clones the small handle instead.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GraphicsDevice {
    pub name: String,
}

impl GraphicsDevice {
    pub fn new(name: &str) -> GraphicsDevice {
        GraphicsDevice { name: name.to_string() }
    }

    // JS: `device.name === 'Software'`
    pub fn is_software(&self) -> bool {
        self.name == "Software"
    }
}

// JS: `const params = P.launchParams ? P.launchParams() : {};` — page URL parameters
// (browser.js `launchParams()`, e.g. `?connect=host:port&user=Name`). boot() reads
// `params.connect` and `params.user`; every other key is ignored.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct LaunchParams {
    pub connect: Option<String>,
    pub user: Option<String>,
}

// JS (net/address.js): `parseAddress(text)` returns
// `{ kind: 'tcp', host, port }` | `{ kind: 'eagler', scheme, host, port, path, user, pass, url }`
// | null. The parser itself is ported in [`crate::address`]; this reads the fields
// boot() needs off its JSON form.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedAddress {
    pub kind: AddressKind,
    pub host: String,
    // JS: `a.port` — null for eagler addresses without an explicit port; the tcp
    // parser always fills a numeric port (defaulting to 25565).
    pub port: Option<u32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AddressKind {
    Tcp,
    Eagler,
}

// JS: `const a = parseAddress(params.connect);`
pub fn parse_boot_address(text: &str) -> Option<ParsedAddress> {
    let json = crate::address::parse_address(text)?;
    let kind = if json.contains("\"kind\":\"eagler\"") {
        AddressKind::Eagler
    } else {
        AddressKind::Tcp
    };
    Some(ParsedAddress {
        kind,
        host: json_string_field(&json, "host")?,
        port: json_port_field(&json),
    })
}

// Reads `"key":"…"` out of the JSON `crate::address::parse_address` returns,
// unescaping the escapes its `json_string` helper can produce.
fn json_string_field(json: &str, key: &str) -> Option<String> {
    let needle = format!("\"{}\":\"", key);
    let start = json.find(&needle)? + needle.len();
    let mut out = String::new();
    let mut chars = json[start..].chars();
    while let Some(c) = chars.next() {
        match c {
            '"' => return Some(out),
            '\\' => match chars.next()? {
                '"' => out.push('"'),
                '\\' => out.push('\\'),
                '/' => out.push('/'),
                'n' => out.push('\n'),
                'r' => out.push('\r'),
                't' => out.push('\t'),
                'b' => out.push('\u{0008}'),
                'f' => out.push('\u{000C}'),
                'u' => {
                    let hex: String = (0..4).filter_map(|_| chars.next()).collect();
                    let code = u32::from_str_radix(&hex, 16).ok()?;
                    out.push(char::from_u32(code)?);
                }
                _ => return None,
            },
            c => out.push(c),
        }
    }
    None
}

// Reads `"port":<n|null>` — None for null, missing, or unparsable values.
fn json_port_field(json: &str) -> Option<u32> {
    let needle = "\"port\":";
    let start = json.find(needle)? + needle.len();
    let rest = &json[start..];
    if rest.starts_with("null") {
        return None;
    }
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    digits.parse::<u32>().ok()
}

// JS: `if (params.connect) { const a = parseAddress(params.connect);
// if (a && a.kind === 'eagler') game.connect(params.connect, 0, params.user || null);
// else game.connect(a ? a.host : 'localhost', a ? a.port : 25565, params.user || null);
// } else { game.screens.open(new TitleScreen(game)); }`
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LaunchDecision {
    // JS: an eagler (ws://) address — the original string is passed through, port 0.
    ConnectEagler { address: String, user: Option<String> },
    // JS: a vanilla TCP address — parsed host/port, or 'localhost'/25565 when the
    // parse failed (and 25565 whenever the parse never produced a port).
    ConnectVanilla { host: String, port: u32, user: Option<String> },
    // JS: no `connect` param (an empty one is falsy) — open the title screen.
    OpenTitle,
}

pub fn decide_launch(params: &LaunchParams) -> LaunchDecision {
    // JS: `params.user || null` — an empty string is falsy too.
    let user = params.user.as_deref().filter(|user| !user.is_empty()).map(str::to_string);
    // JS: `if (params.connect)` — an empty string is falsy.
    let Some(connect) = params.connect.as_deref().filter(|connect| !connect.is_empty()) else {
        return LaunchDecision::OpenTitle;
    };
    match parse_boot_address(connect) {
        // JS: `if (a && a.kind === 'eagler') game.connect(params.connect, 0, params.user || null);`
        Some(parsed) if parsed.kind == AddressKind::Eagler => {
            LaunchDecision::ConnectEagler { address: connect.to_string(), user }
        }
        // JS: `game.connect(a ? a.host : 'localhost', a ? a.port : 25565, params.user || null);`
        Some(parsed) => LaunchDecision::ConnectVanilla {
            host: parsed.host,
            port: parsed.port.unwrap_or(DEFAULT_PORT),
            user,
        },
        None => LaunchDecision::ConnectVanilla { host: "localhost".to_string(), port: DEFAULT_PORT, user },
    }
}

// The decision as a plain string, for JS-side smoke tests:
// "title" | "eagler" | "<host>:<port>".
#[wasm_bindgen]
pub fn boot_launch_action(connect: Option<String>, user: Option<String>) -> String {
    let params = LaunchParams { connect, user };
    match decide_launch(&params) {
        LaunchDecision::OpenTitle => "title".to_string(),
        LaunchDecision::ConnectEagler { .. } => "eagler".to_string(),
        LaunchDecision::ConnectVanilla { host, port, .. } => format!("{}:{}", host, port),
    }
}

// JS: `this.data = {}` — filled by `assets.load()`; boot reads `data.recipes`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct AssetData {
    // JS: `this.data.recipes` — the raw recipes data, consumed by `initRecipes`
    // (the crafting manager is ported in [`crate::crafting`]).
    pub recipes: Option<String>,
}

// JS: `const assets = new Assets();` (assets.js — the boot-relevant surface:
// the graphics device, the selected language, and the loaded data blobs).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Assets {
    // JS: `this.device` — set by `assets.setDevice(device)`.
    pub device: Option<GraphicsDevice>,
    // JS: `this.language = 'en_us';` — boot overwrites it from the settings.
    pub language: String,
    // JS: `this.data`
    pub data: AssetData,
}

impl Default for Assets {
    // JS: `constructor()` sets `this.language = 'en_us'`.
    fn default() -> Assets {
        Assets { device: None, language: DEFAULT_LANGUAGE.to_string(), data: AssetData::default() }
    }
}

impl Assets {
    pub fn new() -> Assets {
        Assets::default()
    }

    // JS: `setDevice(device) { this.device = device; }`
    pub fn set_device(&mut self, device: GraphicsDevice) {
        self.device = Some(device);
    }

    // JS: `if (assets.data.recipes)` — truthiness of the loaded recipes data.
    pub fn has_recipes(&self) -> bool {
        self.data.recipes.is_some()
    }
}

// JS: `const splash = new Splash(device);` (render/splash.js) — the vanilla startup
// splash (Mojang logo on white). boot() drives load/start/stop around `assets.load`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Splash {
    // JS: `this.device = device` — kept for texture creation.
    pub device: GraphicsDevice,
    // JS: `this.tex` — whether the logo texture exists (null draws plain white).
    pub texture: bool,
    // JS: `this.running`
    pub running: bool,
}

impl Splash {
    pub fn new(device: &GraphicsDevice) -> Splash {
        Splash { device: device.clone(), texture: false, running: false }
    }

    // JS: `async load(bytes)`: `if (!bytes) return;` then decode — a missing logo or a
    // bad PNG draws plain white and never rejects.
    pub fn load(&mut self, bytes: Option<&[u8]>) {
        if let Some(bytes) = bytes {
            if !bytes.is_empty() {
                self.texture = true;
            }
        }
    }

    // JS: `start() { this.running = true; ... }` — the draw loop itself is
    // Browser-bound (stays in JS): it schedules frames on requestAnimationFrame.
    pub fn start(&mut self) {
        self.running = true;
    }

    // JS: `stop() { this.running = false; ... }` + texture/mesh teardown.
    pub fn stop(&mut self) {
        self.running = false;
        self.texture = false;
    }
}

// JS: `this.shaderPack = new ShaderPackFinal(this)` (game.js constructor). Boot only
// assigns `shaderPack.error` when the library load fails.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ShaderPack {
    // JS: `game.shaderPack.error = e.message;`
    pub error: Option<String>,
}

// JS: `new ShaderLibrary(game.shaderPack)` (render/shader-library.js). The entries and
// selection state live in platform storage; boot only constructs the library and
// awaits `load()`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ShaderLibrary {
    // Set once the `load()` await resolved.
    pub loaded: bool,
}

impl ShaderLibrary {
    // JS: `constructor(pack)` — the pack back-reference stays in JS.
    pub fn new() -> ShaderLibrary {
        ShaderLibrary::default()
    }
}

// JS: the screen stack (`game.screens.open(...)`); boot opens exactly one of these.
// Names mirror the JS constructor names the crash report prints.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Screen {
    // JS: `new TitleScreen(game)` (gui/screens/menus.js)
    TitleScreen,
    // JS: `new ConnectingScreen(this, host, port)` (game.js `connect()`)
    ConnectingScreen,
}

impl Screen {
    // JS: `game.screens.current.constructor.name`
    pub fn report_name(self) -> &'static str {
        match self {
            Screen::TitleScreen => "TitleScreen",
            Screen::ConnectingScreen => "ConnectingScreen",
        }
    }
}

// JS: `this.serverAddress = { host, port };` (game.js `connect()`)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ServerAddress {
    pub host: String,
    pub port: u32,
}

// JS: `const game = new Game(assets, settings, device);` (game/game.js — the fields
// boot() and the crash report touch).
#[derive(Debug)]
pub struct Game {
    pub assets: Assets,
    pub settings: Settings,
    pub device: GraphicsDevice,
    // JS: `game.proxies = proxies;` — assigned right after construction.
    pub proxies: Option<ProxyList>,
    // JS: `this.shaderPack = new ShaderPackFinal(this)`
    pub shader_pack: ShaderPack,
    // JS: `game.shaderLibrary = new ShaderLibrary(game.shaderPack);`
    pub shader_library: Option<ShaderLibrary>,
    // JS: `game.screens.current`
    pub current_screen: Option<Screen>,
    // JS: `this.serverAddress` — set by `connect()`.
    pub server_address: Option<ServerAddress>,
    // JS: `connect(host, port, username)` forwards the username to the connection;
    // the kernel records it for the boot decision tests.
    pub connect_username: Option<String>,
    // JS: `this.inWorld` — false during boot.
    pub in_world: bool,
    // JS: `this.gameMode` — survival (0) until a world joins.
    pub game_mode: u8,
    // JS: `this.fps` — unset until the frame loop ticks.
    pub fps: Option<u32>,
}

impl Game {
    // JS: `constructor(assets, settings, device)` — boot-level fields start empty
    // (no world, no player, no screen yet).
    pub fn new(assets: Assets, settings: Settings, device: GraphicsDevice) -> Game {
        Game {
            assets,
            settings,
            device,
            proxies: None,
            shader_pack: ShaderPack::default(),
            shader_library: None,
            current_screen: None,
            server_address: None,
            connect_username: None,
            in_world: false,
            game_mode: 0,
            fps: None,
        }
    }

    // JS: `game.proxies = proxies;`
    pub fn set_proxies(&mut self, proxies: ProxyList) {
        self.proxies = Some(proxies);
    }

    // JS: `game.shaderLibrary = new ShaderLibrary(game.shaderPack);`
    pub fn set_shader_library(&mut self) {
        self.shader_library = Some(ShaderLibrary::new());
    }

    // JS: `game.shaderPack.error = e.message;`
    pub fn set_shader_pack_error(&mut self, message: &str) {
        self.shader_pack.error = Some(message.to_string());
    }

    // JS: `game.screens.open(new TitleScreen(game));`
    pub fn open_title_screen(&mut self) {
        self.current_screen = Some(Screen::TitleScreen);
    }

    // JS: `async connect(host, port, username = null)`: records
    // `this.serverAddress = { host, port }` and opens the ConnectingScreen. The dial
    // itself is Browser-bound (stays in JS) and ported with the protocol layers.
    pub fn connect(&mut self, host: &str, port: u32, username: Option<&str>) {
        self.server_address = Some(ServerAddress { host: host.to_string(), port });
        self.connect_username = username.map(str::to_string);
        self.current_screen = Some(Screen::ConnectingScreen);
    }
}

// The browser-bound surface `boot()` reaches. JS `await`s map to `Result`: a rejected
// promise is `Err(BootFailure)`. Optional platform members (platform.js marks
// `loadConfig`, `setPotato` and `launchParams` as optional) return `Option`:
// `None` models the member being absent from the platform implementation.
pub trait BootEnv {
    // JS: `await initWasm();` — client/js/wasm/core.js loads and instantiates the kernel.
    fn init_wasm(&mut self) -> Result<(), BootFailure>;

    // JS: `const device = await P.createGraphicsDevice(settings.graphicsApi);`
    fn create_graphics_device(&mut self, preference: &str) -> Result<GraphicsDevice, BootFailure>;

    // JS: `if (P.setPotato) P.setPotato(on);` — `None`: the member is absent.
    fn set_potato(&mut self, _on: bool) -> Option<()> {
        None
    }

    // JS: `P.hideLoading();`
    fn hide_loading(&mut self);

    // JS: `P.setLoadingError('Failed to load: ' + e.message);`
    fn set_loading_error(&mut self, message: &str);

    // JS: `const params = P.launchParams ? P.launchParams() : {};` — `None`: absent → `{}`.
    fn launch_params(&mut self) -> Option<LaunchParams> {
        None
    }

    // JS (settings.js): `platform().loadSetting('Gravrust.settings')` — `None` models
    // storage being unavailable (browser.js catches and returns null).
    fn load_setting(&mut self, _key: &str) -> Option<String> {
        None
    }

    // JS: `P.loadConfig ? await P.loadConfig() : {}` — `None`: the member is absent.
    fn load_config(&mut self) -> Option<Result<BootConfig, BootFailure>> {
        None
    }

    // JS: `await assets.readBytes(path)` — the asset source (fetch / IndexedDB /
    // the embedded single-file zip).
    fn read_bytes(&mut self, path: &str) -> Result<Option<Vec<u8>>, BootFailure>;

    // JS: `await assets.activatePacks(ids)` — pack activation runs in the browser.
    fn activate_packs(&mut self, assets: &mut Assets, packs: &[String]) -> Result<(), BootFailure>;

    // JS: `await assets.load(progress)` — fills `assets.data` (including `recipes`).
    fn assets_load(&mut self, assets: &mut Assets, progress: &mut dyn FnMut(&str)) -> Result<(), BootFailure>;

    // JS: `await game.shaderLibrary.load()` — restores the saved shader pack from storage.
    fn shader_library_load(&mut self, library: &mut ShaderLibrary) -> Result<(), BootFailure>;
}

// JS: `let config = {}; try { config = P.loadConfig ? await P.loadConfig() : {}; }
// catch (e) { console.warn('Config unavailable', e); }`
pub fn load_config_stage(env: &mut dyn BootEnv, log: &mut BootLog) -> BootConfig {
    match env.load_config() {
        // JS: `P.loadConfig` absent → `config = {}` — no warning.
        None => BootConfig::default(),
        Some(Ok(config)) => config,
        Some(Err(error)) => {
            log.warn("Config unavailable", &error.message);
            BootConfig::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_start_from_the_defaults_table() {
        let settings = Settings::new(&BootConfig::default(), "{}");
        assert_eq!(settings.graphics_api, "webgl2");
        assert!(!settings.super_potato);
        assert_eq!(settings.language, "en_us");
        assert!(settings.resource_packs.is_empty());
        assert!(settings.proxies.is_empty());
        assert_eq!(settings.proxy, 0);
    }

    #[test]
    fn config_json_cannot_override_the_boot_fields() {
        // settings.js: `Object.assign(this, defaults, saved)` — config.json only
        // contributes servers and skinProxy, never graphicsApi/superPotato/language.
        let config = BootConfig { proxies: Vec::new() };
        let settings = Settings::new(&config, "{}");
        assert_eq!(settings.graphics_api, "webgl2");
        assert!(!settings.super_potato);
    }

    #[test]
    fn saved_settings_overlay_the_defaults() {
        let saved = r#"{"graphicsApi":"software","superPotato":true,"language":"en_US","resourcePacks":["vanilla","faithful"],"proxy":2}"#;
        let settings = Settings::new(&BootConfig::default(), saved);
        assert_eq!(settings.graphics_api, "software");
        assert!(settings.super_potato);
        // JS: `this.language = this.language.toLowerCase()`
        assert_eq!(settings.language, "en_us");
        assert_eq!(settings.resource_packs, vec!["vanilla".to_string(), "faithful".to_string()]);
        assert_eq!(settings.proxy, 2);
    }

    #[test]
    fn unparsable_saved_settings_keep_the_defaults() {
        // JS: `try { saved = JSON.parse(...) } catch (e) { saved = {}; }`
        let settings = Settings::new(&BootConfig::default(), "{not json");
        assert_eq!(settings.graphics_api, "webgl2");
        assert_eq!(settings.language, "en_us");
    }

    #[test]
    fn empty_language_falls_back_to_en_us() {
        // JS: `assets.language = settings.language || 'en_us';`
        let mut settings = Settings::new(&BootConfig::default(), "{}");
        settings.language = String::new();
        assert_eq!(settings.effective_language(), "en_us");
        settings.language = "de_de".to_string();
        assert_eq!(settings.effective_language(), "de_de");
    }

    fn entry(name: &str, url: &str, kind: &str) -> ProxyEntry {
        ProxyEntry {
            name: name.to_string(),
            url: url.to_string(),
            kind: kind.to_string(),
            token: None,
        }
    }

    #[test]
    fn proxy_entries_normalize_like_proxies_js() {
        let parsed = serde_json::json!({ "url": "ws://p.example" });
        let entry = ProxyEntry::from_json(&parsed).unwrap();
        assert_eq!(entry.name, "ws://p.example"); // JS: `String(p.name || url)`
        assert_eq!(entry.kind, "Gravrust"); // JS: `proxyType(p)`
        assert_eq!(ProxyEntry::from_json(&serde_json::json!({ "name": "x" })), None);
        let relay = serde_json::json!({ "name": "r", "url": "wss://r.example", "type": "relay", "token": "t" });
        let entry = ProxyEntry::from_json(&relay).unwrap();
        assert_eq!(entry.kind, "relay");
        assert_eq!(entry.token.as_deref(), Some("t"));
    }

    #[test]
    fn proxy_list_defaults_from_config_and_clamps_the_selection() {
        let config = BootConfig { proxies: vec![entry("a", "ws://a", "Gravrust"), entry("b", "ws://b", "relay")] };
        let mut settings = Settings::new(&config, "{}");
        // JS: `clampSelection()` — 2 is out of bounds for n=2, so it clamps to 0.
        settings.proxy = 2;
        let proxies = ProxyList::new(&mut settings);
        assert_eq!(proxies.entries.len(), 2);
        assert_eq!(proxies.selected, 0);
        assert_eq!(settings.proxy, 0); // written back like JS
        assert_eq!(proxies.current().map(|e| e.name.as_str()), Some("a"));

        settings.proxy = -3;
        let proxies = ProxyList::new(&mut settings);
        assert_eq!(proxies.selected, 0);

        settings.proxy = 1;
        let proxies = ProxyList::new(&mut settings);
        assert_eq!(proxies.selected, 1);
        assert_eq!(proxies.current().map(|e| e.kind.as_str()), Some("relay"));
    }

    #[test]
    fn proxy_list_without_entries_selects_none() {
        // JS: `i = n ? 0 : -1` — an empty list deselects.
        let mut settings = Settings::new(&BootConfig::default(), "{}");
        let proxies = ProxyList::new(&mut settings);
        assert_eq!(proxies.selected, -1);
        assert_eq!(proxies.current(), None);
    }

    #[test]
    fn parses_boot_addresses_like_the_js_parser() {
        let tcp = parse_boot_address("mc.example.com").unwrap();
        assert_eq!(tcp.kind, AddressKind::Tcp);
        assert_eq!(tcp.host, "mc.example.com");
        assert_eq!(tcp.port, Some(25565)); // the parser fills the vanilla default
        let tcp = parse_boot_address("mc.example.com:25566").unwrap();
        assert_eq!(tcp.port, Some(25566));
        let v6 = parse_boot_address("[::1]:25565").unwrap();
        assert_eq!(v6.host, "::1");
        let eagler = parse_boot_address("ender:x@ws:///s.example:8080/play").unwrap();
        assert_eq!(eagler.kind, AddressKind::Eagler);
        assert_eq!(eagler.host, "s.example");
        assert_eq!(eagler.port, Some(8080));
        // Eaglercraft without an explicit port: `a.port` is null.
        let eagler = parse_boot_address("wss://s.example/play").unwrap();
        assert_eq!(eagler.kind, AddressKind::Eagler);
        assert_eq!(eagler.port, None);
        assert_eq!(parse_boot_address("bad host"), None);
    }

    #[test]
    fn parses_escaped_hosts() {
        // The tcp parser only rejects whitespace, so a quoted host survives as JSON
        // `"a\"b"` and must be unescaped back to `a"b`.
        let parsed = parse_boot_address("a\"b:8080").unwrap();
        assert_eq!(parsed.host, "a\"b");
        assert_eq!(parsed.port, Some(8080));
    }

    #[test]
    fn decides_title_without_a_connect_param() {
        assert_eq!(decide_launch(&LaunchParams::default()), LaunchDecision::OpenTitle);
        // JS: `if (params.connect)` — an empty string is falsy.
        let empty = LaunchParams { connect: Some(String::new()), user: None };
        assert_eq!(decide_launch(&empty), LaunchDecision::OpenTitle);
    }

    #[test]
    fn eagler_addresses_pass_through_with_port_zero_semantics() {
        let params = LaunchParams {
            connect: Some("ws://s.example/play".to_string()),
            user: Some("Steve".to_string()),
        };
        assert_eq!(
            decide_launch(&params),
            LaunchDecision::ConnectEagler { address: "ws://s.example/play".to_string(), user: Some("Steve".to_string()) }
        );
    }

    #[test]
    fn vanilla_addresses_use_the_parsed_host_and_port() {
        let params = LaunchParams { connect: Some("mc.example.com:25566".to_string()), user: None };
        assert_eq!(
            decide_launch(&params),
            LaunchDecision::ConnectVanilla {
                host: "mc.example.com".to_string(),
                port: 25566,
                user: None,
            }
        );
    }

    #[test]
    fn unparseable_addresses_fall_back_to_localhost() {
        // JS: `game.connect(a ? a.host : 'localhost', a ? a.port : 25565, ...)`
        let params = LaunchParams { connect: Some("not a host".to_string()), user: Some("".to_string()) };
        assert_eq!(
            decide_launch(&params),
            LaunchDecision::ConnectVanilla {
                host: "localhost".to_string(),
                port: 25565,
                user: None, // JS: `params.user || null` — empty string is falsy
            }
        );
    }

    #[test]
    fn launch_actions_are_smoke_test_strings() {
        assert_eq!(boot_launch_action(None, None), "title");
        assert_eq!(boot_launch_action(Some(String::new()), None), "title");
        assert_eq!(boot_launch_action(Some("ws://s/play".to_string()), Some("A".to_string())), "eagler");
        assert_eq!(boot_launch_action(Some("mc.example.com:25566".to_string()), None), "mc.example.com:25566");
        // JS: `game.connect(a ? a.host : 'localhost', ...)` — whitespace makes the
        // parse fail; a bare word like "bogus" would parse as the host "bogus".
        assert_eq!(boot_launch_action(Some("no no".to_string()), None), "localhost:25565");
    }

    #[test]
    fn assets_start_with_the_default_language() {
        // JS: `this.language = 'en_us';` (assets.js constructor)
        let assets = Assets::new();
        assert_eq!(assets.language, "en_us");
        assert_eq!(assets.device, None);
        assert!(!assets.has_recipes());
    }

    #[test]
    fn splash_lifecycle_tracks_the_js_flags() {
        let device = GraphicsDevice::new("WebGL2");
        let mut splash = Splash::new(&device);
        assert_eq!(splash.device, device);
        assert!(!splash.texture);
        assert!(!splash.running);
        // JS: `if (!bytes) return;` — a missing logo keeps plain white.
        splash.load(None);
        splash.load(Some(&[]));
        assert!(!splash.texture);
        splash.load(Some(&[0x89, b'P', b'N', b'G']));
        assert!(splash.texture);
        splash.start();
        assert!(splash.running);
        splash.stop();
        assert!(!splash.running);
        assert!(!splash.texture); // JS: stop() destroys the texture
    }

    #[test]
    fn game_records_connect_and_title_like_the_js_methods() {
        let game = Game::new(Assets::new(), Settings::new(&BootConfig::default(), "{}"), GraphicsDevice::new("WebGL2"));
        assert_eq!(game.current_screen, None);
        assert!(!game.in_world);
        assert_eq!(game.fps, None);
        let mut game = game;
        game.connect("mc.example.com", 25565, Some("Steve"));
        assert_eq!(game.server_address.as_ref().map(|a| a.host.as_str()), Some("mc.example.com"));
        assert_eq!(game.server_address.as_ref().map(|a| a.port), Some(25565));
        assert_eq!(game.connect_username.as_deref(), Some("Steve"));
        assert_eq!(game.current_screen, Some(Screen::ConnectingScreen));
        assert_eq!(game.current_screen.map(Screen::report_name), Some("ConnectingScreen"));

        let mut game = Game::new(Assets::new(), Settings::new(&BootConfig::default(), "{}"), GraphicsDevice::new("WebGL2"));
        game.open_title_screen();
        assert_eq!(game.current_screen, Some(Screen::TitleScreen));
        assert_eq!(game.current_screen.map(Screen::report_name), Some("TitleScreen"));
    }
}
