// MinecraftJS proxy: serves the web client, bridges WebSocket <-> Minecraft TCP,
// and serves the game's 1.18.2 assets.
const net = require('net');
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const dns = require('dns');
const express = require('express');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const { ZipFile } = require('./lib/zip');
const msauth = require('./lib/msauth');
const mcassets = require('./lib/mcassets');
const {readDefaultAsset,builtAssetsMatch}=require('./lib/asset-layers');
const { extractModels, assertCompleteModels } = require('./lib/modelextract');

const {proxyOptions,resolveTarget,openPack}=require('./lib/proxy-options');
const options=proxyOptions();
if(options.help){console.log('Usage: npm start -- [--proxy-only] [--allow-loopback]\nPROXY_ONLY=1 disables client/assets hosting. Loopback targets are blocked unless ALLOW_LOOPBACK=1.');process.exit(0);}
const PORT = parseInt(process.env.PORT, 10) || 3000;
const CLIENT_DIR = path.join(__dirname, 'client');
const PROXY_VERSION = require('./package.json').version || '';

// ---------------------------------------------------------------------------
// Game assets. A built client/assets/ folder (npm run assets) is served as is; without one the proxy serves the
// same layout straight from the 1.18.2 jar and asset index (see tools/build.js for the layout).
// ---------------------------------------------------------------------------

let jar = null;
let validBuiltAssets=false;
let assetIndex = null; // mcassets.loadAssetIndex(): { objects, read(name) }
const bundleCache = new Map();

function jarJson(name) {
  const b = jar.read(name);
  return b ? JSON.parse(b.toString('utf8')) : null;
}

// bundles/models.json and bundles/textures.bin, gzipped
function buildBundle(kind) {
  if (bundleCache.has(kind)) return bundleCache.get(kind);
  const P = 'assets/minecraft/';
  let raw;
  if (kind === 'models.json') {
    const out = { blockstates: {}, models: {} };
    for (const f of jar.list(P + 'blockstates/')) out.blockstates[path.basename(f, '.json')] = jarJson(f);
    for (const f of jar.list(P + 'models/')) {
      if (f.endsWith('.json')) out.models[f.slice((P + 'models/').length, -5)] = jarJson(f);
    }
    raw = Buffer.from(JSON.stringify(out));
  } else if (kind === 'entity-models.json') {
    // Never cache/serve a partial bundle that will crash later in the render loop.
    const models = assertCompleteModels(extractModels(jar));
    raw = Buffer.from(JSON.stringify(models));
  } else if (kind === 'recipes.json') {
    // recipe ids: the reverse of the jar's entry order (see tools/build.js)
    const list = [];
    for (const f of jar.list('data/minecraft/recipes/')) {
      if (f.endsWith('.json')) list.push({ name: f.slice(('data/minecraft/recipes/').length, -5), ...jarJson(f) });
    }
    raw = Buffer.from(JSON.stringify(list.reverse()));
  } else if (kind === 'textures.bin') {
    // u32 headerLength, JSON header { files: [[name, offset, length]], mcmeta }, then the PNG bytes
    const files = [], blobs = [], mcmeta = {};
    let offset = 0;
    for (const dir of ['block', 'item']) {
      for (const f of jar.list(P + 'textures/' + dir + '/')) {
        const rel = f.slice((P + 'textures/').length);
        if (f.endsWith('.png')) {
          const data = jar.read(f);
          files.push([rel.slice(0, -4), offset, data.length]);
          blobs.push(data);
          offset += data.length;
        } else if (f.endsWith('.mcmeta')) {
          try { mcmeta[rel.slice(0, -11)] = JSON.parse(jar.read(f).toString('utf8')); } catch (e) { /* ignore */ }
        }
      }
    }
    const header = Buffer.from(JSON.stringify({ files, mcmeta }));
    const len = Buffer.alloc(4);
    len.writeUInt32LE(header.length);
    raw = Buffer.concat([len, header, ...blobs]);
  } else return null;
  const gz = zlib.gzipSync(raw);
  bundleCache.set(kind, gz);
  return gz;
}

