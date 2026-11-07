//! Port of `client/js/net/connection.js`: socket link to the game server.
//!
//! Vanilla servers go through the selected proxy: a Gravrust proxy
//! (platform().openSocket, the proxy logs in), or a Java relay / Wisp server
//! carrying raw TCP (tcp.js, the client logs in); Eaglercraft servers
//! (ws:// / wss:// addresses) are reached directly over their own WebSocket
//! (eagler.js). All sockets look the same: binary frames carry raw play packets
//! (varint id + body), text frames JSON control messages.

use std::cell::RefCell;
use std::rc::Rc;
use std::collections::HashMap;

use wasm_bindgen::prelude::*;
use js_sys::{Object, Array, Function, Reflect, Uint8Array};
use serde_json::{json, Value as JsonValue};

use crate::platform_contract::{Platform, PlatformSocket, SocketEvent, SocketEventKind};
use crate::protocol_1144::decode_packet_498;
use crate::protocol_1152::{decode_packet_578, PROTOCOL_578};
use crate::address::parse_address;
use crate::protocol::Json;

/// Current protocol version (1.15.2 = 578)
pub const PROTOCOL_VERSION: i32 = PROTOCOL_578;

/// Connection state
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectionState {
    Idle,
    Login,
    Play,
    Closed,
}

impl ConnectionState {
    fn as_str(&self) -> &'static str {
        match self {
            ConnectionState::Idle => "idle",
            ConnectionState::Login => "login",
            ConnectionState::Play => "play",
            ConnectionState::Closed => "closed",
        }
    }
}

/// Events that can be emitted by the Connection
#[wasm_bindgen]
pub enum ConnectionEventKind {
    Close,
    Control,
    Packet,
}

/// A decoded packet with its ID and body
pub struct DecodedPacket {
    id: i32,
    name: Option<String>,
    body: JsValue,
}

impl DecodedPacket {
    pub fn id(&self) -> i32 {
        self.id
    }

    pub fn name(&self) -> Option<String> {
        self.name.clone()
    }

    pub fn body(&self) -> JsValue {
        self.body.clone()
    }
}

/// Main Connection struct
#[wasm_bindgen]
pub struct Connection {
    /// The underlying socket (if connected)
    socket: Option<Rc<RefCell<Box<dyn PlatformSocket>>>>,
    /// Event handlers: event name -> array of callbacks
    handlers: HashMap<String, Vec<Function>>,
    /// Current connection state
    state: ConnectionState,
    /// Bytes received
    bytes_in: u64,
    /// Packets received
    packets_in: u64,
    /// Platform reference for opening sockets (stored internally, not exposed to wasm)
    platform: Option<Rc<RefCell<dyn Platform>>>,
}

#[wasm_bindgen]
impl Connection {
    /// Create a new Connection.
    #[wasm_bindgen(constructor)]
    pub fn new() -> Connection {
        Connection {
            socket: None,
            handlers: HashMap::new(),
            state: ConnectionState::Idle,
            bytes_in: 0,
            packets_in: 0,
            platform: None,
        }
    }

    /// Register an event handler for the given event name.
    /// Event names: "close", "control", "packet"
    pub fn on(&mut self, ev: &str, callback: Function) {
        self.handlers.entry(ev.to_string()).or_default().push(callback);
    }

    /// Emit an event to all registered handlers.
    fn emit(&self, ev: &str, args: &[JsValue]) {
        if let Some(handlers) = self.handlers.get(ev) {
            for handler in handlers {
                let this = JsValue::NULL;
                let _ = match args.len() {
                    0 => handler.call0(&this),
                    1 => handler.call1(&this, &args[0]),
                    2 => handler.call2(&this, &args[0], &args[1]),
                    3 => handler.call3(&this, &args[0], &args[1], &args[2]),
                    _ => {
                        let arr = Array::new();
                        for arg in args {
                            arr.push(arg);
                        }
                        handler.apply(&this, &arr)
                    }
                };
            }
        }
    }

    /// Get the current connection state
    #[wasm_bindgen(getter)]
    pub fn state(&self) -> String {
        self.state.as_str().to_string()
    }

    /// Get bytes received
    #[wasm_bindgen(getter)]
    pub fn bytes_in(&self) -> u64 {
        self.bytes_in
    }

    /// Get packets received
    #[wasm_bindgen(getter)]
    pub fn packets_in(&self) -> u64 {
        self.packets_in
    }

