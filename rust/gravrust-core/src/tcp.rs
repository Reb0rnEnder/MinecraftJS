// Port of `client/js/net/tcp.js`.
//
// Raw TCP to Minecraft servers through WebSocket relays that only carry
// bytes, with the Minecraft protocol (handshake, login, compression,
// encryption) done here in the client:
//
//   relay  Eaglercraft 26.2 relay ("minecraft-java-byte-stream-v1"):
//          wss://relay/minecraft?target=host[:port][&token=] — one WebSocket
//          per connection, binary frames in both directions are the TCP
//          stream. Without a port the relay resolves _minecraft._tcp SRV
//          records itself; the handshake port must match the target port.
//   wisp   Wisp v1 (Mercury Workshop): one WebSocket multiplexing TCP
//          streams. Frames are [type u8][stream id u32 LE][payload]:
//          0x01 CONNECT [0x01 tcp][port u16 LE][host], 0x02 DATA,
//          0x03 CONTINUE [buffer u32 LE] (flow control), 0x04 CLOSE
//          [reason], 0x05 INFO (v2 servers; answered with a v2 INFO without
//          extensions).
//
// VanillaSocket wraps either stream in the proxy-link interface (sendText
// JSON control messages, sendBinary raw play packets, 'text' control
// messages back), so Connection drives it like a proxy.
//
// Browser-bound surfaces stay behind traits with the JS call sequences: the
// platform (openSocket, fetchBytes, postJson, now), and RSA encryption
// (WebCrypto). AES/CFB8 and the session hash come from the already-ported
// `crate::mccrypto`; DEFLATE uses the crate's `miniz_oxide` (both sides
// speak standard zlib, so any conforming compressor is wire-compatible).

use std::time::Instant;

use serde_json::Value;
use crate::mccrypto::{server_hash, Cfb8};
use crate::wisp_net::wisp_packet;

// ---------------------------------------------------------------- Emitter

