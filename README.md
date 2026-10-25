# MinecraftJS

> **1.14.4 development branch:** the browser and proxy now use protocol 498 with native terrain data and independent light updates. Native workstations, trading, lectern controls, bell rendering and scaffolding movement are implemented; jar-derived block properties and visible models for the new mobs are in place; remaining pose, animation and particle parity work is ongoing.
> Follow the [1.14.4 transition plan](docs/transition-1.14.4.md) before publishing a 1.14.4 client.
> The [content milestone](docs/workstations-content-1.14.4.md) records workstation/block support and its limits.
> The [runtime milestone](docs/runtime-1.14.4-milestone.md) records browser join/reconnect validation and remaining work.

A Minecraft 1.14.4 client that runs in the browser (WebGL 2 or WebGPU). It joins vanilla 1.14.4 servers through a
small Node proxy, and Eaglercraft servers directly over WebSockets.

MinecraftJS is not affiliated with Mojang or Microsoft. The repository contains no Mojang files: the game assets
are taken from your own copy of Minecraft 1.14.4, or downloaded from Mojang's servers on first use. That includes the
entity and block entity models (mobs, boats, chests, signs, skulls, beds, ...): in 1.12 they are Java code, so the
build runs the model constructors from the client jar in a small bytecode interpreter (`lib/jvm.js`,
`lib/modelextract.js`) and stores the boxes in `bundles/entity-models.json`.

## Requirements

