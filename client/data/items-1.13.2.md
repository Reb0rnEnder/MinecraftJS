# Java 1.13.2 item registry (protocol 404)

## Provenance and reproducibility

`items.json` is a **byte-for-byte copy**, without ID conversion, of the primary
PrismarineJS **minecraft-data** repository's `data/pc/1.13.2/items.json` at commit
`6b8fa82ecd933101be155dac89ad48c3cb144ec9` (October 3, 2026).

- Upstream repository: `https://github.com/PrismarineJS/minecraft-data`
- Pinned source:
  `https://raw.githubusercontent.com/PrismarineJS/minecraft-data/6b8fa82ecd933101be155dac89ad48c3cb144ec9/data/pc/1.13.2/items.json`
- SHA-256: `9282b71d45df8fcd3317e47d1cc9f7a6108097eefca002897fe60c4b395b3616`
- Git blob: `0cc33a1072e35e821ec5467a388baf676f4560d0`; size: 96,621 bytes.
- 789 non-air items, IDs 1 through 789. Examples: grass block 8, diamond sword
  493, red bed 610, potion 629, elytra 763, trident 786, heart of the sea 789.
- The same commit's `data/pc/1.13.2/version.json` explicitly declares
  `minecraftVersion: "1.13.2"`, `version: 404`, `majorVersion: "1.13"`.
- **License: MIT**, as declared in that commit's root `README.md`, section
  “License”. Attribution: PrismarineJS/minecraft-data contributors. That README
  also notes that some data was extracted from wiki.vg and minecraft.gamepedia.com;
  there is no standalone root LICENSE file at this revision.

The enchantment registry order used for enchanting-table clues in `items.js`
was checked against `data/pc/1.13.2/enchantments.json` at the same commit
(SHA-256 `e6e19e5d3e09c5946d78ae94cb9751655f0090d460ceaf4d87f8f3cee87b0d77`).
The same version's `materials.json` was checked for tool/material relationships;
runtime rules use tool names, not its predecessor's numeric item keys.

Explicit re-import (network access, overwrites only `client/data/items.json`):

```sh
node tools/test-1.13.2-items.mjs --import-registry
```

The importer checks the pinned version, declared license and content hash before
writing. Normal tests run offline and assert the same hash.

## Local vanilla reference

The local `cache/1.13.2.jar` has SHA-1
`30bfe37a8db404db11c7edf02cb5165817afb4d9`, matching the cached Mojang version
manifest's client download. It contains no JSON registry report to import. Its
models, textures, language and bytecode were used directly to verify behavior:

- `assets/minecraft/models/item/*.json`: all 789 registry names have an item model;
  former damage variants are independent names. Bow, shield, rod, compass, clock
  and elytra overrides are read from those files.
- `assets/minecraft/lang/en_us.json`: `item.minecraft.*`, `block.minecraft.*`,
  potion and enchantment translation keys, music-disc descriptions and head names.
- `ata.r()` (Item registration): flattened spawn eggs, their colour pairs and
  item properties. Existing creative egg colours are reused by entity name;
  1.13 additions are named constants in `items.js`.
- `ate` (ItemStack), `awg` (enchantment helpers): `Damage`, `Unbreakable`,
  JSON `display.Name`, legacy-string `display.Lore`, string IDs in `Enchantments`
  and `StoredEnchantments`.
- `aut.b()` (potions), `aej` (effects): turtle-master, strong-slowness and
  slow-falling additions and new effect colours.
- `cgi` (ItemColors), `cgf` (BlockColors), `axs`/`axw` (foliage/grass): no-world
  inventory tints, grass colormap sampling at (0.5, 1.0), egg-item rather than
  EntityTag colours; `atj.f()` supplies filled-map tint on layer 1.
- `yf` (banner colour data fix): 1.13 NBT colour order is white-first. The shared
  compositor still uses black-first indices, so the item renderer adapts only
  colour inputs at that boundary. Banner base colour comes from the item name.
- `cwd$c` (inactive conduit model): 32x16 texture, one box from (-3,-3,-3) with
  size (6,6,6), used for the conduit inventory model.