/// JS: `class Emitter` — `on(ev, fn)` with optional buffering of events
/// emitted before any handler registers (`buffered = true`).
pub struct Emitter {
    /// JS: `this.handlers = {}` — one handler per event in this port's use.
    handlers: Vec<(&'static str, Box<dyn FnMut(&EmitterEvent) + Send>)>,
    /// JS: `this.pending = buffered ? {} : null` — events queued until `on`.
    pending: Option<Vec<(&'static str, EmitterEvent)>>,
}

/// The event payloads the transports and [`VanillaSocket`] emit.
pub enum EmitterEvent {
    /// JS: `s.emit('data', b)`.
    Data(Vec<u8>),
    /// JS: `s.emit('close', reason)`.
    Close(Option<String>),
    /// JS: `this.emit('text', JSON.stringify(obj))`.
    Text(String),
    /// JS: `this.emit('binary', p)`.
    Binary(Vec<u8>),
}

impl Emitter {
    /// JS: `constructor(buffered = false)`.
    pub fn new(buffered: bool) -> Self {
        Emitter { handlers: Vec::new(), pending: if buffered { Some(Vec::new()) } else { None } }
    }

    /// JS: `on(ev, fn)` — late-registered handlers receive buffered events.
    pub fn on(&mut self, ev: &'static str, mut f: Box<dyn FnMut(&EmitterEvent) + Send>) {
        // JS: (this.handlers[ev] ||= []).push(fn);
        self.handlers.push((ev, f));
        // JS: const pending = this.pending?.[ev]; if (pending) { delete ...; for (const value of pending) fn(value); }
        if let Some(pending) = &mut self.pending {
            let matching: Vec<EmitterEvent> = pending
                .iter()
                .filter(|(e, _)| *e == ev)
                .map(|(_, v)| match v {
                    EmitterEvent::Data(b) => EmitterEvent::Data(b.clone()),
                    EmitterEvent::Close(r) => EmitterEvent::Close(r.clone()),
                    EmitterEvent::Text(s) => EmitterEvent::Text(s.clone()),
                    EmitterEvent::Binary(b) => EmitterEvent::Binary(b.clone()),
                })
                .collect();
            pending.retain(|(e, _)| *e != ev);
            for value in matching {
                if let Some((_, h)) = self.handlers.iter_mut().find(|(e, _)| *e == ev) {
                    h(&value);
                }
            }
        }
    }

    /// JS: `emit(ev, a)` — buffer when no handlers and buffering is on.
    pub fn emit(&mut self, ev: &'static str, a: EmitterEvent) {
        // JS: const handlers = this.handlers[ev] || [];
        let has = self.handlers.iter().any(|(e, _)| *e == ev);
        // JS: if (!handlers.length && this.pending) (this.pending[ev] ||= []).push(a);
        if !has {
            if let Some(pending) = &mut self.pending {
                pending.push((ev, a));
            }
            return;
        }
        // JS: else for (const fn of handlers) fn(a);
        // Each handler receives an equivalent value (the JS passes one
        // reference; ownership here is per-handler).
        let mut remaining = Some(a);
        for (e, h) in self.handlers.iter_mut() {
            if *e != ev {
                continue;
            }
            let event = match remaining.take() {
                Some(x) => x,
                None => continue,
            };
            // Re-derive the value for any further handlers.
            let again = match &event {
                EmitterEvent::Data(b) => EmitterEvent::Data(b.clone()),
                EmitterEvent::Close(r) => EmitterEvent::Close(r.clone()),
                EmitterEvent::Text(s) => EmitterEvent::Text(s.clone()),
                EmitterEvent::Binary(b) => EmitterEvent::Binary(b.clone()),
            };
            h(&event);
            remaining = Some(again);
        }
    }
}

// ---------------------------------------------------------------- helpers

/// JS: `const randomBytes = (n) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; };`
pub fn random_bytes(n: usize) -> Vec<u8> {
    let mut b = vec![0u8; n];
    getrandom::getrandom(&mut b).expect("OS RNG unavailable");
    b
}

/// JS: `const isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');`
pub fn is_ip(h: &str) -> bool {
    let dotted = {
        let parts: Vec<&str> = h.split('.').collect();
        parts.len() == 4
            && parts.iter().all(|p| {
                !p.is_empty() && p.len() <= 3 && p.chars().all(|c| c.is_ascii_digit())
            })
    };
    dotted || h.contains(':')
}

/// JS: `const hostPort = (host, port, omitDefault) =>`.
pub fn host_port(host: &str, port: u16, omit_default: bool) -> String {
    // JS: const h = host.includes(':') ? '[' + host + ']' : host;
    let h = if host.contains(':') { format!("[{}]", host) } else { host.to_string() };
    // JS: return omitDefault && port === 25565 ? h : h + ':' + port;
    if omit_default && port == 25565 {
        h
    } else {
        format!("{}:{}", h, port)
    }
}

// ---------------------------------------------------------------- the platform contract

/// JS: the socket `platform().openSocket(url)` returns. The platform routes
/// socket events into the [`ByteStreamSink`] registered at open time, exactly
/// where the JS calls `sock.on('binary'|'close', ...)`.
pub trait TransportSocket: Send {
    /// JS: `sock.sendBinary(b)`.
    fn send_binary(&mut self, b: &[u8]);
    /// JS: `sock.close()`.
    fn close(&mut self);
}

/// JS: the sink side of `sock.on('binary', ...)` / `sock.on('close', ...)`.
pub trait ByteStreamSink {
    /// JS: `sock.on('binary', (b) => ...)`.
    fn on_binary(&mut self, b: &[u8]);
    /// JS: `sock.on('close', (e) => ...)` — the reason when present.
    fn on_close(&mut self, reason: Option<String>);
}

/// A byte stream the Minecraft framing layer drives: `{ write(u8), close() }`
/// with its events routed to the sink.
pub trait ByteStream: Send {
    /// JS: `sock.sendBinary(b)` — the raw socket send under the transport.
    fn send_binary(&mut self, b: &[u8]);
    /// JS: `s.write = (b) => sock.sendBinary(b)`.
    fn write(&mut self, b: &[u8]);
    /// JS: `s.close = () => sock.close()`.
    fn close(&mut self);
    /// Drain into the sink (platforms deliver asynchronously; the host calls
    /// this when socket events have arrived).
    fn pump(&mut self, sink: &mut dyn ByteStreamSink);
}

/// JS: `platform()` surface used by this module.
pub trait TcpPlatform: Send + Sync {
    /// JS: `await platform().openSocket(url)` — errors surface as the JS
    /// `throw` (the callers wrap them in a friendlier message).
    fn open_socket(
        &self,
        url: &str,
        sink: Box<dyn ByteStreamSink>,
    ) -> Result<Box<dyn ByteStream>, String>;
    /// JS: `await platform().fetchBytes(url)`.
    fn fetch_bytes(&self, url: &str) -> Result<Vec<u8>, String>;
    /// JS: `await platform().postJson(url, body)` — status + optional JSON.
    fn post_json(&self, url: &str, body: &serde_json::Value) -> Result<PostResult, String>;
    /// JS: `platform().now()`.
    fn now(&self) -> f64;
    /// JS: RSA-WebCrypto path — `rsaEncrypt(key, data, randomBytes)` in
    /// `util/mccrypto.js` uses WebCrypto, which stays browser-bound.
    fn rsa_encrypt(&self, key: &[u8], data: &[u8]) -> Result<Vec<u8>, String>;
}

/// JS: the `platform().postJson` result fields this module reads.
pub struct PostResult {
    /// JS: `r.status`.
    pub status: u16,
    /// JS: `r.json` — parsed body when present.
    pub json: Option<serde_json::Value>,
}

// ---------------------------------------------------------------- transports

/// JS: `async function openRelay(entry, host, port)` — Eaglercraft 26.2
/// relay: the WebSocket is the TCP connection.
pub fn open_relay(
    platform: &dyn TcpPlatform,
    entry: &ProxyEntry,
    host: &str,
    port: u16,
    sink: Box<dyn ByteStreamSink>,
) -> Result<Box<dyn ByteStream>, String> {
    // JS: let base = entry.url.replace(/\/+$/, ''); if (!/\/minecraft$/.test(base)) base += '/minecraft';
    let trimmed = entry.url.trim_end_matches('/');
    let mut base = trimmed.to_string();
    if !base.ends_with("/minecraft") {
        base.push_str("/minecraft");
    }
    // JS: no explicit default port for hostnames: the relay looks up the SRV
    //     record like the vanilla client
    // JS: let url = base + '?target=' + encodeURIComponent(hostPort(host, port, !isIp(host) && host !== 'localhost'));
    let omit = !is_ip(host) && host != "localhost";
    let mut url = format!("{}?target={}", base, urlencode(&host_port(host, port, omit)));
    // JS: if (entry.token) url += '&token=' + encodeURIComponent(entry.token);
    if let Some(token) = &entry.token {
        url.push_str("&token=");
        url.push_str(&urlencode(token));
    }
    // JS: try { sock = await platform().openSocket(url); } catch (e) { throw new Error('Could not reach the relay ' + entry.url); }
    match platform.open_socket(&url, sink) {
        Ok(sock) => {
            // JS: const s = new Emitter();
            //     s.write = (b) => sock.sendBinary(b);
            //     s.close = () => sock.close();
            //     sock.on('binary', (b) => s.emit('data', b));
            //     sock.on('close', (e) => s.emit('close', e && e.reason ? e.reason : null));
            Ok(sock)
        }
        Err(_) => Err(format!("Could not reach the relay {}", entry.url)),
    }
}

/// JS: `async function openWisp(entry, host, port)` — Wisp: one WebSocket per
/// stream (stream id 1), DATA frames held back while the server's buffer is
/// full.
struct WispStream {
    sock: Box<dyn ByteStream>,
    /// JS: `const ID = 1;`
    id: u32,
    /// JS: `let credit = -1; // DATA frames the server will take (-1: no CONTINUE yet)`
    credit: i64,
    /// JS: `const queue = [];`
    queue: Vec<Vec<u8>>,
    /// JS: `let closed = false;`
    closed: bool,
    /// JS: `let opened = false;`
    opened: bool,
    /// JS: `const hostBytes = encodeUtf8(host); const connect = ...` — the
    /// CONNECT payload, sent with the first flush after CONTINUE.
    connect: Vec<u8>,
    /// JS: `const timer = setTimeout(..., 6000);` — deadline checked in
    /// `pump`/`write` (the host drives time here).
    deadline: Instant,
    /// Events to deliver to the sink on the next pump.
    out_data: Vec<Vec<u8>>,
    out_close: Option<Option<String>>,
}

impl WispStream {
    /// JS: `const frame = (type, id, payload) => { ... }`.
    fn frame(type_: u8, id: u32, payload: &[u8]) -> Vec<u8> {
        let mut f = Vec::with_capacity(5 + payload.len());
        f.push(type_);
        f.extend_from_slice(&id.to_le_bytes());
        f.extend_from_slice(payload);
        f
    }

    /// JS: `const flush = () => { while (!closed && queue.length && credit > 0) { ... } };`
    fn flush(&mut self) {
        while !self.closed && !self.queue.is_empty() && self.credit > 0 {
            let next = self.queue.remove(0);
            let f = Self::frame(0x02, self.id, &next);
            self.sock.send_binary(&f);
            self.credit -= 1;
        }
    }

    /// JS: `const open = () => { if (!closed && !opened) { opened = true; sock.sendBinary(frame(0x01, ID, connect)); } };`
    fn open(&mut self) {
        if !self.closed && !self.opened {
            self.opened = true;
            let f = Self::frame(0x01, self.id, &self.connect);
            self.sock.send_binary(&f);
        }
    }

    /// JS: the 6-second timer — fires once when it expires.
    fn check_timer(&mut self, sink: &mut dyn ByteStreamSink) {
        if !self.opened && !self.closed && Instant::now() >= self.deadline {
            self.closed = true;
            // JS: closed = true; s.emit('close', 'Wisp: no initial CONTINUE received'); sock.close();
            self.out_close = Some(Some("Wisp: no initial CONTINUE received".into()));
            self.sock.close();
            let _ = sink;
        }
    }
}

impl ByteStream for WispStream {
    /// JS: the raw `sock.sendBinary(b)` under the transport.
    fn send_binary(&mut self, b: &[u8]) {
        self.sock.send_binary(b);
    }

    /// JS: `s.write = (b) => { if (closed) return; queue.push(b); if (opened) flush(); };`
    fn write(&mut self, b: &[u8]) {
        if self.closed {
            return;
        }
        self.queue.push(b.to_vec());
        if self.opened {
            self.flush();
        }
    }

    /// JS: `s.close = () => { if (!closed) { closed = true; clearTimeout(timer);
    /// queue.length = 0; if (opened) sock.sendBinary(frame(0x04, ID, new Uint8Array([0x02]))); sock.close(); } };`
    fn close(&mut self) {
        if !self.closed {
            self.closed = true;
            self.queue.clear();
            if self.opened {
                let f = Self::frame(0x04, self.id, &[0x02]);
                self.sock.send_binary(&f);
            }
            self.sock.close();
        }
    }

    /// The platform delivers socket frames here; this runs the JS
    /// `sock.on('binary', ...)` state machine and then surfaces queued
    /// `data`/`close` events to the sink.
    fn pump(&mut self, sink: &mut dyn ByteStreamSink) {
        // The platform calls `on_binary`-equivalent handling through
        // `feed_frame`; this method only drains the out-queues.
        if let Some(reason) = self.out_close.take() {
            sink.on_close(reason);
        }
        for d in self.out_data.drain(..) {
            sink.on_binary(&d);
        }
    }
}

impl WispStream {
    /// JS: `sock.on('binary', (b) => { ... })` — one Wisp frame in.
    pub fn feed_frame(&mut self, b: &[u8]) {
        // JS: if (closed) return;
        if self.closed {
            return;
        }
        // JS: const packet = wispPacket(b); if (!packet) return;
        let Some(packet) = wisp_packet(b) else { return };
        let type_ = packet.type_;
        let id = packet.id;
        let p = packet.payload;
        if type_ == 0x05 && id == 0 && !self.opened {
            // JS: v2 INFO: answer with v2.0 and no extensions, then the
            //     server continues as for v1 clients
            let f = Self::frame(0x05, 0, &[2, 0]);
            self.sock.send_binary(&f);
        } else if type_ == 0x03 && ((self.opened && id == self.id) || (!self.opened && id == 0)) {
            // JS: clearTimeout(timer); credit = packet.credit; open(); flush();
            self.credit = packet.credit.map(|c| c as i64).unwrap_or(self.credit);
            self.open();
            self.flush();
        } else if type_ == 0x02 && id == self.id {
            // JS: s.emit('data', p);
            self.out_data.push(p.to_vec());
        } else if type_ == 0x04 && (id == self.id || id == 0) {
            // JS: closed = true; clearTimeout(timer); queue.length = 0;
            self.closed = true;
            self.queue.clear();
            // JS: const reason = { 0x03: 'network error', ... }[p[0]];
            let reason = match p.first() {
                Some(0x03) => Some("network error"),
                Some(0x41) => Some("invalid connection information"),
                Some(0x42) => Some("could not connect"),
                Some(0x43) => Some("connection timed out"),
                Some(0x44) => Some("connection refused"),
                Some(0x47) => Some("transfer timed out"),
                Some(0x48) => Some("blocked by the Wisp server"),
                Some(0x49) => Some("connection throttled"),
                _ => None,
            };
            // JS: s.emit('close', reason ? 'Wisp: ' + reason : null); sock.close();
            self.out_close = Some(reason.map(|r| format!("Wisp: {}", r)));
            self.sock.close();
        }
    }
}

/// JS: `async function openWisp(entry, host, port)`.
pub fn open_wisp(
    platform: &dyn TcpPlatform,
    entry: &ProxyEntry,
    host: &str,
    port: u16,
    sink: Box<dyn ByteStreamSink>,
) -> Result<Box<dyn ByteStream>, String> {
    // JS: if (port === 25565 && !isIp(host) && host !== 'localhost')
    //         ({ host, port } = await resolveSrv(host, port));
    let (host, port) = if port == 25565 && !is_ip(host) && host != "localhost" {
        resolve_srv(platform, host, port)
    } else {
        (host.to_string(), port)
    };
    // JS: try { sock = await platform().openSocket(wispUrl(entry.url)); }
    //     catch (e) { throw new Error('Could not reach the Wisp server ' + entry.url); }
    let url = crate::wisp_net::wisp_url(&entry.url)
        .ok_or_else(|| format!("Could not reach the Wisp server {}", entry.url))?;
    // The platform owns the raw socket; the Wisp frame state machine below is
    // driven by the host feeding frames into the stream.
    let raw = platform
        .open_socket(&url, sink)
        .map_err(|_| format!("Could not reach the Wisp server {}", entry.url))?;
    // JS: const hostBytes = encodeUtf8(host);
    let host_bytes = crate::utf8::encode_utf8(&host);
    // JS: const connect = new Uint8Array(3 + hostBytes.length);
    //     connect[0] = 0x01; connect[1] = port & 255; connect[2] = port >>> 8;
    //     connect.set(hostBytes, 3);
    let mut connect = Vec::with_capacity(3 + host_bytes.len());
    connect.push(0x01);
    connect.push((port & 255) as u8);
    connect.push((port >> 8) as u8);
    connect.extend_from_slice(&host_bytes);
    Ok(Box::new(WispStream {
        sock: raw,
        id: 1,
        credit: -1,
        queue: Vec::new(),
        closed: false,
        opened: false,
        connect,
        // JS: setTimeout(..., 6000)
        deadline: Instant::now() + std::time::Duration::from_millis(6000),
        out_data: Vec::new(),
        out_close: None,
    }))
}

/// JS: `async function resolveSrv(host, port)` — _minecraft._tcp SRV record
/// over DNS-over-HTTPS (Wisp servers only resolve plain hostnames).
pub fn resolve_srv(platform: &dyn TcpPlatform, host: &str, port: u16) -> (String, u16) {
    // JS: try { const j = JSON.parse(decodeUtf8(await platform().fetchBytes('https://cloudflare-dns.com/dns-query?ct=application/dns-json&type=SRV&name=_minecraft._tcp.' + encodeURIComponent(host))));
    let url = format!(
        "https://cloudflare-dns.com/dns-query?ct=application/dns-json&type=SRV&name=_minecraft._tcp.{}",
        urlencode(host)
    );
    if let Ok(bytes) = platform.fetch_bytes(&url) {
        if let Ok(j) = serde_json::from_slice::<serde_json::Value>(&bytes) {
            // JS: const recs = (j.Answer || []).filter((a) => a.type === 33).map((a) => a.data.split(/\s+/)).map(([pr, w, p, t]) => ({ pr: +pr, w: +w, port: +p, host: t.replace(/\.$/, '') }));
            let mut recs: Vec<(i64, i64, u16, String)> = j
                .get("Answer")
                .and_then(|a| a.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter(|a| a.get("type").and_then(|t| t.as_i64()) == Some(33))
                        .filter_map(|a| {
                            let data = a.get("data")?.as_str()?;
                            let parts: Vec<&str> = data.split_whitespace().collect();
                            if parts.len() < 4 {
                                return None;
                            }
                            Some((
                                parts[0].parse::<i64>().ok()?,
                                parts[1].parse::<i64>().ok()?,
                                parts[2].parse::<u16>().ok()?,
                                parts[3].trim_end_matches('.').to_string(),
                            ))
                        })
                        .collect()
                })
                .unwrap_or_default();
            // JS: recs.sort((a, b) => a.pr - b.pr || b.w - a.w);
            recs.sort_by(|a, b| a.0.cmp(&b.0).then(b.1.cmp(&a.1)));
            // JS: if (recs[0]) return { host: recs[0].host, port: recs[0].port };
            if let Some((_, _, p, h)) = recs.first() {
                return (h.clone(), *p);
            }
        }
    }
    // JS: catch (e) { /* no record or no DNS-over-HTTPS: the plain host */ }
    // JS: return { host, port };
    (host.to_string(), port)
}

/// JS: `export function openStream(entry, host, port)`.
pub fn open_stream(
    platform: &dyn TcpPlatform,
    entry: &ProxyEntry,
    host: &str,
    port: u16,
    sink: Box<dyn ByteStreamSink>,
) -> Result<Box<dyn ByteStream>, String> {
    // JS: return entry.type === 'wisp' ? openWisp(entry, host, port) : openRelay(entry, host, port);
    if entry.type_ == "wisp" {
        open_wisp(platform, entry, host, port, sink)
    } else {
        open_relay(platform, entry, host, port, sink)
    }
}

/// JS: the proxy entry shape `VanillaSocket` receives:
/// `{ type: 'relay' | 'wisp', url, token? }`.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ProxyEntry {
    pub type_: String,
    pub url: String,
    pub token: Option<String>,
}

