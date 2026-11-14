# Full-parity checklist — MinecraftJS 1.20.6

Updated 2026-11-14. Audited source: `eb6440fa6328a8480008b22b559a5a2ade35abae`. **Full multiplayer parity: no. Full Java-client parity: no.**

Edit [docs/parity-checklist-1.20.6.json](parity-checklist-1.20.6.json), then run `node tools/port-1.20.6/parity-status.mjs --write`. This file is generated; `--check` catches stale counts, invalid evidence paths and false completion claims.

## How far along?

The native multiplayer foundation works. Substantial feature and acceptance work remains, including confirmed missing consumers. Existing transition milestones: **7 done, 5 partial, 5 todo** (17 total). They differ greatly in size, so this is not a completion percentage.

| Scope | Accepted checkpoints | Partial | Missing implementation | Needs verification | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Native multiplayer + enabled native experiments | 12 | 29 | 21 | 15 | 77 |
| Separate products / optional compatibility | 0 | 2 | 2 | 0 | 4 |
| All tracked checkpoints | 12 | 31 | 23 | 15 | 81 |

These **checkpoints differ in size and do not enumerate every defect**. 65 required checkpoints are still open. An honest percentage or ETA is unavailable until release coverage is triaged. Accepted rows cover exactly their named scope, not an entire subsystem.

Last recorded source gate: **162 target tests + 81 foliage backport tests**, zero failures/skips. See [docs/foliage-parity-1.20.6.md](foliage-parity-1.20.6.md). This audit does not claim a new exhaustive gameplay, native FPS or physical-audio run.

## What the source audit actually found

- A Java-generated sword fixture decodes damage 37, but `Items.damage` reads 0; the custom-name fixture has no legacy NBT view. Effective component data exists but is not connected to major old item consumers. Run `node tools/port-1.20.6/audit-parity-consumers.mjs` for the read-only item diagnostic.
- Font loading has no reference/filter/Unihex paths. The modern default font cannot be considered accepted from existing TTF support.
- Armadillo model selection currently falls through to null; wolf rendering ignores the new variant registry and lacks armor layers.
- Signs still use old text fields/front-side editing; decorated pots and display entities lack dedicated rendering consumers.
- Score packets decode new fields while the scoreboard retains only numeric values. Jigsaw still has an older three-field editor.
- Fabulous **has an implementation**. The remaining task is exact-target routing/scene validation; older prose saying it is wholly absent is stale.

## Work order

1. **P0:** component consumers, native fonts, sign data/editor and core menu correctness. Preserve working join/Creative/foliage gates.
2. **P1:** resource overlays/atlases, stable 1.20 content, Armored Paws, display/head rendering, commands/scoreboards and account signing/reporting.
3. **P2:** complete exact-version server/GUI/backend acceptance, enabled-experiment accounting, performance measurements, backports and coherent builds.
4. Keep separate product scope and optional shader/proxy work explicit; neither can stand in for missing native features.

## Checklist by area

A box is checked only for `accepted`. For each open row, implement/verify the completion criterion and attach exact-version evidence before changing status. Detailed reasons and source paths live in the JSON ledger.

### Foundation

