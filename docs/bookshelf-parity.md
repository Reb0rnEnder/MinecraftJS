# Chiseled-bookshelf interactions — native 1.19.4 / 1.20.6

Implemented and checked 2026-11-17 against each target's pinned jar and official mappings.

The client now distinguishes front-face bookshelf interactions from ordinary side/back block placement. It maps all six slots using the exact facing, row and float column boundaries. A completed insertion/removal swings once; an empty slot with an ineligible item consumes the click without swinging. The click stops before a second offhand interaction or generic item placement. Secondary use retains native bypass behavior. Inventory, block-state occupancy, sound and block-entity content remain authoritative; the native client-side add/remove methods do not change them.

Server `minecraft:bookshelf_books` tags control eligibility. No item-name-only whitelist overrides server tags. The native fallback differs by version:

| Target | Native availability | Accepted default books | Block-use behavior |
| --- | --- | --- | --- |
| 1.19.4 | `minecraft:update_1_20` experiment only | Book, writable book, written book, enchanted book | One block-use method handles both hands; disabled experiment consumes/stops the attempted click without action |
| 1.20.6 | Stable block | The same four plus knowledge book | Item interaction first; default block interaction runs only for the main hand |

This is an adapted backport to the existing 1.19.4 prototype, not an unconditional import of later stable behavior. Eight older targets do not have this block and receive no bookshelf feature. The modern knowledge-book addition is deliberately excluded from 1.19.4. Historical cross-check: [Mojang 1.19.3 experiments](https://www.minecraft.net/en-us/article/minecraft-java-edition-1-19-3), [Wiki experiment history](https://minecraft.wiki/w/Experiments), [knowledge-book history: accepted since 1.20 RC1](https://minecraft.wiki/w/Knowledge_Book).

## Native fixtures and tests

Each native oracle executes **92 actual face/boundary hit tests** and **1,008 actual client interaction results**, including occupied/empty slots, all four directions, both row selections, float thresholds and seven held-item cases. `useItemOn`/`useWithoutItem` in 1.20.6 and the older unified `use` in 1.19.4 execute unmodified. The 1.19.4 tag is read from the bundled experiment rather than the stable default pack.

The test world supplies one block entity through an added branch-free accessor subclass and sets the client-world flag; the 1.19.4 player similarly supplies its hand stack. These are test inputs. No native method bodies, server outcomes or graphics metrics are invented. Original native `.class` bytes are compared against the oracle jar before execution. Test subclasses use Java 17 class format; no later JVM classfile API is required.

Reproduce with the target's `tools/port-<version>/bookshelf-fixtures.mjs --check` and `tools/test-bookshelf-<version>.mjs`. The 1.20.6 full gate passes **489 tests**, zero failures/skips. The adapted 1.19.4 batch passes **20 tests** including native bookshelf, attachment placement, slab/sound and tag regressions. Both browser bundles build.

The four focused tests per target additionally exercise the real interaction sender: a single click, unchanged counts/occupancy, no speculative shelf state or local feedback sound, server rejection state remaining visible, server tag replacement, secondary use and each target's hand/feature rules. Live screenshots and a complete reconnect/contents acceptance recording remain open in CONTENT-04. Neither target is certified for full parity by this batch.

No assets changed in this batch; the preceding modern development assets include the bat/pot model additions. Published HTML/static distributions have not been regenerated.
