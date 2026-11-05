// Port of `client/js/debug/text-capture.js`.
//
// An opt-in, local-only capture. No connection/authentication packets or
// settings.
//
// The JS hooks game methods by monkey-patching (`game[key] = wrapper`) and
// keeps an active-capture singleton keyed by a Symbol. Rust has neither
// runtime patching nor Symbols on arbitrary objects, so the same behaviour
// is expressed as an explicit capture session: the host registers its
// callbacks through [`TextCaptureHooks`], the wrapper logic lives in
// [`CaptureSession::record`], and the "one active capture" rule is the
// session handle returned by [`capture_text`]. The clone/deep-copy of JS
// values (Map/Set/bigint aware) maps to `serde_json::Value`, which is the
// transport shape of every packet here already.

use serde_json::Value;

use crate::gui_js::Gui;

/// JS: `const clone=value=>JSON.parse(JSON.stringify(value,...))` — the Rust
/// packet shape is already JSON, so cloning is a serde round-trip.
fn clone(value: &Value) -> Value {
    serde_json::from_str(&value.to_string()).unwrap_or(Value::Null)
}

/// The game surface the capture reads (JS: `game.hud?.chat`,
/// `game.scoreboard`, `game.assets.lang`, `game.assets.translate`).
pub trait TextCaptureGame {
    /// JS: `game.hud?.chat || []` — the initial chat buffer.
    fn initial_chat(&self) -> Vec<Value>;
    /// JS: `game.scoreboard` — `None` when absent. The returned value mirrors
    /// the JS object: sidebar/defaultSidebar/teamSidebars/objectives/teams/
    /// header/footer plus per-objective rows.
    fn scoreboard(&self) -> Option<Value>;
    /// JS: `game.assets.lang?.[key] ?? null` — the translation lookup.
    fn lang(&self, key: &str) -> Option<String>;
    /// JS: `game.assets.translate('minecraftjs.version')`.
    fn translate_version(&self) -> String;
    /// JS: `chatToLegacy(packet.message)` (the ported chat module).
    fn chat_to_legacy(&self, message: &Value) -> String;
}

/// JS: the wrapper hook sites — `['chat', 'scoreboard_objective',
/// 'scoreboard_score', 'scoreboard_display_objective', 'scoreboard_team',
/// 'playerlist_header', 'player_info', 'title']`.
pub const HOOK_NAMES: [&str; 8] = [
    "chat",
    "scoreboard_objective",
    "scoreboard_score",
    "scoreboard_display_objective",
    "scoreboard_team",
    "playerlist_header",
    "player_info",
    "title",
];

/// JS: `const hooks=[]` — the installed wrappers. The host installs/uninstalls
/// through these.
pub trait TextCaptureHooks {
    /// JS: `const key='on_'+name,original=game[key];if(typeof original!=='function')continue;`
    /// — `None` when the game has no such handler.
    fn original(&self, name: &str) -> Option<()>;
    /// JS: `game[key]=wrapper` / restore-on-stop. The wrapper receives the
    /// raw packet, records it, then calls the original.
    fn install(&mut self, name: &str);
    fn uninstall(&mut self, name: &str);
    /// The platform save (`platform().saveFile(name, bytes, mime)`).
    fn save_file(&mut self, name: &str, bytes: &[u8], mime: &str);
    /// The live gui for `chatToLegacy`-formatted entries when needed.
    fn gui(&mut self) -> Option<&mut Gui>;
}

/// JS: `const translations=Object.create(null)` — keys seen in packets mapped
/// to the current language value (or null).
#[derive(Default)]
pub struct CaptureSession {
    /// JS: `const packets=[]`.
    pub packets: Vec<Value>,
    /// JS: `const translations=Object.create(null)`.
    pub translations: std::collections::HashMap<String, Option<String>>,
    /// JS: `const initial={chat:clone(game.hud?.chat||[]),scoreboard:scoreboard(game)}`.
    pub initial_chat: Vec<Value>,
    pub initial_scoreboard: Option<Value>,
    /// JS: `{limit=100}`.
    pub limit: usize,
    /// JS: `const hooks=[]` — the installed hook names (for stop()).
    pub installed: Vec<&'static str>,
    /// JS: `game[ACTIVE]` — set while the capture is live.
    pub active: bool,
}

impl CaptureSession {
    /// JS: `const collect=value=>{ ... }` — walk a parsed packet, recording
    /// every `translate` key with the current language value.
    pub fn collect(&mut self, game: &dyn TextCaptureGame, value: &Value) {
        // JS: if(typeof value==='string'){try{const parsed=JSON.parse(value);
        //     if(parsed&&typeof parsed==='object')collect(parsed);}catch{}return;}
        if let Some(s) = value.as_str() {
            if let Ok(parsed) = serde_json::from_str::<Value>(s) {
                if parsed.is_object() {
                    self.collect(game, &parsed);
                }
            }
            return;
        }
        // JS: if(!value||typeof value!=='object')return;
        let Some(obj) = value.as_object() else { return };
        // JS: if(typeof value.translate==='string')translations[value.translate]=game.assets.lang?.[value.translate]??null;
        if let Some(t) = obj.get("translate").and_then(|t| t.as_str()) {
            self.translations.entry(t.to_string()).or_insert_with(|| game.lang(t));
        }
        // JS: for(const v of Object.values(value))if(v&&typeof v==='object'||typeof v==='string')collect(v);
        for v in obj.values() {
            if v.is_object() || v.is_string() {
                self.collect(game, v);
            }
        }
    }

