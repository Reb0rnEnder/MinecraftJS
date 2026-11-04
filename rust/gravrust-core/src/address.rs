//! Port of `client/js/net/address.js`: forgiving server-address parsing.
//!
//! Plain `host[:port]` / `[v6]:port` addresses go through the Gravrust
//! proxy; `ws(s)://` addresses are Eaglercraft servers. The parser is
//! deliberately more forgiving than the browser URL parser (user info before
//! the scheme, repeated slashes after the scheme, bare IPv6 literals).

use wasm_bindgen::prelude::*;

fn decode_percent(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        if bytes[index] == b'%' {
            if index + 2 >= bytes.len() {
                return value.to_string();
            }
            let hex = |byte: u8| -> Option<u8> {
                match byte {
                    b'0'..=b'9' => Some(byte - b'0'),
                    b'a'..=b'f' => Some(byte - b'a' + 10),
                    b'A'..=b'F' => Some(byte - b'A' + 10),
                    _ => None,
                }
            };
            let (Some(high), Some(low)) = (hex(bytes[index + 1]), hex(bytes[index + 2])) else {
                return value.to_string();
            };
            out.push(high << 4 | low);
            index += 3;
        } else {
            out.push(bytes[index]);
            index += 1;
        }
    }
    String::from_utf8(out).unwrap_or_else(|_| value.to_string())
}

struct UserInfo {
    user: Option<String>,
    pass: Option<String>,
}

fn user_info(value: &str) -> UserInfo {
    match value.find(':') {
        Some(index) => UserInfo {
            user: {
                let user = decode_percent(&value[..index]);
                if user.is_empty() { None } else { Some(user) }
            },
            pass: Some(decode_percent(&value[index + 1..])),
        },
        None => UserInfo {
            user: {
                let user = decode_percent(value);
                if user.is_empty() { None } else { Some(user) }
            },
            pass: None,
        },
    }
}

struct HostPort {
    host: String,
    port: Option<u32>,
    v6: bool,
}

fn digits(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|byte| byte.is_ascii_digit())
}

fn host_port(value: &str) -> Option<HostPort> {
    if value.is_empty() {
        return None;
    }
    if let Some(rest) = value.strip_prefix('[') {
        let end = rest.find(']')?;
        let after = &rest[end + 1..];
        if !after.is_empty() && !(after.starts_with(':') && digits(&after[1..])) {
            return None;
        }
        return Some(HostPort {
            host: rest[..end].to_string(),
            port: if after.is_empty() {
                None
            } else {
                after[1..]
                    .parse::<u64>()
                    .ok()
                    .map(|value| value.min(u32::MAX as u64) as u32)
            },
            v6: true,
        });
    }
    let colons = value.bytes().filter(|byte| *byte == b':').count();
    if colons > 1 {
        return Some(HostPort {
            host: value.to_string(),
            port: None,
            v6: true,
        });
    }
    if colons == 1 {
        let index = value.find(':')?;
        let port = &value[index + 1..];
        if !digits(port) {
            return None;
        }
        return Some(HostPort {
            host: value[..index].to_string(),
            port: port
                .parse::<u64>()
                .ok()
                .map(|value| value.min(u32::MAX as u64) as u32),
            v6: false,
        });
    }
    Some(HostPort {
        host: value.to_string(),
        port: None,
        v6: false,
    })
}

fn valid_port(port: Option<u32>) -> bool {
    match port {
        None => true,
        Some(port) => (1..=65535).contains(&port),
    }
}

fn json_string(out: &mut String, value: &str) {
    out.push('"');
    for c in value.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
}

fn json_option(out: &mut String, value: &Option<String>) {
    match value {
        Some(value) => json_string(out, value),
        None => out.push_str("null"),
    }
}

fn json_port(out: &mut String, value: Option<u32>) {
    match value {
        Some(value) => out.push_str(&value.to_string()),
        None => out.push_str("null"),
    }
}

