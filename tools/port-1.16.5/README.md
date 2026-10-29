# Native 1.16.5 connection baseline

`target.json` pins official Mojang metadata, jars, mappings and the asset index,
plus the minecraft-data revision used to compare packet layouts. Generated reports,
cache files and Mojang assets are deliberately excluded from Git.

With Node 22+, Java 17+ and `npm install`, run from the repository root:

```sh
node tools/port-1.16.5/prepare.mjs
node tools/port-1.16.5/reports.mjs
node tools/port-1.16.5/packet-ids.mjs
node tools/port-1.16.5/runtime-data.mjs
node tools/port-1.16.5/finalize-runtime-data.mjs
npm run assets
node --test tools/test-1.16.5-protocol.mjs
```

Run the finalizer after importing runtime data: it replaces upstream approximations
with native selection/collision/rendering shapes, creative stacks, item mechanics,
tags and metadata. Sound IDs come from the target's generated native registry;
the upstream `pc/1.16` sound table has older IDs and must not be used directly.
The reflection extractors resolve official names through the pinned mappings.
Asset builds run the target's entity-model constructors and validate all block
states. The six new mob renderers are explicitly recorded as pending; the build
still rejects missing models/textures for supported entities.

The optional integration probe uses the running local server without modifying
blocks, its settings or its process:

```sh
node tools/port-1.16.5/probe-server.mjs --duration=25000
```

It verifies status, compressed login, binary UUIDs, dimension data, teleport
confirmation, padded terrain palettes, independent light updates and keepalive
responses. Its evidence is written to ignored `cache/port-1.16.5/live-probe.json`.

The current scope is the connection baseline in
[the transition plan](../../docs/transition-1.16.5.md). New mob visuals, smithing,
new mechanics and a native 1.16 GUI audit are subsequent milestones. Inherited
1.15 GUI layouts are labelled as such in the runtime layout metadata.

With a 1.16.5 proxy on port 3001 and a local server on port 25565, the browser
probe also checks terrain-screen dismissal, movement, HUD/world rendering,
keepalives and console/network errors:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tools/port-1.16.5/probe-browser.mjs
```

`CLIENT_URL` overrides the page URL; `SCREENSHOT` overrides the screenshot path.
