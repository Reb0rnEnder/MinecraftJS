# Adventure component parity — 1.20.6

2026-11-15. The target still used the 1.19.4 CanDestroy/CanPlaceOn NBT parser for actual Adventure permissions. Those lists cannot grant permissions in 1.20.6: this release uses effective `can_break` / `can_place_on` components. Mining start/continuation and actual item-use prediction now consume them, including the selected hand. Container activation remains independent, and Survival/Creative keep their existing paths.

The exact native client jar (`05b6f1c6b46a29d6ea82b4e0d42190e42402030f`) and official mappings were used. `AdventureModePredicate`, `BlockPredicate`, `StatePropertiesPredicate` and its Exact/Ranged matchers were reviewed. Native ItemStack codecs, native private `BlockPredicate.matchesState`, and native `NbtPredicate.matches` execute in `tools/port-1.20.6/ExtractAdventure1206.java`. The input jar, mappings and unsigned oracle class bytes are verified before generation.

The [official 1.20.5 notes](https://www.minecraft.net/es-es/article/minecraft-java-edition-1-20-5) and [versioned Wiki history](https://minecraft.wiki/w/Java_Edition_1.20.5) confirm the switch from CanDestroy/CanPlaceOn to components. No component protocol or permissions implementation is backported to an older target.

## Decoder corrections

The pinned upstream protocol schema was inaccurate in two more places:

- Each RangedMatcher bound is an **Optional string**. An absent minimum/maximum remains unbounded; it is not an empty string.
- An optional NbtPredicate has a **separate presence boolean**, followed by the compound tag. It cannot use an optional-NBT END-tag sentinel.

Both are corrected in the schema generator, not just its generated output. Without these fixes, customized items could consume the wrong bytes inside inventory, equipment, trade or other component-bearing packets.

## Native matching

Block-holder lists and live server block tags are combined with state and NBT conditions using AND. Predicate alternatives use OR. Native Property domains are extracted for all **688 blocks with properties**, sharing **46 comparable domains**. Integer bounds are parsed as native integers and checked against the property's legal values; boolean and enum comparisons retain their native ordering, including Direction's declaration order. Native empty, absent, removed and tooltip-hidden components are distinguished.

The generated `tools/fixtures/adventure-1.20.6.json` has **76 Java-produced stacks and permission results**, covering both components, holder sets, tags, exact/ranged integer/boolean/enum properties, omitted bounds, invalid values and typed NBT subsets. JS decodes and re-encodes every stack byte-for-byte, then compares its actual permission result. Five integration checks exercise mining/placement, containers, hands, legacy-NBT rejection, patch removal and refreshed server tags.

Run `npm run adventure-fixtures:1.20.6` to regenerate, or `node tools/port-1.20.6/adventure-fixtures.mjs --check` to verify. These checks and `tools/test-adventure.mjs` are now in the full target gate. The complete gate passes **323 tests, zero failures/skips**, and the browser entrypoint bundles.

## Backport review and remaining acceptance

All older Adventure regressions were run after the target-specific implementation changed:

| Target | Tests | Result | Eligibility |
| --- | ---: | --- | --- |
| 1.8.9 | 9 | Pass | Keep native legacy item/block permission rules |
| 1.12.2 | 9 | Pass | Keep native legacy item/block permission rules |
| 1.13.2 | 67 | Pass | Keep native text/NBT predicates |
| 1.14.4 | 72 | Pass | Keep native text/NBT predicates |
| 1.15.2 | 72 | Pass | Keep native text/NBT predicates |
| 1.16.5 | 72 | Pass | Keep native text/NBT predicates |
| 1.17.1 | 72 | Pass | Keep native text/NBT predicates |
| 1.18.2 | 72 | Pass | Keep native text/NBT predicates |
| 1.19.4 | 72 | Pass | Keep native text/NBT predicates |

That is **517 passing older-version checks**. This second batch changes only 1.20.6 source; the preceding jigsaw batch was pushed to every eligible older branch.

**Still open:** reconstructing native `BlockEntity.saveWithFullMetadata` data for all block-entity types, including types without a renderer and default/omitted fields; native permission tooltip lists; live server and graphical acceptance. The NBT oracle cases supply an explicit actual compound to the native NbtPredicate rather than pretending to construct a complete live BlockInWorld or block entity. The client currently checks available typed block-entity NBT; it does not fabricate missing metadata. Full Adventure/client parity remains partial. Distributions were not rebuilt by this source batch.
