# Java 1.17.1 implementation ledger

This is a development port, not a full-parity claim. The target is protocol 756,
pack format 7, data version 2730. Source inputs are pinned in
`tools/port-1.17.1/target.json`; generated native counts and schema differences
are in `tools/port-1.17.1/baseline.json`.

## Implemented and checked

- Native climbable vegetation now follows the synchronized `climbable` block
  tag, including new vine tips/stems and server overrides. See
  [climbing verification](climbing-parity.md).

- Native reports: 898 blocks / 20,342 states, 1,100 item registry entries
  (including air), 113 entity types, 1,190 sound events, 89 particles.
- Native selection/collision/occlusion/render/sound properties for every state,
  item mechanics, creative tabs, default tags, biome effects, metadata indices,
  player dimensions and GUI option arrays.
- Model extraction runs the official layer definitions and bakes all 169 layers.
  97 semantic adapters cover existing models and goat/axolotl/glow squid.
  The asset build validates all 73 living entity types and referenced textures.
- Matching version identity, default assets/panorama/languages, F3, handshake,
  and independent asset-cache key. Native accessibility list includes the dark
  Mojang loading background toggle, applied at startup and resource reload.
- Protocol 756 IDs and changed terrain/light masks, inventory state IDs and
  carried stack, explosion counts, registry-grouped tags, particle payloads,
  books, teleport dismount flag, attributes, optional map icons, split
  titles/combat/border packets, and ping/pong. Required resource-pack prompts,
  custom messages, saved preferences and decline/disconnect behavior are implemented.
- Frozen-tick base metadata is retained without shifting living/player data
  into the wrong fields. Existing sleep/Riptide consumers use target indices.
- Goat/axolotl/glow-squid models and variants render, including baby goat horn
  visibility and glow-squid darkness lighting. Glow item frames have target
  models, facing/selection, contents and illuminated rendering.
- Spectator noclip/ground initialization, flight descent and fluid-jump gating
  match the checked native rules. F3+F4 survives pointer unlock until F3 release.
  See `spectator-flight-fixes.md` for the backport matrix and regression checks.
- F3 content follows the target-specific native layout, including CH/SH, target
  coordinates, reduced-debug footer and browser/traffic diagnostics. See
  `debug-overlay-version-audit.md` for cross-version checks and limits.
- Spyglass first-person use/scope/sounds/held model, glowing-sign text and
  contextual powder-snow collision/movement/freezing visuals are implemented.
  See `interaction-1.17.1-audit.md` for native methods, evidence and limits.
- Axolotl native state poses/history, goat ramming/long-jump metadata and baby
  transforms, third-person spyglass attachment, all new particle providers and
  block effect producers are implemented. Block-state decoding matches all
  20,342 native states. See `caves-content-parity.md` for evidence and limits.
- Custom dimension min-Y/height flows through terrain/light bitsets, world and
  worker storage, culling/meshing, collisions, biome sampling, precipitation and
  F3 height maps. Negative and above-255 browser scenes render without errors.
  See `vertical-world-parity.md` for native limits, tests and live-test limits.
- Fabulous six-layer depth composition is implemented on WebGL 2, WebGPU and
  software, with native item/tripwire routing. Native render-layer extraction
  fixes tinted glass and inherited honey transparency. See
  `fabulous-rendering.md` and `block-render-layers.md` for checks and limits.
- Microsoft account block lists/privileges now feed social filtering, chat
  input and multiplayer access; see `social-account-parity.md` for behavior and
  authenticated-test limits.
- Native model/shape offsets now agree across meshing, damage, collision and
  selection, including bamboo/dripstone; see `block-offset-parity.md`.
- Live survival/creative inventory operations, chest transfer, Nether/End return
  travel and negative/tall dimension terrain pass on a disposable Java server.
  See `native-acceptance.md` for the exact coverage and limits.
- Sound registry/events/sample references are checked against the built assets.
- Bee anger accessor follows the native renamed field; the same correction was
  backported to 1.16.5. 1.15.2 already uses its correct original accessor.

## Integration evidence (2026-10-29)

`probe-server.mjs` connects to the supplied local server without changing its
configuration or issuing commands. A 25-second run negotiated compression,
decoded 2,532 chunk sections, acknowledged the spawn teleport, answered two
keepalives and received an authoritative inventory resync after an intentionally
stale state ID on an empty outside click. No unsupported packets were seen.

`probe-browser.mjs` joined the same server using WebGL 2, rendered terrain and
entities, moved and exchanged keepalives without console errors, decode warnings,
missing resources or a crash. Headless software rendering uses a 640x360 viewport,
10 FPS and disabled clouds/biome blending; the larger initial software viewport
delayed network processing enough to time out. This is not hardware performance
or other graphics-adapter validation.

`probe-content-browser.mjs` renders adults/babies of the new mobs and inherited
Nether mobs in an isolated client scene, checks axolotl variants/goat metadata,
opens smithing, video/chat/accessibility/social screens and the F3 mode switcher.
This checks construction/rendering, not exact animation parity.

`verify-runtime.mjs` verifies frozen/living/player/object metadata separation,
sleep/wake deltas, axolotl variants, baby goat horns and the dark loading option.

`verify-protocol.mjs` supplies fixtures for changed packet families, malformed
light masks/trailing bytes, authoritative inventory/click contents and particle
payload alignment. `test-bee-metadata.mjs` checks independent anger/nectar deltas.

Browser probes require a separately installed Playwright module selected by
`PLAYWRIGHT_MODULE`; `CLIENT_URL` selects the running development proxy. TCP
probes accept `--host=`, `--port=` and `--duration=`. They do not start a server.

## Pending acceptance work

- Broader travel/equipment/hardware combinations beyond the native acceptance run.
- Additional inventory acceptance: creative search, every menu/book limit and
  reconciliation during concurrent updates beyond the checked click sequences.
- Complete live powder-snow/leather-armor/freezing and vehicle sequences, snow
  and formatted glowing-sign visual comparisons; full live sequences for candle,
  dripstone, amethyst/sculk/vibration and other new state-specific interactions.
  Provider construction/fixtures do not prove every timing or visual detail.
- Remaining inherited mob animation acceptance. Squid/glow-squid now use the
  native client phase, server cycle reset and interpolated body/tentacle pose;
  random constructor seeds and visual timing still need live comparisons.
  Goat/axolotl and spyglass follow-up checks are in `caves-content-parity.md`.
- Compare all release-note changes and native implementations, including native
  harvesting tags/tool tiers, new mob sound variants and client status effects.
- Carry-over gaps from `parity-1.16.5.md`; command/font/GUI/narrator parity audits;
  shader/custom-pack regressions and measured frame-time/memory profiles.

Next milestone: complete the live inventory/equipment/dimension-travel
acceptance matrix and the outstanding account/GUI/release audits.