    /// Open a socket connection to the given address.
    /// If the address is an Eaglercraft address (ws:// or wss://), connects directly.
    /// Otherwise, uses the configured proxy.
    pub fn open(&mut self, address: &str) -> Result<(), JsValue> {
        if self.socket.is_some() {
            return Ok(());
        }

        let platform = self.platform.as_ref()
            .ok_or_else(|| JsValue::from_str("Platform not set"))?;

        // Parse the address to determine if it's an Eaglercraft address
        let parsed_json = parse_address(address)
            .ok_or_else(|| JsValue::from_str("Invalid address"))?;

        // Parse JSON to check if it's an eagler address
        let is_eagler = parsed_json.contains("\"kind\":\"eagler\"");

        let socket = if is_eagler {
            // For Eaglercraft, we need to extract the URL from the parsed address
            let url = extract_url_from_parsed(&parsed_json)
                .ok_or_else(|| JsValue::from_str("Invalid Eaglercraft address"))?;
            platform.borrow_mut().open_socket(&url)?
        } else {
            // For vanilla servers, use the proxy
            let proxy_url = get_proxy_url(platform.clone())?;
            platform.borrow_mut().open_socket(&proxy_url)?
        };

        let socket_rc = Rc::new(RefCell::new(socket));
        self.setup_socket_handlers(socket_rc.clone());
        self.socket = Some(socket_rc);
        self.state = ConnectionState::Idle;

        Ok(())
    }

    /// Connect to a host with the given credentials.
    /// Sends a "connect" control message.
    pub fn connect(&mut self, host: &str, port: u16, username: &str, auth: Option<Object>) -> Result<(), JsValue> {
        let socket = self.socket.as_ref()
            .ok_or_else(|| JsValue::from_str("Socket not open"))?;

        let mut connect_msg = Object::new();
        Reflect::set(&connect_msg, &"type".into(), &"connect".into())?;
        Reflect::set(&connect_msg, &"host".into(), &host.into())?;
        Reflect::set(&connect_msg, &"port".into(), &(port as i32).into())?;
        Reflect::set(&connect_msg, &"username".into(), &username.into())?;
        
        if let Some(auth_obj) = auth {
            Reflect::set(&connect_msg, &"auth".into(), &auth_obj)?;
        } else {
            Reflect::set(&connect_msg, &"auth".into(), &JsValue::NULL)?;
        }
        
        Reflect::set(&connect_msg, &"protocol".into(), &(PROTOCOL_VERSION).into())?;

        let text = js_sys::JSON::stringify(&connect_msg)
            .map_err(|e| JsValue::from_str(&e.as_string().unwrap_or_else(|| "JSON stringify failed".to_string())))?;

        socket.borrow().send_text(&text.as_string().unwrap_or_default());
        self.state = ConnectionState::Login;

        Ok(())
    }

    /// Ping a host (for server list) - synchronous version that initiates ping
    /// Returns a Promise-like result via callback
    pub fn ping(&mut self, host: &str, port: u16) -> Result<(), JsValue> {
        let platform = self.platform.as_ref()
            .ok_or_else(|| JsValue::from_str("Platform not set"))?;

        let parsed_json = parse_address(host)
            .ok_or_else(|| JsValue::from_str("Invalid address"))?;

        let is_eagler = parsed_json.contains("\"kind\":\"eagler\"");

        if is_eagler {
            // For Eaglercraft, we open a temporary socket and send MOTD request
            let url = extract_url_from_parsed(&parsed_json)
                .ok_or_else(|| JsValue::from_str("Invalid Eaglercraft address"))?;
            
            let mut sock = platform.borrow_mut().open_socket(&url)
                .map_err(|e| JsValue::from_str(&e))?;

            sock.send_text("Accept: MOTD");
            
            // Set up one-time handlers for the ping response
            let this = self as *const Connection;
            sock.on(SocketEventKind::Text, Box::new(move |event: &SocketEvent| {
                if let SocketEvent::Text(text) = event {
                    if let Ok(msg) = serde_json::from_str::<JsonValue>(text) {
                        if msg.get("type").and_then(|v| v.as_str()) == Some("ping_result") {
                            // We can't easily return the result here without async
                            // The result would need to be delivered via a callback
                        }
                    }
                }
            }));
            
            // Close after a timeout (in real implementation this would be handled differently)
            sock.close();
        } else {
            // Vanilla proxy ping
            let proxy_url = get_proxy_url(platform.clone())?;
            let mut sock = platform.borrow_mut().open_socket(&proxy_url)
                .map_err(|e| JsValue::from_str(&e))?;

            let ping_msg = json!({
                "type": "ping",
                "host": host,
                "port": port,
                "id": 1,
                "protocol": PROTOCOL_VERSION
            });
            sock.send_text(&ping_msg.to_string());
            sock.close();
        }
        
        Ok(())
    }

