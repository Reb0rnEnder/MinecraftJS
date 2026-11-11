# Native 1.20.6 development evidence

The graphical P07 milestone is accepted on native 1.20.6: the tracked/default
runtime data, asset target, protocol and public identity now agree on 1.20.6.
Full parity is still unfinished; P08-P16 retain inventory/action, authenticated
session, resource-pack, presentation, chat/command and inherited-gap work.

The SHA-1-pinned native 1.20.6 server (protocol 766) accepts the offline transport
in a disposable loopback-only world. The current probe observes compression
threshold 256, full Configuration negotiation, eight synchronized registries
(64 biomes, 7 chat types, 16 trim patterns, 10 trim materials, 9 wolf variants,
4 dimension types, 45 damage types, 41 banner patterns), vanilla feature flags,
native Play join in the overworld, teleport confirmation, a real keepalive reply,
five chunk-batch replies and 45 decoded/normalized chunk payloads. P07 then drove
the same target through a disposable real Chrome client and accepted graphical
terrain/entity/HUD, movement and death/respawn behavior.

Run `npm run prepare:1.20.6`, `npm run test:1.20.6`, then the fixture and probe
commands in README.md. Native ConfigurationProtocols registrations, registry
entries and known-pack packets were cross-checked against the exact client jar
and official mappings. Java DataOutputStream independently confirmed the modified
UTF-8 fixture `000b41c080c3a9eda0bcedbcbf` for NUL and supplementary characters.
The permanent target gate now passes 87/87 regressions. Inherited mouse-look/Wisp
regressions have nine passes and one intentional browser-only skip.

Cookie limits, registry ownership, phase acknowledgements, reconfiguration,
component-stack defaults/patches, essential Play decoding and malformed input are
covered by regressions. Real server transfer, encrypted authentication,
resource-pack UI and later feature families remain open. Graphical native-server
join is accepted, but target-specific network formats are not backported and
full-parity/release claims remain gated by P08-P16.

The local server jar is verified against target.json; only server properties and
EULA were copied from the existing 1.19.4 fixture. User worlds/configs/captures
are not committed or loaded by the isolated probe. No distribution was rebuilt.

## Forwarded interaction-entity correction

The 1.19.4 parity review (source commit `59853ce`) found zero registration dimensions overwriting the
interaction entity's own 1x1 spawn bounds and pickability. This shared graphical
baseline now retains its defaults, applies width/height/response metadata, uses
zero pick-radius inflation and consumes Use with response-controlled arm swing.
Native 1.20.6 Interaction (`btm`) confirms the same dimensions/response semantics;
client jar SHA-1 is `05b6f1c6b46a29d6ea82b4e0d42190e42402030f`.

The forwarded interaction/chest-boat tests pass (8 tests), and the client bundle
compiles. These use the existing 1.19.4 graphical/metadata baseline, not a
completed 1.20.6 Play codec. A broader projectile test was attempted but cannot
load the absent generated entity-model bundle. Native 1.20.6 live/render parity
is not inferred. No pre-1.19.4 target receives this newer entity feature.

## Planning checkpoint, 2026-11-06

The user authorized advancing the existing 1.20.6 port while carrying inherited gaps explicitly. The [updated plan](transition-1.20.6.md) and [task ledger](transition-1.20.6.tasks.json) replace the earlier finish-all-baseline-fixes-before-starting gate. Four native input hashes and embedded version fields were rechecked; the existing Configuration suite passed nine tests. No live server probe was rerun and no gameplay milestone is newly accepted by this documentation change.

P02 native reports/default components/resource coverage is now accepted below; P03/P04 codec work follows. The first graphical acceptance target is P07. The browser restricted historical release URLs, but direct curl retrieved all seven original Wiki pages; Fandom direct requests returned challenge pages. Their source hashes/topic/fix index, selected-section review and official/native cross-checks are recorded in transition-1.20.6.inputs.json and transition-1.20.6.release-index.json.

## P02 native data/resource baseline, 2026-11-07

