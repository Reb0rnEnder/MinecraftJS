# MinecraftJS 1.21.11 port

The named **1.21.11** branch is under development. The default client protocol
is **774**, and the runtime data/assets and public version identity target
**1.21.11**. Full feature parity is unfinished; selecting this target does not
certify every vanilla feature or patch fix.

## Historical 1.20.6 baseline evidence

The inherited 1.20.6 milestone recorded native protocol **766** offline login,
Configuration, essential Play/Game consumers and the first graphical native-server
milestone against a disposable vanilla 1.20.6 server. These results are historical
1.20.6 evidence, not fresh 1.21.11 acceptance results.

The historical 1.20.6 [full-parity checklist](docs/parity-checklist-1.20.6.md) separates
accepted work, partial implementations, confirmed missing consumers and unverified
scenarios. Its [editable JSON ledger](docs/parity-checklist-1.20.6.json) drives the
counts; checkpoint counts are not completion percentages.

See the 1.20.6 [transition plan](docs/transition-1.20.6.md) and
[native transport evidence](docs/development-1.20.6.md) for that baseline's gates.
The 1.20.6 [ordered task ledger](docs/transition-1.20.6.tasks.json) tracks dependencies and acceptance criteria. Its GitHub handoff audit recorded repairs to live recipe joining, encrypted transport, reconfiguration/transfer, chat/sound consumers and native GUI sprites. At that checkpoint, the next resource gate covered remaining atlases, fonts and pack overlays; item-specific and authenticated-account acceptance remained open.

That baseline also recorded encrypted login with independent RSA/AES tests, while
a real account-backed login remained unverified. A real Chrome client joined the
local native fixture and `wss://mc.arch.lol`, rendering the target menu and hotbar.
WebMC's Eagler backend returned `Your client does not support online mode` before
Configuration; this server rejection is preserved. No prebuilt 1.20.6 distribution
was claimed. These observations do not establish 1.21.11 acceptance or full parity.

Explicit `*:1.20.6` npm scripts remain 1.20.6 tools. The unqualified
`parity:status`, `parity:update` and `parity:consumers` aliases also operate on the
**1.20.6** evidence/ledgers, not 1.21.11.

## 1.21.11 setup and isolated fixture

```sh
npm ci
node tools/port-1.21.11/prepare.mjs
npm run test:1.21.11
# In one terminal (Java 21+, with JAVA set if java is not on PATH):
node tools/port-1.21.11/run-protocol-fixture.mjs
# In another terminal:
node tools/port-1.21.11/probe-configuration.mjs
```

The 1.21.11 fixture binds only `127.0.0.1:25571` and refuses an occupied port.
It verifies the pinned server SHA-1 and writes its own fixture EULA/properties in
`cache/port-1.21.11/fixture-server`. Its `protocol-fixture` world is cache-local
and reused across runs, not a fresh temporary world on each launch. It does not
load existing user servers/worlds or their configuration. Wait for the server to
finish starting before running the probe; stop it with Ctrl+C when finished.
The probe checks native offline transport, Play decoding and basic interactions,
not full feature parity.

## Inherited implementation baseline

This 1.21.11 port inherits the 1.20.6 baseline, including some renderer/gameplay
helpers whose last dedicated parity review was on 1.19.4. Historical provenance
labels are retained rather than blindly relabelled as 1.21.11 evidence. The
default network protocol, runtime registries, block/entity data, visual-state
tables, assets and public identity target 1.21.11; this is not a full-parity
claim. Older supported clients remain on their existing named branches.

Start the proxy from **this worktree**:

```sh
PORT=3003 ALLOW_LOOPBACK=1 npm start
```

Open `http://localhost:3003/` and join a compatible 1.21.11 server. Loopback is
explicitly allowed here for local testing; deployments block it by default.
Use the isolated 1.21.11 fixture workflow above for native testing so
existing local worlds/configurations are never loaded or upgraded.

Validate the prepared 1.21.11 inputs and checked-in runtime data, then build
assets (Java 21+):

```sh
node tools/port-1.21.11/prepare.mjs
node tools/port-1.21.11/reports.mjs --check
node tools/port-1.21.11/runtime-data.mjs --check
npm run assets
npm run test:1.21.11
```

`runtime-data.mjs --check` validates the existing `client/data` tables; it does
not regenerate them. Regeneration without `--check` also invokes
`tools/port-1.21.11/visual-runtime.mjs` and requires prepared native extraction
inputs, including `cache/port-1.21.11/client-unsigned.jar` and its Java libraries.
The explicit 1.20.6 generators instead prepare that older target's cache and
are not the default workflow for this branch.

`npm run build` creates a standalone HTML client; use
`npm run build -- --static --out=dist/site` for static hosting. These are browser
clients and require a compatible proxy to connect to ordinary Java TCP servers.

MinecraftJS is not affiliated with Mojang or Microsoft. The repository contains no Mojang asset files: target
game assets are resolved from the SHA-pinned 1.21.11 Mojang inputs/cache when you build them. Entity and block-entity
models (mobs, boats, chests, signs, skulls, beds, ...) are extracted from pinned native Java constructors through the
official mappings and stored in `bundles/entity-models.json`.

## Requirements

- Node.js 22 or newer
- Java 21 or newer for native 1.21.11 asset/data extraction
- `npm install` (installs the proxy's dependencies, plus esbuild and ffmpeg for the build)

## Running with the proxy

```sh
npm install
npm start
```

Then open http://localhost:3000. The proxy serves the client, bridges the browser to Minecraft servers (TCP),
relays Microsoft account sign in and serves player skins.

Game assets are found automatically from the selected target cache; this 1.21.11 branch defaults to the SHA-pinned
`cache/port-1.21.11` inputs. A built `client/assets/` directory can be served directly for static hosting.

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | HTTP and WebSocket port |
| `MC_VERSION` | `1.21.11` | vanilla asset target used by the proxy/build; does not switch the client protocol |

Leave `MC_VERSION` at this branch's default for the 1.21.11 client. Older asset
targets remain available for explicit compatibility workflows; selecting one
does not turn this client into a 1.20.6 client. Builds use `client/data` unless
`MC_RUNTIME_DATA` points to another runtime-data directory; keep those tables
matched to 1.21.11. `MC_JAR`, if set, must likewise identify the intended target's
client jar.

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
| `--audio=opus\|vorbis\|copy` | sound codec (default **Opus**; `copy` keeps the original files) |
| `--sfx-kbps=N`, `--music-kbps=N` | bitrates (32 and 48) |

The audio options apply to single-file HTML, static-site and development asset builds:

```sh
npm run build -- --audio=opus                 # default: effects 32 kbps, music 48 kbps
npm run build -- --static --audio=copy        # retain original Mojang Vorbis files
npm run assets -- --audio=vorbis --music-kbps=96
```

Opus is lossy, as are the original Vorbis files. Small clips retain their original bytes if re-encoding would enlarge them. Encoded sounds are cached under the target's asset cache in `audio/`; later builds reuse them. Install FFmpeg (or set `FFMPEG`) to transcode; a missing encoder produces a warning and keeps originals. Use `node tools/benchmark-audio.mjs` to measure this target's complete sound corpus, optionally setting `PLAYWRIGHT_MODULE` to a Playwright module path to test actual browser decoding. See [the audio build audit](docs/audio-build-audit.md).

On proxy startup, prebuilt entity models are checked against their extraction sources, jar and content hash. Stale model bundles are regenerated from the target jar; restart the proxy after pulling code. See [model-bundle cache provenance](docs/model-bundle-cache.md).

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
