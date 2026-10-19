// Chunk meshing service. Stateless apart from the model data: every build request carries a world slice
// (world/slice.js), so any number of these can run in parallel workers (see MeshPool).
import { initBlocks } from '../world/blocks.js';
import { initBiomes } from '../world/biomes.js';
import { SliceWorld } from '../world/slice.js';
import { ModelStore } from './models.js';
import { AtlasLookup } from './atlas.js';
import { Mesher } from './mesher.js';
import { platform } from '../platform/platform.js';

export class MeshService {
  constructor(post) {
    this.post = post; // (message, transferList) => void
    this.mesher = null;
    this.pendingOptions = null;
  }

  handle(msg) {
    switch (msg.type) {
      case 'init': {
        initBlocks(msg.blocksJson, msg.shapesJson);
        initBiomes(msg.biomesJson, msg.grass, msg.foliage);
        const store = new ModelStore(msg.models, msg.blockstates, new AtlasLookup(msg.atlas));
        const opts = this.mesher ? this.mesher.options : this.pendingOptions;
        this.mesher = new Mesher(null, store);
        if (opts) Object.assign(this.mesher.options, opts);
        this.post({ type: 'ready' });
        break;
      }
      case 'options':
        if (this.mesher) {
          Object.assign(this.mesher.options, msg.options);
          this.mesher.stateModels.clear();
        } else this.pendingOptions = msg.options;
        break;
      case 'build': {
        if (!this.mesher) break;
        const sl = msg.slice;
        let res = null;
        const t0 = Date.now();
        try { res = this.mesher.buildSection(new SliceWorld(sl), sl.x, sl.y, sl.z); } catch (err) { console.error('mesh error', err); }
        const ms = Date.now() - t0;
        const head = { type: 'built', x: sl.x, y: sl.y, z: sl.z, gen: msg.gen, ms };
        if (!res) { this.post({ ...head, empty: true }); break; }
        this.post({ ...head, ...res }, [res.solid.buffer, res.cutout.buffer, res.translucent.buffer]);
        break;
      }
      default: break;
    }
  }
}

// In-thread stand-in with the same postMessage/onmessage shape as a Worker
export class LocalMeshWorker {
  constructor() {
    this.onmessage = null;
    this.queue = [];
    this.service = new MeshService((m) => { if (this.onmessage) setTimeout(() => this.onmessage({ data: m }), 0); });
  }
  postMessage(msg) {
    // Builds are spread out so they don't block a whole frame
    if (msg.type === 'build') { this.queue.push(msg); if (!this.scheduled) { this.scheduled = true; setTimeout(() => this._drain(), 0); } }
    else this.service.handle(msg);
  }
  _drain() {
    this.scheduled = false;
    const start = Date.now();
    while (this.queue.length && Date.now() - start < 8) this.service.handle(this.queue.shift());
    if (this.queue.length) { this.scheduled = true; setTimeout(() => this._drain(), 0); }
  }
  terminate() {}
}

// Several mesh workers behind one Worker-like interface. Builds go to the least busy worker;
// other messages (init, options) are broadcast. onmessage receives results from all of them.
export class MeshPool {
  // opts.classic: the worker script is a classic (non-module) script
  constructor(url, count, opts = {}) {
    this.onmessage = null;
    this.workers = [];
    const hook = (w) => {
      w.busy = 0;
      w.onmessage = (e) => {
        if (e.data.type === 'built') w.busy--;
        if (this.onmessage) this.onmessage(e);
      };
      this.workers.push(w);
    };
    for (let i = 0; i < count; i++) {
      const w = platform().createWorker(url, opts);
      if (!w) break;
      hook(w);
    }
    if (!this.workers.length) hook(new LocalMeshWorker());
    this.size = this.workers.length;
  }

  postMessage(msg, transfer) {
    if (msg.type === 'build') {
      let best = this.workers[0];
      for (const w of this.workers) if (w.busy < best.busy) best = w;
      best.busy++;
      best.postMessage(msg, transfer);
      return;
    }
    for (const w of this.workers) w.postMessage(msg);
  }

  // Resolves when every worker has answered 'ready' to an init message
  init(msg) {
    let pending = this.workers.length;
    return new Promise((resolve) => {
      const prev = this.onmessage;
      this.onmessage = (e) => {
        if (e.data.type === 'ready') { if (--pending === 0) { this.onmessage = prev; resolve(); } } else if (prev) prev(e);
      };
      for (const w of this.workers) w.postMessage(msg);
    });
  }
}
