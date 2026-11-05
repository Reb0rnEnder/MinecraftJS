# Full-scope parity review: Java 1.19.4

Reviewed 2026-11-05. **Full parity is not achieved.** This report covers the
client's major subsystems, confirmed implementation gaps, release boundaries
and the reference checks still needed. It is not an exhaustive comparison of
every Java method, screen pixel, sound trigger or possible server sequence.

The reference is the pinned Java 1.19.4 client, protocol 762, with client SHA-1
`958928a560c9167687bea0cefeb7375da1e552a8` and mappings SHA-1
`f14771b764f943c154d3a6fcb47694477e328148`. Native classes below use official
mapped names and their exact obfuscated names. CFR source stays in ignored
`cache/port-1.19.4/audit/decompiled/`; the repeatable source index records class
hashes. There are 55 indexed classes; indexing is not behavioral validation.

## Confirmed open findings, in implementation order

P1 denotes missing gameplay/protocol behavior; P2 denotes presentation or
specialized content behavior. These are findings, not claims of shipped fixes.

| ID | Priority | Native reference and current discrepancy | Acceptance needed |
| --- | --- | --- | --- |
| NET-1 | P1 | `ClientboundInitializeBorderPacket` (`wn`), `ClientboundSetBorderLerpSizePacket` (`xz`) and `ClientboundPlayerLookAtPacket` (`xm`): all three packet bodies return `unsupported` in `protocol-1.19.4.js`. | Valid native wire fixtures with complete consumption, followed by actual border updates and `/tp ... facing` application. Look-at must handle source/target anchors, missing target fallback and current/previous angles. |
| WORLD-1 | P1 | `WorldBorder` (`ddi`): Game stores a center and radius, but lerp jumps immediately to the destination. No border wall renderer or border collision path was found in world/render/physics. HUD **does** have a static-distance warning vignette; it does not implement the native changing-border warning calculation. | Growing/shrinking/stationary borders, initialization, absolute size limits, movement collision and warning timing compared against native code and a live fixture. Decoding alone does not close this finding. |
| NET-2 | P1 | `ClientPacketListener.handleRespawn` (`fdk`, official lines 1095–1153): native replaces LocalPlayer and conditionally retains entity data/attributes. Our decoder exposes both retention bits, but `Game.on_respawn` never consumes them and reuses the player. | Every combination of the two flags, same/different dimensions, death respawn and proxy transfer; check effects, attributes, metadata, camera and riding state individually. |
| ENTITY-1 | P1 | `Display` (`bfg`) and its renderers: block/item/text displays map to kind `display`, but `EntityRenderer._build` has no display branch. Native transforms, billboard constraints, light overrides, text backgrounds and interpolation are missing. | Native server spawns of all three types; transformed/interpolated scenes, text alignment and alpha, item transforms and all supported graphics APIs. |
| USE-1 | P1 | `AdventureModeCheck` (`cdf`), `MultiPlayerGameMode` (`fdn`) and item-use paths: Adventure mining explicitly comments that `CanDestroy` is unsupported; neither `CanDestroy` nor `CanPlaceOn` is enforced by local interaction. | Native NBT block predicates, tags, state and block-entity constraints, plus absent/malformed restrictions. Rejected uses must not predict a successful break/place, swing or sound. Server protection remains authoritative. |
| CHAT-1 | P1 | Native secure-chat sessions and reporting: incoming certificate/RSA/chain verification exists, but `ChatState762.encode` always emits unsigned messages and zero signed command arguments. Account signing-key/session publication and the reporting flow are missing; the report button is disabled. | An authenticated account against secure-chat-enforcing native servers, key expiry/renewal, signed command arguments, reconnect/session resets and report evidence/context. Never fabricate a verified status. |
| CMD-1 | P2 | `ClientboundCustomChatCompletionsPacket` (`wb`), `ClientSuggestionProvider` (`fdm`): `chat_suggestions` decodes its action/entries, but Game has no handler or custom completion state. | Native ADD/REMOVE/SET behavior, union with online names, normal-chat completion and reconnection cleanup. Command-specific completion providers must retain their own behavior. |
| TEXT-1 | P2 | `KeybindContents` (`um`): native resolves a keybind component through the current binding; `gui/chat.js` prints the raw identifier, e.g. `key.jump`, in its string and styled paths. | Changed bindings, translated key names, unbound/unknown keys and consistent string/styled/hover rendering. Applies to older releases that actually have keybind components. |
| ENTITY-2 | P2 | Native `Entity.getPickRadius` (`bfh`) defaults to zero, with overrides in ItemFrame, Shulker and AbstractHurtingProjectile. Our targeting uses a generic .1 margin for entities other than the interaction entity fixed here. | Native per-class pick radii, exact ray bounds and reach/occlusion tests. Compare each older release before replacing its existing targeting margin. |
| SOUND-1 | P2 | `ClientLevel.playSeededSound`, `SimpleSoundInstance` (`fwa`) and `SoundEvent`: the packet reader retains seed and optional fixed range, but Game discards both. Sample selection uses `Math.random()` and `Sound.play` always derives attenuation distance from volume. | Native seeded sample-selection vectors and fixed/variable-range attenuation, including entity sounds. Introduce seed/range handling only where each target's native protocol supports it. |
| PACK-1 | P2 | Native atlas source loading, including `PalettedPermutations` (`ftm`): runtime resources scan PNG/model files; no atlas JSON source dispatcher or palette-generation implementation was found. Packs relying on generated sprites will not be equivalent to Java. | Native atlas source order/stacking and supported source types, generated texture names, palette alpha rules, missing resources and reloads. Preserve pre-atlas-format behavior in older targets. |
| TILE-1 | P2 | `SkullBlockRenderer` (`fkr`), dragon/piglin head models: placed skull geometry uses a fixed dragon jaw and fixed piglin ears, with no powered-animation update in the block-entity render loop. | Powered/unpowered transitions, partial ticks and native rotations. Dragon-head support applies to eligible older targets; piglin heads remain gated by the 1.20 experiment in 1.19.4. |

