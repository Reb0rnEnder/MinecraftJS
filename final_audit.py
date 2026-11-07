#!/usr/bin/env python3
"""Final classification for all 205 tracked client/js files.

Verdict semantics actually applied (per task contract):
  ported+wired      : Rust port exists AND reachable from lib.rs AND actually invoked.
  ported+unwired    : Rust port exists but is NOT reachable/invoked.
  not-ported        : no meaningful Rust port exists.
  browser-glue-exempt: only browser/DOM/WebGL/audio/network glue that port-status.json excludes.

WIRING FACT (proved, see docs/port-audit.md "Wiring evidence"):
  * No tracked JS/HTML/tool imports the wasm-bindgen package (client/js/wasm/ does not exist).
  * `core_version()` - the only #[wasm_bindgen] fn in lib.rs - is referenced nowhere else.
  * `cargo build --target wasm32-unknown-unknown` FAILS: duplicate
    `__wbg_decodedpacket_free_*` symbol from two `#[wasm_bindgen] pub struct DecodedPacket`
    (packets.rs:48 and net/connection.rs:57). No .wasm artifact can be produced.
  => No Rust module is invoked by any shipped consumer. So no row can be `ported+wired`.
"""
import os, re, json, collections

REPO = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)\Gravrust"
SRC = os.path.join(REPO, "rust", "gravrust-core", "src")
WS = r"C:\Users\Nicholas\Documents\Downloads\New folder (5)"

reach = json.load(open(os.path.join(WS, "reach3.json")))
prov = json.load(open(os.path.join(WS, "prov.json")))
realuse = json.load(open(os.path.join(WS, "realuse.json")))
js_to_rs = prov["js_to_rs"]
default_on, gated, orphans = set(reach["default"]), set(reach["gated"]), set(reach["orphans"])

js205 = [l.strip() for l in open(os.path.join(WS, "js205.txt"), encoding="utf-8-sig") if l.strip()]

# ---- browser-glue classification ----
# A file is browser-glue when its whole job is talking to a browser API.
# Decided per-file from its actual JS content, then recorded.
GLUE = {
    "client/js/gfx/webgl2.js": "WebGL2 context wrapper: every operation is a gl.* call",
    "client/js/gfx/webgpu.js": "WebGPU adapter/device/queue wrapper: every operation is a navigator.gpu call",
    "client/js/gfx/device.js": "graphics-device contract shim selected at runtime by the browser",
    "client/js/platform/browser.js": "BrowserPlatform: fetch/IndexedDB/WebSocket/WebAudio/Web Worker host bindings",
    "client/js/platform/clipboard.js": "navigator.clipboard bindings",
    "client/js/net/tcp.js": "raw browser WebSocket transport (no protocol logic)",
    "client/js/net/wisp.js": "browser WebSocket transport for the Wisp multiplexing protocol",
    "client/js/net/eagler.js": "browser WebSocket transport for Eaglercraft servers",
    "client/js/net/eagler-presets.js": "static preset table consumed by the eagler WebSocket transport",
    "client/js/net/proxies.js": "browser socket opening for the selected proxy transport",
    "client/js/render/mesh-worker.js": "Web Worker entry point for the off-thread mesher",
    "client/js/render/mesh-service.js": "Web Worker pool / postMessage plumbing around mesh-worker.js",
    "client/js/debug/text-capture.js": "canvas/DOM text capture for debugging",
    "client/js/debug/capture-network.js": "DOM overlay for the network capture panel",
    "client/js/gui/debug-overlay.js": "DOM debug overlay rendering",
    "client/js/lib/truetype-wasm.js": "embedded C/stb_truetype WebAssembly blob (a wasm module, not JS logic)",
    "client/js/lib/pako.esm.mjs": "vendored pako (third-party zlib port), not Gravrust code",
    "client/js/gui/screens/loading.js": "DOM loading-screen element manipulation",
    "client/js/render/loading-overlay.js": "DOM/GL overlay for the loading indicator",
    "client/js/gui/narrator.js": "speechSynthesis binding",
    "client/js/audio/sound.js": "SoundManager front-end: AudioContext/GainNode/PannerNode calls",
    "client/js/gui/font-providers.js": "WebAssembly TrueType provider + FontFace/DOM font loading",
}

rows = []
for j in js205:
    rss = js_to_rs.get(j, [])
    rs_default = [r for r in rss if r in default_on]
    rs_gated = [r for r in rss if r in gated]
    rs_orphan = [r for r in rss if r in orphans]

    rust_counterpart = "; ".join(sorted(set(rs_default + rs_gated + rs_orphan))[:3]) or "none"
    if rs_default:
        declared = "yes"
    elif rs_gated:
        declared = "no (gated-only)"
    elif rs_orphan:
        declared = "no (orphan-only)"
    else:
        declared = "no"

    if rs_default or rs_gated or rs_orphan:
        # A Rust counterpart exists. None is wired (see WIRING FACT). Distinguish
        # only by whether the port is at least compiled into the default crate.
        verdict = "ported+unwired"
        if rs_default:
            used = [r for r in rs_default if realuse.get(r, {}).get("used_items", 0) > 0]
            ev = (f"Rust port {', '.join(rs_default[:3])} compiled into the default crate "
                  f"(declared in lib.rs); NOT invoked by any shipped consumer - no JS imports the "
                  f"wasm package and the wasm32 build fails (duplicate `__wbg_decodedpacket_free_*`). "
                  f"Intra-crate call sites: {len(used)}/{len(rs_default)} module(s).")
        elif rs_gated:
            ev = (f"Rust port {', '.join(rs_gated[:3])} exists but sits behind "
                  f"#[cfg(feature=\"unsupported\")] (lib.rs L268-437) and that feature does NOT compile "
                  f"(parse errors in atlas.rs:218, book.rs, chat.rs, bee_sound_params.rs) - shadow-compiled only, never built.")
        else:
            ev = (f"Rust port {', '.join(rs_orphan[:3])} exists on disk but is declared nowhere in "
                  f"lib.rs (orphan: never compiled by any build).")
    elif j in GLUE:
        verdict = "browser-glue-exempt"
        ev = "browser glue - " + GLUE[j]
    else:
        verdict = "not-ported"
        ev = ("no Rust file names this JS path and no counterpart .rs exists on disk "
              "(algorithmic surface unported)")

    rows.append({
        "js": j, "rust": rust_counterpart, "declared": declared,
        "verdict": verdict, "evidence": ev,
    })

json.dump(rows, open(os.path.join(WS, "final_rows.json"), "w"), indent=1)
c = collections.Counter(r["verdict"] for r in rows)
print("TOTAL:", len(rows))
for k in ["ported+wired", "ported+unwired", "not-ported", "browser-glue-exempt"]:
    print(f"  {k}: {c.get(k,0)}")
