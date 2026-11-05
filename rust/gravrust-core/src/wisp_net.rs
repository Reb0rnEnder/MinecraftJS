// Port of `client/js/net/wisp.js`.
//
// Wisp endpoints use a trailing slash; wisp-python otherwise selects wsproxy.

/// JS: `export function wispUrl(value)`.
///
/// Ensures the URL's path ends with `/` (wisp-python otherwise routes to its
/// wsproxy endpoint). `new URL(value)` parsing is reproduced for the
/// scheme://authority/path forms the proxies list holds.
pub fn wisp_url(value: &str) -> Option<String> {
    let (scheme, rest) = value.split_once("://")?;
    let (authority, path) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => (rest, "/"),
    };
    // JS: url.pathname += '/' when it does not already end with one. A query
    // or fragment would not be part of `pathname`; the proxies list carries
    // bare endpoint URLs, so appending before any `?`/`#` keeps them intact.
    let (path_only, suffix) = match path.find(|c| c == '?' || c == '#') {
        Some(i) => (&path[..i], &path[i..]),
        None => (path, ""),
    };
    let path_only = if path_only.ends_with('/') || path_only.is_empty() {
        path_only.to_string()
    } else {
        format!("{}/", path_only)
    };
    // An empty path means the URL had none; `new URL` normalises it to "/".
    let path_only = if path_only.is_empty() { "/".to_string() } else { path_only };
    Some(format!("{}://{}{}{}", scheme, authority, path_only, suffix))
}

/// JS: the `wispPacket(bytes)` return shape — `{ type, id, payload, credit }`
/// with `credit` present only on CONTINUE frames (type 3).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WispPacket<'a> {
    /// JS: `type` — the frame type byte.
    pub type_: u8,
    /// JS: `id` — the stream id (u32 LE at offset 1).
    pub id: u32,
    /// JS: `payload` — everything after the 5-byte header.
    pub payload: &'a [u8],
    /// JS: `credit` — CONTINUE only: the buffer the server can still take.
    pub credit: Option<u32>,
}

/// JS: `export function wispPacket(bytes)`.
///
/// Frame layout: `[type u8][stream id u32 LE][payload]`.
pub fn wisp_packet(bytes: &[u8]) -> Option<WispPacket<'_>> {
    // JS: if (bytes.length < 5) return null;
    if bytes.len() < 5 {
        return None;
    }
    let type_ = bytes[0];
    // JS: const view = new DataView(...); const id = view.getUint32(1, true);
    let id = u32::from_le_bytes([bytes[1], bytes[2], bytes[3], bytes[4]]);
    // JS: length guards per frame type
    if (type_ == 3 && bytes.len() != 9) || (type_ == 4 && bytes.len() != 6) || (type_ == 5 && bytes.len() < 7) {
        return None;
    }
    // JS: credit: type === 3 ? view.getUint32(5, true) : null
    let credit = if type_ == 3 {
        Some(u32::from_le_bytes([bytes[5], bytes[6], bytes[7], bytes[8]]))
    } else {
        None
    };
    Some(WispPacket { type_, id, payload: &bytes[5..], credit })
}
