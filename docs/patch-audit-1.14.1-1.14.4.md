# Patch review: Java 1.14.1–1.14.4

Reviewed 2026-10-26 against each requested wiki page and the pinned final 1.14.4 jar. These releases contain **39 Additions/Changes topic headings and 233 listed bug tickets**. The table records scope and current evidence; it does not certify all tickets. Final 1.14.4 behavior takes precedence over changes reverted before release.

## [1.14.1](https://minecraft.wiki/w/Java_Edition_1.14.1)

9 topic headings; 62 bug tickets inventoried, not individually certified.

| Topic | Disposition | Finding |
| --- | --- | --- |
| Additions: Controls | partial | F3+Escape and survival/adventure F3+N routes implemented; complete native key combinations and pause behavior need live comparison. |
| Additions: Splashes | partial | Pinned native assets supply splashes; date-specific and randomized title selection need comparison. |
| Changes: Campfire | partial | Native collision/light/sound, food rendering and smoke implemented. Flaming-arrow ignition and waterlogged rejection are server-owned; live permutations remain. |
| Changes: Crafting table | partial | Pinned 1.14.4 assets/data are used; exhaustive target behavior and visual comparisons remain unverified. |
| Changes: Iron ore | partial | Pinned 1.14.4 assets/data are used; exhaustive target behavior and visual comparisons remain unverified. |
| Changes: Iron horse armor | partial | Pinned 1.14.4 assets/data are used; exhaustive target behavior and visual comparisons remain unverified. |
| Changes: Leather horse armor | partial | Pinned 1.14.4 assets/data are used; exhaustive target behavior and visual comparisons remain unverified. |
| Changes: Villages | server-owned | Vanilla server owns the behavior; received state and interactions still require end-to-end validation. |
| Changes: Controls | partial | F3+Escape and survival/adventure F3+N routes implemented; complete native key combinations and pause behavior need live comparison. |

## [1.14.2](https://minecraft.wiki/w/Java_Edition_1.14.2)

9 topic headings; 35 bug tickets inventoried, not individually certified.

| Topic | Disposition | Finding |
| --- | --- | --- |
| Additions: Font | partial | Native glyph resources and font providers are loaded; Vietnamese/Runic/Armenian/Hebrew visual samples need comparison. |
| Changes: Campfire | partial | Native collision/light/sound, food rendering and smoke implemented. Flaming-arrow ignition and waterlogged rejection are server-owned; live permutations remain. |
| Changes: Shulker boxes | partial | Pinned 1.14.4 assets/data are used; exhaustive target behavior and visual comparisons remain unverified. |
| Changes: Parrots | server-owned | Vanilla server owns the behavior; received state and interactions still require end-to-end validation. |
| Changes: Raids | server-owned | Vanilla server owns the behavior; received state and interactions still require end-to-end validation. |
| Changes: Debug screen | not-applicable | Server chunk count is an integrated-server statistic; this browser client connects to an external server. |
| Changes: Error messages | server-owned | Region-file diagnostics originate in the vanilla server; server logs are not browser client UI. |
| Changes: Lighting | partial | Independent 1.14 light packets and chunk updates are implemented; converted-world/rejoin lighting scenarios remain unverified. |
| Changes: Splashes | partial | Pinned 1.14.4 assets/data are used; exhaustive target behavior and visual comparisons remain unverified. |

## [1.14.3](https://minecraft.wiki/w/Java_Edition_1.14.3)

10 topic headings; 82 bug tickets inventoried, not individually certified.

| Topic | Disposition | Finding |
| --- | --- | --- |
| Additions: /gamerule | server-owned | Vanilla server owns the behavior; received state and interactions still require end-to-end validation. |
| Additions: Languages | partial | Pinned language resources are available; complete native language ordering, shaping and selection require comparison. |
| Changes: Lanterns | partial | Native support shapes are extracted; all pane/bar attachment permutations need authoritative placement tests. |
| Changes: Pressure plates and torches | partial | Torch placement on panes/bars adapted; pressure plates and all support faces need live tests. |
| Changes: General | partial | Target restores crafting repair. Server output is authoritative; local recipe-book/prediction paths still need adaptation. |
| Changes: Villagers | server-owned | Vanilla server owns the behavior; received state and interactions still require end-to-end validation. |
| Changes: Illager patrols | server-owned | Vanilla server owns the behavior; received state and interactions still require end-to-end validation. |
| Changes: Enchantments | partial | All 37 target definitions extracted. Temporary 1.14 protection combinations are not target behavior; enchanting UI/permutation tests remain. |
| Changes: Advancements | server-owned | Server evaluates the restored advancement requirements, excluding Saturation; full received advancement sequence untested. |
| Changes: Performance | partial | No comparative frame/allocation or server-tick benchmark completed; no optimization claim. |

## [1.14.4](https://minecraft.wiki/w/Java_Edition_1.14.4)

11 topic headings; 54 bug tickets inventoried, not individually certified.

| Topic | Disposition | Finding |
| --- | --- | --- |
| Additions: /debug | server-owned | Vanilla server owns the behavior; received state and interactions still require end-to-end validation. |
| Additions: server.properties | server-owned | Vanilla server owns the behavior; received state and interactions still require end-to-end validation. |
| Additions: Splashes | partial | Pinned 1.14.4 assets/data are used; exhaustive target behavior and visual comparisons remain unverified. |
| Changes: Suspicious stew | partial | Native food action and effect icons implemented; poppy stew Night Vision is server-owned and needs live testing. |
| Changes: Pillagers | partial | Native arm texture and default model loaded; crossbow arm poses implemented, raid/charging animation variants need comparison. |
| Changes: Villagers | server-owned | Vanilla server owns the behavior; received state and interactions still require end-to-end validation. |
| Changes: Permissions | server-owned | Vanilla server owns the behavior; received state and interactions still require end-to-end validation. |
| Changes: Camera | partial | Removed obsolete first-person pivot offset; visual comparison of all held-item/camera transitions remains. |
| Changes: client.jar | not-applicable | Realms service code moved back into the Java client jar; this browser client has no Realms integration. |
| Changes: Performance | partial | No comparative frame/allocation or server-tick benchmark completed; no optimization claim. |
| Changes: Minecraft Realms | not-applicable | Realms activity UI is outside the currently implemented external-server browser-client scope. |

The [machine-readable inventory](../tools/port-1.14.4/patch-checklist.json) retains source hashes and ticket IDs. The [feature audit](feature-audit-1.14.4.md) tracks implementation and remaining acceptance scenarios. Server-owned changes still require client/server validation; they are not counted as passed.