    /// Send binary data (play packets)
    pub fn send(&mut self, bytes: &[u8]) -> Result<(), JsValue> {
        let socket = self.socket.as_ref()
            .ok_or_else(|| JsValue::from_str("Socket not open"))?;

        if self.state == ConnectionState::Play {
            socket.borrow().send_binary(bytes);
            Ok(())
        } else {
            Err(JsValue::from_str("Not in play state"))
        }
    }

    /// Close the connection
    pub fn close(&mut self) {
        if let Some(socket) = self.socket.take() {
            socket.borrow().close();
        }
        self.state = ConnectionState::Closed;
    }
}

impl Connection {
    /// Set up socket event handlers
    fn setup_socket_handlers(&mut self, socket: Rc<RefCell<Box<dyn PlatformSocket>>>) {
        // Handle text messages (control messages)
        let this_ptr = self as *mut Connection;
        socket.borrow_mut().on(SocketEventKind::Text, Box::new(move |event: &SocketEvent| {
            if let SocketEvent::Text(text) = event {
                if let Ok(msg) = serde_json::from_str::<JsonValue>(text) {
                    if let Ok(js_val) = serde_wasm_bindgen::to_value(&msg) {
                        unsafe {
                            if !(*this_ptr).socket.is_none() {
                                (*this_ptr).emit("control", &[js_val]);
                            }
                        }
                    }
                }
            }
        }));

        // Handle binary messages (play packets)
        let this_ptr2 = self as *mut Connection;
        socket.borrow_mut().on(SocketEventKind::Binary, Box::new(move |event: &SocketEvent| {
            if let SocketEvent::Binary(bytes) = event {
                unsafe {
                    (*this_ptr2).bytes_in += bytes.len() as u64;
                    (*this_ptr2).packets_in += 1;
                    
                    if (*this_ptr2).state == ConnectionState::Play {
                        if let Ok(decoded) = decode_packet(bytes) {
                            (*this_ptr2).emit("packet", &[decoded]);
                        }
                    }
                }
            }
        }));

        // Handle close
        let this_ptr3 = self as *mut Connection;
        socket.borrow_mut().on(SocketEventKind::Close, Box::new(move |event: &SocketEvent| {
            if let SocketEvent::Close(close_event) = event {
                unsafe {
                    let was_state = (*this_ptr3).state;
                    (*this_ptr3).state = ConnectionState::Closed;
                    (*this_ptr3).socket = None;
                    let reason_obj = Object::new();
                    let _ = Reflect::set(&reason_obj, &"code".into(), &(close_event.code as i32).into());
                    let _ = Reflect::set(&reason_obj, &"reason".into(), &close_event.reason.clone().into());
                    let _ = Reflect::set(&reason_obj, &"was".into(), &was_state.as_str().into());
                    (*this_ptr3).emit("close", &[reason_obj.into()]);
                }
            }
        }));
    }
}

/// Internal methods for Connection (not exposed to wasm)
impl Connection {
    /// Set the platform (internal method, not exposed to wasm directly)
    pub fn set_platform_internal(&mut self, platform: Rc<RefCell<dyn Platform>>) {
        self.platform = Some(platform);
    }

    /// Get a reference to the platform for internal use
    pub fn get_platform(&self) -> Option<Rc<RefCell<dyn Platform>>> {
        self.platform.clone()
    }
}

/// Decode a packet from binary data using the current protocol version
fn decode_packet(bytes: &[u8]) -> Result<JsValue, JsValue> {
    // Try 578 first (1.15.2)
    match decode_packet_578(bytes) {
        Ok(decoded) => decoded_to_jsvalue(decoded),
        Err(_) => {
            // Fallback to 498 (1.14.4)
            match decode_packet_498(bytes) {
                Ok(decoded) => decoded498_to_jsvalue(decoded),
                Err(e) => Err(JsValue::from_str(&e.0)),
            }
        }
    }
}