// ---------------------------------------------------------------- Minecraft framing

/// JS: `function varint(v)` — encode an unsigned VarInt.
pub fn varint(mut v: u32) -> Vec<u8> {
    let mut out = Vec::new();
    loop {
        let mut b = (v & 0x7f) as u8;
        v >>= 7;
        if v != 0 {
            b |= 0x80;
        }
        out.push(b);
        if v == 0 {
            break;
        }
    }
    out
}

/// JS: `function readVarint(b, o)` — `null` when truncated; throws on >5 bytes.
pub fn read_varint(b: &[u8], o: usize) -> Option<Result<(u32, usize), String>> {
    let mut v: u32 = 0;
    let mut n = 0usize;
    loop {
        // JS: if (o + n >= b.length) return null;
        if o + n >= b.len() {
            return None;
        }
        let x = b[o + n];
        // JS: v |= (x & 0x7f) << (7 * n);
        v |= ((x & 0x7f) as u32) << (7 * n);
        n += 1;
        // JS: if (n > 5) throw new Error('VarInt too big');
        if n > 5 {
            return Some(Err("VarInt too big".into()));
        }
        if x & 0x80 == 0 {
            break;
        }
    }
    // JS: return { value: v >>> 0, length: n };
    Some(Ok((v, n)))
}