`update_view_position` also has no Game consumer. Native ClientChunkCache uses
the server-specified cache center; our residency is organized differently. This
is a confirmed missing consumer, but its visible/performance impact needs a
transfer/view-distance fixture before prescribing a change.

## Fixed during this review

Interaction entities (`Interaction`, `bfs`) registered at zero dimensions were
assigned 1×1 defaults and then overwritten by generic spawn initialization,
including `pickable=false`. Native width/height/response metadata was not applied.

The fix retains the native 1×1 defaults, applies synchronized dimensions and eye
height, uses the inherited zero pick radius and consumes Use once. A true
`response` swings; a false response still consumes the interaction without a
swing or fallback held-item/offhand use. These entities remain invisible, as in
Java. The server owns recorded attack/interaction actions.

Five regressions cover defaults, native wire metadata/deltas, ray bounds, response
semantics and spectator behavior. An isolated pinned vanilla server sent 2.5×3.5
bounds, accepted the interaction and then updated width to .75 and response to
true. No Java-client screenshot was used to infer these results.

The same correction is forwarded to the existing 1.20.6 worktree. Its native
`Interaction` (`btm`) retains the dimensions and response semantics. It is not
backported to 1.18.2 or earlier: this entity was introduced in 1.19.4. This does
not complete the separate 1.20.6 protocol/rendering transition.

## Coverage by subsystem

| Area | Evidence available | Still required beyond the confirmed findings |
| --- | --- | --- |
| Native data and release gating | All 998 block definitions, 23,725 state names/properties/defaults and 1,454 sound IDs match pinned reports. Native extracted shapes/sound types are used. Default-skin/experimental-catalog tests pass. | Correct table contents do not prove every state-dependent behavior or every resource-pack replacement. |
| Networking and server transfer | Inventory of all 111 clientbound IDs; inherited aliases accounted for. Existing chunk/biome-registry/sequence/recipe/NBT regressions pass. | Valid-body and gameplay fixtures for every packet, malformed-input limits, transfer/respawn retention and cache-center behavior. A decoder reader path is not a parity test. |
| Blocks, items and prediction | Slab/door/support/attachment/dripleaf/fluid-breaking/bundle tests and bounded native-server probes exist. Creative-sword and durability release differences are preserved. | Remaining context-dependent placement overrides, Adventure predicates, item-specific use results and rejection side effects. |
| Movement, vehicles and camera | Crawling, bubble columns, spectator flight, riding lifecycle and camera-limit regressions exist. | Floating chest-boat walking remains an open live acceptance case. Earlier mitigations failed native-server validation; they are not evidence of a fix. Test complete movement/collision traces rather than position alone. |
| Entities and block entities | Projectile/painting/preview equipment/shulker/merchant/golem-crack regressions; 52 native animation keyframe vectors in the selected suite. Interaction is fixed in this pass. | Displays, powered heads, all mob clip selection/transitions, emissive/equipment layers and entity-specific effects. Correct keyframes do not prove the right clip plays at the right time. |
| Terrain, light and effects | Native state/layer/biome/offset and terrain-particle regressions; extracted shape data. | Native light-boundary sequences, every particle/event, fog/fluid/material combinations and pixels on each graphics API. No blanket visual certification. |
| Audio | Registry/assets, state sound types, hit/break categories and gain order checked; isolated native break probe and user wire capture inspected. | Every local trigger, seeded variants, range/attenuation, streaming and physical playback. Web Audio output is not measured by a request trace. |
| Inventories, recipes and GUIs | Native recipe categories preserved; selected merchant, bundle, creative, controls, social and clipboard checks. | Every workstation action/slot synchronization; pixel layouts, focus/navigation and narration for all screen states and GUI scales. |
| Text, commands and social | Native component-format oracle; 116 command parses and seven selector-completion cases from the existing oracle; incoming verification/deletion/filter tests. | Keybind components, custom completions, all argument error/range cases, outgoing signing/reporting and complete narration/context behavior. |
| Resources and fonts | PNG/model/sound pack overlays, namespaces and bitmap/space/legacy-Unicode/TTF providers exist. | Atlas source pipelines and comprehensive pack/provider/reload acceptance. OptiFine packs and MinecraftJS Extras are extensions, not evidence of vanilla parity. |
| Distribution and performance | Existing hidden captures and bounded queue/residency fixes remain available. | Reprofile actual bottlenecks on the user's hardware when changing rendering. No 600-FPS promise, Java FPS comparison or full-memory bound is inferred here. Builds were not regenerated in this review. |