// pack.mcmeta of the default pack: the asset index's language list plus pack metadata
async function defaultPackMeta() {
  const buf = assetIndex ? await assetIndex.read('pack.mcmeta') : null;
  const meta = buf ? JSON.parse(buf.toString('utf8')) : {};
  meta.pack = { pack_format: 4, description: 'The default look and feel of Minecraft' };
  return Buffer.from(JSON.stringify(meta));
}

const MIME = { '.png': 'image/png', '.json': 'application/json', '.mcmeta': 'application/json', '.ogg': 'audio/ogg', '.lang': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };

// One file of the assets/ layout, or null
async function readAsset(rel) {
  if (rel === 'pack.mcmeta') return defaultPackMeta();
  if (rel === 'pack.png') return jar.read('pack.png');
  if (rel.startsWith('minecraft/')) {
    return readDefaultAsset(jar,assetIndex,rel);
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const app = express();
const serveClient=express.static(CLIENT_DIR);
app.use((req,res,next)=>{if(options.proxyOnly)return next();if(req.path.startsWith('/assets/')&&!validBuiltAssets)return next();return serveClient(req,res,next);});

// Pages on other sites (static hosting, the single-file build) use this proxy for sign in and skins
app.use(['/auth', '/skin', '/profile', '/pack'], (req, res, next) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'content-type, x-minecraft-username, x-minecraft-uuid, x-minecraft-version');
  res.set('Access-Control-Expose-Headers', 'content-length');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// Microsoft account sign in (device code flow). The browser cannot call these services directly (CORS),
// so the proxy relays them. Tokens are returned to the client, which stores them; the proxy keeps nothing.
const authRoute = (fn) => async (req, res) => {
  try { res.json(await fn(req.body || {})); } catch (e) { res.status(400).json({ error: e.message, code: e.code }); }
};
app.post('/auth/device', express.json(), authRoute(() => msauth.startDeviceCode()));
app.post('/auth/poll', express.json(), authRoute(async (b) => ({ account: await msauth.pollDeviceCode(String(b.deviceCode || '')) })));
app.post('/auth/refresh', express.json(), authRoute(async (b) => ({ account: await msauth.refresh(String(b.refreshToken || '')) })));
app.post('/auth/blocklist', express.json(), authRoute(async (b) => ({ blockedProfiles: await msauth.blockedProfiles(b.accessToken) })));
app.post('/auth/privileges', express.json(), authRoute(async (b) => ({ privileges: await msauth.socialPrivileges(b.accessToken) })));
// Session join for online-mode servers reached through a byte relay (Java relay / Wisp): the client does the
// protocol and encryption itself, but sessionserver.mojang.com sends no CORS headers
app.post('/auth/join', express.json(), authRoute(async (b) => {
  await msauth.joinServer(String(b.accessToken || ''), String(b.uuid || ''), String(b.hash || ''));
  return { ok: true };
}));

// assets/ (only reached when client/assets/ was not built)
app.get(/^\/assets\/(.+)$/, async (req, res) => {
  if(options.proxyOnly)return res.status(404).end();
  if (!jar) return res.status(503).send('Assets not loaded yet');
  const rel = req.params[0];
  if (rel.includes('..')) return res.status(400).end();
  try {
    let body;
    if (rel.startsWith('bundles/')) {
      body = buildBundle(rel.slice('bundles/'.length));
      res.set('Content-Encoding', 'gzip');
    } else body = await readAsset(rel);
    if (!body) { res.removeHeader('Content-Encoding'); return res.status(404).end(); }
    res.set('Content-Type', rel === 'bundles/textures.bin' ? 'application/octet-stream' : MIME[path.extname(rel)] || 'application/octet-stream');
    res.set('Cache-Control', 'no-cache');
    res.send(body);
  } catch (e) { res.status(502).send(String(e.message)); }
});

// Player skins (only from Mojang's texture CDN)
const skinCache = new Map();
app.get('/skin', async (req, res) => {
  const url = String(req.query.url || '');
  if (!/^https?:\/\/textures\.minecraft\.net\/texture\/[0-9a-f]+$/i.test(url)) return res.status(400).end();
  try {
    let buf = skinCache.get(url);
    if (!buf) { buf = await mcassets.fetchBuffer(url.replace(/^http:/, 'https:')); skinCache.set(url, buf); }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e) { res.status(502).send(String(e)); }
});

// Server resource packs (ResourcePackRepository.downloadResourcePack): most hosts send no CORS headers, so the proxy
// streams the zip through, with the X-Minecraft-* headers vanilla sends and its 50 MiB limit. Only http(s) URLs to
// public hosts are fetched.
const PACK_LIMIT = 52428800;
app.get('/pack', async (req, res) => {
  let url;
  try { url = new URL(String(req.query.url || '')); } catch (e) { return res.status(400).end(); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return res.status(400).end();
  if (!options.allowLoopback&&/^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1\]?$|\[?f[cd])/i.test(url.hostname)) return res.status(403).end();
  const headers = {};
  for (const h of ['x-minecraft-username', 'x-minecraft-uuid', 'x-minecraft-version']) if (req.get(h)) headers[h] = String(req.get(h)).slice(0, 64);
  const abort = new AbortController();
  res.on('close', () => abort.abort());
  try {
    const up = await openPack(url,headers,options,abort.signal);
    if(up.statusCode<200||up.statusCode>=300){up.resume();return res.status(502).send('HTTP '+up.statusCode);}
    const len = Number(up.headers['content-length']) || 0;
    if (len > PACK_LIMIT) return res.status(413).end();
    res.set('Content-Type', 'application/zip');
    if (len) res.set('Content-Length', String(len));
    let got = 0;
    for await (const chunk of up) {
      got += chunk.length;
      if (got > PACK_LIMIT) { abort.abort(); return res.destroy(); }
      if (!res.write(chunk)) await new Promise((r) => res.once('drain', r));
    }
    res.end();
  } catch (e) { if (!res.headersSent) res.status(502).send(String(e.message || e)); else res.destroy(); }
});

// A player's Mojang profile (its signed textures property), for the local player's skin and cape when a server sends
// none (SkinManager.loadProfileTextures falls back to the session's own profile)
const profileCache = new Map();
app.get('/profile', async (req, res) => {
  const uuid = String(req.query.uuid || '').replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(uuid)) return res.status(400).end();
  try {
    let hit = profileCache.get(uuid);
    if (!hit || hit.at < Date.now() - 60000) {
      const buf = await mcassets.fetchBuffer('https://sessionserver.mojang.com/session/minecraft/profile/' + uuid + '?unsigned=false');
      hit = { at: Date.now(), json: JSON.parse(buf.toString('utf8')) };
      profileCache.set(uuid, hit);
    }
    res.json(hit.json);
  } catch (e) { res.status(502).json({ error: String(e.message || e) }); }
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// ---------------------------------------------------------------------------
// Minecraft framing helpers
// ---------------------------------------------------------------------------

function writeVarInt(value) {
  const buf = [];
  value >>>= 0;
  do {
    let b = value & 0x7f;
    value >>>= 7;
    if (value !== 0) b |= 0x80;
    buf.push(b);
  } while (value !== 0);
  return Buffer.from(buf);
}

function readVarInt(buffer, offset) {
  let value = 0;
  let length = 0;
  let b;
  do {
    if (offset + length >= buffer.length) return null;
    b = buffer[offset + length];
    value |= (b & 0x7f) << (length * 7);
    length++;
    if (length > 5) throw new Error('VarInt too big');
  } while (b & 0x80);
  return { value, length };
}

function mcString(s) {
  const b = Buffer.from(s, 'utf8');
  return Buffer.concat([writeVarInt(b.length), b]);
}

// payload = varint(packetId) + data
function frame(payload, threshold) {
  if (threshold >= 0) {
    if (payload.length >= threshold) {
      const compressed = zlib.deflateSync(payload);
      const dataLength = writeVarInt(payload.length);
      return Buffer.concat([writeVarInt(dataLength.length + compressed.length), dataLength, compressed]);
    }
    return Buffer.concat([writeVarInt(payload.length + 1), Buffer.from([0]), payload]);
  }
  return Buffer.concat([writeVarInt(payload.length), payload]);
}

// Resolve _minecraft._tcp SRV records like the vanilla client does (only for default port + hostnames)
async function resolveServer(host, port) {
  if(typeof host!=='string'||!host||/[\s\0/\\]/.test(host))throw new Error('Invalid target hostname');
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid target port');
  const target=await new Promise((resolve) => {
    if (port !== 25565 || net.isIP(host) || host === 'localhost') return resolve({ host, port });
    dns.resolveSrv('_minecraft._tcp.' + host, (err, records) => {
      if (err || !records || !records.length) return resolve({ host, port });
      records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
      resolve({ host: records[0].name, port: records[0].port });
    });
  });
  return {...await resolveTarget(target.host,target.port,options),serverHost:target.host};
}

// protocol: the client's game protocol (758 = 1.18.2)
function handshake(host, port, nextState, protocol = 758) {
  return Buffer.concat([
    writeVarInt(0x00),
    writeVarInt(protocol),
    mcString(host),
    Buffer.from([(port >> 8) & 0xff, port & 0xff]),
    writeVarInt(nextState),
  ]);
}

// Splits a TCP stream into packets (returns decompressed payloads)
class PacketSplitter {
  constructor() {
    this.buffer = Buffer.alloc(0);
    this.threshold = -1;
  }
  // Calls onPacket for each complete packet; onPacket may change this.threshold,
  // which then applies to the very next packet (Set Compression is often batched with Login Success).
  feed(chunk, onPacket) {
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
    for (;;) {
      const len = readVarInt(this.buffer, 0);
      if (!len) break;
      const total = len.length + len.value;
      if (this.buffer.length < total) break;
      let body = this.buffer.subarray(len.length, total);
      this.buffer = this.buffer.subarray(total);
      if (this.threshold >= 0) {
        const dl = readVarInt(body, 0);
        body = body.subarray(dl.length);
        if (dl.value > 0) body = zlib.inflateSync(body);
      }
      onPacket(Buffer.from(body));
    }
  }
}

// ---------------------------------------------------------------------------
// Server list ping (status)
// ---------------------------------------------------------------------------

async function pingServer(host, port, protocol) {
  const target = await resolveServer(host, port);
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: target.host, port: target.port });
    const split = new PacketSplitter();
    let pingStart = 0;
    let status = null;
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('Timed out')); }, 5000);
    sock.on('connect', () => {
      sock.write(frame(handshake(target.serverHost, target.port, 1, protocol), -1));
      sock.write(frame(writeVarInt(0x00), -1));
    });
    sock.on('data', (chunk) => {
      split.feed(chunk, (p) => {
        const id = readVarInt(p, 0);
        if (id.value === 0x00) {
          const sl = readVarInt(p, id.length);
          status = JSON.parse(p.toString('utf8', id.length + sl.length, id.length + sl.length + sl.value));
          pingStart = Date.now();
          const t = Buffer.alloc(8);
          t.writeBigInt64BE(BigInt(pingStart));
          sock.write(frame(Buffer.concat([writeVarInt(0x01), t]), -1));
        } else if (id.value === 0x01) {
          clearTimeout(timer);
          status.ping = Date.now() - pingStart;
          sock.end();
          resolve(status);
        }
      });
    });
    sock.on('error', (e) => { clearTimeout(timer); reject(e); });
  });
}