P02 is accepted. `tools/port-1.20.6/reports.mjs` now regenerates the exact
1.20.6 Mojang data-generator reports from the SHA-1-pinned server input and
checks a committed semantic baseline. The target resolves to 1,060 blocks,
26,684 contiguous block states, 1,330 items, 56 contiguous data-component
types, 74 registries and 8,283 default item-component entries. Every reported
default item component is validated against the target component registry.

The same gate inventories the target client-jar atlas/font definitions and the
asset-index language, sound and external Unihex objects. FeatureFlags bytecode
is checked against the pinned server class: `minecraft:vanilla` is the native
default set, while bundle, trade rebalance and update-1.21 remain non-default
experiments. Protocol phase packet counts are recorded for 1.20.4 versus the
1.20.5/1.20.6 schema boundary.

Mojang's generated item report can vary in JSON object key order between runs,
so report source hashes use canonical parsed JSON rather than raw serializer
bytes. The semantic baseline passed two consecutive full
`npm run test:1.20.6` runs, while the existing nine Configuration tests
remained green. P03 (native binary/NBT text primitives) is the next gate.

## P03 native NBT text primitives, 2026-11-07

P03 is accepted. Protocol 766 now has a bounded anonymous-NBT writer matching
the existing typed reader across tags 1-12, including Java modified UTF-8,
byte/int/long arrays, list/compound nesting and malformed-length/depth checks.

`component-nbt-1.20.6.js` adds the target-specific 1.20.3+ text-component
boundary without changing older chat parsing. It enforces native string/object/
non-empty-list roots, preserves styles/events, normalizes root sibling arrays to
`extra`, and reproduces NbtOps heterogeneous-list empty-key wrappers.

`component-fixtures.mjs` regenerates byte fixtures from the SHA-pinned 1.20.6
server by bootstrapping Mojang `ComponentSerialization` + `NbtOps` and writing
network anonymous NBT. The committed set covers plain text, style/click events,
root siblings, translated mixed lists and hover text, plus native rejection of
numeric, boolean, null and empty-list roots. Configuration disconnect/resource-
pack prompts and Play disconnects now consume the strict component codec.

`npm run test:1.20.6` now checks target IDs, native data/resource reports, native
component fixtures and both regression suites: 17/17 tests pass. P04 item
component-stack defaults/patches/nested stacks is the next dependency gate.

## P04 native item component stacks, 2026-11-07

P04 is accepted. The pinned protocol-766 Slot/SlotComponent graph now generates
target-only codecs for all 56 data-component payload types and target-native
default component sets for all 1,330 item IDs. The runtime preserves the exact
added/removed patch while also exposing the effective component set after Mojang
defaults and removals are applied; there is no legacy slot-NBT fallback.

The schema interpreter covers every constructor reachable from ItemStack in the
1.20.5/1.20.6 minecraft-data graph, including inline/named registry holders,
holder sets, packed positions, anonymous NBT and recursive nested stacks. All 56
payload branches have byte-stable encode/decode/re-encode tests. Consumer views
expose target damage/max-damage/max-stack-size, custom names, lore, written-book
pages and recursively decorated nested stacks.

`stack-fixtures.mjs` independently bootstraps the SHA-pinned Mojang 1.20.6 server
and writes stacks through the native `ItemStack.STREAM_CODEC`. Six committed
fixtures cover empty/default stacks, damage, custom-name addition, default
component removal and a bundle containing a damaged sword. Every native byte
sequence decodes through MinecraftJS and re-encodes byte-identically.

The complete target gate now passes 79/79 tests, including all native report,
component and stack fixture regeneration checks. P05 Configuration lifecycle and
registry ownership is the next dependency gate before the broad Play codec.

## P05 Configuration lifecycle and known-pack ownership, 2026-11-07

P05 is accepted. A SHA-1-pinned vanilla 1.20.6 capture now provides the exact
`minecraft:core@1.20.6` synchronized-registry cache used by the native server:
eight registries and 196 target NBT values. Known-pack negotiation is exact-
version only; protocol-compatible mismatched patch versions are declined and
must send full registry payloads.

