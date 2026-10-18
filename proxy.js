// MinecraftJS proxy: serves the web client, bridges WebSocket <-> Minecraft TCP,
// and serves the game's 1.8.9 assets.
const net = require('net');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const dns = require('dns');
const express = require('express');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const { ZipFile } = require('./lib/zip');
const msauth = require('./lib/msauth');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const MC_VERSION = '1.8.9';
const CACHE_DIR = path.join(__dirname, 'cache');

// ---------------------------------------------------------------------------
// Asset discovery
// ---------------------------------------------------------------------------

function minecraftDirs() {
  const dirs = [];
  if (process.env.MC_DIR) dirs.push(process.env.MC_DIR);
  if (process.env.APPDATA) dirs.push(path.join(process.env.APPDATA, '.minecraft'));
  dirs.push(path.join(os.homedir(), '.minecraft'));
  dirs.push(path.join(os.homedir(), 'Library', 'Application Support', 'minecraft'));
  return dirs;
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return fetchBuffer(res.headers.location).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function getVersionJson() {
  for (const dir of minecraftDirs()) {
    const p = path.join(dir, 'versions', MC_VERSION, MC_VERSION + '.json');
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  }
  const cached = path.join(CACHE_DIR, MC_VERSION + '.json');
  if (fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf8'));
  console.log('Downloading version manifest from Mojang...');
  const manifest = JSON.parse(await fetchBuffer('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'));
  const entry = manifest.versions.find((v) => v.id === MC_VERSION);
  const buf = await fetchBuffer(entry.url);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cached, buf);
  return JSON.parse(buf);
}

async function locateJar() {
  if (process.env.MC_JAR && fs.existsSync(process.env.MC_JAR)) return process.env.MC_JAR;
  for (const dir of minecraftDirs()) {
    const p = path.join(dir, 'versions', MC_VERSION, MC_VERSION + '.jar');
    if (fs.existsSync(p)) return p;
  }
  const cached = path.join(CACHE_DIR, MC_VERSION + '.jar');
  if (fs.existsSync(cached)) return cached;
  const vjson = await getVersionJson();
  console.log('Downloading 1.8.9 game assets...');
  const buf = await fetchBuffer(vjson.downloads.client.url);
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(cached, buf);
  return cached;
}

let assetIndex = null; // { objects: { 'minecraft/sounds/...': { hash, size } } }
let assetObjectDirs = [];

async function loadAssetIndex() {
  const vjson = await getVersionJson();
  const id = vjson.assetIndex ? vjson.assetIndex.id : '1.8';
  for (const dir of minecraftDirs()) {
    const p = path.join(dir, 'assets', 'indexes', id + '.json');
    if (fs.existsSync(p)) {
      assetIndex = JSON.parse(fs.readFileSync(p, 'utf8'));
      break;
    }
  }
  if (!assetIndex) {
    const cached = path.join(CACHE_DIR, 'assets-' + id + '.json');
    if (!fs.existsSync(cached)) {
      console.log('Downloading asset index...');
      fs.mkdirSync(CACHE_DIR, { recursive: true });
      fs.writeFileSync(cached, await fetchBuffer(vjson.assetIndex.url));
    }
    assetIndex = JSON.parse(fs.readFileSync(cached, 'utf8'));
  }
  assetObjectDirs = minecraftDirs().map((d) => path.join(d, 'assets', 'objects'));
  assetObjectDirs.push(path.join(CACHE_DIR, 'objects'));
}

async function readAssetObject(name) {
  if (!assetIndex) return null;
  const obj = assetIndex.objects[name];
  if (!obj) return null;
  const sub = obj.hash.slice(0, 2);
  for (const dir of assetObjectDirs) {
    const p = path.join(dir, sub, obj.hash);
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  const buf = await fetchBuffer(`https://resources.download.minecraft.net/${sub}/${obj.hash}`);
  const outDir = path.join(CACHE_DIR, 'objects', sub);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, obj.hash), buf);
  return buf;
}

let jar = null;
const bundleCache = new Map();

function jarJson(name) {
  const b = jar.read(name);
  return b ? JSON.parse(b.toString('utf8')) : null;
}

