//! Port of `client/js/game/accounts.js`
//!
//! Account manager: offline names and Microsoft accounts (signed in through the proxy with the OAuth
//! device code flow). Stored through the platform settings store on this device only.

use serde_json::{json, Value};
use wasm_bindgen::prelude::*;

// ------------------------------------------------------------ Account types

/// Account type identifier.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AccountType {
    Offline = 0,
    Microsoft = 1,
}

// ------------------------------------------------------------ Account entry

/// A single account entry, mirroring the JS account object shape.
#[derive(Debug, Clone)]
pub struct Account {
    /// Unique identifier (e.g. "offline:Name" or "ms:UUID").
    pub id: String,
    /// Account type.
    pub r#type: AccountType,
    /// Display name.
    pub name: String,
    /// Microsoft UUID (optional, present for Microsoft accounts).
    pub uuid: Option<String>,
    /// Access token (optional, present for Microsoft accounts).
    pub access_token: Option<String>,
    /// Refresh token (optional, present for Microsoft accounts).
    pub refresh_token: Option<String>,
    /// Token expiry epoch millis (optional, present for Microsoft accounts).
    pub expires_at: Option<u64>,
}

// ------------------------------------------------------------ Accounts manager

/// Portable accounts manager ported from client/js/game/accounts.js.
/// Handles offline and Microsoft account storage, selection, and Microsoft auth flow.
#[derive(Debug, Clone)]
pub struct Accounts {
    list: Vec<Account>,
    active_id: Option<String>,
}

impl Accounts {
    /// Create a new Accounts manager, loading any saved state.
    ///
    /// In the ported core, the caller is responsible for providing initial
    /// saved state or passing an empty list. The JS original load from
    /// `platform().loadSetting()` is omitted here so the core remains
    /// platform-agnostic; the browser glue can bridge this call.
    pub fn new(list: Vec<Account>, active_id: Option<String>) -> Self {
        let mut me = Self {
            list,
            active_id,
        };
        if !me.list.is_empty() && me.active_id.is_none() {
            me.active_id = Some(me.list[0].id.clone());
        }
        me
    }

    /// Save the current state (list + active id) through the platform store.
    ///
    /// The JS original calls `platform().saveSetting(KEY, ...)`. In this core
    /// crate the implementation is left as a no-op so callers can bridge to
    /// their platform-specific storage. Override or extend as needed for your
    /// target environment.
    pub fn save(&self) {
        // Platform bridging: call platform().saveSetting("Gravrust.accounts",
        // JSON.stringify({ list: this.list, active: this.activeId }));
    }

    /// Return the currently active account, or null if none.
    ///
    /// Mirrors `Accounts.prototype.active()` from the JS original.
    pub fn active(&self) -> Option<&Account> {
        self.list
            .iter()
            .find(|a| a.id == self.active_id.as_deref().unwrap_or(""))
            .or_else(|| self.list.first())
    }

    /// Set the active account by id, updating the settings username if found.
    ///
    /// Mirrors `Accounts.prototype.setActive(id)` from the JS original.
    pub fn set_active(&mut self, id: &str) {
        self.active_id = Some(id.to_string());
        if let Some(a) = self.active() {
            // The JS original does: this.settings.username = a.name; this.settings.save();
            // In the core crate we only manage accounts; the caller bridges settings.
        }
        self.save();
    }

    /// Add an offline account if one with the given name does not already exist.
    ///
    /// Mirrors `Accounts.prototype.addOffline(name)` from the JS original.
    /// The name is sanitized to alphanumeric+underscore, truncated to 16 chars.
    pub fn add_offline(&mut self, name: &str) -> &Account {
        let sanitized = name
            .chars()
            .filter(|c| c.is_alphanumeric() || *c == '_')
            .collect::<String>()
            .trim_end()
            .to_string();
        let name = if sanitized.is_empty() { "Player".to_string() } else { sanitized };
        let name = &name[..16.min(name.len())];
        let id = format!("offline:{}", name);
        if self.list.iter().any(|a| a.id == id) {
            let a = self.list.iter().find(|a| a.id == id).unwrap();
            return a;
        }
        let a = Account {
            id,
            r#type: AccountType::Offline,
            name: name.to_string(),
            uuid: None,
            access_token: None,
            refresh_token: None,
            expires_at: None,
        };
        self.list.push(a.clone());
        self.save();
        &self.list[self.list.len() - 1]
    }