The isolated live vanilla probe selected `minecraft:core@1.20.6`, observed all
196 synchronized registry values omitted by the server, restored each value
from the captured cache, and still transitioned to Play in `minecraft:overworld`
while confirming teleport, keepalive and chunk-batch control packets. The cache
capture and fixture both verify the pinned server SHA-1 and remain cache-local.

Configuration generations now own fresh registries, tags, feature flags,
selected-known-pack state and cache counters. Connection cookies and pushed
resource-pack metadata survive Play -> Configuration transitions until explicit
removal. Mismatched known packs and omitted uncached registry values fail
explicitly instead of silently using the wrong target data.

`npm run test:1.20.6` passes 80/80 target regressions after the P05 changes.
P06 essential Play packet bodies and Game consumers is now the next gate.

## P06 essential Play/Game bridge, 2026-11-07

P06 is accepted. A target-only generated schema now covers 53 essential
clientbound Play packets and 64 reachable helper types. Native 1.20.6 bytecode
was used to correct three material mistakes in the pinned third-party schema:
section block-update records and both world-border lerp-time fields are VarLong,
not VarInt.

The decoder resolves numeric dimension references against Configuration-owned
dimension registries, forwards simplified biome entries to both the main renderer
and mesh workers, and supplies the target block-state count and exact air-state
IDs to the existing compact chunk decoder. Chunk/light, block changes, block
entities, inventory component stacks, entities, metadata, attributes, movement,
HUD state and world-border packets are normalized to the established Game/World
consumer contracts rather than being routed through protocol 762.

`tools/test-1.20.6-play.mjs` drives the resulting packet shapes through actual
`Game.handlePacket` consumers for Join Game, terrain/light, inventory, entity
identity/movement/attributes, health/experience/abilities and border state. The
complete target gate passes 87/87 tests.

The isolated live vanilla probe additionally reached Play with
`minecraft:core@1.20.6`, resolved the native overworld dimension, confirmed the
initial teleport, answered a keepalive, acknowledged five chunk batches and
decoded 45 native chunk packets. A focused shared-baseline pass kept 35 relevant
world/biome/entity/light/border/respawn tests green. Two selected legacy tests
were already failing on untouched pre-P06 commit `c35d94a`, which was confirmed
in a detached worktree rather than attributed to this milestone.

P07 is next: route protocol 766 through the actual graphical browser connection,
build target assets/runtime data, join the isolated server and accept rendered
terrain/entities/HUD plus movement/respawn before changing the public version
identity.

## P07 graphical native 1.20.6 acceptance, 2026-11-07

P07 is accepted. The target runtime generator now derives and validates 1,060
blocks / 26,684 states, 1,330 items, 130 entities, 64 biomes and 1,607 sound
events from pinned 1.20.6 sources. A mapped native visual extractor covered all
26,684 block states with zero extraction errors, producing 5,538 render-property
combinations, 320 collision shapes and 388 selection shapes. Native model-layer
extraction found 212 baked 1.20.6 layers; every one of the renderer's 123 existing
model specifications resolved without a missing layer.

The complete target asset build produced 13,186 files (~214.5 MB) with 129 checked
entity textures, 79 living renderer types and no pending/missing model entries.
The browser build used only staged 1.20.6 runtime tables during acceptance; no
1.19.4 JSON was copied forward to make the scene boot.

A disposable real Chrome profile then joined the isolated SHA-pinned vanilla
1.20.6 server through the new raw MinecraftJS proxy bridge. The browser loaded 45
chunks, rendered nonblank terrain/HUD, spawned a target-native pig with protocol
wire type 77 and exact 0.9 x 0.9 target dimensions, and stayed connected while a
real Chrome KeyW input moved the player 6.04 blocks through the normal
input/physics/network path.