    /// JS: the wrapper body — record the raw packet, then the per-type extras.
    /// The host calls this *before* invoking the original handler (the JS
    /// calls `original` in a try and records in the finally).
    pub fn record(&mut self, game: &dyn TextCaptureGame, name: &str, packet: &Value) {
        // JS: const raw=clone(packet);collect(raw);
        let raw = clone(packet);
        self.collect(game, &raw);
        // JS: const entry={type:name,packet:raw};
        let mut entry = serde_json::Map::new();
        entry.insert("type".into(), Value::String(name.to_string()));
        entry.insert("packet".into(), raw);
        // JS: if(name==='chat')entry.formatted=chatToLegacy(packet.message);
        if name == "chat" {
            let message = packet.get("message").cloned().unwrap_or(Value::Null);
            entry.insert("formatted".into(), Value::String(game.chat_to_legacy(&message)));
        }
        // JS: if(name.startsWith('scoreboard_')||name==='playerlist_header')entry.scoreboard=scoreboard(game);
        if name.starts_with("scoreboard_") || name == "playerlist_header" {
            entry.insert("scoreboard".into(), game.scoreboard().unwrap_or(Value::Null));
        }
        // JS: packets.push(entry);if(packets.length>limit)packets.shift();
        self.packets.push(Value::Object(entry));
        if self.packets.len() > self.limit {
            self.packets.remove(0);
        }
    }

    /// JS: `dump:()=>clone({version:game.assets.translate('minecraftjs.version'),initial,packets,translations})`.
    pub fn dump(&self, game: &dyn TextCaptureGame) -> Value {
        serde_json::json!({
            "version": game.translate_version(),
            "initial": {
                "chat": self.initial_chat,
                "scoreboard": self.initial_scoreboard,
            },
            "packets": self.packets,
            "translations": self.translations,
        })
    }

    /// JS: `download()` — encode the dump and hand it to
    /// `platform().saveFile('minecraftjs-text-capture.json', bytes, 'application/json')`.
    pub fn download(&self, game: &dyn TextCaptureGame, hooks: &mut dyn TextCaptureHooks) {
        let dump = self.dump(game);
        let bytes = dump.to_string().into_bytes();
        hooks.save_file("minecraftjs-text-capture.json", &bytes, "application/json");
    }

    /// JS: `stop()` — uninstall every hook and return the final dump.
    pub fn stop(&mut self, game: &dyn TextCaptureGame, hooks: &mut dyn TextCaptureHooks) -> Value {
        // JS: for(const {key,original,wrapper,owned}of hooks)
        //     if(game[key]===wrapper){if(owned)game[key]=original;else delete game[key];}
        for name in &self.installed {
            hooks.uninstall(name);
        }
        self.installed.clear();
        // JS: if(game[ACTIVE]===result)delete game[ACTIVE];
        self.active = false;
        // JS: return this.dump();
        self.dump(game)
    }
}

/// JS: `export function captureText(game,{limit=100}={})`.
///
/// Installs the hooks (the host applies them through [`TextCaptureHooks`]),
/// snapshots the initial chat/scoreboard state and returns the live session.
/// The JS "one active capture" singleton maps to the returned session handle:
/// calling this again while one is live stops the previous one first
/// (`game[ACTIVE]?.stop()`).
pub fn capture_text(
    game: &dyn TextCaptureGame,
    hooks: &mut dyn TextCaptureHooks,
    limit: Option<f64>,
) -> CaptureSession {
    // JS: limit=Math.max(1,Math.min(500,Math.trunc(limit)||100));
    let limit = ((limit.unwrap_or(100.0).trunc() as i64).clamp(1, 500)) as usize;
    let mut session = CaptureSession {
        packets: Vec::new(),
        translations: Default::default(),
        // JS: initial={chat:clone(game.hud?.chat||[]),scoreboard:scoreboard(game)}
        initial_chat: game.initial_chat().iter().map(clone).collect(),
        initial_scoreboard: game.scoreboard(),
        limit,
        installed: Vec::new(),
        active: true,
    };
    // JS: for(const message of initial.chat)collect(message.raw);
    let initial_raws: Vec<Value> = session
        .initial_chat
        .iter()
        .map(|m| m.get("raw").cloned().unwrap_or(Value::Null))
        .collect();
    for raw in &initial_raws {
        session.collect(game, raw);
    }
    // JS: for(const name of [...]) { const key='on_'+name,original=game[key];
    //      if(typeof original!=='function')continue; ... game[key]=wrapper; hooks.push(...); }
    for name in HOOK_NAMES {
        if hooks.original(name).is_none() {
            continue;
        }
        hooks.install(name);
        session.installed.push(name);
    }
    session
}
