// Server addresses. Plain "host", "host:port" or "[v6]:port" are vanilla servers reached through a MinecraftJS
// proxy; "ws:" / "wss:" addresses are Eaglercraft servers the browser connects to directly.
//
// A small forgiving parser instead of the browser's URL: user info may come before the scheme as well as after it
// ("user:pass@wss://host" and "wss://user:pass@host"), any number of slashes may follow the scheme
// ("ender:xyz@ws:///example.com:5123/lol"), and the path and query are kept exactly as written.

function decode(s) {
  try { return decodeURIComponent(s); } catch (e) { return s; }
}

function userInfo(s) {
  const i = s.indexOf(':');
  return i < 0 ? { user: decode(s) || null, pass: null } : { user: decode(s.slice(0, i)) || null, pass: decode(s.slice(i + 1)) };
}

// "host", "host:port", "[v6]", "[v6]:port", bare v6 -> { host, port } (port null when absent), or null
function hostPort(s) {
  if (!s) return null;
  if (s[0] === '[') {
    const end = s.indexOf(']');
    if (end < 0) return null;
    const rest = s.slice(end + 1);
    if (rest && !/^:\d+$/.test(rest)) return null;
    return { host: s.slice(1, end), port: rest ? parseInt(rest.slice(1), 10) : null, v6: true };
  }
  const colons = s.split(':').length - 1;
  if (colons > 1) return { host: s, port: null, v6: true }; // bare IPv6 literal
  if (colons === 1) {
    const i = s.indexOf(':');
    const p = s.slice(i + 1);
    if (!/^\d+$/.test(p)) return null;
    return { host: s.slice(0, i), port: parseInt(p, 10), v6: false };
  }
  return { host: s, port: null, v6: false };
}

const validPort = (p) => p === null || (p >= 1 && p <= 65535);

// -> { kind: 'tcp', host, port } | { kind: 'eagler', scheme, host, port, path, user, pass, url } | null
export function parseAddress(text) {
  let t = String(text == null ? '' : text).trim();
  if (!t) return null;
  let user = null, pass = null;

  // user info in front of the scheme
  const pre = t.match(/^([^@/]*)@(wss?:.*)$/i);
  if (pre) { ({ user, pass } = userInfo(pre[1])); t = pre[2]; }

  const m = t.match(/^(wss?):\/*(.*)$/i);
  if (!m) {
    if (pre || /[/@\s]/.test(t)) return null;
    const hp = hostPort(t);
    if (!hp || !hp.host || !validPort(hp.port)) return null;
    return { kind: 'tcp', host: hp.host, port: hp.port || 25565 };
  }

  const scheme = m[1].toLowerCase();
  const rest = m[2];
  const cut = rest.search(/[/?#]/);
  let authority = cut < 0 ? rest : rest.slice(0, cut);
  let path = cut < 0 ? '' : rest.slice(cut);
  if (path && path[0] !== '/') path = '/' + path;
  const at = authority.lastIndexOf('@');
  if (at >= 0) { ({ user, pass } = userInfo(authority.slice(0, at))); authority = authority.slice(at + 1); }
  const hp = hostPort(authority);
  if (!hp || !hp.host || /\s/.test(hp.host) || !validPort(hp.port)) return null;
  const host = hp.host.toLowerCase();
  const url = `${scheme}://${hp.v6 ? '[' + host + ']' : host}${hp.port ? ':' + hp.port : ''}${path || '/'}`;
  return { kind: 'eagler', scheme, host, port: hp.port, path: path || '/', user, pass, url };
}

export const isEaglerAddress = (text) => { const a = parseAddress(text); return !!a && a.kind === 'eagler'; };

// Text for the address field / settings: vanilla servers drop the default port, Eaglercraft addresses stay as typed
export function formatAddress(host, port) {
  if (isEaglerAddress(host)) return host;
  const h = host.includes(':') ? `[${host}]` : host;
  return port && port !== 25565 ? `${h}:${port}` : h;
}

// Proxy addresses: "host[:port][/path]" or an explicit ws(s)/http(s) URL -> WebSocket URL, or null
export function parseProxyUrl(text) {
  let t = String(text == null ? '' : text).trim();
  if (!t) return null;
  const m = t.match(/^(wss?|https?):\/*(.*)$/i);
  let scheme = 'wss';
  if (m) { scheme = { http: 'ws', https: 'wss' }[m[1].toLowerCase()] || m[1].toLowerCase(); t = m[2]; }
  const cut = t.search(/[/?#]/);
  const authority = cut < 0 ? t : t.slice(0, cut);
  let path = cut < 0 ? '/' : t.slice(cut);
  if (path[0] !== '/') path = '/' + path;
  const hp = hostPort(authority);
  if (!hp || !hp.host || /[\s@]/.test(hp.host) || !validPort(hp.port)) return null;
  // Without a scheme, local addresses default to plain ws (no certificate there)
  if (!m && /^(localhost|127\.|10\.|192\.168\.|\[?::1)/i.test(hp.host)) scheme = 'ws';
  return `${scheme}://${hp.v6 ? '[' + hp.host + ']' : hp.host}${hp.port ? ':' + hp.port : ''}${path}`;
}

// ws(s)://host/path -> http(s)://host/path without the trailing slash (base for the proxy's HTTP routes)
export function proxyHttpBase(wsUrl) {
  if (!wsUrl) return null;
  return wsUrl.replace(/^ws(s?):/i, 'http$1:').replace(/\/+$/, '');
}
