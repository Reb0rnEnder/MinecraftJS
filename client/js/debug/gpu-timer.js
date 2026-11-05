// Optional WebGL2 timestamps. Poll availability; never wait on the GPU.
export function createGpuTimer(device, enabled = false) {
  const gl = device?.gl, ext = enabled && gl?.getExtension?.('EXT_disjoint_timer_query_webgl2');
  const pending = [], samples = []; let current = null, discarded = 0;
  return {
    begin() {
      if (!ext) return;
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) {
        discarded += pending.length;
        for (const q of pending.splice(0)) gl.deleteQuery(q);
        return;
      }
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const q = pending.shift(), ns = gl.getQueryParameter(q, gl.QUERY_RESULT);
        if (Number.isFinite(ns)) { samples.push(ns / 1e6); if (samples.length > 3600) samples.shift(); }
        gl.deleteQuery(q);
      }
      // Leave an existing application/third-party timer alone; cap unreturned queries.
      if (current || pending.length >= 8 || gl.getQuery(ext.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) return;
      current = gl.createQuery();
      if (current) gl.beginQuery(ext.TIME_ELAPSED_EXT, current);
    },
    end() {
      if (!current) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT); pending.push(current); current = null;
    },
    snapshot() { return {supported: !!ext, requested: enabled, samplesMs: [...samples], pending: pending.length, discarded}; },
    stop() {
      if (current) { gl.endQuery(ext.TIME_ELAPSED_EXT); gl.deleteQuery(current); current = null; }
      for (const q of pending.splice(0)) gl.deleteQuery(q);
    },
  };
}