- [x] **BASE-01 — Pinned target identity and native inputs** (P0; Accepted scope; P00). Hashes, protocol 766, data 3839 and resource/data formats 32/41 agree. Evidence/start: [tools/port-1.20.6/target.json](../tools/port-1.20.6/target.json), [tools/port-1.20.6/prepare.mjs](../tools/port-1.20.6/prepare.mjs).
- [x] **BASE-02 — Native registries, visual shapes and model extraction** (P0; Accepted scope; P02). Reproduce the native registry/state/model baseline; this does not certify each animation. Evidence/start: [docs/transition-1.20.6.tasks.json](transition-1.20.6.tasks.json), [tools/port-1.20.6/reports.mjs](../tools/port-1.20.6/reports.mjs).
- [x] **BASE-03 — Anonymous NBT and native text component codecs** (P0; Accepted scope; P03). Native valid/rejected component vectors and live /locate remain correct. Evidence/start: [tools/port-1.20.6/component-fixtures.json](../tools/port-1.20.6/component-fixtures.json), [tools/test-1.20.6-primitives.mjs](../tools/test-1.20.6-primitives.mjs).
- [x] **BASE-04 — All 56 item-component wire types and native defaults** (P0; Accepted scope; P04). Native stack bytes, defaults, removals and nested stacks round-trip. Evidence/start: [tools/test-1.20.6-components.mjs](../tools/test-1.20.6-components.mjs), [tools/port-1.20.6/stack-fixtures.json](../tools/port-1.20.6/stack-fixtures.json).
- [x] **BASE-05 — Configuration, exact known packs and registry replacement** (P0; Accepted scope; P05). Keep Configuration generations isolated and matching known-pack resolution correct. Evidence/start: [tools/test-1.20.6-configuration.mjs](../tools/test-1.20.6-configuration.mjs), [client/js/net/configuration-1.20.6.js](../client/js/net/configuration-1.20.6.js).
- [x] **BASE-06 — All 122 clientbound Play packet body decoders** (P0; Accepted scope; P06). Native packet IDs/bodies and complete payload consumption remain checked. Evidence/start: [client/js/net/play-schema-1.20.6.js](../client/js/net/play-schema-1.20.6.js), [tools/test-1.20.6-play.mjs](../tools/test-1.20.6-play.mjs).
- [x] **BASE-07 — Graphical native join, movement and death/respawn milestone** (P0; Accepted scope; P07). Local fixture renders terrain/HUD/entities, moves and completes death/respawn without decoder errors. Evidence/start: [docs/development-1.20.6.md](development-1.20.6.md), [docs/transition-1.20.6.tasks.json](transition-1.20.6.tasks.json).
- [x] **BASE-08 — Creative tab populations and component-preserving stack transfer** (P0; Accepted scope; P08). Every enabled tab renders; native server accepts the component-bearing book placement. Evidence/start: [tools/test-1.20.6-creative.mjs](../tools/test-1.20.6-creative.mjs), [client/js/gui/creative-data-1.20.6.js](../client/js/gui/creative-data-1.20.6.js).
- [x] **BASE-09 — Grass/cherry/azalea and native biome color correction** (P0; Accepted scope; P10). Native colors, colormaps and registry IDs agree; no claim about all weather/fog. Evidence/start: [docs/foliage-parity-1.20.6.md](foliage-parity-1.20.6.md), [tools/test-1.20.6-foliage.mjs](../tools/test-1.20.6-foliage.mjs).
- [x] **BASE-10 — Menu redesign foundation and six-pass blur** (P0; Accepted scope; P13). Keep the listed native geometry/blur cases green; exceptional screens stay open below. Evidence/start: [docs/ui-parity-1.20.6.md](ui-parity-1.20.6.md), [tools/test-menu-blur-browser.mjs](../tools/test-menu-blur-browser.mjs).
- [x] **BASE-11 — UUID server-pack lifecycle implementation** (P0; Accepted scope; P10). Retain the tested lifecycle semantics; native pack content/overlays and live combinations remain open. Evidence/start: [client/js/game/serverpacks-1.20.6.js](../client/js/game/serverpacks-1.20.6.js), [tools/test-1.20.6-serverpacks.mjs](../tools/test-1.20.6-serverpacks.mjs).
- [x] **BASE-12 — Selection arrows, title-icon centering and decoder presentation** (P0; Accepted scope; P13). Native arrow regions and JS error identity remain correct without invented Java stack frames. Evidence/start: [tools/test-1.20.6-ui.mjs](../tools/test-1.20.6-ui.mjs), [tools/test-1.20.6-decode-errors.mjs](../tools/test-1.20.6-decode-errors.mjs).

### Fonts and resources