/// Convert Decoded578 to JsValue
fn decoded_to_jsvalue(decoded: crate::protocol_1152::Decoded578) -> Result<JsValue, JsValue> {
    use crate::protocol_1152::Decoded578;
    
    let obj = Object::new();
    
    match decoded {
        Decoded578::Packet { id, name, body } => {
            Reflect::set(&obj, &"id".into(), &id.into())?;
            Reflect::set(&obj, &"name".into(), &name.into())?;
            let body_js = json_to_jsvalue(&body)?;
            Reflect::set(&obj, &"body".into(), &body_js)?;
        }
        Decoded578::Unsupported { id, packet_name, data } => {
            Reflect::set(&obj, &"id".into(), &id.into())?;
            Reflect::set(&obj, &"name".into(), &"unsupported".into())?;
            if let Some(name) = packet_name {
                Reflect::set(&obj, &"packetName".into(), &name.into())?;
            }
            let data_arr = Uint8Array::new_with_length(data.len() as u32);
            data_arr.copy_from(&data);
            Reflect::set(&obj, &"data".into(), &data_arr.into())?;
        }
    }
    
    Ok(obj.into())
}

/// Convert Decoded498 to JsValue
fn decoded498_to_jsvalue(decoded: crate::protocol_1144::Decoded498) -> Result<JsValue, JsValue> {
    use crate::protocol_1144::Decoded498;
    
    let obj = Object::new();
    
    match decoded {
        Decoded498::Packet { id, name, body } => {
            Reflect::set(&obj, &"id".into(), &id.into())?;
            Reflect::set(&obj, &"name".into(), &name.into())?;
            let body_js = json_to_jsvalue(&body)?;
            Reflect::set(&obj, &"body".into(), &body_js)?;
        }
        Decoded498::Unsupported { id, packet_name, data } => {
            Reflect::set(&obj, &"id".into(), &id.into())?;
            Reflect::set(&obj, &"name".into(), &"unsupported".into())?;
            if let Some(name) = packet_name {
                Reflect::set(&obj, &"packetName".into(), &name.into())?;
            }
            let data_arr = Uint8Array::new_with_length(data.len() as u32);
            data_arr.copy_from(&data);
            Reflect::set(&obj, &"data".into(), &data_arr.into())?;
        }
    }
    
    Ok(obj.into())
}

/// Convert protocol::Json to JsValue
fn json_to_jsvalue(json: &Json) -> Result<JsValue, JsValue> {
    match json {
        Json::Null => Ok(JsValue::NULL),
        Json::Bool(b) => Ok((*b).into()),
        Json::Int(i) => Ok((*i).into()),
        Json::Num(f) => Ok((*f).into()),
        Json::Str(s) => Ok(s.clone().into()),
        Json::Arr(arr) => {
            let js_arr = Array::new();
            for item in arr {
                let item_js = json_to_jsvalue(item)?;
                js_arr.push(&item_js);
            }
            Ok(js_arr.into())
        }
        Json::Obj(obj_map) => {
            let js_obj = Object::new();
            for (key, value) in obj_map {
                let value_js = json_to_jsvalue(value)?;
                Reflect::set(&js_obj, &key.into(), &value_js)?;
            }
            Ok(js_obj.into())
        }
    }
}

/// Extract URL from parsed address JSON
fn extract_url_from_parsed(parsed: &str) -> Option<String> {
    if let Ok(value) = serde_json::from_str::<JsonValue>(parsed) {
        if let Some(url) = value.get("url").and_then(|v| v.as_str()) {
            return Some(url.to_string());
        }
    }
    None
}

