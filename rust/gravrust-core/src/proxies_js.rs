// Port of `client/js/net/proxies.js`.
//
// Proxies: what connects the browser to vanilla (TCP) servers.
//
// The JavaScript keeps module-level state (`selected`, `allProxies`,
// `routingSettings`); here that state lives in a process-wide registry guarded
// by a mutex, updated by [`ProxyList`] exactly where the JS reassigns the
// globals. Browser calls (`platform().originSocketUrl`, `platform().now`,
// `platform().fetchJson`) go through the [`ProxyPlatform`] contract.

use std::sync::Mutex;

use serde_json::Value;

/// JS: `export const PROXY_TYPES = ['mcjs', 'relay', 'wisp', 'gravrust-via'];`
pub const PROXY_TYPES: [&str; 4] = ["mcjs", "relay", "wisp", "gravrust-via"];

/// JS: `platform()` surface used by this module.
pub trait ProxyPlatform: Send + Sync {
    /// JS: `platform().originSocketUrl ? platform().originSocketUrl() : null`.
    fn origin_socket_url(&self) -> Option<String>;
    /// JS: `platform().now()` — milliseconds.
    fn now(&self) -> f64;
    /// JS: `platform().fetchJson(url)`.
    fn fetch_json(&self, url: &str) -> Result<Value, String>;
}

/// JS: a proxy entry `{ name, url, type, token? }`.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct Proxy {
    pub name: String,
    pub url: String,
    /// JS: `type` — one of [`PROXY_TYPES`].
    pub type_: String,
    pub token: Option<String>,
}

impl Proxy {
    fn to_json(&self) -> Value {
        let mut m = serde_json::Map::new();
        m.insert("name".into(), Value::String(self.name.clone()));
        m.insert("url".into(), Value::String(self.url.clone()));
        m.insert("type".into(), Value::String(self.type_.clone()));
        if let Some(t) = &self.token {
            m.insert("token".into(), Value::String(t.clone()));
        }
        Value::Object(m)
    }

    fn from_json(v: &Value) -> Option<Proxy> {
        let url = v.get("url")?.as_str()?.to_string();
        Some(Proxy {
            name: v.get("name").and_then(|n| n.as_str()).unwrap_or(&url).to_string(),
            url,
            type_: v.get("type").and_then(|t| t.as_str()).unwrap_or_default().to_string(),
            token: v.get("token").and_then(|t| t.as_str()).map(|s| s.to_string()),
        })
    }
}

/// The settings object fields this module reads and writes (the JS mutates
/// `settings.proxies` / `settings.proxy` in place).
#[derive(Debug, Clone, Default)]
pub struct ProxySettings {
    pub proxies: Vec<Proxy>,
    pub proxy: i32,
    /// JS: `settings.config` — the raw config for `defaultProxies`.
    pub config: Option<Value>,
    /// JS: `settings.save()` — host persistence hook.
    pub save: Option<Box<dyn FnMut() + Send>>,
}

impl ProxySettings {
    fn save(&mut self) {
        if let Some(save) = &mut self.save {
            save();
        }
    }
}

/// JS: `export const proxyType = (p) => (p && PROXY_TYPES.includes(p.type) ? p.type : 'mcjs');`
pub fn proxy_type(p: Option<&Proxy>) -> String {
    match p {
        Some(p) if PROXY_TYPES.contains(&p.type_.as_str()) => p.type_.clone(),
        _ => "mcjs".to_string(),
    }
}

/// The module-level registry: `(selected, allProxies)`.
static REGISTRY: Mutex<(Option<Proxy>, Vec<Proxy>)> = Mutex::new((None, Vec::new()));

fn set_registry(selected: Option<Proxy>, all: Vec<Proxy>) {
    if let Ok(mut guard) = REGISTRY.lock() {
        *guard = (selected, all);
    }
}

/// JS: `export function normalizeProxy(p)`.
///
/// Returns `None` where the JS returns `null` (no entry, or no url, or the
/// origin socket URL is unavailable).
pub fn normalize_proxy(p: Option<&Value>, platform: &dyn ProxyPlatform) -> Option<Proxy> {
    let p = p?;
    let mut url = p.get("url")?.as_str()?.to_string();
    // JS: if (url === 'origin') { url = platform().originSocketUrl ? ... : null; if (!url) return null; }
    if url == "origin" {
        url = platform.origin_socket_url()?;
    }
    let mut out = Proxy {
        name: p.get("name").and_then(|n| n.as_str()).unwrap_or(&url).to_string(),
        url: url.clone(),
        type_: String::new(),
        token: None,
    };
    out.type_ = proxy_type(Some(&out));
    if let Some(token) = p.get("token").and_then(|t| t.as_str()) {
        out.token = Some(token.to_string());
    }
    Some(out)
}

