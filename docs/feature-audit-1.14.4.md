# 1.14.4 feature audit — 2026-10-25

The port is **not at full 1.14.4 parity**. The native content tables are substantially complete, but several consumers still use pre-1.14 behavior. This audit covers all **151 topic headings** under Additions and Changes on the requested [1.14 reference page](https://minecraft.wiki/w/Java_Edition_1.14), plus **15 patch-behavior groups** for the actual 1.14.4 target. Every topic below has a disposition, code evidence and an acceptance scenario. This is a source/runtime audit, **not a claim that every scenario has been played**. Individual vanilla bug-ticket regressions and every bullet/recipe/AI permutation have not been certified.

## Evidence and limits

The existing suite was rerun: **56 tests passed**, with no failures or skips. Two audit checks were then added; the resulting **58-test suite passes**. The audit checks ensure the catalog has no omitted recorded topic and that the checked-in diagnostic results agree with the current runtime. They do **not** assert that known parity gaps are acceptable gameplay.

The fresh diagnostic makes **58 focused assertions: 3 positive controls pass and 55 assertions expose gaps**. These are deliberately selected checks of suspected missing adaptations, not 55 independent bugs or a representative completion percentage. Registry and visual validation are reported separately. No live gameplay, screenshot comparison or performance benchmark was performed for this audit. Earlier live-server and visual evidence remains in the linked milestone documents; its existence is not a substitute for the unexecuted acceptance scenarios below. The user's running server/world was not changed.

The pinned official client jar is SHA-1 `8c325a0c5bd674dd747d6ebaa4c791fd363ad8a9`. Native registry validation confirms:

| Data | Native / client | Result |
| --- | --- | --- |
| Blocks | 676 / 676 | All names and numeric IDs match; all have native blockstate JSON and collision entries. |
| Block states | 11,271 | All have validated native render/light/occlusion properties. |
| Inventory items | 877 / 876 | All names and IDs match; air is deliberately omitted as an inventory item. All 876 have native item model JSON. |
| Particle types | 58 / 58 | IDs match, but sprite loading and dispatch are incomplete. |
| Enchantments | 37 / 34 | Multishot, Quick Charge and Piercing are missing; Mending and Vanishing retain wrong numeric IDs. |
| Living entity adapters | 64 | Default model geometry/animation values and texture existence validate. |
| Entity/layer texture paths | 114 | Present in the pinned jar; special poses/skins are not all covered by this check. |

An asset existing or a shape being extracted does not prove its renderer, item-use path, interaction packets or animation works. The detailed machine-readable [results and full block/item inventory](feature-audit-1.14.4-results.json) preserve actual values for every probe. In particular, a passing default mob adapter check does not certify all panda genes, fox poses, ravager attacks or sleeping villagers. Comparing old client tables would also misidentify older missing entries as newly introduced content, so the coverage checks use the **target vanilla registry**, not an assumed-complete 1.13 client.

## Confirmed client gaps to address first

1. **Use and movement:** crossbows have no charge/use duration or charged model predicates; sweet berries and suspicious stew are not foods in the use-action table. Sneaking still uses height 1.65 instead of 1.5, old eye height, and no fitting-pose/crawling transition.
2. **Block/entity visuals:** none of the native wood sign names reaches the sign renderer; it also requests the removed `entity/sign.png`. Sign dye colors/editor need adaptation. Campfire food items and lectern books lack placed-block rendering. Painting rendering requests a removed combined atlas. Panda gene skins and new special mob poses require further work.
3. **Particles/effects/sound:** renderer requests the removed `particle/particles.png` rather than native per-particle sprite lists. All eight probed new particle dispatches emit nothing. Bad Omen/Hero definitions are absent from `Items.effects`; effect icon consumers still use legacy layout. Six new note instruments resolve to harp because event dispatch reads legacy bytes rather than native block-state instrument/note properties, and the entity-attached sound packet lacks a consumer. Sound-type heuristics also need comparison for new blocks.
4. **Protocol/UI interactions:** native horse inventory and open-book packets are decoded without Game handlers. Digging acknowledgements also lack a handler. Book editing uses old item IDs and obsolete custom payload save channels. Creative tag search/tag tooltips, new spawn-egg tint lookup, leather horse armor slot validation, JSON item lore and `CustomModelData` need adaptation. Recipe-book JSON ingredients ignore tags; new cooking books need a separate pass.
5. **Menus and target patches:** Accessibility/Mouse settings, full keyboard focus/navigation, pause feedback/bug buttons and deferred language application are missing; stale Snooper/VBO entries and the 1.13.2 layout table remain. Programmer Art is not exposed as a built-in selectable pack. The first-person camera still applies a pivot offset removed in 1.14.4. Native loading/progress presentation remains incomplete.

These are audit findings; **this change does not implement those remaining features**. Existing workstation/scaffolding/native-visual fixes remain covered by their tests. The next implementation should follow the groups above, closing a row only after its acceptance scenario and relevant automated checks pass. Shared defects discovered while implementing should be backported where behavior existed; 1.14 additions must stay out of older branches. This audit adds no runtime changes to backport or rebuild.

## Target-version corrections

Use the official patch notes for [1.14.1](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-14-1), [1.14.2](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-14-2), [1.14.3](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-14-3) and [1.14.4](https://www.minecraft.net/en-us/article/minecraft-java-1-14-4-released), together with the pinned jar/mappings. In particular, 1.14.3 restores crafting repair and the pre-1.14 enchanting exclusivity rules; their temporary removal in base 1.14 must not become a 1.14.4 requirement. Target poppy stew gives Night Vision. Server-owned world generation, AI, loot, raids, scheduling and datapack evaluation should be checked through received state and displayed effects, rather than reimplemented as client simulation. Singleplayer saves, Java server CLI/LWJGL and disabled Realms screens are outside current browser-client scope.

## Reproduce

From the 1.14.4 worktree, after preparing the pinned native inputs:

```sh
node tools/port-1.14.4/prepare.mjs
node tools/port-1.14.4/audit-features.mjs
node --test tools/test-1.14.4-*.mjs tools/test-shadows.mjs tools/test-font-providers.mjs tools/test-worker-snapshots.mjs
```

`audit-features.mjs` is a diagnostic: its default successful exit means the audit ran, not that parity passed. `--strict` exits nonzero for any probed gap or registry mismatch. `--write` refreshes the committed JSON after reviewing a behavior change. The reviewed topic catalog is [feature-checklist.json](../tools/port-1.14.4/feature-checklist.json); update its observations/statuses manually with new evidence. `referenceWikitextSha256` fingerprints the consulted article snapshot without committing its text. No network access or live server is needed to rerun the diagnostic once native inputs are cached.

## Complete topic matrix

- **Partial:** supporting code/data exists, with known gaps or unexecuted cases.
- **Missing:** a required client adaptation is absent or demonstrably incompatible.
- **Server-owned:** vanilla owns the behavior; the acceptance scenario still needs client/server testing. This is not a pass.
- **Unverified:** insufficient evidence to say whether the change works.
- **Not applicable:** outside currently implemented browser-client scope, not full-game parity.

No entire topic is marked verified: narrower probes/tests have stronger evidence than full end-to-end topic certification.

Topic dispositions: 21 missing, 5 not-applicable, 94 partial, 42 server-owned, 4 unverified. These counts are not a completion percentage.


### Additions — Blocks

Evidence: [tile-renderer.js](../client/js/render/tile-renderer.js); [blocks.js](../client/js/world/blocks.js); [scaffolding.js](../client/js/world/scaffolding.js); [workstations-1.14.4.js](../client/js/game/workstations-1.14.4.js); [test-1.14.4-content.mjs](../tools/test-1.14.4-content.mjs); [test-1.14.4-visual-properties.mjs](../tools/test-1.14.4-visual-properties.mjs). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Bamboo | **partial** — Native states, models, shapes and potted variant exist; growth and panda feeding are server decisions. | Plant, bone-meal, break a tall stalk, pot it, burn it and feed a panda. |
| Flowers | **partial** — All three flowers and pots are registered; wither damage is authoritative on the server. | Place cornflower, lily and wither rose; craft dyes and stew, test rose damage outside Peaceful. |
| Looms | **partial** — Routing, slots, scrolling and pattern selection have runtime tests; all live combinations are not certified. | Apply each ordinary and template pattern; repeat until six layers, shift-click outputs and check template retention. |
| Signs | **missing** — Native wood sign names are not routed to the tile renderer; old sign texture path and undyed text remain. | Place every wood standing/wall sign; edit, select, copy, paste and dye text all 16 colors; rejoin. |
| Slabs | **partial** — Native states and collision/selection data exist for the added variants; every placement combination needs visual testing. | Place all variants top, bottom, double and waterlogged; inspect occlusion, lighting and breaking overlays. |
| Stairs | **partial** — Native states and shapes exist; full rotations and corner combinations are not certified. | Place each variant in all facings, upside down, inner/outer corners and waterlogged; walk and break them. |
| Walls | **partial** — Native states and shapes exist; all adjacency combinations need visual testing. | Connect each wall to walls, glass, fences, gates and solid blocks; inspect selection and climb collision. |
| Barrels | **partial** — Native block and generic chest inventory routing exist; server controls open state and obstruction rules. | Open all six orientations under solid blocks, shift-click and transfer with hoppers; rejoin. |
| Bells | **partial** — Native model and ringing event timer are tested; raid resonance effects are incomplete. | Ring all attachments from each valid side, use projectiles, wake villagers and ring during a raid. |
| Blast furnaces | **partial** — Native furnace window routing, slots and texture are tested; server owns processing time and recipes. | Smelt ore and metal at double speed; reject food; test fuel, progress, XP and hoppers. |
| Smokers | **partial** — Native furnace variant and GUI routing are tested; full recipe/fuel combinations remain unverified. | Cook food at double speed; reject ores; test fuel, progress, XP and hoppers. |
| Cartography tables | **partial** — Menu, map-lock packet decoding and preview path exist; all live map transformations need checking. | Clone, extend and lock maps, then inspect both held maps and item frames after rejoin. |
| Fletching tables | **partial** — Block data/model exist; this version has no player crafting GUI, which is correct. | Craft/place it and confirm a villager becomes a fletcher; do not expect a later-version crafting menu. |
| Smithing tables | **partial** — Block data/model exist; this version has no player smithing GUI, which is correct. | Craft/place it and confirm a villager becomes a toolsmith; no netherite upgrade is expected. |
| Stonecutters | **partial** — Recipe sorting, menu selection, output counts and stepping have tests; every recipe needs a live pass. | Process each stone family, scroll recipes, right-click and shift-click results; stand on the block. |
| Grindstones | **partial** — Native menu routing and result consumption are tested; all curse/durability/XP cases remain unverified. | Repair and disenchant tools/books; retain curses, collect XP, test all mounting positions. |
| Lecterns | **partial** — Native book GUI/page/take controls exist; the placed book is not handled by the tile renderer. | Insert and remove a book, share pages between two clients, inspect the block book and comparator output. |
| Scaffolding | **partial** — Jump/sneak collision and falling-block mover regression are tested; full placement/collapse behavior needs a live pass. | Build vertically and six blocks horizontally, extend to falling distance, collapse and climb while sneaking. |
| Lanterns | **partial** — Native state, shape and light properties exist; pane/bar support changes need live placement checks. | Place upright and hanging, including on/below panes and iron bars; remove support and rejoin. |
| Jigsaw blocks | **partial** — Block model and state exist; no native jigsaw editor was found. | Obtain by command, edit pool/attachment/final state as an operator and test save/reload. |
| Sweet berry bushes | **partial** — All age models exist; local physics lacks berry-bush slowdown. | Plant, bone-meal and harvest each age; walk/jump through mature bushes and compare server correction/damage. |
| Campfires | **partial** — Native light, face visibility and stepping have regression tests; cooking-item renderer and smoke dispatch are absent. | Cook four foods, place hay below, extinguish/reignite, test waterlogging and burning-arrow ignition. |
| Composters | **partial** — Native fill states/models exist; composter particle packets are ignored. | Compost multiple plant types through level eight, extract bone meal, test hopper transfer and particles. |
| Note blocks | **partial** — Native event 0/0 requires instrument and note from BlockState, but dispatch reads legacy byte fields and only lists ten instruments. | Play all 16 instruments over their substrate blocks and compare pitch and note particles. |

### Additions — Items

Evidence: [items.js](../client/js/game/items.js); [container.js](../client/js/game/container.js); [item-renderer.js](../client/js/render/item-renderer.js); [enchantments.json](../client/data/enchantments.json). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| General | **partial** — BlockStateTag survives generic NBT transport, but placement prediction does not interpret it. | Give blocks with custom facing/axis/age BlockStateTag and compare immediate placement with authoritative updates. |
| Banner patterns | **partial** — Loom has all five template patterns and native ordinals; template retention needs live verification. | Use flower, creeper, skull, thing and globe templates; verify recipe/trade acquisition and reuse. |
| Crossbows | **missing** — useAction is none, useDuration is zero, charging/charged predicates are absent and enchantment registry is stale. | Charge in either hand, retain a charge in inventory, fire arrows/rockets and test Multishot, Piercing and Quick Charge. |
| Suspicious stew | **missing** — The item is registered but not classified as food; no sustained eating action starts. | Eat each flower recipe and brown-mooshroom stew; verify 1.14.4 poppy Night Vision and bowl return. |
| Dyes | **partial** — Native names/items exist; sign colors and all replacement dye actions are not certified. | Use all 16 dyes on sheep, wool, leather, banners and signs; ensure the four former ingredients no longer dye directly. |
| Sweet berries | **missing** — The item is registered but not classified as food; planting/harvesting is server-owned. | Eat berries and plant them; verify hunger, use priority on dirt and mature-bush harvesting. |
| Leather horse armor | **partial** — Item tinting is generic, but horse armor slot validation excludes leather and horse rendering needs adaptation. | Equip, dye, remove and dispense leather armor; inspect color and invisibility rendering. |
| Spawn eggs | **partial** — All seven new eggs have native item IDs; their runtime color lookup returns null. | Inspect all seven egg icons, spawn adults/babies and test EntityTag overrides without changing egg colors. |

### Additions — Mobs

Evidence: [entities.js](../client/js/game/entities.js); [entity-renderer.js](../client/js/render/entity-renderer.js); [entity-models.js](../client/js/render/entity-models.js); [villager-layers.js](../client/js/render/villager-layers.js); [test-1.14.4-visual-properties.mjs](../tools/test-1.14.4-visual-properties.mjs). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Mooshrooms | **partial** — Brown/red texture selection exists; conversion, feeding and stew outcomes are server-owned and untested here. | Summon both types, strike with lightning, feed flowers, milk stew and shear. |
| Pandas | **partial** — Native model and default texture render; personality skins, rolling/sneezing/eating poses remain incomplete. | Spawn every gene variant and babies; observe sneeze, roll, eat, breeding and unhappy behavior. |
| Pillagers | **partial** — Native living renderer exists; crossbow charging/aim poses and raid participation need completion. | Inspect patrol leader banner, load/fire poses and a raid wave; test shield interactions. |
| Ravagers | **partial** — Native model renders; attack/stun/roar poses and passenger combinations are not certified. | Observe bite, shield stun, roar and pillager/vindicator/evoker jockeys in raids. |
| Cats | **partial** — Separate cat registry and texture metadata are handled; full sleeping/lying/taming poses need testing. | Spawn all 11 coats and babies; tame, sit, sleep near player, wake and collect gifts. |
| Trader Llamas | **partial** — Native living classification and trader texture exist; leash/carpet/chest combinations need checking. | Spawn with trader, lead them, inspect decor and chests, ride and watch spit/despawn. |
| Wandering Traders | **partial** — Native model/texture render; AI, offers and invisibility transitions need a live check. | Trade all offers, inspect llamas and lead, observe night potion/milk transitions and despawn. |
| Foxes | **partial** — Native model and red/snow variants render; sleeping/crouching/pouncing and held-item poses need testing. | Observe both types sleeping, pouncing, carrying/eating items and breeding; test trusted babies. |

### Additions — World generation

Evidence: [biomes.json](../client/data/biomes.json); [chunk-1.14.4.js](../client/js/world/chunk-1.14.4.js); [test-1.14.4-chunks.mjs](../tools/test-1.14.4-chunks.mjs). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| General | **server-owned** — Chunk generation/loading policy is vanilla-server-owned; receiving native chunks is tested separately. | Travel quickly through newly generated terrain and compare lighting and terrain with a native client. |
| Bamboo Forests | **partial** — Both bamboo-jungle biome entries exist; structure and vegetation generation are server-owned. | Visit both bamboo-jungle biomes, check foliage colors, bamboo, pandas and transitions. |
| Pillager outposts | **server-owned** — Structure placement, loot and spawning are server-owned; rendering all generated contents needs a live tour. | Locate an outpost, inspect tower/cages/loot and observe pillagers and golem. |
| Villages | **server-owned** — Snowy village generation and contents are server-owned; client workstation/mob gaps apply. | Tour a newly generated snowy village and compare structures, beds, paths, mobs and workstations. |
| Zombie Villages | **server-owned** — Snowy abandoned village generation is server-owned; zombie-villager display needs live coverage. | Visit or load a snowy abandoned village, inspect cobwebs and villagers through day/night. |

### Additions — Gameplay

Evidence: [game.js](../client/js/game/game.js); [hud.js](../client/js/gui/hud.js); [advancements.js](../client/js/gui/screens/advancements.js); [packs.js](../client/js/gui/screens/packs.js); [items.js](../client/js/game/items.js). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Advancements | **partial** — Server advancement packets and generic tree/toast UI exist; new icon/text and trigger scenarios are unverified. | Earn all new crossbow, raid and trading advancements; inspect toast, icons, descriptions and persistence. |
| Illager patrols | **server-owned** — Patrol spawning and Bad Omen assignment are server-owned; new effect display is incomplete. | Encounter a patrol, kill its captain and inspect banner, effect and raid trigger. |
| Raids | **partial** — Generic boss bars work; Bad Omen/Hero runtime definitions, bell resonance and some mob poses are missing. | Run a full raid including loss/victory, all waves, boss bar, horn, glowing, discounts and gifts. |
| Resource packs | **missing** — External packs load, but the built-in Programmer Art pack is not exposed in the pack chooser. | Enable built-in Programmer Art, reorder with another pack and reload; test old-format red warning/dialog. |
| Status effects | **partial** — Native effects table includes Bad Omen and Hero; Items.effects lookup lacks both and HUD uses legacy icons. | Apply/remove both effects, trigger raid, drink milk and inspect HUD/inventory names, timers and icons. |

### Additions — Command format

Evidence: [game.js](../client/js/game/game.js); [chat.js](../client/js/gui/screens/chat.js); [tags.js](../client/js/game/tags.js). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Tags | **partial** — Native block/item/fluid tag consumption exists; the local tag cache discards entity-type tags and creative tag search is absent. | Reload block/item/entity/fluid tags; inspect F3 block tags, creative # search and command completions. |
| /loot | **server-owned** — Execution and loot evaluation belong to the server; command tree and suggestion transport exist. | Type, complete and run loot give/insert/spawn/replace with permissions and inspect outputs. |
| /schedule | **server-owned** — Function scheduling belongs to the server; no local command interpreter is required. | Complete and run schedule for a test function and inspect timed chat/block updates. |
| /teammsg | **server-owned** — Team routing is server-owned; translated chat and suggestions need live comparison. | Join two teams and compare tm/teammsg delivery, translation and hover/click metadata. |

### Additions — General

Evidence: [target.json](../tools/port-1.14.4/target.json); [splash.js](../client/js/render/splash.js); [font-providers.js](../client/js/gui/font-providers.js); [particles.js](../client/js/render/particles.js); [recipebook.js](../client/js/game/recipebook.js); [menus.js](../client/js/gui/screens/menus.js); [stats.js](../client/js/gui/screens/stats.js). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Client.jar | **partial** — Official jar/mappings are pinned and extraction is validated; root version.json metadata is present in the target jar. | Verify root version.json version, protocol and data/pack versions agree with native runtime tables and displayed client identity. |
| Death messages | **unverified** — Generic translation/chat supports server messages; each new death message has not been replayed. | Trigger new berry/firework/falling variants as applicable and compare translated text and hover data. |
| Font | **partial** — Bitmap, legacy Unicode and TTF providers have tests; complete native glyph coverage remains a visual check. | Compare added glyphs and non-Latin text; load TTF/OpenType resource packs and test fallback/Unicode mode. |
| Title screen | **missing** — The title screen has the new panorama but lacks the Accessibility entry point. | Inspect accessibility button, keyboard focus, narration and navigation to accessibility options. |
| Particles | **missing** — All native particle IDs exist, but eight new dispatches emit nothing and the legacy atlas is absent from the native jar. | Use particle commands for every native ID and compare animation, color, collision and resource-pack overrides. |
| Recipes | **partial** — Native recipe codec includes new workstation/campfire types; recipe-book JSON tags are not resolved. | Learn/craft added recipes, use all furnace books and campfire recipes, check filtering and ghost ingredients. |
| Splashes | **partial** — Splashes are loaded from native assets; individual additions have not been visually sampled. | Inspect native splash list and sample title splashes including localization/special dates. |
| Startup screen | **partial** — Startup splash still draws the old white-logo presentation without native loading progress. | Reload cached/uncached resources and compare startup progress bar, logo and fade into the main menu. |
| Statistics | **partial** — Generic statistic packets and screen exist; all new actions and entity statistics are unverified. | Use each new workstation, raid and mob interaction, then compare updated statistics after rejoin. |

### Changes — Blocks

Evidence: [blocks.js](../client/js/world/blocks.js); [world.js](../client/js/world/world.js); [physics.js](../client/js/game/physics.js); [sound.js](../client/js/audio/sound.js); [tile-renderer.js](../client/js/render/tile-renderer.js); [recipebook.js](../client/js/game/recipebook.js); [test-1.14.4-visual-properties.mjs](../tools/test-1.14.4-visual-properties.mjs). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Beds | **partial** — Native collision/selection shapes are extracted; color/sleep rendering has prior fixes but all orientations need a visual pass. | Select and collide with both halves in every orientation, sleep and break/rejoin all colors. |
| Brewing stands | **server-owned** — New village generation/job-site assignment is server-owned; existing brewing UI remains in use. | Visit a temple and assign a cleric; open brewing stand and brew with hoppers. |
| Carpets | **partial** — Native recipes are available, but tag-based ingredients break recipe-book matching. | Recolor eight white carpets around every non-white dye and inspect recipe-book filtering. |
| Cauldrons | **server-owned** — Village placement and leatherworker job assignment are server-owned. | Visit a tannery, assign a leatherworker and test water levels/dye removal. |
| Chorus flowers | **server-owned** — Projectile break/drop behavior is server-owned; client must apply block/item updates. | Shoot with arrows and tridents, inspect block disappearance, dropped flower and relog state. |
| Crops and nether wart | **partial** — Native sound assets exist; legacy local sound-type heuristics are not exhaustive. | Place/break every crop and wart; compare sound and volume against native 1.14.4. |
| Cut sandstone and cut red sandstone | **partial** — Native stonecutting recipes and menu are available; exact result recipes need live testing. | Select both cut sandstone recipes in the stonecutter and take/shift-click outputs. |
| Dispensers | **server-owned** — Shearing sheep is server-owned; animation, wool item updates and sounds need live testing. | Dispense shears at sheep, verify drops, durability and regrowth. |
| Glass | **partial** — Native support/occlusion properties exist; local placement rules are not fully certified. | Place redstone on glass and inspect support, rendering, light and power updates. |
| Grass path, mycelium, and podzol | **partial** — Native models are loaded; randomized top orientation needs a visual comparison. | Place large patches of all three blocks and compare random top rotation and lighting before/after updates. |
| Leaves | **server-owned** — Stick drop probabilities and decay are server-owned. | Break/decay leaves with and without Fortune/Silk Touch; inspect stick drops and collision. |
| Nether brick fences | **partial** — Native crafting recipes exist; recipe-book ingredient handling remains incomplete. | Craft fences with blocks plus brick items and walls with the former fence layout; compare yields. |
| Redstone dust | **server-owned** — Depowering simulation/performance is server-owned, while received power states render locally. | Toggle long redstone lines and inspect power colors and block-state updates. |
| Signs | **missing** — Oak rename is registered, but renderer routing, native textures, text colors and selection editor are stale. | Use all wood recipes, move cursor, select/copy/paste text and dye it; rejoin. |
| Smooth quartz, smooth sandstone, smooth red sandstone and smooth stone | **partial** — Native smelting recipes exist; books and all furnace interactions need verification. | Smelt all four source blocks and check recipe book, timing and output stacks. |
| Smooth stone slab | **partial** — Native item/block names and models exist; recipe-book tag handling is incomplete. | Craft from smooth stone, inspect single/double models and ensure stone produces the separate stone slab. |
| Stained glass panes | **partial** — Native recoloring recipes exist; recipe-book matching needs correction. | Surround all dyes with clear panes and inspect result count, color and recipe filtering. |
| TNT | **server-owned** — Explosion block-drop policy is server-owned. | Explode a controlled block palette and compare surviving item count and client block/light updates. |
| Transparent blocks | **partial** — Per-state native opacity/occlusion is extracted; every support and light-propagation rule is not certified. | Test slabs, stairs, snow, panes, leaves, paths and pistons for face culling, light and supported attachments. |
| Vines | **partial** — Local ladder detection accepts unsupported vines; motion and jump transitions need a server comparison. | Climb hanging vines without backing blocks, jump from them and test corners/sneaking. |

### Changes — Items

Evidence: [items.js](../client/js/game/items.js); [book.js](../client/js/gui/screens/book.js); [item-renderer.js](../client/js/render/item-renderer.js); [entity-renderer.js](../client/js/render/entity-renderer.js); [container.js](../client/js/game/container.js). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Beetroot soup | **partial** — Native shapeless recipe exists; food use predates this port but recipe-book matching is incomplete. | Craft with shuffled slots, eat and check hunger/bowl return and recipe-book placement. |
| Book and quill | **missing** — Editor uses legacy item IDs and custom-payload save channels; native open-book packets have no consumer. | Write up to 100 pages, select/copy/paste words/pages, sign in either hand, reopen and verify server persistence. |
| Dead bush | **server-owned** — Fuel acceptance/time is decided by server furnace processing. | Burn dead bushes in furnaces/smokers/blast furnaces and check progress and consumption. |
| Dye | **partial** — Native renamed items exist; use behavior relies on server and local inventory validation. | Check red/yellow/green names; reject old raw ingredients for dyeing while preserving bone-meal growth use. |
| Horse armor | **partial** — Horse rendering/slot code is inherited; invisibility and hurt-tint changes are not certified. | Equip each material, make horse invisible and damage it; verify armor stays visible without red tint. |
| Rabbit stew | **partial** — Native shapeless recipe exists; recipe-book ingredients still need adaptation. | Craft both mushroom variants in shuffled slots; eat and check bowl return. |
| Totem of undying | **partial** — Totem animation exists but custom_model_data predicate is absent. | Trigger a totem with a custom model resource pack and compare held versus activation appearance. |

### Changes — Mobs

Evidence: [entities.js](../client/js/game/entities.js); [entity-renderer.js](../client/js/render/entity-renderer.js); [villager-layers.js](../client/js/render/villager-layers.js); [physics.js](../client/js/game/physics.js); [test-1.14.4-visual-properties.mjs](../tools/test-1.14.4-visual-properties.mjs). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| General | **partial** — Native entity metadata is decoded; local sneaking dimensions are stale and full sleeping/hitbox behavior is unverified. | Compare entity hitboxes, eye positions, sleeping and forced player poses against native 1.14.4. |
| Cats and ocelots | **partial** — Separate entity routing exists; tame/trust behavior is server-owned. | Feed both species, inspect tame/trust outcomes and collar, sitting and baby states. |
| Creepers | **server-owned** — Music-disc loot conditions are server-owned. | Have skeletons and strays kill creepers and inspect drops. |
| Dolphins | **server-owned** — Dispenser armor rejection is server-owned. | Dispense armor at dolphins and verify inventory/equipment remains correct. |
| Fish | **server-owned** — Vanilla fish AI optimizations do not transfer to browser rendering. | Load schools of fish, compare movement updates and profile browser rendering separately. |
| Illusioners, players and the wither | **server-owned** — Loot table evaluation is server-owned. | Use custom loot tables for each entity type and verify received item updates. |
| Iron golem | **server-owned** — Village spawning rules include patch changes and are server-owned. | Run a working/sleeping/panicking village and inspect golem spawning and rendering. |
| Mooshrooms | **partial** — Brown variant metadata/texture exists; transformation sounds and feeding effects need live verification. | Strike each type with lightning, feed flowers and milk suspicious stew; compare sounds/textures. |
| Parrots | **unverified** — Native sound IDs exist; new imitation selection and playback have not been observed. | Place parrots near pillagers, ravagers and pandas; compare imitation sound events. |
| Phantoms | **server-owned** — Cat avoidance is server AI. | Observe phantoms near tame and stray cats and compare client interpolation. |
| Villagers | **partial** — Seven biome/profession/badge texture layers and trade packets have tests; sleep/held-offer poses and all AI transitions remain unverified. | Exercise all professions, levels, biome skins, children, work, sleep, meetings, curing and demand/restock trades. |
| Vindicators | **server-owned** — Door breaking is server AI; client receives animation and block updates. | Observe a vindicator breaking a door and compare animation/sounds and final block state. |
| Wolves | **server-owned** — Tamed-kill attribution, loot and captain Bad Omen are server-owned. | Have a tame wolf kill mobs and a raid captain; inspect loot, XP and effect updates. |

### Changes — Non-mob entities

Evidence: [entities.js](../client/js/game/entities.js); [entity-renderer.js](../client/js/render/entity-renderer.js). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Armor stands | **server-owned** — Armor stand loot-table evaluation is server-owned; rendering has an existing adapter. | Assign a custom loot table, break the stand and inspect drops/equipment and metadata poses. |
| Thrown projectiles | **partial** — Object rendering mostly chooses fixed item types; full optional Item metadata overrides need adaptation. | Summon each egg/pearl/bottle/eye/fireball/snowball with a custom Item stack and compare model/tint. |
| Minecart with TNT | **server-owned** — Explosion drop-rate changes are server-owned. | Explode a TNT minecart against a controlled palette and inspect drops, particles and block updates. |
| Paintings | **missing** — Renderer requests the removed combined atlas; native jar has separate painting sprites. | Place every motive, use an animated painting pack and inspect frame/back/lighting after rejoin. |

### Changes — World generation

Evidence: [biomes.json](../client/data/biomes.json); [chunk-1.14.4.js](../client/js/world/chunk-1.14.4.js); [entity-renderer.js](../client/js/render/entity-renderer.js). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Villages | **server-owned** — New layouts, paths, job sites and generation are server-owned; client mob/block gaps still apply. | Tour all five village styles and inspect every generated block/entity in both clients. |
| Swamp huts | **server-owned** — Black cat generation is server-owned; coat metadata has a client adapter. | Visit a fresh witch hut and inspect spawned black cat and witch. |
| Zombie villages | **server-owned** — Abandoned biome-style variants are server-owned. | Tour each abandoned village style and verify blocks, cobwebs and zombie-villager skins. |
| The Nether | **server-owned** — Nether generation changes belong to the server; biome/terrain display uses native tables. | Visit new Nether terrain and compare bedrock, terrain and block lighting with native client. |

### Changes — Command format

Evidence: [game.js](../client/js/game/game.js); [chat.js](../client/js/gui/screens/chat.js); [containers.js](../client/js/gui/screens/containers.js); [items.js](../client/js/game/items.js); [item-renderer.js](../client/js/render/item-renderer.js); [villager-layers.js](../client/js/render/villager-layers.js). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Advancements | **server-owned** — Changed predicates are evaluated by the server; advancement display is generic. | Load a test datapack using changed predicates and inspect progress, toast and descriptions. |
| Commands/NBT data | **server-owned** — Time suffixes and command NBT semantics are server-owned; input is sent as text. | Complete and execute time arguments with t/s/d and fractional values; inspect server feedback. |
| Conditions | **server-owned** — Loot entity-properties predicate evaluation is server-owned. | Exercise entity_properties predicate variants through test loot and inspect received items. |
| Creative menu | **missing** — Creative search only matches names; #tag search and matching-tag tooltips are absent. | Search #minecraft:logs and another item tag; inspect matched items and tooltip tag labels. |
| Loot tables | **server-owned** — New entries/functions/conditions are server datapack logic, not a client loot interpreter. | Exercise block/entity/dynamic/tag/sequence loot and NBT/lore functions; inspect item updates and tooltips. |
| JSON text components | **partial** — Generic chat parses server-resolved text; NBT interpretation belongs to server; JSON item lore still renders as raw text. | Use entity/block NBT text components and interpret=true, plus JSON-formatted item lore in tooltips. |
| NBT paths | **server-owned** — Multi-match paths, filters and negative indices are parsed/evaluated by server. | Run data modify/get with list/object filters, [] and negative indices and inspect feedback. |
| Villager NBT | **partial** — Structured profession/biome/level metadata maps to native layers; offers/brain NBT is server-owned. | Summon every profession/type/level and mutate VillagerData, then trade and rejoin. |
| World generator registries | **server-owned** — Generator registry and datapack validation are server-owned. | Load custom biome-related generator configuration on a separate vanilla world and inspect received terrain. |
| Zombie villager NBT | **partial** — Structured type/profession texture layers exist; offers persistence through curing is server-owned. | Summon matching VillagerData/Offers, cure and zombify, inspect skin and retained trades. |
| Other | **partial** — Server implements data/execute/locate/tag/quote changes; client custom_model_data predicate is missing. | Test command completions, modified item frames and resource-pack CustomModelData overrides. |

### Changes — Gameplay

Evidence: [physics.js](../client/js/game/physics.js); [world.js](../client/js/world/world.js); [items.js](../client/js/game/items.js); [hud.js](../client/js/gui/hud.js); [workstations-1.14.4.js](../client/js/game/workstations-1.14.4.js); [test-1.14.4-content.mjs](../tools/test-1.14.4-content.mjs); [test-1.14.4-world-light.mjs](../tools/test-1.14.4-world-light.mjs). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Crafting | **partial** — Combining damaged items was restored in 1.14.3; inherited repair logic is appropriate for target, with recipe-book gaps remaining. | Repair tools in crafting and grindstone; compare durability, enchantment loss and counts on 1.14.4. |
| Enchanting | **partial** — Protection exclusivity was restored in 1.14.3; new crossbow IDs and enchanting clue labels are incorrect. | Enchant crossbows and normal tools; compare offered clue IDs/names, costs and mutually exclusive protections. |
| Lighting system | **partial** — Separate light packets and pending chunk lifecycle have tests; directional block properties are native. | Load/unload dimensions, travel fast, edit partial blocks and compare light at borders without requiring block updates. |
| Sneaking | **missing** — Local height remains 1.65 and eye height remains pre-1.14; 1.5-block gaps are unsupported. | Sneak beneath top slabs/trapdoors; release crouch with blocked headroom and compare camera and server correction. |
| Status effects | **partial** — Effect icons still use the old atlas, and new effect runtime definitions are absent; AI detection is server-owned. | Apply all effects, inspect separate native icons and timers, and test invisible armor/entity layers. |
| Trading | **partial** — Native offer list, demand/special-price calculation, XP and repeated shift trades have tests; full restock/reputation sessions are unverified. | Trade across all five levels, exhaust/restock, cure/attack villagers and inspect prices, discounts and badges. |

### Changes — General

Evidence: [options.js](../client/js/gui/screens/options.js); [manager.js](../client/js/gui/screens/manager.js); [pause.js](../client/js/gui/screens/pause.js); [vanilla-layout.js](../client/js/gui/vanilla-layout.js); [splash.js](../client/js/render/splash.js); [narrator.js](../client/js/gui/narrator.js); [physics.js](../client/js/game/physics.js); [test-1.14.4-assets-panorama.mjs](../tools/test-1.14.4-assets-panorama.mjs). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Advancements | **partial** — Server owns changed requirements; new foods/crossbow use prevent completing some from this client. | Test Balanced Diet, Two by Two, Monster Hunter and How Did We Get Here using 1.14.4 requirements. |
| Collision code | **partial** — Native selection/collision data plus specialized scaffolding behavior are validated; new pose fitting remains stale. | Run a collision course covering every new partial block, pistons, doors, swimming, sneaking and moving entities. |
| Creative inventory | **partial** — Tabs are extracted from the native jar; tag search, new egg tinting and all special item renderers are incomplete. | Compare every tab/order including walls, search tags, tooltips, saved hotbars and all new icons. |
| Credits | **partial** — Credits are read from native text assets; full screen layout/music behavior is not visually certified. | Open credits, compare staff text, scrolling, narration, skip behavior and music. |
| Debug screen | **partial** — Existing F3/graphs are inherited; new tick min/avg/max and server chunk metrics need a dedicated comparison. | Compare F3 and Alt+F3 lines/charts with native client; server tick metrics are unavailable on ordinary remote servers. |
| Dedicated servers | **not-applicable** — This repository is a browser client/proxy; vanilla owns server.properties, EULA and server CLI changes. | Confirm external server starts with desired settings; no browser implementation of Java server CLI is required. |
| Language | **missing** — Language selection immediately calls setLanguage rather than applying on Done. | Choose several languages, cancel/Done and compare reload timing and selection behavior. |
| Loading screen | **partial** — Old splash renderer lacks a resource progress bar; chunk/loading screens need comparison. | Reload assets and connect/change dimension, comparing progress indication and transitions. |
| LWJGL | **not-applicable** — Browser WebGL/audio/input replace the Java native library; matching its version is not a browser feature. | Validate supported WebGL platform separately; no LWJGL dependency is expected. |
| Title screen | **partial** — Native panorama source hashes and runtime cube map have tests; accessibility/navigation gaps remain. | Compare all six panorama faces, rotation, title layout and button focus. |
| Menus | **missing** — Base Tab handling cycles text fields only; full button focus and Shift+Tab/list arrow navigation are absent. | Navigate every menu without a mouse using Tab, Shift+Tab, arrows, Space and Enter. |
| Narrator | **partial** — A narrator exists, but native accessibility placement and hovered/focused button narration are not certified. | Enable narration and traverse buttons, lists, chat and inventory; verify hovered/focused announcements. |
| Optimizations | **not-applicable** — World-save optimization and Nether portal chunk tickets are server/integrated-server responsibilities. | Test server portal retention separately; browser performance must be profiled rather than claiming vanilla engine optimizations. |
| Options | **missing** — Accessibility and mouse submenus are absent; obsolete Snooper remains and layout is generated for 1.13.2. | Compare all options, chat background/text opacity, scroll sensitivity/discrete scrolling and saved settings. |
| Particles | **missing** — Renderer still addresses removed particles.png; native per-particle sprite definitions are not consumed. | Override sprite lists in a resource pack; test all frames and each native particle ID. |
| Pause screen | **missing** — Give Feedback and Report Bugs buttons are absent. | Open pause menu and compare buttons, links, placement and keyboard focus. |
| Player positioning | **missing** — Local updateSize does not choose a fitting pose under blocked headroom; forced crawling is absent. | Close a trapdoor on the player, crawl under one-block gaps and return to standing only when space permits. |
| Sounds | **partial** — Native sound IDs/assets exist; new note instruments and entity-attached sound consumer are missing. | Compare new block/mob sound types, entity-attached sounds, global volume and movement while sounds play. |
| Splash | **partial** — Native splash text is loaded, but removed-string exclusion has not been independently asserted. | Check the native list excludes removed strings and sample rendered title messages. |
| Technical | **partial** — Per-state opacity, occlusion and light data is extracted and build-validated; broad light propagation needs live coverage. | Test partial faces on slabs/stairs/snow/paths/pistons/portal frames against native client lighting. |
| Textures | **partial** — Native asset source is pinned and panorama/entity textures validated; sign, particle, painting and effect consumers remain stale. | Inspect terrain/items/entities/GUI/effects with default assets and layered packs; look for missing or legacy paths. |
| Video settings | **missing** — The obsolete VBO toggle remains and the shared option order table identifies 1.13.2. | Compare every video option/order/default including biome blend; remove obsolete VBO controls. |
| World creation | **not-applicable** — Singleplayer world creation/save upgrades are not implemented in this multiplayer browser client. | Treat save folder naming and structure upgrade progress as future integrated-server scope, not a passed feature. |

### Patches — 1.14.1

Evidence: [game.js](../client/js/game/game.js); [particles.js](../client/js/render/particles.js). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| campfire-arrow-ignition | **server-owned** — Burning-arrow ignition is decided by server block state updates. | Shoot a lit arrow into an unlit campfire; verify flames, light, smoke and state after rejoin. |

### Patches — 1.14.2

Evidence: [world.js](../client/js/world/world.js); [test-1.14.4-world-light.mjs](../tools/test-1.14.4-world-light.mjs). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| lighting-and-world-diagnostics | **server-owned** — Old-save light recalculation and region diagnostics belong to the server; client light packets are tested separately. | Load an upgraded world and check section boundaries and emitters against a native client. |
| debug-server-chunk-count | **unverified** — Server chunk metrics differ between integrated and remote servers; inherited F3 is not certified. | Compare native F3 chunk lines in multiplayer and avoid inventing unavailable server counts. |
| raids-and-parrot-spawning | **server-owned** — Loaded-chunk raid spawning, larger bell search radius and grass-block parrot spawn checks are server-owned. | Trigger raids at chunk edges and locate parrots on grass blocks. |

### Patches — 1.14.3

Evidence: [crafting.js](../client/js/game/crafting.js). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| crafting-repair-restoration | **partial** — Target restores crafting repair; do not implement base-1.14 removal. | Combine damaged items in a crafting grid and compare result/consumption with native 1.14.4. |
| enchanting-reversion | **partial** — Protection enchantment exclusivity is restored; crossbow registration and numeric clues still need fixing. | Compare enchanting and anvil combinations including crossbow enchantments. |
| pane-bar-attachments | **unverified** — Native shapes exist; full torch/lantern/plate placement prediction has not been verified. | Place torches/lanterns/pressure plates on panes/bars and hang lanterns below them. |
| advancements-patrols-village-ai | **server-owned** — Saturation requirement removal, disableRaids, patrol spawning and villager AI/persistence are vanilla-server logic. | Use 1.14.4 advancement requirements; toggle raids and observe work/sleep/patrol behavior. |

### Patches — 1.14.4

Evidence: [items.js](../client/js/game/items.js). See the catalog for per-topic evidence.

| Topic | Status and finding | Acceptance scenario still to execute |
| --- | --- | --- |
| poppy-stew-night-vision | **missing** — Poppy stew gives Night Vision in target; suspicious stew cannot currently begin eating. | Eat poppy stew and verify Night Vision rather than Speed, correct duration and bowl return. |
| first-person-camera-offset | **missing** — renderFrame still applies a -0.1 first-person pivot translation, removed by target. | Compare first-person camera/raycast origin against native 1.14.4 near walls and at different FOVs. |
| pillager-texture | **partial** — Native pillager texture is used; exact pose/UV comparison remains unverified. | Compare front/back and crossbow aiming with native 1.14.4. |
| chunk-streaming | **partial** — Native chunk/light decoding and lifecycle have tests; high-speed live stress and memory profiling remain outstanding. | Fly/teleport rapidly across dimensions and verify no stale sections, dark borders or retained unloaded chunks. |
| commands-and-permissions | **server-owned** — debug report, reload/forceload permission changes and function-permission-level are server responsibilities. | Complete and execute those commands at appropriate permissions; verify feedback. |
| villagers-spawning-pathfinding | **server-owned** — Stock/restock, persistent gossip, siege exclusions and bamboo pathfinding are server-owned; client displays resulting metadata/offers. | Run work/restock/cure sessions and bamboo paths; compare offer counts, demand and trade UI updates. |
| realms-activity | **not-applicable** — Realms is disabled in this client; removal of its Player Activity button is outside implemented scope. | Revisit if Realms support is added. |
