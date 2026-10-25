# Native 1.14.4 networking milestone — 2026-10-25

The browser runtime is still the inherited protocol-404 client. A separate native
498 codec and a real-server integration probe now exercise the first port stage.
They are deliberately not selected by `Connection` or the UI until the native
registries, models, metadata consumers and world/light lifecycle are connected.

## Implemented

- Generated all 93 clientbound and 46 serverbound numeric packet IDs from the
  hash-verified, revision-pinned schema. Regeneration has a `--check` mode.
- Added native X/Z/Y packed block positions with signed coordinate bounds;
  the existing 404 reader/writer retain X/Y/Z.
- Added join-game/view-distance, respawn, difficulty lock, teleport, keepalive,
  settings, basic inventory/menu, four-registry tags, block changes, and other
  startup/control codecs. Native metadata handles villager data, optional
  VarInts and pose; particle parameters use 1.14 IDs.
- Added chunk packet heightmaps and separate light masks/arrays for all 18 light
  sections, including boundaries below/above terrain. Reject malformed masks,
  conflicting empty/data masks and non-2048-byte light arrays.
- Added native section decoding: two-byte reported block counts, local/global
  palettes, continuous packed values spanning 64-bit boundaries, no embedded
  light arrays, and the full-chunk 256-entry biome array. Palette sizes,
  state IDs, array lengths, masks, truncation and trailing data are checked.
- Added native serverbound block interactions with the new packet IDs, the
  hand-first block-place layout and the inside-block flag. They have byte-level
  tests; the live probe does not mine/place blocks or send chat/commands.

Unsupported packet families remain explicitly labelled `unsupported` with their
packet name and raw body. They do not fall back to 404 packet IDs or layouts.
The partial codec is not a claim of full protocol coverage.

## Live-server evidence

Ran against the user's existing vanilla 1.14.4 server on local port 25565,
offline mode, using a temporary probe player named `Codex1144Probe`. The test
uses a Node TCP adapter and the existing `VanillaSocket` Minecraft handshake,
compression and login machinery. It does not yet test the browser, WebSocket
relay or rendering. The probe disconnects when its bounded run completes.

The successful 25-second run negotiated compression threshold 256, logged in,
decoded Join Game, confirmed the initial teleport, and answered two keepalives.
It decoded **462 chunk packets, 2,372 terrain sections and 462 light updates**,
plus native tags, inventory, metadata and block updates with no decoder error.
The local report is `cache/port-1.14.4/live-probe.json`; counts vary per world/run.

The live test exposed a vanilla 1.14.4 detail missed by the synthetic fixtures:
`LevelChunkSection.recalcBlockCounts` (`bxu.h()` in the verified jar) counts both
non-air states and non-empty fluids into its reported block count. A section's
wire count can therefore exceed 4,096. The decoder retains `wireNonAir` and
recounts actual occupied cells, treating native air, void-air and cave-air IDs as
empty. It does not reject valid fluid-filled sections because of that count.
The native registry size and air IDs are checked against the generated reports.

Client settings must be sent after Join Game, not immediately on Login Success;
the server may still be finishing its transition out of the login state.

## Reproduce

```sh
node tools/port-1.14.4/packet-ids.mjs --check
node tools/test-1.14.4-bootstrap.mjs
node tools/test-1.14.4-protocol.mjs
node tools/test-1.14.4-chunks.mjs
node tools/port-1.14.4/probe-server.mjs --host=127.0.0.1 --port=25565 --duration=25000
```

The live probe expects a running vanilla 1.14.4 server that accepts offline
players and negotiates compression. It makes one status connection and one
bounded login connection, creates ordinary player data on the test server, and
saves its diagnostic report in the ignored cache. It never edits server
configuration or starts/stops the user's server.

All 16 bootstrap/protocol/section tests pass, packet-ID regeneration matches,
and the 42 inherited shared/sky tests also pass using the 1.13.2 baseline jar.

## Next stages

1. Adapt native asset/model/shape/GUI extraction and complete the registry
   consumer audit. Preserve version/hash provenance.
2. Connect section storage and independent light updates: light-before-chunk,
   chunk-before-light, partial updates, empty/boundary sections, unload/reload,
   dimension reset and mesh-worker invalidation. Decode alone is not enough.
3. Complete the remaining clientbound/serverbound packet families, especially
   commands, recipes, entities, attributes, player info, advancements and trades.
   Add fixtures and real-server checks as each family is enabled.
4. Wire the native codec, proxy-advertised version and native data into the
   browser only when those dependencies are ready; then validate actual play,
   reconnects and dimensions. Keep stable releases on their own branches.

These changes belong only on the 1.14.4 branch. They do not introduce the newer
protocol, registries or mechanics into 1.13.2, 1.12.2 or 1.8.9.