fn scheme_prefix(text: &str) -> Option<(&'static str, &str)> {
    let lower = text.to_ascii_lowercase();
    let (scheme, rest) = if lower.starts_with("wss:") {
        ("wss", &text[4..])
    } else if lower.starts_with("ws:") {
        ("ws", &text[3..])
    } else {
        return None;
    };
    let rest = rest.trim_start_matches('/');
    Some((scheme, rest))
}

fn parse(text: &str) -> Option<String> {
    let mut text = text.trim();
    if text.is_empty() {
        return None;
    }
    let mut user: Option<String> = None;
    let mut pass: Option<String> = None;

    // user info in front of the scheme
    let mut had_pre = false;
    if let Some(at) = text.find('@') {
        let prefix = &text[..at];
        let rest = &text[at + 1..];
        if !prefix.contains('/') && scheme_prefix(rest).is_some() {
            let info = user_info(prefix);
            user = info.user;
            pass = info.pass;
            text = rest;
            had_pre = true;
        }
    }

    let Some((scheme, rest)) = scheme_prefix(text) else {
        if had_pre || text.chars().any(|c| c == '/' || c == '@' || c.is_whitespace()) {
            return None;
        }
        let host_port = host_port(text)?;
        if host_port.host.is_empty() || !valid_port(host_port.port) {
            return None;
        }
        let mut out = String::from("{\"kind\":\"tcp\",\"host\":");
        json_string(&mut out, &host_port.host);
        out.push_str(",\"port\":");
        json_port(&mut out, Some(host_port.port.unwrap_or(25565)));
        out.push('}');
        return Some(out);
    };

    let cut = rest.find(|c| c == '/' || c == '?' || c == '#');
    let mut authority = match cut {
        Some(index) => &rest[..index],
        None => rest,
    };
    let mut path = match cut {
        Some(index) => rest[index..].to_string(),
        None => String::new(),
    };
    if !path.is_empty() && !path.starts_with('/') {
        path.insert(0, '/');
    }
    if let Some(at) = authority.rfind('@') {
        let info = user_info(&authority[..at]);
        user = info.user;
        pass = info.pass;
        authority = &authority[at + 1..];
    }
    let host_port = host_port(authority)?;
    if host_port.host.is_empty()
        || host_port.host.chars().any(|c| c.is_whitespace())
        || !valid_port(host_port.port)
    {
        return None;
    }
    let host = host_port.host.to_ascii_lowercase();
    let path = if path.is_empty() {
        "/".to_string()
    } else {
        path
    };
    let url = format!(
        "{}://{}{}{}",
        scheme,
        if host_port.v6 {
            format!("[{}]", host)
        } else {
            host.clone()
        },
        host_port
            .port
            .map(|port| format!(":{}", port))
            .unwrap_or_default(),
        path
    );
    let mut out = String::from("{\"kind\":\"eagler\",\"scheme\":");
    json_string(&mut out, scheme);
    out.push_str(",\"host\":");
    json_string(&mut out, &host);
    out.push_str(",\"port\":");
    json_port(&mut out, host_port.port);
    out.push_str(",\"path\":");
    json_string(&mut out, &path);
    out.push_str(",\"user\":");
    json_option(&mut out, &user);
    out.push_str(",\"pass\":");
    json_option(&mut out, &pass);
    out.push_str(",\"url\":");
    json_string(&mut out, &url);
    out.push('}');
    Some(out)
}

#[wasm_bindgen]
pub fn parse_address(text: &str) -> Option<String> {
    parse(text)
}

#[wasm_bindgen]
pub fn is_eagler_address(text: &str) -> bool {
    parse(text)
        .map(|json| json.contains("\"kind\":\"eagler\""))
        .unwrap_or(false)
}

/// `formatAddress(host, port)`.
#[wasm_bindgen]
pub fn format_address(host: &str, port: Option<u32>) -> String {
    if is_eagler_address(host) {
        return host.to_string();
    }
    let display = if host.contains(':') {
        format!("[{}]", host)
    } else {
        host.to_string()
    };
    match port {
        Some(port) if port != 0 && port != 25565 => format!("{}:{}", display, port),
        _ => display,
    }
}

