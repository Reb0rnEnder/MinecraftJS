# 1.14.4 feature audit — 2026-10-26

The port is **not at full 1.14.4 parity**. This review tracks all **151 Additions/Changes topic headings** on the [1.14 reference page](https://minecraft.wiki/w/Java_Edition_1.14), plus **15 target patch groups**. The separate [patch review](patch-audit-1.14.1-1.14.4.md) accounts for all 39 headings and inventories the 233 bug tickets listed across the four requested patch pages. Topic and ticket coverage do not mean every behavior has passed.

## Implemented in this milestone

- Extract native food/use mechanics, all 37 enchantments, spawn-egg colors, effect definitions, player dimensions, dye text colors and per-state SoundTypes from the pinned jar.
- Implement crossbow use/release/model predicates and held poses, fitting player/crawling poses, native signs and colored editing, campfire contents/smoke, lectern books and separate painting textures, native panda gene skins and received remote pose dimensions.
- Load native particle JSON sprite lists, including resource-pack overrides, instead of the removed legacy sheet; dispatch missing particles and use native effect icons. Several motion adapters still need exact visual comparison.
- Handle native horse inventory, open-book, digging acknowledgement and entity sound packets. Correct writable-book, command-block, command-minecart, jigsaw and structure editor packets.
- Add book cursor/selection editing, item JSON lore/CustomModelData, creative tag search, native note-state sounds, Accessibility/Mouse settings, native option arrays, keyboard focus and Programmer Art.
- Remove the first-person pivot offset removed in 1.14.4; implement F3+Escape and the target F3+N transition.

## Evidence and limits

The target regression suite passes **72 tests**; the expanded target/shared run passes **133 checks**, with one optional external-endpoint test skipped. Shared fixtures now use target metadata, flattened state IDs, JSON lore and particle sprites. Independent 1.14 light ownership is tested separately from legacy local relighting. The diagnostic's **58 selected probes pass**, with no probed gaps. This is not a completion percentage: wider topic acceptance scenarios remain open, and `--strict` also checks those open topics, so it still rejects a full-parity release.

Browser menu checks exercised Accessibility, Mouse settings, options, Programmer Art and all 58 particle sprite sets (126 sprites), with no JavaScript errors. An isolated vanilla 1.14.4 server accepted crossbow charging held beyond the nominal use duration, release/loading and subsequent firing; it awarded Ol’ Betsy. Rendering and mesh scheduling were disabled only in that protocol test. Full-world software-rendered headless runs timed out, so those runs do not establish rendered gameplay performance or parity. A separate small visual fixture rendered campfire flames/smoke/food, a colored spruce sign, lectern book and nine new mobs without JavaScript errors. These checks do not certify every texture, animation or transform against Java screenshots. The user's server/world was not modified.

The official pinned client jar is SHA-1 `8c325a0c5bd674dd747d6ebaa4c791fd363ad8a9`. Registry checks match 676 blocks, 11,271 states, 877 item IDs (876 inventory items plus air), 58 particle types and 37 enchantments. Default geometry and texture validation covers 64 living adapters and 114 entity/layer paths. Native data presence does not establish correct consumer behavior.

## Remaining work

Furnace/smoker/blast-furnace recipe books and dynamic crafting prediction; special mob poses/variants and sleeping transforms; exact particle trajectories, painting lighting/back tiling and block-entity transforms; complete GUI navigation/narration, language ordering and rich book interactions; all support/placement permutations; target patch regression scenarios, raid/trading/advancement sequences and representative performance comparisons remain open. See individual rows for more precise scope. Shared fixes are backported where their native behavior exists; 1.14 additions stay on this branch.

## Target patch behavior

Final 1.14.4 is authoritative. In particular, 1.14.3 restores crafting repair and protection enchantment exclusivity; poppy suspicious stew gives Night Vision in 1.14.4. Village generation, AI, raids, loot, enchantment application and datapack evaluation belong to the connected vanilla server. Received state and interactions still require client/server testing; server ownership is not a pass. Integrated-server statistics, Java server command-line interfaces and Realms are outside current external-server browser-client scope.

## Reproduce

```sh
node tools/port-1.14.4/prepare.mjs
node tools/port-1.14.4/finalize-runtime-data.mjs
node tools/port-1.14.4/audit-features.mjs
node --test tools/test-1.14.4-*.mjs tools/test-shadows.mjs tools/test-font-providers.mjs tools/test-worker-snapshots.mjs
```

`--write` refreshes the [diagnostic results](feature-audit-1.14.4-results.json). `--strict` fails for any registry/probe gap or open feature/patch topic. The default only indicates that the diagnostic ran. [Feature checklist](../tools/port-1.14.4/feature-checklist.json) and [patch checklist](../tools/port-1.14.4/patch-checklist.json) preserve dispositions, source fingerprints and evidence without copying the reference articles. Native inputs are cached for offline checks. The expanded command also includes `tools/test-chat-*.mjs`, `test-client-regressions.mjs`, `test-crash-screen-browser.mjs`, `test-site-config-regressions.mjs`, `test-sky-pack-regressions.mjs` and `test-wisp-regressions.mjs`; supply `PLAYWRIGHT_MODULE` for the separately installed browser test dependency.

## Complete topic matrix

**Partial** means supporting implementation exists but known gaps or unexecuted scenarios remain. **Missing** means a required adaptation is absent. **Server-owned** still requires client/server validation. **Unverified** lacks adequate evidence. **Not applicable** is outside this browser-client scope. No whole topic is certified by narrower probes alone.

Topic dispositions: 5 not-applicable, 115 partial, 42 server-owned, 4 unverified.


### Additions — Blocks

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Bamboo | **partial** — Native states, models, shapes and potted variant exist; growth and panda feeding are server decisions. | Plant, bone-meal, break a tall stalk, pot it, burn it and feed a panda. |
| Flowers | **partial** — All three flowers and pots are registered; wither damage is authoritative on the server. | Place cornflower, lily and wither rose; craft dyes and stew, test rose damage outside Peaceful. |
| Looms | **partial** — Routing, slots, scrolling and pattern selection have runtime tests; all live combinations are not certified. | Apply each ordinary and template pattern; repeat until six layers, shift-click outputs and check template retention. |
| Signs | **partial** — All native wood sign names now route to per-wood textures, colored JSON text and a cursor/selection editor; complete visual/resource-pack combinations still need comparison. | Place every wood standing/wall sign; edit, select, copy, paste and dye text all 16 colors; rejoin. |
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
| Lecterns | **partial** — Native page/take controls and a placed open book model are implemented. Exact transforms, shared reading and all packet interactions remain acceptance work. | Insert and remove a book, share pages between two clients, inspect the block book and comparator output. |
| Scaffolding | **partial** — Jump/sneak collision and falling-block mover regression are tested; full placement/collapse behavior needs a live pass. | Build vertically and six blocks horizontally, extend to falling distance, collapse and climb while sneaking. |
| Lanterns | **partial** — Native state, shape and light properties exist; pane/bar support changes need live placement checks. | Place upright and hanging, including on/below panes and iron bars; remove support and rejoin. |
| Jigsaw blocks | **partial** — Native three-field operator editor and dedicated packed-position update packet are implemented, including the native attachement_type spelling and input validation. | Obtain by command, edit pool/attachment/final state as an operator and test save/reload. |
| Sweet berry bushes | **partial** — All age models exist; local physics lacks berry-bush slowdown. | Plant, bone-meal and harvest each age; walk/jump through mature bushes and compare server correction/damage. |
| Campfires | **partial** — Native light/collision plus placed cooking items, smoke sprite sets and hay signal-fire lifetime are implemented. Cooking/extinguishing and all live combinations remain acceptance work. | Cook four foods, place hay below, extinguish/reignite, test waterlogging and burning-arrow ignition. |
| Composters | **partial** — Native fill states/models exist; composter particle packets are ignored. | Compost multiple plant types through level eight, extract bone meal, test hopper transfer and particles. |
| Note blocks | **partial** — Events now read instrument and note from synchronized state, including all six new instruments; native sound types are extracted for every state. | Play all 16 instruments over their substrate blocks and compare pitch and note particles. |

### Additions — Items

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| General | **partial** — BlockStateTag survives generic NBT transport, but placement prediction does not interpret it. | Give blocks with custom facing/axis/age BlockStateTag and compare immediate placement with authoritative updates. |
| Banner patterns | **partial** — Loom has all five template patterns and native ordinals; template retention needs live verification. | Use flower, creeper, skull, thing and globe templates; verify recipe/trade acquisition and reuse. |
| Crossbows | **partial** — Native use/charge duration, ammo checks, Quick Charge, charged/rocket predicates and first/third-person hand poses are implemented. A browser network test loaded/fired a real crossbow against isolated vanilla 1.14.4; all enchantment/projectile variants still need live tests. | Charge in either hand, retain a charge in inventory, fire arrows/rockets and test Multishot, Piercing and Quick Charge. |
| Suspicious stew | **partial** — Native extracted food mechanics now start eating. Server decides flower effects, including target poppy Night Vision; live effect/return-bowl combinations remain unverified. | Eat each flower recipe and brown-mooshroom stew; verify 1.14.4 poppy Night Vision and bowl return. |
| Dyes | **partial** — Native names/items exist; sign colors and all replacement dye actions are not certified. | Use all 16 dyes on sheep, wool, leather, banners and signs; ensure the four former ingredients no longer dye directly. |
| Sweet berries | **partial** — Native extracted food mechanics now start eating; planting is recognized separately from eating. Bush slowdown/harvest interaction priority still needs work. | Eat berries and plant them; verify hunger, use priority on dirt and mature-bush harvesting. |
| Leather horse armor | **partial** — Horse slot validation now admits leather. Native item tinting exists; equipped horse armor layer/NBT rendering still needs completion. | Equip, dye, remove and dispense leather armor; inspect color and invisibility rendering. |
| Spawn eggs | **partial** — All native spawn egg colors are extracted, and every registered egg resolves tint data in tests. Every spawn interaction is not yet played. | Inspect all seven egg icons, spawn adults/babies and test EntityTag overrides without changing egg colors. |

### Additions — Mobs

| Topic | Finding | Acceptance scenario still to execute |
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

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| General | **server-owned** — Chunk generation/loading policy is vanilla-server-owned; receiving native chunks is tested separately. | Travel quickly through newly generated terrain and compare lighting and terrain with a native client. |
| Bamboo Forests | **partial** — Both bamboo-jungle biome entries exist; structure and vegetation generation are server-owned. | Visit both bamboo-jungle biomes, check foliage colors, bamboo, pandas and transitions. |
| Pillager outposts | **server-owned** — Structure placement, loot and spawning are server-owned; rendering all generated contents needs a live tour. | Locate an outpost, inspect tower/cages/loot and observe pillagers and golem. |
| Villages | **server-owned** — Snowy village generation and contents are server-owned; client workstation/mob gaps apply. | Tour a newly generated snowy village and compare structures, beds, paths, mobs and workstations. |
| Zombie Villages | **server-owned** — Snowy abandoned village generation is server-owned; zombie-villager display needs live coverage. | Visit or load a snowy abandoned village, inspect cobwebs and villagers through day/night. |

### Additions — Gameplay

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Advancements | **partial** — Server advancement packets and generic tree/toast UI exist; new icon/text and trigger scenarios are unverified. | Earn all new crossbow, raid and trading advancements; inspect toast, icons, descriptions and persistence. |
| Illager patrols | **server-owned** — Patrol spawning and Bad Omen assignment are server-owned; new effect display is incomplete. | Encounter a patrol, kill its captain and inspect banner, effect and raid trigger. |
| Raids | **partial** — Generic boss bars work; Bad Omen/Hero runtime definitions, bell resonance and some mob poses are missing. | Run a full raid including loss/victory, all waves, boss bar, horn, glowing, discounts and gifts. |
| Resource packs | **partial** — Native Programmer Art is shipped/listed as a read-only built-in selectable pack. External format warnings remain; ordering and all pack visual combinations need comparison. | Enable built-in Programmer Art, reorder with another pack and reload; test old-format red warning/dialog. |
| Status effects | **partial** — Native Bad Omen/Hero definitions, separate sprite icons and show-icon/ambient packet flags are implemented. Raid/discount transitions remain live acceptance work. | Apply/remove both effects, trigger raid, drink milk and inspect HUD/inventory names, timers and icons. |

### Additions — Command format

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Tags | **partial** — Block/item/fluid/entity tags are cached; creative #tag search and tag tooltips are implemented. Reloaded custom tag display still needs live verification. | Reload block/item/entity/fluid tags; inspect F3 block tags, creative # search and command completions. |
| /loot | **server-owned** — Execution and loot evaluation belong to the server; command tree and suggestion transport exist. | Type, complete and run loot give/insert/spawn/replace with permissions and inspect outputs. |
| /schedule | **server-owned** — Function scheduling belongs to the server; no local command interpreter is required. | Complete and run schedule for a test function and inspect timed chat/block updates. |
| /teammsg | **server-owned** — Team routing is server-owned; translated chat and suggestions need live comparison. | Join two teams and compare tm/teammsg delivery, translation and hover/click metadata. |

### Additions — General

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Client.jar | **partial** — Official jar/mappings are pinned and extraction is validated; root version.json metadata is present in the target jar. | Verify root version.json version, protocol and data/pack versions agree with native runtime tables and displayed client identity. |
| Death messages | **unverified** — Generic translation/chat supports server messages; each new death message has not been replayed. | Trigger new berry/firework/falling variants as applicable and compare translated text and hover data. |
| Font | **partial** — Bitmap, legacy Unicode and TTF providers have tests; complete native glyph coverage remains a visual check. | Compare added glyphs and non-Latin text; load TTF/OpenType resource packs and test fallback/Unicode mode. |
| Title screen | **partial** — Native Accessibility entry point is implemented and browser-smoke tested. Complete focus, narration and presentation comparison remains. | Inspect accessibility button, keyboard focus, narration and navigation to accessibility options. |
| Particles | **partial** — All native per-particle sprite lists load and support pack overrides; all new dispatches emit. Some particle motion/lifetimes use initial adapters and are not fully native-certified. | Use particle commands for every native ID and compare animation, color, collision and resource-pack overrides. |
| Recipes | **partial** — JSON ingredient tags and cooking-result strings now resolve. Workstation codecs exist; separate furnace/smoker/blast-furnace recipe-book interfaces still need implementation. | Learn/craft added recipes, use all furnace books and campfire recipes, check filtering and ghost ingredients. |
| Splashes | **partial** — Splashes are loaded from native assets; individual additions have not been visually sampled. | Inspect native splash list and sample title splashes including localization/special dates. |
| Startup screen | **partial** — Startup splash still draws the old white-logo presentation without native loading progress. | Reload cached/uncached resources and compare startup progress bar, logo and fade into the main menu. |
| Statistics | **partial** — Generic statistic packets and screen exist; all new actions and entity statistics are unverified. | Use each new workstation, raid and mob interaction, then compare updated statistics after rejoin. |

### Changes — Blocks

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Beds | **partial** — Native collision/selection shapes are extracted; color/sleep rendering has prior fixes but all orientations need a visual pass. | Select and collide with both halves in every orientation, sleep and break/rejoin all colors. |
| Brewing stands | **server-owned** — New village generation/job-site assignment is server-owned; existing brewing UI remains in use. | Visit a temple and assign a cleric; open brewing stand and brew with hoppers. |
| Carpets | **partial** — Native recipes are available, but tag-based ingredients break recipe-book matching. | Recolor eight white carpets around every non-white dye and inspect recipe-book filtering. |
| Cauldrons | **server-owned** — Village placement and leatherworker job assignment are server-owned. | Visit a tannery, assign a leatherworker and test water levels/dye removal. |
| Chorus flowers | **server-owned** — Projectile break/drop behavior is server-owned; client must apply block/item updates. | Shoot with arrows and tridents, inspect block disappearance, dropped flower and relog state. |
| Crops and nether wart | **partial** — Block state sound types, including crop and wart sounds, are extracted from native SoundType and consumed by step/break/place/hit/fall audio. | Place/break every crop and wart; compare sound and volume against native 1.14.4. |
| Cut sandstone and cut red sandstone | **partial** — Native stonecutting recipes and menu are available; exact result recipes need live testing. | Select both cut sandstone recipes in the stonecutter and take/shift-click outputs. |
| Dispensers | **server-owned** — Shearing sheep is server-owned; animation, wool item updates and sounds need live testing. | Dispense shears at sheep, verify drops, durability and regrowth. |
| Glass | **partial** — Native support/occlusion properties exist; local placement rules are not fully certified. | Place redstone on glass and inspect support, rendering, light and power updates. |
| Grass path, mycelium, and podzol | **partial** — Native models are loaded; randomized top orientation needs a visual comparison. | Place large patches of all three blocks and compare random top rotation and lighting before/after updates. |
| Leaves | **server-owned** — Stick drop probabilities and decay are server-owned. | Break/decay leaves with and without Fortune/Silk Touch; inspect stick drops and collision. |
| Nether brick fences | **partial** — Native crafting recipes exist; recipe-book ingredient handling remains incomplete. | Craft fences with blocks plus brick items and walls with the former fence layout; compare yields. |
| Redstone dust | **server-owned** — Depowering simulation/performance is server-owned, while received power states render locally. | Toggle long redstone lines and inspect power colors and block-state updates. |
| Signs | **partial** — Native names, per-wood textures, dye colors and cursor/selection/copy/paste are implemented. Chunk NBT retains Color; exact editor presentation still needs comparison. | Use all wood recipes, move cursor, select/copy/paste text and dye it; rejoin. |
| Smooth quartz, smooth sandstone, smooth red sandstone and smooth stone | **partial** — Native smelting recipes exist; books and all furnace interactions need verification. | Smelt all four source blocks and check recipe book, timing and output stacks. |
| Smooth stone slab | **partial** — Native item/block names and models exist; recipe-book tag handling is incomplete. | Craft from smooth stone, inspect single/double models and ensure stone produces the separate stone slab. |
| Stained glass panes | **partial** — Native recoloring recipes exist; recipe-book matching needs correction. | Surround all dyes with clear panes and inspect result count, color and recipe filtering. |
| TNT | **server-owned** — Explosion block-drop policy is server-owned. | Explode a controlled block palette and compare surviving item count and client block/light updates. |
| Transparent blocks | **partial** — Per-state native opacity/occlusion is extracted; every support and light-propagation rule is not certified. | Test slabs, stairs, snow, panes, leaves, paths and pistons for face culling, light and supported attachments. |
| Vines | **partial** — Local ladder detection accepts unsupported vines; motion and jump transitions need a server comparison. | Climb hanging vines without backing blocks, jump from them and test corners/sneaking. |

### Changes — Items

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Beetroot soup | **partial** — Native shapeless recipe exists; food use predates this port but recipe-book matching is incomplete. | Craft with shuffled slots, eat and check hunger/bowl return and recipe-book placement. |
| Book and quill | **partial** — Native item IDs/edit-book/off-hand packets, 100 pages, multiline selection/copy/paste, movement and word/page mouse selection are implemented. Rich written-book hover/click and exact editor layout still need comparison. | Write up to 100 pages, select/copy/paste words/pages, sign in either hand, reopen and verify server persistence. |
| Dead bush | **server-owned** — Fuel acceptance/time is decided by server furnace processing. | Burn dead bushes in furnaces/smokers/blast furnaces and check progress and consumption. |
| Dye | **partial** — Native renamed items exist; use behavior relies on server and local inventory validation. | Check red/yellow/green names; reject old raw ingredients for dyeing while preserving bone-meal growth use. |
| Horse armor | **partial** — Horse rendering/slot code is inherited; invisibility and hurt-tint changes are not certified. | Equip each material, make horse invisible and damage it; verify armor stays visible without red tint. |
| Rabbit stew | **partial** — Native shapeless recipe exists; recipe-book ingredients still need adaptation. | Craft both mushroom variants in shuffled slots; eat and check bowl return. |
| Totem of undying | **partial** — CustomModelData predicates now resolve item overrides; activation animation must still be checked for retaining the original stack tag. | Trigger a totem with a custom model resource pack and compare held versus activation appearance. |

### Changes — Mobs

| Topic | Finding | Acceptance scenario still to execute |
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

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Armor stands | **server-owned** — Armor stand loot-table evaluation is server-owned; rendering has an existing adapter. | Assign a custom loot table, break the stand and inspect drops/equipment and metadata poses. |
| Thrown projectiles | **partial** — Object rendering mostly chooses fixed item types; full optional Item metadata overrides need adaptation. | Summon each egg/pearl/bottle/eye/fireball/snowball with a custom Item stack and compare model/tint. |
| Minecart with TNT | **server-owned** — Explosion drop-rate changes are server-owned. | Explode a TNT minecart against a controlled palette and inspect drops, particles and block updates. |
| Paintings | **partial** — Renderer now reads native individual motive/front/back textures. Tiled per-block lighting and animated resource-pack paintings still need work. | Place every motive, use an animated painting pack and inspect frame/back/lighting after rejoin. |

### Changes — World generation

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Villages | **server-owned** — New layouts, paths, job sites and generation are server-owned; client mob/block gaps still apply. | Tour all five village styles and inspect every generated block/entity in both clients. |
| Swamp huts | **server-owned** — Black cat generation is server-owned; coat metadata has a client adapter. | Visit a fresh witch hut and inspect spawned black cat and witch. |
| Zombie villages | **server-owned** — Abandoned biome-style variants are server-owned. | Tour each abandoned village style and verify blocks, cobwebs and zombie-villager skins. |
| The Nether | **server-owned** — Nether generation changes belong to the server; biome/terrain display uses native tables. | Visit new Nether terrain and compare bedrock, terrain and block lighting with native client. |

### Changes — Command format

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Advancements | **server-owned** — Changed predicates are evaluated by the server; advancement display is generic. | Load a test datapack using changed predicates and inspect progress, toast and descriptions. |
| Commands/NBT data | **server-owned** — Time suffixes and command NBT semantics are server-owned; input is sent as text. | Complete and execute time arguments with t/s/d and fractional values; inspect server feedback. |
| Conditions | **server-owned** — Loot entity-properties predicate evaluation is server-owned. | Exercise entity_properties predicate variants through test loot and inspect received items. |
| Creative menu | **partial** — Creative #tag search and matching-tag tooltips are implemented; full namespace/filter/order scenarios remain unverified. | Search #minecraft:logs and another item tag; inspect matched items and tooltip tag labels. |
| Loot tables | **server-owned** — New entries/functions/conditions are server datapack logic, not a client loot interpreter. | Exercise block/entity/dynamic/tag/sequence loot and NBT/lore functions; inspect item updates and tooltips. |
| JSON text components | **partial** — JSON item lore now renders as components; server handles NBT interpretation. Complete styled chat/tooltip cases remain unverified. | Use entity/block NBT text components and interpret=true, plus JSON-formatted item lore in tooltips. |
| NBT paths | **server-owned** — Multi-match paths, filters and negative indices are parsed/evaluated by server. | Run data modify/get with list/object filters, [] and negative indices and inspect feedback. |
| Villager NBT | **partial** — Structured profession/biome/level metadata maps to native layers; offers/brain NBT is server-owned. | Summon every profession/type/level and mutate VillagerData, then trade and rejoin. |
| World generator registries | **server-owned** — Generator registry and datapack validation are server-owned. | Load custom biome-related generator configuration on a separate vanilla world and inspect received terrain. |
| Zombie villager NBT | **partial** — Structured type/profession texture layers exist; offers persistence through curing is server-owned. | Summon matching VillagerData/Offers, cure and zombify, inspect skin and retained trades. |
| Other | **partial** — CustomModelData predicates now resolve. Native technical editor packets replace obsolete command/structure custom payloads; other command semantics are server-owned. | Test command completions, modified item frames and resource-pack CustomModelData overrides. |

### Changes — Gameplay

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Crafting | **partial** — Combining damaged items was restored in 1.14.3; inherited repair logic is appropriate for target, with recipe-book gaps remaining. | Repair tools in crafting and grindstone; compare durability, enchantment loss and counts on 1.14.4. |
| Enchanting | **partial** — All 37 native enchantment IDs and max levels now resolve; numeric clues and single-level labels are tested. Full enchanting/anvil combinations remain live work. | Enchant crossbows and normal tools; compare offered clue IDs/names, costs and mutually exclusive protections. |
| Lighting system | **partial** — Separate light packets and pending chunk lifecycle have tests; directional block properties are native. | Load/unload dimensions, travel fast, edit partial blocks and compare light at borders without requiring block updates. |
| Sneaking | **partial** — Native extracted pose dimensions now permit 1.5-high sneaking and forced 0.6-high crawling, with appropriate eye height and stand-up clearance tests. | Sneak beneath top slabs/trapdoors; release crouch with blocked headroom and compare camera and server correction. |
| Status effects | **partial** — Native separate effect icons and extracted definitions replace legacy inventory atlas coordinates. Invisibility/armor and all effect transitions remain unverified. | Apply all effects, inspect separate native icons and timers, and test invisible armor/entity layers. |
| Trading | **partial** — Native offer list, demand/special-price calculation, XP and repeated shift trades have tests; full restock/reputation sessions are unverified. | Trade across all five levels, exhaust/restock, cure/attack villagers and inspect prices, discounts and badges. |

### Changes — General

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| Advancements | **partial** — Server owns changed requirements; new foods/crossbow use prevent completing some from this client. | Test Balanced Diet, Two by Two, Monster Hunter and How Did We Get Here using 1.14.4 requirements. |
| Collision code | **partial** — Native selection/collision data plus specialized scaffolding behavior are validated; new pose fitting remains stale. | Run a collision course covering every new partial block, pistons, doors, swimming, sneaking and moving entities. |
| Creative inventory | **partial** — Tabs are extracted from the native jar; tag search, new egg tinting and all special item renderers are incomplete. | Compare every tab/order including walls, search tags, tooltips, saved hotbars and all new icons. |
| Credits | **partial** — Credits are read from native text assets; full screen layout/music behavior is not visually certified. | Open credits, compare staff text, scrolling, narration, skip behavior and music. |
| Debug screen | **partial** — Existing F3/graphs are inherited; new tick min/avg/max and server chunk metrics need a dedicated comparison. | Compare F3 and Alt+F3 lines/charts with native client; server tick metrics are unavailable on ordinary remote servers. |
| Dedicated servers | **not-applicable** — This repository is a browser client/proxy; vanilla owns server.properties, EULA and server CLI changes. | Confirm external server starts with desired settings; no browser implementation of Java server CLI is required. |
| Language | **partial** — Selecting a language now defers reload until Done; Escape returns without applying the pending choice. Full Unicode/localization scenarios remain unverified. | Choose several languages, cancel/Done and compare reload timing and selection behavior. |
| Loading screen | **partial** — Old splash renderer lacks a resource progress bar; chunk/loading screens need comparison. | Reload assets and connect/change dimension, comparing progress indication and transitions. |
| LWJGL | **not-applicable** — Browser WebGL/audio/input replace the Java native library; matching its version is not a browser feature. | Validate supported WebGL platform separately; no LWJGL dependency is expected. |
| Title screen | **partial** — Native panorama source hashes and runtime cube map have tests; accessibility/navigation gaps remain. | Compare all six panorama faces, rotation, title layout and button focus. |
| Menus | **partial** — Tab/Shift+Tab, button activation, slider arrows and list navigation are implemented. Complete keyboard traversal of nested container controls remains unverified. | Navigate every menu without a mouse using Tab, Shift+Tab, arrows, Space and Enter. |
| Narrator | **partial** — A narrator exists, but native accessibility placement and hovered/focused button narration are not certified. | Enable narration and traverse buttons, lists, chat and inventory; verify hovered/focused announcements. |
| Optimizations | **not-applicable** — World-save optimization and Nether portal chunk tickets are server/integrated-server responsibilities. | Test server portal retention separately; browser performance must be profiled rather than claiming vanilla engine optimizations. |
| Options | **partial** — Native Accessibility/Mouse submenus replace Snooper; scroll settings and chat-background opacity are wired. Broader accessibility/background/narration behavior still needs verification. | Compare all options, chat background/text opacity, scroll sensitivity/discrete scrolling and saved settings. |
| Particles | **partial** — Native individual sprite lists replace removed atlases; per-particle frame selection and pack overrides are tested. All trajectories/lifetimes are not certified. | Override sprite lists in a resource pack; test all frames and each native particle ID. |
| Pause screen | **partial** — Native feedback/report links are implemented; exact layout, link behavior and focus require comparison. | Open pause menu and compare buttons, links, placement and keyboard focus. |
| Player positioning | **partial** — Fitting-pose fallback handles standing, crouching and crawling; native dimensions and eye heights have collision-course regressions. Remote pose/sleep presentation remains incomplete. | Close a trapdoor on the player, crawl under one-block gaps and return to standing only when space permits. |
| Sounds | **partial** — Native state sound types and note instruments replace heuristics; entity-attached sound decode/playback is implemented. All sound events/movement/mixing remain unverified. | Compare new block/mob sound types, entity-attached sounds, global volume and movement while sounds play. |
| Splash | **partial** — Native splash text is loaded, but removed-string exclusion has not been independently asserted. | Check the native list excludes removed strings and sample rendered title messages. |
| Technical | **partial** — Per-state opacity, occlusion and light data is extracted and build-validated; broad light propagation needs live coverage. | Test partial faces on slabs/stairs/snow/paths/pistons/portal frames against native client lighting. |
| Textures | **partial** — Native asset source/cache v4 includes Programmer Art; signs/particles/paintings/effect sprite consumers are adapted. All default/pack visuals are not certified. | Inspect terrain/items/entities/GUI/effects with default assets and layered packs; look for missing or legacy paths. |
| Video settings | **partial** — Native video option order is extracted and obsolete VBO removed. GUI scale limits and complete input/render setting behavior still need comparison. | Compare every video option/order/default including biome blend; remove obsolete VBO controls. |
| World creation | **not-applicable** — Singleplayer world creation/save upgrades are not implemented in this multiplayer browser client. | Treat save folder naming and structure upgrade progress as future integrated-server scope, not a passed feature. |

### Patches — 1.14.1

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| campfire-arrow-ignition | **server-owned** — Burning-arrow ignition is decided by server block state updates. | Shoot a lit arrow into an unlit campfire; verify flames, light, smoke and state after rejoin. |

### Patches — 1.14.2

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| lighting-and-world-diagnostics | **server-owned** — Old-save light recalculation and region diagnostics belong to the server; client light packets are tested separately. | Load an upgraded world and check section boundaries and emitters against a native client. |
| debug-server-chunk-count | **unverified** — Server chunk metrics differ between integrated and remote servers; inherited F3 is not certified. | Compare native F3 chunk lines in multiplayer and avoid inventing unavailable server counts. |
| raids-and-parrot-spawning | **server-owned** — Loaded-chunk raid spawning, larger bell search radius and grass-block parrot spawn checks are server-owned. | Trigger raids at chunk edges and locate parrots on grass blocks. |

### Patches — 1.14.3

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| crafting-repair-restoration | **partial** — Target restores crafting repair; do not implement base-1.14 removal. | Combine damaged items in a crafting grid and compare result/consumption with native 1.14.4. |
| enchanting-reversion | **partial** — Protection enchantment exclusivity is restored; crossbow registration and numeric clues still need fixing. | Compare enchanting and anvil combinations including crossbow enchantments. |
| pane-bar-attachments | **unverified** — Native shapes exist; full torch/lantern/plate placement prediction has not been verified. | Place torches/lanterns/pressure plates on panes/bars and hang lanterns below them. |
| advancements-patrols-village-ai | **server-owned** — Saturation requirement removal, disableRaids, patrol spawning and villager AI/persistence are vanilla-server logic. | Use 1.14.4 advancement requirements; toggle raids and observe work/sleep/patrol behavior. |

### Patches — 1.14.4

| Topic | Finding | Acceptance scenario still to execute |
| --- | --- | --- |
| poppy-stew-night-vision | **partial** — Native food-use classification permits eating stew. The isolated vanilla server supplies target effect semantics; all flower/bowl combinations still need live checks. | Eat poppy stew and verify Night Vision rather than Speed, correct duration and bowl return. |
| first-person-camera-offset | **partial** — The obsolete first-person -0.1 pivot translation is removed; near-wall/FOV comparisons remain unverified. | Compare first-person camera/raycast origin against native 1.14.4 near walls and at different FOVs. |
| pillager-texture | **partial** — Native pillager texture is used; exact pose/UV comparison remains unverified. | Compare front/back and crossbow aiming with native 1.14.4. |
| chunk-streaming | **partial** — Native chunk/light decoding and lifecycle have tests; high-speed live stress and memory profiling remain outstanding. | Fly/teleport rapidly across dimensions and verify no stale sections, dark borders or retained unloaded chunks. |
| commands-and-permissions | **server-owned** — debug report, reload/forceload permission changes and function-permission-level are server responsibilities. | Complete and execute those commands at appropriate permissions; verify feedback. |
| villagers-spawning-pathfinding | **server-owned** — Stock/restock, persistent gossip, siege exclusions and bamboo pathfinding are server-owned; client displays resulting metadata/offers. | Run work/restock/cure sessions and bamboo paths; compare offer counts, demand and trade UI updates. |
| realms-activity | **not-applicable** — Realms is disabled in this client; removal of its Player Activity button is outside implemented scope. | Revisit if Realms support is added. |
