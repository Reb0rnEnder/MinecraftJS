import {decodeBase85} from '../util/base85.js';
// Browser implementation of the platform contract (platform.js).
import { WebGL2Device } from '../gfx/webgl2.js';
import { WebGPUDevice } from '../gfx/webgpu.js';
import { SoftwareDevice } from '../gfx/software.js';

const POTATO_PIXELS = 854 * 480; // Super Potato Mode: internal resolution cap

class Emitter {
  constructor() { this.handlers = {}; }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); }
  emit(ev, a) { const h = this.handlers[ev]; if (h) for (const fn of h) fn(a); }
}

// Server-first protocols (Wisp) can send their greeting in the same network turn as open.
// Keep those events until the caller of openSocket has installed its listeners.
class SocketEmitter extends Emitter {
  constructor() { super(); this.pending = {}; }
  on(ev, fn) {
    super.on(ev, fn);
    const pending = this.pending[ev];
    delete this.pending[ev];
    if (pending) for (const value of pending) fn(value);
  }
  emit(ev, value) {
    if (this.handlers[ev]?.length) super.emit(ev, value);
    else (this.pending[ev] ||= []).push(value);
  }
}

// ---------------------------------------------------------------- IndexedDB file store

class IdbFiles {
  // legacyName: database used before the rename; copied over once when the new one is empty
  constructor(dbName, legacyName) {
    const open = (name) => new Promise((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('files');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const all = (db) => new Promise((resolve) => {
      const out = [];
      const req = db.transaction('files', 'readonly').objectStore('files').openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else resolve(out); };
      req.onerror = () => resolve(out);
    });
    this.ready = (async () => {
      const db = await open(dbName);
      if (legacyName) {
        try {
          const existing = await all(db);
          if (!existing.length) {
            const old = await open(legacyName);
            const entries = await all(old);
            old.close();
            if (entries.length) {
              await new Promise((resolve) => {
                const tx = db.transaction('files', 'readwrite');
                for (const [k, v] of entries) tx.objectStore('files').put(v, k);
                tx.oncomplete = resolve; tx.onerror = resolve;
              });
            }
          }
        } catch (e) { /* migration is best effort */ }
      }
      return db;
    })().catch(() => null);
  }
  async _tx(mode, fn) {
    const db = await this.ready;
    if (!db) throw new Error('File storage unavailable');
    return new Promise((resolve, reject) => {
      const tx = db.transaction('files', mode);
      const req = fn(tx.objectStore('files'));
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
    });
  }
  put(name, bytes) { return this._tx('readwrite', (s) => s.put(bytes, name)); }
  async get(name) { const r = await this._tx('readonly', (s) => s.get(name)); return r ? new Uint8Array(r) : null; }
  async list(prefix = '') { const keys = await this._tx('readonly', (s) => s.getAllKeys()); return (keys || []).filter((k) => String(k).startsWith(prefix)); }
  delete(name) { return this._tx('readwrite', (s) => s.delete(name)); }
}

// ---------------------------------------------------------------- WebAudio

class WebAudio {
  constructor() {
    this.ctx = null;
  }
  _ctx() {
    if (!this.ctx) {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }
  resume() { const c = this._ctx(); if (c && c.state === 'suspended') c.resume().catch(() => {}); }
  get running() { return !!this.ctx && this.ctx.state === 'running'; }
  async decode(bytes) {
    const c = this._ctx();
    if (!c) return null;
    const copy = bytes.slice().buffer;
    return c.decodeAudioData(copy);
  }
  // opts: { volume, pitch, pos: [x,y,z] | null, maxDistance, onEnd }
  play(buffer, opts = {}) {
    const c = this._ctx();
    if (!c || !buffer) return null;
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = opts.pitch || 1;
    if (opts.loop) src.loop = true;
    const gain = c.createGain();
    gain.gain.value = opts.volume === undefined ? 1 : opts.volume;
    src.connect(gain);
    let out = gain;
    if (opts.pos) {
      const p = c.createPanner();
      p.panningModel = 'equalpower';
      p.distanceModel = 'linear';
      p.refDistance = 1;
      p.maxDistance = opts.maxDistance || 16;
      p.rolloffFactor = 1;
      if (p.positionX) { p.positionX.value = opts.pos[0]; p.positionY.value = opts.pos[1]; p.positionZ.value = opts.pos[2]; } else p.setPosition(...opts.pos);
      gain.connect(p);
      out = p;
    }
    out.connect(this.master);
    src.start();
    const panner = out !== gain ? out : null;
    const voice = {
      stop: () => { try { src.stop(); } catch (e) { /* already stopped */ } },
      ended: false,
      setVolume: (v) => { gain.gain.value = v; },
      setPitch: (v) => { src.playbackRate.value = v; },
      setPosition: (pos) => { if (!panner) return; if (panner.positionX) { panner.positionX.value = pos[0]; panner.positionY.value = pos[1]; panner.positionZ.value = pos[2]; } else panner.setPosition(...pos); },
    };
    src.onended = () => { voice.ended = true; if (opts.onEnd) opts.onEnd(); };
    return voice;
  }
  setListener(pos, f, up) {
    if (!this.ctx) return;
    const L = this.ctx.listener;
    if (L.positionX) {
      L.positionX.value = pos[0]; L.positionY.value = pos[1]; L.positionZ.value = pos[2];
      L.forwardX.value = f[0]; L.forwardY.value = f[1]; L.forwardZ.value = f[2];
      L.upX.value = up[0]; L.upY.value = up[1]; L.upZ.value = up[2];
    } else { L.setPosition(...pos); L.setOrientation(...f, ...up); }
  }
}

// ---------------------------------------------------------------- platform

export class BrowserPlatform extends Emitter {
  // Used for the initial Touchscreen Mode default; explicit user preferences win.
  get hasTouchscreen() { return (navigator.maxTouchPoints || 0) > 0 || !!globalThis.matchMedia?.('(any-pointer: coarse)').matches; }
  constructor() {
    super();
    this.name = 'browser';
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'game-canvas';
    this.canvas.tabIndex = 0;
    document.body.appendChild(this.canvas);
    this.files = new IdbFiles('minecraftjs', 'minekampf');
    this.audio = null;
    this.locked = false;
    this._resize();
    window.addEventListener('resize', () => { this._resize(); this.emit('resize'); });
    // devicePixelRatio changes (browser zoom, moving to another monitor) without a resize event
    const watchDpr = () => {
      if (!window.matchMedia) return;
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      mq.addEventListener('change', () => { this._resize(); this.emit('resize'); watchDpr(); }, { once: true });
    };
    watchDpr();
    this._bindInput();
  }