- [ ] **FONT-01 — Recursive font reference providers** (P0; Missing implementation; P10). Resolve default/custom font reference graphs with pack precedence, cycle handling and fallback. Evidence/start: [client/js/gui/font-providers.js](../client/js/gui/font-providers.js).
- [ ] **FONT-02 — Unihex providers and asset-index font resources** (P0; Missing implementation; P10). Load native ZIP/hex glyphs, metrics and size overrides, including CJK and supplementary characters. Evidence/start: [client/js/gui/font-providers.js](../client/js/gui/font-providers.js), [docs/transition-1.20.6.md](transition-1.20.6.md).
- [ ] **FONT-03 — Uniform/Japanese filters and native Font Settings navigation** (P0; Missing implementation; P10). Both native font options select correct filtered providers, survive reload and appear on the native Language/Font pages. Evidence/start: [client/js/gui/font-providers.js](../client/js/gui/font-providers.js), [client/js/gui/screens/options.js](../client/js/gui/screens/options.js).
- [ ] **PACK-01 — Resource-pack overlays and resource filters** (P1; Missing implementation; P10). Default/custom packs honor format-gated overlays and filtered resources, including reload and removal. Evidence/start: [client/js/asset-source.js](../client/js/asset-source.js), [client/js/resource-models.js](../client/js/resource-models.js).
- [ ] **PACK-02 — Native atlas source JSON and paletted permutations** (P1; Missing implementation; P10). Native source families and generated trim/palette sprites resolve under custom pack overrides. Evidence/start: [client/js/render/atlas.js](../client/js/render/atlas.js), [client/js/assets.js](../client/js/assets.js).
- [ ] **PACK-03 — Default-pack priority, pack import and focus behavior** (P1; Partial; P10). Reordering Default changes effective resource priority; import/confirmation/focus match native. Evidence/start: [client/js/gui/screens/packs.js](../client/js/gui/screens/packs.js), [docs/ui-parity-1.20.6.md](ui-parity-1.20.6.md).
- [ ] **PACK-04 — Live multi-pack reload and Configuration/Play lifecycle matrix** (P2; Needs verification; P10). Native server scenarios cover stacked required/optional packs, failed downloads, transfer, cancellation and recovery. Evidence/start: [tools/test-1.20.6-serverpacks.mjs](../tools/test-1.20.6-serverpacks.mjs), [client/js/game/serverpacks-1.20.6.js](../client/js/game/serverpacks-1.20.6.js).

### Items and inventory

- [ ] **ITEM-01 — Connect damage, names and stack metadata to actual item consumers** (P0; Missing implementation; P08). Actual HUD/tooltips/use/render consumers observe added, default and explicitly removed components, not absent legacy NBT. Evidence/start: [client/js/game/items.js](../client/js/game/items.js), [client/js/net/item-components-1.20.6.js](../client/js/net/item-components-1.20.6.js).
- [ ] **ITEM-02 — Native potion/effect, spawn-egg and instrument metadata** (P0; Missing implementation; P08). Native potion names/colors/effects, spawn-egg colors and horn durations/selection match effective stack components. Evidence/start: [client/js/game/items.js](../client/js/game/items.js), [tools/port-1.20.6/creative-data.mjs](../tools/port-1.20.6/creative-data.mjs).
- [ ] **ITEM-03 — Enchantments, attributes, food, use duration and cooldown consumers** (P0; Partial; P08). Test enchanted/removed/custom components in tooltips, damage/use calculations, animation, food and cooldown behavior. Evidence/start: [client/js/game/items.js](../client/js/game/items.js), [client/js/game/interaction.js](../client/js/game/interaction.js).
- [ ] **ITEM-04 — Dye, potion, firework, map and glint item colors from components** (P1; Missing implementation; P08). GUI, held and dropped variants use native component colors and explicit glint overrides. Evidence/start: [client/js/render/item-renderer.js](../client/js/render/item-renderer.js), [client/js/game/items.js](../client/js/game/items.js).
- [ ] **ITEM-05 — Books, skull profiles, banners, bundles and container item contents** (P1; Partial; P08). Names/lore/books/profile skins/patterns/nested contents preserve native component semantics through use and reload. Evidence/start: [client/js/render/item-renderer.js](../client/js/render/item-renderer.js), [client/js/game/items.js](../client/js/game/items.js).
- [ ] **ITEM-06 — Dynamic registry holders in Creative stacks** (P1; Partial; P08). Reordered/custom registries resolve enchantments, instruments, paintings and holder-based contents by server ownership. Evidence/start: [client/js/gui/creative-data-1.20.6.js](../client/js/gui/creative-data-1.20.6.js), [tools/port-1.20.6/creative-data.mjs](../tools/port-1.20.6/creative-data.mjs).
- [ ] **MENU-01 — All workstation slot layouts, actions and component-bearing clicks** (P0; Partial; P08). All 25 menu types have native slot geometry and live pickup/split/shift/drag/number/drop/rejection checks. Evidence/start: [client/js/gui/screens/workstations.js](../client/js/gui/screens/workstations.js), [client/js/gui/screens/containers.js](../client/js/gui/screens/containers.js).
- [ ] **MENU-02 — Recipes, recipe book, ghost recipes and result previews** (P1; Partial; P08). Target serializers, special recipes, unlocks, filters, ghost/output previews and server corrections work with native components. Evidence/start: [client/js/gui/screens/workstations.js](../client/js/gui/screens/workstations.js), [client/js/game/game.js](../client/js/game/game.js).

### Interaction and physics