The live browser run caught two issues that packet-only tests did not: entity wire
IDs were being reinterpreted through the old numeric renderer registry, and entity
relative-movement shorts were being treated as blocks instead of 1/4096-block
units. Entity renderer identity now resolves by canonical target name while
retaining the wire ID, and protocol-766 relative deltas are normalized at the
codec boundary. A final live pig moved naturally over six seconds instead of
running away to huge coordinates; the 1/4096 conversion also has a regression.

Vanilla `/kill` opened the actual browser DeathScreen at health 0. Invoking its
real Respawn button sent protocol-766 client_command(0); the client received
respawn/position/health plus 45 fresh chunk packets, returned to health 20, closed
the death screen and remained connected.

Only after those checks passed were the tracked `client/data` tables, resource-pack
format/default asset target, public `MinecraftJS 1.20.6` identity, asset cache key
and saved-hotbar namespace switched atomically. With no target environment
overrides, tracked runtime JSON byte-matches the validated staged target set,
`lib/mcassets` selects 1.20.6 / pack format 32, a normal no-assets HTML build
succeeds, and `npm run test:1.20.6` remains 87/87 green.

P08 is next. Creative/item-mechanics data is intentionally target-marked and
incomplete rather than inherited from 1.19.4; inventory actions, authoritative
component-stack reconciliation, native ranges/poses and rejection side effects
must be ported before that gate can be accepted.

## P08 inventory/actions/target attributes, 2026-11-08

P08 is accepted. Protocol-766 container clicks now carry the modern state ID,
changed-slot component stacks and carried stack, while local prediction preserves
the complete component patch/effective component state instead of the old
NBT-only subset. Incoming `set_slot`/`window_items` remain authoritative and
replace rejected or corrected predictions.

The target menu registry accounts for the Crafter insertion and every native
1.20.6 menu ID; modern Smithing uses template/base/addition/result indices and
merchant ItemCost component predicates normalize into the existing merchant
consumer shape. The generic Play decoder is no longer restricted to the P06
join subset: all 122 clientbound protocol-766 packet bodies are generated.

The 1.20.5 attribute migration is connected to gameplay rather than stored as
metadata. Gravity, jump strength, step height, scale/pose dimensions,
safe-fall distance, fall-damage multiplier, block-break speed and block/entity
interaction ranges affect the existing physics/interaction code. Native Player
bytecode confirms 4.5 block and 3.0 entity interaction-range defaults.

The target regression gate is now 95/95 green. P09 is next: reuse the older
encrypted-login/session-join path with the protocol-766 login layouts and prove
both offline and account-backed state transitions.

## GitHub handoff review: reproducible native reports, 2026-11-11

Resumed the existing branch from GitHub commit `42dbb78`. A fresh native report
regeneration exposed a nondeterministic baseline: Mojang emits the item component
map as a list whose iteration order varies across JVM runs. All 1,330 regenerated
item defaults were semantically identical to the committed defaults, but the
report hash and generated JS differed by map order.

The report digest now sorts only the top-level per-item component map by type.
Generated default objects also have stable recursive key order. Semantic lists
inside component values (lore, modifiers, nested stacks, etc.) remain ordered;
regressions assert that reordering them or changing a value still changes the
canonical representation. The baseline digest was regenerated from pinned native
inputs; no item defaults or component IDs changed.

## Connection and live-join handoff repairs, 2026-11-11

The GitHub milestone still explicitly disconnected every encrypted login. Native
`ClientHandshakePacketListenerImpl` (`fxw`) confirms the 1.20.5 authentication
boolean: both cases encrypt the secret/token and enable AES-CFB8, but only the
true case joins the session service. The target now implements that distinction.
Independent Node RSA/AES checks cover the reused crypto path. They use a mocked
session response, not a real Microsoft account; P09 remains partial.