  // Runtime details for the debug screen
  info() {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    const m = ua.match(/(Edg|Firefox|Chrome|Safari)\/([\d.]+)/);
    const pm = globalThis.performance && globalThis.performance.memory;
    return {
      runtime: m ? (m[1] === 'Edg' ? 'Edge' : m[1]) + ' ' + m[2].split('.')[0] : 'Browser',
      bits: /x64|Win64|WOW64|x86_64|aarch64|arm64/i.test(ua) ? 64 : 32,
      memory: pm ? { used: pm.usedJSHeapSize, total: pm.totalJSHeapSize, max: pm.jsHeapSizeLimit } : null,
      cpu: (navigator.hardwareConcurrency || '?') + 'x ' + ((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || 'CPU'),
    };
  }

  get cpuCount() { return (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4; }
  get width() { return this.canvas.width; }
  get height() { return this.canvas.height; }

  // re-apply the surface size
  refreshSize() { this._resize(); this.emit('resize'); }

  // Super Potato Mode: render below the display resolution (any graphics API; always on for the CPU rasteriser),
  // the canvas stretched to the window
  setPotato(on) { this.potato = !!on; this.refreshSize(); }

  _resize() {
    // Backing store in device pixels so the pixel art maps 1:1 to screen pixels (a CSS-pixel canvas gets
    // stretched by non-integer factors on scaled displays, doubling random pixel rows/columns)
    const dpr = window.devicePixelRatio || 1;
    this.dpr = dpr;
    const cw = Math.max(1, window.innerWidth), ch = Math.max(1, window.innerHeight);
    let w = Math.max(1, Math.round(cw * dpr)), h = Math.max(1, Math.round(ch * dpr));
    this.canvas.style.width = (w / dpr) + 'px';
    this.canvas.style.height = (h / dpr) + 'px';
    if (this.potato) {
      const s = Math.min(1, Math.sqrt(POTATO_PIXELS / (w * h)));
      w = Math.max(1, Math.round(w * s)); h = Math.max(1, Math.round(h * s));
    }
    this.canvas.style.imageRendering = this.potato ? 'pixelated' : '';
    if (this.device) this.device.resize(w, h); else { this.canvas.width = w; this.canvas.height = h; }
    // canvas pixels per CSS pixel for mouse positions (the software device renders below device resolution)
    this.pxScale = this.canvas.width / cw;
  }

  _bindInput() {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.emit('pointerlock', this.locked);
    });
    window.addEventListener('mousemove', (e) => this.emit('mousemove', { x: e.clientX * (this.pxScale || this.dpr), y: e.clientY * (this.pxScale || this.dpr), dx: e.movementX || 0, dy: e.movementY || 0 }));
    window.addEventListener('mousedown', (e) => { this._userGesture(); this.emit('mousedown', { button: e.button, x: e.clientX * (this.pxScale || this.dpr), y: e.clientY * (this.pxScale || this.dpr), shift: e.shiftKey }); });
    window.addEventListener('mouseup', (e) => this.emit('mouseup', { button: e.button, x: e.clientX * (this.pxScale || this.dpr), y: e.clientY * (this.pxScale || this.dpr), shift: e.shiftKey }));
    window.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY) this.emit('wheel', e.deltaY/(e.deltaMode===0?100:e.deltaMode===1?3:1));
    }, { passive: false });
    window.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      this._userGesture();
      const block = ['Tab', 'F1', 'F2', 'F3', 'F5', 'F11', 'Space', 'Slash', 'Quote', 'Backspace', 'Escape', 'ArrowUp', 'ArrowDown'];
      if (block.includes(e.code) || (e.ctrlKey && ['KeyW', 'KeyS', 'KeyD', 'KeyF', 'KeyB', 'Equal', 'Minus', 'NumpadAdd', 'NumpadSubtract', 'Digit0'].includes(e.code))) e.preventDefault();
      this.emit('keydown', { code: e.code, key: e.key, repeat: e.repeat, ctrl: e.ctrlKey || e.metaKey, shift: e.shiftKey, alt: e.altKey });
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) this.emit('char', e.key);
    });
    window.addEventListener('keyup', (e) => this.emit('keyup', { code: e.code, key: e.key }));
    window.addEventListener('blur', () => this.emit('blur'));
    window.addEventListener('beforeunload', (e) => {
      e.preventDefault();
      e.returnValue = '';
    });
    document.addEventListener('paste', (e) => { const t = e.clipboardData && e.clipboardData.getData('text'); if (t) this.emit('char', t); });
  }

  _userGesture() { if (this.audio) this.audio.resume(); }

  lockPointer() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) {
        p.catch(() => {
          try { const p2 = this.canvas.requestPointerLock(); if (p2 && p2.catch) p2.catch(() => {}); } catch (e) {}
        });
      }
    } catch (e) {
      try { this.canvas.requestPointerLock(); } catch (err) {}
    }
  }
  unlockPointer() { if (document.pointerLockElement) document.exitPointerLock(); }
  isPointerLocked() { return this.locked; }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  isFullscreen() { return !!document.fullscreenElement; }

  setClipboard(text) { if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {}); }

  loadSetting(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  saveSetting(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage disabled */ } }

  pickFiles({ accept = '', multiple = false } = {}) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.multiple = multiple;
      input.onchange = async () => {
        const out = [];
        for (const f of input.files) out.push({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) });
        resolve(out);
      };
      input.click();
    });
  }

  saveFile(name, bytes, mime = 'application/octet-stream') {
    const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
    const a = document.createElement('a');
    a.download = name;
    a.href = url;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  openUrl(url) { window.open(url, '_blank', 'noopener'); }

  async fetchBytes(path) {
    const r = await fetch(path);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  }
  async fetchText(path) { const r = await fetch(path); return r.ok ? r.text() : null; }
  async postJson(path, body) {
    const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
    let json = null;
    try { json = await r.json(); } catch (e) { json = null; }
    return { status: r.status, json };
  }
  // Whether an HTTP(S) URL answers at all (no CORS needed: the opaque response is enough)
  async probe(url) { await fetch(url, { mode: 'no-cors', cache: 'no-store' }); return true; }
  async fetchJson(path) { const r = await fetch(path); if (!r.ok) throw new Error(`Failed to load ${path} (${r.status})`); return r.json(); }

  // WebSocket (a MinecraftJS proxy, or an Eaglercraft server)
  openSocket(url) {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(url); } catch (e) { reject(new Error('Bad address ' + url)); return; }
      ws.binaryType = 'arraybuffer';
      const sock = new SocketEmitter();
      sock.sendText = (s) => { if (ws.readyState === 1) ws.send(s); };
      sock.sendBinary = (b) => { if (ws.readyState === 1) ws.send(b); };
      sock.close = () => ws.close();
      ws.onopen = () => resolve(sock);
      ws.onerror = () => reject(new Error('Could not connect to ' + url));
      ws.onclose = (e) => sock.emit('close', { code: e.code, reason: e.reason });
      ws.onmessage = (e) => {
        if (typeof e.data === 'string') sock.emit('text', e.data);
        else sock.emit('binary', new Uint8Array(e.data));
      };
    });
  }

  // The proxy at the page's own server (the proxy serves the client), or null for file:// pages
  originSocketUrl() {
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return null;
    return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/`;
  }

  // Asset zip embedded by the single-file build (tools/build.js), decoded once
  embeddedAssets() {
    if (this._embedded !== undefined) return this._embedded;
    const el = document.getElementById('minecraftjs-assets');
    this._embedded = null;
    if (el) {
      const text = el.textContent.trim();
      el.remove();
      if(el.dataset.encoding==='base85')this._embedded=decodeBase85(text,Number(el.dataset.bytes));
      else if (Uint8Array.fromBase64) this._embedded = Uint8Array.fromBase64(text);
      else {
        const bin = atob(text);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
        this._embedded = out;
      }
    }
    return this._embedded;
  }

  // Site configuration: defaults embedded by the build, overridden by a config.json next to the page
  async loadConfig() {
    let config = {};
    const el = document.getElementById('minecraftjs-config');
    if (el) { try { config = JSON.parse(el.textContent); } catch (e) { console.warn('Bad embedded config', e); } }
    if (location.protocol === 'http:' || location.protocol === 'https:') {
      try {
        const r = await fetch('config.json', { cache: 'no-cache' });
        if (r.ok) config = { ...config, ...(await r.json()) };
      } catch (e) { console.warn('Could not read config.json:', e.message); }
    }
    return config;
  }

  now() { return performance.now(); }
  // vsync false: run frames as fast as possible (Use VSync: OFF), otherwise follow the display
  requestFrame(fn) {
    if (this.vsync === false) {
      if (!this._mc) { this._mc = new MessageChannel(); this._mcq = []; this._mc.port1.onmessage = () => { const q = this._mcq; this._mcq = []; const t = performance.now(); for (const f of q) f(t); }; }
      this._mcq.push(fn);
      if (this._mcq.length === 1) this._mc.port2.postMessage(0);
      return;
    }
    requestAnimationFrame(fn);
  }

  // preference: 'webgl2' (default), 'webgpu' or 'software'; every failure falls through to the next API, and the CPU
  // software rasteriser is the last resort
  async createGraphicsDevice(preference = 'auto') {
    const order = preference === 'webgpu' ? ['webgpu', 'webgl2', 'software'] : preference === 'software' ? ['software'] : ['webgl2', 'webgpu', 'software'];
    const errors = [];
    for (const [k, api] of order.entries()) {
      if (k > 0) this.replaceSurface();
      try {
        if (api === 'webgpu') this.device = await WebGPUDevice.create(this.canvas);
        else if (api === 'webgl2') this.device = new WebGL2Device(this.canvas);
        else this.device = new SoftwareDevice(this.canvas);
        this.device.graphicsSelection={requested:preference,active:api,errors:[...errors]};
        this._resize();
        return this.device;
      } catch (e) {
        console.warn(api + ' unavailable:', e.message);
        errors.push(api + ': ' + e.message);
      }
    }
    throw new Error('No graphics API could be initialized (' + errors.join('; ') + ')');
  }

  // Changing graphics API needs a fresh canvas (a canvas can only ever have one context type)
  replaceSurface() {
    const old = this.canvas;
    const c = document.createElement('canvas');
    c.id = 'game-canvas';
    c.tabIndex = 0;
    old.replaceWith(c);
    this.canvas = c;
    this.device = null;
    this._resize();
  }

  createAudio() {
    if (!window.AudioContext && !window.webkitAudioContext) return null;
    this.audio = new WebAudio();
    return this.audio;
  }

  createWorker(path, opts = {}) {
    if (typeof Worker === 'undefined') return null;
    try { return new Worker(path, opts.classic ? {} : { type: 'module' }); } catch (e) { return null; }
  }

  setLoading(message, percent) {
    const el = document.getElementById('loading');
    if (!el) return;
    el.style.display = 'flex';
    document.getElementById('loading-text').textContent = message;
    if (percent !== undefined) document.getElementById('loading-bar').style.width = percent + '%';
  }
  hideLoading() { const el = document.getElementById('loading'); if (el) el.style.display = 'none'; }
  setLoadingError(message) {
    const el = document.getElementById('loading');
    if (el) { el.style.display = 'flex'; el.classList.add('error'); }
    const t = document.getElementById('loading-text');
    if (t) t.textContent = message;
  }

  setTitle(t) { document.title = t; }

  // Startup options (from the page URL, e.g. ?connect=host:port&user=Name)
  launchParams() {
    const out = {};
    for (const [k, v] of new URLSearchParams(location.search)) out[k] = v;
    return out;
  }
}