- Node.js 18 or newer
- `npm install` (installs the proxy's dependencies, plus esbuild and ffmpeg for the build)

## Running with the proxy

```sh
npm install
npm start
```

Then open http://localhost:3000. The proxy serves the client, bridges the browser to Minecraft servers (TCP),
relays Microsoft account sign in and serves player skins.

Game assets are found automatically, in this order:

1. `client/assets/` if you have built it (see below)
2. the 1.14.4 jar from `./1.14.4/`, `MC_JAR`, `MC_DIR`, or your launcher's `.minecraft` folder
3. otherwise a download from Mojang into `cache/`

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP and WebSocket port |
| `MC_JAR` | | path to a `1.14.4.jar` |
| `MC_DIR` | | a `.minecraft` folder to look in |

## Building

### Single-file client

```sh
npm run build
```

Writes `dist/minecraftjs.html`: one file with the code (minified), the game data and all assets, with sounds
re-encoded to Opus. It runs from any web server or straight from disk (`file://`).

Options (after `npm run build --` or with `node tools/build.js html`):

| Option | Meaning |
| --- | --- |
| `--no-music` | leave out music and music discs (a much smaller file) |
| `--no-assets` | embed only the code: the page loads `assets/` and `data/` next to it |
| `--config=file.json` | embed a `config.json` as the page's defaults |
| `--proxy=type,url[,name]` | add a proxy to the embedded config (repeatable, see [config.json](#configjson)) |
| `--server=address[,name]` | add a server to the embedded config (repeatable) |
| `--no-proxies`, `--no-servers` | ignore that list from `--config` before adding `--proxy` / `--server` entries |
| `--out=path` | output file |
| `--audio=opus\|vorbis\|copy` | sound codec (`copy` keeps the original files) |
| `--sfx-kbps=N`, `--music-kbps=N` | bitrates (32 and 48) |

Encoded sounds are cached in `cache/audio/`, so later builds are fast.

### Assets folder (static hosting)

```sh
npm run assets
```

Writes `client/assets/`. The `client/` folder then works on any static web server (nginx, GitHub Pages, ...)
with no proxy, for example `cd client && python3 -m http.server`. Players need a proxy (see below) to join vanilla
servers; Eaglercraft servers work without one.

Don't publish the built files (`dist/`, `client/assets/`) anywhere you are not allowed to share Mojang's assets.

## config.json

A `config.json` next to `index.html` (or embedded in the single-file build) sets the defaults for new players:

```json
{
  "skinProxy": "",
  "proxies": [
    { "name": "This website", "url": "origin", "type": "minecraftjs" },
    { "name": "Eaglercraft Relay", "url": "wss://relay.eaglercraft.net", "type": "relay" },
    { "name": "Public Java Relay", "url": "wss://eagler-minecraft-relay.u2471966200.workers.dev", "type": "relay" }
  ],
  "servers": [
    { "name": "My Server", "address": "mc.example.com" },
    { "name": "My Eaglercraft Server", "address": "wss://eagler.example.com/" }
  ]
}
```

(this is `client/config.example.json`). The `url` `origin` is the server hosting the page (left out when the page
is opened from disk). Without `proxies`, the server hosting the page is used as the proxy. Players can change both
lists in the game; their own lists are kept in the browser.

The build can read a config file, build one from options, or both:

```sh
# embed a file
npm run build -- --config=client/config.example.json
# or construct it on the command line
npm run build -- --proxy=minecraftjs,origin --proxy="relay,wss://relay.eaglercraft.net,Eaglercraft Relay" --server="mc.example.com,My Server"
# the same options with the assets task write client/config.json
npm run assets -- --config=client/config.example.json
# or just write a config.json
node tools/build.js config --config=client/config.example.json --proxy=wisp,wss://wisp.example.com/ --out=client/config.json
```

## Proxy servers

Vanilla servers are reached through a proxy, picked with the **Proxy Servers** button on the title screen (below
the account button): add, edit, delete, test, reorder and select. The edit screen switches an entry between three
types:

| Type | What it is | Who speaks the Minecraft protocol |
| --- | --- | --- |
| MinecraftJS Proxy | `npm start` on any machine (`wss://proxy.example.com/`, `localhost:3000`) | the proxy |
| Java Relay | an [Eaglercraft 26.2 relay](https://radicle.network/nodes/radicle.jarg.io/rad%3Az3rCaaQD1cNmPDTjyinYWmPpcMgNX) (`wss://relay.eaglercraft.net`) | the client |
| Wisp | a [Wisp](https://github.com/MercuryWorkshop/wisp-protocol) server (v1 protocol, which v2 servers also speak) | the client |

Wisp v1 is supported, including `wisp-python`. Select the **Wisp** proxy type and enter its WebSocket endpoint (for example, `ws://localhost:4000/`); endpoint paths are normalized to end in `/`. The client waits for the server’s initial buffer allowance before sending data. For local or LAN Minecraft targets, start wisp-python with `--allow-loopback` or `--allow-private` as appropriate.

Java relays and Wisp servers only carry the TCP stream; the client does the handshake, login, compression and
encryption itself. Public relays usually refuse local or private addresses. Microsoft accounts still need a MinecraftJS
proxy somewhere in the list: it signs accounts in, joins online-mode sessions (Mojang's session server blocks
browsers). Skin/profile downloads can instead use the separate HTTP/CORS template below.

## Skin/CORS proxy

Open **Proxy Servers → Skin Proxy** to choose a separate HTTP proxy for skin,
cape and public profile downloads. You can also set its default in `config.json`:

```json
{ "skinProxy": "https://proxy.example/?url=%R" }
```

For a ready-to-edit configuration, copy `client/config.skin-proxy.example.json` to
`config.json` beside the built HTML and replace `https://proxy.example/?url=%R`
with your service URL. You can also embed it:

```sh
npm run build -- --config=client/config.skin-proxy.example.json
```

Saved player settings take precedence over site defaults. Players who already
saved a skin proxy can update it in **Proxy Servers → Skin Proxy**.
External `config.json` loads when served over HTTP(S); builds opened with `file://`
use their embedded configuration.

`%u` inserts the player UUID without hyphens; `%r` inserts the full raw URL;
`%R` inserts the full percent-encoded URL. `%U` remains an alias for `%r`.
A UUID image service can use `https://skins.example/skin/%u` even when the server
sends no texture property. UUID-only templates apply to skins; cape/profile
requests keep the automatic route so PNG endpoints never receive JSON requests. Leave the field blank to use the automatic MinecraftJS proxy route.
The service should return the original PNG or profile JSON with CORS headers.
This works independently of the game-server relay; sign-in/session authentication
continues to use its existing routes. Saving reloads skins immediately.

## Eaglercraft servers

Server addresses starting with `ws:` or `wss:` are Eaglercraft servers (EaglerXBungee and compatible). The client
connects to them directly. A name and password can be given in the address, before or after the scheme:

```
wss://play.example.com/
ender:password@wss://play.example.com:8081/server
```

## Layout

| Path | Contents |
| --- | --- |
| `proxy.js` | the proxy (HTTP, WebSocket bridge, asset serving) |
| `lib/` | asset discovery (`mcassets.js`), zip and class file reading, the model extractor, Microsoft sign in |
| `tools/build.js` | `npm run build` and `npm run assets` |
| `client/index.html`, `client/js/main.js` | the client's entry point |
| `client/js/platform/` | the only code that talks to the browser (`platform.js` describes the contract) |
| `client/js/net/` | protocol, proxy and Eaglercraft connections, address parsing |
| `client/js/game/`, `render/`, `gui/`, `world/`, `audio/`, `gfx/` | game logic, rendering, screens, world, sound, graphics devices |
| `client/data/` | game data tables (blocks, items, entities, ...) |
