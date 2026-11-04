// Previous MinecraftJS scheduler retained as a differential and benchmark oracle.
import {platform} from '../../client/js/platform/platform.js';
import {buildSlice,SliceWorld} from '../../client/js/world/slice.js';
import {Mesher} from '../../client/js/render/mesher.js';
export function baselineScheduleMeshes() {
    if(this._meshUploads?.length)this._uploadMeshes();
    const started=platform().now();let posted=0;
    this._updateLod();
    if (!this.dirty.size || this.inFlight.size >= this.maxInFlight) return;
    const camera = this._lodCamera();
    const px = camera[0] / 16, py = camera[1] / 16, pz = camera[2] / 16;
    const rd = this.settings.renderDistance + 1;
    const candidates = [];
    for (const key of this.dirty) {
      if (this.inFlight.has(key)) continue;
      const parts = key.split(',');
      const cx = +parts[0], sy = +parts[1], cz = +parts[2];
      if (Math.abs(cx - Math.floor(px)) > rd || Math.abs(cz - Math.floor(pz)) > rd) continue;
      // Wait for horizontal neighbours so edge faces are culled correctly
      let ready = true;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!this.world.getChunk(cx + dx, cz + dz)) {
          const age = this._chunkWaitStart.get(cx + ',' + cz) || 0;
          if (!age) { this._chunkWaitStart.set(cx + ',' + cz, platform().now()); ready = false; }
          else if (platform().now() - age < 1500) ready = false;
          break;
        }
      }
      if (!ready) continue;
      const dx = cx + 0.5 - px, dy = sy + 0.5 - py, dz = cz + 0.5 - pz;
      candidates.push([dx * dx + dy * dy * 0.5 + dz * dz, key, cx, sy, cz]);
    }
    candidates.sort((a, b) => a[0] - b[0]);
    for (const [, key, cx, sy, cz] of candidates) {
      if (this.inFlight.size >= this.maxInFlight || posted&&platform().now()-started>=2) break;
      this.dirty.delete(key);
      this.inFlight.set(key, platform().now());
      this.meshedChunks.add(cx + ',' + cz);
      const sec = this.world.getChunk(cx, cz).sections[sy];
      if (!sec || sec.nonAir === 0) { this.inFlight.delete(key); this.renderer.removeSection(key); continue; }
      const slice = buildSlice(this.world, cx, sy, cz, this.tileProps, this.settings.biomeBlendRadius ?? 2);
      const token=++this.buildSerial;this.buildTokens.set(key,token);
      this.worker.postMessage({ type: 'build', gen: this.meshGen, token, slice, lod: this._lodFor(cx, cz, sy) }, [slice.states.buffer, slice.light.buffer, slice.biomes.buffer]);
      posted++;
    }
    // Recover from lost builds
    for (const [k, t] of this.inFlight) if (platform().now() - t > 10000) this.inFlight.delete(k);
  }