- [ ] **ACT-01 — Native can_break/can_place_on Adventure components** (P0; Partial; P08). Native component predicates honor tags/state/block-entity data and preserve permitted container/item interactions. Evidence/start: [client/js/game/adventure.js](../client/js/game/adventure.js), [client/js/net/item-components-1.20.6.js](../client/js/net/item-components-1.20.6.js).
- [ ] **ACT-02 — Contextual placement and prediction side effects** (P1; Partial; P08). Unsupported placement/orientation, consumption, sound/swing and authoritative rejection match native for every newly supported family. Evidence/start: [client/js/game/interaction.js](../client/js/game/interaction.js), [docs/dripleaf-placement-parity.md](dripleaf-placement-parity.md).
- [ ] **ACT-03 — 1.20.5 physics/interaction attribute combinations** (P1; Needs verification; P08). Reach/scale/step/jump/gravity/safe-fall/break-speed combinations match native, including poses and remote entities. Evidence/start: [tools/test-1.20.6-actions.mjs](../tools/test-1.20.6-actions.mjs), [client/js/game/physics.js](../client/js/game/physics.js).

### Menus and input

- [ ] **UI-01 — Title initial fade and exceptional menu/loading backgrounds** (P1; Partial; P13). Native timing/background/focus for startup, join, dimension change, credits and all exceptional screens. Evidence/start: [docs/ui-parity-1.20.6.md](ui-parity-1.20.6.md), [client/js/gui/screens/menus.js](../client/js/gui/screens/menus.js).
- [ ] **UI-02 — Options, GUI scale, tooltips and native child-page layouts** (P1; Partial; P13). Every target option has native text/order/geometry, dynamic GUI-scale bounds and working behavior at multiple sizes. Evidence/start: [docs/ui-parity-1.20.6.md](ui-parity-1.20.6.md), [client/js/gui/screens/options.js](../client/js/gui/screens/options.js).
- [ ] **UI-03 — Pause, multiplayer/safety, Controls, Chat and Accessibility screen matrix** (P2; Needs verification; P13). Native reference/layout scenarios cover all screens at multiple GUI scales and short/narrow windows. Evidence/start: [client/js/gui/screens/options.js](../client/js/gui/screens/options.js), [client/js/gui/screens/menus.js](../client/js/gui/screens/menus.js).
- [ ] **UI-04 — Keyboard focus, narration, clipboard and touchscreen defaults** (P2; Needs verification; P13). Native traversal, validation, selection/clipboard, shortcut and narration scenarios pass for each editable screen. Evidence/start: [client/js/gui/widgets.js](../client/js/gui/widgets.js), [docs/ui-parity-1.20.6.md](ui-parity-1.20.6.md).
- [ ] **UI-05 — Credits interpolation and End-poem behavior** (P2; Partial; P13). Native poem/credits appearance, timing, skip/speed controls and return/respawn behavior. Evidence/start: [client/js/gui/screens/credits.js](../client/js/gui/screens/credits.js), [docs/ui-parity-1.20.6.md](ui-parity-1.20.6.md).
- [ ] **UI-06 — Native jigsaw editor fields and packet values** (P1; Missing implementation; P13). Native 1.20.6 jigsaw name/target/pool/joint/priorities/generation controls and server updates match. Evidence/start: [client/js/gui/screens/jigsaw.js](../client/js/gui/screens/jigsaw.js), [client/js/net/packets.js](../client/js/net/packets.js).
- [ ] **UI-07 — F3, HUD, bossbars, toast and advancement presentation acceptance** (P1; Partial; P13). Native target information and layouts remain correct across dimensions, effects, game modes and resource reloads. Evidence/start: [client/js/game/game.js](../client/js/game/game.js), [tools/test-1.20.6-presentation.mjs](../tools/test-1.20.6-presentation.mjs).

### Text, commands and accounts