// ---------------------------------------------------------------------------
// WebSocket bridge
// Browser -> proxy: text JSON control messages, binary = raw play payload (varint id + data)
// Proxy -> browser: text JSON control messages, binary = raw play payload (decompressed)
// ---------------------------------------------------------------------------

wss.on('connection', (ws) => {
  let mc = null;
  let state = 'handshake';
  const split = new PacketSplitter();
  let cipher = null, decipher = null; // AES-128-CFB8 once an online-mode server enables encryption
  const writeMc = (buf) => { if (mc && mc.writable) mc.write(cipher ? cipher.update(buf) : buf); };

  const sendJson = (obj) => { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); };

  ws.on('message', async (data, isBinary) => {
    if (isBinary) {
      if (mc && state === 'play') writeMc(frame(Buffer.from(data), split.threshold));
      return;
    }
    let msg;
    try { msg = JSON.parse(data.toString()); } catch (e) { return; }

    // Proxy test from the client's Proxy Servers screen
    if (msg.type === 'info') {
      sendJson({ type: 'info', name: 'MinecraftJS proxy', version: PROXY_VERSION, protocols: [758] });
      return;
    }

    if (msg.type === 'ping') {
      try {
        const st = await pingServer(msg.host || 'localhost', msg.port || 25565, msg.protocol | 0 || 758);
        sendJson({ type: 'ping_result', id: msg.id, status: st });
      } catch (e) {
        sendJson({ type: 'ping_result', id: msg.id, error: e.message });
      }
      return;
    }

    if (msg.type === 'connect') {
      const host = msg.host || 'localhost';
      const port = msg.port || 25565;
      const auth = msg.auth && msg.auth.accessToken && msg.auth.uuid ? msg.auth : null;
      const username = (msg.username || 'WebPlayer').slice(0, 16);
      const protocol = msg.protocol | 0 || 758;
      console.log(`[ws] connecting to ${host}:${port} as ${username}${auth ? ' (Microsoft account)' : ''}`);
      sendJson({ type: 'status', key: 'connect.connecting', message: `Connecting to ${host}:${port}...` });

      let target;
      try{target=await resolveServer(host,port);}catch(e){sendJson({type:'error',message:e.message});ws.close();return;}
      if(ws.readyState!==1)return;
      if(mc)mc.destroy();
      mc = net.createConnection({ host: target.host, port: target.port }, () => {
        mc.setNoDelay(true);
        sendJson({ type: 'status', key: 'connect.authorizing', message: 'Logging in...' });
        writeMc(frame(handshake(target.serverHost, target.port, 2, protocol), -1));
        writeMc(frame(Buffer.concat([writeVarInt(0x00), mcString(username)]), -1));
        state = 'login';
      });

      // Online mode: verify with the Mojang session server, answer with the RSA-encrypted secret, then encrypt
      const onEncryptionRequest = async (body) => {
        if (!auth) {
          sendJson({ type: 'kicked', reason: JSON.stringify({ translate: 'minecraftjs.disconnect.online' }) });
          mc.destroy();
          return;
        }
        mc.pause();
        try {
          let o = 0;
          const sl = readVarInt(body, o); o += sl.length;
          const serverId = body.toString('latin1', o, o + sl.value); o += sl.value;
          const kl = readVarInt(body, o); o += kl.length;
          const publicKey = body.subarray(o, o + kl.value); o += kl.value;
          const tl = readVarInt(body, o); o += tl.length;
          const verifyToken = body.subarray(o, o + tl.value);
          const secret = crypto.randomBytes(16);
          sendJson({ type: 'status', key: 'connect.authorizing', message: 'Logging in...' });
          await msauth.joinServer(auth.accessToken, auth.uuid, msauth.serverHash(serverId, secret, publicKey));
          const key = crypto.createPublicKey({ key: publicKey, format: 'der', type: 'spki' });
          const enc = (b) => crypto.publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, b);
          const encSecret = enc(secret), encToken = enc(verifyToken);
          writeMc(frame(Buffer.concat([writeVarInt(0x01), writeVarInt(encSecret.length), encSecret, writeVarInt(encToken.length), encToken]), -1));
          cipher = crypto.createCipheriv('aes-128-cfb8', secret, secret);
          decipher = crypto.createDecipheriv('aes-128-cfb8', secret, secret);
          mc.resume();
        } catch (e) {
          console.log('[ws] online-mode login failed:', e.message);
          sendJson({ type: 'kicked', reason: JSON.stringify({ translate: 'disconnect.loginFailedInfo', with: [e.message] }) });
          mc.destroy();
        }
      };

      mc.on('data', (raw) => {
        const chunk = decipher ? decipher.update(raw) : raw;
        try {
          split.feed(chunk, (p) => {
          if (state === 'login') {
            const id = readVarInt(p, 0);
            const body = p.subarray(id.length);
            if (id.value === 0x00) {
              const l = readVarInt(body, 0);
              const reason = body.toString('utf8', l.length, l.length + l.value);
              sendJson({ type: 'kicked', reason });
            } else if (id.value === 0x01) {
              onEncryptionRequest(Buffer.from(body));
            } else if (id.value === 0x03) {
              split.threshold = readVarInt(body, 0).value;
            } else if (id.value === 0x02) {
              let o = 0;
              let uuid;
              if(protocol>=735){const hex=body.subarray(0,16).toString('hex');if(hex.length!==32)throw Error('Truncated login UUID');uuid=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);o=16;}
              else {const ul=readVarInt(body,o);o+=ul.length;uuid=body.toString('utf8',o,o+ul.value);o+=ul.value;}
              const nl = readVarInt(body, o); o += nl.length;
              const name = body.toString('utf8', o, o + nl.value);
              state = 'play';
              console.log(`[ws] ${name} logged in (${uuid})`);
              sendJson({ type: 'login_success', uuid, username: name });
            }
          } else if (state === 'play') {
            if (ws.readyState === 1) ws.send(p, { binary: true });
          }
          });
        } catch (e) {
          sendJson({ type: 'error', message: 'Bad data from server: ' + e.message });
          mc.destroy();
        }
      });

      mc.on('error', (err) => sendJson({ type: 'error', message: err.message }));
      mc.on('close', () => {
        sendJson({ type: 'disconnected' });
        if (ws.readyState === 1) ws.close();
      });
    }
  });

  ws.on('close', () => { if (mc) mc.destroy(); });
});

