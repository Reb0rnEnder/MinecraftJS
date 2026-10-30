# Java 1.18.2 implementation ledger

This is a development client, not a claim of complete 1.18.2 parity. The branch
forked from 1.17.1 at `5959e94`; applicable later empty-section and F3 capacity
fixes are carried forward. Shared fixes remain on their native older branches.

## Implemented and checked

- Version identity: Java 1.18.2, protocol 758, data version 2975, pack format 8.
  Native metadata, jars, official mappings, asset index and protocol schema are
  hash pinned in `tools/port-1.18.2/target.json`.
- Native reports and runtime tables: 898 blocks / 20,342 states; item, entity,
  sound, particle and biome IDs checked against the target reports. Rendering,
  collision, selection, heightmap predicates, offsets, creative tabs, mechanics,
  metadata, menu IDs and GUI arrays execute the matching native client code.
  Reflection uses the dependencies extracted from the native server bundler.
- Native 1.18 models/assets rebuilt, including the five-part minecart model and
  target languages, fonts, textures and sounds. No 1.17 panorama is substituted.
- Combined chunk/light packets; independent block/biome palettes, including
  single-value containers; padded-long decoding; compact block entities with
  negative Y and signed chunk coordinates; full dimension-relative lighting.
  Native palette-size over-allocation can append one zero byte per single-value
  block palette. Only this bounded zero padding is accepted.
- Changed join/client-information, block-entity type, effect-ID, particle and
  simulation-distance fields. Render and server simulation distances remain
  separate. Unchanged wire bodies reuse prior codecs by packet name.
- The native Overworld -64..319 range and Nether/End bounds flow through existing
  variable-height storage, collision, workers and rendering.
- Native video rows include Chunk Builder, Simulation Distance and Autosave
  Indicator. Chunk Builder uses threaded / player-affected / nearby immediate
  rebuild modes, with the native strict squared-distance threshold of 768.
  Simulation distance is a saved local option; remote simulation remains under
  server authority. Autosave has no integrated-server indicator to display here.
- F3 uses the native 1.18.2 block-relative and chunk/region-file coordinate forms;
  section capacity follows dimension height. Further debug-content audit remains.

## Acceptance evidence

`tools/test-protocol-758.mjs` covers negative/tall boundaries, reloads,
local/direct/single palettes against a BigInt oracle, native padding, malformed
lengths, third-word light masks, block entities and changed control fields.
The 35-test source suite includes native offset, section-storage, F3, empty
tile-scan, vertical light lifecycle and chunk-builder policy regressions. The browser settings probe verifies native option order and mode cycling. The
controlled tinted-glass scenes pass Fancy/Fabulous composition under all three
Chunk Builder modes, with no browser/GL errors.

A real TCP probe against the newly created server passes status/login,
compression, teleport confirmation, a keepalive round trip, authoritative stale
inventory recovery and 11,064 decoded sections, with no unsupported packets in
that run. The disposable native-server/browser probe passes ten authoritative
inventory operations and Nether/End/Overworld round trips, including Y=305 and
Y=-31. It reports no decode/render errors or relevant warnings and receives
three keepalives. These runs use WebGL 2 via software SwiftShader. The isolated
backend rendering regression passes WebGL 2, WebGPU and the software renderer;
this is not a hardware performance measurement.

The initial browser join against the view-distance-10 normal world timed out
while processing initial terrain. TCP passes the same world's packets, and the
view-distance-2 disposable browser acceptance passes. A sustained large-world
browser join/frame-time audit remains open; do not hide this limitation.

## Remaining parity work

1. Exact 1.18/1.18.1/1.18.2 environment rendering: cylindrical distance fog and
   special fog fixes, cloud height, biome-dependent sky/fog and altitude effects.
2. Complete F3 content audit using the native multiplayer path. Server-only
   heightmap/noise/generation and JVM data must never be fabricated.
3. Remaining menus/options: online options, sound-device selection, keybind
   search/layout and autosave behavior where an integrated server exists.
4. Rare packet/body acceptance, custom registry/dimension/pack combinations,
   shader compatibility and actual hardware adapter checks.
5. Profile large-height joins, packet/mesh/upload queues, memory and frame times;
   finish matching 1.18/1.18.1/1.18.2 release-change acceptance.
6. Rebuild published distributions with source commits, manifests and checksums
   together after the next validated checkpoint. Existing all-versions builds
   were not rebuilt by this source milestone.

The native jar/official mappings are the wire/layout authority. Cross-check
release scope against [1.18](https://minecraft.wiki/w/Java_Edition_1.18),
[1.18.1](https://minecraft.wiki/w/Java_Edition_1.18.1) and
[1.18.2](https://minecraft.wiki/w/Java_Edition_1.18.2), and the
[official 1.18.2 release](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-18-2).