Integrated single-player, world creation and Realms are not implemented as the
Java client implements them. If “full parity” includes those products rather
than multiplayer-client behavior, they are additional substantial scope gaps.
Server-side AI, generation, drops, advancements and game rules must remain server
decisions, not client approximations.

## Release-history checks

The exact final 1.19.4 jar determines behavior even when an intermediate release
introduced and later removed a feature. In particular, do not reintroduce the
old chat-preview workflow into 1.19.4.

| History | Boundary relevant to this review |
| --- | --- |
| [1.19 Wiki](https://minecraft.wiki/w/Java_Edition_1.19) | Wild Update content needs client rendering/effects and server behavior assessed separately. The history page was restricted on this pass; its entire change list is not marked reviewed. |
| [1.19.1 official notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-1) | Allay duplication, trust indicators and reporting; duplication is server-owned. System-message gray indicators are native. |
| [1.19.2 official notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-2) | Secure-chat connectivity and social-screen fixes; no new content registry. |
| [1.19.3 official notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-3) | Default skins, creative/recipe-category and resource-format changes need their native release boundaries. |
| [1.19.4 Wiki](https://minecraft.wiki/w/Java_Edition_1.19.4), [official notes](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-4) | Interaction/display entities, accessibility and resource changes. Cherry and related 1.20 content is experimental, not enabled just because its assets exist. |

The 1.19.1–1.19.3 Wiki pages were also restricted during this pass; official
release notes were available. The 1.19.4 historical Wiki page was readable.

## Captured webmc behavior

The supplied captures identify explicit server stone-break packets following
correct local wood/dirt breaks, and a literal InteractiveChat marker inside the
combat/death text. Native playback/component parsing preserves both. Removing
those packets or replacing server text would not fix a Java parity discrepancy.
The gray bar on F3/debug messages is also native System-tag behavior. See
[the capture findings](webmc-capture-findings.md) for native-code/JVM evidence;
incoming player verification and system-message labeling are distinct.

## Repeatable checks and remaining acceptance order

```sh
node tools/port-1.19.4/reports.mjs --check
node tools/port-1.19.4/verify-protocol.mjs
node tools/port-1.19.4/review-packets.mjs
node tools/port-1.19.4/audit-native.mjs --test
# Separate terminals; the probe refuses to mutate any other server:
node tools/port-1.19.4/run-presentation-fixture.mjs
node tools/port-1.19.4/probe-interaction-entities.mjs
```

The selected suite now has **296 passes, zero failures/skips in 49 files**.
The new interaction probe passed against the pinned isolated server. Source-index,
packet inventory and probe results are written under ignored cache/audit files.
The packet inventory deliberately labels reader/handler presence without marking
native behavior validated.

The forwarded 1.20.6 interaction/chest-boat regressions pass (8 tests). Its
projectile-renderer test cannot load the absent generated entity-model bundle;
that attempted test is not reported as passing. No 1.20.6 live-server acceptance
or full port validation is claimed. Its separate 9-test native Configuration
suite also passes. Both worktrees compile as browser bundles.

Close P1 wire/state problems first, then display rendering and Adventure rules,
then authenticated chat. Close P2 content/resource/text/audio findings next.
After each change, run a native fixture or oracle plus the relevant older-target
regressions; only then perform the full GUI/entity/effect acceptance matrix.
Record each backport's native release boundary. Regenerated distributions must
update source commits, manifest and checksums together.
