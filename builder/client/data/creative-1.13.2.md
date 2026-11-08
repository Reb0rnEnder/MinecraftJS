# Java 1.13.2 creative catalog

`creative.json` is generated from the original Mojang Java **1.13.2 client jar**:

- Local input: `cache/1.13.2.jar`, or the `MC_JAR` environment variable.
- Client SHA-1: `30bfe37a8db404db11c7edf02cb5165817afb4d9` (also recorded in `cache/1.13.2.json`).
- Protocol: **404**; data version: **1631**.
- Extractor: `tools/creative-dump/extract-1.13.2.mjs`.
- Verification: `tools/test-1.13.2-creative.mjs`.

## Reproduce offline

From the repository root, with Node 22:

```sh
node tools/creative-dump/extract-1.13.2.mjs --write
node tools/creative-dump/extract-1.13.2.mjs --check
node tools/test-1.13.2-creative.mjs
```

No Java installation, external mappings, network access, or manual grouping is needed.
`--check` is read-only and compares the entire generated object. The regression suite
also verifies the exact generated file formatting. `Dump.java` is the historical
1.12.2 extractor and must not be used to regenerate this catalog.

## Extraction boundary and primary-source code

The independent adapter subclasses the existing `lib/jvm.js` interpreter without
changing it or importing `lib/modelextract.js`. It executes these pinned jar methods:

| Obfuscated class/method | Extracted behavior |
| --- | --- |
| `ary.<clinit>` and `ary$1` … `ary$12` | Tab indices, labels, icon stacks, backgrounds, title/scroll flags, columns, row and right alignment |
| `ata.r()` | Full item registration order and `Item.Properties` group assignments |
| `ata.a(ary,ez)`, `arj.a(ary,ez)`, `bcs.a(ary,ez)` | Actual item/block category predicates and population |
| `atp.a(ary,ez)`, `aul.a(ary,ez)` | Potion variants; tipped arrows omit potion types without effects |
| `asi.a(ary,ez)`, `awe.h()` and enchantment subclasses | All search book levels, category maximum levels, enchantment category membership and order |
| `aut.b()`, `aej.m()` | Potion and effect registrations, durations, amplifiers, colors and modifiers |
| `auc` constructor arguments in `ata.r()` | Native spawn-egg entities and both tint colors |
| `clh` | Audited GUI tab geometry, search length, selection/merge behavior, tooltip category and saved-toolbar hints |

Java collections/registries are represented with JS collections in registration order.
Block/entity/item singleton names come from their jar static initializers. World and
render-only constructors are replaced with recorders; the real base Item constructor,
block-item constructors, block-to-item bindings, creative predicates, variant loops,
enchantment constructors/level methods and tab getters execute in the interpreter.
ItemStack/PotionUtils/enchanted-book output is serialized into the client's typed-NBT
representation. A jar hash mismatch or a failed relevant initializer aborts extraction.

The extracted registry includes air at ID 0 and **789 non-air items**. Every non-air
registration is cross-checked by name and ID against `items.json`; IDs are never
inferred from legacy damage values or block IDs. Every emitted stack/icon also has a
corresponding `assets/minecraft/models/item/<name>.json` in this jar.

Useful audit commands:

```sh
node tools/creative-dump/inspect.mjs ary '<clinit>'
node tools/creative-dump/inspect.mjs ata a '(Lary;Lez;)V'
node tools/creative-dump/inspect.mjs --overrides '(Lary;Lez;)V'
node tools/creative-dump/inspect.mjs --item 'kelp|turtle_egg|conduit'
node tools/creative-dump/inspect.mjs --lang itemGroup.
```

## Regenerated counts and icons

| Index | Label | Entries | Icon |
| ---: | --- | ---: | --- |
| 0 | buildingBlocks | 239 | bricks |
| 1 | decorations | 207 | peony |
| 2 | redstone | 54 | redstone |
| 3 | transportation | 18 | powered_rail |
| 4 | hotbar | 0 (dynamic saved toolbars) | bookshelf |
| 5 | search | 1,034 | compass |
| 6 | misc | 147 | lava_bucket |
| 7 | food | 35 | apple |
| 8 | tools | 35 | iron_axe |
| 9 | combat | 99 | golden_sword |
| 10 | brewing | 138 | potion with `Potion: "minecraft:water"` |
| 11 | inventory | 0 (live inventory) | chest |

- **776 distinct native item IDs** appear in search; vanilla excludes 13 registered
  command-only/noncreative items. Search is the registry's `fillItemGroup(SEARCH)`
  output, not a concatenation of categories.
- **43 potion types**, including `empty`; **42 variants** per potion/splash/lingering
  item; **38 tipped-arrow variants**.
- **34 enchantment types**, **99 search book variants**; category books use maximum
  levels, including the trident enchantments. Unbreaking, Mending and Vanishing books
  appear in both Tools and Combat as specified by the jar.
- **30 effects** with native `effect.minecraft.*` translation keys.
- **51 native spawn eggs**, plus two compatibility aliases in the metadata table.
- Vanilla's non-obvious assignments are retained: kelp, turtle eggs, conduits and
  chorus fruit are Miscellaneous; golden carrots are Brewing. The English hotbar tab
  label in this jar is **Saved Toolbars**.

## Data and consumer compatibility

Each stack tuple remains `[nativeItemId, 0, typedTagOrNull]`. The second field is kept
for structural compatibility, not variant selection. Flattened blocks, beds, banners,
fish, skulls and eggs have their own native IDs. Potion NBT uses resource-location
strings; `StoredEnchantments` uses string `id` tags and short `lvl` tags.

Top-level `potions`, `effects` and `eggs` remain available. Potion entries retain
`{id,name,effects}`; effects retain `{key,name,color,bad,modifiers}`. Egg entries retain
`[primaryColor,secondaryColor,nativeEntityName]`. `minecraft:evocation_illager` and
`minecraft:vindication_illager` alias the native evoker/vindicator metadata because
the current `Items.eggInfo` consumer still requests those two legacy keys.

## Screen and persistence integration

CreativeScreen uses dataset-scoped caches, translated searches, a 50-character search
field, native paper hints with JSON `display.Name`, and deep-copied typed NBT. Search
tooltips include the appropriate category, including enchantment-specific book groups.
NBT identity participates in grid merges and inventory change detection. Synchronization
visits all **46 player-container slots**, including offhand at zero-based slot **45**.

Saved toolbars use `minecraftjs.hotbars.1.13.2.v1` with a schema/version/protocol/data-version
envelope. The unversioned `minecraftjs.hotbars` key is never loaded or overwritten;
there is no lossy automatic conversion of 1.12 numeric saves. Typed arrays, long values,
NBT-only changes and raw-only stacks survive the new save/load path.

The existing asset loader already loads `creative.json`. Deploy the regenerated data
with the updated screen code; rebuild an embedded HTML distribution to include it.
The tests exercise the real screen methods and packet serializer with a recording GUI
surface and actual jar model resolution. They do not require a running Minecraft server.

The separately owned world pick-block/entity-pick path in `client/js/game/interaction.js`
still contained legacy item constants (including spawn egg 383) when this change was
verified. That path needs its own native-ID migration; it is separate from selecting
items in the creative inventory. `lib/jvm.js`, `lib/modelextract.js`, other port work,
and the pre-existing anvil fixes are outside this change.