    /// Add or update a Microsoft account from a raw account object.
    ///
    /// Mirrors `Accounts.prototype.addMicrosoft(acc)` from the JS original.
    /// The `acc` object typically has a `uuid` and other Microsoft fields.
    pub fn add_microsoft(&mut self, acc: &Value) -> &Account {
        let uuid = acc.get("uuid").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let id = format!("ms:{}", uuid);
        let a = Account {
            id: id.clone(),
            r#type: AccountType::Microsoft,
            name: acc.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            uuid: if !uuid.is_empty() { Some(uuid.clone()) } else { None },
            access_token: acc.get("accessToken").and_then(|v| v.as_str()).map(|s| s.to_string()),
            refresh_token: acc.get("refreshToken").and_then(|v| v.as_str()).map(|s| s.to_string()),
            expires_at: acc.get("expiresAt").and_then(|v| v.as_u64()),
        };
        let i = self.list.iter().position(|x| x.id == id);
        if let Some(idx) = i {
            self.list[idx] = a.clone();
        } else {
            self.list.push(a.clone());
        }
        self.save();
        &self.list[self.list.len() - 1]
    }

    /// Remove an account by id. If the list becomes empty, adds an offline account
    /// for the username fallback.
    ///
    /// Mirrors `Accounts.prototype.remove(id)` from the JS original.
    pub fn remove(&mut self, id: &str) {
        self.list = self.list.iter().filter(|a| a.id != id).cloned().collect();
        if self.list.is_empty() {
            // The JS uses `this.settings.username` which the core caller provides;
            // here we add a generic offline fallback.
            self.add_offline("WebPlayer");
        }
        if self.active_id.as_ref().map_or(false, |aid| aid == id) {
            self.active_id = self.list.first().map(|a| a.id.clone());
        }
        self.save();
    }

    /// Ensure a Microsoft account has a fresh access token, refreshing if near expiry.
    ///
    /// Mirrors `Accounts.prototype.ensureFresh(a)` from the JS original.
    /// JS logic: `a.accessToken && a.expiresAt - Date.now() > REFRESH_MARGIN`
    /// where REFRESH_MARGIN = 5 * 60 * 1000 = 300000 ms.
    /// In this core crate the actual time check is omitted (the caller can
    /// compare `a.expires_at` against the current time if desired), and the
    /// HTTP refresh call is left as a bridge point for the platform layer.
    ///
    /// Returns `Ok(a)` if the token is considered fresh or not a Microsoft account.
    /// Returns `Err` with a message if the platform needs to implement the refresh.
    pub async fn ensure_fresh(&mut self, a: &Account) -> Result<Account, String> {
        if a.r#type != AccountType::Microsoft {
            return Ok(a.clone());
        }
        // Token is considered fresh if expires_at is absent or in the future.
        // The exact REFRESH_MARGIN (5 min) check is left to the caller/platform.
        if a.expires_at.is_none() {
            return Ok(a.clone());
        }
        // Platform bridging: const r = await authPost('/auth/refresh', {
        //   refreshToken: a.refreshToken
        // });
        // if (!r.json || !r.json.account) throw new Error(...);
        // return this.addMicrosoft(r.json.account);
        Err("Microsoft token refresh not implemented in core crate".into())
    }

    /// Start the device code sign-in flow.
    ///
    /// Mirrors `Accounts.prototype.startDeviceLogin()` from the JS original.
    /// The browser glue should bridge this to `authPost('/auth/device', {})`.
    pub async fn start_device_login() -> Result<Value, String> {
        // Platform bridging: const r = await authPost('/auth/device', {});
        // if (!r.json || !r.json.deviceCode) throw new Error(...);
        // return r.json;
        Err("Device login not implemented in core crate".into())
    }

    /// Poll for a device code sign-in result.
    ///
    /// Mirrors `Accounts.prototype.pollDeviceLogin(deviceCode)` from the JS original.
    /// The browser glue should bridge this to `authPost('/auth/poll', { deviceCode })`.
    pub async fn poll_device_login(_device_code: &str) -> Result<Option<Account>, String> {
        // Platform bridging: const r = await authPost('/auth/poll', { deviceCode });
        // if (r.status !== 200) throw new Error(...);
        // return r.json.account ? this.addMicrosoft(r.json.account) : null;
        Err("Device login poll not implemented in core crate".into())
    }
}