- [ ] **CHAT-01 — Command syntax for target component items and new argument types** (P1; Partial; P13). Native parser oracle covers modern item/component predicates, selectors, suggestions, errors, ranges and server completions. Evidence/start: [client/js/game/commands.js](../client/js/game/commands.js), [client/js/net/play-codec-1.20.6.js](../client/js/net/play-codec-1.20.6.js).
- [ ] **CHAT-02 — Scoreboard number formats and per-score display text** (P1; Missing implementation; P13). Blank/styled/fixed number formats, optional display names, resets and updates render like native. Evidence/start: [client/js/game/scoreboard.js](../client/js/game/scoreboard.js), [client/js/net/play-codec-1.20.6.js](../client/js/net/play-codec-1.20.6.js).
- [ ] **CHAT-03 — Incoming chat trust, deletion, filtering and registry decorations on 766** (P1; Partial; P13). Native target certificates/chains/decorations/acks/deletion/filtering produce correct trust UI without trusting system messages as signed player chat. Evidence/start: [client/js/net/chat-verifier-1.19.4.js](../client/js/net/chat-verifier-1.19.4.js), [client/js/net/chat-state-1.20.6.js](../client/js/net/chat-state-1.20.6.js).
- [ ] **CHAT-04 — Authenticated outgoing chat and signed command arguments** (P1; Missing implementation; P09). Real account session sends native session updates and valid chat/command signatures with native acknowledgements. Evidence/start: [client/js/net/chat-state-1.20.6.js](../client/js/net/chat-state-1.20.6.js), [docs/parity-status-all-versions.md](parity-status-all-versions.md).
- [ ] **CHAT-05 — Reportable logs and authenticated report submission** (P1; Missing implementation; P13). Native report selection/context/reasons and authenticated submission/cancellation/error handling are accepted. Evidence/start: [client/js/gui/screens/social.js](../client/js/gui/screens/social.js), [docs/social-account-parity.md](social-account-parity.md).
- [ ] **CHAT-06 — Social history, account blocking and narrated interactions** (P2; Partial; P13). Real account block list and native history/search/offline rows/focus/narration behave correctly. Evidence/start: [client/js/gui/screens/social.js](../client/js/gui/screens/social.js), [docs/social-account-parity.md](social-account-parity.md).

### Network and session acceptance

- [ ] **NET-01 — Packet-to-consumer coverage for all 122 Play IDs** (P1; Partial; P06). Each native packet has a tested semantic consumer or a documented native no-op; include bundles/reconfiguration edge cases. Evidence/start: [client/js/net/play-codec-1.20.6.js](../client/js/net/play-codec-1.20.6.js), [client/js/game/game.js](../client/js/game/game.js).
- [ ] **NET-02 — Real authenticated/encrypted 1.20.6 account login** (P1; Needs verification; P09). User-authorized real account session completes encryption/authentication and normal gameplay; do not fabricate this acceptance. Evidence/start: [docs/development-1.20.6.md](development-1.20.6.md), [tools/test-login-transport.mjs](../tools/test-login-transport.mjs).
- [ ] **NET-03 — Real transfer/reconfiguration/custom-registry server sequence** (P1; Needs verification; P09). Two controlled servers transfer/reconfigure repeatedly with correct inventory/chat/cookies/packs/registries and no stale state. Evidence/start: [tools/test-1.20.6-session.mjs](../tools/test-1.20.6-session.mjs), [client/js/net/configuration-1.20.6.js](../client/js/net/configuration-1.20.6.js).
- [ ] **NET-04 — Cancellation, timeouts, disconnects and reconnect stress** (P2; Needs verification; P09). Native phase-specific recovery and cleanup pass repeated real connection/loading/error/reconnect scenarios. Evidence/start: [tools/test-login-transport.mjs](../tools/test-login-transport.mjs), [tools/test-1.20.6-decode-errors.mjs](../tools/test-1.20.6-decode-errors.mjs).

### Trails and Tales