The actual graphical Connection now honors bundles and server transfers. Login,
Configuration and Play cookies retain owned bounded bytes; only server-triggered
transfers copy them and use handshake intent 3. Ordinary joins start empty.
Reconfiguration flushes pending chat acknowledgements before its acknowledgement,
suspends/clears the old world, preserves visible/input chat and resource packs,
and resets chat when the server requests it. Initial brand/settings ordering and
saved client options match `fxw`; these are not resent on reconfiguration. Native
Configuration features/tags reach Join Game consumers rather than disappearing
when the Play handler resets its state. Typed disconnect reasons survive.

The expanded 122-packet decoder also failed live joining on `declare_recipes`:
arrays incorrectly introduced container scope, breaking shaped dimensions and
player-info action switches, and the upstream recipe serializer map retained a
removed banner-add-pattern entry. The generator now sources all 23 serializer
IDs from Mojang's native registry. Shaped recipes reach the existing crafting
consumer with flat, ordered cells and the proper dimensions/identifier.

After these fixes the isolated SHA-pinned vanilla server probe received 45 native
chunks, confirmed a teleport, answered a keepalive and acknowledged five chunk
batches. This was transport/Play acceptance, not a new graphical or account test.
The focused target tests pass 108/108. The native generator/oracle gate is rerun
separately. P08 has been reopened: generic packet decoding did not establish
complete item/menu consumer parity.

Shared cancellation guards prevent late session responses or transport opening
from reviving a cancelled connection. Four independent transport regressions
passed on each older branch, with no new protocol features added there. Pushed
backports: 1.19.4 `7524199`, 1.18.2 `901fe82`, 1.17.1 `f1fe7a0`, 1.16.5 `7fc9c79`,
1.15.2 `b54fe09`, 1.14.4 `c6b5ed8`, 1.13.2 `1ec6af8`, 1.12.2 `a07d54d`,
1.8.9 `2f355d6`. Distributions have not been rebuilt by this source-only batch.

## Native presentation consumer repairs, 2026-11-11

Generic protocol decoding did not normalize all the fields used by Game. NBT
components now cross the legacy consumer boundary as serialized components,
preserving literal JSON-looking strings and styling. Actual handler regressions
cover chat, tab-list profiles/chat-key fields, teams/objectives/scores/removals,
boss bars, titles, death messages, registered/inline sounds and recipe-book IDs.
Configuration chat/damage registries remain available through a typed registry
view instead of falling back to missing or old registry definitions.

Command nodes now carry native flags, redirects, executable state, argument
properties and root indices into CommandTree. Particle and argument IDs come from
Mojang's native registry reports. Native `ArgumentTypeInfos` (`il`, lines 118-155)
confirms the omitted property-free style/item-slots/NBT/loot templates. Simple
particles need a void payload switch, not an error. Parameterized particles now
reach renderer consumers with block states, item stacks, vibration targets,
colors and delays; 1.20.5 entity-effect ARGB is no longer read from velocity.

Native `Explosion.finalizeExplosion` (`dbs`, lines 269-307) confirms sound volume,
pitch, server-provided particle selection and the KEEP test. The target respects
those values and applies knockback without clearing KEEP blocks. This fixes the
missing sound/particles and mismatched motion/record field names in the handoff.

The generator/oracle gate and all 117 target tests pass; the browser code bundles.
The isolated vanilla 1.20.6 probe again decodes 45 chunks and confirms control
replies. This batch has no applicable older-target backport: these are adapters
between the new protocol/registry formats and established consumers. P13 remains
partial: new content/renderers, native GUI resources, number-format rendering,
full command argument behavior, signing/reporting and visual acceptance remain.

## GUI sprites, resource packs and Eagler handoff repairs, 2026-11-11

The missing title/menu/hotbar was a real target migration defect. 1.20.6 does not
ship the old `gui/widgets.png` or `gui/icons.png` sheets. HUD consumers now sample
the actual target GUI sprites, including native resource-pack replacements;
buttons/sliders use stretch/tile/nine-slice metadata. The logo follows the exact
`LogoRenderer` (`fhx`) virtual dimensions: 256x44 from a 256x64 logical image,
with the 128x14 edition banner. It no longer crops pieces from the old logo sheet.
Native checkbox, toast, spectator and boss-bar sprites are mapped too. Required
sprites/scaling metadata preload before the title screen, using one metadata
bundle rather than requesting nonexistent `.mcmeta` files individually. Resource
metadata belongs to the pack supplying the PNG; malformed tile sizes are rejected.