// ---------------------------------------------------------------------------

(async () => {
  if(!options.proxyOnly){
  const built = fs.existsSync(path.join(CLIENT_DIR, 'assets', 'pack.mcmeta'));
  try {
    jar = new ZipFile(await mcassets.locateJar());
    console.log(built ? 'Game assets: client/assets/' : 'Game assets loaded (served from the game jar)');
  } catch (e) {
    console.error('Could not load game assets:', e.message);
    console.error('Set MC_JAR to the location of the 1.18.2 client if it is installed somewhere unusual.');
  }
  try {
    assetIndex = await mcassets.loadAssetIndex();
    try {
      const manifest=JSON.parse(fs.readFileSync(path.join(CLIENT_DIR,'assets','asset-manifest.json'),'utf8'));
      const version=await mcassets.getVersionJson();
      validBuiltAssets=builtAssetsMatch(manifest,mcassets.MC_VERSION,crypto.createHash('sha1').update(jar.data).digest('hex'),version.assetIndex.id);
    }catch(e){validBuiltAssets=false;}
    if(built&&!validBuiltAssets)console.log('Ignoring unversioned/stale client/assets; serving native indexed assets instead');
    console.log('Sound asset index loaded');
  } catch (e) {
    console.error('Could not load sound asset index (sounds disabled):', e.message);
  }
  }
  server.listen(PORT, () => {
    console.log(options.proxyOnly?'MinecraftJS proxy-only mode (client/assets hosting disabled)':'MinecraftJS client and proxy');
    console.log('Loopback connections: '+(options.allowLoopback?'allowed':'blocked'));
    console.log(`MinecraftJS server running at http://localhost:${PORT}`);
  });
})();
