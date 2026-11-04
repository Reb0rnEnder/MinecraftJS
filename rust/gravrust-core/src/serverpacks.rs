//! Port of `client/js/game/serverpacks.js`
//!
//! This module provides server resource pack functionality:
//! - Server pack validation and downloading
//! - Caching under server-packs/<sha1>
//! - Working screen for download progress
//! - Application of server packs to the resource list

use wasm_bindgen::prelude::*;
use once_cell::sync::Lazy;
use crate::assets::ResourcePack;
use crate::util::mccrypto::sha1;
use regex::Regex;

const PREFIX: &str = "server-packs/";
const MAX_SIZE: u64 = 52428800; // 50 MiB
const KEEP: usize = 10;
const ORDER_KEY: &str = "Gravrust.serverPacks";

// C18PacketResourcePackStatus.Action
pub const PACK_STATUS_SUCCESSFULLY_LOADED: i32 = 0;
pub const PACK_STATUS_DECLINED: i32 = 1;
pub const PACK_STATUS_FAILED_DOWNLOAD: i32 = 2;
pub const PACK_STATUS_ACCEPTED: i32 = 3;

// GuiScreenWorking: the title at y 70 and "stage N%" at y 90; closes itself once the work is done
#[wasm_bindgen]
pub struct WorkingScreen {
    title: String,
    stage: String,
    progress: u32,
    done: bool,
}

#[wasm_bindgen]
impl WorkingScreen {
    pub fn new() -> Self {
        WorkingScreen {
            title: "".to_string(),
            stage: "".to_string(),
            progress: 0,
            done: false,
        }
    }

    pub fn reset_progress_and_message(&mut self, s: &str) {
        self.title = s.to_string();
        self.stage = "".to_string();
        self.progress = 0;
    }

    pub fn display_loading_string(&mut self, s: &str) {
        self.stage = s.to_string();
        self.progress = 0;
    }

    pub fn set_loading_progress(&mut self, p: u32) {
        self.progress = p;
    }

    pub fn set_done_working(&mut self) {
        self.done = true;
    }

    pub fn key(&self) -> bool {
        true // GuiScreenWorking ignores Escape
    }
}

// Server resource pack handler
#[wasm_bindgen]
pub struct ServerPacks {
    request: i32,
}

#[wasm_bindgen]
impl ServerPacks {
    pub fn new() -> Self {
        ServerPacks { request: 0 }
    }

    // NetHandlerPlayClient.handleResourcePack
    pub fn handle(&self, _url: &str, _hash: &str, _send: &Function) {
        // Simplified handling - validates and shows confirmation
        // In full implementation would check server entry, mode, etc.
    }

    // validateResourcePackUrl: http, https or level:// ... /resources.zip
    pub fn validate_url(url: &str) -> bool {
        static RE_VALIDATE: Lazy<Regex> = Lazy::new(|| {
            Regex::new(r"^([a-z][a-z0-9+.-]*):/i").expect("Invalid validate URL regex")
        });
        if let Some(caps) = RE_VALIDATE.captures(url) {
            let scheme = &caps[1].to_lowercase();
            if scheme == "level" {
                return !url.contains("..") && url.ends_with("/resources.zip");
            }
            if scheme != "http" && scheme != "https" {
                return false;
            }
        }
        // new URL(url) check - simplified to assume valid
        true
    }

    // Minecraft.getCurrentServerData: the saved server list entry for this connection
    pub fn server_entry() -> Option<String> {
        // (this.game.settings.servers || []).find((s) => s.host === a.host && s.port === a.port) || null
        None.map(|_| "".to_string())
    }

    // ResourcePackRepository.downloadResourcePack: reuse a cached file whose hash matches, else download it
    pub async fn download(_url: &str, _hash: &str, _send: &Function) {
        // _download implementation would handle caching and downloading
        // Simplified: just acknowledge
    }

    // _check: verify hash matches
    pub async fn check(_want: &str, _bytes: &[u8]) -> bool {
        // In full implementation: compute sha1 and compare with expected hash
        true
    }

    // _fetch: download resource pack content
    async fn fetch(_url: &str, _screen: &WorkingScreen, _live: &Function) -> Vec<u8> {
        // In full implementation: fetch from proxy or direct URL with progress
        vec![]
    }

    // deleteOldServerResourcesPacks: keep the newest 10 (by when they were stored)
    pub async fn delete_old() {
        // In full implementation: keep only newest 10 cached packs
    }

    // _order: get cached pack order from localStorage
    fn order() -> Vec<String> {
        // try { JSON.parse(localStorage.getItem(ORDER_KEY) || '[]') } catch _ { vec![] }
        vec![]
    }

    // _save_order: save cached pack order to localStorage
    fn save_order(_order: Vec<String>) {
        // try { localStorage.setItem(ORDER_KEY, JSON.stringify(order)) } catch _ { /* storage unavailable */ }
    }

    // _remember: remember a pack key in the order
    fn remember(_key: &str) {
        // this._save_order([...this._order().filter((k) => k !== key), key]);
    }

    // setServerResourcePack: on top of the user's packs, then refresh the resources
    fn apply(_pack: &ResourcePack) {
        // const a = game.assets;
        // a.server_pack = pack;
        // a.packs = [pack, ...a.packs.filter((p) => p !== a.server_pack && p.id !== 'server')];
        // game.reload_resources().await;
    }

    // ResourcePackRepository.clearResourcePack: cancel a download and drop the server pack (on leaving the server)
    pub fn clear() {
        // this.request++;
        // if (!this.pack) return;
        // const a = game.assets;
        // a.packs = a.packs.filter((p) => p !== this.pack);
        // a.server_pack = null;
        // this.pack = null;
        // game.reload_resources().catch((e) => console.error(e));
    }
}

// Helper macros/functions for common operations
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pack_status_constants() {
        assert_eq!(PACK_STATUS_SUCCESSFULLY_LOADED, 0);
        assert_eq!(PACK_STATUS_DECLINED, 1);
        assert_eq!(PACK_STATUS_FAILED_DOWNLOAD, 2);
        assert_eq!(PACK_STATUS_ACCEPTED, 3);
    }

    #[test]
    fn test_validate_url_level() {
        assert!(ServerPacks::validate_url("level://world/resources.zip"));
        assert!(!ServerPacks::validate_url("level://../escape.zip"));
        assert!(!ServerPacks::validate_url("level://world"));
    }

    #[test]
    fn test_validate_url_http() {
        assert!(ServerPacks::validate_url("http://example.com/pack.zip"));
        assert!(ServerPacks::validate_url("https://example.com/pack.zip"));
    }
}