- [ ] **CONTENT-01 — Two-sided and hanging sign rendering/editing/wax state** (P0; Missing implementation; P11). Both sides, hanging/standing/wall transforms, dye/glow/wax/filtering and native edit screen update the correct side. Evidence/start: [client/js/gui/screens/sign.js](../client/js/gui/screens/sign.js), [client/js/render/tile-renderer.js](../client/js/render/tile-renderer.js).
- [ ] **CONTENT-02 — Archaeology brushing and suspicious-block client presentation** (P1; Missing implementation; P11). Brush/cancel timing, stages, displayed item, sounds/particles and authoritative result match native. Evidence/start: [client/js/game/interaction.js](../client/js/game/interaction.js), [client/js/render/tile-renderer.js](../client/js/render/tile-renderer.js).
- [ ] **CONTENT-03 — Decorated pot textures, contents, wobble and events** (P1; Missing implementation; P11). Sherd faces, stored item insertion/feedback, wobble/projectile break and reconnect use native block-entity data; no invented GUI. Evidence/start: [client/js/render/tile-renderer.js](../client/js/render/tile-renderer.js).
- [ ] **CONTENT-04 — Chiseled bookshelf hit-slot/contents interactions** (P1; Partial; P11). Every shelf slot/rotation, insertion/removal and server rejection/reload matches native. Evidence/start: [client/js/game/interaction.js](../client/js/game/interaction.js), [client/js/render/tile-renderer.js](../client/js/render/tile-renderer.js).
- [ ] **CONTENT-05 — Smithing templates, trim previews and worn armor layers** (P1; Partial; P11). Upgrade/trim recipes, template slots, native preview, dyed/worn armor and pack-provided trim textures work. Evidence/start: [client/js/gui/screens/workstations.js](../client/js/gui/screens/workstations.js), [client/js/render/entity-renderer.js](../client/js/render/entity-renderer.js).
- [ ] **CONTENT-06 — Camel poses, transitions, dash and two-passenger riding** (P1; Partial; P11). Native sit/stand/dash transitions, rider offsets/control and held/equipped state match real server metadata. Evidence/start: [client/js/render/wild-mobs-1.19.4.js](../client/js/render/wild-mobs-1.19.4.js), [client/js/game/entities.js](../client/js/game/entities.js).
- [ ] **CONTENT-07 — Sniffer states, eggs/plants and associated effects** (P1; Partial; P11). Native state changes, baby proportions, egg stages, plants, sounds/particles and reload match; AI/growth stay server-owned. Evidence/start: [client/js/render/wild-mobs-1.19.4.js](../client/js/render/wild-mobs-1.19.4.js), [client/js/game/entities.js](../client/js/game/entities.js).
- [ ] **CONTENT-08 — Cherry/bamboo construction, rafts and new block placement families** (P2; Needs verification; P11). Target doors/trapdoors/fences/stairs/rafts and all new plants have native placement, collision, sounds and passenger transforms. Evidence/start: [docs/foliage-parity-1.20.6.md](foliage-parity-1.20.6.md), [client/js/game/interaction.js](../client/js/game/interaction.js).
- [ ] **CONTENT-09 — Calibrated sensors, resonance and target vibration effects** (P1; Partial; P11). Native server events produce correct routes/delays/frequencies/textures/sounds without adding unrelated shrieker rings. Evidence/start: [client/js/render/particles.js](../client/js/render/particles.js), [docs/parity-fix-tasks-1.19.4.md](parity-fix-tasks-1.19.4.md).
- [ ] **CONTENT-10 — Updated bat, shield pose, entity names and pearl feedback** (P2; Partial; P11). Each changed presentation family has exact-target state/animation/visual evidence. Evidence/start: [client/js/render/entity-models.js](../client/js/render/entity-models.js), [client/js/render/entity-renderer.js](../client/js/render/entity-renderer.js).

### Armored Paws

- [ ] **PAWS-01 — Armadillo model, metadata, roll/unroll and brushing effects** (P1; Missing implementation; P12). Native standing/rolled/transitions/baby model, metadata, scute/brush effects and sounds render correctly. Evidence/start: [client/js/render/entity-renderer.js](../client/js/render/entity-renderer.js), [client/js/game/entities.js](../client/js/game/entities.js).
- [ ] **PAWS-02 — All wolf variants and variant-specific textures/layers** (P1; Missing implementation; P12). All nine server-selected variants retain native tame/angry/collar/baby state through updates and reload. Evidence/start: [client/js/render/entity-renderer.js](../client/js/render/entity-renderer.js), [client/js/game/entities.js](../client/js/game/entities.js).
- [ ] **PAWS-03 — Wolf armor, dye and damage layers with repair/removal feedback** (P1; Missing implementation; P12). Native body equipment, cracks/dye, repair/shears removal, component copying and effects match server state. Evidence/start: [client/js/render/entity-renderer.js](../client/js/render/entity-renderer.js), [client/js/game/items.js](../client/js/game/items.js).
- [ ] **PAWS-04 — Horse/llama body equipment and final 1.20.6 inventory hotfix** (P1; Needs verification; P12). Horse/trader-llama inventory and armor/body equipment survive updates/rejoin; replay MC-271109 client-visible case. Evidence/start: [client/js/gui/screens/containers.js](../client/js/gui/screens/containers.js), [client/js/render/entity-renderer.js](../client/js/render/entity-renderer.js).

### Inherited rendering and effects