/// JS: `export function defaultProxies(config)`.
pub fn default_proxies(config: Option<&Value>, platform: &dyn ProxyPlatform) -> Vec<Proxy> {
    // JS: if (config && Array.isArray(config.proxies)) return config.proxies.map(normalizeProxy).filter(Boolean);
    if let Some(list) = config.and_then(|c| c.get("proxies")).and_then(|p| p.as_array()) {
        return list.iter().filter_map(|p| normalize_proxy(Some(p), platform)).collect();
    }
    // JS: const origin = platform().originSocketUrl ? ... : null;
    //     return origin ? [{ name: 'This website', url: origin, type: 'mcjs' }] : [];
    match platform.origin_socket_url() {
        Some(origin) => vec![Proxy { name: "This website".into(), url: origin, type_: "mcjs".into(), token: None }],
        None => Vec::new(),
    }
}

/// JS: `export class ProxyList`.
pub struct ProxyList<'a> {
    /// JS: `this.settings = settings`.
    pub settings: &'a mut ProxySettings,
}

impl<'a> ProxyList<'a> {
    /// JS: `constructor(settings)`.
    pub fn new(settings: &'a mut ProxySettings, platform: &dyn ProxyPlatform) -> Self {
        // JS: routingSettings = settings;
        // JS: if (!Array.isArray(settings.proxies)) settings.proxies = defaultProxies(settings.config);
        if settings.proxies.is_empty() {
            settings.proxies = default_proxies(settings.config.as_ref(), platform);
        }
        let mut list = ProxyList { settings };
        list.clamp_selection();
        list
    }

    /// JS: `get list()`.
    pub fn list(&self) -> &[Proxy] {
        &self.settings.proxies
    }

    /// JS: `get index()`.
    pub fn index(&self) -> i32 {
        self.settings.proxy
    }

    /// JS: `clampSelection()`.
    pub fn clamp_selection(&mut self) {
        let n = self.settings.proxies.len() as i32;
        let mut i = self.settings.proxy;
        if i < 0 || i >= n {
            i = if n > 0 { 0 } else { -1 };
        }
        self.settings.proxy = i;
        for p in &mut self.settings.proxies {
            p.type_ = proxy_type(Some(p));
        }
        // JS: selected = i >= 0 ? this.list[i] : null; allProxies = this.list;
        let selected = if i >= 0 { self.settings.proxies.get(i as usize).cloned() } else { None };
        set_registry(selected, self.settings.proxies.clone());
    }

    /// JS: `select(i) { this.settings.proxy = i; this.clampSelection(); this.settings.save(); }`.
    pub fn select(&mut self, i: i32) {
        self.settings.proxy = i;
        self.clamp_selection();
        self.settings.save();
    }

    /// JS: `current() { return this.index >= 0 ? this.list[this.index] : null; }`.
    pub fn current(&self) -> Option<Proxy> {
        if self.index() >= 0 {
            self.settings.proxies.get(self.index() as usize).cloned()
        } else {
            None
        }
    }

    /// JS: `save() { this.clampSelection(); this.settings.save(); }`.
    pub fn save(&mut self) {
        self.clamp_selection();
        self.settings.save();
    }
}

/// JS: `export function currentProxy() { return selected; }`.
pub fn current_proxy() -> Option<Proxy> {
    REGISTRY.lock().ok().and_then(|g| g.0.clone())
}

/// JS: `export function currentProxyUrl() { return selected ? selected.url : null; }`.
pub fn current_proxy_url() -> Option<String> {
    current_proxy().map(|p| p.url)
}

/// JS: `export function proxyRoute(path)`.
///
/// The HTTP base of the selected (or first available) `mcjs` proxy plus the
/// path; `None` where the JS returns `null`.
pub fn proxy_route(path: &str) -> Option<String> {
    let guard = REGISTRY.lock().ok()?;
    let (selected, all) = (&guard.0, &guard.1);
    // JS: const p = selected && proxyType(selected) === 'mcjs' ? selected : allProxies.find((x) => proxyType(x) === 'mcjs');
    let p = match selected {
        Some(s) if proxy_type(Some(s)) == "mcjs" => Some(s),
        _ => all.iter().find(|x| proxy_type(Some(x)) == "mcjs"),
    };
    // JS: const base = p ? proxyHttpBase(p.url) : null; return base ? base + path : null;
    let base = p.and_then(|p| crate::address::proxy_http_base(&p.url))?;
    Some(format!("{}{}", base, path))
}

