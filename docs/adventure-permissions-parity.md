# Adventure permission gates (2026-11-06)

This milestone applies native `CanDestroy` and `CanPlaceOn` checks to local mining and item use in 1.19.4. Rejected actions do not predict a break/place, consume an item or play a placement sound. Opening containers and other activated-block behavior stays ahead of the item-use restriction, as in Java. Native Use Item On packets are still sent when ItemStack.useOn returns PASS; an attack arm swing is not suppressed merely because the mining controller rejects a break. Item use in air is unchanged.

The parser/matcher supports block IDs, server block tags, properties, strict typed SNBT compound/list predicates, and native prefix parsing. Exact numeric NBT types matter; compound/list matching follows NbtUtils.compareNbt with unordered list subsets. SNBT strict options are opt-in so legacy hover capture parsing keeps its indexed-list behavior.

**Open integration gate:** block-entity constraints currently match the typed NBT available on a matching live renderer tile. That is received update NBT, not a complete native BlockEntity.saveWithFullMetadata view. Defaults, fields omitted by update tags, non-rendered block entities and client-side serialization still require work. In particular, the standalone predicate oracle's empty chest NBT is not evidence that this client reconstructs an empty chest's full native save state. USE-1 remains open for that gate and complete item-specific Adventure behavior.

## References and verification

Pinned Java 1.19.4 client SHA-1 `958928a560c9167687bea0cefeb7375da1e552a8`, official mappings `f14771b764f943c154d3a6fcb47694477e328148`: Player.hasRestricted / mayUseItemAt (`bym`), MultiPlayerGameMode (`fdn`), ItemStack.useOn (`cfv`), AdventureModeCheck (`cdf`), BlockPredicateArgument (`fd`), BlockStateParser (`ff`) and NbtUtils (`rq`).

`VerifyAdventure.java` runs native BlockPredicateArgument against real block states and constructed native block entities. Committed input/output fixtures cover 66 cases, including native serialization, tags, malformed properties, numeric types and suffix handling. `tools/test-adventure.mjs` compares the JavaScript parser with those outputs and tests the actual interaction gates, hands, containers and Survival/Creative behavior. The selected native audit passes 415 tests in 59 files, zero failures/skips; the browser bundle compiles.

`tools/port-1.19.4/probe-adventure.mjs` passes on the owned isolated pinned vanilla server: unauthorized placement/mining are rejected and permitted stone placement/mining are confirmed by server commands/updates using the actual received item NBT. A real efficiency-enchanted permitted tool provides native instant mining. Placement geometry preflight is fixed true for the known-valid test; no renderer, default block-entity serialization or complete item-use acceptance is inferred.

The historical Adventure/1.13/1.14 Wiki pages were restricted on this pass. Exact native code establishes the behavior above; unavailable Wiki contents are not marked verified. Older releases require their own block-name versus predicate and item-specific gates; backport status is recorded below as each branch is checked. No distributions were rebuilt.
