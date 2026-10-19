# MinecraftJS

A Minecraft 1.12.2 client that runs in the browser (WebGL 2 or WebGPU). It joins vanilla 1.12.2 servers through a
small Node proxy, and Eaglercraft servers directly over WebSockets.

MinecraftJS is not affiliated with Mojang or Microsoft. The repository contains no Mojang files: the game assets
are taken from your own copy of Minecraft 1.12.2, or downloaded from Mojang's servers on first use.

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
2. the 1.12.2 jar from `./1.12.2/`, `MC_JAR`, `MC_DIR`, or your launcher's `.minecraft` folder
3. otherwise a download from Mojang into `cache/`

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP and WebSocket port |
| `MC_JAR` | | path to a `1.12.2.jar` |
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

A `config.json` next to `index.html` (or embedded with `--config`) sets the defaults for new players:

```json
{
  "proxies": [
    { "name": "My Proxy", "url": "wss://proxy.example.com/" }
  ],
  "servers": [
    { "name": "My Server", "address": "mc.example.com" },
    { "name": "My Eaglercraft Server", "address": "wss://eagler.example.com/" }
  ]
}
```

Without `proxies`, the server hosting the page is used as the proxy. Players can change both lists in the game;
their own lists are kept in the browser.

## Proxy servers

The **Proxy Servers** button on the title screen (below the account button) manages the proxies used for vanilla
servers: add, edit, delete, test, reorder and pick one. Any machine running `npm start` is a proxy; addresses look
like `wss://proxy.example.com/` (or `localhost:3000`).

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
| `lib/` | asset discovery (`mcassets.js`), zip reading, Microsoft sign in |
| `tools/build.js` | `npm run build` and `npm run assets` |
| `client/index.html`, `client/js/main.js` | the client's entry point |
| `client/js/platform/` | the only code that talks to the browser (`platform.js` describes the contract) |
| `client/js/net/` | protocol, proxy and Eaglercraft connections, address parsing |
| `client/js/game/`, `render/`, `gui/`, `world/`, `audio/`, `gfx/` | game logic, rendering, screens, world, sound, graphics devices |
| `client/data/` | game data tables (blocks, items, entities, ...) |