/// JS: the `testProxy` result shapes (`{ ping, info }` or `{ error }`).
#[derive(Debug, Clone, PartialEq)]
pub enum ProxyTestResult {
    Ok { ping: i64, info: Value },
    Err(String),
}

/// JS: `export async function testProxy(p, timeout = 6000)`.
///
/// The upstream file dispatches relay/wisp tests to `testRelay`/`testWisp`,
/// which its truncated source does not define; only the `gravrust-via` arm
/// (`testVia`) has a body to port.
pub fn test_proxy(p: &Proxy, timeout_ms: u64, platform: &dyn ProxyPlatform) -> ProxyTestResult {
    let type_ = proxy_type(Some(p));
    match type_.as_str() {
        // JS: if (type === 'relay') return testRelay(p, timeout);
        // JS: if (type === 'wisp') return testWisp(p, timeout);
        "relay" | "wisp" => ProxyTestResult::Err(format!("test{} not present in the truncated JS source", type_)),
        // JS: if (type === 'gravrust-via') return testVia(p, timeout);
        "gravrust-via" => test_via(p, timeout_ms, platform),
        // JS: // ... mcjs test
        _ => ProxyTestResult::Err("mcjs test not present in the truncated JS source".into()),
    }
}

/// JS: `async function testVia(p, timeout)`.
fn test_via(p: &Proxy, timeout_ms: u64, platform: &dyn ProxyPlatform) -> ProxyTestResult {
    // JS: const wsUrl = new URL(p.url); const healthUrl = `http://${wsUrl.host}/health`;
    let Some((_, authority)) = split_url_authority(&p.url) else {
        return ProxyTestResult::Err("Unreachable".into());
    };
    let health_url = format!("http://{}/health", authority);
    // JS: const t0 = platform().now();
    let t0 = platform.now();
    // JS: withTimeout(platform().fetchJson(healthUrl), timeout)
    let started = std::time::Instant::now();
    let r = platform.fetch_json(&health_url);
    // The withTimeout wrapper aborts after `timeout`; the platform fetch is
    // synchronous here, so the elapsed check reproduces the deadline.
    if started.elapsed().as_millis() as u64 > timeout_ms {
        return ProxyTestResult::Err("Unreachable".into());
    }
    match r {
        // JS: if (r && r.ok) return { ping: Math.round(platform().now() - t0), info: {...} };
        Ok(v) if v.get("ok").and_then(|o| o.as_bool()).unwrap_or(false) => {
            let ping = (platform.now() - t0).round() as i64;
            let mut info = serde_json::Map::new();
            info.insert("name".into(), Value::String("Gravrust Via".into()));
            for key in ["protocol", "version", "target", "viaVersion"] {
                if let Some(x) = v.get(key) {
                    info.insert(key.into(), x.clone());
                }
            }
            info.insert("viaRewind".into(), Value::Bool(true));
            ProxyTestResult::Ok { ping, info: Value::Object(info) }
        }
        // JS: return { error: 'Not a Gravrust Via server' };
        Ok(_) => ProxyTestResult::Err("Not a Gravrust Via server".into()),
        // JS: catch { return { error: 'Unreachable' }; }
        Err(_) => ProxyTestResult::Err("Unreachable".into()),
    }
}

/// JS `new URL(p.url)` for the authority (host[:port]) this module needs.
fn split_url_authority(url: &str) -> Option<(&str, &str)> {
    let rest = url.split_once("://")?.1;
    match rest.find('/') {
        Some(i) => Some((&rest[..i], &rest[..i])),
        None => Some((rest, rest)),
    }
}

/// JS: module state seeding used by tests and hosts that build a list without
/// a full `ProxyList` lifecycle.
pub fn set_registry_for_tests(selected: Option<Proxy>, all: Vec<Proxy>) {
    set_registry(selected, all);
}

/// JS: the settings JSON round-trip helpers the JS gets for free from object
/// mutation: `settings.proxies` comes from config as plain JSON.
pub fn proxies_from_json(v: &Value) -> Vec<Proxy> {
    v.as_array().map(|a| a.iter().filter_map(Proxy::from_json).collect()).unwrap_or_default()
}

pub fn proxies_to_json(list: &[Proxy]) -> Value {
    Value::Array(list.iter().map(|p| p.to_json()).collect())
}
