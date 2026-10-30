# Java 1.16.5 parity audit

The client connects natively using protocol 754. This is a development build;
full Java 1.16.5 parity has **not** been established. Resource coverage, isolated
behavior checks and live-server checks are separate evidence below.

## Inputs and inventory

The official 1.16.5 jar, mappings and asset index are pinned in
[`target.json`](../tools/port-1.16.5/target.json). The registry comparison uses a
pinned 1.15.2 Git baseline, so it does not require another worktree.

[`content-1.16.5.json`](content-1.16.5.json) records native resource coverage:
763 blocks (83 new names), 975 non-air items (93 new names), 108 entity types
(six new names, including the zombified-piglin rename), 79 biome entries (four
new names), and 72 particles (ten new names). An asset being present does not
establish correct gameplay. The build validates 17,112 block states, extracts
94 entity model variants, checks all supported mob textures and includes all
2,336 sound files. There is no pending-mob exemption in the visual validator.

## Implemented and checked

- Modern world-event block IDs/item names, six-direction dispenser smoke,
  Ender-eye rings and flattened block ambient dispatch are corrected. Stackable
  snow/sea-pickle/turtle-egg placement predicts the clicked cell and native count.
  Applicable corrections are backported through their introduction.

- Crimson/warped signs are recognized as sign block entities; ordinary sign
  text tracks ambient light updates. Resource-pack HTTP requests identify this
  target as 1.16.5. Shared sign lighting is backported through 1.8.9.

- Protocol: compressed login, binary UUIDs, dimension/biome registries, padded
  terrain palettes, independent lighting, entity equipment/metadata, teleport
  confirmation and keepalives. A real Chromium client joins the running Java
  server, loads terrain and moves without decoding errors or missing resources.
- Nether mobs: native hoglin/zoglin, piglin/brute/zombified-piglin and strider
  geometry, textures, baby transforms, animation states, equipment and saddle
  layers. The isolated browser scene renders twelve adult/child variants.
- Smithing: native slot layout, server recipe matching, output prediction,
  input consumption and shift-click rules; base-item name/NBT survive upgrading.
- Items/blocks: native tool-speed tables, Netherite tools and equipment, Pigstep
  record lookup, piglin banner pattern, soul campfire rendering, lodestone
  compass targets and glint. Smithing and conversion world-event sounds route
  to their native sound categories.
- Environment: native biome fog/sky/water colors and server-provided biome
  effects, Gaussian fog sampling, lava/fire-resistance fog, all ten new particle
  providers, biome ambience/music, Soul Sand slowdown and Soul Speed handling.
- Riding: pig/strider steering, cold/warm and boost speeds, source-lava surface
  collision and submerged buoyancy have isolated collision/controller checks.
- Commands: the complete native command tree decodes without unread bytes;
  94 command cases match native Brigadier cursors, argument ranges and error
  status. New angle and UUID arguments include native syntax checks.
- Text: RGB component colors, named resource-pack fonts, modern hover contents,
  atomic wrapping/format inheritance and Unicode font regression checks.
- GUI: option ordering is extracted from native arrays. Video, Chat and
  Accessibility settings include the new controls; scrolling, chat spacing,
  delayed player-chat queue, local social hiding, F3+F4 and previous-game-mode
  shortcuts have fixture/browser coverage. Screen/FOV effect controls and
  entity-distance scaling affect rendering.

These checks include controlled fixtures. They do not demonstrate every possible
multiplayer interaction or pixel-perfect rendering of every screen.

## Remaining verification and known gaps

- Full live shader/resource-pack and native screenshot comparisons for the
  new Fabulous path remain acceptance work. Six-layer composition and native
  item/tripwire routing pass controlled tests on all three graphics backends;
  see `fabulous-rendering.md`.
- Social Interactions has session-local hiding and name filtering. Microsoft
  account block-list retrieval and account-service integration remain missing.
- Verify complete gameplay sequences against Java: respawn anchors and invalid
  dimension explosions, Nether portal travel, lodestone invalidation, piglin
  bartering, strider mounting/boosting, Soul Speed equipment changes and custom
  dimensions. Server-owned AI, loot and world generation must be distinguished
  from client rendering/input behavior.
- Compare remaining animation transitions, block ambience, particle offsets,
  sounds, entity poses and menu pixels against native rendering. Resource/model
  validation alone cannot resolve these differences.
- Expand command cases and packet-family audits beyond the native 94-case
  command fixture; neither commands nor protocol coverage are exhaustive.
- Audit all release changes from 1.16 through 1.16.5, including uncommon fixes,
  before describing the client as fully compatible.

Release inventory references: [1.16](https://minecraft.wiki/w/Java_Edition_1.16),
[1.16.1](https://minecraft.wiki/w/Java_Edition_1.16.1),
[1.16.2](https://minecraft.wiki/w/Java_Edition_1.16.2),
[1.16.3](https://minecraft.wiki/w/Java_Edition_1.16.3),
[1.16.4](https://minecraft.wiki/w/Java_Edition_1.16.4),
[1.16.5](https://minecraft.wiki/w/Java_Edition_1.16.5).
Implementation details above are checked against the pinned native inputs and
repository tests, rather than inferred from release-note presence.

## Backports

Flattened record lookup and missing conversion-event sounds apply to 1.13.2,
1.14.4 and 1.15.2. Grindstone/book world-event sounds also apply to 1.14.4 and
1.15.2. New Nether content, protocol changes and 1.16 GUI changes remain on
1.16.5. The previously pushed font/build-worker fixes remain on their applicable
older branches.

## Loading and terrain follow-up

The login terrain fix accepts vanilla fluid-inclusive section counts above
4096 and normalizes palette widths. A full fluid-heavy packet fixture, real
server join and all wood-family empty-hand interaction fixtures pass. Resource
pack labels use the native 1.16 `pack.*` keys, and startup/resource reloads now
use the native loading overlay. See [loading-screen-parity.md](loading-screen-parity.md)
for version-specific layouts and backport scope.
