#!/usr/bin/env node
// Gravrust Via Server - ViaVersion/ViaRewind proxy via ViaProxy
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const https = require('https');
const net = require('net');
const { WebSocketServer } = require('ws');

const ROOT = path.join(__dirname, '..');
const LIB_DIR = path.join(ROOT, 'lib', 'via');

const VIAPROXY_URL = 'https://github.com/ViaVersion/ViaProxy/releases/download/v3.3.2/ViaProxy-3.3.2.jar';
const VIAPROXY_JAVA8_URL = 'https://github.com/ViaVersion/ViaProxy/releases/download/v3.3.2/ViaProxy-3.3.2%2Bjava8.jar';

class ViaServer {
  constructor(options = {}) {
    this.port = options.port || 25566;
    this.targetHost = options.targetHost || 'localhost';
    this.targetPort = options.targetPort || 25565;
    this.javaPath = options.javaPath || 'java';
    this.javaArgs = options.javaArgs || ['-Xmx512M'];
    this.verbose = options.verbose || false;
    this.wss = null;
    this.javaProcess = null;
    this.running = false;
    this.connections = new Set();
    this.viaVersionJar = null;
  }

  async ensureJars() {
    if (!fs.existsSync(LIB_DIR)) fs.mkdirSync(LIB_DIR, { recursive: true });
    const jars = [
      { name: 'ViaProxy', urls: [VIAPROXY_URL, VIAPROXY_JAVA8_URL].filter(Boolean), file: 'ViaProxy.jar' },
      { name: 'ViaRewind', urls: [], file: 'ViaRewind.jar' },
      { name: 'ViaBackwards', urls: [], file: 'ViaBackwards.jar' }
    ];
    for (const jar of jars) {
      const jarPath = path.join(LIB_DIR, jar.file);
      if (!fs.existsSync(jarPath)) {
        console.log(`Downloading ${jar.name}...`);
        if (jar.urls.length === 0) {
          console.warn(`No download URLs for ${jar.name}. Download manually from CurseForge/Modrinth and place in ${LIB_DIR}`);
        } else {
          for (const url of jar.urls) {
            try { await this.downloadFile(url, jarPath); console.log(`${jar.name} downloaded`); break; }
            catch (err) { console.warn(`Failed ${url}: ${err.message}`); }
          }
        }
      } else { console.log(`${jar.name} exists`); }
    }
    this.viaVersionJar = path.join(LIB_DIR, 'ViaProxy.jar');
  }

  downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      const req = client.get(url, (res) => {
        if ([301, 302].includes(res.statusCode)) return this.downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
        file.on('error', e => { fs.unlink(dest, () => {}); reject(e); });
      });
      req.on('error', reject);
      req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  async start() {
    console.log('Starting Gravrust Via Server...');
    await this.ensureJars();
    this.httpServer = http.createServer((req, res) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, protocol: 'gravrust-via', version: '3.3.2', target: `${this.targetHost}:${this.targetPort}`, connections: this.connections.size, javaRunning: this.javaProcess && !this.javaProcess.killed }));
      } else if (req.url === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>Gravrust Via Server</h1><p>WS: ws://localhost:${this.port}/via</p><p>Target: ${this.targetHost}:${this.targetPort}</p><p>Java: ${this.javaProcess ? 'Running' : 'Stopped'}</p>`);
      } else { res.writeHead(404).end(); }
    });
    this.wss = new (require('ws')).WebSocketServer({ server: this.httpServer, path: '/via' });
    this.wss.on('connection', (ws) => this.handleWS(ws));
    await new Promise((resolve, reject) => { this.httpServer.listen(this.port, '0.0.0.0', resolve).on('error', reject); });
    await this.startJavaProxy();
    this.running = true;
    console.log(`Via Server on port ${this.port}`);
  }

  async startJavaProxy() {
    const jarPath = path.join(LIB_DIR, 'ViaProxy.jar');
    if (!fs.existsSync(jarPath)) { console.warn('ViaProxy JAR not found'); return; }
    const configFile = path.join(ROOT, 'via-proxy-config.yml');
    const configExists = fs.existsSync(configFile);
    const args = ['-jar', 'ViaProxy.jar', configExists ? 'config' : 'cli', configExists ? path.join(ROOT, 'via-proxy-config.yml') : '--help'];
    this.javaProcess = spawn('java', ['-Xmx512M', ...args], { cwd: LIB_DIR, stdio: ['pipe','pipe','pipe'], env: { ...process.env, NODE_ENV: 'production' } });
    this.javaProcess.stdout.on('data', d => { const o = d.toString().trim(); if (this.verbose) console.log(`[ViaProxy] ${o}`); if (o.includes('Listening') || o.includes('Started')) console.log('ViaProxy started'); });
    this.javaProcess.stderr.on('data', d => console.error(`[ViaProxy] ${d.toString().trim()}`));
    this.javaProcess.on('close', (code) => { console.log(`ViaProxy exited ${code}`); if (this.running && code !== 0) setTimeout(() => this.startJavaProxy(), 5000); });
    await new Promise(r => setTimeout(r, 3000));
  }

  handleWS(ws) {
    const id = `${ws._socket.remoteAddress}:${ws._socket.remotePort}`;
    this.connections.add(ws);
    const proxySocket = require('net').connect({ host: '127.0.0.1', port: this.proxyPort }, () => {
      ws.on('message', data => { if (this.javaProcess?.stdin?.writable) this.javaProcess.stdin.write(data); });
      ws.on('close', () => { this.connections.delete(ws); });
    });
    proxySocket.on('data', data => { if (ws.readyState === 1) ws.send(data); });
    proxySocket.on('error', () => ws.close(1011, 'Proxy error'));
    proxySocket.on('close', () => ws.close(1000, 'Proxy closed'));
  }

  async stop() {
    this.running = false;
    for (const ws of this.connections) ws.close(1001);
    if (this.wss) await new Promise(r => this.wss.close(r));
    if (this.httpServer) await new Promise(r => this.httpServer.close(r));
    if (this.javaProcess) this.javaProcess.kill('SIGTERM');
  }
}

async function main() {
  const opts = {}; for (let i=2;i<process.argv.length;i++) { const a=process.argv[i]; if(a==='--port') opts.port=+process.argv[++i]; else if(a==='--target-host') opts.targetHost=process.argv[++i]; else if(a==='--target-port') opts.targetPort=+process.argv[++i]; else if(a==='--help'){console.log('Usage: node via-server.cjs --port 25566 --target-host localhost --target-port 25565');return;} }
  const server = new ViaServer(opts);
  process.on('SIGINT', async () => { await server.stop(); process.exit(0); });
  process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });
  try { await server.start(); } catch(e) { console.error(e); process.exit(1); }
}
main();

module.exports = { ViaServer };