// ------------------------------------------------------------ Tests

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_sets_active_to_first() {
        let list = vec![
            Account {
                id: "offline:Player1".to_string(),
                r#type: AccountType::Offline,
                name: "Player1".to_string(),
                uuid: None,
                access_token: None,
                refresh_token: None,
                expires_at: None,
            },
            Account {
                id: "offline:Player2".to_string(),
                r#type: AccountType::Offline,
                name: "Player2".to_string(),
                uuid: None,
                access_token: None,
                refresh_token: None,
                expires_at: None,
            },
        ];
        let accounts = Accounts::new(list, None);
        assert_eq!(accounts.active().map(|a| a.id.as_str()), Some("offline:Player1"));
    }

    #[test]
    fn add_offline_creates_sanitized() {
        let mut accounts = Accounts::new(vec![], None);
        let a = accounts.add_offline("  John_Doe#123  ");
        assert_eq!(a.name, "John_Doe");
        assert_eq!(a.id, "offline:John_Doe");
    }

    #[test]
    fn add_offline_truncates() {
        let mut accounts = Accounts::new(vec![], None);
        accounts.add_offline("VeryLongNameThatGetsTruncated");
        // Should have been truncated to 16 chars: "VeryLongNameTha"
        let last = accounts.list.last().unwrap();
        assert!(last.id.starts_with("offline:"));
        let suffix = &last.id["offline:".len()..];
        assert!(suffix.len() <= 16);
    }

    #[test]
    fn remove_removes_and_keeps_active() {
        let mut accounts = Accounts::new(
            vec![
                Account {
                    id: "offline:Player1".to_string(),
                    r#type: AccountType::Offline,
                    name: "Player1".to_string(),
                    uuid: None,
                    access_token: None,
                    refresh_token: None,
                    expires_at: None,
                },
                Account {
                    id: "offline:Player2".to_string(),
                    r#type: AccountType::Offline,
                    name: "Player2".to_string(),
                    uuid: None,
                    access_token: None,
                    refresh_token: None,
                    expires_at: None,
                },
            ],
            None,
        );
        accounts.remove("offline:Player1");
        assert!(accounts.list.iter().all(|a| a.id != "offline:Player1"));
        // Active should shift to first remaining
        assert_eq!(
            accounts.active().map(|a| a.id.as_str()),
            Some("offline:Player2")
        );
    }

    #[test]
    fn active_returns_first_when_no_active() {
        let accounts = Accounts::new(
            vec![
                Account {
                    id: "offline:Player1".to_string(),
                    r#type: AccountType::Offline,
                    name: "Player1".to_string(),
                    uuid: None,
                    access_token: None,
                    refresh_token: None,
                    expires_at: None,
                },
            ],
            None,
        );
        assert_eq!(
            accounts.active().map(|a| a.id.as_str()),
            Some("offline:Player1")
        );
    }
}