UUID server pack pushes/pops now reach Game in Configuration and Play. The loader
supports an ordered stack, replacement/removal during concurrent downloads, native
status replies in the currently active protocol phase, required prompts, reload
failure recovery and stale-download cancellation. It uses the native 250 MiB
limit (`DownloadedPackSource$4`, `0xFA00000`) and target version headers. Native
`ServerPackManager` (`grv`) and `ServerboundResourcePackPacket.Action` (`aas$a`)
were inspected for ordering, status codes and removal semantics. P10 is partial:
atlas sources/palette permutations, overlays, font references/filter/Unihex and
all-screen pixel acceptance still need work.

Both reported public WebSocket endpoints negotiate protocol 766. Arch sends
Configuration after the Eagler handshake, while the old Connection path assumed
Play. EaglerSocket766 now reuses the native Configuration/Play state machine
without TCP length/compression framing or a duplicate Login Acknowledged (the
server supplies it). A real WebSocket regression verifies that boundary. The
live join also exposed an unimplemented `restBuffer` leaf used by custom payloads;
it is now decoded normally and late packets are ignored after close.

Upstream evidence is `lax1dude/eaglerxserver` commit
`3822c777a960a15e519372399ccfda9190ad73ae`: `core/src/main/java/net/lax1dude/eaglercraft/backend/server/base/pipeline/WebSocketEaglerInitialHandler.java`
(`enterPlayState`, Login Acknowledged at lines 646-653) and
`core/src/main/java/net/lax1dude/eaglercraft/backend/server/base/handshake/VanillaInitializer.java`
(encryption-request rejection at lines 110-130). Source:
https://github.com/lax1dude/eaglerxserver/tree/3822c777a960a15e519372399ccfda9190ad73ae

A disposable real Chrome client rendered the corrected main menu and survival
HUD, joined the isolated vanilla fixture with 45 chunks, and joined
`wss://mc.arch.lol` with 49 chunks and no recorded client errors. Arch's normal
registration prompt was shown; the test did not register an account or send chat
commands. WebMC returned `Your client does not support online mode` before
Configuration, matching the upstream backend's rejection of encryption requests.
That rejection remains open; no account-backed success or server change is claimed.
Cache-local screenshots/logs are in `cache/port-1.20.6/review-session/`.

The complete native generator/oracle gate plus 133 regressions pass. An asset
build with `--audio=copy` produced 13,253 files (~626.6 MiB) before adding the GUI
metadata bundle; original audio was retained because this host lacks ffmpeg.
The browser code also bundles successfully. This is validation output, not a
published all-version distribution. Full 1.20.6 parity remains explicitly open.

Applicable shared fixes were pushed separately. Eagler brand/version diagnostics
are corrected on all older targets; flattened-ID clients (1.13.2+) now resolve
the recipe-toast crafting table by native name instead of the obsolete ID 58.
The 1.8.9 client has no recipe toast, and 1.12.2's native ID 58 remains correct.
Backport checks: eight tests each on 1.13.2-1.19.4, seven each on 1.8.9/1.12.2.
Latest pushed heads: 1.19.4 `601b181`, 1.18.2 `32a358a`, 1.17.1 `6096692`,
1.16.5 `10b4fe9`, 1.15.2 `e96e276`, 1.14.4 `1824ef1`, 1.13.2 `135ee4e`,
1.12.2 `ac3e106`, 1.8.9 `e55635e`.

A final identity audit also found that the shared GUI metadata still identified
1.19.4 / resource format 13, affecting F3 and resource-pack compatibility warnings.
Those identity fields now match the pinned 1.20.6 / format 32 jar and have a native
regression. The retained option arrays remain explicitly marked as awaiting the
P13 target layout audit; changing identity does not establish layout parity.