- [ ] **RENDER-01 — Block/item/text display entities and interpolation** (P1; Missing implementation; P14). Native transforms, billboard/light/shadow/text/background/culling and tick interpolation update correctly. Evidence/start: [client/js/render/entity-renderer.js](../client/js/render/entity-renderer.js), [client/js/game/entities.js](../client/js/game/entities.js).
- [ ] **RENDER-02 — Powered dragon/piglin head animation** (P1; Missing implementation; P14). Redstone/note events animate eligible heads at native timing and survive block updates/reload. Evidence/start: [client/js/render/tile-renderer.js](../client/js/render/tile-renderer.js).
- [ ] **RENDER-03 — Exact 1.20.6 Fabulous routing/composition and resource overrides** (P2; Needs verification; P14). Compare exact 1.20.6 shader/render routing and real scenes on WebGL2/WebGPU/software including reload/resize. Evidence/start: [client/js/render/fabulous.js](../client/js/render/fabulous.js), [docs/fabulous-rendering.md](fabulous-rendering.md).
- [ ] **RENDER-04 — Floating boat/chest-boat walking and constrained camera behavior** (P2; Needs verification; P14). Same native/server scene proves stable collision/support and native camera limits; do not claim an old report is reproduced now. Evidence/start: [docs/parity-status-all-versions.md](parity-status-all-versions.md), [client/js/game/physics.js](../client/js/game/physics.js).
- [ ] **RENDER-05 — Sky, fog, weather, water, altitude and lighting transitions** (P2; Needs verification; P14). Exact target dimension/biome/altitude/status-effect scenarios match native across reload and all backends. Evidence/start: [client/js/render/entity-renderer.js](../client/js/render/entity-renderer.js), [client/js/game/game.js](../client/js/game/game.js).
- [ ] **FX-01 — Every client-owned sound trigger and target sound mappings** (P1; Partial; P13). Audit success/failure/player-excluded triggers and physical playback; do not count registry entries as behavior acceptance. Evidence/start: [docs/client-sound-trigger-audit.md](client-sound-trigger-audit.md), [client/js/game/items.js](../client/js/game/items.js).
- [ ] **FX-02 — Particle parameters, physics, new effects and item-use bursts** (P1; Partial; P13). Native type parameters, motion/collision/tints/lifetime and target damage/use/brush/armor effects match. Evidence/start: [client/js/render/particles.js](../client/js/render/particles.js), [client/js/net/play-codec-1.20.6.js](../client/js/net/play-codec-1.20.6.js).
- [ ] **FX-03 — Server tick/freeze/step presentation** (P2; Partial; P13). Native freeze/step/rate scenes update entities, particles, interpolation and UI correctly without breaking real-time controls. Evidence/start: [client/js/game/game.js](../client/js/game/game.js).

### Acceptance and release

- [ ] **VERIFY-01 — Disposition every release topic and fix reference** (P1; Partial; P01). Each non-heading topic, MC fix and unkeyed fix gets client/server/experiment/product/superseded disposition and linked evidence. Evidence/start: [docs/transition-1.20.6.release-index.json](transition-1.20.6.release-index.json).
- [ ] **VERIFY-02 — Whole-target native server scenario matrix** (P2; Needs verification; P15). All required content/menu/interaction sequences and hotfix cases pass on disposable native 1.20.6 fixtures. Evidence/start: [docs/native-acceptance.md](native-acceptance.md), [docs/transition-1.20.6.tasks.json](transition-1.20.6.tasks.json).
- [ ] **VERIFY-03 — WebGL2, WebGPU and software visual acceptance** (P2; Needs verification; P15). Representative identical scenes, resource changes, depth/transparency/lighting and adapter switching pass target references. Evidence/start: [tools/test-menu-blur-browser.mjs](../tools/test-menu-blur-browser.mjs), [tools/test-fabulous-browser.mjs](../tools/test-fabulous-browser.mjs).
- [ ] **VERIFY-04 — Frame-time, memory and rendering performance on representative hardware** (P2; Needs verification; P15). Capture CPU/GPU/frame-time/memory under matched settings and high view distance; record hardware and measured limits. Evidence/start: [docs/visual-parity-and-performance-todo.md](visual-parity-and-performance-todo.md).
- [ ] **VERIFY-05 — Every shared fix reviewed/backported to native eligible targets** (P2; Partial; P16). For each change record eligibility, native differences, target commit and relevant regressions; never import later features. Evidence/start: [docs/foliage-parity-1.20.6.md](foliage-parity-1.20.6.md), [docs/parity-status-all-versions.md](parity-status-all-versions.md).
- [ ] **VERIFY-06 — Coherent static/offline distributions from validated source heads** (P2; Missing implementation; P16). Build sources/assets/source SHAs/manifest/checksums together and smoke-test both static and offline artifacts. Evidence/start: [docs/transition-1.20.6.tasks.json](transition-1.20.6.tasks.json), [README.md](../README.md).