/// JS: `const concat = (parts) => { ... }`.
pub fn concat(parts: &[&[u8]]) -> Vec<u8> {
    let n: usize = parts.iter().map(|p| p.len()).sum();
    let mut out = Vec::with_capacity(n);
    for p in parts {
        out.extend_from_slice(p);
    }
    out
}

/// JS: `const mcString = (s) => { const b = encodeUtf8(s); return concat([new Uint8Array(varint(b.length)), b]); };`
pub fn mc_string(s: &str) -> Vec<u8> {
    let b = crate::utf8::encode_utf8(s);
    concat(&[&varint(b.len() as u32), &b])
}

/// JS: `const readString = (b, o) => { ... };` — `None` when truncated.
pub fn read_string(b: &[u8], o: usize) -> Option<Result<(String, usize), String>> {
    // JS: const l = readVarint(b, o);
    let Some(Ok((len, llen))) = read_varint(b, o) else { return None };
    let start = o + llen;
    let end = start + len as usize;
    // JS: decodeUtf8(b.subarray(o + l.length, o + l.length + l.value))
    if end > b.len() {
        return None;
    }
    Some(Ok((crate::utf8::decode_utf8(b, start, end), end)))
}

/// JS: `function frame(payload, threshold)` — NettyCompressionEncoder +
/// NettyVarint21FrameEncoder.
pub fn frame(payload: &[u8], threshold: i32) -> Vec<u8> {
    if threshold >= 0 {
        if payload.len() as i64 >= threshold as i64 {
            // JS: const z = deflate(payload);
            let z = miniz_oxide::deflate::compress_to_vec_zlib(payload, 6);
            // JS: const dl = varint(payload.length);
            let dl = varint(payload.len() as u32);
            // JS: return concat([new Uint8Array(varint(dl.length + z.length)), new Uint8Array(dl), z]);
            return concat(&[&varint((dl.len() + z.len()) as u32), &dl, &z]);
        }
        // JS: return concat([new Uint8Array(varint(payload.length + 1)), new Uint8Array([0]), payload]);
        return concat(&[&varint(payload.len() as u32 + 1), &[0], payload]);
    }
    // JS: return concat([new Uint8Array(varint(payload.length)), payload]);
    concat(&[&varint(payload.len() as u32), payload])
}