No jar assets or class files are added to source control. Tests use `MC_JAR` or
the cached jar and the project's existing model extractor, PNG decoder, atlas,
model baker and geometry builders. The mock graphics device records vertices;
these checks do not require a GPU or running server.

## Integration contract and remaining callers

Wire item IDs stay unchanged in both directions. Resolve identity with
`items.name(id)` / `items.byName`, block association with `items.blockFor(id)`,
and durability with `items.damage(stack)`. Block registry IDs and global state
IDs are separate domains. Wheat grain is not the identically named crop block.
NBT writers must clear `nbtRaw` and `_simple` after in-place edits; replacing
`stack.nbt` also invalidates the simplified view automatically.

`displayName` and tooltips use the public `chatToLegacy` API. Tooltips pass its
inherited `style` option so explicit JSON `italic:false` and nested formatting
work. Lore is intentionally not JSON-parsed in 1.13.2.

Integration status and remaining legacy callers:

| Area | Required integration |
| --- | --- |
| `game/container.js` (`Inventory` and `ContainerWindow`) | Resolved in the bounded container follow-up: native-name armour/offhand, furnace, brewing, lapis, beacon, saddle/horse-armour rules; typed NBT equality; shift-click validation/limits; authoritative inbound crafting results. Local crafting prediction/remainders and entity-specific horse/llama capabilities are separate integration work (see below). |
| `gui/screens/containers.js`, `data/creative.json` | Anvil rename fields use plain visible text and refresh when same-ID stacks change names. Creative tabs/icons/order/variants now reproduce from the 1.13.2 jar; saved hotbars have a versioned namespace, locked-paper hints use native IDs/JSON names, and offhand/NBT synchronization has interaction regressions. See `creative-1.13.2.md`. |
| `game/game.js` | Book opening, bow slowdown and elytra checks now use names and NBT durability. Incoming set-slot/window-items forwarding preserves wire identity and is exercised by the regression test. Cooldown IDs likewise require no remapping. |
| `game/interaction.js` | `_itemBlock`/`_placedBlock`, block/entity picking, destroy restrictions, use/equip/throw/food checks now use native names and `blockFor`/`armorType`; direct flattened states are not reconstructed from legacy nibbles in these paths. `_predictPlace` and recipe prediction still contain older compatibility assumptions. Existing numeric `enchantLevel` calls are temporarily interpreted using the old internal enchantment definitions; migrate them to names before replacing `enchantments.json`. `enchantmentName(number, level)` already interprets protocol404 clue IDs. Trident charging/throwing requires its own use action and interaction flow. |
| `game/crafting.js`, `game/recipebook.js`, recipe data | Repair reads/writes `stack.damage`; ingredients/results/remainders still use old numeric IDs or metadata. Recipe matching and creation must produce native 1.13.2 stacks/NBT. |
| `assets.js`, `game/itemnames.js`, `world/blockstates.js` | Assets and Items now build item-only maps. The old ItemNames and itemModelName mappings are no longer used by this item pipeline. |
| `render/hand-renderer.js`, `render/entity-renderer.js` | Entity armor, headwear, bow/shield/elytra and projectile identities now use native names. Frame map numbers use NBT `map`, and dropped-item/frame cache keys include model/tint inputs. Thrown trident geometry comes from the jar. Swimming pose rendering is integrated. First-person hand/use integration and held trident builtin geometry still require audit. Player-head owner skins remain the existing Steve fallback. |
| `render/particles.js`, `game/tutorial.js`, other synthetic stacks | Audit raw IDs, old item-crack damage variants, and tutorial log/plank constants. Synthetic stacks must use registry names to find current IDs. |
| `render/banner.js` / placed banner callers | Migrate the shared compositor to a single documented 1.13 dye order together with its world callers; then remove the local item colour adapter. |

World grass/plant tint and waterlogged rendering/immersion have separate regressions
in `tools/test-1.13.2-world-fluids.mjs`. Fluids remain distinct from block collision.

## Bounded container follow-up

Container rules are implemented in `client/js/game/container.js` and checked by
the item regression suite against the cached vanilla jar.

