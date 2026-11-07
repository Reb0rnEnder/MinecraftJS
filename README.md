# MinecraftJS 1.20.6 port

The named **1.20.6** branch is under development. Native protocol **766** offline
login, Configuration, essential Play/Game consumers and the first graphical
native-server milestone are implemented and tested against a disposable vanilla
1.20.6 server. The default runtime data/assets and public version identity now
target **1.20.6**. Full feature parity is still unfinished; later ledger gates
cover inventory actions, authenticated sessions, resource packs, presentation
families, chat/commands and inherited baseline gaps.

See the [transition plan](docs/transition-1.20.6.md) and
[native transport evidence](docs/development-1.20.6.md) for remaining gates.
The [ordered task ledger](docs/transition-1.20.6.tasks.json) tracks dependencies and acceptance criteria. Native data/resources, strict protocol-766 NBT text, the complete 1.20.5+ item-component stack codec, Configuration/known-pack lifecycle, essential Play/Game bridge and graphical join are now reproducible; the next task is inventory/action reconciliation and target physics attributes.

```sh
npm ci
npm run prepare:1.20.6
npm run test:1.20.6
# In one terminal (Java 21+, with JAVA set if java is not on PATH):
npm run fixture:1.20.6
# In another terminal:
npm run probe:1.20.6
```

The fixture binds only `127.0.0.1:25568` in a fresh cache-local temporary world and refuses an occupied port. It verifies the pinned server SHA-1 and writes its own fixture EULA/properties, so it never loads or upgrades user worlds or configuration. Stop the fixture with Ctrl+C when finished.

Encrypted/account login and later feature families remain pending. Essential Play terrain/light, dimension, entity, HUD and inventory state plus the graphical join are native-verified, but this is not a full-parity release. No prebuilt 1.20.6 distribution is claimed.

## Inherited implementation baseline

The 1.20.6 port still intentionally reuses some renderer/gameplay helpers whose
last dedicated parity review was on 1.19.4. Those helpers are being replaced or
revalidated gate-by-gate rather than blindly relabelled; see the transition task
ledger for the remaining work. The default network protocol, runtime registries,
block/entity data, visual-state tables, assets and public identity are now native
1.20.6. Older supported clients remain on their existing named branches.

Start the proxy from **this worktree**:

```sh
PORT=3003 ALLOW_LOOPBACK=1 npm start
```

Open `http://localhost:3003/` and join a compatible 1.20.6 server. Loopback is
explicitly allowed here for local testing; deployments block it by default.
Use the isolated `npm run fixture:1.20.6` workflow above for parity testing so
existing local worlds/configurations are never loaded or upgraded.

Reproduce the native 1.20.6 runtime data and assets (Java 21+):

```sh
npm run prepare:1.20.6
node tools/port-1.20.6/reports.mjs --check
node tools/port-1.20.6/runtime-data.mjs
node tools/port-1.20.6/visual-runtime.mjs
npm run assets
npm run test:1.20.6
```

`npm run build` creates a standalone HTML client; use
`npm run build -- --static --out=dist/site` for static hosting. These are browser
clients and require a compatible proxy to connect to ordinary Java TCP servers.

MinecraftJS is not affiliated with Mojang or Microsoft. The repository contains no Mojang asset files: target
game assets are resolved from the SHA-pinned 1.20.6 Mojang inputs/cache when you build them. Entity and block-entity
models (mobs, boats, chests, signs, skulls, beds, ...) are extracted from pinned native Java constructors through the
official mappings and stored in `bundles/entity-models.json`.

## Requirements

- Node.js 22 or newer
- Java 21 or newer for native 1.20.6 asset/data extraction
- `npm install` (installs the proxy's dependencies, plus esbuild and ffmpeg for the build)

## Running with the proxy

```sh
npm install
npm start
```

Then open http://localhost:3000. The proxy serves the client, bridges the browser to Minecraft servers (TCP),
relays Microsoft account sign in and serves player skins.

Game assets are found automatically from the selected target cache; the 1.20.6 branch defaults to the SHA-pinned
`cache/port-1.20.6` inputs. A built `client/assets/` directory can be served directly for static hosting.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP and WebSocket port |
| `MC_VERSION` | `1.20.6` | asset/runtime target selected by the build |

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

Static website output: `npm run build -- --static --out=dist/site`. Separate backend:
`npm start -- --proxy-only`. Outbound loopback is blocked by default; use
`--allow-loopback` for a Minecraft server on the same machine. See
[static hosting, proxy flags and resource fixes](docs/static-hosting-and-proxy.md).

Parity status: [supported-version wiki/runtime audit](docs/supported-version-parity-audit.md).
No branch is certified as implementing every vanilla feature or patch fix.

Shader packs now attempt supported native programs in best-effort mode and report skipped stages and fallback inputs in the shader screen. Generated replacement cloud/wave/lightmap effects stay removed; full BSL/Complementary/Photon sky, water and shadow rendering remains unfinished. See [shader best-effort loading](docs/shader-best-effort-loading.md) and [preloading/rendering measurements](docs/preloading-and-real-shader-pipeline.md).