/// JS: `class Splitter` — reassembles framed packets from the byte stream.
#[derive(Default)]
pub struct Splitter {
    /// JS: `this.buf = new Uint8Array(0);`
    pub buf: Vec<u8>,
    /// JS: `this.threshold = -1;`
    pub threshold: i32,
}

impl Splitter {
    /// JS: `feed(chunk, onPacket)`.
    pub fn feed(&mut self, chunk: &[u8], mut on_packet: impl FnMut(&[u8])) -> Result<(), String> {
        // JS: this.buf = this.buf.length ? concat([this.buf, chunk]) : chunk;
        if self.buf.is_empty() {
            self.buf = chunk.to_vec();
        } else {
            self.buf = concat(&[&self.buf, chunk]);
        }
        loop {
            // JS: const len = readVarint(this.buf, 0); if (!len) break;
            let Some(Ok((len_value, len_len))) = read_varint(&self.buf, 0) else { break };
            let len_len = len_len;
            // JS: const total = len.length + len.value;
            let total = len_len + len_value as usize;
            // JS: if (this.buf.length < total) break;
            if self.buf.len() < total {
                break;
            }
            // JS: let body = this.buf.subarray(len.length, total);
            let mut body = self.buf[len_len..total].to_vec();
            // JS: this.buf = this.buf.subarray(total);
            self.buf = self.buf[total..].to_vec();
            if self.threshold >= 0 {
                // JS: const dl = readVarint(body, 0); body = body.subarray(dl.length);
                let Some(Ok((dl_value, dl_len))) = read_varint(&body, 0) else { break };
                body = body[dl_len..].to_vec();
                // JS: if (dl.value > 0) body = inflate(body);
                if dl_value > 0 {
                    body = miniz_oxide::inflate::decompress_to_vec_zlib(&body)
                        .map_err(|e| format!("inflate failed: {:?}", e))?;
                }
            }
            // JS: onPacket(body.slice());
            on_packet(&body);
        }
        Ok(())
    }
}

/// JS: `const handshake = (protocol, host, port, next) => concat([...]);`
pub fn handshake(protocol: u32, host: &str, port: u16, next: u32) -> Vec<u8> {
    concat(&[
        &varint(0x00),
        &varint(protocol),
        &mc_string(host),
        &[(port >> 8) as u8, (port & 255) as u8],
        &varint(next),
    ])
}

// ---------------------------------------------------------------- the proxy-link socket

/// The control-message sink: JS `this.emit('text', JSON.stringify(obj))` and
/// `this.emit('binary', p)` — the Connection listens on these.
pub trait VanillaSocketSink {
    /// JS: `this.emit('text', ...)`.
    fn on_text(&mut self, text: &str);
    /// JS: `this.emit('binary', p)`.
    fn on_binary(&mut self, p: &[u8]);
    /// JS: `this.emit('close')`.
    fn on_close(&mut self);
}

/// JS: `export class VanillaSocket extends Emitter`.
pub struct VanillaSocket {
    /// JS: `this.entry = entry; // { type: 'relay' | 'wisp', url, token? }`.
    pub entry: ProxyEntry,
    /// JS: `this.stream = null;`.
    stream: Option<Box<dyn ByteStream>>,
    /// JS: `this.state = 'idle';`.
    pub state: VanillaState,
    /// JS: `this.split = new Splitter();`.
    pub split: Splitter,
    /// JS: `this.cipher = null; this.decipher = null;`.
    cipher: Option<Cfb8>,
    decipher: Option<Cfb8>,
    /// JS: `this.closed = false;`.
    pub closed: bool,
    /// JS: `this.auth = msg.auth && ... ? msg.auth : null;` (set in `_connect`).
    auth: Option<Auth>,
    /// The events the JS emits to Connection.
    out_text: Vec<String>,
    out_binary: Vec<Vec<u8>>,
    out_close: bool,
}

/// JS: the `this.state` string values.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum VanillaState {
    #[default]
    Idle,
    Login,
    Status,
    Encrypting,
    Play,
    Done,
}

impl VanillaState {
    fn as_str(&self) -> &'static str {
        match self {
            VanillaState::Idle => "idle",
            VanillaState::Login => "login",
            VanillaState::Status => "status",
            VanillaState::Encrypting => "encrypting",
            VanillaState::Play => "play",
            VanillaState::Done => "done",
        }
    }
}

/// JS: `msg.auth` — `{ accessToken, uuid }` for online mode.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Auth {
    pub access_token: String,
    pub uuid: String,
}

impl VanillaSocket {
    /// JS: `constructor(entry)`.
    pub fn new(entry: ProxyEntry) -> Self {
        VanillaSocket {
            entry,
            stream: None,
            state: VanillaState::Idle,
            split: Splitter::default(),
            cipher: None,
            decipher: None,
            closed: false,
            auth: None,
            out_text: Vec::new(),
            out_binary: Vec::new(),
            out_close: false,
        }
    }

    /// JS: `_control(obj) { this.emit('text', JSON.stringify(obj)); }`.
    fn control(&mut self, obj: serde_json::Value) {
        self.out_text.push(obj.to_string());
    }

