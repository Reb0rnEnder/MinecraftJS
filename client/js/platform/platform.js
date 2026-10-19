// Platform contract. Game code only talks to the host environment through this interface, so the
// client can be ported by providing another implementation (see browser.js for the reference one).
//
//   width, height                         drawing surface size (pixels)
//   on(event, fn)                         events:
//       'resize'        ()
//       'keydown'       { code, key, repeat, ctrl, shift, alt }      code uses KeyboardEvent.code names
//       'keyup'         { code, key }
//       'char'          string (typed text, including pasted text)
//       'mousedown'     { button, x, y, shift }   button: 0 left, 1 middle, 2 right
//       'mouseup'       { button, x, y, shift }
//       'mousemove'     { x, y, dx, dy }          dx/dy are raw deltas (valid while the pointer is locked)
//       'wheel'         delta (+1 down / -1 up)
//       'blur'          ()
//       'pointerlock'   boolean
//   lockPointer() / unlockPointer() / isPointerLocked()
//   toggleFullscreen() / isFullscreen()
//   setClipboard(text)
//   loadSetting(key) -> string|null, saveSetting(key, string)
//   files: persistent binary store  -> async put(name, bytes), get(name), list(prefix) -> [names], delete(name)
//   pickFiles({ accept, multiple }) -> Promise<[{ name, bytes }]>
//   saveFile(name, bytes, mime)
//   openUrl(url)
//   fetchBytes(path) / fetchText(path) / fetchJson(path)     assets served next to the client
//   postJson(url, body) -> Promise<{ status, json }>        requests to the proxy (e.g. account sign in)
//   probe(url) -> Promise<true>             optional: rejects when an http(s) URL does not answer (reachability only)
//   openSocket(url) -> Promise<Socket>   WebSocket (proxy or Eaglercraft server). Socket: sendText(s), sendBinary(u8), close(), on('text'|'binary'|'close', fn)
//   originSocketUrl() -> url | null       optional: proxy hosting the page, the default proxy
//   embeddedAssets() -> Uint8Array | null optional: asset zip bundled with the client (single-file build)
//   loadConfig() -> Promise<object>       optional: site configuration (config.json: proxies, servers)
//   now() -> ms, requestFrame(fn), vsync (bool, frames follow the display refresh when true)
//   cpuCount                              logical CPU cores (sizes the mesh worker pool)
//   info() -> { runtime, bits, memory: { used, total, max } | null, cpu }   for the debug screen
//   createGraphicsDevice(preference: 'auto'|'webgl2'|'webgpu') -> Promise<Device>   (see gfx/device.js)
//   createAudio() -> Audio | null    Audio: decode(bytes) -> Promise<buffer>, play(buffer, opts { loop, ... }) -> voice { stop(), setVolume(v), setPosition([x,y,z]) },
//                                   setListener(pos, forward, up), resume()
//   createWorker(path, { classic }) -> Worker-like { postMessage(msg, transfer), onmessage } | null   (module script unless classic)
//   setLoading(message, percent) / hideLoading()
//   setTitle(title)
//   launchParams() -> { [key]: string }   optional startup options (connect, user)

let current = null;

export function setPlatform(p) { current = p; }
export function platform() {
  if (!current) throw new Error('Platform not initialised');
  return current;
}