- Furnace fuel membership is verified directly against `bju.p()` in the same
  cached jar, resolving `atf`, `bct`, `wx` fields and `data/minecraft/tags/items`.
  Smelting membership is verified against every jar smelting recipe, including
  logs/stripped wood, kelp, sea pickles, coloured terracotta and metal equipment.
  These named vanilla sets control shift-click routing, not server recipe execution;
  the input slot still permits manual insertion of any item.
- Brewing ingredient/bottle rules and ingredient-first shift-click precedence
  follow `auu` and `apy` in the jar. In this version blaze powder shift-clicks to
  the ingredient slot; manual insertion in the fuel slot remains valid.
- `stackable` compares native item ID and typed NBT. Compounds ignore key order
  and root names; lists retain order; numeric tag types and long-array precision
  are preserved. Structured-only, packet-decoded and raw-only stacks interoperate.
  The obsolete top-level `damage` field is not a subtype identity.
- `setSlot`/`setAll` on both inventory and container windows apply server data
  directly, without local crafting callbacks. Valid output remains takeable and
  its native ID and NBT survive the outbound window-click packet. Explicit null
  results are respected. Local `put`/click/ingredient-consumption prediction was
  not replaced with a new crafting engine.

### Exact caller/integration contract

`armorType(stack, items)` accepts the `Items` instance, or its `byId` Map, and
returns 0=head, 1=chest, 2=legs, 3=feet, -1=not wearable. The second parameter is
optional for named stacks (`{ name: 'minecraft:diamond_boots' }`). A numeric stack
without a registry returns -1; it is never looked up as a legacy item ID.

All current production calls to `armorType` are inside `container.js` and pass
`this.items`. New equipment callers should use `armorType(stack, game.items)`
(or `game.items.byId`). In particular:

- `game/interaction.js`, `sendUseItem`'s equipment branch (lines 694-696 at audit):
  replace the legacy armour ID range/modulo with the helper and map to
  `inventory.armor[3 - type]` after checking `type >= 0`.
- `render/entity-renderer.js`, `_updateArmor`/headwear checks and
  `armorMaterialIndex` now resolve native names and actual armor materials,
  including turtle helmets. Slot classification alone is not used to select
  armor textures. Invisible bodies do not hide equipped armor/headwear.
- `game/crafting.js` (`craftResult`, `containerItem`) and the local prediction
  hooks in `container.js` still implement legacy crafting/repair/remainders.
  A local grid edit can still predict incorrectly until a server packet arrives.
  Inbound packets must keep using `setSlot`/`setAll`, not `put` or
  `updateCraftResult`.
- `EntityHorse` now recognizes native saddle and the three native horse-armour
  items. Species-specific capabilities (donkey/mule equipment restrictions,
  llama carpets and llama chest layout) require reliable entity-type integration
  with `game/entities.js` and `gui/screens/containers.js`'s `HorseScreen`; the
  generic horse window still has its existing two equipment-slot layout.
- Custom server datapack smelting/tag updates need recipe/tag synchronization
  before client shift-click routing can reflect them. Server-provided slots and
  results are accepted without applying these vanilla membership sets.

## Verification

```sh
node tools/test-1.13.2-items.mjs
node tools/test-1.13.2-protocol.mjs
node tools/test-1.13.2-glass.mjs
node tools/test-1.13.2-entity-models.mjs
```

Container follow-up verification: the item suite passed all **20 tests** (zero
failures/skips), the protocol/chunk smoke test passed, and whitespace checks
passed for the container source, item test and this note.

The item suite checks literal protocol404 window-items bytes, real slot/NBT
codecs, Game/Inventory/ContainerWindow forwarding, unchanged outbound creative
IDs, all 789 item models through real geometry, former metadata variants,
different item/block/state IDs, custom JSON names and lore, durability bars and
model predicates, overrides, inventory tints, potions, named enchantments,
spawn eggs and coloured builtins. The follow-up adds armour/offhand and container
validation/shift-click checks, exhaustive furnace routing over all 789 items
against jar data, structured NBT distinctions, and server crafting-result packet
ordering and pickup regressions. A live-server/browser visual check is separate
from these CPU geometry and integration regressions.