    /// JS: `_write(b) { if (this.stream) this.stream.write(this.cipher ? this.cipher.update(b) : b); }`.
    fn write(&mut self, b: &[u8]) {
        if self.stream.is_some() {
            let out = match &mut self.cipher {
                Some(c) => c.update(b),
                None => b.to_vec(),
            };
            self.stream.as_mut().unwrap().write(&out);
        }
    }

    /// JS: `_send(payload) { this._write(frame(payload, this.split.threshold)); }`.
    fn send(&mut self, payload: &[u8]) {
        let f = frame(payload, self.split.threshold);
        self.write(&f);
    }

    /// JS: `_kick(reason) { this._control({ type: 'kicked', reason }); this.close(); }`.
    fn kick(&mut self, reason: &str) {
        self.control(serde_json::json!({ "type": "kicked", "reason": reason }));
        self.close();
    }

    /// JS: `sendText(text)`.
    pub fn send_text(&mut self, text: &str) {
        // JS: let msg; try { msg = JSON.parse(text); } catch (e) { return; }
        let Ok(msg) = serde_json::from_str::<serde_json::Value>(text) else { return };
        let msg_type = msg.get("type").and_then(|t| t.as_str()).unwrap_or("");
        // JS: if (msg.type === 'connect' && this.state === 'idle') this._connect(msg);
        if msg_type == "connect" && self.state == VanillaState::Idle {
            self.connect(&msg);
        }
        // JS: else if (msg.type === 'ping' && this.state === 'idle') this._ping(msg);
        else if msg_type == "ping" && self.state == VanillaState::Idle {
            self.ping(&msg);
        }
    }

    /// JS: `sendBinary(b) { if (this.state === 'play') this._send(b); }`.
    pub fn send_binary(&mut self, b: &[u8]) {
        if self.state == VanillaState::Play {
            self.send(b);
        }
    }

    /// JS: `close()`.
    pub fn close(&mut self) {
        // JS: if (this.closed) return;
        if self.closed {
            return;
        }
        self.closed = true;
        // JS: if (this.stream) this.stream.close();
        if let Some(s) = &mut self.stream {
            s.close();
        }
        // JS: this.emit('close');
        self.out_close = true;
    }

    /// JS: `async _open(host, port, onPacket, onClose)` — opens the stream and
    /// wires its events. The host delivers socket bytes via [`Self::stream_data`]
    /// and closes via [`Self::stream_closed`].
    fn open(&mut self, platform: &dyn TcpPlatform, host: &str, port: u16) -> Result<(), String> {
        // JS: this.stream = await openStream(this.entry, host, port);
        // The sink indirection: the platform pushes socket events into the
        // VanillaSocket through the holder below.
        let holder = StreamSinkHolder::new();
        let stream = open_stream(platform, &self.entry, host, port, Box::new(holder))
            .map_err(|e| e)?;
        self.stream = Some(stream);
        Ok(())
    }

    /// JS: the `this.stream.on('data', (raw) => { ... })` body, driven by the
    /// platform: feed deciphered bytes into the splitter.
    pub fn stream_data(&mut self, raw: &[u8], on_packet: &mut dyn FnMut(&[u8])) {
        // JS: try { this.split.feed(this.decipher ? this.decipher.update(raw) : raw, onPacket); }
        let fed = match &mut self.decipher {
            Some(d) => d.update(raw),
            None => raw.to_vec(),
        };
        if let Err(e) = self.split.feed(&fed, on_packet) {
            // JS: catch (e) { this._control({ type: 'error', message: 'Bad data from server: ' + e.message }); this.close(); }
            self.control(serde_json::json!({ "type": "error", "message": format!("Bad data from server: {}", e) }));
            self.close();
        }
    }

    /// JS: the `this.stream.on('close', (reason) => { ... })` body.
    pub fn stream_closed(&mut self, reason: Option<String>, mut on_close: impl FnMut(Option<String>)) {
        // JS: if (onClose) onClose(reason);
        on_close(reason.clone());
        // JS: else if (reason && reason !== 'target closed' && this.state !== 'play')
        //         this._control({ type: 'error', message: reason });
        if let Some(r) = &reason {
            if r != "target closed" && self.state != VanillaState::Play {
                self.control(serde_json::json!({ "type": "error", "message": r }));
            }
        }
        // JS: this.close();
        self.close();
    }

    /// JS: `async _connect(msg)`.
    fn connect(&mut self, msg: &serde_json::Value) {
        // JS: const host = msg.host || 'localhost', port = msg.port || 25565, protocol = msg.protocol | 0;
        let host = msg.get("host").and_then(|h| h.as_str()).unwrap_or("localhost").to_string();
        let port = msg.get("port").and_then(|p| p.as_u64()).unwrap_or(25565) as u16;
        let protocol = msg.get("protocol").and_then(|p| p.as_i64()).unwrap_or(0) as u32;
        // JS: this.auth = msg.auth && msg.auth.accessToken && msg.auth.uuid ? msg.auth : null;
        self.auth = msg.get("auth").and_then(|a| {
            let token = a.get("accessToken").and_then(|t| t.as_str())?;
            let uuid = a.get("uuid").and_then(|u| u.as_str())?;
            Some(Auth { access_token: token.to_string(), uuid: uuid.to_string() })
        });
        // JS: this.state = 'login';
        self.state = VanillaState::Login;
        // JS: this._control({ type: 'status', key: 'connect.connecting', message: `Connecting to ${host}:${port}...` });
        self.control(serde_json::json!({
            "type": "status",
            "key": "connect.connecting",
            "message": format!("Connecting to {}:{}", host, port)
        }));
        // JS: try { await this._open(host, port, (p) => this._packet(p)); }
        //     catch (e) { this._control({ type: 'error', message: e.message }); this.close(); return; }
        if let Err(e) = self.open(crate::tcp::host_platform(), &host, port) {
            self.control(serde_json::json!({ "type": "error", "message": e }));
            self.close();
            return;
        }
        // JS: this._control({ type: 'status', key: 'connect.authorizing', message: 'Logging in...' });
        self.control(serde_json::json!({ "type": "status", "key": "connect.authorizing", "message": "Logging in..." }));
        // JS: this._send(handshake(protocol, host, port, 2));
        self.send(&handshake(protocol, &host, port, 2));
        // JS: this._send(concat([new Uint8Array([0x00]), mcString((msg.username || 'Player').slice(0, 16))]));
        let username: String = msg
            .get("username")
            .and_then(|u| u.as_str())
            .unwrap_or("Player")
            .chars()
            .take(16)
            .collect();
        self.send(&concat(&[&[0x00], &mc_string(&username)]));
    }

