# Adventure permission gates (2026-11-06)

This milestone applies native `CanDestroy` and `CanPlaceOn` checks to local mining and item use in 1.19.4. Rejected actions do not predict a break/place, consume an item or play a placement sound. Opening containers and other activated-block behavior stays ahead of the item-use restriction, as in Java. Native Use Item On packets are still sent when ItemStack.useOn returns PASS; an attack arm swing is not suppressed merely because the mining controller rejects a break. Item use in air is unchanged.

The parser/matcher supports block IDs, server block tags, properties, strict typed SNBT compound/list predicates, and native prefix parsing. Exact numeric NBT types matter; compound/list matching follows NbtUtils.compareNbt with unordered list subsets. SNBT strict options are opt-in so legacy hover capture parsing keeps its indexed-list behavior.

**Open integration gate:** block-entity constraints currently match the typed NBT available on a matching live renderer tile. That is received update NBT, not a complete native BlockEntity.saveWithFullMetadata view. Defaults, fields omitted by update tags, non-rendered block entities and client-side serialization still require work. In particular, the standalone predicate oracle's empty chest NBT is not evidence that this client reconstructs an empty chest's full native save state. USE-1 remains open for that gate and complete item-specific Adventure behavior.

## References and verification

Pinned Java 1.19.4 client SHA-1 `958928a560c9167687bea0cefeb7375da1e552a8`, official mappings `f14771b764f943c154d3a6fcb47694477e328148`: Player.blockActionRestricted / mayUseItemAt (`bym`), MultiPlayerGameMode (`fdn`), ItemStack.useOn (`cfv`), AdventureModeCheck (`cdf`), BlockPredicateArgument (`fd`), BlockStateParser (`ff`) and NbtUtils (`rq`).

`VerifyAdventure.java` runs native BlockPredicateArgument against real block states and constructed native block entities. Committed input/output fixtures cover 67 cases, including native serialization, tags, malformed properties, numeric types and suffix handling. `tools/test-adventure.mjs` compares the JavaScript parser with those outputs and tests the actual interaction gates, hands, containers and Survival/Creative behavior. The selected native audit passes 416 tests in 59 files, zero failures/skips; the browser bundle compiles.

`tools/port-1.19.4/probe-adventure.mjs` passes on the owned isolated pinned vanilla server: unauthorized placement/mining are rejected and permitted stone placement/mining are confirmed by server commands/updates using the actual received item NBT. A real efficiency-enchanted permitted tool provides native instant mining. Placement geometry preflight is fixed true for the known-valid test; no renderer, default block-entity serialization or complete item-use acceptance is inferred.

The historical Adventure/1.13/1.14 Wiki pages were restricted on this pass. Exact native code establishes the behavior above; unavailable Wiki contents are not marked verified. Older releases require their own block-name versus predicate and item-specific gates; backport status is recorded below as each branch is checked. No distributions were rebuilt.

## Descending backport review

| Target | Native permission format / checked release differences | Focused tests |
| --- | --- | ---: |
| 1.19.4 | Block/tag/property/NBT predicate gates; native JVM oracle and isolated server | 416 selected native audit |
| 1.18.2 | Same gate in ItemStack `buw.useOn` | 83 |
| 1.17.1 | Same gate in ItemStack `bqq.useOn` | 83 |
| 1.16.5 | Same gate in ItemStack `bmb.useOn` | 83 |
| 1.15.2 | Same gate in ItemStack `ben.useOn` | 83 |
| 1.14.4 | Same gate in ItemStack `bcj.useOn` | 83 |
| 1.13.2 | ItemStack `ate`; pinned Brigadier 1.0.14 and SNBT keep older quote rules; no newer oak-sign fixture is treated as native content | 78 |
| 1.12.2 | ItemStack `aip` resolves block names/numeric IDs; no modern predicates or universal ItemStack-use gate | 20 |
| 1.8.9 | ItemStack `zx` resolves block names/numeric IDs; no modern predicates or universal ItemStack-use gate | 21 |

All listed targets compile as browser ESM bundles. Older item paths retain their own results: minecarts bypass edit permission; spawn eggs return client success before the server's permission check. Fireworks are particularly different: native 1.8.9 ItemFirework `zo` returns false on the client, whereas 1.12.2 `aif` returns success. The 1.8.9 false-success/swing path is corrected. Native references also include old ItemMinecart `aad` / `aiy`, ItemMonsterPlacer `aax` / `ajv`, and block-name lookup `afh.b(String)` / `aow.b(String)`. Complete item-specific edit-position/face/replaceability acceptance remains open.

The 1.19.4 predicate fixture is a shared parser/matcher oracle when run on older predicate-capable targets; it does not claim those targets have newer fields in their own block-entity save data. Only the corresponding target's actual block/metadata state is consumed in production. The same correction is forwarded to the existing 1.20.6 **1.19.4 graphical baseline**, with no claim that native 766 Play/item components are complete.

Re-run the pinned JVM oracle with `node tools/port-1.19.4/verify-adventure.mjs` after preparing native inputs. The committed input list and expected output are separate; `--write` explicitly refreshes the vectors. Run the isolated server fixture and `node tools/port-1.19.4/probe-adventure.mjs` separately for wire/game acceptance.