function buildBundle(kind) {
  if (bundleCache.has(kind)) return bundleCache.get(kind);
  const P = 'assets/minecraft/';
  const out = {};
  if (kind === 'models') {
    out.blockstates = {};
    out.models = {};
    for (const f of jar.list(P + 'blockstates/')) {
      out.blockstates[path.basename(f, '.json')] = jarJson(f);
    }
    for (const f of jar.list(P + 'models/')) {
      if (!f.endsWith('.json')) continue;
      out.models[f.slice((P + 'models/').length, -5)] = jarJson(f);
    }
  } else if (kind === 'textures') {
    // Binary container: u32 headerLength, JSON header { files: [[name, offset, length]], mcmeta }, then raw PNG bytes
    const files = [];
    const blobs = [];
    const mcmeta = {};
    let offset = 0;
    for (const dir of ['blocks', 'items']) {
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
    const gz = zlib.gzipSync(Buffer.concat([len, header, ...blobs]));
    bundleCache.set(kind, gz);
    return gz;
  }
  const json = Buffer.from(JSON.stringify(out));
  const gz = zlib.gzipSync(json);
  bundleCache.set(kind, gz);
  return gz;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

const app = express();
app.use(express.static(path.join(__dirname, 'client')));
app.use('/lib/pako', express.static(path.join(__dirname, 'node_modules', 'pako', 'dist')));

// Microsoft account sign in (device code flow). The browser cannot call these services directly (CORS),
// so the proxy relays them. Tokens are returned to the client, which stores them; the proxy keeps nothing.
const authRoute = (fn) => async (req, res) => {
  try { res.json(await fn(req.body || {})); } catch (e) { res.status(400).json({ error: e.message, code: e.code }); }
};
app.post('/auth/device', express.json(), authRoute(() => msauth.startDeviceCode()));
app.post('/auth/poll', express.json(), authRoute(async (b) => ({ account: await msauth.pollDeviceCode(String(b.deviceCode || '')) })));
app.post('/auth/refresh', express.json(), authRoute(async (b) => ({ account: await msauth.refresh(String(b.refreshToken || '')) })));

app.get('/mc/status', (req, res) => {
  res.json({ assets: !!jar, sounds: !!assetIndex });
});

app.get('/mc/bundle/:kind', (req, res) => {
  if (!jar) return res.status(503).send('Assets not loaded yet');
  try {
    const gz = buildBundle(req.params.kind);
    res.set('Content-Type', req.params.kind === 'textures' ? 'application/octet-stream' : 'application/json');
    res.set('Content-Encoding', 'gzip');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(gz);
  } catch (e) {
    res.status(500).send(String(e));
  }
});

// Any asset file, e.g. /mc/file/textures/gui/widgets.png
app.get(/^\/mc\/file\/(.+)$/, (req, res) => {
  if (!jar) return res.status(503).send('Assets not loaded yet');
  const rel = req.params[0];
  if (rel.includes('..')) return res.status(400).end();
  const buf = jar.read('assets/minecraft/' + rel);
  if (!buf) return res.status(404).end();
  const ext = path.extname(rel);
  res.set('Content-Type', ext === '.png' ? 'image/png' : ext === '.json' || ext === '.mcmeta' ? 'application/json' : 'application/octet-stream');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(buf);
});

// Icon of the built-in "Default" resource pack (pack.png at the root of the game jar)
app.get('/mc/pack.png', (req, res) => {
  if (!jar) return res.status(503).send('Assets not loaded yet');
  const buf = jar.read('pack.png');
  if (!buf) return res.status(404).end();
  res.set('Content-Type', 'image/png');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(buf);
});

// Languages: the list comes from the asset index's pack.mcmeta ("language" section), like vanilla's
// LanguageManager; en_US.lang is in the jar, every other language is an asset index object.
app.get('/mc/languages.json', async (req, res) => {
  try {
    const buf = await readAssetObject('pack.mcmeta');
    const meta = buf ? JSON.parse(buf.toString('utf8')) : {};
    res.json(meta.language || { en_US: { name: 'English', region: 'US', bidirectional: false } });
  } catch (e) { res.status(500).send(String(e.message)); }
});

app.get('/mc/lang/:code', async (req, res) => {
  const code = String(req.params.code).replace(/\.lang$/, '');
  if (!/^[A-Za-z]{2,3}_[A-Za-z]{2}$/.test(code)) return res.status(400).end();
  try {
    let buf = code === 'en_US' && jar ? jar.read('assets/minecraft/lang/en_US.lang') : null;
    if (!buf) buf = await readAssetObject('minecraft/lang/' + code + '.lang');
    if (!buf) return res.status(404).end();
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(buf);
  } catch (e) { res.status(502).send(String(e.message)); }
});

// Sound definitions and sound files from the asset index
app.get('/mc/sounds.json', async (req, res) => {
  try {
    const buf = await readAssetObject('minecraft/sounds.json');
    if (!buf) return res.status(404).end();
    res.set('Content-Type', 'application/json');
    res.send(buf);
  } catch (e) { res.status(500).send(String(e)); }
});

app.get(/^\/mc\/sound\/(.+)$/, async (req, res) => {
  const rel = req.params[0];
  if (rel.includes('..')) return res.status(400).end();
  try {
    const buf = await readAssetObject('minecraft/sounds/' + rel);
    if (!buf) return res.status(404).end();
    res.set('Content-Type', 'audio/ogg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e) { res.status(500).send(String(e)); }
});

// Player skins (only from Mojang's texture CDN)
const skinCache = new Map();
app.get('/skin', async (req, res) => {
  const url = String(req.query.url || '');
  if (!/^https?:\/\/textures\.minecraft\.net\/texture\/[0-9a-f]+$/i.test(url)) return res.status(400).end();
  try {
    let buf = skinCache.get(url);
    if (!buf) { buf = await fetchBuffer(url.replace(/^http:/, 'https:')); skinCache.set(url, buf); }
    res.set('Content-Type', 'image/png');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e) { res.status(502).send(String(e)); }
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
function resolveServer(host, port) {
  return new Promise((resolve) => {
    if (port !== 25565 || net.isIP(host) || host === 'localhost') return resolve({ host, port });
    dns.resolveSrv('_minecraft._tcp.' + host, (err, records) => {
      if (err || !records || !records.length) return resolve({ host, port });
      records.sort((a, b) => a.priority - b.priority || b.weight - a.weight);
      resolve({ host: records[0].name, port: records[0].port });
    });
  });
}

function handshake(host, port, nextState) {
  return Buffer.concat([
    writeVarInt(0x00),
    writeVarInt(47),
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

async function pingServer(host, port) {
  const target = await resolveServer(host, port);
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: target.host, port: target.port });
    const split = new PacketSplitter();
    let pingStart = 0;
    let status = null;
    const timer = setTimeout(() => { sock.destroy(); reject(new Error('Timed out')); }, 5000);
    sock.on('connect', () => {
      sock.write(frame(handshake(target.host, target.port, 1), -1));
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

    if (msg.type === 'ping') {
      try {
        const st = await pingServer(msg.host || 'localhost', msg.port || 25565);
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
      console.log(`[ws] connecting to ${host}:${port} as ${username}${auth ? ' (Microsoft account)' : ''}`);
      sendJson({ type: 'status', key: 'connect.connecting', message: `Connecting to ${host}:${port}...` });

      const target = await resolveServer(host, port);
      mc = net.createConnection({ host: target.host, port: target.port }, () => {
        mc.setNoDelay(true);
        sendJson({ type: 'status', key: 'connect.authorizing', message: 'Logging in...' });
        writeMc(frame(handshake(target.host, target.port, 2), -1));
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
              const ul = readVarInt(body, o); o += ul.length;
              const uuid = body.toString('utf8', o, o + ul.value); o += ul.value;
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
  try {
    const jarPath = await locateJar();
    jar = new ZipFile(jarPath);
    console.log('Game assets loaded');
  } catch (e) {
    console.error('Could not load game assets:', e.message);
    console.error('Set MC_JAR to the location of the 1.8.9 client if it is installed somewhere unusual.');
  }
  try {
    await loadAssetIndex();
    console.log('Sound asset index loaded');
  } catch (e) {
    console.error('Could not load sound asset index (sounds disabled):', e.message);
  }
  server.listen(PORT, () => {
    console.log(`MinecraftJS web client running at http://localhost:${PORT}`);
  });
})();