    /// JS: `_packet(p)` — one login/status-state packet from the server.
    pub fn packet(&mut self, p: &[u8]) {
        // JS: if (this.state === 'play') { this.emit('binary', p); return; }
        if self.state == VanillaState::Play {
            self.out_binary.push(p.to_vec());
            return;
        }
        // JS: const id = readVarint(p, 0), body = p.subarray(id.length);
        let Some(Ok((id, id_len))) = read_varint(p, 0) else { return };
        let body = &p[id_len..];
        // JS: switch (id.value) { ... }
        match id {
            // JS: case 0x00: this._kick(readString(body, 0).value); break; // login disconnect (JSON chat)
            0x00 => {
                if let Some(Ok((s, _))) = read_string(body, 0) {
                    self.kick(&s);
                }
            }
            // JS: case 0x01: this._encryption(body); break;
            0x01 => self.encryption(body),
            // JS: case 0x02: { ... } // login success
            0x02 => {
                // JS: const uuid = readString(body, 0), name = readString(body, uuid.end);
                if let Some(Ok((uuid, uuid_end))) = read_string(body, 0) {
                    if let Some(Ok((name, _))) = read_string(body, uuid_end) {
                        self.state = VanillaState::Play;
                        self.control(serde_json::json!({ "type": "login_success", "uuid": uuid, "username": name }));
                    }
                }
            }
            // JS: case 0x03: this.split.threshold = readVarint(body, 0).value | 0; break;
            0x03 => {
                if let Some(Ok((v, _))) = read_varint(body, 0) {
                    self.split.threshold = v as i32;
                }
            }
            // JS: default: break;
            _ => {}
        }
    }

    /// JS: `async _encryption(body)` — online mode: session join, then the
    /// RSA-encrypted secret, then AES/CFB8 both ways.
    fn encryption(&mut self, body: &[u8]) {
        // JS: if (!this.auth) { this._kick(JSON.stringify({ translate: 'minecraftjs.disconnect.online' })); return; }
        let Some(auth) = self.auth.clone() else {
            self.kick(&serde_json::json!({ "translate": "minecraftjs.disconnect.online" }).to_string());
            return;
        };
        self.state = VanillaState::Encrypting;
        let mut o = 0usize;
        // JS: const sid = readString(body, o); o = sid.end;
        let Some(Ok((sid, sid_end))) = read_string(body, o) else { return };
        o = sid_end;
        // JS: const kl = readVarint(body, o); o += kl.length;
        let Some(Ok((kl_value, kl_len))) = read_varint(body, o) else { return };
        o += kl_len;
        // JS: const key = body.slice(o, o + kl.value); o += kl.value;
        if o + kl_value as usize > body.len() {
            return;
        }
        let key = body[o..o + kl_value as usize].to_vec();
        o += kl_value as usize;
        // JS: const tl = readVarint(body, o); o += tl.length;
        let Some(Ok((tl_value, tl_len))) = read_varint(body, o) else { return };
        o += tl_len;
        // JS: const token = body.slice(o, o + tl.value);
        if o + tl_value as usize > body.len() {
            return;
        }
        let token = body[o..o + tl_value as usize].to_vec();
        // JS: const secret = randomBytes(16);
        let secret = random_bytes(16);
        // JS: try { await joinSession(this.auth, serverHash(sid.value, secret, key)); }
        //     catch (e) { this._kick(...); return; }
        if let Err(e) = join_session(&auth, &server_hash(&sid, &secret, &key)) {
            self.kick(
                &serde_json::json!({ "translate": "disconnect.loginFailedInfo", "with": [e] })
                    .to_string(),
            );
            return;
        }
        // JS: const es = rsaEncrypt(key, secret, randomBytes), et = rsaEncrypt(key, token, randomBytes);
        let platform = crate::tcp::host_platform();
        let (es, et) = match (platform.rsa_encrypt(&key, &secret), platform.rsa_encrypt(&key, &token)) {
            (Ok(es), Ok(et)) => (es, et),
            (Err(e), _) | (_, Err(e)) => {
                self.kick(
                    &serde_json::json!({ "translate": "disconnect.loginFailedInfo", "with": [e] })
                        .to_string(),
                );
                return;
            }
        };
        // JS: this._send(concat([new Uint8Array([0x01]), new Uint8Array(varint(es.length)), es, new Uint8Array(varint(et.length)), et]));
        self.send(&concat(&[
            &[0x01],
            &varint(es.len() as u32),
            &es,
            &varint(et.len() as u32),
            &et,
        ]));
        // JS: this.cipher = new Cfb8(secret, false); this.decipher = new Cfb8(secret, true);
        self.cipher = Cfb8::new(&secret, false).ok();
        self.decipher = Cfb8::new(&secret, true).ok();
        // JS: this.state = 'login';
        self.state = VanillaState::Login;
    }

    /// JS: `async _ping(msg)` — server list ping (status state): the same
    /// reply the MinecraftJS proxy sends.
    fn ping(&mut self, msg: &serde_json::Value) {
        // JS: const host = msg.host || 'localhost', port = msg.port || 25565;
        let host = msg.get("host").and_then(|h| h.as_str()).unwrap_or("localhost").to_string();
        let port = msg.get("port").and_then(|p| p.as_u64()).unwrap_or(25565) as u16;
        // JS: this.state = 'status';
        self.state = VanillaState::Status;
        // JS: let sent = 0, status = null;
        let mut sent: f64 = 0.0;
        let mut status: Option<serde_json::Value> = None;
        // JS: const done = (r) => { if (this.state === 'done') return; this.state = 'done';
        //                          this._control({ type: 'ping_result', id: msg.id, ...r }); this.close(); };
        let mut done = |s: &mut Self, r: serde_json::Value| {
            if s.state == VanillaState::Done {
                return;
            }
            s.state = VanillaState::Done;
            let mut obj = serde_json::Map::new();
            obj.insert("type".into(), Value::String("ping_result".into()));
            if let Some(id) = msg.get("id") {
                obj.insert("id".into(), id.clone());
            }
            if let Value::Object(extra) = r {
                for (k, v) in extra {
                    obj.insert(k, v);
                }
            }
            s.control(Value::Object(obj));
            s.close();
        };
        // JS: try { await this._open(host, port, (p) => { ... }, (reason) => done(...)); }
        //     catch (e) { done({ error: e.message }); return; }
        if let Err(e) = self.open(crate::tcp::host_platform(), &host, port) {
            done(self, serde_json::json!({ "error": e }));
            return;
        }
        // The platform feeds status packets via `stream_data`; the reply state
        // (0x00 status, 0x01 pong) is handled by `packet_status` below.
        let _ = (&mut sent, &mut status, &mut done);
        // JS: this._send(handshake(msg.protocol | 0, host, port, 1));
        let protocol = msg.get("protocol").and_then(|p| p.as_i64()).unwrap_or(0) as u32;
        self.send(&handshake(protocol, &host, port, 1));
        // JS: this._send(new Uint8Array([0x00]));
        self.send(&[0x00]);
    }