### Enabled native experiments

- [ ] **EXP-01 — Bundles and trade-rebalance experiment acceptance** (P2; Partial; P15; experiment). Both enabled/disabled cases match target behavior with native components and server-owned trades. Evidence/start: [client/js/gui/creative-data-1.20.6.js](../client/js/gui/creative-data-1.20.6.js), [client/js/game/bundle.js](../client/js/game/bundle.js).
- [ ] **EXP-02 — Update 1.21 content available inside the 1.20.6 jar** (P2; Partial; P15; experiment). Keep default stable catalogs clean; explicitly accept enabled crafter/trial/vault/breeze/mace and related target-native experiments without later 1.21 behavior. Evidence/start: [client/js/gui/creative-data-1.20.6.js](../client/js/gui/creative-data-1.20.6.js), [client/js/render/entity-renderer.js](../client/js/render/entity-renderer.js).

### Other product scope

- [ ] **PRODUCT-01 — Integrated singleplayer, world creation and local simulation** (P3; Missing implementation; P15; product). Separate product implementation/acceptance is required for literal full Java-client parity. Evidence/start: [README.md](../README.md), [client/js/gui/screens/menus.js](../client/js/gui/screens/menus.js).
- [ ] **PRODUCT-02 — Native Realms and account-backed services outside multiplayer baseline** (P3; Missing implementation; P15; product). Implement/test native Realms and remaining applicable services, or label the result multiplayer-only parity. Evidence/start: [README.md](../README.md), [client/js/gui/screens/menus.js](../client/js/gui/screens/menus.js).

### Optional compatibility

- [ ] **EXTRA-01 — Full OptiFine shader-pack render graphs/reflections/shadows** (P3; Partial; P15; optional). Track actual pack-stage support separately; never substitute synthetic effects for unsupported pack programs. Evidence/start: [client/js/render/shader-pack.js](../client/js/render/shader-pack.js), [client/js/render/shader-stages.js](../client/js/render/shader-stages.js).
- [ ] **EXTRA-02 — Eagler/Wisp/proxy interoperability outside native protocol** (P3; Partial; P15; optional). Track real server/proxy regressions and protocol extensions separately from vanilla server acceptance. Evidence/start: [docs/development-1.20.6.md](development-1.20.6.md), [client/js/net/wisp.js](../client/js/net/wisp.js).

## Release-history coverage: separate from implementation counts

The existing index has 415 topic/heading entries, including 318 non-heading topics and 97 structural headings. There are 806 MC-fix references and 1 unkeyed fix entry. These are references to classify, **not that many missing client features**; many are server-owned, superseded or experimental. Existing selected source reviews do not replace per-entry mappings.

| Reference family | Indexed | Mapped to disposition/tasks | Still unmapped |
| --- | ---: | ---: | ---: |
| topics | 318 | 9 | 309 |
| fixes | 806 | 0 | 806 |
| unkeyedFixes | 1 | 0 | 1 |

Use the existing [docs/transition-1.20.6.release-index.json](transition-1.20.6.release-index.json) and the `releaseReview` maps in the JSON ledger. Topic keys are `release|path joined with / including spaces|duplicate ordinal` (the script uses `path.join(' / ')`); fix keys are `release|MC-id`. Run `node tools/port-1.20.6/parity-status.mjs --unmapped` to list every outstanding reference key. Record accepted, client work, pending client acceptance, server-owned, excluded, superseded or not-applicable, with evidence and checkpoint IDs. A server-owned change is not automatically irrelevant to rendering/UI/inventory synchronization.

## Older versions and publication

All nine older branches remain **not certified for full parity**. Their latest known feature backlogs are summarized in [docs/parity-status-all-versions.md](parity-status-all-versions.md); those historical rows were not freshly gameplay-audited here. The latest foliage backport heads and native eligibility remain in Git and [docs/foliage-parity-1.20.6.md](foliage-parity-1.20.6.md). Review each subsequent shared fix against every eligible branch, preserving native differences.

Published distributions have not been regenerated from this checkpoint. Full Java-client equality additionally requires the separately listed singleplayer/Realms products. Shader packs, zoom, dynamic lights and Eagler/Wisp extensions are optional compatibility work, not vanilla feature evidence.
