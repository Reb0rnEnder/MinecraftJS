// offline-entry.js — bundled into offlineclient.html by make-offline.mjs.
// The pkg glue + the WASM-as-base64 live in client/js/wasm/pkg (checked in);
// bundling inlines them so the page runs straight from file:// with no fetch()
// and no server.
import init, { core_version, SoftwareDevice } from './client/js/wasm/pkg/gravrust_core.js';
import { wasmBase64 } from './client/js/wasm/pkg/wasm-bytes.js';

(async () => {
  const status = document.getElementById('status');
  try {
    const binary = atob(wasmBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    await init({ module_or_path: bytes });
    const v = core_version();
    document.getElementById('ver').textContent = 'gravrust core v' + v + ' \u2014 running';
    status.textContent = 'WASM kernel initialized (' + (bytes.length / 1024).toFixed(1) + ' KiB).';

    // The software rasteriser is a pure Rust struct taking a pixel size — render
    // one frame to prove the whole pipeline works end to end.
    const w = 320, h = 180;
    const device = new SoftwareDevice(w, h);
    device.resize(w, h);
    device.begin_frame(0, 0, 1);
    const pixels = device.end_frame(); // Uint8Array framebuffer
    status.textContent = 'Software device operational \u2014 frame rendered: ' +
      w + '\u00d7' + h + ', ' + pixels.length + ' bytes of pixels';
    window.__GRAVRUST_OK = { version: v, pixels: pixels.length };
  } catch (e) {
    document.getElementById('ver').textContent = 'gravrust core failed to load';
    status.textContent = String(e);
    window.__GRAVRUST_OK = { error: String(e) };
  }
})();