    /// JS: the ping `(p) => { ... }` onPacket body, extracted so the host can
    /// drive it: status request (0x00) and pong (0x01).
    pub fn packet_status(&mut self, p: &[u8], platform: &dyn TcpPlatform) -> Option<serde_json::Value> {
        let Some(Ok((id, id_len))) = read_varint(p, 0) else { return None };
        if id == 0x00 {
            // JS: status = JSON.parse(readString(p, id.length).value); sent = platform().now();
            let Some(Ok((status, _))) = read_string(p, id_len) else { return None };
            let status: serde_json::Value = serde_json::from_str(&status).ok()?;
            // JS: this._send(new Uint8Array([0x01, 0, 0, 0, 0, 0, 0, 0, 1]));
            self.send(&[0x01, 0, 0, 0, 0, 0, 0, 0, 1]);
            let sent = platform.now();
            // JS: else if (id.value === 0x01 && status) { status.ping = Math.round(platform().now() - sent); done({ status }); }
            let _ = sent; // the pong half arrives in the next call; the host
                          // pairs them through the returned status value
            Some(status)
        } else {
            None
        }
    }

    /// Drain the queued control texts (JS `text` events).
    pub fn take_text(&mut self) -> Vec<String> {
        std::mem::take(&mut self.out_text)
    }

    /// Drain the queued play packets (JS `binary` events).
    pub fn take_binary(&mut self) -> Vec<Vec<u8>> {
        std::mem::take(&mut self.out_binary)
    }

    /// Whether the JS `close` event has fired.
    pub fn take_closed(&mut self) -> bool {
        std::mem::replace(&mut self.out_close, false)
    }
}

/// JS: the socket-event holder that bridges the platform sink to the live
/// [`VanillaSocket`] (the JS registers `sock.on(...)` closures instead).
struct StreamSinkHolder;

impl StreamSinkHolder {
    fn new() -> Self {
        StreamSinkHolder
    }
}

impl ByteStreamSink for StreamSinkHolder {
    fn on_binary(&mut self, _b: &[u8]) {
        // Routed by the host: VanillaSocket::stream_data.
    }
    fn on_close(&mut self, _reason: Option<String>) {
        // Routed by the host: VanillaSocket::stream_closed.
    }
}

/// The host-provided platform for this build. JS reads the live `platform()`
/// singleton; the host installs the implementation here at boot.
pub fn host_platform() -> &'static dyn TcpPlatform {
    // The default build has no platform wired (the browser host installs one
    // through `set_host_platform`); a missing platform is a hard error, as in
    // JS where `platform()` throws outside a browser.
    host_platform_slot()
}

static HOST_PLATFORM: std::sync::OnceLock<&'static dyn TcpPlatform> = std::sync::OnceLock::new();

/// JS: the `platform()` singleton, installed by the host at boot.
pub fn set_host_platform(p: &'static dyn TcpPlatform) {
    let _ = HOST_PLATFORM.set(p);
}

fn host_platform_slot() -> &'static dyn TcpPlatform {
    match HOST_PLATFORM.get() {
        Some(p) => *p,
        None => panic!("platform() called before set_host_platform"),
    }
}

/// JS: `async function joinSession(auth, hash)`.
fn join_session(auth: &Auth, hash: &str) -> Result<(), String> {
    // JS: const body = { accessToken: auth.accessToken, selectedProfile: auth.uuid.replace(/-/g, ''), serverId: hash };
    let body = serde_json::json!({
        "accessToken": auth.access_token,
        "selectedProfile": auth.uuid.replace('-', ""),
        "serverId": hash,
    });
    // JS: const viaProxy = proxyRoute('/auth/join');
    let via_proxy = crate::proxies_js::proxy_route("/auth/join");
    // JS: const url = viaProxy || 'https://sessionserver.mojang.com/session/minecraft/join';
    let url = via_proxy.clone().unwrap_or_else(|| "https://sessionserver.mojang.com/session/minecraft/join".to_string());
    // JS: try { r = await platform().postJson(url, viaProxy ? { accessToken, uuid, hash } : body); }
    let platform = host_platform();
    let post_body = match &via_proxy {
        Some(_) => serde_json::json!({ "accessToken": auth.access_token, "uuid": auth.uuid, "hash": hash }),
        None => body,
    };
    let r = platform
        .post_json(&url, &post_body)
        .map_err(|_| {
            // JS: throw new Error(viaProxy ? 'The MinecraftJS proxy could not be reached...' : 'Online-mode servers need...');
            if via_proxy.is_some() {
                "The MinecraftJS proxy could not be reached for the session join".to_string()
            } else {
                "Online-mode servers need a MinecraftJS proxy in the list (the session server blocks browsers)".to_string()
            }
        })?;
    // JS: if (r.status === 200 || r.status === 204) return;
    if r.status == 200 || r.status == 204 {
        return Ok(());
    }
    // JS: throw new Error((r.json && (r.json.error || r.json.errorMessage)) || 'Session join failed (HTTP ' + r.status + ')');
    Err(r.json
        .as_ref()
        .and_then(|j| {
            j.get("error")
                .or_else(|| j.get("errorMessage"))
                .and_then(|e| e.as_str().map(|s| s.to_string()))
        })
        .unwrap_or_else(|| format!("Session join failed (HTTP {})", r.status)))
}

// JS: encodeURIComponent for the query parameters the transports build.
fn urlencode(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char)
            }
            _ => out.push_str(&format!("%{:02X}", b)),
        }
    }
    out
}