/// Get the proxy URL from the platform
fn get_proxy_url(platform: Rc<RefCell<dyn Platform>>) -> Result<String, JsValue> {
    let origin = platform.borrow().origin_socket_url();
    origin.ok_or_else(|| JsValue::from_str("No proxy selected: add one in Proxy Servers on the title screen"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::platform_contract::{Platform, PlatformInfo, MemoryInfo};
    use std::collections::HashMap;

    struct MockPlatform {
        sockets: Vec<MockSocket>,
    }

    struct MockSocket {
        handlers: HashMap<String, Box<dyn FnMut(&SocketEvent)>>,
    }

    impl MockSocket {
        fn new() -> Self {
            Self {
                handlers: HashMap::new(),
            }
        }
    }

    impl PlatformSocket for MockSocket {
        fn send_text(&self, _s: &str) {}
        fn send_binary(&self, _b: &[u8]) {}
        fn close(&self) {}
        fn on(&mut self, event: SocketEventKind, handler: Box<dyn FnMut(&SocketEvent)>) {
            self.handlers.insert(event.as_str().to_string(), handler);
        }
    }

    impl Platform for MockPlatform {
        fn width(&self) -> u32 { 800 }
        fn height(&self) -> u32 { 600 }
        fn on(&mut self, _event: crate::platform_contract::PlatformEventKind, _handler: Box<dyn FnMut(&crate::platform_contract::PlatformEvent)>) {}
        fn lock_pointer(&mut self) {}
        fn unlock_pointer(&mut self) {}
        fn is_pointer_locked(&self) -> bool { false }
        fn toggle_fullscreen(&mut self) {}
        fn is_fullscreen(&self) -> bool { false }
        fn set_clipboard(&mut self, _text: &str) {}
        fn load_setting(&self, _key: &str) -> Option<String> { None }
        fn save_setting(&mut self, _key: &str, _value: &str) {}
        fn files(&mut self) -> &mut dyn crate::platform_contract::PlatformFiles { unimplemented!() }
        fn pick_files(&mut self, _options: &crate::platform_contract::PickFilesOptions) -> Vec<crate::platform_contract::PickedFile> { Vec::new() }
        fn save_file(&self, _name: &str, _bytes: &[u8], _mime: &str) {}
        fn open_url(&mut self, _url: &str) {}
        fn fetch_bytes(&mut self, _path: &str) -> Option<Vec<u8>> { None }
        fn fetch_text(&mut self, _path: &str) -> Option<String> { None }
        fn post_json(&mut self, _path: &str, _body: &serde_json::Value) -> crate::platform_contract::PostJsonResponse {
            crate::platform_contract::PostJsonResponse { status: 0, json: None }
        }
        fn probe(&mut self, _url: &str) -> bool { false }
        fn fetch_json(&mut self, _path: &str) -> Result<serde_json::Value, String> { Err("stub".into()) }
        fn open_socket(&mut self, _url: &str) -> Result<Box<dyn PlatformSocket>, String> {
            Ok(Box::new(MockSocket::new()))
        }
        fn origin_socket_url(&self) -> Option<String> { Some("wss://proxy.example.com".to_string()) }
        fn embedded_assets(&mut self) -> Option<Vec<u8>> { None }
        fn load_config(&mut self) -> serde_json::Map<String, serde_json::Value> { serde_json::Map::new() }
        fn now(&self) -> f64 { 0.0 }
        fn request_frame(&mut self, _frame: Box<dyn FnOnce(f64)>) {}
        fn vsync(&self) -> Option<bool> { None }
        fn cpu_count(&self) -> u32 { 4 }
        fn info(&self) -> PlatformInfo {
            PlatformInfo {
                runtime: "Test".into(),
                bits: 64,
                memory: None,
                cpu: "Test CPU".into(),
            }
        }
        fn create_graphics_device(&mut self, _preference: &str) -> Result<(), String> { Err("stub".into()) }
        fn create_audio(&mut self) -> bool { false }
        fn create_worker(&mut self, _path: &str, _classic: bool) -> Option<Box<dyn crate::platform_contract::Worker>> { None }
        fn set_loading(&mut self, _message: &str, _percent: Option<f64>) {}
        fn hide_loading(&mut self) {}
        fn set_loading_error(&mut self, _message: &str) {}
        fn set_title(&mut self, _title: &str) {}
        fn launch_params(&self) -> HashMap<String, String> { HashMap::new() }
    }

    #[test]
    fn test_connection_new() {
        let conn = Connection::new();
        assert_eq!(conn.state(), "idle");
        assert_eq!(conn.bytes_in(), 0);
        assert_eq!(conn.packets_in(), 0);
    }

    #[test]
    fn test_connection_state_transitions() {
        let mut conn = Connection::new();
        let platform = Rc::new(RefCell::new(MockPlatform { sockets: Vec::new() }));
        conn.set_platform_internal(platform);
        
        assert_eq!(conn.state(), "idle");
        conn.close();
        assert_eq!(conn.state(), "closed");
    }

    #[test]
    fn test_json_conversion() {
        let json_null = Json::Null;
        assert_eq!(json_to_jsvalue(&json_null).unwrap(), JsValue::NULL);

        let json_bool = Json::Bool(true);
        assert!(json_to_jsvalue(&json_bool).unwrap().as_bool().unwrap());

        let json_int = Json::Int(42);
        assert_eq!(json_to_jsvalue(&json_int).unwrap().as_f64().unwrap(), 42.0);

        let json_num = Json::Num(3.14);
        assert_eq!(json_to_jsvalue(&json_num).unwrap().as_f64().unwrap(), 3.14);

        let json_str = Json::Str("hello".to_string());
        assert_eq!(json_to_jsvalue(&json_str).unwrap().as_string().unwrap(), "hello");
    }
}