/// `parseProxyUrl`: returns a ws(s) URL, or `None`.
#[wasm_bindgen]
pub fn parse_proxy_url(text: &str) -> Option<String> {
    let mut text = text.trim();
    if text.is_empty() {
        return None;
    }
    let lower = text.to_ascii_lowercase();
    let (scheme, explicit) = if lower.starts_with("wss:") {
        ("wss", true)
    } else if lower.starts_with("ws:") {
        ("ws", true)
    } else if lower.starts_with("https:") {
        ("wss", true)
    } else if lower.starts_with("http:") {
        ("ws", true)
    } else {
        ("wss", false)
    };
    if explicit {
        let colon = text.find(':')?;
        text = &text[colon + 1..];
        text = text.trim_start_matches('/');
    }
    let cut = text.find(|c| c == '/' || c == '?' || c == '#');
    let authority = match cut {
        Some(index) => &text[..index],
        None => text,
    };
    let mut path = match cut {
        Some(index) => text[index..].to_string(),
        None => "/".to_string(),
    };
    if !path.starts_with('/') {
        path.insert(0, '/');
    }
    let host_port = host_port(authority)?;
    if host_port.host.is_empty()
        || host_port.host.chars().any(|c| c.is_whitespace() || c == '@')
        || !valid_port(host_port.port)
    {
        return None;
    }
    let local = {
        let host = host_port.host.to_ascii_lowercase();
        host == "localhost"
            || host.starts_with("127.")
            || host.starts_with("10.")
            || host.starts_with("192.168.")
            || host == "::1"
            || host == "[::1]"
    };
    let scheme = if !explicit && local { "ws" } else { scheme };
    Some(format!(
        "{}://{}{}{}",
        scheme,
        if host_port.v6 {
            format!("[{}]", host_port.host)
        } else {
            host_port.host
        },
        host_port
            .port
            .map(|port| format!(":{}", port))
            .unwrap_or_default(),
        path
    ))
}

/// `proxyHttpBase`: ws(s) URL -> http(s) base without trailing slashes.
#[wasm_bindgen]
pub fn proxy_http_base(url: &str) -> Option<String> {
    if url.is_empty() {
        return None;
    }
    let lower = url.to_ascii_lowercase();
    let replaced = if lower.starts_with("wss:") {
        format!("https:{}", &url[4..])
    } else if lower.starts_with("ws:") {
        format!("http:{}", &url[3..])
    } else {
        url.to_string()
    };
    Some(replaced.trim_end_matches('/').to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tcp_addresses() {
        assert!(parse("example.com").unwrap().contains("\"port\":25565"));
        assert!(parse("example.com:25566").unwrap().contains("\"port\":25566"));
        assert!(parse("[::1]:25565").unwrap().contains("\"host\":\"::1\""));
        assert!(parse("example.com:0").is_none());
        assert!(parse("bad host").is_none());
    }

    #[test]
    fn parses_eagler_addresses_with_user_info() {
        let parsed = parse("ender:xyz@ws:///example.com:5123/lol").expect("address");
        assert!(parsed.contains("\"kind\":\"eagler\""));
        assert!(parsed.contains("\"scheme\":\"ws\""));
        assert!(parsed.contains("\"user\":\"ender\""));
        assert!(parsed.contains("\"pass\":\"xyz\""));
        assert!(parsed.contains("\"url\":\"ws://example.com:5123/lol\""));
    }

    #[test]
    fn formats_proxy_urls_and_bases() {
        assert_eq!(parse_proxy_url("localhost:8080"), Some("ws://localhost:8080/".into()));
        assert_eq!(parse_proxy_url("https://proxy.example/ws"), Some("wss://proxy.example/ws".into()));
        assert_eq!(proxy_http_base("wss://proxy.example/ws/"), Some("https://proxy.example/ws".into()));
        assert_eq!(format_address("example.com", Some(25565)), "example.com");
        assert_eq!(format_address("::1", Some(25566)), "[::1]:25566");
    }
}
